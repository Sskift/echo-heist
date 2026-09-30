import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Echo } from '../src/engine.ts';
import { level, point as p } from '../src/campaign-authoring.ts';
import { CHAPTER_TWO } from '../src/chapter-two.ts';
import { playWitness } from '../src/witness.ts';
import type { GuardDefinition } from '../src/levels.ts';

const idle = { x: 0, y: 0, lure: false };
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.step(idle); };
const guard = (id: string, x: number, y: number): GuardDefinition => ({ id, route: [p(x, y)], facing: Math.PI, speed: 160, range: 1, hearing: 500, searchSeconds: 0.5 });
const sound = (x: number, y: number, colorIndex: number): Echo => ({ colorIndex, frames: [{ x, y, angle: 0, lure: true }, { x, y, angle: 0, lure: false }] });

test('spatial collision lookup preserves brute-force geometry including off-grid walls and strict edges', () => {
  const map = level('geometry-unit', '', {
    walls: [p(-17, 24), p(65.5, 80.25), p(160, 128)],
    doors: [{ id: 'D', x: 240, y: 96, w: 32, h: 64 }],
    glass: [{ id: 'G', x: 304, y: 64, w: 17, h: 128 }],
  });
  const game = new Game(map);
  for (const opened of [false, true]) {
    if (opened) game.openDoors.add('D'); else game.openDoors.clear();
    for (const sight of [false, true]) for (const radius of [0, 1, 10, 40]) {
      const rects = [...map.walls.map(w => ({ ...w, w: 32, h: 32 })), ...(!opened ? map.doors : []), ...(!sight ? map.glass! : [])];
      for (let x = -64; x <= 384; x += 2.5) for (let y = 0; y <= 224; y += 3.5) {
        const expected = rects.some(r => Math.hypot(x - Math.max(r.x, Math.min(x, r.x + r.w)), y - Math.max(r.y, Math.min(y, r.y + r.h))) < radius);
        assert.equal(game.blocked(x, y, radius, sight), expected, `${x},${y} r${radius} sight${sight} open${opened}`);
      }
    }
  }
  assert.equal(game.blocked(150, 144), false, 'exact tangency remains passable');
  assert.equal(game.blocked(150.001, 144), true);
});

test('glass blocks walking but neither vision nor hearing', () => {
  const map = level('glass-unit', '', { glass: [{ id: 'G', x: 448, y: 192, w: 32, h: 192 }], spawn: p(400, 304), noiseResponse: 'nearest' });
  const game = new Game(map); game.start();
  assert.ok(game.canSee(p(400, 304), p(560, 304)));
  assert.equal(game.occluded(460, 304), false); assert.equal(game.blocked(460, 304), true);
  for (let i = 0; i < 60; i++) game.step({ ...idle, x: 1 });
  assert.ok(game.player.x < 440);
  const watched = new Game({ ...map, guards: [{ ...guard('A', 560, 304), range: 240 }] });
  watched.start(); run(watched, 45);
  assert.equal(watched.status, 'caught'); assert.equal(watched.failure?.guard, 0);
  const heard = new Game({ ...map, guards: [guard('A', 560, 304)] });
  heard.start(); heard.step({ ...idle, lure: true });
  assert.deepEqual(heard.guards[0].investigate, map.spawn);
});

test('a dispatched guard routes around glass, searches on arrival, and routes back to its post', () => {
  const game = new Game(level('return-unit', '', { spawn: p(336, 304), glass: [{ id: 'G', x: 448, y: 192, w: 32, h: 192 }], noiseResponse: 'nearest', guards: [guard('A', 560, 304)] }));
  game.start(); game.step({ ...idle, lure: true }); run(game, 30);
  assert.equal(game.guards[0].attention, 0.5, 'travel must not consume the arrival search duration');
  let offAxis = false, crossed = false;
  for (let i = 0; i < 560; i++) {
    game.step(idle); offAxis ||= Math.abs(game.guards[0].y - 304) > 95; crossed ||= game.guards[0].x < 420;
    assert.equal(game.blocked(game.guards[0].x, game.guards[0].y), false);
  }
  assert.ok(offAxis && crossed, 'investigation must actually navigate through an end opening');
  assert.equal(game.guards[0].investigate, null);
  assert.ok(Math.hypot(game.guards[0].x - 560, game.guards[0].y - 304) < 6);
  assert.equal(game.guards[0].angle, Math.PI);
  assert.ok(game.signals.some(s => s.text.includes('抵达声源')));
  assert.ok(game.signals.some(s => s.text.includes('返回巡逻')));
});

