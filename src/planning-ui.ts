import './immersive.css';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

/** Move the existing controls intact so their listeners and save paths stay shared. */
export class PlanningUI {
  open = false;
  constructor(private pause: () => void, private returnToScene: (resume: boolean) => void) {
    $('.mission-panel').id = 'planning-panel';
    $('#planning-panel').setAttribute('aria-label', '行动计划');
    $('#planning-panel').insertAdjacentHTML('afterbegin', '<div class="planning-heading"><strong>行动计划</strong><span>时间暂停</span><button id="close-planning" aria-label="返回场景">返回场景 <kbd>Esc</kbd></button></div>');
    $('.console').insertAdjacentHTML('beforeend', '<div class="action-hud"><div id="hud-clock"></div><div id="hud-actions"></div><button id="planning-button" aria-controls="planning-panel" aria-expanded="false">行动计划 <span id="hud-echoes">0 / 3</span><kbd>G</kbd></button></div>');
    $('#hud-clock').append($('.clock-panel'));
    $('#hud-actions').append($('#record-button'), $('#retry-button'));
    const panel = $('#planning-panel');
    panel.append($('.timeline'), $('.rehearsal-toolbar'), $('#preview-panel'), $('#operation-panel'), $('#credential-strip'), $('#relay-panel'), $('#power-panel'), $('#suppression-panel'), $('#security-panel'), $('#delivery-panel'));
    panel.insertAdjacentHTML('beforeend', '<details id="action-library"><summary>行动档案与故事</summary><div id="action-library-body"></div></details>');
    $('#action-library-body').append($('.campaign-shell'), $('.intro'));
    panel.append($('.hint'));
    // Story and contract entry points remain a single click away in the header.
    $('#help-button').before($('#story-button'), $('#contracts-button'));
    $('#planning-button').addEventListener('click', () => this.open ? this.close() : this.show());
    $('#close-planning').addEventListener('click', () => this.close());
    panel.hidden = true;
    document.body.classList.add('immersive');
  }
  show() {
    if (this.open) return;
    this.open = true;
    this.pause();
    $('#planning-panel').hidden = false;
    $('.game-layout').classList.add('planning-open');
    $('#planning-button').setAttribute('aria-expanded', 'true');
    $('#close-planning').focus({ preventScroll: true });
  }
  close(resume = true) {
    if (!this.open) return;
    this.open = false;
    $('#planning-panel').hidden = true;
    $('.game-layout').classList.remove('planning-open');
    $('#planning-button').setAttribute('aria-expanded', 'false');
    this.returnToScene(resume);
  }
  render(count: number, limit: number, preview: boolean) {
    $('#hud-echoes').textContent = `${count} / ${limit}`;
    $('.planning-heading > span').textContent = preview ? '只读预演' : '时间暂停';
  }
}
