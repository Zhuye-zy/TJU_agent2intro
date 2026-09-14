import type { AvatarManifest } from '../../../shared/contracts';
export const kelaitaManifest: AvatarManifest = {
  id: 'kelaita', display_name: '海小棠', source_character: '珂莱塔 / 鸣潮 BongoCat 风格',
  renderer: 'live2d', model_url: '/assets/kelaita/runtime/kelaita.model3.json',
  core_url: '/vendor/live2dcubismcore.min.js',
  capabilities: { renderer: false, lip_sync: 'none', expressions: [], motions: [], customization: [], is_3d: false, face_morph: false }
};
// Source has ParamMouthOpenY/EyeBlink, but actual runtime capability remains false until B verifies.
// Sole expression changes watermark; it is not an emotion and must not be repurposed as one.
