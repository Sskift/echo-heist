import assert from 'node:assert/strict';
import { MISSIONS, stageVersions } from '../src/campaign-content.ts';
import { Game } from '../src/engine.ts';
import { Campaign } from '../src/campaign.ts';
import { playWitness } from '../src/witness.ts';
import { doorPlates, WIDTH, HEIGHT, TILE } from '../src/levels.ts';
import { STORY } from '../src/story.ts';

assert.equal(new Set(STORY.map(s => s.id)).size, STORY.length, 'Duplicate story scene');
for (const scene of STORY) {
  assert.ok(MISSIONS.some(m => m.id === scene.mission && m.id.startsWith(`C${scene.chapter}-`)), `Unknown story checkpoint: ${scene.id}`);
  assert.ok(scene.pages.length && scene.pages.every(p => p.speaker.trim() && p.text.trim()), `Empty scene: ${scene.id}`);
  for (const page of scene.pages) if (page.response) {
    const previous = STORY.find(s => s.id === page.response!.scene);
    assert.ok(previous && STORY.indexOf(previous) < STORY.indexOf(scene) && Object.keys(page.response.options).every(id => previous.choice?.options.some(o => o.id === id)), `Invalid dialogue callback: ${scene.id}`);
  }
}

const ids = new Set<string>();
let zones = 0, layouts = 0;
for (const mission of MISSIONS) {
  const facts = new Set<string>();
  if (mission.endingAnchor !== undefined) {
    assert.ok(Number.isInteger(mission.endingAnchor) && mission.endingAnchor >= 0 && mission.endingAnchor < mission.stages.length - 1 && mission.stages[mission.endingAnchor].outcomes?.length, `Invalid ending rollback anchor in ${mission.id}`);
    const endings = stageVersions(mission.stages.at(-1)!).map(s => s.ending);
    assert.ok(endings.length >= 2 && endings.every(Boolean) && new Set(endings.map(e => e!.id)).size === endings.length, `Missing distinct endings in ${mission.id}`);
  }
  for (const base of mission.stages) {
    for (const variant of base.variants ?? []) {
      assert.ok(facts.has(variant.when), `Unknown branch prerequisite ${variant.when}`);
      assert.ok(!variant.stage.variants?.length, 'Nested stage variants are not supported');
      assert.deepEqual(variant.stage.grants, base.grants, 'Branches must preserve the shared checkpoint facts');
      assert.equal(variant.stage.requires, base.requires, 'Branches must preserve the shared prerequisite');
    }
    for (const stage of stageVersions(base)) {
    const level = stage.level;
    if (stage.ending) assert.ok(base === mission.stages.at(-1) && mission.endingAnchor !== undefined && stage.ending.title.trim() && stage.ending.consequence.trim() && stage.ending.reunion.length >= 2 && stage.ending.reunion.every(p => p.trim()), `Incomplete ending in ${level.id}`);
    assert.ok(!ids.has(level.id), `Duplicate action zone ${level.id}`); ids.add(level.id);
    if (stage.requires) assert.ok(facts.has(stage.requires), `Unavailable prerequisite ${stage.requires}`);
    const unique = (values: { id: string }[]) => assert.equal(new Set(values.map(v => v.id)).size, values.length, `Duplicate entity in ${level.id}`);
    unique(level.plates); unique(level.doors); unique(level.circuits ?? []); unique(level.terminals ?? []); unique(level.scanners ?? []); unique(level.suppressors ?? []); unique(level.glass ?? []); unique(level.soundMarkers ?? []);
    if (stage.outcomes) {
      unique(stage.outcomes);
      assert.equal(stage.outcomes.length, 2, `A circuit decision needs two outcomes in ${level.id}`);
      assert.equal(stage.outcomes[0].power.id, stage.outcomes[1].power.id, `Outcomes must inspect the same circuit in ${level.id}`);
      assert.notEqual(stage.outcomes[0].power.on, stage.outcomes[1].power.on, `Outcomes must cover opposite states in ${level.id}`);
      for (const outcome of stage.outcomes) assert.ok(level.circuits?.some(c => c.id === outcome.power.id) && /^[a-zA-Z0-9-]+$/.test(outcome.id) && outcome.label.trim() && outcome.consequence.trim(), `Invalid outcome in ${level.id}`);
    }
    unique(level.guards.filter(g => g.id !== undefined) as { id: string }[]);
    if (level.noiseResponse === 'nearest') assert.ok(level.guards.every(g => g.id), `Stable guard IDs required in ${level.id}`);
    for (const guard of level.guards) {
      assert.ok(guard.route.length && guard.route.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 32 && p.y >= 32 && p.x <= WIDTH - 32 && p.y <= HEIGHT - 32), `Invalid guard route in ${level.id}`);
      assert.ok(guard.speed >= 0 && guard.range > 0 && (guard.hearing === undefined || guard.hearing > 0) && (guard.searchSeconds === undefined || guard.searchSeconds > 0), `Invalid guard rules in ${level.id}`);
      if (guard.lighting) assert.ok(level.circuits?.some(c => c.id === guard.lighting!.id) && guard.lighting.darkRange > 0 && guard.lighting.darkRange <= guard.range, `Invalid lighting in ${level.id}`);
      if (guard.traceSeconds !== undefined) assert.ok(guard.kind === 'tracker' && Number.isFinite(guard.traceSeconds) && guard.traceSeconds > 0 && guard.traceSeconds <= 12, `Invalid tracker memory in ${level.id}`);
      if (guard.kind === 'tracker') assert.ok(guard.searchSeconds !== undefined, `Tracker needs an explicit arrival search duration in ${level.id}`);
    }
    for (const rect of [...level.glass ?? [], ...level.scanners ?? [], ...level.suppressors ?? []]) assert.ok(rect.w > 0 && rect.h > 0 && rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= WIDTH && rect.y + rect.h <= HEIGHT, `Invalid facility bounds in ${level.id}`);
    assert.ok((level.terminals ?? []).filter(t => t.kind === 'source').length <= 1, `Multiple credentials in ${level.id}`);
    for (const terminal of level.terminals ?? []) {
      if (terminal.window) assert.ok(terminal.window[0] >= 0 && terminal.window[1] > terminal.window[0] && terminal.window[1] <= 12, `Invalid terminal window in ${level.id}`);
      if (terminal.plate) assert.ok(level.plates.some(p => p.id === terminal.plate), `Unknown terminal plate in ${level.id}`);
      if (terminal.requiresAuthorization) assert.ok(level.terminals?.some(t => t.authorization === terminal.requiresAuthorization && t.id !== terminal.id), `Unknown prerequisite authorization in ${level.id}`);
      if (terminal.kind === 'lock') assert.ok(terminal.authorization && !terminal.waitForDelivery, `Invalid lock in ${level.id}`);
      else assert.ok(!terminal.authorization, `Only locks grant authorization in ${level.id}`);
    }
    for (const door of level.doors) {
      for (const plate of doorPlates(door)) assert.ok(level.plates.some(p => p.id === plate), `Unknown plate in ${level.id}`);
      if (door.authorization) assert.ok(level.terminals?.some(t => t.authorization === door.authorization), `Missing authorization in ${level.id}`);
    }
    for (const cycle of [...level.scanners ?? [], ...(level.suppressors ?? []).flatMap(s => s.cycle ? [s.cycle] : [])]) {
      assert.ok(cycle.period > 0 && cycle.period <= 12 && cycle.active[0] >= 0 && cycle.active[1] > cycle.active[0] && cycle.active[1] <= cycle.period && Number.isFinite(cycle.phase ?? 0), `Invalid facility cycle ${level.id}`);
    }
    for (const entity of [...level.doors, ...level.guards, ...level.suppressors ?? [], ...level.scanners ?? [], ...level.terminals ?? []]) {
      if (entity.power) assert.ok(level.circuits?.some(c => c.id === entity.power!.id), `Unknown circuit in ${level.id}`);
    }
    for (const powers of [level.lootPower, level.exitPower, level.onLoot?.power, level.delivery?.power, level.delivery?.onDeposit?.power]) {
      unique(powers ?? []);
      for (const p of powers ?? []) assert.ok(level.circuits?.some(c => c.id === p.id) && typeof p.on === 'boolean', `Invalid objective power in ${level.id}`);
    }
    if (level.onLoot) assert.ok(level.objective !== 'reach' && level.objective !== 'deliver' && level.onLoot.message.trim(), `Pickup consequence needs a collectible and warning in ${level.id}`);
    assert.equal(!!level.delivery, level.objective === 'deliver', `Delivery objective needs its target in ${level.id}`);
    if (level.delivery) {
      const d = level.delivery;
      assert.ok(/^[A-Za-z0-9_-]{1,32}$/.test(d.id) && d.label.trim(), `Invalid delivery in ${level.id}`);
      assert.ok(!level.lootPower?.length, `Use delivery power for ${level.id}`);
      assert.ok([...(level.circuits ?? []), ...(level.terminals ?? [])].every(t => Math.hypot(t.x - d.x, t.y - d.y) >= 60), `Overlapping interaction targets in ${level.id}`);
      if (d.window) assert.ok(d.window[0] >= 0 && d.window[1] > d.window[0] && d.window[1] <= 12, `Invalid delivery window in ${level.id}`);
      if (d.plate) assert.ok(level.plates.some(p => p.id === d.plate), `Unknown delivery plate in ${level.id}`);
      if (d.authorization) assert.ok(level.terminals?.some(t => t.authorization === d.authorization), `Unknown delivery authorization in ${level.id}`);
      if (d.onDeposit) assert.ok(d.onDeposit.message.trim(), `Missing deposit consequence warning in ${level.id}`);
      unique((d.receivers ?? []).map(r => ({ id: r.guard })));
      for (const receiver of d.receivers ?? []) {
        const guard = level.guards.find(g => g.id === receiver.guard);
        assert.ok(guard && (!guard.kind || guard.kind === 'patrol') && guard.speed > 0 && guard.searchSeconds && guard.route.some(p => p.x === receiver.at.x && p.y === receiver.at.y) && receiver.label.trim(), `Invalid delivery witness in ${level.id}`);
      }
    }
    for (const wall of level.walls) assert.ok(wall.x >= 0 && wall.y >= 0 && wall.x + TILE <= WIDTH && wall.y + TILE <= HEIGHT, `Wall outside ${level.id}`);
    const game = new Game(level);
    for (const point of [level.spawn, level.exit ?? level.spawn, ...level.plates, ...level.circuits ?? [], ...level.terminals ?? [], ...(level.delivery ? [level.delivery, ...level.delivery.receivers?.map(r => r.at) ?? []] : level.objective === 'reach' ? [] : [level.loot])]) {
      assert.ok(!game.blocked(point.x, point.y), `Entity inside obstacle: ${level.id} at ${point.x},${point.y}`);
    }
    const win = playWitness(stage);
    for (const witness of stage.alternatives ?? []) playWitness({ ...stage, witness });
    console.log(`${level.id.padEnd(14)} ${win.seconds.toFixed(2)}s / ${win.echoes.length} echoes / validated`);
    layouts++;
    }
    stageVersions(base).forEach(s => { s.grants.forEach(f => facts.add(f)); s.outcomes?.forEach(o => facts.add(o.id)); });
    zones++;
  }
}
// Validate reachable combinations, not just each layout in isolation. Every
// outcome must have a real input witness from every prefix that reaches it.
for (const mission of MISSIONS.filter(m => m.stages.some(s => stageVersions(s).some(v => v.outcomes?.length)))) {
  const before = MISSIONS.slice(0, MISSIONS.indexOf(mission));
  let prefixes = [new Campaign({ version: 1, selected: mission.id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) })];
  for (let index = 0; index < mission.stages.length; index++) {
    const next = new Map<string, Campaign>();
    for (const prefix of prefixes) {
      assert.ok((mission.stages[index].variants ?? []).filter(v => prefix.flags.includes(v.when)).length <= 1, `Ambiguous branch in ${mission.id} stage ${index}`);
      const stage = prefix.stage, reached = new Set<string>();
      for (const witness of [stage.witness, ...stage.alternatives ?? []]) {
        const win = playWitness({ ...stage, witness }), campaign = new Campaign(prefix.export());
        assert.ok(campaign.commit(win), `Cannot commit ${stage.level.id}`);
        const selected = campaign.data.outcomes?.[mission.stages[index].level.id];
        if (selected) reached.add(selected);
        const restored = new Campaign(campaign.export());
        assert.equal(restored.cleared(), index + 1, `Cannot restore ${stage.level.id}`);
        next.set(JSON.stringify(restored.data.outcomes), restored);
      }
      for (const outcome of stage.outcomes ?? []) assert.ok(reached.has(outcome.id), `No executable choice ${outcome.id} after ${JSON.stringify(prefix.data.outcomes)}`);
    }
    prefixes = [...next.values()];
  }
  assert.ok(prefixes.every(c => c.data.completed.includes(mission.id)), `Incomplete route in ${mission.id}`);
  if (mission.endingAnchor !== undefined) assert.ok(prefixes.every(c => c.ending && c.data.endings?.includes(c.ending.id)), `Ending not committed after final delivery in ${mission.id}`);
  console.log(`${mission.id}: ${prefixes.length} complete choice combinations survived checkpoint reloads`);
}
console.log(`${MISSIONS.length} missions / ${zones} action zones / ${layouts} branch layouts: references and executable solutions passed. This does not measure first-play duration.`);
