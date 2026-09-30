import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Echo } from '../src/engine.ts';
import { level, point as p, room, g, e } from '../src/campaign-authoring.ts';
import { CHAPTER_FIVE } from '../src/chapter-five.ts';
import { playWitness } from '../src/witness.ts';
import { encodePlan, decodePlan } from '../src/plans.ts';

const idle = { x: 0, y: 0, lure: false };
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.step(idle); };
const actor = (x: number, y: number, colorIndex = 0): Echo => ({ colorIndex, frames: [{ x, y, angle: 0, lure: false }, { x, y, angle: 0, lure: false }] });
const trackerMap = () => level('tracker-unit', '', { spawn: p(400, 304), guards: [{ id: 'TR', kind: 'tracker', route: [p(528, 304), p(528, 432)], facing: Math.PI, speed: 80, range: 250, hearing: 700, searchSeconds: 1, traceSeconds: 1 }] });
const find = (id: string) => CHAPTER_FIVE.flatMap(m => m.stages).find(s => s.level.id === id)!;

test('suppression cycles are frame exact, wrap with phase, and combine with power', () => {
  const field = { id: 'N', x: 240, y: 144, w: 96, h: 96, cycle: { period: 4, active: [1, 2] as [number, number] }, power: { id: 'P', on: true } };
  const game = new Game(level('pulse-unit', '', { circuits: [{ id: 'P', x: 112, y: 432, initial: true }], suppressors: [field] }));
  for (const [frame, on] of [[59, false], [60, true], [119, true], [120, false], [300, true], [360, false]] as const) assert.equal(game.suppressionActive(field, frame), on);
  assert.equal(game.suppressionActive({ ...field, cycle: { ...field.cycle, phase: 0.5 } }, 30), true);
  assert.equal(game.suppressionActive({ ...field, cycle: { ...field.cycle, phase: -1 } }, 120), true);
  game.circuits.set('P', false); assert.equal(game.suppressionActive(field, 60), false);
});

test('overlapping fields must both release an echo, while a human can operate inside either', () => {
  const scenario = level('overlap-unit', '', { spawn: p(272, 176), plates: [{ id: 'A', x: 272, y: 176 }], circuits: [{ id: 'P', x: 272, y: 176, initial: true }], suppressors: [{ id: 'N1', x: 240, y: 144, w: 96, h: 96, power: { id: 'P', on: true } }, { id: 'N2', x: 256, y: 160, w: 96, h: 96, cycle: { period: 4, active: [0, 2] } }] });
  const human = new Game(scenario); human.start(); human.step({ ...idle, interact: true });
  assert.ok(human.activePlates.has('A')); assert.equal(human.circuits.get('P'), false);
  const ghost = new Game({ ...scenario, spawn: p(112, 432) }); ghost.restorePlan([actor(272, 176)]); ghost.start();
  assert.equal(ghost.suppressionFields(p(272, 176)).length, 2); ghost.circuits.set('P', false); run(ghost, 120);
  assert.equal(ghost.activePlates.has('A'), false); run(ghost, 1); assert.ok(ghost.activePlates.has('A'));
  assert.equal(ghost.echoes[0].frames.length, 2); assert.equal(ghost.echoAt(ghost.echoes[0]).x, 272);
});

test('a missed receive is not replayed on recovery; a later explicit request can receive', () => {
  const scenario = level('missed-unit', '', { terminals: [{ id: 'S', kind: 'source', x: 272, y: 176 }], suppressors: [{ id: 'N', x: 240, y: 144, w: 96, h: 96, cycle: { period: 4, active: [1, 2] } }] });
  const courier = actor(272, 176); courier.delay = 90;
  courier.frames = Array.from({ length: 62 }, () => ({ ...courier.frames[0] }));
  courier.frames[0].intent = { type: 'take', id: 'S' }; courier.frames[60].intent = { type: 'take', id: 'S' };
  const game = new Game(scenario); game.restorePlan([courier]); game.start(); run(game, 150);
  assert.equal(game.tokenOwner, 'terminal:S'); assert.equal(game.waitingReceivers.size, 0);
  run(game, 1); assert.equal(game.tokenOwner, 'echo:0');
});

test('trackers ignore humans but identify, chase and alarm on a visible echo', () => {
  const human = new Game(trackerMap()); human.start(); run(human, 100);
  assert.equal(human.status, 'running'); assert.equal(human.alarm, 0); assert.equal(human.guards[0].trace, undefined);
  const ghost = new Game(trackerMap()); ghost.restorePlan([actor(400, 304)]); ghost.start(); run(ghost, 10);
  assert.equal(ghost.guards[0].trace?.actor, 'echo:0'); assert.ok(ghost.guards[0].x < 528); assert.ok(ghost.alarm > 0);
  run(ghost, 40); assert.equal(ghost.status, 'caught'); assert.equal(ghost.failure?.actor, '回声 1');
});

