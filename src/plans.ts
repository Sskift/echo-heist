import type { Echo, Frame } from './engine.ts';
import { HEIGHT, MAX_ECHOES, MAX_FRAMES, WIDTH } from './levels.ts';

// Bump this version when a level's geometry or replay semantics change.
export const PLAN_VERSION = 2;
export const PLAN_KEY = 'echo-heist-plans-v1';
export type SavedPlan = { version: number; levelId: string; echoes: Echo[] };

export function encodePlan(levelId: string, echoes: Echo[]): SavedPlan {
  return { version: PLAN_VERSION, levelId, echoes: echoes.map(echo => ({ ...echo, frames: echo.frames.map(frame => ({ ...frame, ...(frame.intent ? { intent: { ...frame.intent } } : {}) })) })) };
}

function isFrame(value: unknown): value is Frame {
  if (!value || typeof value !== 'object') return false;
  const f = value as Frame;
  return Number.isFinite(f.x) && f.x >= 0 && f.x <= WIDTH &&
    Number.isFinite(f.y) && f.y >= 0 && f.y <= HEIGHT &&
    Number.isFinite(f.angle) && Math.abs(f.angle) <= Math.PI * 2 && typeof f.lure === 'boolean' &&
    (f.intent === undefined || (!!f.intent && typeof f.intent === 'object' && typeof f.intent.id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(f.intent.id) &&
      (f.intent.type === 'circuit' ? typeof f.intent.on === 'boolean' : ['take', 'give', 'authorize', 'deposit'].includes(f.intent.type))));
}

export function decodePlan(value: unknown, levelId: string): Echo[] | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as SavedPlan;
  if (![1, PLAN_VERSION].includes(plan.version) || plan.levelId !== levelId || !Array.isArray(plan.echoes) || plan.echoes.length > MAX_ECHOES) return null;
  const colors = new Set<number>();
  for (const echo of plan.echoes) {
    if (!echo || typeof echo !== 'object' || !Number.isInteger(echo.colorIndex) || echo.colorIndex < 0 || echo.colorIndex >= MAX_ECHOES || colors.has(echo.colorIndex)) return null;
    if (!Array.isArray(echo.frames) || echo.frames.length < 2 || echo.frames.length > MAX_FRAMES || !echo.frames.every(isFrame)) return null;
    if (echo.delay !== undefined && (!Number.isInteger(echo.delay) || echo.delay < 0 || echo.delay > 360 || echo.delay % 15 !== 0)) return null;
    colors.add(echo.colorIndex);
  }
  return encodePlan(levelId, plan.echoes).echoes;
}
