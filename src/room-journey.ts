import type { Campaign } from './campaign.ts';
import type { Game } from './engine.ts';
import type { Level, Point } from './levels.ts';

export type PassageLandmark = { at: Point; label: string; kind: 'stairs' | 'hatch' | 'threshold' };
export type RoomJourney = { from: string; to: string; title: string; detail: string; arrival: Point; travel: boolean };

/** Authored spatial relationships: equal coordinates alone do not imply adjacency. */
export function roomJourney(campaign: Campaign, departing: Game): RoomJourney | undefined {
  const index = campaign.indexOf(departing.level.id);
  if (departing.status !== 'won' || index < 0 || campaign.stageIndex !== index + 1 || campaign.ending) return;
  const next = campaign.stage.level, incoming = campaign.credentialFor(next.id);
  const result: RoomJourney = {
    from: departing.level.title, to: next.title, arrival: next.spawn, travel: false,
    title: `前往${next.title}`, detail: '已抵达下一处安全锚点。准备好后再开始行动。',
  };
  if (campaign.mission.id === 'C3-6') {
    const hatch = next.id.endsWith('-hatch'), returning = !!next.continuity?.home;
    result.from = returning ? '封存室' : '配电室'; result.to = returning ? '原配电室' : '封存室';
    result.title = hatch ? `从北侧检修口${returning ? '原路返回' : '进入'}` : returning ? '沿南侧安全梯返回' : '乘南侧货梯进入';
    result.detail = returning ? '窗边的回声仍在 HOLD 留守。带核心回到 CIV，把街区的灯接回来。' : '同一扇观察窗的另一侧，回声仍守住 HOLD，为这里维持供电。';
  } else if (campaign.mission.id === 'C4-6') {
    if (next.id.startsWith('C4-6-receive')) {
      const service = incoming?.owner === 'terminal:SERVICE';
      result.from = '登记厅楼梯'; result.to = service ? '站台南侧' : '站台北侧';
      result.title = `沿楼梯到${service ? '南侧 SERVICE' : '北侧 FAST'} 柜背面`;
      result.detail = `你空手离开登记厅，原票仍留在 ${service ? 'SERVICE' : 'FAST'} 柜中。到对侧后，由本人接回来。`;
    } else {
      result.from = '货运站台'; result.to = '货运档案'; result.title = '沿东南通道继续';
      result.detail = '从刚才离开的东南锚点进入，原票仍在 ARCHIVE 柜中，等你安排最后一次接班。';
    }
  } else if (next.lostProperty && departing.level.id.startsWith('C7-6-e')) {
    result.from = '中央总库'; result.to = '序章旧馆'; result.travel = true;
    result.title = '离开总库，回到第一扇门';
    result.detail = '穿过夜间街区，带着身份恢复回执回到旧馆。还是原来的入口、通道和 B-17 失物柜。';
  }
  return result;
}

export function passageLandmarks(level: Level): PassageLandmark[] {
  const mark = (at: Point, label: string, kind: PassageLandmark['kind'] = 'threshold'): PassageLandmark => ({at, label, kind});
  const exit = level.exit ?? level.spawn;
  if (level.id === 'C3-6-entry') return [mark(exit, '南侧货梯', 'stairs'), mark(level.alternateExit!.at, '北侧检修口', 'hatch')];
  if (level.id.startsWith('C3-6-core')) return [mark(level.spawn, level.id.endsWith('-hatch') ? '北侧检修口' : '南侧安全梯', level.id.endsWith('-hatch') ? 'hatch' : 'stairs')];
  if (level.id.startsWith('C3-6-return')) return [mark(level.spawn, level.id.endsWith('-hatch') ? '北侧检修口' : '南侧安全梯', level.id.endsWith('-hatch') ? 'hatch' : 'stairs'), mark(exit, '回到街口')];
  if (level.id === 'C4-6-send') return [mark(exit, '站台楼梯', 'stairs')];
  if (level.id.startsWith('C4-6-receive')) return [mark(level.spawn, level.id.endsWith('-service') ? '南侧站台' : '北侧站台', 'stairs'), mark(exit, '货运档案通道')];
  if (level.id.startsWith('C4-6-cargo')) return [mark(level.spawn, '东南通道')];
  if (level.id.startsWith('C7-6-e')) return [mark(exit, '街口 · 旧馆方向')];
  if (level.lostProperty) return [mark(level.spawn, '旧馆入口')];
  return [];
}
