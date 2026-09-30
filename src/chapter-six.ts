import type { Mission, Outcome, Stage, WitnessAction } from './campaign-content.ts';
import type { Circuit, GuardDefinition, Level, Terminal } from './levels.ts';
import { g, w, r, e, noise, point as p, room, level, stage, gate, plate } from './campaign-authoring.ts';

const power = (id: string, on = true) => ({ id, on });
const panel = (id: string, x: number, y: number, initial: boolean, label: string, states?: [string, string]): Circuit => ({ id, x, y, initial, label, states });
const source = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'S', kind: 'source', x, y, ...extra });
const lock = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'L', kind: 'lock', x, y, authorization: 'SIGNED', ...extra });
const signed = (x = 448, y = 160) => ({ id: 'SIGNED', x, y, w: 32, h: 64, authorization: 'SIGNED' });
const east = { loot: p(816, 176), exit: p(848, 432) };
const holdA = [g(272, 432), g(272, 176), r()];
const courier = [g(112, 176), e(), g(400, 176), g(400, 304), e(), g(272, 304), g(272, 432), r()];
const receiver = [g(400, 432), g(400, 304), w(160), e(), g(656, 304), g(656, 176), e(), g(816, 176), g(848, 176), g(848, 432)];
const outcome = (id: string, label: string, consequence: string, circuit: string, on: boolean): Outcome => ({ id, label, consequence, power: power(circuit, on) });
function action(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: WitnessAction[], previous?: string): Stage {
  const map = level(id, title, { subtitle: 'WRITE YOUR OWN WAY IN', district: '市政厅 / CIVIC HALL', theme: 'clockwork', noiseResponse: 'nearest', ...props, hint: hints[2], hints });
  const s = stage(map, story, result, [id + '-clear'], witness, previous ? previous + '-clear' : undefined);
  s.level.briefing = [map.objectiveLabel ?? '安排入口和同伙，在锚点提交下一段的条件。'];
  return s;
}
function variant(base: Stage, when: string, other: Stage) {
  other.grants = [...base.grants]; other.requires = base.requires;
  (base.variants ??= []).push({ when, stage: other });
}

const entry = action('C6-1-a', '两条入口，一份承诺', {
  ...east, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 272, 304)],
  circuits: [panel('ENTRY', 176, 432, true, '入口登记', ['检修口', '正门'])],
  terminals: [source(272, 176), lock(400, 176, { plate: 'A' })],
  doors: [{ ...signed(), power: power('ENTRY') }, { id: 'SERVICE', x: 448, y: 384, w: 32, h: 64, power: power('ENTRY', false) }],
  suppressors: [{ id: 'MANUAL', x: 128, y: 384, w: 96, h: 96 }], lootLabel: '入口登记回执',
}, '联络员：正门登记能保留下一间的凭据终端；检修口不登记，但下一间要靠两处人工值守。你看过后果后自己选。', '入口回执已提交。下一间按你留下的入口状态开放；想换方案，可以回到这个锚点。',
['看上方签名门与下方检修门，比较锚点下的两种后果。', '正门授权需要同伙守 A；检修口的 ENTRY 面板在抑制场内，只能由真人改设。', '正门：录 A 留守，真人从 S 取凭据、在 L 签名。检修：真人将 ENTRY 设为检修口，从下方进入。'],
[g(272, 432), g(272, 304), r(), g(112, 176), g(272, 176), e(), g(400, 176), e(), g(816, 176), g(848, 176), g(848, 432)]);
entry.outcomes = [outcome('C6-1-front', '走正门登记', '下一间 S 与 R 接力终端可用，内门需要持票授权。', 'ENTRY', true), outcome('C6-1-service', '走检修口', '下一间接力终端关闭，A、B 两处人工门与抑制控制 Q 可用。', 'ENTRY', false)];
entry.alternatives = [[g(176, 432), e(), g(528, 432), g(816, 432), g(816, 176), g(848, 176), g(848, 432)]];

