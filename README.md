# CS2 Pro Tracker

面向中文玩家的 CS2 职业选手信息聚合站，提供 FACEIT 日报、官方排名、选手数据、比赛记录和近期职业圈动态。

正式站点：https://cs2pro.pages.dev

## 主要功能

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
