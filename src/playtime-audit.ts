import type { PlaytestData } from './playtest.ts';

export type Review = {
  kind: 'echo-heist-playtest-review'; sessionId: string; dataSha256: string; reviewer: string; reviewedAt: string;
  firstPlayConfirmed: boolean; guideUseChecked: boolean; excludedMs: number; reason: string;
  outcome: 'complete' | 'withdrew'; storyUnderstood: boolean; noveltyNotes: string[];
};
export type ReviewedSession = { data: PlaytestData; review: Review; hashMatches: boolean };
export function decodeReview(value: unknown): Review | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Review;
  if (r.kind !== 'echo-heist-playtest-review' || typeof r.sessionId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(r.sessionId) || typeof r.dataSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(r.dataSha256)) return null;
  if (typeof r.reviewer !== 'string' || !r.reviewer.trim() || !Number.isFinite(Date.parse(r.reviewedAt)) || !['complete', 'withdrew'].includes(r.outcome)) return null;
  if (typeof r.firstPlayConfirmed !== 'boolean' || typeof r.guideUseChecked !== 'boolean' || typeof r.storyUnderstood !== 'boolean') return null;
  if (!Number.isFinite(r.excludedMs) || r.excludedMs < 0 || typeof r.reason !== 'string' || !r.reason.trim()) return null;
  if (!Array.isArray(r.noveltyNotes) || !r.noveltyNotes.every(n => typeof n === 'string')) return null;
  return structuredClone(r);
}
export function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * q;
  const lower = Math.floor(index), higher = Math.ceil(index);
  return sorted[lower] + (sorted[higher] - sorted[lower]) * (index - lower);
}
export function auditPlaytime(sessions: ReviewedSession[], requiredZones: string[], build: string) {
  const required = new Set(requiredZones), seen = new Set<string>();
  const included: { id: string; minutes: number; experience: string }[] = [];
  const rejected: { id: string; reasons: string[] }[] = [];
  const withdrawals: { id: string; completedZones: number; activeMinutes: number }[] = [];
  for (const { data, review, hashMatches } of sessions) {
    const reasons: string[] = [];
    const active = data.segments.filter(s => required.has(s.zoneId) && !['away', 'unclassified'].includes(s.phase)).reduce((sum, s) => sum + s.ms, 0);
    if (seen.has(data.id)) reasons.push('duplicate-session'); seen.add(data.id);
    if (!hashMatches || review.sessionId !== data.id) reasons.push('review-does-not-match-export');
    if (data.environment !== 'browser') reasons.push('not-human-browser-evidence');
    if (data.profile.role !== 'first-time' || !review.firstPlayConfirmed) reasons.push('not-confirmed-first-play');
    if (data.profile.externalGuide || !review.guideUseChecked) reasons.push('external-guide-or-unchecked');
    if (data.builds.length !== 1 || data.builds[0] !== build) reasons.push('different-or-mixed-build');
    if (!review.reviewer || !Number.isFinite(Date.parse(review.reviewedAt)) || !review.reason) reasons.push('incomplete-manual-review');
    if (!Number.isFinite(review.excludedMs) || review.excludedMs < 0 || review.excludedMs > active) reasons.push('invalid-exclusions');
    if (review.outcome === 'withdrew') withdrawals.push({ id: data.id, completedZones: data.completedZones.filter(z => required.has(z)).length, activeMinutes: active / 60_000 });
    if (review.outcome !== 'complete' || !requiredZones.every(zone => data.completedZones.includes(zone))) reasons.push('main-campaign-incomplete');
    if (!review.storyUnderstood || review.noveltyNotes.length < 8 || review.noveltyNotes.some(note => !note.trim())) reasons.push('story-or-chapter-novelty-unreviewed');
    if (reasons.length) rejected.push({ id: data.id, reasons });
    else included.push({ id: data.id, minutes: (active - review.excludedMs) / 60_000, experience: data.profile.experience });
  }
  const minutes = included.map(s => s.minutes);
  const median = quantile(minutes, 0.5), p25 = quantile(minutes, 0.25);
  const mixedExperience = included.some(s => s.experience === 'new') && included.some(s => s.experience === 'regular');
  const passed = included.length >= 20 && mixedExperience && median >= 720 && median <= 840 && p25 >= 600;
  return { passed, requiredZones: requiredZones.length, reviewedSessions: sessions.length, qualifyingCompletions: included.length, mixedExperience, medianMinutes: median, p25Minutes: p25, included, rejected, withdrawals,
    limitation: 'This checks submitted exports and manual attestations. Reviewer provenance, participant recruitment and completeness of the cohort still require external verification.' };
}
