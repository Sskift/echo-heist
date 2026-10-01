import type { Mission, Stage } from './campaign-content.ts';
import { g, w, r, e, room, gate } from './campaign-authoring.ts';
import { prepareGrid } from './grid-preparation.ts';
import { prepareHandoffs } from './handoff-preparations.ts';
import { prepareReviews } from './review-preparations.ts';
import { prepareDock } from './dock-preparation.ts';

// Preparations are authored layouts, not runtime mutations of a saved room.
// Canonical checkpoint IDs stay stable; every layout has its own recording ID.
export function prepareMissions(missions: Mission[]) {
  const museum = missions.find(m => m.id === 'C0-6')!;
  museum.preparations = [
    { id: 'museum-freight', label: '末班货梯', sources: [], effect: '从装卸间南侧进入，沿原有封条通道取底稿。', cost: '先去西北方安排货梯值守；内库需要分配两道门的岗位。' },
    { id: 'museum-service', label: '按检修图开侧道', sources: ['C0-4'], effect: '开启装卸间北侧检修口，改从内库北门进入、南门取件。', cost: '货梯停用。前两区需要靠近 H 按 E 松开门闩，同时安排回声守住承重开关。' },
  ];
  const entry = structuredClone(museum.stages[0]);
  entry.level = { ...entry.level, id: 'C0-6-a-service', title: '图上的北侧检修口',
    walls: room([[16, [5, 6]]], [], [[8, 5], [9, 5], [22, 9], [23, 9]]),
    circuits: [{ id: 'H', x: 432, y: 176, initial: false, label: '检修门闩', states: ['扣紧', '松开'], mechanical: true }],
    doors: [{ ...gate('SIDE', 512, 160, 'A'), power: { id: 'H', on: true } }],
    objectiveLabel: '松开北侧门闩，配合承重开关进入内库',
    hint: '图纸标出的检修口在北侧。先录下守 A 的回声，再到 H 旁按 E 松闩；A 与 H 同时满足才可通过 SIDE。每轮门闩复位，录下的 E 请求会重演。',
  };
  entry.story = '联络员：检修图标明了北侧门闩。货梯让给闭馆人员；让过去的你托住配重，你亲手把侧门打开。';
  entry.result = '图上的侧道确实通向内库。下一段从北门进入，底稿仍在同一处封存柜。';
  entry.witness = [g(336, 400), g(336, 144), g(272, 144), r(), g(432, 400), g(432, 176), e(), g(592, 176), g(816, 176)];
  add(museum.stages[0], 'museum-service', entry);

  const vault = structuredClone(museum.stages[1]);
  vault.level = { ...vault.level, id: 'C0-6-b-service', title: '从封条背面靠近',
    walls: room([[10, [5, 6]], [20, [11, 12]]], [], [[14, 6], [15, 6]]),
    circuits: [{ id: 'H', x: 272, y: 400, initial: false, label: '内库门闩', states: ['扣紧', '松开'], mechanical: true }],
    doors: [{ ...gate('SIDE', 320, 160, 'A'), power: { id: 'H', on: true } }, gate('B', 640, 352)],
    objectiveLabel: '从北侧检修门接引同伙，再经南侧取回原始底稿',
    hint: 'A 托住北门配重，H 需要 E 松闩。让第二条回声操作 H、从北门进入再守 B；最后由你经北门绕到南侧 B 门，去东北方拿底稿。两次开闩请求相同，不会互相抵消。',
  };
  vault.story = '你：从检修口进来，原来的正门在墙另一边。让一个自己托住北门，另一个去接南边的班。';
  vault.result = museum.stages[1].result;
  vault.witness = [g(208, 400), g(208, 208), r(), g(272, 400), e(), g(272, 176), g(400, 176), g(560, 176), g(560, 464), g(496, 464), r(), g(272, 400), e(), g(272, 176), g(400, 176), g(560, 176), g(560, 400), g(720, 400), g(816, 400), g(816, 144), g(848, 144)];
  delete vault.alternatives;
  add(museum.stages[1], 'museum-service', vault);

  const gala = missions.find(m => m.id === 'C1-6')!;
  gala.preparations = [
    { id: 'gala-guests', label: '随宾客到场', sources: [], effect: '迎宾带每 6 秒扫描前 2 秒。两份邀请的有效时段在第 4–5.5 秒重叠。', cost: '先等迎宾扫描结束，再安排两名同伙同时签到。' },
    { id: 'gala-handover', label: '利用交班空档', sources: ['C1-1', 'C1-4'], effect: '迎宾扫描改为第 3–6 秒；可以先行通过。核验台在第 6–7 秒集中接受两份邀请。', cost: '迎宾带每轮扫描更久，核验门仅开 1 秒。两名同伙先就位，真人要在门口等准时刻。后两区保持原规则。' },
  ];
  const welcome = structuredClone(gala.stages[0]);
  welcome.level = { ...welcome.level, id: 'C1-6-a-handover', title: '赶在交班扫光之前',
    scanners: [{ id: 'WELCOME', x: 320, y: 32, w: 96, h: 512, period: 6, active: [3, 6] }],
    hint: '你选了交班空档。迎宾带在第 3–6 秒扫描；先录一条直接去 A 的路线，下一轮立刻穿过扫描带，再通过 A 门。拖到第 3 秒才出发会撞上扫光。',
  };
  welcome.story = '联络员：认证时刻表对上了换岗记录。迎宾带前三秒没人复核，别把这段空档等过去。';
  welcome.witness = [g(528, 432), r(), g(656, 432), g(848, 432)];
  add(gala.stages[0], 'gala-handover', welcome);
  const invitations = structuredClone(gala.stages[1]);
  invitations.level = { ...invitations.level, id: 'C1-6-b-handover', title: '在同一秒被接班人看见',
    plates: invitations.level.plates.map(p => ({ ...p, window: [3, 8] })),
    doors: invitations.level.doors.map(d => ({ ...d, window: [6, 7] })),
    scanners: [{ id: 'CHECK', x: 288, y: 384, w: 96, h: 96, period: 12, active: [0, 1] }],
    hint: '两名同伙分别去 A、B。B 的扫描在第 1 秒结束，核验门只在第 6–7 秒接受同时签到。真人提前到 INVITE 西侧等候，第 6 秒一亮就过门。',
  };
  invitations.story = '你：提前进来省下了迎宾等待，却赶上接班人的集中核验。我们三个，要接住同一秒。';
  invitations.witness = [g(176, 464), g(176, 176), r(), g(272, 464), w(40), g(272, 432), g(336, 432), r(), g(112, 304), g(400, 304), w(240), g(528, 304), g(816, 304)];
  add(gala.stages[1], 'gala-handover', invitations);
  prepareGrid(missions.find(m => m.id === 'C3-5')!);
  prepareDock(missions.find(m => m.id === 'C2-1')!);
  prepareHandoffs(missions);
  prepareReviews(missions);
}

function add(base: Stage, when: string, alternate: Stage) {
  alternate.level.description = alternate.story;
  alternate.level.briefing = [alternate.level.hint];
  (base.variants ??= []).push({ when, stage: alternate });
}
