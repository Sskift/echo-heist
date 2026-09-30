import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Campaign } from '../src/campaign.ts';
import { MISSIONS, stageVersions } from '../src/campaign-content.ts';
import { playWitness } from '../src/witness.ts';

for (const mission of MISSIONS) for (const stage of mission.stages.flatMap(stageVersions)) {
  test(`${stage.level.id}: authored reference inputs complete the action zone in 12 seconds`, () => {
    const game = playWitness(stage);
    assert.equal(game.status, 'won'); assert.ok(game.seconds <= 12);
  });
  for (const [index, witness] of (stage.alternatives ?? []).entries()) test(`${stage.level.id}: alternative ${index + 1} also completes with real input`, () => {
    assert.equal(playWitness({ ...stage, witness }).status, 'won');
  });
}

test('campaign commits only real wins, restores checkpoints, and rolls back dependent facts', () => {
  const campaign = new Campaign();
  assert.equal(campaign.select('C0-4'), false);
  for (const mission of MISSIONS.slice(0, 3)) {
    assert.ok(campaign.select(mission.id));
    assert.ok(campaign.commit(playWitness(mission.stages[0])));
  }
  assert.ok(campaign.select('C0-4'));
  const win = playWitness(campaign.stage);
  assert.ok(campaign.commit(win)); assert.equal(campaign.commit(win), false);
  const restored = new Campaign(campaign.export());
  assert.equal(restored.stageIndex, 1); assert.deepEqual(restored.flags, ['service-route']);
  assert.ok(restored.returnTo(0)); assert.deepEqual(restored.flags, []);
  assert.equal(restored.stageIndex, 0);
  const preview = playWitness(restored.stage); preview.spectator = true;
  assert.equal(restored.commit(preview), false);
});

test('invalid campaign stage sequences do not unlock later content', () => {
  const campaign = new Campaign({ version: 1, selected: 'C0-6', runs: { 'C0-1': ['invented'], 'C0-4': ['C0-4-b'] }, completed: ['C0-1', 'C0-4'] });
  assert.equal(campaign.mission.id, 'C0-1'); assert.equal(campaign.available('C0-2'), false);
  assert.deepEqual(campaign.flags, []);
});

test('replaying a completed mission retains historical unlocks across reloads', () => {
  const campaign = new Campaign();
  campaign.commit(playWitness(campaign.stage));
  assert.ok(campaign.available('C0-2'));
  campaign.returnTo(0);
  const restored = new Campaign(campaign.export());
  assert.ok(restored.available('C0-2')); assert.deepEqual(restored.flags, []);
});

test('completing the prologue unlocks the next chapter and excludes optional probes from main progression', () => {
  const campaign = new Campaign();
  for (const mission of MISSIONS.filter(m => m.id.startsWith('C0-'))) {
    assert.ok(campaign.select(mission.id));
    for (const stage of mission.stages) assert.ok(campaign.commit(playWitness(stage)));
  }
  assert.equal(campaign.nextMission?.id, 'C1-1'); assert.ok(campaign.available('C1-1'));
  assert.ok(campaign.select('C1-1')); assert.equal(new Campaign(campaign.export()).mission.id, 'C1-1');
  const last = MISSIONS.filter(m => !m.id.startsWith('LAB-')).at(-1)!;
  campaign.data.selected = last.id;
  assert.equal(campaign.nextMission, undefined);
});
