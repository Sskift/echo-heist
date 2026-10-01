import type { Ending, Mission, Outcome, Stage, WitnessAction } from './campaign-content.ts';
import type { Circuit, Delivery, Level, Terminal } from './levels.ts';
import { g, w, r, e, noise, point as p, room, level, stage, gate, plate } from './campaign-authoring.ts';

const power = (id: string, on = true) => ({ id, on });
const panel = (id: string, x: number, y: number, initial: boolean, label: string, states?: [string, string]): Circuit => ({ id, x, y, initial, label, states });
const source = (x: number, y: number): Terminal => ({ id: 'S', kind: 'source', x, y });
const lock = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'L', kind: 'lock', x, y, authorization: 'SIGNED', ...extra });
const delivery = (x: number, y: number, label: string, extra: Partial<Delivery> = {}): Delivery => ({ id: 'D', x, y, label, ...extra });
const signed = (x = 704, y = 160, authorization = 'SIGNED') => ({ id: authorization, x, y, w: 32, h: 64, authorization });
const outcome = (id: string, label: string, consequence: string, circuit: string, on: boolean): Outcome => ({ id, label, consequence, power: power(circuit, on) });
const courier = [g(112, 176), e(), g(272, 176), g(272, 400), e(), g(208, 400), g(208, 176), r()];
function action(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: WitnessAction[], previous?: string): Stage {
  const map = level(id, title, { subtitle: 'ONE LAST PLAN', district: '中央总库 / CENTRAL VAULT', theme: 'audit', noiseResponse: 'nearest', ...props, hint: hints[2], hints });
  const s = stage(map, story, result, [id + '-clear'], witness, previous ? previous + '-clear' : undefined);
  s.level.briefing = [map.objectiveLabel ?? hints[0]]; return s;
}
function variant(base: Stage, when: string, other: Stage) {
  other.grants = [...base.grants]; other.requires = base.requires;
  (base.variants ??= []).push({ when, stage: other });
}

const rolesA = action('C7-4-a', '签名的人还要接班', {
  objective: 'deliver', exit: p(848, 432), par: 3, walls: room([[10, [12, 13]], [22, [5, 6]]]),
  plates: [plate('A', 208, 176), plate('B', 528, 432), plate('C', 656, 304)], doors: [gate('ENTRY', 320, 384, 'A'), signed()],
  terminals: [source(112, 176), lock(656, 176, { plate: 'B' })], delivery: delivery(816, 176, '恢复索引的三方校验', { authorization: 'SIGNED', plate: 'C' }),
  objectiveLabel: 'A 守入口，B 见证签名，第三位持票授权后改守 C；真人完成植入',
}, '你：三个位置，三个过去。签名的人不能停在终端；签完以后，提交位置还在等他接班。', '三方校验提交成功。凭据留在签名者手里，实体证据由你植入；不同职责没有混成一份复制品。',
['A 是入口，B 只在签名时需要，C 只在植入时需要。', '第三条录像先持票签名，再移动到 C；不用让第四个同伙做这两件事。', '第一条守 A，第二条穿入口守 B。第三条从 S 取票，经南侧到 L 授权，再南下守 C。真人最后进南门，绕到北侧植入 D 并从东侧撤离。'],
[g(208, 432), g(208, 176), r(), g(528, 432), r(), g(112, 176), e(), g(112, 432), g(656, 432), g(656, 176), e(), g(656, 304), r(), g(656, 432), g(656, 176), w(150), g(816, 176), e(), g(848, 176), g(848, 432)]);

