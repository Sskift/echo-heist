import type { RoomJourney } from './room-journey.ts';
import './journey.css';

export class JourneyUI {
  private readonly panel = document.createElement('section');
  private readonly route: HTMLElement;
  private readonly title: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly skip: HTMLButtonElement;
  constructor(before: HTMLElement, stop: () => void) {
    this.panel.id = 'journey-panel'; this.panel.className = 'journey-panel'; this.panel.hidden = true;
    this.panel.setAttribute('aria-label', '房间行程');
    this.panel.innerHTML = '<div><p class="journey-route" id="journey-route"></p><strong id="journey-title"></strong><p id="journey-detail" role="status"></p><small>锚点已保存 · 开始行动前不计时</small></div><button id="journey-skip">跳过镜头</button>';
    before.before(this.panel);
    this.route = this.panel.querySelector('#journey-route')!;
    this.title = this.panel.querySelector('#journey-title')!;
    this.detail = this.panel.querySelector('#journey-detail')!;
    this.skip = this.panel.querySelector('#journey-skip')!;
    this.skip.addEventListener('click', () => { stop(); this.skip.hidden = true; });
  }
  show(journey: RoomJourney, moving: boolean) {
    this.route.textContent = `${journey.from} ${journey.travel ? '…' : '→'} ${journey.to}`;
    this.title.textContent = journey.title; this.detail.textContent = journey.detail;
    this.panel.hidden = false; this.skip.hidden = !moving;
  }
  update(moving: boolean) { this.skip.hidden = !moving; }
  clear() { this.panel.hidden = true; }
}
