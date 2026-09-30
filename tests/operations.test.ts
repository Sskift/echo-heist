import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Echo, type Intent } from '../src/engine.ts';
import { level, point, room } from '../src/campaign-authoring.ts';
import { encodePlan } from '../src/plans.ts';

const idle = { x: 0, y: 0, lure: false };
const press = { ...idle, interact: true };
const run = (g: Game, n: number) => { for (let i = 0; i < n; i++) g.step(idle); };
const pose = (x: number, y: number, intent?: Intent) => ({ x, y, angle: 0, lure: false, ...(intent ? { intent } : {}) });
const echo = (colorIndex: number, x: number, y: number, intent: Intent): Echo => ({ colorIndex, frames: [pose(x, y, intent), pose(x, y)] });
const open = () => level('trace-test', '操作诊断', { spawn: point(112, 112), objective: 'reach', exit: point(848, 432), walls: room() });

for (const initiallySuppressed of [false, true]) test(`diagnostics distinguish pre-power circuit requests from post-power handoffs (suppression initially ${initiallySuppressed})`, () => {
  const g = new Game({ ...open(), circuits: [{ id: 'P', x: 112, y: 112, initial: initiallySuppressed }, { id: 'Q', x: 272, y: 144, initial: true }],
    terminals: [{ id: 'S', kind: 'source', x: 272, y: 112 }], suppressors: [{ id: 'FIELD', x: 240, y: 96, w: 64, h: 80, power: { id: 'P', on: true } }] });
  g.restorePlan([echo(0, 272, 144, { type: 'circuit', id: 'Q', on: false }), echo(1, 272, 112, { type: 'take', id: 'S' })]);
  g.start(); g.step(press);
  assert.equal(g.circuits.get('Q'), initiallySuppressed); assert.equal(g.tokenOwner, initiallySuppressed ? 'echo:1' : 'terminal:S');
  assert.equal(g.operationLog.find(op => op.actor === 'echo:0')?.result, initiallySuppressed ? 'blocked' : 'success');
  assert.equal(g.operationLog.find(op => op.actor === 'echo:1')?.result, initiallySuppressed ? 'success' : 'blocked');
  assert.ok(g.operationLog.every(op => op.frame === 0)); assert.equal(g.operationLog.length, 3);
});

test('conflicting requests identify every participant and keep the existing deterministic result', () => {
  const g = new Game({ ...open(), circuits: [{ id: 'P', x: 112, y: 112, initial: false }] });
  g.restorePlan([echo(2, 112, 112, { type: 'circuit', id: 'P', on: false })]); g.start(); g.step(press);
  assert.equal(g.circuits.get('P'), false); assert.equal(g.operationLog.length, 2);
  assert.deepEqual(new Set(g.operationLog.map(op => op.actor)), new Set(['player', 'echo:2']));
  assert.ok(g.operationLog.every(op => op.result === 'blocked' && op.reason.includes('相反请求')));
  assert.equal(g.operationLog.find(op => op.actor === 'echo:2')!.label, '回声 1');
});

test('a delayed last-frame request is reported once at its actual time, never again while holding the end pose', () => {
  const g = new Game({ ...open(), circuits: [{ id: 'P', x: 272, y: 112, initial: false }] });
  const e = echo(0, 272, 112, { type: 'circuit', id: 'P', on: true }); e.frames.reverse(); e.delay = 60;
  g.restorePlan([e]); g.start(); run(g, 61); assert.equal(g.operationLog.length, 0);
  g.step(idle); assert.equal(g.operationLog[0].frame, 61); run(g, 200); assert.equal(g.operationLog.length, 1);
});

test('waiting records registration and later receipt, with no per-frame flood or duplicated credential', () => {
  const g = new Game({ ...open(), terminals: [{ id: 'S', kind: 'source', x: 112, y: 112 }, { id: 'R', kind: 'relay', x: 272, y: 112, waitForDelivery: true }] });
  g.restorePlan([echo(0, 272, 112, { type: 'take', id: 'R' })]); g.start(); g.step(press); run(g, 120);
  assert.equal(g.operationLog.filter(op => op.actor === 'echo:0').length, 1);
  assert.equal(g.operationLog.find(op => op.actor === 'echo:0')!.result, 'waiting');
  g.player.x = 272; g.step(press);
  const records = g.operationLog.filter(op => op.actor === 'echo:0');
  assert.deepEqual(records.map(op => op.result), ['waiting', 'success']); assert.equal(records[1].frame, 121);
  assert.equal(g.tokenOwner, 'echo:0'); assert.equal(g.waitingReceivers.size, 0);
});

