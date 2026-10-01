# 声画素材 / v0.15.0

0.15 的观察窗、街区灯窗、留守回声标记为 Canvas 原创绘制，复用已有房间材质与角色图。CIV 重接后的远处电车铃由 Web Audio 合成，不新增第三方素材或网络请求。

本版将免费素材实际用于游戏场景、人物和配乐。素材文件打包进本地构建，运行时不请求素材网站；无需账号、订阅或 API key。游戏内「声画 → 素材与音乐鸣谢」可查看作者与原始页面。

0.14 新增的修表铺为 `src/story-ui.ts` 内的原创 SVG：夜间街景、工作台、怀表、车票、收音机、文件和两只杯子。章节对话聚焦不同物件，C6 联系搭档后杯子重新摆正。它不引入第三方图片或外部请求。阅读时使用该章已有音乐的低音量规划混音；旧渡口继续使用尾声曲。

## 来源与许可

| 内容 | 作者 | 原始页面 | 采用许可 | 使用与修改 |
| --- | --- | --- | --- | --- |
| Top-down Shooter | Kenney Vleugels | [Kenney](https://kenney.nl/assets/top-down-shooter) | CC0 1.0 | 原 PNG 中的三个人物、三种地板、木箱和纸张；原文件不改，运行时缩放、调色与合成 |
| Espionage | brandon75689，HaelDB 上传 | [OpenGameArt](https://opengameart.org/content/espionage) | CC0 1.0（从页面列出的许可中选用） | 旧馆、夜场与转运场景配乐；从 OGG 转为 MP3，统一响度 |
| Strange Experiments | Alexander Ehlers / tricksntraps | [OpenGameArt](https://opengameart.org/content/t-t-free-cyberpunk-pack-2) | CC0 1.0 | 工业与核验场景配乐；从 OGG 转为 MP3，统一响度 |
| PYNCHON | James Gargette / cinameng | [OpenGameArt](https://opengameart.org/content/pynchon) | CC0 1.0 | 旧渡口结局配乐；重新编码并统一响度 |

2026-10-01 核对以上原始发布页面。许可全文保留在 [CC0-1.0.txt](../licenses/CC0-1.0.txt)，Kenney 随包许可保留在 [Kenney-Topdown-CC0.txt](../licenses/Kenney-Topdown-CC0.txt)。来源、下载地址、原始包 SHA-256 见 [asset-sources.json](../licenses/asset-sources.json)，实际入库文件的大小和 SHA-256 见 [asset-hashes.json](../licenses/asset-hashes.json)。CC0 不要求署名，本项目仍保留作者鸣谢。

音乐转换使用 FFmpeg：`loudnorm=I=-23:TP=-3:LRA=9`，44.1 kHz、112 kbit/s MP3；保留整曲，不加速或重编旋律。原始文件留在被 Git 忽略的 `.local/asset-sources`，运行时只使用仓库内的成品。未采用候选 Night Club，发布包也不包含它。

转换后重新测量整曲：Espionage 为 -23.57 LUFS / -4.52 dBTP，Strange Experiments 为 -21.98 LUFS / -3.42 dBTP，PYNCHON 为 -23.40 LUFS / -10.28 dBTP。文件没有达到满幅的削波峰值；实际游戏还会经过音乐音量、场景音量、总音量与压缩器。保留原曲的动态差异，不把合成提示音混入配乐文件。

## 画面

五种已有场景主题分别使用旧馆木地板、夜场石砖、工业混凝土、转运木地板和核验石砖，配合不同色温。墙顶亮边、侧面阴影、柜体与箱件均服从原有实体墙格。装饰物只画在已有墙体上，不把可通行地面伪装成掩体。

玩家、回声、守卫与追踪器使用人物精灵；摄像头使用独立设备轮廓。回声保留颜色、编号、虚线圈和路径；方向箭头、警觉条、视锥、门禁、字母与条件文字继续根据实际模拟绘制。静态材质按关卡缓存，低动态偏好仍生效；可在「声画」关闭材质和人物，使用简洁图形。

## 音乐与操作

默认关闭全部声音，首次需主动开启。音乐与音效分别调节，偏好仅存在本机。重新打开页面不会自动播放；开始行动或再次操作音频控件后解锁浏览器音频。

配乐随场景选曲，切换用两秒淡入淡出；重录、重试、暂停与三倍快进均不从头播放、不改变曲速。规划和失败时降低音乐音量；开启动态变化时，行动中的滤波与低音脉冲随警觉变化。关闭动态变化会取消滤波变化和警觉脉冲，仍保留规划时的音量收敛。提示音走独立音量通道，总输出经过压缩器；离开窗口与总静音直接关闭总通道，包含已排队的音效。

三个整曲解码后循环播放，最多保留两首解码缓存。静音状态不创建音频上下文；音乐音量为零时不发起新的曲目解码。音频解码不可用时保留可玩的游戏与错误提示，用户可重新启用声音重试。

声画素材本身不构成首次体验或实际游玩时长的验证证据；当前功能与地图改动以 [制作状态](production-status.md) 为准。
