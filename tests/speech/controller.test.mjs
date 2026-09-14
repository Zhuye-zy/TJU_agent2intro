import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    outDir: '.runtime/adapter-build',
    emptyOutDir: false,
    minify: false,
    lib: { entry: 'frontend/src/speech/controller.ts', formats: ['es'], fileName: () => 'controller-r2.js' },
  },
});

const moduleUrl = pathToFileURL(`${process.cwd()}/.runtime/adapter-build/controller-r2.js`).href;
const { CampusSpeechController, IncrementalSpeechSanitizer, sanitizeSpeechText } = await import(moduleUrl);

const ids = () => ({
  request_id: crypto.randomUUID(),
  session_id: crypto.randomUUID(),
  campus_id: 'weijinlu',
  generation_id: crypto.randomUUID(),
  voice_id: 'edge:zh-CN-XiaoxiaoNeural',
  mode: 'full',
  signal: new AbortController().signal,
});

class FakeAdapter {
  constructor({ blocked = false, failPrepare = false } = {}) {
    this.blocked = blocked;
    this.failPrepare = failPrepare;
    this.prepared = [];
    this.played = [];
    this.concurrent = 0;
    this.maxConcurrent = 0;
    this.callbacks = null;
    this.current = null;
  }
  async activatePlayback() { return { status: 'ready' }; }
  async prepareSpeech(context, utteranceId, text, voiceId) {
    if (this.failPrepare) return { status: 'failed', error_code: 'tts_unavailable' };
    const item = { requestId: context.request_id, utteranceId, context, text, voiceId, kind: 'server', released: false };
    this.prepared.push(text);
    return item;
  }
  async playPreparedSpeech(item, callbacks) {
    this.current = item;
    this.callbacks = callbacks;
    if (this.blocked) {
      callbacks.onFailure(item.utteranceId, 'playback_permission_denied');
      return { status: 'failed', error_code: 'playback_permission_denied' };
    }
    this.concurrent += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrent);
    this.played.push(item.text);
    callbacks.onStart(item.utteranceId);
    setTimeout(() => { this.concurrent -= 1; callbacks.onEnd(item.utteranceId); }, 2);
    return { status: 'ready' };
  }
  async resumePlayback() {
    if (this.paused) { this.paused=false; return { status: 'ready' }; }
    if (!this.blocked || !this.current) return { status: 'failed', error_code: 'nothing_to_resume' };
    this.blocked = false;
    this.played.push(this.current.text);
    this.callbacks.onStart(this.current.utteranceId);
    setTimeout(() => this.callbacks.onEnd(this.current.utteranceId), 2);
    return { status: 'ready' };
  }
  pausePlayback() { if (!this.current) return { status: 'failed', error_code: 'nothing_playing' }; this.paused=true; return { status: 'ready' }; }
  releasePrepared(item) { item.released = true; }
  async stop() { return { local_stopped: true, upstream_stop: 'not_started' }; }
  async listVoices() { return [{ id: 'edge:zh-CN-XiaoxiaoNeural', name: '晓晓', locale: 'zh-CN', provider: 'edge' }]; }
  dispose() {}
}

test('sanitizer preserves labels and campus numbers while removing URLs, code, images, citations, HTML, and source-only tail', () => {
  const input = '# 导览\n- 26号楼开放时间为2026-09-14 08:30，共12间教室。[校历](https://example.edu/a?q=1)【2】\n- 详情见 https://example.edu/raw 。<b>请预约</b>。\n![图](https://img.example/a.png)\n```js\nfetch("https://secret.example")\n```\n## 来源\n- https://source.example';
  const output = sanitizeSpeechText(input).text;
  assert.match(output, /26号楼/);
  assert.match(output, /2026-09-14 08:30/);
  assert.match(output, /12间教室/);
  assert.match(output, /校历/);
  assert.match(output, /请预约/);
  assert.doesNotMatch(output, /https|example|fetch|来源|【2】|图/u);
});

test('split bare URL, Markdown link, and code fence produce the same incremental speech as complete text', () => {
  const chunks = ['第一句介绍完成。裸地址是 https://exa', 'mple.edu/raw 。下一项见 [校', '园页](https://example.', 'edu/path)。```ts\nconst u="https://bad.', 'example";\n```最后一项有3个入口，开放到18:30。'];
  const full = chunks.join('');
  const sanitizer = new IncrementalSpeechSanitizer();
  const incremental = [];
  for (const chunk of chunks) incremental.push(...sanitizer.append(chunk));
  incremental.push(...sanitizer.finish(full));
  assert.equal(incremental.join(''), sanitizeSpeechText(full).text);
  assert.doesNotMatch(incremental.join(''), /https|example|const/u);
});

