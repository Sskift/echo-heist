import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.ts';
import { level, point as p } from '../src/campaign-authoring.ts';
import { CHAPTER_SEVEN } from '../src/chapter-seven.ts';
import { playWitness } from '../src/witness.ts';
import { decodePlan, encodePlan } from '../src/plans.ts';
import { Campaign } from '../src/campaign.ts';
import { MISSIONS } from '../src/campaign-content.ts';

const idle = { x: 0, y: 0, lure: false }, press = { ...idle, interact: true };
const run = (g: Game, frames: number) => { for (let i = 0; i < frames; i++) g.step(idle); };
const map = () => level('delivery-unit', '', { objective: 'deliver', spawn: p(400, 304), loot: p(400, 304), exit: p(816, 432), delivery: { id: 'D', ...p(400, 304), label: '证据' } });
const find = (id: string) => CHAPTER_SEVEN.flatMap(m => m.stages).find(s => s.level.id === id)!;

test('delivery requires a live E at its target; walking over the old collectible cannot complete it', () => {
  const g = new Game(map()); g.start(); run(g, 10);
  assert.equal(g.hasLoot, false); assert.equal(g.evidenceDeposited, false); assert.equal(g.objectiveComplete, false);
  g.player.x += 30; g.step(press); assert.equal(g.evidenceDeposited, false);
  g.player.x -= 1; g.step(idle); g.step(press);
  assert.equal(g.evidenceDeposited, true); assert.equal(g.objectiveComplete, true); assert.equal(g.hasLoot, false);
  assert.deepEqual(g.drainEvents().filter(e => e === 'deposit'), ['deposit']);
});

test('delivery checks power, presence, authorization and a half-open window when E is pressed', () => {
  const m = map(); m.delivery = { ...m.delivery!, power: [{ id: 'P', on: true }], plate: 'A', authorization: 'SIGN', window: [1, 2] };
  m.circuits = [{ id: 'P', ...p(600, 304), initial: false }]; m.plates = [{ id: 'A', ...p(400, 304) }];
  const g = new Game(m); g.start(); g.step(press);
  assert.match(g.signals.at(-1)!.text, /P.*SIGN.*1–2/);
  g.circuits.set('P', true); g.authorized.add('SIGN'); run(g, 59); g.step(press);
  assert.equal(g.evidenceDeposited, true);
  const late = new Game(m); late.start(); late.circuits.set('P', true); late.authorized.add('SIGN'); run(late, 120); late.step(press);
  assert.equal(late.evidenceDeposited, false);
  const absent = new Game({ ...m, plates: [{ id: 'A', ...p(600, 432) }] }); absent.start(); absent.circuits.set('P', true); absent.authorized.add('SIGN'); run(absent, 60); absent.step(press);
  assert.equal(absent.evidenceDeposited, false); assert.match(absent.deliveryStatus(), /守住 A/);
});

test('holding a failed E never submits automatically when its window opens', () => {
  const m = map(); m.delivery!.window = [1, 2]; const g = new Game(m); g.start();
  for (let i = 0; i < 70; i++) g.step(press);
  assert.equal(g.evidenceDeposited, false); assert.equal(g.signals.filter(s => s.text.includes('植入未满足')).length, 1);
  g.step(idle); g.step(press); assert.equal(g.evidenceDeposited, true);
});

test('a teammate can authorize in the deposit tick; deposit effects override earlier circuit requests exactly once', () => {
  const m = map(); m.circuits = [{ id: 'P', ...p(600, 304), initial: false }];
  m.terminals = [{ id: 'L', ...p(600, 176), kind: 'lock', authorization: 'SIGN' }];
  m.delivery = { ...m.delivery!, power: [{ id: 'P', on: true }], authorization: 'SIGN', onDeposit: { power: [{ id: 'P', on: false }], message: '提交后复位' } };
  const g = new Game(m); g.restorePlan([
    { colorIndex: 0, frames: [0, 1].map(() => ({ ...p(600, 304), angle: 0, lure: false, intent: { type: 'circuit', id: 'P', on: true } })) },
    { colorIndex: 1, frames: [0, 1].map(() => ({ ...p(600, 176), angle: 0, lure: false, intent: { type: 'authorize', id: 'L' } })) },
  ]); g.tokenOwner = 'echo:1'; g.start(); g.step(press);
  assert.equal(g.evidenceDeposited, true); assert.equal(g.circuits.get('P'), false);
  g.step(idle); assert.equal(g.circuits.get('P'), true); g.step(press); assert.equal(g.circuits.get('P'), true);
  assert.equal(g.signals.filter(s => s.text === '提交后复位').length, 1);
});

