// Isolated audio/fetch substitutes; never contact the live app or claim browser QA.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CampusSpeechAdapter } from '../../.runtime/adapter-build/speech.js';
const context = () => ({request_id:crypto.randomUUID(),session_id:crypto.randomUUID(),signal:new AbortController().signal});
const callbacks = (events) => ({onText(){},onStart:id=>events.push(['start',id]),onEnd:id=>events.push(['end',id]),onFailure:(id,code)=>events.push(['failure',id,code])});

test('context abort stops already-playing audio and suppresses late end', async () => {
  const originals={Audio:globalThis.Audio,fetch:globalThis.fetch}; const instances=[];
  class FakeAudio {
    constructor(){instances.push(this);}
    async play(){this.onplaying?.();}
    pause(){this.paused=true;}
    removeAttribute(){}
    load(){}
  }
  const events=[]; const controller=new AbortController(); const ctx={...context(),signal:controller.signal}; const utterance=crypto.randomUUID();
  globalThis.Audio=FakeAudio;
  globalThis.fetch=async () => new Response(JSON.stringify({request_id:ctx.request_id,utterance_id:utterance,audio_url:'/api/speech/audio/test'}),{status:200});
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
