import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Level } from './levels.ts';
import { sceneLook, setting } from './set-dressing.ts';

type Size = [number, number, number];
type Point3 = [number, number, number];

/** Architectural silhouettes, always on occupied wall cells or outside the map.
 * The playable deck stays at y=0. Lower strata are foundation, never new paths.
 */
export class EnvironmentArt {
  private readonly style;
  private readonly look;
  readonly cityWindows: THREE.Mesh[] = [];
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  constructor(private level: Level, private detail: boolean) {
    this.style = setting(level); this.look = sceneLook(level);
  }
  private material(color: string, glow = 0) {
    const key = `${color}:${glow}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .92, emissive: color, emissiveIntensity: glow }));
    return this.materials.get(key)!;
  }
  private piece(parent: THREE.Object3D, geometry: THREE.BufferGeometry, at: Point3, color: string, glow = 0) {
    const mesh = new THREE.Mesh(geometry, this.material(color, glow)); mesh.position.set(...at);
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; parent.add(mesh); return mesh;
  }
  private block(parent: THREE.Object3D, at: Point3, size: Size, color: string, radius = .12) {
    return this.piece(parent, new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(n => n / 3))), at, color);
  }
  private oval(parent: THREE.Object3D, at: Point3, size: Size, color: string) {
    const mesh = this.piece(parent, new THREE.SphereGeometry(1, 24, 16), at, color); mesh.scale.set(...size); return mesh;
  }
  private column(parent: THREE.Object3D, at: Point3, top: number, bottom: number, height: number, color: string) {
    return this.piece(parent, new THREE.CylinderGeometry(top, bottom, height, 24), at, color);
  }
  private ring(parent: THREE.Object3D, at: Point3, radius: number, tube: number, color: string, arc = Math.PI * 2) {
    return this.piece(parent, new THREE.TorusGeometry(radius, tube, 8, 48, arc), at, color);
  }
  private pipe(parent: THREE.Object3D, points: Point3[], radius: number, color: string) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return this.piece(parent, new THREE.TubeGeometry(curve, 32, radius, 8, false), [0, 0, 0], color);
  }
  /** Bake only this module's static meshes. Dynamic city lights stay separate. */
  private bake(root: THREE.Group, shadows = false) {
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(); root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!(o instanceof THREE.Mesh) || o.userData.cityLight) return;
      const material = o.material as THREE.Material;
      if (!batches.has(material)) batches.set(material, []);
      const matrix = root.matrixWorld.clone().invert().multiply(o.matrixWorld);
      const geometry = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(matrix);
      batches.get(material)!.push(geometry); o.geometry.dispose();
    });
    const lights = [...root.children].filter(o => o.userData.cityLight); root.clear();
    for (const [material, parts] of batches) {
      const mesh = new THREE.Mesh(mergeGeometries(parts), material);
      mesh.castShadow = shadows; mesh.receiveShadow = true; mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; root.add(mesh);
      for (const part of parts) part.dispose();
    }
    root.add(...lights);
  }
  foundation(parent: THREE.Object3D) {
    const root = new THREE.Group(); parent.add(root);
    const p = this.look;
    // A continuous, shallow rim makes the playable boundary unambiguous.
    this.block(root, [0, -.24, 0], [30.2, .3, 18.2], p.cap, .14);
    if (this.style === 'station') {
      this.block(root, [0, -.58, 0], [29.5, .4, 17.6], p.panel, .18);
      for (const x of [-11, -4, 3, 10]) this.block(root, [x, -1.6, 1], [1.2, 2.1, 15.6], p.panel, .35);
    } else if (this.style === 'records' || this.style === 'archive') {
      for (let i = 0; i < 3; i++) this.block(root, [i % 2 ? -.2 : .2, -.62 - i * .5, 0], [30 - i * .85, .47, 17.8 - i * .8], i % 2 ? p.plaster : p.panel, .17);
    } else if (this.style === 'power') {
      this.block(root, [0, -.95, 0], [29.6, 1.5, 17.6], p.panel, .25);
      for (const x of [-12, -6, 0, 6, 12]) this.block(root, [x, -1.25, 8.6], [1.7, 2, .55], p.plaster, .25);
      this.pipe(root, [[-14, -1.35, 8.9], [-9, -1.55, 9.2], [5, -1.55, 9.2], [14, -1.35, 8.9]], .16, p.trim);
    } else if (this.style === 'retention') {
      this.block(root, [0, -.68, 0], [29.2, .65, 17.2], p.panel, .3);
      for (const x of [-10, 0, 10]) this.oval(root, [x, -1.25, 2], [3.4, 1.25, 6.5], p.plaster);
    } else if (this.style === 'vault') {
      this.block(root, [0, -1.15, 0], [29.5, 1.9, 17.5], p.panel, .7);
      for (const x of [-11, -5.5, 0, 5.5, 11]) this.block(root, [x, -1.15, 8.6], [3.5, 1.65, .8], p.plaster, .5);
    } else {
      const layers = this.style === 'civic' ? 3 : 2;
      for (let i = 0; i < layers; i++) this.block(root, [0, -.62 - i * .43, 0], [30 - i * .6, .48, 17.9 - i * .65], i % 2 ? p.plaster : p.panel, .22);
    }
    this.bake(root);
  }
  wallHeight(border: boolean, near: boolean, furniture: boolean) {
    if (near) return .28;
    if (furniture) return 1.5;
    if (!border) return ({museum:1.5,gala:1.25,records:1.85,power:1.55,station:1.05,retention:1.4,civic:1.35,vault:1.9,archive:1.7})[this.style];
    return ({museum:2.3,gala:1.05,records:2.2,power:1.15,station:.85,retention:1.35,civic:1.25,vault:1.75,archive:2.1})[this.style];
  }
  wall(parent: THREE.Group, width: number, depth: number, height: number, border: boolean, near: boolean) {
    const root = new THREE.Group(); parent.add(root); const p = this.look;
    this.block(root, [0, height / 2, 0], [width, height, depth], p.plaster, .22);
    if (near) { this.bake(root, true); return; }
    const horizontal = width >= depth, span = Math.max(width, depth), thin = Math.min(width, depth);
    const face = new THREE.Group(); if (!horizontal) face.rotation.y = Math.PI / 2; root.add(face);
    this.block(face, [0, .14, thin / 2 - .035], [span - .07, .22, .05], p.panel, .02);
    const spacing = this.style === 'records' ? 3 : this.style === 'station' ? 6 : this.style === 'civic' ? 3.4 : 4.8;
    const bays = Math.floor(span / spacing);
    if (border) for (let i = 0; i < bays; i++) {
      const x = -span / 2 + (i + .5) * span / bays;
      if (this.style === 'museum') {
        this.block(face, [x, height / 2, 0], [.7, height + .3, thin * .96], p.cap, .25);
        if (this.detail) this.block(face, [x, height * .62, thin / 2 - .04], [.1, .65, .06], p.light, .025);
      } else if (this.style === 'gala') {
        this.column(face, [x, 1.75, 0], .28, .44, 3.5, p.cap);
        this.oval(face, [x, 3.54, 0], [.4, .22, thin * .46], p.trim);
      } else if (this.style === 'records' || this.style === 'archive') {
        this.block(face, [x, height * .55, thin * .39], [Math.min(spacing - .6, span - .15), height * .64, thin * .16], p.panel, .08);
        for (const y of [.8, 1.35]) this.block(face, [x, y, thin * .46], [Math.min(spacing - .8, span - .2), .16, .05], p.cap, .024);
      } else if (this.style === 'power') {
        this.block(face, [x, 1.15, 0], [.5, 2.3, thin * .94], p.panel, .18);
        this.block(face, [x, 1.65, thin * .43], [.19, .68, .08], p.cap, .045);
      } else if (this.style === 'station') {
        this.block(face, [x, 1.8, 0], [.26, 3.6, thin * .76], p.panel, .08);
        this.block(face, [x, 3.57, 0], [1.4, .18, thin * .9], p.cap, .08);
      } else if (this.style === 'retention') {
        this.oval(face, [x, 1.7, 0], [.46, 1.4, thin * .48], p.cap);
        this.block(face, [x, 1.7, thin * .43], [.14, 1.05, .065], p.panel, .03);
      } else if (this.style === 'civic') {
        this.column(face, [x, 2.1, 0], .3, .45, 4.2, p.cap);
        this.block(face, [x, 4.16, 0], [.8, .22, thin * .98], p.plaster, .07);
      } else {
        this.block(face, [x, 1.4, 0], [.9, 2.8, thin * .98], p.panel, .32);
        this.block(face, [x, 1.35, thin * .44], [.25, 1.9, .08], p.cap, .04);
      }
    }
    if (!border && this.detail && span > 3) {
      // These bands remain within each occupied cell; they add no false cover.
      const n = this.style === 'records' || this.style === 'vault' ? 2 : 1;
      for (let i = 0; i < n; i++) this.block(face, [0, height * (.48 + i * .24), thin / 2 - .025], [span - .12, .055, .035], p.cap, .015);
    }
    this.bake(root, true);
  }
  exterior(parent: THREE.Object3D) {
    const root = new THREE.Group(); parent.add(root); const p = this.look;
    this.block(root, [0, -.65, -10.7], [29.7, 1.3, 3.4], p.panel, .45);
    // Backdrop solids sit outside the map or within its occupied outer rim.
    if (this.style === 'museum') {
      for (const [x, h, r] of [[-10, 4.5, 2.4], [-2, 5.4, 3], [8, 3.9, 2.4]]) {
        this.block(root, [x, h / 2, -10.35], [r * 2 + .8, h, 2.5], p.plaster, 1);
        const ring = this.ring(root, [x, h * .54, -8.96], 1, .12, p.cap); ring.scale.set(r, h * .4, 1);
        this.oval(root, [x, h * .54, -9.04], [r * .84, h * .34, .08], p.panel);
      }
      this.block(root, [-16, 1.3, -1], [1.5, 2.6, 12], p.panel, .6);
    } else if (this.style === 'gala') {
      for (const [x, tilt, h] of [[-10, -.5, 4.2], [-2, -.12, 5.4], [7, .34, 4.5]]) {
        const wing = this.oval(root, [x, h, -10.7], [3.8, .32, 1.6], p.cap); wing.rotation.z = tilt;
        this.column(root, [x, h / 2, -10.8], .24, .52, h, p.panel);
        this.pipe(root, [[x - 3, h - .2, -9.8], [x, h + .2, -9.5], [x + 3, h + .05, -9.8]], .09, p.trim);
      }
      const disc = this.ring(root, [-1, 3.7, -11], 1.35, .18, p.trim); disc.rotation.y = .18;
    } else if (this.style === 'records' || this.style === 'archive') {
      for (let i = 0; i < 7; i++) {
        const x = -12 + i * 4, h = [3, 4.2, 5.5, 6.2, 5, 3.9, 3.2][i];
        this.block(root, [x, h / 2, -10.65], [3.5, h, 2.5], i % 2 ? p.cap : p.plaster, .32);
        for (let y = 1; y < h - .4; y += 1.1) this.block(root, [x, y, -9.36], [2.8, .24, .12], p.panel, .06);
      }
      for (let i = 0; i < 3; i++) this.block(root, [-16.1, .9 + i * .48, -4 + i * 3.5], [1.7, 1.8 + i * .96, 2.9], p.panel, .3);
    } else if (this.style === 'power') {
      for (const [x, h, r] of [[-10, 4.1, 2], [-2, 5.9, 2.45], [8, 4.8, 2.1]]) {
        this.column(root, [x, h / 2, -11.65], r * .87, r, h, p.panel);
        this.column(root, [x, h + .1, -11.65], r, r, .3, p.plaster);
        const ring = this.ring(root, [x, h * .57, -11.65], r + .025, .075, p.cap); ring.rotation.x = Math.PI / 2;
        this.oval(root, [x, h + .24, -11.65], [r * .7, .35, r * .7], p.plaster);
      }
      this.pipe(root, [[-10, 1.1, -11.65], [-15.9, 1.1, -11], [-16.8, 1.1, -6], [-16.8, 1.1, 5]], .36, p.cap);
      if (this.level.handoff || this.level.continuity) this.block(root, [4.1, 1.4, -10], [2.8, 2.8, 1.4], p.panel, .25);
      if (this.level.handoff || this.level.continuity) for (const x of [3.35, 4.1, 4.85]) {
        const light = this.piece(root, new THREE.BoxGeometry(.4, .85, .08), [x, 1.9, -9.24], '#d2b76c', .9);
        // This is the distant city supplied by CIV, updated from actual power.
        light.material = new THREE.MeshStandardMaterial({color:'#d2b76c',emissive:'#efbd72',emissiveIntensity:.9});
        light.userData.cityLight = true; this.cityWindows.push(light);
      }
    } else if (this.style === 'station') {
      for (const z of [-10.4, -12.4]) this.block(root, [0, -.42, z], [30, .15, .13], p.cap, .04);
      this.block(root, [0, -.72, -11.4], [30.5, .45, 3.2], p.panel, .2);
      const train = this.piece(root, new THREE.CapsuleGeometry(1.05, 21, 6, 20), [0, .8, -11.4], p.cap); train.rotation.z = Math.PI / 2;
      for (const x of [-9, -6, -3, 0, 3, 6, 9]) this.block(root, [x, 1.07, -10.43], [1.85, .64, .13], p.panel, .17);
      this.pipe(root, [[-14, 3.7, -9.6], [-6, 4.8, -10], [5, 4.8, -10], [14, 3.7, -9.6]], .21, p.cap);
      for (const x of [-12, -6, 0, 6, 12]) this.block(root, [x, 2.05, -9.6], [.25, 4.1, .25], p.panel, .075);
    } else if (this.style === 'retention') {
      for (const [x, r, tilt] of [[-10, 2.1, -.12], [-1, 3, .1], [9, 2.45, -.2]]) {
        const shell = this.ring(root, [x, r + .1, -10.4], r, .33, p.cap, Math.PI * 1.8); shell.rotation.set(.1, tilt, .1);
        this.oval(root, [x, r + .1, -10.75], [r * .7, r * .85, .5], p.panel);
        this.column(root, [x, .45, -10.5], .7, 1, .9, p.plaster);
        const lens = this.ring(root, [x, r + .1, -10.15], r * .48, .06, p.plaster); lens.rotation.y = tilt;
      }
    } else if (this.style === 'civic') {
      for (let i = 0; i < 9; i++) {
        const x = -12 + i * 3, h = 3.6 + (4 - Math.abs(i - 4)) * .68;
        this.block(root, [x, h / 2, -10.25], [1.5, h, 1.9], p.cap, .45);
        this.block(root, [x, h - .05, -10.25], [2.5, .35, 2.1], p.plaster, .12);
        this.block(root, [x, h * .6, -9.28], [.2, h * .5, .07], p.panel, .025);
      }
      this.ring(root, [0, 4.4, -9.22], 1.15, .14, p.trim);
      this.block(root, [-16.3, 1.3, -2], [1.7, 2.6, 13], p.cap, .5);
    } else {
      this.block(root, [0, 2.2, -11.2], [21, 4.4, 3.6], p.panel, 1.1);
      this.oval(root, [0, 3.5, -9.32], [5.8, 4.6, .45], p.plaster);
      for (const [r, depth] of [[3.65, -8.82], [2.9, -8.74]]) this.ring(root, [0, 3.4, depth], r, .28, p.cap);
      this.oval(root, [0, 3.4, -8.85], [2.6, 2.6, .08], p.panel);
      for (const x of [-11, 11]) this.block(root, [x, 2.5, -10.8], [3.3, 5, 3.2], p.cap, .85);
    }
    this.bake(root);
  }
}
