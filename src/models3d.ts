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
export type CharacterRole = 'player' | 'guard' | 'tracker' | 'echo';
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
  character(role: CharacterRole, tint?: string) {
    const ghost = role === 'echo', body = clone(this.agent);
    const mixer = new THREE.AnimationMixer(body), actions = { idle: mixer.clipAction(this.clips.idle), run: mixer.clipAction(this.clips.run) };
    actions.idle.play(); actions.run.play().setEffectiveWeight(0); mixer.setTime(0); body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3());
    body.scale.multiplyScalar((role === 'guard' || role === 'tracker' ? 2.05 : 1.95) / size.y);
    body.position.y = -box.min.y * body.scale.y;
    body.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const base = o.material as THREE.MeshStandardMaterial;
      o.material = base.clone();
      o.userData.ownedMaterial = true;
      if (role === 'tracker') (o.material as THREE.MeshStandardMaterial).color.set('#9295a1');
      if (ghost && tint) { const mat = o.material as THREE.MeshStandardMaterial; mat.emissive.set(tint); mat.emissiveIntensity = 0.35; mat.transparent = true; mat.opacity = 0.65; mat.depthWrite = false; o.castShadow = false; }
    });
    const group = new THREE.Group(); group.add(body);
    const head = body.getObjectByName('Head')!, spine = body.getObjectByName('Spine')!, neck = body.getObjectByName('Neck')!;
    const headwear = new THREE.Group(), clothing = new THREE.Group(), scarf = new THREE.Group(); group.add(headwear, clothing, scarf);
    const add = (parent: THREE.Object3D, position: [number, number, number], dimensions: [number, number, number], color: string) => {
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
      if (ghost && tint) { material.color.set(tint); material.emissive.set(tint); material.emissiveIntensity = 0.3; material.transparent = true; material.opacity = 0.65; material.depthWrite = false; }
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material); mesh.position.set(...position);
      mesh.castShadow = !ghost; mesh.userData.ownedMaterial = true; mesh.userData.ownedGeometry = true; parent.add(mesh); return mesh;
    };
    if (role === 'guard') {
      add(headwear, [0, 0.62, 0.02], [0.7, 0.17, 0.64], '#203c51');
      add(headwear, [0, 0.54, 0.26], [0.7, 0.055, 0.42], '#152c3d');
      add(headwear, [0, 0.62, 0.35], [0.13, 0.11, 0.035], '#d7be76');
      add(clothing, [0, 0.18, 0], [0.55, 0.6, 0.37], '#28485b');
      add(clothing, [0.14, 0.36, 0.2], [0.09, 0.11, 0.03], '#dfc175');
      add(clothing, [0, -0.08, 0.01], [0.58, 0.075, 0.4], '#182b32');
    } else if (role === 'tracker') {
      add(headwear, [0, 0.32, 0.02], [0.79, 0.7, 0.69], '#293540');
      add(headwear, [0, 0.32, 0.39], [0.66, 0.15, 0.045], '#a98ae7');
      add(clothing, [0, 0.18, 0], [0.65, 0.65, 0.46], '#34464b');
      add(clothing, [0, 0.15, -0.32], [0.49, 0.57, 0.25], '#625e77');
      add(clothing, [0.19, 0.68, -0.32], [0.05, 0.52, 0.05], '#b6a0de');
    } else {
      add(scarf, [0, -0.025, 0.025], [0.41, 0.13, 0.39], '#57a8ac');
      add(scarf, [-0.14, -0.24, 0.22], [0.16, 0.46, 0.075], '#71bcb7');
      add(clothing, [0.1, 0.07, -0.28], [0.4, 0.45, 0.22], '#385a60');
      add(clothing, [0.1, 0.09, -0.405], [0.28, 0.06, 0.035], '#c5ad70');
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.33, 32, 1, 0, ghost ? Math.PI * 1.6 : Math.PI * 2), new THREE.MeshBasicMaterial({ color: tint ?? (role === 'guard' ? '#d6ad78' : role === 'tracker' ? '#b797e7' : '#c8e7d3'), transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.055; ring.userData.ownedGeometry = true; ring.userData.ownedMaterial = true; group.add(ring);
    const ticket = add(group, [0, 0, 0], [0.23, 0.03, 0.15], '#ffe0a0');
    ticket.userData.credential = true; ticket.visible = false;
    (ticket.material as THREE.MeshStandardMaterial).transparent = false;
    (ticket.material as THREE.MeshStandardMaterial).opacity = 1;
    (ticket.material as THREE.MeshStandardMaterial).depthWrite = true;
    (ticket.material as THREE.MeshStandardMaterial).color.set('#ffe0a0');
    (ticket.material as THREE.MeshStandardMaterial).emissive.set('#9c6c29');
    const rightArm = body.getObjectByName('RightArm')!, forearm = body.getObjectByName('RightForeArm')!, hand = body.getObjectByName('RightHand')!;
    const restArm = rightArm.quaternion.clone(), restForearm = forearm.quaternion.clone(), at = new THREE.Vector3();
    const follow = (object: THREE.Object3D, bone: THREE.Object3D) => { bone.getWorldPosition(at); object.position.copy(group.worldToLocal(at)); };
    const pose = (frame: number, moving: boolean, gesture: number, holding: boolean, suppressed: boolean) => {
      rightArm.quaternion.copy(restArm); forearm.quaternion.copy(restForearm);
      actions.idle.setEffectiveWeight(moving ? 0 : 1); actions.run.setEffectiveWeight(moving ? 1 : 0); mixer.setTime(frame / 60);
      restArm.copy(rightArm.quaternion); restForearm.copy(forearm.quaternion);
      rightArm.rotateZ(-gesture * 0.5); forearm.rotateY(gesture * 0.8);
      group.updateMatrixWorld(true); follow(headwear, head); follow(clothing, spine); follow(scarf, neck); follow(ticket, hand);
      ticket.visible = holding;
      if (ghost) group.traverse(o => { if (o instanceof THREE.Mesh && !o.userData.credential) (o.material as THREE.Material).opacity = suppressed ? 0.17 : 0.65; });
    };
    return { group, body, mixer, pose };
  }
}
