import type { Point } from './levels.ts';
export const VIEW_WIDTH = 1280, VIEW_HEIGHT = 800;
// Rotate screen input; normalization and all recorded poses remain in the engine.
export function screenMovement(x: number, y: number): Point { return { x: x + y, y: y - x }; }
