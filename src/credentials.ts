import type { CredentialSnapshot, Level } from './levels.ts';

const copy = (s: CredentialSnapshot): CredentialSnapshot => ({ id: s.id, owner: s.owner, authorizations: [...s.authorizations], ...(s.receivedFrom ? { receivedFrom: s.receivedFrom } : {}) });
const valid = (value: unknown): value is CredentialSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const s = value as CredentialSnapshot;
  return typeof s.id === 'string' && typeof s.owner === 'string' && Array.isArray(s.authorizations) && s.authorizations.every(a => typeof a === 'string') && new Set(s.authorizations).size === s.authorizations.length && (s.receivedFrom === undefined || typeof s.receivedFrom === 'string');
};

// Only explicit author-approved checkpoint facts survive. Echo ownership is
// round-local and can never be exported into a room with a different team.
export function outgoingCredential(level: Level, value: unknown): CredentialSnapshot | undefined {
  const rule = level.credential;
  if (!rule || !valid(value) || value.id !== rule.id || !rule.exitOwners.includes(value.owner)) return;
  const required = rule.exitAuthorizations ?? [];
  if (value.authorizations.length !== required.length || !required.every(a => value.authorizations.includes(a))) return;
  if (rule.receiveByPlayer && value.receivedFrom !== rule.receiveByPlayer) return;
  return copy(value);
}

export function incomingCredential(level: Level, value: unknown): CredentialSnapshot | undefined {
  const rule = level.credential;
  if (!rule?.from || !valid(value) || value.id !== rule.id || !rule.incomingOwners?.includes(value.owner)) return;
  if (value.owner !== 'player' && !level.terminals?.some(t => t.kind !== 'lock' && value.owner === `terminal:${t.id}`)) return;
  if (!(rule.incomingAuthorizations ?? []).every(a => value.authorizations.includes(a))) return;
  return copy(value);
}
