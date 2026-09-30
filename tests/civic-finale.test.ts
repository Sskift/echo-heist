import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Campaign } from '../src/campaign.ts';
import { MISSIONS, type Stage } from '../src/campaign-content.ts';
import { playWitness } from '../src/witness.ts';

function begin(id: string) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  return new Campaign({ version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
}
const choose = (s: Stage, alternative: boolean) => playWitness(alternative ? { ...s, witness: s.alternatives![0] } : s);

for (const south of [false, true]) test(`the ${south ? 'signed south' : 'held north'} backup survives pickup lockdown and checkpoint reload`, () => {
  let c = begin('C6-4'); c.commit(choose(c.stage, south)); c = new Campaign(c.export());
  assert.equal(c.stage.level.id, south ? 'C6-4-b-south' : 'C6-4-b');
  let closedAfterPickup = false;
  const win = playWitness(c.stage, g => { if (g.hasLoot && !g.circuits.get('ENTRY')) closedAfterPickup = true; });
  assert.ok(closedAfterPickup); assert.equal(win.circuits.get('BACK'), !south);
  assert.equal(win.authorized.has('SIGNED'), south);
  c.commit(win); c = new Campaign(c.export());
  assert.ok(c.commit(playWitness(c.stage))); assert.ok(c.data.completed.includes('C6-4'));
});

test('an early backup reset is overwritten by pickup; the planned later reset is necessary', () => {
  const s = MISSIONS.find(m => m.id === 'C6-4')!.stages[2];
  let pickup = -1, restored = -1;
  playWitness(s, g => {
    if (g.hasLoot && pickup < 0) { pickup = g.frame; assert.equal(g.circuits.get('BACK'), false); }
    if (g.hasLoot && g.circuits.get('BACK') && restored < 0) restored = g.frame;
  });
  assert.ok(restored > pickup);
  assert.throws(() => playWitness({ ...s, witness: s.witness.filter(a => !('wait' in a)) }), /blocked|did not finish/);
});

for (const s of MISSIONS.find(m => m.id === 'C6-5')!.stages) test(`${s.level.id}: fewer echoes trades a brief visible crossing for the alternate plan's zero exposure`, () => {
  let fewAlarm = 0, quietAlarm = 0;
  const few = playWitness(s, g => { fewAlarm = Math.max(fewAlarm, ...g.guards.map(x => x.suspicion)); });
  const quiet = playWitness({ ...s, witness: s.alternatives![0] }, g => { quietAlarm = Math.max(quietAlarm, ...g.guards.map(x => x.suspicion)); });
  assert.ok(few.echoes.length < quiet.echoes.length); assert.ok(fewAlarm > 0 && fewAlarm < 1); assert.equal(quietAlarm, 0);
  assert.equal(quiet.echoes.length, 2);
});

for (let bits = 0; bits < 8; bits++) test(`the civic heist choice combination ${bits} completes all four stages after reload`, () => {
  let c = begin('C6-6');
  const service = !!(bits & 1), manual = !!(bits & 2), signed = !!(bits & 4);
  const expected = ['C6-6-a', service ? 'C6-6-b-service' : 'C6-6-b', manual ? 'C6-6-c-manual' : 'C6-6-c', signed ? 'C6-6-d-signed' : 'C6-6-d'];
  for (let i = 0; i < 4; i++) {
    assert.equal(c.stage.level.id, expected[i]);
    const win = choose(c.stage, i === 0 ? service : i === 1 ? manual : i === 2 ? signed : false);
    if (i === 3) { assert.ok(win.hasLoot); assert.equal(win.circuits.get('CIV'), true); }
    assert.ok(c.commit(win)); c = new Campaign(c.export());
    assert.equal(c.cleared(), i + 1);
  }
  assert.deepEqual(c.data.outcomes, { 'C6-6-a': service ? 'C6-6-service' : 'C6-6-certified', 'C6-6-b': manual ? 'C6-6-manual' : 'C6-6-radio', 'C6-6-c': signed ? 'C6-6-signed-exit' : 'C6-6-manual-exit' });
  assert.ok(c.data.completed.includes('C6-6')); assert.equal(c.mission.evidence, MISSIONS.find(m => m.id === 'C6-6')!.evidence);
});

test('rollback in a three-decision mission preserves only the upstream choice and rebuilds downstream layouts', () => {
  let c = begin('C6-6');
  for (let i = 0; i < 3; i++) c.commit(choose(c.stage, true));
  c.returnTo(1); c = new Campaign(c.export());
  assert.deepEqual(c.data.outcomes, { 'C6-6-a': 'C6-6-service' });
  assert.equal(c.stage.level.id, 'C6-6-b-service');
  c.commit(choose(c.stage, false)); assert.equal(c.stage.level.id, 'C6-6-c');
  c.commit(choose(c.stage, false)); assert.equal(c.stage.level.id, 'C6-6-d');
  c.returnTo(2); c = new Campaign(c.export());
  assert.deepEqual(c.data.outcomes, { 'C6-6-a': 'C6-6-service', 'C6-6-b': 'C6-6-radio' });
  c.commit(choose(c.stage, true)); assert.equal(c.stage.level.id, 'C6-6-d-signed');
});

test('the timed courier must be delayed; both dispatch branches can independently select either downstream method', () => {
  const stage = MISSIONS.find(m => m.id === 'C6-6')!.stages[1];
  assert.throws(() => playWitness({ ...stage, witness: stage.witness.filter(a => !('delay' in a)) }), /blocked|did not finish/);
  for (const version of [stage, stage.variants![0].stage]) for (const alt of [false, true]) assert.equal(choose(version, alt).circuits.get('RADIO'), !alt);
});

test('the broadcast route needs its lure and its post-pickup suppression reset', () => {
  const s = MISSIONS.find(m => m.id === 'C6-6')!.stages[2];
  assert.throws(() => playWitness({ ...s, witness: s.witness.filter(a => !('press' in a && a.press === 'lure')) }), /caught/);
  assert.throws(() => playWitness({ ...s, witness: s.witness.filter(a => !('press' in a && a.press === 'interact')) }), /blocked|did not finish/);
  let pickup = false, recovered = false;
  playWitness(s, g => {
    if (g.hasLoot && !pickup) { pickup = true; assert.equal(g.circuits.get('N'), true); }
    if (g.hasLoot && !g.circuits.get('N')) recovered = true;
  });
  assert.ok(pickup && recovered);
});

test('the manual route deliberately restarts tracking but hides its keeper and opens the alternate return', () => {
  const s = MISSIONS.find(m => m.id === 'C6-6')!.stages[2].variants![0].stage;
  let restarted = false;
  const win = playWitness(s, g => {
    if (g.hasLoot && !restarted) { restarted = true; assert.equal(g.circuits.get('T'), true); assert.ok(g.suppressed(g.echoAt(g.echoes[0]))); assert.ok(g.openDoors.has('RETURN')); }
  });
  assert.ok(restarted); assert.equal(win.echoes.length, 1);
});

test('both civic exits require a real post-pickup civilian restoration', () => {
  const base = MISSIONS.find(m => m.id === 'C6-6')!.stages[3];
  for (const s of [base, base.variants![0].stage]) {
    let pickup = -1, restore = -1;
    playWitness(s, g => {
      if (g.hasLoot && pickup < 0) { pickup = g.frame; assert.equal(g.circuits.get('CIV'), false); }
      if (g.hasLoot && g.circuits.get('CIV') && restore < 0) restore = g.frame;
    });
    assert.ok(restore > pickup);
    assert.throws(() => playWitness({ ...s, witness: s.witness.filter((_, i) => i !== s.witness.length - 2) }), /did not finish/);
  }
});
