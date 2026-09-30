import type { Game } from './engine.ts';
import { MISSIONS, type Mission } from './campaign-content.ts';

export const CAMPAIGN_KEY = 'echo-heist-campaign-v1';
export type CampaignSave = { version: 1; selected: string; runs: Record<string, string[]>; completed: string[] };

export class Campaign {
  data: CampaignSave = { version: 1, selected: MISSIONS[0].id, runs: {}, completed: [] };
  constructor(raw?: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const save = raw as CampaignSave;
    if (save.version !== 1 || !save.runs || typeof save.runs !== 'object' || !Array.isArray(save.completed)) return;
    for (const mission of MISSIONS) {
      const cleared = save.runs[mission.id];
      if (Array.isArray(cleared) && cleared.length <= mission.stages.length && cleared.every((id, i) => id === mission.stages[i].level.id)) {
        this.data.runs[mission.id] = [...cleared];
        if (save.completed.includes(mission.id)) this.data.completed.push(mission.id);
      }
    }
    if (MISSIONS.some(m => m.id === save.selected) && this.available(save.selected)) this.data.selected = save.selected;
  }
  get mission(): Mission { return MISSIONS.find(m => m.id === this.data.selected)!; }
  cleared(id = this.mission.id): number { return this.data.runs[id]?.length ?? 0; }
  get stageIndex(): number { return Math.min(this.cleared(), this.mission.stages.length - 1); }
  get stage() { return this.mission.stages[this.stageIndex]; }
  get flags(): string[] { return this.mission.stages.slice(0, this.cleared()).flatMap(s => s.grants); }
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
    if (game.spectator || game.status !== 'won' || this.mission.stages[index]?.level.id !== game.level.id) return false;
    const required = this.mission.stages[index].requires;
    if (required && !this.flags.includes(required)) return false;
    (this.data.runs[this.mission.id] ??= []).push(game.level.id);
    if (this.cleared() === this.mission.stages.length && !this.data.completed.includes(this.mission.id)) this.data.completed.push(this.mission.id);
    return true;
  }
  returnTo(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index > this.stageIndex) return false;
    this.data.runs[this.mission.id] = (this.data.runs[this.mission.id] ?? []).slice(0, index);
    // Historical mission completion remains a permanent unlock; the current
    // run's facts come only from its surviving prefix of committed stages.
    return true;
  }
  export(): CampaignSave { return structuredClone(this.data); }
}
