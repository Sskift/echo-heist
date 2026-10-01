import { doorPlates, FPS, LOOP_SECONDS, MAX_ECHOES, MAX_FRAMES, TILE, type Cycle, type Level, type Point, type Power, type Scanner, type Suppressor, type Terminal } from './levels.ts';
import { findRoute } from './navigation.ts';

export type Intent = { type: 'circuit'; id: string; on: boolean } | { type: 'take' | 'give' | 'authorize' | 'deposit'; id: string };
export type Input = { x: number; y: number; lure: boolean; interact?: boolean };
export type Frame = Point & { angle: number; lure: boolean; intent?: Intent };
export type Echo = { frames: Frame[]; colorIndex: number; delay?: number };
export type Carry = { level: Level; echo: Echo };
export type Status = 'ready' | 'running' | 'paused' | 'caught' | 'won';
export type OperationResult = 'success' | 'blocked' | 'waiting' | 'cancelled' | 'ignored';
export type OperationRecord = { frame: number; actor: string; label: string; intent: Intent; result: OperationResult; reason: string; point: Point };
type OperationRequest = { id: string; label: string; at: Frame; intent: Intent };
type Guard = Point & { angle: number; waypoint: number; investigate: Point | null; attention: number; suspicion: number; path?: Point[]; pathKey?: string; seenActor?: string; searching?: boolean; trace?: { at: Point; actor: string; label: string; remaining: number } };
export type GameEvent = 'start' | 'rewind' | 'door' | 'loot' | 'deposit' | 'receipt' | 'lure' | 'caught' | 'won' | 'tick' | 'full' | 'plan';

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
  evidenceDeposited = false;
  evidenceReaders = new Set<string>();
  evidenceReceipts = new Set<string>();
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
  // Observations only: rebuilt each round/preview and never stored in a plan.
  operationLog: OperationRecord[] = [];
  failure: { frame: number; actor: string; guard: number; point: Point; scanner?: string } | null = null;
  scanExposure = new Map<string, number>();
  spectator = false;
  private interactHeld = false;
  private pendingNoise: Point[] = [];
  private wallCells = new Map<number, Map<number, Point[]>>();
  readonly carried?: Carry;
  readonly remote?: Game;

  constructor(level: Level, carried?: Carry) {
    this.level = level;
    if (carried && level.continuity?.source === carried.level.id) {
      this.carried = { level: carried.level, echo: cloneEcho(carried.echo) };
      this.echoes = [cloneEcho(carried.echo)];
      if (!level.continuity.home) {
        this.remote = new Game(carried.level);
        this.remote.spectator = true;
        this.remote.restorePlan([carried.echo]);
      }
    }
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
  get lockedSlots(): number { return this.carried ? 1 : 0; }
  get localPlan(): Echo[] { return this.echoes.slice(this.lockedSlots); }
  get exitPoint(): Point { return this.level.alternateExit && this.powered(this.level.alternateExit.power) ? this.level.alternateExit.at : this.level.exit ?? this.level.spawn; }
  get activeEchoes() { return this.echoes.map((echo, index) => ({ echo, index })).filter(({ echo, index }) => !(this.remote && index === 0) && index !== this.editingIndex && this.frame >= (echo.delay ?? 0)); }
  get canUndo(): boolean { return this.planHistory.length > 0 && this.editingIndex === null; }

  private snapshot(): Echo[] {
    return this.echoes.map(cloneEcho);
  }

  private rememberPlan() {
    this.planHistory.push(this.snapshot());
    if (this.planHistory.length > 20) this.planHistory.shift();
  }

  restorePlan(echoes: Echo[]) {
    this.echoes = this.carried ? [cloneEcho(this.carried.echo)] : [];
    for (const echo of echoes.slice(0, MAX_ECHOES - this.lockedSlots)) {
      const used = new Set(this.echoes.map(e => e.colorIndex));
      this.echoes.push({ ...cloneEcho(echo), colorIndex: used.has(echo.colorIndex) ? [0, 1, 2].find(i => !used.has(i))! : echo.colorIndex });
    }
    this.editingIndex = null;
    this.planHistory = [];
    this.resetWorld('ready');
  }

  setDelay(index: number, frames: number): boolean {
    if (index < this.lockedSlots || !this.echoes[index] || this.editingIndex !== null || !Number.isInteger(frames) || frames < 0 || frames > FPS * 6 || frames % 15 !== 0) return false;
    if ((this.echoes[index].delay ?? 0) === frames) return false;
    this.rememberPlan(); this.echoes[index].delay = frames;
    this.resetWorld('ready'); this.events.push('plan'); return true;
  }

  previewAt(frame: number): Game {
    const preview = new Game(this.level, this.carried);
    preview.spectator = true;
    preview.restorePlan(this.localPlan); preview.start();
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
  get handoffReady(): boolean {
    if (!this.level.handoff) return true;
    const plate = this.level.plates.find(p => p.id === this.level.handoff!.plate);
    const echo = this.echoes[0];
    return this.echoes.length === 1 && !!plate && !!echo && distance(echo.frames.at(-1)!, plate) < 23 && this.activePlates.has(plate.id);
  }
  get exitReady(): boolean { return this.handoffReady && (!this.level.continuity || !!this.carried) && !this.unmetPower(this.level.exitPower).length; }
  get objectiveComplete(): boolean {
    return this.level.objective === 'deliver' ? !!this.level.delivery && this.evidenceDeposited && (this.level.delivery.receivers ?? []).every(r => this.evidenceReceipts.has(r.guard)) : this.level.objective === 'reach' || this.hasLoot;
  }
  deliveryBlockers(): string[] {
    const d = this.level.delivery;
    if (!d) return [];
    return [
      ...this.unmetPower(d.power).map(p => `${p.id} 需${this.circuitState(p.id, p.on)}`),
      ...(d.plate && !this.activePlates.has(d.plate) ? [`需有人守住 ${d.plate}`] : []),
      ...(d.authorization && !this.authorized.has(d.authorization) ? [`需先取得 ${d.authorization} 授权`] : []),
      ...(d.window && (this.frame < Math.round(d.window[0] * FPS) || this.frame >= Math.round(d.window[1] * FPS)) ? [`提交时段 ${d.window.join('–')} 秒`] : []),
    ];
  }
  deliveryStatus(): string {
    if (!this.level.delivery) return '';
    if (this.objectiveComplete) return '证据送达已确认，前往撤离点';
    if (this.evidenceDeposited) return `证据已植入；回执 ${this.evidenceReceipts.size} / ${this.level.delivery.receivers?.length ?? 0}`;
    const blockers = this.deliveryBlockers();
    return blockers.length ? `携带证据 · ${blockers.join('、')}` : `携带证据 · 到 ${this.level.delivery.id} 按 E 植入`;
  }
  private updateDelivery() {
    const d = this.level.delivery;
    // Physical evidence belongs to the live operation. Replays may open its
    // conditions but cannot deposit it, including an old recorded E request.
    if (this.level.objective !== 'deliver' || !d || this.spectator || this.editingIndex !== null) return;
    if (!this.evidenceDeposited && this.player.intent?.type === 'deposit' && this.player.intent.id === d.id && distance(this.player, d) < 30) {
      const blockers = this.deliveryBlockers();
      if (blockers.length) { this.signal(`${d.id} 植入未满足：${blockers.join('、')}`); this.tracePlayerDeposit('blocked', blockers.join('、')); }
      else {
        this.evidenceDeposited = true; this.events.push('deposit'); this.signal(`${d.id} 已植入 ${d.label}`);
        this.tracePlayerDeposit('success', `实体证据已植入${d.receivers?.length ? '；仍需独立回执' : ''}`);
        if (d.onDeposit) {
          for (const p of d.onDeposit.power) this.circuits.set(p.id, p.on);
          this.signal(d.onDeposit.message); this.updatePlates();
        }
      }
    }
    if (!this.evidenceDeposited) return;
    for (const receiver of d.receivers ?? []) {
      const i = this.level.guards.findIndex(g => g.id === receiver.guard);
      const guard = this.guards[i], def = this.level.guards[i];
      if (!guard || !this.powered(def.power)) continue;
      if (!this.evidenceReaders.has(receiver.guard) && guard.investigate && guard.searching && distance(guard, d) < 24 && this.canWalk(guard, d)) {
        this.evidenceReaders.add(receiver.guard); this.signal(`${receiver.guard} 搜索发现证据，携带核验副本返回 ${receiver.label}`);
      }
      if (this.evidenceReaders.has(receiver.guard) && !this.evidenceReceipts.has(receiver.guard) && !guard.investigate && !guard.trace && distance(guard, receiver.at) < 20 && this.canWalk(guard, receiver.at)) {
        this.evidenceReceipts.add(receiver.guard); this.events.push('receipt'); this.signal(`${receiver.guard} 已在 ${receiver.label} 登记回执`);
      }
    }
  }
  visionRange(index: number): number {
    const def = this.level.guards[index];
    return def.lighting && !this.powered(def.lighting) ? def.lighting.darkRange : def.range;
  }
  scanning(scanner: Scanner, frame = this.frame): boolean {
    return this.powered(scanner.power) && this.cycleActive(scanner, frame);
  }
  cycleActive(cycle: Cycle, frame = this.frame): boolean {
    const period = Math.round(cycle.period * FPS);
    const time = ((frame + Math.round((cycle.phase ?? 0) * FPS)) % period + period) % period;
    return time >= Math.round(cycle.active[0] * FPS) && time < Math.round(cycle.active[1] * FPS);
  }
  cycleRemaining(cycle: Cycle): number {
    const period = Math.round(cycle.period * FPS), start = Math.round(cycle.active[0] * FPS), end = Math.round(cycle.active[1] * FPS);
    const time = ((this.frame + Math.round((cycle.phase ?? 0) * FPS)) % period + period) % period;
    return (time < start ? start - time : time < end ? end - time : period - time + start) / FPS;
  }
  suppressionActive(field: Suppressor, frame = this.frame): boolean {
    return this.powered(field.power) && (!field.cycle || this.cycleActive(field.cycle, frame));
  }
  suppressionFields(at: Point): Suppressor[] {
    return (this.level.suppressors ?? []).filter(s => this.suppressionActive(s) && at.x >= s.x && at.x <= s.x + s.w && at.y >= s.y && at.y <= s.y + s.h);
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
    return this.suppressionFields(at).length > 0;
  }
  private actors(includeSuppressed = false) {
    return [
      ...(!this.spectator ? [{ id: 'player', label: '当前的你', at: this.player }] : []),
      ...this.activeEchoes.filter(({ echo }) => includeSuppressed || !this.suppressed(this.echoAt(echo))).map(({ echo, index }) => ({ id: `echo:${echo.colorIndex}`, label: `回声 ${index + 1}`, at: this.echoAt(echo) })),
    ];
  }
  private signal(text: string) {
    this.signals.push({ frame: this.frame, text });
    if (this.signals.length > 100) this.signals.shift();
  }
  private traceOperation(request: OperationRequest, result: OperationResult, reason: string) {
    this.operationLog.push({ frame: this.frame, actor: request.id, label: request.label, intent: { ...request.intent }, result, reason, point: { x: request.at.x, y: request.at.y } });
  }
  private tracePlayerDeposit(result: OperationResult, reason: string) {
    if (this.player.intent?.type === 'deposit') this.traceOperation({ id: 'player', label: '当前的你', at: this.player, intent: this.player.intent }, result, reason);
  }

  interaction(): Intent | undefined {
    const delivery = this.level.delivery;
    if (this.level.objective === 'deliver' && delivery && distance(delivery, this.player) < 30) return { type: 'deposit', id: delivery.id };
    const circuit = this.level.circuits?.find(c => !c.feed && distance(c, this.player) < 30);
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
    const collect = (includeSuppressed = false): OperationRequest[] => this.actors(includeSuppressed).flatMap(actor => {
      if (!actor.at.intent) return [];
      if (actor.id !== 'player') {
        const echo = this.echoes.find(e => `echo:${e.colorIndex}` === actor.id)!;
        if (this.frame - (echo.delay ?? 0) >= echo.frames.length) return [];
      }
      return [{ ...actor, intent: actor.at.intent }];
    });
    let requests = collect();
    // Circuit requests see the suppression state BEFORE power is resolved.
    for (const request of collect(true).filter(r => r.intent.type === 'circuit')) {
      const target = this.level.circuits?.find(c => c.id === request.intent.id);
      if (request.id !== 'player' && this.suppressed(request.at)) this.traceOperation(request, 'blocked', '操作当刻投影受抑制，恢复后不会补发');
      else if (!target) this.traceOperation(request, 'blocked', '这个电路不在当前行动区');
      else if (distance(request.at, target) >= 30) this.traceOperation(request, 'blocked', '操作位置已超出设备范围');
    }
    for (const circuit of (this.level.circuits ?? []).filter(c => !c.feed)) {
      const group = requests.filter(r => r.intent.type === 'circuit' && r.intent.id === circuit.id && distance(r.at, circuit) < 30);
      if (!group.length) continue;
      const values = new Set(group.map(r => (r.intent as Extract<Intent, { type: 'circuit' }>).on));
      if (values.size > 1) {
        this.signal(`${circuit.id} 操作冲突：保持原供电状态`);
        group.forEach(r => this.traceOperation(r, 'blocked', `同帧出现相反请求，${circuit.id} 保持原状态`));
      } else {
        this.circuits.set(circuit.id, [...values][0]); this.signal(`${circuit.id} 电源${circuit.states ? '：' : ''}${this.circuitState(circuit.id)}`);
        group.forEach(r => this.traceOperation(r, 'success', `${circuit.id} 已${this.circuitState(circuit.id)}`));
      }
    }
    requests = collect(); // Transfers see suppression after this tick's power requests.
    for (const request of collect(true).filter(r => r.intent.type !== 'circuit')) {
      if (request.id !== 'player' && this.suppressed(request.at)) { this.traceOperation(request, 'blocked', '交互当刻投影受抑制，恢复后不会补发'); continue; }
      if (request.intent.type === 'deposit') {
        if (request.id !== 'player') this.traceOperation(request, 'ignored', '回声只重放请求，实体证据必须由真人植入');
        else if (this.editingIndex !== null) this.traceOperation(request, 'ignored', '重录只保存请求，不提交实体证据');
        else if (this.evidenceDeposited) this.traceOperation(request, 'ignored', '实体证据已经植入，不会重复提交');
        continue;
      }
      const target = this.level.terminals?.find(t => t.id === request.intent.id);
      if (!target) this.traceOperation(request, 'blocked', '这个终端不在当前行动区');
      else if (distance(request.at, target) >= 30) this.traceOperation(request, 'blocked', '操作位置已超出终端范围');
      else if ((request.intent.type === 'authorize') !== (target.kind === 'lock')) this.traceOperation(request, 'blocked', '请求类型与终端用途不符');
    }
    // Only marked terminals retain a take request. Leaving range, suppression,
    // or a new request cancels it; end-pose holding can wait but never reissues E.
    for (const [actor, id] of this.waitingReceivers) {
      const at = this.actors().find(a => a.id === actor)?.at;
      const terminal = this.level.terminals?.find(t => t.id === id);
      if (!at || !terminal || distance(at, terminal) >= 30 || requests.some(r => r.id === actor)) {
        this.waitingReceivers.delete(actor);
        const receiver = this.actors(true).find(a => a.id === actor);
        if (receiver) this.traceOperation({ ...receiver, intent: { type: 'take', id } }, 'cancelled', !at ? '投影受抑制，留候取消；恢复后需要新的接收请求' : requests.some(r => r.id === actor) ? '新的操作替换了这次留候' : '离开接收范围，留候取消');
        if (!requests.some(r => r.id === actor)) this.signal(`${actor === 'player' ? '当前的你' : `回声 ${this.echoes.findIndex(e => `echo:${e.colorIndex}` === actor) + 1}`} 在 ${id} 的等候已取消：${!at ? '投影不可用' : '已离开接收范围'}`);
      }
    }
    for (const request of requests) {
      if (request.intent.type !== 'take') continue;
      const terminal = this.level.terminals?.find(t => t.id === request.intent.id);
      if (terminal?.waitForDelivery && distance(request.at, terminal) < 30) {
        this.waitingReceivers.set(request.id, terminal.id);
        this.signal(`${request.label} 在 ${terminal.id} 等候接收；离开终端会取消`);
        this.traceOperation(request, 'waiting', `已登记留候：${[...this.terminalBlockers(terminal), ...(this.tokenOwner !== `terminal:${terminal.id}` ? ['等待凭据送达'] : [])].join('、') || '等待本帧接收结算'}；离开或受抑制会取消`);
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
          if (!waiting) {
            this.signal(`${terminal.id} ${phase === 'authorize' ? '授权' : phase === 'give' ? '交付' : '接收'}未满足：${blockers.join('、')}`);
            group.forEach(r => this.traceOperation(r, 'blocked', blockers.join('、')));
          }
          continue;
        }
        if (waiting && this.tokenOwner !== `terminal:${terminal.id}`) continue;
        if (phase === 'give') {
          const sender = group.find(r => r.id === this.tokenOwner);
          if (sender) { this.tokenOwner = `terminal:${terminal.id}`; this.signal(`${sender.label} 将凭据交给 ${terminal.id}`); }
          else this.signal(`${terminal.id} 交付未满足：没有持有凭据`);
          group.forEach(r => this.traceOperation(r, r === sender ? 'success' : 'blocked', r === sender ? `凭据已交到 ${terminal.id}` : '你不是这份凭据的持有人'));
        } else if (phase === 'take') {
          group.forEach(r => this.waitingReceivers.delete(r.id));
          if (group.length > 1) {
            this.signal(`${terminal.id} 接收冲突：凭据留在终端`);
            group.forEach(r => this.traceOperation(r, 'blocked', '多人同时接收，本次请求全部取消'));
          } else if (this.tokenOwner === `terminal:${terminal.id}`) {
            this.tokenOwner = group[0].id; this.signal(`${group[0].label} 收到 ${terminal.id} 的凭据`);
            this.traceOperation(group[0], 'success', `已收到 ${terminal.id} 的唯一凭据`);
          } else {
            this.signal(`${group[0].label} 接收未满足：${terminal.id} 尚无凭据`);
            this.traceOperation(group[0], 'blocked', `${terminal.id} 尚无凭据；当前持有者：${this.credentialOwner()}`);
          }
        } else {
          const holder = group.find(r => r.id === this.tokenOwner);
          if (holder && terminal.authorization) { this.authorized.add(terminal.authorization); this.signal(`${holder.label} 完成 ${terminal.id} 授权`); }
          else this.signal(`${terminal.id} 授权未满足：需要凭据`);
          group.forEach(r => this.traceOperation(r, r === holder && terminal.authorization ? 'success' : 'blocked', r === holder && terminal.authorization ? `已签 ${terminal.authorization}，凭据仍由你保管` : '授权需要由凭据持有人发出请求'));
        }
      }
    }
  }

  beginRerecord(index: number): boolean {
    if (!Number.isInteger(index) || index < this.lockedSlots || !this.echoes[index] || this.editingIndex !== null) return false;
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
    if (this.remote && index === 0) return `${this.level.continuity!.room} · ${this.remote.echoActivity(0)}`;
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
    this.remote?.resetWorld('running');
    this.player = { ...this.level.spawn, angle: -Math.PI / 2, lure: false };
    this.frame = 0;
    this.hasLoot = false;
    this.evidenceDeposited = false;
    this.evidenceReaders.clear(); this.evidenceReceipts.clear();
    this.alarm = 0;
    this.lureCooldown = 0;
    this.recording = [];
    this.noise = [];
    this.pendingNoise = [];
    this.interactHeld = false;
    this.failure = null;
    this.scanExposure.clear();
    this.signals = [];
    this.operationLog = [];
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
    this.echoes = this.carried ? [cloneEcho(this.carried.echo)] : [];
    this.editingIndex = null;
    this.attempts = 1;
    this.resetWorld('ready');
    this.events.push('rewind', 'plan');
  }

  removeEcho(index: number) {
    if (!Number.isInteger(index) || index < this.lockedSlots || index >= this.echoes.length || this.editingIndex !== null) return;
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
    for (const circuit of this.level.circuits ?? []) if (circuit.feed) {
      this.circuits.set(circuit.id, (circuit.feed.remote ? this.remote?.activePlates : this.activePlates)?.has(circuit.feed.plate) ?? false);
    }
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
    else for (const index of this.guards.keys()) if (this.hears(index, at)) this.investigate(index, at);
  }

  guardName(index: number): string { return this.level.guards[index].id ?? String(index + 1); }
  soundName(at: Point): string { return this.level.soundMarkers?.find(m => distance(m, at) < 12)?.id ?? '临时声源'; }
  private hears(index: number, at: Point): boolean {
    const def = this.level.guards[index];
    return def.kind !== 'sentry' && def.kind !== 'camera' && this.powered(def.power) && distance(this.guards[index], at) < (def.hearing ?? 450);
  }
  private investigate(index: number, at: Point) {
    const guard = this.guards[index];
    guard.trace = undefined;
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
      if (!this.powered(def.power)) {
        guard.suspicion = 0; guard.trace = undefined; guard.seenActor = undefined;
        if (def.kind === 'tracker') { guard.investigate = null; guard.attention = 0; guard.searching = false; }
        return;
      }
      const sees = ({ id, at }: { id: string; at: Point }) => {
        if (def.kind === 'tracker' && id === 'player') return false;
        const gap = Math.atan2(at.y - guard.y, at.x - guard.x) - guard.angle;
        const angle = Math.abs(Math.atan2(Math.sin(gap), Math.cos(gap)));
        return distance(at, guard) < this.visionRange(index) && (angle < 0.56 || distance(at, guard) < 24) && this.canSee(guard, at);
      };
      const nearestVisible = () => actors.filter(sees).sort((a, b) => distance(a.at, guard) - distance(b.at, guard) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
      if (def.kind === 'tracker' && !guard.investigate) {
        const spotted = nearestVisible();
        if (spotted) {
          if (guard.trace?.actor !== spotted.id) this.signal(`${this.guardName(index)} 追踪 ${spotted.label} 的可见位置`);
          guard.trace = { at: { x: spotted.at.x, y: spotted.at.y }, actor: spotted.id, label: spotted.label, remaining: def.traceSeconds ?? 1.5 };
        } else if (guard.trace) {
          guard.trace.remaining = Math.max(0, guard.trace.remaining - DT);
          if (!guard.trace.remaining) { guard.trace = undefined; this.signal(`${this.guardName(index)} 丢失投影线索，返回原路线`); }
        }
      }
      if (guard.investigate && def.searchSeconds !== undefined && distance(guard, guard.investigate) < 8 && !guard.searching) {
        guard.searching = true; this.signal(`${this.guardName(index)} 号守卫抵达声源，搜索 ${def.searchSeconds} 秒`);
      }
      if (def.searchSeconds === undefined || guard.searching) guard.attention = Math.max(0, guard.attention - DT);
      if (guard.investigate && guard.attention === 0) { guard.investigate = null; guard.searching = false; this.signal(`${this.guardName(index)} 号守卫返回巡逻路线`); }
      const destination = guard.investigate ?? guard.trace?.at ?? def.route[guard.waypoint % def.route.length];
      let target = destination;
      // Keep existing recordings on legacy maps compatible with their original
      // routing rule. New arrival-search guards and glass need body clearance.
      const routeBlocked = (guard.investigate || guard.trace || def.searchSeconds !== undefined) &&
        !(guard.trace || def.searchSeconds !== undefined || this.level.glass?.length ? this.canWalk(guard, destination) : this.canSee(guard, destination));
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
      } else if (!guard.investigate && !guard.trace && def.kind !== 'sentry' && def.kind !== 'camera') {
        guard.waypoint = (guard.waypoint + 1) % def.route.length;
        if (def.route.length === 1 && def.facing !== undefined) guard.angle = def.facing;
      }
      const seen = def.kind === 'tracker' ? nearestVisible() : actors.find(sees);
      guard.seenActor = seen?.label;
      guard.suspicion = Math.max(0, Math.min(1, guard.suspicion + (seen ? DT * 1.65 : -DT * 0.8)));
    });
    this.alarm = Math.max(0, ...this.guards.map(g => g.suspicion));
    if (this.alarm >= 1) {
      const guard = this.guards.findIndex(g => g.suspicion >= 1);
      const actor = actors.find(a => a.label === this.guards[guard].seenActor)!;
      this.failure = { frame: this.frame, actor: actor.label, guard, point: { x: actor.at.x, y: actor.at.y } };
      this.status = 'caught';
      const observer = this.level.guards[guard].kind === 'tracker' ? '追踪器' : this.level.guards[guard].kind === 'camera' ? '摄像头' : '号守卫';
      this.lastMessage = `${this.seconds.toFixed(2)} 秒：${actor.label}被 ${this.guardName(guard)} ${observer}发现。调整这一段路线或出场时间。`;
      this.signal(this.lastMessage);
      this.events.push('caught');
    }
  }

  step(input: Input) {
    if (this.status !== 'running') return;
    if (this.remote) {
      this.remote.step({ x: 0, y: 0, lure: false });
      this.remote.drainEvents();
      if (this.remote.status === 'caught') {
        this.status = 'caught'; this.alarm = 1;
        this.lastMessage = `${this.level.continuity!.room} 的留守回声暴露了。可回到首段锚点重新布置。`;
        this.events.push('caught'); return;
      }
    }
    for (const field of this.level.suppressors ?? []) if (field.cycle && this.suppressionActive(field) !== this.suppressionActive(field, this.frame - 1)) this.signal(`${field.id} 抑制周期${this.suppressionActive(field) ? '开启' : '进入空档'}`);
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
    if (this.alarm >= 1) { if (!this.evidenceDeposited && this.editingIndex === null) this.tracePlayerDeposit('blocked', '本帧已触发警报，实体植入未执行'); return; }
    this.updateScanners();
    if (this.alarm >= 1) { if (!this.evidenceDeposited && this.editingIndex === null) this.tracePlayerDeposit('blocked', '本帧已触发扫描警报，实体植入未执行'); return; }
    this.updateDelivery();
    if (!this.spectator && this.level.objective !== 'reach' && this.level.objective !== 'deliver' && this.editingIndex === null && !this.hasLoot && this.canCollect && distance(this.player, this.level.loot) < 25) {
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
    if (!this.spectator && this.editingIndex === null && this.exitReady && this.objectiveComplete && distance(this.player, this.exitPoint) < 30) {
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
