import type { CredentialRoute } from './levels.ts';
import type { Ending, Stage } from './campaign-content.ts';
import { g, r, e, point as p, room, level, stage, gate, plate } from './campaign-authoring.ts';

export const RESTORATION_ID = 'B17-RESTORATION';
export const RESTORATION_STAGE = 'C7-6-b';
export const restorationReceipt = (): CredentialRoute => ({
  id: RESTORATION_ID, label: '公共身份恢复回执', exitOwners: ['player'], exitAuthorizations: ['ROOT', 'RESTORED'],
  journey: {
    title: '恢复姓名 → 收妥回执 → 带回旧馆', summary: '这份回执从哪里来、要送到哪里',
    help: '在公共登记核心完成 ROOT 与 RESTORED 签名、亲手提交身份索引后，由本人带着回执离开。成功到达锚点才保存这份回执；处理责任证据与私人档案期间它收在行囊中。最终交付以后回到旧馆，把同一份回执亲手交进 HOME 失物柜。回声只能重放请求，不能复制纸张；回退到恢复身份之前会撤销这份回执。',
  },
});

/** The return uses the exact entrance, gate, plate and cover of the prologue. */
export const museumEntrance = () => ({
  spawn: p(112, 272), walls: room([[14, [8, 9]]], [], [[7, 4], [7, 5], [22, 12], [23, 12]]),
  plates: [plate('A', 272, 368)], doors: [gate('A', 448, 256)], lostProperty: p(784, 240),
});

export function museumReturn(publicEnding: Ending, privateEnding: Ending): Stage {
  const returning = stage(level('C7-6-f', '把名字带回第一扇门', {
    ...museumEntrance(), setting: 'museum', district: '旧馆 / 回到最初的失物柜', subtitle: 'A NAME COMES HOME',
    objective: 'reach', exit: p(112, 272), par: 1,
    objectiveLabel: '让回声守 A，本人把恢复回执交进 HOME，再从来时的门离开',
    terminals: [{id: 'HOME', kind: 'relay', x: 784, y: 272, transfer: 'give', appearance: 'lost-property'}],
    credential: {...restorationReceipt(), from: RESTORATION_STAGE, incomingOwners: ['player'], incomingAuthorizations: ['ROOT', 'RESTORED'], exitOwners: ['terminal:HOME']},
    hint: '录下从入口走到 A 的动作。下一轮穿过原来的门，走到东侧 HOME 按 E 交入回执，再沿通道回到西侧入口。',
    hints: ['还是最初那扇需要两个人的门。这次你带来的东西，比带走的更重要。', '回执在本人手里。让回声留在 A，亲自去 HOME 交入；只有柜子实际收到，离开条件才会满足。', '从 (112,272) 走到 (272,368) 录制留守。真人向东穿过门，到 (784,272) 按 E，再从同一通道回到 (112,272)。'],
  }), '完整档案的两份公共副本已经送达。离开城市前，你带着恢复姓名的回执回到旧馆。还是那条通道、那只失物柜，铜牌上只有 B-17 和一块空白。你：最后一趟，把名字送回来。',
  '失物柜收到了身份恢复回执，空白铜牌重新登记为“沈舟”。你收起投影器，带着馆方签收联去旧渡口。这一次，起点留下了一个完整的名字。',
  ['C7-6-f-clear'], [g(272, 272), g(272, 368), r(), g(784, 272), e(), g(112, 272)], 'C7-6-e-clear');
  returning.ending = publicEnding;
  const privateReturn: Stage = structuredClone(returning);
  privateReturn.level.id = 'C7-6-f-return';
  privateReturn.story = privateReturn.level.description = '私人封套已经按当事人授权归还，责任证据仍公开可核验。离开城市前，你带着恢复姓名的回执回到旧馆。还是那条通道、那只失物柜，铜牌上只有 B-17 和一块空白。你：最后一趟，把名字送回来。';
  privateReturn.ending = privateEnding;
  returning.variants = [{when: 'C7-ending-return', stage: privateReturn}];
  return returning;
}