test('recorded deposits survive plan encoding but echoes, end holds, previews and rerecords cannot submit physical evidence', () => {
  const g = new Game(map()); g.start(); g.step(press); g.step(idle); assert.ok(g.rewind());
  const decoded = decodePlan(encodePlan(g.level.id, g.echoes), g.level.id)!;
  assert.equal(decoded[0].frames[0].intent?.type, 'deposit');
  g.restorePlan(decoded); g.start(); run(g, 10); assert.equal(g.evidenceDeposited, false);
  const preview = g.previewAt(60); assert.equal(preview.evidenceDeposited, false); assert.equal(preview.objectiveComplete, false);
  assert.ok(g.beginRerecord(0)); g.start(); g.step(press); assert.equal(g.evidenceDeposited, false);
  g.cancelRerecord(); g.start(); g.step(press); assert.equal(g.evidenceDeposited, true);
  g.restart(); assert.equal(g.evidenceDeposited, false); assert.equal(g.evidenceReaders.size, 0); assert.equal(g.evidenceReceipts.size, 0);
});

test('missing delivery definition fails closed and an alarm in the deposit tick prevents submission', () => {
  const broken = new Game({ ...map(), delivery: undefined }); broken.start(); broken.step(press); assert.equal(broken.objectiveComplete, false);
  const m = map(); m.scanners = [{ id: 'X', x: 368, y: 272, w: 64, h: 64, period: 12, active: [0, 12] }];
  const g = new Game(m); g.start(); run(g, 17); g.step(press);
  assert.equal(g.status, 'caught'); assert.equal(g.evidenceDeposited, false);
});

test('walking past evidence does not count as discovery; investigation and a powered return to the receipt desk are both necessary', () => {
  const m = map(); m.delivery!.receivers = [{ guard: 'G', at: p(656, 304), label: '登记台' }];
  m.circuits = [{ id: 'P', ...p(112, 432), initial: true }];
  m.guards = [{ id: 'G', route: [p(656, 304), p(400, 304)], range: 1, speed: 128, searchSeconds: 0.5, power: { id: 'P', on: true } }];
  const g = new Game(m); g.start(); g.step(press); run(g, 130);
  assert.equal(g.evidenceReaders.size, 0); assert.equal(g.evidenceReceipts.size, 0);
  // A nearby sound starts a real search; the guard has not yet returned to its desk.
  g.step({ ...idle, lure: true }); run(g, 20); assert.ok(g.evidenceReaders.has('G')); assert.equal(g.objectiveComplete, false);
  g.circuits.set('P', false); run(g, 60); assert.equal(g.evidenceReceipts.size, 0);
  g.circuits.set('P', true); run(g, 220); assert.ok(g.evidenceReceipts.has('G')); assert.equal(g.objectiveComplete, true);
  g.restart(); assert.equal(g.evidenceReaders.size, 0); assert.equal(g.evidenceReceipts.size, 0);
});

test('the first security receipt is discovered after deposit and registered only after a real outward-and-return investigation', () => {
  let deposit = -1, discovery = -1, receipt = -1;
  const g = playWitness(find('C7-3-a'), g => {
    if (g.evidenceDeposited && deposit < 0) deposit = g.frame;
    if (g.evidenceReaders.has('G1') && discovery < 0) { discovery = g.frame; assert.ok(g.guards[0].searching); }
    if (g.evidenceReceipts.has('G1') && receipt < 0) { receipt = g.frame; assert.equal(g.guards[0].investigate, null); assert.ok(Math.hypot(g.guards[0].x - 656, g.guards[0].y - 304) < 20); }
  });
  assert.ok(discovery > deposit && receipt > discovery); assert.equal(g.status, 'won'); assert.equal(g.echoes.length, 0);
});

