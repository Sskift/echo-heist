import assert from 'node:assert/strict';
import { MISSIONS, stageVersions, type Mission } from '../src/campaign-content.ts';
import { CONTRACTS, CONTRACT_FAMILIES } from '../src/contract-content.ts';
import { ContractBook } from '../src/contracts.ts';
import { Game } from '../src/engine.ts';
import { Campaign } from '../src/campaign.ts';
import { playWitness } from '../src/witness.ts';
import { doorPlates, WIDTH, HEIGHT, TILE } from '../src/levels.ts';
import { STORY } from '../src/story.ts';
import { passageLandmarks, roomJourney } from '../src/room-journey.ts';

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
const wins = new Map<string, Game>();
let zones = 0, layouts = 0;
const contractMissions: Mission[]=CONTRACTS.map(c=>({id:c.stage.level.id,chapter:'夜班委托',title:c.title,summary:c.request,evidence:'委托已交差',stages:[c.stage]}));
for (const mission of [...MISSIONS,...contractMissions]) {
  const preparations = mission.preparations ?? [];
  const facts = new Set(preparations.map(p => p.id));
  assert.equal(facts.size, preparations.length, `Duplicate preparation in ${mission.id}`);
  if (preparations.length) assert.equal(preparations[0].sources.length, 0, 'Original route must remain available to old saves');
  for (const p of preparations) {
    assert.ok(/^[a-z0-9-]+$/.test(p.id) && p.label.trim() && p.effect.trim() && p.cost.trim(), `Invalid preparation ${p.id}`);
    for (const source of p.sources) assert.ok(MISSIONS.slice(0, MISSIONS.indexOf(mission)).some(m => m.id === source), `Unobtainable preparation evidence ${source}`);
  }
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
    assert.ok(level.echoLimit===undefined || [1,2,3].includes(level.echoLimit), `Invalid echo limit in ${level.id}`);
    if (level.lostProperty) assert.ok(level.lostProperty.x >= TILE && level.lostProperty.x <= WIDTH - TILE && level.lostProperty.y >= TILE && level.lostProperty.y <= HEIGHT - TILE, `Invalid lost-property landmark in ${level.id}`);
    if (stage.ending) assert.ok(base === mission.stages.at(-1) && mission.endingAnchor !== undefined && stage.ending.title.trim() && stage.ending.consequence.trim() && stage.ending.reunion.length >= 2 && stage.ending.reunion.every(p => p.trim()), `Incomplete ending in ${level.id}`);
    assert.ok(!ids.has(level.id), `Duplicate action zone ${level.id}`); ids.add(level.id);
    if (stage.requires) assert.ok(facts.has(stage.requires), `Unavailable prerequisite ${stage.requires}`);
    const unique = (values: { id: string }[]) => assert.equal(new Set(values.map(v => v.id)).size, values.length, `Duplicate entity in ${level.id}`);
    unique(level.plates); unique(level.doors); unique(level.circuits ?? []); unique(level.terminals ?? []); unique(level.scanners ?? []); unique(level.suppressors ?? []); unique(level.glass ?? []); unique(level.soundMarkers ?? []);
    if (stage.outcomes) {
      unique(stage.outcomes);
      assert.equal(stage.outcomes.length, 2, `A circuit decision needs two outcomes in ${level.id}`);
      const [a, b] = stage.outcomes;
      if ('power' in a && 'power' in b) {
        assert.equal(a.power.id, b.power.id, `Outcomes must inspect the same circuit in ${level.id}`);
        assert.notEqual(a.power.on, b.power.on, `Outcomes must cover opposite states in ${level.id}`);
      } else {
        assert.ok('credentialAt' in a && 'credentialAt' in b && a.credentialAt !== b.credentialAt, `Ambiguous credential outcome in ${level.id}`);
      }
      for (const outcome of stage.outcomes) assert.ok(('power' in outcome ? level.circuits?.some(c => c.id === outcome.power.id) : level.credential?.exitOwners.includes(outcome.credentialAt)) && /^[a-zA-Z0-9-]+$/.test(outcome.id) && outcome.label.trim() && outcome.consequence.trim(), `Invalid outcome in ${level.id}`);
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
      if (terminal.appearance === 'lost-property') assert.ok(level.lostProperty && terminal.x === level.lostProperty.x && terminal.y === level.lostProperty.y + TILE && terminal.kind === 'relay' && terminal.transfer === 'give', `Invalid lost-property receiving slot in ${level.id}`);
      if (terminal.window) assert.ok(terminal.window[0] >= 0 && terminal.window[1] > terminal.window[0] && terminal.window[1] <= 12, `Invalid terminal window in ${level.id}`);
      if (terminal.plate) assert.ok(level.plates.some(p => p.id === terminal.plate), `Unknown terminal plate in ${level.id}`);
      if (terminal.requiresAuthorization) assert.ok(level.credential?.incomingAuthorizations?.includes(terminal.requiresAuthorization) || level.terminals?.some(t => t.authorization === terminal.requiresAuthorization && t.id !== terminal.id), `Unknown prerequisite authorization in ${level.id}`);
      if (terminal.kind === 'lock') assert.ok(terminal.authorization && !terminal.waitForDelivery && !terminal.transfer, `Invalid lock in ${level.id}`);
      else assert.ok(!terminal.authorization, `Only locks grant authorization in ${level.id}`);
      if (terminal.transfer === 'give') assert.ok(!terminal.waitForDelivery, `A return slot cannot wait for pickup in ${level.id}`);
    }
    for (const door of level.doors) {
      for (const plate of doorPlates(door)) assert.ok(level.plates.some(p => p.id === plate), `Unknown plate in ${level.id}`);
      if (door.authorization) assert.ok(level.credential?.incomingAuthorizations?.includes(door.authorization) || level.terminals?.some(t => t.authorization === door.authorization), `Missing authorization in ${level.id}`);
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
    for (const {at, label} of passageLandmarks(level)) assert.ok(label.trim() && at.x >= TILE && at.x <= WIDTH - TILE && at.y >= TILE && at.y <= HEIGHT - TILE && !game.blocked(at.x, at.y), `Invalid passage landmark in ${level.id}`);
    const source = level.continuity ? wins.get(level.continuity.source) : undefined;
    const carry = source ? { level: source.level, echo: source.echoes[0] } : undefined;
    if (level.continuity) assert.ok(carry && source?.level.handoff, `Missing retained recording for ${level.id}`);
    for (const c of level.circuits ?? []) if (c.feed) assert.ok((c.feed.remote ? carry?.level : level)?.plates.some(p => p.id === c.feed!.plate), `Unknown feeder plate in ${level.id}`);
    if (level.credential) {
      const c = level.credential, stableOwner = (o: string) => o === 'player' || !!level.terminals?.some(t => t.kind !== 'lock' && o === `terminal:${t.id}`);
      assert.ok(c.id && c.label && c.exitOwners.length && c.exitOwners.every(stableOwner), `Invalid checkpoint owner in ${level.id}`);
      if (c.receiveByPlayer) assert.ok(level.terminals?.some(t => t.id === c.receiveByPlayer), `Missing personal pickup in ${level.id}`);
      for (const auth of c.exitAuthorizations ?? []) assert.ok(c.incomingAuthorizations?.includes(auth) || level.terminals?.some(t => t.authorization === auth), `Missing exported signature in ${level.id}`);
      if (c.from) {
        const upstream = mission.stages.find(s => s.level.id === c.from);
        assert.ok(upstream && mission.stages.indexOf(upstream) < mission.stages.indexOf(base), `Invalid credential dependency in ${level.id}`);
        assert.ok(!level.terminals?.some(t => t.kind === 'source'), `Credential was regenerated in ${level.id}`);
        assert.ok(c.incomingOwners?.length && c.incomingOwners.every(stableOwner), `Invalid arrival owner in ${level.id}`);
        assert.ok(stageVersions(upstream).some(s => s.level.credential?.id === c.id && c.incomingOwners?.every(o => s.level.credential?.exitOwners.includes(o)) && c.incomingAuthorizations?.every(a => s.level.credential?.exitAuthorizations?.includes(a)) !== false), `Credential provenance missing in ${level.id}`);
      }
    }
    if (!level.credential?.from) {
      const win = playWitness(stage, carry);
      wins.set(level.id, win);
      for (const witness of stage.alternatives ?? []) playWitness({ ...stage, witness }, carry);
      console.log(`${level.id.padEnd(14)} ${win.seconds.toFixed(2)}s / ${win.echoes.length} echoes / validated`);
    }
    layouts++;
    }
    stageVersions(base).forEach(s => { s.grants.forEach(f => facts.add(f)); s.outcomes?.forEach(o => facts.add(o.id)); });
    zones++;
  }
}
// Validate reachable combinations, not just each layout in isolation. Every
// outcome must have a real input witness from every prefix that reaches it.
for (const mission of MISSIONS.filter(m => m.preparations?.length || m.stages.some(s => stageVersions(s).some(v => v.outcomes?.length || v.level.credential?.from)))) {
  const before = MISSIONS.slice(0, MISSIONS.indexOf(mission));
  let prefixes = [new Campaign({ version: 1, selected: mission.id, runs: Object.fromEntries(before.map(m => [m.id, []])), completed: before.map(m => m.id) })];
  if (mission.preparations) prefixes = mission.preparations.map(p => {
    const campaign = new Campaign(prefixes[0].export());
    assert.ok(campaign.choosePreparation(p.id), `Cannot prepare ${p.id}`);
    return campaign;
  });
  for (let index = 0; index < mission.stages.length; index++) {
    const next = new Map<string, Campaign>();
    for (const prefix of prefixes) {
      assert.ok((mission.stages[index].variants ?? []).filter(v => prefix.flags.includes(v.when)).length <= 1, `Ambiguous branch in ${mission.id} stage ${index}`);
      const stage = prefix.stage, reached = new Set<string>();
      for (const witness of [stage.witness, ...stage.alternatives ?? []]) {
        const win = playWitness({ ...stage, witness }, prefix.carryFor(stage.level.id), prefix.credentialFor(stage.level.id)), campaign = new Campaign(prefix.export());
        assert.ok(campaign.commit(win), `Cannot commit ${stage.level.id}`);
        const saved = campaign.export(), journey = roomJourney(campaign, win);
        if (index + 1 < mission.stages.length) {
          assert.ok(journey, `Missing room journey after ${stage.level.id}`);
          assert.ok(journey.title.trim() && journey.detail.trim(), `Empty room journey after ${stage.level.id}`);
          assert.deepEqual(journey.arrival, campaign.stage.level.spawn, `Journey enters the wrong branch after ${stage.level.id}`);
        } else assert.equal(journey, undefined, `Journey invented after the end of ${mission.id}`);
        assert.deepEqual(campaign.export(), saved, `Presentation changed checkpoint facts after ${stage.level.id}`);
        const selected = campaign.data.outcomes?.[mission.stages[index].level.id];
        if (selected) reached.add(selected);
        const restored = new Campaign(campaign.export());
        assert.equal(restored.cleared(), index + 1, `Cannot restore ${stage.level.id}`);
        next.set(JSON.stringify([restored.data.outcomes, restored.data.preparations]), restored);
      }
      for (const outcome of stage.outcomes ?? []) assert.ok(reached.has(outcome.id), `No executable choice ${outcome.id} after ${JSON.stringify(prefix.data.outcomes)}`);
    }
    prefixes = [...next.values()];
  }
  assert.ok(prefixes.every(c => c.data.completed.includes(mission.id)), `Incomplete route in ${mission.id}`);
  if (mission.endingAnchor !== undefined) assert.ok(prefixes.every(c => c.ending && c.data.endings?.includes(c.ending.id)), `Ending not committed after final delivery in ${mission.id}`);
  console.log(`${mission.id}: ${prefixes.length} complete choice combinations survived checkpoint reloads`);
}
assert.equal(new Set(CONTRACTS.map(c=>c.id)).size,CONTRACTS.length,'Duplicate contract');
for (const family of CONTRACT_FAMILIES) assert.ok(CONTRACTS.filter(c=>c.family===family).length>=2,`Insufficient arrangements for ${family}`);
for (const c of CONTRACTS) {
  assert.ok(c.conditions.length>=3 && c.stage.level.echoLimit && c.stage.level.setting,`Incomplete contract briefing ${c.id}`);
  assert.equal(c.stage.level.briefing[0],c.request,`Opening must present the commission in ${c.id}`);
  assert.ok(!c.stage.level.briefing.includes(c.stage.level.hint),`Full solution leaked into opening in ${c.id}`);
  const book=new ContractBook(undefined,()=>true);
  while (!book.offers.some(o=>o.id===c.id)) book.refresh();
  assert.ok(book.accept(c.id));
  const win=wins.get(c.stage.level.id)!;
  assert.ok(win.echoes.length<=win.echoLimit && book.commit(win),`Invalid contract completion ${c.id}`);
  const restored=new ContractBook(book.export(),()=>true);
  assert.equal(restored.active?.id,c.id); assert.deepEqual(restored.score(c.id),book.score(c.id));
}
console.log(`${MISSIONS.length} missions + ${CONTRACTS.length} contracts / ${zones} action zones / ${layouts} layouts: references and executable solutions passed. This does not measure first-play duration.`);
