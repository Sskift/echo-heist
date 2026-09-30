import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/engine.ts';
import { FPS, LEVELS, MAX_FRAMES, type Point } from '../src/levels.ts';

const idle: Input = { x: 0, y: 0, lure: false };
function step(game: Game, frames: number, input = idle) {
  for (let i = 0; i < frames; i++) game.step(input);
}
function go(game: Game, target: Point) {
  let steps = 0;
  while (Math.hypot(game.player.x - target.x, game.player.y - target.y) > 4) {
    assert.equal(game.status, 'running', `route interrupted at ${game.player.x},${game.player.y}: ${game.lastMessage}`);
    assert.ok(steps++ < 240, `route blocked toward ${target.x},${target.y}; player at ${game.player.x},${game.player.y}`);
    game.step({ x: target.x - game.player.x, y: target.y - game.player.y, lure: false });
    if ((game.status as string) === 'won') return;
  }
}
function route(game: Game, points: number[][]) { points.forEach(([x, y]) => { if (game.status !== 'won') go(game, { x, y }); }); }
function recordA(game: Game) {
  route(game, [[272, 464], [272, 176]]);
  assert.equal(game.activePlates.has('A'), true);
  assert.equal(game.rewind(), true);
}
function recordB(game: Game) {
  route(game, [[400, 464], [400, 352], [528, 352], [528, 464], [656, 464]]);
  assert.equal(game.activePlates.has('B'), true);
  assert.equal(game.rewind(), true);
}

test('ready and paused states do not consume loop time', () => {
  const game = new Game(LEVELS[0]);
  step(game, 60);
  assert.equal(game.frame, 0);
  game.start(); step(game, 30); game.togglePause(); step(game, 60);
  assert.equal(game.frame, 30);
  game.togglePause(); step(game, 30);
  assert.equal(game.seconds, 1);
});

test('diagonal movement has the same speed as straight movement', () => {
  const straight = new Game(LEVELS[0]); const diagonal = new Game(LEVELS[0]);
  straight.start(); diagonal.start();
  step(straight, 20, { x: 1, y: 0, lure: false });
  step(diagonal, 20, { x: 1, y: -1, lure: false });
  const distance = (g: Game) => Math.hypot(g.player.x - g.level.spawn.x, g.player.y - g.level.spawn.y);
  assert.ok(Math.abs(distance(straight) - distance(diagonal)) < 0.001);
});

test('walls and closed gates block the player', () => {
  const game = new Game(LEVELS[0]); game.start();
  step(game, 100, { x: -1, y: 0, lure: false });
  assert.ok(game.player.x >= 42);
  game.player = { x: 425, y: 352, angle: 0, lure: false };
  step(game, 30, { x: 1, y: 0, lure: false });
  assert.ok(game.player.x < 439);
});

test('recordings replay exact coordinates and hold the last pose', () => {
  const game = new Game(LEVELS[0]); game.start();
  step(game, 30, { x: 1, y: 0, lure: false });
  const recorded = game.recording.map(f => ({ ...f }));
  game.rewind();
  for (let i = 0; i < recorded.length; i++) assert.deepEqual(game.echoAt(game.echoes[0], i), recorded[i]);
  assert.deepEqual(game.echoAt(game.echoes[0], 600), recorded.at(-1));
  assert.equal(game.frame, 0);
  assert.deepEqual({ x: game.player.x, y: game.player.y }, game.level.spawn);
});

test('a ghost standing on a pressure plate keeps the door open', () => {
  const game = new Game(LEVELS[0]); game.start(); recordA(game);
  step(game, 200);
  assert.ok(game.openDoors.has('A'));
  assert.equal(game.player.x, game.level.spawn.x);
});

test('a full loop automatically becomes an echo', () => {
  const game = new Game(LEVELS[0]); game.start(); step(game, MAX_FRAMES);
  assert.equal(game.echoes.length, 1);
  assert.equal(game.echoes[0].frames.length, MAX_FRAMES);
  assert.equal(game.frame, 0);
});

