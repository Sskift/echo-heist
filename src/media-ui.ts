import { Sound } from './audio.ts';
import type { Renderer } from './render.ts';
import { SOUNDTRACK } from './soundtrack.ts';
import './media.css';

export class MediaUI {
  private dialog: HTMLDialogElement;
  private opener: HTMLElement | null = null;
  constructor(private sound: Sound, private renderer: Renderer, pause: () => void, close: () => void) {
    document.querySelector('#sound-button')!.insertAdjacentHTML('afterend', '<button id="media-button" class="media-button" aria-label="声音与画面设置" title="声音与画面">声画</button>');
    document.body.insertAdjacentHTML('beforeend', `<dialog id="media-dialog" class="media-dialog" aria-labelledby="media-title">
      <button class="dialog-close" id="media-close" aria-label="关闭声画设置">×</button>
      <p class="eyebrow">AFTER HOURS / 声画设置</p><h2 id="media-title">听见另一条时间线。</h2>
      <div class="now-playing"><span class="record-disc" aria-hidden="true">◎</span><div><span class="eyebrow">当前配乐</span><p id="now-playing" role="status"></p></div></div>
      <button id="audio-toggle" class="primary-button"></button>
      <label class="volume-label" for="music-volume">音乐 <output id="music-value"></output></label><input id="music-volume" type="range" min="0" max="100" step="1" aria-label="音乐音量">
      <label class="volume-label" for="effects-volume">音效 <output id="effects-value"></output></label><input id="effects-volume" type="range" min="0" max="100" step="1" aria-label="音效音量">
      <label class="media-option"><input id="adaptive-audio" type="checkbox"><span>跟随行动变化<small>规划时收敛，警觉升高时加入低音脉冲；快进不改变音乐速度。</small></span></label>
      <label class="media-option"><input id="scene-detail" type="checkbox"><span>场景细节与局部灯光<small>关闭后减少窗框、地板纹理和壁灯照明，保留 3D 人物与机关。</small></span></label>
      <p class="media-note">首次需主动开启声音。离开窗口自动静音，重录保持配乐连续；音量和画面偏好保存在本机。</p>
      <details class="media-credits"><summary>素材与音乐鸣谢 <span>CC0</span></summary><p>人物与骨骼动画：<a href="https://kenney.nl/assets/animated-characters-protagonists" target="_blank" rel="noopener noreferrer">Kenney · Animated Characters Protagonists</a></p>${Object.values(SOUNDTRACK).map(track => `<p><a href="${track.source}" target="_blank" rel="noopener noreferrer">${track.title}</a><small>${track.artist}</small></p>`).join('')}<p>以上素材采用 CC0。人物骨架与动画在运行时调整比例并驱动本项目建模的角色外观；建筑、家具、地板和机关由本项目建模与绘制。3D 渲染使用 Three.js（MIT 许可），音乐经过统一响度与格式转换。</p></details>
    </dialog>`);
    this.dialog = document.querySelector('#media-dialog')!;
    try { renderer.detail = localStorage.getItem('echo-heist-scene-detail') !== 'false'; } catch { /* Default detailed mode. */ }
    document.querySelector('#media-button')!.addEventListener('click', () => {
      this.opener = document.activeElement as HTMLElement; pause(); this.render(); this.dialog.showModal();
    });
    document.querySelector('#media-close')!.addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => { close(); this.opener?.focus({ preventScroll: true }); });
    document.querySelector('#audio-toggle')!.addEventListener('click', () => { sound.enabled = !sound.enabled; sound.unlock(); sound.play('door'); this.render(); });
    for (const [id, key] of [['music', 'music'], ['effects', 'effects']] as const) {
      document.querySelector(`#${id}-volume`)!.addEventListener('input', event => {
        sound.configure({ [key]: Number((event.target as HTMLInputElement).value) / 100 }); sound.unlock(); this.render();
      });
    }
    document.querySelector('#effects-volume')!.addEventListener('change', () => sound.play('door'));
    document.querySelector('#adaptive-audio')!.addEventListener('change', event => sound.configure({ adaptive: (event.target as HTMLInputElement).checked }));
    document.querySelector('#scene-detail')!.addEventListener('change', event => {
      renderer.detail = (event.target as HTMLInputElement).checked;
      try { localStorage.setItem('echo-heist-scene-detail', String(renderer.detail)); } catch { /* Still applies this session. */ }
    });
    sound.onChange = () => this.render(); this.render();
  }
  get open() { return this.dialog.open; }
  render() {
    const s = this.sound;
    for (const key of ['music', 'effects'] as const) {
      const value = Math.round(s.settings[key] * 100);
      document.querySelector<HTMLInputElement>(`#${key}-volume`)!.value = String(value);
      document.querySelector(`#${key}-value`)!.textContent = `${value}%`;
    }
    document.querySelector<HTMLInputElement>('#adaptive-audio')!.checked = s.settings.adaptive;
    document.querySelector<HTMLInputElement>('#scene-detail')!.checked = this.renderer.detail;
    document.querySelector('#now-playing')!.textContent = s.description;
    document.querySelector('#audio-toggle')!.textContent = s.enabled ? '关闭全部声音' : '开启音乐与音效';
    const button = document.querySelector('#sound-button')!;
    button.classList.toggle('active', s.enabled); button.setAttribute('aria-pressed', String(s.enabled));
    const label = s.enabled ? '关闭声音' : '开启音乐与音效';
    button.setAttribute('aria-label', label); button.setAttribute('title', label);
  }
}
