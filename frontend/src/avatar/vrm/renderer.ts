import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { VRMHumanBoneName } from '@pixiv/three-vrm-core';
import type { AdapterResult, AvatarState } from '../../../../shared/contracts';
import { VRM_CUSTOM_MODEL, VRM_FALLBACK_MODEL, vrmManifest } from './manifest';
import { RoamController, roamEnabled } from './roam';

const TARGET_HEIGHT = 1.55;
const BASE_CAMERA_Z = 2.1;
/** VRM0 sample faces -Z after load; rotate 180° so idle pose faces the camera. */
const VRM_BASE_YAW = Math.PI;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class VrmRenderer {
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private vrm?: VRM;
  private observer?: ResizeObserver;
  private clock = new THREE.Clock();
  private state: AvatarState = 'idle';
  private audioLevel = 0;
  private smoothedLevel = 0;
  private scale = 1;
  private nextBlinkAt = performance.now() + 1400;
  private blinkStartedAt: number | null = null;
  private roam?: RoamController;
  private walkBlend = 0;
  private greetUntil = 0;
  private baseY = 0;
  private walker?: {
    hips?: THREE.Object3D; leftUpperLeg?: THREE.Object3D; leftLowerLeg?: THREE.Object3D; leftFoot?: THREE.Object3D;
    rightUpperLeg?: THREE.Object3D; rightLowerLeg?: THREE.Object3D; rightFoot?: THREE.Object3D;
    leftUpperArm?: THREE.Object3D; leftLowerArm?: THREE.Object3D; rightUpperArm?: THREE.Object3D; rightLowerArm?: THREE.Object3D;
  };
  private bones: { head?: THREE.Object3D; chest?: THREE.Object3D; hips?: THREE.Object3D } = {};
  private baseQuaternions = new Map<THREE.Object3D, THREE.Quaternion>();

  async mount(host: HTMLElement): Promise<AdapterResult> {
    this.dispose();
    try {
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const canvas = renderer.domElement;
      canvas.dataset.avatarRenderer = 'vrm';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      if (roamEnabled()) {
        this.roam = new RoamController(() => { this.greetUntil = performance.now() + 1500; });
        this.roam.stage.appendChild(canvas);
      } else {
        host.appendChild(canvas);
      }
      this.renderer = renderer;

      const scene = new THREE.Scene();
      this.scene = scene;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
      this.camera = camera;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb4c8, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(1.2, 2.2, 2.4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9fd4ff, 0.35);
      rim.position.set(-1.6, 1.4, -1.8);
      scene.add(rim);

      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      let gltf;
      try {
        gltf = await loader.loadAsync(VRM_CUSTOM_MODEL);
      } catch {
        gltf = await loader.loadAsync(VRM_FALLBACK_MODEL);
      }
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (!vrm) return { status: 'failed', error_code: 'vrm_model_load_failed' };
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse((object) => { object.frustumCulled = false; });

      vrm.scene.rotation.y = VRM_BASE_YAW;
      const box = new THREE.Box3().setFromObject(vrm.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const factor = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
      vrm.scene.scale.setScalar(factor);
      vrm.scene.position.set(0, -box.min.y * factor, 0);
      this.baseY = vrm.scene.position.y;

      const bone = (name: string) => vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName) ?? undefined;
      this.bones = { head: bone('head'), chest: bone('chest'), hips: bone('hips') };
      this.walker = {
        hips: this.bones.hips, leftUpperLeg: bone('leftUpperLeg'), leftLowerLeg: bone('leftLowerLeg'), leftFoot: bone('leftFoot'),
        rightUpperLeg: bone('rightUpperLeg'), rightLowerLeg: bone('rightLowerLeg'), rightFoot: bone('rightFoot'),
        leftUpperArm: bone('leftUpperArm'), leftLowerArm: bone('leftLowerArm'), rightUpperArm: bone('rightUpperArm'), rightLowerArm: bone('rightLowerArm'),
      };
      for (const item of [...Object.values(this.bones), ...Object.values(this.walker)]) {
        if (item) this.baseQuaternions.set(item, item.quaternion.clone());
      }
      scene.add(vrm.scene);
      this.vrm = vrm;

      const fit = () => this.resize(host);
      this.observer = new ResizeObserver(fit);
      this.observer.observe(host);
      fit();
      this.applyScale();

      renderer.setAnimationLoop(() => this.tick());
      return { status: 'ready' };
    } catch {
      this.dispose();
      return { status: 'failed', error_code: 'vrm_renderer_unavailable' };
    }
  }

  setState(state: AvatarState): void {
    this.state = state;
  }

  setAudioLevel(level: number): void {
    this.audioLevel = Number.isFinite(level) ? clamp(level, 0, 1) : 0;
  }

  setScale(scale: number): void {
    this.scale = clamp(scale, 0.6, 1.25);
    this.applyScale();
  }

  dispose(): void {
    this.renderer?.setAnimationLoop(null);
    this.observer?.disconnect();
    this.observer = undefined;
    this.roam?.dispose();
    this.roam = undefined;
    this.walkBlend = 0;
    this.walker = undefined;
    if (this.vrm) {
      try { VRMUtils.deepDispose(this.vrm.scene); } catch { /* ignore */ }
      this.vrm = undefined;
    }
    this.scene?.clear();
    this.scene = undefined;
    this.camera = undefined;
    this.bones = {};
    this.baseQuaternions.clear();
    const renderer = this.renderer;
    this.renderer = undefined;
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    }
    this.smoothedLevel = 0;
    this.blinkStartedAt = null;
  }

  private applyScale(): void {
    if (!this.camera) return;
    const fov = (this.camera.fov * Math.PI) / 180;
    const heightNeed = TARGET_HEIGHT * 1.18;
    const widthNeed = TARGET_HEIGHT * 0.78;
    const distanceV = heightNeed / (2 * Math.tan(fov / 2));
    const distanceH = widthNeed / (2 * Math.tan(fov / 2) * Math.max(this.camera.aspect, 0.25));
    const distance = Math.max(distanceV, distanceH, BASE_CAMERA_Z) / this.scale;
    this.camera.position.set(0, TARGET_HEIGHT * 0.52, distance);
    this.camera.lookAt(0, TARGET_HEIGHT * 0.5, 0);
  }

  private resize(host: HTMLElement): void {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, host.clientWidth || 640);
    const height = Math.max(1, host.clientHeight || 640);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyScale();
  }

  private tick(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.vrm) return;
    const delta = this.clock.getDelta();
    const now = performance.now();
    this.smoothedLevel += (this.audioLevel - this.smoothedLevel) * 0.45;
    this.roam?.update(now);
    const walking = this.roam?.motion === 'walk';
    this.walkBlend += ((walking ? 1 : 0) - this.walkBlend) * Math.min(1, delta * 8);
    if (this.roam) {
      const target = walking ? this.roam.heading : VRM_BASE_YAW;
      const current = this.vrm.scene.rotation.y;
      const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
      this.vrm.scene.rotation.y = current + difference * Math.min(1, delta * 8);
      this.vrm.scene.position.y = this.baseY + Math.abs(Math.sin(now / 1000 * 6.4)) * 0.02 * this.walkBlend;
    }
    this.driveExpressions(now);
    this.driveBones(now, delta);
    this.vrm.update(delta);
    this.renderer.render(this.scene, this.camera);
  }

  private driveExpressions(now: number): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;
    const seconds = now / 1000;
    let mouth = 0;
    let blink = 0;

    if (this.state === 'speaking') {
      mouth = clamp(this.smoothedLevel * 1.2, 0, 1);
    } else if (this.state === 'listening') {
      mouth = clamp((Math.sin(seconds * 2.2) + 1) * 0.05, 0, 0.1);
    }

    manager.setValue('aa', mouth);
    manager.setValue('happy', this.state === 'listening' ? 0.18 : (now < this.greetUntil ? 0.9 : 0));
    manager.setValue('sad', this.state === 'error' ? 0.55 : 0);
    manager.setValue('lookUp', this.state === 'thinking' ? 0.45 : 0);
    manager.setValue('lookLeft', this.state === 'thinking' ? 0.35 : 0);

    if (this.blinkStartedAt === null && now >= this.nextBlinkAt) this.blinkStartedAt = now;
    if (this.blinkStartedAt !== null) {
      const phase = (now - this.blinkStartedAt) / 150;
      blink = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      if (phase >= 1) {
        this.blinkStartedAt = null;
        this.nextBlinkAt = now + 2200 + Math.random() * 2400;
      }
    }
    manager.setValue('blink', clamp(blink, 0, 1));
  }

  private driveBones(now: number, delta: number): void {
    void delta;
    const seconds = now / 1000;
    const pose = new Map<THREE.Object3D, { x: number; y: number; z: number }>();
    const add = (bone: THREE.Object3D | undefined, x: number, y: number, z: number) => {
      if (!bone) return;
      const current = pose.get(bone) ?? { x: 0, y: 0, z: 0 };
      pose.set(bone, { x: current.x + x, y: current.y + y, z: current.z + z });
    };
    const blend = this.walkBlend;
    // Relaxed A-pose: bring T-pose arms down (VRM normalized bones are T-pose).
    if (this.walker) {
      add(this.walker.leftUpperArm, 0, -0.12, 1.12);
      add(this.walker.rightUpperArm, 0, 0.12, -1.12);
      add(this.walker.leftLowerArm, 0.18, 0, 0.08);
      add(this.walker.rightLowerArm, 0.18, 0, -0.08);
    }
    if (blend > 0.01 && this.walker) {
      const swing = Math.sin(seconds * 6.4);
      const kneeLeft = Math.max(0, -swing);
      const kneeRight = Math.max(0, swing);
      add(this.walker.leftUpperLeg, swing * 0.55 * blend, 0, 0);
      add(this.walker.rightUpperLeg, -swing * 0.55 * blend, 0, 0);
      add(this.walker.leftLowerLeg, -kneeLeft * 0.75 * blend, 0, 0);
      add(this.walker.rightLowerLeg, -kneeRight * 0.75 * blend, 0, 0);
      add(this.walker.leftFoot, kneeLeft * 0.3 * blend, 0, 0);
      add(this.walker.rightFoot, kneeRight * 0.3 * blend, 0, 0);
      add(this.walker.leftUpperArm, -swing * 0.4 * blend, 0, 0.12 * blend);
      add(this.walker.rightUpperArm, swing * 0.4 * blend, 0, -0.12 * blend);
      add(this.walker.leftLowerArm, 0.25 * blend, 0, 0);
      add(this.walker.rightLowerArm, 0.25 * blend, 0, 0);
    }
    let headX = Math.sin(seconds * 0.5) * 0.02;
    let headY = Math.sin(seconds * 0.34) * 0.03;
    let headZ = Math.sin(seconds * 0.4) * 0.015;
    let chestZ = Math.sin(seconds * 0.4) * 0.012;
    let hipsZ = 0;
    if (this.state === 'listening') {
      headY += Math.sin(seconds * 1.6) * 0.05;
      headZ += 0.04;
    } else if (this.state === 'thinking') {
      headX -= 0.05;
      headY += 0.04;
    } else if (this.state === 'speaking') {
      headX += Math.sin(seconds * 2.6) * 0.03;
      chestZ += Math.sin(seconds * 2.6) * 0.01;
    } else if (this.state === 'error') {
      headX += 0.12;
      hipsZ = 0;
    }
    add(this.bones.head, headX, headY, headZ);
    add(this.bones.chest, 0, 0, chestZ);
    add(this.bones.hips, 0, 0, hipsZ);

    const deltaQuaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    for (const [bone, rotation] of pose) {
      const base = this.baseQuaternions.get(bone);
      euler.set(rotation.x, rotation.y, rotation.z);
      deltaQuaternion.setFromEuler(euler);
      if (base) bone.quaternion.copy(base).multiply(deltaQuaternion);
      else bone.quaternion.multiply(deltaQuaternion);
    }
  }
}
