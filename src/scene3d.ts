import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Game, type Frame } from './engine.ts';
import { doorPlates, ECHO_COLORS, HEIGHT, TILE, WIDTH, type Level, type Point } from './levels.ts';
import { Models3D, type ModelName, type CharacterRole } from './models3d.ts';
import { VIEW_WIDTH, VIEW_HEIGHT } from './isometric.ts';
import { SetDressing, setting } from './set-dressing.ts';

type Actor = ReturnType<Models3D['character']>;
type Label = { at: Point; height: number; text: string; color: string };
type Wall = { root: THREE.Group; x: number; y: number; w: number; h: number; tall: boolean };
const world = (at: Point, height = 0) => new THREE.Vector3(at.x / TILE - 15, height, at.y / TILE - 9);
const colors = { brass: '#bca16d', light: '#f7d897', cyan: '#8ed4ed', lime: '#c3ed82', red: '#ed947c' };
const themes = {
  archive: ['#647571', '#394f50', '#817968'], gala: ['#b0a18a', '#555c59', '#a4977c'],
  industrial: ['#778d93', '#354f5b', '#7a8886'], clockwork: ['#918b79', '#415953', '#8f7c5f'], audit: ['#8e8a9f', '#48465e', '#928779'],
};

export class Renderer {
  trails = true;
  detail = true;
  closeup = false;
  rewindFlash = 0;
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly ctx: CanvasRenderingContext2D;
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-20, 20, 12.5, -12.5, 0.1, 150);
  private readonly models = new Models3D();
  private readonly levelRoot = new THREE.Group();
  private readonly overlay = document.createElement('canvas');
  private readonly ground = document.createElement('canvas');
  private readonly groundTexture: THREE.CanvasTexture;
  private readonly keyLight = new THREE.DirectionalLight('#ffedce', 2.6);
  private readonly mat = new Map<string, THREE.MeshStandardMaterial>();
  private readonly cube = new RoundedBoxGeometry(1, 1, 1, 2, 0.035);
  private readonly dressing = new SetDressing((...args) => this.box(...args));
  private ready = false;
  private level?: Level;
  private walls: Wall[] = [];
  private actors = new Map<string, Actor>();
  private guardMotion = new Map<number, Point & { frame: number; moving: boolean }>();
  private doors = new Map<string, THREE.Group>();
  private terminals = new Map<string, THREE.Mesh>();
  private tickets = new Map<string, THREE.Mesh>();
  private circuits = new Map<string, THREE.Mesh>();
  private lamps: THREE.Object3D[] = [];
  private civicWindows: THREE.Mesh[] = [];
  private labels: Label[] = [];
  private loot?: THREE.Group;
  private previousTime = 0;
  private lastDetail = true;
  private renderWidth = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.gl.setSize(VIEW_WIDTH, VIEW_HEIGHT, false);
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.02;
    this.scene.background = new THREE.Color('#14252d');
    this.scene.add(new THREE.HemisphereLight('#d1e9ef', '#524a3a', 1.2));
    this.keyLight.position.set(-9, 21, 1); this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048); this.keyLight.shadow.camera.left = -23; this.keyLight.shadow.camera.right = 23; this.keyLight.shadow.camera.top = 18; this.keyLight.shadow.camera.bottom = -18;
    this.keyLight.shadow.camera.near = 1; this.keyLight.shadow.camera.far = 65; this.keyLight.shadow.bias = -0.0002; this.keyLight.shadow.normalBias = 0.035;
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight('#9dd5ed', 0.85); rim.position.set(18, 9, -12); this.scene.add(rim);
    this.scene.add(this.levelRoot);
    this.overlay.className = 'scene-labels'; this.overlay.width = VIEW_WIDTH; this.overlay.height = VIEW_HEIGHT;
    this.overlay.setAttribute('aria-hidden', 'true'); canvas.after(this.overlay); this.ctx = this.overlay.getContext('2d')!;
    this.ground.width = WIDTH; this.ground.height = HEIGHT;
    this.groundTexture = new THREE.CanvasTexture(this.ground); this.groundTexture.colorSpace = THREE.SRGBColorSpace;
    this.canvas.dataset.sceneReady = 'loading';
    void this.models.ready.then(() => { this.ready = true; this.level = undefined; this.canvas.dataset.sceneReady = 'ready'; }).catch(error => {
      this.canvas.dataset.sceneReady = 'error'; console.error('3D model loading failed', error);
    });
  }
  private material(color: string, metalness = 0, roughness = 0.8) {
    const key = `${color}:${metalness}:${roughness}`;
    if (!this.mat.has(key)) this.mat.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return this.mat.get(key)!;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, metal = 0) {
    const mesh = new THREE.Mesh(this.cube, this.material(color, metal)); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private model(name: ModelName, parent: THREE.Object3D, x: number, z: number, width: number, depth: number, height?: number, y = 0) {
    if (!this.ready) return;
    const model = this.models.furniture(name, width, depth, height); model.position.set(x, y, z); parent.add(model); return model;
  }
  private bulb(parent: THREE.Object3D, x: number, y: number, z: number, color = colors.light, light = false) {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2, roughness: 0.3 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), material); mesh.position.set(x, y, z); parent.add(mesh);
    mesh.userData.ownedMaterial = true; mesh.userData.ownedGeometry = true;
    if (light && this.detail) { const lamp = new THREE.PointLight(color, 8, 4.5, 2); lamp.position.set(x, y - 0.12, z); parent.add(lamp); this.lamps.push(lamp); }
    return mesh;
  }
  private build(level: Level) {
    this.level = level;
    // Keep shared models and materials; dispose only per-room render resources.
    this.levelRoot.traverse(o => {
      if (o.userData.ownedGeometry && o instanceof THREE.Mesh) o.geometry.dispose();
      if (o.userData.ownedTexture && o instanceof THREE.Mesh) { const m = o.material as THREE.MeshStandardMaterial; m.map?.dispose(); m.dispose(); }
      else if (o.userData.ownedMaterial && o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
    });
    for (const a of this.actors.values()) a.mixer.uncacheRoot(a.body);
    this.levelRoot.clear(); this.walls = []; this.actors.clear(); this.guardMotion.clear(); this.doors.clear(); this.terminals.clear(); this.tickets.clear(); this.circuits.clear(); this.lamps = []; this.civicWindows = []; this.loot = undefined;
    const style = setting(level);
    const [plaster, panel, floorColor] = style === 'station' ? ['#71847c', '#294e59', '#637572'] : style === 'museum' ? ['#586d62', '#284940', '#79624c'] : themes[level.theme ?? 'archive'];
    this.box(this.levelRoot, 0, -0.35, 0, 30.35, 0.65, 18.35, '#344951');
    this.box(this.levelRoot, 0, -0.04, 0, 30, 0.12, 18, floorColor);
    this.box(this.levelRoot, 0, -0.7, 0, 30.8, 0.12, 18.8, '#a08f6d', 0.45);
    const floorCanvas = this.dressing.floor(level, this.detail, floorColor);
    const texture = new THREE.CanvasTexture(floorCanvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.91 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.03; floor.receiveShadow = true; floor.userData.ownedGeometry = true; floor.userData.ownedTexture = true; this.levelRoot.add(floor);
    const fx = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshBasicMaterial({ map: this.groundTexture, transparent: true, depthWrite: false, toneMapped: false }));
    fx.rotation.x = -Math.PI / 2; fx.position.y = 0.047; fx.userData.ownedGeometry = true; fx.userData.ownedMaterial = true; this.levelRoot.add(fx);
    const remaining = new Set(level.walls.map(p => `${p.x / TILE},${p.y / TILE}`));
    for (const cell of level.walls) {
      const cx = cell.x / TILE, cy = cell.y / TILE; if (!remaining.has(`${cx},${cy}`)) continue;
      let w = 1, h = 1; while (remaining.has(`${cx + w},${cy}`)) w++;
      outer: while (true) { for (let x = 0; x < w; x++) if (!remaining.has(`${cx + x},${cy + h}`)) break outer; h++; }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) remaining.delete(`${cx + x},${cy + y}`);
      const root = new THREE.Group(), x = cx - 15 + w / 2, z = cy - 9 + h / 2;
      root.position.set(x, 0, z); this.levelRoot.add(root);
      const border = cx === 0 || cy === 0 || cx + w === 30 || cy + h === 18;
      const near = cx === 29 || cy === 17, furniture = !border && w <= 2 && h <= 2;
      const height = near ? 0.25 : border ? 2.6 : furniture ? 1.5 : 1.45;
      if (furniture && style === 'museum') {
        this.dressing.exhibit(root, w, h, cx + cy);
      } else if (furniture && this.ready) {
        this.model((cx + cy) % 2 ? 'bookcase' : 'cabinet', root, 0, 0, w * 0.98, h * 0.98, height);
        if ((cx + cy) % 2) for (let shelf = 0; shelf < 3; shelf++) this.model('books', root, 0, 0.12, w * 0.64, h * 0.42, 0.24, 0.15 + shelf * 0.43);
        if ((cx + cy) % 3 === 0) this.model('plant', root, 0, 0, w * 0.65, h * 0.65, 0.5, height);
      } else {
        this.box(root, 0, height / 2, 0, w, height, h, plaster);
        this.box(root, 0, Math.min(height / 2, 0.36), 0, w + 0.02, Math.min(height, 0.72), h + 0.02, panel);
        this.box(root, 0, height + 0.035, 0, w + 0.04, 0.07, h + 0.04, '#8e9e89');
        if (height > 1) {
          this.box(root, 0, 0.74, 0, w + 0.06, 0.055, h + 0.06, colors.brass, 0.6);
          const count = Math.floor(Math.max(w, h) / 3);
          for (let i = 0; i < count; i++) {
            const along = -Math.max(w, h) / 2 + 1.5 + i * 3;
            const px = w > h ? along : 0, pz = h > w ? along : 0;
            this.box(root, px, height / 2, pz, w > h ? 0.18 : w + 0.05, height + 0.06, h > w ? 0.18 : h + 0.05, '#8d9c90');
            if (border && !near && this.detail && i % 2 === 0) {
              const lamp = this.model('lamp', root, px, pz + (w > h ? h / 2 + 0.03 : 0), 0.35, 0.35, 0.55, 1.65);
              if (lamp && h > w) { lamp.position.x = w / 2; lamp.rotation.y = Math.PI / 2; }
              this.bulb(root, px + (h > w ? w / 2 + 0.1 : 0), 1.85, pz + (w > h ? h / 2 + 0.1 : 0), colors.light, this.lamps.length < 6);
            }
            if (border && !near && this.detail && i % 2 === 1) {
              if (this.dressing.wallBay(level, root, px + (h > w ? w / 2 + 0.045 : 0), pz + (w > h ? h / 2 + 0.045 : 0), w > h, i)) continue;
              const window = new THREE.Group();
              window.position.set(px + (h > w ? w / 2 + 0.045 : 0), 1.68, pz + (w > h ? h / 2 + 0.045 : 0));
              if (h > w) window.rotation.y = Math.PI / 2;
              root.add(window);
              this.box(window, 0, 0, 0, 1.16, 1.44, 0.09, '#b8a77c', 0.5);
              const pane = this.box(window, 0, 0, 0.06, 1.03, 1.3, 0.05, '#274b65', 0.45);
              pane.material = new THREE.MeshStandardMaterial({ color: '#284b64', emissive: '#345973', emissiveIntensity: 0.38, roughness: 0.25, metalness: 0.35 });
              pane.userData.ownedMaterial = true;
              if (level.handoff || level.continuity) this.civicWindows.push(pane);
              this.box(window, 0, 0, 0.1, 0.045, 1.3, 0.045, '#c4b78e', 0.5);
              this.box(window, 0, 0.03, 0.1, 1.03, 0.045, 0.045, '#c4b78e', 0.5);
              this.box(window, 0, -0.74, 0.13, 1.29, 0.1, 0.27, '#c2c5ac');
            }
          }
        }
      }
      this.walls.push({ root, x: cell.x, y: cell.y, w: w * TILE, h: h * TILE, tall: height > 1 });
    }
    for (const door of level.doors) {
      const pos = world({ x: door.x + door.w / 2, y: door.y + door.h / 2 }), group = new THREE.Group(); group.position.copy(pos); this.levelRoot.add(group);
      const vertical = door.h > door.w, width = (vertical ? door.h : door.w) / TILE;
      if (vertical) group.rotation.y = Math.PI / 2;
      this.box(group, -width / 2 + 0.08, 0.97, 0, 0.16, 1.94, 0.6, '#65736b'); this.box(group, width / 2 - 0.08, 0.97, 0, 0.16, 1.94, 0.6, '#65736b');
      this.box(group, 0, 1.91, 0, width, 0.15, 0.6, '#baac87', 0.35);
      const panelGroup = new THREE.Group(); group.add(panelGroup);
      this.box(panelGroup, 0, 0.87, 0, width - 0.25, 1.7, 0.12, '#557372', 0.35);
      for (let i = 0; i < 3; i++) this.box(panelGroup, 0, 0.4 + i * 0.46, 0.07, width - 0.34, 0.06, 0.045, '#cfb783', 0.6);
      this.doors.set(door.id, panelGroup);
    }
    for (const terminal of level.terminals ?? []) {
      const { screen, ticket } = this.dressing.terminal(this.levelRoot, terminal, style === 'station');
      this.terminals.set(terminal.id, screen); this.tickets.set(terminal.id, ticket);
    }
    for (const circuit of level.circuits ?? []) {
      const at = world(circuit); this.model('radio', this.levelRoot, at.x, at.z, 0.65, 0.55, 0.58);
      const lamp = this.bulb(this.levelRoot, at.x, 0.68, at.z, colors.lime); this.circuits.set(circuit.id, lamp);
    }
    for (const glass of level.glass ?? []) {
      const at = world({ x: glass.x + glass.w / 2, y: glass.y + glass.h / 2 });
      const pane = this.box(this.levelRoot, at.x, 0.85, at.z, glass.w / TILE, 1.7, glass.h / TILE, '#a3d0d2');
      pane.material = new THREE.MeshPhysicalMaterial({ color: '#a3d0d2', transparent: true, opacity: 0.18, roughness: 0.18, metalness: 0.1, depthWrite: false }); pane.castShadow = false;
      pane.userData.ownedMaterial = true;
      this.box(this.levelRoot, at.x, 1.73, at.z, glass.w / TILE, 0.05, glass.h / TILE, '#b2bfaf', 0.6);
    }
    if (level.objective !== 'reach' || level.delivery || level.handoff) {
      const at = world(level.delivery ?? level.loot); this.model('desk', this.levelRoot, at.x, at.z, 1.1, 0.9, 0.75);
      this.loot = new THREE.Group(); this.loot.position.copy(at); this.levelRoot.add(this.loot);
      if (level.lootLabel?.includes('怀表')) this.dressing.watch(this.loot, 0.82, 0.75);
      else this.model('books', this.loot, 0, 0, 0.4, 0.35, 0.17, 0.8);
      this.bulb(this.loot, 0, 1.15, 0, level.delivery ? colors.cyan : colors.light, true);
    }
    if (level.id.startsWith('C4-6')) for (const [id, y] of [['FAST', 176], ['SERVICE', 432]] as const) for (const x of [400, 496]) {
      if (level.terminals?.some(t => t.id === id && t.x === x)) continue;
      const { screen } = this.dressing.terminal(this.levelRoot, { id, x, y, kind: 'relay' }, true);
      (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
    // Stage labels and furniture respect the existing collision map.
    this.lastDetail = this.detail;
  }
  private groundEffects(game: Game) {
    const c = this.ground.getContext('2d')!; c.clearRect(0, 0, WIDTH, HEIGHT);
    const line = (points: Point[], color: string, dash: number[] = []) => { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.strokeStyle = color; c.lineWidth = 2; c.setLineDash(dash); c.stroke(); c.setLineDash([]); };
    for (const plate of game.level.plates) {
      const active = game.activePlates.has(plate.id) || game.remote?.activePlates.has(plate.id);
      for (const d of game.level.doors.filter(d => doorPlates(d).includes(plate.id))) line([plate, { x: plate.x, y: d.y + d.h / 2 }, { x: d.x + d.w / 2, y: d.y + d.h / 2 }], active ? '#c3ed82a0' : '#4d6f6965', [4, 6]);
      c.fillStyle = active ? '#c3ed8280' : '#234847b0'; c.fillRect(plate.x - 17, plate.y - 17, 34, 34); c.strokeStyle = active ? colors.lime : '#90ac9a'; c.lineWidth = 2; c.strokeRect(plate.x - 17, plate.y - 17, 34, 34);
      c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillStyle = active ? '#fff8c5' : '#d2d9c0'; c.fillText(plate.id, plate.x, plate.y + 5); c.textAlign = 'left';
    }
    const exit = game.exitPoint; c.fillStyle = '#214c4380'; c.fillRect(exit.x - 24, exit.y - 24, 48, 48); c.strokeStyle = game.exitReady ? colors.lime : '#bdb092'; c.lineWidth = 2; c.setLineDash([7, 5]); c.strokeRect(exit.x - 26, exit.y - 26, 52, 52); c.setLineDash([]);
    game.guards.forEach((g, i) => {
      if (!game.powered(game.level.guards[i].power)) return;
      const range = game.visionRange(i), tint = g.suspicion > 0.2 ? '239,133,103' : '237,192,113';
      const gradient = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, range); gradient.addColorStop(0, `rgba(${tint},0.42)`); gradient.addColorStop(1, `rgba(${tint},0.015)`);
      c.beginPath(); c.moveTo(g.x, g.y);
      for (let a = g.angle - 0.56; a <= g.angle + 0.57; a += 0.028) { let r = 0; for (; r < range; r += 5) if (game.occluded(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r)) break; c.lineTo(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r); }
      c.closePath(); c.fillStyle = gradient; c.fill();
      if (this.trails && game.level.guards[i].route.length > 1) line(game.level.guards[i].route, '#e6c39450', [3, 7]);
      if (this.trails && (g.investigate || g.trace)) line([g, ...(g.path ?? []), (g.investigate ?? g.trace!.at)], '#efbd7280', [3, 6]);
    });
    for (const field of game.level.suppressors ?? []) {
      const active = game.suppressionActive(field); c.fillStyle = active ? '#b899ed45' : '#b899ed10'; c.fillRect(field.x, field.y, field.w, field.h); c.strokeStyle = '#b899ed99'; c.strokeRect(field.x, field.y, field.w, field.h);
      if (active) for (let x = field.x + 8; x < field.x + field.w; x += 16) line([{ x, y: field.y }, { x, y: field.y + field.h }], '#b899ed50');
    }
    for (const s of game.level.scanners ?? []) { const active = game.scanning(s); c.fillStyle = active ? '#f59a7950' : '#f5c97915'; c.fillRect(s.x, s.y, s.w, s.h); if (active) for (let y = s.y; y < s.y + s.h; y += 12) line([{ x: s.x, y }, { x: s.x + s.w, y }], '#ffb396b0'); }
    if (this.trails) for (const echo of game.echoes) line(echo.frames.filter((_, i) => i % 6 === 0), `${ECHO_COLORS[echo.colorIndex]}aa`, [4, 5]);
    for (const n of game.noise) { c.strokeStyle = `rgba(247,212,148,${n.life * 0.75})`; c.lineWidth = 2; c.beginPath(); c.arc(n.x, n.y, 12 + (1 - n.life) * 100, 0, Math.PI * 2); c.stroke(); }
    for (const receipt of game.level.delivery?.receivers ?? []) { c.strokeStyle = game.evidenceReceipts.has(receipt.guard) ? colors.lime : colors.cyan; c.strokeRect(receipt.at.x - 18, receipt.at.y - 18, 36, 36); }
    if (game.failure) { c.strokeStyle = colors.red; c.lineWidth = 3; c.beginPath(); c.arc(game.failure.point.x, game.failure.point.y, 26, 0, Math.PI * 2); c.stroke(); }
    this.groundTexture.needsUpdate = true;
  }
  private actor(id: string, at: Frame, game: Game, moving: boolean, role: CharacterRole, tint?: string, suppressed = false) {
    if (!this.ready) return;
    if (!this.actors.has(id)) { const a = this.models.character(role, tint); this.actors.set(id, a); this.levelRoot.add(a.group); }
    const a = this.actors.get(id)!; a.group.visible = true; a.group.position.copy(world(at)); a.group.rotation.y = Math.PI / 2 - at.angle;
    const owner = id.startsWith('remote:') ? id.replace('remote:', 'echo:') : id;
    const action = [...game.operationLog].reverse().find(op => op.actor === owner && game.frame - op.frame < 24);
    const gesture = action && !this.reducedMotion ? Math.sin((game.frame - action.frame) / 24 * Math.PI) : 0;
    a.pose(this.reducedMotion ? 0 : game.frame, moving, gesture, game.tokenOwner === owner, suppressed);
  }
  private label(at: Point, height: number, text: string, color = '#e9e4d0') { this.labels.push({ at, height, text, color }); }
  private hud(game: Game, dt: number) {
    const c = this.ctx; c.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const compact = this.canvas.clientWidth < 600;
    const scale = Math.max(1, VIEW_WIDTH / Math.max(320, this.canvas.clientWidth) * 0.9);
    c.font = `500 ${12 * scale}px "Microsoft YaHei", sans-serif`;
    const rects: { x: number; y: number; width: number }[] = [];
    for (const label of this.labels) {
      const projected = world(label.at, label.height).project(this.camera), anchorX = (projected.x + 1) * VIEW_WIDTH / 2, anchorY = (1 - projected.y) * VIEW_HEIGHT / 2;
      if (anchorX < 8 || anchorX > VIEW_WIDTH - 8 || anchorY < 8 || anchorY > VIEW_HEIGHT - 15) continue;
      const width = c.measureText(label.text).width + 14 * scale;
      let x = anchorX, y = anchorY;
      for (let i = 0; i < 18; i++) {
        const row = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
        y = Math.max(20 * scale, Math.min(VIEW_HEIGHT - 15 * scale, anchorY + row * 25 * scale));
        x = Math.max(width / 2 + 8, Math.min(VIEW_WIDTH - width / 2 - 8, anchorX));
        if (!rects.some(r => Math.abs(r.x - x) < (r.width + width) / 2 + 3 * scale && Math.abs(r.y - y) < 24 * scale)) break;
      }
      if (Math.abs(y - anchorY) > 5 * scale || Math.abs(x - anchorX) > 5 * scale) {
        c.strokeStyle = '#b7cab8a0'; c.lineWidth = scale; c.beginPath(); c.moveTo(anchorX, anchorY); c.lineTo(x, y + (y < anchorY ? 8 : -15) * scale); c.stroke();
        c.fillStyle = '#d2d8b7'; c.beginPath(); c.arc(anchorX, anchorY, 1.7 * scale, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#14282be5'; c.beginPath(); c.roundRect(x - width / 2, y - 15 * scale, width, 22 * scale, 4 * scale); c.fill(); c.fillStyle = label.color; c.textAlign = 'center'; c.fillText(label.text, x, y); rects.push({ x, y, width });
    }
    if (!compact) {
    c.textAlign = 'left'; c.font = '600 13px "Microsoft YaHei", sans-serif'; c.fillStyle = '#b9c9c2'; c.fillText('回 声 劫 案  /  夜 间 行 动', 35, 37);
    c.font = '11px "Microsoft YaHei", sans-serif'; c.fillStyle = '#9caea9'; c.fillText(game.level.district ?? game.level.title, 35, 58);
    c.textAlign = 'right'; c.fillText(this.closeup ? '跟随近景' : '全景 · 2.5D', VIEW_WIDTH - 35, 37);
    c.textAlign = 'center'; c.fillText('WASD / 方向键按画面移动 · R 留下回声 · E 操作', VIEW_WIDTH / 2, VIEW_HEIGHT - 25);
    c.textAlign = 'right'; c.fillText('地图北 ↗  /  东 ↘', VIEW_WIDTH - 35, VIEW_HEIGHT - 25); c.textAlign = 'left';
    }
    if (!this.ready) { c.fillStyle = '#d4d8be'; c.fillText(this.canvas.dataset.sceneReady === 'error' ? '模型加载失败，请刷新重试' : '正在布置场景…', 35, 82); }
    if (game.alarm > 0.1) { c.strokeStyle = `rgba(239,133,103,${game.alarm * 0.8})`; c.lineWidth = 7; c.strokeRect(4, 4, VIEW_WIDTH - 8, VIEW_HEIGHT - 8); }
    if (this.rewindFlash > 0 && !this.reducedMotion) { this.rewindFlash = Math.max(0, this.rewindFlash - dt * 2); c.fillStyle = `rgba(160,220,235,${this.rewindFlash * 0.15})`; c.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT); }
  }
  draw(game: Game, time: number) {
    const dt = Math.min(0.1, time - this.previousTime); this.previousTime = time;
    const width = Math.round(this.canvas.clientWidth || VIEW_WIDTH);
    if (this.renderWidth !== width) {
      this.renderWidth = width; this.gl.setSize(width, Math.round(width * VIEW_HEIGHT / VIEW_WIDTH), false);
      const size = width < 600 ? 1024 : 2048;
      if (this.keyLight.shadow.mapSize.x !== size) { this.keyLight.shadow.map?.dispose(); this.keyLight.shadow.map = null; this.keyLight.shadow.mapSize.set(size, size); }
    }
    if (this.level !== game.level || this.detail !== this.lastDetail) this.build(game.level);
    const focus = game.spectator && game.activeEchoes[0] ? game.echoAt(game.activeEchoes[0].echo) : game.player;
    const target = this.closeup ? world(focus, 0.45) : new THREE.Vector3(0, 0.3, 0);
    this.camera.position.copy(target).add(new THREE.Vector3(30, 27, 30)); this.camera.lookAt(target); this.camera.zoom = this.closeup ? this.canvas.clientWidth < 600 ? 2.65 : 1.65 : 1; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.groundEffects(game); this.labels = [];
    for (const pane of this.civicWindows) {
      const mat = pane.material as THREE.MeshStandardMaterial, on = game.circuits.get('CIV');
      mat.color.set(on ? '#d2b76c' : '#284b64'); mat.emissive.set(on ? '#efbd72' : '#193042'); mat.emissiveIntensity = on ? 0.9 : 0.1;
    }
    for (const wall of this.walls) {
      const p = world(game.player, 0.8).project(this.camera), center = world({ x: wall.x + wall.w / 2, y: wall.y + wall.h / 2 }, 0).project(this.camera);
      const within = game.player.x > wall.x - 50 && game.player.x < wall.x + wall.w + 50 && game.player.y > wall.y - 50 && game.player.y < wall.y + wall.h + 50;
      wall.root.scale.y = wall.tall && !game.spectator && within && center.y < p.y && wall.x + wall.y + wall.w + wall.h > game.player.x + game.player.y ? 0.3 : 1;
    }
    for (const a of this.actors.values()) a.group.visible = false;
    const prev = game.recording.at(-2);
    if (!game.spectator) { this.actor('player', game.player, game, !!prev && (prev.x !== game.player.x || prev.y !== game.player.y), 'player'); this.label(game.player, 2.2, game.tokenOwner === 'player' ? '你 · ◆ 凭据' : game.hasLoot ? '你 · 已取目标' : '你'); }
    for (const { echo, index } of game.activeEchoes) {
      const at = game.echoAt(echo), last = game.echoAt(echo, Math.max(0, game.frame - 1)); this.actor(`echo:${echo.colorIndex}`, at, game, at.x !== last.x || at.y !== last.y, 'echo', ECHO_COLORS[echo.colorIndex], game.suppressed(at));
      this.label(at, 2.2, `回声 ${index + 1}${game.suppressed(at) ? ' · 失效' : game.tokenOwner === `echo:${echo.colorIndex}` ? ' · ◆' : ''}`, ECHO_COLORS[echo.colorIndex]);
    }
    if (game.remote) for (const { echo } of game.remote.activeEchoes) { const at = game.remote.echoAt(echo), before = game.remote.echoAt(echo, Math.max(0, game.frame - 1)); this.actor(`remote:${echo.colorIndex}`, at, game.remote, at.x !== before.x || at.y !== before.y, 'echo', ECHO_COLORS[echo.colorIndex]); this.label(at, 2.2, '回声 1 · 留守', ECHO_COLORS[echo.colorIndex]); }
    game.guards.forEach((g, i) => {
      const def = game.level.guards[i], enabled = game.powered(def.power);
      const previous = this.guardMotion.get(i);
      const moving = !!previous && (previous.frame === game.frame ? previous.moving : game.frame > previous.frame && (previous.x !== g.x || previous.y !== g.y));
      this.guardMotion.set(i, { x: g.x, y: g.y, frame: game.frame, moving });
      if (def.kind === 'camera') {
        const id = `camera:${i}`;
        if (!this.terminals.has(id)) { const at = world(g); this.box(this.levelRoot, at.x, 0.65, at.z, 0.07, 1.3, 0.07, '#9daaa4', 0.6); const head = this.box(this.levelRoot, at.x, 1.35, at.z, 0.4, 0.22, 0.26, '#d6d2ba', 0.3); this.terminals.set(id, head); }
        this.terminals.get(id)!.rotation.y = -g.angle;
      } else this.actor(`guard:${i}`, { ...g, lure: false }, game, moving, def.kind === 'tracker' ? 'tracker' : 'guard');
      const role = def.kind === 'camera' ? '镜头' : def.kind === 'tracker' ? '追踪' : def.speed > 0 ? '巡逻' : '哨兵';
      this.label(g, def.kind === 'camera' ? 1.8 : 2.35, `${role} ${game.guardName(i)}${!enabled ? ' · 停机' : g.suspicion > 0.2 ? ' !' : g.investigate ? ' · 调查' : g.trace ? ' · 追踪' : ''}`, colors.light);
    });
    for (const d of game.level.doors) { const open = game.openDoors.has(d.id); this.doors.get(d.id)!.visible = !open; this.label({ x: d.x + d.w / 2, y: d.y + d.h / 2 }, 2.18, `${d.id} · ${open ? '开' : '关'}${d.window ? ` ${d.window.join('–')}s` : ''}`, open ? colors.lime : '#e2bd91'); }
    for (const t of game.level.terminals ?? []) {
      const holding = game.tokenOwner === `terminal:${t.id}`, color = holding ? colors.light : game.terminalBlockers(t).length ? '#a599b0' : colors.cyan;
      const material = this.terminals.get(t.id)!.material as THREE.MeshStandardMaterial; material.color.set(color); material.emissive.set(color);
      this.tickets.get(t.id)!.visible = holding;
      this.label(t, 1.22, `${t.id}${holding ? ' ◆' : t.authorization && game.authorized.has(t.authorization) ? ' ✓' : ''}`, color);
      if (Math.hypot(game.player.x - t.x, game.player.y - t.y) < 30 && !game.spectator) this.label(t, 1.95, t.kind === 'lock' ? 'E 签入' : t.transfer === 'give' ? 'E 归还' : holding ? 'E 取件' : game.tokenOwner === 'player' ? 'E 交付' : 'E 接收');
    }
    for (const t of game.level.circuits ?? []) { const color = game.circuits.get(t.id) ? colors.lime : colors.light; const material = this.circuits.get(t.id)!.material as THREE.MeshStandardMaterial; material.color.set(color); material.emissive.set(color); this.label(t, 1.12, `${t.id} · ${game.circuitState(t.id)}`, color); }
    if (this.loot) { this.loot.visible = game.level.delivery ? !game.evidenceDeposited : !game.hasLoot; this.label(game.level.delivery ?? game.level.loot, 1.42, game.level.handoff ? '核心 · 下一段目标' : game.level.delivery ? `${game.level.delivery.id} · E 植入` : game.hasLoot ? '已取走' : game.level.lootLabel ?? '目标', colors.light); }
    if (game.level.handoff || game.level.continuity) this.label({ x: 160, y: 530 }, 0.1, game.circuits.get('CIV') ? '街区恢复供电' : '街区停电', colors.light);
    for (const p of game.level.plates) if (p.window) this.label(p, 0.25, `${p.id} · ${p.window.join('–')}s`, colors.light);
    for (const p of game.level.soundMarkers ?? []) this.label(p, 0.08, `${p.id} · 响点`, colors.light);
    this.label(game.exitPoint, 0.12, game.level.objective === 'reach' ? '锚点' : '撤离', colors.lime);
    for (const s of game.level.scanners ?? []) this.label({ x: s.x + s.w / 2, y: s.y }, 0.15, `${s.id} · ${game.scanning(s) ? '扫描' : '空档'}`, colors.red);
    for (const s of game.level.suppressors ?? []) this.label({ x: s.x + s.w / 2, y: s.y }, 0.15, `${s.id} · ${game.suppressionActive(s) ? '抑制' : '空档'}`, '#d2a0ef');
    for (const r of game.level.delivery?.receivers ?? []) this.label(r.at, 0.1, `${r.guard} 回执${game.evidenceReceipts.has(r.guard) ? ' ✓' : ' …'}`, colors.cyan);
    this.gl.render(this.scene, this.camera); this.hud(game, dt);
  }
}
