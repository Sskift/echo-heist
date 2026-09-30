import { doorPlates, FPS, LOOP_SECONDS, MAX_ECHOES, MAX_FRAMES, TILE, type Level, type Point, type Power, type Scanner, type Terminal } from './levels.ts';
import { findRoute } from './navigation.ts';

export type Intent = { type: 'circuit'; id: string; on: boolean } | { type: 'take' | 'give' | 'authorize'; id: string };
export type Input = { x: number; y: number; lure: boolean; interact?: boolean };
export type Frame = Point & { angle: number; lure: boolean; intent?: Intent };
export type Echo = { frames: Frame[]; colorIndex: number; delay?: number };
export type Status = 'ready' | 'running' | 'paused' | 'caught' | 'won';
export type Guard = Point & { angle: number; waypoint: number; investigate: Point | null; attention: number; suspicion: number; path?: Point[]; pathKey?: string; seenActor?: string; searching?: boolean };
export type GameEvent = 'start' | 'rewind' | 'door' | 'loot' | 'lure' | 'caught' | 'won' | 'tick' | 'full' | 'plan';

const SPEED = 224;
const RADIUS = 10;
const DT = 1 / FPS;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cloneFrame = (frame: Frame): Frame => ({ ...frame, ...(frame.intent ? { intent: { ...frame.intent } } : {}) });
const cloneEcho = (echo: Echo): Echo => ({ ...echo, frames: echo.frames.map(cloneFrame) });

export class Game {
  level: Level;
  player: Frame;
  echoes: Echo[] = [];
  editingIndex: number | null = null;
  private planHistory: Echo[][] = [];
  recording: Frame[] = [];
  guards: Guard[] = [];
  openDoors = new Set<string>();
  activePlates = new Set<string>();
  status: Status = 'ready';
  frame = 0;
  hasLoot = false;
  alarm = 0;
  attempts = 1;
  lureCooldown = 0;
  events: GameEvent[] = [];
  lastMessage = '';
  noise: { x: number; y: number; life: number }[] = [];
  circuits = new Map<string, boolean>();
  authorized = new Set<string>();
  tokenOwner: string | null = null;
  waitingReceivers = new Map<string, string>();
  signals: { frame: number; text: string }[] = [];
  failure: { frame: number; actor: string; guard: number; point: Point; scanner?: string } | null = null;
  scanExposure = new Map<string, number>();
  spectator = false;
  private interactHeld = false;
  private pendingNoise: Point[] = [];
  private wallCells = new Map<number, Map<number, Point[]>>();

  constructor(level: Level) {
    this.level = level;
    // Walls are static for the life of a level. Index every touched cell so
    // collision and vision queries also work with walls off the tile grid.
    for (const wall of level.walls) {
      for (let x = Math.floor(wall.x / TILE); x < Math.ceil((wall.x + TILE) / TILE); x++) {
        let column = this.wallCells.get(x);
        if (!column) { column = new Map(); this.wallCells.set(x, column); }
        for (let y = Math.floor(wall.y / TILE); y < Math.ceil((wall.y + TILE) / TILE); y++) {
          const cell = column.get(y) ?? []; cell.push(wall); column.set(y, cell);
        }
      }
    }
    this.player = { ...level.spawn, angle: -Math.PI / 2, lure: false };
    this.resetWorld('ready');
  }

  get seconds(): number { return this.frame / FPS; }
  get remaining(): number { return Math.max(0, LOOP_SECONDS - this.seconds); }
  get activeEchoes() { return this.echoes.map((echo, index) => ({ echo, index })).filter(({ echo, index }) => index !== this.editingIndex && this.frame >= (echo.delay ?? 0)); }
  get canUndo(): boolean { return this.planHistory.length > 0 && this.editingIndex === null; }

  private snapshot(): Echo[] {
    return this.echoes.map(cloneEcho);
  }

  private rememberPlan() {
    this.planHistory.push(this.snapshot());
    if (this.planHistory.length > 20) this.planHistory.shift();
  }

  restorePlan(echoes: Echo[]) {
    this.echoes = echoes.map(cloneEcho);
    this.editingIndex = null;
    this.planHistory = [];
    this.resetWorld('ready');
  }