const rolesB = action('C7-4-b', '这次由现在接过凭据', {
  objective: 'deliver', exit: p(848, 432), par: 3, walls: room([[10, [12, 13]], [22, [5, 6]]]),
  plates: [plate('A', 208, 432), plate('B', 528, 432), plate('C', 656, 400)], doors: [gate('ENTRY', 320, 384, 'A'), signed()],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 272, y: 400 }, lock(656, 176, { plate: 'B' })],
  circuits: [panel('Q', 592, 432, true, '提交见证位抑制')], suppressors: [{ id: 'KEEPER', x: 624, y: 368, w: 64, h: 64, power: power('Q') }],
  delivery: delivery(816, 176, '空白身份位的校验', { authorization: 'SIGNED', plate: 'C' }),
  objectiveLabel: '送件者交到 R 后守 A；B、C 分别值守；真人接票、恢复 C、授权并植入',
}, '联络员：上一间由过去签名，这一间由现在接票。同样三个槽位，职责要重新安排。', '原本被标记为不存在的身份位已通过校验。你接回了凭据，也替暂时失效的同伙恢复了位置。',
['A 的位置改到南侧，送件者交到 R 后就能留守；C 在抑制区。', '三条录像分别负责送件兼 A、B 留守、C 留守。真人接票以后还要关 Q。', '录 S 取票、R 交票、A 留守；再录 B 和 C。真人在 R 等到约第 4 秒接票，进门关 Q，去 L 授权后植入 D。'],
[g(112, 176), e(), g(272, 176), g(272, 400), e(), g(208, 400), g(208, 432), r(), g(272, 432), g(400, 432), g(528, 432), r(), g(272, 432), g(400, 432), g(656, 432), g(656, 400), r(), g(272, 432), g(272, 400), w(190), e(), g(592, 400), g(592, 432), e(), g(592, 176), g(656, 176), e(), g(816, 176), e(), g(848, 176), g(848, 432)], 'C7-4-a');

const rolesC = action('C7-4-c', '发声之后还有一个岗位', {
  objective: 'deliver', exit: p(112, 432), par: 3, walls: room([[22, [5, 6]]]),
  plates: [plate('A', 208, 432), plate('B', 272, 304), plate('C', 528, 432)], doors: [gate('RETURN', 704, 160, 'A')],
  terminals: [source(112, 176), lock(400, 176, { plate: 'B' })],
  delivery: delivery(528, 176, '三方授权的恢复申请', { authorization: 'SIGNED', plate: 'C', receivers: [{ guard: 'G1', at: p(784, 176), label: '恢复登记台' }] }),
  guards: [{ id: 'G1', route: [p(784, 176)], facing: 0, speed: 128, range: 100, hearing: 800, searchSeconds: 0.5 }],
  objectiveLabel: '签名者转守 A，B 见证签名，诱饵发声后转守 C；真人植入并等待回执',
}, '你：没有多余的自己。发声的人回来值守，签名的人去开回程门。每个人都得把下一步接上。', '恢复申请拿到了独立回执。三条回声各有职责，有人还在中途换过一次岗位。',
['B 只支持签名，A 支持守卫往返，C 支持真人植入；发声不能成为录像的终点。', '第一条可先录下尚未满足的签名动作，第二条 B 到位后就能回放成功。第三条发声后返回 C。', '录 S 取票、L 授权请求、A 留守；再录 B。第三条到 D 发声后南下守 C。真人到 D 等 C 就位再植入，返回西南等待 G1 带回回执。'],
[g(112, 176), e(), g(400, 176), e(), g(208, 176), g(208, 432), r(), g(272, 432), g(272, 304), r(), g(528, 432), g(528, 176), noise(), g(528, 432), r(), g(528, 432), g(528, 176), w(100), e(), g(528, 432), g(112, 432), w(220)], 'C7-4-b');

