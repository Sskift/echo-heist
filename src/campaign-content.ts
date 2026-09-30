import type { Level } from './levels.ts';
import { g, w, r, e, noise, point, room, level, stage, gate, plate } from './campaign-authoring.ts';
import { CHAPTER_ONE } from './chapter-one.ts';
import { CHAPTER_TWO } from './chapter-two.ts';
import { CHAPTER_THREE } from './chapter-three.ts';
export { room } from './campaign-authoring.ts';

export type WitnessAction = { go: [number, number] } | { wait: number } | { press: 'interact' | 'lure' } | { record: true } | { delay: number; echo: number };
export type Stage = { level: Level; story: string; result: string; grants: string[]; witness: WitnessAction[]; requires?: string; alternatives?: WitnessAction[][] };
export type Mission = { id: string; chapter: string; title: string; summary: string; evidence: string; stages: Stage[] };

const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'C0-1', chapter: '序章', title: '缺席的搭档', summary: '有人从这座城市的记录中消失了。先替他打开一扇门。', evidence: '失物柜上的空白姓名',
    stages: [stage(level('C0-1-a', '一道需要两个人的门', {
      spawn: point(112, 272), exit: point(784, 272), objective: 'reach', objectiveLabel: '穿过通道，到达右侧锚点',
      walls: room([[14, [8, 9]]], [], [[7, 4], [7, 5], [22, 12], [23, 12]]),
      plates: [plate('A', 272, 368)], doors: [gate('A', 448, 256)],
      hint: '走到下方 A 开关，按 R 保存回声。下一轮，直接穿过中间的门，到右侧锚点。',
    }), '联络员：旧馆有一只属于你搭档的失物柜。登记册却说，这个人从未存在。', '门开了。柜台上有一道被刮掉的名字，只有编号还留着。', ['entry-open'], [g(272, 272), g(272, 368), r(), g(400, 272), g(528, 272), g(784, 272)])],
  },
  {
    id: 'C0-2', chapter: '序章', title: '有人留守', summary: '回声会停在录像的最后一刻。让过去替你守住通道。', evidence: '一枚刻着两道划痕的怀表',
    stages: [stage(level('C0-2-a', '留在原地的承诺', {
      spawn: point(112, 464), loot: point(688, 144), lootLabel: '怀表', objectiveLabel: '取回怀表，返回下方入口',
      walls: room([], [[8, [20, 21]]], [[10, 11], [11, 11], [6, 4], [7, 4]]),
      plates: [plate('A', 176, 400)], doors: [{ id: 'A', x: 640, y: 256, w: 64, h: 32, plate: 'A' }],
      hint: '到 A 停下后按 R。回声到终点会一直待命；沿下方走到右侧缺口，取回怀表再原路返回。',
    }), '你：这两道划痕是我们第一次合作留下的。他的东西，不该叫“无主财产”。', '怀表背面藏着一张取件凭条：档案 B-17。', ['watch-found'], [g(176, 464), g(176, 400), r(), g(688, 464), g(688, 144), g(688, 464), g(112, 464)])],
  },
  {
    id: 'C0-3', chapter: '序章', title: '第二扇门', summary: '一个同伙帮另一个同伙就位，再轮到现在的你。', evidence: 'B-17 的调阅记录',
    stages: [stage(level('C0-3-a', '先替同伙开门', {
      exit: point(816, 464), objectiveLabel: '取走调阅记录，从右下方离开', lootLabel: '调阅记录', par: 2,
      walls: room([[10, [12, 13]], [20, [5, 6]]], [], [[14, 7], [15, 7], [24, 10]]),
      plates: [plate('A', 176, 176), plate('B', 496, 432)], doors: [gate('A', 320, 384), gate('B', 640, 160)],
      hint: '先录一条停在 A 的回声，再穿过 A 门录一条停在 B 的回声。第三轮从上方 B 门取记录，再去右下方出口。',
    }), '联络员：调阅室由两个人分别签入。你一个人来，倒也够用。', '记录被调阅了两次。第二次的日期，正是搭档失踪的那晚。', ['file-found'], [g(176, 432), g(176, 176), r(), g(400, 432), g(496, 432), r(), g(560, 432), g(560, 208), g(720, 208), g(816, 144), g(848, 144), g(848, 464), g(816, 464)])],
  },
  {
    id: 'C0-4', chapter: '序章', title: '留一条退路', summary: '进去与出来可以是两条路线。到安全锚点后，这一段计划就完成了。', evidence: '通往封存区的检修图',
    stages: [
      stage(level('C0-4-a', '从另一侧离开', {
        spawn: point(112, 400), loot: point(688, 160), exit: point(848, 400), lootLabel: '检修图', objectiveLabel: '带着检修图，从右侧撤离',
        walls: room([[14, [6, 7]]], [], [[20, 10], [21, 10]]), plates: [plate('A', 176, 464)], doors: [gate('A', 448, 192)],
        hint: '让回声守住 A，沿中上方的缺口进入。取图后去右侧锚点，不必再穿一次入口门。',
      }), '联络员：旧馆正门会落锁。检修图上标着另一条出口，拿到图后去东侧碰头。', '检修图确认了一条侧路。已建立安全锚点，下一段失败不会丢失这张图。', ['service-route'], [g(176, 400), g(176, 464), r(), g(400, 400), g(400, 240), g(528, 240), g(688, 160), g(848, 160), g(848, 400)]),
      stage(level('C0-4-b', '检修通道', {
        spawn: point(112, 272), exit: point(848, 400), objective: 'reach', objectiveLabel: '利用已打开的侧门，抵达封存区',
        walls: room([[10, [8, 9]], [22, [11, 12]]], [], [[16, 6], [16, 7]]),
        plates: [plate('B', 528, 176)], doors: [{ id: 'SIDE', x: 320, y: 256, w: 32, h: 64 }, gate('B', 704, 352)],
        hint: '上阶段取得的图已打开 SIDE 门。新回声穿过它去守 B；你走下方通道抵达右侧锚点。',
      }), '你：原来它真的通向封存区。我们得到的图，已经改变了下一步能走的路。', '你穿过了检修通道。旧馆的失物，最后都会被送到这里。', ['archive-entry'], [g(400, 272), g(464, 272), g(464, 176), g(528, 176), r(), g(400, 272), g(656, 272), g(656, 400), g(848, 400)], 'service-route'),
    ],
  },
  {
    id: 'C0-5', chapter: '序章', title: '替你被听见', summary: '声响也会被录下。让同伙把守卫带向你选定的位置。', evidence: '被改写的封存清单',
    stages: [
      stage(level('C0-5-a', '隔墙的敲门声', {
        spawn: point(112, 432), exit: point(816, 432), objective: 'reach', objectiveLabel: '通过巡逻走廊，到右下方锚点',
        walls: room([[14, [12, 13]]], [], [[19, 7], [20, 7], [21, 7]]),
        plates: [plate('A', 272, 304)], doors: [gate('A', 448, 384)],
        guards: [{ route: [point(688, 208), point(848, 208)], speed: 52, range: 180 }],
        hint: '录制去 A 的路线时按空格，让噪声也成为计划的一部分。穿过门后沿最下方移动，墙体与距离能保护你。',
      }), '联络员：他们看得见投影，也听得见它。让过去替你敲一声门。', '巡逻日志里留下了另一条调查路线。你的投影，第一次替你调动了别人。', ['patrol-diverted'], [g(272, 432), g(272, 304), noise(), r(), g(528, 432), g(816, 432)]),
      stage(level('C0-5-b', '带走一张空白', {
        spawn: point(112, 464), loot: point(784, 432), lootLabel: '封存清单', objectiveLabel: '避开上方巡逻，带走封存清单',
        walls: room([[12, [12, 13]]], [], [[18, 8], [19, 8], [20, 8], [23, 8]]),
        plates: [plate('A', 240, 304)], doors: [gate('A', 384, 384)],
        guards: [{ route: [point(624, 192), point(816, 192)], speed: 64, range: 185 }],
        hint: '安排 A 开关后，从最下方经过。回声也会暴露，录好的路线同样要避开视野。随时按“预演”检查。',
      }), '你：这张清单上没有他的名字，却留着姓名字段被重写的痕迹。', '空白不代表从未存在。封存清单的原始底稿，还在内库。', ['blank-list'], [g(240, 464), g(240, 304), r(), g(336, 464), g(336, 432), g(528, 432), g(784, 432), g(528, 432), g(336, 432), g(336, 464), g(112, 464)], 'patrol-diverted'),
    ],
  },
  {
    id: 'C0-6', chapter: '序章', title: '旧馆最后一班', summary: '在闭馆前潜入、取得原件并撤离。把学过的配合编成一场完整劫案。', evidence: '身份编号 B-17：尚未注销',
    stages: [
      stage(level('C0-6-a', '潜入装卸间', {
        spawn: point(112, 400), exit: point(816, 176), objective: 'reach', objectiveLabel: '打开货梯，抵达内库入口',
        walls: room([[16, [11, 12]]], [], [[8, 5], [9, 5], [22, 9], [23, 9]]), plates: [plate('A', 272, 144)], doors: [gate('A', 512, 352)],
        hint: '用一条回声守住左上方的 A；你从下方货梯进入，再沿右侧抵达内库。',
      }), '联络员：最后一班货梯还有电。先进去，后面每到一个安全位置，我都会替你留下锚点。', '你已经进入内库。装卸间的门可以关上了，下一段重新安排同伙。', ['inside-vault'], [g(336, 400), g(336, 144), g(272, 144), r(), g(464, 400), g(592, 400), g(816, 400), g(816, 176)]),
      stage(level('C0-6-b', '找回原始底稿', {
        spawn: point(112, 400), exit: point(848, 144), loot: point(816, 144), lootLabel: '原始底稿', objectiveLabel: '配合打开两道门，取得底稿并到达锚点', par: 2,
        walls: room([[10, [11, 12]], [20, [5, 6]]], [], [[14, 6], [15, 6]]),
        plates: [plate('A', 208, 208), plate('B', 496, 464)], doors: [gate('A', 320, 352), gate('B', 640, 160)],
        hint: '第一条回声守 A；第二条穿过 A 去 B。最后一轮沿中区右侧向上，经 B 门取得原件。',
      }), '你：两道封条，三个自己。这次我知道该让谁先走。', '原件上的身份编号仍然有效。有人删掉了他的名字，却没来得及抹去所有关联。', ['original-secured'], [g(208, 400), g(208, 208), r(), g(400, 400), g(496, 400), g(496, 464), r(), g(560, 400), g(560, 208), g(720, 208), g(816, 144), g(848, 144)], 'inside-vault'),
      stage(level('C0-6-c', '把名字带出去', {
        spawn: point(112, 464), exit: point(848, 432), objective: 'reach', objectiveLabel: '保住已取得的原件，从东侧出口撤离',
        walls: room([[14, [12, 13]]], [], [[20, 8], [21, 8], [22, 8]]), plates: [plate('A', 272, 336)], doors: [gate('A', 448, 384)],
        guards: [{ route: [point(656, 176), point(848, 176)], speed: 74, range: 190 }],
        hint: '原件已经在安全锚点保存。让回声控制 A，当前角色从下方穿过并去东侧；留意守卫也会看见回声。',
      }), '联络员：出口在东侧。把名字带出去，才算让这份证据重新存在。', '旧馆身后落锁。B-17 的下一条记录，指向明晚的私人拍卖会。序章完成。', ['prologue-complete'], [g(272, 464), g(272, 336), r(), g(400, 464), g(400, 432), g(528, 432), g(848, 432)], 'original-secured'),
    ],
  },
  {
    id: 'LAB-TIME', chapter: '机制试验', title: '晚到三秒', summary: '把录像整体后移，寻找一次准确的开门窗口。', evidence: '时序配合验证',
    stages: [stage(level('LAB-TIME-a', '在第四秒相遇', {
      spawn: point(112, 432), exit: point(784, 304), objective: 'reach', objectiveLabel: '在 4–6 秒窗口穿过 T 门',
      walls: room([[14, [8, 9]]]), plates: [plate('A', 272, 304)], doors: [{ ...gate('T', 448, 256, 'A'), window: [4, 6] }],
      hint: '录下到 A、停留一秒、再离开的路线。用回声卡片的 +0.25s 调整出场时间；预演确认 A 与 4–6 秒窗口重叠。你可以提前在门口等候。',
    }), '联络员：拍卖会的认证只开放两秒。你可以调整同伙什么时候出现。', '一次旧动作，因为晚到几秒，接上了原本错过的窗口。', ['timing-tested'], [g(272, 432), g(272, 304), w(60), g(272, 176), r(), { delay: 180, echo: 0 }, g(400, 432), g(400, 304), w(175), g(528, 304), g(784, 304)])],
  },
  {
    id: 'LAB-POWER', chapter: '机制试验', title: '借一盏灯', summary: 'E 操作电源；回声会记住你请求的状态。', evidence: '设备意图回放验证',
    stages: [stage(level('LAB-POWER-a', '两条不同的电路', {
      spawn: point(112, 432), exit: point(784, 304), objective: 'reach', objectiveLabel: '关闭监控、接通门禁，再到右侧锚点',
      walls: room([[14, [8, 9]]]), circuits: [{ id: 'P', x: 272, y: 176, initial: false }],
      doors: [{ id: 'POWER', x: 448, y: 256, w: 32, h: 64, power: { id: 'P', on: true } }],
      guards: [{ route: [point(560, 304), point(400, 304)], speed: 0, range: 220, kind: 'sentry', power: { id: 'P', on: false } }],
      hint: '到 P 附近按 E，将供电切到门禁。此时监控关闭。录下这个操作，让回声替你完成，你可直接赶往入口。',
    }), '联络员：这条线路只能供门禁或监控其中一个。你录下的是“接通”，不是盲目再切一次。', '投影正确重放了设备请求。场景可以成为计划中的一环。', ['power-tested'], [g(272, 432), g(272, 176), e(), r(), g(400, 432), g(400, 304), w(50), g(528, 304), g(784, 304)])],
  },
  {
    id: 'LAB-RELAY', chapter: '机制试验', title: '空手的信使', summary: '先录好一次接收，再在下一轮把凭据送到。', evidence: '唯一凭据与交接验证',
    stages: [stage(level('LAB-RELAY-a', '给过去一封信', {
      spawn: point(112, 464), loot: point(816, 144), exit: point(848, 272), lootLabel: '授权底稿', objectiveLabel: '经 R 接力，在 L 授权，取底稿后撤离',
      walls: room([[20, [8, 9]]], [], [[11, 6], [12, 6]]),
      terminals: [{ id: 'S', kind: 'source', x: 112, y: 144 }, { id: 'R', kind: 'relay', x: 336, y: 400 }, { id: 'L', kind: 'lock', x: 528, y: 144, authorization: 'KEY' }],
      doors: [{ id: 'KEY', x: 640, y: 256, w: 32, h: 64, authorization: 'KEY' }],
      hint: '先去 R，等到约第 4 秒按 E 录下接收请求；再走下方绕到 L 按 E 请求授权，最后按 R 保存。下一轮先从 S 用 E 取凭据，再去 R 用 E 交付。信使随后会接收并授权。',
    }), '联络员：录像里的你可以先伸出手。现在的你，再决定往那只手里放什么。', '录制时失败的授权，这一次成功了。改变的是条件，路线仍然完全一样。', ['relay-tested'], [g(336, 464), g(336, 400), w(180), e(), g(528, 400), g(528, 144), e(), r(), g(112, 144), e(), g(112, 400), g(336, 400), e(), g(560, 400), g(560, 304), w(80), g(704, 304), g(816, 304), g(816, 144), g(816, 272), g(848, 272)])],
  },
  {
    id: 'LAB-NULL', chapter: '机制试验', title: '给幽灵留条路', summary: '抑制场里，回声会继续走，但暂时不能影响世界。', evidence: '投影抑制与恢复验证',
    stages: [stage(level('LAB-NULL-a', '让同伙重新出现', {
      spawn: point(112, 432), exit: point(784, 304), objective: 'reach', objectiveLabel: '关闭 N 抑制场，让回声打开 A 门',
      walls: room([[14, [8, 9]]]), plates: [plate('A', 272, 176)], doors: [gate('A', 448, 256)],
      circuits: [{ id: 'N', x: 112, y: 336, initial: true }], suppressors: [{ id: 'N', x: 224, y: 128, w: 128, h: 128, power: { id: 'N', on: true } }],
      hint: '先录一条停在 A 的回声。下一轮由真人到 N 按 E 关闭抑制场，回声会恢复压住 A。投影时钟不会因为失效暂停。',
    }), '联络员：这是专门对付投影的设施。你本人可以进去，同伙在里面却什么也碰不到。', '你替过去的自己清除了障碍。恢复的是作用能力，时间从未倒退。', ['null-tested'], [g(272, 432), g(272, 176), r(), g(112, 336), e(), g(400, 336), g(400, 304), g(528, 304), g(784, 304)])],
  },
];

export const MISSIONS: Mission[] = [...INITIAL_MISSIONS.filter(m => m.id.startsWith('C0-')), ...CHAPTER_ONE, ...CHAPTER_TWO, ...CHAPTER_THREE, ...INITIAL_MISSIONS.filter(m => m.id.startsWith('LAB-'))];

export const CAMPAIGN_LEVELS = MISSIONS.flatMap(m => m.stages.map(s => s.level));
