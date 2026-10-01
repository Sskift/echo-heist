import type { Game } from './engine.ts';
import { FPS, MAX_FRAMES } from './levels.ts';
import { MISSIONS, outcomeSelected, stageVersions } from './campaign-content.ts';
import type { Campaign } from './campaign.ts';
import './campaign.css';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
type Actions = { mission: (id: string) => void; stage: (index: number) => void; training: () => void; preview: () => void; scrub: (frame: number) => void; delay: (index: number, delta: number) => void };

export class CampaignUI {
  private key = '';
  private delayKey = '';
  private securityKey = '';
  private powerKey = '';
  private relayKey = '';
  private suppressionKey = '';
  private consequenceKey = '';
  private deliveryKey = '';
  constructor(private campaign: Campaign, actions: Actions) {
    $('.intro').insertAdjacentHTML('afterend', `
      <section class="campaign-shell" aria-label="行动档案">
        <div class="campaign-toolbar"><details id="mission-board"><summary><span>行动档案</span><strong id="campaign-summary">昨天的搭档</strong><span class="board-arrow">⌄</span></summary><div id="mission-cards"></div></details><button id="training-mode">基础演习</button></div>
        <div id="story-strip" class="story-strip"><div><p class="eyebrow" id="chapter-label"></p><h2 id="operation-title"></h2></div><p id="story-line"></p></div>
        <div class="stage-bar" id="stage-bar"><nav id="stage-rail" aria-label="任务阶段"></nav><span id="checkpoint-note" role="status">锚点自动保存在本机</span></div>
      </section>`);
    $('.stage-bar').insertAdjacentHTML('afterend', '<section id="consequence-panel" class="consequence-panel" hidden aria-label="下一阶段后果"><strong>给下一段留下什么</strong><p>以下结果在成功抵达锚点时提交，由实际设备状态或交付位置决定；回退到本阶段可重新安排。</p><ul id="consequence-options"></ul></section>');
    $('.stage-bar').insertAdjacentHTML('afterend', '<section id="continuity-panel" class="continuity-panel" hidden aria-label="连续行动"><strong>配电室 → 封存室 → 原路撤离</strong><p id="continuity-status" role="status"></p><p>各区共用 12 秒节拍：每轮同时从录像起点播放，短录像在终点待命。留守者一直占用一个回声名额。失败只重试当前区；点击首段锚点可重排留守者，后段锚点与计划随之撤销。</p></section>');
    $('.stage-bar').insertAdjacentHTML('afterend', '<section id="credential-journey" class="continuity-panel" hidden aria-label="凭据交接要求"><strong id="credential-route-title"></strong><p id="credential-location" role="status"></p><p id="credential-requirements"></p><details><summary id="credential-route-summary"></summary><p id="credential-route-help"></p></details></section>');
    $('.timeline').insertAdjacentHTML('afterend', `
      <div class="rehearsal-toolbar"><button id="preview-button" aria-pressed="false">◇ 预演回声</button><span id="interaction-tip">E 操作设备 · P 预演已保存的计划</span></div>
      <section id="preview-panel" class="preview-panel" hidden aria-label="回声预演"><div><strong>只读预演</strong><output id="preview-time">0.00s</output></div><p>仅播放已保存回声；真人不参与，也不会保存进度。拖动时间，检查门与设备。</p><input id="preview-frame" type="range" min="0" max="720" step="1" value="0" aria-label="预演时间"><ol id="preview-log"></ol></section>`);
    $('#echo-slots').insertAdjacentHTML('afterend', '<div id="echo-delays" class="echo-delays"></div>');
    $('.rehearsal-toolbar').insertAdjacentHTML('afterend', '<details id="delivery-panel" class="security-panel power-panel" hidden><summary>证据植入与送达回执 <span>＋</span></summary><p>真人携带证据到植入点按 E，提交时检查列出的条件。回声可以配合开门、授权和引导调查，但不能替代真人植入。需要回执时，指定守卫必须到植入点搜索发现副本，再返回标记的登记点；巡逻路过、远处听见或只读预演均不算送达。</p><p id="delivery-status" role="status"></p><ul id="delivery-requirements" aria-label="植入条件与回执"></ul><p id="delivery-consequence"></p></details>');
    $('.rehearsal-toolbar').insertAdjacentHTML('afterend', '<div id="credential-strip" class="credential-strip" hidden><strong id="credential-owner"></strong><span id="credential-event"></span></div><details id="relay-panel" class="security-panel relay-panel" hidden><summary>凭据与交接时段 <span>＋</span></summary><p>凭据只有一份，金色标记表示持有者。先交付、再接收、最后授权；授权后仍持有凭据。普通终端只处理按键那一刻，留候终端可按一次 E 后站在圈内等送件；离开或投影受抑制就取消。多人同时接收会取消本次请求，不会复制凭据。</p><ul id="relay-status" aria-label="交接状态"></ul><p>实体原件仍需真人取走。预演只播放已保存回声，不包含真人送件。</p></details>');
    $('#preview-panel').insertAdjacentHTML('afterend', '<details id="security-panel" class="security-panel" hidden><summary>安保响应规则 <span>＋</span></summary><p id="security-rule"></p><ul id="security-status" aria-label="守卫状态"></ul><p>地图圆圈为参考响点；其他位置同样可以发声。方框标记的固定哨兵不响应诱饵。单位格与地图网格一致。</p></details>');
    $('#security-panel').insertAdjacentHTML('beforebegin', '<details id="power-panel" class="security-panel power-panel" hidden><summary>电路与行动条件 <span>＋</span></summary><p>在面板旁按 E，录下的是指定状态；重复相同请求不会反复切换。同帧相反请求会取消。连线显示门禁、监控与照明的供电关系。</p><ul id="power-status" aria-label="电路状态"></ul><p id="power-objectives"></p><p id="power-consequence" class="power-consequence"></p></details>');
    $('#power-panel').insertAdjacentHTML('beforebegin', '<details id="suppression-panel" class="security-panel suppression-panel" hidden><summary>抑制范围与恢复时刻 <span>＋</span></summary><p>紫色网格只影响回声，真人仍可操作。回声继续沿原录像移动：暂时不能压开关、操作、交接或发声，也不会被安保看见。凭据仍归原持有人。离场或场关闭后恢复当前动作，错过的 E 不会补发；被取消的留候需要重新按 E。</p><ul id="suppression-status" aria-label="抑制状态"></ul><p>重叠区域中，只要有一层开启，投影就仍然失效。用预演检查同伙恢复的位置与时刻。</p></details>');
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
      const frames = Math.round(Number(input.value) * FPS), delta = frames - Number(input.dataset.current);
      // Re-rendering replaces the focused control and may commit its change
      // again on blur. Mark the accepted value before triggering that render.
      input.dataset.current = String(frames);
      actions.delay(Number(input.dataset.delayInput), delta);
    });
  }

  checkpointSaved(ok: boolean) { $('#checkpoint-note').textContent = ok ? '安全锚点已保存到本机' : '仅本次有效 · 本机存档不可用'; }

  render(game: Game, campaignMode: boolean, preview: Game | null, demo = false) {
    const world = preview ?? game;
    $('#credential-journey').hidden = !game.level.credential;
    if (game.level.credential) {
      const c = game.level.credential;
      if ($('#credential-journey').dataset.route !== `${this.campaign.mission.id}:${c.id}`) {
        $('#credential-journey').dataset.route = `${this.campaign.mission.id}:${c.id}`;
        const acrossRooms = this.campaign.mission.stages.some(base => stageVersions(base).some(stage => stage.level.credential?.from));
        $('#credential-route-title').textContent = acrossRooms ? '登记厅交出 → 对侧站台接回 → 货运档案接班' : '真人取件 → 回声签入 → 本人接回原票';
        $('#credential-route-summary').textContent = acrossRooms ? '这张票如何跨过房间' : '为什么签入后还要接回';
        $('#credential-route-help').textContent = acrossRooms
          ? '整场只有一张 B-17 货运凭据。成功到锚点才保存实际交接位置；失败从当前锚点恢复。回退会撤销后段物件状态与计划。每区重新开始十二秒，录像只能请求交接，不能复制凭据。RETURN 是只收不取的归还槽，空手也可录下交付请求，执行时仍须真正持有凭据。'
          : `这份${c.label}只在当前行动区流转。授权不会收走凭据，签入者还需把它交到 ${c.receiveByPlayer}，再由本人按 E 接回；只完成签名、让回声拿着或由回声代收都不满足撤离。失败后从本区来源重新开始，物件不会复制。`;
      }
      const location = `${preview ? '只读预演 · ' : ''}${c.label} · 现在：${world.credentialOwner()}${world.incoming ? ` · 入站位置：${world.incoming.owner === 'player' ? '本人持有' : world.incoming.owner.slice(9)}` : ' · 首次领取'}${c.incomingAuthorizations?.length ? ` · 前段签名：${c.incomingAuthorizations.join('、')}` : ''}`;
      const requirements = world.credentialBlockers().join('；') || '交接条件已完成，带齐目标后前往锚点。';
      if ($('#credential-location').textContent !== location) $('#credential-location').textContent = location;
      if ($('#credential-requirements').textContent !== requirements) $('#credential-requirements').textContent = requirements;
    }
    $('#continuity-panel').hidden = !game.level.handoff && !game.level.continuity;
    if (!$('#continuity-panel').hidden) {
      const status = game.level.handoff ? '准备入口 · 窗那边的核心就是下一段目标。仅一条回声留守 HOLD，另外两格留给后续行动。' : `${preview ? '预演 · ' : ''}${game.level.continuity?.home ? '回到原处' : '隔窗协作'} · 回声 01 · ${world.echoActivity(0)} · 本区可用 2 格`;
      if ($('#continuity-status').textContent !== status) $('#continuity-status').textContent = status;
    }
    const delivery = world.level.delivery;
    $('#delivery-panel').hidden = world.level.objective !== 'deliver' || !delivery;
    if (delivery) {
      const rules = [
        `${delivery.id} · ${delivery.label} · 真人按 E 植入${delivery.window ? ` · 时段 ${delivery.window.join('–')} 秒` : ''}`,
        ...(delivery.power ?? []).map(p => `${p.id} 需${world.circuitState(p.id, p.on)} ${world.powered(p) ? '✓' : '·'}`),
        ...(delivery.plate ? [`需守 ${delivery.plate} ${world.activePlates.has(delivery.plate) ? '✓' : '·'}`] : []),
        ...(delivery.authorization ? [`先签 ${delivery.authorization} ${world.authorized.has(delivery.authorization) ? '✓' : '·'}`] : []),
        ...(delivery.receivers ?? []).map(r => `${r.guard} → ${r.label}：${world.evidenceReceipts.has(r.guard) ? '回执已登记' : world.evidenceReaders.has(r.guard) ? '已发现，待返回登记点' : '待到场搜索发现'}`),
      ];
      const status = preview ? '预演仅核对同伙与安保路线；真人植入及送达回执需在实际行动中确认。' : game.editingIndex !== null ? '重录中：只录路线，不能植入实体证据。' : world.deliveryStatus();
      const key = JSON.stringify([delivery, rules, status]);
      if (key !== this.deliveryKey) {
        this.deliveryKey = key;
        $('#delivery-status').textContent = status;
        $('#delivery-requirements').replaceChildren(...rules.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
        $('#delivery-consequence').textContent = delivery.onDeposit ? `${world.evidenceDeposited ? '已经发生' : '植入后预告'}：${delivery.onDeposit.message}` : '';
      }
    }
    const suppression = (world.level.suppressors ?? []).map(field => {
      const on = world.suppressionActive(field), powered = world.powered(field.power);
      const affected = world.activeEchoes.filter(({ echo }) => world.suppressionFields(world.echoAt(echo)).some(s => s.id === field.id)).map(({ index }) => `回声 ${index + 1}`);
      return `${field.id} · ${!powered ? '已断电' : on ? '抑制中' : '空档'}${field.power ? ` · 供电 ${field.power.id} 需${world.circuitState(field.power.id, field.power.on)}` : ''}${field.cycle ? ` · 每 ${field.cycle.period}s 抑制 ${field.cycle.active.join('–')}s${field.cycle.phase ? `（相位 ${field.cycle.phase}s）` : ''}${powered ? ` · 距${on ? '恢复' : '抑制'} ${world.cycleRemaining(field.cycle).toFixed(1)}s` : ''}` : ' · 无周期'}${affected.length ? ` · ${affected.join('、')} 失效` : ''}`;
    });
    const suppressionKey = `${world.level.id}:${suppression.join('|')}`;
    if (suppressionKey !== this.suppressionKey) {
      this.suppressionKey = suppressionKey;
      $('#suppression-panel').hidden = !suppression.length;
      $('#suppression-status').replaceChildren(...suppression.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
    }
    const relayStatus = (world.level.terminals ?? []).map(t => world.terminalStatus(t));
    const relayKey = `${world.level.id}:${world.credentialOwner()}:${relayStatus.join('|')}:${world.signals.at(-1)?.text}:${!!preview}`;
    if (relayKey !== this.relayKey) {
      this.relayKey = relayKey;
      $('#credential-strip').hidden = $('#relay-panel').hidden = !world.level.terminals?.length;
      $('#credential-owner').textContent = `${preview ? '预演 · ' : ''}唯一凭据：${world.credentialOwner()}`;
      const event = world.signals.filter(s => /凭据|接收|交付|授权|等候/.test(s.text)).at(-1);
      $('#credential-event').textContent = event ? `${(event.frame / FPS).toFixed(2)}s · ${event.text}` : '在终端旁按 E；空手也能录下接收请求';
      $('#relay-status').replaceChildren(...relayStatus.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
    }
    const powerKey = `${world.level.id}:${world.hasLoot}:${[...world.circuits].join(',')}:${[...world.openDoors].join(',')}:${!!preview}`;
    if (powerKey !== this.powerKey) {
      this.powerKey = powerKey;
      $('#power-panel').hidden = !world.level.circuits?.length;
      const mechanical = world.level.circuits?.some(c => c.mechanical);
      $('#power-panel summary').firstChild!.textContent = mechanical ? '门闩与行动条件 ' : '电路与行动条件 ';
      $('#power-panel > p').textContent = mechanical ? '到 H 旁按 E 松开门闩；承重开关也要有人留守，通道才可通过。每轮门闩复位。录下的是指定状态，多人重复松闩不会将它扣紧。' : '在面板旁按 E，录下的是指定状态；重复相同请求不会反复切换。同帧相反请求会取消。连线显示门禁、监控与照明的供电关系。';
      if (world.level.circuits?.some(c => c.feed)) {
        const automatic = '标有「自动」的接线柜由所列开关值守供电，无需按 E；松开后立即断电。连线显示确认位、接线柜与门禁的关系。';
        $('#power-panel > p').textContent = world.level.circuits.every(c => c.feed) ? automatic : `${$('#power-panel > p').textContent} ${automatic}`;
      }
      $('#power-status').replaceChildren(...(world.level.circuits ?? []).map(circuit => {
        const feeds = world.level.doors.filter(d => d.power?.id === circuit.id).map(d => `${d.id} ${world.openDoors.has(d.id) ? '开' : '关'}（需${world.circuitState(circuit.id, d.power!.on)}）`);
        world.level.terminals?.filter(t => t.power?.id === circuit.id).forEach(t => feeds.push(`${t.id} 柜面${world.powered(t.power) ? '可用' : '停用'}（需${world.circuitState(circuit.id, t.power!.on)}）`));
        world.level.suppressors?.filter(s => s.power?.id === circuit.id).forEach(s => feeds.push(`${s.id} 抑制供电${world.powered(s.power) ? '接通' : '断开'}`));
        world.level.guards.forEach((g, i) => {
          if (g.power?.id === circuit.id) feeds.push(`${world.guardName(i)} ${world.powered(g.power) ? '工作' : '停机'}`);
          if (g.lighting?.id === circuit.id) feeds.push(`${world.guardName(i)} 照明${world.powered(g.lighting) ? '亮' : '暗'}，视距 ${(world.visionRange(i) / 32).toFixed(1)} 格`);
        });
        const item = document.createElement('li');
        item.textContent = `${circuit.id} · ${circuit.label ?? '电源'}${circuit.feed ? `（自动 · ${circuit.feed.remote ? '前区' : '本区'} ${circuit.feed.plate} 值守）` : ''}：${world.circuitState(circuit.id)}${feeds.length ? ` ｜ ${feeds.join('；')}` : ''}`;
        return item;
      }));
      $('#power-objectives').textContent = [world.level.lootPower?.length ? `取物：${world.powerRequirements(world.level.lootPower)}${world.canCollect ? ' ✓' : ' · 未满足'}` : '', world.level.exitPower?.length ? `撤离：${world.powerRequirements(world.level.exitPower)}${world.exitReady ? ' ✓' : ' · 未满足'}` : ''].filter(Boolean).join(' ｜ ');
      $('#power-consequence').textContent = world.level.onLoot ? world.hasLoot && world.level.exitPower?.length && world.exitReady ? '取物后变化已经发生，撤离供电条件已满足。' : `${world.hasLoot ? '已经发生' : '取物后预告'}：${world.level.onLoot.message}${preview ? '（只读预演不含真人取物，仅展示录像操作。）' : ''}` : '';
    }
    const security = world.guards.map((guard, i) => {
      const def = world.level.guards[i];
      const source = guard.investigate ? world.soundName(guard.investigate) : '';
      const investigation = def.searchSeconds === undefined ? `调查 ${source}，剩余 ${guard.attention.toFixed(1)} 秒` : guard.searching ? `在 ${source} 搜索，剩余 ${guard.attention.toFixed(1)} 秒` : `前往 ${source}，抵达后搜索 ${def.searchSeconds} 秒`;
      const fixed = def.kind === 'sentry' || def.kind === 'camera';
      const trace = guard.trace ? `追向 ${guard.trace.label} 最后位置（${Math.round(guard.trace.at.x)}, ${Math.round(guard.trace.at.y)}），线索 ${guard.trace.remaining.toFixed(1)} 秒` : '';
      return `${world.guardName(i)}${def.kind === 'tracker' ? ' · 投影追踪器，只识别回声' : ''} · ${!world.powered(def.power) ? '停机' : fixed ? `${def.kind === 'camera' ? '摄像头' : '固定哨兵'}，忽略声音` : guard.investigate ? investigation : trace || '按原路线值守'} · 视野 ${(world.visionRange(i) / 32).toFixed(1)} 格${fixed ? '' : ` · 听觉 ${((def.hearing ?? 450) / 32).toFixed(1)} 格`}${def.kind === 'tracker' ? ` · 丢失目标后追查 ${def.traceSeconds ?? 1.5} 秒；声响调查优先` : ''}`;
    });
    const securityKey = `${world.level.id}:${security.join('|')}`;
    if (securityKey !== this.securityKey) {
      this.securityKey = securityKey;
      $('#security-panel').hidden = !world.guards.length;
      $('#security-rule').textContent = world.level.noiseResponse === 'nearest' ? '每个声源派最近的可响应守卫。同帧多声源按最近组合分派，每名守卫接一处；距离相同先按守卫编号，再按声源从西到东、从北到南。墙与玻璃不隔声；守卫抵达后搜索，再返回岗位。' : '听觉范围内的巡逻者都会响应；普通墙体不隔声。调查结束后返回原路线。';
      $('#security-status').replaceChildren(...security.map(text => { const item = document.createElement('li'); item.textContent = text; return item; }));
    }
    const mission = this.campaign.mission;
    const stageIndex = this.campaign.indexOf(game.level.id);
    const current = stageIndex >= 0 ? this.campaign.stageAt(stageIndex) : undefined;
    const consequenceKey = `${campaignMode}:${world.level.id}:${world.tokenOwner}:${[...world.circuits].join(',')}:${game.status}:${!!preview}`;
    if (consequenceKey !== this.consequenceKey) {
      this.consequenceKey = consequenceKey;
      $('#consequence-panel').hidden = !campaignMode || !current?.outcomes?.length;
      $('#consequence-options').replaceChildren(...(current?.outcomes ?? []).map(o => {
        const item = document.createElement('li'), selected = outcomeSelected(o, world);
        item.dataset.selected = String(selected);
        item.textContent = `${selected ? preview ? '预演状态' : game.status === 'won' ? '已提交' : '当前结果' : '另一方案'} · ${o.label}（${'power' in o ? `${o.power.id} ${world.circuitState(o.power.id, o.power.on)}` : `凭据交入 ${o.credentialAt.slice(9)}`}）：${o.consequence}`;
        return item;
      }));
    }
    const key = `${campaignMode}:${mission.id}:${game.level.id}:${stageIndex}:${game.status}:${this.campaign.data.completed.join(',')}:${this.campaign.cleared()}:${JSON.stringify(this.campaign.data.outcomes)}`;
    if (key !== this.key) {
      this.key = key;
      $('.level-nav').hidden = campaignMode;
      $('#story-strip').hidden = !campaignMode;
      $('#stage-bar').hidden = !campaignMode;
      $('#training-mode').textContent = demo ? '返回完整主线' : campaignMode ? '基础演习' : '返回主线';
      $('#mission-board').hidden = demo;
      $('#campaign-summary').textContent = campaignMode ? `${mission.chapter} · ${mission.title}` : '原型演习 · 三种基本配合';
      $('#mission-cards').innerHTML = [...new Set(MISSIONS.map(m => m.chapter))].map(chapter => `<details class="chapter-group" ${chapter === mission.chapter ? 'open' : ''}><summary>${chapter === '序章' ? 'C0 / 昨天的搭档' : chapter === '机制试验' ? '机制试验 / 后续章节的可玩样例' : `${MISSIONS.find(m => m.chapter === chapter)!.id.split('-')[0]} / ${chapter}`}<span>${MISSIONS.filter(m => m.chapter === chapter && this.campaign.data.completed.includes(m.id)).length} / ${MISSIONS.filter(m => m.chapter === chapter).length}</span></summary><div class="mission-grid">${MISSIONS.filter(m => m.chapter === chapter).map(m => {
        const complete = this.campaign.data.completed.includes(m.id), available = this.campaign.available(m.id);
        return `<button class="mission-card ${m.id === mission.id && campaignMode ? 'current' : ''}" data-mission="${m.id}" ${!available ? 'disabled' : ''}><span>${complete ? '✓ 已完成' : available ? `${m.stages.length} 段行动` : '完成前一任务解锁'}</span><strong>${available ? m.title : '未解锁的行动'}</strong><small>${available ? m.summary : '抵达之后，任务与线索才会揭晓。'}</small></button>`;
      }).join('')}</div></details>`).join('');
      if (campaignMode && stageIndex >= 0) {
        const stage = this.campaign.stageAt(stageIndex);
        $('#chapter-label').textContent = demo ? `独立试玩 · 与主线存档分开保存 · 第 ${stageIndex + 1} / ${mission.stages.length} 段` : `${mission.chapter} / ${String(MISSIONS.indexOf(mission) + 1).padStart(2, '0')} · 第 ${stageIndex + 1} / ${mission.stages.length} 段`;
        $('#operation-title').textContent = mission.title;
        $('#story-line').textContent = game.status === 'won' ? stage.result : stage.story;
        $('#stage-rail').innerHTML = mission.stages.map((s, i) => `<button data-stage="${i}" ${i > this.campaign.stageIndex ? 'disabled' : ''} ${i === stageIndex ? 'aria-current="step"' : ''} title="回到该锚点；其后阶段将重新规划"><span>${i < this.campaign.cleared() ? '✓' : String(i + 1).padStart(2, '0')}</span>${i > this.campaign.stageIndex && s.variants?.length ? '下一段 · 依所选方案' : this.campaign.stageAt(i).level.title}</button>`).join('');
      }
    }
    const delayKey = `${!!preview}:${game.level.id}:${game.editingIndex}:${game.echoes.map(e => `${e.colorIndex}:${e.frames.length}:${e.delay ?? 0}`).join(',')}`;
    if (delayKey !== this.delayKey) {
      this.delayKey = delayKey;
      $('#echo-delays').innerHTML = game.echoes.map((echo, index) => {
        if (index < game.lockedSlots) return '<p class="retained-delay">E1 · 配电室留守录像已随锚点保存；回到首段调整。</p>';
        const delay = echo.delay ?? 0, cut = Math.max(0, delay + echo.frames.length - MAX_FRAMES);
        return `<div class="delay-row"><span>E${index + 1} 出场 <strong>${(delay / FPS).toFixed(2)}s</strong></span><input type="number" min="0" max="6" step="0.25" value="${(delay / FPS).toFixed(2)}" data-current="${delay}" data-delay-input="${index}" aria-label="回声 ${index + 1} 出场秒数" ${game.editingIndex !== null || preview ? 'disabled' : ''}><button data-echo="${index}" data-delay="-15" aria-label="提前回声 ${index + 1} 四分之一秒" ${delay === 0 || game.editingIndex !== null ? 'disabled' : ''}>−</button><button data-echo="${index}" data-delay="15" aria-label="延迟回声 ${index + 1} 四分之一秒" ${delay === 360 || game.editingIndex !== null ? 'disabled' : ''}>＋</button>${cut ? `<small>末尾 ${(cut / FPS).toFixed(2)}s 不会播放</small>` : ''}</div>`;
      }).join('') + (game.echoes.length ? '<p>每格 0.25s · 调整后从本轮起点重新规划</p>' : '');
      if (preview) document.querySelectorAll<HTMLButtonElement>('[data-delay]').forEach(button => { button.disabled = true; });
    }
    const intent = game.interaction();
    const tip = intent?.type === 'deposit' ? game.evidenceDeposited ? `${intent.id} 已植入 · ${game.objectiveComplete ? '前往撤离点' : '等待送达回执'}` : `E：在 ${intent.id} 植入实体证据` : intent ? `E：${intent.type === 'circuit' ? `将 ${intent.id} 设为${game.circuitState(intent.id, intent.on)}` : intent.type === 'take' ? `在 ${intent.id} 接收凭据` : intent.type === 'give' ? `向 ${intent.id} 交付凭据` : `在 ${intent.id} 请求授权`}` : game.tokenOwner === 'player' ? '你持有唯一凭据 · 到终端按 E 交付' : 'E 操作设备 · P 预演已保存的计划';
    const terminal = intent && game.level.terminals?.find(t => t.id === intent.id && intent.type !== 'circuit');
    const waiting = game.waitingReceivers.get('player') === terminal?.id;
    const blockers = terminal ? game.terminalBlockers(terminal) : [];
    const explanation = terminal ? `${waiting ? `在 ${terminal.id} 等候接收 · 离开取消` : tip}${blockers.length ? `（${blockers.join('、')}）` : intent?.type === 'take' && game.tokenOwner !== `terminal:${terminal.id}` ? terminal.waitForDelivery ? '（可原地留候）' : '（终端为空，可录制请求）' : ''}` : tip;
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
