import type { Game } from './engine.ts';
import { FPS, MAX_FRAMES } from './levels.ts';
import { MISSIONS } from './campaign-content.ts';
import type { Campaign } from './campaign.ts';
import './campaign.css';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
type Actions = { mission: (id: string) => void; stage: (index: number) => void; training: () => void; preview: () => void; scrub: (frame: number) => void; delay: (index: number, delta: number) => void };

export class CampaignUI {
  private key = '';
  private delayKey = '';
  private securityKey = '';
  constructor(private campaign: Campaign, actions: Actions) {
    $('.intro').insertAdjacentHTML('afterend', `
      <section class="campaign-shell" aria-label="行动档案">
        <div class="campaign-toolbar"><details id="mission-board"><summary><span>行动档案</span><strong id="campaign-summary">昨天的搭档</strong><span class="board-arrow">⌄</span></summary><div id="mission-cards"></div></details><button id="training-mode">基础演习</button></div>
        <div id="story-strip" class="story-strip"><div><p class="eyebrow" id="chapter-label"></p><h2 id="operation-title"></h2></div><p id="story-line"></p></div>
        <div class="stage-bar" id="stage-bar"><nav id="stage-rail" aria-label="任务阶段"></nav><span id="checkpoint-note" role="status">锚点自动保存在本机</span></div>
      </section>`);
    $('.timeline').insertAdjacentHTML('afterend', `
      <div class="rehearsal-toolbar"><button id="preview-button" aria-pressed="false">◇ 预演回声</button><span id="interaction-tip">E 操作设备 · P 预演已保存的计划</span></div>
      <section id="preview-panel" class="preview-panel" hidden aria-label="回声预演"><div><strong>只读预演</strong><output id="preview-time">0.00s</output></div><p>仅播放已保存回声；真人不参与，也不会保存进度。拖动时间，检查门与设备。</p><input id="preview-frame" type="range" min="0" max="720" step="1" value="0" aria-label="预演时间"><ol id="preview-log"></ol></section>`);
    $('#echo-slots').insertAdjacentHTML('afterend', '<div id="echo-delays" class="echo-delays"></div>');
    $('.hint').insertAdjacentHTML('afterend', '<details class="hint evidence"><summary>已取得的线索 <span>＋</span></summary><div id="evidence-list"></div></details>');
    $('#preview-panel').insertAdjacentHTML('afterend', '<details id="security-panel" class="security-panel" hidden><summary>安保响应规则 <span>＋</span></summary><p id="security-rule"></p><ul id="security-status" aria-label="守卫状态"></ul><p>地图圆圈为参考响点；其他位置同样可以发声。方框标记的固定哨兵不响应诱饵。单位格与地图网格一致。</p></details>');
    $('#mission-cards').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mission]');
      if (button && !button.disabled) { actions.mission(button.dataset.mission!); $<HTMLDetailsElement>('#mission-board').open = false; }
    });
    $('#stage-rail').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-stage]');
      if (button && !button.disabled) actions.stage(Number(button.dataset.stage));
    });
    $('#training-mode').addEventListener('click', actions.training);
    $('#preview-button').addEventListener('click', actions.preview);
    $('#preview-frame').addEventListener('input', event => actions.scrub(Number((event.target as HTMLInputElement).value)));
    $('#echo-delays').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delay]');
      if (button && !button.disabled) actions.delay(Number(button.dataset.echo), Number(button.dataset.delay));
    });
    $('#echo-delays').addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      if (!input.matches('[data-delay-input]')) return;
      if (!input.checkValidity()) { input.reportValidity(); input.value = (Number(input.dataset.current) / FPS).toFixed(2); return; }
      actions.delay(Number(input.dataset.delayInput), Math.round(Number(input.value) * FPS) - Number(input.dataset.current));
    });
  }

  checkpointSaved(ok: boolean) { $('#checkpoint-note').textContent = ok ? '安全锚点已保存到本机' : '仅本次有效 · 本机存档不可用'; }

  render(game: Game, campaignMode: boolean, preview: Game | null) {
    const world = preview ?? game;
    const security = world.guards.map((guard, i) => {
      const def = world.level.guards[i];
      const source = guard.investigate ? world.soundName(guard.investigate) : '';
      const investigation = def.searchSeconds === undefined ? `调查 ${source}，剩余 ${guard.attention.toFixed(1)} 秒` : guard.searching ? `在 ${source} 搜索，剩余 ${guard.attention.toFixed(1)} 秒` : `前往 ${source}，抵达后搜索 ${def.searchSeconds} 秒`;
      return `${world.guardName(i)} · ${!world.powered(def.power) ? '断电' : def.kind === 'sentry' ? '固定哨兵，忽略声音' : guard.investigate ? investigation : '按原路线值守'} · 视野 ${(def.range / 32).toFixed(1)} 格${def.kind === 'sentry' ? '' : ` · 听觉 ${((def.hearing ?? 450) / 32).toFixed(1)} 格`}`;
    });
    const securityKey = `${world.level.id}:${security.join('|')}`;
    if (securityKey !== this.securityKey) {
      this.securityKey = securityKey;
      $('#security-panel').hidden = !world.guards.length;
      $('#security-rule').textContent = world.level.noiseResponse === 'nearest' ? '每个声源派最近的可响应守卫。同帧多声源按最近组合分派，每名守卫接一处；距离相同先按守卫编号，再按声源从西到东、从北到南。墙与玻璃不隔声；守卫抵达后搜索，再返回岗位。' : '听觉范围内的巡逻者都会响应；普通墙体不隔声。调查结束后返回原路线。';
      $('#security-status').replaceChildren(...security.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
    }
    const mission = this.campaign.mission;
    const stageIndex = mission.stages.findIndex(s => s.level.id === game.level.id);
    const key = `${campaignMode}:${mission.id}:${stageIndex}:${game.status}:${this.campaign.data.completed.join(',')}:${this.campaign.cleared()}`;
    if (key !== this.key) {
      this.key = key;
      $('.level-nav').hidden = campaignMode;
      $('#story-strip').hidden = !campaignMode;
      $('#stage-bar').hidden = !campaignMode;
      $('#training-mode').textContent = campaignMode ? '基础演习' : '返回主线';
      $('#campaign-summary').textContent = campaignMode ? `${mission.chapter} · ${mission.title}` : '原型演习 · 三种基本配合';
      $('#mission-cards').innerHTML = [...new Set(MISSIONS.map(m => m.chapter))].map(chapter => `<details class="chapter-group" ${chapter === mission.chapter ? 'open' : ''}><summary>${chapter === '序章' ? 'C0 / 昨天的搭档' : chapter === '机制试验' ? '机制试验 / 后续章节的可玩样例' : `${MISSIONS.find(m => m.chapter === chapter)!.id.split('-')[0]} / ${chapter}`}<span>${MISSIONS.filter(m => m.chapter === chapter && this.campaign.data.completed.includes(m.id)).length} / ${MISSIONS.filter(m => m.chapter === chapter).length}</span></summary><div class="mission-grid">${MISSIONS.filter(m => m.chapter === chapter).map(m => {
        const complete = this.campaign.data.completed.includes(m.id), available = this.campaign.available(m.id);
        return `<button class="mission-card ${m.id === mission.id && campaignMode ? 'current' : ''}" data-mission="${m.id}" ${!available ? 'disabled' : ''}><span>${complete ? '✓ 已完成' : available ? `${m.stages.length} 段行动` : '完成前一任务解锁'}</span><strong>${m.title}</strong><small>${m.summary}</small></button>`;
      }).join('')}</div></details>`).join('');
      if (campaignMode && stageIndex >= 0) {
        const stage = mission.stages[stageIndex];
        $('#chapter-label').textContent = `${mission.chapter} / ${String(MISSIONS.indexOf(mission) + 1).padStart(2, '0')} · 第 ${stageIndex + 1} / ${mission.stages.length} 段`;
        $('#operation-title').textContent = mission.title;
        $('#story-line').textContent = game.status === 'won' ? stage.result : stage.story;
        $('#stage-rail').innerHTML = mission.stages.map((s, i) => `<button data-stage="${i}" ${i > this.campaign.stageIndex ? 'disabled' : ''} ${i === stageIndex ? 'aria-current="step"' : ''} title="回到该锚点；其后阶段将重新规划"><span>${i < this.campaign.cleared() ? '✓' : String(i + 1).padStart(2, '0')}</span>${s.level.title}</button>`).join('');
      }
      $('#evidence-list').innerHTML = MISSIONS.filter(m => m.chapter !== '机制试验' && this.campaign.data.completed.includes(m.id)).map(m => `<p>◇ ${m.evidence}</p>`).join('') || '<p>完成主线任务后，线索会保存在这里。</p>';
    }
    const delayKey = `${!!preview}:${game.level.id}:${game.editingIndex}:${game.echoes.map(e => `${e.colorIndex}:${e.frames.length}:${e.delay ?? 0}`).join(',')}`;
    if (delayKey !== this.delayKey) {
      this.delayKey = delayKey;
      $('#echo-delays').innerHTML = game.echoes.map((echo, index) => {
        const delay = echo.delay ?? 0, cut = Math.max(0, delay + echo.frames.length - MAX_FRAMES);
        return `<div class="delay-row"><span>E${index + 1} 出场 <strong>${(delay / FPS).toFixed(2)}s</strong></span><input type="number" min="0" max="6" step="0.25" value="${(delay / FPS).toFixed(2)}" data-current="${delay}" data-delay-input="${index}" aria-label="回声 ${index + 1} 出场秒数" ${game.editingIndex !== null || preview ? 'disabled' : ''}><button data-echo="${index}" data-delay="-15" aria-label="提前回声 ${index + 1} 四分之一秒" ${delay === 0 || game.editingIndex !== null ? 'disabled' : ''}>−</button><button data-echo="${index}" data-delay="15" aria-label="延迟回声 ${index + 1} 四分之一秒" ${delay === 360 || game.editingIndex !== null ? 'disabled' : ''}>＋</button>${cut ? `<small>末尾 ${(cut / FPS).toFixed(2)}s 不会播放</small>` : ''}</div>`;
      }).join('') + (game.echoes.length ? '<p>每格 0.25s · 调整后从本轮起点重新规划</p>' : '');
      if (preview) document.querySelectorAll<HTMLButtonElement>('[data-delay]').forEach(button => { button.disabled = true; });
    }
    const intent = game.interaction();
    const tip = intent ? `E：${intent.type === 'circuit' ? `${intent.on ? '接通' : '断开'} ${intent.id}` : intent.type === 'take' ? `在 ${intent.id} 接收凭据` : intent.type === 'give' ? `向 ${intent.id} 交付凭据` : `在 ${intent.id} 请求授权`}` : game.tokenOwner === 'player' ? '你持有唯一凭据 · 到终端按 E 交付' : 'E 操作设备 · P 预演已保存的计划';
    const explanation = intent?.type === 'take' && game.tokenOwner !== `terminal:${intent.id}` ? `${tip}（终端为空，可录制请求）` : tip;
    if ($('#interaction-tip').textContent !== explanation) $('#interaction-tip').textContent = explanation;
    $('#preview-panel').hidden = !preview;
    $('#preview-button').textContent = preview ? '◇ 结束预演，返回计划' : '◇ 预演回声';
    $('#preview-button').setAttribute('aria-pressed', String(!!preview));
    $<HTMLButtonElement>('#preview-button').disabled = game.editingIndex !== null;
    if (preview) {
      $('#preview-time').textContent = `${preview.seconds.toFixed(2)}s${preview.failure ? ' · 发现暴露' : ''}`;
      $('#preview-log').innerHTML = preview.signals.slice(-6).map(s => `<li><time>${(s.frame / FPS).toFixed(2)}s</time> ${s.text}</li>`).join('') || '<li>此时没有门禁或设备事件。</li>';
    }
  }
}
