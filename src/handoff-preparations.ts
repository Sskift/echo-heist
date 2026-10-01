import type { Mission, Stage } from './campaign-content.ts';
import type { Circuit, Level, Terminal } from './levels.ts';
import { e, g, r, w, plate, room, point as p } from './campaign-authoring.ts';

const oldFeed = (x: number, y: number): Circuit => ({ id: 'OLD', x, y, initial: false, label: '旧班复核供电', states: ['等待值守', '旧台接通'], feed: { plate: 'A' } });
const legacy = (terminals: Terminal[]) => terminals.map(t => ({ ...t, appearance: 'legacy' as const }));

export function prepareHandoffs(missions: Mission[]) {
  const station = missions.find(m => m.id === 'C4-5')!;
  station.preparations = [
    { id: 'station-current', label: '沿当班授权链', sources: [], effect: '沿原有柜台交接，前后签名按公布时段接受。', cost: '首尾区可各用一名回声，中区两名；后两区需要赶上签入或交接窗口。' },
    { id: 'station-legacy', label: '重启旧班复核台', sources: ['C3-6', 'C4-3'], effect: '恢复的民用供电让旧台可用；按被划去的班次定位柜面，首区改从北门进入，后两区取消旧台时段限制。', cost: '每区安排两名回声分别守 A、B；A 持续供电，B 在 L2 签入时确认。凭据仍须真实交接并先签 L1，证据不代替授权。' },
  ];
  arrange(station.stages[0], 'station-legacy', '旧班台需要两个人醒着', {
    par: 2, walls: room([[14, [5, 6]], [22, [8, 9]]]), plates: [plate('A', 272, 432), plate('B', 592, 432)], circuits: [oldFeed(272, 496)],
    doors: [{ id: 'ENTRY', x: 448, y: 160, w: 32, h: 64, authorization: 'L1' }, { id: 'PASS', x: 704, y: 256, w: 32, h: 64, authorization: 'L2' }],
    terminals: legacy([{ id: 'S', kind: 'source', x: 112, y: 176 }, { id: 'L1', kind: 'lock', x: 272, y: 176, authorization: 'L1' }, { id: 'R', kind: 'relay', x: 336, y: 176, waitForDelivery: true }, { id: 'L2', kind: 'lock', x: 592, y: 176, authorization: 'L2', requiresAuthorization: 'L1', plate: 'B', power: { id: 'OLD', on: true } }]),
    objectiveLabel: '先签 L1 并交 R；A 供电、B 确认，真人接回唯一凭据签 L2',
  }, '联络员：你恢复的那条民用支路也给旧台供电。划去的班次不是不存在，只是没人值守。先把柜面和岗位重新接起来。',
  '旧班台亮起，北门后仍是同一组授权编号。恢复供电没有替任何人签名。',
  ['第一名取 S、签 L1、交 R 后守 A；A 只给 OLD 供电，不能代签。L2 还需要中区 B 与真实凭据。', '第二名经过已签开的北门，到中区南侧守 B。真人在 R 接回凭据，再到北侧 L2 签入；这次不需要赶时段。', '先录 S (112,176) → L1 (272,176) → R (336,176) 交付 → A (272,432)。第二条经 (400,176)、(592,176) 到 B (592,432)。真人在 R 留候约 2 秒，沿北门签 L2，再经中央内门取件。'],
  [g(112, 176), e(), g(272, 176), e(), g(336, 176), e(), g(336, 432), g(272, 432), r(), g(400, 432), g(400, 176), w(30), g(592, 176), g(592, 432), r(), g(336, 432), g(336, 176), e(), w(120), g(592, 176), e(), g(656, 176), g(656, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 432)]);

  arrange(station.stages[1], 'station-legacy', '签完的人还要留下确认', {
    par: 2, plates: [plate('A', 208, 176), plate('B', 592, 496)], circuits: [oldFeed(208, 112)],
    terminals: legacy(station.stages[1].level.terminals!.map(t => t.id === 'L2' ? { ...t, window: undefined, power: { id: 'OLD', on: true }, plate: 'B' } : t)),
    objectiveLabel: '第一棒送 R1 后守 A；第二棒签 L1、交 R2 后守 B；真人接票签 L2',
  }, '你：旧台不用等到晚班才开，但第二个签完的人也不能离开。让他把票交给我，再留下确认。',
  '送件、内侧签名和旧台复核各有人接班。你拿到了内侧复核编号，两个岗位都真实有人在场。',
  ['A 同时开入口并维持 OLD，B 给 L2 确认；L2 不限时段，但必须已经签过 L1。', '沿原来的 R1 → L1 → R2 交接。第二棒交出后再南下 B，真人收到票后等 B 亮起再去 L2。', '第一条取 S、交 R1 后守 A。第二条在 R1 留候约 4 秒，进南门签 L1 (528,432)，交 R2 (592,400)，再到 B (592,496) 按 R。真人跟进 R2 接收，去 L2 (592,176) 签入后取件。'],
  [g(112, 144), e(), g(112, 400), g(272, 400), e(), g(208, 400), g(208, 176), r(), g(272, 432), g(272, 400), e(), w(240), g(400, 400), g(400, 432), g(528, 432), e(), g(592, 432), g(592, 400), e(), g(592, 496), r(), w(240), g(400, 432), g(592, 432), g(592, 400), e(), w(55), g(592, 176), e(), g(656, 176), g(656, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 432)]);

  arrange(station.stages[2], 'station-legacy', '旧时刻表，新的值守人', {
    par: 2, plates: [plate('A', 336, 464), plate('B', 592, 176)], circuits: [oldFeed(336, 496)],
    terminals: legacy(station.stages[2].level.terminals!.map(t => t.id === 'L2' ? { ...t, y: 432, window: undefined, plate: 'B', power: { id: 'OLD', on: true }, requiresAuthorization: 'L1' } : { ...t, window: undefined })),
    objectiveLabel: '先签 L1、交 R，再安排 A 供电和北侧 B 确认；真人去南侧 L2 完成授权链',
  }, '联络员：最后一页也不必赶早晚班了。一个自己守住来处的电，另一个守住内侧的确认，剩下的签名仍由你带着原票完成。',
  '同一个编号通过旧班台接回了连续授权。那班未列在客运表上的列车，确实为后来的人留过位置。',
  ['L1、R、L2 都不限时段。先签 L1 才能进中区；A 与 B 必须同时留守，南侧 L2 才接受原票。', '第一名签 L1、交 R 后南下 A。第二名经过中央入口，北上中区 B；真人从 R 接票后改去南侧 L2。', '录 S → L1 → R (336,400) 交付 → A (336,464)。第二条经 (400,304)、(592,304) 到 B (592,176)。真人在 R 留候 3 秒，进入后到 L2 (592,432) 按 E，沿南门取原件。'],
  [g(112, 176), e(), g(272, 176), e(), g(336, 176), g(336, 400), e(), g(336, 464), r(), g(400, 432), g(400, 304), w(30), g(592, 304), g(592, 176), r(), g(336, 432), g(336, 400), e(), w(180), g(400, 400), g(400, 304), g(592, 304), g(592, 432), e(), g(816, 432), g(848, 464)]);

  prepareManual(missions.find(m => m.id === 'C5-5')!);
}

