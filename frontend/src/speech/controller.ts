import type { AdapterResult, Voice } from '../../../shared/contracts';
import type { SpeechController, SpeechProgress, SpeechRun } from '../../../shared/r2';
import { CampusSpeechAdapter, type PreparedSpeech, type SpeechAdapterOptions, type SpeechPlaybackTrace } from './adapter';

const MAX_SEGMENTS = 64;
const MAX_RUN_CHARS = 23_000;
const MAX_SEGMENT_CHARS = 4_000;
const MAX_PENDING_CONSTRUCT_CHARS = 4_096;
const BRIEF_CHARS = 220;
const BRIEF_SENTENCES = 2;
const SHORT_SEGMENT_CHARS = 28;

type Sanitized = { text: string; pendingRawChars: number };
type QueueItem = { key: string; segmentId: string; utteranceId: string; seq: number; text: string };
type ActiveRun = {
  run: SpeechRun;
  controller: AbortController;
  removeAbort: () => void;
  sanitizer: IncrementalSpeechSanitizer;
  queue: QueueItem[];
  seen: Set<string>;
  nextSeq: number;
  queuedChars: number;
  briefSentences: number;
  finished: boolean;
  failedItem: QueueItem | null;
  drainWaiters: Array<() => void>;
  plannedText: string[];
};

function cleanLines(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const kept: string[] = [];
  for (const source of lines) {
    const line = source.trim();
    if (!line) continue;
    if (/^(?:#{1,6}\s*)?(?:来源|参考(?:资料|文献)?|sources?|references?)\s*[:：]?\s*$/iu.test(line)) break;
    if (/^(?:来源|参考(?:资料|文献)?|sources?|references?)\s*[:：]/iu.test(line)) continue;
    const withoutList = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/^(?:[-+*•>]|\d{1,3}[.)、]|[（(]?[一二三四五六七八九十]+[）).、])\s*/, '')
      .replace(/[*_~]+/g, '')
      .trim();
    if (withoutList) kept.push(withoutList);
  }
  return kept.join('。')
    .replace(/\s+/g, ' ')
    .replace(/。{2,}/g, '。')
    .replace(/\s+([，。！？；：,.!?;:])/g, '$1')
    .trim();
}

/** Deterministic Markdown-to-speech transform. It never returns a URL or code body. */
export function sanitizeSpeechText(raw: string, final = true): Sanitized {
  let output = '';
  let index = 0;
  let pendingAt = -1;
  const lower = raw.toLowerCase();
  while (index < raw.length) {
    if (raw.startsWith('```', index)) {
      const end = raw.indexOf('```', index + 3);
      if (end < 0) { if (!final) pendingAt = index; break; }
      index = end < 0 ? raw.length : end + 3;
      continue;
    }
    if (raw[index] === '`') {
      const end = raw.indexOf('`', index + 1);
      if (end < 0) { if (!final) pendingAt = index; break; }
      index = end < 0 ? raw.length : end + 1;
      continue;
    }
    if (raw.startsWith('![', index)) {
      const labelEnd = raw.indexOf(']', index + 2);
      const urlStart = labelEnd >= 0 && raw[labelEnd + 1] === '(' ? labelEnd + 2 : -1;
      const urlEnd = urlStart >= 0 ? raw.indexOf(')', urlStart) : -1;
      if (labelEnd < 0 || urlStart < 0 || urlEnd < 0) { if (!final) pendingAt = index; break; }
      index = urlEnd + 1;
      continue;
    }
    if (raw[index] === '[') {
      const labelEnd = raw.indexOf(']', index + 1);
      if (labelEnd < 0) { if (!final) pendingAt = index; break; }
      const label = raw.slice(index + 1, labelEnd);
      if (raw[labelEnd + 1] === '(') {
        const urlEnd = raw.indexOf(')', labelEnd + 2);
        if (urlEnd < 0) { if (!final) pendingAt = index; break; }
        output += label;
        index = urlEnd + 1;
        continue;
      }
      if (/^\s*\d+(?:\s*[-,，]\s*\d+)*\s*$/.test(label)) {
        index = labelEnd + 1;
        continue;
      }
    }
    if (raw[index] === '【') {
      const end = raw.indexOf('】', index + 1);
      if (end < 0) { if (!final) pendingAt = index; break; }
      if (/^\s*\d+(?:\s*[-,，]\s*\d+)*\s*$/.test(raw.slice(index + 1, end))) {
        index = end + 1;
        continue;
      }
    }
    if (raw[index] === '<') {
      const end = raw.indexOf('>', index + 1);
      if (end < 0) { if (!final) pendingAt = index; break; }
      index = end < 0 ? raw.length : end + 1;
      continue;
    }
    const isUrl = lower.startsWith('https://', index) || lower.startsWith('http://', index) || lower.startsWith('www.', index);
    if (isUrl) {
      let end = index;
      while (end < raw.length && !/[\s，。！？；、）】}>]/u.test(raw[end])) end += 1;
      if (end === raw.length && !final) { pendingAt = index; break; }
      index = end;
      continue;
    }
    output += raw[index];
    index += 1;
  }
  return { text: cleanLines(output), pendingRawChars: pendingAt < 0 ? 0 : raw.length - pendingAt };
}

