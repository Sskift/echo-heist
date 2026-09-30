import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Campaign } from '../src/campaign.ts';
import { MISSIONS, canonicalZoneId, type Stage } from '../src/campaign-content.ts';
import { Game } from '../src/engine.ts';
import { playWitness } from '../src/witness.ts';
import { decodePlan, encodePlan } from '../src/plans.ts';

function begin(id: string) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  return new Campaign({ version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
}
const choose = (s: Stage, alternative: boolean) => playWitness(alternative ? { ...s, witness: s.alternatives![0] } : s);

for (const id of ['C6-1', 'C6-2', 'C6-3']) for (const alternative of [false, true]) {
  test(`${id}: ${alternative ? 'alternative' : 'primary'} whole mission survives each checkpoint reload`, () => {
    let campaign = begin(id);
    const first = campaign.stage, win = choose(first, alternative);
    const expected = first.outcomes!.find(o => win.powered(o.power))!;
    assert.ok(campaign.commit(win)); assert.ok(campaign.flags.includes(expected.id));
    while (campaign.cleared() < campaign.mission.stages.length) {
      campaign = new Campaign(campaign.export());
      assert.equal(campaign.mission.id, id); assert.ok(campaign.flags.includes(expected.id));
      const current = campaign.stage;
      if (alternative && campaign.stageIndex === 1) assert.notEqual(current.level.id, campaign.mission.stages[1].level.id);
      assert.ok(campaign.commit(playWitness(current)));
    }
    assert.ok(campaign.data.completed.includes(id));
    assert.equal(new Campaign(campaign.export()).cleared(), campaign.mission.stages.length);
  });
}

test('rollback removes branch outcomes and dependent wins while retaining historical unlocks', () => {
  let campaign = begin('C6-2');
  campaign.commit(choose(campaign.stage, true));
  campaign.commit(playWitness(campaign.stage)); campaign.commit(playWitness(campaign.stage));
  assert.ok(campaign.available('C6-3'));
  campaign.returnTo(1);
  assert.deepEqual(campaign.flags, ['C6-2-a-clear', 'C6-2-voice']);
  assert.equal(campaign.stage.level.id, 'C6-2-b-voice');
  campaign.returnTo(0);
  assert.deepEqual(campaign.flags, []); assert.deepEqual(campaign.data.outcomes, {});
  campaign = new Campaign(campaign.export());
  assert.ok(campaign.available('C6-3'));
  campaign.commit(playWitness(campaign.stage));
  assert.equal(campaign.stage.level.id, 'C6-2-b');
  assert.ok(!campaign.flags.includes('C6-2-voice'));
});

test('missing or invalid decisions stop restoration at the last verifiable checkpoint', () => {
  const campaign = begin('C6-1'); campaign.commit(playWitness(campaign.stage)); campaign.commit(playWitness(campaign.stage));
  for (const bad of [undefined, {}, { 'C6-1-a': 'invented' }, { 'C6-1-a': 'C6-2-records' }]) {
    const restored = new Campaign({ ...campaign.export(), outcomes: bad });
    assert.equal(restored.cleared('C6-1'), 0); assert.ok(!restored.data.completed.includes('C6-1'));
    assert.deepEqual(restored.flags, []);
  }
  const restored = new Campaign({ ...campaign.export(), outcomes: { ...campaign.data.outcomes, 'C6-3-a': 'C6-3-door' } });
  assert.deepEqual(restored.data.outcomes, { 'C6-1-a': 'C6-1-front' });
});

test('only a real win of the resolved branch can commit; plans cannot leak between layouts', () => {
  const campaign = begin('C6-1');
  const initial = campaign.export(), live = new Game(campaign.stage.level);
  live.start(); live.circuits.set('ENTRY', false);
  assert.equal(campaign.commit(live), false); assert.deepEqual(campaign.export(), initial);
  const previewWin = choose(campaign.stage, true); previewWin.spectator = true;
  assert.equal(campaign.commit(previewWin), false); assert.deepEqual(campaign.export(), initial);
  const editingWin = choose(campaign.stage, true); editingWin.editingIndex = 0;
  assert.equal(campaign.commit(editingWin), false);
  assert.ok(campaign.commit(choose(campaign.stage, true)));
  const defaultWin = playWitness(campaign.mission.stages[1]);
  assert.equal(campaign.commit(defaultWin), false);
  const branch = campaign.stage, branchWin = playWitness(branch);
  assert.equal(decodePlan(encodePlan(defaultWin.level.id, defaultWin.echoes), branch.level.id), null);
  assert.equal(canonicalZoneId(branch.level.id), 'C6-1-b');
  assert.ok(campaign.commit(branchWin));
  assert.deepEqual(campaign.data.runs['C6-1'], ['C6-1-a', 'C6-1-b']);
});

test('entry choices change terminal access and staffing, rather than just the story', () => {
  const front = begin('C6-1'), service = begin('C6-1');
  front.commit(choose(front.stage, false)); service.commit(choose(service.stage, true));
  assert.equal(front.stage.level.terminals?.length, 3); assert.equal(service.stage.level.terminals, undefined);
  const a = playWitness(front.stage), b = playWitness(service.stage);
  assert.equal(a.echoes.length, 1); assert.equal(b.echoes.length, 2);
  assert.ok(a.authorized.has('SIGNED')); assert.equal(b.circuits.get('Q'), false);
});

test('order choices swap both proof sources and merge on the same verified contact', () => {
  const records = begin('C6-2'), voice = begin('C6-2');
  records.commit(choose(records.stage, false)); voice.commit(choose(voice.stage, true));
  assert.match(records.stage.level.lootLabel!, /编号/); assert.match(voice.stage.level.lootLabel!, /暗号/);
  records.commit(playWitness(records.stage)); voice.commit(playWitness(voice.stage));
  assert.match(records.stage.level.lootLabel!, /录音/); assert.match(voice.stage.level.lootLabel!, /注销记录/);
  assert.throws(() => playWitness({ ...voice.stage, witness: voice.stage.witness.filter(a => !('press' in a && a.press === 'lure')) }), /caught/);
  records.commit(playWitness(records.stage)); voice.commit(playWitness(voice.stage));
  assert.deepEqual(records.data.runs['C6-2'], voice.data.runs['C6-2']);
  assert.equal(records.mission.evidence, voice.mission.evidence);
});

test('the saved supply outcome configures the next room and supports distinct one-echo and zero-echo plans', () => {
  const light = begin('C6-3'), door = begin('C6-3');
  light.commit(choose(light.stage, false)); door.commit(choose(door.stage, true));
  const lit = new Campaign(light.export()).stage, dark = new Campaign(door.export()).stage;
  assert.equal(new Game(lit.level).circuits.get('GRID'), true);
  const darkGame = new Game(dark.level);
  assert.equal(darkGame.circuits.get('GRID'), false); assert.equal(darkGame.visionRange(0), 64);
  assert.equal(playWitness(lit).echoes.length, 1); assert.equal(playWitness(dark).echoes.length, 0);
  const proof = door.mission.stages[2], a = playWitness(proof), b = choose(proof, true);
  assert.equal(a.echoes.length, 1); assert.equal(b.echoes.length, 2);
  assert.ok(a.authorized.has('SIGNED')); assert.equal(b.authorized.size, 0);
});
