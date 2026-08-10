import assert from "node:assert/strict";
import test from "node:test";

function rss(source, count, publishedAt) {
  const items = Array.from({ length: count }, (_, index) => `
    <item>
      <title>${source} CS2 roster update ${index + 1}</title>
      <description>${source} reports a verified Counter-Strike roster update for team ${index + 1}.</description>
      <link>https://example.com/${source.toLowerCase()}/${index + 1}</link>
      <guid>${source.toLowerCase()}-news-${index + 1}</guid>
      <pubDate>${publishedAt}</pubDate>
    </item>`).join("");
  return `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
}

test("news translation covers every English item before the response is cached", async () => {
  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;
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

  const publishedAt = new Date().toUTCString();
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("5eplay.com/api/article")) {
      return Response.json({ data: { list: [] } });
    }
    if (url.includes("hltv.org/rss/news")) {
      return new Response(rss("HLTV", 4, publishedAt), { headers: { "content-type": "application/rss+xml" } });
    }
    if (url.includes("dust2.us/rss")) {
      return new Response(rss("Dust2", 4, publishedAt), { headers: { "content-type": "application/rss+xml" } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const app = await import(`../dist/server/index.js?news-translation-test=${Date.now()}`);
    let aiCalls = 0;
    const env = {
      AI: {
        async run(_model, input) {
          aiCalls += 1;
          const fields = JSON.parse(input.messages[1].content);
          return {
            response: JSON.stringify({
              translations: fields.map(field => ({
                id: field.id,
                title: `中文标题 ${field.id}`,
                summary: `中文摘要 ${field.id}`,
              })),
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
    const request = () => new Request("https://example.com/api/news", {
      headers: { accept: "application/json" },
    });

    const first = await app.default.fetch(request(), env, ctx);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("x-ai-translation"), "translated");
    assert.equal(first.headers.get("x-ai-translation-coverage"), "8/8");
    assert.notEqual(first.headers.get("cache-control"), "no-store");
    const payload = await first.json();
    assert.equal(payload.items.length, 8);
    assert.ok(payload.items.every(item => item.aiTranslated === true));
    assert.ok(payload.items.every(item => item.title.startsWith("中文标题 ")));
    assert.ok(payload.items.every(item => item.description.startsWith("中文摘要：")));
    assert.ok(payload.items.every(item => /CS2 roster update/.test(item.originalTitle)));
    assert.equal(aiCalls, 2);
    await Promise.all(pending);

    const second = await app.default.fetch(request(), env, ctx);
    assert.equal(second.headers.get("x-ai-translation-coverage"), "8/8");
    assert.equal(aiCalls, 2);
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
    globalThis.fetch = originalFetch;
  }
});
