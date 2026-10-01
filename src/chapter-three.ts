import { LAST_LIGHT } from './last-light.ts';
import type { Mission, Stage, WitnessAction } from './campaign-content.ts';
import type { Circuit, Door, GuardDefinition, Level, Power } from './levels.ts';
import { g, w, r, e, noise, point as p, room, level, stage, plate } from './campaign-authoring.ts';

const power = (id: string, on: boolean): Power => ({ id, on });
const panel = (id: string, x: number, y: number, initial: boolean, label = '分流器', states?: [string, string]): Circuit => ({ id, x, y, initial, label, states });
const door = (id: string, x: number, y: number, circuit: string, on: boolean, extra: Partial<Door> = {}): Door => ({ id, x, y, w: 32, h: 64, power: power(circuit, on), ...extra });
const camera = (id: string, x: number, y: number, facing: number, range: number, circuit: string): GuardDefinition => ({ id, route: [p(x, y)], kind: 'camera', facing, range, speed: 0, power: power(circuit, true) });
const litGuard = (x: number, y: number, facing: number, range: number, circuit: string, on: boolean, darkRange = 96): GuardDefinition => ({ id: 'A', route: [p(x, y)], facing, range, speed: 100, hearing: 550, searchSeconds: 0.8, lighting: { ...power(circuit, on), darkRange } });
const reach = { objective: 'reach' as const, exit: p(816, 432), objectiveLabel: '调整供电，抵达东侧安全锚点' };
function action(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: WitnessAction[], previous?: string): Stage {
  const map = level(id, title, { subtitle: 'EVERY LIGHT HAS A COST', district: '配电站 / MUNICIPAL GRID', theme: 'industrial', noiseResponse: 'nearest', ...props, hint: hints[2], hints });
  const s = stage(map, story, result, [id + '-clear'], witness, previous ? previous + '-clear' : undefined);
  s.level.briefing = [map.objectiveLabel ?? '观察电路连接，再安排这一段行动。'];
  return s;
}

