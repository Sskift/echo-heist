import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.ts';
import { LEVELS, type CredentialSnapshot, type Level } from '../src/levels.ts';
import { decodePlan, encodePlan } from '../src/plans.ts';
import { Campaign } from '../src/campaign.ts';
import { MISSIONS } from '../src/campaign-content.ts';
import { playWitness } from '../src/witness.ts';
import { evidence, sceneUnlocked, STORY, StoryState } from '../src/story.ts';

function lastLight() {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'C3-6'));
  return new Campaign({ version: 1, selected: 'C3-6', runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
}

function preparationMission(id = 'C0-6') {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  return new Campaign({ version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
}

test('only archived evidence permits preparation; missing old-save evidence never blocks the original route', () => {
  const campaign = preparationMission(), missing = campaign.export();
  missing.completed = missing.completed.filter(id => id !== 'C0-4');
  const old = new Campaign(missing);
  assert.equal(old.data.selected, 'C0-6');
  assert.equal(old.choosePreparation('museum-service'), false);
  assert.equal(old.choosePreparation('invented'), false);
  assert.equal(old.stage.level.id, 'C0-6-a');
  assert.equal(old.preparationOptions.length, 1);
  assert.ok(campaign.choosePreparation('museum-service'));
  assert.equal(campaign.stage.level.id, 'C0-6-a-service');
  assert.ok(campaign.flags.includes('museum-service'));
  for (const [mission, choice, sources] of [['C1-6', 'gala-handover', ['C1-1', 'C1-4']], ['C3-5', 'grid-bypass', ['C2-6', 'C3-4']], ['C4-5', 'station-legacy', ['C3-6', 'C4-3']], ['C5-5', 'retention-manual', ['C4-6', 'C5-2']]] as const) {
    const ready = preparationMission(mission);
    for (const id of sources) {
      const save = ready.export(); save.completed = save.completed.filter(m => m !== id);
      assert.equal(new Campaign(save).choosePreparation(choice), false);
    }
    assert.ok(ready.choosePreparation(choice));
  }
});

test('departure freezes a preparation through retry, reload and rollback; rehearsal cannot freeze it', () => {
  const campaign = preparationMission(); campaign.choosePreparation('museum-service');
  const game = new Game(campaign.stage.level);
  const preview = game.previewAt(100);
  assert.equal(campaign.depart(preview), false);
  assert.equal(campaign.commit(preview), false);
  assert.equal(campaign.preparationLocked, false);
  game.start(); assert.ok(campaign.depart(game));
  assert.equal(campaign.choosePreparation('museum-freight'), false);
  game.restart(); game.clear(); // Neither discarding a take nor its recordings changes the mission arrangement.
  const restored = new Campaign(campaign.export());
  assert.equal(restored.preparationLocked, true);
  assert.equal(restored.stage.level.id, 'C0-6-a-service');
  restored.returnTo(0); assert.equal(restored.choosePreparation('museum-freight'), false);
  restored.data.completed.push('C0-6');
  assert.ok(restored.resetPreparation());
  assert.ok(restored.data.completed.includes('C0-6'));
  assert.ok(restored.available('C1-1'));
  assert.ok(restored.choosePreparation('museum-freight'));
  assert.equal(restored.stage.level.id, 'C0-6-a');
  const stale = new Game(game.level); stale.status = 'won';
  assert.equal(restored.commit(stale), false, 'a completed stale layout cannot submit');
});

test('preparation migration preserves old checkpoints and safely rejects corrupt or unsupported arrangements', () => {
  const old = preparationMission().export();
  old.runs['C0-6'] = ['C0-6-a']; delete old.preparations;
  const migrated = new Campaign(old);
  assert.equal(migrated.cleared(), 1); assert.equal(migrated.stage.level.id, 'C0-6-b');
  assert.equal(migrated.preparationLocked, true);
  const save = migrated.export();
  save.completed.push('C0-6');
  save.preparations!['C0-6'] = { id: 'unknown-route', locked: true };
  const repaired = new Campaign(save);
  assert.equal(repaired.cleared(), 0); assert.equal(repaired.stage.level.id, 'C0-6-a');
  assert.ok(repaired.data.completed.includes('C0-6')); assert.ok(repaired.available('C1-1'));
  save.preparations!['C0-6'] = { id: 'museum-service', locked: false };
  const resumed = new Campaign(save);
  assert.equal(resumed.stage.level.id, 'C0-6-b-service'); assert.equal(resumed.preparationLocked, true);
  const ready = preparationMission(), recorded = new Game(ready.stage.level);
  recorded.start();
  for (let tick = 0; tick < 3; tick++) recorded.step({ x: 1, y: 0, lure: false });
  assert.ok(recorded.rewind());
  const restoredPlan = new Game(ready.stage.level); restoredPlan.restorePlan(recorded.localPlan);
  assert.ok(ready.depart(restoredPlan), 'a restored recording also proves an old save has departed');
});

const incomingTicket: CredentialSnapshot = { id: 'ticket', owner: 'terminal:IN', authorizations: ['STAMP'] };
const transferRoom: Level = {
  ...LEVELS[0], id: 'transfer-fixture', walls: [], doors: [], plates: [], guards: [],
  spawn: { x: 100, y: 100 }, exit: { x: 800, y: 500 }, objective: 'reach',
  credential: { id: 'ticket', label: '凭据', from: 'previous', incomingOwners: ['terminal:IN'], incomingAuthorizations: ['STAMP'], receiveByPlayer: 'IN', exitOwners: ['terminal:RETURN'], exitAuthorizations: ['STAMP', 'FINAL'] },
  terminals: [{ id: 'IN', kind: 'relay', x: 100, y: 100 }, { id: 'FINAL', kind: 'lock', authorization: 'FINAL', x: 200, y: 100 }, { id: 'RETURN', kind: 'relay', transfer: 'give', x: 300, y: 100 }],
};
function interact(game: Game) {
  game.step({ x: 0, y: 0, lure: false, interact: true });
  game.step({ x: 0, y: 0, lure: false });
}
function walkToX(game: Game, x: number) {
  for (let n = 0; Math.abs(game.player.x - x) > 4; n++) {
    assert.ok(n < 100); game.step({ x: Math.sign(x - game.player.x), y: 0, lure: false });
  }
}

test('one incoming ticket resets to its checkpoint, inherits only declared signatures and requires a personal pickup', () => {
  for (const invalid of [undefined, { ...incomingTicket, id: 'other' }, { ...incomingTicket, owner: 'echo:0' }, { ...incomingTicket, authorizations: [] }]) {
    const game = new Game(transferRoom, undefined, invalid);
    assert.equal(game.tokenOwner, null); assert.equal(game.exitReady, false);
  }
  const input = structuredClone(incomingTicket);
  input.authorizations.push('UNDECLARED');
  const game = new Game(transferRoom, undefined, input);
  input.owner = 'player'; input.authorizations.length = 0;
  assert.equal(game.tokenOwner, 'terminal:IN'); assert.deepEqual([...game.authorized], ['STAMP']);
  game.start(); interact(game); assert.equal(game.tokenOwner, 'player');
  walkToX(game, 200); interact(game); walkToX(game, 300); interact(game);
  assert.deepEqual(game.credentialCheckpoint(), { id: 'ticket', owner: 'terminal:RETURN', authorizations: ['STAMP', 'FINAL'], receivedFrom: 'IN' });
  interact(game); assert.equal(game.tokenOwner, 'terminal:RETURN'); // Give-only slots cannot create a new pickup.
  assert.ok(game.rewind());
  assert.equal(game.tokenOwner, 'terminal:IN'); assert.deepEqual([...game.authorized], ['STAMP']);
  assert.match(game.credentialBlockers().join(), /本人/);
  const preview = game.previewAt(200);
  assert.equal(preview.tokenOwner, 'terminal:RETURN'); assert.ok(preview.authorized.has('FINAL'));
  assert.equal(preview.credentialCheckpoint(), undefined); // An echo cannot substitute for the current player's receipt.
  assert.equal(game.frame, 0); assert.equal(game.tokenOwner, 'terminal:IN');
  interact(game); // The recorded and live pickup collide in the same frame.
  assert.equal(game.tokenOwner, 'terminal:IN'); assert.match(game.signals.map(s => s.text).join(), /接收冲突/);
  game.restart(); assert.equal(game.tokenOwner, 'terminal:IN'); assert.equal(game.echoes.length, 1);
  assert.deepEqual([...game.authorized], ['STAMP']);
});

test('an empty-handed rehearsal records a return request without inventing possession', () => {
  const game = new Game({ ...transferRoom, spawn: { x: 300, y: 100 } }, undefined, incomingTicket);
  game.start(); interact(game);
  assert.deepEqual(game.recording[0].intent, { type: 'give', id: 'RETURN' });
  assert.equal(game.tokenOwner, 'terminal:IN');
  assert.ok(game.operationLog.some(op => op.intent.id === 'RETURN' && op.result === 'blocked'));
  assert.equal(game.credentialCheckpoint(), undefined);
});

test('ticket checkpoints reject corrupt provenance, restore across mission changes and roll back downstream facts', () => {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'C4-6'));
  const campaign = new Campaign({ version: 1, selected: 'C4-6', runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
  assert.ok(campaign.commit(playWitness(campaign.stage)));
  const stage = campaign.stage, inbound = campaign.credentialFor(stage.level.id)!;
  const received = playWitness(stage, undefined, inbound);
  assert.ok(received.exitReady);
  received.incoming!.authorizations.push('invented');
  assert.equal(campaign.commit(received), false);
  received.incoming!.authorizations.pop();
  assert.ok(campaign.commit(received));
  const saved = campaign.export();
  const restored = new Campaign(saved), cargo = restored.stage.level;
  assert.deepEqual(restored.credentialFor(cargo.id), saved.credentials!['C4-6-receive']);
  assert.ok(restored.select('C4-1')); assert.ok(restored.select('C4-6'));
  assert.equal(new Game(cargo, undefined, restored.credentialFor(cargo.id)).tokenOwner, 'terminal:ARCHIVE');
  for (const corrupt of [undefined, { ...saved.credentials!['C4-6-receive'], receivedFrom: undefined }, { ...saved.credentials!['C4-6-receive'], authorizations: [] }]) {
    const broken = structuredClone(saved);
    if (corrupt) broken.credentials!['C4-6-receive'] = corrupt; else delete broken.credentials!['C4-6-receive'];
    const repaired = new Campaign(broken);
    assert.equal(repaired.cleared(), 1); assert.equal(repaired.stage.level.id, 'C4-6-receive');
    assert.equal(repaired.data.credentials!['C4-6-receive'], undefined);
  }
  const mismatch = structuredClone(saved); mismatch.credentials!['C4-6-send'].owner = 'terminal:SERVICE';
  assert.equal(new Campaign(mismatch).cleared(), 0);
  restored.returnTo(0);
  assert.deepEqual(restored.data.credentials, {}); assert.equal(restored.data.outcomes!['C4-6-send'], undefined);
  const old = structuredClone(saved);
  old.runs['C4-6'] = ['C4-6-a', 'C4-6-b', 'C4-6-c', 'C4-6-d']; old.completed.push('C4-6'); old.selected = 'C5-1';
  const migrated = new Campaign(old);
  assert.equal(migrated.data.selected, 'C5-1'); assert.ok(migrated.available('C5-1'));
  migrated.select('C4-6'); assert.equal(migrated.cleared(), 0); assert.deepEqual(migrated.data.credentials, {});
});

test('retained recording survives reload, drives real remote power and shares the three-slot limit', () => {
  const campaign = lastLight();
  assert.ok(campaign.commit(playWitness(campaign.stage)));
  const restored = new Campaign(campaign.export()), level = restored.stage.level;
  const game = new Game(level, restored.carryFor(level.id));
  assert.equal(game.echoes.length, 1); assert.ok(game.remote);
  assert.equal(game.setDelay(0, 60), false); assert.equal(game.beginRerecord(0), false);
  game.removeEcho(0); assert.equal(game.echoes.length, 1);
  const off = game.previewAt(1), on = game.previewAt(180);
  assert.equal(off.circuits.get('FEED'), false); assert.equal(on.circuits.get('FEED'), true);
  assert.equal(on.remote!.frame, on.frame);
  assert.deepEqual(on.remote!.echoAt(on.remote!.echoes[0]), game.echoes[0].frames.at(-1));
  assert.equal(game.frame, 0); assert.equal(restored.cleared(), 1);
  game.start();
  for (let recording = 0; recording < 2; recording++) {
    game.step({ x: 0, y: 0, lure: false }); game.step({ x: 0, y: 0, lure: false });
    assert.ok(game.rewind());
  }
  assert.equal(game.echoes.length, 3); assert.equal(new Set(game.echoes.map(e => e.colorIndex)).size, 3);
  game.step({ x: 0, y: 0, lure: false }); game.step({ x: 0, y: 0, lure: false });
  assert.equal(game.rewind(), false);
  const again = new Game(level, restored.carryFor(level.id));
  again.restorePlan(decodePlan(encodePlan(level.id, game.localPlan), level.id)!);
  assert.equal(again.echoes.length, 3); assert.equal(again.localPlan.length, 2);
  again.clear(); assert.equal(again.echoes.length, 1); assert.ok(again.carried);
  assert.ok(again.undoPlan()); assert.equal(again.echoes.length, 3);
  again.restart(); assert.equal(again.remote!.frame, 0); assert.equal(again.circuits.get('FEED'), false);
});

test('missing retained data rolls back its checkpoint; old finale completion keeps later chapters unlocked', () => {
  const campaign = lastLight(); assert.ok(campaign.commit(playWitness(campaign.stage)));
  const missing = campaign.export(); missing.carries = {};
  const recovered = new Campaign(missing); assert.equal(recovered.cleared(), 0);
  assert.equal(recovered.carryFor('C3-6-core'), undefined);
  const old = lastLight().export();
  old.runs['C3-6'] = ['C3-6-a', 'C3-6-b', 'C3-6-c', 'C3-6-d'];
  old.completed.push('C3-6'); old.selected = 'C4-1';
  const migrated = new Campaign(old);
  assert.equal(migrated.data.selected, 'C4-1'); assert.ok(migrated.available('C4-1'));
  migrated.select('C3-6'); assert.equal(migrated.cleared(), 0);
  campaign.returnTo(0);
  assert.equal(campaign.data.carries?.['C3-6-entry'], undefined);
  assert.equal(campaign.data.outcomes?.['C3-6-entry'], undefined);
});

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
