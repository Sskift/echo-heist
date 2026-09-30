import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/engine.ts';
import { LEVELS, MAX_FRAMES, WIDTH } from '../src/levels.ts';
import { decodePlan, encodePlan } from '../src/plans.ts';

const idle: Input = { x: 0, y: 0, lure: false };
function step(game: Game, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) game.step(input);
}
function fill(game: Game) {
  game.start();
  for (let i = 0; i < 3; i++) { step(game, 10 + i * 5, { x: 1, y: 0, lure: false }); game.rewind(); }
}

test('rerecording a full middle slot replaces only that teammate and preserves its color', () => {
  const game = new Game(LEVELS[0]); fill(game);
  const [first, middle, last] = game.echoes;
  assert.ok(game.beginRerecord(1));
  assert.deepEqual(game.activeEchoes.map(e => e.index), [0, 2]);
  assert.equal(game.echoes[1], middle);
  game.start(); step(game, 40, { x: 0, y: -1, lure: false });
  assert.ok(game.rewind());
  assert.equal(game.echoes.length, 3);
  assert.equal(game.echoes[0], first); assert.equal(game.echoes[2], last);
  assert.equal(game.echoes[1].colorIndex, middle.colorIndex);
  assert.equal(game.echoes[1].frames.length, 40);
  assert.equal(game.editingIndex, null);
  assert.ok(game.undoPlan());
  assert.deepEqual(game.echoes[1], middle);
});

test('cancel keeps the original recording intact, including after a failed attempt and retry', () => {
  const game = new Game(LEVELS[0]); fill(game);
  const original = encodePlan(game.level.id, game.echoes);
  game.beginRerecord(0); game.start(); step(game, 20);
  game.status = 'caught'; game.restart(); step(game, 5);
  assert.equal(game.editingIndex, 0);
  assert.ok(game.cancelRerecord());
  assert.deepEqual(encodePlan(game.level.id, game.echoes), original);
  assert.equal(game.status, 'ready');
});

test('a full 12-second rerecord commits even when all three slots are occupied', () => {
  const game = new Game(LEVELS[0]); fill(game);
  game.beginRerecord(2); game.start(); step(game, MAX_FRAMES);
  assert.equal(game.status, 'running');
  assert.equal(game.editingIndex, null);
  assert.equal(game.echoes.length, 3);
  assert.equal(game.echoes[2].frames.length, MAX_FRAMES);
  assert.equal(game.frame, 0);
});

test('the old version of a rerecorded echo cannot operate switches, make noise or trigger security', () => {
  const game = new Game(LEVELS[2]);
  game.echoes = [
    { colorIndex: 0, frames: Array.from({ length: 2 }, () => ({ x: 770, y: 320, angle: 0, lure: true })) },
    { colorIndex: 1, frames: Array.from({ length: 2 }, () => ({ x: 272, y: 176, angle: 0, lure: false })) },
  ];
  game.beginRerecord(0); game.start(); game.drainEvents(); step(game, 60);
  assert.equal(game.status, 'running'); assert.equal(game.alarm, 0);
  assert.equal(game.drainEvents().filter(e => e === 'lure').length, 0);
  assert.ok(game.openDoors.has('A'));
  game.cancelRerecord(); game.beginRerecord(1); game.start();
  assert.equal(game.openDoors.has('A'), false);
  step(game, 60);
  assert.equal(game.status, 'caught');
});

test('rerecording cannot collect the prize or accidentally finish a mission', () => {
  const game = new Game(LEVELS[0]); fill(game); game.beginRerecord(0); game.start();
  game.player = { ...game.level.loot, angle: 0, lure: false }; step(game, 2);
  assert.equal(game.hasLoot, false); assert.equal(game.status, 'running');
});

