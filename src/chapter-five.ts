import type { Mission, Stage, WitnessAction } from './campaign-content.ts';
import type { Circuit, GuardDefinition, Level, Suppressor, Terminal } from './levels.ts';
import { g, w, r, e, noise, point as p, room, level, stage, gate, plate } from './campaign-authoring.ts';

const panel = (id: string, x: number, y: number, initial = true, label = '设施电源'): Circuit => ({ id, x, y, initial, label });
const field = (id: string, x: number, y: number, width: number, height: number, extra: Partial<Suppressor> = {}): Suppressor => ({ id, x, y, w: width, h: height, ...extra });
const cycle = (period: number, start: number, end: number) => ({ period, active: [start, end] as [number, number] });
const power = (id: string, on = true) => ({ id, on });
const tracker = (extra: Partial<GuardDefinition> = {}): GuardDefinition => ({ id: 'TR', kind: 'tracker', route: [p(784, 432), p(560, 432)], speed: 80, range: 300, hearing: 800, searchSeconds: 1.2, traceSeconds: 1.5, ...extra });
const camera = (id: string, x: number, y: number, facing: number, range: number, circuit: string, on = true): GuardDefinition => ({ id, kind: 'camera', route: [p(x, y)], facing, range, speed: 0, power: power(circuit, on) });
const source = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'S', kind: 'source', x, y, ...extra });
const relay = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'R', kind: 'relay', x, y, ...extra });
const lock = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'L', kind: 'lock', x, y, authorization: 'L', ...extra });
const authorized = (x = 640, y = 256) => ({ id: 'PASS', x, y, w: 32, h: 64, authorization: 'L' });
const east = { loot: p(816, 176), exit: p(848, 432) };
const recordA = [g(272, 432), g(272, 176), r()];
const serialPlan = [g(208, 432), g(208, 176), r(), e(), g(400, 432), g(528, 432), r()];
const decoy = [g(112, 176), g(656, 176), noise(), g(848, 176), g(848, 80), r()];
const cargoRoute = [g(400, 432), w(180), g(816, 432), g(400, 432), g(112, 432)];
function action(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: WitnessAction[], previous?: string): Stage {
  const map = level(id, title, { subtitle: 'WHO IS HUNTING YOUR ECHO?', district: '转存设施 / RETENTION WING', theme: 'audit', noiseResponse: 'nearest', ...props, hint: hints[2], hints });
  const s = stage(map, story, result, [id + '-clear'], witness, previous ? previous + '-clear' : undefined);
  s.level.briefing = [map.objectiveLabel ?? '观察抑制与安保，分配真人和回声的职责。'];
  return s;
}