function sentenceEnds(text: string, from: number): number[] {
  const ends: number[] = [];
  const pattern = /[。！？!?；;](?:[”’）】])?/gu;
  pattern.lastIndex = from;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) ends.push(pattern.lastIndex);
  return ends;
}

function splitBounded(text: string): string[] {
  if ([...text].length <= MAX_SEGMENT_CHARS) return [text];
  const result: string[] = [];
  let rest = text;
  while ([...rest].length > MAX_SEGMENT_CHARS) {
    const chars = [...rest];
    let cut = MAX_SEGMENT_CHARS;
    for (let i = MAX_SEGMENT_CHARS - 1; i >= Math.max(1, MAX_SEGMENT_CHARS - 500); i -= 1) {
      if (/[，、；;。！？!?\s]/u.test(chars[i])) { cut = i + 1; break; }
    }
    result.push(chars.slice(0, cut).join('').trim());
    rest = chars.slice(cut).join('').trim();
  }
  if (rest) result.push(rest);
  return result.filter(Boolean);
}

export class IncrementalSpeechSanitizer {
  private raw = '';
  private consumed = 0;
  private emittedPrefix = '';

  append(chunk: string): string[] {
    this.raw += chunk;
    if ([...this.raw].length > MAX_RUN_CHARS) throw new Error('speech_queue_overflow');
    const parsed = sanitizeSpeechText(this.raw, false);
    if (parsed.pendingRawChars > MAX_PENDING_CONSTRUCT_CHARS) throw new Error('speech_sanitizer_limit');
    return this.take(parsed.text, false);
  }

  finish(finalText: string): string[] {
    if ([...finalText].length > MAX_RUN_CHARS) throw new Error('speech_queue_overflow');
    const parsed = sanitizeSpeechText(finalText, true);
    if (this.emittedPrefix && !parsed.text.startsWith(this.emittedPrefix)) throw new Error('speech_final_mismatch');
    this.raw = finalText;
    return this.take(parsed.text, true);
  }

  private take(text: string, final: boolean): string[] {
    if (this.consumed > text.length) throw new Error('speech_final_mismatch');
    const ends = sentenceEnds(text, this.consumed);
    const segments: string[] = [];
    let start = this.consumed;
    for (const end of ends) {
      const candidate = text.slice(start, end).trim();
      if (!candidate) { start = end; continue; }
      if (!final && [...candidate].length < SHORT_SEGMENT_CHARS && end === ends.at(-1) && end === text.length) break;
      if ([...candidate].length < SHORT_SEGMENT_CHARS && end !== ends.at(-1)) continue;
      segments.push(...splitBounded(candidate));
      start = end;
    }
    if (final) {
      const tail = text.slice(start).trim();
      if (tail) segments.push(...splitBounded(tail));
      start = text.length;
    }
    this.consumed = start;
    this.emittedPrefix = text.slice(0, this.consumed);
    return segments;
  }
}

