import * as THREE from 'three';
import type { Circuit, Level, Terminal } from './levels.ts';

type Box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, metal?: number) => THREE.Mesh;
type Setting = 'museum' | 'gala' | 'records' | 'power' | 'station' | 'retention' | 'civic' | 'vault' | 'archive';
export function setting(level: Level): Setting {
  const chapter = /^C([0-7])-/.exec(level.id)?.[1];
  if (chapter) return (['museum', 'gala', 'records', 'power', 'station', 'retention', 'civic', 'vault'] as const)[Number(chapter)];
  if (/^(01|02|03)$/.test(level.id)) return 'museum';
  if (level.id.startsWith('LAB-NULL')) return 'retention';
  if (level.id.startsWith('LAB-POWER')) return 'power';
  if (level.id.startsWith('LAB-TIME')) return 'gala';
  return 'archive';
}
const looks = {
  museum: { plaster: '#50696b', panel: '#213c40', floor: '#79624c', trim: '#bca16d', cap: '#748984', light: '#ffd196', background: '#101d2a', title: '旧馆 · 失物档案' },
  gala: { plaster: '#805962', panel: '#422e40', floor: '#bbb095', trim: '#c3a568', cap: '#aa8d76', light: '#ffd6a0', background: '#261f31', title: '夜场 · 拍卖会' },
  records: { plaster: '#827769', panel: '#435e58', floor: '#8a9181', trim: '#b7a27a', cap: '#9b9e8b', light: '#dfe9bb', background: '#1c302f', title: '市政档案 · 转运区' },
  power: { plaster: '#5c7075', panel: '#32444b', floor: '#626d6e', trim: '#b59a52', cap: '#89958d', light: '#b5e2e7', background: '#182832', title: '市政配电 · 维护区' },
  station: { plaster: '#71847c', panel: '#294e59', floor: '#637572', trim: '#bca16d', cap: '#8e9e89', light: '#f7d897', background: '#14252d', title: '北站 · 货运登记' },
  retention: { plaster: '#5b6277', panel: '#282e44', floor: '#737e8d', trim: '#9498af', cap: '#929bad', light: '#c5c3fa', background: '#1b2234', title: '转存设施 · 投影核验' },
  civic: { plaster: '#aea891', panel: '#42675f', floor: '#c1b9a0', trim: '#b39b5f', cap: '#c2b793', light: '#f4dfa7', background: '#253434', title: '市政厅 · 公共登记' },
  vault: { plaster: '#899ca4', panel: '#344d60', floor: '#a0adb0', trim: '#bdab7a', cap: '#b4c0bd', light: '#d9eced', background: '#172a37', title: '中央总库 · 身份档案' },
  archive: { plaster: '#647571', panel: '#394f50', floor: '#817968', trim: '#bca16d', cap: '#8e9e89', light: '#f7d897', background: '#14252d', title: '档案 · 机制演习' },
};
export const sceneLook = (level: Level) => looks[setting(level)];

