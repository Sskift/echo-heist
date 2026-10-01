import type { Mission, Stage } from './campaign-content.ts';
import type { Circuit, Level } from './levels.ts';
import { e, g, r, plate, room } from './campaign-authoring.ts';

const feed = (id: string, x: number, y: number, label: string, pad: string): Circuit => ({ id, x, y, label, initial: false, states: ['等待值守', '值守接通'], feed: { plate: pad } });

export function prepareGrid(mission: Mission) {
  mission.preparations = [
    { id: 'grid-timed', label: '按分时表借电', sources: [], effect: '沿原线路依次供给门禁、取件与回程，保留原有入口和监控联动。', cost: '前两区可各用一名回声；切换和归位要接上真人经过的时刻。末区需要手动确认与远程停机配合。' },
    { id: 'grid-bypass', label: '按专线图准备旁路', sources: ['C2-6', 'C3-4'], effect: '首段拆开两组门禁，中段独立供电取件，末段开放北侧检修入口。', cost: '每区可用两名回声固定值守，减少赶切换时刻。真人要绕行操作独立面板；取件供电必须归位，末区监控也要复位后才能撤离。' },
  ];
  variant(mission.stages[0], '两条各自有人值守的线', {
    par: 2, plates: [plate('A', 208, 208), plate('B', 480, 208)],
    circuits: [feed('F', 208, 176, '首尾门确认馈线', 'A'), feed('M', 480, 176, '中门旁路馈线', 'B')],
    doors: mission.stages[0].level.doors.map((d, i) => ({ ...d, power: { id: i === 1 ? 'M' : 'F', on: true } })),
    objectiveLabel: 'A 维持首尾门，B 接通中门旁路，真人取走分时供电表',
  }, '联络员：转运总表指认了共用负载，专线图标出了另一组接口。旁路已接好，但两个确认位必须分别有人守着。',
  '两组门在各自的值守下同时供电。你拿到了分时表；下一间要把取件电源从这些门禁中单独拆出来。',
  ['A 接通 F，负责 FIRST 与 LAST；B 接通 M，负责 MIDDLE。两组都是自动馈线，不用按 E。', '先让 A 接引第二名回声过 FIRST，第二名再去 B。真人等两人各就各位，沿南侧穿过三门。', '先经 (208,432) 到 A 按 R；第二条经 (400,432)、(480,432) 到 B 按 R。真人沿南侧经过三门，到东侧取表并撤离。'],
  [g(208, 432), g(208, 208), r(), g(400, 432), g(480, 432), g(480, 208), r(), g(528, 432), g(688, 432), g(848, 432)]);

  variant(mission.stages[1], '门可以留着，取件仍要归位', {
    par: 2, plates: [plate('A', 208, 176), plate('B', 656, 432)],
    circuits: [feed('N', 208, 112, '北门确认馈线', 'A'), feed('R', 656, 496, '南侧返程馈线', 'B'), { id: 'S', x: 656, y: 304, initial: false, label: '独立取件电源', states: ['归位', '取件'] }],
    doors: mission.stages[1].level.doors.map((d, i) => ({ ...d, power: { id: i ? 'R' : 'N', on: true } })),
    objectiveLabel: '安排北门与返程值守；S 接通取件，取走后亲手归位，再返回入口',
  }, '你：门禁已经分开，档案夹还要用自己的电。让同伙留住来回的路，我到里面接通 S；拿走后再亲手归位。',
  '独立恢复顺序已经带回。S 已归位，门禁的两名值守没有替你省掉这一步。',
  ['N 由 A 值守接通，R 由 B 值守接通；S 是内侧可按 E 的取件电源。取物需 S 在取件，撤离需 S 归位。', '先录 A。第二名从北门进入，沿东侧去 B 守返程门。真人从北门进入，在 S 接通后取件，再回来归位，从南门撤离。', 'A 位于 (208,176)。第二名经北门，到 (656,432) 按 R。真人经北门到 S (656,304) 按 E，取东北原件，再回 S 按 E；经 (656,400) 走 SOUTH，返回 (112,432)。'],
  [g(208, 432), g(208, 176), r(), g(112, 176), g(528, 176), g(656, 176), g(656, 432), r(), g(112, 176), g(656, 176), g(656, 304), e(), g(816, 304), g(816, 176), g(656, 176), g(656, 304), e(), g(656, 400), g(400, 400), g(112, 400), g(112, 432)]);

  variant(mission.stages[2], '沿旁路回来把监控复位', {
    par: 2, walls: room([[14, [3, 4]]]), plates: [plate('A', 272, 176), plate('B', 272, 432)],
    circuits: [feed('P', 208, 432, '北侧检修馈线', 'B'), { id: 'Q', x: 656, y: 112, initial: true, label: '独立监控与钥匙锁', states: ['停机取件', '运行归位'] }],
    doors: [{ id: 'BYPASS', x: 448, y: 96, w: 32, h: 64, plate: 'A', power: { id: 'P', on: true } }],
    guards: mission.stages[2].level.guards.map(guard => ({ ...guard, power: { id: 'Q', on: true } })),
    lootPower: [{ id: 'Q', on: false }], exitPower: [{ id: 'Q', on: true }],
    objectiveLabel: 'A、B 共同维持北门；在 Q 停机取钥匙，再回 Q 复位，沿北侧和东侧撤离',
  }, '联络员：北侧旁路避开监控正面，却没有替你把它关掉。到 Q 停机才能拔钥匙；取件后再把 Q 归位，沿镜头背面离开。',
  '钥匙已经带出，独立监控恢复运行。旁路减少了切电时序，却多了一次亲手返回面板的路。下一步仍要把核心和城市一起带出黑暗。',
  ['北门同时要求 A 值守与 B 的 P 馈线。Q 初态运行：停机才可取钥匙，复位才可撤离。', '两名回声分别守西侧 A、B；真人从北门到 Q 按 E。取件后回 Q 复位，再沿最北侧走到最东侧，避开朝西的镜头。', '先去 A (272,176) 按 R，再去 B (272,432) 按 R。真人经 (112,112) 到 Q (656,112) 停机，去 (816,304) 取钥匙，原路回 Q 复位；沿 (848,112) 到 (848,432) 撤离。'],
  [g(272, 432), g(272, 176), r(), g(272, 432), r(), g(112, 112), g(656, 112), e(), g(816, 112), g(816, 304), g(816, 112), g(656, 112), e(), g(848, 112), g(848, 432)]);
}

function variant(base: Stage, title: string, properties: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: Stage['witness']) {
  const alternate: Stage = { ...base, level: { ...structuredClone(base.level), ...properties, id: `${base.level.id}-bypass`, title, description: story, hints, hint: hints[2], briefing: [hints[0], properties.objectiveLabel!] }, story, result, witness };
  delete alternate.variants; delete alternate.alternatives;
  (base.variants ??= []).push({ when: 'grid-bypass', stage: alternate });
}
