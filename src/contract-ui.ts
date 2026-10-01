import { CONTRACTS, type Contract } from './contract-content.ts';
import type { ContractBook } from './contracts.ts';
import { FPS } from './levels.ts';
import './contracts.css';
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
export class ContractUI {
  private dialog: HTMLDialogElement;
  private key='';
  constructor(private book: ContractBook, private actions: {open:()=>void; close:()=>void; accept:(id:string)=>void; refresh:()=>void; leave:()=>void; readOnly:()=>boolean}) {
    $('.campaign-toolbar').insertAdjacentHTML('beforeend','<button id="contracts-button">夜班委托</button>');
    $('.campaign-shell').insertAdjacentHTML('beforeend','<section id="contract-strip" class="contract-strip" hidden><div><p class="eyebrow">AFTER THE LAST FERRY</p><strong id="contract-current"></strong><p id="contract-conditions"></p></div><button id="contract-switch">查看委托与成绩</button></section>');
    document.body.insertAdjacentHTML('beforeend',`<dialog id="contracts-dialog" class="contracts-dialog" aria-labelledby="contracts-title"><button id="contracts-close" class="dialog-close" aria-label="关闭夜班委托">×</button><p class="eyebrow">AFTER THE LAST FERRY / 夜班来信</p><h2 id="contracts-title">城里的夜班，还需要同伙。</h2><p id="contracts-intro"></p><p id="contracts-save" role="status"></p><div id="contracts-active"></div><div id="contract-offers" class="contract-offers"></div><div class="contract-actions"><button id="contracts-refresh">换一批委托 · 免费</button><button id="contracts-leave">返回原主线</button></div><details id="contracts-records"><summary>已交差的安排与个人纪录</summary><div id="contract-scores"></div></details><p class="contract-record-note">最快成功回合与最少回声分别记录，可能来自不同次完成。重试与重录不计入成功回合时间；这些纪录不代表初见时长或无重试通关。</p></dialog>`);
    this.dialog=$('#contracts-dialog');
    $('#contracts-button').addEventListener('click',()=>this.show());
    $('#contract-switch').addEventListener('click',()=>this.show());
    $('#contracts-close').addEventListener('click',()=>this.dialog.close());
    this.dialog.addEventListener('close',()=>actions.close());
    $('#contracts-refresh').addEventListener('click',()=>{ if (actions.readOnly()) return; actions.refresh(); this.draw(); });
    $('#contracts-leave').addEventListener('click',()=>{ this.dialog.close(); actions.leave(); });
    this.dialog.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-contract]');
      if (!button || button.disabled || actions.readOnly()) return;
      this.dialog.close(); actions.accept(button.dataset.contract!);
    });
  }
  get open() { return this.dialog.open; }
  saved(ok: boolean) { $('#contracts-save').textContent=ok ? '委托与纪录已保存在本机。' : '仅本次有效 · 无法写入本机存档。'; }
  show() { this.actions.open(); this.draw(); if (!this.dialog.open) this.dialog.showModal(); }
  private record(c: Contract): string {
    const s=this.book.score(c.id);
    return s ? `已交差 ${s.completions} 次 · 最快成功回合 ${(s.fastestFrames/FPS).toFixed(2)} 秒 · 最少 ${s.fewestEchoes} 名回声` : '尚未交差';
  }
  private card(c: Contract): string {
    return `<article class="contract-card"><p class="eyebrow">${c.family} / ${c.stage.level.echoLimit} 名回声以内</p><h3>${c.title}</h3><p>${c.request}</p><ul>${c.conditions.map(t=>`<li>${t}</li>`).join('')}</ul><p class="contract-record">${this.record(c)}</p><button class="primary-button" data-contract="${c.id}" ${this.actions.readOnly()?'disabled':''}>${this.book.active?.id===c.id?'继续本单':'接下委托'} →</button></article>`;
  }
  private draw() {
    const unlocked=this.book.unlocked;
    $('#contracts-intro').textContent=unlocked ? (this.actions.readOnly()?'当前为只读预演。退出预演后可接单或换单。':'一次查看三份委托，可自由换单。接单后布局和条件固定；刷新继续同一安排。各安排的录像独立保存，可反复改进。') : '完成八章主线后，修表铺会收到三类夜班委托。历史通关资格会保留，回看结局或重玩主线不会收回。';
    $('#contract-offers').innerHTML=unlocked ? this.book.offers.map(c=>this.card(c)).join('') : '';
    $('#contracts-active').innerHTML=unlocked && this.book.active && !this.book.offers.includes(this.book.active) ? `<p>正在进行的委托仍保留：</p>${this.card(this.book.active)}` : '';
    $('#contracts-records').hidden=!unlocked;
    $('#contract-scores').innerHTML=unlocked ? CONTRACTS.filter(c=>this.book.score(c.id)).map(c=>`<p><strong>${c.title}</strong><br>${this.record(c)}</p>`).join('') || '<p>交差后，纪录会留在这里。</p>' : '';
    $<HTMLButtonElement>('#contracts-refresh').disabled=!unlocked || this.actions.readOnly();
    $('#contracts-leave').hidden=!this.book.inContracts;
  }
  render(active: boolean, demo: boolean) {
    $('#contracts-button').hidden=demo;
    $('#contracts-button').textContent=this.book.unlocked?'夜班委托':'夜班委托 · 通关后解锁';
    $('#contract-strip').hidden=!active;
    const c=active ? this.book.active : undefined;
    const key=`${active}:${c?.id}:${this.book.unlocked}`;
    if (key===this.key) return;
    this.key=key;
    if (c) {
      $('#contract-current').textContent=`${c.family} · ${c.title}`;
      $('#contract-conditions').textContent=c.conditions.join('；');
    }
  }
}
