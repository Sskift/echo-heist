import type { Mission, Stage } from './campaign-content.ts';
import type { Level } from './levels.ts';
import { e, g, r, w, plate, room, point as p } from './campaign-authoring.ts';

const power = (id: string, on = true) => ({ id, on });
const reviewLine = { id: 'REVIEW', x: 112, y: 304, initial: true, label: '独立复核线路', states: ['借用取件', '常态归位'] as [string, string] };
const north = { id: 'NORTH', x: 448, y: 160, w: 32, h: 64, power: power('REVIEW', false) };
const south = { id: 'RETURN', x: 448, y: 384, w: 32, h: 64, power: power('REVIEW') };
const keeper = [g(272, 432), g(272, 176), r()];
const switcher = (delay = 240) => [g(112, 304), e(), w(delay), e(), r()];

export function prepareReviews(missions: Mission[]) {
  const civic = missions.find(m => m.id === 'C6-5')!;
  civic.preparations = [
    { id: 'review-current', label: '沿现有监控走廊', sources: [], effect: '保留原来少回声与低暴露的两种安排，按每区设施自行组合。', cost: '少回声路线经过监控边缘；避开监控则多安排同伙值守或停机。' },
    { id: 'review-independent', label: '按原件借用复核线路', sources: ['C5-6', 'C6-3'], effect: '批准书原件与设备时间戳指向独立保管柜；临时借用 REVIEW 可打开北侧取件通道，避开原监控走廊。', cost: '每区离开前必须恢复 REVIEW。首区亲手返回复位，后两区安排回声先借用、后归位；末区还要接力原票签入，不能只拿走原件。' },
  ];
  add(civic.stages[0], 'review-independent', '借来的线路，也要有人还', {
    par: 1, walls: room([[14, [5, 6]]]), plates: [plate('A', 272, 176)], doors: [{ ...north, plate: 'A' }],
    circuits: [reviewLine], guards: [], loot: p(816, 176), exit: p(112, 432), lootPower: [power('REVIEW', false)], exitPower: [power('REVIEW')],
    objectiveLabel: 'A 留守北门，真人借用 REVIEW 取索引，沿北门返回后恢复线路再撤离',
  }, '你：批准书的签名与设备时间戳指向同一组保管柜。我们可以核对原件，不必再经过监控走廊；但这条复核线还供别人在用，取完就还。',
  '索引来自独立保管柜，REVIEW 已恢复。证人的记录与批准书能相互核对，联络员的解释不再是唯一来源。',
  ['REVIEW 借用时北门与取件柜可用，归位后关门；撤离要求线路归位。A 仍需持续有人守住。', '先录 A。真人在西侧借用 REVIEW，经北门取索引，带件回到西侧后再归位，不能在门内等自动恢复。', '录 A (272,176)。真人到 REVIEW (112,304) 按 E，经 (112,176) 到 (816,176) 取件，再回 (112,176)、REVIEW 按 E，南下锚点。'],
  [...keeper, g(112, 304), e(), g(112, 176), g(816, 176), g(112, 176), g(112, 304), e(), g(112, 432)]);

  add(civic.stages[1], 'review-independent', '归位的时候，另一扇门打开', {
    par: 2, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 272, 176)], doors: [{ ...north, plate: 'A' }, south],
    circuits: [reviewLine], guards: [], loot: p(816, 176), exit: p(112, 432), lootPower: [power('REVIEW', false)], exitPower: [power('REVIEW')],
    objectiveLabel: 'A 接应北门，操作回声先借用 REVIEW、取件后归位；真人沿南侧 RETURN 返回',
  }, '搭档：这一组保管柜在归位后打开南侧回程。让过去的你留在外侧操作；你拿到收据时，他再把借用的线还回去。',
  '收据取出后，REVIEW 归位，北门关闭、南门打开。同伙的恢复动作接上了你的回程。',
  ['北门在借用态开启，南门在归位态开启。收据只在借用态可取；归位过早，柜子会重新锁住。', '一名回声守 A，另一名先借用 REVIEW，约四秒后归位。真人先取件，再往南侧 RETURN 等回程。', '先录 A。再录到 REVIEW (112,304) 按 E、等四秒、再按 E 后录制。真人经 (112,176) 穿北门取件，沿东侧到 (848,432)，等南门亮起后返回 (112,432)。'],
  [...keeper, ...switcher(), g(112, 176), g(816, 176), g(848, 176), g(848, 432), w(30), g(112, 432)]);

  add(civic.stages[2], 'review-independent', '把签名留在恢复之后', {
    par: 2, walls: room([[14, [5, 6, 12, 13]]]), plates: [plate('A', 208, 176)], doors: [north, { ...south, authorization: 'SIGNED' }],
    circuits: [reviewLine], guards: [], loot: p(816, 176), exit: p(112, 432), exitPower: [power('REVIEW')],
    terminals: [{ id: 'S', kind: 'source', x: 112, y: 176, appearance: 'review' }, { id: 'R', kind: 'relay', x: 304, y: 400, waitForDelivery: true, appearance: 'review' }, { id: 'L', kind: 'lock', x: 656, y: 176, authorization: 'SIGNED', plate: 'A', power: power('REVIEW'), appearance: 'review' }],
    lootPower: [power('REVIEW')],
    objectiveLabel: '送件者交 R 后守 A；操作员借用北门再恢复 REVIEW；真人带原票到内侧 L 签入，从南门返回',
  }, '你：最后这份签名要在正常线路上核验。一个自己送票后留守，另一个借门再归位；我带原票进去，等灯恢复后再签。',
  '原票在已恢复的独立线路上完成核验，第二份签名与索引、收据归档。证据改变了可走的路，但没有替任何人签字。',
  ['借用态只开 NORTH；L 签名和取件都要求 REVIEW 已归位。RETURN 同时要求归位和 SIGNED。', '先录 S 取票、交 R、守 A；第二名在 REVIEW 借用后等约五秒半再归位。真人在 R 接件，趁借用进入北门，在内侧等恢复签入。', '录 S (112,176) → R (304,400) 交付 → A (208,176)。第二条操作 REVIEW 等五秒半归位。真人在 R 留候约两秒，经 (400,400)、(400,176) 到 L (656,176)，等约一秒再签；取件后向南，经 RETURN 回西侧锚点。'],
  [g(112, 176), e(), g(304, 176), g(304, 400), e(), g(208, 400), g(208, 176), r(), ...switcher(330), g(304, 432), g(304, 400), e(), w(120), g(400, 400), g(400, 176), g(656, 176), w(60), e(), g(816, 176), g(816, 432), g(112, 432)]);

  const vault = missions.find(m => m.id === 'C7-1')!;
  vault.preparations = [
    { id: 'vault-timed', label: '沿公开认证入口', sources: [], effect: '保留原入口时段、扫描周期与脉冲核验。', cost: '两区各可使用一名回声；真人需把通过与签名放进公布的空档。' },
    { id: 'vault-addressed', label: '按传输地址找侧面收件口', sources: ['C6-6', 'C6-4'], effect: '传输地址定位收件侧廊，联锁日志确认其复位方式；改走无扫描的北侧入口与连续复核台。', cost: '每区需要两名回声。首区有人守门、有人解除并恢复联锁；第二区送票者守 A，另一人守 B 维持复核，原票仍需本人签入。' },
  ];
  add(vault.stages[0], 'vault-addressed', '地址背后，还有一扇收件门', {
    par: 2, walls: room([[14, [5, 6]]]), plates: [plate('A', 272, 176)], doors: [{ id: 'INTAKE', x: 448, y: 160, w: 32, h: 64, plate: 'A' }],
    scanners: [], circuits: [{ id: 'Q', x: 112, y: 304, initial: true, label: '收件口联锁', states: ['临时接应', '联锁归位'] }],
    suppressors: [{ id: 'KEEPER', x: 224, y: 128, w: 96, h: 96, power: power('Q') }], exitPower: [power('Q')], exit: p(848, 432),
    objectiveLabel: 'A 守住收件门，操作回声解除 Q 接应真人；穿过北门后恢复 Q，再抵达内侧锚点',
  }, '搭档：市政厅传输地址背面标着这处收件口，联锁日志也对上了。一个自己留在门边，一个在外侧操作；你进去以后，把联锁恢复到原来的样子。',
  '你从收件侧廊进入，Q 已归位。总库接受的仍须是真人送入的原件与独立回执，地址只是把你带到了正确的门。',
  ['Q 接通时抑制 A；解除后守门回声恢复。内侧锚点要求 Q 归位，不能关掉它就走。', '第一名录 A；第二名到 Q 解除，等四秒再归位。真人经北门进入后留在内侧，不需要再返回。', '录 A (272,176)。再录 Q (112,304) 按 E、等四秒、再按 E。真人经 (112,176) 穿过北门，沿东侧到 (848,432)，等 Q 归位后完成。'],
  [...keeper, g(112, 304), e(), w(240), e(), r(), g(112, 176), g(848, 176), g(848, 432), w(60)]);

  add(vault.stages[1], 'vault-addressed', '有人送件，有人维持复核', {
    par: 2, walls: room([[22, [5, 6]]]), plates: [plate('A', 208, 176), plate('B', 400, 432)],
    circuits: [{ id: 'CHECK', x: 400, y: 496, initial: false, label: '收件复核馈线', states: ['等待值守', '连续复核'], feed: { plate: 'B' } }],
    suppressors: [{ id: 'KEEPER', x: 160, y: 128, w: 96, h: 96, power: power('CHECK', false) }],
    terminals: [{ id: 'S', kind: 'source', x: 112, y: 176, appearance: 'review' }, { id: 'R', kind: 'relay', x: 272, y: 400, waitForDelivery: true, appearance: 'review' }, { id: 'L', kind: 'lock', x: 528, y: 176, authorization: 'SIGNED', plate: 'A', power: power('CHECK'), appearance: 'review' }],
    objectiveLabel: '送件回声把原票交 R 后守 A，另一名守 B 维持 CHECK；真人接票签 L，进入总库',
  }, '联络员：地址上的复核台不用等脉冲，但得有人持续看着馈线。送票的自己在 A 等你，另一人在 B 让他保持有效，最后的签名由你来。',
  '原票经过两处真实值守完成签入。责任清单与传输地址把你带进了总库，下一步仍要亲手植入证据，取得独立回执。',
  ['B 自动接通 CHECK，解除 A 的抑制并给 L 供电。A、B 同时在场，原票的 L 签名才有效。', '第一条录 S 取票、交 R 后守 A。第二条守南侧 B。真人在 R 等件、接回，再到 L；无需赶周期。', '录 S (112,176) → R (272,400) 交付 → A (208,176)。第二条到 B (400,432) 按 R。真人在 R 按 E 等约三秒，到 L (528,176) 签入，沿北门进入后到东南锚点。'],
  [g(112, 176), e(), g(272, 176), g(272, 400), e(), g(208, 400), g(208, 176), r(), g(400, 432), r(), g(272, 432), g(272, 400), e(), w(180), g(528, 400), g(528, 176), e(), g(848, 176), g(848, 432)]);
}

function add(base: Stage, when: string, title: string, properties: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: Stage['witness']) {
  const alternate: Stage = { ...base, level: { ...structuredClone(base.level), ...properties, id: `${base.level.id}-${when}`, title, description: story, hints, hint: hints[2], briefing: [hints[0], properties.objectiveLabel!] }, story, result, witness };
  delete alternate.variants; delete alternate.alternatives;
  (base.variants ??= []).push({ when, stage: alternate });
}
