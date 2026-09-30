import './style.css';
import './planning.css';
import { Game } from './engine.ts';
import { ECHO_COLORS, FPS, LEVELS, LOOP_SECONDS, MAX_ECHOES, type Level } from './levels.ts';
import { Renderer } from './render.ts';
import { Sound } from './audio.ts';
import { decodePlan, encodePlan, PLAN_KEY, type SavedPlan } from './plans.ts';
import { CAMPAIGN_LEVELS, MISSIONS, canonicalZoneId } from './campaign-content.ts';
import { Campaign, CAMPAIGN_KEY } from './campaign.ts';
import { CampaignUI } from './campaign-ui.ts';
import { PlaytestUI } from './playtest-ui.ts';
import { EndingUI } from './ending-ui.ts';
import { OperationUI, operationText } from './operation-ui.ts';

const ALL_LEVELS = [...LEVELS, ...CAMPAIGN_LEVELS];
let campaign: Campaign;
try { campaign = new Campaign(JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null')); }
catch { campaign = new Campaign(); }

const icons = {
  echo: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M6 6h20v6H12v4h12v5H12v5h14" stroke="currentColor" stroke-width="3"/><path d="M2 11v19h19" stroke="currentColor" opacity=".4" stroke-width="2"/></svg>',
  rewind: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 5 3 10l5 5V5Zm8 0-5 5 5 5V5Z" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg>',
  sound: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m10 4-4 3H3v6h3l4 3V4Zm3 3c2 1 2 5 0 6m3-9c4 3 4 9 0 12" stroke="currentColor" stroke-width="1.3"/></svg>',
  eye: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" stroke="currentColor" stroke-width="1.3"/><circle cx="10" cy="10" r="2" stroke="currentColor"/></svg>',
};

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let saved: Record<string, { echoes: number; seconds: number }> = {};
try {
  const raw = JSON.parse(localStorage.getItem('echo-heist-progress-v1') ?? '{}');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const level of ALL_LEVELS) {
      const record = raw[level.id];
      if (record && Number.isFinite(record.echoes) && Number.isFinite(record.seconds)) saved[level.id] = record;
    }
  }
} catch { /* Storage can be unavailable in private browser contexts. */ }

