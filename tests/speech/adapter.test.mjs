// Isolated audio/fetch substitutes; never contact the live app or claim browser QA.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// Build this test's own entry and chunks from the checked-out source on every run.
// Keep them separate from controller.test.mjs and the shared adapter smoke build.
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const outputUrl = new URL('../../.runtime/speech-adapter-test-build/', import.meta.url);
await build({
  root: projectRoot,
  configFile: false,
  logLevel: 'silent',
  build: {
    outDir: fileURLToPath(outputUrl),
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('../../frontend/src/speech/adapter.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'speech-test.js',
    },
  },
});
const { CampusSpeechAdapter } = await import(new URL('speech-test.js', outputUrl).href);
const context = () => ({request_id:crypto.randomUUID(),session_id:crypto.randomUUID(),signal:new AbortController().signal});
const callbacks = (events) => ({onText(){},onStart:id=>events.push(['start',id]),onEnd:id=>events.push(['end',id]),onFailure:(id,code)=>events.push(['failure',id,code])});

test('context abort stops already-playing audio and suppresses late end', async () => {
  const originals={Audio:globalThis.Audio,fetch:globalThis.fetch}; const instances=[];
  class FakeAudio {
    constructor(){this.volume=1;this.muted=false;this.paused=true;this.ended=false;instances.push(this);}
    async play(){this.onplaying?.();}
    pause(){this.paused=true;}
    removeAttribute(){}
    load(){}
  }
  const events=[]; const controller=new AbortController(); const ctx={...context(),signal:controller.signal}; const utterance=crypto.randomUUID();
  globalThis.Audio=FakeAudio;
  globalThis.fetch=async (url) => url==='/api/speech/tts'
    ? new Response(JSON.stringify({request_id:ctx.request_id,utterance_id:utterance,audio_url:'/api/speech/audio/0123456789abcdef0123456789abcdef',mime_type:'audio/mpeg',timestamps:'none'}),{status:200,headers:{'content-type':'application/json'}})
    : new Response(new Uint8Array([73,68,51,4,0,0,1]),{status:200,headers:{'content-type':'audio/mpeg'}});
  try {
    const adapter=new CampusSpeechAdapter();
    assert.equal((await adapter.speak(ctx,utterance,'fixture','edge:test',callbacks(events))).status,'ready');
    const lateEnd=instances[0].onended;
    controller.abort();
    lateEnd();
    assert.equal(instances[0].paused,true);
    assert.deepEqual(events,[['start',utterance]]);
  } finally {Object.assign(globalThis,originals);}
});

test('late provider failure after stop never triggers stale callback', async () => {
  const originals={Audio:globalThis.Audio,fetch:globalThis.fetch};
  let resolve; const response=new Promise(r=>{resolve=r;}); const events=[];
  globalThis.Audio=class {};
  globalThis.fetch=async (url)=>url==='/api/speech/stop'
    ? new Response(JSON.stringify({local_stopped:true,upstream_stop:'unconfirmed'}))
    : response;
  try {
    const adapter=new CampusSpeechAdapter(); const ctx=context();
    const pending=adapter.speak(ctx,crypto.randomUUID(),'fixture','edge:test',callbacks(events));
    await new Promise(r=>setTimeout(r,0));
    await adapter.stop(ctx.request_id);
    resolve(new Response(JSON.stringify({error:{code:'fixture_late_failure'}}),{status:503}));
    assert.equal((await pending).error_code,'stopped');
    assert.deepEqual(events,[]);
  } finally {Object.assign(globalThis,originals);}
});

test('B02 old audio.play rejection leaves the new shared player callbacks intact', async () => {
  const original = { Audio: globalThis.Audio, fetch: globalThis.fetch };
  let rejectOld, player;
  class FakeAudio {
    constructor() { player = this; this.volume = 1; this.muted = false; this.plays = 0; }
    play() {
      this.plays += 1;
      if (this.plays === 1) return new Promise((_, reject) => { rejectOld = reject; });
      this.onplaying?.();
      return Promise.resolve();
    }
    pause() {} removeAttribute() {} load() {}
  }
  globalThis.Audio = FakeAudio;
  globalThis.fetch = async (url, options = {}) => {
    if (url === '/api/speech/tts') {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ request_id: body.request_id, utterance_id: body.utterance_id, audio_url: '/api/speech/audio/fixture', mime_type: 'audio/mpeg', timestamps: 'none' }), { headers: { 'content-type': 'application/json' } });
    }
    if (url === '/api/speech/stop') return new Response(JSON.stringify({ local_stopped: true, upstream_stop: 'unconfirmed' }));
    return new Response(new Uint8Array([73, 68, 51, 4]), { headers: { 'content-type': 'audio/mpeg' } });
  };
  try {
    const a = new CampusSpeechAdapter(), old = context(), fresh = context(), events = [];
    const pending = a.speak(old, 'old', '旧内容', 'edge:test', callbacks(events));
    await new Promise((r) => setTimeout(r, 0));
    await a.stop(old.request_id);
    assert.equal((await a.speak(fresh, 'fresh', '新内容', 'edge:test', callbacks(events))).status, 'ready');
    const currentEnd = player.onended;
    rejectOld(new DOMException('old playback rejected', 'NotAllowedError'));
    assert.equal((await pending).error_code, 'stopped');
    assert.equal(player.onended, currentEnd);
    currentEnd();
    assert.deepEqual(events, [['start', 'fresh'], ['end', 'fresh']]);
  } finally { Object.assign(globalThis, original); }
});
