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
