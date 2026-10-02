import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Circuit, Level, Point, Terminal } from './levels.ts';
import type { PassageLandmark } from './room-journey.ts';

type Box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, metal?: number) => THREE.Mesh;
type Setting = 'museum' | 'gala' | 'records' | 'power' | 'station' | 'retention' | 'civic' | 'vault' | 'archive';
export function setting(level: Level): Setting {
  if (level.setting) return level.setting;
  const chapter = /^C([0-7])-/.exec(level.id)?.[1];
  if (chapter) return (['museum', 'gala', 'records', 'power', 'station', 'retention', 'civic', 'vault'] as const)[Number(chapter)];
  if (/^(01|02|03)$/.test(level.id)) return 'museum';
  if (level.id.startsWith('LAB-NULL')) return 'retention';
  if (level.id.startsWith('LAB-POWER')) return 'power';
  if (level.id.startsWith('LAB-TIME')) return 'gala';
  return 'archive';
}
const looks = {
  museum: { plaster: '#b37965', panel: '#715763', floor: '#d2a17d', trim: '#d8bc98', cap: '#c59883', light: '#ffe5b8', background: '#3b3446', title: '旧馆 · 失物档案' },
  gala: { plaster: '#b38f8e', panel: '#6d5669', floor: '#c4a596', trim: '#c3a568', cap: '#aa8d76', light: '#ffd6a0', background: '#261f31', title: '夜场 · 拍卖会' },
  records: { plaster: '#8fa49a', panel: '#536f69', floor: '#b6b9a0', trim: '#b7a27a', cap: '#9b9e8b', light: '#dfe9bb', background: '#1c302f', title: '市政档案 · 转运区' },
  power: { plaster: '#739797', panel: '#3e5a63', floor: '#8caaa3', trim: '#b59a52', cap: '#89958d', light: '#b5e2e7', background: '#182832', title: '市政配电 · 维护区' },
  station: { plaster: '#8ca6a1', panel: '#436973', floor: '#a5b6a8', trim: '#bca16d', cap: '#8e9e89', light: '#f7d897', background: '#14252d', title: '北站 · 货运登记' },
  retention: { plaster: '#9095ae', panel: '#535a76', floor: '#a0a7b9', trim: '#9498af', cap: '#929bad', light: '#c5c3fa', background: '#1b2234', title: '转存设施 · 投影核验' },
  civic: { plaster: '#b8c3ad', panel: '#66887d', floor: '#ced0b7', trim: '#b39b5f', cap: '#c2b793', light: '#f4dfa7', background: '#253434', title: '市政厅 · 公共登记' },
  vault: { plaster: '#9bb6bc', panel: '#536e86', floor: '#bacbd0', trim: '#bdab7a', cap: '#b4c0bd', light: '#d9eced', background: '#172a37', title: '中央总库 · 身份档案' },
  archive: { plaster: '#8da29d', panel: '#536c70', floor: '#b1ad97', trim: '#bca16d', cap: '#8e9e89', light: '#f7d897', background: '#14252d', title: '档案 · 机制演习' },
};
export const sceneLook = (level: Level) => looks[setting(level)];

// Dressing follows the existing floor plan. Solid props replace occupied cells;
// wall art stays on wall faces, and painted floor markings add no cover.
export class SetDressing {
  constructor(private box: Box) {}