function prepareManual(mission: Mission) {
  mission.preparations = [
    { id: 'retention-cycle', label: '沿周期交接柜', sources: [], effect: '沿原有抑制周期与交接窗口安排送件、接收和重新请求。', cost: '后两区需要把动作放在抑制空档；错过的请求不会自动补发。' },
    { id: 'retention-manual', label: '按货单走人工取件面', sources: ['C4-6', 'C5-2'], effect: '货单设施编号与人工权限对上后，改用不受周期限制的取件面和场外交接台。', cost: 'S 与确认位 A 位于常开抑制区，真人必须取件、送到 R，再回 A 接应回声签入。中区还要归位柜面，末区须亲手接回同一份凭据。' },
  ];
  const common: Partial<Level> = {
    par: 1, spawn: p(112, 432), exit: p(848, 304), walls: room([[20, [8, 9]]]), plates: [plate('A', 208, 176)],
    doors: [{ id: 'PASS', x: 640, y: 256, w: 32, h: 64, authorization: 'L' }],
    suppressors: [{ id: 'MANUAL', x: 64, y: 128, w: 192, h: 224 }],
    terminals: [{ id: 'S', kind: 'source', x: 112, y: 176, appearance: 'manual' }, { id: 'R', kind: 'relay', x: 304, y: 304, waitForDelivery: true, appearance: 'manual' }, { id: 'L', kind: 'lock', x: 528, y: 176, authorization: 'L', plate: 'A' }],
  };
  const receiver = [g(304, 432), g(304, 304), e(), w(100), g(528, 304), g(528, 176), e(), r()];
  const send = [g(112, 176), e(), g(112, 304), g(304, 304), e(), g(208, 304), g(208, 176), w(75)];
  const leave = [g(592, 304), g(816, 304), g(816, 176), g(848, 176), g(848, 304)];
  arrange(mission.stages[0], 'retention-manual', '这份凭据由你先送出去', {
    ...common, objectiveLabel: '真人从 S 取件并交 R，回到常开抑制区守 A；回声接件签 L',
  }, '你：车票上的设施编号与人工接管权限对上了。S 和 A 都只认真人的作用，今天由我先取件、送到场外，再回来替过去的自己守岗位。',
  '原票从人工取件面交到回声手中，副页由你带走。货单提供的是能核对的入口，不是凭空复制的通行证。',
  ['MANUAL 常开，覆盖 S 与 A，回声在其中无法取件或确认；R、L 位于场外。', '先录回声在 R 留候、等到真人完成送件后去 L 签入。真人取 S、交 R，再回 A，守到 L 成功。', '录到 R (304,304) 按 E、等约 1.7 秒，再去 L (528,176) 按 E。正式行动：S (112,176) 取件，经 (112,304) 到 R 交付，回 A (208,176) 守约 1.25 秒，再走中央门取件。'],
  [...receiver, ...send, ...leave]);

  arrange(mission.stages[1], 'retention-manual', '开了柜面，还要亲手归位', {
    ...common, terminals: common.terminals!.map(t => t.id === 'R' ? { ...t, power: { id: 'M', on: false } } : t),
    circuits: [{ id: 'M', x: 112, y: 304, initial: true, label: '人工交接柜面', states: ['开放交接', '归位锁闭'] }], exitPower: [{ id: 'M', on: true }],
    objectiveLabel: '真人开启 M、送 R 后守 A；回声签 L 后，真人回 M 归位再撤离',
  }, '联络员：这处人工柜面不等交班时段，但开口要由你解锁，也要由你关回去。控制面板在常开抑制区里，录像不能替你操作。',
  '柜面已归位，确认单保留着同一组设施编号。上面的中止标记不是正常结算，馆方已经启动抹除。',
  ['R 需要 M 开放才能交接，撤离要求 M 归位。M 和 A 都在 MANUAL 内，只能由真人操作和确认。', '先录 R 留候到 L 签入。真人取 S，在经过 M 时开放柜面，送到 R 后回 A。L 签入后再回 M 归位。', '沿上一段录 R 等约 1.7 秒再去 L。真人到 S 取件，经 M (112,304) 按 E，再到 R 交付、回 A 等约 1.25 秒；经 (112,176) 回 M 按 E 归位，再从中央门取件。'],
  [...receiver, g(112, 176), e(), g(112, 304), e(), g(304, 304), e(), g(208, 304), g(208, 176), w(75), g(112, 176), g(112, 304), e(), ...leave]);

  arrange(mission.stages[2], 'retention-manual', '签完以后，把原票交回我', {
    ...common, terminals: [...common.terminals!, { id: 'BACK', kind: 'relay', x: 528, y: 400, waitForDelivery: true, appearance: 'manual' }],
    credential: { id: 'manual-review-key', label: '人工复核凭据', exitOwners: ['player'], exitAuthorizations: ['L'], receiveByPlayer: 'BACK' },
    objectiveLabel: '真人送 R 后守 A；回声签 L 并交 BACK，真人亲手接回原票再带倒计时记录撤离',
  }, '你：最后一份还要原票随副页离场。过去的我去签，签完放进 BACK；我会回来亲手接住，不把它留给抹除程序。',
  '原票和倒计时记录一起离开人工复核区。没有复制，也没有把失效的投影当作物件丢失；抹除目标还包括整批未经确认的转存对象。',
  ['S 与 A 只由真人生效。L 成功后凭据仍在签入者手里；BACK 只用于交回原票，必须本人接收并持有才能撤离。', '录制时亲手取 S，在 R 放下再取回，让录像明确包含接收与之后的交付。再去 L 请求签入、到 BACK 交出。正式行动中，真人代替受抑制的开头取件并送 R，再回 A。', '录 S → R (304,304) 按 E 放下、再按 E 接回 → L 按 E → BACK (528,400) 交出。正式真人取 S、交 R，回 A (208,176) 等约 1.25 秒；经 (528,304) 去 BACK 按 E 接回，再经 (592,400)、(592,304) 穿门取件。'],
  [g(112, 176), e(), g(112, 304), g(304, 304), e(), e(), g(528, 304), g(528, 176), e(), g(528, 400), e(), r(), ...send, g(528, 176), g(528, 400), e(), g(592, 400), ...leave]);
}

function arrange(base: Stage, when: string, title: string, properties: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: Stage['witness']) {
  const alternate: Stage = { ...base, level: { ...structuredClone(base.level), ...properties, id: `${base.level.id}-${when}`, title, description: story, hints, hint: hints[2], briefing: [hints[0], properties.objectiveLabel!] }, story, result, witness };
  delete alternate.variants; delete alternate.alternatives;
  (base.variants ??= []).push({ when, stage: alternate });
}