export const CHAPTER_FIVE: Mission[] = [
  { id: 'C5-1', chapter: '专门抓鬼的人', title: '消失的一秒', summary: '抑制不暂停录像。先观察轮廓继续移动，再利用它恢复作用的那一刻。', evidence: '转存区投影抑制规程', stages: [
    action('C5-1-a', '时钟没有跟着消失', { objective: 'reach', exit: p(816, 304), walls: room([[14, [8, 9]]]), plates: [plate('A', 272, 304)], doors: [gate('A', 448, 256)], suppressors: [field('N', 224, 256, 128, 112, { cycle: cycle(4, 1, 2) })], objectiveLabel: '安排回声守 A，利用每轮抑制停止后的空档通过' },
      '联络员：货单上的设施就是这里。紫色区域每四秒启动一次，第 1–2 秒抑制投影。回声仍在原位，只是暂时压不动开关。', '抑制结束后，回声仍在录像的终点。没有消失的一秒，只有失效的一秒。',
      ['N 的公开周期和回声轮廓都可以预演。', '真人能在 N 中踩 A；录成回声后，A 会在抑制结束时恢复。', '到 A 停下录制。真人到门前稍等，第二秒以后通过，不必重录失效的那一秒。'],
      [g(272, 432), g(272, 304), r(), g(400, 432), g(400, 304), w(35), g(528, 304), g(816, 304)]),
    action('C5-1-b', '错过的按键不会补发', { loot: p(816, 176), exit: p(848, 304), walls: room([[20, [8, 9]]]), plates: [plate('A', 112, 304)], doors: [authorized()], terminals: [source(272, 304), lock(528, 176, { plate: 'A' })], suppressors: [field('N', 224, 256, 96, 96, { cycle: cycle(6, 0, 3) })], objectiveLabel: '把取凭据动作移到抑制空档，真人守 A 允许回声授权', lootLabel: '抑制规程' },
      '你：身体走出来了，刚才没按下去的 E 却不会重新发生。我得把动作安排在能生效的时候。', '调整出场后，同一条录像在空档接到了凭据。这套设备会切断作用，不会改写过去。',
      ['S 在 N 内，前 3 秒的投影接收会失效。', '录下 S 接收、L 授权，整体延后 3 秒；真人同时守 A。', '先去 S 按 E，再去 L 按 E 并录制，出场设为 3.00s。真人去 A 等到约第 6.3 秒，授权成功后经中门取件，去右侧出口。'],
      [g(272, 432), g(272, 304), e(), g(528, 304), g(528, 176), e(), r(), { delay: 180, echo: 0 }, g(112, 304), w(345), g(560, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 304)], 'C5-1-a'),
  ] },
  { id: 'C5-2', chapter: '专门抓鬼的人', title: '过去走得过去', summary: '能走过去，不代表还能在那里工作。有些岗位必须留给真人。', evidence: '维护通道的人工接管权限', stages: [
    action('C5-2-a', '这一次由你留下', { ...east, walls: room([[20, [8, 9]]]), plates: [plate('A', 272, 176)], doors: [authorized()], terminals: [source(112, 304, { plate: 'A' }), lock(528, 176)], suppressors: [field('N', 224, 128, 96, 96)], lootLabel: '人工接管凭条', objectiveLabel: '真人在常开抑制区守 A，回声接收 S 并完成 L 授权' },
      '联络员：A 在常开抑制场里。把回声留在那里没有用，今天得由你替过去的自己守一次岗位。', '你留下，信使前进。人工接管权限没有把“人”与“投影”混为一谈。',
      ['S 接收时需要 A；A 中的真人有效，回声无效。', '回声先去 S 等你就位，再接收、去 L；真人在 A 守到它取件。', '录 S 等约 1.7 秒、按 E，再去 L 按 E 的路线。真人到 A 等约 3 秒，再绕中央门取件撤离。'],
      [g(112, 304), w(100), e(), g(528, 304), g(528, 176), e(), r(), g(272, 432), g(272, 176), w(180), g(560, 176), g(560, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 432)]),
    action('C5-2-b', '只有手动面板还有效', { ...east, walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('ENTRY', 448, 384, 'A')], circuits: [panel('N', 112, 304, true, '远端抑制场')], suppressors: [field('N', 224, 128, 96, 96, { power: power('N') }), field('MANUAL', 64, 256, 96, 96)], lootLabel: '手动面板说明' },
      '你：面板自己也被另一片场覆盖。录下去关电的回声会失效，我本人过去却仍能操作。', '手动维护口是真人的入口。它原本为维修人员保留，现在也为你的同伙保留。',
      ['A 受可断电的 N 覆盖；面板受常开的 MANUAL 覆盖。', '回声去 A 留守，真人去 N 面板关闭远端场。', '录一条到 A 停下的回声。真人沿西侧到 N 按 E，再回下方穿 ENTRY，沿东侧取件撤离。'],
      [...recordA, g(112, 304), e(), g(112, 432), g(816, 432), g(816, 176), g(848, 176), g(848, 432)], 'C5-2-a'),
    action('C5-2-c', '最后一个签名留给你', { ...east, walls: room([[22, [8, 9]]]), plates: [plate('A', 208, 176)], doors: [authorized(704)], terminals: [source(112, 144), relay(272, 400, { waitForDelivery: true }), lock(592, 176, { plate: 'A' })], suppressors: [field('N', 544, 128, 96, 96)], lootLabel: '接管权限原件' },
      '联络员：L 被永久覆盖，回声拿着凭据也不能签。让它送件、留守，你去完成最后的授权。', '凭据沿着旧路线来到你手里，最后一次签名由真人补上。',
      ['L 只接受能生效的持有人，N 内的真人仍可操作。', '回声取 S，交到 R 后守 A；真人在 R 接收，然后亲自进入 N 授权。', '录 S → R 交付 → 左上 A 留守。真人在 R 按 E 等 3 秒接收，去 L 按 E，再从中央门取件。'],
      [g(112, 144), e(), g(112, 400), g(272, 400), e(), g(208, 400), g(208, 176), r(), g(272, 432), g(272, 400), e(), w(180), g(592, 400), g(592, 176), e(), g(656, 176), g(656, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 432)], 'C5-2-b'),
  ] },
  { id: 'C5-3', chapter: '专门抓鬼的人', title: '给幽灵留条路', summary: '关闭一片场可能唤醒另一套安保。把供电调整排进同伙的行动顺序。', evidence: '抑制网络与安保共用的分流表', stages: [
    action('C5-3-a', '门开之后，把场接回去', { loot: p(816, 432), exit: p(848, 464), par: 2, walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('ENTRY', 448, 384, 'A')], circuits: [panel('P', 272, 432, true, '抑制 / 监控分流')], suppressors: [field('N', 224, 128, 96, 96, { power: power('P') })], guards: [camera('CAM', 736, 432, Math.PI, 200, 'P', false)], lootLabel: '共用分流表' },
      '联络员：断开 P，会释放守门的回声，也会启动走廊镜头。你进门以后，同伙再接回 P，让镜头停下。', '回声再次失效时，你已经过了门。失效也能成为计划的一部分。',
      ['P 接通抑制、断开监控；断开时两者交换。', '第一名守 A，第二名控制 P 的短暂断开，真人利用这段时间进入。', '先录 A 留守。再录到 P 断开、等约 1.9 秒、接通。真人沿下方前进，进入后等镜头停机再取件。'],
      [...recordA, g(272, 432), e(), w(115), e(), r(), g(816, 432), g(848, 464)]),
    action('C5-3-b', '还有另一层网', { ...east, walls: room([[14, [8, 9]]]), plates: [plate('A', 272, 176)], doors: [{ ...gate('ENTRY', 448, 256, 'A'), window: [2, 4] }], circuits: [panel('P', 112, 304, true, '固定抑制层')], suppressors: [field('N1', 224, 128, 96, 96, { power: power('P') }), field('N2', 256, 144, 112, 112, { cycle: cycle(4, 0, 2) })], lootLabel: '重叠覆盖图' },
      '你：P 已经断开，回声却还没恢复。A 上方有两层网，另一层正按周期运行。', '两层边界分别标在图上。关掉一条线，不等于这个位置已经安全。',
      ['A 同时处于 N1 与 N2；任意一层开启都让投影失效。', '真人断 P 处理 N1，再等 N2 的 2–4 秒空档。', '录 A 留守。真人去 P 断开，再到中央门前等待；在第 2–4 秒通过后沿东侧取件。'],
      [...recordA, g(112, 304), e(), g(400, 304), w(40), g(816, 304), g(816, 176), g(848, 176), g(848, 432)], 'C5-3-a'),
    action('C5-3-c', '没有同时亮起的同伙', { ...east, par: 3, walls: room([[10, [12, 13]], [20, [8, 9]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)], doors: [gate('ENTRY', 320, 384, 'A'), gate('INNER', 640, 256, 'B')], circuits: [panel('Q', 112, 432, true, '两区抑制分流')], suppressors: [field('N1', 160, 128, 96, 96, { power: power('Q') }), field('N2', 480, 384, 96, 96, { power: power('Q', false) })], lootLabel: '分流控制原件', objectiveLabel: '先让 A 生效通过外门，再让 B 生效通过内门' },
      '联络员：Q 的两侧不能同时停机。先让第一名同伙开门，再让第二名接班，控制分流的人最后才录。', '三段录像在不同时间起作用。你不需要所有同伙一直有效。',
      ['Q 断开时 A 有效，接通时 B 有效。', '先录 A，再亲自断 Q 进入录 B，最后录一条先断、后接的控制录像。', '第一条停 A。第二条出生处断 Q，经下门停 B。第三条出生处断 Q，等 3.5 秒再接通。真人先走下门，到中区中央等 B 恢复后穿内门取件。'],
      [...serialPlan, e(), w(210), e(), r(), g(560, 432), g(560, 304), w(110), g(816, 304), g(816, 176), g(848, 176), g(848, 432)], 'C5-3-b'),
  ] },
  { id: 'C5-4', chapter: '专门抓鬼的人', title: '被盯上的搭档', summary: '追踪器只识别投影，会追向最后看见的位置；路线、声响响应和记忆时间都可预演。', evidence: '审计员部署的投影追踪记录', stages: [
    action('C5-4-a', '它在看另一个你', { objective: 'reach', exit: p(784, 432), walls: room([[14, [12, 13]]]), plates: [plate('A', 400, 432)], doors: [gate('ENTRY', 448, 384, 'A')], guards: [tracker()], objectiveLabel: '让回声错开追踪器的巡逻朝向，再通过它面前' },
      '联络员：菱形的 TR 只识别投影。你录制时可以从它眼前走过，回放时同样的位置却会被盯上。先预演一次。', '你从机器眼前经过。它寻找的，是身后那个过去的你。',
      ['TR 的虚线路线与视野公开；它不识别真人，但会被声响吸引。', '回声到 A 太早会被追踪。等 TR 向右巡逻时再让它出现。', '录一条直接到 A 停下的回声，预演查看追踪失败，再把出场设为 3.00s。真人在 A 附近等到回声就位后向右抵达锚点。'],
      [g(400, 432), r(), { delay: 180, echo: 0 }, g(400, 432), w(180), g(784, 432)]),
    action('C5-4-b', '让追踪器去查一声响', { loot: p(816, 432), exit: p(112, 432), par: 2, walls: room([[14, [4, 5, 12, 13]]], [], [[19, 7], [20, 7], [21, 7], [22, 7], [24, 2], [24, 3], [24, 4]]), plates: [plate('A', 400, 432)], doors: [gate('ENTRY', 448, 384, 'A'), { id: 'SERVICE', x: 448, y: 128, w: 32, h: 64, window: [0, 3] }], guards: [tracker()], soundMarkers: [{ id: 'N1', x: 656, y: 176 }], lootLabel: '声响响应记录', objectiveLabel: '上方同伙引开追踪器，下方同伙留守回程门，真人取件返回' },
      '你：只错开第一次经过还不够。回来时它会再次面向留守者。让另一名同伙给它安排一次北侧调查。', 'TR 离开原路线，转向同伙留下的响点。听见声音，会让它放弃旧的投影线索。',
      ['上方入口只开 0–3 秒；下门需要 A，原件要带回左侧。', '第一名从上门到 N1 发声后向右上退开，第二名延迟守 A。', '先录经北门到 N1 发声、再去右上角待命的回声。第二条停 A，出场设为 3.00s。真人在下门等它就位，沿下方取件后原路返回。'],
      [...decoy, g(400, 432), r(), { delay: 180, echo: 1 }, ...cargoRoute], 'C5-4-a'),
    action('C5-4-c', '给内侧的人一段空档', { ...east, par: 2, walls: room([[14, [12, 13]]]), plates: [plate('A', 400, 432)], doors: [gate('ENTRY', 448, 384, 'A')], circuits: [panel('T', 112, 176, true, '追踪器与内侧抑制'), panel('Q', 528, 432, true, '北侧镜头')], suppressors: [field('MANUAL', 64, 128, 96, 96), field('N', 480, 384, 96, 96, { power: power('T') })], guards: [tracker({ power: power('T') }), camera('CAM', 816, 176, Math.PI, 300, 'Q')], lootLabel: '部署记录' },
      '联络员：T 的维护口只能由你操作。停掉它既能让留守者免于追踪，也会释放内侧 Q，允许第二名同伙去关镜头。', '入口、内侧面板和北侧镜头分开停了下来。追踪器的部署命令来自馆长办公室。',
      ['T 停止 TR 与 N，Q 停止 CAM；MANUAL 永久覆盖 T 面板。', '第一名守 A。录第二条时你亲自断 T，进入去断 Q。最后一轮仍由你断 T。', '先录 A。第二次沿左侧北上断 T，回下门进入，在 Q 按 E 后录制。最后真人再次先断 T，经下门进入，从中区北上取件。'],
      [g(400, 432), r(), g(112, 176), e(), g(112, 432), g(528, 432), e(), r(), g(112, 176), e(), g(112, 432), g(560, 432), g(560, 176), g(816, 176), g(848, 176), g(848, 432)], 'C5-4-b'),
  ] },
  { id: 'C5-5', chapter: '专门抓鬼的人', title: '带着密钥消失', summary: '失效的投影仍持有那一份凭据。判断什么时候该等，什么时候必须重新请求。', evidence: '被中止的转存确认与抹除倒计时', stages: [
    action('C5-5-a', '带出去的仍是同一份', { ...east, walls: room([[22, [8, 9]]]), plates: [plate('A', 528, 464)], doors: [authorized(704)], terminals: [source(112, 176), relay(528, 304, { waitForDelivery: true }), lock(592, 176, { plate: 'A' })], suppressors: [field('N', 256, 128, 160, 128)], lootLabel: '转存确认副页' },
      '你：金色标记跟着失效的轮廓走，没有掉在地上。只要把交付留到场外，它就还能把那份东西交给我。', '转存确认没有第二份副本。抑制期间，编号仍归同一个持有人。',
      ['S 在场外，横向路线穿过 N，R 在下方场外。', '送件回声带凭据穿过场，再到 R 交付、南下守 A。真人在 R 留候并完成 L 授权。', '录 S → 沿北侧走到 x528 → 向南到 R 交付 → A 留守。真人到 R 按 E 等 3 秒，去 L 授权后穿门取件。'],
      [g(112, 176), e(), g(528, 176), g(528, 304), e(), g(528, 464), r(), g(528, 432), g(528, 304), e(), w(180), g(592, 304), g(592, 176), e(), g(656, 176), g(656, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 432)]),
    action('C5-5-b', '不要在失效时松手', { ...east, walls: room([[22, [8, 9]]]), plates: [plate('A', 528, 464)], doors: [authorized(704)], terminals: [source(112, 176), relay(528, 304, { waitForDelivery: true, window: [6, 7] }), lock(592, 176, { plate: 'A' })], suppressors: [field('N', 480, 256, 96, 96, { cycle: cycle(6, 2, 5) })], lootLabel: '被中止的确认单' },
      '联络员：上次能交付的位置，这次也被覆盖了。凭据不会丢，但那一下松手会落空；必须把交付移到终端和抑制都允许的时刻。', '回声把一直握着的凭据交了出来。确认单注明，馆方已启动抹除程序。',
      ['R 在 6–7 秒开放；N 每六秒抑制第 2–5 秒。', '沿用上段送件录像，整体延后 2.5 秒，让交付落在两种条件的交集。', '录 S → 北侧到 R 按 E → A 留守，出场设为 2.50s。真人在 R 按 E，等约 4 秒接收，再到 L 授权取件。'],
      [g(112, 176), e(), g(528, 176), g(528, 304), e(), g(528, 464), r(), { delay: 150, echo: 0 }, g(528, 432), g(528, 304), e(), w(240), g(592, 304), g(592, 176), e(), g(656, 176), g(656, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 432)], 'C5-5-a'),
    action('C5-5-c', '重新伸一次手', { loot: p(816, 176), exit: p(848, 304), walls: room([[20, [8, 9]]]), plates: [plate('A', 112, 304)], doors: [authorized()], terminals: [source(112, 144), relay(304, 400, { waitForDelivery: true }), lock(528, 176, { plate: 'A' })], suppressors: [field('N', 256, 352, 96, 96, { cycle: cycle(6, 2, 4) })], lootLabel: '抹除倒计时记录' },
      '你：它原本在等，进入抑制后等候被取消了。恢复时不会替我再问一次，我要在录像里补上新的接收请求。', '新的请求接住了迟来的凭据。抹除目标中除了 B-17，还列着整批未经确认的转存对象。',
      ['R 的早期等候会在第 2 秒被取消；真人仍能在第 3 秒左右送件。', '回声第一次请求后原地等，在第 4 秒以后再次按 E，再去 L。', '回声到 R 按 E、等约 3.3 秒、再次按 E，再去 L 授权并录制。真人取 S 送到 R，回西侧 A 守到约第 7 秒，再通过中央门取件。'],
      [g(304, 432), g(304, 400), e(), w(200), e(), g(528, 400), g(528, 176), e(), r(), g(112, 144), e(), g(112, 400), g(304, 400), e(), g(112, 400), g(112, 304), w(130), g(560, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 304)], 'C5-5-b'),
  ] },
  { id: 'C5-6', chapter: '专门抓鬼的人', title: '审计员巡夜', summary: '拆开感知、供电与抑制网络，在证据被抹去前带走原件。联络员的签名，也在其中。', evidence: '抹除批准书原件与 B-17 的转存坐标', stages: [
    action('C5-6-a', '先拆掉它的眼睛', { ...east, par: 2, walls: room([[14, [12, 13]], [22, [5, 6]]]), plates: [plate('A', 272, 176), plate('B', 656, 432)], doors: [gate('ENTRY', 448, 384, 'A'), gate('INNER', 704, 160, 'B')], circuits: [panel('N', 112, 304, true, '外侧抑制'), panel('T', 528, 432, true, '追踪器')], suppressors: [field('N', 224, 128, 96, 96, { power: power('N') }), field('MANUAL1', 64, 256, 96, 96), field('MANUAL2', 480, 384, 96, 96)], guards: [tracker({ route: [p(784, 432), p(592, 432)], power: power('T') })], lootLabel: '感知部署原件' },
      '联络员：审计员已经启动清理。两处维护口只认真人：先释放外侧同伙，再在第二名被看见以前切断追踪器。', '感知部署被拆开了。抹除任务仍在独立供电，不能只让机器暂时看不见。',
      ['N 释放 A；T 在外门内，必须赶在 B 留守者暴露前关闭。', '第一名守 A。录第二名时亲自断 N、断 T，再让它停在 B；最终真人重复两处手动操作。', '先录 A。第二次断左侧 N，经下门到 T 断电，再向东停 B。最终真人先断 N、进门断 T，再沿中区北上，经 B 门取件。'],
      [...recordA, g(112, 304), e(), g(112, 432), g(528, 432), e(), g(656, 432), r(), g(112, 304), e(), g(112, 432), g(528, 432), e(), g(656, 432), g(656, 176), g(816, 176), g(848, 176), g(848, 432)]),
    action('C5-6-b', '先停追踪，再恢复同伙', { ...east, par: 3, walls: room([[10, [12, 13]], [20, [8, 9]]]), plates: [plate('A', 208, 176), plate('B', 528, 432)], doors: [gate('ENTRY', 320, 384, 'A'), gate('INNER', 640, 256, 'B')], circuits: [panel('Q', 112, 432, true, '两区抑制分流'), panel('T', 560, 304, true, '内侧追踪器')], suppressors: [field('N1', 160, 128, 96, 96, { power: power('Q') }), field('N2', 352, 384, 224, 96, { power: power('Q', false) })], guards: [tracker({ route: [p(592, 432)], facing: Math.PI, power: power('T') })], lootLabel: '抹除供电图', objectiveLabel: '先穿外门切断 T，再让控制回声把 Q 切回去恢复 B' },
      '你：B 现在失效，反而没被看到。先停掉 T，再给它恢复作用，顺序不能反过来。', '分流切换发生时，追踪器已经断电。抹除供电图暴露了存放批准书的位置。',
      ['Q 断开使 A 有效、B 受抑制；Q 接通时交换。T 能看见恢复后的 B。', '沿用三名同伙的接班计划，把接回 Q 留到第 4 秒之后，真人先在中区断 T。', '先录 A，再亲自断 Q 进门录 B。第三条断 Q、等约 4.2 秒后接通。真人经下门进入中区，去 T 断开，再等内门开放取件。'],
      [...serialPlan, e(), w(250), e(), r(), g(560, 432), g(560, 304), e(), w(100), g(816, 304), g(816, 176), g(848, 176), g(848, 432)], 'C5-6-a'),
    action('C5-6-c', '取件之后，别急着唤醒他们', { loot: p(816, 432), exit: p(112, 432), par: 2, walls: room([[14, [8, 9]], [22, [12, 13]]]), plates: [plate('A', 272, 176), plate('B', 592, 176)], doors: [gate('ENTRY', 448, 256, 'A'), gate('INNER', 704, 384, 'B')], circuits: [panel('T', 848, 464, false, '追踪器'), panel('N', 848, 240, false, '双区抑制')], suppressors: [field('N1', 224, 128, 96, 96, { power: power('N') }), field('N2', 544, 128, 96, 96, { power: power('N') })], guards: [tracker({ route: [p(688, 176)], facing: Math.PI, power: power('T') })], onLoot: { power: [power('N'), power('T')], message: '取件启动 N 与 T：同伙失效、回程门关闭。先断 T，再断 N，恢复同伙后带原件返回。' }, exitPower: [power('N', false), power('T', false)], lootLabel: '抹除程序备份' },
      '联络员：提取会唤醒 T，也会抑制两名留守者。趁他们还不可见，先停 T，再恢复 N 两端。……这套取件程序，我认识。', '你：你不只是认识程序。备份里的签字人，是你。',
      ['取件后两门会关闭；失效的回声暂时也不会被追踪器识别。', '先安排 A、B 留守，再取件。取件后先关旁边 T，再北上关 N，避免恢复 B 时被追踪。', '第一条守 A，第二条穿中央外门去 B。真人同路入内，改从南侧内门取件；在右下 T 断电，再去右中 N 断电。沿南侧内门、中央外门返回左下入口。'],
      [...recordA, g(400, 432), g(400, 304), g(592, 304), g(592, 176), r(), g(400, 432), g(400, 304), g(592, 304), g(592, 432), g(816, 432), g(848, 432), g(848, 464), e(), g(848, 240), e(), g(848, 432), g(656, 432), g(656, 304), g(400, 304), g(112, 304), g(112, 432)], 'C5-6-b'),
    {
      ...action('C5-6-d', '把签名也带出去', { loot: p(816, 432), exit: p(112, 432), par: 2, walls: room([[14, [4, 5, 12, 13]]], [], [[19, 7], [20, 7], [21, 7], [22, 7], [24, 2], [24, 3], [24, 4]]), plates: [plate('A', 400, 432)], doors: [gate('ENTRY', 448, 384, 'A'), { id: 'SERVICE', x: 448, y: 128, w: 32, h: 64, window: [0, 3] }], circuits: [panel('N', 112, 432, true, '下门留守区抑制'), panel('T', 208, 176, true, '追踪器')], suppressors: [field('N', 352, 384, 96, 96, { power: power('N') })], guards: [tracker({ power: power('T') })], soundMarkers: [{ id: 'N1', x: 656, y: 176 }], exitPower: [power('N', false)], lootLabel: '批准书原件', objectiveLabel: '释放 A 并保住留守者；可用北侧声响诱导 TR，或由真人先断 T，再断 N' },
        '联络员：我签过同类抹除命令。我说服自己那只是错误记录。你：这一次先跟我救出证据，包括你的签名。等找到 B-17，我们再谈。', '批准书和转存坐标安全离开。馆方的抹除程序被留下了无法否认的原件。你继续与联络员合作，但已经不会只听他的解释。B-17 的下一处坐标，就在内库深处。',
        ['N 控制留守者能否生效，T 控制追踪器；两条路线都要从下门带原件回来。', '诱导方案用北侧发声回声加延迟守 A，真人断 N。停机方案只录 A，真人先北上断 T，再回入口断 N。', '诱导：录经 0–3 秒北门到 N1 发声、退到右上角；再录 A，延迟 3.00s。真人出生处断 N，等 A 就位，沿下方取件返回。停机：只录 A；真人经左侧去 T 断电，再回出生处断 N，穿下门取件返回。'],
        [...decoy, g(400, 432), r(), { delay: 180, echo: 1 }, e(), ...cargoRoute], 'C5-6-c'),
      alternatives: [[g(400, 432), r(), g(208, 432), g(208, 176), e(), g(112, 176), g(112, 432), e(), g(400, 432), g(816, 432), g(400, 432), g(112, 432)]],
    },
  ] },
];
