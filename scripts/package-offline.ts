import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const version: string = JSON.parse(readFileSync('package.json', 'utf8')).version;
let commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) commit += '-worktree';
let html = readFileSync('dist/index.html', 'utf8');
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, asset: string) => {
  const js = readFileSync(join('dist', asset), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/, (_, asset: string) => `<style>${readFileSync(join('dist', asset), 'utf8')}</style>`);
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(readFileSync('dist/favicon.svg', 'utf8'))}"`);
html = html.replace('<head>', `<head>\n    <meta name="echo-heist-build" content="${version}:${commit}" />`);
if (/<(?:script|link)[^>]+(?:src|href)="\/(?:src|assets)\//.test(html)) throw new Error('Unbundled runtime asset');

const assets: { file: string; bytes: number; sha256: string }[] = JSON.parse(readFileSync('licenses/asset-hashes.json', 'utf8'));
for (const asset of assets) {
  const bytes = readFileSync(asset.file);
  if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`Asset manifest differs: ${asset.file}`);
  if (!html.includes(bytes.toString('base64'))) throw new Error(`Asset missing from standalone build: ${asset.file}`);
}

const target = '.local/releases'; mkdirSync(target, { recursive: true });
const filename = `echo-heist-v${version}.html`;
writeFileSync(join(target, filename), html);
writeFileSync(join(target, '试玩说明.txt'), `回声劫案 ECHO HEIST / v${version}

解压后，用 Chrome 或 Edge 打开 ${filename}。无需安装、联网或启动服务器。
你的同伙，是过去的你：把自己的动作录成回声，再和录像中的自己合作。

WASD / 方向键：移动　R：录下本轮　空格：制造声响　E：操作设备
P：预演计划　Shift：按住快进　Esc：暂停
右上方「行动手册」有详细规则，可正常使用提示、暂停、快进、重录和撤销。
点击地图上方喇叭开启声音；「声画」可分别调音乐和音效、查看素材鸣谢、切换简洁画面。
声音默认关闭。离开窗口自动静音，重录与快进不会重启或加速配乐。

可以分次游玩，关闭后仍可在相同浏览器、相同文件位置继续。请保持同一份文件位置。
离线版与 localhost 版的浏览器存档相互独立；开始新版本前请保留旧文件。

进入主线会播放当前章节的故事。阅读期间游戏暂停，可逐页阅读、收起或跳过。
「修表铺 · 故事与线索」收集已解锁的故事和完成任务获得的证据，不展示后续真相。
两次对话回答会保存在本机，影响后续台词与尾声。跳过不代替你选择，回看不改写回答。
收起未读完的片段后，可在修表铺续读；刷新也会恢复阅读位置。
主线中的行动路线与最终公开范围，仍由你在关卡里实际完成的操作决定。

0.19 出发准备：旧馆 C0-6 可使用 C0-4 带回的检修图，宴会 C1-6 可使用时刻表与岗位轮换记录。
在「修表铺 · 出发准备」查看来源、路线变化与代价。真实出发后锁定安排，预演只读。
重试和刷新保留方案；重新准备回到任务起点并清除本次所有录像、锚点和后续结果，已取得的证据保留。
检修口需要 H 门闩与承重开关配合；交班空档更早进门，但下一间核验只接受第 6–7 秒。

0.20 配电站旁路：C2-6 的转运总表与 C3-4 的独立接口可用于 C3-5。
原方案让同伙按时切电；旁路让两人分别守馈线，真人安排取件、归位和监控复位。
自动接线柜显示所需值守位置，松开确认位就断电；手动面板仍需靠近按 E。

0.21 出发准备：C4-5 可凭恢复供电与旧班记录重启旧台，两名回声分别值守，换取宽松签入时段。
C5-5 可按货单编号和人工权限改走人工取件面，真人取件、送件并接应回声；末区由本人接回原票。
两组准备都保留原路线，修表铺会说明证据来源与新岗位要求。凭据只按实际交接移动。

0.22 美术：新人物比例、面部、长外套与制服网格；窗格月光、扇形窗门楣和脚底接触阴影。模型与骨骼动画全部内嵌，仍使用固定 2.5D 镜头。
0.22 出发准备：C2-1 可按 C1-6 交付账本走收货侧廊，首区配合货运窗口，次区从规程柜背面取件。
C6-5 可按抹除批准书与设备时间戳借用独立复核线，取证后必须恢复，末段在恢复后持原票签名。
C7-1 可按传输地址与联锁日志找到侧面收件口，两名回声接应、归位，再持续值守复核。
三个任务都保留原方案。复核台采用石材柜面与签章装置；门禁连线按实际所需供电状态显示。

0.21 美术：柱式与檐口、窗外夜景、拼花木地板、玻璃展柜中的怀表、浑仪与发报器，旧班木柜与人工钢柜。
冷暖夜间光照、墙脚阴影、材质凹凸、拱窗墙裙与建筑底座，玩家采用长外套和铜色围巾。
桌面有轻微灯光晕染与抗锯齿；手机自动使用轻量渲染。需要降低开销时可在「声画」关闭附加细节。

使用真实 3D 场景与固定 2.5D 镜头。WASD 和方向键按屏幕方向移动。
「近景 / 全景」切换镜头；地图北向右上、东向右下。已有录像与存档仍使用原始地图坐标。
建议使用支持 WebGL 2 的 Chrome 或 Edge；模型、动画和音乐均包含在本文件内。

0.18 为八章配置各自的场景材质、建筑细节和陈设；电源拨杆、扫描器和抑制场灯读取真实状态。
旧馆有展陈与怀表，车站有双面交接柜。围巾背包属于玩家，制服帽属于普通守卫，面罩属于追踪器。
柜槽和人物手中的凭据根据实际持有状态显示；手机按显示尺寸渲染，密集标签带有指向目标的引线。

C4-6《不存在的列车票》：登记厅交出唯一车票，到对侧站台本人接回，再交接至货运档案。
直接试玩：在此 HTML 文件地址后加 ?demo=station-transfer，与完整主线分开存档。
FAST 要提前安排同伙与时段，后两区各省一名同伙；SERVICE 随时交票，后段需要额外接应。

C3-6《最后一盏灯》：配电室布置、隔窗取核心、回原处恢复城市。
独立试玩入口 ?demo=last-light。留守者占一个回声名额，各区每轮十二秒从零同步。
回到首段重排计划会撤销后段锚点；凭据、授权和本区计划随各自安全锚点恢复。

构建对应：${commit}
`);
const sources: { title: string; author: string; sourcePage: string; license: string }[] = JSON.parse(readFileSync('licenses/asset-sources.json', 'utf8'));
writeFileSync(join(target, '素材鸣谢.txt'), `回声劫案 / 免费素材鸣谢\n\n${sources.map(s => `${s.title}\n${s.author}\n${s.license}\n${s.sourcePage}`).join('\n\n')}\n\n音乐统一响度并转为 MP3；家具、人物和动画原文件未修改，运行时缩放与调色。\n建筑、地板、门禁和交互提示由本项目绘制与建模。\n3D 渲染：Three.js / MIT，见 Three-MIT.txt。\n所有运行资源已包含在 HTML 中，外部链接仅用于查看作者页面。\n许可全文：CC0-1.0.txt；Kenney-Furniture-CC0.txt；Kenney-Characters-CC0.txt。\n`);
for (const file of ['CC0-1.0.txt', 'Kenney-Furniture-CC0.txt', 'Kenney-Characters-CC0.txt', 'Three-MIT.txt']) copyFileSync(join('licenses', file), join(target, file));
console.log(JSON.stringify({ target: join(target, filename), bytes: Buffer.byteLength(html), version, commit, embeddedAssets: assets.length }));
