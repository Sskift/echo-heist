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

构建对应：${commit}
`);
const sources: { title: string; author: string; sourcePage: string; license: string }[] = JSON.parse(readFileSync('licenses/asset-sources.json', 'utf8'));
writeFileSync(join(target, '素材鸣谢.txt'), `回声劫案 / 免费素材鸣谢\n\n${sources.map(s => `${s.title}\n${s.author}\n${s.license}\n${s.sourcePage}`).join('\n\n')}\n\n音乐统一响度并转为 MP3；图片在游戏内缩放与调色，原始 PNG 未改。\n所有运行资源已包含在 HTML 中，外部链接仅用于查看作者页面。\n许可全文：CC0-1.0.txt；Kenney 原始随包许可：Kenney-Topdown-CC0.txt。\n`);
for (const file of ['CC0-1.0.txt', 'Kenney-Topdown-CC0.txt']) copyFileSync(join('licenses', file), join(target, file));
console.log(JSON.stringify({ target: join(target, filename), bytes: Buffer.byteLength(html), version, commit, embeddedAssets: assets.length }));
