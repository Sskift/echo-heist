import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaytestRecorder, decodePlaytest, PLAYTEST_BUILD, type PlaytestData } from '../src/playtest.ts';
import { auditPlaytime, decodeReview, type Review, type ReviewedSession } from '../src/playtime-audit.ts';

const context = { zoneId: 'C0-1-a', missionId: 'C0-1', phase: 'execution' as const };
const profile = { role: 'developer' as const, experience: 'regular' as const, externalGuide: false };

test('playtest time uses the supplied wall clock and separates breaks and unknown gaps', () => {
  const recorder = new PlaytestRecorder(); recorder.start(profile, 'unit-clock', 'automation');
  recorder.tick(0, context); recorder.tick(1000, context);
  recorder.onBreak = true; recorder.tick(1000, context); recorder.tick(61_000, context);
  recorder.onBreak = false; recorder.tick(61_000, context); recorder.tick(62_000, context);
  recorder.tick(72_000, context);
  assert.equal(recorder.activeMinutes * 60_000, 2000);
  assert.equal(recorder.data!.segments.filter(s => s.phase === 'away').reduce((n, s) => n + s.ms, 0), 60_000);
  assert.equal(recorder.data!.segments.filter(s => s.phase === 'unclassified').reduce((n, s) => n + s.ms, 0), 10_000);
});

test('reload resumes a recording without charging time while the app was closed', () => {
  const recorder = new PlaytestRecorder(); recorder.start(profile, 'unit-reload', 'automation');
  recorder.tick(0, context); recorder.tick(1000, context); recorder.event('won', context.zoneId);
  const restored = new PlaytestRecorder(recorder.snapshot());
  restored.tick(3_600_000, context); restored.tick(3_601_000, context);
  assert.equal(restored.activeMinutes * 60_000, 2000);
  assert.deepEqual(restored.data!.completedZones, ['C0-1-a']);
  restored.stop(); restored.tick(4_000_000, context); restored.event('won', 'C0-2-a');
  assert.deepEqual(restored.data!.completedZones, ['C0-1-a']);
});

test('malformed logs are rejected and exports do not share mutable references', () => {
  const recorder = new PlaytestRecorder(); recorder.start(profile, 'unit-invalid', 'automation');
  recorder.tick(0, context); recorder.tick(100, context);
  const raw = recorder.snapshot().data!; raw.segments[0].ms = -1;
  assert.equal(decodePlaytest(raw), null); assert.equal(recorder.data!.segments[0].ms, 100);
  raw.segments[0].ms = Infinity; assert.equal(decodePlaytest(raw), null);
  assert.equal(decodePlaytest({}), null);
});

// Synthetic fixtures exist only inside unit tests. They are never exported as
// participant evidence, and their test result cannot establish campaign duration.
function synthetic(index: number, minutes = 750): ReviewedSession {
  const data: PlaytestData = { kind: 'echo-heist-playtest', schemaVersion: 1, id: `synthetic-${index}`, builds: [PLAYTEST_BUILD], environment: 'browser', startedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T13:00:00Z', profile: { role: 'first-time', experience: index % 2 ? 'regular' : 'new', externalGuide: false }, segments: [{ ...context, ms: minutes * 60_000 }], events: [], completedZones: ['C0-1-a', 'C7-6-e'] };
  const review: Review = { kind: 'echo-heist-playtest-review', sessionId: data.id, dataSha256: 'a'.repeat(64), reviewer: 'synthetic-unit-fixture', reviewedAt: '2026-01-02T00:00:00Z', firstPlayConfirmed: true, guideUseChecked: true, excludedMs: 0, reason: 'Synthetic unit fixture only', outcome: 'complete', storyUnderstood: true, noveltyNotes: Array(8).fill('Synthetic chapter observation') };
  return { data, review, hashMatches: true };
}
const required = ['C0-1-a', 'C7-6-e'];

test('duration audit requires enough reviewed first-time completions and both experience groups', () => {
  const sessions = Array.from({ length: 20 }, (_, i) => synthetic(i, 720 + i * 3));
  assert.equal(auditPlaytime(sessions.slice(0, 19), required, PLAYTEST_BUILD).passed, false);
  const report = auditPlaytime(sessions, required, PLAYTEST_BUILD);
  assert.equal(report.passed, true); assert.equal(report.medianMinutes, 748.5);
  sessions.forEach(s => { s.data.profile.experience = 'regular'; });
  assert.equal(auditPlaytime(sessions, required, PLAYTEST_BUILD).passed, false);
});

test('automation, missing zones, duplicate records, wrong hashes and unreviewed story cannot qualify', () => {
  const sessions = Array.from({ length: 20 }, (_, i) => synthetic(i));
  sessions[0].data.environment = 'automation'; sessions[1].data.completedZones.pop();
  sessions[2].hashMatches = false; sessions[3].review.storyUnderstood = false;
  sessions[4].data.profile.externalGuide = true; sessions[5].data.builds.push('old-build');
  sessions.push(sessions[6]);
  const report = auditPlaytime(sessions, required, PLAYTEST_BUILD);
  assert.equal(report.passed, false); assert.equal(report.qualifyingCompletions, 14); assert.equal(report.rejected.length, 7);
});

test('optional content and idle time cannot pad the campaign; manual exclusions only subtract', () => {
  const sessions = Array.from({ length: 20 }, (_, i) => synthetic(i, 590));
  for (const s of sessions) {
    s.data.segments.push({ ...context, phase: 'away', ms: 600 * 60_000 }, { ...context, phase: 'unclassified', ms: 600 * 60_000 }, { ...context, zoneId: 'LAB-POWER-a', ms: 600 * 60_000 });
    s.review.excludedMs = 10 * 60_000;
  }
  const report = auditPlaytime(sessions, required, PLAYTEST_BUILD);
  assert.equal(report.passed, false); assert.equal(report.medianMinutes, 580);
  sessions[0].review.excludedMs = -1;
  assert.equal(auditPlaytime(sessions, required, PLAYTEST_BUILD).qualifyingCompletions, 19);
});

test('withdrawals stay in the report without inflating completion durations', () => {
  const s = synthetic(0, 1000); s.review.outcome = 'withdrew'; s.data.completedZones = ['C0-1-a'];
  const report = auditPlaytime([s], required, PLAYTEST_BUILD);
  assert.equal(report.qualifyingCompletions, 0); assert.equal(report.withdrawals.length, 1);
  assert.equal(report.withdrawals[0].activeMinutes, 1000); assert.equal(report.p25Minutes, 0);
  assert.ok(decodeReview(s.review));
  assert.equal(decodeReview({ ...s.review, firstPlayConfirmed: 'true' }), null);
});