  batchFixed(root: THREE.Group) {
    // Combine only fixed boxes using shared materials. Dynamic lamps, tickets,
    // textured signs and articulated child groups retain their own objects.
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...root.children]) {
      if (!(child instanceof THREE.Mesh) || child.userData.ownedGeometry || child.userData.ownedMaterial || Array.isArray(child.material)) continue;
      child.updateMatrix(); const geometry = child.geometry.clone().applyMatrix4(child.matrix);
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material)!.push(geometry); root.remove(child);
    }
    for (const [material, pieces] of batches) {
      const mesh = new THREE.Mesh(mergeGeometries(pieces), material);
      mesh.castShadow = mesh.receiveShadow = true; mesh.userData.ownedGeometry = true; root.add(mesh);
      for (const piece of pieces) piece.dispose();
    }
  }

  sculpt(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, radius = .14) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 3, h / 3, d / 3)),
      new THREE.MeshStandardMaterial({ color, roughness: .92 }));
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; parent.add(mesh); return mesh;
  }

  sconce(parent: THREE.Object3D, level: Level, x: number, z: number, horizontal: boolean) {
    const group = new THREE.Group(), look = sceneLook(level);
    group.position.set(x, 0, z); if (!horizontal) group.rotation.y = Math.PI / 2; parent.add(group);
    this.sculpt(group, 0, 1.98, .055, .34, .83, .16, look.panel, .15);
    const light = new THREE.Mesh(new THREE.CapsuleGeometry(.048, .43, 4, 10),
      new THREE.MeshStandardMaterial({color: look.light, emissive: look.light, emissiveIntensity: 1.25, roughness: .6}));
    light.position.set(0, 1.98, .15); light.userData.ownedGeometry = light.userData.ownedMaterial = true; group.add(light);
    return group;
  }

  passage(parent: THREE.Object3D, landmark: PassageLandmark) {
    const group = new THREE.Group(); group.position.set(landmark.at.x / 32 - 15, 0, landmark.at.y / 32 - 9); parent.add(group);
    const stair = landmark.kind !== 'threshold', depth = stair ? 1.35 : .52;
    this.box(group, 0, .017, 0, 1.35, .025, depth, '#233f47', .25);
    for (const x of [-.64, .64]) this.box(group, x, .039, 0, .045, .045, depth, '#b9a26c', .55);
    for (const z of [-depth / 2, depth / 2]) this.box(group, 0, .039, z, 1.35, .045, .045, '#b9a26c', .55);
    if (stair) {
      for (let i = 0; i < 5; i++) this.box(group, 0, .04, -.47 + i * .235, 1.17, .018, .15, landmark.kind === 'hatch' ? '#4c696a' : '#7c8277', .2);
      this.box(group, .78, .38, -.44, .065, .75, .065, '#b9a26c', .65);
      this.box(group, .78, .78, -.44, .16, .075, .16, '#a8c2b4', .2);
    } else for (const x of [-.35, 0, .35]) this.box(group, x, .04, 0, .1, .02, .22, '#b9a26c', .4);
  }

  floorPlate(parent: THREE.Object3D, at: Point) {
    const group = new THREE.Group(); group.position.set(at.x / 32 - 15, 0, at.y / 32 - 9); parent.add(group);
    // Flush hardware surrounds the existing state-colored floor indicator.
    // The center stays open for the engraved symbol and its active light.
    for (const side of [-1, 1]) {
      this.box(group, side * .56, .047, 0, .035, .025, 1.13, '#9faea1', .65);
      this.box(group, 0, .047, side * .56, 1.13, .025, .035, '#9faea1', .65);
      for (const end of [-1, 1]) this.box(group, side * .48, .058, end * .48, .065, .016, .065, '#bca16d', .7);
    }
    this.batchFixed(group);
  }

  lostProperty(parent: THREE.Object3D, at: Point) {
    const group = new THREE.Group(); group.position.set(at.x / 32 - 15, 0, at.y / 32 - 9); parent.add(group);
    // The player approaches the front at one tile south of this cabinet.
    this.box(group, 0, .1, 0, 1.72, .2, 1.06, '#283e3c');
    this.sculpt(group, 0, .98, 0, 1.54, 1.66, .86, '#b8c3af', .3);
    this.sculpt(group, 0, 1.83, 0, 1.68, .22, .96, '#d9d2b4', .1);
    this.sculpt(group, 0, 1.99, -.05, .92, .16, .55, '#536f70', .07);
    for (const x of [-.7, .7]) {
      this.box(group, x, .98, .45, .07, 1.63, .07, '#b29a67', .5);
      this.box(group, x, 1.78, .45, .14, .14, .13, '#c6b57b', .5);
    }
    for (const x of [-.34, .34]) for (const y of [.4, .69]) {
      this.box(group, x, y, .46, .59, .23, .045, '#405751');
      this.box(group, x, y + .015, .505, .15, .032, .058, '#cfb57a', .55);
    }
    this.box(group, 0, 1.04, .46, 1.09, .22, .04, '#1b3235');
    this.box(group, 0, .94, .57, 1.13, .04, .24, '#bca470', .5);
    this.box(group, 0, 1.49, .46, 1.19, .51, .055, '#c6ad76', .4);
    const names = ['姓名空白', '沈 舟'].map(name => {
      const holder = new THREE.Group(); holder.position.set(0, 1.49, .4); group.add(holder);
      return this.panel(holder, 1.08, .42, c => {
        c.fillStyle = '#263f40'; c.fillRect(0, 0, 512, 384);
        c.textAlign = 'center'; c.fillStyle = '#beac7b'; c.font = 'bold 70px serif'; c.fillText('B–17', 256, 112);
        c.fillStyle = '#eee3c0'; c.font = 'bold 108px "Microsoft YaHei", sans-serif'; c.fillText(name, 256, 285);
      });
    });
    names[1].visible = false;
    this.batchFixed(group);
    const ticket = this.box(group, 0, 1.01, .56, .43, .032, .19, '#eee0b8'); ticket.visible = false;
    const screen = this.box(group, .55, 1.06, .5, .075, .075, .027, '#7caaa7');
    screen.material = new THREE.MeshStandardMaterial({color: '#7caaa7', emissive: '#7caaa7', emissiveIntensity: .3}); screen.userData.ownedMaterial = true;
    return {screen, ticket, names};
  }

  doorCrown(level: Level, root: THREE.Object3D, width: number) {
    if (width > 2.5 || !['museum', 'gala', 'civic', 'archive'].includes(setting(level))) return;
    const look = sceneLook(level), outer = width / 2 + .08, inner = outer - .14;
    const shape = new THREE.Shape();
    shape.moveTo(-outer, 1.85); shape.absarc(0, 1.85, outer, Math.PI, 0, true);
    shape.lineTo(inner, 1.85); shape.absarc(0, 1.85, inner, 0, Math.PI, false); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: .3, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .035, bevelThickness: .025, curveSegments: 18}), new THREE.MeshStandardMaterial({color: look.cap, roughness: .73}));
    mesh.position.z = -.15; mesh.castShadow = mesh.receiveShadow = true; mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; root.add(mesh);
    const fan = new THREE.Shape(); fan.moveTo(-inner, 1.85); fan.absarc(0, 1.85, inner, Math.PI, 0, true); fan.closePath();
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(fan), new THREE.MeshStandardMaterial({color: '#365b63', metalness: .2, roughness: .35, side: THREE.DoubleSide}));
    pane.userData.ownedGeometry = pane.userData.ownedMaterial = true; root.add(pane);

  }

  foundation(level: Level, root: THREE.Object3D) {
    const look = sceneLook(level);
    // Broad layers instead of tiny brickwork keep the floating room silhouette legible.
    this.sculpt(root, 0, -.92, 0, 29.9, .48, 17.9, look.panel, .23);
    this.sculpt(root, 0, -1.22, 0, 29.25, .27, 17.25, look.background, .12);
  }

  archWindow(root: THREE.Object3D, level: Level) {
    const outline = (radius: number, bottom: number) => {
      const shape = new THREE.Shape(); shape.moveTo(-radius, bottom); shape.lineTo(radius, bottom); shape.lineTo(radius, 0.15);
      shape.absarc(0, 0.15, radius, 0, Math.PI, false); shape.closePath(); return shape;
    };
    const frameShape = outline(0.66, -0.76); frameShape.holes.push(new THREE.Path(outline(0.53, -0.64).getPoints()));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.09, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.025, bevelThickness: 0.02 }), new THREE.MeshStandardMaterial({ color: sceneLook(level).cap, roughness: .95 }));
    frame.castShadow = frame.receiveShadow = true; frame.userData.ownedGeometry = frame.userData.ownedMaterial = true; root.add(frame);
    const glass = document.createElement('canvas'); glass.width = 128; glass.height = 192;
    const c = glass.getContext('2d')!, sky = c.createLinearGradient(0, 0, 0, 192);
    sky.addColorStop(0, '#203951'); sky.addColorStop(0.65, '#608d9f'); sky.addColorStop(1, '#adc5bd'); c.fillStyle = sky; c.fillRect(0, 0, 128, 192);
    const texture = new THREE.CanvasTexture(glass); texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.ShapeGeometry(outline(0.53, -0.64)), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + 0.53) / 1.06, (positions.getY(i) + 0.64) / 1.32);
    const pane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, color: '#99bcc8', emissive: '#3e7596', emissiveIntensity: 0.23, roughness: 0.35 }));
    pane.position.z = 0.025; pane.userData.ownedGeometry = pane.userData.ownedTexture = true; root.add(pane);
    this.box(root, 0, -0.78, 0.13, 1.47, 0.12, 0.35, sceneLook(level).cap);
    return pane;
  }

  floor(level: Level, detail: boolean, _fallback: string) {
    const canvas = document.createElement('canvas'), resolution = detail ? 2 : 1;
    canvas.width = 960 * resolution; canvas.height = 576 * resolution;
    const c = canvas.getContext('2d')!, look = sceneLook(level);
    c.scale(resolution, resolution); c.fillStyle = look.floor; c.fillRect(0, 0, 960, 576);
    // Large quiet planes and fine pigment variations, no patterned parquet or floor copy.
    const light = c.createLinearGradient(0, 0, 780, 576);
    light.addColorStop(0, '#fff0d420'); light.addColorStop(.5, '#ffffff00'); light.addColorStop(1, '#253c4720');
    c.fillStyle = light; c.fillRect(0, 0, 960, 576);
    if (detail) {
      for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
        const x = col * 176 - (row % 2) * 52, y = row * 164;
        c.fillStyle = (row + col) % 3 ? '#ffffef04' : '#203c4105'; c.fillRect(x, y, 175, 163);
      }
      c.strokeStyle = '#f8edd820'; c.lineWidth = 1;
      c.beginPath(); c.roundRect(53, 53, 854, 470, 28); c.stroke();
    }
    this.floorContact(c, level); return canvas;
  }

  private floorContact(context: CanvasRenderingContext2D, level: Level) {
    // Static masonry contacts are baked once per room. Doors and characters
    // retain real-time shadows, so opening a gate never leaves a fake shadow.
    const mask = document.createElement('canvas'); mask.width = 960; mask.height = 576;
    const c = mask.getContext('2d')!; c.fillStyle = '#142025'; c.beginPath();
    for (const wall of level.walls) c.rect(wall.x, wall.y, 32, 32);
    c.fill(); context.save(); context.globalAlpha = 0.42; context.filter = 'blur(7px)'; context.drawImage(mask, 0, 0); context.restore();
  }

  private panel(parent: THREE.Object3D, width: number, height: number, paint: (c: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 384; paint(canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88 }));
    mesh.position.z = 0.105; mesh.userData.ownedGeometry = true; mesh.userData.ownedTexture = true; parent.add(mesh); return mesh;
  }

  wallDetails(level: Level, root: THREE.Object3D, width: number, depth: number, height: number) {
    if (height < 1) return;
    const look = sceneLook(level), horizontal = width > depth, span = Math.max(width, depth);
    const group = new THREE.Group(); group.position.set(horizontal ? 0 : width / 2, 0, horizontal ? depth / 2 : 0);
    if (!horizontal) group.rotation.y = Math.PI / 2; root.add(group);
    this.sculpt(group, 0, .22, .018, Math.max(.2, span - .16), .36, .09, look.panel, .035);
    if (height > 2.8) {
      for (let x = -span / 2 + 1.1; x < span / 2 - .5; x += 4.5) {
        this.sculpt(group, x, height / 2, .022, .1, height - .55, .08, look.cap, .035);
      }
    }
  }

  wallBay(level: Level, root: THREE.Object3D, x: number, z: number, horizontal: boolean, index: number) {
    const style = setting(level), look = sceneLook(level);
    if (style === 'station' && index === 3) { const clock = this.clock(root, x, z); if (!horizontal) clock.rotation.y = Math.PI / 2; return true; }
    // Sparse reliefs alternate with windows; the wall does not carry a second HUD.
    if (index % 4 === 3 || ['power', 'civic', 'records'].includes(style)) return false;
    const group = new THREE.Group(); group.position.set(x, 1.75, z); if (!horizontal) group.rotation.y = Math.PI / 2; root.add(group);
    this.sculpt(group, 0, 0, .01, 1.12, 1.53, .14, look.panel, .25);
    // An unlit inset echoes the tall apertures without posing as an interactable switch.
    this.sculpt(group, 0, .04, .095, .56, 1.1, .035, look.plaster, .017);
    this.sculpt(group, -.2, .04, .13, .045, .94, .04, look.cap, .018);
    return true;
  }

  clock(parent: THREE.Object3D, x: number, z: number) {
    const group = new THREE.Group(); group.position.set(x, 1.72, z); parent.add(group);
    this.box(group, 0, 0, 0, 1.44, 1.44, 0.14, '#3a4943');
    this.panel(group, 1.27, 1.27, c => {
      c.fillStyle = '#daceac'; c.fillRect(0, 0, 512, 384); c.save(); c.translate(256, 192); c.scale(1, 0.75);
      c.strokeStyle = '#344842'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 167, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 12; i++) { c.save(); c.rotate(i * Math.PI / 6); c.fillStyle = '#344842'; c.fillRect(-4, -152, 8, 19); c.restore(); }
      c.lineCap = 'round'; c.lineWidth = 11; c.beginPath(); c.moveTo(0, 0); c.lineTo(-77, -68); c.moveTo(0, 0); c.lineTo(97, -93); c.stroke(); c.restore();
    });
    return group;
  }

  exhibit(parent: THREE.Object3D, width: number, depth: number, index: number) {
    this.sculpt(parent, 0, .15, 0, width * .94, .3, depth * .94, '#48676c', .14);
    this.sculpt(parent, 0, .63, 0, width * .83, .83, depth * .83, '#b8b6a0', .18);
    this.sculpt(parent, 0, 1.04, 0, width * .9, .12, depth * .9, '#d9cfad', .055);
    const artifact = new THREE.Group(); artifact.position.y = 1.06; artifact.scale.setScalar(Math.min(width, depth) * 0.75); parent.add(artifact);
    const piece = (geometry: THREE.BufferGeometry, color: string, metal = 0) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: 0.42 }));
      mesh.castShadow = mesh.receiveShadow = true; mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; artifact.add(mesh); return mesh;
    };
    if (index % 3 === 0) {
      artifact.rotation.x = 0.4; this.watch(artifact, 0.03, 1);
    } else if (index % 3 === 1) {
      // A brass armillary instrument with three intersecting rings.
      const foot = piece(new THREE.CylinderGeometry(0.2, 0.28, 0.08, 16), '#63503a'); foot.position.y = 0.04;
      const stem = piece(new THREE.CylinderGeometry(0.045, 0.075, 0.25, 12), '#bda578', 0.6); stem.position.y = 0.19;
      for (let i = 0; i < 3; i++) { const ring = piece(new THREE.TorusGeometry(0.29, 0.019, 6, 24), '#c8aa6b', 0.65); ring.position.y = 0.46; ring.rotation.set(i * 0.72, i * 0.9, 0.3); }
      const globe = piece(new THREE.SphereGeometry(0.11, 12, 8), '#7baba9', 0.15); globe.position.y = 0.46;
    } else {
      // A salvaged telegraph: spool, contact lever and insulated terminals.
      this.box(artifact, 0, 0.065, 0, 0.65, 0.13, 0.48, '#53372a');
      const spool = piece(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 16), '#a9814c', 0.5); spool.rotation.z = Math.PI / 2; spool.position.set(-0.1, 0.25, -0.04);
      for (const x of [-0.26, 0.06]) { const flange = piece(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 16), '#283f43', 0.4); flange.rotation.z = Math.PI / 2; flange.position.set(x, 0.25, -0.04); }
      this.box(artifact, 0.1, 0.18, 0.15, 0.37, 0.045, 0.07, '#d3b674', 0.6);
      const key = piece(new THREE.SphereGeometry(0.068, 10, 6), '#233438'); key.position.set(0.25, 0.22, 0.15);
    }
    if (parent instanceof THREE.Group) this.batchFixed(parent);
  }

  private oval(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, glow = 0) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({color, roughness: .88, emissive: color, emissiveIntensity: glow}));
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = !glow; mesh.receiveShadow = true;
    mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; parent.add(mesh); return mesh;
  }

  private ring(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, color: string, horizontal = false, glow = 0) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, .035, 8, 32), new THREE.MeshStandardMaterial({color, roughness: .82, emissive: color, emissiveIntensity: glow}));
    mesh.position.set(x, y, z); if (horizontal) mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = !glow; mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; parent.add(mesh); return mesh;
  }

  pedestal(parent: THREE.Object3D, x: number, z: number) {
    this.sculpt(parent, x, .1, z, .95, .2, .82, '#43656d', .09);
    this.sculpt(parent, x, .46, z, .72, .6, .58, '#b9c4b4', .2);
    this.sculpt(parent, x, .79, z, 1.04, .13, .85, '#dfd4b7', .06);
  }

  document(parent: THREE.Object3D, height = .86) {
    this.sculpt(parent, 0, height, 0, .42, .06, .32, '#d6c4a3', .029);
    this.sculpt(parent, 0, height + .045, 0, .36, .04, .27, '#ece2c6', .018);
    this.box(parent, -.08, height + .07, 0, .045, .018, .28, '#789793');
    this.oval(parent, -.08, height + .087, .035, .045, .017, .045, '#a46e5e');
  }

  cover(level: Level, parent: THREE.Object3D, width: number, depth: number, index: number) {
    const style = setting(level), look = sceneLook(level), w = width * .96, d = depth * .96;
    if (style === 'museum') { this.exhibit(parent, width, depth, index); return true; }
    this.sculpt(parent, 0, .1, 0, w, .2, d, look.panel, .095);
    if (style === 'gala') {
      this.sculpt(parent, 0, .59, 0, w * .85, .86, d * .85, look.cap, .22);
      const fold = this.oval(parent, 0, 1.18, 0, Math.min(w,d) * .25, .38, Math.min(w,d) * .12, '#d9c5a8'); fold.rotation.z = -.4;
      this.ring(parent, 0, 1.33, 0, Math.min(w,d) * .24, look.trim);
    } else if (style === 'station' || style === 'records' || style === 'archive') {
      this.sculpt(parent, 0, .67, 0, w * .93, 1.13, d * .93, look.cap, .24);
      this.sculpt(parent, 0, .62, d * .47, w * .74, .67, .07, look.panel, .03);
      // Two broad archive drawers / cargo ribs keep their purpose without tiny fittings.
      for (const y of [.43, .79]) this.sculpt(parent, 0, y, d * .52, w * .64, .17, .08, look.plaster, .035);
      if (style === 'records' || style === 'archive') this.document(parent, 1.25);
    } else if (style === 'power' || style === 'retention') {
      this.sculpt(parent, 0, .84, 0, w * .94, 1.46, d * .94, look.panel, .28);
      for (const side of [-1, 1]) this.sculpt(parent, side * w * .31, .84, d * .35, w * .24, 1.27, d * .25, look.cap, .12);
      this.oval(parent, 0, .92, d * .48, w * .18, .43, .08, look.plaster);
    } else {
      this.sculpt(parent, 0, .8, 0, w * .94, 1.4, d * .94, look.cap, .25);
      this.sculpt(parent, 0, .79, d * .47, w * .71, 1.07, .06, look.panel, .029);
      if (style === 'civic') for (const y of [.43, .75, 1.07]) this.sculpt(parent, 0, y, d * .51, w * .52, .16, .09, look.plaster, .04);
      else this.ring(parent, 0, .86, d * .52, Math.min(w,d) * .22, look.trim);
    }
    return true;
  }

  circuit(parent: THREE.Object3D, level: Level, circuit: Circuit) {
    const look = sceneLook(level), group = new THREE.Group();
    group.position.set(circuit.x / 32 - 15, 0, circuit.y / 32 - 9 - .25); parent.add(group);
    this.sculpt(group, 0, .09, 0, .8, .18, .66, look.panel, .08);
    const bone = '#d3cfb3';
    if (circuit.feed) {
      this.sculpt(group, 0, .47, 0, .58, .66, .48, look.panel, .18);
      for (const side of [-1, 1]) this.oval(group, side * .2, .67, .07, .11, .43, .19, bone);
      this.ring(group, 0, .62, .28, .17, look.cap);
      const lamp = this.oval(group, 0, .62, .3, .11, .11, .035, '#b8d78e', .8);
      return {lamp, lever: undefined};
    }
    if (circuit.mechanical) {
      // Exposed bridge and jaws distinguish a physical latch from the sealed power pod.
      for (const side of [-1, 1]) this.sculpt(group, side * .26, .5, .02, .16, .76, .33, bone, .075);
      this.sculpt(group, 0, .86, .02, .65, .15, .32, bone, .07);
    } else {
      this.sculpt(group, 0, .48, 0, .63, .73, .47, bone, .21);
      this.sculpt(group, 0, .5, .24, .35, .4, .07, look.panel, .03);
    }
    const lever = new THREE.Group(); lever.position.set(0, .62, .26); group.add(lever);
    this.sculpt(lever, 0, .13, .065, .07, .3, .09, look.cap, .034);
    this.oval(lever, 0, .28, .07, .16, .067, .067, '#9a7360');
    const lamp = this.oval(group, 0, .87, -.03, .12, .045, .105, '#b8d78e', .8);
    return {lamp, lever};
  }

  field(parent: THREE.Object3D, area: { x: number; y: number; w: number; h: number }, color: string) {
    // Flush emitters match the exact simulated boundary; they are not obstacles.
    const group = new THREE.Group(); parent.add(group);
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.45 });
    for (const [i, [x, y]] of [[area.x, area.y], [area.x + area.w, area.y], [area.x, area.y + area.h], [area.x + area.w, area.y + area.h]].entries()) {
      const mesh = this.box(group, x / 32 - 15, 0.065, y / 32 - 9, 0.14, 0.035, 0.14, color); mesh.material = material;
      mesh.userData.ownedMaterial = i === 0; mesh.castShadow = false;
    }
    return material;
  }

  core(parent: THREE.Object3D) {
    this.ring(parent, 0, .89, 0, .26, '#bcb699', true);
    this.oval(parent, 0, 1.12, 0, .19, .29, .19, '#a4d8c9', .24);
    for (const side of [-1, 1]) this.oval(parent, side * .2, 1.09, 0, .07, .3, .17, '#ddd2b1');
    this.ring(parent, 0, 1.12, 0, .24, '#648782');
  }

  watch(parent: THREE.Object3D, height: number, scale = 1) {
    const group = new THREE.Group(); group.position.y = height; group.scale.setScalar(scale); parent.add(group);
    for (const [radius, y, color] of [[0.3, 0.04, '#b89a59'], [0.25, 0.09, '#e0d6b4']] as const) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.06, 24), new THREE.MeshStandardMaterial({ color, metalness: color === '#b89a59' ? 0.65 : 0, roughness: 0.6 }));
      mesh.position.y = y; mesh.castShadow = true; mesh.userData.ownedMaterial = true; mesh.userData.ownedGeometry = true; group.add(mesh);
    }
    this.box(group, 0, 0.132, -0.095, 0.022, 0.013, 0.19, '#3a493d');
    this.box(group, 0.065, 0.133, 0, 0.15, 0.013, 0.022, '#3a493d');
    this.box(group, 0, 0.04, -0.34, 0.11, 0.07, 0.1, '#b89a59', 0.65);
  }

  terminal(parent: THREE.Object3D, terminal: Terminal, station: boolean) {
    const group = new THREE.Group(); group.position.set(terminal.x / 32 - 15, 0, terminal.y / 32 - 9 - .38); parent.add(group);
    if (station && ['FAST', 'SERVICE'].includes(terminal.id)) {
      const west = terminal.x < 448; group.position.set(terminal.x / 32 - 15 + (west ? .38 : -.38), 0, terminal.y / 32 - 9);
      group.rotation.y = west ? -Math.PI / 2 : Math.PI / 2;
    }
    const shell = terminal.appearance === 'legacy' ? '#c4a27d' : terminal.appearance === 'manual' ? '#b8c0c8' : '#d8d3b9';
    const lining = terminal.id === 'SERVICE' ? '#91725f' : terminal.appearance === 'review' ? '#567772' : '#42656e';
    this.sculpt(group, 0, .09, 0, .86, .18, .69, lining, .08);
    this.sculpt(group, 0, .48, -.025, .73, .69, .57, shell, .22);
    this.sculpt(group, 0, .58, .24, .52, .35, .08, lining, .035);
    this.sculpt(group, 0, .385, .33, .61, .055, .24, shell, .026);
    if (terminal.kind === 'lock') {
      // Upright seal ring identifies authorisation, rather than a second storage slot.
      this.ring(group, 0, 1.07, -.1, .25, shell);
      this.sculpt(group, 0, .87, -.1, .07, .26, .09, lining, .034);
    } else if (terminal.kind === 'source') {
      this.oval(group, 0, .87, -.055, .37, .15, .25, shell);
      this.sculpt(group, 0, .9, .14, .48, .06, .09, lining, .028);
    } else {
      for (const side of [-1, 1]) this.oval(group, side * .26, .81, -.04, .09, .24, .22, shell);
    }
    if (terminal.appearance === 'legacy') this.ring(group, -.39, .58, .04, .14, '#a37f5c');
    if (terminal.appearance === 'manual') this.sculpt(group, .34, .56, .22, .08, .31, .12, lining, .035);
    if (terminal.appearance === 'review') for (const side of [-1, 1]) this.sculpt(group, side * .32, .24, .05, .085, .25, .47, lining, .04);
    const ticket = this.sculpt(group, 0, .57, .308, .32, .075, .04, '#ffe0a0', .018); ticket.visible = false;
    const screen = this.oval(group, 0, .83, .12, .16, .04, .09, '#94d7cd', .45);
    return {screen, ticket};
  }
}
