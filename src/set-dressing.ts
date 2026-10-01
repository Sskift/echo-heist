import * as THREE from 'three';
import type { Level, Terminal } from './levels.ts';

type Box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, metal?: number) => THREE.Mesh;
export const setting = (level: Level) => level.id.startsWith('C4-') ? 'station' : level.id.startsWith('C0-') || /^(01|02|03)$/.test(level.id) ? 'museum' : 'archive';

// Dressing follows the existing floor plan. Solid props replace occupied cells;
// wall art stays on wall faces, and painted floor markings add no cover.
export class SetDressing {
  constructor(private box: Box) {}

  floor(level: Level, detail: boolean, fallback: string) {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 576;
    const c = canvas.getContext('2d')!, style = setting(level);
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
    return canvas;
  }

  private panel(parent: THREE.Object3D, width: number, height: number, paint: (c: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 384; paint(canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88 }));
    mesh.position.z = 0.105; mesh.userData.ownedGeometry = true; mesh.userData.ownedTexture = true; parent.add(mesh); return mesh;
  }

  wallBay(level: Level, root: THREE.Object3D, x: number, z: number, horizontal: boolean, index: number) {
    const style = setting(level); if (style === 'archive' || (style === 'museum' && index % 4 === 3)) return false;
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
    if (index % 3 === 0) {
      this.watch(parent, 1.07, Math.min(width, depth) * 0.9);
    } else if (index % 3 === 1) {
      this.box(parent, 0, 1.14, 0, width * 0.43, 0.24, depth * 0.48, '#4b6259');
      this.box(parent, 0, 1.32, 0, width * 0.25, 0.16, depth * 0.31, '#bda578', 0.5);
    } else {
      this.box(parent, 0, 1.19, 0, width * 0.46, 0.33, depth * 0.43, '#6d4e38');
      this.box(parent, 0, 1.28, 0.025, width * 0.32, 0.045, depth * 0.48, '#c6b580', 0.5);
    }
    const glass = this.box(parent, 0, 1.26, 0, width * 0.81, 0.48, depth * 0.81, '#91b6af');
    glass.material = new THREE.MeshStandardMaterial({ color: '#b1d6ca', transparent: true, opacity: 0.13, depthWrite: false, roughness: 0.2, metalness: 0.1 }); glass.castShadow = false; glass.userData.ownedMaterial = true;
    this.box(parent, 0, 0.87, depth * 0.425, width * 0.25, 0.12, 0.018, '#dfd0a3');
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
