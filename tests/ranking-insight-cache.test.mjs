import assert from "node:assert/strict";
import test from "node:test";

test("ranking insight warms once and serves the shared result without another AI call", async () => {
  const originalCaches = globalThis.caches;
  const stored = new Map();
  globalThis.caches = {
    default: {
      async match(request) {
        return stored.get(request.url)?.clone();
      },
      async put(request, response) {
        stored.set(request.url, response.clone());
      },
    },
  };

  try {
    const app = await import(`../dist/server/index.js?ranking-cache-test=${Date.now()}`);
    let aiCalls = 0;
    const env = {
      AI: {
        async run() {
          aiCalls += 1;
          return {
            response: JSON.stringify({
              title: "职业选手数据变化",
              summary: "player1 今日完成 3 场并取得 3 胜",
              highlights: [
                { rank: 1, label: "当前领先", note: "今日取得 3 胜" },
                { rank: 2, label: "紧随其后", note: "今日取得 2 胜" },
                { rank: 3, label: "榜单第三", note: "今日取得 1 胜" },
              ],
            }),
          };
        },
      },
    };
    const pending = [];
    const ctx = {
      waitUntil(promise) { pending.push(promise); },
      passThroughOnException() {},
    };
    const players = [1, 2, 3].map(index => ({
      id: `p${index}`,
      nickname: `player${index}`,
      team: `team${index}`,
      matches: 3,
      wins: 4 - index,
      losses: index - 1,
      winRate: 80 - index * 10,
      recentMatches: 5,
      recentWinRate: 70,
      currentWinStreak: 3 - index,
    }));
    const request = () => new Request("https://example.com/api/rankings/insights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "wins", players }),
    });

    const first = await app.default.fetch(request(), env, ctx);
    assert.equal(first.headers.get("x-ai-insight"), "warming");
    assert.equal((await first.json()).status, "fallback");
    await Promise.all(pending);

    const second = await app.default.fetch(request(), env, ctx);
    assert.equal(second.headers.get("x-ai-insight"), "shared-cache");
    const generated = await second.json();
    assert.equal(generated.status, "generated");
    assert.equal(generated.title, "player1 暂居今日胜场榜首");
    assert.doesNotMatch(generated.title, /职业选手数据变化|数据编辑|数据分析助手|Workers AI|AI 生成/i);
    assert.equal(generated.summary, "player1 今日完成 3 场并取得 3 胜");
    assert.equal(aiCalls, 1);
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});
