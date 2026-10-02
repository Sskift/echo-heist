import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterRole } from './models3d.ts';

/** Sculpted silhouettes driven by the existing animation rig. World movement
 * and recorded poses stay in the simulation; this retargeting is visual only. */
export class CharacterArt {
  readonly root = new THREE.Group();
  readonly hand = new THREE.Vector3();
  private readonly points = new Map<string, THREE.Vector3>();
  private readonly bones = new Map<string, THREE.Object3D>();
  private readonly links: { mesh: THREE.Mesh; from: string; to: string }[] = [];
  private readonly yAxis = new THREE.Vector3(0, 1, 0);
  private readonly direction = new THREE.Vector3();
  private readonly inverse = new THREE.Matrix4();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly coat = new THREE.Group();
  private readonly satchel = new THREE.Group();
  private readonly feet: THREE.Group[] = [];
  private readonly palms: THREE.Group[] = [];
  private readonly tails: THREE.Mesh[] = [];
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  constructor(rig: THREE.Object3D, private owner: THREE.Group, role: CharacterRole, private tint?: string) {
    const guard = role === 'guard', tracker = role === 'tracker';
    const cloth = guard ? '#46566b' : tracker ? '#65617f' : '#426f72';
    const shell = guard ? '#a0afba' : tracker ? '#b6b5cd' : '#e3d7b8';
    const inset = '#263b47', accent = guard ? '#e2b77d' : tracker ? '#c1a6e3' : '#dba276';
    owner.add(this.root); this.root.add(this.torso, this.head, this.coat, this.satchel);
    for (const name of ['Hips', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightHand', 'RightForeArm', 'LeftHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot']) {
      this.bones.set(name, rig.getObjectByName(name)!); this.points.set(name, new THREE.Vector3());
    }
    this.profile(this.torso, [[0, .22], [.13, .24], [.47, .28], [.68, .19], [.73, .13]], cloth, .71);
    // One swept mantle reads from the overhead camera, with two flexible lower leaves.
    this.profile(this.torso, [[.45, .28], [.49, guard ? .39 : .34], [.62, .31], [.76, .17]], shell, .79);
    for (const side of [-1, 1]) {
      const start = side < 0 ? Math.PI + .06 : .06;
      const tail = this.mesh(this.coat, new THREE.LatheGeometry([new THREE.Vector2(tracker ? .29 : .35, -.4), new THREE.Vector2(.31, -.29), new THREE.Vector2(.23, .05)], 16, start, Math.PI - .12), cloth);
      tail.scale.z = .74; this.tails.push(tail);
      if (guard) this.ellipsoid(this.torso, side * .29, .57, -.01, .17, .15, .22, shell);
    }
    this.ellipsoid(this.torso, 0, .48, .24, .09, .12, .035, inset);
    this.ellipsoid(this.torso, 0, .49, .266, .031, .064, .016, accent);
    if (tracker) {
      this.profile(this.satchel, [[.04, .17], [.18, .22], [.55, .19], [.78, .07]], shell, .8).position.z = -.2;
      for (const side of [-1, 1]) {
        const fin = this.ellipsoid(this.satchel, side * .13, .67, -.27, .035, .28, .075, cloth); fin.rotation.z = side * -.19;
      }
    } else {
      this.ellipsoid(this.satchel, .17, .21, -.22, .18, .26, .12, shell);
      this.box(this.satchel, .17, .23, -.335, .045, .22, .018, accent);
      if (!guard) {
        const scarf = this.profile(this.torso, [[.65, .15], [.72, .18], [.77, .15]], accent, .85); scarf.rotation.z = -.07;
        const fold = this.ellipsoid(this.torso, -.16, .47, .23, .08, .19, .035, accent); fold.rotation.z = -.2;
      }
    }
    // A recessed mask replaces tiny eyes, brows and cap details that disappear in play.
    this.ellipsoid(this.head, 0, .16, -.015, guard ? .245 : .225, tracker ? .28 : .255, .215, shell);
    this.ellipsoid(this.head, 0, .12, .15, .16, .14, .09, inset);
    if (tracker) {
      this.box(this.head, 0, .13, .235, .032, .15, .02, accent);
      for (const side of [-1, 1]) {
        const antenna = this.ellipsoid(this.head, side * .16, .43, -.07, .024, .15, .042, cloth); antenna.rotation.z = side * -.25;
      }
    } else if (guard) {
      this.box(this.head, 0, .15, .24, .22, .028, .025, accent);
      this.ellipsoid(this.head, 0, .31, -.01, .26, .11, .225, cloth);
    } else {
      for (const side of [-1, 1]) this.ellipsoid(this.head, side * .068, .13, .233, .024, .035, .02, '#e6ecd1');
      this.ellipsoid(this.head, 0, .28, -.11, .205, .16, .14, shell);
    }
    for (const side of ['Left', 'Right']) {
      this.link(`${side}Arm`, `${side}ForeArm`, guard ? .135 : .115, .085, cloth);
      this.link(`${side}ForeArm`, `${side}Hand`, .092, .065, shell);
      this.link(`${side}UpLeg`, `${side}Leg`, .112, .081, inset);
      this.link(`${side}Leg`, `${side}Foot`, .082, .055, cloth);
      const palm = new THREE.Group(); this.root.add(palm); this.palms.push(palm);
      this.ellipsoid(palm, 0, -.026, 0, .068, .098, .053, inset);
      this.ellipsoid(palm, side === 'Left' ? -.053 : .053, .007, .022, .025, .05, .027, inset);
      const boot = new THREE.Group(); this.root.add(boot); this.feet.push(boot);
      this.ellipsoid(boot, 0, -.006, .056, .085, .1, .15, inset);
      this.ellipsoid(boot, 0, .023, .097, .076, .062, .14, shell);
    }
    this.link('Head', 'Neck', .08, .1, inset);
    // Static garment and face details share one draw per material. Limbs and
    // split hems remain independent so the animation still articulates them.
    for (const group of [this.torso, this.head, this.satchel, ...this.feet, ...this.palms]) this.batch(group);
    if (!tint) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const c = canvas.getContext('2d')!, gradient = c.createRadialGradient(32, 32, 4, 32, 32, 32);
      gradient.addColorStop(0, '#0a152ac0'); gradient.addColorStop(.45, '#0a152a65'); gradient.addColorStop(1, '#0a152a00');
      c.fillStyle = gradient; c.fillRect(0, 0, 64, 64);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const contact = new THREE.Mesh(new THREE.PlaneGeometry(.82, .66), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, opacity: .6}));
      contact.position.y = .052; contact.rotation.x = -Math.PI / 2;
      contact.userData.ownedGeometry = contact.userData.ownedTexture = true; this.root.add(contact);
    }
  }
  private batch(group: THREE.Group) {
    const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh)) continue;
      child.updateMatrix(); child.geometry.applyMatrix4(child.matrix);
      const material = child.material as THREE.Material;
      if (!parts.has(material)) parts.set(material, []);
      parts.get(material)!.push(child.geometry); group.remove(child);
    }
    for (const [material, geometry] of parts) {
      // Rounded boxes, lathes and spheres all have position, normal and UV.
      // Normalize indexed geometry before combining unlike primitive types.
      const normalized = geometry.map(g => g.index ? g.toNonIndexed() : g);
      const mesh = new THREE.Mesh(mergeGeometries(normalized), material);
      mesh.castShadow = !this.tint; mesh.receiveShadow = true;
      mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; group.add(mesh);
      for (const g of new Set([...geometry, ...normalized])) g.dispose();
    }
  }
  private material(color: string) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({
      color: this.tint ?? color, roughness: .9, metalness: 0, envMapIntensity: .2,
      emissive: this.tint ?? '#000000', emissiveIntensity: this.tint ? .26 : 0,
      transparent: !!this.tint, opacity: this.tint ? .65 : 1, depthWrite: !this.tint,
    }));
    return this.materials.get(color)!;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.castShadow = !this.tint; mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = this.mesh(parent, new RoundedBoxGeometry(1, 1, 1, 1, .08), color);
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); return mesh;
  }
  private ellipsoid(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const mesh = this.mesh(parent, new THREE.SphereGeometry(1, 20, 12), color);
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); return mesh;
  }
  private profile(parent: THREE.Object3D, sections: number[][], color: string, depth: number) {
    const mesh = this.mesh(parent, new THREE.LatheGeometry(sections.map(([y, r]) => new THREE.Vector2(r, y)), 20), color);
    mesh.scale.z = depth; return mesh;
  }
  private link(from: string, to: string, top: number, bottom: number, color: string) {
    const profile = [[-.5, 0], [-.5, bottom * .8], [-.45, bottom], [.35, top], [.47, top * .92], [.5, 0]];
    const mesh = this.mesh(this.root, new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), 16), color);
    this.links.push({mesh, from, to}); return mesh;
  }
  pose(frame: number, moving: boolean, suppressed: boolean) {
    this.inverse.copy(this.owner.matrixWorld).invert();
    for (const [name, bone] of this.bones) {
      const point = this.points.get(name)!; bone.getWorldPosition(point); point.applyMatrix4(this.inverse);
      point.x *= 1.16;
      point.y = point.y < 1.24 ? point.y * 1.29 : 1.5996 + (point.y - 1.24) * .72;
    }
    for (const {mesh, from, to} of this.links) {
      const a = this.points.get(from)!, b = this.points.get(to)!;
      mesh.position.copy(a).add(b).multiplyScalar(.5); this.direction.copy(a).sub(b);
      mesh.scale.y = this.direction.length() + .035; mesh.quaternion.setFromUnitVectors(this.yAxis, this.direction.normalize());
    }
    const hips = this.points.get('Hips')!, neck = this.points.get('Neck')!;
    this.torso.position.copy(hips); this.direction.copy(neck).sub(hips);
    this.torso.scale.y = this.direction.length() / .78;
    this.torso.quaternion.setFromUnitVectors(this.yAxis, this.direction.normalize());
    this.coat.position.copy(hips); this.coat.quaternion.copy(this.torso.quaternion);
    this.satchel.position.copy(hips); this.satchel.quaternion.copy(this.torso.quaternion);
    this.head.position.copy(this.points.get('Head')!);
    const sway = moving ? Math.sin(frame / 60 * 11) * .09 : 0;
    this.tails.forEach((tail, i) => tail.rotation.x = sway * (i ? -1 : 1));
    ['Left', 'Right'].forEach((side, i) => {
      this.palms[i].position.copy(this.points.get(`${side}Hand`)!);
      this.direction.copy(this.points.get(`${side}ForeArm`)!).sub(this.points.get(`${side}Hand`)!);
      this.palms[i].quaternion.setFromUnitVectors(this.yAxis, this.direction.normalize());
      this.feet[i].position.copy(this.points.get(`${side}Foot`)!);
    });
    this.hand.copy(this.points.get('RightHand')!);
    if (this.tint) for (const material of this.materials.values()) material.opacity = suppressed ? .17 : .65;
  }
}