const future = action('C7-5-a', '离开时还要留下一条线', {
  objective: 'deliver', exit: p(112, 432), walls: room([[14, [5, 6, 12, 13]]]),
  circuits: [panel('ENTRY', 112, 432, true, '当前入口'), panel('BACK', 112, 304, false, '当前回程'), panel('CIV', 112, 176, true, '民用身份核验'), panel('ROUTE', 848, 304, true, '下一间接应线路', ['签名接力', '人工留守'])],
  doors: [{ id: 'ENTRY', x: 448, y: 384, w: 32, h: 64, power: power('ENTRY') }, { id: 'BACK', x: 448, y: 160, w: 32, h: 64, power: power('BACK') }],
  delivery: delivery(816, 176, '最终送达线路申请', { onDeposit: { power: [power('ENTRY', false), power('CIV', false)], message: '提交关闭当前入口并复位 CIV；从 BACK 回程时恢复民用核验。ROUTE 决定下一间接应方式。' } }), exitPower: [power('CIV')],
  objectiveLabel: '植入后从备用线返回、恢复 CIV，并在东侧 ROUTE 选择下一间的接应设施',
}, '联络员：这份申请会改变下一间。先看清楚两种接应方式，再离开；当前的民用核验也必须接回。', '你已经安全撤离，CIV 恢复。下一间按照留下的 ROUTE 开放，当前退路与未来入口都已安排。',
['BACK 接当前回程，ROUTE 选下一间设施；CIV 在植入后必须恢复。', '让同伙在西侧开 BACK，真人在东侧选择 ROUTE；两种选择都要带着已恢复的 CIV 撤离。', '录同伙到 BACK 等 4.5 秒再接通。真人南侧进门植入 D，到东南 ROUTE 保留人工或切到签名，再沿北侧 BACK 返回，接回西北 CIV 后撤离。'],
[g(112, 304), w(270), e(), r(), g(528, 432), g(528, 176), g(816, 176), e(), g(816, 304), g(848, 304), g(848, 176), g(112, 176), e(), g(112, 432)]);
future.outcomes = [outcome('C7-5-manual', '留下人工接应', '下一间南门需要 A、B 两人；真人解除抑制，提交后恢复 CIV。', 'ROUTE', true), outcome('C7-5-signed', '留下签名接应', '下一间北门需要一份凭据接力；真人签入、提交，再恢复 CIV。', 'ROUTE', false)];
future.alternatives = [[...future.witness.slice(0, 10), e(), ...future.witness.slice(10)]];

const after = action('C7-5-b', '两个人等在你选的门后', {
  objective: 'deliver', exit: p(848, 432), par: 2, walls: room([[14, [12, 13]]]), plates: [plate('A', 208, 176), plate('B', 336, 176)],
  doors: [{ id: 'MANUAL', x: 448, y: 384, w: 32, h: 64, plates: ['A', 'B'] }], circuits: [panel('Q', 112, 304, true, 'B 接应抑制'), panel('CIV', 656, 432, true, '民用核验支线')],
  suppressors: [{ id: 'KEEPER', x: 304, y: 128, w: 64, h: 96, power: power('Q') }],
  delivery: delivery(816, 176, '最终归还通道校验', { window: [5, 8], onDeposit: { power: [power('CIV', false)], message: '校验已提交，CIV 支线复位；撤离前在东南恢复。' } }), exitPower: [power('CIV')],
  objectiveLabel: '恢复 B，同 A 一起开人工门，在 5–8 秒提交，再接回 CIV',
}, '你：人工接应和预告一致。这里没有凭据终端，两名留守者就是入口。', '通道校验提交，CIV 已恢复。你选的接应方案已经实际接住这一轮。',
['A、B 必须同时作用，B 的抑制由真人解除。', '提交窗口在第 5 秒开始，入内后可以先到 D 等候。', '分别录 A、B；真人到 Q 解除抑制，从南门进入到 D，在窗口内植入。南下到 CIV 恢复，再到东南撤离点。'],
[g(208, 432), g(208, 176), r(), g(336, 432), g(336, 176), r(), g(112, 304), e(), g(112, 432), g(656, 432), g(656, 176), g(816, 176), w(50), e(), g(816, 432), g(656, 432), e(), g(848, 432)], 'C7-5-a');
variant(after, 'C7-5-signed', action('C7-5-b-signed', '一份凭据等在你选的门后', {
  objective: 'deliver', exit: p(848, 432), walls: room([[14, [5, 6]]]), plates: [plate('A', 208, 176)], doors: [signed(448, 160)],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 272, y: 400 }, lock(400, 176, { plate: 'A' })], circuits: [panel('CIV', 656, 432, true, '民用核验支线')],
  delivery: delivery(816, 176, '最终归还通道校验', { authorization: 'SIGNED', window: [5, 8], onDeposit: { power: [power('CIV', false)], message: '校验已提交，CIV 支线复位；撤离前在东南恢复。' } }), exitPower: [power('CIV')],
  objectiveLabel: '按预留的凭据线路签入，在 5–8 秒提交，再接回 CIV',
}, '联络员：你留下的签名线路已接通。送件者交到 R 后还能守 A，当前的你负责签入和提交。', '通道校验提交，CIV 已恢复。单份凭据的接应方案已经实际接住这一轮。',
['北侧是签名门，S、R、L 和 A 都按上一段的选择保留。', '送件兼留守，真人接收与授权；别在恢复 CIV 之前离开。', '录 S 取票、R 交票、A 留守；真人在 R 等接收，到 L 授权，经北门在 D 植入，再到东南 CIV 恢复。'],
[...courier, g(272, 432), g(272, 400), w(160), e(), g(400, 400), g(400, 176), e(), g(816, 176), e(), g(816, 432), g(656, 432), e(), g(848, 432)]));

