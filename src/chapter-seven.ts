import type { Mission, Stage, WitnessAction } from './campaign-content.ts';
import type { Circuit, Delivery, Level, Terminal } from './levels.ts';
import { g, w, r, e, noise, point as p, room, level, stage, gate, plate } from './campaign-authoring.ts';
import { CHAPTER_SEVEN_FINALE } from './chapter-seven-finale.ts';

const power = (id: string, on = true) => ({ id, on });
const panel = (id: string, x: number, y: number, initial: boolean, label: string): Circuit => ({ id, x, y, initial, label });
const source = (x: number, y: number): Terminal => ({ id: 'S', kind: 'source', x, y });
const lock = (x: number, y: number, extra: Partial<Terminal> = {}): Terminal => ({ id: 'L', kind: 'lock', x, y, authorization: 'SIGNED', ...extra });
const delivery = (x: number, y: number, label: string, extra: Partial<Delivery> = {}): Delivery => ({ id: 'D', x, y, label, ...extra });
function action(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: WitnessAction[], previous?: string): Stage {
  const map = level(id, title, { subtitle: 'RETURN WHAT THEY ERASED', district: '中央总库 / CENTRAL VAULT', theme: 'audit', noiseResponse: 'nearest', ...props, hint: hints[2], hints });
  const s = stage(map, story, result, [id + '-clear'], witness, previous ? previous + '-clear' : undefined);
  s.level.briefing = [map.objectiveLabel ?? hints[0]];
  return s;
}

