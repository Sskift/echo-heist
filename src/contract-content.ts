import type { Stage, WitnessAction } from './campaign-content.ts';
import type { Level } from './levels.ts';
import { g, w, r, e, noise, point as p, room, level, stage, gate, plate } from './campaign-authoring.ts';

export const CONTRACT_FAMILIES = ['空站交接', '夜班检修', '独立见证'] as const;
export type ContractFamily = typeof CONTRACT_FAMILIES[number];
export type Contract = { id: string; family: ContractFamily; title: string; request: string; conditions: string[]; stage: Stage };
const power = (id: string, on = true) => ({ id, on });
function contract(id: string, family: ContractFamily, title: string, request: string, conditions: string[], props: Partial<Level>, hint: string, witness: WitnessAction[]): Contract {
  const map = level(`CT-${id}`, title, { subtitle: 'AFTER THE LAST FERRY', description: request, briefing: [request], hint,
    theme: 'clockwork', echoLimit: 2, ...props });
  const action=stage(map, request, '委托已交差。原来的城市里，还有需要同伙的人。', [], witness);
  // The complete route is an opt-in hint, never the opening briefing.
  action.level.briefing=[request,...conditions];
  return { id, family, title, request, conditions, stage: action };
}
const ticket = (id: string) => ({ id, label: '夜班原票', exitOwners: ['player'], exitAuthorizations: ['STAMP'], receiveByPlayer: 'BACK',
  journey: { title: 'S 原票 → 回声签入 L → BACK → 本人', summary: '这份委托如何交票', help: '回声从 S 取票，去 L 签入后交到 BACK；本人必须从 BACK 接回同一张原票，最后撤离。在 BACK 可按 E 后等候，离开圈内会取消。每次重试恢复 S 的原票，不保留上次签名。' } });

