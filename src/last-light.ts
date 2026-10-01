import type { Mission, Stage } from './campaign-content.ts';
import type { Circuit, Level } from './levels.ts';
import { e, g, r, w, level, plate, point as p, room, stage } from './campaign-authoring.ts';

// All three views share world coordinates: the feeder room remains west of
// the observation window, the archive east. Returning really uses this room.
const walls = room([[14, [5, 6, 12, 13]]], [], Array.from({ length: 9 }, (_, i): [number, number] => [20 + i, 8]).filter(([x]) => x !== 25 && x !== 26));
const glass = [{ id: '配电室观察窗', x: 608, y: 32, w: 12, h: 512 }];
const panel = (id: string, x: number, y: number, initial: boolean, label: string): Circuit => ({ id, x, y, initial, label });
const feed = (remote = false): Circuit => ({ ...panel('FEED', 368, 80, false, '留守线路 · 自动'), feed: { plate: 'HOLD', remote } });
const common: Partial<Level> = { walls, glass, theme: 'industrial', district: '配电室 ← 观察窗 → 封存室', subtitle: 'THE LAST LIGHT', loot: p(848, 176) };
const gate = (id: string, y: number, power: string, on: boolean, hold?: string) => ({ id, x: 448, y, w: 32, h: 64, power: { id: power, on }, ...(hold ? { plate: hold } : {}) });
function scene(id: string, title: string, props: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: Stage['witness'], requires?: string): Stage {
  const s = stage(level(id, title, { ...common, ...props, hints, hint: hints[2] }), story, result, [id.replace(/-hatch$/, '') + '-clear'], witness, requires);
  s.level.briefing = [story, hints[0]];
  return s;
}

const prepare = scene('C3-6-entry', '配电室 · 留一个自己', {
  objective: 'reach', spawn: p(112, 432), exit: p(560, 432),
  alternateExit: { power: { id: 'HATCH', on: true }, at: p(560, 176), label: '检修口 → 封存室北侧' },
  handoff: { plate: 'HOLD', room: '配电室' }, plates: [plate('HOLD', 176, 176)],
  circuits: [feed(), { ...panel('HATCH', 304, 176, false, '检修口机械锁'), states: ['未解锁 · 走货梯', '已解锁 · 走检修口'] }, panel('SEC', 336, 432, true, '检修口监控'), panel('CIV', 272, 304, true, '民用主线 · 拆离后重接')],
  exitPower: [{ id: 'CIV', on: true }],
  doors: [gate('LIFT', 384, 'FEED', true), gate('HATCH', 160, 'HATCH', true)],
  guards: [{ id: 'CAM', kind: 'camera', route: [p(560, 112)], facing: Math.PI / 2, speed: 0, range: 180, power: { id: 'SEC', on: true } }],
  objectiveLabel: '只留一条回声守 HOLD；货梯直接进入，或关监控并解锁北侧检修口',
}, '联络员：窗那边就是核心。留下一个你守 HOLD，下一间的锁才有电。货梯进去快，但拆掉核心后会停运；现在绕路开检修口，回来就省一次配合。',
'你跨过了房间，留守者没有跟来。它的原录像已存入锚点，接下来仍占用三个名额中的一个。',
['这次只带一名留守者。它必须停在 HOLD；另外两格留给后面的自己。', '走货梯：录好 HOLD，沿南门前往窗边。走检修口：先关 SEC，再开 HATCH，从北门进入。', '先经 (176,432) 到 HOLD 按 R。货梯方案直接沿南侧到锚点；检修方案先去 SEC 按 E，再经西侧去 HATCH 按 E，从北门到锚点。回退到首段可重新安排。'],
[g(176, 432), g(176, 176), r(), g(560, 432)]);
prepare.outcomes = [
  { id: 'last-light-lift', label: '乘货梯进入', power: { id: 'HATCH', on: false }, consequence: '从封存室南侧进入；核心离位后货梯停运，回配电室需要同伙手动守门。' },
  { id: 'last-light-hatch', label: '预先打开检修口', power: { id: 'HATCH', on: true }, consequence: '从封存室北侧进入；机械锁保留，回程可以使用同一条北侧通道。' },
];
prepare.alternatives = [[g(176, 432), g(176, 176), r(), g(336, 432), e(), g(304, 432), g(304, 176), e(), g(560, 176)]];

