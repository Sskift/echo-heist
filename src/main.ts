import './style.css';
import { Game } from './engine.ts';
import { ECHO_COLORS, FPS, LEVELS, LOOP_SECONDS, MAX_ECHOES } from './levels.ts';
import { Renderer } from './render.ts';
import { Sound } from './audio.ts';

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
    for (const level of LEVELS) {
      const record = raw[level.id];
      if (record && Number.isFinite(record.echoes) && Number.isFinite(record.seconds)) saved[level.id] = record;
    }
  }
} catch { /* Storage can be unavailable in private browser contexts. */ }

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="ECHO HEIST 首页"><span class="brand-symbol">${icons.echo}</span><span>ECHO HEIST<span class="brand-cn">回声劫案</span></span></a>
    <div class="header-note"><span class="status-dot"></span> A SOLO CO-OP HEIST <span class="version">VOL. 01</span></div>
    <button class="text-button" id="help-button">行动手册 <span class="key">?</span></button>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">12 SECONDS. THREE ECHOES. ONE PERFECT HEIST.</p><h1>你的同伙，是过去的你<span>。</span></h1></div>
      <nav class="level-nav" aria-label="选择关卡">${LEVELS.map((level, i) => `<button class="level-tab" data-level="${i}"><span class="tab-number">${level.id}</span><span>${level.title}</span><span class="level-check" aria-label="已完成">${saved[level.id] ? '✓' : ''}</span></button>`).join('')}</nav>
    </section>
    <div class="game-layout">
      <section class="console" aria-label="游戏区域">
        <div class="console-bar"><div class="feed-label"><span class="status-dot"></span> LIVE FEED <span class="divider">/</span> <span id="map-code">ANNEX_01</span></div><div class="console-controls"><button class="icon-button active" id="trails-button" title="显示 / 隐藏回声轨迹" aria-label="显示回声轨迹" aria-pressed="true">${icons.eye}</button><button class="icon-button" id="sound-button" title="开启音效" aria-label="开启音效" aria-pressed="false">${icons.sound}<span class="sound-off"></span></button><button class="icon-button pause-button" id="pause-button" title="暂停 / 继续 (Esc)" aria-label="暂停游戏">Ⅱ</button><button class="icon-button" id="fullscreen-button" title="全屏" aria-label="切换全屏">⛶</button></div></div>
        <div class="arena">
          <canvas id="game-canvas" tabindex="0" aria-label="俯视角金库。用 WASD 或方向键移动，R 保存回声，空格制造声响。详细操作见行动手册。"></canvas>
          <div class="arena-badge"><span class="rec-dot"></span><span id="record-label">STANDBY</span></div>
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
        <div class="echo-section"><p class="section-label">你的同伙 <span id="echo-count">0 / 3</span></p><div id="echo-slots"></div></div>
        <div class="mission-actions"><button class="primary-button" id="record-button">${icons.rewind}<span>留下回声</span><kbd>R</kbd></button><div class="secondary-actions"><button id="retry-button">重试本轮 <kbd>↵</kbd></button><button id="reset-button">清空计划</button></div></div>
        <details class="hint"><summary>卡住了？查看线索 <span>＋</span></summary><p id="hint-text"></p></details>
      </aside>
    </div>
    <footer class="game-footer"><div class="controls-legend"><span><kbd>W A S D</kbd> / <kbd>↑↓←→</kbd> 移动</span><span><kbd>R</kbd> 留下回声</span><span><kbd>SPACE</kbd> 声响诱饵</span><span><kbd>ESC</kbd> 暂停</span></div><span class="footer-motto">ONE THIEF. MULTIPLE ALIBIS.</span></footer>
  </main>
  <dialog id="help-dialog"><button class="dialog-close" aria-label="关闭行动手册">×</button><p class="eyebrow">FIELD MANUAL / 001</p><h2>你只需要一个同伙。<br />昨天的你就够了。</h2><p class="manual-intro">每一轮有 12 秒。走过的路线会被录下，成为下一轮与你同时行动的回声。</p><ol class="manual-steps"><li><strong>走到开关，留下自己</strong><p>用 WASD 或方向键走到 A。按 R 保存路线并开始下一轮。提前录制的回声会停在终点，直到这一轮结束。</p></li><li><strong>让过去为现在开门</strong><p>回声从起点重放，你可以自由行动。它会踩开关、重放声响，也会被守卫发现。回声是投影，可穿过后来关闭的门，无法拿走藏品。</p></li><li><strong>拿到藏品，安全撤离</strong><p>接触右上角金色藏品自动拾取，再返回左下角撤离点。12 秒用尽会自动录制；槽位满时需要重试或删除旧回声。</p></li></ol><div class="manual-shortcuts"><span><kbd>R</kbd> 保存回声</span><span><kbd>Enter</kbd> 重试，保留同伙</span><span><kbd>Space</kbd> 声响诱饵</span><span><kbd>Esc</kbd> 暂停</span></div><p class="manual-note">删除回声后，其他回声保留原来的绝对路线。切换关卡会重置当前计划，通关记录会保存在本机。建议使用桌面键盘游玩。</p><button class="primary-button" id="close-help">知道了，开始行动 ${icons.arrow}</button></dialog>
