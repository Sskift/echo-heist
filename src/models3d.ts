import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterArt } from './character-art.ts';
import agent from './assets/models/agent.fbx?inline';
import run from './assets/models/run.fbx?inline';
import idle from './assets/models/idle.fbx?inline';
import skin from './assets/models/agent-skin.png?inline';

export type CharacterRole = 'player' | 'guard' | 'tracker' | 'echo';
function buffer(url: string): ArrayBuffer {
  const raw = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export class Models3D {
  private agent!: THREE.Group;
  private clips!: { idle: THREE.AnimationClip; run: THREE.AnimationClip };
  readonly ready: Promise<void>;
  constructor() {
    this.ready = this.load();
  }
  private async load() {
    const manager = new THREE.LoadingManager(); manager.setURLModifier(() => skin);
    const fbx = new FBXLoader(manager);
    this.agent = fbx.parse(buffer(agent), '');
    const texture = await new THREE.TextureLoader().loadAsync(skin); texture.colorSpace = THREE.SRGBColorSpace;
    this.agent.traverse(o => { if (o instanceof THREE.Mesh) { o.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.84 }); o.castShadow = true; o.receiveShadow = true; } });
    this.clips = { idle: fbx.parse(buffer(idle), '').animations.find(c => c.name.endsWith('|Idle'))!, run: fbx.parse(buffer(run), '').animations.find(c => c.name.endsWith('|Run'))! };
  }
  character(role: CharacterRole, tint?: string) {
    const ghost = role === 'echo', body = clone(this.agent);
    const mixer = new THREE.AnimationMixer(body), actions = { idle: mixer.clipAction(this.clips.idle), run: mixer.clipAction(this.clips.run) };
    actions.idle.play(); actions.run.play().setEffectiveWeight(0); mixer.setTime(0); body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body), size = box.getSize(new THREE.Vector3());
    body.scale.multiplyScalar((role === 'guard' || role === 'tracker' ? 2.05 : 1.95) / size.y);
    body.position.y = -box.min.y * body.scale.y;
    body.traverse(o => { if (o instanceof THREE.Mesh) o.visible = false; });
    const group = new THREE.Group(); group.add(body);
    const art = new CharacterArt(body, group, role, ghost ? tint : undefined);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.33, 32, 1, 0, ghost ? Math.PI * 1.6 : Math.PI * 2), new THREE.MeshBasicMaterial({ color: tint ?? (role === 'guard' ? '#d6ad78' : role === 'tracker' ? '#b797e7' : '#c8e7d3'), transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.055; ring.userData.ownedGeometry = true; ring.userData.ownedMaterial = true; group.add(ring);
    const ticket = new THREE.Mesh(new THREE.BoxGeometry(.23, .03, .15), new THREE.MeshStandardMaterial({color: '#ffe0a0', emissive: '#9c6c29'}));
    ticket.userData.ownedGeometry = ticket.userData.ownedMaterial = true; group.add(ticket);
    ticket.userData.credential = true; ticket.visible = false;
    (ticket.material as THREE.MeshStandardMaterial).transparent = false;
    (ticket.material as THREE.MeshStandardMaterial).opacity = 1;
    (ticket.material as THREE.MeshStandardMaterial).depthWrite = true;
    (ticket.material as THREE.MeshStandardMaterial).color.set('#ffe0a0');
    (ticket.material as THREE.MeshStandardMaterial).emissive.set('#9c6c29');
    const rightArm = body.getObjectByName('RightArm')!, forearm = body.getObjectByName('RightForeArm')!;
    const restArm = rightArm.quaternion.clone(), restForearm = forearm.quaternion.clone();
    const pose = (frame: number, moving: boolean, gesture: number, holding: boolean, suppressed: boolean) => {
      rightArm.quaternion.copy(restArm); forearm.quaternion.copy(restForearm);
      actions.idle.setEffectiveWeight(moving ? 0 : 1); actions.run.setEffectiveWeight(moving ? 1 : 0); mixer.setTime(frame / 60);
      restArm.copy(rightArm.quaternion); restForearm.copy(forearm.quaternion);
      rightArm.rotateZ(-gesture * 0.5); forearm.rotateY(gesture * 0.8);
      group.updateMatrixWorld(true); art.pose(frame, moving, suppressed); ticket.position.copy(art.hand);
      ticket.visible = holding;
      if (ghost) (ring.material as THREE.Material).opacity = suppressed ? .17 : .65;
    };
    return { group, body, mixer, pose };
  }
}