// Dressing follows the existing floor plan. Solid props replace occupied cells;
// wall art stays on wall faces, and painted floor markings add no cover.
export class SetDressing {
  constructor(private box: Box) {}

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
    for (const angle of [Math.PI / 4, Math.PI / 2, Math.PI * .75]) {
      const spoke = this.box(root, Math.cos(angle) * inner / 2, 1.85 + Math.sin(angle) * inner / 2, .06, inner, .035, .04, look.trim, .5); spoke.rotation.z = angle;
    }
    this.box(root, 0, 1.85 + outer, .03, .19, .26, .4, look.trim, .25);
    for (const side of [-1, 1]) {
      this.box(root, side * (width / 2 - .04), 1.72, 0, .27, .17, .7, look.cap);
      this.box(root, side * (width / 2 - .04), .14, 0, .27, .28, .7, look.panel);
    }
  }

  architecture(level: Level, root: THREE.Object3D, width: number, depth: number, height: number) {
    if (height < 2.8) return;
    const look = sceneLook(level), formal = ['museum', 'gala', 'station', 'civic', 'archive'].includes(setting(level));
    const horizontal = width > depth, span = Math.max(width, depth), group = new THREE.Group();
    group.position.set(horizontal ? 0 : width / 2, 0, horizontal ? depth / 2 : 0);
    if (!horizontal) group.rotation.y = Math.PI / 2; root.add(group);
    const parts: { p: number[]; s: number[]; color: string }[] = [];
    const add = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => parts.push({ p: [x, y, z], s: [w, h, d], color });
    // All pieces stay attached to the existing wall footprint. Batch the small
    // mouldings into one draw call per wall, including their real shadows.
    for (let x = -span / 2 + 0.5; x < span / 2; x += 6) {
      add(x, height / 2, 0.06, 0.38, height, 0.2, formal ? look.cap : look.panel);
      add(x, 0.2, 0.14, 0.58, 0.4, 0.33, look.panel);
      add(x, 0.46, 0.14, 0.5, 0.12, 0.32, look.trim);
      add(x, height - 0.38, 0.11, 0.49, 0.13, 0.28, look.cap);
      add(x, height - 0.25, 0.12, 0.64, 0.14, 0.34, look.trim);
      if (formal) for (const dx of [-0.12, 0, 0.12]) add(x + dx, height / 2, 0.171, 0.038, height - 1.25, 0.012, look.panel);
      else for (const y of [0.65, height - 0.6]) add(x, y, 0.18, 0.16, 0.16, 0.045, look.trim);
    }
    add(0, height - 0.09, 0.1, span, 0.16, 0.36, look.panel);
    if (formal) for (let x = -span / 2 + 0.2; x < span / 2; x += 0.4) add(x, height - 0.24, 0.12, 0.12, 0.09, 0.22, look.cap);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.76 }), parts.length);
    const transform = new THREE.Object3D(), color = new THREE.Color();
    parts.forEach((part, i) => { transform.position.fromArray(part.p); transform.scale.fromArray(part.s); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); mesh.setColorAt(i, color.set(part.color)); });
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.ownedGeometry = mesh.userData.ownedMaterial = true; group.add(mesh);
  }

  foundation(level: Level, root: THREE.Object3D) {
    const industrial = ['power', 'retention', 'vault'].includes(setting(level));
    const stones: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
    for (let row = 0; row < 3; row++) {
      const y = -0.22 - row * 0.25;
      for (let x = -15; x < 15; x += 1.5) stones.push({ x: x + 0.72, y, z: 9.185, w: 1.46, h: 0.22, d: 0.09 });
      for (let z = -9; z < 9; z += 1.5) stones.push({ x: 15.185, y, z: z + 0.72, w: 0.09, h: 0.22, d: 1.46 });
    }
    const masonry = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }), stones.length);
    const transform = new THREE.Object3D(), shade = new THREE.Color();
    stones.forEach((stone, index) => {
      transform.position.set(stone.x, stone.y, stone.z); transform.scale.set(stone.w, stone.h, stone.d); transform.updateMatrix(); masonry.setMatrixAt(index, transform.matrix);
      shade.set(industrial ? '#42505a' : '#686257').multiplyScalar(0.8 + (index * 7 % 11) / 35); masonry.setColorAt(index, shade);
    });
    masonry.castShadow = masonry.receiveShadow = true; masonry.userData.ownedGeometry = masonry.userData.ownedMaterial = true; root.add(masonry);
    if (industrial) for (let x = -13; x < 15; x += 4) {
      this.box(root, x, -0.45, 9.26, 0.2, 0.88, 0.13, '#273640', 0.5);
      for (const y of [-0.16, -0.7]) this.box(root, x, y, 9.34, 0.07, 0.07, 0.025, '#9c9b88', 0.6);
    }
  }

  archWindow(root: THREE.Object3D, level: Level) {
    const outline = (radius: number, bottom: number) => {
      const shape = new THREE.Shape(); shape.moveTo(-radius, bottom); shape.lineTo(radius, bottom); shape.lineTo(radius, 0.15);
      shape.absarc(0, 0.15, radius, 0, Math.PI, false); shape.closePath(); return shape;
    };
    const frameShape = outline(0.66, -0.76); frameShape.holes.push(new THREE.Path(outline(0.53, -0.64).getPoints()));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.09, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.025, bevelThickness: 0.02 }), new THREE.MeshStandardMaterial({ color: sceneLook(level).trim, metalness: 0.35, roughness: 0.5 }));
    frame.castShadow = frame.receiveShadow = true; frame.userData.ownedGeometry = frame.userData.ownedMaterial = true; root.add(frame);
    const glass = document.createElement('canvas'); glass.width = 128; glass.height = 192;
    const c = glass.getContext('2d')!, sky = c.createLinearGradient(0, 0, 0, 192);
    sky.addColorStop(0, '#203951'); sky.addColorStop(0.65, '#608d9f'); sky.addColorStop(1, '#adc5bd'); c.fillStyle = sky; c.fillRect(0, 0, 128, 192);
    for (let i = 0; i < 8; i++) { const x = i * 19 - 7, y = 134 + i * 7 % 30; c.fillStyle = '#1a343f'; c.fillRect(x, y, 17, 192 - y); c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 8, y - 12); c.lineTo(x + 20, y); c.fill(); c.fillStyle = '#d3bc7e'; c.fillRect(x + 6, y + 9, 3, 5); }
    c.fillStyle = '#d4dfc4'; c.beginPath(); c.arc(95, 35, 12, 0, Math.PI * 2); c.fill();
    const texture = new THREE.CanvasTexture(glass); texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.ShapeGeometry(outline(0.53, -0.64)), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (positions.getX(i) + 0.53) / 1.06, (positions.getY(i) + 0.64) / 1.32);
    const pane = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, color: '#99bcc8', emissive: '#3e7596', emissiveIntensity: 0.23, roughness: 0.35 }));
    pane.position.z = 0.025; pane.userData.ownedGeometry = pane.userData.ownedTexture = true; root.add(pane);
    this.box(root, 0, -0.02, 0.13, 0.045, 1.41, 0.055, '#acb6a6', 0.5);
    this.box(root, 0, -0.19, 0.13, 1.06, 0.045, 0.055, '#acb6a6', 0.5);
    this.box(root, 0, -0.78, 0.13, 1.47, 0.12, 0.35, sceneLook(level).cap);
    return pane;
  }

  private chapterFloor(c: CanvasRenderingContext2D, level: Level, detail: boolean) {
    const style = setting(level), look = sceneLook(level), formal = style === 'gala' || style === 'civic' || style === 'vault';
    const tile = style === 'vault' ? 96 : 64;
    c.fillStyle = look.floor; c.fillRect(0, 0, 960, 576);
    for (let y = 0; y < 576; y += tile) for (let x = 0; x < 960; x += tile) {
      c.fillStyle = (x + y) % (tile * 2) ? '#ffffff09' : '#192d3810'; c.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      c.strokeStyle = formal ? '#3c50482e' : '#25384645'; c.lineWidth = 1; c.strokeRect(x, y, tile, tile);
      if (detail && formal) {
        c.strokeStyle = '#e5e3cf30'; c.beginPath(); c.moveTo(x + 4, y + 40); c.lineTo(x + 22, y + 36); c.lineTo(x + 28, y + 20); c.lineTo(x + 57, y + 14); c.stroke();
      }
    }
    if (!detail) return;
    c.strokeStyle = formal ? look.panel : '#32444e'; c.lineWidth = formal ? 14 : 7; c.strokeRect(54, 54, 852, 468);
    c.strokeStyle = look.trim; c.lineWidth = 2; c.strokeRect(54, 54, 852, 468);
    if (style === 'gala') {
      for (const [x, w] of [[72, 322], [558, 328]]) {
        c.fillStyle = '#533440aa'; c.fillRect(x, 226, w, 128);
        c.strokeStyle = '#c6aa7780'; c.lineWidth = 2; c.strokeRect(x + 6, 232, w - 12, 116);
        for (let y = 246; y < 346; y += 24) { c.beginPath(); c.moveTo(x + 15, y); c.lineTo(x + 30, y + 12); c.lineTo(x + 15, y + 24); c.stroke(); }
      }
    } else if (style === 'records') {
      c.strokeStyle = '#e5d6a966'; c.lineWidth = 3; c.setLineDash([16, 7]); c.strokeRect(80, 80, 800, 416); c.setLineDash([]);
      c.fillStyle = '#314a4666'; c.font = 'bold 17px monospace';
      for (let x = 120; x < 900; x += 192) c.fillText(`R-${String((x - 120) / 192 + 1).padStart(2, '0')}`, x, 108);
    } else if (style === 'power') {
      for (const t of level.circuits ?? []) {
        c.strokeStyle = '#a7b6ad70'; c.lineWidth = 2;
        for (const d of level.doors.filter(d => d.power?.id === t.id)) { c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.x, d.y + d.h / 2); c.lineTo(d.x + d.w / 2, d.y + d.h / 2); c.stroke(); }
        c.strokeStyle = '#cdb86780'; c.lineWidth = 3; c.strokeRect(t.x - 22, t.y - 22, 44, 44);
      }
      c.fillStyle = '#c4b37a';
      for (let x = 72; x < 880; x += 40) { c.save(); c.translate(x, 64); c.transform(1, 0, -0.5, 1, 0, 0); c.fillRect(0, 0, 13, 9); c.restore(); }
    } else if (style === 'retention') {
      c.strokeStyle = '#ced7e040'; c.lineWidth = 2;
      for (let x = 80; x < 920; x += 96) for (const y of [72, 504]) { c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke(); }
    } else if (style === 'civic' || style === 'vault') {
      for (const x of [220, 756]) {
        c.strokeStyle = `${look.panel}50`; c.lineWidth = 4; c.beginPath(); c.arc(x, 288, 52, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = `${look.trim}90`; c.lineWidth = 2; c.strokeRect(x - 38, 250, 76, 76);
        c.font = 'bold 24px serif'; c.textAlign = 'center'; c.fillStyle = `${look.panel}80`; c.fillText(style === 'vault' ? '档' : '公', x, 298);
      }
    }
    c.textAlign = 'center'; c.font = '500 15px sans-serif';
    c.fillStyle = look.panel; c.fillRect(330, 60, 300, 32); c.fillStyle = '#d7d2b3'; c.fillText(look.title, 480, 82);
  }

  floor(level: Level, detail: boolean, fallback: string) {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 576;
    const c = canvas.getContext('2d')!, style = setting(level);
    if (!['museum', 'station', 'archive'].includes(style)) { this.chapterFloor(c, level, detail); this.floorContact(c, level); return canvas; }
    c.fillStyle = style === 'station' ? '#637572' : style === 'museum' ? '#79624c' : fallback; c.fillRect(0, 0, 960, 576);
    if (style === 'station') {
      c.fillStyle = '#526662'; c.fillRect(480, 32, 224, 512); c.fillStyle = '#7c7769'; c.fillRect(736, 32, 192, 512);
      for (let y = 32; y < 544; y += 48) for (let x = 32; x < 928; x += 48) {
        c.fillStyle = (x + y) % 96 ? '#e3dcc20a' : '#192d2a0e'; c.fillRect(x + 1, y + 1, 46, 46);
        c.strokeStyle = '#283e3b40'; c.lineWidth = 1; c.strokeRect(x, y, 48, 48);
      }
      if (detail) {
        c.strokeStyle = '#c2b174'; c.lineWidth = 4; c.strokeRect(52, 52, 856, 472);
        c.font = 'bold 42px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#d7c99660';
        for (const [x, text] of [[220, '01'], [602, '02'], [825, '03']] as const) c.fillText(text, x, 92);
        c.font = 'bold 12px sans-serif'; c.fillText('登 记 厅', 220, 111); c.fillText('接 应 站 台', 602, 111); c.fillText('货 运 档 案', 825, 111);
        if (level.id.startsWith('C4-6')) for (const [id, y] of [['FAST', 176], ['SERVICE', 432]] as const) {
          c.fillStyle = id === 'FAST' ? '#62969755' : '#b5915855'; c.fillRect(370, y - 26, 156, 52);
          c.strokeStyle = '#d8cda1a0'; c.lineWidth = 2; c.setLineDash([4, 4]); c.strokeRect(370, y - 26, 156, 52); c.setLineDash([]);
          c.fillStyle = '#ded2a5'; c.font = 'bold 10px sans-serif'; c.fillText(id, 400, y + 41); c.fillText(id, 496, y + 41);
        }
      }
    } else {
      for (let y = 0; y < 576; y += 24) for (let x = 0; x < 960; x += 72) {
        const offset = y % 48 ? 36 : 0, n = ((x * 17 + y * 31) % 37) / 37;
        c.fillStyle = `rgba(29,24,18,${0.05 + n * 0.1})`; c.fillRect(x - offset, y, 71, 23);
        c.strokeStyle = '#382e2437'; c.lineWidth = 0.6; c.strokeRect(x - offset, y, 71, 23);
        if (detail) { c.strokeStyle = '#d2ba8520'; c.beginPath(); c.moveTo(x - offset + 4, y + 7); c.lineTo(x - offset + 62, y + 6); c.stroke(); }
      }
      if (detail && style === 'museum') {
        // Alternating parquet blocks give the old gallery a crafted floor;
        // this remains a single baked texture with no gameplay geometry.
        c.fillStyle = '#584536'; c.fillRect(0, 0, 960, 576);
        for (let y = 0; y < 576; y += 64) for (let x = 0; x < 960; x += 64) {
          c.save(); c.translate(x + 32, y + 32); if ((x + y) % 128) c.rotate(Math.PI / 2);
          for (let p = 0; p < 4; p++) {
            const shade = (x * 7 + y * 11 + p * 17) % 31;
            c.fillStyle = `rgb(${105 + shade},${78 + shade * 0.72},${51 + shade * 0.55})`; c.fillRect(-31.5, -31.5 + p * 16, 63, 15);
            c.strokeStyle = '#dcc58d24'; c.lineWidth = 0.6;
            for (let line = 0; line < 3; line++) { c.beginPath(); c.moveTo(-27, -28 + p * 16 + line * 4); c.bezierCurveTo(-12, -30 + p * 16 + line * 4, 12, -24 + p * 16 + line * 4, 27, -28 + p * 16 + line * 4); c.stroke(); }
          }
          c.restore();
        }
      }
      if (detail && style === 'museum') {
        c.strokeStyle = '#283e36'; c.lineWidth = 13; c.strokeRect(55, 55, 850, 466);
        c.strokeStyle = '#bdac7d'; c.lineWidth = 2; c.strokeRect(55, 55, 850, 466);
        for (const [x, y] of [[72, 72], [888, 72], [72, 504], [888, 504]]) {
          c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#b7a377'; c.fillRect(-6, -6, 12, 12); c.restore();
        }
        c.fillStyle = '#162e2960'; c.fillRect(64, 234, 328, 98);
        c.strokeStyle = '#b9a47780'; c.lineWidth = 2; c.strokeRect(70, 240, 316, 86);
        c.font = '500 15px serif'; c.textAlign = 'center'; c.fillStyle = '#ccb78c90'; c.fillText('旧 馆 · 失 物 档 案', 234, 288);
      }
    }
    this.floorContact(c, level);
    return canvas;
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
    const style = setting(level), look = sceneLook(level), group = new THREE.Group(), horizontal = width > depth;
    group.position.set(horizontal ? 0 : width / 2 + 0.015, 0, horizontal ? depth / 2 + 0.015 : 0);
    if (!horizontal) group.rotation.y = Math.PI / 2; root.add(group);
    const span = Math.max(width, depth);
    const paneled = ['museum', 'gala', 'station', 'civic', 'archive'].includes(style);
    if (paneled) {
      // Recessed lower panels and a stepped cornice give walls a scale between
      // the architecture and the characters. They sit on occupied wall faces.
      const bays = Math.max(1, Math.floor(span / 2.4)), step = span / bays;
      for (let i = 0; i < bays; i++) {
        const x = -span / 2 + step * (i + 0.5);
        this.box(group, x, 0.38, 0.025, step - 0.26, 0.43, 0.045, '#142e33');
        this.box(group, x, 0.62, 0.065, step - 0.2, 0.038, 0.055, look.trim, 0.3);
        for (const side of [-1, 1]) this.box(group, x + side * (step / 2 - 0.12), 0.39, 0.06, 0.04, 0.49, 0.065, look.cap);
      }
      this.box(group, 0, 0.1, 0.07, span, 0.12, 0.16, look.panel);
      if (height > 2) {
        this.box(group, 0, height - 0.16, 0.07, span, 0.14, 0.16, look.panel);
        this.box(group, 0, height - 0.06, 0.1, span, 0.055, 0.23, look.trim, 0.3);
      }
    }
    if (style === 'power') {
      for (const y of [height - 0.21, height - 0.38]) this.box(group, 0, y, 0.02, span, 0.075, 0.075, '#929c91', 0.6);
      for (let x = -span / 2 + 0.4; x < span / 2; x += 3) this.box(group, x, height - 0.29, 0.02, 0.13, 0.35, 0.13, '#3d4a4c', 0.5);
    } else if (style === 'retention') {
      this.box(group, 0, height - 0.18, 0.02, span, 0.055, 0.07, '#9493b9', 0.4);
      this.box(group, 0, 0.11, 0.02, span, 0.075, 0.07, '#1b2332', 0.5);
    } else if (style === 'records') {
      this.box(group, 0, height - 0.2, 0.02, span, 0.14, 0.1, '#4b554c', 0.3);
    } else if (style === 'gala' || style === 'civic') {
      this.box(group, 0, height - 0.15, 0.01, span, 0.06, 0.1, look.trim, 0.5);
      this.box(group, 0, 0.11, 0.01, span, 0.08, 0.1, look.trim, 0.5);
    } else if (style === 'vault') {
      this.box(group, 0, height - 0.18, 0.02, span, 0.13, 0.12, '#344c5d', 0.65);
      for (let x = -span / 2 + 0.2; x < span / 2; x += 2) this.box(group, x, height - 0.18, 0.1, 0.055, 0.055, 0.04, '#c3bb95', 0.7);
    }
  }

  private chapterBay(level: Level, root: THREE.Object3D, x: number, z: number, horizontal: boolean, index: number) {
    const style = setting(level), look = sceneLook(level), group = new THREE.Group();
    group.position.set(x, 1.6, z); if (!horizontal) group.rotation.y = Math.PI / 2; root.add(group);
    if (style === 'gala' && index % 4 === 3) {
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) this.box(group, side * (0.69 + i * 0.08), 0.05, 0.12 - i * 0.025, 0.16, 1.72, 0.13, i % 2 ? '#6e3b50' : '#512d43');
      this.box(group, 0, 0.94, 0.05, 1.95, 0.08, 0.16, look.trim, 0.6); return false;
    }
    // CIV windows remain actual light indicators in the three-part power mission.
    if ((style === 'power' || style === 'civic' || style === 'records') && index % 4 === 3) return false;
    if (style === 'records') {
      this.box(group, 0, 0, 0, 1.72, 1.62, 0.15, '#3b504b');
      for (let row = 0; row < 3; row++) {
        const y = -0.5 + row * 0.46;
        this.box(group, 0, y - 0.19, 0.13, 1.64, 0.065, 0.3, '#9b9476', 0.4);
        for (let col = 0; col < 3; col++) {
          this.box(group, -0.5 + col * 0.5, y, 0.15, 0.43, 0.31, 0.23, ['#b3a782', '#718c7a', '#987d62'][(col + row) % 3]);
          this.box(group, -0.5 + col * 0.5, y, 0.275, 0.14, 0.08, 0.015, '#dcd1ad');
        }
      }
      for (const x of [-0.81, 0.81]) this.box(group, x, 0, 0.14, 0.06, 1.64, 0.3, '#a69c7e', 0.5);
      return true;
    }
    if (style === 'retention') {
      this.box(group, 0, 0, 0, 1.65, 1.55, 0.1, '#22283b', 0.4);
      for (let i = 0; i < 6; i++) this.box(group, -0.63 + i * 0.25, 0, 0.1, 0.13, 1.33, 0.1, i % 2 ? '#434760' : '#3b4159');
      this.box(group, 0, -0.66, 0.16, 1.4, 0.07, 0.04, '#9893b9', 0.5);
      return true;
    }
    this.box(group, 0, 0, 0, 1.7, 1.5, 0.08, look.panel, 0.3);
    this.box(group, 0, 0, 0.035, 1.59, 1.39, 0.07, look.trim, 0.5);
    this.panel(group, 1.47, 1.27, c => {
      c.fillStyle = style === 'gala' ? '#3d2b40' : style === 'power' ? '#bbc3b2' : style === 'vault' ? '#253e52' : '#d4c9a8'; c.fillRect(0, 0, 512, 384);
      c.textAlign = 'center'; c.fillStyle = style === 'gala' || style === 'vault' ? '#d7bd7f' : '#344b49'; c.font = 'bold 28px sans-serif';
      c.fillText(style === 'gala' ? '夜间拍卖 · 预展' : style === 'power' ? '市政配电 · 检修表' : style === 'civic' ? '公共登记 · 核验' : '中央总库 · 封存', 256, 53);
      if (style === 'power') {
        for (const x of [153, 359]) {
          c.fillStyle = '#e3dbc0'; c.fillRect(x - 83, 103, 166, 130); c.strokeStyle = '#3f5553'; c.lineWidth = 5;
          c.beginPath(); c.arc(x, 194, 63, Math.PI, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(x, 194); c.lineTo(x + 33, 147); c.stroke();
        }
        c.fillStyle = '#3f5553'; c.font = '20px monospace'; c.fillText('MUNICIPAL / 03', 256, 307);
      } else {
        c.strokeStyle = style === 'gala' || style === 'vault' ? '#c6a873' : '#617b62'; c.lineWidth = 5;
        c.beginPath(); c.arc(256, 197, 85, 0, Math.PI * 2); c.stroke();
        c.save(); c.translate(256, 197); c.rotate(Math.PI / 4); c.strokeRect(-50, -50, 100, 100); c.restore();
        c.font = 'bold 47px serif'; c.fillText(style === 'gala' ? '夜' : style === 'civic' ? '公' : '档', 256, 214);
        c.font = '17px monospace'; c.fillText(style === 'gala' ? 'NIGHT GALA' : style === 'civic' ? 'CIVIC HALL' : 'CENTRAL VAULT', 256, 340);
      }
    });
    if (style === 'power') {
      for (const x of [-0.77, 0.77]) this.box(group, x, 0, 0.12, 0.08, 1.5, 0.12, '#8d9e9a', 0.65);
      this.box(group, 0, -0.69, 0.17, 1.5, 0.14, 0.2, '#485d60', 0.5);
    }
    return true;
  }

  wallBay(level: Level, root: THREE.Object3D, x: number, z: number, horizontal: boolean, index: number) {
    const style = setting(level); if (style === 'archive' || (style === 'museum' && index % 4 === 3)) return false;
    if (style !== 'museum' && style !== 'station') return this.chapterBay(level, root, x, z, horizontal, index);
    if (style === 'station' && index === 3) { const clock = this.clock(root, x, z); if (!horizontal) clock.rotation.y = Math.PI / 2; return true; }
    const group = new THREE.Group(); group.position.set(x, 1.63, z); if (!horizontal) group.rotation.y = Math.PI / 2; root.add(group);
    const width = style === 'station' ? 1.65 : 1.2;
    this.box(group, 0, 0, 0, width + 0.12, 1.31, 0.07, '#3b392e');
    this.box(group, 0, 0, 0.025, width + 0.04, 1.24, 0.07, '#b7a06a', 0.45);
    this.panel(group, width - 0.05, 1.12, c => {
      c.fillStyle = style === 'station' ? '#1f353a' : '#c9b990'; c.fillRect(0, 0, 512, 384);
      if (style === 'station') {
        c.fillStyle = '#d9c58d'; c.font = 'bold 29px sans-serif'; c.textAlign = 'center'; c.fillText(index % 4 === 1 ? '北站 · 货运登记' : '双面交接柜', 256, 60);
        c.strokeStyle = '#bdaa745c'; c.lineWidth = 2;
        c.font = '22px monospace'; c.textAlign = 'left';
        for (const [i, line] of ['01   登记厅', '02   接应站台', '03   货运档案'].entries()) { c.beginPath(); c.moveTo(36, 102 + i * 76); c.lineTo(476, 102 + i * 76); c.stroke(); c.fillText(line, 44, 149 + i * 76); }
      } else {
        c.fillStyle = '#567064'; c.beginPath(); c.moveTo(0, 284); c.lineTo(105, 170); c.lineTo(220, 265); c.lineTo(335, 140); c.lineTo(512, 290); c.lineTo(512, 384); c.lineTo(0, 384); c.fill();
        c.fillStyle = '#a77954'; c.beginPath(); c.arc(index % 4 ? 374 : 128, 91, 47, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#344c43'; c.fillRect(90, 266, 52, 118); c.fillRect(173, 304, 118, 80); c.fillRect(343, 234, 48, 150);
        c.fillStyle = '#dfcca0'; c.font = '18px serif'; c.fillText('城 市 旧 影', 34, 351);
      }
    });
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
    this.box(parent, 0, 0.12, 0, width * 0.97, 0.24, depth * 0.97, '#344b43');
    this.box(parent, 0, 0.57, 0, width * 0.84, 0.76, depth * 0.84, '#85745b');
    this.box(parent, 0, 0.98, 0, width * 0.96, 0.1, depth * 0.96, '#b9a883', 0.2);
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
    const glassHeight = Math.max(0.56, Math.min(width, depth) * 0.63), top = 1.06 + glassHeight;
    const glass = this.box(parent, 0, 1.06 + glassHeight / 2, 0, width * 0.81, glassHeight, depth * 0.81, '#91b6af');
    glass.material = new THREE.MeshStandardMaterial({ color: '#b1d6ca', transparent: true, opacity: 0.08, depthWrite: false, roughness: 0.2, metalness: 0.1 }); glass.castShadow = false; glass.userData.ownedMaterial = true;
    for (const x of [-1, 1]) for (const z of [-1, 1]) this.box(parent, x * width * 0.407, 1.06 + glassHeight / 2, z * depth * 0.407, 0.023, glassHeight, 0.023, '#ae9160', 0.5);
    for (const z of [-1, 1]) this.box(parent, 0, top, z * depth * 0.407, width * 0.83, 0.027, 0.027, '#ae9160', 0.5);
    for (const x of [-1, 1]) this.box(parent, x * width * 0.407, top, 0, 0.027, 0.027, depth * 0.83, '#ae9160', 0.5);
    this.box(parent, 0, 0.87, depth * 0.425, width * 0.25, 0.12, 0.018, '#dfd0a3');
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
    this.box(group, 0, 0.38, 0, cabinet ? 0.88 : 0.68, 0.76, 0.55, cabinet ? tint : '#6a6553', 0.2);
    this.box(group, 0, 0.81, 0, cabinet ? 1 : 0.82, 0.1, 0.71, '#b9ad87', 0.4);
    if (cabinet) {
      this.box(group, 0, 0.52, 0.29, 0.69, 0.28, 0.03, '#1d3b42');
      this.box(group, 0, 0.39, 0.34, 0.28, 0.035, 0.06, '#d0ba78', 0.65);
      this.box(group, -0.3, 0.13, 0.29, 0.12, 0.05, 0.035, '#d0ba78', 0.65);
      this.box(group, 0.3, 0.13, 0.29, 0.12, 0.05, 0.035, '#d0ba78', 0.65);
    }
    const ticket = this.box(group, 0, 0.57, 0.315, 0.32, 0.07, 0.045, '#ffe0a0'); ticket.visible = false;
    const screen = this.box(group, 0, 0.875, -0.1, 0.4, 0.045, 0.23, '#78bfc2');
    screen.material = new THREE.MeshStandardMaterial({ color: '#78bfc2', emissive: '#78bfc2', emissiveIntensity: 0.35 }); screen.userData.ownedMaterial = true;
    return { screen, ticket };
  }
}