export const CHAPTER_SEVEN: Mission[] = [
  {
    id: 'C7-1', chapter: '最后一个自己', title: '偷回入口', summary: '在抑制空档与认证时段之间，重新打开中央总库。', evidence: '中央总库送达规则：认证、植入、独立回执',
    stages: [
      action('C7-1-a', '让入口等到同伙', {
        objective: 'reach', exit: p(848, 304), walls: room([[14, [8, 9]]]), plates: [plate('A', 272, 176)],
        circuits: [panel('Q', 112, 304, true, '入口投影抑制')], suppressors: [{ id: 'KEEPER', x: 224, y: 128, w: 96, h: 96, power: power('Q') }],
        doors: [{ ...gate('ENTRY', 448, 256, 'A'), window: [4, 6.5] }], scanners: [{ id: 'SCAN', x: 640, y: 256, w: 32, h: 96, period: 4, active: [0, 2] }],
        objectiveLabel: '恢复 A 留守者，穿过 4–6.5 秒入口与扫描空档',
      }, 'B-17：我在旧渡口等你。中央总库不缺另一份被偷走的原件，它缺一份已经送达、无法否认的记录。', '入口已打开。总库的送达规则要求实体证据和独立回执；投影只能协助，不能替你提交。',
      ['入口同时需要 A 和时段；后面的扫描是另一只时钟。', '真人负责关 Q。让 A 的同伙恢复后，仍要等入口与扫描各自的空档。', '录下到 A 留守；真人到 Q 关抑制，在入口西侧等到第 4 秒通过，再在扫描西侧等到第 6 秒后前进。'],
      [g(272, 432), g(272, 176), r(), g(112, 304), e(), g(400, 304), w(130), g(528, 304), g(592, 304), w(78), g(848, 304)]),
      action('C7-1-b', '签名之前必须有人在场', {
        objective: 'reach', exit: p(848, 432), walls: room([[22, [5, 6]]]), plates: [plate('A', 208, 176)],
        terminals: [source(112, 176), { id: 'R', kind: 'relay', x: 272, y: 400 }, lock(528, 176, { plate: 'A' })],
        doors: [{ id: 'SIGNED', x: 704, y: 160, w: 32, h: 64, authorization: 'SIGNED' }],
        suppressors: [{ id: 'PULSE', x: 160, y: 128, w: 96, h: 96, cycle: { period: 4, active: [0, 2] } }],
        objectiveLabel: '接收凭据，在 A 恢复的空档签名，再进入总库',
      }, '联络员：我以前把“系统已确认”当作免责。这里的签名必须有人值守；这一次，我们把每一环都亲手确认。', '入口签名留在公共登记链。接下来要把证据送入登记架，而不是再取走一件藏品。',
      ['送件者可以兼任 A 留守；A 每四秒失效两秒。', '凭据可以先拿着等。授权那一刻必须恰好落在 A 可用的 2–4、6–8 秒。', '录 S 取件、R 交付后转去 A。真人到 R 等到凭据，接收后去 L，等第 6 秒后授权，穿东北门撤离。'],
      [g(112, 176), e(), g(272, 176), g(272, 400), e(), g(208, 400), g(208, 176), r(), g(272, 432), g(272, 400), w(150), e(), g(528, 400), g(528, 176), w(120), e(), g(848, 176), g(848, 432)], 'C7-1-a'),
    ],
  },
  {
    id: 'C7-2', chapter: '最后一个自己', title: '把证据放回去', summary: '真人带证据进入，借同伙完成认证，再为提交后的退路留人。', evidence: '已植入的责任证据与送达校验码',
    stages: [
      action('C7-2-a', '这一次，空着手回来', {
        objective: 'deliver', exit: p(112, 432), walls: room([[14, [12, 13]]]), plates: [plate('A', 272, 176)], doors: [gate('ENTRY', 448, 384, 'A')],
        terminals: [source(112, 176), lock(656, 176)], delivery: delivery(816, 176, '可互相核验的责任证据', { authorization: 'SIGNED', plate: 'A' }),
        objectiveLabel: '持凭据签名，真人在 D 按 E 植入证据，再沿同伙守住的入口返回',
      }, '你：蓝色封套在我手里。过去的我替我开门、替我作证，真正送进去的这一步必须由现在的我来走。', '责任证据已写入总库。你没有带走新的藏品；留下的原件将成为公开核验的起点。',
      ['蓝色 D 是提交位置，走近不会自动完成；证据一直由真人携带。', 'L 的签名与 A 的值守都要成立。签名使用凭据，植入使用实体证据，两者互不替代。', '留回声守 A。真人从 S 拿凭据，沿南侧进入东区，到 L 按 E 授权，再到 D 按 E 植入，沿原路南侧返回西侧撤离点。'],
      [g(272, 432), g(272, 176), r(), g(112, 176), e(), g(400, 176), g(400, 432), g(656, 432), g(656, 176), e(), g(816, 176), e(), g(656, 176), g(656, 432), g(112, 432)]),
      action('C7-2-b', '先提交，再接回退路', {
        objective: 'deliver', exit: p(112, 432), walls: room([[14, [5, 6, 12, 13]]]),
        circuits: [panel('ENTRY', 112, 432, true, '进入通道'), panel('WRITE', 656, 304, false, '写入登记架'), panel('BACK', 272, 176, false, '北侧退路')],
        doors: [{ id: 'ENTRY', x: 448, y: 384, w: 32, h: 64, power: power('ENTRY') }, { id: 'BACK', x: 448, y: 160, w: 32, h: 64, power: power('BACK') }],
        delivery: delivery(656, 176, '送达校验码', { power: [power('WRITE')], window: [4, 6], onDeposit: { power: [power('ENTRY', false), power('BACK', false)], message: '登记架已写入：南侧入口关闭、BACK 复位；请在提交后重新接通北侧退路。' } }), exitPower: [power('BACK')],
        objectiveLabel: '在 4–6 秒提交校验码；同伙在提交后接回 BACK，真人从北侧返回',
      }, '联络员：写入会锁住来路，也会复位备用线。告示就在登记架上；把恢复动作留到提交以后。', '校验码与责任证据相互对应。总库无法再用“来历不明”撤回它们，但我们还需要独立的送达回执。',
      ['D 的提交窗口与 BACK 的复位是两件事，提前接通会被提交覆盖。', '真人先接 WRITE，等提交窗口；同伙晚一些才接 BACK。', '录回声到 BACK 后等四秒再按 E，保存。真人从南侧进入、接 WRITE，到 D 等到第 4 秒按 E，随后从东北等 BACK 恢复再返回。'],
      [g(272, 432), g(272, 176), w(240), e(), r(), g(656, 432), g(656, 304), e(), g(656, 176), w(35), e(), g(528, 176), w(90), g(112, 176), g(112, 432)], 'C7-2-a'),
    ],
  },
  {
    id: 'C7-3', chapter: '最后一个自己', title: '让他们看见真相', summary: '把安保调查变成独立见证：让守卫发现副本，再亲自带回登记点。', evidence: '值班、监察与外部登记链的独立送达回执',
    stages: [
      action('C7-3-a', '调查记录也是记录', {
        objective: 'deliver', exit: p(112, 432), par: 0,
        delivery: delivery(496, 304, '值班核验副本', { receivers: [{ guard: 'G1', at: p(656, 304), label: '值班登记台' }] }),
        guards: [{ id: 'G1', route: [p(656, 304)], facing: 0, speed: 112, range: 100, hearing: 800, searchSeconds: 0.5 }], soundMarkers: [{ id: 'D', ...p(496, 304) }],
        objectiveLabel: '植入副本、引 G1 到 D 搜索，再等它返回值班台登记回执',
      }, '你：他们可以删掉我提交的文件，却得解释值班员亲手登记的发现。把他们的调查写进证据链。', 'G1 返回值班台，登记了发现责任证据的时间与校验码。第一份独立回执已在总库外留底。',
      ['蓝圈是回执登记台；只让守卫听见声音还不够。', '先植入，再在 D 发声并离开。守卫到场搜索拿到副本，返回原处才会登记。', '真人沿南侧到 D，按 E 植入后按空格，立刻向南再回西南撤离点。等 G1 搜索后返回蓝圈，收到回执才算完成。'],
      [g(496, 432), g(496, 304), e(), noise(), g(496, 432), g(112, 432), w(120)]),
      action('C7-3-b', '让两份回执彼此作证', {
        objective: 'deliver', exit: p(112, 432), par: 2,
        circuits: [{ ...panel('ROSTER', 112, 432, true, '调查值班线路'), states: ['监察值班', '一线值班'] }],
        delivery: delivery(496, 304, '双重见证副本', { receivers: [{ guard: 'G1', at: p(656, 208), label: '值班登记台' }, { guard: 'G2', at: p(656, 400), label: '监察登记台' }] }),
        guards: [{ id: 'G1', route: [p(656, 208)], facing: 0, speed: 128, range: 100, hearing: 800, searchSeconds: 0.5, power: power('ROSTER') }, { id: 'G2', route: [p(656, 400)], facing: 0, speed: 128, range: 100, hearing: 800, searchSeconds: 0.5, power: power('ROSTER', false) }],
        soundMarkers: [{ id: 'D', ...p(496, 304) }],
        objectiveLabel: '先取得 G1 回执，再切 ROSTER 到监察值班，由延迟诱饵引 G2 留下第二份回执',
      }, '联络员：单独一份回执仍可能被说成误录。值班与监察不共用一条线路；等第一份送达，再请第二位见证。', '两名守卫分别发现同一份校验副本，回到各自登记台留下独立记录。先后的两条链核验出相同内容。',
      ['ROSTER 两态分别启用 G1 或 G2。已经登记的回执不会因换班撤回。', '先让 G1 完成往返，再切给 G2；把第二次声音延后，发声者必须及时离开 D。', '录一条到 D 发声后向西北离开的回声，延迟 4.5 秒；再录一条相同响点、向西南离开的早班回声。真人先植入并返回，看到 G1 回执后将 ROSTER 切为监察值班，等待延迟回声引 G2 完成往返。'],
      [g(496, 432), g(496, 304), noise(), g(368, 304), g(368, 176), r(), { delay: 270, echo: 0 }, g(496, 432), g(496, 304), noise(), g(368, 304), g(368, 432), r(), g(496, 432), g(496, 304), e(), g(496, 432), g(112, 432), w(90), e(), w(300)], 'C7-3-a'),
      action('C7-3-c', '门也要为见证人打开', {
        objective: 'deliver', exit: p(112, 432), par: 2, walls: room([[22, [5, 6]]]), plates: [plate('A', 208, 432)], doors: [gate('RETURN', 704, 160, 'A')],
        circuits: [panel('Q', 400, 432, false, '登记架联锁抑制')], suppressors: [{ id: 'KEEPER', x: 160, y: 384, w: 96, h: 96, power: power('Q') }],
        delivery: delivery(528, 176, '外部登记链副本', { receivers: [{ guard: 'G1', at: p(784, 176), label: '外部登记台' }], onDeposit: { power: [power('Q')], message: '植入触发 Q 抑制，A 留守者暂时失效；恢复同伙后，见证人才能来取副本并返回登记。' } }),
        guards: [{ id: 'G1', route: [p(784, 176)], facing: 0, speed: 128, range: 100, hearing: 800, searchSeconds: 0.5 }], soundMarkers: [{ id: 'D', ...p(528, 176) }],
        objectiveLabel: '植入后解除 Q，恢复 A；让延迟诱饵把 G1 引过门，并保持其回程畅通',
      }, '你：这扇门不只让我通过，也得让带着回执的人回去。过去的我守住它，现在的我去救回那道投影。', '外部登记台收到副本。责任证据已有彼此独立的送达记录，下一步是恢复被抹除者的公共身份，并决定私人记忆如何归还。',
      ['G1 在门后，登记点也在门后。它要完整走完往返才能留下回执。', '植入会抑制 A；真人回到 Q 恢复同伙，再由延迟回声引 G1 到 D。', '第一条留守 A；第二条到 D 发声后沿西侧离开，延迟两秒。真人先植入 D，回 Q 关抑制，再返回撤离点，等 G1 完成搜索和回程。'],
      [g(208, 432), r(), g(528, 432), g(528, 176), noise(), g(528, 304), g(400, 304), g(400, 432), r(), { delay: 120, echo: 1 }, g(528, 432), g(528, 176), e(), g(528, 432), g(400, 432), e(), g(112, 432), w(250)], 'C7-3-b'),
    ],
  },
  ...CHAPTER_SEVEN_FINALE,
];