const plans: Record<string, SavedPlan> = {};
try {
  const raw: unknown = JSON.parse(localStorage.getItem(PLAN_KEY) ?? '{}');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const level of ALL_LEVELS) {
      const echoes = decodePlan((raw as Record<string, unknown>)[level.id], level.id);
      if (echoes) plans[level.id] = encodePlan(level.id, echoes);
    }
  }
} catch { /* Invalid or unavailable saves fall back to a fresh plan. */ }

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="ECHO HEIST 首页"><span class="brand-symbol">${icons.echo}</span><span>ECHO HEIST<span class="brand-cn">回声劫案</span></span></a>
    <div class="header-note"><span class="status-dot"></span> A SOLO CO-OP HEIST <span class="version">VOL. 02</span></div>
    <button class="text-button" id="help-button">行动手册 <span class="key">?</span></button>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">12 SECONDS. THREE ECHOES. ONE PERFECT HEIST.</p><h1>你的同伙，是过去的你<span>。</span></h1></div>
      <nav class="level-nav" aria-label="选择关卡">${LEVELS.map((level, i) => `<button class="level-tab" data-level="${i}"><span class="tab-number">${level.id}</span><span>${level.title}</span><span class="level-check" aria-label="已完成">${saved[level.id] ? '✓' : ''}</span></button>`).join('')}</nav>
    </section>
    <div class="game-layout">
      <section class="console" aria-label="游戏区域">
        <div class="console-bar"><div class="feed-label"><span class="status-dot"></span> LIVE FEED <span class="divider">/</span> <span id="map-code">ANNEX_01</span></div><div class="console-controls"><button class="fast-forward-button" id="fast-forward" title="按住快进，或按住 Shift" aria-label="按住三倍快进" aria-pressed="false">3× <span>快进</span></button><button class="icon-button active" id="trails-button" title="显示 / 隐藏回声轨迹" aria-label="显示回声轨迹" aria-pressed="true">${icons.eye}</button><button class="icon-button" id="sound-button" title="开启音效" aria-label="开启音效" aria-pressed="false">${icons.sound}<span class="sound-off"></span></button><button class="icon-button pause-button" id="pause-button" title="暂停 / 继续 (Esc)" aria-label="暂停游戏">Ⅱ</button><button class="icon-button" id="fullscreen-button" title="全屏" aria-label="切换全屏">⛶</button></div></div>
        <div class="arena">
          <canvas id="game-canvas" tabindex="0" aria-label="俯视角金库。用 WASD 或方向键移动，R 保存回声，空格制造声响。详细操作见行动手册。"></canvas>
          <div class="arena-badge"><span id="speed-indicator" hidden>3× FAST FORWARD</span><span class="rec-dot"></span><span id="record-label">STANDBY</span></div>
          <div class="edit-banner" id="edit-banner" hidden><span id="edit-label"></span><button id="cancel-rerecord">取消，保留原路线</button></div>
          <div class="arena-caption">ARCHIVE SECURITY SYSTEM <span>CAM_04</span></div>
          <div class="overlay" id="overlay"><div class="overlay-card" id="overlay-card"></div></div>
          <div class="toast" id="toast" role="status" aria-live="polite"></div>
        </div>
        <div class="timeline"><div class="timeline-heading"><span>时间轨道 <small>REPLAY BUFFER</small></span><span class="timeline-scale"><span>0s</span><span>4s</span><span>8s</span><span>12s</span></span></div><div id="tracks"></div></div>
        <div class="touch-controls" aria-label="触摸控制"><div class="dpad"><button data-direction="up" aria-label="向上移动">↑</button><button data-direction="left" aria-label="向左移动">←</button><button data-direction="down" aria-label="向下移动">↓</button><button data-direction="right" aria-label="向右移动">→</button></div><button class="touch-lure" id="touch-lure">制造声响</button></div>
      </section>
      <aside class="mission-panel">
        <div class="mission-heading"><span class="eyebrow">OPERATION <span id="mission-number">01</span> / 03</span><span class="mission-symbol">↗</span></div>
        <h2 id="mission-title"></h2><p class="mission-subtitle" id="mission-subtitle"></p><p class="mission-description" id="mission-description"></p>
        <div class="clock-panel"><div class="clock-top"><span>本轮剩余</span><span id="loop-number">TAKE 01</span></div><div class="clock"><span id="seconds">12</span><span class="clock-fraction" id="fraction">.00</span><span class="clock-unit">s</span></div><div class="clock-progress"><span id="clock-fill"></span></div></div>
        <div class="objectives"><p class="section-label">行动目标 <span>OBJECTIVES</span></p><div class="objective" id="objective-doors"><span class="objective-check">01</span><div>让过去的你打开通道<small id="door-status">等待开关激活</small></div></div><div class="objective" id="objective-loot"><span class="objective-check">02</span><div>取走藏品，回到撤离点<small id="loot-status">藏品位于右上角</small></div></div></div>
        <div class="echo-section"><p class="section-label">你的同伙 <span id="echo-count">0 / 3</span></p><div id="echo-slots"></div><p class="plan-status" id="plan-status" role="status">录制后自动保存</p></div>
        <div class="mission-actions"><button class="primary-button" id="record-button">${icons.rewind}<span>留下回声</span><kbd>R</kbd></button><div class="secondary-actions"><button id="retry-button">重试本轮 <kbd>↵</kbd></button><button id="undo-button" title="撤销上次录制、重录、删除或清空 (Z)">撤销 <kbd>Z</kbd></button><button id="reset-button">清空计划</button></div></div>
        <details class="hint"><summary>卡住了？查看线索 <span>＋</span></summary><p id="hint-text"></p></details>
      </aside>
    </div>
    <footer class="game-footer"><div class="controls-legend"><span><kbd>W A S D</kbd> / <kbd>↑↓←→</kbd> 移动</span><span><kbd>R</kbd> 保存回声</span><span><kbd>SHIFT</kbd> 按住快进</span><span><kbd>SPACE</kbd> 声响诱饵</span><span><kbd>ESC</kbd> 暂停</span></div><span class="footer-motto">ONE THIEF. MULTIPLE ALIBIS.</span></footer>
  </main>
  <dialog id="help-dialog"><button class="dialog-close" aria-label="关闭行动手册">×</button><p class="eyebrow">FIELD MANUAL / 002</p><h2>你只需要一个同伙。<br />昨天的你就够了。</h2><p class="manual-intro">每一轮有 12 秒。走过的路线会被录下，成为下一轮与你同时行动的回声。</p><ol class="manual-steps"><li><strong>走到开关，留下自己</strong><p>用 WASD 或方向键走到 A。按 R 保存路线并开始下一轮。提前录制的回声会停在终点，直到这一轮结束。</p></li><li><strong>让过去为现在开门</strong><p>回声从起点重放，你可以自由行动。它会踩开关、重放声响，也会被守卫发现。回声是投影，可穿过后来关闭的门，无法拿走藏品。</p></li><li><strong>拿到藏品，安全撤离</strong><p>接触右上角金色藏品自动拾取，再返回左下角撤离点。12 秒用尽会自动录制；槽位满时可以点击重录，调整某一名同伙的路线。</p></li><li><strong>修改计划，不必全部重来</strong><p>点击回声卡片的「重录」，其他同伙照常行动，被重录的旧回声暂时退场。这一轮只录路线；按 R 替换，或取消以保留旧路线。误删或录错可以按 Z 撤销。按住 Shift 以三倍速度推进，松开恢复正常。</p></li></ol><div class="manual-shortcuts"><span><kbd>R</kbd> 保存回声</span><span><kbd>Enter</kbd> 重试，保留同伙</span><span><kbd>Shift</kbd> 按住快进</span><span><kbd>Z</kbd> 撤销计划修改</span></div><p class="manual-note">已保存的回声计划按关卡保存在本机，刷新或切换关卡不会丢失。正在录制的草稿和撤销历史仅在本次关卡有效。建议使用桌面键盘游玩。</p><button class="primary-button" id="close-help">知道了，开始行动 ${icons.arrow}</button></dialog>
