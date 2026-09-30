import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Echo, type Intent } from '../src/engine.ts';
import { level, point as p } from '../src/campaign-authoring.ts';
import { CHAPTER_FOUR } from '../src/chapter-four.ts';
import { playWitness } from '../src/witness.ts';
import { encodePlan, decodePlan } from '../src/plans.ts';
import type { Terminal } from '../src/levels.ts';

const idle = { x: 0, y: 0, lure: false };
const tick = (game: Game, frames = 1) => { for (let i = 0; i < frames; i++) game.step(idle); };
const actor = (colorIndex: number, intent: Intent, x = 272, y = 304): Echo => ({ colorIndex, frames: [{ x, y, angle: 0, lure: false, intent }, { x, y, angle: 0, lure: false }] });
const map = (extra: Partial<Terminal> = {}) => level('relay-test', '', { spawn: p(272, 304), terminals: [{ id: 'S', kind: 'source', x: 112, y: 144 }, { id: 'R', kind: 'relay', x: 272, y: 304, ...extra }, { id: 'L', kind: 'lock', x: 528, y: 176, authorization: 'KEY' }] });
const find = (id: string) => CHAPTER_FOUR.flatMap(m => m.stages).find(s => s.level.id === id)!;

test('terminal windows include their first frame and exclude their last for giving and taking', () => {
  for (const phase of ['take', 'give'] as const) for (const [frame, allowed] of [[59, false], [60, true], [119, true], [120, false]] as const) {
    const game = new Game(map({ window: [1, 2] })); game.start(); game.frame = frame;
    game.tokenOwner = phase === 'take' ? 'terminal:R' : 'player';
    game.step({ ...idle, interact: true });
    assert.equal(game.tokenOwner, allowed ? phase === 'take' ? 'player' : 'terminal:R' : phase === 'take' ? 'terminal:R' : 'player');
    if (!allowed) assert.match(game.signals.at(-1)!.text, /时段 1–2 秒/);
  }
});

test('a marked terminal retains one request until delivery; an ordinary terminal never retries', () => {
  for (const waitForDelivery of [true, false]) {
    const game = new Game(map({ waitForDelivery })); game.start(); game.step({ ...idle, interact: true }); tick(game, 60);
    assert.equal(game.waitingReceivers.size, waitForDelivery ? 1 : 0);
    const before = game.signals.length; tick(game, 60); assert.equal(game.signals.length, before);
    game.tokenOwner = 'terminal:R'; tick(game);
    assert.equal(game.tokenOwner, waitForDelivery ? 'player' : 'terminal:R');
    assert.equal(game.waitingReceivers.size, 0);
  }
});

test('waiting across a closed window receives on its first open frame without a second E', () => {
  const game = new Game(map({ waitForDelivery: true, window: [2, 3] })); game.start(); game.tokenOwner = 'terminal:R';
  game.step({ ...idle, interact: true }); tick(game, 119);
  assert.equal(game.tokenOwner, 'terminal:R'); assert.match(game.terminalStatus(game.level.terminals![1]), /等候接收/);
  tick(game); assert.equal(game.tokenOwner, 'player'); assert.equal(game.waitingReceivers.size, 0);
});

test('leaving the receiving circle cancels a pending request, and returning does not recreate it', () => {
  const game = new Game(map({ waitForDelivery: true })); game.start(); game.step({ ...idle, interact: true });
  for (let i = 0; i < 9; i++) game.step({ ...idle, x: 1 });
  assert.equal(game.waitingReceivers.size, 0);
  assert.match(game.signals.at(-1)!.text, /等候已取消：已离开接收范围/);
  for (let i = 0; i < 9; i++) game.step({ ...idle, x: -1 });
  game.tokenOwner = 'terminal:R'; tick(game); assert.equal(game.tokenOwner, 'terminal:R');
});

test('held echo endpoints keep a pending request but never reissue a completed take', () => {
  const game = new Game(map({ waitForDelivery: true })); game.restorePlan([actor(0, { type: 'take', id: 'R' })]); game.start(); tick(game, 60);
  assert.equal(game.waitingReceivers.get('echo:0'), 'R');
  game.tokenOwner = 'terminal:R'; tick(game); assert.equal(game.tokenOwner, 'echo:0');
  game.tokenOwner = 'terminal:R'; tick(game, 60); assert.equal(game.tokenOwner, 'terminal:R');
});

