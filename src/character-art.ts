import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharacterRole } from './models3d.ts';

/** Tailored silhouettes driven by the existing animation rig. World movement
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
  private readonly palms: THREE.Mesh[] = [];
  private readonly tails: THREE.Mesh[] = [];
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  constructor(rig: THREE.Object3D, private owner: THREE.Group, role: CharacterRole, private tint?: string) {
    const guard = role === 'guard', tracker = role === 'tracker';
    const cloth = guard ? '#253d56' : tracker ? '#383c50' : '#28565b';
    const seam = guard ? '#48647a' : tracker ? '#63617d' : '#588280';
    const leather = '#392e2c', skin = '#c79b7b', brass = '#c7a365';
    owner.add(this.root); this.root.add(this.torso, this.head, this.coat, this.satchel);
    for (const name of ['Hips', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot']) {
      this.bones.set(name, rig.getObjectByName(name)!); this.points.set(name, new THREE.Vector3());
    }
    // Profiles give the coat a chest, a waist and a flared hem instead of a box.
    this.profile(this.torso, [[0, .24], [.12, .245], [.49, .29], [.66, .23], [.7, .14]], cloth, .65);
    for (const side of [-1, 1]) {
      const lapel = this.box(this.torso, side * .105, .51, .18, .095, .28, .035, seam); lapel.rotation.z = side * .34;
      this.box(this.torso, side * .185, .62, 0, .18, .035, .24, guard ? brass : seam);
      this.box(this.torso, side * .16, .2, .17, .13, .06, .022, seam);
      const tail = this.profile(this.coat, [[-.44, .155], [-.38, .15], [0, .115]], cloth, 1.05);
      tail.position.set(side * .135, 0, -.035); tail.rotation.z = side * .085; this.tails.push(tail);
    }
    this.box(this.torso, 0, .05, 0, .5, .055, .34, leather);
    this.box(this.torso, 0, .05, .18, .075, .065, .028, brass);
    for (const y of [.18, .30, .42]) this.ellipsoid(this.torso, .015, y, .19, .019, .019, .012, brass);
    if (guard) {
      this.box(this.torso, .13, .5, .195, .068, .09, .02, brass);
      this.box(this.torso, -.19, .25, -.17, .105, .23, .07, leather);
    } else if (tracker) {
      this.box(this.satchel, 0, .33, -.255, .38, .49, .2, '#44445c');
      this.box(this.satchel, .17, .65, -.255, .026, .3, .026, '#b2a5cd');
      this.ellipsoid(this.satchel, 0, .38, -.38, .11, .11, .03, '#a49bbd');
    } else {
      this.profile(this.torso, [[.66, .155], [.72, .17], [.78, .145]], '#b87650', .84);
      const scarf = this.box(this.torso, -.115, .51, .208, .13, .38, .045, '#c78a5e'); scarf.rotation.z = -.13;
      const strap = this.box(this.torso, 0, .34, .205, .065, .67, .024, '#805f43'); strap.rotation.z = -.5;
      this.box(this.satchel, .25, .06, -.16, .25, .3, .14, '#75553c');
      this.box(this.satchel, .25, .17, -.24, .26, .09, .03, '#99704c');
      this.box(this.satchel, .25, .10, -.256, .04, .05, .018, brass);
    }
    // Faceted rounded face, ears, brows and cap keep a readable profile at
    // the game camera distance without recreating the oversized source head.
    this.ellipsoid(this.head, 0, .14, .015, .175, .23, .165, skin);
    this.ellipsoid(this.head, 0, .26, -.03, .181, .155, .166, '#342c2b');
    this.ellipsoid(this.head, 0, .115, .17, .027, .043, .035, skin);
    this.box(this.head, 0, .065, .169, .05, .011, .008, '#8c6254');
    for (const side of [-1, 1]) {
      this.ellipsoid(this.head, side * .173, .13, .01, .035, .06, .033, skin);
      this.box(this.head, side * .065, .19, .161, .059, .014, .018, '#403535');
      this.box(this.head, side * .065, .163, .168, .018, .013, .012, '#202b31');
    }
    if (tracker) {
      this.ellipsoid(this.head, 0, .27, -.025, .205, .185, .2, '#333848');
      this.box(this.head, 0, .177, .183, .29, .074, .06, '#2c3243');
      this.box(this.head, 0, .181, .219, .22, .024, .014, '#c0aadf');
    } else {
      this.ellipsoid(this.head, 0, .30, .005, .207, guard ? .11 : .087, .201, guard ? cloth : '#3a4647');
      this.ellipsoid(this.head, 0, .252, .125, .21, .024, .19, guard ? '#202b39' : '#293c3c');
      if (guard) this.box(this.head, 0, .306, .20, .056, .065, .018, brass);
    }
    for (const side of ['Left', 'Right']) {
      this.link(`${side}Arm`, `${side}ForeArm`, .115, .09, cloth);
      this.link(`${side}ForeArm`, `${side}Hand`, .088, .065, cloth);
      this.link(`${side}UpLeg`, `${side}Leg`, .115, .087, guard ? '#253446' : '#293b40');
      this.link(`${side}Leg`, `${side}Foot`, .085, .061, '#293339');
      this.palms.push(this.ellipsoid(this.root, 0, 0, 0, .075, .105, .065, leather));
      const boot = new THREE.Group(); this.root.add(boot); this.feet.push(boot);
      this.ellipsoid(boot, 0, -.015, .065, .082, .086, .155, leather);
      this.box(boot, 0, -.083, .055, .166, .034, .31, '#20272b');
    }
    this.link('Head', 'Neck', .08, .10, skin);
    // Static garment and face details share one draw per material. Limbs and
    // split hems remain independent so the animation still articulates them.
    for (const group of [this.torso, this.head, this.satchel, ...this.feet]) this.batch(group);
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
      color: this.tint ?? color, roughness: .77, emissive: this.tint ?? '#000000', emissiveIntensity: this.tint ? .28 : 0,
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
    const mesh = this.mesh(parent, new THREE.SphereGeometry(1, 10, 8), color);
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); return mesh;
  }
  private profile(parent: THREE.Object3D, sections: number[][], color: string, depth: number) {
    const mesh = this.mesh(parent, new THREE.LatheGeometry(sections.map(([y, r]) => new THREE.Vector2(r, y)), 12), color);
    mesh.scale.z = depth; return mesh;
  }
  private link(from: string, to: string, top: number, bottom: number, color: string) {
    const mesh = this.mesh(this.root, new THREE.CylinderGeometry(top, bottom, 1, 8), color); this.links.push({mesh, from, to});
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
      this.feet[i].position.copy(this.points.get(`${side}Foot`)!);
    });
    this.hand.copy(this.points.get('RightHand')!);
    if (this.tint) for (const material of this.materials.values()) material.opacity = suppressed ? .17 : .65;
  }
}
