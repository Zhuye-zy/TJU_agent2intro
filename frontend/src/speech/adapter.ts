import type { AdapterResult, SpeechAdapter, SpeechContext, SpeechCallbacks, Voice } from '../../../shared/contracts';
export async function loadVadModule() { return import('@ricky0123/vad-web'); }
export class StubSpeechAdapter implements SpeechAdapter {
  readonly capabilities = { asr: false, tts: false, timestamps: 'none' as const };
  async start(_ctx: SpeechContext, callbacks: SpeechCallbacks): Promise<AdapterResult> {
    callbacks.onFailure(_ctx.request_id, 'not_implemented');
    return { status: 'not_implemented' };
  }
  async stop(_request_id: string) { return { local_stopped: true, upstream_stop: 'not_started' as const }; }
  async speak(_ctx: SpeechContext, id: string, _text: string, _voice: string, callbacks: SpeechCallbacks): Promise<AdapterResult> {
    callbacks.onFailure(id, 'not_implemented');
    return { status: 'not_implemented' };
  }
  async listVoices(): Promise<Voice[]> { return []; }
}

export function createSpeechAdapter(): SpeechAdapter { return new StubSpeechAdapter(); }