  setDelay(index: number, frames: number): boolean {
    if (!this.echoes[index] || this.editingIndex !== null || !Number.isInteger(frames) || frames < 0 || frames > FPS * 6 || frames % 15 !== 0) return false;
    if ((this.echoes[index].delay ?? 0) === frames) return false;
    this.rememberPlan(); this.echoes[index].delay = frames;
    this.resetWorld('ready'); this.events.push('plan'); return true;
  }

  previewAt(frame: number): Game {
    const preview = new Game(this.level);
    preview.spectator = true;
    preview.restorePlan(this.snapshot()); preview.start();
    for (let i = 0; i < Math.min(MAX_FRAMES, Math.max(0, Math.floor(frame))); i++) {
      if (preview.status !== 'running') break;
      preview.step({ x: 0, y: 0, lure: false });
    }
    return preview;
  }

  powered(power?: { id: string; on: boolean }): boolean { return !power || this.circuits.get(power.id) === power.on; }
  circuitState(id: string, on = this.circuits.get(id) ?? false): string {
    return this.level.circuits?.find(c => c.id === id)?.states?.[on ? 1 : 0] ?? (on ? '接通' : '断开');
  }
  unmetPower(requirements: Power[] = []): Power[] { return requirements.filter(p => !this.powered(p)); }
  powerRequirements(requirements: Power[] = []): string { return requirements.map(p => `${p.id} ${this.circuitState(p.id, p.on)}`).join('、'); }
  get canCollect(): boolean { return !this.unmetPower(this.level.lootPower).length; }
  get exitReady(): boolean { return !this.unmetPower(this.level.exitPower).length; }
  visionRange(index: number): number {
    const def = this.level.guards[index];
    return def.lighting && !this.powered(def.lighting) ? def.lighting.darkRange : def.range;
  }
  scanning(scanner: Scanner, frame = this.frame): boolean {
    const period = Math.round(scanner.period * FPS);
    const time = ((frame + Math.round((scanner.phase ?? 0) * FPS)) % period + period) % period;
    return this.powered(scanner.power) && time >= Math.round(scanner.active[0] * FPS) && time < Math.round(scanner.active[1] * FPS);
  }

  private updateScanners() {
    const actors = this.actors();
    for (const scanner of this.level.scanners ?? []) {
      const on = this.scanning(scanner);
      if (on !== this.scanning(scanner, this.frame - 1)) this.signal(`${scanner.id} 扫描${on ? '开始' : '结束'}`);
      for (const key of this.scanExposure.keys()) if (key.startsWith(`${scanner.id}:`) && !actors.some(actor => key === `${scanner.id}:${actor.id}`)) this.scanExposure.set(key, 0);
      for (const actor of actors) {
        const key = `${scanner.id}:${actor.id}`;
        const inside = on && actor.at.x >= scanner.x && actor.at.x <= scanner.x + scanner.w && actor.at.y >= scanner.y && actor.at.y <= scanner.y + scanner.h;
        const exposure = inside ? (this.scanExposure.get(key) ?? 0) + 1 : 0;
        this.scanExposure.set(key, exposure);
        this.alarm = Math.max(this.alarm, Math.min(1, exposure / 18));
        if (exposure >= 18) {
          this.failure = { frame: this.frame, actor: actor.label, guard: -1, scanner: scanner.id, point: { x: actor.at.x, y: actor.at.y } };
          this.status = 'caught';
          this.lastMessage = `${this.seconds.toFixed(2)} 秒：${actor.label}进入 ${scanner.id} 扫描区。调整路线或出场时刻；扫描周期可在预演中查看。`;
          this.signal(this.lastMessage); this.events.push('caught'); return;
        }
      }
    }
  }
  suppressed(at: Point): boolean {
    return (this.level.suppressors ?? []).some(s => this.powered(s.power) && at.x >= s.x && at.x <= s.x + s.w && at.y >= s.y && at.y <= s.y + s.h);
  }
  private actors() {
    return [
      ...(!this.spectator ? [{ id: 'player', label: '当前的你', at: this.player }] : []),
      ...this.activeEchoes.filter(({ echo }) => !this.suppressed(this.echoAt(echo))).map(({ echo, index }) => ({ id: `echo:${echo.colorIndex}`, label: `回声 ${index + 1}`, at: this.echoAt(echo) })),
    ];
  }
  private signal(text: string) {
    this.signals.push({ frame: this.frame, text });
    if (this.signals.length > 100) this.signals.shift();
  }

