import type { Ending } from './campaign-content.ts';
import './ending.css';

export class EndingUI {
  private dialog: HTMLDialogElement;
  private previousFocus: HTMLElement | null = null;
  constructor(revisit: () => void) {
    document.body.insertAdjacentHTML('beforeend', `<dialog id="ending-dialog" class="ending-dialog" aria-labelledby="ending-title">
      <div class="harbor-scene"><svg viewBox="0 0 840 240" role="img" aria-label="晨光里的旧渡口，两个人坐在长椅上，远处的船正靠岸">
        <rect width="840" height="240" fill="#d7dbbb"/><circle cx="645" cy="75" r="39" fill="#faf0b4"/>
        <path d="M0 139 110 130 150 136 240 121 310 135 380 126 456 141 548 134 640 143 735 128 840 138V240H0Z" fill="#77968a"/>
        <path d="M0 165H840M440 181H776M24 202H340M518 220H819M165 176H290" stroke="#c9d8bd" stroke-width="2" opacity=".6"/>
        <path d="m610 160 126 0 -17 19 -84 0Z" fill="#304b43"/><path d="M650 131h48v29h-48zM674 100v31" fill="#f1e8c5" stroke="#304b43" stroke-width="3"/>
        <path d="M0 213h540l46 27H0Z" fill="#475b4c"/><path d="M20 228h510M37 214l-6 26M128 214l5 26M226 214l15 26M322 214l25 26M427 214l38 26" stroke="#8e9e7b"/>
        <path d="M159 167h225v12H159zM170 197h205v10H170zM182 178v50M360 178v50" fill="#263f37" stroke="#263f37" stroke-width="5"/>
        <circle cx="238" cy="147" r="13" fill="#273f37"/><path d="m227 161 24 0 8 36 -9 22h-12l6-24h-27Z" fill="#273f37"/>
        <circle cx="300" cy="148" r="13" fill="#455943"/><path d="m289 162 25 0 11 33 -12 25h-11l6-25h-28Z" fill="#455943"/>
        <path d="m250 174 20 8 17-7" fill="none" stroke="#273f37" stroke-width="6"/><path d="M268 177h9v11h-9z" fill="#f4e5b2"/>
      </svg><span>旧渡口 · 天亮以后</span></div>
      <div class="ending-copy"><p class="ending-eyebrow">ECHO HEIST / 后来</p><h2 id="ending-title" tabindex="-1"></h2><p id="ending-consequence" class="ending-consequence"></p><div id="ending-reunion"></div>
      <p class="ending-note">主线交付已完成。两种选择都保留已公开的责任证据；可以回到范围选择锚点，体验另一种交付与收束。</p>
      <div class="ending-actions"><button id="ending-return" class="primary-button">回到最终选择</button><button id="ending-close">返回行动档案</button></div></div></dialog>`);
    this.dialog = document.querySelector<HTMLDialogElement>('#ending-dialog')!;
    this.dialog.querySelector('#ending-return')!.addEventListener('click', () => { this.dialog.close(); revisit(); });
    this.dialog.querySelector('#ending-close')!.addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => { if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true }); });
  }
  get open() { return this.dialog.open; }
  show(ending: Ending, reflection: string) {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog.querySelector('#ending-title')!.textContent = ending.title;
    this.dialog.querySelector('#ending-consequence')!.textContent = ending.consequence;
    this.dialog.querySelector('#ending-reunion')!.replaceChildren(...[reflection, ...ending.reunion].map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
    if (!this.dialog.open) this.dialog.showModal();
    // Start reading at the story, without arming the rollback button for Space.
    this.dialog.querySelector<HTMLElement>('#ending-title')!.focus({ preventScroll: true });
    this.dialog.scrollTop = 0;
  }
}
