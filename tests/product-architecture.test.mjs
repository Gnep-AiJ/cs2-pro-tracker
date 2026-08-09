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
  assert.match(route, /\/history\?game=cs2/);
  assert.match(route, /players\.length === 0/);
  assert.match(route, /recentLeaders/);
  assert.match(route, /trackedWinRate/);
});

test("rank positions link to a separate official ranking route", async () => {
  const [component, board, route] = await Promise.all([source("app/components/LiveTracker.tsx"), source("app/components/RankingsBoard.tsx"), source("app/api/rankings/route.ts")]);
  assert.match(component, /className="rank-entry" href=\{`\/rankings\?/);
  assert.match(board, /FACEIT 官方排名/);
  assert.match(route, /\/rankings\/games\/cs2\/regions/);
});

test("tiered API and browser caches preserve fast repeat visits", async () => {
  const [component, worker, newsRoute, rankingRoute] = await Promise.all([source("app/components/LiveTracker.tsx"), source("worker/index.ts"), source("app/api/news/route.ts"), source("app/api/rankings/route.ts")]);
  assert.match(component, /news-loading-progress/);
  assert.match(component, /readBrowserCache/);
  assert.match(component, /NEWS_CLIENT_TTL = 12 \* 60 \* 60_000/);
  assert.match(worker, /caches\.default/);
  assert.match(worker, /url\.pathname === "\/api\/news" \? "v16d" : "v16b"/);
  assert.match(worker, /cache\.put\(cacheKey, finalResponse\.clone\(\)\)/);
  assert.match(newsRoute, /max-age=43200/);
  assert.match(rankingRoute, /max-age=3600/);
  assert.doesNotMatch(component, />数据状态</);
});

test("mobile ranking layout keeps region badge and controls in normal flow", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.rank-hero > strong \{ width: fit-content; position: static;/);
  assert.match(css, /\.rank-filters \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("desktop and mobile daily report use one content hierarchy", async () => {
  const [component, css] = await Promise.all([source("app/components/LiveTracker.tsx"), source("app/globals.css")]);
  assert.doesNotMatch(component, /readBrowserCache<OverviewFeed>/);
  assert.match(component, /fetch\("\/api\/overview", \{ cache: "no-cache" \}\)/);
  assert.match(css, /\.daily-report-heading \{ position: relative;/);
  assert.match(css, /\.daily-hot-list \.spotlight-leaders \{ grid-template-columns: repeat\(3,/);
  assert.match(css, /\.spotlight-leaders \{ display: grid; grid-auto-columns: auto; grid-auto-flow: row;/);
});

test("customer-facing copy follows the approved Chinese format", async () => {
  const [home, player, match, rankings] = await Promise.all([
    source("app/components/LiveTracker.tsx"),
    source("app/components/PlayerDetail.tsx"),
    source("app/components/MatchDetail.tsx"),
    source("app/components/RankingsBoard.tsx"),
  ]);
  assert.match(home, /46 名职业选手 · 今日战绩/);
  assert.match(home, /更新 · UTC\+8/);
  assert.doesNotMatch(home, /中国时间|数据批次|近10场|查找玩家|优先读取缓存|个人比赛索引|每日报告/);
  assert.doesNotMatch(`${player}${match}${rankings}`, /bad response|国家 \/ 地区|K - D - A/);
  assert.match(player, /闪光敌人/);
  assert.match(rankings, /Top 1000/);
});
