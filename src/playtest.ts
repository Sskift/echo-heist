export const PLAYTEST_BUILD = '0.7.0';
export const PLAYTEST_KEY = 'echo-heist-playtest-v1';
export type Phase = 'planning' | 'execution' | 'rehearsal' | 'help' | 'away' | 'unclassified';
export type Profile = { role: 'first-time' | 'returning' | 'developer'; experience: 'new' | 'regular'; externalGuide: boolean };
export type Context = { zoneId: string; missionId: string; phase: Phase };
export type PlaytestData = {
  kind: 'echo-heist-playtest'; schemaVersion: 1; id: string; builds: string[]; environment: 'browser' | 'automation';
  startedAt: string; updatedAt: string; profile: Profile;
  segments: (Context & { ms: number })[];
  events: { atMs: number; zoneId: string; kind: string; detail: string }[];
  completedZones: string[];
};
const phases: Phase[] = ['planning', 'execution', 'rehearsal', 'help', 'away', 'unclassified'];

export function decodePlaytest(value: unknown): PlaytestData | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as PlaytestData;
  if (d.kind !== 'echo-heist-playtest' || d.schemaVersion !== 1 || typeof d.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(d.id)) return null;
  if (!Array.isArray(d.builds) || !d.builds.length || !d.builds.every(b => typeof b === 'string' && b.length < 32)) return null;
  if (!['browser', 'automation'].includes(d.environment) || !Number.isFinite(Date.parse(d.startedAt)) || !Number.isFinite(Date.parse(d.updatedAt))) return null;
  if (!d.profile || !['first-time', 'returning', 'developer'].includes(d.profile.role) || !['new', 'regular'].includes(d.profile.experience) || typeof d.profile.externalGuide !== 'boolean') return null;
  const validId = (s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9-]{1,40}$/.test(s);
  if (!Array.isArray(d.segments) || d.segments.length > 100_000 || !d.segments.every(s => s && validId(s.zoneId) && validId(s.missionId) && phases.includes(s.phase) && Number.isFinite(s.ms) && s.ms >= 0)) return null;
  if (!Array.isArray(d.events) || d.events.length > 100_000 || !d.events.every(e => e && validId(e.zoneId) && Number.isFinite(e.atMs) && e.atMs >= 0 && typeof e.kind === 'string' && e.kind.length < 40 && typeof e.detail === 'string' && e.detail.length < 500)) return null;
  if (!Array.isArray(d.completedZones) || !d.completedZones.every(validId)) return null;
  return structuredClone(d);
}

// Use monotonic *wall* time supplied by the UI, never simulation frames. Thinking
// time remains visible for review; background time and unexplained long gaps do not count.
export class PlaytestRecorder {
  data: PlaytestData | null = null;
  recording = false;
  onBreak = false;
  private last: number | null = null;
  private context: Context | null = null;
  private elapsed = 0;
  constructor(raw?: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const stored = raw as { data?: unknown; recording?: unknown };
    this.data = decodePlaytest(stored.data);
    this.recording = !!this.data && stored.recording === true;
    if (this.data) {
      this.elapsed = this.data.segments.reduce((sum, s) => sum + s.ms, 0);
      if (!this.data.builds.includes(PLAYTEST_BUILD)) this.data.builds.push(PLAYTEST_BUILD);
    }
  }
  start(profile: Profile, id: string, environment: 'browser' | 'automation', at = new Date().toISOString()) {
    if (!this.data) this.data = { kind: 'echo-heist-playtest', schemaVersion: 1, id, builds: [PLAYTEST_BUILD], environment, startedAt: at, updatedAt: at, profile: { ...profile }, segments: [], events: [], completedZones: [] };
    this.recording = true; this.onBreak = false; this.last = null; this.context = null;
  }
  stop() { this.recording = false; this.last = null; this.context = null; }
  tick(now: number, context: Context) {
    if (!this.recording || !this.data || !Number.isFinite(now)) return;
    if (this.last !== null && this.context) {
      const ms = Math.max(0, now - this.last);
      const phase = this.context.phase === 'away' ? 'away' : ms > 2000 ? 'unclassified' : this.context.phase;
      const prior = this.data.segments.at(-1);
      if (prior && prior.zoneId === this.context.zoneId && prior.phase === phase) prior.ms += ms;
      else this.data.segments.push({ ...this.context, phase, ms });
      this.elapsed += ms;
    }
    this.last = now;
    this.context = { ...context, phase: this.onBreak ? 'away' : context.phase };
  }
  event(kind: string, zoneId: string, detail = '') {
    if (!this.recording || !this.data) return;
    this.data.events.push({ atMs: this.elapsed, zoneId, kind, detail: detail.slice(0, 499) });
    if (kind === 'won' && !this.data.completedZones.includes(zoneId)) this.data.completedZones.push(zoneId);
  }
  get activeMinutes() { return (this.data?.segments.filter(s => !['away', 'unclassified'].includes(s.phase)).reduce((sum, s) => sum + s.ms, 0) ?? 0) / 60_000; }
  snapshot() {
    if (this.data) this.data.updatedAt = new Date().toISOString();
    return { data: this.data ? structuredClone(this.data) : null, recording: this.recording };
  }
}