  interaction(): Intent | undefined {
    const circuit = this.level.circuits?.find(c => distance(c, this.player) < 30);
    if (circuit) return { type: 'circuit', id: circuit.id, on: !this.circuits.get(circuit.id) };
    const terminal = this.level.terminals?.find(t => distance(t, this.player) < 30);
    if (terminal) return { type: terminal.kind === 'lock' ? 'authorize' : this.tokenOwner === 'player' ? 'give' : 'take', id: terminal.id };
  }

  credentialOwner(): string {
    if (this.tokenOwner === 'player') return '当前的你';
    if (this.tokenOwner?.startsWith('terminal:')) return `终端 ${this.tokenOwner.slice(9)}`;
    const index = this.echoes.findIndex(e => `echo:${e.colorIndex}` === this.tokenOwner);
    return index >= 0 ? `回声 ${index + 1}` : '无凭据';
  }

  terminalBlockers(terminal: Terminal): string[] {
    const reasons: string[] = [];
    if (terminal.window && (this.frame < Math.round(terminal.window[0] * FPS) || this.frame >= Math.round(terminal.window[1] * FPS))) reasons.push(`时段 ${terminal.window.join('–')} 秒`);
    if (!this.powered(terminal.power)) reasons.push(`${terminal.power!.id} 需${this.circuitState(terminal.power!.id, terminal.power!.on)}`);
    if (terminal.plate && !this.activePlates.has(terminal.plate)) reasons.push(`需有人守住 ${terminal.plate}`);
    if (terminal.requiresAuthorization && !this.authorized.has(terminal.requiresAuthorization)) reasons.push(`需先取得 ${terminal.requiresAuthorization} 授权`);
    return reasons;
  }

  terminalStatus(terminal: Terminal): string {
    const blockers = this.terminalBlockers(terminal);
    const names = [...this.waitingReceivers].filter(([, id]) => id === terminal.id).map(([actor]) => actor === 'player' ? '你' : `回声 ${this.echoes.findIndex(e => `echo:${e.colorIndex}` === actor) + 1}`);
    const window = terminal.window ? this.seconds < terminal.window[0] ? `距开放 ${(terminal.window[0] - this.seconds).toFixed(1)}s` : this.seconds < terminal.window[1] ? `剩余 ${(terminal.window[1] - this.seconds).toFixed(1)}s` : '时段已过' : '不限时段';
    const conditions = [terminal.plate ? `需守 ${terminal.plate}` : '', terminal.power ? `${terminal.power.id} 需${this.circuitState(terminal.power.id, terminal.power.on)}` : '', terminal.requiresAuthorization ? `先签 ${terminal.requiresAuthorization}` : ''].filter(Boolean).join('、');
    return `${terminal.id} · ${terminal.kind === 'lock' ? '授权' : terminal.kind === 'source' ? '凭据源' : '交接'} · ${terminal.window ? `${terminal.window.join('–')}s，` : ''}${window}${conditions ? ` · ${conditions}` : ''} · ${blockers.length ? '条件未满足' : '可操作'}${this.tokenOwner === `terminal:${terminal.id}` ? ' · 存有凭据' : ''}${terminal.authorization && this.authorized.has(terminal.authorization) ? ' · 已授权' : ''}${names.length ? ` · ${names.join('、')} 等候接收` : ''}${terminal.waitForDelivery ? ' · 按 E 留候，离开取消' : ''}`;
  }