export const SPEECH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  speech_not_enabled: '请先点击开启语音；本页面尚未取得播放权限。',
  playback_permission_denied: '浏览器拦截了播放，请点击继续播报。',
  playback_activation_failed: '播放器未能恢复，请检查网页声音权限后重试。',
  tts_unavailable: '语音合成服务暂时不可用，文字答案仍可阅读，请稍后重试。',
  tts_empty_audio: '语音服务返回了空音频，文字答案仍可阅读，请重试。',
  audio_decode_failed: '浏览器无法解码这段音频，请重试或改用浏览器中文音色。',
  audio_fetch_failed: '音频文件未能取回，文字答案仍可阅读，请重试。',
  playback_failed: '浏览器播放失败，文字答案仍可阅读，请重试。',
  voice_unavailable: '所选中文音色当前不可用，请重新选择后重试。',
  speech_queue_overflow: '回答过长，已停止播报；文字答案不受影响，可选择一段朗读。',
  speech_sanitizer_limit: '朗读内容含过长的未闭合链接或代码，已安全停止，避免读出网址。',
  speech_final_mismatch: '最终答案与已播增量不一致，已停止以避免重复播报。',
  nothing_to_replay: '当前没有可重播的语音段。',
  nothing_to_continue: '当前回答没有未播报的剩余段。',
};

export interface SpeechControllerOptions extends SpeechAdapterOptions { adapter?: CampusSpeechAdapter }

export class CampusSpeechController implements SpeechController {
  readonly capabilities = { incremental: true, pause: true, resume: true, timestamps: 'none' as const };
  private readonly adapter: CampusSpeechAdapter;
  private readonly listeners = new Set<(state: SpeechProgress) => void>();
  private readonly traces: SpeechPlaybackTrace[] = [];
  private enabled = false;
  private activeRun: ActiveRun | null = null;
  private activeItem: QueueItem | null = null;
  private prefetched: { item: QueueItem; promise: Promise<PreparedSpeech | AdapterResult> } | null = null;
  private pumping = false;
  private blocked = false;
  private disposed = false;
  private lastPlayback: { run: SpeechRun; text: string; segmentId: string } | null = null;
  private lastResponse: { run: SpeechRun; remaining: string } | null = null;

  constructor(options: SpeechControllerOptions = {}) {
    this.adapter = options.adapter ?? new CampusSpeechAdapter({ ...options, onTrace: (event) => {
      this.traces.push(event);
      if (this.traces.length > 256) this.traces.shift();
      options.onTrace?.(event);
    } });
  }

  getTrace(): readonly SpeechPlaybackTrace[] { return [...this.traces]; }
  /** Use this same adapter for ASR so starting capture enforces half duplex by stopping TTS. */
  getAdapter(): CampusSpeechAdapter { return this.adapter; }

  async enable(enabled: boolean): Promise<AdapterResult> {
    if (this.disposed) return { status: 'failed', error_code: 'disposed' };
    if (!enabled) { this.enabled = false; await this.stop('user'); return { status: 'ready' }; }
    const result = await this.adapter.activatePlayback();
    this.enabled = result.status === 'ready';
    if (!this.enabled) this.emit('error', result.error_code ?? 'playback_activation_failed');
    if (this.enabled && this.blocked) return this.resume();
    return result;
  }

