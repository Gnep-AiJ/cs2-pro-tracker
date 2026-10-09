# CS2 Pro Tracker

## 当前发布 — 2026-10-10

用户确认后，FACEIT 优先的新界面已发布到 [正式网站](https://cs2pro.pages.dev/?lang=zh)。生产版本 `96182b24-fc93-451e-b3b8-67a069f5c689`，旧版本保留供回滚。源码包含榜单、对比、战队查找、热门赛事、Valve 积分与档案细节，以及永久联系/微信打赏入口。生产 FACEIT、PandaScore、别名搜索和原始二维码已核验；Valve 首次降级后复查恢复官方数据。完整验证、浏览器复测限制及回滚信息见 [发布记录](docs/RELEASE_20261009_PORTAL.md)。

下方“本地更新、未发布”说明记录的是各阶段当时状态；当前发布状态以本节为准。

## 2026-10-09 — 选手查找与档案细节

对局按选手筛选；查找窗口按战队浏览，同时支持全站 FACEIT 昵称搜索。常见别名绑定核验账号，simple/s1mple 已修正为 s1mplecsgod 的固定 ID。档案增加胜负颜色、地图图标和近期战绩；360px 布局已检查。77 项测试通过；本地更新，未发布。详见 [UI 记录](docs/PORTAL_UI_20261009.md)。

## 2026-10-09 — 综合信息站调整

当前主导航为 FACEIT、赛事、动态；榜单、对比、查找选手并列在 FACEIT 顶部。官方榜单默认展示；收录选手 TOP 10 按 ELO、CS2 生涯场次、胜率排序。赛事选择旁提供 Valve 积分弹窗，取消底部跳转；联系与打赏及两张原图保留。此节取代下方旧界面说明。

本轮本地构建、74 项测试、类型检查通过；lint 0 错误、10 条既有警告。未发布线上。详情见 [PORTAL_UI_20261009.md](docs/PORTAL_UI_20261009.md)。

## 2026-10-09 — 当前方向

FACEIT 职业选手对局与热门 CS2 赛事站。首页和第一导航为 FACEIT，第二导航为赛事；支持 English / 中文及浏览器语言检测。此节取代下方历史版本的“赛事优先”阅读顺序。

- 首页展示精选对局和近期对局流；完整阵容、逐图记分板按需打开。榜单和对比为次级入口，查找和筛选用弹窗；移除同局分析和 AI 解读入口。
- 赛事默认展示赛程、进行中比赛和赛果。仅收录符合主赛事规则的 PandaScore S/A 级赛事，排除资格赛、青训和小型赛事；不把收录数量当作热度或观看人数。
- 所有页面保留“联系与打赏”入口；联系二维码 `/wechat-community-qr-v1.png` 与用户提供的收款码 `/wechat-support-qr.png` 分别切换，原图不压缩、不替换、不移除。
- 凭据仅用于服务端。本地 PandaScore Fixtures 接口已返回成功响应；这不等于付费个人统计、实时回合数据已经接入。
- 当前修改仅在本地；构建、70 项测试与类型检查通过，lint 为 0 错误、10 条既有警告。桌面和 360px 手机布局、对局弹窗、选手档案、榜单/对比、联系/打赏均已浏览器验收。线上站点未由本轮更新。

新设计、数据来源、额度策略与验收记录见 [MATCH_FIRST_REDESIGN_20261009.md](docs/MATCH_FIRST_REDESIGN_20261009.md)。
界面收缩与 FACEIT 参考布局见 [UI_SIMPLIFICATION_20261009.md](docs/UI_SIMPLIFICATION_20261009.md)。

### 数据与配置

在已忽略的 `.env.local` 中配置 `FACEIT_API_KEY` 和 `PANDASCORE_API_TOKEN`。变量名可公开，凭据值不得进入客户端、日志、文档或提交。不要复制或输出现有 `.env.local`。

FACEIT 首页检查 20 个已核验账号的最近 10 场历史，每次刷新最多 20 次历史请求与 6 次房间元数据请求，120 秒缓存；完整统计只在打开对局时请求。不同地图分别展示，缺失 Rating/Swing 不推算。

PandaScore 目录共享三次请求并缓存 10 分钟；选中赛事缓存 5 分钟并合并并发请求，每个 tournament 最多三页。本地每个 isolate 设 120 次请求/小时预算，遇到 429 暂停请求；Cloudflare 赛事响应缓存 5 分钟。这些限制不能保证多个 isolate 共用全账户预算，严格的全局额度需要共享调度或 Durable Object。

没有核实到 HLTV 官方公开 API。赛事路径默认停止读取 HLTV 页面，只有确认获授权后才启用 `HLTV_AUTHORIZED_ACCESS=true`；注明日期的历史快照保留。ENSI /10 样本与 HLTV Rating 分开，Valve VRS 是注明日期的战队积分，不是赛程或实时赛果。

## 历史版本说明 — 以下保留供追溯

以下功能描述和阅读顺序记录 2026-10-08 及之前版本，与当前节冲突时以当前节为准。原有命令、技术栈和目录链接仍可参考。

CS2 重要赛事与选手数据站：赛事优先，FACEIT 次级；支持 English / 中文及浏览器语言检测。

正式站点：https://cs2pro.pages.dev

## 主要功能

默认阅读顺序：赛事赛程/赛果 → 本赛事选手表现 → 个人对比。赛事选择支持搜索；FACEIT 默认展示近期个人表现榜，筛选、来源和 AI 解读收在次级区域。界面与发布检查见 `docs/UI_READING_ORDER_20261008.md`。

- HLTV Big/Featured 赛历、对阵、赛果、参赛阵容
- 同赛事个人 ADR、K/D、KAST、ENSI /10 样本对比及模糊搜索
- 来源和观测时间可追溯；未来赛事不展示虚构统计
- 基于观测数据的可选 Workers AI 解读

- 汇总已核验职业选手的今日与近期 FACEIT 状态
- 查看 ELO、区域排名、生涯数据和地图表现
- 展开最近比赛及完整记分板
- 浏览 FACEIT 官方区域榜和国家榜
- 聚合最近 30 天的中文与英文 CS2 资讯
- 针对桌面端和手机端提供响应式界面

## 技术栈

- React 19
- Next.js 16 / vinext
- TypeScript
- Cloudflare Pages、Workers AI 和 Cache API
- FACEIT Data API

## 本地开发

需要 Node.js 22.13 或更高版本。

```powershell
npm ci
Copy-Item .env.example .env.local
```

在 `.env.local` 中填写：

```text
FACEIT_API_KEY=你的_FACEIT_API_KEY
```

启动开发服务器：

```powershell
npm run dev
```

## 验证

```powershell
npm run lint
npm test
```

## 项目导航

- `AGENTS.md`：AI 协作入口与阅读顺序
- `docs/PROJECT_MAP.md`：页面、API、数据流和关键路径
- `docs/UI_GUIDE.md`：界面、文案与手机端规则
- `docs/DECISIONS.md`：不可无意回退的项目决策
- `skills/cs2-pro-tracker/SKILL.md`：项目领域规则

`.env.local`、构建缓存和 Cloudflare 发布包均已加入忽略规则，不应提交到仓库。

## 赛事维护

运行时自动刷新公开赛历、选中赛事对阵及可用统计；来源失败时显示已核验快照。`npm run data:events` 用于更新部署内的持久快照，来源检查失败不会覆盖原快照。统计为提供方可用样本，并非全量 HLTV Rating。产品范围及数据边界见 `docs/PRODUCT_REDESIGN_20261007.md`。