test('tracking remembers only the last visible position, then expires and resumes its route', () => {
  const scenario = { ...trackerMap(), spawn: p(112, 432), suppressors: [{ id: 'N', x: 360, y: 80, w: 80, h: 80 }] };
  const courier = actor(400, 304); courier.frames[1] = { ...courier.frames[0], y: 112 };
  const game = new Game(scenario); game.restorePlan([courier]); game.start(); run(game, 1);
  assert.deepEqual(game.guards[0].trace?.at, p(400, 304)); run(game, 20);
  assert.deepEqual(game.guards[0].trace?.at, p(400, 304)); assert.equal(game.guards[0].seenActor, undefined);
  const left = game.guards[0].x; run(game, 60);
  assert.equal(game.guards[0].trace, undefined); assert.ok(game.guards[0].y > 304); assert.ok(game.guards[0].x > left - 60);
  assert.ok(game.signals.some(s => s.text.includes('丢失投影线索')));
});

test('tracker visual targets use stable identity for ties independently of echo order', () => {
  const one = actor(400, 280, 0), two = actor(400, 328, 1); const outcomes = [];
  for (const echoes of [[one, two], [two, one]]) {
    const game = new Game(trackerMap()); game.restorePlan(echoes); game.start(); run(game, 10);
    outcomes.push({ actor: game.guards[0].trace?.actor, x: game.guards[0].x, y: game.guards[0].y, alarm: game.alarm });
  }
  assert.deepEqual(outcomes[0], outcomes[1]); assert.equal(outcomes[0].actor, 'echo:0');
});

test('solid walls hide echoes from trackers, while glass only blocks the pursuit body', () => {
  const map = trackerMap(); map.guards[0].route = [p(560, 304)];
  const walls = new Game({ ...map, walls: room([[14, []]]) }); walls.restorePlan([actor(400, 304)]); walls.start(); run(walls, 30);
  assert.equal(walls.guards[0].trace, undefined); assert.equal(walls.alarm, 0);
  const glass = new Game({ ...map, glass: [{ id: 'G', x: 448, y: 32, w: 32, h: 512 }] }); glass.restorePlan([actor(400, 304)]); glass.start(); run(glass, 10);
  assert.equal(glass.guards[0].trace?.actor, 'echo:0'); assert.ok(glass.guards[0].x >= 490);
});

test('a heard noise overrides a visual trace and a power cut clears tracking and suspicion', () => {
  const game = new Game({ ...trackerMap(), spawn: p(112, 176), circuits: [{ id: 'T', x: 112, y: 176, initial: true }] });
  game.level.guards[0].power = { id: 'T', on: true }; game.restorePlan([actor(400, 304)]); game.start(); run(game, 3);
  assert.ok(game.guards[0].trace); game.step({ ...idle, lure: true });
  assert.equal(game.guards[0].trace, undefined); assert.deepEqual(game.guards[0].investigate, p(112, 176));
  run(game, 5); assert.equal(game.guards[0].trace, undefined);
  game.step({ ...idle, interact: true }); assert.equal(game.guards[0].trace, undefined); assert.equal(game.guards[0].suspicion, 0); assert.equal(game.guards[0].seenActor, undefined);
  assert.equal(game.guards[0].investigate, null); assert.equal(game.guards[0].attention, 0);
});

test('tracker preview and reloaded plans agree, and cannot modify the live world', () => {
  const stage = find('C5-4-a'); const win = playWitness(stage); const saved = encodePlan(stage.level.id, win.echoes);
  const game = new Game(stage.level); game.restorePlan(decodePlan(saved, stage.level.id)!);
  const preview = game.previewAt(320); const again = game.previewAt(320);
  assert.deepEqual(preview.guards, again.guards); assert.equal(game.frame, 0); assert.equal(game.status, 'ready');
  assert.equal(game.guards[0].trace, undefined); assert.equal(game.signals.length, 0);
  game.beginRerecord(0); game.start(); run(game, 360); assert.equal(game.guards[0].trace, undefined); assert.equal(game.alarm, 0);
});

test('all 18 C5 references and the alternate stay within 12 seconds and the three-echo limit', () => {
  const stages = CHAPTER_FIVE.flatMap(m => m.stages); assert.equal(CHAPTER_FIVE.length, 6); assert.equal(stages.length, 18);
  for (const stage of stages) for (const witness of [stage.witness, ...stage.alternatives ?? []]) {
    const game = playWitness({ ...stage, witness }); assert.equal(game.status, 'won'); assert.ok(game.seconds < 12); assert.ok(game.echoes.length <= 3);
  }
  assert.equal(playWitness(find('C5-3-c')).echoes.length, 3);
  assert.equal(playWitness(find('C5-6-b')).echoes.length, 3);
});