export const CHAPTER_THREE: Mission[] = [
  { id: 'C3-1', chapter: '停电之夜', title: '借一盏灯', summary: '分流器有两种明确状态：电流去门禁，就不能同时去照明。', evidence: '档案库与市政服务共用的电网图', stages: [
    action('C3-1-a', '把电流借给门', { ...reach, par: 0, walls: room([[14, [8, 9]]]), circuits: [panel('S', 272, 304, false, '照明 / 门禁分流', ['照明', '门禁'])], doors: [door('ENTRY', 448, 256, 'S', true)], guards: [litGuard(656, 304, Math.PI, 420, 'S', false, 72)] },
      '联络员：转运单上的线路就在这里。S 不是万能的总开关：拨向门禁，巡逻区就失去照明。到面板旁按 E。', '门打开时，安保视野也缩短了。图纸另一端标着居民楼与泵站。',
      ['S 的两条线分别通往门和照明。', '把 S 从照明拨向门禁，入口会打开，守卫仍在岗但只能看近处。', '沿西侧到 S 按 E，经中央门后先向南绕开守卫，再向东到锚点。'],
      [g(112, 304), g(272, 304), e(), g(528, 304), g(528, 432), g(816, 432)]),
    action('C3-1-b', '应急门不吃同一口电', { loot: p(816, 176), exit: p(848, 432), par: 0, lootLabel: '共用电网图', objectiveLabel: '将 S 切到应急通道，取走电网图', walls: room([[14, [5, 6]]]), circuits: [panel('S', 272, 432, true, '照明 / 应急门分流', ['应急通道', '照明'])], doors: [door('SAFE', 448, 160, 'S', false)], guards: [litGuard(656, 176, Math.PI / 2, 330, 'S', true, 72)] },
      '你：上一扇门在亮起时打开，这扇却相反。我得看接线，不能只记住按钮按几次。', '民用线路没有独立电源。档案系统把整片街区接在了同一台设备上。',
      ['SAFE 接在 S 的应急状态。', '先把 S 从照明切向应急通道，北侧入口才会放行。', '在西南 S 按 E，沿隔墙西侧北行，经北侧门取图，再从东侧撤离。'],
      [g(272, 432), e(), g(400, 432), g(400, 176), g(816, 176), g(848, 432)], 'C3-1-a'),
  ] },
  { id: 'C3-2', chapter: '停电之夜', title: '亮着才危险', summary: '开门的电流也会启动摄像头。过去的自己负责开关，现在的自己穿过通道。', evidence: '入口与监控共用的联动规程', stages: [
    action('C3-2-a', '开门之后，再关一次', { loot: p(816, 432), exit: p(848, 464), lootLabel: '监控规程', walls: room([[14, [12, 13]]], [[10, []], [15, []]]), circuits: [panel('P', 272, 432, false, '入口与监控')], doors: [door('ENTRY', 448, 384, 'P', true)], guards: [camera('CAM', 688, 432, Math.PI, 200, 'P')], objectiveLabel: '穿过通电入口，再让同伙关掉同一线路上的摄像头' },
      '联络员：通电会开门，也会让镜头醒来。门后的人走过去，面板前的人留下。', '摄像头停下时，入口也关闭了。你已经在门的正确一侧。',
      ['P 同时控制 ENTRY 和 CAM。', '录下接通、稍等、断开的动作。真人利用短暂开门进入，再继续向东。', '同伙在 P 接通后等约 1.3 秒，再断开并录制。真人沿南侧通道向东取件、撤离。'],
      [g(272, 432), e(), w(76), e(), r(), g(816, 432), g(848, 464)]),
    action('C3-2-b', '给回程留一次亮灯', { loot: p(816, 176), exit: p(112, 432), lootLabel: '联动时序表', walls: room([[14, [5, 6, 12, 13]]]), circuits: [panel('P', 272, 432, false, '两门与监控')], doors: [door('ENTRY', 448, 160, 'P', true), door('RETURN', 448, 384, 'P', true)], guards: [camera('CAM', 784, 176, Math.PI, 350, 'P')], objectiveLabel: '开北门进入、停机取件，再开南门返回出生处' },
      '你：不能永远停电。回来的门也在这条线上；最后一次接通，要等我离开镜头。', '回程窗口被留在录像后半段。供电顺序比一次停电更有用。',
      ['两扇门都接 P，但镜头只覆盖北侧取件走廊。', '北门进，南门回；在真人取件时停机，回到南侧之后再接通。', '同伙在 P 接通，约第 3 秒断开，第 6.1 秒再接通。真人先沿西墙北上，赶在停机前通过北门，停机后取件，再走南门回到西南出口。'],
      [g(272, 432), e(), w(133), e(), w(187), e(), r(), g(112, 176), g(400, 176), g(528, 176), g(816, 176), g(816, 432), g(400, 432), g(112, 432)], 'C3-2-a'),
  ] },
  { id: 'C3-3', chapter: '停电之夜', title: '没有免费的黑暗', summary: '熄灯会关掉安全门；守卫听觉还在，也能在近处发现你。', evidence: '电网中的民用支路标记', stages: [
    action('C3-3-a', '黑暗里的绕行', { loot: p(816, 176), exit: p(848, 464), par: 0, lootLabel: '支路标记', walls: room([[14, [8, 9, 14, 15]]]), circuits: [panel('L', 112, 432, true, '照明与中央门')], doors: [door('SHORT', 448, 256, 'L', true)], guards: [litGuard(720, 304, 2.3, 420, 'L', true, 112)], objectiveLabel: '熄灯后中央门失效，利用南侧检修口绕行' },
      '联络员：黑暗会缩短巡逻者的视野，也会锁住中央安全门。先找好停电后的路。', '南侧检修口不依赖电力。电网图上，类似的通道都留有手动接管方案。',
      ['南侧开口没有接线。', '关闭 L 后不要再挤中央门；从最南侧绕到东区。', '出生处按 E，沿南侧检修口去东区，再从最东侧取件、撤离。别从守卫身边擦过。'],
      [e(), g(112, 464), g(816, 464), g(816, 176), g(848, 464)]),
    action('C3-3-b', '让另一扇门接班', { loot: p(816, 176), exit: p(112, 432), par: 0, lootLabel: '手动接管方案', walls: room([[14, [5, 6, 12, 13]]]), circuits: [panel('L', 272, 432, true, '照明 / 应急分流', ['应急通道', '照明'])], doors: [door('NORTH', 448, 160, 'L', true), door('SOUTH', 448, 384, 'L', false)], guards: [litGuard(624, 176, Math.PI / 2, 420, 'L', true, 160)], lootPower: [power('L', false)], objectiveLabel: '停照明才能释放档案夹；改走南侧应急门' },
      '你：取物锁要求断开照明，北门却需要它。既然不能两全，就换一条回程。', '档案夹列出了泵站的应急接口。所谓安全门，保护的是设备的优先级。',
      ['断开照明会释放档案夹，也会关闭 NORTH、打开 SOUTH。', '整段可以走南门，取物时从东侧接近，避开暗中的近距视野。', '在 L 切到应急通道，走南门到最东侧，再北上取件，沿原路返回。'],
      [g(272, 432), e(), g(816, 432), g(816, 176), g(816, 432), g(112, 432)], 'C3-3-a'),
    action('C3-3-c', '熄灯以后，他仍听得见', { ...reach, walls: room([[14, [5, 6, 12, 13]]]), circuits: [panel('L', 112, 432, true, '入口与照明分流', ['应急通道', '照明'])], doors: [door('ENTRY', 448, 384, 'L', false)], guards: [litGuard(560, 432, Math.PI, 340, 'L', true, 180)], soundMarkers: [{ id: 'N1', x: 272, y: 176 }] },
      '联络员：熄灯不会让人失聪。南侧守卫仍然贴着入口，得再给他安排一次调查。', '照明、听觉和通道是三件不同的事。城市的支路也不能只靠一个总开关解决。',
      ['暗中的 A 仍能看见近处，并响应声音。', '同伙先熄灯，再去北侧发声；真人使用南侧应急门。', '回声在出生处按 E，去 N1 发声，向北再向东退开待命。真人等两秒，从南侧进入。'],
      [e(), g(272, 432), g(272, 176), noise(), g(272, 80), g(400, 80), r(), w(120), g(816, 432)], 'C3-3-b'),
  ] },
  { id: 'C3-4', chapter: '停电之夜', title: '回声会接线', summary: '录像保存的是指定状态。把入口操作、内侧断电和留守拆给不同的自己。', evidence: '封存设备的独立供电接口', stages: [
    action('C3-4-a', '入口交给昨天', { loot: p(816, 176), exit: p(848, 432), lootLabel: '设备接线表', walls: room([[10, [12, 13]]]), circuits: [panel('P', 208, 176, false, '入口电源'), panel('Q', 528, 432, true, '内侧监控')], doors: [door('ENTRY', 320, 384, 'P', true, { window: [1.5, 2.5] })], guards: [camera('CAM', 784, 176, Math.PI, 350, 'Q')], objectiveLabel: '让回声赶上入口窗口，真人进入后关闭内侧监控' },
      '你：过去的我只需要记住“接通 P”。Q 还在门里面，留给现在的我。', 'P 与 Q 可以分开操作。封存设备并非真的只能和城市一起断电。',
      ['入口只接受 1.5–2.5 秒的供电；P 在西北，Q 在东南。', '回声去 P，真人提前赶到入口。入内后关闭 Q 再去北侧取件。', '录下经西侧到 P 接通的路线。真人走南门，到 Q 断开，再沿东区中部北上取件，从东侧撤离。'],
      [g(208, 432), g(208, 176), e(), r(), g(528, 432), e(), g(592, 432), g(592, 176), g(816, 176), g(848, 432)]),
    action('C3-4-b', '让下一人接上内线', { loot: p(816, 176), exit: p(848, 432), par: 2, lootLabel: '独立接口编号', walls: room([[10, [12, 13]], [20, [8, 9]]]), circuits: [panel('P', 208, 176, false, '入口电源'), panel('Q', 528, 432, true, '内侧分流', ['检修通道', '监控'])], doors: [door('ENTRY', 320, 384, 'P', true, { window: [1.5, 2.5] }), door('INNER', 640, 256, 'Q', false)], guards: [camera('CAM', 784, 304, Math.PI, 300, 'Q')], objectiveLabel: '先打开外门，再把内侧电流从监控拨给检修通道' },
      '联络员：录第二名同伙时，第一名照常给你开门。内侧这次请求会在下一轮原样重放。', '录像里的 Q 请求写着“检修通道”，并不是盲目再拨一次开关。',
      ['第一道窗口门仍依赖 P，内门和摄像头分别占用 Q 的两种状态。', '第一条录像接通 P。第二条进门改 Q，真人跟随并走中央内门。', '先录 P。第二回声穿 ENTRY 到 Q，按 E 切到检修并录制。真人也先经过 Q 一侧，再北上穿 INNER 取件、沿东侧撤离。'],
      [g(208, 432), g(208, 176), e(), r(), g(528, 432), e(), r(), g(592, 432), g(592, 304), g(816, 304), g(816, 176), g(848, 432)], 'C3-4-a'),
    action('C3-4-c', '接线的人还得留下', { loot: p(816, 176), exit: p(848, 432), par: 2, lootLabel: '封存专线图', walls: room([[10, [12, 13]], [20, [8, 9]]]), circuits: [panel('P', 208, 176, false, '入口电源'), panel('Q', 528, 432, true, '检修与监控分流', ['检修', '监控'])], plates: [plate('A', 528, 176)], doors: [door('ENTRY', 320, 384, 'P', true, { window: [1.5, 2.5] }), door('INNER', 640, 256, 'Q', false, { plate: 'A' })], guards: [camera('CAM', 784, 304, Math.PI, 300, 'Q')], objectiveLabel: '第二回声改接 Q 后守 A，真人穿内门取走专线图' },
      '你：内门还需要有人按住确认。第二个我接好线之后，不能跟着离开。', '专线图把封存、监控与民用负载分开了。接下来可以按顺序把电流借给它们。',
      ['INNER 同时需要 Q 在检修状态、A 有人留守。', '同一名回声先操作 Q，再去 A。真人利用它最终留下的位置。', '第一回声接 P。第二回声进门改 Q，再沿中区到 A 留守。真人穿 ENTRY 后在 INNER 西侧等 A 点亮，再去东侧取件撤离。'],
      [g(208, 432), g(208, 176), e(), r(), g(528, 432), e(), g(528, 176), r(), g(592, 432), g(592, 304), w(60), g(816, 304), g(816, 176), g(848, 432)], 'C3-4-b'),
  ] },
  { id: 'C3-5', chapter: '停电之夜', title: '只留一条供电线', summary: '同一条电流依次服务多个目标，入口、取物与撤离不能同时满足。', evidence: '民用负载的独立恢复顺序', stages: [
    action('C3-5-a', '电流接力', { loot: p(816, 432), exit: p(848, 432), lootLabel: '分时供电表', walls: room([[10, [12, 13]], [18, [12, 13]], [24, [12, 13]]]), circuits: [panel('S', 208, 176, false, '干线分流', ['中门', '首尾门'])], doors: [door('FIRST', 320, 384, 'S', true), door('MIDDLE', 576, 384, 'S', false), door('LAST', 768, 384, 'S', true)], objectiveLabel: '同一分流器按首门、中门、末门的顺序供电' },
      '联络员：首尾门在一边，中门在另一边。让同伙按你的行进顺序接线。', '电力没有增加，三扇门却都在需要的时候打开了。',
      ['S 的两种状态不能同时服务三扇门。', '让回声接通首门，等你过后改给中门，再改回末门。', '回声到 S 切向首尾门，等 1.5 秒改中门，再等约 1.3 秒改回。真人沿南侧依次穿过三门。'],
      [g(208, 432), g(208, 176), e(), w(90), e(), w(80), e(), r(), g(528, 432), g(688, 432), g(848, 432)]),
    action('C3-5-b', '取物也要排进供电表', { loot: p(816, 176), exit: p(112, 432), lootLabel: '独立恢复顺序', walls: room([[14, [5, 6, 12, 13]]]), circuits: [panel('S', 272, 432, false, '干线分流', ['入口与归位', '取物与回程'])], doors: [door('NORTH', 448, 160, 'S', false), door('SOUTH', 448, 384, 'S', true)], lootPower: [power('S', true)], exitPower: [power('S', false)], objectiveLabel: '北门进入，供电取物，南门返回，最后把干线归位' },
      '你：光走过去还不够，档案夹也在等电。最后把线路归位，才算没有留下烂摊子。', '恢复顺序已带回；入口、取件和归位各自占用了不同的时段。',
      ['S 初态打开北门；取物与南门需要相反状态。出口要求恢复初态。', '安排一次中途切换和一次晚些的归位，真人走一圈。', '回声在 S 等到约第 4 秒切向取物与回程，再等四秒归位。真人从北门取件，走南门回出生处等待最终归位。'],
      [g(272, 432), w(200), e(), w(240), e(), r(), g(112, 176), g(400, 176), g(528, 176), g(816, 176), g(816, 432), g(400, 432), g(112, 432), w(60)], 'C3-5-a'),
    action('C3-5-c', '手动确认与远程停机', { loot: p(816, 304), exit: p(848, 432), par: 2, lootLabel: '备用馈线钥匙', walls: room([[14, [8, 9]]]), circuits: [panel('P', 208, 432, false, '入口与监控')], plates: [plate('A', 272, 176)], doors: [door('ENTRY', 448, 256, 'P', true, { plate: 'A' })], guards: [camera('CAM', 784, 304, Math.PI, 350, 'P')], lootPower: [power('P', false)], objectiveLabel: '一人确认 A，一人负责 P 的开关，真人穿门后停机取件' },
      '联络员：这份钥匙需要手动确认，也需要停机才能拔出。三个人各做一件事，时序才不会互相拆台。', '备用馈线可以接入了。最后一场行动要把证据和城市一起带出黑暗。',
      ['A 与 P 同时成立才能开门；取物要求 P 断开。', '一条回声守 A，另一条控制 P。真人要在停机前越过门槛。', '第一回声守 A。第二回声到 P 接通，约第 2.5 秒断开。真人沿西墙到中央门穿过，等镜头熄灭后取件并东撤。'],
      [g(272, 432), g(272, 176), r(), g(208, 432), e(), w(124), e(), r(), g(112, 304), g(528, 304), g(816, 304), g(848, 432)], 'C3-5-b'),
  ] },
  LAST_LIGHT,
];