const returnFeed = action('C7-5-c', '把回执的来路也接回去', {
  objective: 'deliver', exit: p(112, 432), par: 2, walls: room([], [[8, [24, 25]]]), plates: [plate('A', 272, 432)],
  doors: [{ id: 'RETURN', x: 768, y: 256, w: 64, h: 32, plate: 'A' }], circuits: [panel('CIV', 112, 304, true, '外部见证与民用核验')],
  delivery: delivery(784, 304, '归还线路的外部回执申请', { receivers: [{ guard: 'G1', at: p(784, 144), label: '外部核验台' }], onDeposit: { power: [power('CIV', false)], message: '提交复位 CIV，见证人暂停响应；请回西侧恢复线路，让延迟诱饵和 A 接应完成取证往返。' } }), exitPower: [power('CIV')],
  guards: [{ id: 'G1', route: [p(784, 144)], facing: -Math.PI / 2, speed: 128, range: 100, hearing: 900, searchSeconds: 0.5, power: power('CIV') }],
  objectiveLabel: '植入后接回 CIV，留下 A 为见证人开门，再让延迟诱饵完成回执链',
}, '你：关闭见证线路只会让我暂时安全，却收不到回执。我要离开，也要让后面的人能继续核验。', '归还线路取得外部回执，CIV 保持接通。现在进入最后五段：恢复名字、公开责任，再决定私人档案的去向。',
['见证人在北侧，D 在南侧；A 控制它的往返门。', '提交会暂停见证响应。晚到的声响必须发生在真人回西侧接回 CIV 以后。', '录 A 留守；再录到 D 发声后向西南离开，延迟四秒。真人先植入 D，沿南区回 CIV 接通，再回西南等见证人完成往返。'],
[g(272, 432), r(), g(784, 432), g(784, 304), noise(), g(656, 304), g(656, 432), r(), { delay: 240, echo: 1 }, g(784, 432), g(784, 304), e(), g(112, 304), e(), g(112, 432), w(250)], 'C7-5-b');

