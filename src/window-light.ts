import * as THREE from 'three';
import type { Level } from './levels.ts';

/** A baked light cookie, clipped by the actual walls and door footprints.
 * It adds window tracery to the floor without extra lights or shadow maps. */
export class WindowLight {
  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private count = 0;
  constructor(private level: Level) {
    this.canvas.width = 960; this.canvas.height = 576;
    this.context = this.canvas.getContext('2d')!;
  }
  add(x: number, z: number, horizontal: boolean) {
    const c = this.context, ox = (x + 15) * 32, oy = (z + 9) * 32;
    // Windows face into the cutaway room. Project a cool, elongated arch.
    const along = horizontal ? {x: 1, y: 0} : {x: 0, y: 1};
    const inward = horizontal ? {x: .4, y: 1} : {x: 1, y: .4};
    const blockers = [...this.level.walls.map(w => ({...w, w: 32, h: 32})), ...this.level.doors];
    for (let u = -19; u < 19; u += 2) {
      let blocked = false;
      for (let v = 8; v < 143; v += 2) {
        const px = ox + along.x * u + inward.x * v, py = oy + along.y * u + inward.y * v;
        if (blockers.some(b => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h)) blocked = true;
        if (blocked || Math.abs(u) < 1.8 || (v > 46 && v < 51) || (v > 92 && v < 97)) continue;
        const arch = Math.sqrt(Math.max(0, 1 - (u / 19) ** 2));
        if (v > 112 + arch * 30) continue;
        const alpha = .17 * Math.sin((v - 8) / 135 * Math.PI) * Math.min(1, (19 - Math.abs(u)) / 3);
        c.fillStyle = `rgba(149,196,227,${alpha})`; c.fillRect(px, py, 2.5, 2.5);
      }
    }
    this.count++;
  }
  attach(parent: THREE.Object3D) {
    if (!this.count) return;
    // Smooth the two-pixel raster once, keeping the light cookie inexpensive
    // on phones and eliminating bands along oblique projections.
    const copy = document.createElement('canvas'); copy.width = 960; copy.height = 576;
    copy.getContext('2d')!.drawImage(this.canvas, 0, 0);
    this.context.clearRect(0, 0, 960, 576); this.context.filter = 'blur(.7px)'; this.context.drawImage(copy, 0, 0);
    const texture = new THREE.CanvasTexture(this.canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false}));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = .04;
    mesh.userData.ownedGeometry = mesh.userData.ownedTexture = true; parent.add(mesh);
  }
}
