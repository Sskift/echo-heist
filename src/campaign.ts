import type { Carry, Game } from './engine.ts';
import { MISSIONS, resolveStage, stageVersions, type Mission, type Stage } from './campaign-content.ts';
import { decodePlan, encodePlan, type SavedPlan } from './plans.ts';

export const CAMPAIGN_KEY = 'echo-heist-campaign-v1';
type CampaignSave = { version: 1; selected: string; runs: Record<string, string[]>; completed: string[]; outcomes?: Record<string, string>; endings?: string[]; carries?: Record<string, SavedPlan> };

export class Campaign {
  data: CampaignSave = { version: 1, selected: MISSIONS[0].id, runs: {}, completed: [], outcomes: {}, endings: [], carries: {} };
  constructor(raw?: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const save = raw as CampaignSave;
    if (save.version !== 1 || !save.runs || typeof save.runs !== 'object' || !Array.isArray(save.completed)) return;
    for (const mission of MISSIONS) {
      const cleared = save.runs[mission.id];
      // The old four-room finale has no retained recording. Preserve its
      // historical unlock but restart this newly authored operation safely.
      if (mission.id === 'C3-6' && Array.isArray(cleared) && cleared.some(id => /^C3-6-[a-d]$/.test(id))) {
        this.data.runs[mission.id] = [];
        if (save.completed.includes(mission.id)) this.data.completed.push(mission.id);
        continue;
      }
      if (Array.isArray(cleared) && cleared.length <= mission.stages.length && cleared.every((id, i) => id === mission.stages[i].level.id)) {
        const prefix: string[] = [], flags: string[] = [];
        for (const id of cleared) {
          const current = resolveStage(mission.stages[prefix.length], flags);
          const outcome = current.outcomes?.find(o => o.id === save.outcomes?.[id]);
          // A missing or invalid decision cannot silently turn into the default route.
          if (current.outcomes?.length && !outcome) break;
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
    const flags: string[] = [];
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
  revisitEnding(): boolean {
    return !!this.ending && this.mission.endingAnchor !== undefined && this.returnTo(this.mission.endingAnchor);
  }
  get flags(): string[] {
    return this.mission.stages.slice(0, this.cleared()).flatMap((base, i) => {
      const s = this.stageAt(i), outcome = s.outcomes?.find(o => o.id === this.data.outcomes?.[base.level.id]);
      return [...s.grants, ...(outcome ? [outcome.id] : [])];
    });
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
    const outcomes = current.outcomes?.filter(o => game.powered(o.power)) ?? [];
    if (current.outcomes?.length && outcomes.length !== 1) return false;
    if (outcomes[0]) (this.data.outcomes ??= {})[base.level.id] = outcomes[0].id;
    if (current.level.handoff) (this.data.carries ??= {})[base.level.id] = encodePlan(base.level.id, game.echoes);
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
    }
    this.data.runs[this.mission.id] = (this.data.runs[this.mission.id] ?? []).slice(0, index);
    // Historical mission completion remains a permanent unlock; the current
    // run's facts come only from its surviving prefix of committed stages.
    return true;
  }
  export(): CampaignSave { return structuredClone(this.data); }
}