const entryAfter = action('C6-1-b', '登记留下的终端', {
  ...east, walls: room([[22, [5, 6]]]), plates: [plate('A', 272, 432)], doors: [signed(704, 160)],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 400, y: 304 }, lock(656, 176, { plate: 'A' })], lootLabel: '市政厅内部索引',
}, '联络员：你的正门回执接通了 S、R。送件的人还能回来守住授权开关；把凭据交给现在的你。', '索引到手。两种入口都能抵达这里，但留下的同伙安排不同。',
['凭据只需过一道签名门，观察送件者交付后的剩余时间。', '送件者交到 R 后返回 A；真人接件再去 L。', '录下 S 取件、R 交付、A 留守。真人在 R 等送达再接收，去 L 授权，从右上方进门取索引。'], [...courier, ...receiver], 'C6-1-a');
variant(entryAfter, 'C6-1-service', action('C6-1-b-service', '没有登记的检修间', {
  ...east, par: 2, walls: room([[10, [12, 13]], [22, [5, 6]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)], doors: [gate('A', 320, 384), gate('B', 704, 160)],
  circuits: [panel('Q', 112, 432, true, '检修间抑制')], suppressors: [{ id: 'N', x: 480, y: 384, w: 96, h: 96, power: power('Q') }], lootLabel: '市政厅内部索引',
}, '你：检修门开了，凭据终端没有通电。按预告，改用 A、B 人工值守；真人负责 Q。', '索引到手。没有登记也能进来，你用两名留守同伙补上了终端的工作。',
['A 负责外门，B 负责内门；B 的终点在抑制场里。', '真人录制时能站 B，但回放之前必须关闭 Q。', '先录 A，再穿下方门录 B。最后真人关闭起点 Q，沿下方进外门，再从右上方 B 门取索引。'],
[g(208, 432), g(208, 176), r(), g(528, 432), r(), e(), g(656, 432), g(656, 176), g(816, 176), g(848, 176), g(848, 432)]));

const order = action('C6-2-a', '先接通哪一端', {
  loot: p(816, 304), exit: p(848, 432), walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 272, 176)],
  circuits: [panel('ORDER', 112, 432, true, '救援线路', ['先通信', '先记录'])],
  doors: [{ id: 'WINDOW', x: 448, y: 160, w: 32, h: 64, window: [2, 5], power: power('ORDER') }, { ...gate('A', 448, 384), power: power('ORDER', false) }], lootLabel: '救援线路索引',
}, '你：一端是 B-17 的注销记录，另一端是城外临时身份的通信。先恢复哪一端，会决定另一端能获得什么帮助。', '线路顺序已提交。两份证明都要取到，顺序由你决定。',
['上方是定时窗口，下方需要一名留守者。', 'ORDER 保持先记录，走上方窗口；改成先通信，则录 A 打开下方。', '先记录：从上方缺口在 2–5 秒间通过。先通信：改 ORDER，录 A，下一轮再改 ORDER，从下方通过。'],
[g(400, 432), g(400, 176), g(528, 176), g(816, 176), g(816, 304), g(848, 304), g(848, 432)]);
order.outcomes = [outcome('C6-2-records', '先恢复注销记录', '先在双人签名室取得核对编号；编号会打开后续通信间的门。', 'ORDER', true), outcome('C6-2-voice', '先恢复通信', '先关闭共线监听，取得联络暗号；随后可用广播诱饵调离记录室守卫。', 'ORDER', false)];
order.alternatives = [[...holdA, e(), g(528, 432), g(816, 432), g(816, 304), g(848, 304), g(848, 432)]];

const recordsFirst = action('C6-2-b', '先让一个名字重新存在', {
  ...east, walls: room([[14, [5, 6]]]), plates: [plate('A', 272, 432)], doors: [signed()], terminals: [source(112, 176), lock(400, 176, { plate: 'A' })], lootLabel: '注销前后的核对编号',
}, '你：先拿登记处的原件。我们不能只凭联络员的一句话认定城外的人是谁。', '注销前后的编号一致。编号将接通通信间，接下来由对方回答只有我们知道的问题。',
['登记处要求持票者与留守者同时到位。', 'A 在出生点右边，L 在上方入口前；二者不能由同一个真人同时占用。', '录一名同伙留在 A，真人在 S 取票，到 L 授权，然后取走原件。'],
[g(272, 432), r(), g(112, 176), e(), g(400, 176), e(), g(816, 176), g(848, 176), g(848, 432)], 'C6-2-a');
variant(recordsFirst, 'C6-2-voice', action('C6-2-b-voice', '先让一个声音传回来', {
  loot: p(816, 432), exit: p(848, 176), walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 432)], doors: [{ ...gate('A', 448, 384), power: power('MIC', false) }],
  circuits: [panel('MIC', 112, 176, true, '共线监听')], suppressors: [{ id: 'MANUAL', x: 64, y: 128, w: 96, h: 96 }],
  guards: [{ id: 'CAM', kind: 'camera', route: [p(784, 432)], facing: Math.PI, speed: 0, range: 280, power: power('MIC') }], lootLabel: '私人联络暗号',
}, '联络员：你先接通信。监听与门禁共线，MIC 只能由真人关闭；同伙留在 A，别把谈话送进档案系统。', '一个声音回答：“怀表背面不是两道划痕，是我们各划了一道。”先保留暗号，再拿独立记录核对。',
['MIC 同时控制下方门禁与监控，操作点处于抑制中。', '回声只能负责 A，真人先去左上方 MIC，再返回下方通道。', '录 A 留守。真人沿左侧向上关闭 MIC，再原路向下穿门取暗号，从右上方离开。'],
[g(272, 432), r(), g(112, 176), e(), g(112, 432), g(816, 432), g(848, 432), g(848, 176)]));

