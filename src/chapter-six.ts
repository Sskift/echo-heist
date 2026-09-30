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

const backup = action('C6-4-a', '先把退路接好', {
  ...east, walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('A', 448, 384)],
  circuits: [panel('BACK', 528, 304, true, '预置备用线路', ['下方签名通道', '上方留守通道'])], lootLabel: '备用线路图',
}, '搭档：原件一离柜，下一间的入口就会落锁。现在选备用线：上方靠人留守，下方靠持票签名。把回程也写进计划。', '备用线路已接好。原件离柜会关闭来路，下一间只保留你预置的回程条件。',
['在取件之前选好回来走哪一条路。', 'BACK 两态分别保留上方留守门与下方签名门；开关在第一道门后。', '录 A 留守，穿下门到 BACK。保持上方方案，或按 E 改成下方方案，再取线路图到锚点。'],
[...holdA, g(528, 432), g(528, 304), g(848, 304), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]);
backup.outcomes = [outcome('C6-4-north', '预置上方留守通道', '下一间从下方进入；取件锁住下门，靠左上方 A 留守打开上门返回。', 'BACK', true), outcome('C6-4-south', '预置下方签名通道', '下一间从上方进入；取件锁住上门，持票到内侧 L 签名后从下门返回。', 'BACK', false)];
backup.alternatives = [[...holdA, g(528, 432), g(528, 304), e(), g(848, 304), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]];

const sealed = action('C6-4-b', '来路关上之后', {
  loot: p(816, 432), exit: p(112, 432), walls: room([[14, [4, 5, 12, 13]]]), plates: [plate('A', 272, 176)],
  circuits: [panel('ENTRY', 112, 432, true, '取件联锁'), panel('BACK', 112, 304, true, '已预置上方备用线')],
  doors: [{ id: 'ENTRY', x: 448, y: 384, w: 32, h: 64, power: power('ENTRY') }, { ...gate('NORTH', 448, 128, 'A'), power: power('BACK') }],
  onLoot: { power: [power('ENTRY', false)], message: '取件关闭下方 ENTRY；上方 NORTH 仍需要 A 留守。沿右侧向上，再从上门回左侧。' }, lootLabel: '抹除程序原件',
}, '你：上方备用线已在。不能只看去拿原件时的门；让过去的我留在 A，接住来路关闭后的这一轮。', '原件取出，来路确实关闭。预先安排的留守者打开了另一条路。',
['下方入口现在开着，上方 A 的意义在取件以后。', '先录 A，真人从下方进；取件后向上走，利用 NORTH 回左侧。', '录 A。真人下方取件，沿 x=848 到 y=176，穿上门回 x=112，再下行到锚点。'],
[...holdA, g(816, 432), g(848, 432), g(848, 176), g(112, 176), g(112, 432)], 'C6-4-a');
variant(sealed, 'C6-4-south', action('C6-4-b-south', '把签名带到回程', {
  loot: p(816, 176), exit: p(112, 432), walls: room([[14, [4, 5, 12, 13]]]), plates: [plate('A', 272, 304)],
  circuits: [panel('ENTRY', 112, 432, true, '取件联锁'), panel('BACK', 176, 432, false, '已预置下方备用线')],
  terminals: [source(112, 176), lock(656, 432, { plate: 'A' })],
  doors: [{ id: 'ENTRY', x: 448, y: 128, w: 32, h: 64, power: power('ENTRY') }, { ...signed(448, 384), power: power('BACK', false) }],
  onLoot: { power: [power('ENTRY', false)], message: '取件关闭上方 ENTRY；持票到右下方 L 签名，A 同伙留守，打开下方 SIGNED 返回。' }, lootLabel: '抹除程序原件',
}, '搭档：你选了下方备用线。S 的凭据必须随真人进去；拿到原件后，内侧 L 才是回家的钥匙。', '上门关闭后，你带着凭据完成内侧签名，从下方回到了锚点。',
['上方是来路，下方是签名回程；L 在原件内侧。', 'A 负责远端核验，真人从 S 带票进去，在返回前完成 L。', '录 A 留守，真人到 S 取票，从上门取原件。去右下方 L 签名，再穿下门回左侧。'],
[g(272, 432), g(272, 304), r(), g(112, 176), e(), g(816, 176), g(656, 176), g(656, 432), e(), g(112, 432)]));

