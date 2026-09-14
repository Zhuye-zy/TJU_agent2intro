import type { AdapterResult, AvatarAdapter, AvatarState } from '../../../shared/contracts';
import { kelaitaManifest } from './manifest';
export async function loadRendererModules() {
  // Direct mature dependencies, lazy until B mounts. Cubism Core must load before cubism4.
  return { pixi: await import('pixi.js'), live2d: await import('pixi-live2d-display/cubism4') };
}
export class StubAvatarAdapter implements AvatarAdapter {
  readonly manifest = kelaitaManifest;
  async mount(_host: HTMLElement): Promise<AdapterResult> { return { status: 'not_implemented', error_code: 'renderer_not_implemented' }; }
  setState(_state: AvatarState): void { /* B implements local renderer state; no LLM call. */ }
  dispose(): void {}
}

export function createAvatarAdapter(): AvatarAdapter { return new StubAvatarAdapter(); }