const contact = action('C6-2-c', '编号之后，是回答', {
  ...east, walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('A', 448, 384)],
  circuits: [panel('MIC', 528, 432, true, '通信监听')], guards: [{ id: 'CAM', kind: 'camera', route: [p(816, 176)], facing: Math.PI, speed: 0, range: 240, power: power('MIC') }], lootLabel: '经编号核验的联络录音',
}, '你：编号接通了通信间，但监听仍在。先让同伙开门，再由真人关闭 MIC，听完这个回答。', '搭档：我还活着。城外，旧渡口，用的是临时身份。授权链是我留下的——别替我公开那些不属于证据的记忆。两份证明已互相核验。',
['编号打开了进入这一间的权限，屋内的监听还需要单独关闭。', 'A 在左上方，MIC 在右侧下方。真人过门后先操作 MIC，再接近录音。', '录 A 留守，从下方进门关闭 MIC，沿右侧取录音并撤离。'],
[...holdA, g(528, 432), e(), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)], 'C6-2-b');
const diversionGuard: GuardDefinition = { id: 'G', route: [p(784, 432), p(560, 432)], facing: Math.PI, speed: 80, range: 300, hearing: 800, searchSeconds: 1.2 };
variant(contact, 'C6-2-voice', action('C6-2-c-records', '回答之后，是核验', {
  loot: p(816, 432), exit: p(112, 432), walls: room([[14, [4, 5, 12, 13]]], [], [[19, 7], [20, 7], [21, 7], [22, 7], [24, 2], [24, 3], [24, 4]]), plates: [plate('A', 400, 432)],
  doors: [gate('A', 448, 384), { id: 'SERVICE', x: 448, y: 128, w: 32, h: 64, window: [0, 3] }], guards: [diversionGuard], soundMarkers: [{ id: 'N1', x: 656, y: 176 }], lootLabel: '与暗号一致的注销记录', par: 2,
}, '搭档：记录室的广播会被最近的人检查。你先接通了通信，我能让那台广播工作；让一个过去的你去上方发声，另一个守住下门。', '注销记录与暗号、旧授权链一致：B-17 仍活着，正以临时身份藏在城外旧渡口。他请你核验责任证据，也请你保留私人记忆的边界。',
['下方守卫会看见真人，上方检修门只在最初三秒开放。', '先录上方声源，声响将把守卫调离下方，保护取件后的回程；第二条回声晚些到 A。', '录经上方通道到 N1 发声、再向右上躲藏的回声；另录 A 留守，延迟 3 秒。真人在左侧等 3 秒后穿下门取记录，再原路返回左侧。'],
[g(112, 176), g(656, 176), noise(), g(848, 176), g(848, 80), r(), g(400, 432), r(), { delay: 180, echo: 1 }, w(180), g(816, 432), g(400, 432), g(112, 432)]));

const grid = action('C6-3-a', '把一半电留给后来', {
  ...east, walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('A', 448, 384)],
  circuits: [panel('GRID', 688, 432, true, '下一间供电分流', ['留门', '留灯'])], lootLabel: '供电分流回执',
}, '搭档：下一间只有一条备用电源。留灯会保住签名终端，也保住摄像头；留门会打开检修通道，但终端失电。抵达锚点前都可以改。', '分流状态已保存，下一间的门、终端和照明按这份回执工作。你可以进入前查看，也可以回到这里重选。',
['先看两种后果，GRID 面板在右下方；它影响下一间，不影响本轮入口。', '安排 A 开外门，再决定是否改设 GRID。回放中的操作也计入最终状态。', '录 A，真人穿下门。保留 GRID 为留灯或在面板按 E 改为留门，随后取回执、去右下方锚点。'],
[...holdA, g(688, 432), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]);
grid.outcomes = [outcome('C6-3-light', '保留照明与签名', '下一间 S、L 终端接通，签名门关闭；摄像头工作，需要到内侧 Q 单独关闭。', 'GRID', true), outcome('C6-3-door', '保留检修门', '下一间下方通道打开，S、L 无电；巡逻者失去照明，视距降为两格，听觉仍有效。', 'GRID', false)];
grid.alternatives = [[...holdA, g(688, 432), e(), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]];

