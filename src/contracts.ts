import { CONTRACTS, CONTRACT_FAMILIES, contractById, type Contract } from './contract-content.ts';
import type { Game } from './engine.ts';
import { MAX_FRAMES } from './levels.ts';

export const CONTRACT_KEY = 'echo-heist-contracts-v1';
export const CONTRACT_PLAN_KEY = 'echo-heist-contract-plans-v1';
export type ContractScore = { completions: number; fastestFrames: number; fewestEchoes: number; last: { frames: number; echoes: number } };
type ContractSave = { version: 1; rotation: number; active?: string; inContracts: boolean; scores: Record<string, ContractScore> };
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export class ContractBook {
  private data: ContractSave = {version:1,rotation:0,inContracts:false,scores:{}};
  // Each world reset creates a new recording. Displayed attempt numbers can
  // restart at one when a player clears a plan, so they are not run identities.
  private committed = new WeakSet<Game['recording']>();
  constructor(save: unknown, private canEnter: () => boolean) {
    if (!save || typeof save !== 'object') return;
    const raw = save as Partial<ContractSave>;
    if (raw.version !== 1) return;
    if (integer(raw.rotation,0,1_000_000)) this.data.rotation=raw.rotation;
    if (typeof raw.active === 'string' && contractById(raw.active)) this.data.active=raw.active;
    this.data.inContracts=raw.inContracts===true && !!this.data.active;
    if (raw.scores && typeof raw.scores === 'object') for (const c of CONTRACTS) {
      const s=raw.scores[c.id], limit=c.stage.level.echoLimit!;
      if (s && integer(s.completions,1,1_000_000) && integer(s.fastestFrames,1,MAX_FRAMES) && integer(s.fewestEchoes,0,limit)
        && s.last && integer(s.last.frames,s.fastestFrames,MAX_FRAMES) && integer(s.last.echoes,s.fewestEchoes,limit)) {
        this.data.scores[c.id]={completions:s.completions,fastestFrames:s.fastestFrames,fewestEchoes:s.fewestEchoes,last:{...s.last}};
      }
    }
  }
  get unlocked() { return this.canEnter(); }
  get active(): Contract | undefined { return this.data.active ? contractById(this.data.active) : undefined; }
  get inContracts() { return this.unlocked && this.data.inContracts && !!this.active; }
  get offers(): Contract[] { return CONTRACT_FAMILIES.map(f => { const choices=CONTRACTS.filter(c=>c.family===f); return choices[this.data.rotation%choices.length]; }); }
  score(id: string): ContractScore | undefined { const s=this.data.scores[id]; return s ? structuredClone(s) : undefined; }
  refresh(): boolean {
    if (!this.unlocked) return false;
    this.data.rotation=(this.data.rotation+1)%1_000_000; return true;
  }
  accept(id: string): boolean {
    if (!this.unlocked || (!this.offers.some(c=>c.id===id) && this.active?.id!==id)) return false;
    this.data.active=id; this.data.inContracts=true; return true;
  }
  leave() { this.data.inContracts=false; }
  commit(game: Game): boolean {
    const c=this.active;
    if (!this.inContracts || !c || game.level!==c.stage.level || game.status!=='won' || game.spectator || game.editingIndex!==null
      || !game.objectiveComplete || !game.exitReady || game.echoes.length>game.echoLimit || this.committed.has(game.recording)) return false;
    const last={frames:game.frame,echoes:game.echoes.length}, before=this.data.scores[c.id];
    this.data.scores[c.id]={completions:Math.min(1_000_000,(before?.completions??0)+1),
      fastestFrames:Math.min(before?.fastestFrames??MAX_FRAMES,last.frames), fewestEchoes:Math.min(before?.fewestEchoes??3,last.echoes), last};
    this.committed.add(game.recording); return true;
  }
  export(): ContractSave { return structuredClone(this.data); }
}