  private resolveIntents() {
    const collect = () => this.actors().flatMap(actor => {
      if (!actor.at.intent) return [];
      if (actor.id !== 'player') {
        const echo = this.echoes.find(e => `echo:${e.colorIndex}` === actor.id)!;
        if (this.frame - (echo.delay ?? 0) >= echo.frames.length) return [];
      }
      return [{ ...actor, intent: actor.at.intent }];
    });
    let requests = collect();
    for (const circuit of this.level.circuits ?? []) {
      const group = requests.filter(r => r.intent.type === 'circuit' && r.intent.id === circuit.id && distance(r.at, circuit) < 30);
      if (!group.length) continue;
      const values = new Set(group.map(r => (r.intent as Extract<Intent, { type: 'circuit' }>).on));
      if (values.size > 1) this.signal(`${circuit.id} 操作冲突：保持原供电状态`);
      else { this.circuits.set(circuit.id, [...values][0]); this.signal(`${circuit.id} 电源${circuit.states ? '：' : ''}${this.circuitState(circuit.id)}`); }
    }
    requests = collect(); // Transfers see suppression after this tick's power requests.
    // Only marked terminals retain a take request. Leaving range, suppression,
    // or a new request cancels it; end-pose holding can wait but never reissues E.
    for (const [actor, id] of this.waitingReceivers) {
      const at = this.actors().find(a => a.id === actor)?.at;
      const terminal = this.level.terminals?.find(t => t.id === id);
      if (!at || !terminal || distance(at, terminal) >= 30 || requests.some(r => r.id === actor)) {
        this.waitingReceivers.delete(actor);
        if (!requests.some(r => r.id === actor)) this.signal(`${actor === 'player' ? '当前的你' : `回声 ${this.echoes.findIndex(e => `echo:${e.colorIndex}` === actor) + 1}`} 在 ${id} 的等候已取消：${!at ? '投影不可用' : '已离开接收范围'}`);
      }
    }
    for (const request of requests) {
      if (request.intent.type !== 'take') continue;
      const terminal = this.level.terminals?.find(t => t.id === request.intent.id);
      if (terminal?.waitForDelivery && distance(request.at, terminal) < 30) {
        this.waitingReceivers.set(request.id, terminal.id);
        this.signal(`${request.label} 在 ${terminal.id} 等候接收；离开终端会取消`);
      }
    }
    for (const [actor, id] of this.waitingReceivers) {
      if (requests.some(r => r.id === actor)) continue;
      const receiver = this.actors().find(a => a.id === actor)!;
      requests.push({ ...receiver, intent: { type: 'take', id } });
    }
    // All transfers use the single owner field. Giving precedes receiving, so a
    // same-tick rendezvous works; competing receivers cancel instead of duplicating.
    for (const phase of ['give', 'take', 'authorize'] as const) {
      for (const terminal of this.level.terminals ?? []) {
        const group = requests.filter(r => r.intent.type === phase && r.intent.id === terminal.id && distance(r.at, terminal) < 30);
        if (!group.length) continue;
        if ((phase === 'authorize') !== (terminal.kind === 'lock')) continue;
        const blockers = this.terminalBlockers(terminal);
        const waiting = phase === 'take' && terminal.waitForDelivery;
        if (blockers.length) {
          if (!waiting) this.signal(`${terminal.id} ${phase === 'authorize' ? '授权' : phase === 'give' ? '交付' : '接收'}未满足：${blockers.join('、')}`);
          continue;
        }
        if (waiting && this.tokenOwner !== `terminal:${terminal.id}`) continue;
        if (phase === 'give') {
          const sender = group.find(r => r.id === this.tokenOwner);
          if (sender) { this.tokenOwner = `terminal:${terminal.id}`; this.signal(`${sender.label} 将凭据交给 ${terminal.id}`); }
          else this.signal(`${terminal.id} 交付未满足：没有持有凭据`);
        } else if (phase === 'take') {
          group.forEach(r => this.waitingReceivers.delete(r.id));
          if (group.length > 1) this.signal(`${terminal.id} 接收冲突：凭据留在终端`);
          else if (this.tokenOwner === `terminal:${terminal.id}`) { this.tokenOwner = group[0].id; this.signal(`${group[0].label} 收到 ${terminal.id} 的凭据`); }
          else this.signal(`${group[0].label} 接收未满足：${terminal.id} 尚无凭据`);
        } else {
          const holder = group.find(r => r.id === this.tokenOwner);
          if (holder && terminal.authorization) { this.authorized.add(terminal.authorization); this.signal(`${holder.label} 完成 ${terminal.id} 授权`); }
          else this.signal(`${terminal.id} 授权未满足：需要凭据`);
        }
      }
    }
  }