const recover = action('C6-4-c', '修复要发生在取件之后', {
  loot: p(816, 432), exit: p(112, 432), walls: room([[14, [4, 5, 12, 13]]]),
  circuits: [panel('ENTRY', 176, 432, true, '来路联锁'), panel('BACK', 112, 304, false, '备用线复位')],
  doors: [{ id: 'ENTRY', x: 448, y: 384, w: 32, h: 64, power: power('ENTRY') }, { id: 'BACK', x: 448, y: 128, w: 32, h: 64, power: power('BACK') }],
  onLoot: { power: [power('ENTRY', false), power('BACK', false)], message: '取件会同时断开 ENTRY 与 BACK。提前复位无效；让留在外侧的同伙在取件后接回 BACK。' }, exitPower: [power('BACK')], lootLabel: '联锁变更日志',
}, '你：这一间会把备用线也重置。过去的我不能只做对的事，还得在正确的时候做。', '复位发生在断电以后，日志安全带出。馆方的取件联锁已成为可预先安排的步骤。',
['取件会覆盖本帧更早的复位，先开一次 BACK 并不够。', '真人去取件；回声留在左侧 BACK，晚些才接通它。', '录下走到 BACK、等待约四秒、按 E 接通。下一轮真人直接下方取件，再从上方备用门返回左侧。'],
[g(112, 304), w(240), e(), r(), g(816, 432), g(848, 432), g(848, 176), g(112, 176), g(112, 432)], 'C6-4-b');

const crossCamera = (powerId?: string): GuardDefinition => ({ id: 'CAM', kind: 'camera', route: [p(688, 112)], facing: Math.PI / 2, speed: 0, range: 176, ...(powerId ? { power: power(powerId) } : {}) });
const spare = action('C6-5-a', '少一个自己，多一次掠过', {
  ...east, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 176, 304), plate('B', 304, 400)],
  doors: [{ id: 'WINDOW', x: 448, y: 160, w: 32, h: 64, window: [2, 5] }, { id: 'MANUAL', x: 448, y: 384, w: 32, h: 64, plates: ['A', 'B'], plateMode: 'all' }], guards: [crossCamera()], lootLabel: '匿名证人的封存索引', par: 0,
}, '搭档：上方窗口不用同伙，但要短暂经过监控边缘。下方可留两名同伙，绕到视野外。两种安排都能完成，别把回声数量当成唯一答案。', '索引取得。你选择了自己的代价：少留同伙，或把经过监控的时间降为零。',
['比较上方短窗口和下方双人门，摄像头只看正下方。', '上方快速穿过视野边缘不会立即报警；下方路线应沿右墙向上，保持在视野外。', '少回声：真人在 2–5 秒经过上门，沿 y=176 快速横穿。低暴露：分别录 A、B 留守，走下门，沿 x=848 取索引。'],
[g(400, 432), g(400, 176), g(816, 176), g(848, 176), g(848, 432)]);
spare.alternatives = [[g(176, 432), g(176, 304), r(), g(304, 432), g(304, 400), r(), g(528, 432), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]];

const exposure = action('C6-5-b', '谁去关掉那只眼睛', {
  loot: p(816, 432), exit: p(848, 432), walls: room([[14, [12, 13]]]), plates: [plate('A', 400, 432)], doors: [gate('A', 448, 384)],
  circuits: [panel('CAM', 656, 176, true, '走廊摄像头')], guards: [{ ...crossCamera('CAM'), route: [p(688, 368)] }], lootLabel: '匿名证人保留的收据', par: 1,
}, '你：只留一个开门的人，可以直接掠过走廊。再安排一个人去内侧关监控，就能在它失去视线之后取件。', '收据与索引一致。两种配合保住的是同一份证据，区别在同伙分工与暴露代价。',
['摄像头从走廊上方看下来，CAM 操作点在门内上方。', '一名同伙守 A，真人快速横穿；或者第二名同伙先进内侧关闭 CAM，真人稍后通过。', '少回声：录 A，沿 y=432 一直通过。低暴露：录 A，再录从门内 x=528 上行到 CAM 并关闭的操作员；真人等约两秒再穿走廊。'],
[g(400, 432), r(), g(816, 432), g(848, 432)], 'C6-5-a');
exposure.alternatives = [[g(400, 432), r(), g(528, 432), g(528, 176), g(656, 176), e(), r(), w(120), g(816, 432), g(848, 432)]];

