# CS2 Pro Tracker

FACEIT 优先的 CS2 职业选手对局与热门赛事站，支持中文和 English。

正式网站：https://cs2pro.pages.dev

## 主要功能

- 已核验职业选手的 FACEIT 对局、榜单、对比与选手查找
- 热门赛事的赛程、进行中比赛和赛果
- 选手档案、注明日期的 Valve 积分，以及中英文 CS2 动态
- 桌面与手机布局；全站保留联系与微信打赏入口

## 技术栈

React 19、Next.js 16 / vinext、TypeScript。部署在 Cloudflare Pages，使用 Workers AI 与 Cache API。比赛与选手数据来自 FACEIT Data API 和 PandaScore。

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

先把 `.env.example` 复制为 `.env.local`，再按变量名填写。只提交变量名，不要提交凭据值。`.env.example` 中的名称：

- `FACEIT_API_KEY`
- `PANDASCORE_API_TOKEN`
- `PANDASCORE_EVENT_MAP`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `RATING_FEED_URL`
- `RATING_FEED_TOKEN`
- `HLTV_AUTHORIZED_ACCESS`

本地查看对局和赛事时，通常需要 `FACEIT_API_KEY` 和 `PANDASCORE_API_TOKEN`。`.openai/hosting.json` 保持现有字段供构建读取；`project_id` 使用占位符，真实 Sites 项目 ID 只在本地填写，不要提交。

## 文档

发布过程、回滚信息和更完整的产品说明留在 `docs/`，不在本页展开：

- [2026-10-09 / 10 发布记录](docs/RELEASE_20261009_PORTAL.md)
- [2026-10-07 发布记录](docs/RELEASE_20261007.md)
- [项目地图](docs/PROJECT_MAP.md)
- [界面规则](docs/UI_GUIDE.md)
- [产品决策](docs/DECISIONS.md)
- [Portal 界面记录](docs/PORTAL_UI_20261009.md)

校验命令：`npm run lint`、`npm test`。
