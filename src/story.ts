import { MISSIONS } from './campaign-content.ts';
import type { Campaign } from './campaign.ts';

type StoryPage = { speaker: string; text: string; response?: { scene: string; options: Record<string, string> } };
export type StoryScene = {
  id: string; chapter: number; mission: string; moment: 'before' | 'after'; title: string; place: string;
  prop: 'cup' | 'watch' | 'file' | 'ticket' | 'radio';
  pages: StoryPage[];
  choice?: { prompt: string; options: { id: string; label: string; reply: string }[] };
};
const say = (speaker: string, text: string): StoryPage => ({ speaker, text });

// Order is the reading order in the safehouse. All revelations require an
// actual mission checkpoint; skipping a scene never supplies a dialogue answer.
export const STORY: StoryScene[] = [
  { id: 'c0-arrival', chapter: 0, mission: 'C0-1', moment: 'before', title: '还有一个人没有回来', place: '旧馆街 · 二楼修表铺', prop: 'cup', pages: [
    say('修表铺', '你把两只杯子摆在工作台上。水烧开的时候，楼下的电车已经收班。对面的椅子空了十七天。'),
    say('你', '我去过登记处。他们找不到他的住址、工作记录，连我们一起签过的入馆单上也只剩一个名字。我记得这个人。他们说，记得不算证明。'),
    say('联络员', '旧馆今晚清空失物柜。B-17，那是最后一条没被删掉的编号。我能给你门禁图，进门之后只能靠你。'),
    say('你', '我把投影器扣在手腕上。它只能留下十二秒的动作，不能替一个人回答问题。但有人守住开关，我就能进去。那杯茶先放着。'),
  ] },
  { id: 'c0-watch', chapter: 0, mission: 'C0-2', moment: 'after', title: '两道划痕', place: '修表铺 · 工作台', prop: 'watch', pages: [
    say('你', '怀表停在六点十二分。我没有上发条，先把背面的两道划痕描在纸上。修表时我常磨掉这些痕迹，只有这一枚，他始终不让。'),
    say('联络员', '“旧东西也能认人？”电话那头问。我合上表盖：“至少不会忽然说自己从没见过我。”他没有接话。'),
  ] },
  { id: 'c0-departure', chapter: 0, mission: 'C0-6', moment: 'after', title: '编号还在走', place: '修表铺 · 黎明前', prop: 'file', pages: [
    say('你', '编号没有注销，姓名却被刮掉了。有人仍在使用属于他的那一行空格。我把柜门上的拓印与转运日期钉在一起。'),
    say('联络员', '下一场私人拍卖在明晚。邀请函会把人带进宴会厅，服务通道会把货带出去。找一份目录，看看他们究竟在卖什么。'),
    say('修表铺', '你收走了凉茶，把另一只杯子倒扣。天亮后，街上的人照常排队买早点。你开始留意他们会怎样报出自己的名字。'),
  ] },
  { id: 'c1-arrival', chapter: 1, mission: 'C1-1', moment: 'before', title: '请按时成为客人', place: '拍卖馆 · 后街', prop: 'ticket', pages: [
    say('联络员', '这里的门按秒核对来客。早到与迟到都算身份不符。把需要值守的动作录好，必要时让它晚一点出发。'),
    say('你', '请柬上没有卖家的名字，只有一段印得很漂亮的话：“为您的过去寻找更好的归宿。”我从服务员入口走进去。'),
  ] },
  { id: 'c1-catalogue', chapter: 1, mission: 'C1-3', moment: 'after', title: '第十七号拍品', place: '拍卖馆外 · 公用电话', prop: 'file', pages: [
    say('你', '目录里的描述很短：“雨夜，离家的母亲，未寄出的信。”这些是私人档案里的生活片段。标价旁边没有当事人的授权。'),
    say('联络员', '先拍下来源编号。别打开片段。我们需要证明它从哪里来，谁把它放到了货架上。'),
    say('你', '“你怎么知道该看哪一栏？”听筒里停了两秒。“我见过这种目录。”他说。宴会厅的掌声隔着墙传出来。'),
  ] },
  { id: 'c1-departure', chapter: 1, mission: 'C1-6', moment: 'after', title: '售出之后', place: '修表铺 · 雨夜', prop: 'file', pages: [
    say('你', '账本把一个人拆成了货号、价款和交付地址。B-17 的地址指向市政档案库。私人宴会散场，公共机构替它收货。'),
    say('联络员', '把账本留在店里，带副本过去。只追着一个编号跑，他们可以把其他行都擦干净。'),
    say('修表铺', '你在墙上第一次贴上了别人的编号。桌子还是那么小，两只杯子已经放不下所有文件。'),
  ] },
  { id: 'c2-arrival', chapter: 2, mission: 'C2-1', moment: 'before', title: '值夜的人', place: '市政档案库 · 侧门', prop: 'radio', pages: [
    say('你', '值班室的收音机在播夜间路况。巡逻员把保温杯放在窗台，接着按表去检查每一扇门。'),
    say('联络员', '巡逻员会去查声响，固定哨兵不会离岗。看清他们怎样交接，再借这个习惯走进去。别让一个诱饵叫来你没算进去的人。'),
    say('你', '我把广播调小。今晚需要他们离开岗位；明天，也许还需要他们证明自己当晚看见了什么。'),
  ] },
  { id: 'c2-departure', chapter: 2, mission: 'C2-6', moment: 'after', title: '同一根电线', place: '修表铺 · 街灯下', prop: 'file', pages: [
    say('联络员', '封存设备吃市政电。切掉总闸，追踪会停，柜门也会开。'),
    say('你', '我把电网图翻过来。背面列着诊所、供水泵和夜班电车。“这些也会停。”我说。电话那头的纸张声停了。'),
    say('联络员', '那就找分路。先拿到核心，再把民用支路接回去。我把旧维修记录发给你。'),
  ] },
  { id: 'c3-arrival', chapter: 3, mission: 'C3-1', moment: 'before', title: '窗户里的灯', place: '市政供电站 · 傍晚', prop: 'cup', pages: [
    say('修表铺', '出门时，楼下药店正在换灯泡。店员请你回来时帮忙看一下走慢的挂钟。你答应了，没说今晚可能会发生什么。'),
    say('你', '把安保关掉，把需要的门接通。带走封存核心之后，还得让那些窗户重新亮起来。我在撤离图上补了一条回总控台的线。'),
  ] },
  { id: 'c3-departure', chapter: 3, mission: 'C3-6', moment: 'after', title: '灯重新亮了', place: '修表铺 · 凌晨', prop: 'cup', pages: [
    say('修表铺', '楼下的冰柜重新响起来，末班电车晚点进站。你用外套擦干核心外壳，听见药店里有人把挂钟拨回正确的时间。'),
    say('联络员', '你把最后的时间留给了民用支路。核心拿到手以后，我以为你会只盯着出口。'),
  ], choice: { prompt: '你放下外套，回答他：', options: [
    { id: 'neighbors', label: '不能让邻居替我付账。', reply: '他问诊所的灯是否也亮了。你说亮了。他很轻地应了一声，没有再催你走。' },
    { id: 'proof', label: '我要带回能让人相信的证据。', reply: '“靠另一场事故遮住我们的行动，拿回来的东西还会被谁相信？”你问。他把剩下半句捷径咽了回去。' },
  ] } },
  { id: 'c4-arrival', chapter: 4, mission: 'C4-1', moment: 'before', title: '有人替你留了座', place: '转运车站 · 货运站台', prop: 'ticket', pages: [
    say('联络员', '核心里的记录通向车站。接收席位属于 B-17，授权一直没有收回。'),
    say('你', '门票只有一份。投影器能重演伸手的动作，却变不出第二张票。我必须真的把东西交到那只手里，再去另一头接住。'),
    say('你', '那是我们以前工作的规矩：先到的人留住门，另一个人带东西出去。他把这条规矩写进了授权里。'),
  ] },
  { id: 'c4-wait', chapter: 4, mission: 'C4-4', moment: 'after', title: '先到的人等一下', place: '车站 · 无人候车室', prop: 'watch', pages: [
    say('你', '协议末尾有一句手写批注：“别把门交给计时器，等到那个人来了再松手。”别人看见的是一条值守要求。'),
    say('往事', '有一次收工，你嫌他开门太慢，已经走到巷口。他还撑着沉重的铁门，等一位推车的老人通过。后来你们就用两道划痕代替约定：一个先到，一个一定等。'),
    say('你', '我把怀表放回口袋。留下授权链的人知道，会有人沿着它找来。'),
  ] },
  { id: 'c4-departure', chapter: 4, mission: 'C4-6', moment: 'after', title: '没有乘客的车票', place: '修表铺 · 清晨', prop: 'ticket', pages: [
    say('你', '票面印着货运班次，乘客栏却留下了接收授权。他没有靠这张票离开，而是给后来的人留了一条进去的路。'),
    say('联络员', '下一站有专门对付投影的设施。在里面，记录会继续走，动作却可能暂时失效。先确认你的同伙什么时候还能伸出手。'),
    say('你', '“他知道你会把这条路交给我吗？”我问。联络员说不知道。这是今晚他回答得最快的一句。'),
  ] },
  { id: 'c5-arrival', chapter: 5, mission: 'C5-1', moment: 'before', title: '专门给过去设的门', place: '转存区 · 审计入口', prop: 'radio', pages: [
    say('联络员', '抑制场里，回声还沿原来的路线走，但不能值守、交接和发声。别在它消失的时候等它开门。'),
    say('你', '我在检修窗上看见自己的倒影，身后的投影刚好熄灭了一瞬。再往前走，连“过去的我一定会在那里”都不再可靠。'),
    say('你', '这里保存抹除程序的批准书。今晚我要拿到原件。'),
  ] },
  { id: 'c5-departure', chapter: 5, mission: 'C5-6', moment: 'after', title: '签名在灯下', place: '修表铺 · 工作台', prop: 'file', pages: [
    say('你', '我把批准书摊在台灯下，拨通了号码。“签字的是你。”这次他没有说先找到 B-17 再谈。'),
    say('联络员', '“是。我批准了那次抹除。我以为把来源藏起来，交易就不会追到人身上。后来他们连人也一并从登记里拿走了。”'),
    say('你', '“你不是来给我一个清白的解释。”我把他的名字也抄进责任清单。“你是来告诉我，还有哪些地方能查到同一件事。”'),
  ], choice: { prompt: '接下来，你给这次合作定下一条规矩：', options: [
    { id: 'testify', label: '继续帮忙。你的签名也要一起公开。', reply: '“我会作证。”他说。你让他先留下完整的签名说明，再把原件装进另一个封套。' },
    { id: 'verify', label: '给我坐标。你的话我会逐条核对。', reply: '他开始报出档案室和设备编号。你逐个写下，最后说：“没有查到的部分，就还是没有查到。”' },
  ] } },
  { id: 'c6-arrival', chapter: 6, mission: 'C6-1', moment: 'before', title: '谁来画下一条线', place: '修表铺 · 出发前', prop: 'file', pages: [
    { speaker: '联络员', text: '两条入口，都能抵达内库。我把各自留下的设备状态写在旁边。路线由你选。', response: { scene: 'c5-departure', options: {
      testify: '签名说明已经送到你店里。两条入口和后续设备的状态也在这里。把我说的每一处都和原件核对，之后我会当着调查者再说一遍。',
      verify: '你要的坐标在纸上。我把可以互相核验的设备编号列出来了。正门还是检修口，由你来决定。',
    } } },
    { speaker: '你', text: '我先把民用支路圈出来，再看入口。拿走东西之后，这座城还要继续运转。', response: { scene: 'c3-departure', options: {
      neighbors: '我又想起楼下药店的挂钟。在每条撤离路线旁边，我都写上恢复民用线路的位置。',
      proof: '签名、设备时间戳和交付记录得能互相印证。我在图上标出三处来源，给每一份证据留好带回来的路。',
    } } },
  ] },
  { id: 'c6-contact', chapter: 6, mission: 'C6-2', moment: 'after', title: '杯子不用收了', place: '修表铺 · 加密通话', prop: 'cup', pages: [
    say('搭档', '“你是不是还没给那只表上发条？”听到这句话，我才坐下。他说，旧渡口的椅子很硬，临时身份只能买最早一班船的票。'),
    say('你', '“等我。我已经拿到了——”他说先别急。'),
    say('搭档', '“我想拿回名字，也想知道是谁签了字。但那些档案里还有别人的生活。你能看见它，不等于他们愿意让所有人看见。”'),
    say('修表铺', '挂断前，你问他喝什么。他笑着说都行，要热的。你把倒扣的杯子翻了过来。'),
  ] },
  { id: 'c6-departure', chapter: 6, mission: 'C6-6', moment: 'after', title: '证据需要第二双眼睛', place: '修表铺 · 最后一夜', prop: 'file', pages: [
    say('你', '墙上的线终于接在一起：谁批准，谁转运，谁收钱，谁负责让名字消失。每条线都能找到另一份记录。'),
    say('联络员', '藏一份原件只能保住一份原件。中央总库能把责任证据送进独立登记链，收到回执后，任何一个人都不能单独撤回它。'),
    say('你', '我把留在店里的副本装进盒子。下次回来，就不必再用这张工作台解释一个人为什么存在了。'),
  ] },
  { id: 'c7-arrival', chapter: 7, mission: 'C7-1', moment: 'before', title: '这一次，把东西放进去', place: '中央总库 · 天亮前', prop: 'radio', pages: [
    say('搭档', '“见证人必须真的收到，走回登记点。让他们看到文件，等他们把回执交出去。”他的声音从耳机里传来。'),
    say('你', '十二秒还是十二秒。有人值守，有人送件，有人把目光引向该被看见的地方。我把最后一条路线的终点画在撤离口。'),
    say('联络员', '责任清单里有我的签名。线路接通以后，把那一页也送进去。'),
  ] },
  { id: 'c7-receipts', chapter: 7, mission: 'C7-3', moment: 'after', title: '收到，不再撤回', place: '中央总库外 · 短暂休息', prop: 'file', pages: [
    say('你', '第一张回执来自值班台，第二张来自监察处，外部登记链又送回第三张。文件上的字没有变，但已经有别的人替它留了位置。'),
    say('搭档', '“现在，去把那些空白补上。”他说。登记册恢复的是公共身份；失去的岁月还得继续过。至于私人档案的钥匙，我们仍然要决定交给谁。'),
  ] },
];