  async begin(run: SpeechRun): Promise<AdapterResult> {
    if (!this.enabled) { this.emitFor(run, 'error', 'speech_not_enabled'); return { status: 'failed', error_code: 'speech_not_enabled' }; }
    await this.stop('new_request');
    if (run.signal.aborted) return { status: 'failed', error_code: 'stopped' };
    const controller = new AbortController();
    const abort = () => void this.stop('cancel');
    run.signal.addEventListener('abort', abort, { once: true });
    this.activeRun = { run, controller, removeAbort: () => run.signal.removeEventListener('abort', abort), sanitizer: new IncrementalSpeechSanitizer(), queue: [], seen: new Set(), nextSeq: 1, queuedChars: 0, briefSentences: 0, finished: false, failedItem: null, drainWaiters: [], plannedText: [] };
    this.blocked = false;
    this.emit('buffering', null);
    return { status: 'ready' };
  }

  append(generationId: string, text: string): void {
    const state = this.activeRun;
    if (!state || state.run.generation_id !== generationId || state.finished || !text) return;
    try { this.enqueue(state, state.sanitizer.append(text)); } catch (error) { this.fail(errorCode(error)); }
  }

  async finish(generationId: string, finalText: string): Promise<void> {
    const state = this.activeRun;
    if (!state || state.run.generation_id !== generationId || state.finished) return;
    state.finished = true;
    try {
      this.enqueue(state, state.sanitizer.finish(finalText));
      const full = sanitizeSpeechText(finalText, true).text;
      const planned = state.plannedText.join('');
      this.lastResponse = { run: state.run, remaining: full.startsWith(planned) ? full.slice(planned.length).trim() : '' };
    } catch (error) { this.fail(errorCode(error)); return; }
    this.checkDrained();
    if (!this.activeRun || this.activeRun !== state || (!this.activeItem && !state.queue.length && !this.pumping)) return;
    await new Promise<void>((resolve) => state.drainWaiters.push(resolve));
  }

  async playSegment(run: SpeechRun, text: string, segmentId: string): Promise<AdapterResult> {
    const ready = await this.begin({ ...run, mode: 'full' });
    if (ready.status !== 'ready') return ready;
    const state = this.activeRun!;
    state.finished = true;
    const sanitized = sanitizeSpeechText(text, true).text;
    if (!sanitized) return this.fail('speech_empty');
    this.enqueueItem(state, sanitized, segmentId);
    return { status: 'ready' };
  }

  async playFull(run: SpeechRun, text: string): Promise<AdapterResult> {
    const ready = await this.begin({ ...run, mode: 'full' });
    if (ready.status !== 'ready') return ready;
    const state = this.activeRun!;
    state.finished = true;
    try { this.enqueue(state, state.sanitizer.finish(text)); } catch (error) { return this.fail(errorCode(error)); }
    return { status: 'ready' };
  }

  async stop(reason: 'user' | 'new_request' | 'clear' | 'campus_change' | 'cancel'): Promise<void> {
    const state = this.activeRun;
    this.activeRun = null;
    this.activeItem = null;
    this.blocked = false;
    this.pumping = false;
    const prefetched = this.prefetched;
    this.prefetched = null;
    if (!state) return;
    state.removeAbort();
    state.controller.abort();
    if (prefetched) void prefetched.promise.then((item) => { if (!('status' in item)) this.adapter.releasePrepared(item); });
    await this.adapter.stop(state.run.request_id);
    for (const resolve of state.drainWaiters.splice(0)) resolve();
    this.emitFor(state.run, 'stopped', reason);
  }

  pause(): Promise<AdapterResult> {
    const result = this.adapter.pausePlayback();
    if (result.status === 'ready') this.emit('paused', null);
    return Promise.resolve(result);
  }

