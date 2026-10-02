import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentArt } from '../src/environment-art.ts';
import { setting } from '../src/set-dressing.ts';
import { MISSIONS, stageVersions } from '../src/campaign-content.ts';
import { CONTRACTS } from '../src/contract-content.ts';
import { LEVELS } from '../src/levels.ts';
import { Game } from '../src/engine.ts';
import { firstLesson, SceneFeedback } from '../src/scene-feedback.ts';

const levels = [...LEVELS, ...CONTRACTS.map(c => c.stage.level), ...MISSIONS.flatMap(m => m.stages.flatMap(s => stageVersions(s).map(v => v.level)))];
function vertices(root: THREE.Group, visit: (p: THREE.Vector3) => void) {
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const positions = o.geometry.getAttribute('position'), point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) visit(point.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld));
  });
}
function dispose(root: THREE.Group) {
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
}

test('chapter architecture never occupies walkable space, including contracts and variants', () => {
  const tested = new Map<string, Set<string>>();
  for (const level of levels) {
    const style = setting(level), key = `${style}:${!!(level.handoff || level.continuity)}`;
    if (!tested.has(key)) {
      const root = new THREE.Group(), art = new EnvironmentArt(level, true), cells = new Set<string>(); art.exterior(root);
      vertices(root, p => {
        if (p.y <= .04 || p.x <= -15 || p.x >= 15 || p.z <= -9 || p.z >= 9) return;
        // Every above-floor vertex lies in the outer collision rim; no long
        // triangle may bridge the interior because each backdrop stays north
        // or west of it (a convex half-plane for every individual solid).
        assert.ok(p.x < -14 || p.z < -8, `${level.id}: backdrop entered room at ${p.toArray()}`);
        cells.add(`${Math.floor(p.x + 15)},${Math.floor(p.z + 9)}`);
      });
      dispose(root); tested.set(key, cells);
      const base = new THREE.Group(); art.foundation(base);
      vertices(base, p => assert.ok(p.y <= .02, `${style}: foundation rises through the playable deck`)); dispose(base);
    }
    const walls = new Set(level.walls.map(p => `${p.x / 32},${p.y / 32}`));
    for (const cell of tested.get(key)!) assert.ok(walls.has(cell), `${level.id}: backdrop falsely blocks ${cell}`);
  }
  assert.ok(tested.size >= 8);
});

test('architectural wall details stay inside the real obstacle footprint', () => {
  for (const level of [...new Map(levels.map(l => [setting(l), l])).values()]) {
    const art = new EnvironmentArt(level, true);
    for (const [width, depth] of [[30, 1], [1, 16], [5, 1], [1, 3], [2, 2]]) for (const border of [true, false]) {
      const root = new THREE.Group(); art.wall(root, width, depth, art.wallHeight(border, false, false), border, false);
      vertices(root, p => assert.ok(Math.abs(p.x) <= width / 2 + .001 && Math.abs(p.z) <= depth / 2 + .001, `${setting(level)} ${width}×${depth}: detail protrudes into a path: ${p.toArray()}`));
      dispose(root);
    }
  }
});

test('first lessons follow real pressure, recording and collection without changing game state', () => {
  const level = MISSIONS.find(m => m.id === 'C0-2')!.stages[0].level;
  const game = new Game(level), plate = level.plates[0]; game.start();
  assert.equal(firstLesson(game).at, plate); assert.equal(firstLesson(game).record, false);
  game.player.x = plate.x; game.player.y = plate.y;
  game.step({x:0,y:0,lure:false}); game.step({x:0,y:0,lure:false});
  assert.equal(firstLesson(game).record, true);
  game.togglePause(); assert.equal(firstLesson(game).record, false); game.togglePause();
  assert.equal(game.rewind(), true);
  assert.equal(firstLesson(game).record, false); assert.equal(firstLesson(game).at, level.loot);
  game.player.x = level.loot.x; game.player.y = level.loot.y; game.step({x:0,y:0,lure:false});
  assert.equal(game.hasLoot, true); assert.deepEqual(firstLesson(game).at, game.exitPoint);
  assert.deepEqual(firstLesson(game.previewAt(30)), {record:false});
  game.clear(); assert.equal(firstLesson(game).at, plate);
});

test('visual transitions freeze with simulation and reset on retries and preview seeks', () => {
  const game = new Game(LEVELS[0]), feedback = new SceneFeedback(); game.start(); feedback.sample(game);
  const plate = game.level.plates[0]; game.player.x = plate.x; game.player.y = plate.y;
  game.step({x:0,y:0,lure:false}); feedback.sample(game);
  assert.equal(feedback.age('plate:A'), 0); assert.equal(feedback.age('door:A'), 0);
  game.togglePause(); for (let i = 0; i < 10; i++) { game.step({x:0,y:0,lure:false}); feedback.sample(game); }
  assert.equal(feedback.age('door:A'), 0);
  game.restart(); feedback.sample(game); assert.ok(feedback.age('door:A') > 48);
  const preview = game.previewAt(90); feedback.sample(preview); assert.ok(feedback.age('door:A') > 48);
  feedback.sample(game.previewAt(20)); assert.ok(feedback.age('door:A') > 48);
});
