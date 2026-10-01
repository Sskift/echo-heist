import type { Mission, Stage } from './campaign-content.ts';
import type { Level, Terminal } from './levels.ts';
import { e, g, r, w, level, plate, point as p, room, stage } from './campaign-authoring.ts';

const ticket = { id: 'B17-TICKET', label: 'B-17 唯一货运凭据' };
const shell = room([[14, [8, 9, 10]], [18, [5, 6, 12, 13]], [22, [8, 9]]]);
const shared: Partial<Level> = {
  walls: shell, glass: [{ id: '双面交接柜观察窗', x: 448, y: 256, w: 32, h: 96 }],
  theme: 'clockwork', district: '登记厅 ← 双面交接柜 → 货运站台', subtitle: 'A TICKET KEPT FOR YOU',
};
const relay = (id: string, x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id, x, y, kind: 'relay', ...extra });
const lock = (id: string, x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id, x, y, kind: 'lock', authorization: id, ...extra });
const passage = (id: string, x: number, y: number, authorization: string, hold?: string) => ({ id, x, y, w: 32, h: 64, authorization, ...(hold ? { plate: hold } : {}) });
function scene(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: Stage['witness'], grant: string, requires?: string): Stage {
  const s = stage(level(id, title, { ...shared, ...props, hints, hint: hints[2] }), story, result, [grant], witness, requires);
  s.level.briefing = [story]; return s;
}

const send = scene('C4-6-send', '登记厅 · 把下一站准备好', {
  objective: 'reach', spawn: p(112, 432), exit: p(400, 304),
  credential: { ...ticket, exitOwners: ['terminal:FAST', 'terminal:SERVICE'] },
  plates: [plate('DISPATCH', 240, 304)],
  terminals: [{ id: 'S', x: 112, y: 176, kind: 'source' }, relay('FAST', 400, 176, { plate: 'DISPATCH', window: [3, 7] }), relay('SERVICE', 400, 432)],
  objectiveLabel: '交出唯一凭据后空手离开：FAST 需同伙与 3–7 秒窗口，SERVICE 随时收件',
}, '联络员：这是同一只柜子的两面。FAST 要先安排人和时段，但站台会替你省一次接应；SERVICE 随时收件，后面两段要多留一名同伙。把票放进去，再从楼梯到另一侧接它。',
'你空着手离开。凭据留在选定的柜子里；下一间不会再补发一份。',
['FAST 的前期配合，换取后两区更少的留守；SERVICE 无需前期同伙，但后面要人工接应。', 'FAST：录一名回声守 DISPATCH，本人取 S，在第 3–7 秒交到 FAST。SERVICE：本人从 S 取票，交到南侧 SERVICE 即可。', '先录 (240,432) → DISPATCH。本人去 S 按 E，再到 FAST 等至第 3 秒按 E 交出，去中央楼梯。也可不录回声，取 S 后沿西侧南下，到 SERVICE 交付再上楼。'],
[g(240, 432), g(240, 304), r(), g(112, 176), e(), g(400, 176), w(40), e(), g(400, 304)], 'station-sent');
send.outcomes = [
  { id: 'station-fast', credentialAt: 'terminal:FAST', label: 'FAST 快线交接柜', consequence: '从站台北侧接回；站台与档案区各需一名回声配合。' },
  { id: 'station-service', credentialAt: 'terminal:SERVICE', label: 'SERVICE 人工交接柜', consequence: '从站台南侧接回；无交付窗口，后两区各需额外一名回声接应。' },
];
send.alternatives = [[g(112, 176), e(), g(112, 432), g(400, 432), e(), g(400, 304)]];

