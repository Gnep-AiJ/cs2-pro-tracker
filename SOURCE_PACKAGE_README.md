# CS2 Pro Tracker — 完整源码包

这是当前线上版本的完整源代码快照，包含 Next.js/Vinext 页面、API Routes、样式、数据库模型、构建脚本、测试、Sites 部署配置，以及 `skills/cs2-pro-tracker/SKILL.md` 项目维护 Skill。

## 包含内容

- `app/`：首页、FACEIT、赛事、动态与选手详情页面，以及实时数据 API
- `db/`、`drizzle/`、`prisma/`：数据层与数据库模型
- `scripts/`、`build/`、`worker/`：构建、校验与边缘运行文件
- `.openai/hosting.json`：当前 Sites 项目标识与部署配置
- `skills/cs2-pro-tracker/SKILL.md`：可复用的项目开发与维护说明
- `package.json`、`package-lock.json`：依赖与锁定版本
- `tests/`：渲染测试

## 本地运行

```bash
npm ci
npm run dev
```

生产构建：

```bash
npm run build
```

## 数据说明

- 选手数据来自 FACEIT 公开网页接口
- 最近 10 场会获取逐场 K-D-A、K/D、K/R、ADR、爆头率、MVP、比分与 ELO 变化
- 最近 30 场用于状态趋势统计
- FACEIT 公开逐场数据没有独立 Rating 字段时，页面不会估算或伪造
- 新闻与赛事模块使用公开来源并保留来源链接

## 未包含内容

源码包不包含 `node_modules`、构建缓存、`.git` 历史、临时文件或任何本地凭据。这些不是源代码，可通过 `npm ci` 和 `npm run build` 重新生成。
