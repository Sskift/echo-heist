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
    this.box(group, 0, .98, 0, 1.54, 1.66, .86, '#624a37');
    this.box(group, 0, 1.88, 0, 1.77, .16, 1.04, '#9a7c4c');
    this.box(group, 0, 2.0, -.08, 1.15, .11, .66, '#3b514d');
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

  cover(level: Level, parent: THREE.Object3D, width: number, depth: number, index: number) {
    const style = setting(level), look = sceneLook(level);
    if (style === 'museum') { this.exhibit(parent, width, depth, index); return true; }
    if (style === 'archive' || style === 'station') return false;
    const w = width * 0.96, d = depth * 0.96;
    if (style === 'gala') {
      this.box(parent, 0, 0.1, 0, w, 0.2, d, '#3e3540');
      this.box(parent, 0, 0.64, 0, w * 0.92, 0.94, d * 0.92, '#785b63');
      this.box(parent, 0, 1.16, 0, w, 0.11, d, '#d2c19a');
      const sculpture = new THREE.Group(); sculpture.position.y = 1.4; parent.add(sculpture);
      const piece = this.box(sculpture, 0, 0, 0, Math.min(w, d) * 0.37, 0.36, Math.min(w, d) * 0.37, '#b29b64', 0.65); piece.rotation.set(0.2, Math.PI / 4, 0.3);
    } else if (style === 'records') {
      for (const x of [-0.3, 0.3]) this.box(parent, x * w, 0.09, 0, w * 0.16, 0.18, d, '#62523f');
      this.box(parent, 0, 0.24, 0, w, 0.1, d, '#a99069');
      for (let i = 0; i < 2; i++) {
        this.box(parent, 0, 0.57 + i * 0.57, 0, w * 0.94, 0.55, d * 0.94, i ? '#a18e66' : '#7d8168');
        this.box(parent, 0, 0.57 + i * 0.57, d * 0.48, w * 0.17, 0.55, 0.02, '#d4be87');
        this.box(parent, w * 0.23, 0.6 + i * 0.57, d * 0.49, w * 0.23, 0.17, 0.02, '#e6d8b1');
      }
    } else {
      this.box(parent, 0, 0.08, 0, w, 0.16, d, '#344349', 0.4);
      this.box(parent, 0, 0.85, 0, w * 0.96, 1.4, d * 0.96, look.panel, 0.35);
      this.box(parent, 0, 1.59, 0, w, 0.09, d, look.cap, 0.5);
      if (style === 'power' || style === 'retention') {
        for (let i = 0; i < 5; i++) this.box(parent, 0, 0.38 + i * 0.19, d * 0.49, w * 0.79, 0.075, 0.04, style === 'power' ? '#8e9b98' : '#5d6681', 0.3);
        this.box(parent, w * 0.33, 1.42, d * 0.49, w * 0.12, 0.055, 0.045, look.trim, 0.4);
      } else if (style === 'civic') {
        for (let i = 0; i < 3; i++) {
          this.box(parent, 0, 0.42 + i * 0.41, d * 0.49, w * 0.85, 0.35, 0.035, '#648075');
          this.box(parent, 0, 0.48 + i * 0.41, d * 0.52, w * 0.26, 0.04, 0.04, look.trim, 0.6);
        }
      } else {
        this.box(parent, 0, 0.87, d * 0.49, w * 0.84, 1.24, 0.035, '#7c949c', 0.65);
        this.box(parent, 0, 0.88, d * 0.54, w * 0.38, 0.07, 0.08, '#d4bf8a', 0.7);
        this.box(parent, 0, 0.88, d * 0.54, 0.07, 0.4, 0.08, '#d4bf8a', 0.7);
      }
    }
    return true;
  }

  circuit(parent: THREE.Object3D, level: Level, circuit: Circuit) {
    const look = sceneLook(level), group = new THREE.Group();
    group.position.set(circuit.x / 32 - 15, 0, circuit.y / 32 - 9 - 0.25); parent.add(group);
    if (circuit.mechanical) {
      // Open bronze linkage, visibly distinct from an electrical cabinet.
      this.box(group, 0, 0.07, 0, 0.72, 0.14, 0.58, '#50483c', 0.4);
      for (const x of [-0.23, 0.23]) this.box(group, x, 0.48, 0, 0.09, 0.82, 0.14, '#ad8d55', 0.7);
      this.box(group, 0, 0.83, 0, 0.64, 0.12, 0.15, '#8e7149', 0.7);
      const lever = new THREE.Group(); lever.position.set(0, 0.72, 0.07); group.add(lever);
      this.box(lever, 0, 0.2, 0.1, 0.065, 0.47, 0.065, '#c8aa72', 0.7);
      this.box(lever, 0, 0.43, 0.1, 0.34, 0.095, 0.095, '#704536');
      const lamp = this.box(group, 0, 0.35, 0.12, 0.24, 0.12, 0.035, '#c7b386');
      lamp.material = new THREE.MeshStandardMaterial({ color: '#c7b386', roughness: 0.7 }); lamp.userData.ownedMaterial = true;
      return { lamp, lever };
    }
    if (circuit.feed) {
      this.box(group, 0, 0.08, 0, 0.74, 0.16, 0.62, '#354b4e', 0.5);
      this.box(group, 0, 0.56, 0, 0.64, 0.8, 0.48, '#476572', 0.4);
      this.box(group, 0, 0.58, 0.25, 0.5, 0.59, 0.045, '#243c44', 0.5);
      for (const x of [-0.15, 0.15]) {
        this.box(group, x, 0.58, 0.285, 0.075, 0.39, 0.06, '#c7a66d', 0.7);
        for (const y of [0.42, 0.57, 0.72]) this.box(group, x, y, 0.32, 0.16, 0.06, 0.06, '#778e8a', 0.4);
      }
      const lamp = this.box(group, 0, 0.89, 0.285, 0.42, 0.07, 0.05, '#b8d78e');
      lamp.material = new THREE.MeshStandardMaterial({ color: '#b8d78e', emissive: '#b8d78e', emissiveIntensity: 0.8 }); lamp.userData.ownedMaterial = true;
      return { lamp, lever: undefined };
    }
    this.box(group, 0, 0.08, 0, 0.7, 0.16, 0.65, '#354b4e', 0.4);
    this.box(group, 0, 0.52, 0, 0.62, 0.76, 0.48, look.panel, 0.4);
    this.box(group, 0, 0.64, 0.25, 0.49, 0.44, 0.045, '#aaa98c', 0.45);
    this.box(group, 0, 0.61, 0.28, 0.06, 0.28, 0.03, '#293d41');
    const lever = new THREE.Group(); lever.position.set(0, 0.59, 0.29); group.add(lever);
    this.box(lever, 0, 0.11, 0.09, 0.045, 0.23, 0.045, '#ded4ad', 0.6);
    this.box(lever, 0, 0.23, 0.09, 0.19, 0.09, 0.09, '#825444');
    const lamp = this.box(group, 0, 0.93, 0, 0.2, 0.05, 0.2, '#b8d78e');
    lamp.material = new THREE.MeshStandardMaterial({ color: '#b8d78e', emissive: '#b8d78e', emissiveIntensity: 0.8 }); lamp.userData.ownedMaterial = true;
    return { lamp, lever };
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
    this.box(parent, 0, 0.87, 0, 0.54, 0.13, 0.4, '#3b5359', 0.6);
    this.box(parent, 0, 1.11, 0, 0.35, 0.36, 0.3, '#95c1bb', 0.4);
    for (const x of [-0.22, 0.22]) this.box(parent, x, 1.09, 0, 0.07, 0.38, 0.35, '#b7ac83', 0.7);
    this.box(parent, 0, 1.32, 0, 0.53, 0.09, 0.4, '#d4be8b', 0.6);
    for (const y of [1.02, 1.18]) this.box(parent, 0, y, 0.16, 0.24, 0.04, 0.015, '#d2e4c2');
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
    const group = new THREE.Group(), at = { x: terminal.x / 32 - 15, z: terminal.y / 32 - 9 - 0.38 }; group.position.set(at.x, 0, at.z); parent.add(group);
    if (terminal.appearance === 'review') {
      this.box(group, 0, 0.09, 0, 0.96, 0.18, 0.75, '#aeb29d');
      this.box(group, 0, 0.45, 0, 0.74, 0.64, 0.56, '#355e59');
      for (const x of [-0.33, 0.33]) this.box(group, x, 0.46, 0.28, 0.045, 0.59, 0.035, '#bfaa74', 0.5);
      this.box(group, 0, 0.81, 0, 1.06, 0.13, 0.82, '#d0c6a8');
      this.box(group, 0, 0.39, 0.3, 0.48, 0.13, 0.045, '#152f35');
      this.box(group, 0, 0.3, 0.33, 0.58, 0.04, 0.13, '#c1a974', 0.5);
      this.box(group, -0.19, 0.9, 0.08, 0.32, 0.028, 0.39, '#e5dac0');
      for (let i = 0; i < 3; i++) this.box(group, -0.19, 0.916, -0.03 + i * 0.07, 0.21, 0.006, 0.011, '#8c9b8b');
      if (terminal.kind === 'lock') {
        this.box(group, 0.27, 0.92, -0.1, 0.24, 0.07, 0.25, '#3d4b46', 0.4);
        this.box(group, 0.27, 1.02, -0.16, 0.045, 0.25, 0.045, '#bc9a61', 0.6);
        this.box(group, 0.27, 1.13, -0.08, 0.18, 0.045, 0.21, '#bc9a61', 0.6);
      } else for (let i = 0; i < 2; i++) this.box(group, 0.25, 0.9 + i * 0.045, -0.1, 0.28, 0.035, 0.35, i ? '#94aba0' : '#b9a06e');
      this.batchFixed(group);
      const ticket = this.box(group, 0, 0.4, 0.33, 0.32, 0.07, 0.045, '#ffe0a0'); ticket.visible = false;
      const screen = this.box(group, 0, 0.9, -0.32, 0.37, 0.035, 0.13, '#78bfc2');
      screen.material = new THREE.MeshStandardMaterial({ color: '#78bfc2', emissive: '#78bfc2', emissiveIntensity: 0.35 }); screen.userData.ownedMaterial = true;
      return { screen, ticket };
    }
    if (terminal.appearance) {
      const old = terminal.appearance === 'legacy', casing = old ? '#664833' : '#385668', trim = old ? '#bd9956' : '#9aadb5';
      this.box(group, 0, 0.08, 0, 0.93, 0.16, 0.64, '#263b40', 0.25);
      this.box(group, 0, 0.47, 0, 0.86, 0.68, 0.55, casing, old ? 0 : 0.35);
      this.box(group, 0, 0.84, 0, 1.04, 0.1, 0.73, trim, 0.4);
      this.box(group, 0, 0.55, 0.29, 0.62, 0.27, 0.025, '#142c35');
      this.box(group, 0, 0.41, 0.36, 0.48, 0.04, 0.15, trim, 0.6);
      for (const x of [-0.37, 0.37]) {
        this.box(group, x, 0.48, 0.295, old ? 0.055 : 0.085, 0.62, 0.055, trim, 0.4);
        if (!old) for (const y of [0.21, 0.75]) this.box(group, x, y, 0.34, 0.035, 0.035, 0.025, '#283a43', 0.5);
      }
      const sign = new THREE.Group(); sign.position.set(0, 0.23, 0.22); group.add(sign);
      this.panel(sign, 0.59, 0.19, c => {
        c.fillStyle = old ? '#503c28' : '#213f52'; c.fillRect(0, 0, 512, 384);
        c.fillStyle = '#e4d1a2'; c.textAlign = 'center'; c.font = 'bold 130px serif'; c.fillText(old ? '旧班' : '人工', 256, 244);
      });
      if (old) {
        this.box(group, 0, 0.965, -0.23, 0.72, 0.16, 0.12, casing);
        this.box(group, 0, 1.06, -0.23, 0.79, 0.04, 0.16, trim, 0.4);
      }
      this.batchFixed(group);
      const ticket = this.box(group, 0, 0.54, 0.325, 0.32, 0.07, 0.045, '#ffe0a0'); ticket.visible = false;
      const screen = this.box(group, 0, 0.9, -0.05, 0.4, 0.045, 0.23, '#78bfc2');
      screen.material = new THREE.MeshStandardMaterial({ color: '#78bfc2', emissive: '#78bfc2', emissiveIntensity: 0.35 }); screen.userData.ownedMaterial = true;
      return { screen, ticket };
    }
    if (station && ['FAST', 'SERVICE'].includes(terminal.id)) {
      const west = terminal.x < 448; group.position.set(terminal.x / 32 - 15 + (west ? 0.38 : -0.38), 0, terminal.y / 32 - 9);
      group.rotation.y = west ? -Math.PI / 2 : Math.PI / 2;
    }
    const cabinet = station && ['FAST', 'SERVICE', 'ARCHIVE', 'RETURN'].includes(terminal.id);
    const tint = terminal.id === 'SERVICE' ? '#a77e45' : terminal.id === 'FAST' ? '#437e82' : '#48616a';
    const width = cabinet ? .88 : .74, body = cabinet ? tint : station ? '#3e5d59' : '#5e5646';
    this.box(group, 0, .07, 0, width + .05, .14, .61, '#253d40');
    this.box(group, 0, .44, 0, width, .65, .55, body);
    this.box(group, 0, .76, 0, width + .09, .045, .62, '#b69a66', .65);
    this.box(group, 0, .825, 0, cabinet ? 1 : .86, .09, .71, '#b9b09a');
    this.box(group, 0, .405, .286, width - .16, .42, .025, '#263f40');
    for (const side of [-1, 1]) {
      this.box(group, side * (width / 2 - .045), .43, .3, .035, .57, .045, '#a78e61', .65);
      this.box(group, side * (width / 2 - .07), .16, .313, .065, .042, .025, '#d0ba78', .65);
    }
    this.box(group, 0, .64, .31, width - .18, .075, .035, body);
    this.box(group, 0, .53, .325, .22, .03, .045, '#d0ba78', .65);
    // A bound register and a seal belong to the desk, distinct from the one
    // luminous credential which appears only in its actual holder's slot.
    const register = new THREE.Group(); register.position.set(-.2, .882, .14); register.rotation.y = -.16; group.add(register);
    this.box(register, 0, .016, 0, .25, .032, .29, '#384f47');
    this.box(register, 0, .039, .005, .215, .018, .25, '#c7bda1');
    this.box(register, 0, .055, 0, .25, .017, .29, '#384f47');
    this.box(register, -.07, .065, 0, .011, .005, .25, '#b89d67', .5); this.batchFixed(register);
    if (terminal.kind === 'lock') {
      this.box(group, .26, .89, .12, .17, .035, .17, '#a08761', .5);
      this.box(group, .26, .975, .12, .065, .14, .065, '#3d4440');
    }
    if (cabinet) {
      this.box(group, 0, 0.52, 0.29, 0.69, 0.28, 0.03, '#1d3b42');
      this.box(group, 0, 0.39, 0.34, 0.28, 0.035, 0.06, '#d0ba78', 0.65);
      this.box(group, -0.3, 0.13, 0.29, 0.12, 0.05, 0.035, '#d0ba78', 0.65);
      this.box(group, 0.3, 0.13, 0.29, 0.12, 0.05, 0.035, '#d0ba78', 0.65);
    }
    this.batchFixed(group);
    const ticket = this.box(group, 0, 0.57, 0.34, 0.32, 0.07, 0.045, '#ffe0a0'); ticket.visible = false;
    const screen = this.box(group, 0, 0.875, -0.1, 0.4, 0.045, 0.23, '#78bfc2');
    screen.material = new THREE.MeshStandardMaterial({ color: '#78bfc2', emissive: '#78bfc2', emissiveIntensity: 0.35 }); screen.userData.ownedMaterial = true;
    return { screen, ticket };
  }
}