const gridAfter = action('C6-3-b', '有灯，有签名，也有眼睛', {
  ...east, walls: room([[14, [5, 6]]]), plates: [plate('A', 272, 432)], doors: [signed()],
  circuits: [panel('GRID', 112, 432, true, '已提交的照明分流'), panel('Q', 528, 432, true, '内侧摄像头')],
  terminals: [source(112, 176, { power: power('GRID') }), lock(400, 176, { plate: 'A', power: power('GRID') })],
  guards: [{ id: 'CAM', kind: 'camera', route: [p(816, 176)], facing: Math.PI, speed: 0, range: 224, power: power('Q') }], lootLabel: '责任人签名副本',
}, '你：灯留着，S、L 能用，摄像头也醒着。先取得签名，再从内侧绕去 Q；这是我刚才选择留下的局面。', '签名副本到手。光让认证更直接，也让接近原件更危险。',
['签名只解决入口，摄像头仍监视右上方原件。', 'A 留守配合 L。进门后先沿中线下行去 Q，不要直接冲向原件。', '录 A。真人 S 取票、L 签名，进门后在 x=528 下行关闭 Q，再沿右侧取原件并撤离。'],
[g(272, 432), r(), g(112, 176), e(), g(400, 176), e(), g(528, 176), g(528, 432), e(), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)], 'C6-3-a');
variant(gridAfter, 'C6-3-door', action('C6-3-b-door', '门留着，灯不在', {
  loot: p(816, 176), exit: p(112, 432), walls: room([[14, [12, 13]]]), doors: [{ id: 'SERVICE', x: 448, y: 384, w: 32, h: 64, power: power('GRID', false) }],
  circuits: [panel('GRID', 112, 176, false, '已提交的检修分流')], terminals: [source(272, 176, { power: power('GRID') }), lock(400, 176, { power: power('GRID') })],
  guards: [{ id: 'G', route: [p(784, 432), p(784, 304)], facing: -Math.PI / 2, speed: 70, range: 320, hearing: 450, searchSeconds: 1.2, lighting: { id: 'GRID', on: true, darkRange: 64 } }], lootLabel: '责任人签名副本',
}, '搭档：下方门已打开，终端没有电。巡逻者只能看两格，但声音照样会传过去。你不必唤醒整间屋子。', '你带回了同一份签名副本。保留通道、借黑暗避开巡逻，这次不需要留下同伙。',
['下方通道已经打开，注意暗处巡逻者的两格视距。', '沿右墙绕过巡逻者，再原路回左侧。开灯会同时关闭检修门。', '真人沿 y=496 到 x=880，再沿右墙向上取件；回到 x=880、y=496，经下方通道返回左侧锚点。'],
[g(112, 496), g(400, 496), g(400, 432), g(528, 432), g(528, 496), g(880, 496), g(880, 176), g(816, 176), g(880, 176), g(880, 496), g(528, 496), g(528, 432), g(400, 432), g(112, 432)]));

const verify = action('C6-3-c', '两种方法，同一份证词', {
  ...east, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 272, 432), plate('B', 176, 304), plate('C', 304, 400)],
  terminals: [source(112, 176), lock(400, 176, { plate: 'A' })], doors: [signed(), { id: 'MANUAL', x: 448, y: 384, w: 32, h: 64, plates: ['B', 'C'], plateMode: 'all' }], lootLabel: '独立保管的签字时间戳',
}, '你：同一份指令，档案签名和设备时间戳都指向同一个人。最后这间可持票核验，也可用两名留守者打开人工通道。', '签字时间戳与前一间的副本互相印证。联络员承认签过字；责任证据不再只依赖他的供述。',
['上方凭据门与下方双人通道都通向时间戳，选择一套人员安排。', '凭据方案由一名回声守 A、真人持票；人工方案由两名回声分别守 B、C。', '少回声：录 A，S 取票后到 L 签名，从上方通过。人工：分别录 B、C，真人走下方门。'],
[g(272, 432), r(), g(112, 176), e(), g(400, 176), e(), g(816, 176), g(848, 176), g(848, 432)], 'C6-3-b');
verify.alternatives = [[g(176, 432), g(176, 304), r(), g(304, 432), g(304, 400), r(), g(528, 432), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]];

export const CHAPTER_SIX: Mission[] = [
  { id: 'C6-1', chapter: '自己写作案计划', title: '正门还是检修口', summary: '选择入口，也选择下一间可用的设施；成功后才提交，锚点允许重选。', evidence: '两条入口汇合的市政厅内部索引', stages: [entry, entryAfter] },
  { id: 'C6-2', chapter: '自己写作案计划', title: '先救谁的时间', summary: '先取记录或先接通信，让先得到的证明帮助核验另一份。', evidence: 'B-17 活着的双重证明与旧渡口地址', stages: [order, recordsFirst, contact] },
  { id: 'C6-3', chapter: '自己写作案计划', title: '留灯还是留门', summary: '供电结果带到下一间：终端与监控，或通道与黑暗。', evidence: '互相印证的签名副本与设备时间戳', stages: [grid, gridAfter, verify] },
];