  beginRerecord(index: number): boolean {
    if (!Number.isInteger(index) || !this.echoes[index] || this.editingIndex !== null) return false;
    this.editingIndex = index;
    this.attempts++;
    this.resetWorld('ready');
    this.events.push('rewind');
    return true;
  }

  cancelRerecord(): boolean {
    if (this.editingIndex === null) return false;
    this.editingIndex = null;
    this.resetWorld('ready');
    this.events.push('rewind');
    return true;
  }

  undoPlan(): boolean {
    if (!this.canUndo) return false;
    this.echoes = this.planHistory.pop()!;
    this.attempts++;
    this.resetWorld('ready');
    this.events.push('rewind', 'plan');
    return true;
  }

  echoActivity(index: number): string {
    if (index === this.editingIndex) return '正在重录';
    const echo = this.echoes[index];
    if (!echo) return '';
    if (this.status === 'ready') return '等待行动';
    if (this.frame < (echo.delay ?? 0)) return `${(((echo.delay ?? 0) - this.frame) / FPS).toFixed(2)}s 后出场`;
    const actor = this.echoAt(echo);
    if (this.suppressed(actor)) return '投影受抑制';
    const plate = this.level.plates.find(p => distance(p, actor) < 23);
    if (plate) return this.activePlates.has(plate.id) || !plate.window ? `守住 ${plate.id} 开关` : `在 ${plate.id} 等待响应`;
    if (this.frame - (echo.delay ?? 0) >= echo.frames.length - 1) return '终点待命';
    return distance(actor, this.echoAt(echo, Math.max(0, this.frame - 1))) < 0.1 ? '等待中' : '移动中';
  }

  resetWorld(status: Status = 'running') {
    this.player = { ...this.level.spawn, angle: -Math.PI / 2, lure: false };
    this.frame = 0;
    this.hasLoot = false;
    this.alarm = 0;
    this.lureCooldown = 0;
    this.recording = [];
    this.noise = [];
    this.pendingNoise = [];
    this.interactHeld = false;
    this.failure = null;
    this.scanExposure.clear();
    this.signals = [];
    this.circuits = new Map((this.level.circuits ?? []).map(c => [c.id, c.initial]));
    this.authorized.clear();
    const source = this.level.terminals?.find(t => t.kind === 'source');
    this.tokenOwner = source ? `terminal:${source.id}` : null;
    this.waitingReceivers.clear();
    this.openDoors.clear();
    this.activePlates.clear();
    this.guards = this.level.guards.map(g => ({
      ...g.route[0], angle: g.facing ?? Math.atan2((g.route[1] ?? g.route[0]).y - g.route[0].y, (g.route[1] ?? g.route[0]).x - g.route[0].x),
      waypoint: 1, investigate: null, attention: 0, suspicion: 0,
    }));
    this.status = status;
    this.lastMessage = '';
    this.updatePlates();
  }

  start() { if (this.status === 'ready') { this.status = 'running'; this.events.push('start'); } }

  togglePause() {
    if (this.status === 'running') this.status = 'paused';
    else if (this.status === 'paused') this.status = 'running';
  }

  restart() { this.attempts++; this.resetWorld(); this.events.push('rewind'); }

  clear() {
    if (this.echoes.length) this.rememberPlan();
    this.echoes = [];
    this.editingIndex = null;
    this.attempts = 1;
    this.resetWorld('ready');
    this.events.push('rewind', 'plan');
  }