test('two waiting receivers cancel on arrival without depending on echo array order', () => {
  const echoes = [actor(0, { type: 'take', id: 'R' }), actor(1, { type: 'take', id: 'R' })];
  for (const order of [echoes, [...echoes].reverse()]) {
    const game = new Game(map({ waitForDelivery: true })); game.restorePlan(order); game.start(); tick(game, 20);
    assert.equal(game.waitingReceivers.size, 2); game.tokenOwner = 'terminal:R'; tick(game);
    assert.equal(game.tokenOwner, 'terminal:R'); assert.equal(game.waitingReceivers.size, 0);
    assert.match(game.signals.at(-1)!.text, /接收冲突/); const count = game.signals.length; tick(game, 60); assert.equal(game.signals.length, count);
  }
});

test('suppression cancels waiting after this frame power requests and does not resume it later', () => {
  const scenario = { ...map({ waitForDelivery: true }), circuits: [{ id: 'N', x: 112, y: 432, initial: false }], suppressors: [{ id: 'NULL', x: 240, y: 272, w: 64, h: 64, power: { id: 'N', on: true } }] };
  const game = new Game(scenario); game.restorePlan([actor(0, { type: 'take', id: 'R' }), { ...actor(1, { type: 'circuit', id: 'N', on: true }, 112, 432), delay: 15 }]);
  game.start(); tick(game, 15); assert.equal(game.waitingReceivers.size, 1); tick(game); assert.equal(game.waitingReceivers.size, 0);
  game.circuits.set('N', false); game.tokenOwner = 'terminal:R'; tick(game); assert.equal(game.tokenOwner, 'terminal:R');
});

test('a queued transfer checks both power and remote presence, then uses give-before-take ordering', () => {
  const scenario = { ...map({ waitForDelivery: true, plate: 'A', power: { id: 'P', on: true } }), circuits: [{ id: 'P', x: 112, y: 432, initial: false }], plates: [{ id: 'A', x: 400, y: 432 }] };
  const game = new Game(scenario); game.restorePlan([actor(0, { type: 'take', id: 'R' })]); game.start(); game.tokenOwner = 'player'; tick(game);
  game.step({ ...idle, interact: true }); assert.equal(game.tokenOwner, 'player');
  game.circuits.set('P', true); tick(game); game.step({ ...idle, interact: true }); assert.equal(game.tokenOwner, 'player');
  game.echoes.push(actor(1, { type: 'take', id: 'missing' }, 400, 432)); tick(game);
  game.step({ ...idle, interact: true }); assert.equal(game.tokenOwner, 'echo:0');
});

test('authorization requires the earlier signature and keeps the credential after success', () => {
  const scenario = map(); scenario.terminals!.push({ id: 'L2', kind: 'lock', x: 272, y: 304, authorization: 'SECOND', requiresAuthorization: 'KEY' });
  scenario.terminals = scenario.terminals!.filter(t => t.id !== 'R');
  const game = new Game(scenario); game.start(); game.tokenOwner = 'player'; game.step({ ...idle, interact: true });
  assert.equal(game.authorized.size, 0); assert.match(game.signals.at(-1)!.text, /先取得 KEY/);
  game.authorized.add('KEY'); tick(game); game.step({ ...idle, interact: true });
  assert.ok(game.authorized.has('SECOND')); assert.equal(game.tokenOwner, 'player');
});

test('preview and restored recordings reconstruct waiting without saving transient ownership', () => {
  const game = new Game(map({ waitForDelivery: true })); game.restorePlan([actor(0, { type: 'take', id: 'R' })]);
  const plan = decodePlan(encodePlan(game.level.id, game.echoes), game.level.id)!;
  const preview = game.previewAt(90); assert.equal(preview.waitingReceivers.size, 1); assert.equal(game.waitingReceivers.size, 0);
  const restored = new Game(game.level); restored.restorePlan(plan); assert.equal(restored.waitingReceivers.size, 0); assert.equal(restored.tokenOwner, 'terminal:S');
  restored.start(); tick(restored, 90); assert.deepEqual(restored.waitingReceivers, preview.waitingReceivers);
  restored.restart(); assert.equal(restored.waitingReceivers.size, 0); assert.equal(restored.tokenOwner, 'terminal:S');
  restored.beginRerecord(0); restored.start(); tick(restored, 90); assert.equal(restored.waitingReceivers.size, 0);
});