function archive(hatch: boolean): Stage {
  return scene(`C3-6-core${hatch ? '-hatch' : ''}`, hatch ? '封存室 · 从留下的侧门进入' : '封存室 · 窗那边的同伙', {
    continuity: { source: prepare.level.id, room: '配电室' },
    spawn: p(656, hatch ? 176 : 432), exit: p(656, hatch ? 176 : 432), lootLabel: '封存证据核心',
    plates: [plate('HOLD', 176, 176), plate('K', 720, 432)],
    circuits: [feed(true), panel('HATCH', 304, 176, hatch, '先前留下的机械锁'), panel('ARCH', hatch ? 720 : 848, hatch ? 176 : 432, true, '封存锁与监控'), panel('LIFT', 560, 432, true, '核心供电 · 取物后停运'), panel('CIV', 272, 304, true, '民用主线 · 取物后断开')],
    doors: [gate('LIFT', 384, 'LIFT', true), gate('HATCH', 160, 'HATCH', true), { id: 'CORE', x: 800, y: 256, w: 64, h: 32, plate: 'K', power: { id: 'FEED', on: true } }],
    guards: [{ id: 'ARCH-CAM', kind: 'camera', route: [p(880, 112)], facing: Math.PI / 2, speed: 0, range: 190, power: { id: 'ARCH', on: true } }],
    lootPower: [{ id: 'ARCH', on: false }, { id: 'FEED', on: true }],
    onLoot: { power: [{ id: 'LIFT', on: false }, { id: 'CIV', on: false }], message: '核心已拆离：货梯与民用主线断电。带着核心回配电室，接上独立的 CIV 馈线。' },
    objectiveLabel: hatch ? '关闭 ARCH 后取核心，从已准备的北侧检修口返回' : '留守者供电、本区同伙守 K；关闭 ARCH，取核心后回南侧安全梯',
  }, hatch ? '你：上一间打开的检修口，正好落在封存锁后面。窗外的我还在接线，这一段不用再留人守门。' : '你：我看见窗那边的自己了。它负责 FEED；这里还缺一个守 K 的人，我去停监控、取核心。',
  '核心到手，整条街的窗户熄了。安全梯通回刚才的配电室，接下来要把灯还回去。',
  [hatch ? '你从封存锁的内侧进入，这是前段准备的结果。' : '窗外回声守 HOLD，FEED 才有电；它仍占一个名额。', hatch ? '在北侧 ARCH 停机，取件，再走同一入口返回。' : '再录一名同伙守 K。真人关闭南侧 ARCH，从东侧 CORE 门进入，取件再返回。', hatch ? '到 (720,176) 按 E，取东北核心，再返回 (656,176)。' : '先去 (720,432) 按 R。下一轮到 (848,432) 按 E，从 (848,304) 北上取核心，再沿原路返回 (656,432)。'],
  hatch ? [g(720, 176), e(), w(60), g(848, 176), g(656, 176)] : [g(720, 432), r(), g(848, 432), e(), g(848, 304), g(848, 176), g(848, 432), g(656, 432)], 'C3-6-entry-clear');
}
function home(hatch: boolean): Stage {
  return scene(`C3-6-return${hatch ? '-hatch' : ''}`, '原路撤离 · 把灯还回去', {
    continuity: { source: prepare.level.id, room: '配电室', home: true }, objective: 'reach',
    spawn: p(560, hatch ? 176 : 432), exit: p(112, 432),
    plates: [plate('HOLD', 176, 176), plate('RETURN', 528, 304)],
    circuits: [feed(), { ...panel('HATCH', 304, 176, hatch, '先前留下的机械锁'), states: ['未解锁', '保持开启'] }, panel('CIV', 272, 304, false, '独立民用馈线')],
    doors: [gate('MANUAL', 384, 'FEED', true, 'RETURN'), gate('HATCH', 160, 'HATCH', true)],
    exitPower: [{ id: 'CIV', on: true }],
    objectiveLabel: '回到同一间配电室：接通 CIV 独立馈线，再从最初的街口离开',
  }, hatch ? '你：检修口还开着，HOLD 前的我也还在。去 CIV 把灯接回来，然后带它一起回家。' : '联络员：这就是刚才的配电室，货梯已经没电。你还剩两格回声，留一个在 RETURN 按住人工门；最早那个你继续给门供电。',
  '街区的窗户重新亮起，远处电车恢复运行。你经过留守者，带着核心回到最初的街口。转运记录指向南一站：车站。',
  [hatch ? '北侧机械锁保持着你离开时的状态。' : '货梯停了，原位置的人工门需要 FEED 与 RETURN 同时成立。', hatch ? '走先前打开的北门，到西侧 CIV 接上民用馈线。' : '本区回声守东侧 RETURN；窗边通道打开后，真人去西侧 CIV。', hatch ? '从 (560,176) 沿北门向西，到 (272,176) 再南下 CIV 按 E，返回街口。' : '先从 (560,432) 到 (528,304) 按 R；真人从南门向西到 (272,432)，北上 CIV 按 E，再返回 (112,432)。'],
  hatch ? [g(272, 176), g(272, 304), e(), g(272, 432), g(112, 432)] : [g(528, 432), g(528, 304), r(), g(272, 432), g(272, 304), e(), g(272, 432), g(112, 432)], 'C3-6-core-clear');
}
const core = archive(false), back = home(false);
core.variants = [{ when: 'last-light-hatch', stage: archive(true) }];
back.variants = [{ when: 'last-light-hatch', stage: home(true) }];
export const LAST_LIGHT: Mission = {
  id: 'C3-6', chapter: '停电之夜', title: '最后一盏灯',
  summary: '把同伙留在配电室，隔窗取走核心，再原路回来恢复城市。前段选的入口，就是后段的退路。',
  evidence: '封存核心与已恢复的民用供电；下一站是转运车站', stages: [prepare, core, back],
};
