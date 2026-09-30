import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodePlaytest, PLAYTEST_BUILD } from '../src/playtest.ts';
import { auditPlaytime, decodeReview, type Review, type ReviewedSession } from '../src/playtime-audit.ts';
import { MISSIONS } from '../src/campaign-content.ts';

const directory = process.argv[2];
if (!directory || !fs.existsSync(directory)) {
  console.error('Usage: npm run audit:playtime -- <directory containing participant exports and reviews>');
  process.exitCode = 2;
} else {
  const budget = JSON.parse(fs.readFileSync('docs/campaign-budget.json', 'utf8'));
  const requiredZones: string[] = budget.chapters.flatMap((chapter: { missions: { id: string; requiredActionZones: number }[] }) => chapter.missions.flatMap(m => Array.from({ length: m.requiredActionZones }, (_, i) => `${m.id}-${String.fromCharCode(97 + i)}`)));
  const implemented = new Set(MISSIONS.flatMap(m => m.stages.map(s => s.level.id)));
  const missingContent = requiredZones.filter(id => !implemented.has(id));
  const exports = new Map<string, { data: NonNullable<ReturnType<typeof decodePlaytest>>; sha: string }>();
  const reviews = new Map<string, Review>();
  const invalidFiles: string[] = [];
  let cohort: { sessionIds: string[]; build: string; recruitmentNotes: string; reviewer: string; externalFirstPlayConfirmed: boolean } | null = null;
  for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    try {
      const body = fs.readFileSync(path.join(directory, filename)), raw = JSON.parse(body.toString('utf8'));
      if (raw.kind === 'echo-heist-playtest-cohort') {
        if (cohort || !Array.isArray(raw.sessionIds) || !raw.sessionIds.every((id: unknown) => typeof id === 'string') || new Set(raw.sessionIds).size !== raw.sessionIds.length || typeof raw.build !== 'string' || typeof raw.recruitmentNotes !== 'string' || typeof raw.reviewer !== 'string' || typeof raw.externalFirstPlayConfirmed !== 'boolean') throw new Error('Invalid cohort');
        cohort = raw;
      } else if (raw.kind === 'echo-heist-playtest-review') {
        const review = decodeReview(raw);
        if (!review || reviews.has(review.sessionId)) throw new Error('Invalid or duplicate review');
        reviews.set(review.sessionId, review);
      } else {
        const data = decodePlaytest(raw);
        if (!data || exports.has(data.id)) throw new Error('Invalid or duplicate export');
        exports.set(data.id, { data, sha: createHash('sha256').update(body).digest('hex') });
      }
    } catch { invalidFiles.push(filename); }
  }
  const sessions: ReviewedSession[] = [], unreviewed: string[] = [];
  for (const [id, { data, sha }] of exports) {
    const review = reviews.get(id);
    if (!review) unreviewed.push(id);
    else sessions.push({ data, review, hashMatches: sha === review.dataSha256.toLowerCase() });
  }
  const report = auditPlaytime(sessions, requiredZones, PLAYTEST_BUILD);
  const cohortVerified = !!cohort && cohort.build === PLAYTEST_BUILD && cohort.externalFirstPlayConfirmed && !!cohort.recruitmentNotes.trim() && !!cohort.reviewer.trim() && cohort.sessionIds.length >= 20;
  const missingParticipants = cohort?.sessionIds.filter(id => !exports.has(id)) ?? [];
  const unregisteredExports = [...exports.keys()].filter(id => !cohort?.sessionIds.includes(id));
  const orphanReviews = [...reviews.keys()].filter(id => !exports.has(id));
  const passed = report.passed && cohortVerified && !missingContent.length && !invalidFiles.length && !unreviewed.length && !missingParticipants.length && !unregisteredExports.length && !orphanReviews.length;
  console.log(JSON.stringify({ ...report, passed, cohortVerified, missingContent, invalidFiles, unreviewed, missingParticipants, unregisteredExports, orphanReviews }, null, 2));
  if (!passed) process.exitCode = 1;
}