export const CONTRACTS: Contract[] = [
  contract('station-platform', '空站交接', '送件的人，留下开门', '站务员：把夜班原票签好带回来。送件的同伙还得替你守住最后一道门。',
    ['最多 1 名回声；送件后兼任 A 留守', 'L 随时签入；BACK 必须由本人接回', '无巡逻，门由 A 和签名共同控制'], {
      setting: 'station', district: '夜班站台 / PLATFORM', echoLimit: 1, par: 1,
      objective: 'reach', objectiveLabel: '本人接回签好原票，从东侧通道离开', exit: p(848,432),
      walls: room([[25,[12,13]]]), plates: [plate('A',656,336)], doors: [{...gate('EXIT',800,384,'A'),authorization:'STAMP'}],
      credential: ticket('NIGHT-PLATFORM'), terminals: [
        {id:'S',kind:'source',x:112,y:176},
        {id:'L',kind:'lock',x:528,y:432,authorization:'STAMP'}, {id:'BACK',kind:'relay',x:720,y:432,waitForDelivery:true},
      ],
    }, '先录从 S 取票、去 L 按 E、交到 BACK、最后停在 A 的路线。真人到 BACK 按 E 留候接回，等同伙到 A 后撤离。',
    [g(112,176),e(),g(112,432),g(528,432),e(),g(720,432),e(),g(656,336),r(),g(720,432),e(),w(180),g(848,432)]),
  contract('station-window', '空站交接', '南窗只开三秒', '站务员：这一班需有人在西侧值守签名台。接收柜已改到北站台，别沿用上一班的分工。',
    ['最多 2 名回声；A 必须有人值守', 'L 只在第 4–7 秒签入', 'BACK 改在北侧；本人接票后走东北门'], {
      setting:'station', district:'北侧交班窗 / NIGHT WINDOW', par:2,
      objective:'reach',objectiveLabel:'4–7 秒内签入，从北侧 BACK 接回原票',exit:p(848,176),
      walls:room([[25,[4,5]]]),plates:[plate('A',176,176)],doors:[{...gate('EXIT',800,128,'A'),authorization:'STAMP'}],
      credential:ticket('NIGHT-WINDOW'),terminals:[
        {id:'S',kind:'source',x:112,y:304},
        {id:'L',kind:'lock',x:528,y:432,authorization:'STAMP',plate:'A',window:[4,7]},
        {id:'BACK',kind:'relay',x:720,y:176,waitForDelivery:true},
      ],
    }, '先录 A 留守；第二名从 S 取票，抵达 L 后等到第 4 秒签入，再交到北侧 BACK。本人到 BACK 留候接回，再从东北门离开。',
    [g(176,432),g(176,176),r(),g(112,304),e(),g(528,304),g(528,432),w(90),e(),g(720,432),g(720,176),e(),r(),g(720,432),g(720,176),e(),w(180),g(848,176)]),
  contract('power-return', '夜班检修', '借来的电，原路送回', '值班电工：封存件在东间。先断开共线供电才能取件，离场前务必恢复街区馈线。',
    ['最多 1 名回声，负责南侧 A', 'GRID 断开才可进门、取件', '必须把 GRID 恢复接通后从西侧离开'], {
      setting:'power',theme:'industrial',district:'街区馈线室 / FEEDER',echoLimit:1,par:1,
      spawn:p(112,432),loot:p(688,176),lootLabel:'检修封存件',objectiveLabel:'取回封存件并恢复 GRID',
      walls:room([[14,[12,13]]]),plates:[plate('A',272,432)],doors:[{...gate('A',448,384),power:power('GRID',false)}],
      circuits:[{id:'GRID',x:112,y:176,initial:true,label:'街区馈线'}],lootPower:[power('GRID',false)],exitPower:[power('GRID')],
    }, '录 A 留守；真人先去西北方关闭 GRID，从南门取件并返回西侧，再去原面板接通 GRID，最后到西南出口。',
    [g(272,432),r(),g(112,176),e(),g(112,432),g(688,432),g(688,176),g(688,432),g(112,432),g(112,176),e(),g(112,432)]),
  contract('power-shift', '夜班检修', '进门和回程分两班', '值班电工：北门借电开放，南门断电后开放。让一个同伙换线，另一个提前到南侧接你。',
    ['最多 2 名回声；M 的通电与断电分别开放北、南门', '南门另需东侧 B 留守', '取件与离场都要求 M 已断开'], {
      setting:'power',theme:'industrial',district:'双路检修间 / TWO FEEDS',par:2,spawn:p(112,176),loot:p(784,176),exit:p(112,432),lootLabel:'线圈检修记录',
      objectiveLabel:'借北门进入，断电取件，从南侧 B 回程',walls:room([[14,[4,5,12,13]]]),plates:[plate('B',656,432)],
      doors:[{id:'NORTH',x:448,y:128,w:32,h:64,power:power('M')},{...gate('SOUTH',448,384,'B'),power:power('M',false)}],
      circuits:[{id:'M',x:176,y:176,initial:false,label:'借用检修馈线'}],lootPower:[power('M',false)],exitPower:[power('M',false)],
    }, '先录 M 接通、等待四秒、再断开的同伙。第二名趁通电穿北门，沿东侧到 B 留守。真人同样从北进入，断电后取件，经南门回到西南。',
    [g(176,176),e(),w(240),e(),r(),w(20),g(528,176),g(528,432),g(656,432),r(),w(20),g(784,176),w(100),g(784,432),g(112,432)]),
  contract('witness-desk', '独立见证', '有人在场，才肯收件', '联络员：副本只在短暂的收件时段接受。留一个人确认提交，再让值班员亲自发现、带回登记。',
    ['最多 1 名回声；植入时须有人压 A', 'D 只在第 2–5 秒接收真人植入', 'G1 听觉约 11 格，搜索 0.8 秒；返回登记台才算回执'], {
      setting:'civic',theme:'audit',district:'独立登记处 / WITNESS DESK',echoLimit:1,par:1,objective:'deliver',exit:p(112,432),noiseResponse:'nearest',
      plates:[plate('A',272,432)],delivery:{id:'D',x:496,y:304,label:'夜班责任副本',plate:'A',window:[2,5],receivers:[{guard:'G1',at:p(656,304),label:'值班登记台'}]},
      guards:[{id:'G1',route:[p(656,304)],facing:0,speed:112,range:100,hearing:350,searchSeconds:0.8}],soundMarkers:[{id:'D',...p(496,304)}],
      objectiveLabel:'真人植入，取得 G1 返回登记台的回执',
    }, '录 A 留守；真人沿南侧到 D，时段内按 E 植入后发声，立即南退回入口。等 G1 到 D 搜索并回登记台。',
    [g(272,432),r(),g(496,432),g(496,304),e(),noise(),g(496,432),g(112,432),w(180)]),
  contract('witness-shift', '独立见证', '两位见证人，错开到场', '联络员：值班与监察轮流在线。副本需在换班前植入，两次调查各自归位后才有完整回执。',
    ['最多 2 名回声；两次响声必须错开', 'D 仅第 2–3.5 秒接收；ROSTER 决定哪位见证人在线', '两人听觉分别约 11 / 8 格；各自返回登记台才算完成'], {
      setting:'civic',theme:'audit',district:'交班核验处 / SHIFT REGISTER',par:2,objective:'deliver',exit:p(112,432),noiseResponse:'nearest',
      circuits:[{id:'ROSTER',x:112,y:432,initial:true,label:'调查值班线路',states:['监察值班','一线值班']}],
      delivery:{id:'D',x:496,y:304,label:'双重夜班副本',window:[2,3.5],receivers:[{guard:'G1',at:p(656,208),label:'值班登记台'},{guard:'G2',at:p(656,400),label:'监察登记台'}]},
      guards:[{id:'G1',route:[p(656,208)],facing:0,speed:128,range:100,hearing:360,searchSeconds:0.5,power:power('ROSTER')},{id:'G2',route:[p(656,400)],facing:0,speed:128,range:100,hearing:260,searchSeconds:0.5,power:power('ROSTER',false)}],
      soundMarkers:[{id:'D',...p(496,304)}],objectiveLabel:'植入后先取 G1 回执，换班，再取 G2 回执',
    }, '两条回声各到 D 发声后向西侧躲开，其中一条延迟 4.5 秒。真人先到 D 植入并回入口；等第一份回执，再切 ROSTER，让晚班回声引第二人。',
    [g(496,432),g(496,304),noise(),g(368,304),g(368,176),r(),{delay:270,echo:0},g(496,432),g(496,304),noise(),g(368,304),g(368,432),r(),g(496,432),g(496,304),e(),g(496,432),g(112,432),w(90),e(),w(300)]),
];
export const contractById = (id: string) => CONTRACTS.find(c => c.id === id);
export const contractForLevel = (id: string) => CONTRACTS.find(c => c.stage.level.id === id);
