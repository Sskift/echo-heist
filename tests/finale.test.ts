import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, stageVersions, type Stage, type WitnessAction } from '../src/campaign-content.ts';
import { Campaign } from '../src/campaign.ts';
import { playWitness } from '../src/witness.ts';

const find = (id: string) => MISSIONS.flatMap(m => m.stages.flatMap(stageVersions)).find(s => s.level.id === id)!;
function begin(id: string) {
  const before = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === id));
  return new Campaign({ version: 1, selected: id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) });
}
const choose = (s: Stage, alternative: boolean) => playWitness(alternative ? { ...s, witness: s.alternatives![0] } : s);
function omitRole(s: Stage, role: number) {
  const sections: WitnessAction[][] = [[]];
  for (const a of s.witness) { sections.at(-1)!.push(a); if ('record' in a) sections.push([]); }
  return { ...s, witness: sections.filter((_, i) => i !== role).flat() };
}

for (const [i, id] of ['C7-4-a', 'C7-4-b', 'C7-4-c'].entries()) test(`${id}: all three recorded roles contribute and the credential changes hands across arrangements`, () => {
  const s = find(id), win = playWitness(s);
  assert.equal(win.echoes.length, 3); assert.equal(win.tokenOwner, i === 0 ? 'echo:2' : i === 1 ? 'player' : 'echo:0');
  assert.ok(win.evidenceDeposited); assert.ok(win.authorized.has('SIGNED'));
  if (i === 0 || i === 2) assert.ok(win.activePlates.has('C'));
  for (let role = 0; role < 3; role++) assert.throws(() => playWitness(omitRole(s, role)), /blocked|did not finish|exceeded|caught/);
});

for (const signed of [false, true]) test(`the ${signed ? 'signed' : 'manual'} future entrance follows the restored-current-exit decision through all three saved stages`, () => {
  let c = begin('C7-5'), cut = false, restored = false;
  const first = c.stage;
  const win = playWitness(signed ? { ...first, witness: first.alternatives![0] } : first, g => {
    if (g.evidenceDeposited && !g.circuits.get('CIV')) cut = true;
    if (cut && g.circuits.get('CIV')) restored = true;
  });
  assert.ok(cut && restored); assert.ok(c.commit(win)); c = new Campaign(c.export());
  assert.equal(c.stage.level.id, signed ? 'C7-5-b-signed' : 'C7-5-b');
  assert.ok(c.commit(playWitness(c.stage))); c = new Campaign(c.export());
  let stopped = false, resumed = false;
  const last = playWitness(c.stage, g => {
    if (g.evidenceDeposited && !g.circuits.get('CIV')) { stopped = true; assert.equal(g.evidenceReceipts.size, 0); }
    if (stopped && g.circuits.get('CIV') && g.evidenceReaders.size) resumed = true;
  });
  assert.ok(stopped && resumed); assert.ok(c.commit(last)); assert.equal(new Campaign(c.export()).cleared(), 3);
  c.returnTo(0); assert.deepEqual(c.data.outcomes, {}); c.commit(choose(c.stage, !signed));
  assert.equal(c.stage.level.id, signed ? 'C7-5-b' : 'C7-5-b-signed');
});

for (const open of [false, true]) test(`all five final stages complete the ${open ? 'public archive' : 'private return'} ending with real delivery and refreshable checkpoints`, () => {
  let c = begin('C7-6'); assert.equal(c.revisitEnding(), false);
  for (let i = 0; i < 5; i++) {
    const win = choose(c.stage, i === 3 && open);
    if (i === 1) { assert.equal(win.tokenOwner, 'player'); assert.ok(win.authorized.has('ROOT') && win.authorized.has('RESTORED')); }
    if (i === 2) assert.ok(win.evidenceReceipts.has('G1'));
    if (i === 4) {
      assert.equal(win.level.id, open ? 'C7-6-e' : 'C7-6-e-return'); assert.ok(win.evidenceDeposited);
      if (open) assert.deepEqual([...win.evidenceReceipts].sort(), ['G1', 'G2']);
      else { assert.ok(win.authorized.has('CONSENT')); assert.equal(win.circuits.get('CIV'), true); }
    }
    assert.ok(c.commit(win)); c = new Campaign(c.export());
    assert.equal(c.cleared(), i + 1);
    if (i < 4) { assert.equal(c.ending, undefined); assert.deepEqual(c.data.endings, []); }
  }
  assert.equal(c.ending?.id, open ? 'open-archive' : 'return-memories');
  assert.match(c.ending!.reunion.join(''), /旧渡口.*关掉了投影器.*沈舟.*热茶/);
  assert.deepEqual(c.data.endings, [c.ending!.id]); assert.equal(c.nextMission, undefined);
});

