import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("global overview is independent from team selection and covers verified roster", async () => {
  const [component, route] = await Promise.all([source("app/components/LiveTracker.tsx"), source("app/api/overview/route.ts")]);
  assert.match(component, /fetch\("\/api\/overview"/);
  assert.match(component, /今日 FACEIT<\/span><em>状态日报/);
  assert.match(component, /今日手感火热榜/);
  assert.match(component, /spotlight-leaders/);
  assert.doesNotMatch(component, /全员今日胜率|今日赢家|状态榜同时补充近期手感出色的选手/);
  assert.match(route, /trackedPlayers\.filter\(player => player\.faceitPlayerId\)/);
  assert.match(route, /const FACEIT_CONCURRENCY = 6/);
  assert.match(route, /offset \+= FACEIT_CONCURRENCY/);
  assert.match(route, /complete \? CACHE_CONTROL : "no-store"/);
  assert.match(route, /\/history\?game=cs2/);
  assert.match(route, /players\.length === 0/);
  assert.match(route, /recentLeaders/);
  assert.match(route, /trackedWinRate/);
  assert.match(route, /\n    players,\n/);
});

test("rank positions link to a separate official ranking route", async () => {
  const [component, board, route, insights, workerInsights] = await Promise.all([source("app/components/LiveTracker.tsx"), source("app/components/RankingsBoard.tsx"), source("app/api/rankings/route.ts"), source("app/api/rankings/insights/route.ts"), source("worker/ranking-insights.ts")]);
  assert.match(component, /className="rank-entry" href=\{`\/rankings\?/);
  assert.match(board, /FACEIT 官方排名/);
  assert.match(board, /职业日榜/);
  assert.match(board, /今日胜场/);
  assert.match(board, /今日活跃/);
  assert.match(board, /近期连胜/);
  assert.match(board, /const RELEASE_VERIFIED_PLAYER_COUNT = 44/);
  assert.match(board, /已收录 \$\{RELEASE_VERIFIED_PLAYER_COUNT\} 名核验选手/);
  assert.doesNotMatch(board, /返回 \$\{dailyFeed\.coverage\.returned\}/);
  assert.match(board, /fetch\("\/api\/overview"/);
  assert.match(board, /fetch\("\/api\/rankings\/insights"/);
  assert.doesNotMatch(board, /Workers AI 生成|规则摘要|daily-podium-avatar|daily-rank-initial/);
  assert.match(route, /\/rankings\/games\/cs2\/regions/);
  assert.match(insights, /CLOUDFLARE_API_TOKEN/);
  assert.match(insights, /response_format/);
  assert.match(insights, /json_schema/);
  assert.match(insights, /fallbackInsight/);
  assert.match(insights, /不改变排序/);
  assert.match(workerInsights, /ranking-insight-v4/);
  assert.match(workerInsights, /activeGenerations/);
  assert.match(workerInsights, /ctx\.waitUntil\(generation\)/);
  assert.match(workerInsights, /x-ai-insight": "warming"/);
  assert.match(workerInsights, /CS2 职业比赛数据分析助手/);
  assert.doesNotMatch(workerInsights, /CS2 数据编辑/);
  assert.match(workerInsights, /INVALID_SUMMARY_PATTERN/);
  assert.match(workerInsights, /title: fallback\.title/);
  assert.match(board, /cs2:rankings:insight:v4/);
  assert.match(board, /window\.setTimeout\(\(\) => void requestInsight\(false, key\), 5_000\)/);
});

test("tiered API and browser caches preserve fast repeat visits", async () => {
  const [component, worker, liveRoute, newsRoute, rankingRoute, packager, pagesEntry] = await Promise.all([source("app/components/LiveTracker.tsx"), source("worker/index.ts"), source("app/api/live/route.ts"), source("app/api/news/route.ts"), source("app/api/rankings/route.ts"), source("scripts/package-pages-release.mjs"), source("scripts/pages-worker-entry.mjs")]);
  assert.match(component, /news-loading-progress/);
  assert.match(component, /readBrowserCache/);
  assert.match(component, /cs2:live:v16e/);
  assert.match(component, /fetch\(`\/api\/live\?team=.*\{ cache: "no-store" \}\)/);
  assert.match(component, /referrerPolicy="no-referrer"/);
  assert.match(component, /NEWS_CLIENT_TTL = 12 \* 60 \* 60_000/);
  assert.match(worker, /caches\.default/);
  assert.match(worker, /url\.pathname === "\/api\/overview" \? "v17a"/);
  assert.match(worker, /url\.pathname === "\/api\/news" \? "v17b"/);
  assert.match(worker, /url\.pathname === "\/api\/live" \? "v16d"/);
  assert.match(component, /cs2:news:v17b/);
  assert.match(worker, /!\/\\bno-store\\b\/i\.test\(cacheControl\)/);
  assert.match(worker, /cache\.put\(cacheKey, finalResponse\.clone\(\)\)/);
  assert.match(worker, /page-shell-\$\{env\.RELEASE_VERSION \|\| "development"\}/);
  assert.match(packager, /createHash\("sha256"\)/);
  assert.match(packager, /process\.env\.CS2_RELEASE_VERSION/);
  assert.match(pagesEntry, /RELEASE_VERSION/);
  assert.match(worker, /request\.headers\.get\("accept"\).*includes\("text\/html"\)/s);
  assert.match(worker, /x-shell-cache/);
  assert.match(worker, /s-maxage=86400, stale-while-revalidate=604800/);
  assert.match(liveRoute, /hasCompleteFaceitData/);
  assert.match(liveRoute, /hasCompleteFaceitData \? CACHE_CONTROL : "no-store"/);
  assert.match(liveRoute, /coverage\.profiles === value\.faceit\.coverage\.requested/);
  assert.match(newsRoute, /max-age=43200/);
  assert.match(rankingRoute, /max-age=3600/);
  assert.doesNotMatch(component, />数据状态</);
});

test("mobile ranking layout keeps region badge and controls in normal flow", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.rank-hero > strong \{ width: fit-content; position: static;/);
  assert.match(css, /\.rank-filters \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.daily-podium-card\.podium-1 \{ grid-column: 1 \/ -1;/);
  assert.match(css, /\.daily-rank-row \{ grid-template-columns: 38px minmax\(0, 1fr\) auto 17px; \}/);
});

test("desktop and mobile daily report use one content hierarchy", async () => {
  const [component, css] = await Promise.all([source("app/components/LiveTracker.tsx"), source("app/globals.css")]);
  assert.doesNotMatch(component, /readBrowserCache<OverviewFeed>/);
  assert.match(component, /fetch\("\/api\/overview", \{ cache: "no-cache" \}\)/);
  assert.match(component, /fetch\("\/api\/overview".*\.then\(async overviewResponse/s);
  assert.match(css, /\.daily-report-heading \{ position: relative;/);
  assert.match(css, /\.daily-hot-list \.spotlight-leaders \{ grid-template-columns: repeat\(3,/);
  assert.match(css, /\.spotlight-leaders \{ display: grid; grid-auto-columns: auto; grid-auto-flow: row;/);
});

test("first visit avoids animation runtime and unnecessary web fonts", async () => {
  const [component, layout, css] = await Promise.all([
    source("app/components/LiveTracker.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
  ]);
  assert.doesNotMatch(component, /framer-motion|AnimatePresence|motion\./);
  assert.doesNotMatch(layout, /next\/font|Geist/);
  assert.match(css, /--font-geist-sans: "Segoe UI"/);
  assert.match(css, /--font-geist-mono: "SFMono-Regular"/);
});

test("customer-facing copy follows the approved Chinese format", async () => {
  const [home, player, match, rankings] = await Promise.all([
    source("app/components/LiveTracker.tsx"),
    source("app/components/PlayerDetail.tsx"),
    source("app/components/MatchDetail.tsx"),
    source("app/components/RankingsBoard.tsx"),
  ]);
  assert.match(home, /46 名职业选手 · 今日战绩/);
  assert.match(home, /const RELEASE_VERIFIED_PLAYER_COUNT = 44/);
  assert.match(home, /已收录 \$\{RELEASE_VERIFIED_PLAYER_COUNT\} 名核验选手/);
  assert.doesNotMatch(home, /已同步 \$\{overviewFeed\.coverage\.returned\}\/\$\{overviewFeed\.coverage\.verified\}/);
  assert.match(home, /更新 · UTC\+8/);
  assert.doesNotMatch(home, /中国时间|数据批次|近10场|查找玩家|优先读取缓存|个人比赛索引|每日报告/);
  assert.doesNotMatch(`${player}${match}${rankings}`, /bad response|国家 \/ 地区|K - D - A/);
  assert.match(player, /闪光敌人/);
  assert.match(rankings, /Top 1000/);
});

test("Spirit identities use pinned FACEIT IDs instead of nickname guesses", async () => {
  const identities = await source("app/data/tracked-players.ts");
  assert.match(identities, /magixx: "1ace868a-d60c-46b8-a61e-f51d40d0305b"/);
  assert.match(identities, /\["magixx", "lilpeepfan-", \["1xigam"\]\]/);
});

test("community and permanent contact share separate original contact and payment codes", async () => {
  const [community, route, tracker, header, contact] = await Promise.all([
    source("app/components/CommunityPage.tsx"),
    source("app/community/page.tsx"),
    source("app/components/LiveTracker.tsx"),
    source("app/components/SiteHeader.tsx"),
    source("app/components/CreatorContact.tsx"),
  ]);
  assert.match(community, /<CreatorContact/);
  assert.match(contact, /\/wechat-community-qr-v1\.png/);
  assert.match(contact, /\/wechat-support-qr\.png/);
  assert.match(contact, /unoptimized/);
  assert.match(contact, /重新加载二维码/);
  assert.match(contact, /问题反馈、功能建议/);
  assert.match(contact, /微信打赏/);
  assert.doesNotMatch(community, /一起把产品做得更好|分成|承诺分红|固定比例|界面体验.*数据问题/);
  assert.doesNotMatch(community, /<header>|<main|<footer>/);
  assert.match(route, /<LiveTracker initialTab="community"/);
  assert.match(header, /href: "\/matches", label: "赛事"/);
  assert.match(tracker, /tab === "community" \? <CommunityPage \/>/);
});

test("every product surface uses the shared site header", async () => {
  const [header, tracker, rankings, player, match] = await Promise.all([
    source("app/components/SiteHeader.tsx"),
    source("app/components/LiveTracker.tsx"),
    source("app/components/RankingsBoard.tsx"),
    source("app/components/PlayerDetail.tsx"),
    source("app/components/MatchDetail.tsx"),
  ]);
  assert.match(header, /const siteNav = \[/);
  assert.match(header, /href: "\/matches", label: "赛事"/);
  for (const component of [tracker, rankings, player, match]) {
    assert.match(component, /<SiteHeader /);
    assert.doesNotMatch(component, /<nav aria-label="站内导航">/);
  }
});
