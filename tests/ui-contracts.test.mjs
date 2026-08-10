import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("team selector stays compact and player avatars render in their card layer", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("app/components/LiveTracker.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  const teamDirectory = component.match(/<div className="team-directory"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.ok(teamDirectory);
  assert.doesNotMatch(teamDirectory, /team\.members|member\.display|<img/);
  assert.match(css, /\.player-avatar\s*\{[^}]*display:\s*grid;[^}]*overflow:\s*hidden;/);
  assert.match(css, /\.player-avatar\s+img\s*\{[^}]*object-fit:\s*cover;/);
});

test("recent form stays compact and links to full match history", async () => {
  const component = await readFile(new URL("app/components/PlayerDetail.tsx", root), "utf8");
  assert.match(component, /function RecentFormStrip/);
  assert.match(component, /matches\.slice\(0, 5\)/);
  assert.match(component, /查看完整比赛记录/);
  assert.doesNotMatch(component, /RecentFormBoard|player-v3-form-grid|<svg/);
});

test("news aggregation excludes YouTube and Perfect World promotions", async () => {
  const route = await readFile(new URL("app/api/news/route.ts", root), "utf8");
  assert.doesNotMatch(route, /youtube\.com|CREATOR_FEEDS/);
  assert.doesNotMatch(route, /PERFECT_NEWS|getPerfectWorld|完美世界 CS 国服/);
  assert.match(route, /PROMOTIONAL_PATTERN/);
  assert.match(route, /qualityScore/);
  assert.match(route, /balanceTopSources/);
});

test("search UI does not expose ranking-scope development copy", async () => {
  const component = await readFile(new URL("app/components/LiveTracker.tsx", root), "utf8");
  assert.doesNotMatch(component, /不限\s*Top\s*10\s*阵容/i);
});

test("home has no hard-coded popular player strip", async () => {
  const component = await readFile(new URL("app/components/LiveTracker.tsx", root), "utf8");
  assert.doesNotMatch(component, /popularPlayers|popular-player-links|热门选手/);
});

test("player navigation uses three uniform data sections", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("app/components/PlayerDetail.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(component, /数据概览/);
  assert.match(component, /地图数据/);
  assert.match(component, /比赛记录/);
  assert.match(css, /\.player-v3-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(css, /button\.matches-tab/);
});

test("Cloudflare worker applies the optional Workers AI translation binding", async () => {
  const [worker, translator] = await Promise.all([
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("worker/translate-news.ts", root), "utf8"),
  ]);
  assert.match(worker, /translateNews\(response, env\.AI, ctx\)/);
  assert.match(translator, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
  assert.match(translator, /保留选手、战队、赛事、地图和比分等专有名词原文/);
  assert.match(translator, /translateBatch/);
  assert.match(translator, /const BATCH_SIZE = 5/);
  assert.match(translator, /4_000/);
  assert.match(translator, /status: "warming"/);
  assert.match(translator, /Promise\.all\(batches\.map/);
  assert.match(translator, /field\.item\.title = translated\.title/);
  assert.match(translator, /Object\.keys\(translations\)\.length === expected\.size/);
  assert.doesNotMatch(translator, /slice\(0, 6\)/);
  assert.match(translator, /x-ai-translation/);
  assert.match(translator, /x-ai-summary/);
  assert.match(translator, /x-ai-translation-coverage/);
  assert.match(translator, /headers\.set\("cache-control", "no-store"\)/);
  assert.match(translator, /binding-missing/);
});

test("mobile FACEIT layout keeps a compact daily overview before search and players", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("app/components/LiveTracker.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(component, /className="faceit-controls"/);
  assert.match(component, /className="daily-overview"/);
  assert.match(component, /data-strip-\$\{tab\}/);
  assert.match(css, /\.faceit-controls\s+\.player-search-row\s*\{[^}]*order:\s*1/);
  assert.match(css, /\.team-directory\s*\{[^}]*display:\s*flex;[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.hero\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(css, /\.hero\s*\{\s*display:\s*none;/);
});

test("player detail reads official regional and country ranking positions", async () => {
  const [route, component] = await Promise.all([
    readFile(new URL("app/api/players/[nickname]/route.ts", root), "utf8"),
    readFile(new URL("app/components/PlayerDetail.tsx", root), "utf8"),
  ]);
  assert.match(route, /rankings\/games\/cs2\/regions/);
  assert.match(route, /countryPosition/);
  assert.match(component, /区域排名/);
  assert.match(component, /国家排名/);
});

test("tracked professionals resolve by immutable FACEIT player ID", async () => {
  const [directory, liveRoute, playerRoute] = await Promise.all([
    readFile(new URL("app/data/tracked-players.ts", root), "utf8"),
    readFile(new URL("app/api/live/route.ts", root), "utf8"),
    readFile(new URL("app/api/players/[nickname]/route.ts", root), "utf8"),
  ]);
  const ids = new Set(directory.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g) || []);
  assert.equal(ids.size, 46);
  assert.match(directory, /\["kyousuke", "CEMEN_BAKIN"\]/);
  assert.match(directory, /kyousuke:\s*"64000660-f2d2-4c9b-8e29-6ad5ec2b49cf"/);
  assert.match(liveRoute, /players\/\$\{encodeURIComponent\(tracked\.faceitPlayerId\)\}/);
  assert.match(liveRoute, /rankings\/games\/cs2\/regions/);
  assert.doesNotMatch(liveRoute, /players\?nickname=/);
  assert.match(playerRoute, /knownPlayer\.faceitPlayerId/);
  assert.match(playerRoute, /FACEIT 身份尚未核验/);
});

test("mobile player profile keeps identity, rank, tabs, and compact match metrics", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("app/components/PlayerDetail.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);
  assert.match(component, /CHALLENGER/);
  assert.match(component, /player-v3-level-line/);
  assert.match(css, /Player mobile v4/);
  assert.match(css, /\.player-v3-tabs\s*\{[^}]*position:\s*sticky/);
  assert.match(css, /\.player-v3-hero\s*\{[^}]*min-height:\s*0/);
  assert.match(css, /player-v3-match-stats > span:nth-child\(4\)/);
});