  removeEcho(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= this.echoes.length || this.editingIndex !== null) return;
    this.rememberPlan();
    this.echoes.splice(index, 1);
    this.attempts++;
    this.resetWorld('ready');
    this.events.push('rewind', 'plan');
  }

  rewind(): boolean {
    if (this.status !== 'running' || this.recording.length < 2) return false;
    if (this.echoes.length >= MAX_ECHOES && this.editingIndex === null) {
      this.lastMessage = '回声槽已满。点击回声的「重录」修改路线，或按 Enter 重试本轮。';
      this.events.push('full');
      return false;
    }
    this.rememberPlan();
    if (this.editingIndex !== null) {
      const colorIndex = this.echoes[this.editingIndex].colorIndex;
      this.echoes[this.editingIndex] = { ...this.echoes[this.editingIndex], frames: this.recording.map(cloneFrame), colorIndex };
      this.editingIndex = null;
    } else {
      const used = new Set(this.echoes.map(e => e.colorIndex));
      const colorIndex = [0, 1, 2].find(i => !used.has(i)) ?? 0;
      this.echoes.push({ frames: this.recording.map(cloneFrame), colorIndex });
    }
    this.attempts++;
    this.resetWorld();
    this.events.push('rewind', 'plan');
    return true;
  }

  echoAt(echo: Echo, frame = this.frame): Frame {
    return echo.frames[Math.max(0, Math.min(frame - (echo.delay ?? 0), echo.frames.length - 1))];
  }

  blocked(x: number, y: number, radius = RADIUS, sight = false): boolean {
    if (radius <= 0) return false;
    const touches = (rx: number, ry: number, width: number, height: number) => {
      const dx = x - Math.max(rx, Math.min(x, rx + width));
      const dy = y - Math.max(ry, Math.min(y, ry + height));
      return dx * dx + dy * dy < radius * radius;
    };
    for (let cx = Math.floor((x - radius) / TILE); cx <= Math.floor((x + radius) / TILE); cx++) {
      const column = this.wallCells.get(cx);
      if (!column) continue;
      for (let cy = Math.floor((y - radius) / TILE); cy <= Math.floor((y + radius) / TILE); cy++) {
        for (const wall of column.get(cy) ?? []) if (touches(wall.x, wall.y, TILE, TILE)) return true;
      }
    }
    return this.level.doors.some(d => !this.openDoors.has(d.id) && touches(d.x, d.y, d.w, d.h)) ||
      (!sight && (this.level.glass ?? []).some(g => touches(g.x, g.y, g.w, g.h)));
  }

  occluded(x: number, y: number): boolean { return this.blocked(x, y, 1, true); }

  private canWalk(from: Point, to: Point): boolean {
    const steps = Math.ceil(distance(from, to) / 5);
    for (let i = 1; i <= steps; i++) if (this.blocked(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps)) return false;
    return true;
  }

  private move(actor: Point, dx: number, dy: number) {
    if (!this.blocked(actor.x + dx, actor.y)) actor.x += dx;
    if (!this.blocked(actor.x, actor.y + dy)) actor.y += dy;
  }

  updatePlates() {
    const actors = this.actors().map(a => a.at);
    const previous = this.openDoors;
    this.activePlates = new Set(this.level.plates.filter(p => (!p.window || (this.seconds >= p.window[0] && this.seconds < p.window[1])) && actors.some(a => distance(a, p) < 23)).map(p => p.id));
    this.openDoors = new Set(this.level.doors.filter(d => {
      const plates = doorPlates(d), count = plates.filter(p => this.activePlates.has(p)).length;
      const pressed = !plates.length || (d.plateMode === 'none' ? count === 0 : d.plateMode === 'one' ? count === 1 : d.plateMode === 'any' ? count > 0 : count === plates.length);
      const windows = d.windows ?? (d.window ? [d.window] : []);
      return pressed && this.powered(d.power) && (!windows.length || windows.some(([start, end]) => this.seconds >= start && this.seconds < end)) && (!d.authorization || this.authorized.has(d.authorization));
    }).map(d => d.id));
    for (const door of this.level.doors) if (previous.has(door.id) !== this.openDoors.has(door.id)) this.signal(`${door.id} 门${this.openDoors.has(door.id) ? '开启' : '关闭'}`);
    if (this.openDoors.size > previous.size) this.events.push('door');
  }

  canSee(from: Point, to: Point): boolean {
    const steps = Math.ceil(distance(from, to) / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.occluded(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return false;
    }
    return true;
  }

  private makeNoise(at: Point) {
    this.noise.push({ ...at, life: 1 });
    this.events.push('lure');
    if (this.level.noiseResponse === 'nearest') this.pendingNoise.push({ x: at.x, y: at.y });
    else for (const [index, guard] of this.guards.entries()) if (this.hears(index, at)) this.investigate(index, at);
  }

  guardName(index: number): string { return this.level.guards[index].id ?? String(index + 1); }
  soundName(at: Point): string { return this.level.soundMarkers?.find(m => distance(m, at) < 12)?.id ?? '临时声源'; }
  private hears(index: number, at: Point): boolean {
    const def = this.level.guards[index];
    return def.kind !== 'sentry' && def.kind !== 'camera' && this.powered(def.power) && distance(this.guards[index], at) < (def.hearing ?? 450);
  }
  private investigate(index: number, at: Point) {
    const guard = this.guards[index];
    guard.investigate = { x: at.x, y: at.y }; guard.searching = false;
    guard.attention = this.level.guards[index].searchSeconds ?? 2.5;
    this.signal(`${this.guardName(index)} 号守卫调查声响 · ${this.soundName(at)}`);
  }
  private dispatchNoise() {
    // Resolve simultaneous sounds as a batch. Distance, stable guard ID, then
    // source coordinates break ties, independently of the echo array order.
    const sources = this.pendingNoise.filter((s, i, all) => all.findIndex(a => a.x === s.x && a.y === s.y) === i);
    const pairs = sources.flatMap(at => this.guards.flatMap((guard, index) => this.hears(index, at) ? [{ at, index, gap: distance(guard, at), id: this.guardName(index) }] : []));
    pairs.sort((a, b) => a.gap - b.gap || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || a.at.x - b.at.x || a.at.y - b.at.y);
    const assigned = new Set<number>(), heard = new Set<Point>();
    for (const pair of pairs) if (!assigned.has(pair.index) && !heard.has(pair.at)) {
      this.investigate(pair.index, pair.at); assigned.add(pair.index); heard.add(pair.at);
    }
    this.pendingNoise = [];
  }

  private updateGuards() {
    const actors = this.actors();
    this.guards.forEach((guard, index) => {
      const def = this.level.guards[index];
      if (!this.powered(def.power)) { guard.suspicion = 0; return; }
      if (guard.investigate && def.searchSeconds !== undefined && distance(guard, guard.investigate) < 8 && !guard.searching) {
        guard.searching = true; this.signal(`${this.guardName(index)} 号守卫抵达声源，搜索 ${def.searchSeconds} 秒`);
      }
      if (def.searchSeconds === undefined || guard.searching) guard.attention = Math.max(0, guard.attention - DT);
      if (guard.investigate && guard.attention === 0) { guard.investigate = null; guard.searching = false; this.signal(`${this.guardName(index)} 号守卫返回巡逻路线`); }
      const destination = guard.investigate ?? def.route[guard.waypoint % def.route.length];
      let target = destination;
      // Keep existing recordings on legacy maps compatible with their original
      // routing rule. New arrival-search guards and glass need body clearance.
      const routeBlocked = (guard.investigate || def.searchSeconds !== undefined) &&
        !(def.searchSeconds !== undefined || this.level.glass?.length ? this.canWalk(guard, destination) : this.canSee(guard, destination));
      if (routeBlocked) {
        const key = `${destination.x}:${destination.y}:${[...this.openDoors].join(',')}`;
        if (guard.pathKey !== key) { guard.path = findRoute(guard, destination, (x, y) => this.blocked(x, y)); guard.pathKey = key; }
        while (guard.path?.length && distance(guard, guard.path[0]) < 5) guard.path.shift();
        target = guard.path?.[0] ?? guard;
      } else { guard.pathKey = ''; guard.path = []; }
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5 && def.kind !== 'sentry' && def.kind !== 'camera') {
        guard.angle = Math.atan2(dy, dx);
        this.move(guard, dx / dist * def.speed * DT, dy / dist * def.speed * DT);
      } else if (!guard.investigate && def.kind !== 'sentry' && def.kind !== 'camera') {
        guard.waypoint = (guard.waypoint + 1) % def.route.length;
        if (def.route.length === 1 && def.facing !== undefined) guard.angle = def.facing;
      }
      const seen = actors.find(({ at: a }) => {
        const gap = Math.atan2(a.y - guard.y, a.x - guard.x) - guard.angle;
        const angle = Math.abs(Math.atan2(Math.sin(gap), Math.cos(gap)));
        return distance(a, guard) < this.visionRange(index) && (angle < 0.56 || distance(a, guard) < 24) && this.canSee(guard, a);
      });
      guard.seenActor = seen?.label;
      guard.suspicion = Math.max(0, Math.min(1, guard.suspicion + (seen ? DT * 1.65 : -DT * 0.8)));
    });
    this.alarm = Math.max(0, ...this.guards.map(g => g.suspicion));
    if (this.alarm >= 1) {
      const guard = this.guards.findIndex(g => g.suspicion >= 1);
      const actor = actors.find(a => a.label === this.guards[guard].seenActor)!;
      this.failure = { frame: this.frame, actor: actor.label, guard, point: { x: actor.at.x, y: actor.at.y } };
      this.status = 'caught';
      this.lastMessage = `${this.seconds.toFixed(2)} 秒：${actor.label}被 ${this.guardName(guard)} 号守卫发现。调整这一段路线或出场时间。`;
      this.signal(this.lastMessage);
      this.events.push('caught');
    }
  }

  step(input: Input) {
    if (this.status !== 'running') return;
    this.updatePlates();
    this.lureCooldown = Math.max(0, this.lureCooldown - DT);
    const mag = Math.hypot(input.x, input.y);
    if (mag > 0) {
      this.player.angle = Math.atan2(input.y, input.x);
      this.move(this.player, input.x / mag * SPEED * DT, input.y / mag * SPEED * DT);
    }
    this.player.lure = !this.spectator && input.lure && this.lureCooldown === 0;
    if (this.player.lure) { this.lureCooldown = 1.5; this.makeNoise(this.player); }
    for (const { echo } of this.activeEchoes) {
      const local = this.frame - (echo.delay ?? 0);
      if (local < echo.frames.length && echo.frames[local].lure && !this.suppressed(echo.frames[local])) this.makeNoise(echo.frames[local]);
    }
    this.dispatchNoise();
    delete this.player.intent;
    if (!this.spectator && input.interact && !this.interactHeld) this.player.intent = this.interaction();
    this.interactHeld = !!input.interact;
    this.resolveIntents();
    this.recording.push(cloneFrame(this.player));
    this.updatePlates();
    this.updateGuards();
    if (this.alarm >= 1) return;
    this.updateScanners();
    if (this.alarm >= 1) return;
    if (!this.spectator && this.level.objective !== 'reach' && this.editingIndex === null && !this.hasLoot && this.canCollect && distance(this.player, this.level.loot) < 25) {
      this.hasLoot = true;
      this.events.push('loot');
      if (this.level.onLoot) {
        for (const power of this.level.onLoot.power) this.circuits.set(power.id, power.on);
        this.signal(this.level.onLoot.message);
        this.updatePlates();
      }
    }
    this.frame++;
    this.noise = this.noise.map(n => ({ ...n, life: n.life - DT * 1.3 })).filter(n => n.life > 0);
    if (!this.spectator && this.editingIndex === null && this.exitReady && (this.hasLoot || this.level.objective === 'reach') && distance(this.player, this.level.exit ?? this.level.spawn) < 30) {
      this.status = 'won';
      this.events.push('won');
      return;
    }
    if (this.frame % FPS === 0 && this.remaining <= 3) this.events.push('tick');
    if (this.frame >= MAX_FRAMES) {
      if (this.spectator) { this.status = 'paused'; return; }
      if (this.echoes.length < MAX_ECHOES || this.editingIndex !== null) this.rewind();
      else {
        this.status = 'caught';
        this.lastMessage = '12 秒已用完。回声槽已满，按 Enter 重试，或删除一条回声重新安排。';
        this.events.push('caught');
      }
    }
  }

  drainEvents(): GameEvent[] { return this.events.splice(0); }
}