`;

let levelIndex = 0;
let campaignMode = false;
let previewGame: Game | null = null;
let previewWasRunning = false;
let game = new Game(LEVELS[0]);
const renderer = new Renderer($('#game-canvas'));
const sound = new Sound();
const keys = new Set<string>();
let accumulator = 0;
let lastFrame = performance.now();
let uiKey = '';
let overlayKey = '';
let toastTimer = 0;
let helpWasRunning = false;
let initialized = false;
let pointerFastForward = false;
let hintStep = 0;
const dialog = $<HTMLDialogElement>('#help-dialog');
const endingUI = new EndingUI(() => {
  if (campaign.revisitEnding()) { clearInput(); saveCampaign(); loadLevel(campaign.stage.level); focusGame(); }
});
const campaignUI = new CampaignUI(campaign, {
  mission: id => openMission(id),
  stage: index => { if (campaign.returnTo(index)) { saveCampaign(); loadLevel(campaign.stage.level); } },
  training: () => campaignMode ? setLevel(0) : openMission(campaign.data.selected, false),
  preview: togglePreview,
  scrub: frame => { previewGame = game.previewAt(frame); refreshUI(); },
  delay: (index, delta) => {
    if (game.setDelay(index, (game.echoes[index]?.delay ?? 0) + delta)) {
      previewGame = null; clearInput(); accumulator = 0; uiKey = ''; overlayKey = '';
      persistPlan(); refreshUI();
    }
  },
});
const operationUI = new OperationUI(() => { clearInput(); if (game.status === 'running') { game.togglePause(); refreshUI(); } });
$('#mission-board').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('#mission-board').open && game.status === 'running') { game.togglePause(); clearInput(); refreshUI(); }
});
$('#security-panel').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('#security-panel').open && game.status === 'running') { game.togglePause(); clearInput(); refreshUI(); }
});
$('#power-panel').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('#power-panel').open && game.status === 'running') { game.togglePause(); clearInput(); refreshUI(); }
});
$('#relay-panel').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('#relay-panel').open && game.status === 'running') { game.togglePause(); clearInput(); refreshUI(); }
});
$('#suppression-panel').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('#suppression-panel').open && game.status === 'running') { game.togglePause(); clearInput(); refreshUI(); }
});
$('#delivery-panel').addEventListener('toggle', () => {
  if ($<HTMLDetailsElement>('#delivery-panel').open && game.status === 'running') { game.togglePause(); clearInput(); refreshUI(); }
});
$('#touch-lure').insertAdjacentHTML('afterend', '<button class="touch-lure" id="touch-interact">E 操作设备</button>');
$('.clock-panel').insertAdjacentElement('afterend', $('.mission-actions'));
$('#hint-text').insertAdjacentHTML('afterend', '<button id="more-hint" class="more-hint" hidden>再给一点提示</button>');
$('#more-hint').addEventListener('click', () => { hintStep++; renderHint(); playtesting.event('hint', `tier ${hintStep + 1}`); });
function renderHint() {
  const hints = game.level.hints ?? [game.level.hint];
  hintStep = Math.min(hintStep, hints.length - 1);
  $('#hint-text').textContent = hints[hintStep];
  $('#more-hint').hidden = hintStep >= hints.length - 1;
  $('#more-hint').textContent = `再给一点提示（${hintStep + 1} / ${hints.length}）`;
}
$('.version').textContent = 'VOL. 12';
$('.manual-steps').insertAdjacentHTML('beforeend', '<li><strong>安排一场完整劫案</strong><p>行动档案中的序章会逐步解锁。每段成功后保存安全锚点，下一段重新录制同伙。点击阶段名称可以回退；之后的阶段需要重做。</p></li><li><strong>调整时序，先看结果</strong><p>回声下方的加减按钮以 0.25 秒调整出场；按 P 预演已保存的回声，拖动时间检查门禁与暴露。E 操作电源和凭据终端，录制会保留这次操作请求。轨道上的 ✓ 表示完成，× 表示受阻或留候取消；点击标记会暂停并显示时间、操作者和原因。「操作记录」保留本轮结果，可只看问题项。预演没有真人送件，结果可能与实际行动不同。</p></li>');
const playtesting = new PlaytestUI(() => ({ zoneId: canonicalZoneId(game.level.id), missionId: campaignMode ? campaign.mission.id : game.level.id, phase: dialog.open ? 'help' : previewGame ? 'rehearsal' : game.status === 'running' ? 'execution' : 'planning' }), () => { if (game.status === 'running') game.togglePause(); clearInput(); });
$('.hint').addEventListener('toggle', () => { if ($<HTMLDetailsElement>('.hint').open) playtesting.event('hint', `tier ${hintStep + 1}`); });

function saveCampaign() {
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign.export())); campaignUI.checkpointSaved(true); }
  catch { campaignUI.checkpointSaved(false); }
}

function openMission(id: string, replay = true) {
  if (!campaign.select(id)) return;
  if (replay && campaign.cleared() === campaign.mission.stages.length) campaign.returnTo(0);
  campaignMode = true; levelIndex = -1;
  loadLevel(campaign.stage.level); saveCampaign();
}

function togglePreview() {
  if (game.editingIndex !== null) return;
  if (previewGame) {
    previewGame = null;
    if (previewWasRunning && game.status === 'paused') game.togglePause();
    previewWasRunning = false; overlayKey = ''; uiKey = ''; refreshUI(); focusGame();
  } else {
    previewWasRunning = game.status === 'running';
    if (previewWasRunning) game.togglePause();
    clearInput(); previewGame = game.previewAt(0);
    renderer.rewindFlash = 0; $('#toast').classList.remove('visible');
    $<HTMLInputElement>('#preview-frame').value = '0'; refreshUI();
  }
}

function clearInput() { keys.clear(); pointerFastForward = false; }
function isFastForwarding() { return game.status === 'running' && (pointerFastForward || keys.has('ShiftLeft') || keys.has('ShiftRight')); }

function persistPlan() {
  plans[game.level.id] = encodePlan(game.level.id, game.echoes);
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
    $('#plan-status').textContent = '计划已保存到本机';
  } catch { $('#plan-status').textContent = '仅本次有效 · 无法写入本机存档'; }
}

function toast(text: string) {
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}

function focusGame() { $('#game-canvas').focus({ preventScroll: true }); }

function setLevel(index: number) {
  campaignMode = false;
  levelIndex = index;
  loadLevel(LEVELS[index]);
}

function loadLevel(level: Level) {
  if (initialized) persistPlan();
  previewGame = null; previewWasRunning = false;
  game = new Game(level);
  const restored = decodePlan(plans[game.level.id], game.level.id);
  if (restored) game.restorePlan(restored);
  $('#plan-status').textContent = restored?.length ? `已恢复 ${restored.length} 条回声` : '录制后自动保存';
  initialized = true;
  clearInput(); accumulator = 0;
  uiKey = ''; overlayKey = '';
  $('#toast').classList.remove('visible');
  $('#mission-number').textContent = level.id;
  if (campaignMode) $('#mission-number').textContent = `${campaign.indexOf(level.id) + 1} / ${campaign.mission.stages.length}`;
  $('#mission-number').parentElement!.lastChild!.textContent = campaignMode ? '' : ' / 03';
  $('#mission-title').textContent = level.title;
  $('#mission-subtitle').textContent = level.subtitle;
  $('#mission-description').textContent = level.description;
  hintStep = 0; renderHint();
  $('#map-code').textContent = `ANNEX_${level.id}`;
  $<HTMLDetailsElement>('.hint').open = false;
  document.querySelectorAll<HTMLButtonElement>('.level-tab').forEach((tab, i) => {
    tab.classList.toggle('selected', !campaignMode && i === levelIndex);
    tab.setAttribute('aria-current', !campaignMode && i === levelIndex ? 'step' : 'false');
  });
  refreshUI();
}

function primaryAction() {
  sound.unlock();
  if (campaignMode && campaign.ending && ['ready', 'won'].includes(game.status)) { clearInput(); endingUI.show(campaign.ending); return; }
  if (game.status === 'ready') game.start();
  else if (game.status === 'paused') game.togglePause();
  else if (game.status === 'caught') game.restart();
  else if (game.status === 'won') {
    if (campaignMode) {
      if (campaign.cleared() < campaign.mission.stages.length) loadLevel(campaign.stage.level);
      else {
        const next = campaign.nextMission;
        if (next) openMission(next.id);
        else { campaign.returnTo(0); loadLevel(campaign.stage.level); saveCampaign(); }
      }
    }
    else if (levelIndex < LEVELS.length - 1) setLevel(levelIndex + 1);
    else setLevel(0);
  }
  accumulator = 0;
  focusGame();
}

function record() {
  sound.unlock();
  if (game.status === 'ready') { game.start(); focusGame(); return; }
  if (game.status === 'running') {
    const editing = game.editingIndex !== null;
    if (game.rewind()) { accumulator = 0; clearInput(); toast(editing ? '新路线已替换。按 Z 可撤销这次修改。' : '回声已就位。现在，和过去的自己合作。'); }
    else if (game.lastMessage) toast(game.lastMessage);
  }
  focusGame();
}

function refreshUI() {
  campaignUI.render(game, campaignMode, previewGame);
  $('.game-layout').classList.toggle('previewing', !!previewGame);
  const key = `${game.status}:${game.editingIndex}:${game.canUndo}:${game.echoes.length}:${game.echoes.map(e => `${e.colorIndex}-${e.frames.length}-${e.delay ?? 0}`).join(',')}:${game.attempts}:${game.hasLoot}:${[...game.openDoors].join('')}:${[...game.circuits].join(',')}`;
  if (uiKey !== key) {
    uiKey = key;
    $('#loop-number').textContent = `TAKE ${String(game.attempts).padStart(2, '0')}`;
    $('#echo-count').textContent = `${game.echoes.length} / ${MAX_ECHOES}`;
    $('#record-label').textContent = game.status === 'running' ? 'REC ●' : game.status === 'paused' ? 'PAUSED' : game.status === 'won' ? 'EXTRACTED' : 'STANDBY';
    $('.arena-badge').classList.toggle('recording', game.status === 'running');
    $('#echo-slots').innerHTML = Array.from({ length: MAX_ECHOES }, (_, i) => {
      const echo = game.echoes[i];
      return echo ? `<div class="echo-slot filled ${game.editingIndex === i ? 'editing' : ''}" style="--echo-color:${ECHO_COLORS[echo.colorIndex]}"><span class="echo-avatar">${icons.echo}</span><div class="echo-info"><strong>回声 0${i + 1}<span>${(echo.frames.length / FPS).toFixed(1)}s</span></strong><small data-echo-state="${i}"></small></div><button class="rerecord-button" data-rerecord="${i}" aria-label="重录回声 ${i + 1}" ${game.editingIndex !== null ? 'disabled' : ''}>重录</button><button data-delete="${i}" title="删除回声 ${i + 1} 并重新规划" aria-label="删除回声 ${i + 1}" ${game.editingIndex !== null ? 'disabled' : ''}>×</button></div>` : `<div class="echo-slot empty"><span class="empty-cross">＋</span><span>等待另一个你</span><span class="slot-number">0${i + 1}</span></div>`;
    }).join('');
    $('#tracks').innerHTML = Array.from({ length: MAX_ECHOES }, (_, i) => {
      const echo = game.echoes[i];
      return `<div class="track ${game.editingIndex === i ? 'editing-track' : ''}"><span class="track-label" style="color:${echo ? ECHO_COLORS[echo.colorIndex] : '#62766a'}">E${i + 1}</span><div class="track-line" style="--echo-color:${echo ? ECHO_COLORS[echo.colorIndex] : '#526153'}">${echo ? `<span class="recorded-segment" style="width:${echo.frames.length / FPS / LOOP_SECONDS * 100}%"></span><span class="hold-segment" style="left:${echo.frames.length / FPS / LOOP_SECONDS * 100}%"></span>` : '<span class="empty-track"></span>'}${game.editingIndex === i ? '<span class="draft-segment"></span>' : ''}<span class="track-playhead"></span></div></div>`;
    }).join('');
    document.querySelectorAll<HTMLElement>('.track').forEach((track, i) => {
      const echo = game.echoes[i];
      if (!echo) return;
      const start = (echo.delay ?? 0) / FPS / LOOP_SECONDS * 100;
      const width = Math.min(100 - start, echo.frames.length / FPS / LOOP_SECONDS * 100);
      const segment = track.querySelector<HTMLElement>('.recorded-segment')!;
      segment.style.left = `${start}%`; segment.style.width = `${width}%`;
      track.querySelector<HTMLElement>('.hold-segment')!.style.left = `${start + width}%`;
    });
    const allDoors = game.openDoors.size === game.level.doors.length;
    $('#objective-doors').classList.toggle('done', allDoors);
    $('#objective-loot').classList.toggle('done', game.level.objective === 'deliver' ? game.objectiveComplete : game.hasLoot);
    $('#door-status').textContent = allDoors ? '所有通道已打开' : `${game.openDoors.size} / ${game.level.doors.length} 道门已开启`;
    $('#loot-status').textContent = game.editingIndex !== null ? '重录中：这一轮只录路线' : game.status === 'won' ? '安全撤离，行动完成' : game.level.objectiveLabel ? (game.hasLoot ? '目标已取得，前往标记的撤离点' : game.level.objectiveLabel) : game.hasLoot ? '已拿到藏品，返回左下角！' : '藏品位于右上角';
    $('#objective-loot > div').firstChild!.textContent = game.level.objective === 'deliver' ? '植入证据，确认送达' : game.level.objective === 'reach' ? '抵达安全锚点' : '取得目标，安全撤离';
    if (!game.exitReady && (game.hasLoot || game.level.objective === 'reach')) $('#loot-status').textContent = `撤离前需：${game.powerRequirements(game.unmetPower(game.level.exitPower))}`;
    else if (!game.hasLoot && !game.canCollect) $('#loot-status').textContent = `取物前需：${game.powerRequirements(game.unmetPower(game.level.lootPower))}`;
    if (game.level.circuits?.length) {
      $('#objective-doors > div').firstChild!.textContent = '安排所需通道';
      $('#door-status').textContent = `${game.openDoors.size} / ${game.level.doors.length} 道门开启 · 可以分时通过`;
    } else $('#objective-doors > div').firstChild!.textContent = '让过去的你打开通道';
    const button = $<HTMLButtonElement>('#record-button');
    button.disabled = !['ready', 'running'].includes(game.status);
    button.querySelector('span')!.textContent = game.editingIndex !== null ? (game.status === 'ready' ? '开始重录' : '保存新路线') : game.status === 'ready' ? '开始行动' : '留下回声';
    $('#pause-button').textContent = game.status === 'paused' ? '▷' : 'Ⅱ';
    $('#pause-button').setAttribute('aria-label', game.status === 'paused' ? '继续游戏' : '暂停游戏');
    $<HTMLButtonElement>('#retry-button').disabled = game.status === 'ready';
    $<HTMLButtonElement>('#undo-button').disabled = !game.canUndo;
    $<HTMLButtonElement>('#reset-button').disabled = game.editingIndex !== null;
    $('#edit-banner').hidden = game.editingIndex === null;
    $('#edit-label').textContent = game.editingIndex === null ? '' : `重录回声 0${game.editingIndex + 1} · R 保存新路线`;
  }
  operationUI.render(game, previewGame);
  const fast = isFastForwarding();
  if (previewGame) document.querySelectorAll<HTMLButtonElement>('#record-button, #retry-button, #undo-button, #reset-button, [data-delete], [data-rerecord]').forEach(button => { button.disabled = true; });
  $<HTMLButtonElement>('#pause-button').disabled = !!previewGame;
  $<HTMLButtonElement>('#fast-forward').disabled = !!previewGame;
  $('#speed-indicator').hidden = !fast;
  $('#fast-forward').classList.toggle('active', fast);
  $('#fast-forward').setAttribute('aria-pressed', String(fast));
  document.querySelectorAll<HTMLElement>('[data-echo-state]').forEach(el => {
    const state = game.echoActivity(Number(el.dataset.echoState));
    if (el.textContent !== state) el.textContent = state;
  });
  const draft = document.querySelector<HTMLElement>('.draft-segment');
  if (draft) draft.style.width = `${game.seconds / LOOP_SECONDS * 100}%`;
  const display = previewGame ?? game;
  if (game.level.objective === 'deliver') {
    $('#objective-loot').classList.toggle('done', !previewGame && game.objectiveComplete);
    $('#loot-status').textContent = previewGame ? '预演不含实体植入与回执' : game.editingIndex !== null ? '重录中：只录路线，不能植入证据' : game.status === 'won' ? '送达确认，安全撤离' : game.objectiveComplete && !game.exitReady ? `撤离前需：${game.powerRequirements(game.unmetPower(game.level.exitPower))}` : game.deliveryStatus();
    if (!game.level.doors.length && game.level.delivery?.receivers?.length) {
      $('#objective-doors > div').firstChild!.textContent = '让见证人带回回执';
      $('#door-status').textContent = `已发现 ${display.evidenceReaders.size} · 已登记 ${display.evidenceReceipts.size} / ${game.level.delivery.receivers.length}`;
      $('#objective-doors').classList.toggle('done', !previewGame && game.objectiveComplete);
    }
  }
  $('.clock-top > span:first-child').textContent = previewGame ? '预演剩余 · 只读' : '本轮剩余';
  const seconds = display.remaining.toFixed(2).split('.');
  $('#seconds').textContent = seconds[0].padStart(2, '0');
  $('#fraction').textContent = `.${seconds[1]}`;
  $('#clock-fill').style.transform = `scaleX(${display.remaining / LOOP_SECONDS})`;
  $('.clock-panel').classList.toggle('urgent', game.status === 'running' && game.remaining <= 3);
  document.querySelectorAll<HTMLElement>('.track-playhead').forEach(el => el.style.left = `${game.seconds / LOOP_SECONDS * 100}%`);

  if (previewGame) {
    $('#overlay').hidden = true;
    $('#record-label').textContent = 'REHEARSAL';
    if (game.level.circuits?.length && game.level.objective !== 'deliver') $('#loot-status').textContent = '仅预演回声操作；取物及其后果需要真人执行。';
    $('#door-status').textContent = previewGame.level.circuits?.length ? `${previewGame.openDoors.size} / ${previewGame.level.doors.length} 道门开启 · 可以分时通过` : previewGame.openDoors.size === previewGame.level.doors.length ? '所有通道已打开' : `${previewGame.openDoors.size} / ${previewGame.level.doors.length} 道门已开启`;
    document.querySelectorAll<HTMLElement>('[data-echo-state]').forEach(el => { el.textContent = previewGame!.echoActivity(Number(el.dataset.echoState)); });
    document.querySelectorAll<HTMLElement>('.track-playhead').forEach(el => el.style.left = `${previewGame!.seconds / LOOP_SECONDS * 100}%`);
    return;
  }
  if (overlayKey !== `${game.level.id}:${game.status}:${game.editingIndex}:${game.lastMessage}`) {
    overlayKey = `${game.level.id}:${game.status}:${game.editingIndex}:${game.lastMessage}`;
    const overlay = $('#overlay');
    overlay.hidden = game.status === 'running';
    if (game.status === 'running') return;
    let eyebrow = '', title = '', copy = '', action = '', extra = '';
    if (game.status === 'ready' && campaignMode && campaign.ending) {
      eyebrow = 'STORY COMPLETE'; title = '回声劫案 · 已完成'; copy = campaign.ending.title;
      action = '前往旧渡口'; extra = '<p class="overlay-footnote">尾声已保存 · 可回到最终选择锚点</p>';
    } else if (game.status === 'ready') {
      eyebrow = `OPERATION ${game.level.id} / BRIEFING`;
      title = game.level.title;
      copy = game.level.briefing[0];
      action = '开始行动';
      extra = `<p class="overlay-footnote">WASD 移动 · R 留下回声 · 12 秒一轮</p>`;
      if (game.editingIndex !== null) {
        eyebrow = 'REWRITE THE PAST';
        title = `重录回声 0${game.editingIndex + 1}`;
        copy = '其他同伙照常行动。旧路线暂时退场，这一轮只录制你的新路线。';
        action = '开始重录';
        extra = '<p class="overlay-footnote">R 保存替换 · 取消可恢复旧路线</p>';
      }
    } else if (game.status === 'paused') {
      eyebrow = 'TIME IS ON YOUR SIDE'; title = '时间已暂停'; copy = '想清楚下一步。过去的你会等你。'; action = '继续行动';
    } else if (game.status === 'caught') {
      eyebrow = game.alarm >= 1 ? 'SECURITY ALERT' : 'LOOP EXPIRED'; title = game.alarm >= 1 ? '有一个你，暴露了。' : '差一点，再来一次。';
      copy = game.lastMessage; action = '重试本轮'; extra = '<p class="overlay-footnote">已录好的回声会保留 · Enter 快速重试</p>';
    } else if (game.status === 'won') {
      eyebrow = 'CLEAN GETAWAY'; title = levelIndex === 2 ? '一场完美的合谋。' : '配合得天衣无缝。';
      copy = `${game.echoes.length + 1} 个你 · ${game.seconds.toFixed(2)} 秒 · 藏品已安全撤离`;
      action = levelIndex === LEVELS.length - 1 ? '再来一场' : '下一场行动';
      extra = `<div class="win-stamp">${game.echoes.length <= game.level.par ? '◆ MASTER PLAN' : '◆ HEIST COMPLETE'}</div>`;
      if (campaignMode) {
        const mission = campaign.mission, stageIndex = campaign.indexOf(game.level.id);
        const final = stageIndex === mission.stages.length - 1;
        eyebrow = final ? game.level.objective === 'deliver' ? 'DELIVERY CONFIRMED' : 'EVIDENCE SECURED' : 'SAFE ANCHOR';
        title = final ? `${mission.title} · 完成` : '这一段，已经安全了。';
        copy = campaign.stageAt(stageIndex).result;
        const next = campaign.nextMission;
        action = !final ? '进入下一行动区' : campaign.ending ? '前往旧渡口' : next ? `下一任务：${next.title}` : '重玩这场行动';
        extra = `<div class="win-stamp">${final ? `◇ ${mission.evidence}` : `✓ 安全锚点 ${stageIndex + 1} / ${mission.stages.length}`}</div>`;
      }
    }
    $('#overlay-card').innerHTML = `<p class="overlay-eyebrow">${eyebrow}</p><h2>${title}</h2><p class="overlay-copy">${copy}</p>${extra}<button class="primary-button" id="overlay-action">${action} ${icons.arrow}</button>`;
    $('#overlay-action').addEventListener('click', primaryAction);
  }
}

$('#record-button').addEventListener('click', record);
$('#retry-button').addEventListener('click', () => { sound.unlock(); game.restart(); accumulator = 0; clearInput(); focusGame(); });
$('#reset-button').addEventListener('click', () => { game.clear(); accumulator = 0; clearInput(); focusGame(); });
$('#pause-button').addEventListener('click', () => { game.togglePause(); clearInput(); focusGame(); });
function undoPlan() {
  if (game.undoPlan()) { accumulator = 0; clearInput(); toast('已恢复上一个计划。'); }
  focusGame();
}
$('#undo-button').addEventListener('click', undoPlan);
$('#cancel-rerecord').addEventListener('click', () => {
  game.cancelRerecord(); accumulator = 0; clearInput(); focusGame();
  persistPlan();
  toast('旧路线已恢复。');
});
$('#echo-slots').addEventListener('click', event => {
  const rerecord = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-rerecord]');
  if (rerecord && game.beginRerecord(Number(rerecord.dataset.rerecord))) {
    accumulator = 0; clearInput(); focusGame();
    $('#toast').classList.remove('visible');
    $('#plan-status').textContent = '旧路线保留中 · R 保存新路线';
    return;
  }
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delete]');
  if (target) { game.removeEcho(Number(target.dataset.delete)); accumulator = 0; clearInput(); focusGame(); }
});
const fastButton = $('#fast-forward');
fastButton.addEventListener('pointerdown', event => {
  event.preventDefault(); fastButton.setPointerCapture(event.pointerId);
  pointerFastForward = game.status === 'running';
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) fastButton.addEventListener(event, () => { pointerFastForward = false; });
fastButton.addEventListener('keydown', event => {
  if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); event.stopPropagation(); pointerFastForward = game.status === 'running'; }
});
fastButton.addEventListener('keyup', event => { if (event.code === 'Space' || event.code === 'Enter') pointerFastForward = false; });
fastButton.addEventListener('blur', () => { pointerFastForward = false; });
document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(button => button.addEventListener('click', () => setLevel(Number(button.dataset.level))));
$('#trails-button').addEventListener('click', () => {
  renderer.trails = !renderer.trails;
  $('#trails-button').classList.toggle('active', renderer.trails);
  $('#trails-button').setAttribute('aria-pressed', String(renderer.trails));
  focusGame();
});
$('#sound-button').addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  sound.unlock(); sound.play('door');
  $('#sound-button').classList.toggle('active', sound.enabled);
  $('#sound-button').setAttribute('aria-pressed', String(sound.enabled));
  $('#sound-button').setAttribute('aria-label', sound.enabled ? '关闭音效' : '开启音效');
  $('#sound-button').title = sound.enabled ? '关闭音效' : '开启音效';
  focusGame();
});
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { toast('当前浏览器不支持全屏模式。'); }
});
function showHelp() {
  helpWasRunning = game.status === 'running';
  if (helpWasRunning) game.togglePause();
  clearInput(); dialog.showModal();
}
function closeHelp() { dialog.close(); }
$('#help-button').addEventListener('click', showHelp);
$('#close-help').addEventListener('click', closeHelp);
$('.dialog-close').addEventListener('click', closeHelp);
dialog.addEventListener('close', () => { if (helpWasRunning && game.status === 'paused') game.togglePause(); focusGame(); });

const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyR', 'KeyZ', 'ShiftLeft', 'ShiftRight', 'Enter', 'Escape'];
const isEditingControl = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input:not([type="range"]), select, textarea, [contenteditable="true"]');
document.addEventListener('focusin', event => {
  if (!isEditingControl(event.target)) return;
  clearInput();
  if (game.status === 'running') { game.togglePause(); refreshUI(); }
});
window.addEventListener('keydown', event => {
  if (dialog.open || endingUI.open) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (isEditingControl(event.target)) return;
  if (event.code === 'KeyP' || (previewGame && event.code === 'Escape')) { event.preventDefault(); if (!event.repeat) togglePreview(); return; }
  if (previewGame) return;
  if (event.key === '?') { event.preventDefault(); showHelp(); return; }
  const onControl = event.target instanceof HTMLElement && event.target.closest('button, summary, a');
  if (onControl && ['Space', 'Enter'].includes(event.code)) return;
  if (gameKeys.includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  sound.unlock();
  if (event.code === 'KeyR') record();
  else if (event.code === 'KeyZ') undoPlan();
  else if (event.code === 'Escape') { game.togglePause(); clearInput(); }
  else if (event.code === 'Enter') {
    if (game.status === 'running') { game.restart(); accumulator = 0; clearInput(); }
    else primaryAction();
  } else {
    keys.add(event.code);
    if (game.status === 'ready' && gameKeys.includes(event.code) && !event.code.startsWith('Shift')) game.start();
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
function pauseOnLeave() { clearInput(); if (game.status === 'running') game.togglePause(); }
window.addEventListener('blur', pauseOnLeave);
window.addEventListener('pagehide', persistPlan);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });
$('#game-canvas').addEventListener('pointerdown', () => { sound.unlock(); focusGame(); });

const touchCodes: Record<string, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-direction], #touch-lure, #touch-interact')) {
  const code = button.id === 'touch-interact' ? 'KeyE' : button.id === 'touch-lure' ? 'Space' : touchCodes[button.dataset.direction!];
  button.addEventListener('pointerdown', event => {
    if (previewGame) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(code); sound.unlock();
    if (game.status === 'ready') game.start();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(code));
}

function loop(now: number) {
  const elapsed = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (game.status === 'running') {
    accumulator += elapsed * (isFastForwarding() ? 3 : 1);
    while (accumulator >= 1 / FPS) {
      const before = game.frame;
      const operationCount = game.operationLog.length;
      game.step({
        x: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        y: Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')),
        lure: keys.has('Space'),
        interact: keys.has('KeyE'),
      });
      const feedback = game.operationLog.slice(operationCount).filter(op => op.actor === 'player').at(-1);
      if (feedback) toast(operationText(feedback));
      accumulator -= 1 / FPS;
      if (game.status !== 'running' || game.frame < before) { accumulator = 0; clearInput(); break; }
    }
  } else accumulator = 0;
  for (const event of game.drainEvents()) {
    if (['start', 'rewind', 'plan', 'caught', 'won'].includes(event)) playtesting.event(event, event === 'caught' ? game.lastMessage : `take ${game.attempts}; echoes ${game.echoes.length}; frame ${game.frame}`);
    sound.play(event);
    if (event === 'deposit' || event === 'receipt') toast(game.signals.at(-1)?.text ?? game.deliveryStatus());
    if (event === 'plan') persistPlan();
    if (event === 'rewind') renderer.rewindFlash = 1;
    if (event === 'loot') toast(game.level.onLoot?.message ?? (!game.exitReady ? `目标已取得；撤离前需 ${game.powerRequirements(game.unmetPower(game.level.exitPower))}。` : '目标已取得。前往标记的撤离点！'));
    if (event === 'won' || event === 'caught') $('#toast').classList.remove('visible');
    if (event === 'won') {
      if (campaignMode && campaign.commit(game)) {
        saveCampaign();
        playtesting.event('checkpoint', `${game.level.id}; ${campaign.data.outcomes?.[canonicalZoneId(game.level.id)] ?? 'linear'}`);
      }
      const record = { echoes: game.echoes.length, seconds: game.seconds };
      const previous = saved[game.level.id];
      if (!previous || record.echoes < previous.echoes || (record.echoes === previous.echoes && record.seconds < previous.seconds)) {
        saved[game.level.id] = record;
        try { localStorage.setItem('echo-heist-progress-v1', JSON.stringify(saved)); } catch { /* Best-effort local progress. */ }
      }
      if (!campaignMode) $(`[data-level="${levelIndex}"] .level-check`).textContent = '✓';
    }
  }
  playtesting.tick();
  renderer.draw(previewGame ?? game, now / 1000);
  refreshUI();
  requestAnimationFrame(loop);
}

if (new URLSearchParams(location.search).get('mode') === 'training') setLevel(0);
else openMission(campaign.data.selected, false);
requestAnimationFrame(loop);