const roles = action('C6-5-c', '一个人兼任，或两个人分担', {
  ...east, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 208, 176), plate('B', 304, 432)],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 272, y: 400 }, lock(400, 176, { plate: 'A' })],
  doors: [signed(), { id: 'MANUAL', x: 448, y: 384, w: 32, h: 64, plates: ['A', 'B'], plateMode: 'all' }], guards: [crossCamera()], lootLabel: '证人保留的第二份签名',
}, '搭档：送件、值守可以由同一个过去完成；也可以把职责拆开，走人工通道。证人需要的是证据被带出来，不是你演一场最漂亮的戏。', '证人收据和两份签名归档。你已有足够独立的材料，下一场进市政厅核心，将取证、调度与交接串成整套方案。',
['同一个回声交完凭据后还能到 A 值守；下门则需要 A、B 同时有人。', '兼任方案从上方持票通过监控边缘；分担方案由两名回声守开关，真人从下方沿右墙取件。', '兼任：录 S 取票、R 交付、A 留守；真人等 R 送达再接票，到 L 签名。分担：分别录 A、B，走下门与右墙。'],
[g(112, 176), e(), g(272, 176), g(272, 400), e(), g(208, 400), g(208, 176), r(), g(272, 432), g(272, 400), w(180), e(), g(400, 400), g(400, 176), e(), g(816, 176), g(848, 176), g(848, 432)], 'C6-5-b');
roles.alternatives = [[g(208, 432), g(208, 176), r(), g(304, 432), r(), g(528, 432), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]];

const hallEntry = action('C6-6-a', '自己决定从哪里进去', {
  ...east, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 272, 304), plate('B', 176, 304), plate('C', 304, 400)],
  circuits: [panel('ACCESS', 272, 432, true, '核心入口', ['双人检修', '持票认证'])], terminals: [source(112, 176), lock(400, 176, { plate: 'A', window: [2, 7] })],
  doors: [{ ...signed(), power: power('ACCESS') }, { id: 'SERVICE', x: 448, y: 384, w: 32, h: 64, plates: ['B', 'C'], plateMode: 'all', power: power('ACCESS', false) }], lootLabel: '核心区审计章',
}, '你：入口由我选，接下来怎样调度、怎样交接，也由我安排。先把完整后果看清楚，再开始。', '第一份回执已提交。接力终端或人工岗位将按你的入口方案开放。',
['上方签名要在 2–7 秒核验；下方检修要两处同时留守。', '持票方案录 A，真人 S 取票、L 授权；检修方案录 B、C，真人改 ACCESS。', '认证：录 A，再到 S、L，走上门。检修：分别录 B、C，真人到 ACCESS 设为双人检修，走下门。'],
[g(272, 432), g(272, 304), r(), g(112, 176), e(), g(400, 176), e(), g(816, 176), g(848, 176), g(848, 432)]);
hallEntry.outcomes = [outcome('C6-6-certified', '凭据入口', '调度间开放定时 R 接力和签名内门；需要把送件安排在接收窗口。', 'ACCESS', true), outcome('C6-6-service', '人工入口', '调度间关闭终端，改用 A、B 两处值守与 Q 抑制控制。', 'ACCESS', false)];
hallEntry.alternatives = [[g(176, 432), g(176, 304), r(), g(304, 432), g(304, 400), r(), g(272, 432), e(), g(528, 432), g(848, 432), g(848, 176), g(816, 176), g(848, 176), g(848, 432)]];