for (const suppress of [false, true]) test(`a retained receiver reports ${suppress ? 'suppression' : 'leaving range'} at cancellation rather than pretending the original E failed`, () => {
  const g = new Game({ ...open(), terminals: [{ id: 'R', kind: 'relay', x: 272, y: 112, waitForDelivery: true }],
    circuits: [{ id: 'P', x: 112, y: 112, initial: false }], suppressors: [{ id: 'F', x: 240, y: 80, w: 64, h: 64, power: { id: 'P', on: true } }] });
  const receiver = echo(0, 272, 112, { type: 'take', id: 'R' }); if (!suppress) receiver.frames[1] = pose(336, 112);
  g.restorePlan([receiver]); g.start(); g.step(idle); g.step(suppress ? press : idle); run(g, 100);
  const records = g.operationLog.filter(op => op.actor === 'echo:0');
  assert.deepEqual(records.map(op => op.result), ['waiting', 'cancelled']); assert.equal(records[1].frame, 1);
  assert.match(records[1].reason, suppress ? /抑制/ : /离开/); assert.equal(g.waitingReceivers.size, 0);
});

test('failed authorization reports the unmet plate; an independent later request succeeds without changing the original record', () => {
  const g = new Game({ ...open(), terminals: [{ id: 'L', kind: 'lock', x: 112, y: 112, authorization: 'KEY', plate: 'A' }], plates: [{ id: 'A', x: 272, y: 112 }] });
  g.start(); g.tokenOwner = 'player'; g.step(press);
  const failed = structuredClone(g.operationLog[0]); assert.equal(failed.result, 'blocked'); assert.match(failed.reason, /A/);
  g.echoes.push({ colorIndex: 0, frames: [pose(272, 112), pose(272, 112)] }); g.step(idle); g.step(press);
  assert.ok(g.authorized.has('KEY')); assert.equal(g.operationLog.at(-1)!.result, 'success');
  assert.deepEqual(g.operationLog[0], failed); g.player.x = 304; assert.deepEqual(g.operationLog[0].point, { x: 112, y: 112 });
});

test('physical delivery distinguishes unmet conditions, real success, repeated submission and projection-only requests', () => {
  const g = new Game({ ...open(), objective: 'deliver', delivery: { id: 'D', label: '证据', x: 112, y: 112, authorization: 'KEY' } });
  g.start(); g.step(press); assert.equal(g.evidenceDeposited, false); assert.equal(g.operationLog[0].result, 'blocked');
  g.authorized.add('KEY'); g.step(idle); g.step(press); assert.equal(g.evidenceDeposited, true); assert.equal(g.operationLog.at(-1)!.result, 'success');
  g.step(idle); g.step(press); assert.equal(g.operationLog.at(-1)!.result, 'ignored');
  g.restorePlan([echo(0, 112, 112, { type: 'deposit', id: 'D' })]);
  const preview = g.previewAt(2); assert.equal(preview.evidenceDeposited, false); assert.equal(preview.operationLog[0].result, 'ignored');
  assert.equal(g.operationLog.length, 0);
});

test('a deposit blocked by alarm on the same frame never receives a success marker', () => {
  const g = new Game({ ...open(), spawn: point(272, 112), objective: 'deliver', delivery: { id: 'D', label: '证据', x: 272, y: 112 },
    guards: [{ id: 'G1', kind: 'sentry', route: [point(112, 112)], facing: 0, speed: 0, range: 240 }] });
  g.start(); run(g, 36); assert.equal(g.status, 'running'); g.step(press);
  assert.equal(g.status, 'caught'); assert.equal(g.evidenceDeposited, false);
  assert.equal(g.operationLog.length, 1); assert.equal(g.operationLog[0].result, 'blocked'); assert.match(g.operationLog[0].reason, /警报/);
});

test('out-of-range and missing devices have actionable failures instead of silent omissions', () => {
  const g = new Game({ ...open(), terminals: [{ id: 'S', kind: 'source', x: 272, y: 112 }] });
  g.restorePlan([echo(0, 112, 112, { type: 'take', id: 'S' }), echo(1, 112, 112, { type: 'circuit', id: 'OLD', on: true })]);
  g.start(); g.step(idle); assert.equal(g.tokenOwner, 'terminal:S'); assert.equal(g.operationLog.length, 2);
  assert.ok(g.operationLog.every(op => op.result === 'blocked')); assert.ok(g.operationLog.some(op => op.reason.includes('范围'))); assert.ok(g.operationLog.some(op => op.reason.includes('不在')));
});

test('preview diagnostics are isolated, deterministic, reset on retry, and never become saved operation outcomes', () => {
  const g = new Game({ ...open(), circuits: [{ id: 'P', x: 272, y: 112, initial: false }] });
  g.restorePlan([echo(0, 272, 112, { type: 'circuit', id: 'P', on: true })]); g.start(); g.step(idle);
  const before = structuredClone(g.operationLog), plan = encodePlan(g.level.id, g.echoes);
  const first = g.previewAt(60), second = g.previewAt(60); assert.deepEqual(first.operationLog, second.operationLog); assert.deepEqual(g.operationLog, before);
  first.operationLog[0].intent.id = 'CHANGED'; assert.equal(g.operationLog[0].intent.id, 'P'); assert.deepEqual(encodePlan(g.level.id, g.echoes), plan);
  g.restart(); assert.deepEqual(g.operationLog, []); assert.equal(g.circuits.get('P'), false);
});