test('unclosed constructs and total speech text have bounded safe failures', () => {
  const construct = new IncrementalSpeechSanitizer();
  assert.throws(() => construct.append('```' + 'x'.repeat(4097)), /speech_sanitizer_limit/);
  const total = new IncrementalSpeechSanitizer();
  assert.throws(() => total.append('中'.repeat(23001)), /speech_queue_overflow/);
});

test('controller requires a page-session activation and then plays five segments serially', async () => {
  const adapter = new FakeAdapter();
  const controller = new CampusSpeechController({ adapter });
  assert.equal((await controller.begin(ids())).error_code, 'speech_not_enabled');
  assert.equal((await controller.enable(true)).status, 'ready');
  for (let i = 0; i < 5; i += 1) {
    const run = ids();
    assert.equal((await controller.playSegment(run, `这是第${i + 1}次完整中文播报。`, `answer-${i + 1}`)).status, 'ready');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(adapter.played.length, 5);
  assert.equal(adapter.maxConcurrent, 1);
  assert.ok(adapter.prepared.length >= 5);
});

test('first complete segment starts before completed and completed does not replay it', async () => {
  const adapter = new FakeAdapter();
  const controller = new CampusSpeechController({ adapter });
  await controller.enable(true);
  const run = ids();
  const first = '这是已经完整封口的第一段中文核心答案，可以立即开始合成和播放。';
  const final = `${first}这是完成事件才补齐的末段`;
  await controller.begin(run);
  controller.append(run.generation_id, `${first}这是完成事件`);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(adapter.played, [first]);
  await controller.finish(run.generation_id, final);
  assert.equal(adapter.played.filter((text) => text === first).length, 1);
});

test('brief, full, and selected text share sanitization and playback entry points', async () => {
  const adapter = new FakeAdapter();
  const controller = new CampusSpeechController({ adapter });
  await controller.enable(true);
  const brief = { ...ids(), mode: 'brief' };
  const answer = '核心第一句说明天津大学校区导览服务已经准备好，可以查看各个地点。核心第二句说明服务时间为08:30，并准确保留日期和数量。第三句不会进入自动短播，但可以通过继续讲来播放。';
  await controller.begin(brief);
  controller.append(brief.generation_id, answer);
  await controller.finish(brief.generation_id, answer);
  assert.equal(adapter.played.length, 2);
  assert.equal((await controller.continueRemaining()).status, 'ready');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(adapter.played[2], /第三句/);
  const full = ids();
  await controller.playFull(full, '[完整标题](https://example.edu)。全文第二句。');
  await new Promise((resolve) => setTimeout(resolve, 10));
  const selected = ids();
  await controller.playSegment(selected, '选中的第26号楼。', 'selection-1');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal((await controller.replay()).status, 'ready');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(adapter.played.join(''), /完整标题/);
  assert.match(adapter.played.join(''), /第26号楼/);
  assert.doesNotMatch(adapter.played.join(''), /https/);
});

test('pause and resume expose the actual adapter boundary', async () => {
  const adapter = new FakeAdapter();
  const controller = new CampusSpeechController({ adapter });
  await controller.enable(true);
  await controller.playSegment(ids(), '这是一段用于暂停边界的中文语音。', 'pause');
  assert.equal((await controller.pause()).status, 'ready');
  assert.equal((await controller.resume()).status, 'ready');
});

test('verbatim URL playback is isolated behind an explicit-request guard', async () => {
  const adapter = new FakeAdapter();
  const controller = new CampusSpeechController({ adapter });
  await controller.enable(true);
  const run = ids();
  assert.equal((await controller.playVerbatimUrl(run, '网址是 https://www.tju.edu.cn/', 'url', false)).error_code, 'explicit_url_request_required');
  assert.equal((await controller.playVerbatimUrl(run, '网址是 https://www.tju.edu.cn/', 'url', true)).status, 'ready');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.match(adapter.played.at(-1), /https:\/\/www\.tju\.edu\.cn\//);
});

test('autoplay rejection retains the current segment and explicit resume plays it', async () => {
  const adapter = new FakeAdapter({ blocked: true });
  const controller = new CampusSpeechController({ adapter });
  const progress = [];
  controller.subscribe((event) => progress.push(event));
  await controller.enable(true);
  const run = ids();
  await controller.playSegment(run, '权限恢复后仍应播放这一段。', 'blocked-1');
  await new Promise((resolve) => setTimeout(resolve, 2));
  assert.equal(progress.at(-1).code, 'playback_permission_denied');
  assert.equal((await controller.enable(true)).status, 'ready');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(adapter.played, ['权限恢复后仍应播放这一段。']);
});

test('stop invalidates late ended callbacks and a TTS failure remains retryable', async () => {
  const adapter = new FakeAdapter();
  const controller = new CampusSpeechController({ adapter });
  const progress = [];
  controller.subscribe((event) => progress.push(event));
  await controller.enable(true);
  const oldRun = ids();
  await controller.playSegment(oldRun, '旧校区播报。', 'old');
  const staleEnd = adapter.callbacks.onEnd;
  const staleId = adapter.current.utteranceId;
  await controller.stop('campus_change');
  const freshRun = ids();
  await controller.begin(freshRun);
  staleEnd(staleId);
  assert.notEqual(progress.at(-1)?.generation_id, oldRun.generation_id);

  const failing = new CampusSpeechController({ adapter: new FakeAdapter({ failPrepare: true }) });
  const failed = [];
  failing.subscribe((event) => failed.push(event));
  await failing.enable(true);
  await failing.playSegment(ids(), '合成失败时文字仍由界面保留。', 'retryable');
  await new Promise((resolve) => setTimeout(resolve, 2));
  assert.equal(failed.at(-1).code, 'tts_unavailable');
  assert.equal((await failing.resume()).status, 'ready');
});

test('B01 every Markdown link split preserves the exact spoken text without leaking delimiters', () => {
  const full = '[这是一段具有完整句号且足够长的校园讲解标签需要保留标签内容。](https://example.edu/a)。后续导览内容。';
  for (let cut = 0; cut <= full.length; cut += 1) {
    const s = new IncrementalSpeechSanitizer();
    const output = [...s.append(full.slice(0, cut)), ...s.append(full.slice(cut)), ...s.finish(full)].join('');
    assert.equal(output, sanitizeSpeechText(full).text, `split ${cut}`);
  }
  const s = new IncrementalSpeechSanitizer();
  const prefix = '这段完整文字足够长所以会在增量阶段真实排队并形成不可变的已读前缀。';
  s.append(prefix);
  assert.throws(() => s.finish('替换了全部正文。'), /speech_final_mismatch/);
});

test('B02 a delayed old play failure cannot clear or report failure for the fresh generation', async () => {
  let failOld;
  const adapter = new FakeAdapter();
  adapter.playPreparedSpeech = async (item, callbacks) => {
    if (item.context.request_id === 'old') return new Promise((resolve) => { failOld = resolve; });
    callbacks.onStart(item.utteranceId);
    return { status: 'ready' };
  };
  const c = new CampusSpeechController({ adapter }), events = [];
  c.subscribe((e) => events.push(e));
  await c.enable(true);
  await c.playSegment({ ...ids(), request_id: 'old' }, '旧回答。', 'old');
  await new Promise((r) => setTimeout(r, 0));
  await c.stop('new_request');
  await c.playSegment({ ...ids(), request_id: 'fresh' }, '新回答。', 'fresh');
  await new Promise((r) => setTimeout(r, 0));
  failOld({ status: 'failed', error_code: 'playback_failed' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(events.at(-1).request_id, 'fresh');
  assert.equal(events.at(-1).status, 'speaking');
  assert.ok(!events.some((e) => e.request_id === 'fresh' && e.status === 'error'));
  await c.stop('clear');
});

test('B03 clearing, changing campus, cancelling or starting a new request invalidates replay caches', async () => {
  for (const reason of ['clear', 'campus_change', 'cancel', 'new_request']) {
    const c = new CampusSpeechController({ adapter: new FakeAdapter() });
    await c.enable(true);
    const run = { ...ids(), mode: 'brief' };
    const text = '第一句的校园介绍足够长用来独立排入播放队列并且避免和下一句合并。第二句的校园介绍也足够长用来独立排入播放队列并且保留后续内容。第三句是旧校区剩余内容。';
    await c.begin(run); await c.finish(run.generation_id, text);
    await c.stop(reason);
    assert.equal((await c.continueRemaining()).error_code, 'nothing_to_continue', reason);
    assert.equal((await c.replay()).error_code, 'nothing_to_replay', reason);
  }
});

test('B04 brief counts actual sentences, bounds long first sentences, and continuation preserves the remainder', async () => {
  for (const text of ['第一句。第二句。第三句。第四句。第五句。第六句。', '校园'.repeat(160) + '。后续句子。']) {
    const adapter = new FakeAdapter(), c = new CampusSpeechController({ adapter });
    await c.enable(true);
    const run = { ...ids(), mode: 'brief' };
    await c.begin(run); await c.finish(run.generation_id, text);
    const brief = adapter.played.join('');
    assert.ok([...brief].length <= 220);
    assert.ok((brief.match(/[。！？!?；;]/gu) ?? []).length <= 2);
    assert.ok(brief.length > 0);
    assert.equal((await c.continueRemaining()).status, 'ready');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(adapter.played.join(''), sanitizeSpeechText(text).text);
  }
});

test('B05 slow server discovery and delayed browser voices succeed; an explicit next call retries failure', async () => {
  const original = { window: globalThis.window, fetch: globalThis.fetch, SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance };
  const listeners = new Set(), scheduled = new Set();
  let browserVoices = [], fail = true, calls = 0;
  const timer = (fn, ms) => { const id = setTimeout(fn, ms / 100); scheduled.add(id); return id; };
  globalThis.window = {
    setTimeout: timer, clearTimeout,
    speechSynthesis: {
      getVoices: () => browserVoices,
      addEventListener: (_, cb) => listeners.add(cb),
      removeEventListener: (_, cb) => listeners.delete(cb),
    },
  };
  globalThis.SpeechSynthesisUtterance = class {};
  globalThis.fetch = async (url, options = {}) => {
    if (url === '/api/health') return new Response(JSON.stringify({ capabilities: { asr: false } }));
    calls += 1;
    await new Promise((resolve, reject) => {
      const id = setTimeout(resolve, 60); // 6 seconds in the scaled clock, beyond the former 4-second deadline.
      scheduled.add(id);
      options.signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
    });
    return fail
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ status: 'ready', voices: [{ id: 'edge:voice', locale: 'zh-CN', name: '中文', provider: 'edge' }] }));
  };
  try {
    const c = new CampusSpeechController();
    timer(() => {
      browserVoices = [{ voiceURI: 'browser-voice', lang: 'zh-CN', name: '中文浏览器音色' }];
      for (const cb of [...listeners]) cb();
    }, 2500);
    const first = await c.listVoices();
    assert.ok(first.some((v) => v.id === 'browser:browser-voice'));
    assert.ok(!first.some((v) => v.id === 'edge:voice'));
    fail = false;
    const second = await c.listVoices();
    assert.ok(second.some((v) => v.id === 'edge:voice'));
    assert.equal(calls, 2);
    assert.equal(listeners.size, 0);
  } finally {
    for (const id of scheduled) clearTimeout(id);
    Object.assign(globalThis, original);
  }
});

test('B02 concurrent begin cannot resurrect the older pending transition', async () => {
  const adapter = new FakeAdapter(), c = new CampusSpeechController({ adapter });
  await c.enable(true); await c.playSegment(ids(), '正在播放。', 'active');
  let release;
  adapter.stop = () => new Promise((r) => { release = r; });
  const older = c.begin({ ...ids(), generation_id: 'older' });
  const newer = await c.begin({ ...ids(), generation_id: 'newer' });
  release({});
  assert.equal(newer.status, 'ready');
  assert.equal((await older).error_code, 'stopped');
  const events = []; c.subscribe((e) => events.push(e));
  c.append('newer', '新的完整段落足够长因而可以马上进入当前任务队列进行语音播放。');
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(events.some((e) => e.generation_id === 'newer' && e.status === 'speaking'));
});

test('selected long text uses bounded FIFO segments; empty speech fails explicitly', async () => {
  const adapter = new FakeAdapter(), c = new CampusSpeechController({ adapter });
  await c.enable(true);
  const full = '校园'.repeat(2200);
  assert.equal((await c.playSegment(ids(), full, 'long')).status, 'ready');
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(adapter.played.join(''), full);
  assert.ok(adapter.played.every((s) => [...s].length <= 4000));
  assert.equal((await c.playFull(ids(), 'https://example.edu')).error_code, 'speech_empty');
});

test('B04 long first sentence prefers the Chinese comma before the 220-character limit', async () => {
  const adapter = new FakeAdapter(), c = new CampusSpeechController({ adapter });
  await c.enable(true);
  const run = { ...ids(), mode: 'brief' };
  const text = '校'.repeat(150) + '，' + '园'.repeat(150) + '。末句。';
  await c.begin(run); await c.finish(run.generation_id, text);
  assert.equal(adapter.played.join(''), '校'.repeat(150) + '，');
});