test('staggered sounds reach different shifts; switching after the first receipt preserves it but cannot substitute the second', () => {
  let oneOnly = false;
  const g = playWitness(find('C7-3-b'), g => { if (g.evidenceReceipts.size === 1) { oneOnly = true; assert.equal(g.objectiveComplete, false); assert.equal(g.status, 'running'); } });
  const assigned = g.signals.filter(s => /号守卫调查声响/.test(s.text));
  assert.equal(assigned.length, 2); assert.equal(assigned[1].frame - assigned[0].frame, 270); assert.notEqual(assigned[0].text, assigned[1].text);
  assert.ok(g.signals.find(s => /G1.*已在/.test(s.text))!.frame < g.signals.find(s => /ROSTER.*监察/.test(s.text))!.frame);
  assert.deepEqual([...g.evidenceReceipts].sort(), ['G1', 'G2']); assert.ok(oneOnly);
  const s = find('C7-3-b'), shift = s.witness.length - 2;
  assert.throws(() => playWitness({ ...s, witness: s.witness.filter((_, i) => i !== shift) }), /did not finish/);
  // This is a planning window, not a frame-perfect simultaneous sound puzzle.
  for (const delay of [255, 285]) assert.equal(playWitness({ ...s, witness: s.witness.map(a => 'delay' in a ? { ...a, delay } : a) }).evidenceReceipts.size, 2);
});

test('omitting the sound cannot count patrol presence as evidence delivery', () => {
  for (const id of ['C7-3-a', 'C7-3-b', 'C7-3-c']) {
    const s = find(id);
    assert.throws(() => playWitness({ ...s, witness: s.witness.filter(a => !('press' in a && a.press === 'lure')) }), /did not finish/);
  }
});

test('the witness return gate must be restored after deposit, and a blueprint alone cannot submit a checkpoint', () => {
  const s = find('C7-3-c'); let closed = false, reopened = false;
  const win = playWitness(s, g => {
    if (g.evidenceDeposited && g.circuits.get('Q')) { closed = true; assert.equal(g.openDoors.has('RETURN'), false); }
    if (closed && !g.circuits.get('Q') && g.openDoors.has('RETURN')) reopened = true;
  });
  assert.ok(closed && reopened);
  const lastE = s.witness.reduce((last, a, i) => 'press' in a && a.press === 'interact' ? i : last, -1);
  assert.throws(() => playWitness({ ...s, witness: s.witness.filter((_, i) => i !== lastE) }), /did not finish/);
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'C7-3'));
  const c = new Campaign({ version: 1, selected: 'C7-3', runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
  assert.equal(c.commit(win), false); // Wrong action zone, despite a valid real win.
  for (let i = 0; i < 3; i++) { const real = playWitness(c.stage); assert.equal(c.commit(real.previewAt(600)), false); assert.ok(c.commit(real)); }
  const restored = new Campaign(c.export()); assert.equal(restored.cleared(), 3); assert.ok(restored.data.completed.includes('C7-3'));
});

test('final entry requires suppression recovery and its signing window; deposit recovery cannot happen early', () => {
  const a = find('C7-1-a'), b = find('C7-1-b'), deposit = find('C7-2-b');
  assert.throws(() => playWitness({ ...a, witness: a.witness.filter(x => !('press' in x && x.press === 'interact')) }), /blocked|caught/);
  assert.throws(() => playWitness({ ...b, witness: b.witness.filter(x => !('wait' in x && x.wait === 120)) }), /blocked/);
  assert.throws(() => playWitness({ ...deposit, witness: deposit.witness.filter(x => !('wait' in x && x.wait === 240)) }), /blocked/);
});