  async resume(): Promise<AdapterResult> {
    if (!this.enabled) return { status: 'failed', error_code: 'speech_not_enabled' };
    if (this.blocked && this.activeItem) {
      const result = await this.adapter.resumePlayback();
      if (result.status === 'ready') { this.blocked = false; return result; }
      this.emit('error', result.error_code ?? 'playback_failed');
      return result;
    }
    const state = this.activeRun;
    if (state?.failedItem) { state.queue.unshift(state.failedItem); state.failedItem = null; this.blocked = false; void this.pump(); return { status: 'ready' }; }
    const result = await this.adapter.resumePlayback();
    if (result.status === 'ready') this.emit('speaking', null);
    return result;
  }

  /** Replays the current or most recently started segment from its beginning. */
  async replay(): Promise<AdapterResult> {
    const current = this.activeRun && this.activeItem
      ? { run: this.activeRun.run, text: this.activeItem.text, segmentId: this.activeItem.segmentId }
      : this.lastPlayback;
    if (!current) return { status: 'failed', error_code: 'nothing_to_replay' };
    const replayRun: SpeechRun = {
      ...current.run,
      generation_id: crypto.randomUUID(),
      signal: new AbortController().signal,
      mode: 'full',
    };
    return this.playSegment(replayRun, current.text, `replay-${current.segmentId}`);
  }

  /** Continues only the unspoken remainder left by the latest automatic brief. */
  async continueRemaining(): Promise<AdapterResult> {
    const previous = this.lastResponse;
    if (!previous?.remaining) return { status: 'failed', error_code: 'nothing_to_continue' };
    const run: SpeechRun = {
      ...previous.run,
      generation_id: crypto.randomUUID(),
      signal: new AbortController().signal,
      mode: 'full',
    };
    const remaining = previous.remaining;
    this.lastResponse = null;
    return this.playFull(run, remaining);
  }

