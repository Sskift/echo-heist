import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Echo, type Intent } from '../src/engine.ts';
import { LEVELS, type Level } from '../src/levels.ts';
import { encodePlan, decodePlan } from '../src/plans.ts';
import { MISSIONS, room } from '../src/campaign-content.ts';

const idle = { x: 0, y: 0, lure: false };
const run = (game: Game, frames: number) => { for (let i = 0; i < frames; i++) game.step(idle); };
const echo = (x: number, y: number, colorIndex = 0, intent?: Intent): Echo => ({ colorIndex, frames: [{ x, y, angle: 0, lure: false, ...(intent ? { intent } : {}) }, { x, y, angle: 0, lure: false }] });
const relayLevel = (): Level => ({ ...LEVELS[0], walls: room(), guards: [], doors: [], plates: [], terminals: [{ id: 'S', x: 272, y: 176, kind: 'source' }, { id: 'L', x: 528, y: 176, kind: 'lock', authorization: 'KEY' }] });

test('a delayed echo has no effect before appearing and replays its original first frame', () => {
  const game = new Game(LEVELS[0]);
  game.echoes = [{ ...echo(272, 176), delay: 60 }];
  game.start(); run(game, 60);
  assert.equal(game.openDoors.has('A'), false);
  game.step(idle); assert.equal(game.openDoors.has('A'), true);
  assert.deepEqual(game.echoAt(game.echoes[0]), game.echoes[0].frames[1]);
});

test('delay edits support undo, preserve on rerecord, and migrate old saves', () => {
  const game = new Game(LEVELS[0]); game.restorePlan([echo(272, 176)]);
  assert.equal(game.setDelay(0, 17), false); assert.equal(game.setDelay(0, 375), false);
  assert.ok(game.setDelay(0, 90));
  const saved = encodePlan('01', game.echoes);
  assert.deepEqual(decodePlan(saved, '01'), game.echoes);
  assert.ok(game.undoPlan()); assert.equal(game.echoes[0].delay ?? 0, 0);
  game.setDelay(0, 90); game.beginRerecord(0); game.start(); run(game, 20); game.rewind();
  assert.equal(game.echoes[0].delay, 90);
  assert.ok(decodePlan({ version: 1, levelId: '01', echoes: [echo(272, 176)] }, '01'));
  const bad = encodePlan('01', game.echoes); bad.echoes[0].delay = Infinity;
  assert.equal(decodePlan(bad, '01'), null);
});

test('suppression disables plates and noise, keeps time running, and resumes without catching up', () => {
  const level = MISSIONS.find(m => m.id === 'LAB-NULL')!.stages[0].level;
  const game = new Game(level);
  const held = echo(272, 176); held.frames[0].lure = true;
  game.restorePlan([held]); game.start(); game.drainEvents(); run(game, 60);
  assert.equal(game.openDoors.has('A'), false); assert.equal(game.drainEvents().includes('lure'), false);
  assert.equal(game.echoActivity(0), '投影受抑制');
  game.circuits.set('N', false); game.step(idle);
  assert.ok(game.openDoors.has('A')); assert.equal(game.drainEvents().includes('lure'), false);
  assert.equal(game.echoActivity(0), '守住 A 开关');
});

test('competing same-frame circuit values cancel independently of echo array order', () => {
  const level: Level = { ...relayLevel(), circuits: [{ id: 'P', x: 272, y: 176, initial: false }] };
  const inputs = [echo(272, 176, 0, { type: 'circuit', id: 'P', on: true }), echo(272, 176, 1, { type: 'circuit', id: 'P', on: false })];
  for (const list of [inputs, [...inputs].reverse()]) {
    const game = new Game(level); game.restorePlan(list); game.start(); game.step(idle);
    assert.equal(game.circuits.get('P'), false);
    assert.ok(game.signals.some(s => s.text.includes('冲突')));
  }
});

test('a terminal cannot duplicate its one credential when receivers compete', () => {
  const level = relayLevel();
  const inputs = [echo(272, 176, 0, { type: 'take', id: 'S' }), echo(272, 176, 1, { type: 'take', id: 'S' })];
  for (const list of [inputs, [...inputs].reverse()]) {
    const game = new Game(level); game.restorePlan(list); game.start(); game.step(idle);
    assert.equal(game.tokenOwner, 'terminal:S');
    assert.ok(game.signals.some(s => s.text.includes('接收冲突')));
  }
});

test('same-frame handoff gives before receiving; held end poses never repeat requests', () => {
  const game = new Game(relayLevel());
  game.restorePlan([echo(272, 176, 0, { type: 'take', id: 'S' })]);
  game.start(); game.tokenOwner = 'player'; game.player.x = 272; game.player.y = 176;
  game.step({ ...idle, interact: true });
  assert.equal(game.tokenOwner, 'echo:0');
  const signals = game.signals.length; run(game, 120); assert.equal(game.signals.length, signals);
});

test('recorded empty-handed requests can later authorize using a received credential', () => {
  const level = relayLevel();
  const courier = echo(272, 176, 0, { type: 'take', id: 'S' });
  courier.frames[1] = { x: 528, y: 176, angle: 0, lure: false, intent: { type: 'authorize', id: 'L' } };
  const game = new Game(level); game.restorePlan([courier]); game.start(); run(game, 2);
  assert.equal(game.tokenOwner, 'echo:0'); assert.ok(game.authorized.has('KEY'));
});

test('preview cannot modify the live plan, world, history, or progress events', () => {
  const game = new Game(LEVELS[0]); game.restorePlan([echo(272, 176)]); game.start(); run(game, 10);
  const before = JSON.stringify({ plan: encodePlan('01', game.echoes), frame: game.frame, player: game.player, events: game.events, status: game.status });
  const preview = game.previewAt(720);
  assert.equal(preview.spectator, true); assert.equal(preview.status, 'paused'); assert.ok(preview.openDoors.has('A'));
  assert.equal(preview.hasLoot, false); assert.equal(preview.echoes.length, 1);
  assert.equal(JSON.stringify({ plan: encodePlan('01', game.echoes), frame: game.frame, player: game.player, events: game.events, status: game.status }), before);
  preview.echoes[0].frames[0].x = 0; assert.equal(game.echoes[0].frames[0].x, 272);
});

test('failed previews identify the echo, observer and frame', () => {
  const game = new Game(LEVELS[2]); game.restorePlan([echo(770, 320)]);
  const preview = game.previewAt(120);
  assert.equal(preview.status, 'caught'); assert.equal(preview.failure?.actor, '回声 1'); assert.equal(preview.failure?.guard, 0);
  assert.ok(preview.failure!.frame > 0 && preview.failure!.frame < 120);
  assert.equal(game.status, 'ready'); assert.equal(game.failure, null);
});

test('noise investigation can route around a wall instead of walking into it', () => {
  const level: Level = { ...relayLevel(), walls: room([[14, [12, 13]]]), guards: [{ route: [{ x: 560, y: 304 }, { x: 592, y: 304 }], range: 1, speed: 100 }] };
  const game = new Game(level); game.start(); game.player.x = 368; game.player.y = 304;
  game.step({ ...idle, lure: true }); run(game, 120);
  assert.ok(game.guards[0].y > 380, 'guard should take the southern opening');
});