const dispatchOptions = [outcome('C6-6-radio', '保留声响调度', '下一间可从上方广播引走巡逻者；取件会抑制下门同伙，真人需去内侧 N 恢复它。', 'RADIO', true), outcome('C6-6-manual', '切换人工停机', '下一间真人在外侧 T 关闭追踪、释放留守者；取件重启 T，改走预置的上方回程。', 'RADIO', false)];
const dispatch = action('C6-6-b', '把钥匙交到调度间', {
  loot: p(816, 176), exit: p(848, 464), walls: room([[22, [5, 6]]]), plates: [plate('A', 272, 432)], doors: [signed(704, 160)],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 528, y: 304, window: [5, 7] }, lock(656, 176, { plate: 'A' })],
  circuits: [panel('RADIO', 848, 304, true, '下一间安保调度', ['人工停机', '声响调度'])], lootLabel: '安保调度回执',
}, '搭档：认证入口把 R 接通了，但它只在第五到第七秒接件。把送件者和接收者排进同一个窗口，再选择下一间怎样处理安保。', '调度回执已保存。保留广播或改成人工停机，会留下不同的取件与回程安排。',
['R 的窗口同时约束交付与接收；交件者之后还要回到 A。', '送件录像可以延迟出场，真人先在 R 等候，到窗口内接票。', '录 S 取票、R 交付、A 留守，延迟约 1.5 秒。真人到 R 等到五秒左右接票，L 签名；取回执后在 RADIO 保持广播或切为人工。'],
[g(112, 176), e(), g(528, 176), g(528, 304), e(), g(272, 304), g(272, 432), r(), { delay: 90, echo: 0 }, g(528, 432), g(528, 304), w(240), e(), g(656, 304), g(656, 176), e(), g(816, 176), g(848, 176), g(848, 304), g(848, 464)], 'C6-6-a');
dispatch.outcomes = dispatchOptions;
dispatch.alternatives = [[...dispatch.witness.slice(0, -1), e(), g(848, 464)]];
const manualDispatch = action('C6-6-b-service', '把岗位留在调度间', {
  loot: p(816, 176), exit: p(848, 464), par: 2, walls: room([[10, [12, 13]], [22, [5, 6]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)], doors: [gate('A', 320, 384), gate('B', 704, 160)],
  circuits: [panel('Q', 112, 432, true, '内侧抑制'), panel('RADIO', 848, 304, true, '下一间安保调度', ['人工停机', '声响调度'])], suppressors: [{ id: 'N', x: 480, y: 384, w: 96, h: 96, power: power('Q') }], lootLabel: '安保调度回执',
}, '你：没有终端可借。把 A、B 两处岗位留稳，真人关 Q；进去之后还要决定下一间保留广播还是人工停机。', '人工岗位完成了调度室签入。下一间按 RADIO 回执安排安保与回程。',
['两道门的留守关系不变，B 会被 Q 控制的抑制场影响。', '先让 A 打开第一道门，第二条录像到 B；真人关闭 Q 后通过。', '录 A，再录 B。真人在起点关 Q，穿两门取回执；在右侧 RADIO 选下一间方式，再去右下锚点。'],
[g(208, 432), g(208, 176), r(), g(528, 432), r(), e(), g(656, 432), g(656, 176), g(816, 176), g(848, 176), g(848, 304), g(848, 464)]);
manualDispatch.outcomes = dispatchOptions;
manualDispatch.alternatives = [[...manualDispatch.witness.slice(0, -1), e(), g(848, 464)]];
variant(dispatch, 'C6-6-service', manualDispatch);

const deliveryOptions = [outcome('C6-6-manual-exit', '人工交接线', '最后一间用两处留守开门，真人关闭内侧摄像头；取件后还需回到外侧恢复 CIV。', 'DELIVERY', true), outcome('C6-6-signed-exit', '凭据交接线', '最后一间用一名送件兼留守者授权，穿过第五秒结束的扫描，再带件回外侧恢复 CIV。', 'DELIVERY', false)];
const hallPickup = action('C6-6-c', '叫走守卫，还要接回同伙', {
  loot: p(816, 432), exit: p(112, 432), par: 2, walls: room([[14, [4, 5, 12, 13]]], [], [[19, 7], [20, 7], [21, 7], [22, 7], [24, 2], [24, 3], [24, 4]]), plates: [plate('A', 400, 432)],
  doors: [gate('A', 448, 384), { id: 'SERVICE', x: 448, y: 128, w: 32, h: 64, window: [0, 3] }], guards: [{ ...diversionGuard, searchSeconds: 3 }], soundMarkers: [{ id: 'N1', x: 656, y: 176 }],
  circuits: [panel('N', 848, 304, false, '取件抑制联锁'), panel('DELIVERY', 528, 432, true, '最终交接线', ['凭据交接', '人工交接'])], suppressors: [{ id: 'NULL', x: 352, y: 384, w: 96, h: 96, power: power('N') }],
  onLoot: { power: [power('N')], message: '取件会开启 N，A 同伙失效、下门关闭。真人去右侧 N 关闭抑制，再沿下方带件返回。' }, lootLabel: '中央总库责任清单',
}, '搭档：广播保留着，能把守卫叫去上面。原件离柜会抑制开门的同伙；不要忘记给回程留一次真人操作。', '责任清单取出，同伙恢复，你回到了外侧。最后一段按 DELIVERY 回执接入中央总库。',
['除了声响与 A 留守，取件后还要恢复 N；DELIVERY 决定最后一间的交接设施。', '第一条回声上方发声，第二条晚三秒到 A。真人先选 DELIVERY，取件后右上 N 复位，再返回下门。', '录上方 N1 发声并躲藏，另录 A 并延迟三秒。真人等三秒进下门，在 DELIVERY 选择交接方式；取清单后沿右侧去 N 关闭，再沿下方回左侧。'],
[g(112, 176), g(656, 176), noise(), g(848, 176), g(848, 80), r(), g(400, 432), r(), { delay: 180, echo: 1 }, w(180), g(528, 432), g(816, 432), g(848, 432), g(848, 304), e(), g(848, 432), g(400, 432), g(112, 432)], 'C6-6-b');
hallPickup.outcomes = deliveryOptions;
hallPickup.alternatives = [[...hallPickup.witness.slice(0, 11), e(), ...hallPickup.witness.slice(11)]];
const manualPickup = action('C6-6-c-manual', '让重启变成另一扇门', {
  loot: p(816, 432), exit: p(112, 176), walls: room([[14, [4, 5, 12, 13]]]), plates: [plate('A', 400, 432)],
  circuits: [panel('T', 112, 176, true, '追踪与回程分流'), panel('DELIVERY', 528, 432, true, '最终交接线', ['凭据交接', '人工交接'])],
  doors: [gate('A', 448, 384), { id: 'RETURN', x: 448, y: 128, w: 32, h: 64, power: power('T') }],
  guards: [{ id: 'TR', kind: 'tracker', route: [p(688, 432)], facing: Math.PI, speed: 0, range: 350, hearing: 500, searchSeconds: 1.5, traceSeconds: 1.5, power: power('T') }],
  suppressors: [{ id: 'MANUAL', x: 64, y: 128, w: 96, h: 96 }, { id: 'KEEPER', x: 352, y: 384, w: 96, h: 96, power: power('T') }],
  onLoot: { power: [power('T')], message: '取件重启 T：A 回声失效、下门关闭，上方 RETURN 同时打开。真人不被追踪器识别，从上门撤离。' }, lootLabel: '中央总库责任清单',
}, '你：人工方案先由我停 T，放同伙开下门。取件后 T 重启，同时开上门；那时同伙被隐藏，而我可以从它眼前走过。', '追踪器重启时，看不见被抑制的同伙，也不识别真人。你带着责任清单从预置上门离开。',
['T 同时控制追踪、A 的抑制与上方回程门，取件会将它重新接通。', '录 A，真人去左上 T 断电，再返回下方穿门。取件后不要重走下门。', '录到 A 留守。真人左上关 T，经下方门选 DELIVERY、取清单；沿右侧向上，再穿 RETURN 回左上锚点。'],
[g(400, 432), r(), g(112, 176), e(), g(112, 432), g(528, 432), g(816, 432), g(848, 432), g(848, 176), g(112, 176)]);
manualPickup.outcomes = deliveryOptions;
manualPickup.alternatives = [[...manualPickup.witness.slice(0, 6), e(), ...manualPickup.witness.slice(6)]];
variant(hallPickup, 'C6-6-manual', manualPickup);

const hallExit = action('C6-6-d', '留人、关眼睛、恢复城市', {
  loot: p(816, 176), exit: p(112, 432), par: 2, walls: room([[10, [12, 13]], [20, [5, 6]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)], doors: [gate('A', 320, 384), gate('B', 640, 160)],
  circuits: [panel('CAM', 592, 432, true, '内侧监控'), panel('CIV', 112, 304, true, '民用验证线路')], guards: [crossCamera('CAM')],
  onLoot: { power: [power('CIV', false)], message: '取件会断开 CIV。带件返回左侧，亲手接回民用验证线路后才能完成交接。' }, exitPower: [power('CIV')], lootLabel: '中央总库传输地址',
}, '搭档：人工交接线需要两处值守，内侧监控由真人关掉。取出传输地址会断开 CIV，带件回来以后，别让城市替我们的行动付账。', '市政厅的独立记录、责任清单与传输地址齐了，CIV 已恢复。你：下一次我们不再只把东西偷出来。把证据送到他们无法单独抹去的地方，然后去旧渡口见你。',
['A 为 B 开门，B 为真人开内门；CAM 要先关，CIV 要在取件后恢复。', '两条回声分别留守 A、B，真人在右下 CAM 断电，再取地址并沿原路带回左侧。', '录 A，再录 B。真人进外门到 CAM 关闭监控，经上方 B 门取件；返回 B、A 两门后，到左侧 CIV 按 E 恢复，回锚点。'],
[g(208, 432), g(208, 176), r(), g(528, 432), r(), g(592, 432), e(), g(592, 176), g(816, 176), g(592, 176), g(592, 432), g(112, 432), g(112, 304), e(), g(112, 432)], 'C6-6-c');
variant(hallExit, 'C6-6-signed-exit', action('C6-6-d-signed', '让一份凭据完成交接', {
  loot: p(816, 176), exit: p(112, 432), walls: room([[14, [5, 6]]]), plates: [plate('A', 208, 176)], doors: [signed()],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 272, y: 400 }, lock(400, 176, { plate: 'A' })],
  scanners: [{ id: 'SCAN', x: 640, y: 128, w: 32, h: 96, period: 12, active: [0, 5] }], circuits: [panel('CIV', 112, 304, true, '民用验证线路')],
  onLoot: { power: [power('CIV', false)], message: '取件会断开 CIV。按原签名通道带件返回，接回外侧 CIV 才能完成交接；扫描第五秒结束。' }, exitPower: [power('CIV')], lootLabel: '中央总库传输地址',
}, '你：凭据交接线只需一个送件兼留守的人。先把唯一凭据接稳，等扫描结束，再带地址回来恢复 CIV。', '一份凭据串起了全部核验，CIV 已恢复。市政厅的独立记录与责任清单指向中央总库。你：把证据送到他们无法单独抹去的地方，然后去旧渡口见你。',
['同一名回声交件后守 A；真人接票、授权、穿过扫描，最后恢复 CIV。', '扫描到第五秒结束，接力已经消耗了一部分时间；进入光带前确认空档。', '录 S 取票、R 交件、A 留守。真人在 R 等件接收，到 L 签名，等扫描结束后取地址；原路回到左侧 CIV 恢复，再到锚点。'],
[g(112, 176), e(), g(272, 176), g(272, 400), e(), g(208, 400), g(208, 176), r(), g(272, 432), g(272, 400), w(160), e(), g(400, 400), g(400, 176), e(), g(592, 176), g(816, 176), g(112, 176), g(112, 304), e(), g(112, 432)]));