`;

let levelIndex = 0;
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
const dialog = $<HTMLDialogElement>('#help-dialog');

function toast(text: string) {
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}

function focusGame() { $('#game-canvas').focus({ preventScroll: true }); }

function setLevel(index: number) {
  levelIndex = index;
  game = new Game(LEVELS[index]);
  keys.clear(); accumulator = 0;
  uiKey = ''; overlayKey = '';
  $('#toast').classList.remove('visible');
  const level = game.level;
  $('#mission-number').textContent = level.id;
  $('#mission-title').textContent = level.title;
  $('#mission-subtitle').textContent = level.subtitle;
  $('#mission-description').textContent = level.description;
  $('#hint-text').textContent = level.hint;
  $('#map-code').textContent = `ANNEX_${level.id}`;
  $<HTMLDetailsElement>('.hint').open = false;
  document.querySelectorAll<HTMLButtonElement>('.level-tab').forEach((tab, i) => {
    tab.classList.toggle('selected', i === index);
    tab.setAttribute('aria-current', i === index ? 'step' : 'false');
  });
  refreshUI();
}

function primaryAction() {
  sound.unlock();
  if (game.status === 'ready') game.start();
  else if (game.status === 'paused') game.togglePause();
  else if (game.status === 'caught') game.restart();
  else if (game.status === 'won') {
    if (levelIndex < LEVELS.length - 1) setLevel(levelIndex + 1);
    else setLevel(0);
  }
  accumulator = 0;
  focusGame();
}

function record() {
  sound.unlock();
  if (game.status === 'ready') { game.start(); focusGame(); return; }
  if (game.status === 'running') {
    if (game.rewind()) { accumulator = 0; keys.clear(); toast('回声已就位。现在，和过去的自己合作。'); }
    else if (game.lastMessage) toast(game.lastMessage);
  }
  focusGame();
}

function refreshUI() {
  const key = `${game.status}:${game.echoes.length}:${game.echoes.map(e => `${e.colorIndex}-${e.frames.length}`).join(',')}:${game.attempts}:${game.hasLoot}:${[...game.openDoors].join('')}`;
  if (uiKey !== key) {
    uiKey = key;
    $('#loop-number').textContent = `TAKE ${String(game.attempts).padStart(2, '0')}`;
    $('#echo-count').textContent = `${game.echoes.length} / ${MAX_ECHOES}`;
    $('#record-label').textContent = game.status === 'running' ? 'REC ●' : game.status === 'paused' ? 'PAUSED' : game.status === 'won' ? 'EXTRACTED' : 'STANDBY';
    $('.arena-badge').classList.toggle('recording', game.status === 'running');
    $('#echo-slots').innerHTML = Array.from({ length: MAX_ECHOES }, (_, i) => {
      const echo = game.echoes[i];
      return echo ? `<div class="echo-slot filled" style="--echo-color:${ECHO_COLORS[echo.colorIndex]}"><span class="echo-avatar">${icons.echo}</span><div><strong>回声 0${i + 1}</strong><small>${(echo.frames.length / FPS).toFixed(1)}s 路线 · 终点待命</small></div><button data-delete="${i}" title="删除回声 ${i + 1} 并重新规划" aria-label="删除回声 ${i + 1}">×</button></div>` : `<div class="echo-slot empty"><span class="empty-cross">＋</span><span>等待另一个你</span><span class="slot-number">0${i + 1}</span></div>`;
    }).join('');
    $('#tracks').innerHTML = Array.from({ length: MAX_ECHOES }, (_, i) => {
      const echo = game.echoes[i];
      return `<div class="track"><span class="track-label" style="color:${echo ? ECHO_COLORS[echo.colorIndex] : '#62766a'}">E${i + 1}</span><div class="track-line" style="--echo-color:${echo ? ECHO_COLORS[echo.colorIndex] : '#526153'}">${echo ? `<span class="recorded-segment" style="width:${echo.frames.length / FPS / LOOP_SECONDS * 100}%"></span><span class="hold-segment" style="left:${echo.frames.length / FPS / LOOP_SECONDS * 100}%"></span>` : '<span class="empty-track"></span>'}<span class="track-playhead"></span></div></div>`;
    }).join('');
    const allDoors = game.openDoors.size === game.level.doors.length;
    $('#objective-doors').classList.toggle('done', allDoors);
    $('#objective-loot').classList.toggle('done', game.hasLoot);
    $('#door-status').textContent = allDoors ? '所有通道已打开' : `${game.openDoors.size} / ${game.level.doors.length} 道门已开启`;
    $('#loot-status').textContent = game.status === 'won' ? '安全撤离，行动完成' : game.hasLoot ? '已拿到藏品，返回左下角！' : '藏品位于右上角';
    const button = $<HTMLButtonElement>('#record-button');
    button.disabled = !['ready', 'running'].includes(game.status);
    button.querySelector('span')!.textContent = game.status === 'ready' ? '开始行动' : '留下回声';
    $('#pause-button').textContent = game.status === 'paused' ? '▷' : 'Ⅱ';
    $('#pause-button').setAttribute('aria-label', game.status === 'paused' ? '继续游戏' : '暂停游戏');
    $<HTMLButtonElement>('#retry-button').disabled = game.status === 'ready';
  }
  const seconds = game.remaining.toFixed(2).split('.');
  $('#seconds').textContent = seconds[0].padStart(2, '0');
  $('#fraction').textContent = `.${seconds[1]}`;
  $('#clock-fill').style.transform = `scaleX(${game.remaining / LOOP_SECONDS})`;
  $('.clock-panel').classList.toggle('urgent', game.status === 'running' && game.remaining <= 3);
  document.querySelectorAll<HTMLElement>('.track-playhead').forEach(el => el.style.left = `${game.seconds / LOOP_SECONDS * 100}%`);

  if (overlayKey !== `${levelIndex}:${game.status}:${game.lastMessage}`) {
    overlayKey = `${levelIndex}:${game.status}:${game.lastMessage}`;
    const overlay = $('#overlay');
    overlay.hidden = game.status === 'running';
    if (game.status === 'running') return;
    let eyebrow = '', title = '', copy = '', action = '', extra = '';
    if (game.status === 'ready') {
      eyebrow = `OPERATION ${game.level.id} / BRIEFING`;
      title = game.level.title;
      copy = game.level.briefing[0];
      action = '开始行动';
      extra = `<p class="overlay-footnote">WASD 移动 · R 留下回声 · 12 秒一轮</p>`;
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
    }
    $('#overlay-card').innerHTML = `<p class="overlay-eyebrow">${eyebrow}</p><h2>${title}</h2><p class="overlay-copy">${copy}</p>${extra}<button class="primary-button" id="overlay-action">${action} ${icons.arrow}</button>`;
    $('#overlay-action').addEventListener('click', primaryAction);
  }
}

$('#record-button').addEventListener('click', record);
$('#retry-button').addEventListener('click', () => { sound.unlock(); game.restart(); accumulator = 0; keys.clear(); focusGame(); });
$('#reset-button').addEventListener('click', () => { game.clear(); accumulator = 0; keys.clear(); focusGame(); });
$('#pause-button').addEventListener('click', () => { game.togglePause(); keys.clear(); focusGame(); });
$('#echo-slots').addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delete]');
  if (target) { game.removeEcho(Number(target.dataset.delete)); accumulator = 0; keys.clear(); focusGame(); }
});
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
  keys.clear(); dialog.showModal();
}
function closeHelp() { dialog.close(); }
$('#help-button').addEventListener('click', showHelp);
$('#close-help').addEventListener('click', closeHelp);
$('.dialog-close').addEventListener('click', closeHelp);
dialog.addEventListener('close', () => { if (helpWasRunning && game.status === 'paused') game.togglePause(); focusGame(); });

const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR', 'Enter', 'Escape'];
window.addEventListener('keydown', event => {
  if (dialog.open) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === '?') { event.preventDefault(); showHelp(); return; }
  const onControl = event.target instanceof HTMLElement && event.target.closest('button, summary, a');
  if (onControl && ['Space', 'Enter'].includes(event.code)) return;
  if (gameKeys.includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  sound.unlock();
  if (event.code === 'KeyR') record();
  else if (event.code === 'Escape') { game.togglePause(); keys.clear(); }
  else if (event.code === 'Enter') {
    if (game.status === 'running') { game.restart(); accumulator = 0; keys.clear(); }
    else primaryAction();
  } else {
    keys.add(event.code);
    if (game.status === 'ready' && gameKeys.includes(event.code)) game.start();
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
function pauseOnLeave() { keys.clear(); if (game.status === 'running') game.togglePause(); }
window.addEventListener('blur', pauseOnLeave);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });
$('#game-canvas').addEventListener('pointerdown', () => { sound.unlock(); focusGame(); });

const touchCodes: Record<string, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-direction], #touch-lure')) {
  const code = button.id === 'touch-lure' ? 'Space' : touchCodes[button.dataset.direction!];
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(code); sound.unlock();
    if (game.status === 'ready') game.start();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(code));
}

function loop(now: number) {
  const elapsed = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (game.status === 'running') {
    accumulator += elapsed;
    while (accumulator >= 1 / FPS) {
      game.step({
        x: Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        y: Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')),
        lure: keys.has('Space'),
      });
      accumulator -= 1 / FPS;
      if (game.status !== 'running') { accumulator = 0; keys.clear(); break; }
    }
  } else accumulator = 0;
  for (const event of game.drainEvents()) {
    sound.play(event);
    if (event === 'rewind') renderer.rewindFlash = 1;
    if (event === 'loot') toast('藏品到手。回到左下角撤离点！');
    if (event === 'won' || event === 'caught') $('#toast').classList.remove('visible');
    if (event === 'won') {
      const record = { echoes: game.echoes.length, seconds: game.seconds };
      const previous = saved[game.level.id];
      if (!previous || record.echoes < previous.echoes || (record.echoes === previous.echoes && record.seconds < previous.seconds)) {
        saved[game.level.id] = record;
        try { localStorage.setItem('echo-heist-progress-v1', JSON.stringify(saved)); } catch { /* Best-effort local progress. */ }
      }
      $(`[data-level="${levelIndex}"] .level-check`).textContent = '✓';
    }
  }
  renderer.draw(game, now / 1000);
  refreshUI();
  requestAnimationFrame(loop);
}

setLevel(0);
requestAnimationFrame(loop);
