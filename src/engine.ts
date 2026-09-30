import { FPS, LOOP_SECONDS, MAX_ECHOES, MAX_FRAMES, TILE, type Level, type Point } from './levels.ts';

export type Input = { x: number; y: number; lure: boolean };
export type Frame = Point & { angle: number; lure: boolean };
export type Echo = { frames: Frame[]; colorIndex: number };
export type Status = 'ready' | 'running' | 'paused' | 'caught' | 'won';
export type Guard = Point & { angle: number; waypoint: number; investigate: Point | null; attention: number; suspicion: number };
export type GameEvent = 'start' | 'rewind' | 'door' | 'loot' | 'lure' | 'caught' | 'won' | 'tick' | 'full';

const SPEED = 224;
const RADIUS = 10;
const DT = 1 / FPS;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const cloneFrame = (frame: Frame): Frame => ({ ...frame });

export class Game {
  level: Level;
  player: Frame;
  echoes: Echo[] = [];
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

  constructor(level: Level) {
    this.level = level;
    this.player = { ...level.spawn, angle: -Math.PI / 2, lure: false };
    this.resetWorld('ready');
  }

  get seconds(): number { return this.frame / FPS; }
  get remaining(): number { return Math.max(0, LOOP_SECONDS - this.seconds); }

  resetWorld(status: Status = 'running') {
    this.player = { ...this.level.spawn, angle: -Math.PI / 2, lure: false };
    this.frame = 0;
    this.hasLoot = false;
    this.alarm = 0;
    this.lureCooldown = 0;
    this.recording = [];
    this.noise = [];
    this.openDoors.clear();
    this.activePlates.clear();
    this.guards = this.level.guards.map(g => ({
      ...g.route[0], angle: Math.atan2(g.route[1].y - g.route[0].y, g.route[1].x - g.route[0].x),
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

  clear() { this.echoes = []; this.attempts = 1; this.resetWorld('ready'); this.events.push('rewind'); }

  removeEcho(index: number) {
    if (index < 0 || index >= this.echoes.length) return;
    this.echoes.splice(index, 1);
    this.attempts++;
    this.resetWorld('ready');
    this.events.push('rewind');
  }

  rewind(): boolean {
    if (this.status !== 'running' || this.recording.length < 2) return false;
    if (this.echoes.length >= MAX_ECHOES) {
      this.lastMessage = '回声槽已满。删除一条旧回声，或按 Enter 重试当前路线。';
      this.events.push('full');
      return false;
    }
    const used = new Set(this.echoes.map(e => e.colorIndex));
    const colorIndex = [0, 1, 2].find(i => !used.has(i)) ?? 0;
    this.echoes.push({ frames: this.recording.map(cloneFrame), colorIndex });
    this.attempts++;
    this.resetWorld();
    this.events.push('rewind');
    return true;
  }

  echoAt(echo: Echo, frame = this.frame): Frame {
    return echo.frames[Math.min(frame, echo.frames.length - 1)];
  }

  blocked(x: number, y: number, radius = RADIUS): boolean {
    const touches = (r: { x: number; y: number; w: number; h: number }) => {
      const nearX = Math.max(r.x, Math.min(x, r.x + r.w));
      const nearY = Math.max(r.y, Math.min(y, r.y + r.h));
      return Math.hypot(x - nearX, y - nearY) < radius;
    };
    return this.level.walls.some(w => touches({ ...w, w: TILE, h: TILE })) ||
      this.level.doors.some(d => !this.openDoors.has(d.id) && touches(d));
  }

  private move(actor: Point, dx: number, dy: number) {
    if (!this.blocked(actor.x + dx, actor.y)) actor.x += dx;
    if (!this.blocked(actor.x, actor.y + dy)) actor.y += dy;
  }

  updatePlates() {
    const actors = [this.player, ...this.echoes.map(e => this.echoAt(e))];
    const previous = this.openDoors.size;
    this.activePlates = new Set(this.level.plates.filter(p => actors.some(a => distance(a, p) < 23)).map(p => p.id));
    this.openDoors = new Set(this.level.doors.filter(d => this.activePlates.has(d.plate)).map(d => d.id));
    if (this.openDoors.size > previous) this.events.push('door');
  }

  canSee(from: Point, to: Point): boolean {
    const steps = Math.ceil(distance(from, to) / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.blocked(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 1)) return false;
    }
    return true;
  }

  private makeNoise(at: Point) {
    this.noise.push({ ...at, life: 1 });
    this.events.push('lure');
    for (const guard of this.guards) if (distance(guard, at) < 450) {
      guard.investigate = { ...at };
      guard.attention = 2.5;
    }
  }

  private updateGuards() {
    const actors = [this.player, ...this.echoes.map(e => this.echoAt(e))];
    this.guards.forEach((guard, index) => {
      const def = this.level.guards[index];
      guard.attention = Math.max(0, guard.attention - DT);
      if (guard.attention === 0) guard.investigate = null;
      const target = guard.investigate ?? def.route[guard.waypoint];
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        guard.angle = Math.atan2(dy, dx);
        this.move(guard, dx / dist * def.speed * DT, dy / dist * def.speed * DT);
      } else if (!guard.investigate) guard.waypoint = (guard.waypoint + 1) % def.route.length;
      const seen = actors.some(a => {
        const gap = Math.atan2(a.y - guard.y, a.x - guard.x) - guard.angle;
        const angle = Math.abs(Math.atan2(Math.sin(gap), Math.cos(gap)));
        return distance(a, guard) < def.range && (angle < 0.56 || distance(a, guard) < 24) && this.canSee(guard, a);
      });
      guard.suspicion = Math.max(0, Math.min(1, guard.suspicion + (seen ? DT * 1.65 : -DT * 0.8)));
    });
    this.alarm = Math.max(0, ...this.guards.map(g => g.suspicion));
    if (this.alarm >= 1) {
      this.status = 'caught';
      this.lastMessage = '有一个你暴露了。重试这一轮，或重录回声的路线。';
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
    this.player.lure = input.lure && this.lureCooldown === 0;
    if (this.player.lure) { this.lureCooldown = 1.5; this.makeNoise(this.player); }
    for (const echo of this.echoes) {
      if (this.frame < echo.frames.length && echo.frames[this.frame].lure) this.makeNoise(echo.frames[this.frame]);
    }
    this.recording.push(cloneFrame(this.player));
    this.updatePlates();
    this.updateGuards();
    if (this.alarm >= 1) return;
    if (!this.hasLoot && distance(this.player, this.level.loot) < 25) {
      this.hasLoot = true;
      this.events.push('loot');
    }
    this.frame++;
    this.noise = this.noise.map(n => ({ ...n, life: n.life - DT * 1.3 })).filter(n => n.life > 0);
    if (this.hasLoot && distance(this.player, this.level.spawn) < 30) {
      this.status = 'won';
      this.events.push('won');
      return;
    }
    if (this.frame % FPS === 0 && this.remaining <= 3) this.events.push('tick');
    if (this.frame >= MAX_FRAMES) {
      if (this.echoes.length < MAX_ECHOES) this.rewind();
      else {
        this.status = 'caught';
        this.lastMessage = '12 秒已用完。回声槽已满，按 Enter 重试，或删除一条回声重新安排。';
        this.events.push('caught');
      }
    }
  }

  drainEvents(): GameEvent[] { return this.events.splice(0); }
}