test('all 18 C4 zones and the alternative use real inputs, valid owners and at most three echoes', () => {
  const stages = CHAPTER_FOUR.flatMap(m => m.stages); assert.equal(CHAPTER_FOUR.length, 6); assert.equal(stages.length, 18);
  for (const stage of stages) for (const witness of [stage.witness, ...stage.alternatives ?? []]) {
    const game = playWitness({ ...stage, witness }, g => {
      assert.ok(g.tokenOwner === 'player' || g.level.terminals!.some(t => g.tokenOwner === `terminal:${t.id}`) || g.echoes.some(e => g.tokenOwner === `echo:${e.colorIndex}`));
    });
    assert.equal(game.status, 'won'); assert.ok(game.seconds < 12); assert.ok(game.echoes.length <= 3);
    if (stage.level.objective !== 'reach') assert.ok(game.hasLoot);
  }
});

test('every C4 reference needs its recorded device operations; early handoff cannot replace delayed rendezvous', () => {
  for (const stage of CHAPTER_FOUR.flatMap(m => m.stages)) assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter(a => !('press' in a) || a.press !== 'interact') }), stage.level.id);
  for (const id of ['C4-3-a', 'C4-3-b']) {
    const stage = find(id); assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter(a => !('delay' in a)) }), id);
  }
});

test('the empty-handed first recording fails locally but its identical take and authorization succeed on replay', () => {
  const stage = find('C4-1-a'); let first: string[] = [];
  const game = playWitness(stage, g => { if (g.attempts === 1) first = g.signals.map(s => s.text); });
  const replay = game.signals.map(s => s.text);
  assert.ok(first.some(s => s.includes('R 尚无凭据'))); assert.ok(first.some(s => s.includes('授权未满足')));
  assert.ok(replay.some(s => s.includes('回声 1 收到 R'))); assert.ok(replay.some(s => s.includes('回声 1 完成 L')));
  assert.equal(game.tokenOwner, 'echo:0'); assert.ok(game.hasLoot);
});

test('the station finale supports actual credential transfer and a distinct inner-control route', () => {
  const stage = find('C4-6-d'); const relay = playWitness(stage); const service = playWitness({ ...stage, witness: stage.alternatives![0] });
  assert.ok(relay.signals.some(s => s.text.includes('收到 R')));
  assert.equal(service.signals.some(s => s.text.includes('收到 R')), false);
  assert.equal(relay.tokenOwner, 'player'); assert.equal(service.tokenOwner, 'echo:0');
  assert.ok(relay.circuits.get('P')); assert.ok(service.circuits.get('P'));
});

test('remote presence is necessary for the first lesson and the later two-signature relay', () => {
  for (const id of ['C4-1-a', 'C4-2-b', 'C4-3-c', 'C4-5-c']) {
    const stage = find(id);
    assert.throws(() => playWitness({ ...stage, level: { ...stage.level, plates: [] } }), id);
  }
  const stage = find('C4-5-b');
  const witness = stage.witness.filter((a, i, all) => {
    const before = all[i - 1];
    return !('press' in a && before && 'go' in before && before.go[0] === 528 && before.go[1] === 432);
  });
  assert.throws(() => playWitness({ ...stage, witness }));
});

test('physical freight pickup activates extraction security and requires the live player to restore P', () => {
  const stage = find('C4-6-c');
  const trace: { loot: boolean; powered: boolean; owner: string | null; won: boolean }[] = [];
  const game = playWitness(stage, g => trace.push({ loot: g.hasLoot, powered: g.circuits.get('P')!, owner: g.tokenOwner, won: g.status === 'won' }));
  assert.ok(trace.some(t => t.loot && !t.powered && !t.won));
  assert.ok(game.hasLoot && game.circuits.get('P')); assert.equal(game.tokenOwner, 'echo:1');
  const lastInteraction = stage.witness.reduce((last, a, i) => 'press' in a ? i : last, -1);
  assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter((_, i) => i !== lastInteraction) }));
});
