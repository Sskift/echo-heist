import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.ts';
import { LEVELS } from '../src/levels.ts';
import { decodePlan, encodePlan } from '../src/plans.ts';
import { Campaign } from '../src/campaign.ts';
import { MISSIONS } from '../src/campaign-content.ts';
import { playWitness } from '../src/witness.ts';
import { evidence, sceneUnlocked, STORY, StoryState } from '../src/story.ts';

test('saved plans preserve an edited recording, isolate copies and reject corrupt coordinates', () => {
  const game = new Game(LEVELS[0]); game.start();
  for (let i = 0; i < 20; i++) game.step({ x: 1, y: 0, lure: false });
  game.rewind();
  assert.ok(game.beginRerecord(0)); game.start();
  for (let i = 0; i < 10; i++) game.step({ x: 0, y: -1, lure: false });
  assert.ok(game.rewind()); assert.equal(game.echoes[0].frames.length, 10);
  const encoded = encodePlan(game.level.id, game.echoes);
  assert.deepEqual(decodePlan(encoded, game.level.id), game.echoes);
  encoded.echoes[0].frames[0].x = -100;
  assert.notEqual(game.echoes[0].frames[0].x, -100);
  assert.equal(decodePlan(encoded, game.level.id), null);
  const before = encodePlan(game.level.id, game.echoes);
  game.removeEcho(0); assert.equal(game.echoes.length, 0);
  assert.ok(game.undoPlan()); assert.deepEqual(encodePlan(game.level.id, game.echoes), before);
});

test('a real checkpoint survives reload; rollback removes dependent progress but keeps unlocks', () => {
  const campaign = new Campaign();
  assert.ok(campaign.commit(playWitness(campaign.stage)));
  const restored = new Campaign(campaign.export());
  assert.equal(restored.cleared(), 1); assert.ok(restored.available('C0-2'));
  assert.ok(restored.returnTo(0)); assert.equal(restored.cleared(), 0);
  assert.ok(restored.available('C0-2'));
  assert.deepEqual(evidence(restored).map(m => m.id), ['C0-1']);
});

test('story reveals follow actual mission completion and old saves enter the current chapter', () => {
  const fresh = new Campaign(), state = new StoryState();
  assert.deepEqual(STORY.filter(s => sceneUnlocked(s, fresh)).map(s => s.id), ['c0-arrival']);
  state.finish(STORY[0]); assert.equal(state.pending(fresh), undefined);
  const before = MISSIONS.filter(m => m.id < 'C6-1' && m.id.startsWith('C'));
  const old = new Campaign({ version: 1, selected: 'C6-1', runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
  assert.equal(state.pending(old)?.id, 'c6-arrival');
  assert.ok(!sceneUnlocked(STORY.find(s => s.id === 'c6-contact')!, old));
});

test('dialogue answers and cursor survive reload; skipping and rereading cannot invent or replace an answer', () => {
  const scene = STORY.find(s => s.id === 'c5-departure')!;
  const state = new StoryState({ version: 1, seen: ['unknown'], choices: { unknown: 'bad' }, cursor: { id: scene.id, page: 2, choice: 'verify' } });
  assert.equal(state.data.cursor?.page, 2); assert.deepEqual(state.data.seen, []);
  state.finish(scene, state.data.cursor?.choice);
  const restored = new StoryState(state.data);
  assert.equal(restored.data.cursor, undefined);
  assert.match(restored.endingNote(), /逐项核对/);
  restored.finish(scene, 'testify'); assert.equal(restored.data.choices[scene.id], 'verify');
  const skipped = new StoryState(); skipped.finish(scene);
  assert.equal(skipped.data.choices[scene.id], undefined);
  const malformed = new StoryState({ version: 1, seen: [scene.id], choices: { [scene.id]: 'forged' }, cursor: { id: scene.id, page: -1 } });
  assert.deepEqual(malformed.data.choices, {}); assert.equal(malformed.data.cursor, undefined);
});