function receive(service: boolean): Stage {
  const cabinet = service ? 'SERVICE' : 'FAST';
  return scene(`C4-6-receive${service ? '-service' : ''}`, service ? '对侧站台 · 接回人工柜的票' : '对侧站台 · 快线给你留了位置', {
    objective: 'reach', spawn: p(528, service ? 432 : 176), exit: p(848, 464),
    credential: { ...ticket, from: send.level.id, incomingOwners: [`terminal:${cabinet}`], receiveByPlayer: cabinet, exitOwners: ['terminal:ARCHIVE'], exitAuthorizations: ['PLATFORM'] },
    plates: [plate('HAND', 656, service ? 176 : 432), ...(service ? [plate('STEP', 528, 304)] : [])],
    terminals: [relay(cabinet, 496, service ? 432 : 176, { plate: 'HAND', waitForDelivery: true, ...(!service ? { window: [2, 6] as [number, number] } : {}) }), lock('PLATFORM', 656, service ? 304 : 176), relay('ARCHIVE', 848, 304)],
    doors: [passage('TICKET', 704, 256, 'PLATFORM', service ? 'STEP' : undefined)],
    objectiveLabel: `本人从 ${cabinet} 接回原票，完成 PLATFORM 签入，再把票交到 ARCHIVE 留给下一段`,
  }, service ? '你：柜门就在我刚才投递的位置背面。人工柜没有时段限制，不过 HAND 接线和 STEP 放行都要有人留下。我去取票、签入，再把它送往档案区。' : '你：柜子背面的 FAST 灯亮了。先让一个我去 HAND，真人在 2–6 秒接回；快线替我省掉了第二个放行岗位。',
  '你亲手接回并签入了这张票，又把它交到 ARCHIVE。进入档案区后，它仍会在这里等你。',
  [service ? 'HAND 负责柜门接收，STEP 负责人工放行；两处需要分别留守。' : 'HAND 负责打开柜门；FAST 的接收窗口是第 2–6 秒，提前按 E 可原地留候。', '本人接回后到 PLATFORM 签入，穿过中门，把同一张票交入 ARCHIVE，再去东南锚点。回声代取不能替代本人接回。', service ? '先录回声经南侧到 HAND；再录第二条停在西侧 STEP。本人到 SERVICE 按 E 等 HAND 就位，沿南侧去 PLATFORM 签入，通过 TICKET，在 ARCHIVE 按 E 交出，再东南撤离。' : '录一条先沿西侧南下、再到 HAND 的回声。本人在 FAST 按 E 原地等至第 2 秒，去北侧 PLATFORM 签入，再经中央门到 ARCHIVE 交付，从东南离开。'],
  service
    ? [g(656, 432), g(656, 176), r(), g(528, 304), r(), g(496, 432), e(), w(120), g(656, 432), g(656, 304), e(), g(848, 304), e(), g(848, 464)]
    : [g(528, 432), g(656, 432), r(), g(496, 176), e(), w(125), g(656, 176), e(), g(656, 304), g(848, 304), e(), g(848, 464)], 'station-received', 'station-sent');
}
function cargo(service: boolean): Stage {
  const courier = [g(848, 432), e(), w(105), g(784, 432), g(784, 304), g(656, 304), e(), g(656, 432), g(624, 432), e(), g(624, 240), e(), g(656, 176), r()];
  return scene(`C4-6-cargo${service ? '-service' : ''}`, '货运档案 · 票据不是货物', {
    spawn: p(848, 464), exit: p(848, 464), loot: p(528, 176), lootLabel: 'B-17 实体转运货单', par: service ? 2 : 1,
    credential: { ...ticket, from: 'C4-6-receive', incomingOwners: ['terminal:ARCHIVE'], incomingAuthorizations: ['PLATFORM'], exitOwners: ['terminal:RETURN'], exitAuthorizations: ['PLATFORM', 'FINAL'] },
    plates: [plate('HOLD', 656, 176), ...(service ? [plate('POWER', 848, 496)] : [])],
    terminals: [relay('ARCHIVE', 848, 304), relay('R', 848, 432, { waitForDelivery: true }), lock('FINAL', 624, 432, { requiresAuthorization: 'PLATFORM' }), relay('RETURN', 624, 240, { transfer: 'give' })],
    circuits: [{ id: 'CAM-P', x: 656, y: 304, initial: true, label: '货单监控' }],
    doors: [passage('TICKET', 704, 256, 'PLATFORM', service ? 'POWER' : undefined), passage('NORTH', 576, 160, 'FINAL', 'HOLD'), passage('SOUTH', 576, 384, 'FINAL', 'HOLD')],
    guards: [{ id: 'CAM', kind: 'camera', route: [p(528, 112)], facing: Math.PI / 2, range: 190, speed: 0, power: { id: 'CAM-P', on: true } }],
    objectiveLabel: '本人从 ARCHIVE 送票到 R，回声停监控、签 FINAL、交回 RETURN 并守 HOLD；本人带走货单',
  }, `联络员：ARCHIVE 里是你上一段交来的原票，PLATFORM 签名也还在。${service ? '人工通道还需要一个你守 POWER。' : '快线的通道已保持放行。'}另一个你在 R 等票，签完 FINAL 后把票留在 RETURN，继续守住 HOLD；货单只能由你带走。`,
  '票留给下一位接班人，实体货单跟着你离开。B-17 曾预留这条授权链，却没有抵达签收；货物最终转入了防投影设施。',
  ['原票在东侧 ARCHIVE，不会从新来源生成。R 可以录制空手留候；PLATFORM 是上一段留下的签名。', '让回声在 R 等待你送件，再停监控、签 FINAL、交票到 RETURN、守 HOLD。本人取货后回到东南出口。', `${service ? '先录一条守 POWER 的回声。' : ''}接班者在 R 按 E 留候约 1.75 秒，沿东侧绕到 CAM-P 断电，再向南签 FINAL、北上交 RETURN，停在 HOLD 录制。本人从 ARCHIVE 取票，回 R 交出，随后经中央通道等北门打开，取货后原路东撤。`],
  [...(service ? [g(848, 496), r()] : []), ...courier, g(848, 304), e(), g(848, 432), e(), g(784, 432), g(784, 304), g(656, 304), g(656, 176), w(120), g(528, 176), g(656, 176), g(656, 304), g(848, 304), g(848, 464)], 'station-complete', 'station-received');
}
const platform = receive(false), final = cargo(false);
platform.variants = [{ when: 'station-service', stage: receive(true) }];
final.variants = [{ when: 'station-service', stage: cargo(true) }];
export const STATION_TRANSFER: Mission = {
  id: 'C4-6', chapter: '把现在交给过去', title: '不存在的列车票',
  summary: '从登记厅交出唯一凭据，到柜子另一侧亲手接回，再把它送进档案区完成最后一棒。',
  evidence: 'B-17 预留的货运票与防投影设施编号', stages: [send, platform, final],
};
