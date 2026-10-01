import type { Carry, Game } from './engine.ts';
import { MISSIONS, outcomeSelected, resolveStage, stageVersions, type Mission, type Stage } from './campaign-content.ts';
import { decodePlan, encodePlan, type SavedPlan } from './plans.ts';
import type { CredentialSnapshot } from './levels.ts';
import { incomingCredential, outgoingCredential } from './credentials.ts';
import { RESTORATION_ID, RESTORATION_STAGE } from './museum-return.ts';

export const CAMPAIGN_KEY = 'echo-heist-campaign-v1';
type Prepared = { id: string; locked: boolean };
type CampaignSave = { version: 1; restorationVersion?: 1; selected: string; runs: Record<string, string[]>; completed: string[]; outcomes?: Record<string, string>; endings?: string[]; carries?: Record<string, SavedPlan>; credentials?: Record<string, CredentialSnapshot>; preparations?: Record<string, Prepared> };

export class Campaign {
  data: CampaignSave = { version: 1, restorationVersion: 1, selected: MISSIONS[0].id, runs: {}, completed: [], outcomes: {}, endings: [], carries: {}, credentials: {}, preparations: {} };
  constructor(raw?: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const save = raw as CampaignSave;
    if (save.version !== 1 || !save.runs || typeof save.runs !== 'object' || !Array.isArray(save.completed)) return;
    for (const mission of MISSIONS) {
      const cleared = save.runs[mission.id];
      const preparation = save.preparations?.[mission.id];
      if (mission.preparations && preparation !== undefined) {
        const choice = mission.preparations.find(p => p.id === preparation?.id && p.sources.every(id => this.data.completed.includes(id)));
        // A corrupt/newer preparation cannot reuse another layout's checkpoints.
        // Historical evidence and chapter unlocks remain permanent.
        if (!choice || typeof preparation.locked !== 'boolean') {
          this.data.runs[mission.id] = [];
          if (save.completed.includes(mission.id)) this.data.completed.push(mission.id);
          continue;
        }
        this.data.preparations![mission.id] = { id: choice.id, locked: preparation.locked || (Array.isArray(cleared) && cleared.length > 0) };
      } else if (mission.preparations && Array.isArray(cleared) && cleared.length) {
        // Saves made before preparation existed continue the original route.
        this.data.preparations![mission.id] = { id: mission.preparations[0].id, locked: true };
      }
      // The old four-room finale has no retained recording. Preserve its
      // historical unlock but restart this newly authored operation safely.
      if (['C3-6', 'C4-6'].includes(mission.id) && Array.isArray(cleared) && cleared.some(id => new RegExp(`^${mission.id}-[a-d]$`).test(id))) {
        this.data.runs[mission.id] = [];
        if (save.completed.includes(mission.id)) this.data.completed.push(mission.id);
        continue;
      }
      if (Array.isArray(cleared) && cleared.length <= mission.stages.length && cleared.every((id, i) => id === mission.stages[i].level.id)) {
        const prefix: string[] = [], flags = this.preparationFlags(mission);
        for (const id of cleared) {
          const current = resolveStage(mission.stages[prefix.length], flags);
          const outcome = current.outcomes?.find(o => o.id === save.outcomes?.[id]);
          // A missing or invalid decision cannot silently turn into the default route.
          if (current.outcomes?.length && !outcome) break;
          if (current.level.credential) {
            const rule = current.level.credential;
            if (rule.from && !incomingCredential(current.level, this.data.credentials![rule.from])) break;
            // Before the museum return existed, a successfully archived
            // restoration already proved ROOT, RESTORED and index delivery.
            // Issue its receipt once during migration; never use story flags,
            // historical ending IDs, or a damaged new-format checkpoint.
            const legacyReceipt = id === RESTORATION_STAGE && save.restorationVersion === undefined && save.credentials?.[id] === undefined
              ? { id: RESTORATION_ID, owner: 'player', authorizations: ['ROOT', 'RESTORED'] } : undefined;
            const checkpoint = outgoingCredential(current.level, save.credentials?.[id] ?? legacyReceipt);
            if (!checkpoint || (outcome && 'credentialAt' in outcome && checkpoint.owner !== outcome.credentialAt)) break;
            this.data.credentials![id] = checkpoint;
          }
          if (current.level.handoff) {
            const plan = decodePlan(save.carries?.[id], id), plate = current.level.plates.find(p => p.id === current.level.handoff!.plate);
            if (!plan || plan.length !== 1 || !plate || Math.hypot(plan[0].frames.at(-1)!.x - plate.x, plan[0].frames.at(-1)!.y - plate.y) >= 23) break;
            this.data.carries![id] = encodePlan(id, plan);
          }
          prefix.push(id); flags.push(...current.grants);
          if (outcome) { this.data.outcomes![id] = outcome.id; flags.push(outcome.id); }
        }
        this.data.runs[mission.id] = prefix;
        if (prefix.length === cleared.length && save.completed.includes(mission.id)) this.data.completed.push(mission.id);
      }
    }
    if (MISSIONS.some(m => m.id === save.selected) && this.available(save.selected)) this.data.selected = save.selected;
    const allowed = MISSIONS.filter(m => this.data.completed.includes(m.id)).flatMap(m => m.stages.flatMap(stageVersions).flatMap(s => s.ending ? [s.ending.id] : []));
    this.data.endings = Array.isArray(save.endings) ? [...new Set(save.endings.filter(id => allowed.includes(id)))] : [];
    if (this.ending && !this.data.endings.includes(this.ending.id)) this.data.endings.push(this.ending.id);
  }
  get mission(): Mission { return MISSIONS.find(m => m.id === this.data.selected)!; }
  get nextMission(): Mission | undefined {
    const next = MISSIONS[MISSIONS.indexOf(this.mission) + 1];
    return next && next.id.startsWith('LAB-') === this.mission.id.startsWith('LAB-') ? next : undefined;
  }
  cleared(id = this.mission.id): number { return this.data.runs[id]?.length ?? 0; }
  get stageIndex(): number { return Math.min(this.cleared(), this.mission.stages.length - 1); }
  stageAt(index: number): Stage {
    const flags = this.preparationFlags(this.mission);
    for (let i = 0; i < index && i < this.cleared(); i++) {
      const base = this.mission.stages[i], resolved = resolveStage(base, flags);
      flags.push(...resolved.grants);
      const outcome = resolved.outcomes?.find(o => o.id === this.data.outcomes?.[base.level.id]);
      if (outcome) flags.push(outcome.id);
    }
    return resolveStage(this.mission.stages[index], flags);
  }
  indexOf(levelId: string): number { return this.mission.stages.findIndex(s => stageVersions(s).some(v => v.level.id === levelId)); }
  get stage() { return this.stageAt(this.stageIndex); }
  carryFor(levelId: string): Carry | undefined {
    const index = this.indexOf(levelId);
    const link = index >= 0 ? this.stageAt(index).level.continuity : undefined;
    if (!link) return;
    const source = this.mission.stages.find(s => s.level.id === link.source)?.level;
    const echo = decodePlan(this.data.carries?.[link.source], link.source)?.[0];
    if (source && echo) return { level: source, echo };
  }
  get ending() { return this.cleared() === this.mission.stages.length ? this.stage.ending : undefined; }
  credentialFor(levelId: string): CredentialSnapshot | undefined {
    const index = this.indexOf(levelId);
    if (index < 0) return;
    const level = this.stageAt(index).level;
    return incomingCredential(level, this.data.credentials?.[level.credential?.from ?? '']);
  }
  revisitEnding(): boolean {
    return !!this.ending && this.mission.endingAnchor !== undefined && this.returnTo(this.mission.endingAnchor);
  }
  get flags(): string[] {
    return [...this.preparationFlags(this.mission), ...this.mission.stages.slice(0, this.cleared()).flatMap((base, i) => {
      const s = this.stageAt(i), outcome = s.outcomes?.find(o => o.id === this.data.outcomes?.[base.level.id]);
      return [...s.grants, ...(outcome ? [outcome.id] : [])];
    })];
  }
  private preparationFlags(mission: Mission): string[] {
    const id = this.data.preparations?.[mission.id]?.id ?? mission.preparations?.[0]?.id;
    return id ? [id] : [];
  }
  get preparation() { return this.mission.preparations?.find(p => p.id === this.preparationFlags(this.mission)[0]); }
  get preparationOptions() { return this.mission.preparations?.filter(p => p.sources.every(id => this.data.completed.includes(id))) ?? []; }
  get preparationLocked() { return !!this.data.preparations?.[this.mission.id]?.locked || this.cleared() > 0; }
  choosePreparation(id: string): boolean {
    if (!this.available(this.mission.id) || this.preparationLocked || !this.preparationOptions.some(p => p.id === id)) return false;
    (this.data.preparations ??= {})[this.mission.id] = { id, locked: false };
    return true;
  }
  depart(game: Game): boolean {
    if (!this.preparation || this.preparationLocked || game.spectator || game.level.id !== this.stage.level.id || (game.status === 'ready' && !game.localPlan.length)) return false;
    (this.data.preparations ??= {})[this.mission.id] = { id: this.preparation.id, locked: true };
    return true;
  }
  resetPreparation(): boolean {
    if (!this.preparation || !this.returnTo(0)) return false;
    (this.data.preparations ??= {})[this.mission.id] = { id: this.preparation.id, locked: false };
    return true;
  }
  available(id: string): boolean {
    const index = MISSIONS.findIndex(m => m.id === id);
    return index >= 0 && (MISSIONS[index].chapter === '机制试验' || index === 0 || this.data.completed.includes(MISSIONS[index - 1].id));
  }
  select(id: string): boolean {
    if (!this.available(id)) return false;
    this.data.selected = id; return true;
  }
  commit(game: Game): boolean {
    const index = this.cleared();
    if (game.spectator || game.editingIndex !== null || game.status !== 'won' || index >= this.mission.stages.length) return false;
    const current = this.stageAt(index), base = this.mission.stages[index];
    if (current.level.id !== game.level.id) return false;
    const required = current.requires;
    if (required && !this.flags.includes(required)) return false;
    if (!game.exitReady) return false;
    if (current.level.continuity && JSON.stringify(game.carried?.echo) !== JSON.stringify(this.carryFor(game.level.id)?.echo)) return false;
    if (current.level.credential?.from && JSON.stringify(game.incoming) !== JSON.stringify(this.credentialFor(game.level.id))) return false;
    const credential = game.credentialCheckpoint();
    if (current.level.credential && !credential) return false;
    const outcomes = current.outcomes?.filter(o => outcomeSelected(o, game)) ?? [];
    if (current.outcomes?.length && outcomes.length !== 1) return false;
    this.depart(game);
    if (outcomes[0]) (this.data.outcomes ??= {})[base.level.id] = outcomes[0].id;
    if (current.level.handoff) (this.data.carries ??= {})[base.level.id] = encodePlan(base.level.id, game.echoes);
    if (credential) (this.data.credentials ??= {})[base.level.id] = credential;
    (this.data.runs[this.mission.id] ??= []).push(base.level.id);
    if (this.cleared() === this.mission.stages.length && !this.data.completed.includes(this.mission.id)) this.data.completed.push(this.mission.id);
    if (current.ending && !this.data.endings?.includes(current.ending.id)) (this.data.endings ??= []).push(current.ending.id);
    return true;
  }
  returnTo(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index > this.stageIndex) return false;
    for (const stage of this.mission.stages.slice(index)) {
      delete this.data.outcomes?.[stage.level.id];
      delete this.data.carries?.[stage.level.id];
      delete this.data.credentials?.[stage.level.id];
    }
    this.data.runs[this.mission.id] = (this.data.runs[this.mission.id] ?? []).slice(0, index);
    // Historical mission completion remains a permanent unlock; the current
    // run's facts come only from its surviving prefix of committed stages.
    return true;
  }
  export(): CampaignSave { return structuredClone(this.data); }
}
