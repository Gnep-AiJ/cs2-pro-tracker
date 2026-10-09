# FACEIT 与热门赛事重构 — 2026-10-09

本地重构、最终回归和主要浏览器验收已完成。本轮没有新的发布授权，不能把本地改动描述为已上线。本文取代旧版赛事优先的界面阅读顺序；原文档和数据快照保留供追溯。

## 界面方向

首页与第一导航为 FACEIT，第二导航为赛事。FACEIT 首屏展示精选对局和近期对局流；点击后读取完整阵容与逐图记分板。榜单、对比、统计、查找和筛选收在弹窗中。赛事默认展示进行中比赛、未来赛程或已有赛果，其他统计为次级内容。

保留现有 React 19、Next.js/Vinext、Worker 和 API 路径。使用独立精选卡片、紧凑列表、按钮、原生弹窗与折叠信息，避免首屏堆满同类卡片。中文用简短、直接的标签，不写口号或阅读指令。来源、时间和保存/部分覆盖状态保持可见。

根布局在每页挂载 `ContactAccess`，保留原始二维码 `/wechat-community-qr-v1.png`、社区联系页及原图链接。二维码不优化、不替换、不移除。本轮静态审查确认原文件 SHA256 为 `39dd981dbe849cf3e8f810b7015736c62d2e87ac93c257592e5dcbdfc58191be`。

## 数据边界

| 来源 | 本轮路径与限制 |
| --- | --- |
| FACEIT Data API | 20 个已核验账号，每个最多最近 10 场；按 match ID 去重。首页刷新最多 20 次历史请求与 6 次房间元数据请求，缓存 120 秒。打开比赛后才读取完整统计；多地图单独展示，缺失 Rating/Swing 不推算。 |
| PandaScore Fixtures | 三个 matches 端点和三个 tournaments 端点本地实测 HTTP 200；确认赛程/赛果权限，不代表付费个人统计或实时回合数据可用。`/csgo` 路径沿用提供方命名，在服务端校验 `videogame_title.id=13` 与 `slug=cs-2`；不发送错误的 `filter[videogame_title]=cs2`。 |
| HLTV 历史观测 | 没有核实到官方公开 API。赛事路径默认停止读取 HLTV 页面，仅在确认授权后通过 `HLTV_AUTHORIZED_ACCESS=true` 启用。原快照保留日期，不冒充当前实时数据。 |
| Ensigame | 保留已有赛事样本及来源日期；ENSI /10 与 HLTV Rating 分开。不能把历史样本猜测关联到新的 PandaScore player ID。 |
| Valve | 官方 VRS 战队积分，标注发布日期；不代表实时赛程、比赛比分或选手 Rating。 |

赛事范围使用 PandaScore S/A 级和主赛事排除规则，排除资格赛、青训与小型赛事。这是收录范围，尚无热度或观看人数实测。目录使用原生 `ps-` series 标识，按准确 series ID 分组，并保留各阶段 tournament ID；不得把相似赛事名称或不同年份当成同一赛事。

## 请求与额度

PandaScore API 凭据只保存在已忽略的本地服务端环境中，不出现在客户端、日志、文档、构建产物或提交里。用户提供的额度为 1000 次/小时，不自动购买或升级套餐。

- `getProviderCatalogue` 共享三次目录请求，缓存 10 分钟。
- 选中赛事缓存 5 分钟，并发请求合并为一次读取；每个 series 最多三页 / 300 场，覆盖有界时如实标注。
- 本地每个 isolate 最多 120 次请求/小时，遇到 429 进入冷却；失败保留注明日期的可用观测。
- Cloudflare 对可用赛事响应缓存 5 分钟；所有 `no-store` 降级响应不得写入缓存。

这些限制能保护单个 isolate，不能保证多个 isolate 共用全账户额度。若必须严格守住全账户预算，需要共享调度或 Durable Object，不能仅凭内存缓存作保证。

## 本地验收

已有静态证据：首页和 FACEIT 路由使用 `FaceitWorkspace`，赛事路由使用 `EventsWorkspace`；导航按 FACEIT、赛事排序；根布局挂载联系入口；原二维码字节未变。接口读取已验证 PandaScore 六个 Fixtures 端点返回 HTTP 200。上述证据不等同于完整产品验收或线上验证。

