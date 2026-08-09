import { ProxyAgent, fetch } from "undici";

const production = process.argv[2] ?? "https://cs2pro.pages.dev";
const preview = process.argv[3];
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

async function request(path, base = production) {
  const response = await fetch(`${base}${path}`, {
    dispatcher,
    headers: { "user-agent": "cs2pro-release-check/1.0" },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML routes are expected here as well.
  }
  return { response, text, json };
}

for (const base of [preview, production].filter(Boolean)) {
  for (const path of ["/", "/faceit", "/rankings", "/news"]) {
    const { response, text } = await request(path, base);
    console.log(JSON.stringify({
      url: `${base}${path}`,
      status: response.status,
      hasDeveloperCopy: /\u6a21\u62df\u6570\u636e|\u5f00\u53d1\u6587\u6848|\u6bcf 5 \u5206\u949f\u5237\u65b0/.test(text),
    }));
  }
}

const overview = await request("/api/overview");
console.log(JSON.stringify({
  endpoint: "overview",
  status: overview.response.status,
  summary: overview.json?.summary ?? null,
  coverage: overview.json?.coverage ?? null,
  error: overview.json?.error ?? null,
}));

const ranking = await request("/api/rankings?region=EU");
console.log(JSON.stringify({
  endpoint: "rankings",
  status: ranking.response.status,
  region: ranking.json?.region ?? null,
  players: ranking.json?.items?.length ?? 0,
  first: ranking.json?.items?.[0]?.nickname ?? null,
  error: ranking.json?.error ?? null,
}));

const live = await request("/api/live");
const livePlayers = live.json?.faceit?.items ?? [];
console.log(JSON.stringify({
  endpoint: "live",
  status: live.response.status,
  players: livePlayers.length,
  names: livePlayers.map((player) => player.name ?? player.nickname),
  warning: live.json?.faceit?.warning ?? null,
  coverage: live.json?.faceit?.coverage ?? null,
  matches: (live.json?.matches?.items ?? live.json?.matches ?? []).length,
}));

for (const nickname of ["m0NESY", "NiKo"]) {
  const result = await request(`/api/players/${encodeURIComponent(nickname)}`);
  const data = result.json;
  const matches = data?.player?.recentMatches ?? [];
  console.log(JSON.stringify({
    endpoint: "player",
    nickname,
    status: result.response.status,
    elo: data?.player?.elo ?? null,
    matches: matches.length,
    detailed: matches.filter((match) => match.stats || match.kills != null).length,
    error: data?.error ?? null,
  }));
}

const news = await request("/api/news");
const newsItems = news.json?.items ?? news.json?.news ?? [];
const now = Date.now();
console.log(JSON.stringify({
  endpoint: "news",
  status: news.response.status,
  count: newsItems.length,
  sources: [...new Set(newsItems.map((item) => item.source).filter(Boolean))],
  undated: newsItems.filter((item) => !(item.publishedAt || item.date)).length,
  olderThan30Days: newsItems.filter((item) => {
    const timestamp = Date.parse(item.publishedAt || item.date || "");
    return Number.isFinite(timestamp) && now - timestamp > 31 * 86_400_000;
  }).length,
}));
