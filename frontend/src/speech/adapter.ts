import type {
  AdapterResult,
  ApiError,
  SpeechAdapter,
  SpeechCallbacks,
  SpeechContext,
  Voice,
} from '../../../shared/contracts';

type AsrResponse = { request_id: string; text: string; is_final: boolean };
type TtsResponse = {
  request_id: string;
  utterance_id: string;
  audio_url: string;
  mime_type: string;
  timestamps: 'none' | 'word' | 'viseme';
};

type RecognitionMode = 'server' | 'browser';

export interface SpeechAdapterOptions {
  /** Server uses VAD + /api/speech/asr. Browser is an explicit online browser-service fallback. */
  recognitionMode?: RecognitionMode;
}

type VadInstance = {
  pause(): Promise<void>;
  destroy(): Promise<void>;
};

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type BrowserRecognitionConstructor = new () => BrowserRecognition;

type SpeechWindow = Window & typeof globalThis & {
  SpeechRecognition?: BrowserRecognitionConstructor;
  webkitSpeechRecognition?: BrowserRecognitionConstructor;
};

type Capture = {
  requestId: string;
  generation: number;
  stop(): Promise<void>;
  removeAbort(): void;
};

type Playback = {
  requestId: string;
  generation: number;
  stop(): void;
  removeAbort(): void;
};

export async function loadVadModule() {
  return import('@ricky0123/vad-web');
}

function safeErrorCode(response: Response, fallback: string): Promise<string> {
  return response.json()
    .then((body: ApiError) => body?.error?.code || fallback)
    .catch(() => fallback);
}

function browserRecognitionConstructor(): BrowserRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function browserTtsAvailable(): boolean {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined';
}

function permissionCode(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    return 'permission_denied';
  }
  return 'capture_failed';
}

async function waitForBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!browserTtsAvailable()) return [];
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length) return immediate;
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => finish(), 1200);
    const finish = () => {
      window.clearTimeout(timeout);
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
  });
}

export class CampusSpeechAdapter implements SpeechAdapter {
  readonly capabilities = {
    asr: false,
    tts: false,
    timestamps: 'none' as const,
  };

  private readonly recognitionMode: RecognitionMode;
  private capture?: Capture;
  private playback?: Playback;
  private captureGeneration = 0;
  private playbackGeneration = 0;

  constructor(options: SpeechAdapterOptions = {}) {
    this.recognitionMode = options.recognitionMode ?? 'server';
  }

  async start(context: SpeechContext, callbacks: SpeechCallbacks): Promise<AdapterResult> {
    await this.stopCapture();
    this.cancelPlayback();
    if (context.signal.aborted) return { status: 'failed', error_code: 'stopped' };
    return this.recognitionMode === 'browser'
      ? this.startBrowserRecognition(context, callbacks)
      : this.startServerRecognition(context, callbacks);
  }

