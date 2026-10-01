import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import bookcase from './assets/models/bookcaseOpen.glb?inline';
import cabinet from './assets/models/bookcaseClosedWide.glb?inline';
import terminal from './assets/models/cabinetBedDrawer.glb?inline';
import desk from './assets/models/desk.glb?inline';
import lamp from './assets/models/lampWall.glb?inline';
import books from './assets/models/books.glb?inline';
import plant from './assets/models/pottedPlant.glb?inline';
import radio from './assets/models/radio.glb?inline';
import agent from './assets/models/agent.fbx?inline';
import run from './assets/models/run.fbx?inline';
import idle from './assets/models/idle.fbx?inline';
import skin from './assets/models/agent-skin.png?inline';

const sources = { bookcase, cabinet, terminal, desk, lamp, books, plant, radio };
export type ModelName = keyof typeof sources;
function buffer(url: string): ArrayBuffer {
  const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export class Models3D {
  private models = new Map<ModelName, THREE.Group>();
  private agent!: THREE.Group;
  private clips!: { idle: THREE.AnimationClip; run: THREE.AnimationClip };
  readonly ready: Promise<void>;
  constructor() {
    this.ready = this.load();
  }
  private async load() {
    const gltf = new GLTFLoader();
    await Promise.all(Object.entries(sources).map(async ([key, url]) => {
      const model = (await gltf.parseAsync(buffer(url), '')).scene;
      model.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = true; o.receiveShadow = true;
        const original = o.material as THREE.MeshStandardMaterial;
        o.material = new THREE.MeshStandardMaterial({ color: original.color, map: original.map, roughness: 0.85 });
        if (original.name.toLowerCase().includes('wood')) (o.material as THREE.MeshStandardMaterial).color.set('#8b7252');
      });
      this.models.set(key as ModelName, model);
    }));
    const manager = new THREE.LoadingManager(); manager.setURLModifier(() => skin);
    const fbx = new FBXLoader(manager);
    this.agent = fbx.parse(buffer(agent), '');
    const texture = await new THREE.TextureLoader().loadAsync(skin); texture.colorSpace = THREE.SRGBColorSpace;
    this.agent.traverse(o => { if (o instanceof THREE.Mesh) { o.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.84 }); o.castShadow = true; o.receiveShadow = true; } });
    this.clips = { idle: fbx.parse(buffer(idle), '').animations.find(c => c.name.endsWith('|Idle'))!, run: fbx.parse(buffer(run), '').animations.find(c => c.name.endsWith('|Run'))! };
  }
  furniture(name: ModelName, width: number, depth: number, height?: number): THREE.Group {
    const model = this.models.get(name)!.clone(true), bound = new THREE.Box3().setFromObject(model), size = bound.getSize(new THREE.Vector3());
    const scale = Math.min(width / size.x, depth / size.z);
    model.scale.multiplyScalar(scale);
    if (height) model.scale.y *= height / (size.y * scale);
    const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    const group = new THREE.Group(); group.add(model); return group;
  }
  character(tint?: string, ghost = false) {
    const body = clone(this.agent), box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3());
    body.scale.multiplyScalar(1.8 / size.y);
    body.position.y = -box.min.y * body.scale.y;
    body.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const base = o.material as THREE.MeshStandardMaterial;
      o.material = base.clone();
      o.userData.ownedMaterial = true;
      if (tint) (o.material as THREE.MeshStandardMaterial).color.set(tint);
      if (ghost && tint) { const mat = o.material as THREE.MeshStandardMaterial; mat.emissive.set(tint); mat.emissiveIntensity = 0.35; mat.transparent = true; mat.opacity = 0.65; mat.depthWrite = false; o.castShadow = false; }
    });
    const group = new THREE.Group(); group.add(body);
    const mixer = new THREE.AnimationMixer(body), actions = { idle: mixer.clipAction(this.clips.idle), run: mixer.clipAction(this.clips.run) };
    actions.idle.play(); actions.run.play();
    return { group, body, mixer, actions };
  }
}
