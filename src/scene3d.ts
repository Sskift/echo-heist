import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Game, type Frame } from './engine.ts';
import { doorPlates, ECHO_COLORS, HEIGHT, TILE, WIDTH, type Level, type Point } from './levels.ts';
import { Models3D, type CharacterRole } from './models3d.ts';
import { VIEW_WIDTH, VIEW_HEIGHT } from './isometric.ts';
import { SetDressing, setting, sceneLook } from './set-dressing.ts';
import { SceneFinish, SurfaceRelief } from './scene-finish.ts';
import { EnvironmentArt } from './environment-art.ts';
import { signalGlyph } from './scene-signals.ts';
import { SceneFeedback } from './scene-feedback.ts';
import { passageLandmarks } from './room-journey.ts';

type Actor = ReturnType<Models3D['character']>;
type Label = { at: Point; height: number; text: string; color: string; contextual: boolean };
type Wall = { root: THREE.Group; x: number; y: number; w: number; h: number; tall: boolean };
const world = (at: Point, height = 0) => new THREE.Vector3(at.x / TILE - 15, height, at.y / TILE - 9);
const colors = { brass: '#bca16d', light: '#f7d897', cyan: '#8ed4ed', lime: '#c3ed82', red: '#ed947c' };

export class Renderer {
  trails = false;
  annotations = false;
  detail = true;
  closeup = false;
  rewindFlash = 0;
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private arrival?: { at: Point; elapsed: number };
  get arriving() { return !!this.arrival; }
  beginArrival(at: Point) { this.arrival = this.reducedMotion ? undefined : {at: {...at}, elapsed: 0}; }
  finishArrival() { this.arrival = undefined; }
  readonly ctx: CanvasRenderingContext2D;
  private readonly gl: THREE.WebGLRenderer;
  private readonly finish: SceneFinish;
  private readonly relief = new SurfaceRelief();
  private reflections?: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-20, 20, 12.5, -12.5, 0.1, 150);
  private readonly models = new Models3D();
  private readonly levelRoot = new THREE.Group();
  private readonly overlay = document.createElement('canvas');
  private readonly ground = document.createElement('canvas');
  private readonly groundTexture: THREE.CanvasTexture;
  private readonly keyLight = new THREE.DirectionalLight('#f6dfc0', 2.6);
  private readonly mat = new Map<string, THREE.MeshStandardMaterial>();
  private readonly cube = new RoundedBoxGeometry(1, 1, 1, 2, 0.035);
  private readonly dressing = new SetDressing((...args) => this.box(...args));
  private ready = false;
  private level?: Level;
  private walls: Wall[] = [];
  private actors = new Map<string, Actor>();
  private guardMotion = new Map<number, Point & { frame: number; moving: boolean }>();
  private doors = new Map<string, THREE.Group>();
  private plates = new Map<string, THREE.Group>();
  private readonly feedback = new SceneFeedback();
  private terminals = new Map<string, THREE.Mesh>();
  private tickets = new Map<string, THREE.Mesh>();
  private circuits = new Map<string, ReturnType<SetDressing['circuit']>>();
  private suppressors = new Map<string, THREE.MeshStandardMaterial>();
  private scanners = new Map<string, THREE.MeshStandardMaterial>();
  private lamps: THREE.Object3D[] = [];
  private civicWindows: THREE.Mesh[] = [];
  private propertyCabinet?: ReturnType<SetDressing['lostProperty']>;
  private labels: Label[] = [];
  private loot?: THREE.Group;
  private previousTime = 0;
  private lastDetail = true;
  private renderWidth = 0;
  private renderHeight = 0;
  private overlayHeight = VIEW_HEIGHT;
  private readonly overviewTarget = new THREE.Vector3();
  private readonly overviewSize = new THREE.Vector2(40, 25);
  constructor(public canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.gl.setSize(VIEW_WIDTH, VIEW_HEIGHT, false);
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.06;
    this.scene.background = new THREE.Color('#14252d');
    this.scene.add(new THREE.HemisphereLight('#b6d5d3', '#665260', 1.15));
    this.keyLight.position.set(-12, 18, -8); this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048); this.keyLight.shadow.camera.left = -23; this.keyLight.shadow.camera.right = 23; this.keyLight.shadow.camera.top = 18; this.keyLight.shadow.camera.bottom = -18;
    this.keyLight.shadow.camera.near = 1; this.keyLight.shadow.camera.far = 65; this.keyLight.shadow.bias = -0.0002; this.keyLight.shadow.normalBias = 0.035;
    this.keyLight.shadow.radius = 2.2;
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight('#f4c88a', 0.65); rim.position.set(18, 9, 10); this.scene.add(rim);
    this.scene.add(this.levelRoot);
    this.finish = new SceneFinish(this.gl, this.scene, this.camera);
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
    if (!this.mat.has(key)) this.mat.set(key, new THREE.MeshStandardMaterial({ color, metalness,
      roughness: metalness ? 0.66 : Math.max(.88, roughness),
      bumpMap: metalness ? this.relief.metal : this.relief.plaster, bumpScale: metalness ? 0.003 : 0.005,
      envMapIntensity: metalness ? 1.15 : 0.45 }));
    return this.mat.get(key)!;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string, metal = 0) {
    const mesh = new THREE.Mesh(this.cube, this.material(color, metal)); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private bulb(parent: THREE.Object3D, x: number, y: number, z: number, color = colors.light, light = false) {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.3 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), material); mesh.position.set(x, y, z); parent.add(mesh);
    mesh.userData.ownedMaterial = true; mesh.userData.ownedGeometry = true;
    if (light && this.detail) { const lamp = new THREE.PointLight(color, 5.5, 5.5, 2); lamp.position.set(x, y - 0.12, z); parent.add(lamp); this.lamps.push(lamp); }
    return mesh;
  }
  private build(level: Level) {
    this.level = level;
    // A single local reflection probe gives brass and glass shaped highlights.
    // Simple mode skips both the probe bake and environment shading.
    if (this.detail && !this.reflections) {
      const studio = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.gl);
      this.reflections = pmrem.fromScene(studio, .055);
      studio.dispose(); pmrem.dispose();
    }
    this.scene.environment = this.detail ? this.reflections!.texture : null;
    this.scene.environmentIntensity = .09;
    // Keep shared models and materials; dispose only per-room render resources.
    this.levelRoot.traverse(o => {
      if (o.userData.ownedGeometry && o instanceof THREE.Mesh) o.geometry.dispose();
      if (o.userData.ownedTexture && o instanceof THREE.Mesh) { const m = o.material as THREE.MeshStandardMaterial; m.map?.dispose(); m.dispose(); }
      else if (o.userData.ownedMaterial && o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
      if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
    });
    for (const a of this.actors.values()) a.mixer.uncacheRoot(a.body);
    this.levelRoot.clear(); this.walls = []; this.actors.clear(); this.guardMotion.clear(); this.doors.clear(); this.plates.clear(); this.terminals.clear(); this.tickets.clear(); this.circuits.clear(); this.suppressors.clear(); this.scanners.clear(); this.lamps = []; this.civicWindows = []; this.loot = undefined; this.propertyCabinet = undefined;
    const style = setting(level), look = sceneLook(level), { floor: floorColor } = look;
    const architecture = new EnvironmentArt(level, this.detail);
    (this.scene.background as THREE.Color).set(look.background);
    architecture.foundation(this.levelRoot);
    architecture.exterior(this.levelRoot);
    this.civicWindows.push(...architecture.cityWindows);
    this.box(this.levelRoot, 0, -0.04, 0, 30, 0.12, 18, floorColor);
    const floorCanvas = this.dressing.floor(level, this.detail, floorColor);
    const texture = new THREE.CanvasTexture(floorCanvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), new THREE.MeshStandardMaterial({ map: texture,
      roughness: .96, envMapIntensity: .12,
      bumpMap: this.relief.stone, bumpScale: 0.004 }));
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
      const height = architecture.wallHeight(border, near, furniture);
      if (furniture && this.dressing.cover(level, root, w, h, cx + cy)) {
        // The entire prop remains inside the existing occupied footprint.
      } else {
        architecture.wall(root, w, h, height, border, near);
      }
      this.dressing.batchFixed(root);
      this.walls.push({ root, x: cell.x, y: cell.y, w: w * TILE, h: h * TILE, tall: height > 1 });
    }
    for (const door of level.doors) {
      const pos = world({ x: door.x + door.w / 2, y: door.y + door.h / 2 }), group = new THREE.Group(); group.position.copy(pos); this.levelRoot.add(group);
      const vertical = door.h > door.w, width = (vertical ? door.h : door.w) / TILE;
      if (vertical) group.rotation.y = Math.PI / 2;
      this.box(group, -width / 2 + 0.08, 0.97, 0, 0.16, 1.94, 0.6, look.cap); this.box(group, width / 2 - 0.08, 0.97, 0, 0.16, 1.94, 0.6, look.cap);
      this.box(group, 0, 1.91, 0, width, 0.15, 0.6, look.trim, 0.35);
      if (this.detail) this.dressing.doorCrown(level, group, width);
      const panelGroup = new THREE.Group(); group.add(panelGroup);
      this.box(panelGroup, 0, 0.87, 0, width - 0.25, 1.7, 0.12, look.panel, 0.35);
      this.box(panelGroup, 0, .87, .075, .065, 1.5, .04, look.cap);
      this.box(panelGroup, 0, 1.53, .075, width - .45, .035, .035, look.cap);
      if (style === 'vault') {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 20), this.material(look.trim, 0.7)); wheel.position.set(0, 0.9, 0.19); wheel.userData.ownedGeometry = true; panelGroup.add(wheel);
        for (let i = 0; i < 3; i++) { const spoke = this.box(panelGroup, 0, 0.9, 0.19, 0.57, 0.035, 0.05, look.trim, 0.6); spoke.rotation.z = i * Math.PI / 3; }
      }
      this.dressing.batchFixed(group); this.dressing.batchFixed(panelGroup);
      this.doors.set(door.id, panelGroup);
    }
    for (const landmark of passageLandmarks(level)) this.dressing.passage(this.levelRoot, landmark);
    for (const plate of level.plates) this.plates.set(plate.id, this.dressing.floorPlate(this.levelRoot, plate));
    if (level.lostProperty) this.propertyCabinet = this.dressing.lostProperty(this.levelRoot, level.lostProperty);
    for (const terminal of level.terminals ?? []) {
      const { screen, ticket } = terminal.appearance === 'lost-property' && this.propertyCabinet ? this.propertyCabinet : this.dressing.terminal(this.levelRoot, terminal, style === 'station');
      this.terminals.set(terminal.id, screen); this.tickets.set(terminal.id, ticket);
    }
    for (const circuit of level.circuits ?? []) this.circuits.set(circuit.id, this.dressing.circuit(this.levelRoot, level, circuit));
    for (const field of level.suppressors ?? []) this.suppressors.set(field.id, this.dressing.field(this.levelRoot, field, '#b899ed'));
    for (const field of level.scanners ?? []) this.scanners.set(field.id, this.dressing.field(this.levelRoot, field, '#f59a79'));
    for (const glass of level.glass ?? []) {
      const at = world({ x: glass.x + glass.w / 2, y: glass.y + glass.h / 2 });
      const pane = this.box(this.levelRoot, at.x, 0.85, at.z, glass.w / TILE, 1.7, glass.h / TILE, '#a3d0d2');
      pane.material = new THREE.MeshPhysicalMaterial({ color: '#a3d0d2', transparent: true, opacity: 0.18, roughness: 0.18, metalness: 0.1, depthWrite: false }); pane.castShadow = false;
      pane.userData.ownedMaterial = true;
      this.box(this.levelRoot, at.x, 1.73, at.z, glass.w / TILE, 0.05, glass.h / TILE, '#b2bfaf', 0.6);
    }
    if (level.objective !== 'reach' || level.delivery || level.handoff) {
      const at = world(level.delivery ?? level.loot); this.dressing.pedestal(this.levelRoot, at.x, at.z);
      this.loot = new THREE.Group(); this.loot.position.copy(at); this.levelRoot.add(this.loot);
      const core = !!level.handoff || !!level.lootLabel?.includes('核心');
      if (level.lootLabel?.includes('怀表')) this.dressing.watch(this.loot, 0.82, 0.75);
      else if (core) this.dressing.core(this.loot);
      else this.dressing.document(this.loot);
      this.bulb(this.loot, 0, core ? 1.49 : 1.15, 0, level.delivery ? colors.cyan : colors.light, true);
    }
    if (level.id.startsWith('C4-6')) for (const [id, y] of [['FAST', 176], ['SERVICE', 432]] as const) for (const x of [400, 496]) {
      if (level.terminals?.some(t => t.id === id && t.x === x)) continue;
      const { screen } = this.dressing.terminal(this.levelRoot, { id, x, y, kind: 'relay' }, true);
      (screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
    // Stage labels and furniture respect the existing collision map.
    this.frameArchitecture();
    this.lastDetail = this.detail;
  }
  private frameArchitecture() {
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const up = new THREE.Vector3().crossVectors(new THREE.Vector3(30, 27, 30).normalize(), right).normalize();
    const point = new THREE.Vector3();
    let left = Infinity, bottom = Infinity, rightmost = -Infinity, top = -Infinity;
    this.levelRoot.updateMatrixWorld(true);
    this.levelRoot.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const positions = o.geometry.getAttribute('position');
      // Actual vertices avoid framing the empty corners of a large merged batch.
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        const x = point.dot(right), y = point.dot(up);
        left = Math.min(left, x); rightmost = Math.max(rightmost, x); bottom = Math.min(bottom, y); top = Math.max(top, y);
      }
    });
    this.overviewTarget.copy(right).multiplyScalar((left + rightmost) / 2).addScaledVector(up, (bottom + top) / 2);
    this.overviewSize.set((rightmost - left) * 1.07, (top - bottom) * 1.08);
  }
  private groundEffects(game: Game) {
    const c = this.ground.getContext('2d')!; c.clearRect(0, 0, WIDTH, HEIGHT);
    const ids = [...new Set([...game.level.plates.map(p => p.id), ...game.level.doors.flatMap(doorPlates), ...(game.remote?.level.plates.map(p => p.id) ?? [])])].sort();
    const signal = (id: string, x: number, y: number, radius: number, color: string) => signalGlyph(c, ids.indexOf(id), x, y, radius, color);
    const line = (points: Point[], color: string, dash: number[] = []) => { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.strokeStyle = color; c.lineWidth = 2; c.setLineDash(dash); c.stroke(); c.setLineDash([]); };
    for (const plate of game.level.plates) {
      const active = game.activePlates.has(plate.id);
      c.fillStyle = active ? '#cbf3c980' : '#233c4240'; c.beginPath(); c.roundRect(plate.x - 17, plate.y - 17, 34, 34, 8); c.fill(); c.strokeStyle = active ? colors.lime : '#e6dfc5'; c.lineWidth = active ? 2.5 : 1.5; c.stroke();
      if (!this.annotations) signal(plate.id, plate.x, plate.y, 9, active ? '#fbffdf' : '#e8e4cc');
      if (this.annotations) { c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillStyle = active ? '#fff8c5' : '#d2d9c0'; c.fillText(plate.id, plate.x, plate.y + 5); c.textAlign = 'left'; }
    }
    for (const door of game.level.doors) {
      const ids = doorPlates(door), x = door.x + door.w / 2 + (door.h > door.w ? door.w / 2 + 12 : 0), y = door.y + door.h / 2 + (door.h > door.w ? 0 : door.h / 2 + 12);
      ids.forEach((id, i) => signal(id, x + (i - (ids.length - 1) / 2) * 18, y, 7, game.activePlates.has(id) ? '#e0ffc0' : '#947c68'));
    }
    for (const marker of game.level.soundMarkers ?? []) {
      c.strokeStyle = '#dfceaa80'; c.lineWidth = 1.5;
      for (const radius of [8, 14]) { c.beginPath(); c.arc(marker.x, marker.y, radius, -.8, .8); c.stroke(); c.beginPath(); c.arc(marker.x, marker.y, radius, Math.PI - .8, Math.PI + .8); c.stroke(); }
    }
    const exit = game.exitPoint;
    c.strokeStyle = game.exitReady ? '#def4c4' : '#bfb9a4'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(exit.x, exit.y, 23, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = .25; c.lineWidth = 7; c.stroke(); c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(exit.x, exit.y, 17 - i * 4, Math.PI * .12, Math.PI * 1.15); c.lineWidth = 1.2; c.stroke(); }
    if (!game.spectator) {
      c.strokeStyle = '#f8e5be99'; c.lineWidth = 1.3; c.beginPath(); c.arc(game.player.x, game.player.y, 11, 0, Math.PI * 2); c.stroke();
    }
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
    this.feedback.ground(c, game, this.annotations, this.reducedMotion);
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
  private label(at: Point, height: number, text: string, color = '#e9e4d0', contextual = false) {
    if (this.annotations || contextual) this.labels.push({ at, height, text, color, contextual });
  }
  private hud(game: Game, dt: number) {
    const c = this.ctx; c.clearRect(0, 0, VIEW_WIDTH, this.overlayHeight);
    const scale = Math.max(1, VIEW_WIDTH / Math.max(320, this.canvas.clientWidth) * 0.9);
    c.font = `500 ${12 * scale}px "Microsoft YaHei", sans-serif`;
    const rects: { x: number; y: number; width: number }[] = [];
    // Reserve projected character silhouettes before placing any device labels.
    // A nearby switch must not paint its name over the player's body on phones.
    const silhouettes = [...this.actors.values()].filter(a => a.group.visible).map(a => {
      const points: THREE.Vector3[] = [];
      for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) for (const y of [0, 2.08]) points.push(new THREE.Vector3(x, y, z).add(a.group.position).project(this.camera));
      return { left: (Math.min(...points.map(p => p.x)) + 1) * VIEW_WIDTH / 2, right: (Math.max(...points.map(p => p.x)) + 1) * VIEW_WIDTH / 2, top: (1 - Math.max(...points.map(p => p.y))) * this.overlayHeight / 2, bottom: (1 - Math.min(...points.map(p => p.y))) * this.overlayHeight / 2 };
    });
    // In quiet view only the nearest usable object gets a prompt.
    const visibleLabels = this.annotations ? this.labels : this.labels.filter(l => l.contextual)
      .sort((a, b) => Math.hypot(a.at.x - game.player.x, a.at.y - game.player.y) - Math.hypot(b.at.x - game.player.x, b.at.y - game.player.y)).slice(0, 1);
    this.canvas.dataset.labels = String(visibleLabels.length);
    this.canvas.dataset.annotations = String(this.annotations);
    for (const label of visibleLabels) {
      const projected = world(label.at, label.height).project(this.camera), anchorX = (projected.x + 1) * VIEW_WIDTH / 2, anchorY = (1 - projected.y) * this.overlayHeight / 2;
      if (anchorX < 8 || anchorX > VIEW_WIDTH - 8 || anchorY < 8 || anchorY > this.overlayHeight - 15) continue;
      const width = c.measureText(label.text).width + 14 * scale;
      let x = anchorX, y = anchorY;
      for (let i = 0; i < 18; i++) {
        const row = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
        y = Math.max(20 * scale, Math.min(this.overlayHeight - 15 * scale, anchorY + row * 25 * scale));
        x = Math.max(width / 2 + 8, Math.min(VIEW_WIDTH - width / 2 - 8, anchorX));
        if (!rects.some(r => Math.abs(r.x - x) < (r.width + width) / 2 + 3 * scale && Math.abs(r.y - y) < 24 * scale)
          && !silhouettes.some(r => x + width / 2 > r.left && x - width / 2 < r.right && y + 7 * scale > r.top && y - 15 * scale < r.bottom)) break;
      }
      if (Math.abs(y - anchorY) > 5 * scale || Math.abs(x - anchorX) > 5 * scale) {
        c.strokeStyle = '#b7cab8a0'; c.lineWidth = scale; c.beginPath(); c.moveTo(anchorX, anchorY); c.lineTo(x, y + (y < anchorY ? 8 : -15) * scale); c.stroke();
        c.fillStyle = '#d2d8b7'; c.beginPath(); c.arc(anchorX, anchorY, 1.7 * scale, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#203939d9'; c.beginPath(); c.roundRect(x - width / 2, y - 15 * scale, width, 22 * scale, 4 * scale); c.fill(); c.fillStyle = label.color; c.textAlign = 'center'; c.fillText(label.text, x, y); rects.push({ x, y, width });
    }
    if (!this.ready) { c.fillStyle = '#d4d8be'; c.fillText(this.canvas.dataset.sceneReady === 'error' ? '模型加载失败，请刷新重试' : '正在布置场景…', 35, 82); }
    if (!this.annotations) game.guards.forEach((guard, i) => {
      if ((!guard.investigate && !guard.trace && guard.suspicion <= .02) || !game.powered(game.level.guards[i].power)) return;
      const point = world(guard, 2.35).project(this.camera), x = (point.x + 1) * VIEW_WIDTH / 2, y = (1 - point.y) * this.overlayHeight / 2;
      c.strokeStyle = '#203939c0'; c.lineWidth = 3 * scale; c.beginPath(); c.arc(x, y, 7 * scale, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = guard.suspicion > .2 ? colors.red : colors.light;
      c.beginPath(); c.arc(x, y, 7 * scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.08, Math.min(1, guard.suspicion))); c.stroke();
      if (guard.suspicion > .7) { c.font = `700 ${10 * scale}px sans-serif`; c.textAlign = 'center'; c.fillStyle = colors.red; c.fillText('!', x, y + 3 * scale); }
    });
    const seenOperations = new Set<string>();
    for (const op of [...game.operationLog].reverse()) {
      const age = game.frame - op.frame;
      if (age >= 48) break;
      if (age < 0 || seenOperations.has(op.intent.id)) continue;
      seenOperations.add(op.intent.id);
      const target = [...game.level.terminals ?? [], ...game.level.circuits ?? [], ...(game.level.delivery ? [game.level.delivery] : [])].find(t => t.id === op.intent.id);
      if (!target) continue;
      const point = world(target, 1.5).project(this.camera), x = (point.x + 1) * VIEW_WIDTH / 2, anchorY = (1 - point.y) * this.overlayHeight / 2;
      let y = anchorY;
      for (let step = 0; step < 12; step++) {
        const radius = 9 * scale;
        const occupied = silhouettes.some(r => x + radius > r.left && x - radius < r.right && y + radius > r.top && y - radius < r.bottom)
          || rects.some(r => Math.abs(r.x - x) < r.width / 2 + radius && Math.abs(r.y - y) < 24 * scale);
        if (!occupied) break;
        y -= 18 * scale;
      }
      c.save(); c.globalAlpha = Math.min(1, (48 - age) / 12); c.strokeStyle = op.result === 'success' ? colors.lime : op.result === 'waiting' ? colors.light : colors.red; c.lineWidth = 2 * scale;
      c.beginPath();
      if (op.result === 'success') { c.moveTo(x - 5 * scale, y); c.lineTo(x - scale, y + 4 * scale); c.lineTo(x + 7 * scale, y - 5 * scale); }
      else if (op.result === 'waiting') c.arc(x, y, 6 * scale, -.6, Math.PI * 1.35);
      else { c.moveTo(x - 4 * scale, y - 4 * scale); c.lineTo(x + 4 * scale, y + 4 * scale); c.moveTo(x + 4 * scale, y - 4 * scale); c.lineTo(x - 4 * scale, y + 4 * scale); }
      c.stroke(); c.restore();
    }
    if (game.alarm > 0.1) { c.strokeStyle = `rgba(239,133,103,${game.alarm * 0.8})`; c.lineWidth = 7; c.strokeRect(4, 4, VIEW_WIDTH - 8, this.overlayHeight - 8); }
    if (this.rewindFlash > 0 && !this.reducedMotion) { this.rewindFlash = Math.max(0, this.rewindFlash - dt * 2); c.fillStyle = `rgba(160,220,235,${this.rewindFlash * 0.15})`; c.fillRect(0, 0, VIEW_WIDTH, this.overlayHeight); }
  }
  draw(game: Game, time: number) {
    const dt = Math.min(0.1, time - this.previousTime); this.previousTime = time;
    const width = Math.round(this.canvas.clientWidth || VIEW_WIDTH);
    const height = Math.round(this.canvas.clientHeight || width * VIEW_HEIGHT / VIEW_WIDTH);
    if (this.renderWidth !== width || this.renderHeight !== height) {
      this.renderWidth = width; this.renderHeight = height; this.gl.setSize(width, height, false);
      this.finish.resize(width, height);
      const aspect = width / height, halfHeight = Math.max(12.5, 20 / aspect);
      this.camera.left = -halfHeight * aspect; this.camera.right = halfHeight * aspect;
      this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
      this.overlayHeight = Math.round(VIEW_WIDTH / aspect); this.overlay.height = this.overlayHeight;
      const size = width < 600 ? 1024 : 2048;
      if (this.keyLight.shadow.mapSize.x !== size) { this.keyLight.shadow.map?.dispose(); this.keyLight.shadow.map = null; this.keyLight.shadow.mapSize.set(size, size); }
    }
    if (this.level !== game.level || this.detail !== this.lastDetail) this.build(game.level);
    const focus = game.spectator && game.activeEchoes[0] ? game.echoAt(game.activeEchoes[0].echo) : game.player;
    const target = this.closeup ? world(focus, 0.45) : this.overviewTarget.clone();
    if (this.closeup) {
      // Keep the surrounding room in the shot when following an edge route.
      // The actor still drives the camera; simulation and screen input do not change.
      target.x = THREE.MathUtils.clamp(target.x, -8.5, 8.5);
      target.z = THREE.MathUtils.clamp(target.z, -4.5, 4.5);
    }
    let arrivalZoom = 1, arrivalShade = 0;
    if (this.arrival && !this.reducedMotion) {
      this.arrival.elapsed += Math.max(0, dt);
      const progress = Math.min(1, this.arrival.elapsed / .9), remaining = (1 - progress) ** 3;
      target.lerp(world(this.arrival.at, .45), remaining * .45); arrivalZoom += remaining * .08;
      arrivalShade = remaining * .6;
      if (progress >= 1) this.arrival = undefined;
    } else this.arrival = undefined;
    const overviewZoom = Math.min((this.camera.right - this.camera.left) / this.overviewSize.x, (this.camera.top - this.camera.bottom) / this.overviewSize.y);
    this.camera.position.copy(target).add(new THREE.Vector3(30, 27, 30)); this.camera.lookAt(target); this.camera.zoom = (this.closeup ? this.canvas.clientWidth < 600 ? 2.65 : 1.65 : overviewZoom) * arrivalZoom; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    this.feedback.sample(game);
    this.groundEffects(game); this.labels = [];
    for (const landmark of passageLandmarks(game.level)) this.label(landmark.at, .2, landmark.label, colors.brass);
    if (this.propertyCabinet && game.level.lostProperty) {
      const received = game.tokenOwner === 'terminal:HOME';
      this.propertyCabinet.names[0].visible = !received; this.propertyCabinet.names[1].visible = received;
      const interactive = game.level.terminals?.some(t => t.appearance === 'lost-property');
      this.label(game.level.lostProperty, 2.1, received ? 'HOME · 沈舟 · 已归档' : `${interactive ? 'HOME · ' : ''}B-17 · 姓名空白`, received ? colors.lime : colors.light);
    }
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
    for (const d of game.level.doors) {
      const open = game.openDoors.has(d.id), span = Math.max(d.w, d.h) / TILE;
      const crown = this.detail && span <= 2.5 && ['museum', 'gala', 'civic', 'archive'].includes(setting(game.level));
      // Collision opens immediately. The remaining shutter retracts above
      // head height, leaving the traversable opening clear from the first frame.
      const shutter = this.doors.get(d.id)!;
      const progress = this.reducedMotion ? 1 : Math.min(1, this.feedback.age(`door:${d.id}`) / 12);
      shutter.scale.y = open ? .14 - .11 * progress : 1;
      shutter.position.y = open ? 1.72 + .15 * progress : 0;
      this.label({ x: d.x + d.w / 2, y: d.y + d.h / 2 }, crown ? 2.14 + span / 2 : 2.18, `${d.id} · ${open ? '开' : '关'}${d.window ? ` ${d.window.join('–')}s` : ''}`, open ? colors.lime : '#e2bd91');
    }
    for (const p of game.level.plates) {
      const active = game.activePlates.has(p.id);
      const progress = this.reducedMotion ? 1 : Math.min(1, this.feedback.age(`plate:${p.id}`) / 8);
      this.plates.get(p.id)!.position.y = (active ? 1 - progress : progress) * .07;
    }
    for (const t of game.level.terminals ?? []) {
      const holding = game.tokenOwner === `terminal:${t.id}`, color = holding ? colors.light : t.authorization && game.authorized.has(t.authorization) ? colors.lime : game.terminalBlockers(t).length ? '#a599b0' : colors.cyan;
      const material = this.terminals.get(t.id)!.material as THREE.MeshStandardMaterial; material.color.set(color); material.emissive.set(color);
      this.tickets.get(t.id)!.visible = holding;
      if (t.appearance !== 'lost-property') this.label(t, 1.22, `${t.id}${holding ? ' ◆' : t.authorization && game.authorized.has(t.authorization) ? ' ✓' : ''}`, color);
      if (Math.hypot(game.player.x - t.x, game.player.y - t.y) < 30 && !game.spectator && !(t.appearance === 'lost-property' && holding)) this.label(t, 1.95, t.appearance === 'lost-property' ? 'E 归档回执' : t.kind === 'lock' ? 'E 签入' : t.transfer === 'give' ? 'E 归还' : holding ? 'E 取件' : game.tokenOwner === 'player' ? 'E 交付' : 'E 接收', colors.light, true);
    }
    for (const t of game.level.circuits ?? []) {
      const on = game.circuits.get(t.id), color = on ? colors.lime : colors.light, { lamp, lever } = this.circuits.get(t.id)!;
      const material = lamp.material as THREE.MeshStandardMaterial; material.color.set(color); material.emissive.set(color); if (lever) lever.rotation.x = on ? -0.5 : 0.65;
      this.label(t, 1.25, `${t.id}${t.mechanical ? ' 门闩' : t.feed ? ` ← ${t.feed.plate}` : ''} · ${game.circuitState(t.id)}`, color);
      if (!t.feed && !game.spectator && Math.hypot(game.player.x - t.x, game.player.y - t.y) < 30) this.label(t, 1.95, t.mechanical ? (on ? 'E 扣紧' : 'E 松闩') : (on ? 'E 断开' : 'E 接通'), colors.light, true);
    }
    if (game.level.delivery && !game.evidenceDeposited && !game.spectator && Math.hypot(game.player.x - game.level.delivery.x, game.player.y - game.level.delivery.y) < 30) this.label(game.level.delivery, 1.9, 'E 植入', colors.light, true);
    if (this.loot) { this.loot.visible = game.level.delivery ? !game.evidenceDeposited : !game.hasLoot; this.label(game.level.delivery ?? game.level.loot, 1.42, game.level.handoff ? '核心 · 下一段目标' : game.level.delivery ? `${game.level.delivery.id} · E 植入` : game.hasLoot ? '已取走' : game.level.lootLabel ?? '目标', colors.light); }
    if (game.level.handoff || game.level.continuity) this.label({ x: 160, y: 530 }, 0.1, game.circuits.get('CIV') ? '街区恢复供电' : '街区停电', colors.light);
    for (const p of game.level.plates) if (p.window) this.label(p, 0.25, `${p.id} · ${p.window.join('–')}s`, colors.light);
    for (const p of game.level.soundMarkers ?? []) this.label(p, 0.08, `${p.id} · 响点`, colors.light);
    this.label(game.exitPoint, 0.12, game.level.objective === 'reach' ? '锚点' : '撤离', colors.lime);
    for (const s of game.level.scanners ?? []) { const active = game.scanning(s); this.scanners.get(s.id)!.emissiveIntensity = active ? 1.6 : 0.03; this.label({ x: s.x + s.w / 2, y: s.y }, 0.15, `${s.id} · ${active ? '扫描' : '空档'}`, colors.red); }
    for (const s of game.level.suppressors ?? []) { const active = game.suppressionActive(s); this.suppressors.get(s.id)!.emissiveIntensity = active ? 1.6 : 0.03; this.label({ x: s.x + s.w / 2, y: s.y }, 0.15, `${s.id} · ${active ? '抑制' : '空档'}`, '#d2a0ef'); }
    for (const r of game.level.delivery?.receivers ?? []) this.label(r.at, 0.1, `${r.guard} 回执${game.evidenceReceipts.has(r.guard) ? ' ✓' : ' …'}`, colors.cyan);
    this.finish.draw(this.scene, this.camera, this.detail, width); this.hud(game, dt);
    if (arrivalShade > 0) { this.ctx.fillStyle = `rgba(6,18,26,${arrivalShade})`; this.ctx.fillRect(0, 0, VIEW_WIDTH, this.overlayHeight); }
  }
}