验收范围与限制：

1. `npm run lint`、类型检查、`npm test` 中的构建与测试，记录警告和失败。
2. 桌面与 360px，中文与英文，首屏/长名称/空状态均无横向页面滚动。
3. 搜索、筛选、加载更多、榜单/对比/统计弹窗、记分板、多地图切换；Escape、背景点击和焦点回归。
4. 赛事切换与搜索，进行中/赛程/赛果状态，弹窗比分和来源日期同步；旧统计与新 ID 不猜测关联。
5. 联系入口在各页面可用，原二维码能完整显示，原图链接保留。
6. 上游失败、部分覆盖、429 冷却及额度缓存行为；凭据忽略规则和客户端构建不泄露。

本轮不包含部署、生产读回、付费统计授权或全局预算设施。完成本地验收后仍需明确的发布授权才能更新线上站点。

## 参考

- [FACEIT Data API](https://docs.faceit.com/docs/data-api/data/)
- [PandaScore plan reference](https://developers.pandascore.co/docs/plan-reference)
- [PandaScore upcoming matches](https://developers.pandascore.co/reference/get_csgo_matches_upcoming-1)
- [HLTV terms](https://www.hltv.org/terms)
- [Valve regional standings](https://github.com/ValveSoftware/counter-strike_regional_standings)

设计参考沿用已阅读的 [Frontend Design SKILL](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md) 和 [UI/UX Pro Max SKILL](https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md)，用于层级和交互，不引入新运行时依赖。

## 最终结果 — 2026-10-09

- `npm test`：生产构建成功，63/63 测试通过。`tsc --noEmit` 通过；`npm run lint` 为 0 错误、10 条原有警告。`git diff --check` 通过，仅有行尾转换提示。
- 使用本地凭据扫描最终构建 55 份文件，无凭据值。`.env.local` 与输出证据目录保持 Git 忽略。PandaScore 密钥只写入服务端配置。
- FACEIT 实测读取 20/20 个账号、80 条去重对局。已打开真实对局，10 名选手的 K/D/A、ADR、HS% 正常返回。发现旧归一化会将 Headshots 与 Headshots % 混淆，现保留百分比语义，且不同字段顺序的回归用例通过；真实房间再次读取核验成功。
- PandaScore 实测 5 个 S/A 赛事；EPL 41 场、80 名参赛身份、进行中 1:0 系列比分、地图胜者及官方直播链接。Thunderpick 有赛事信息，具体对阵尚未公布；空列表保留为空。
- 官方单场个人统计 `/csgo/matches/1711371/players/stats` 实测 HTTP 403，当前凭据未获这项读取权限。未购买或变更套餐。
- 桌面 1280px 和手机 360px 已核验，无横向页面滚动；中文与英文选择可保留。首页搜索/空状态、地图筛选、加载更多、榜单/对比/统计入口、原生 Escape 与焦点回归通过主要交互验收。手机记分板改为逐名选手布局，10 人数据在有界弹窗中显示。
- 赛事切换、搜索 G2 返回 4 场赛果、赛事弹窗真实系列比分和逐图胜者均已核验。切换期间保留已知赛事目录；不短暂借用另一赛事名称。比分从当前数据按 match ID 读取，避免旧对象搭配新时间。
- Valve 积分可按需展开并保留日期；它仍是官方积分，非实时赛果。原微信二维码文件哈希不变，手机弹窗完整加载，原图链接保留。8 个公共路由的全页联系入口通过构建页面测试。
- 截图：`outputs/redesign-20261009/faceit-desktop.jpg`、`faceit-mobile.jpg`、`events-mobile.jpg`、`scoreboard-mobile-en.jpg`。API、权限与日志证据也在该忽略目录。

未验收：生产部署、真实设备扫码、FACEIT 多地图上游实例、付费赛事个人统计和全账户跨 isolate 请求上限。多地图分离、429 冷却、分页、单飞与失效回退已由本地回归验证，不等同于这些上游/生产路径已实测。
