import { TILE, type Level, type Point } from './levels.ts';
import type { Stage, WitnessAction } from './campaign-content.ts';

export const g = (x: number, y: number): WitnessAction => ({ go: [x, y] });
export const w = (wait: number): WitnessAction => ({ wait });
export const r = (): WitnessAction => ({ record: true });
export const e = (): WitnessAction => ({ press: 'interact' });
export const noise = (): WitnessAction => ({ press: 'lure' });
export const point = (x: number, y: number) => ({ x, y });

// Room geometry is authored in tile coordinates. Each opening is deliberate;
// witnesses below are real input routes used by the content validator.
export function room(vertical: [number, number[]][] = [], horizontal: [number, number[]][] = [], blocks: [number, number][] = []): Point[] {
  const cells = new Set<string>();
  const put = (x: number, y: number) => cells.add(`${x},${y}`);
  for (let x = 0; x < 30; x++) { put(x, 0); put(x, 17); }
  for (let y = 0; y < 18; y++) { put(0, y); put(29, y); }
  for (const [x, gaps] of vertical) for (let y = 1; y < 17; y++) if (!gaps.includes(y)) put(x, y);
  for (const [y, gaps] of horizontal) for (let x = 1; x < 29; x++) if (!gaps.includes(x)) put(x, y);
  for (const [x, y] of blocks) put(x, y);
  return [...cells].map(cell => { const [x, y] = cell.split(',').map(Number); return point(x * TILE, y * TILE); });
}

export function level(id: string, title: string, properties: Partial<Level>): Level {
  return {
    id, title, subtitle: 'THE MISSING PARTNER', description: '', hint: '', briefing: [],
    spawn: point(112, 432), loot: point(816, 144), walls: room(), doors: [], plates: [], guards: [], par: 1,
    district: '旧馆 / OLD ARCHIVE', ...properties,
  };
}
export function stage(level: Level, story: string, result: string, grants: string[], witness: WitnessAction[], requires?: string): Stage {
  return { level: { ...level, description: level.description || story, briefing: [level.hint, ...level.briefing] }, story, result, grants, witness, requires };
}
export const gate = (id: string, x: number, y: number, plate = id) => ({ id, x, y, w: 32, h: 64, plate });
export const plate = (id: string, x: number, y: number) => ({ id, x, y });