test('ending rollback preserves the first three stages and historical endings, while discarding the final choice and delivery', () => {
  let c = begin('C7-6'); for (let i = 0; i < 5; i++) c.commit(playWitness(c.stage));
  assert.ok(c.revisitEnding()); c = new Campaign(c.export());
  assert.equal(c.cleared(), 3); assert.equal(c.stage.level.id, 'C7-6-d'); assert.equal(c.ending, undefined);
  assert.deepEqual(c.data.outcomes, {}); assert.deepEqual(c.data.endings, ['return-memories']);
  assert.equal(c.commit(playWitness(find('C7-6-e'))), false);
  c.commit(choose(c.stage, true)); c.commit(playWitness(c.stage)); c = new Campaign(c.export());
  assert.deepEqual(c.data.endings, ['return-memories', 'open-archive']); assert.equal(c.ending?.id, 'open-archive');
  assert.ok(c.revisitEnding()); c.commit(choose(c.stage, true)); c.commit(playWitness(c.stage)); assert.equal(c.data.endings!.length, 2);
});

test('old saves unlock the new continuation; malformed or unrelated ending records are discarded', () => {
  const c = begin('C7-3'); for (let i = 0; i < 3; i++) c.commit(playWitness(c.stage));
  const restored = new Campaign(c.export()); assert.equal(restored.nextMission?.id, 'C7-4'); assert.ok(restored.available('C7-4'));
  const invalid = c.export(); invalid.endings = ['open-archive', 'unknown', 'return-memories']; assert.deepEqual(new Campaign(invalid).data.endings, []);
  const finish = begin('C7-6'); for (let i = 0; i < 5; i++) finish.commit(playWitness(finish.stage));
  const save = finish.export(); save.endings = ['return-memories', 'return-memories', 'unknown'];
  assert.deepEqual(new Campaign(save).data.endings, ['return-memories']);
  delete save.outcomes!['C7-6-d'];
  const missingChoice = new Campaign(save); assert.equal(missingChoice.cleared(), 3); assert.equal(missingChoice.ending, undefined); assert.deepEqual(missingChoice.data.endings, []);
});

test('the entire 48-mission, 132-zone mainline survives a reload at every real checkpoint and ends in the reunion', () => {
  let c = new Campaign(), zones = 0;
  const main = MISSIONS.filter(m => !m.id.startsWith('LAB-'));
  assert.equal(main.length, 48);
  for (const mission of main) {
    assert.ok(c.select(mission.id));
    for (let i = 0; i < mission.stages.length; i++) { assert.ok(c.commit(playWitness(c.stage))); c = new Campaign(c.export()); zones++; }
    assert.ok(c.data.completed.includes(mission.id));
  }
  assert.equal(zones, 132); assert.equal(c.data.completed.filter(id => !id.startsWith('LAB-')).length, 48);
  assert.equal(c.ending?.id, 'return-memories'); assert.equal(c.nextMission, undefined);
});

test('the final return cannot bypass post-delivery civilian restoration, and public delivery cannot skip independent witnesses', () => {
  const privateStage = find('C7-6-e-return');
  assert.throws(() => playWitness({ ...privateStage, witness: privateStage.witness.filter((_, i) => i !== privateStage.witness.length - 2) }), /did not finish/);
  const publicStage = find('C7-6-e');
  assert.throws(() => playWitness({ ...publicStage, witness: publicStage.witness.filter(a => !('press' in a && a.press === 'lure')) }), /did not finish/);
});

for (const mobile of [false, true]) test(`the complete prologue finale supports ${mobile ? 'one keeper changing posts' : 'two persistent keepers'} without changing published geometry`, () => {
  let c = begin('C0-6');
  for (let i = 0; i < 3; i++) {
    const s = c.stage;
    const win = playWitness(mobile && i === 1 ? { ...s, witness: s.alternatives![0] } : s);
    if (i === 1) {
      assert.equal(win.echoes.length, mobile ? 1 : 2);
      if (mobile) {
        const frames = win.echoes[0].frames;
        assert.ok(frames.some(f => Math.hypot(f.x - 208, f.y - 208) < 5));
        assert.ok(Math.hypot(frames.at(-1)!.x - 496, frames.at(-1)!.y - 464) < 5);
        assert.equal(win.activePlates.has('A'), false); assert.equal(win.activePlates.has('B'), true);
      }
    }
    assert.ok(c.commit(win)); c = new Campaign(c.export());
  }
  assert.equal(c.cleared(), 3); assert.ok(c.available('C1-1'));
});

test('the mobile keeper must allow time to cross A before changing posts', () => {
  const s = find('C0-6-b'), witness = s.alternatives![0].filter(a => !('wait' in a));
  assert.throws(() => playWitness({ ...s, witness }), /blocked|did not finish|exceeded/);
});
