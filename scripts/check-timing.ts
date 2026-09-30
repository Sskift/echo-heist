import { MISSIONS, stageVersions, type Stage, type WitnessAction } from '../src/campaign-content.ts';
import { playWitness } from '../src/witness.ts';

// A deterministic author check, not a human playtest or a proof about all paths.
// Perturb one action at a time; never mutate the map, clock speed, or game state.
const scope = process.argv[2];
if (process.argv.length > 3 || (scope && !/^C[0-7](?:-\d+(?:-[a-z]+(?:-[a-z]+)?)?)?$/.test(scope))) {
  console.error('Usage: npm run check:timing -- [chapter, mission, or layout ID]'); process.exit(2);
}
type Finding = { layout: string; route: number; action: number; input: WitnessAction; failures: { frames: number; reason: string }[] };
const findings: Finding[] = [];
let layouts = 0, references = 0, probes = 0;
function check(stage: Stage, route: number, witness: WitnessAction[]) {
  playWitness({ ...stage, witness }); references++;
  for (const [index, action] of witness.entries()) {
    const offsets = 'wait' in action ? [-12, -6, -2, -1, 1, 2, 6, 12] : 'press' in action ? [1, 2, 6, 12] : 'record' in action ? [1, 2, 6, 12, 60] : [];
    const failures: Finding['failures'] = [];
    for (const frames of offsets) {
      if ('wait' in action && action.wait + frames < 0) continue;
      const adjusted = structuredClone(witness);
      if ('wait' in action) adjusted[index] = { wait: action.wait + frames };
      else adjusted.splice(index, 0, { wait: frames });
      probes++;
      try { playWitness({ ...stage, witness: adjusted }); }
      catch (error) { failures.push({ frames, reason: String(error) }); }
    }
    if (failures.length) findings.push({ layout: stage.level.id, route, action: index, input: action, failures });
  }
}
for (const mission of MISSIONS.filter(m => !m.id.startsWith('LAB-'))) for (const base of mission.stages) for (const stage of stageVersions(base)) {
  if (scope && stage.level.id !== scope && !stage.level.id.startsWith(scope + '-')) continue;
  layouts++;
  [stage.witness, ...stage.alternatives ?? []].forEach((witness, route) => check(stage, route, witness));
}
if (!layouts) { console.error('No matching main-campaign layout'); process.exit(2); }
const tight = findings.filter(f => f.failures.some(failure => Math.abs(failure.frames) <= 2));
console.log(JSON.stringify({ scope: scope ?? 'main-campaign', layouts, references, probes, oneOrTwoFrameSensitiveActions: tight.length, findings,
  limitation: 'Single-action changes to authored routes only. Does not test arbitrary movement errors, combined delays, all possible solutions, blind-play quality, or human duration. Larger offsets flag review candidates, not inherently broken maps.' }, null, 2));
// A failure here means the route needs investigation, not that the map must be
// made easier: a better allocation or safer recording order may be sufficient.
if (tight.length) process.exitCode = 1;