for (const id of ['C5-3-c', 'C5-6-b']) test(`${id}: the controller is recorded before B, with half-second timing margin and no rushed recording`, () => {
  const stage = find(id);
  const restoreWait = stage.witness.findIndex(a => 'wait' in a);
  for (const offset of [-30, -12, -6, -1, 0, 1, 6, 12, 30]) {
    const witness = structuredClone(stage.witness);
    const wait = witness[restoreWait]; assert.ok('wait' in wait); wait.wait += offset;
    // A full second to save the controller and the inner keeper must be safe.
    for (let i = witness.length - 1; i >= 0; i--) if ('record' in witness[i]) witness.splice(i, 0, { wait: 60 });
    const win = playWitness({ ...stage, witness });
    const requests = win.echoes.map(e => e.frames.flatMap(f => f.intent ? [f.intent] : []));
    assert.deepEqual(requests[1], [{ type: 'circuit', id: 'Q', on: false }, { type: 'circuit', id: 'Q', on: true }]);
    assert.deepEqual(requests[2], []);
    assert.equal(win.circuits.get('Q'), true); assert.equal(win.echoes.length, 3);
    if (id === 'C5-6-b') assert.equal(win.circuits.get('T'), false);
  }
});

test('retiming is necessary on the selected routes and a missing diversion exposes the keeper', () => {
  for (const id of ['C5-1-b', 'C5-4-a', 'C5-5-b']) {
    const stage = find(id); assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter(a => !('delay' in a)) }), id);
  }
  for (const id of ['C5-4-b', 'C5-6-d']) {
    const stage = find(id); assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter(a => !('press' in a) || a.press !== 'lure') }), /回声 2被 TR/);
  }
});

test('a courier carries the unique credential through suppression without dropping or cloning it', () => {
  const trace: { suppressed: boolean; owner: string | null }[] = [];
  const game = playWitness(find('C5-5-a'), g => {
    if (g.echoes.length) trace.push({ suppressed: g.suppressed(g.echoAt(g.echoes[0])), owner: g.tokenOwner });
  });
  assert.ok(trace.some(t => t.suppressed && t.owner === 'echo:0')); assert.ok(trace.some(t => !t.suppressed && t.owner === 'player'));
  const delivery = game.signals.find(s => s.text.includes('回声 1 将凭据交给 R'))!;
  const receipt = game.signals.find(s => s.text.includes('当前的你 收到 R'))!;
  assert.equal(delivery.frame, receipt.frame);
  assert.equal(game.tokenOwner, 'player'); assert.ok(game.authorized.has('L'));
});

test('suppression cancels a real waiting receiver; recovery alone cannot replace the second request', () => {
  const stage = find('C5-5-c'); const game = playWitness(stage);
  assert.ok(game.signals.some(s => s.text.includes('等候已取消：投影不可用')));
  assert.ok(game.signals.some(s => s.text.includes('回声 1 收到 R')));
  assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter((_, i) => i !== 4) }));
});

test('reconnecting suppression before stopping the shared camera is needed for the corridor route', () => {
  const stage = find('C5-3-a');
  assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter((_, i) => i !== 6) }), /CAM/);
});

test('pickup starts tracking and suppression; stopping T before restoring N protects the real keepers', () => {
  const stage = find('C5-6-c'); let armed = false; let safeRestore = false;
  const win = playWitness(stage, game => {
    if (game.hasLoot && game.circuits.get('N') && game.circuits.get('T')) { armed = true; assert.ok(game.echoes.every(e => game.suppressed(game.echoAt(e)))); }
    if (armed && game.hasLoot && !game.circuits.get('N')) { safeRestore = true; assert.equal(game.circuits.get('T'), false); }
  });
  assert.ok(armed && safeRestore && win.hasLoot);
  const start = stage.witness.findIndex(a => 'go' in a && a.go[0] === 816 && a.go[1] === 432);
  const tail = stage.witness.findIndex((a, i) => i > start + 1 && 'go' in a && a.go[0] === 848 && a.go[1] === 432);
  const wrongOrder = [...stage.witness.slice(0, start + 1), g(848, 432), g(848, 240), e(), g(848, 464), e(), ...stage.witness.slice(tail)];
  assert.throws(() => playWitness({ ...stage, witness: wrongOrder }), /TR/);
});

test('the finale has a powered sound diversion and a separate one-echo power isolation solution', () => {
  const stage = find('C5-6-d'); const diversion = playWitness(stage); const shutdown = playWitness({ ...stage, witness: stage.alternatives![0] });
  assert.equal(diversion.echoes.length, 2); assert.equal(shutdown.echoes.length, 1);
  assert.equal(diversion.circuits.get('T'), true); assert.equal(shutdown.circuits.get('T'), false);
  assert.ok(diversion.signals.some(s => s.text.includes('调查声响'))); assert.equal(shutdown.signals.some(s => s.text.includes('调查声响')), false);
  assert.ok(diversion.hasLoot && shutdown.hasLoot); assert.equal(diversion.circuits.get('N'), false); assert.equal(shutdown.circuits.get('N'), false);
});
