import type { Game } from './engine.ts';
import { doorPlates, ECHO_COLORS, type Point } from './levels.ts';

const near = (a: Point, b: Point, radius = 56) => Math.hypot(a.x - b.x, a.y - b.y) < radius;

/** The two introductory rooms teach one action at a time. No saved progress or
 * simulated actions: retry, rewind and preview derive the cue from real state. */
export function firstLesson(game: Game): { at?: Point; record: boolean } {
  if (!['C0-1-a', 'C0-2-a', '01'].includes(game.level.id) || game.spectator || game.editingIndex !== null || !['ready', 'running', 'paused'].includes(game.status)) return { record: false };
  if (!game.echoes.length) {
    const plate = game.level.plates[0];
    const record = !!plate && near(game.player, plate, 23) && game.activePlates.has(plate.id) && game.status === 'running';
    return { at: record ? undefined : plate, record };
  }
  return { at: game.objectiveComplete && game.exitReady ? game.exitPoint : game.level.loot, record: false };
}

/** Observation-only, game-frame effects. Freezing the game freezes every cue;
 * rebuilding a preview or starting a new round cannot leak an old transition. */
export class SceneFeedback {
  private game?: Game;
  private log?: Game['operationLog'];
  private frame = -1;
  private states = new Map<string, { on: boolean; frame: number }>();
  sample(game: Game) {
    if (this.game !== game || this.log !== game.operationLog || game.frame < this.frame) this.states.clear();
    this.game = game; this.log = game.operationLog; this.frame = game.frame;
    const observe = (key: string, on: boolean) => {
      const previous = this.states.get(key);
      this.states.set(key, { on, frame: !previous ? -1000 : previous.on !== on ? game.frame : previous.frame });
    };
    for (const p of game.level.plates) observe(`plate:${p.id}`, game.activePlates.has(p.id));
    for (const d of game.level.doors) observe(`door:${d.id}`, game.openDoors.has(d.id));
    for (const c of game.level.circuits ?? []) observe(`circuit:${c.id}`, !!game.circuits.get(c.id));
  }
  age(key: string) { return this.frame - (this.states.get(key)?.frame ?? -1000); }
  ground(c: CanvasRenderingContext2D, game: Game, annotations: boolean, reduced: boolean) {
    const ring = (at: Point, radius: number, color: string, width = 2, dash: number[] = []) => {
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash);
      c.beginPath(); c.arc(at.x, at.y, radius, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    };
    const link = (from: Point, to: Point, on: boolean) => {
      const middle = { x: from.x, y: to.y }, points = [from, middle, to];
      c.strokeStyle = on ? '#d7edb0b0' : '#486b7060'; c.lineWidth = on ? 2 : 1.3; c.setLineDash(on ? [] : [3, 6]);
      c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.setLineDash([]);
      if (on && !reduced) {
        const a = Math.abs(to.y - from.y), b = Math.abs(to.x - from.x), distance = ((game.frame % 72) / 72) * (a + b);
        const p = distance <= a ? { x: from.x, y: from.y + Math.sign(to.y - from.y) * distance } : { x: from.x + Math.sign(to.x - from.x) * (distance - a), y: to.y };
        c.fillStyle = '#f6ffd7'; c.beginPath(); c.arc(p.x, p.y, 3, 0, Math.PI * 2); c.fill();
      }
    };
    const lesson = firstLesson(game);
    for (const plate of game.level.plates) {
      const active = game.activePlates.has(plate.id), age = this.age(`plate:${plate.id}`);
      if (annotations || near(game.player, plate) || active || age < 48 || lesson.at === plate) {
        for (const d of game.level.doors.filter(d => doorPlates(d).includes(plate.id))) link(plate, { x: d.x + d.w / 2, y: d.y + d.h / 2 }, active);
        for (const t of game.level.terminals?.filter(t => t.plate === plate.id) ?? []) link(plate, t, active);
      }
      if (age < 36) ring(plate, reduced ? 24 : 20 + age / 3, active ? '#e1f2ba' : '#8c9f9c', 1.7);
    }
    for (const circuit of game.level.circuits ?? []) {
      const on = !!game.circuits.get(circuit.id);
      if (!annotations && !near(game.player, circuit) && this.age(`circuit:${circuit.id}`) >= 48) continue;
      const source = circuit.feed && (circuit.feed.remote ? game.carried?.level : game.level)?.plates.find(p => p.id === circuit.feed!.plate);
      if (source) link(source, circuit, on);
      for (const d of game.level.doors.filter(d => d.power?.id === circuit.id)) link(circuit, {x:d.x+d.w/2,y:d.y+d.h/2}, game.powered(d.power));
      for (const t of game.level.terminals?.filter(t => t.power?.id === circuit.id) ?? []) link(circuit, t, game.powered(t.power));
    }
    // A nearby timed device shows its actual response interval on one 12-second
    // dial. The moving hand uses simulation time and also freezes in Planning.
    const timed = [
      ...game.level.plates.filter(p => p.window).map(p => ({at:p, windows:[p.window!]})),
      ...(game.level.terminals ?? []).filter(t => t.window).map(t => ({at:t, windows:[t.window!]})),
      ...game.level.doors.filter(d => d.window || d.windows).map(d => ({at:{x:d.x+d.w/2,y:d.y+d.h/2}, windows:d.windows ?? [d.window!]})),
    ];
    for (const {at, windows} of timed) {
      if (!annotations && !near(game.player, at, 72)) continue;
      ring(at, 26, '#35585880', 1);
      c.strokeStyle = '#eddbaf'; c.lineWidth = 3;
      for (const [start, end] of windows) { c.beginPath(); c.arc(at.x, at.y, 26, start / 12 * Math.PI * 2 - Math.PI / 2, end / 12 * Math.PI * 2 - Math.PI / 2); c.stroke(); }
      const angle = game.seconds / 12 * Math.PI * 2 - Math.PI / 2;
      c.strokeStyle = '#faf2d4'; c.lineWidth = 2; c.beginPath(); c.moveTo(at.x + Math.cos(angle)*21, at.y + Math.sin(angle)*21); c.lineTo(at.x + Math.cos(angle)*30, at.y + Math.sin(angle)*30); c.stroke();
    }
    const actorAt = (id: string) => id === 'player' ? game.player : game.activeEchoes.find(e => `echo:${e.echo.colorIndex}` === id)?.echo;
    for (const source of [game, ...(game.remote ? [game.remote] : [])]) for (const { echo } of source.activeEchoes) {
      const at = source.echoAt(echo), color = ECHO_COLORS[echo.colorIndex];
      if (source.suppressed(at)) {
        c.strokeStyle = '#b899ed'; c.lineWidth = 2;
        for (const sign of [-1, 1]) { c.beginPath(); c.moveTo(at.x - 9, at.y - 9 * sign); c.lineTo(at.x + 9, at.y + 9 * sign); c.stroke(); }
      } else if (source.frame - (echo.delay ?? 0) >= echo.frames.length - 1) {
        ring(at, 14, color, 2.3); ring(at, 19, `${color}99`, 1.5, [5, 5]);
      }
    }
    for (const [actor, terminal] of game.waitingReceivers) {
      const entity = actorAt(actor), at = entity && ('frames' in entity ? game.echoAt(entity) : entity);
      const target = game.level.terminals?.find(t => t.id === terminal);
      if (!at || !target) continue;
      ring(at, 23, '#e7c68d', 2, [3, 5]); ring(target, 18, '#e7c68d', 2, [3, 5]);
    }
    // Most recent outcome per device; the engine log, not a key press, decides
    // success. Waiting and rejected requests never animate a moving credential.
    const seen = new Set<string>();
    for (const operation of [...game.operationLog].reverse()) {
      const age = game.frame - operation.frame;
      if (age >= 48) break;
      if (age < 0 || seen.has(operation.intent.id)) continue;
      seen.add(operation.intent.id);
      const target = [...game.level.terminals ?? [], ...game.level.circuits ?? [], ...(game.level.delivery ? [game.level.delivery] : [])].find(t => t.id === operation.intent.id);
      if (!target) continue;
      c.save(); c.globalAlpha = 1 - age / 48;
      const success = operation.result === 'success', waiting = operation.result === 'waiting';
      ring(target, reduced ? 25 : 18 + age * .4, success ? '#edffc3' : waiting ? '#e7c68d' : '#ef967e', 2.3);
      if (success && ['take', 'give'].includes(operation.intent.type)) {
        const from = operation.intent.type === 'take' ? target : operation.point, to = operation.intent.type === 'take' ? operation.point : target;
        c.strokeStyle = '#ffe2a6'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(to.x, to.y); c.stroke();
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        c.beginPath(); c.moveTo(to.x - Math.cos(angle - .6) * 9, to.y - Math.sin(angle - .6) * 9); c.lineTo(to.x, to.y); c.lineTo(to.x - Math.cos(angle + .6) * 9, to.y - Math.sin(angle + .6) * 9); c.stroke();
      } else if (!success && !waiting) {
        c.strokeStyle = '#ef967e'; c.lineWidth = 2.5;
        for (const sign of [-1, 1]) { c.beginPath(); c.moveTo(target.x - 7, target.y + 20 - 7 * sign); c.lineTo(target.x + 7, target.y + 20 + 7 * sign); c.stroke(); }
      }
      c.restore();
    }
    if (lesson.at) ring(lesson.at, reduced ? 30 : 29 + Math.sin(game.frame / 15) * 3, '#f5e7bd90', 2);
  }
}
