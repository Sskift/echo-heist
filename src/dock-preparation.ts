import type { Mission, Stage } from './campaign-content.ts';
import type { Level } from './levels.ts';
import { g, w, r, noise, room, point as p } from './campaign-authoring.ts';

export function prepareDock(mission: Mission) {
  mission.preparations = [
    { id: 'records-public', label: '从值班侧门进入', sources: [], effect: '沿现有侧廊调离守卫，两区分别安排取件与撤离。', cost: '每区可各用一名声响回声；第二间仍从被监视的前场进入。' },
    { id: 'records-dock', label: '按交付账本走收货侧廊', sources: ['C1-6'], effect: '账本上的交付地址定位北侧货运门；穿过收货端后，第二间从规程柜后方进入。', cost: '首区货运门只在第 3–6 秒开启，需先用声响把守卫引向南侧。第二间可不留回声，沿东侧墙口带规程出去。' },
  ];
  add(mission.stages[0], '跟着交付地址走到背面', {
    walls: room([[14, [3, 4, 12, 13]]], [], [[6, 14], [6, 15]]), doors: [{ id: 'DOCK', x: 448, y: 96, w: 32, h: 64, window: [3, 6] }],
    guards: [{ id: 'A', route: [p(560, 176)], facing: Math.PI, speed: 100, range: 230, hearing: 500, searchSeconds: 0.8 }],
    soundMarkers: [{ id: 'N1', x: 304, y: 432 }], exit: p(848, 144),
    objectiveLabel: '用 N1 把守卫引向南侧，趁第 3–6 秒通过北侧 DOCK，抵达收货端',
  }, '你：账本不只写了谁付款，还写了公共机构从哪扇门收货。北门按货运时刻开，我们得先把守门的人请到另一侧。',
  '你抵达了账本标出的收货端。下一间规程柜的背面就在这条侧廊里，不必重新绕到值班室门前。',
  ['A 看着北侧入口，DOCK 在第 3–6 秒开启；声音会让守卫向南侧墙口绕行。', '回声在西南 N1 发声后退到收货箱后，真人稍后向北穿货运门。去内侧锚点后，下一间从相同的收货端开始。', '录到 N1 (304,432) 发声，经 (112,432) 退到箱后 (112,496)。真人等 1.5 秒，到 (400,432)、(400,112)，趁 DOCK 开启穿向 (848,112)，再到收货端 (848,144)。'],
  [g(304, 432), noise(), g(112, 432), g(112, 496), r(), w(90), g(400, 432), g(400, 112), g(848, 112), g(848, 144)]);
  add(mission.stages[1], '回执上的收货端', {
    par: 0, spawn: p(848, 144), loot: p(816, 144), exit: p(848, 464), walls: room([], [[8, [9, 10, 23, 24]]]),
    guards: [{ id: 'A', route: [p(720, 208)], facing: Math.PI / 2, speed: 100, range: 230, hearing: 600, searchSeconds: 0.8 }], soundMarkers: [],
    objectiveLabel: '从收货端取走规程，经东侧墙口向南，再沿东墙撤离',
  }, '联络员：前场还在值班，账本带你来的却是规程柜背面。原件就在身旁；沿东侧墙口离开，不要走进守卫正下方。',
  '你带走了调查规程：抵达声源、搜索、返回岗位。会场账本的交付地址已经变成可走的入口，也让这一次取件省下了同伙。',
  ['出生点延续上一段收货端，规程在身旁。守卫朝南看守前场，墙口在它东侧。', '无需先调离守卫。取规程后从 x=784 的东侧墙口往南，在到达 y=304 时转向东墙，避免继续走入视野。', '从 (848,144) 向西到 (784,144)，经过规程并下行到 (784,304)；转向 (848,304)，再沿东墙南下 (848,464)。'],
  [g(784, 144), g(784, 304), g(848, 304), g(848, 464)]);
}

function add(base: Stage, title: string, properties: Partial<Level>, story: string, result: string, hints: [string, string, string], witness: Stage['witness']) {
  const alternate: Stage = { ...base, level: { ...structuredClone(base.level), ...properties, id: `${base.level.id}-dock`, title, description: story, hints, hint: hints[2], briefing: [hints[0], properties.objectiveLabel!] }, story, result, witness };
  delete alternate.variants; delete alternate.alternatives;
  (base.variants ??= []).push({ when: 'records-dock', stage: alternate });
}