  listVoices(): Promise<Voice[]> { return this.adapter.listVoices(); }
  subscribe(callback: (state: SpeechProgress) => void): () => void { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  dispose(): void { if (this.disposed) return; this.disposed = true; void this.stop('clear'); this.listeners.clear(); this.adapter.dispose(); }

  private enqueue(state: ActiveRun, segments: string[]): void {
    for (const segment of segments) {
      if (state.run.mode === 'brief') {
        if (state.briefSentences >= BRIEF_SENTENCES) continue;
        if (state.briefSentences > 0 && [...segment].length + state.queuedChars > BRIEF_CHARS) continue;
        if (state.briefSentences === 0 && [...segment].length > BRIEF_CHARS) throw new Error('brief_sentence_too_long');
        state.briefSentences += 1;
      }
      this.enqueueItem(state, segment, `stream-${state.nextSeq}`);
    }
  }

  private enqueueItem(state: ActiveRun, text: string, segmentId: string): void {
    const chars = [...text].length;
    if (state.queue.length + (this.activeItem ? 1 : 0) >= MAX_SEGMENTS || state.queuedChars + chars > MAX_RUN_CHARS) throw new Error('speech_queue_overflow');
    const seq = state.nextSeq++;
    const key = `${state.run.request_id}:${segmentId}:${seq}`;
    if (state.seen.has(key)) return;
    state.seen.add(key);
    const item = { key, segmentId, seq, text, utteranceId: crypto.randomUUID() };
    state.queue.push(item);
    state.plannedText.push(text);
    state.queuedChars += chars;
    this.emit('buffering', null, item);
    if (this.activeItem) this.ensurePrefetch(); else void this.pump();
  }

  private async pump(): Promise<void> {
    const state = this.activeRun;
    if (!state || this.pumping || this.activeItem || this.blocked) return;
    const item = state.failedItem ?? state.queue.shift();
    state.failedItem = null;
    if (!item) { this.checkDrained(); return; }
    this.pumping = true;
    this.activeItem = item;
    const context = { request_id: state.run.request_id, session_id: state.run.session_id, signal: state.controller.signal };
    let prepared: PreparedSpeech | AdapterResult;
    if (this.prefetched?.item === item) { prepared = await this.prefetched.promise; this.prefetched = null; }
    else prepared = await this.adapter.prepareSpeech(context, item.utteranceId, item.text, state.run.voice_id);
    if (this.activeRun !== state || state.controller.signal.aborted) { if (!('status' in prepared)) this.adapter.releasePrepared(prepared); this.pumping = false; return; }
    if ('status' in prepared) { this.pumping = false; this.activeItem = null; state.failedItem = item; this.fail(prepared.error_code ?? 'tts_unavailable', false); return; }
    this.ensurePrefetch();
    const result = await this.adapter.playPreparedSpeech(prepared, {
      onText: () => undefined,
      onStart: (utteranceId) => { if (this.isCurrent(state, item, utteranceId)) { this.lastPlayback = { run: state.run, text: item.text, segmentId: item.segmentId }; this.emit('speaking', null, item); } },
      onEnd: (utteranceId) => { if (!this.isCurrent(state, item, utteranceId)) return; this.activeItem = null; this.pumping = false; if (state.queue.length) this.emit('buffering', null, item); void this.pump(); },
      onFailure: (utteranceId, code) => {
        if (!this.isCurrent(state, item, utteranceId)) return;
        this.blocked = code === 'playback_permission_denied';
        if (!this.blocked) { this.activeItem = null; state.failedItem = item; }
        this.pumping = false;
        this.emit('error', code, item);
        this.resolveDrain(state);
      },
    });
    if (result.status !== 'ready' && this.pumping) { this.pumping = false; this.activeItem = null; state.failedItem = item; this.fail(result.error_code ?? 'playback_failed', false); }
  }

  private ensurePrefetch(): void {
    const state = this.activeRun;
    const next = state?.queue[0];
    if (!state || !next || this.prefetched) return;
    const context = { request_id: state.run.request_id, session_id: state.run.session_id, signal: state.controller.signal };
    this.prefetched = { item: next, promise: this.adapter.prepareSpeech(context, next.utteranceId, next.text, state.run.voice_id) };
  }

  private isCurrent(state: ActiveRun, item: QueueItem, utteranceId: string): boolean { return this.activeRun === state && this.activeItem === item && item.utteranceId === utteranceId; }
  private fail(code: string, clearQueue = true): AdapterResult {
    const state = this.activeRun;
    if (state && clearQueue) {
      state.queue.length = 0;
      state.controller.abort();
      this.activeItem = null;
      this.pumping = false;
      const prefetched = this.prefetched;
      this.prefetched = null;
      if (prefetched) void prefetched.promise.then((item) => { if (!('status' in item)) this.adapter.releasePrepared(item); });
    }
    this.blocked = false;
    this.emit('error', code);
    if (state) this.resolveDrain(state);
    return { status: 'failed', error_code: code };
  }
  private checkDrained(): void {
    const state = this.activeRun;
    if (!state || !state.finished || this.activeItem || this.pumping || state.queue.length) return;
    this.emit('idle', null);
    this.resolveDrain(state);
    state.removeAbort();
    if (this.activeRun === state) this.activeRun = null;
  }
  private resolveDrain(state: ActiveRun): void { for (const resolve of state.drainWaiters.splice(0)) resolve(); }
  private emit(status: SpeechProgress['status'], code: string | null, item = this.activeItem): void { const state = this.activeRun; if (state) this.emitFor(state.run, status, code, item); }
  private emitFor(run: SpeechRun, status: SpeechProgress['status'], code: string | null, item: QueueItem | null = null): void {
    const value: SpeechProgress = { request_id: run.request_id, generation_id: run.generation_id, utterance_id: item?.utteranceId ?? null, segment_id: item?.segmentId ?? null, status, code };
    for (const listener of this.listeners) listener(value);
  }
}

function errorCode(error: unknown): string { return error instanceof Error ? error.message : 'speech_failed'; }
export function createSpeechController(options?: SpeechControllerOptions): CampusSpeechController { return new CampusSpeechController(options); }