const finaleEntry = action('C7-6-a', '最后一次借来的门', {
  objective: 'reach', exit: p(848, 432), par: 2, walls: room([[10, [12, 13]], [20, [5, 6]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)],
  doors: [{ ...gate('ENTRY', 320, 384, 'A'), window: [2, 5] }, gate('INNER', 640, 160, 'B')], suppressors: [{ id: 'PULSE', x: 480, y: 384, w: 96, h: 96, cycle: { period: 6, active: [0, 3] } }],
  objectiveLabel: '入口在 2–5 秒响应，内门留守者在第 3 秒恢复；分时穿过两道门',
}, '你：最后五段。每到一处锚点，计划都能重新安排。先进入公共登记核心，再把证据交到它无法独占的地方。', '公共登记核心已经进入。旧的姓名索引和私人记忆库从这里分开，我们会分别处理。',
['A 的入口看时段，B 的内门看抑制周期。', '先用 A 把 B 送进去；真人最后穿门时不必让两道门始终同时打开。', '录 A，第二条等入口窗口后进中区守 B。真人同样穿南门，北上等 B 在第 3 秒恢复，穿内门到东侧锚点。'],
[g(208, 432), g(208, 176), r(), g(528, 432), r(), g(592, 432), g(592, 176), g(816, 176), g(848, 176), g(848, 432)]);

const restoreNames = action('C7-6-b', '把名字写回公共记录', {
  objective: 'deliver', exit: p(848, 432), par: 2, walls: room([[14, [5, 6]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)], doors: [signed(448, 160, 'ROOT')],
  terminals: [source(112, 176), { id: 'R1', kind: 'relay', x: 272, y: 400 }, lock(400, 176, { id: 'L1', authorization: 'ROOT', plate: 'A' }), { id: 'R2', kind: 'relay', x: 528, y: 304 }, lock(656, 176, { id: 'L2', authorization: 'RESTORED', plate: 'B', requiresAuthorization: 'ROOT' })],
  delivery: delivery(816, 176, '被抹除者的公共身份索引', { authorization: 'RESTORED' }),
  objectiveLabel: '两次交接串起 ROOT 与 RESTORED 签名，由真人植入公共身份索引',
}, '联络员：回声只记录动作。被贩卖的是私人档案片段；馆方删除姓名与来源索引，让受害者在公共系统里消失。恢复索引能还回身份，失去的岁月仍要由他们自己继续生活。', '公共身份索引已恢复。B-17 的姓名重新出现在登记册：沈舟。同批受害者的身份也能由各自原件与签名核验。',
['同一份凭据要依次经过 R1、L1、R2、L2；第二名送件者最后还要守 B。', '第一条交到 R1 后守 A。第二条接票签 ROOT，交到 R2 后守 B。真人最后接票签 RESTORED。', '先录 S→R1→A；再录在 R1 等接收、到 L1 授权、进门到 R2 交付、B 留守。真人等 ROOT 门开后到 R2 接件，去 L2 授权，再植入 D。'],
[...courier.map(a => a), g(272, 432), g(272, 400), w(160), e(), g(400, 400), g(400, 176), e(), g(528, 176), g(528, 304), e(), g(528, 432), r(), g(400, 432), g(400, 176), g(528, 176), g(528, 304), w(90), e(), g(656, 304), g(656, 176), e(), g(816, 176), e(), g(848, 176), g(848, 432)], 'C7-6-a');

const testify = action('C7-6-c', '让责任也署上真名', {
  objective: 'deliver', exit: p(112, 432), plates: [plate('A', 208, 432)], terminals: [source(112, 176), lock(336, 176, { authorization: 'TESTIFY', plate: 'A' })],
  delivery: delivery(496, 304, '责任清单、抹除批准书与联络员证词', { authorization: 'TESTIFY', receivers: [{ guard: 'G1', at: p(656, 304), label: '公开证据登记台' }] }),
  guards: [{ id: 'G1', route: [p(656, 304)], facing: 0, speed: 128, range: 100, hearing: 800, searchSeconds: 0.5 }],
  objectiveLabel: '签入责任证据，真人植入后引 G1 核验并登记公开回执',
}, '联络员：批准书上有我的签名，证词也写我的真名。你：它们会和其他人的责任一起公开，谁都不能再替你删掉。', '责任清单、买卖记录、抹除批准书与联络员证词已经公开并取得回执。无论最后如何处理私人记忆，核心事实都已离开馆方的单独控制。',
['授权证明证据来源，守卫回执证明它确实送达；两者都需要。', '同伙守 A，真人签名、植入、发声后离开。回执会自动在见证人返回时确认。', '录 A；真人从 S 取票，在 L 授权，再到 D 植入并发声。向南退回西南，等 G1 登记。'],
[g(208, 432), r(), g(112, 176), e(), g(336, 176), e(), g(496, 176), g(496, 304), e(), noise(), g(496, 432), g(112, 432), w(150)], 'C7-6-b');

const scope = action('C7-6-d', '剩下的记忆，由谁保管', {
  objective: 'deliver', exit: p(848, 432), walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('ENTRY', 448, 384, 'A')],
  circuits: [panel('PUBLIC', 112, 304, false, '责任证据公开线路'), panel('PRIVATE', 656, 304, true, '私人库监听'), panel('RELEASE', 848, 304, false, '最终交付范围', ['归还私人记忆', '公开完整档案'])],
  guards: [{ id: 'CAM', route: [p(688, 112)], kind: 'camera', facing: Math.PI / 2, speed: 0, range: 220, power: power('PRIVATE') }],
  delivery: delivery(656, 176, '公开证据与私人片段的隔离校验表', { power: [power('PUBLIC'), power('PRIVATE', false)] }),
  objectiveLabel: '保持责任证据公开、关闭私人库监听，植入隔离表，再选择最终交付范围',
}, '沈舟：那些记忆里有罪证，也有许多人从未同意出售的生活。事实已经公开。剩下的片段，是完整交给公众，还是连同钥匙归还各自的主人？', '隔离校验完成，责任证据仍保持公开。你选择的交付范围已经保存；最后一段将执行它，之后仍可回到这个锚点查看另一种收束。',
['PUBLIC 必须接通，PRIVATE 必须断开；RELEASE 才是最终范围选择。', '先完成隔离表，再到东侧选择。两种方式都恢复身份、公开责任证据，也都会去旧渡口。', '录 A，真人接通西侧 PUBLIC，穿南门后关闭东侧 PRIVATE，北上植入 D。到东侧 RELEASE 保留归还，或按 E 改为公开完整档案，再撤离提交。'],
[g(272, 432), g(272, 176), r(), g(112, 304), e(), g(112, 432), g(656, 432), g(656, 304), e(), g(656, 176), e(), g(848, 176), g(848, 304), g(848, 432)], 'C7-6-c');
scope.outcomes = [outcome('C7-ending-open', '公开完整档案', '最后向两个公共登记台送达完整副本，更多人可独立核查；未经同意的私人片段也会公开，无法保证收回。', 'RELEASE', true), outcome('C7-ending-return', '公开罪证，归还私人记忆', '已公开的责任证据保持可核验；最后以当事人授权归还私人封套，完整私人片段不进入公共副本。', 'RELEASE', false)];
scope.alternatives = [[...scope.witness.slice(0, 13), e(), ...scope.witness.slice(13)]];

const reunion = [
  '天亮时，你来到城外旧渡口，关掉了投影器。长椅上的沈舟抬起头，伸手接过你买的热茶。杯壁的温度传到两个人掌心。',
  '“登记册上有我的名字了？”他说。你把恢复姓名的回执放到长椅上：“以后不用临时身份了。”沈舟看了很久，把那张纸仔细折好。',
  '你们谈起失散后的日子，有些空缺谁也无法替另一个人补全。他没有要求你把过去恢复原样，只问下一班船来了，要不要一起走。',
  '码头广播报出船名。这一次，你没有留下一个自己守住原地。你与沈舟并肩走向栈桥。',
];
const publicEnding: Ending = { id: 'open-archive', title: '天亮，档案属于所有人', consequence: '完整档案已在两处公共登记台留存。公众能够独立核查买卖与抹除记录，私人片段也随之暴露。受害者重新获得身份，并开始要求公开者承担保护与纠错的责任；联络员的证词和批准书一并接受调查。', reunion: [reunion[0], reunion[1], '沈舟握着热茶，许久才开口：“我说过，那些不是证据的记忆，不该由你替我公开。”你没有辩解，答应和其他受害者一起处理公开后带来的伤害。他点点头：“先一起走。剩下的，我们还得慢慢谈。”', reunion[3]] };
const privateEnding: Ending = { id: 'return-memories', title: '天亮，记忆回到主人手里', consequence: '责任证据与独立回执继续公开，私人封套按当事人授权归还。公众可核验罪证，却不能任意读取完整私人片段。受害者重新获得身份，也重新决定谁能听见自己的过去；联络员的证词和批准书一并接受调查。', reunion };

const publicDelivery = action('C7-6-e', '让完整档案留下两份回执', {
  objective: 'deliver', exit: p(112, 432), par: 2, noiseResponse: 'all', walls: room([], [[8, [14, 15]]]), plates: [plate('A', 272, 432)], doors: [{ id: 'RETURN', x: 448, y: 256, w: 64, h: 32, plate: 'A' }],
  circuits: [panel('PUB', 112, 304, false, '公共登记接收线路')],
  delivery: delivery(496, 176, '完整档案公开副本', { plate: 'A', power: [power('PUB')], receivers: [{ guard: 'G1', at: p(656, 112), label: '第一公共登记台' }, { guard: 'G2', at: p(656, 240), label: '第二公共登记台' }] }),
  guards: [{ id: 'G1', route: [p(656, 112)], facing: 0, speed: 112, range: 100, hearing: 800, searchSeconds: 0.5, power: power('PUB') }, { id: 'G2', route: [p(656, 240)], facing: 0, speed: 112, range: 100, hearing: 800, searchSeconds: 0.5, power: power('PUB') }],
  objectiveLabel: '接通 PUB，植入完整档案；本区全员响应声响，让两个公共登记台都收到副本',
}, '你选择公开完整档案。两处公共登记台都要拿到副本，任何一处撤回，都不能独自让它消失。私人片段也在这份公开范围内。', '两份完整副本及回执已送达。责任事实和私人片段一并公开。你关掉设备，带着恢复姓名的回执前往旧渡口。',
['本区明确采用全员响应，一处声响会引来两名守卫；两份回执都必须完成。', '第一条守 A，第二条穿门到 D 发声后返回。真人先接 PUB，再植入，发声者会替你引来见证人。', '录 A；再录从南侧穿门到 D 发声、向南西撤离。真人西侧接 PUB，从门下北上植入 D，再退回西侧，等待两个登记台确认。'],
[g(272, 432), r(), g(496, 432), g(496, 176), noise(), g(496, 304), g(336, 304), g(336, 432), r(), g(112, 304), e(), g(496, 304), g(496, 176), e(), g(496, 304), g(112, 304), g(112, 432), w(150)], 'C7-6-d');
publicDelivery.ending = publicEnding;
const privateDelivery = action('C7-6-e-return', '让封套回到有权接收的人手里', {
  objective: 'deliver', exit: p(112, 432), walls: room([[14, [5, 6]]]), plates: [plate('A', 208, 176)], doors: [signed(448, 160, 'CONSENT')],
  terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 272, y: 400 }, lock(400, 176, { authorization: 'CONSENT', plate: 'A' })],
  scanners: [{ id: 'SCAN', x: 640, y: 128, w: 32, h: 96, period: 12, active: [0, 5] }], circuits: [panel('CIV', 112, 304, true, '公开身份核验')],
  delivery: delivery(816, 176, '当事人专属记忆封套', { authorization: 'CONSENT', onDeposit: { power: [power('CIV', false)], message: '封套已按当事人授权归还；接回外侧 CIV，保持公共身份与已公开罪证可核验。' } }), exitPower: [power('CIV')],
  objectiveLabel: '用唯一凭据核验当事人授权，归还私人封套，再恢复公开核验线路',
}, '你选择保留已经公开的罪证，把其余记忆连同读取权归还当事人。凭据标明接收者，私人封套不会写入公共副本。', '封套已按当事人授权归还，CIV 恢复，责任证据仍公开可核验。你关掉设备，带着恢复姓名的回执前往旧渡口。',
['一份凭据证明接收授权，真人负责归还实体封套；第五秒扫描结束。', '同伙交到 R 后守 A。真人接收、在 L 签名、等待扫描空档，再归还 D。', '录 S 取票、R 交票、A 留守。真人在 R 等接收，去 L 签名，过扫描后到 D 按 E。沿北侧回西侧，恢复 CIV，再去西南撤离点。'],
[...courier, g(272, 432), g(272, 400), w(160), e(), g(400, 400), g(400, 176), e(), g(592, 176), g(816, 176), e(), g(112, 176), g(112, 304), e(), g(112, 432)]);
privateDelivery.ending = privateEnding;
variant(publicDelivery, 'C7-ending-return', privateDelivery);

export const CHAPTER_SEVEN_FINALE: Mission[] = [
  { id: 'C7-4', chapter: '最后一个自己', title: '没有多余的自己', summary: '三个槽位在签名、送件、值守与诱饵之间轮换，让每条过去接上下一份职责。', evidence: '三方授权与被抹除身份的恢复许可', stages: [rolesA, rolesB, rolesC] },
  { id: 'C7-5', chapter: '最后一个自己', title: '给昨天留一条路', summary: '解决当前撤离，同时为下一间留下接应方式与持续可用的核验线路。', evidence: '最终归还通道与保持接通的公共核验线路', stages: [future, after, returnFeed] },
  { id: 'C7-6', chapter: '最后一个自己', title: '回声劫案', summary: '五段最后的行动：进入核心、恢复名字、公开责任、决定范围、完成交付。然后去见一直在等的人。', evidence: '恢复的公共身份、公开的责任证据与最终送达回执', stages: [finaleEntry, restoreNames, testify, scope, publicDelivery], endingAnchor: 3 },
];