test('full slots never silently discard an existing recording', () => {
  const game = new Game(LEVELS[0]); game.start();
  for (let i = 0; i < 3; i++) { step(game, 10); game.rewind(); }
  const echoes = [...game.echoes];
  step(game, 10);
  assert.equal(game.rewind(), false);
  assert.deepEqual(game.echoes, echoes);
  step(game, MAX_FRAMES);
  assert.equal(game.status, 'caught');
  assert.deepEqual(game.echoes, echoes);
  game.restart(); assert.equal(game.status, 'running'); assert.equal(game.echoes.length, 3);
});

test('retry resets loot, suspicion and recording but retains echoes', () => {
  const game = new Game(LEVELS[2]); game.start(); recordA(game);
  game.hasLoot = true; game.alarm = 0.5; step(game, 10); game.restart();
  assert.equal(game.hasLoot, false); assert.equal(game.alarm, 0);
  assert.equal(game.echoes.length, 1); assert.equal(game.recording.length, 0);
});

test('removing one echo preserves all other recordings and reuses its color', () => {
  const game = new Game(LEVELS[0]); game.start();
  for (let i = 0; i < 3; i++) { step(game, 10); game.rewind(); }
  const last = game.echoes[2];
  game.removeEcho(1);
  assert.equal(game.echoes[1], last);
  assert.equal(game.status, 'ready');
  game.start(); step(game, 10); game.rewind();
  assert.equal(game.echoes[2].colorIndex, 1);
});

test('sound events replay once; a held terminal pose does not repeat a lure', () => {
  const game = new Game(LEVELS[2]); game.start(); step(game, 2);
  game.step({ x: 0, y: 0, lure: true }); game.rewind(); game.drainEvents();
  step(game, 100);
  assert.equal(game.drainEvents().filter(e => e === 'lure').length, 1);
});

test('guard detection is blocked by solid walls', () => {
  const game = new Game(LEVELS[2]);
  assert.equal(game.canSee({ x: 688, y: 320 }, { x: 688, y: 160 }), false);
  assert.equal(game.canSee({ x: 688, y: 320 }, { x: 740, y: 320 }), true);
});

test('a guard catches the player after sustained exposure', () => {
  const game = new Game(LEVELS[2]); game.start();
  game.player.x = 770; game.player.y = 320;
  step(game, FPS);
  assert.equal(game.status, 'caught');
});

test('a visible echo can trigger the security alarm', () => {
  const game = new Game(LEVELS[2]); game.start();
  game.echoes.push({ colorIndex: 0, frames: [{ x: 770, y: 320, angle: 0, lure: false }] });
  step(game, FPS);
  assert.equal(game.status, 'caught');
});

test('level 01 can be completed with one recorded teammate', () => {
  const game = new Game(LEVELS[0]); game.start(); recordA(game);
  route(game, [[400, 464], [400, 352], [528, 352], [528, 144], [816, 144], [816, 112], [816, 144], [528, 144], [528, 352], [400, 352], [400, 464], [112, 464]]);
  assert.equal(game.status, 'won');
  assert.ok(game.seconds < 12);
  assert.equal(game.echoes.length, 1);
});

test('level 02 can be completed with two coordinated teammates', () => {
  const game = new Game(LEVELS[1]); game.start(); recordA(game); recordB(game);
  route(game, [[400, 464], [400, 352], [528, 352], [528, 288], [800, 288], [800, 192], [816, 112], [800, 192], [800, 288], [528, 288], [528, 352], [400, 352], [400, 464], [112, 464]]);
  assert.equal(game.status, 'won');
  assert.equal(game.echoes.length, 2);
});

test('level 03 has a complete stealth solution using cover and two echoes', () => {
  const game = new Game(LEVELS[2]); game.start(); recordA(game); recordB(game);
  route(game, [[400, 464], [400, 352], [528, 352], [528, 464], [752, 464], [784, 464], [784, 272], [800, 192], [816, 112], [800, 192], [784, 272], [784, 464], [528, 464], [528, 352], [400, 352], [400, 464], [112, 464]]);
  assert.equal(game.status, 'won');
  assert.equal(game.echoes.length, 2);
});