export function sceneUnlocked(scene: StoryScene, campaign: Campaign): boolean {
  return scene.moment === 'after' ? campaign.data.completed.includes(scene.mission) : campaign.available(scene.mission);
}
export function evidence(campaign: Campaign) {
  return MISSIONS.filter(m => !m.id.startsWith('LAB-') && campaign.data.completed.includes(m.id));
}
export function chapterFor(missionId: string) { return /^C([0-7])-/.exec(missionId)?.[1]; }

export const STORY_KEY = 'echo-heist-story-v1';
type StorySave = { version: 1; seen: string[]; choices: Record<string, string>; cursor?: { id: string; page: number; choice?: string } };
export class StoryState {
  data: StorySave = { version: 1, seen: [], choices: {} };
  constructor(raw?: unknown) {
    if (!raw || typeof raw !== 'object') return;
    const value = raw as StorySave;
    if (value.version !== 1) return;
    this.data.seen = STORY.filter(s => Array.isArray(value.seen) && value.seen.includes(s.id)).map(s => s.id);
    for (const s of STORY) {
      const answer = value.choices?.[s.id];
      if (this.data.seen.includes(s.id) && s.choice?.options.some(o => o.id === answer)) this.data.choices[s.id] = answer;
    }
    const cursor = value.cursor, scene = STORY.find(s => s.id === cursor?.id);
    if (scene && !this.data.seen.includes(scene.id) && Number.isInteger(cursor!.page) && cursor!.page >= 0 && cursor!.page < scene.pages.length) {
      this.data.cursor = { id: scene.id, page: cursor!.page };
      if (scene.choice?.options.some(o => o.id === cursor?.choice)) this.data.cursor.choice = cursor!.choice;
    }
  }
  pending(campaign: Campaign): StoryScene | undefined {
    if (chapterFor(campaign.mission.id) === undefined) return;
    const cursor = STORY.find(s => s.id === this.data.cursor?.id && sceneUnlocked(s, campaign));
    if (cursor) return cursor;
    // Older saves join their current chapter; they can read prior scenes in the
    // safehouse, without being forced through every newly added interlude.
    return STORY.find(s => s.moment === 'after' && s.mission === campaign.mission.id && sceneUnlocked(s, campaign) && !this.data.seen.includes(s.id))
      ?? STORY.find(s => s.moment === 'before' && s.chapter === Number(chapterFor(campaign.mission.id)) && !campaign.data.completed.includes(`C${s.chapter}-6`) && sceneUnlocked(s, campaign) && !this.data.seen.includes(s.id));
  }
  finish(scene: StoryScene, choice?: string) {
    if (this.data.seen.includes(scene.id)) return;
    this.data.seen.push(scene.id);
    if (scene.choice?.options.some(o => o.id === choice)) this.data.choices[scene.id] = choice!;
    delete this.data.cursor;
  }
  text(page: StoryPage) {
    return page.response?.options[this.data.choices[page.response.scene]] ?? page.text;
  }
  endingNote() {
    const answer = this.data.choices['c5-departure'];
    return answer === 'testify' ? '离开前，你收到联络员的讯息：他已经带着签名说明前往调查处。你保留了讯息与原件，等候公开核验。'
      : answer === 'verify' ? '出门前，你把联络员报出的坐标与独立记录逐项核对，连同仍有疑问的部分交给调查者。清单上保留着他的名字。'
      : '修表铺里，批准书与独立记录装在同一个盒子里。你把它交给调查者，没有替任何人抽走自己的那一页。';
  }
}
