import { PLAYTEST_KEY, PlaytestRecorder, type Context, type Profile } from './playtest.ts';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
export class PlaytestUI {
  recorder: PlaytestRecorder;
  private lastSave = 0;
  private lastZone = '';
  private lastStatus = '';
  constructor(private context: () => Context, pause: () => void) {
    try { this.recorder = new PlaytestRecorder(JSON.parse(localStorage.getItem(PLAYTEST_KEY) ?? 'null')); }
    catch { this.recorder = new PlaytestRecorder(); }
    $('.mission-panel').insertAdjacentHTML('beforeend', `<details class="hint playtest-panel"><summary>试玩记录（仅本机）<span>＋</span></summary><p>可自愿记录思考、执行、提示和失败，帮助校准主线节奏。不会自动上传；离开时请标记休息。记录时长还需要人工核对。</p><label>试玩身份<select id="playtest-role"><option value="developer">开发 / 调试</option><option value="first-time">首次接触本游戏</option><option value="returning">已玩过部分内容</option></select></label><label>解谜经验<select id="playtest-experience"><option value="regular">经常玩</option><option value="new">较少玩</option></select></label><label class="playtest-guide"><input id="playtest-guide" type="checkbox"> 使用了游戏外攻略</label><div class="playtest-buttons"><button id="playtest-toggle">开始记录</button><button id="playtest-break" disabled>离开一会儿</button><button id="playtest-export" disabled>导出 JSON</button></div><p id="playtest-status" role="status">尚未开始记录</p></details>`);
    $('#playtest-toggle').addEventListener('click', () => {
      this.tick();
      if (this.recorder.recording) this.recorder.stop();
      else this.recorder.start({ role: $<HTMLSelectElement>('#playtest-role').value as Profile['role'], experience: $<HTMLSelectElement>('#playtest-experience').value as Profile['experience'], externalGuide: $<HTMLInputElement>('#playtest-guide').checked }, crypto.randomUUID(), navigator.webdriver ? 'automation' : 'browser');
      this.tick(); this.save(); this.render();
    });
    $('#playtest-break').addEventListener('click', () => {
      this.tick(); this.recorder.onBreak = !this.recorder.onBreak;
      if (this.recorder.onBreak) pause();
      this.tick(); this.save(); this.render();
    });
    $('#playtest-guide').addEventListener('change', () => {
      if (!this.recorder.data) return;
      if ($<HTMLInputElement>('#playtest-guide').checked) this.recorder.data.profile.externalGuide = true;
      $<HTMLInputElement>('#playtest-guide').checked = this.recorder.data.profile.externalGuide;
      this.save();
    });
    $('#playtest-export').addEventListener('click', () => {
      this.tick(); this.save();
      const data = this.recorder.snapshot().data;
      if (!data) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `echo-heist-playtest-${data.id}.json`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.addEventListener('visibilitychange', () => { this.tick(); this.save(); });
    window.addEventListener('blur', () => { this.tick(); this.save(); });
    window.addEventListener('focus', () => { this.tick(); });
    window.addEventListener('pagehide', () => { this.tick(); this.save(); });
    this.render();
  }
  event(kind: string, detail = '') { this.recorder.event(kind, this.context().zoneId, detail); if (kind === 'won') this.save(); }
  tick() {
    const context = this.context(), now = performance.now();
    this.recorder.tick(now, { ...context, phase: document.hidden || !document.hasFocus() ? 'away' : context.phase });
    if (this.recorder.recording && context.zoneId !== this.lastZone) { this.recorder.event('enter', context.zoneId); this.lastZone = context.zoneId; }
    if (this.recorder.recording && now - this.lastSave > 10_000) { this.lastSave = now; this.save(); }
    this.render();
  }
  private save() {
    if (!this.recorder.data) return;
    try { localStorage.setItem(PLAYTEST_KEY, JSON.stringify(this.recorder.snapshot())); }
    catch { $('#playtest-status').textContent = '无法保存本机记录，可直接导出当前数据。'; }
  }
  private render() {
    const data = this.recorder.data;
    const state = `${this.recorder.recording}:${this.recorder.onBreak}:${Math.floor(this.recorder.activeMinutes)}:${!!data}`;
    if (state === this.lastStatus) return;
    this.lastStatus = state;
    $('#playtest-toggle').textContent = this.recorder.recording ? '停止记录' : data ? '继续记录' : '开始记录';
    $('#playtest-break').textContent = this.recorder.onBreak ? '已回来' : '离开一会儿';
    $<HTMLButtonElement>('#playtest-break').disabled = !this.recorder.recording;
    $<HTMLButtonElement>('#playtest-export').disabled = !data;
    for (const id of ['playtest-role', 'playtest-experience']) $<HTMLInputElement>('#' + id).disabled = !!data;
    if (data) {
      $<HTMLSelectElement>('#playtest-role').value = data.profile.role;
      $<HTMLSelectElement>('#playtest-experience').value = data.profile.experience;
      $<HTMLInputElement>('#playtest-guide').checked = data.profile.externalGuide;
    }
    $('#playtest-status').textContent = data ? `${this.recorder.recording ? this.recorder.onBreak ? '休息中，不计有效时间' : '正在本机记录' : '记录已停止'} · 待核对约 ${Math.floor(this.recorder.activeMinutes)} 分钟${data.environment === 'automation' ? ' · 自动化环境，不能作为真人时长证据' : ''}` : '尚未开始记录';
  }
}
