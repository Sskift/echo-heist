export const TILE = 32;
export const WIDTH = 960;
export const HEIGHT = 576;
export const LOOP_SECONDS = 12;
export const FPS = 60;
export const MAX_FRAMES = LOOP_SECONDS * FPS;
export const MAX_ECHOES = 3;
export const ECHO_COLORS = ['#8ed4ed', '#d2a0ef', '#efa886'];

export type Point = { x: number; y: number };
export type Power = { id: string; on: boolean };
export type CredentialSnapshot = { id: string; owner: string; authorizations: string[]; receivedFrom?: string };
export type CredentialRoute = {
  id: string; label: string; from?: string; incomingOwners?: string[]; incomingAuthorizations?: string[];
  exitOwners: string[]; exitAuthorizations?: string[]; receiveByPlayer?: string;
};
export type Door = { id: string; x: number; y: number; w: number; h: number; plate?: string; plates?: string[]; plateMode?: 'all' | 'any' | 'one' | 'none'; power?: Power; window?: [number, number]; windows?: [number, number][]; authorization?: string };
type Plate = Point & { id: string; window?: [number, number] };
export type GuardDefinition = { id?: string; route: Point[]; speed: number; range: number; kind?: 'sentry' | 'patrol' | 'camera' | 'tracker'; power?: Power; lighting?: Power & { darkRange: number }; hearing?: number; searchSeconds?: number; facing?: number; traceSeconds?: number };
type Glass = { id: string; x: number; y: number; w: number; h: number };
export type Circuit = Point & { id: string; initial: boolean; label?: string; states?: [string, string]; mechanical?: boolean; feed?: { plate: string; remote?: boolean } };
export type Terminal = Point & { id: string; kind: 'source' | 'relay' | 'lock'; authorization?: string; requiresAuthorization?: string; window?: [number, number]; power?: Power; plate?: string; waitForDelivery?: boolean; transfer?: 'give' | 'take' };
export type Cycle = { period: number; active: [number, number]; phase?: number };
export type Suppressor = { id: string; x: number; y: number; w: number; h: number; power?: Power; cycle?: Cycle };
export type Scanner = { id: string; x: number; y: number; w: number; h: number; period: number; active: [number, number]; phase?: number; power?: Power };
export type Delivery = Point & { id: string; label: string; power?: Power[]; plate?: string; authorization?: string; window?: [number, number]; receivers?: { guard: string; at: Point; label: string }[]; onDeposit?: { power: Power[]; message: string } };
export type Level = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  hint: string;
  hints?: string[];
  briefing: string[];
  walls: Point[];
  doors: Door[];
  plates: Plate[];
  guards: GuardDefinition[];
  spawn: Point;
  loot: Point;
  par: number;
  exit?: Point;
  objective?: 'collect' | 'reach' | 'deliver';
  delivery?: Delivery;
  objectiveLabel?: string;
  lootLabel?: string;
  district?: string;
  theme?: 'archive' | 'gala' | 'industrial' | 'clockwork' | 'audit';
  circuits?: Circuit[];
  terminals?: Terminal[];
  suppressors?: Suppressor[];
  scanners?: Scanner[];
  glass?: Glass[];
  noiseResponse?: 'all' | 'nearest';
  soundMarkers?: (Point & { id: string })[];
  lootPower?: Power[];
  exitPower?: Power[];
  onLoot?: { power: Power[]; message: string };
  alternateExit?: { power: Power; at: Point; label: string };
  handoff?: { plate: string; room: string };
  continuity?: { source: string; room: string; home?: boolean };
  credential?: CredentialRoute;
};

export const doorPlates = (door: Door): string[] => door.plates ?? (door.plate ? [door.plate] : []);

function walls(doubleDoor: boolean): Point[] {
  const occupied = new Set<string>();
  const add = (x: number, y: number) => occupied.add(`${x},${y}`);
  for (let x = 0; x < 30; x++) { add(x, 0); add(x, 17); }
  for (let y = 0; y < 18; y++) { add(0, y); add(29, y); }
  for (let y = 1; y < 17; y++) if (y !== 10 && y !== 11) add(14, y);
  // Storage stacks make readable, useful cover rather than decorative collision.
  for (const [x, y] of [[5, 7], [6, 7], [5, 8], [6, 8], [10, 12], [10, 13], [18, 11], [18, 12], [25, 13], [26, 13]]) add(x, y);
  if (doubleDoor) {
    for (let x = 15; x < 29; x++) if (x !== 24 && x !== 25) add(x, 7);
  } else {
    for (const [x, y] of [[21, 6], [22, 6], [21, 7], [22, 7]]) add(x, y);
  }
  return [...occupied].map(key => { const [x, y] = key.split(',').map(Number); return { x: x * TILE, y: y * TILE }; });
}

const doorA: Door = { id: 'A', x: 448, y: 320, w: 32, h: 64, plate: 'A' };
const doorB: Door = { id: 'B', x: 768, y: 224, w: 64, h: 32, plate: 'B' };
const plateA: Plate = { id: 'A', x: 272, y: 176 };
const plateB: Plate = { id: 'B', x: 656, y: 464 };
const common = { spawn: { x: 112, y: 464 }, loot: { x: 816, y: 112 } };

export const LEVELS: Level[] = [
  {
    ...common, id: '01', title: '不在场证明', subtitle: 'THE FIRST ECHO',
    description: '一个人进不去的门，两次人生刚刚好。',
    hint: '先走到 A 开关，按 R 留下回声。下一轮等它开门，取走藏品，再回到西南角撤离点。',
    briefing: ['踩住 A 开关，门才会打开。', '按 R 录下这一轮，回声会重复你的路线并停在终点。', '新一轮穿过门，拿到藏品，再回到撤离点。'],
    walls: walls(false), doors: [doorA], plates: [plateA], guards: [], par: 1,
  },
  {
    ...common, id: '02', title: '三人合谋', subtitle: 'AN INSIDE JOB',
    description: '再留一个自己。让计划的每一环都有人在场。',
    hint: '让第一个回声踩 A，第二个回声进入东侧踩 B。第三轮，两个自己会为你打开通往藏品的路。',
    briefing: ['A 控制中间通道，B 控制藏品室。', '先录制压住 A 的回声，再录制压住 B 的回声。', '同时播放两条过去，让现在的你完成撤离。'],
    walls: walls(true), doors: [doorA, doorB], plates: [plateA, plateB], guards: [], par: 2,
  },
  {
    ...common, id: '03', title: '别惊动过去', subtitle: 'GHOSTS IN THE VAULT',
    description: '保安不在乎你来自哪一天。他看得见所有的你。',
    hint: '守卫也看得见回声。贴着南侧走可绕开巡逻区；空格制造声响，引开守卫。躲在实体墙后能阻断视线。',
    briefing: ['守卫会调查空格制造的声响；回声也会重放声响。', '持续进入视野会触发警报，墙和储物柜可以挡住视线。', '失败后按 Enter 重试；已经录好的回声会保留。'],
    walls: walls(true), doors: [doorA, doorB], plates: [plateA, plateB],
    guards: [{ route: [{ x: 688, y: 320 }, { x: 848, y: 320 }], speed: 76, range: 148 }], par: 2,
  },
];