test('simultaneous dispatch is deterministic across guard and echo ordering', () => {
  const definitions = [guard('A', 400, 176), guard('B', 400, 400)];
  const sounds = [sound(300, 288, 0), sound(500, 288, 1)];
  for (const guards of [definitions, [...definitions].reverse()]) for (const echoes of [sounds, [...sounds].reverse()]) {
    const game = new Game(level('dispatch-unit', '', { guards, noiseResponse: 'nearest' }));
    game.restorePlan(echoes); game.start(); game.step(idle);
    assert.deepEqual(game.guards[guards.findIndex(g => g.id === 'A')].investigate, p(300, 288));
    assert.deepEqual(game.guards[guards.findIndex(g => g.id === 'B')].investigate, p(500, 288));
  }
  const tied = new Game(level('tie-unit', '', { guards: definitions, noiseResponse: 'nearest' }));
  tied.restorePlan([sound(400, 288, 0)]); tied.start(); tied.step(idle);
  assert.ok(tied.guards[0].investigate); assert.equal(tied.guards[1].investigate, null);
});

test('dispatch excludes fixed sentries, unpowered guards and listeners outside hearing range', () => {
  const game = new Game(level('eligible-unit', '', { spawn: p(300, 304), noiseResponse: 'nearest', circuits: [{ id: 'P', x: 80, y: 80, initial: false }], guards: [
    { ...guard('S', 320, 304), kind: 'sentry' },
    { ...guard('OFF', 336, 304), power: { id: 'P', on: true } },
    { ...guard('FAR', 352, 304), hearing: 10 },
    guard('B', 500, 304),
  ] }));
  game.start(); game.step({ ...idle, lure: true });
  assert.deepEqual(game.guards.map(g => !!g.investigate), [false, false, false, true]);
});

for (const id of ['C2-5-a', 'C2-5-b']) test(`${id}: the first sound changes who receives the second; preview remains isolated`, () => {
  const stage = CHAPTER_TWO.flatMap(m => m.stages).find(s => s.level.id === id)!;
  const solved = playWitness(stage), game = new Game(stage.level); game.restorePlan(solved.echoes);
  const frame = id === 'C2-5-a' ? 315 : 270;
  const primed = game.previewAt(frame);
  const second = primed.guards[stage.level.guards.findIndex(g => g.id === 'B')].investigate;
  const marker = stage.level.soundMarkers![1];
  assert.ok(second && Math.hypot(second.x - marker.x, second.y - marker.y) < 5);
  assert.equal(game.frame, 0); assert.ok(game.guards.every(g => !g.investigate));
  const unprimed = new Game(stage.level); unprimed.restorePlan([solved.echoes[1]]);
  const before = unprimed.previewAt(frame);
  const assignedA = before.guards[stage.level.guards.findIndex(g => g.id === 'A')].investigate;
  assert.ok(assignedA && Math.hypot(assignedA.x - marker.x, assignedA.y - marker.y) < 5);
  assert.equal(before.guards[stage.level.guards.findIndex(g => g.id === 'B')].investigate, null);
});

test('sound-dependent routes fail when sound is removed, while the fixed-sentry and finale quiet routes remain valid', () => {
  for (const stage of CHAPTER_TWO.flatMap(m => m.stages).filter(s => !['C2-3-a', 'C2-6-d'].includes(s.level.id))) {
    assert.throws(() => playWitness({ ...stage, witness: stage.witness.map(a => 'press' in a ? { wait: 2 } : a) }), /caught/, stage.level.id);
  }
  const finale = CHAPTER_TWO.at(-1)!.stages.at(-1)!;
  const quiet = playWitness({ ...finale, witness: finale.alternatives![0] });
  assert.equal(quiet.echoes.length, 0); assert.equal(quiet.status, 'won');
});