export const CHAPTER_SIX: Mission[] = [
  { id: 'C6-1', chapter: '自己写作案计划', title: '正门还是检修口', summary: '选择入口，也选择下一间可用的设施；成功后才提交，锚点允许重选。', evidence: '两条入口汇合的市政厅内部索引', stages: [entry, entryAfter] },
  { id: 'C6-2', chapter: '自己写作案计划', title: '先救谁的时间', summary: '先取记录或先接通信，让先得到的证明帮助核验另一份。', evidence: 'B-17 活着的双重证明与旧渡口地址', stages: [order, recordsFirst, contact] },
  { id: 'C6-3', chapter: '自己写作案计划', title: '留灯还是留门', summary: '供电结果带到下一间：终端与监控，或通道与黑暗。', evidence: '互相印证的签名副本与设备时间戳', stages: [grid, gridAfter, verify] },
  { id: 'C6-4', chapter: '自己写作案计划', title: '计划赶不上自己', summary: '取件锁住来路，让事先安排的备用门与延后复位接住回程。', evidence: '抹除程序原件与取件联锁变更日志', stages: [backup, sealed, recover] },
  { id: 'C6-5', chapter: '自己写作案计划', title: '不只一种完美', summary: '同一份证据，少回声或低暴露，自己选择配合的代价。', evidence: '匿名证人的索引、收据与第二份签名', stages: [spare, exposure, roles] },
  { id: 'C6-6', chapter: '自己写作案计划', title: '市政厅不眠夜', summary: '四段完整劫案：选择入口、安保调度与交接设施，取出责任清单并恢复民用线路。', evidence: '可互相核验的责任清单与中央总库传输地址', stages: [hallEntry, dispatch, hallPickup, hallExit] },
];
