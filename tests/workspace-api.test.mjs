import assert from "node:assert/strict";
import test from "node:test";

const context = { waitUntil() {}, passThroughOnException() {} };
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const { default: worker } = await import("../dist/server/index.js");

test("development markup cannot be replaced by a stale cached release shell", async () => {
  const previous = globalThis.caches;
  let reads = 0;
  globalThis.caches = { default: { match: async () => { reads++; return new Response("STALE SHELL"); } } };
  try {
    const request = new Request("https://cs2pro.test/", { headers: { accept: "text/html" } });
    const development = await worker.fetch(request, env, context);
    assert.match(await development.text(), /FACEIT matches/);
    assert.equal(reads, 0);
    const released = await worker.fetch(request, { ...env, RELEASE_VERSION: "verified-release" }, context);
    assert.equal(await released.text(), "STALE SHELL");
    assert.equal(reads, 1);
  } finally { globalThis.caches = previous; }
});

test("event calendar and observations remain available when upstream sources fail", async () => {
  const oldFetch=globalThis.fetch, oldCaches = globalThis.caches;
  globalThis.fetch=async()=>{throw new Error('blocked_source');};
  let writes = 0;
  globalThis.caches = { default: { match: async () => undefined, put: async () => { writes++; } } };
  try {
    const response = await worker.fetch(new Request("https://cs2pro.test/api/events"), env, context);
    assert.equal(response.status, 200);
    const feed = await response.json();
    assert.ok(feed.events.length>=5);
    assert.ok(feed.details.matches.length>=30);
    assert.equal(feed.details.saved,true);
    assert.ok(feed.details.players.some(p=>p.name==='donk'&&p.maps>0));
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(writes, 0);
    const future = await worker.fetch(new Request("https://cs2pro.test/api/events?event=8932"),env,context);
    const data=await future.json();
    assert.ok(data.details.players.length>0);
    assert.ok(data.details.players.every(p=>p.maps===null && p.providerScore===null));
  } finally {
    globalThis.caches = oldCaches;
    globalThis.fetch=oldFetch;
  }
});

test("event and individual search reject invalid context and find partial names", async()=>{
  const previous=globalThis.caches;
  globalThis.caches={default:{match:async()=>undefined,put:async()=>{}}};
  try {
    const search=await worker.fetch(new Request('https://cs2pro.test/api/search/players?domain=events&event=8244&q=don'),env,context);
    assert.equal(search.status,200);
    assert.equal(search.headers.get('cache-control'),'no-store');
    const result=await search.json();
    assert.equal(result.items[0].id,'hltv-21167');
    for(const [path,status] of [['/api/events?event=bad',400],['/api/events?event=999999',404],['/api/search/players?domain=wrong',400],['/api/search/players?event=999999',404],['/api/search/players?q='+ 'x'.repeat(41),400],['/api/players/donk666?playerId=bad',400],['/api/players/donk666?playerId=00000000-0000-0000-0000-000000000000',409]]) {
      const response=await worker.fetch(new Request('https://cs2pro.test'+path),env,context);assert.equal(response.status,status,path);
    }
  }finally{globalThis.caches=previous;}
});

test("invalid analysis inputs are rejected before fetching upstream data", async () => {
  for (const body of ["null", "[]", '{"domain":"invented","names":["Spirit"]}', '{"domain":"faceit","names":[]}']) {
    const response = await worker.fetch(new Request("https://cs2pro.test/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body }), env, context);
    assert.equal(response.status, 400);
  }
  const response = await worker.fetch(new Request("https://cs2pro.test/api/analysis", { method: "POST", body: "x".repeat(2049) }), env, context);
  assert.equal(response.status, 413);
});