test('plan undo restores deletions and clear without retaining references to future edits', () => {
  const game = new Game(LEVELS[0]); fill(game);
  const original = encodePlan(game.level.id, game.echoes);
  game.removeEcho(1); assert.equal(game.echoes.length, 2);
  game.clear(); assert.equal(game.echoes.length, 0);
  assert.ok(game.undoPlan()); assert.equal(game.echoes.length, 2);
  assert.ok(game.undoPlan()); assert.deepEqual(encodePlan(game.level.id, game.echoes), original);
  game.beginRerecord(1);
  assert.equal(game.undoPlan(), false);
  game.removeEcho(0); assert.equal(game.echoes.length, 3);
  assert.equal(game.beginRerecord(2), false);
});

test('empty, invalid, and too-short edits do not modify a plan', () => {
  const game = new Game(LEVELS[0]);
  assert.equal(game.undoPlan(), false); assert.equal(game.beginRerecord(0), false);
  fill(game); const original = encodePlan(game.level.id, game.echoes);
  assert.equal(game.beginRerecord(0.5), false);
  game.beginRerecord(0); game.start(); step(game, 1);
  assert.equal(game.rewind(), false);
  assert.deepEqual(encodePlan(game.level.id, game.echoes), original);
});

test('echo status reports actual switch occupancy, movement and end-pose holding', () => {
  const game = new Game(LEVELS[0]); game.start();
  step(game, 10, { x: 1, y: 0, lure: false }); game.rewind(); step(game, 4);
  assert.equal(game.echoActivity(0), '移动中');
  step(game, 15); assert.equal(game.echoActivity(0), '终点待命');
  game.echoes[0].frames.at(-1)!.x = 272; game.echoes[0].frames.at(-1)!.y = 176;
  assert.equal(game.echoActivity(0), '守住 A 开关');
  game.beginRerecord(0); assert.equal(game.echoActivity(0), '正在重录');
});

test('plan serialization round-trips exact replay data and restores a ready game', () => {
  const game = new Game(LEVELS[0]); fill(game);
  const plan = encodePlan(game.level.id, game.echoes);
  const decoded = decodePlan(JSON.parse(JSON.stringify(plan)), game.level.id)!;
  assert.deepEqual(decoded, game.echoes);
  const restored = new Game(LEVELS[0]); restored.restorePlan(decoded);
  assert.equal(restored.status, 'ready'); assert.equal(restored.canUndo, false);
  restored.start(); game.restart();
  step(game, 100); step(restored, 100);
  assert.deepEqual(restored.player, game.player);
  assert.deepEqual(restored.echoAt(restored.echoes[1]), game.echoAt(game.echoes[1]));
  decoded[0].frames[0].x = 0;
  assert.notEqual(restored.echoes[0].frames[0].x, 0);
});

test('invalid saved plans are rejected before reaching the renderer or simulation', () => {
  const game = new Game(LEVELS[0]); fill(game);
  const plan = encodePlan(game.level.id, game.echoes);
  assert.equal(decodePlan(plan, '02'), null);
  assert.equal(decodePlan({ ...plan, version: 900 }, '01'), null);
  assert.equal(decodePlan({ ...plan, echoes: [...plan.echoes, plan.echoes[0]] }, '01'), null);
  for (const bad of [null, {}, [], 'invalid']) assert.equal(decodePlan(bad, '01'), null);
  for (const corrupt of [
    (p: typeof plan) => { p.echoes[0].frames = []; },
    (p: typeof plan) => { p.echoes[1].colorIndex = p.echoes[0].colorIndex; },
    (p: typeof plan) => { p.echoes[0].frames[0].x = WIDTH + 1; },
    (p: typeof plan) => { p.echoes[0].frames[0].angle = Infinity; },
    (p: typeof plan) => { p.echoes[0].frames = Array(MAX_FRAMES + 1).fill(p.echoes[0].frames[0]); },
  ]) {
    const bad = structuredClone(plan); corrupt(bad); assert.equal(decodePlan(bad, '01'), null);
  }
});