  async stop(requestId: string) {
    const stoppedCapture = !!this.capture && this.capture.requestId === requestId;
    const stoppedPlayback = !!this.playback && this.playback.requestId === requestId;
    if (stoppedCapture) await this.stopCapture();
    if (stoppedPlayback) this.cancelPlayback();

    try {
      const sessionId = this.lastSessionByRequest.get(requestId);
      if (!sessionId) return { local_stopped: true, upstream_stop: 'not_started' as const };
      const response = await fetch('/api/speech/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, session_id: sessionId }),
      });
      if (!response.ok) return { local_stopped: true, upstream_stop: 'unconfirmed' as const };
      const body = await response.json() as { local_stopped: boolean; upstream_stop: 'not_started' | 'unconfirmed' | 'confirmed' };
      return { local_stopped: stoppedCapture || stoppedPlayback || body.local_stopped, upstream_stop: body.upstream_stop };
    } catch {
      return { local_stopped: true, upstream_stop: 'unconfirmed' as const };
    }
  }

  async speak(
    context: SpeechContext,
    utteranceId: string,
    text: string,
    voiceId: string,
    callbacks: SpeechCallbacks,
  ): Promise<AdapterResult> {
    this.remember(context);
    await this.stopCapture();
    this.cancelPlayback();
    if (context.signal.aborted) return { status: 'failed', error_code: 'stopped' };
    if (voiceId.startsWith('browser:')) {
      return this.speakWithBrowser(context, utteranceId, text, voiceId.slice('browser:'.length), callbacks);
    }
    return this.speakWithServer(context, utteranceId, text, voiceId, callbacks);
  }

  async listVoices(): Promise<Voice[]> {
    const [server, browser] = await Promise.all([this.listServerVoices(), waitForBrowserVoices()]);
    const browserVoices = browser
      .filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
      .map((voice): Voice => ({
        id: `browser:${voice.voiceURI}`,
        name: voice.name,
        locale: voice.lang,
        provider: 'browser-online-or-os',
      }));
    const voices = [...server, ...browserVoices];
    this.capabilities.tts = voices.length > 0;
    return voices;
  }

  private readonly lastSessionByRequest = new Map<string, string>();

  private remember(context: SpeechContext): void {
    this.lastSessionByRequest.set(context.request_id, context.session_id);
    if (this.lastSessionByRequest.size > 128) {
      const oldest = this.lastSessionByRequest.keys().next().value as string | undefined;
      if (oldest) this.lastSessionByRequest.delete(oldest);
    }
  }

  private async startServerRecognition(context: SpeechContext, callbacks: SpeechCallbacks): Promise<AdapterResult> {
    this.remember(context);
    if (!navigator.mediaDevices?.getUserMedia) {
      callbacks.onFailure(context.request_id, 'capture_unsupported');
      return { status: 'failed', error_code: 'capture_unsupported' };
    }
    const generation = ++this.captureGeneration;
    let vad: VadInstance | undefined;
    const abort = () => void this.stopCapture();
    context.signal.addEventListener('abort', abort, { once: true });
    try {
      const module = await loadVadModule();
      vad = await module.MicVAD.new({
        model: 'v5',
        baseAssetPath: '/vendor/vad/',
        onnxWASMBasePath: '/vendor/ort/',
        startOnLoad: true,
        onSpeechEnd: (audio: Float32Array) => void this.submitAudio(context, generation, audio, callbacks),
      });
      if (generation !== this.captureGeneration || context.signal.aborted) {
        await vad.destroy();
        return { status: 'failed', error_code: 'stopped' };
      }
      this.capture = {
        requestId: context.request_id,
        generation,
        stop: () => vad!.destroy(),
        removeAbort: () => context.signal.removeEventListener('abort', abort),
      };
      return { status: 'ready' };
    } catch (error) {
      context.signal.removeEventListener('abort', abort);
      const code = permissionCode(error);
      callbacks.onFailure(context.request_id, code);
      return { status: 'failed', error_code: code };
    }
  }

  private async submitAudio(
    context: SpeechContext,
    generation: number,
    audio: Float32Array,
    callbacks: SpeechCallbacks,
  ): Promise<void> {
    if (generation !== this.captureGeneration || context.signal.aborted) return;
    if (audio.length > 16000 * 30) {
      callbacks.onFailure(context.request_id, 'audio_too_long');
      return;
    }
    try {
      const vad = await loadVadModule();
      const wav = vad.utils.encodeWAV(audio, 1, 16000, 1, 16);
      const response = await fetch('/api/speech/asr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: context.signal,
        body: JSON.stringify({
          request_id: context.request_id,
          session_id: context.session_id,
          audio: {
            encoding: 'base64',
            mime_type: 'audio/wav',
            sample_rate_hz: 16000,
            channels: 1,
            audio_base64: vad.utils.arrayBufferToBase64(wav),
          },
        }),
      });
      if (!response.ok) {
        callbacks.onFailure(context.request_id, await safeErrorCode(response, 'asr_unavailable'));
        return;
      }
      const body = await response.json() as AsrResponse;
      if (generation === this.captureGeneration && body.request_id === context.request_id) {
        this.capabilities.asr = true;
        callbacks.onText(body.text, body.is_final);
      }
    } catch (error) {
      if (generation === this.captureGeneration && !context.signal.aborted) {
        callbacks.onFailure(context.request_id, error instanceof TypeError ? 'asr_unavailable' : 'capture_failed');
      }
    }
  }

  private async startBrowserRecognition(context: SpeechContext, callbacks: SpeechCallbacks): Promise<AdapterResult> {
    this.remember(context);
    const Recognition = browserRecognitionConstructor();
    if (!Recognition) {
      callbacks.onFailure(context.request_id, 'browser_asr_unsupported');
      return { status: 'failed', error_code: 'browser_asr_unsupported' };
    }
    const generation = ++this.captureGeneration;
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (generation !== this.captureGeneration || context.signal.aborted) return;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript?.trim();
        if (transcript) callbacks.onText(transcript, !!result.isFinal);
      }
    };
    recognition.onerror = (event) => {
      if (generation !== this.captureGeneration) return;
      if (event.error === 'not-allowed') this.capabilities.asr = false;
      callbacks.onFailure(context.request_id, event.error === 'not-allowed' ? 'permission_denied' : 'browser_asr_failed');
    };
    recognition.onend = () => {
      if (this.capture?.generation !== generation) return;
      this.capture.removeAbort();
      this.capture = undefined;
    };
    const abort = () => void this.stopCapture();
    context.signal.addEventListener('abort', abort, { once: true });
    this.capture = {
      requestId: context.request_id,
      generation,
      stop: async () => recognition.abort(),
      removeAbort: () => context.signal.removeEventListener('abort', abort),
    };
    try {
      recognition.start();
      this.capabilities.asr = true;
      return { status: 'ready' };
    } catch (error) {
      await this.stopCapture();
      const code = permissionCode(error);
      callbacks.onFailure(context.request_id, code);
      return { status: 'failed', error_code: code };
    }
  }

  private async speakWithServer(
    context: SpeechContext,
    utteranceId: string,
    text: string,
    voiceId: string,
    callbacks: SpeechCallbacks,
  ): Promise<AdapterResult> {
    if (typeof Audio === 'undefined') {
      callbacks.onFailure(utteranceId, 'playback_unsupported');
      return { status: 'failed', error_code: 'playback_unsupported' };
    }
    const generation = ++this.playbackGeneration;
    const controller = new AbortController();
    const abort = () => controller.abort();
    context.signal.addEventListener('abort', abort, { once: true });
    this.playback = {
      requestId: context.request_id,
      generation,
      stop: () => controller.abort(),
      removeAbort: () => context.signal.removeEventListener('abort', abort),
    };
    try {
      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          request_id: context.request_id,
          session_id: context.session_id,
          utterance_id: utteranceId,
          text,
          voice_id: voiceId,
        }),
      });
      if (!response.ok) {
        const code = await safeErrorCode(response, 'tts_unavailable');
        callbacks.onFailure(utteranceId, code);
        context.signal.removeEventListener('abort', abort);
        if (this.playback?.generation === generation) this.playback = undefined;
        return { status: 'failed', error_code: code };
      }
      const body = await response.json() as TtsResponse;
      if (body.request_id !== context.request_id || body.utterance_id !== utteranceId
          || !body.audio_url.startsWith('/api/speech/audio/')) {
        throw new Error('invalid_tts_response');
      }
      if (generation !== this.playbackGeneration || context.signal.aborted) {
        return { status: 'failed', error_code: 'stopped' };
      }
      const audio = new Audio(body.audio_url);
      audio.preload = 'auto';
      let started = false;
      const cleanup = () => {
        context.signal.removeEventListener('abort', abort);
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        if (this.playback?.generation === generation) this.playback = undefined;
      };
      audio.onplaying = () => {
        if (generation !== this.playbackGeneration || started) return;
        started = true;
        callbacks.onStart(utteranceId);
      };
      audio.onended = () => {
        if (generation !== this.playbackGeneration) return;
        cleanup();
        callbacks.onEnd(utteranceId);
      };
      audio.onerror = () => {
        if (generation !== this.playbackGeneration) return;
        cleanup();
        callbacks.onFailure(utteranceId, 'playback_failed');
      };
      this.playback = {
        requestId: context.request_id,
        generation,
        stop: () => {
          controller.abort();
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        },
        removeAbort: () => context.signal.removeEventListener('abort', abort),
      };
      await audio.play();
      this.capabilities.tts = true;
      return { status: 'ready' };
    } catch (error) {
      context.signal.removeEventListener('abort', abort);
      if (generation === this.playbackGeneration && !context.signal.aborted) {
        this.playback = undefined;
        const code = error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'playback_permission_denied'
          : 'playback_failed';
        callbacks.onFailure(utteranceId, code);
        return { status: 'failed', error_code: code };
      }
      return { status: 'failed', error_code: 'stopped' };
    }
  }

  private async speakWithBrowser(
    context: SpeechContext,
    utteranceId: string,
    text: string,
    voiceUri: string,
    callbacks: SpeechCallbacks,
  ): Promise<AdapterResult> {
    if (!browserTtsAvailable()) {
      callbacks.onFailure(utteranceId, 'browser_tts_unsupported');
      return { status: 'failed', error_code: 'browser_tts_unsupported' };
    }
    const generation = ++this.playbackGeneration;
    const abort = () => this.cancelPlayback();
    context.signal.addEventListener('abort', abort, { once: true });
    this.playback = {
      requestId: context.request_id,
      generation,
      stop: () => window.speechSynthesis.cancel(),
      removeAbort: () => context.signal.removeEventListener('abort', abort),
    };
    const voices = await waitForBrowserVoices();
    if (generation !== this.playbackGeneration || context.signal.aborted) {
      return { status: 'failed', error_code: 'stopped' };
    }
    const voice = voices.find((item) => item.voiceURI === voiceUri && item.lang.toLowerCase().startsWith('zh'));
    if (!voice) {
      this.playback?.removeAbort();
      this.playback = undefined;
      callbacks.onFailure(utteranceId, 'voice_unavailable');
      return { status: 'failed', error_code: 'voice_unavailable' };
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.onstart = () => {
      if (generation === this.playbackGeneration) callbacks.onStart(utteranceId);
    };
    utterance.onend = () => {
      if (generation !== this.playbackGeneration) return;
      this.playback?.removeAbort();
      this.playback = undefined;
      callbacks.onEnd(utteranceId);
    };
    utterance.onerror = () => {
      if (generation !== this.playbackGeneration) return;
      this.playback?.removeAbort();
      this.playback = undefined;
      callbacks.onFailure(utteranceId, 'playback_failed');
    };
    window.speechSynthesis.speak(utterance);
    this.capabilities.tts = true;
    return { status: 'ready' };
  }

  private async listServerVoices(): Promise<Voice[]> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch('/api/speech/voices', { signal: controller.signal });
      if (!response.ok) return [];
      const body = await response.json() as { voices: Voice[]; status: 'ready' | 'not_implemented' };
      return body.status === 'ready' ? body.voices.filter((voice) => voice.locale.toLowerCase().startsWith('zh')) : [];
    } catch {
      return [];
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async stopCapture(): Promise<void> {
    const capture = this.capture;
    this.capture = undefined;
    this.captureGeneration += 1;
    if (!capture) return;
    capture.removeAbort();
    try {
      await capture.stop();
    } catch {
      // The local microphone state is already detached from this adapter.
    }
  }

  private cancelPlayback(): void {
    const playback = this.playback;
    this.playback = undefined;
    this.playbackGeneration += 1;
    if (!playback) return;
    playback.removeAbort();
    playback.stop();
  }
}

export function createSpeechAdapter(options?: SpeechAdapterOptions): SpeechAdapter {
  return new CampusSpeechAdapter(options);
}

// Compatibility alias for the M0 assembly; it now uses the production adapter.
export { CampusSpeechAdapter as StubSpeechAdapter };
