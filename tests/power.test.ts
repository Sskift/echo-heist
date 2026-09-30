import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Echo } from '../src/engine.ts';
import { level, point as p } from '../src/campaign-authoring.ts';
import { CHAPTER_THREE } from '../src/chapter-three.ts';
import { playWitness } from '../src/witness.ts';

const idle = { x: 0, y: 0, lure: false };
const run = (game: Game, n: number, input = idle) => { for (let i = 0; i < n; i++) game.step(input); };
const find = (id: string) => CHAPTER_THREE.flatMap(m => m.stages).find(s => s.level.id === id)!;

test('lighting changes vision immediately but darkness retains near vision and hearing', () => {
  const map = level('lighting-unit', '', { spawn: p(400, 304), circuits: [{ id: 'L', x: 400, y: 304, initial: true }], guards: [{ id: 'A', route: [p(560, 304)], facing: Math.PI, speed: 80, range: 260, hearing: 500, lighting: { id: 'L', on: true, darkRange: 80 } }] });
  const lit = new Game(map); lit.start(); run(lit, 40); assert.equal(lit.status, 'caught');
  const dark = new Game(map); dark.start(); dark.step({ ...idle, interact: true }); run(dark, 40);
  assert.equal(dark.visionRange(0), 80); assert.equal(dark.alarm, 0);
  dark.step({ ...idle, lure: true }); assert.deepEqual(dark.guards[0].investigate, p(400, 304));
  const close = new Game({ ...map, spawn: p(512, 304), circuits: [{ id: 'L', x: 400, y: 304, initial: false }] });
  close.start(); run(close, 40); assert.equal(close.status, 'caught');
});

test('powered cameras keep their angle, ignore sound, and stop detecting when their feed is cut', () => {
  const map = level('camera-unit', '', { spawn: p(400, 304), circuits: [{ id: 'P', x: 400, y: 304, initial: true }], guards: [{ id: 'CAM', route: [p(560, 304), p(560, 432)], speed: 100, range: 250, facing: Math.PI, kind: 'camera', power: { id: 'P', on: true } }] });
  const watching = new Game(map); watching.start(); watching.step({ ...idle, lure: true });
  assert.equal(watching.guards[0].investigate, null); assert.equal(watching.guards[0].angle, Math.PI);
  run(watching, 40); assert.equal(watching.status, 'caught'); assert.equal(watching.guards[0].y, 304);
  const stopped = new Game(map); stopped.start(); stopped.step({ ...idle, interact: true }); run(stopped, 90);
  assert.equal(stopped.alarm, 0); assert.equal(stopped.status, 'running');
});

const coreMap = () => level('core-unit', '', {
  spawn: p(400, 304), loot: p(400, 304), exit: p(600, 304),
  circuits: [{ id: 'SEC', x: 400, y: 304, initial: true }, { id: 'CIV', x: 500, y: 304, initial: true }],
  lootPower: [{ id: 'SEC', on: false }], exitPower: [{ id: 'CIV', on: true }],
  onLoot: { power: [{ id: 'CIV', on: false }], message: 'CIV must be restored after core removal' },
});

test('physical pickup needs power conditions and overrides an earlier same-tick restoration only once', () => {
  const game = new Game(coreMap()); game.start(); run(game, 2); assert.equal(game.hasLoot, false);
  const early: Echo = { colorIndex: 0, delay: 2, frames: [{ x: 500, y: 304, angle: 0, lure: false, intent: { type: 'circuit', id: 'CIV', on: true } }] };
  game.echoes = [early]; game.step({ ...idle, interact: true });
  assert.ok(game.hasLoot); assert.equal(game.circuits.get('CIV'), false); assert.equal(game.exitReady, false);
  run(game, 27, { ...idle, x: 1 }); game.step({ ...idle, interact: true });
  assert.equal(game.circuits.get('CIV'), true); run(game, 22, { ...idle, x: 1 });
  assert.equal(game.status, 'won'); assert.equal(game.signals.filter(s => s.text === game.level.onLoot!.message).length, 1);
  game.restart(); assert.equal(game.hasLoot, false); assert.equal(game.circuits.get('SEC'), true); assert.equal(game.circuits.get('CIV'), true);
});

test('an unmet exit condition blocks completion even when no physical door blocks the exit', () => {
  const map = coreMap(); map.lootPower = [];
  const game = new Game(map); game.start(); game.step(idle); assert.ok(game.hasLoot);
  run(game, 53, { ...idle, x: 1 }); assert.ok(Math.abs(game.player.x - 600) < 5);
  assert.equal(game.status, 'running'); assert.equal(game.exitReady, false);
  run(game, 27, { ...idle, x: -1 }); game.step({ ...idle, interact: true });
  run(game, 27, { ...idle, x: 1 }); assert.equal(game.status, 'won');
});

test('preview and rerecord cannot take the core or cause the physical pickup consequence', () => {
  const map = coreMap(); map.lootPower = [];
  const game = new Game(map);
  game.restorePlan([{ colorIndex: 0, frames: [{ ...map.spawn, angle: 0, lure: false }, { ...map.spawn, angle: 0, lure: false }] }]);
  const preview = game.previewAt(120);
  assert.equal(preview.hasLoot, false); assert.equal(preview.circuits.get('CIV'), true);
  assert.equal(game.frame, 0); assert.equal(game.circuits.get('CIV'), true);
  game.beginRerecord(0); game.start(); run(game, 10);
  assert.equal(game.hasLoot, false); assert.equal(game.circuits.get('CIV'), true);
});

test('the authored core extraction really cuts civilian power and restores it after pickup before winning', () => {
  const trace: { loot: boolean; civil: boolean; won: boolean }[] = [];
  playWitness(find('C3-6-c'), game => trace.push({ loot: game.hasLoot, civil: game.circuits.get('CIV')!, won: game.status === 'won' }));
  assert.ok(trace.some(s => !s.loot && s.civil)); assert.ok(trace.some(s => s.loot && !s.civil));
  assert.deepEqual(trace.at(-1), { loot: true, civil: true, won: true });
  assert.ok(trace.every(s => !s.won || (s.loot && s.civil)));
  const stage = find('C3-6-c');
  let count = 0;
  assert.throws(() => playWitness({ ...stage, witness: stage.witness.map(a => 'press' in a && ++count === 2 ? { wait: 2 } : a) }), /blocked|did not finish/);
});

test('authored power routes depend on their operations; an open entrance alone cannot beat the linked camera', () => {
  for (const stage of CHAPTER_THREE.flatMap(m => m.stages)) {
    assert.throws(() => playWitness({ ...stage, witness: stage.witness.map(a => 'press' in a && a.press === 'interact' ? { wait: 2 } : a) }), /blocked|caught|did not finish/, stage.level.id);
  }
  const shared = find('C3-2-a'); let count = 0;
  assert.throws(() => playWitness({ ...shared, witness: shared.witness.map(a => 'press' in a && ++count === 2 ? { wait: 2 } : a) }), /caught/);
  const finale = find('C3-6-d');
  const quiet = playWitness({ ...finale, witness: finale.alternatives![0] });
  assert.equal(quiet.echoes.length, 0); assert.equal(quiet.status, 'won');
});
