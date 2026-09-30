import type { Game, Intent, OperationRecord, OperationResult } from './engine.ts';
import { FPS, MAX_FRAMES } from './levels.ts';
import './operation.css';

type DisplayOperation = Omit<OperationRecord, 'result'> & { result: OperationResult | 'pending' | 'truncated' };
const names = { circuit: '设置', take: '接收', give: '交付', authorize: '授权', deposit: '植入' };
const results = { success: '已完成', blocked: '未执行', waiting: '登记留候', cancelled: '留候取消', ignored: '仅记录', pending: '尚未执行', truncated: '超出本轮' };
const symbols = { success: '✓', blocked: '×', waiting: '◇', cancelled: '×', ignored: '○', pending: '·', truncated: '!' };
const requestKey = (actor: string, frame: number, intent: Intent) => `${actor}:${frame}:${intent.type}:${intent.id}`;
const problem = (operation: DisplayOperation) => ['blocked', 'cancelled', 'truncated'].includes(operation.result);
export const operationText = (operation: DisplayOperation) => `${(operation.frame / FPS).toFixed(2)} 秒 · ${operation.label} · ${names[operation.intent.type]} ${operation.intent.id} · ${results[operation.result]}：${operation.reason}`;

export class OperationUI {
  private panel: HTMLDetailsElement;
  private detail: HTMLElement;
  private filter: HTMLInputElement;
  private previousWorld: Game | null = null;
  private previousTrack: Element | null = null;
  private key = '';
  private selected = '';
  private displayed: DisplayOperation[] = [];
  constructor(private pause: () => void) {
    document.querySelector('.timeline')!.insertAdjacentHTML('afterend', `<details id="operation-panel" class="operation-panel" hidden>
      <summary>操作记录 <span id="operation-count"></span></summary>
      <p id="operation-mode"></p>
      <p>轨道上的 ✓ 表示完成，× 表示受阻或取消，◇ 表示登记留候，○ 表示只记录请求，· 表示尚未执行，! 表示超出十二秒。点击标记查看原因。</p>
      <p id="operation-detail" tabindex="-1" hidden></p>
      <label class="operation-filter"><input type="checkbox" id="operation-problems">只看受阻、取消或超出时限的操作</label>
      <ol id="operation-log" aria-label="操作时间与原因"></ol>
    </details>`);
    this.panel = document.querySelector('#operation-panel')!;
    this.detail = document.querySelector('#operation-detail')!;
    this.filter = document.querySelector('#operation-problems')!;
    this.panel.addEventListener('toggle', () => { if (this.panel.open) this.pause(); });
    this.filter.addEventListener('change', () => { this.key = ''; });
    for (const element of [this.panel, document.querySelector('#tracks')!]) element.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-operation]');
      if (!button) return;
      const selected = this.displayed[Number(button.dataset.operation)];
      if (!selected) return;
      this.pause(); this.panel.open = true;
      this.selected = requestKey(selected.actor, selected.frame, selected.intent) + ':' + selected.result;
      this.detail.hidden = false; this.detail.textContent = operationText(selected);
      this.detail.focus({ preventScroll: true }); this.detail.scrollIntoView({ block: 'nearest' });
    });
  }

  render(game: Game, preview: Game | null) {
    const world = preview ?? game;
    const tracks = document.querySelector('#tracks')!;
    const firstTrack = tracks.firstElementChild;
    const key = `${world.level.id}:${game.attempts}:${world.operationLog.length}:${!!preview}:${this.filter.checked}`;
    if (key === this.key && world === this.previousWorld && firstTrack === this.previousTrack) return;
    const changedRound = world.level.id !== this.previousWorld?.level.id || (!preview && world !== this.previousWorld) || key.split(':')[1] !== this.key.split(':')[1];
    this.key = key; this.previousWorld = world; this.previousTrack = firstTrack;
    if (changedRound) { this.selected = ''; this.detail.hidden = true; }
    const actual = new Set(world.operationLog.map(op => requestKey(op.actor, op.frame, op.intent)));
    const planned: DisplayOperation[] = [];
    game.echoes.forEach((echo, index) => {
      if (index === game.editingIndex) return;
      echo.frames.forEach((pose, local) => {
        if (!pose.intent) return;
        const frame = local + (echo.delay ?? 0), actor = `echo:${echo.colorIndex}`;
        if (actual.has(requestKey(actor, frame, pose.intent))) return;
        planned.push({ actor, frame, label: `回声 ${index + 1}`, intent: pose.intent, point: pose, result: frame >= MAX_FRAMES ? 'truncated' : 'pending', reason: frame >= MAX_FRAMES ? '出场延迟把这次请求推到了十二秒之后，本轮不会播放' : '还未执行到这次请求，结果以当时的条件为准' });
      });
    });
    this.displayed = [...world.operationLog, ...planned].sort((a, b) => a.frame - b.frame || a.actor.localeCompare(b.actor));
    const visible = !!(world.level.circuits?.length || world.level.terminals?.length || world.level.delivery || this.displayed.length);
    this.panel.hidden = !visible;
    document.querySelector('.timeline')!.classList.toggle('has-operations', visible);
    const bad = this.displayed.filter(problem).length;
    document.querySelector('#operation-count')!.textContent = bad ? `${bad} 项需查看` : `${world.operationLog.length} 条结果`;
    document.querySelector('#operation-mode')!.textContent = preview ? '正在查看只读预演；真人不参与。接力缺少真人送件、实体植入不执行，都可能与实际行动不同。' : '正在查看本轮实际操作；重试后重新判断。已录下的请求不保证下轮成功，操作结果不会写入录像。';
    if (this.selected && !this.displayed.some(op => requestKey(op.actor, op.frame, op.intent) + ':' + op.result === this.selected)) { this.selected = ''; this.detail.hidden = true; }

    for (const element of tracks.querySelectorAll('.operation-marks, #player-operation-track')) element.remove();
    if (visible && !preview && world.operationLog.some(op => op.actor === 'player')) {
      const row = document.createElement('div'); row.id = 'player-operation-track'; row.className = 'track';
      row.innerHTML = '<span class="track-label">YOU</span><div class="track-line"><span class="track-playhead"></span></div>';
      tracks.append(row);
    }
    const lines = [...tracks.querySelectorAll<HTMLElement>('.track-line')];
    const markerGroups = new Map<string, number>();
    this.displayed.forEach((operation, index) => { markerGroups.set(requestKey(operation.actor, operation.frame, operation.intent), index); });
    for (const index of markerGroups.values()) {
      const operation = this.displayed[index];
      const lane = operation.actor === 'player' ? 3 : game.echoes.findIndex(echo => `echo:${echo.colorIndex}` === operation.actor);
      const line = lines[lane]; if (!line) continue;
      let group = line.querySelector<HTMLElement>('.operation-marks');
      if (!group) { group = document.createElement('span'); group.className = 'operation-marks'; line.append(group); }
      const marker = this.button(operation, index); marker.className = 'operation-marker';
      marker.style.left = `${Math.min(99, operation.frame / MAX_FRAMES * 100)}%`; marker.textContent = symbols[operation.result];
      marker.title = operationText(operation); marker.setAttribute('aria-label', operationText(operation)); group.append(marker);
    }
    const log = document.querySelector('#operation-log')!;
    log.replaceChildren(...this.displayed.flatMap((operation, index) => {
      if (this.filter.checked && !problem(operation)) return [];
      const item = document.createElement('li'), button = this.button(operation, index);
      button.textContent = `${symbols[operation.result]} ${operationText(operation)}`; item.append(button); return [item];
    }));
    if (!log.childElementCount) { const item = document.createElement('li'); item.textContent = this.filter.checked ? '目前没有受阻、取消或超出时限的操作。' : '尚无 E 操作。靠近设备操作，或先录制一条操作路线。'; log.append(item); }
  }
  private button(operation: DisplayOperation, index: number) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.operation = String(index); button.dataset.result = operation.result; return button;
  }
}
