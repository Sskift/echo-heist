import assert from 'node:assert/strict';
import { MISSIONS } from '../src/campaign-content.ts';
import { Game } from '../src/engine.ts';
import { playWitness } from '../src/witness.ts';
import { doorPlates, WIDTH, HEIGHT, TILE } from '../src/levels.ts';

const ids = new Set<string>();
let zones = 0;
for (const mission of MISSIONS) {
  const facts = new Set<string>();
  for (const stage of mission.stages) {
    const level = stage.level;
    assert.ok(!ids.has(level.id), `Duplicate action zone ${level.id}`); ids.add(level.id);
    if (stage.requires) assert.ok(facts.has(stage.requires), `Unavailable prerequisite ${stage.requires}`);
    stage.grants.forEach(flag => facts.add(flag));
    const unique = (values: { id: string }[]) => assert.equal(new Set(values.map(v => v.id)).size, values.length, `Duplicate entity in ${level.id}`);
    unique(level.plates); unique(level.doors); unique(level.circuits ?? []); unique(level.terminals ?? []);
    assert.ok((level.terminals ?? []).filter(t => t.kind === 'source').length <= 1, `Multiple credentials in ${level.id}`);
    for (const door of level.doors) {
      for (const plate of doorPlates(door)) assert.ok(level.plates.some(p => p.id === plate), `Unknown plate in ${level.id}`);
      if (door.authorization) assert.ok(level.terminals?.some(t => t.authorization === door.authorization), `Missing authorization in ${level.id}`);
    }
    for (const scanner of level.scanners ?? []) {
      assert.ok(scanner.period > 0 && scanner.period <= 12 && scanner.active[0] >= 0 && scanner.active[1] > scanner.active[0] && scanner.active[1] <= scanner.period, `Invalid scanner cycle ${level.id}`);
    }
    for (const entity of [...level.doors, ...level.guards, ...level.suppressors ?? [], ...level.scanners ?? []]) {
      if (entity.power) assert.ok(level.circuits?.some(c => c.id === entity.power!.id), `Unknown circuit in ${level.id}`);
    }
    for (const wall of level.walls) assert.ok(wall.x >= 0 && wall.y >= 0 && wall.x + TILE <= WIDTH && wall.y + TILE <= HEIGHT, `Wall outside ${level.id}`);
    const game = new Game(level);
    for (const point of [level.spawn, level.exit ?? level.spawn, ...level.plates, ...level.circuits ?? [], ...level.terminals ?? [], ...(level.objective === 'reach' ? [] : [level.loot])]) {
      assert.ok(!game.blocked(point.x, point.y), `Entity inside obstacle: ${level.id} at ${point.x},${point.y}`);
    }
    const win = playWitness(stage);
    for (const witness of stage.alternatives ?? []) playWitness({ ...stage, witness });
    console.log(`${level.id.padEnd(14)} ${win.seconds.toFixed(2)}s / ${win.echoes.length} echoes / validated`);
    zones++;
  }
}
console.log(`${MISSIONS.length} missions / ${zones} action zones: references and executable solutions passed. This does not measure first-play duration.`);
