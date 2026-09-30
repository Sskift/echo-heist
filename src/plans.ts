import type { Echo, Frame } from './engine.ts';
import { HEIGHT, MAX_ECHOES, MAX_FRAMES, WIDTH } from './levels.ts';

// Bump this version when a level's geometry or replay semantics change.
export const PLAN_VERSION = 1;
export const PLAN_KEY = 'echo-heist-plans-v1';
export type SavedPlan = { version: number; levelId: string; echoes: Echo[] };

export function encodePlan(levelId: string, echoes: Echo[]): SavedPlan {
  return { version: PLAN_VERSION, levelId, echoes: echoes.map(echo => ({ colorIndex: echo.colorIndex, frames: echo.frames.map(frame => ({ ...frame })) })) };
}

function isFrame(value: unknown): value is Frame {
  if (!value || typeof value !== 'object') return false;
  const f = value as Frame;
  return Number.isFinite(f.x) && f.x >= 0 && f.x <= WIDTH &&
    Number.isFinite(f.y) && f.y >= 0 && f.y <= HEIGHT &&
    Number.isFinite(f.angle) && Math.abs(f.angle) <= Math.PI * 2 && typeof f.lure === 'boolean';
}

export function decodePlan(value: unknown, levelId: string): Echo[] | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as SavedPlan;
  if (plan.version !== PLAN_VERSION || plan.levelId !== levelId || !Array.isArray(plan.echoes) || plan.echoes.length > MAX_ECHOES) return null;
  const colors = new Set<number>();
  for (const echo of plan.echoes) {
    if (!echo || typeof echo !== 'object' || !Number.isInteger(echo.colorIndex) || echo.colorIndex < 0 || echo.colorIndex >= MAX_ECHOES || colors.has(echo.colorIndex)) return null;
    if (!Array.isArray(echo.frames) || echo.frames.length < 2 || echo.frames.length > MAX_FRAMES || !echo.frames.every(isFrame)) return null;
    colors.add(echo.colorIndex);
  }
  return encodePlan(levelId, plan.echoes).echoes;
}
