import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const base = 'https://cs2pro.pages.dev';
const release = '.cf-pages-release-cs2pro-20261009-portal-final';
const output = 'outputs/release-20261009-portal';
await mkdir(output, { recursive: true });
const report = [];
async function request(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, path + ' HTTP status');
  return response;
}
const checks = [
  ...['/', '/faceit', '/rankings', '/news'].map(path => async () => {
    const html = await (await request(path)).text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(m => m[1]))];
    assert.ok(assets.length > 0, 'Rendered assets');
    for (const asset of assets) await readFile(release + asset);
    return { path, status: 200, assets: assets.length, releaseAssetsMatch: true };
  }),
  ...['wechat-community-qr-v1.png', 'wechat-support-qr.png'].map(file => async () => {
    const remote = Buffer.from(await (await request('/' + file)).arrayBuffer());
    const local = await readFile('public/' + file);
    assert.deepEqual(remote, local, file + ' original bytes');
    return { path: '/' + file, status: 200, originalBytesMatch: true, sha256: createHash('sha256').update(remote).digest('hex') };
  }),
  ...[
    ['/api/search/players?domain=faceit&q=simple', data => assert.equal(data.items[0].id, 'ac71ba3c-d3d4-45e7-8be2-26aa3986867d')],
    ['/api/search/players?domain=faceit&q=m0ensy', data => assert.equal(data.items[0].id, '93306681-bce6-4369-8c41-e0bdba2597ed')],
    ['/api/rankings?region=EU', data => assert.ok(data.items?.length > 0)],
    ['/api/faceit/matches', data => { assert.equal(data.status, 'ready'); assert.ok(data.items.length > 0); }],
    ['/api/events/catalogue', data => { assert.equal(data.saved, false); assert.ok(data.events.some(e => e.provider === 'PandaScore')); assert.ok(data.details.matches.length > 0); }],
    ['/api/events/standings', data => { assert.equal(data.stale, false); assert.ok(data.items.length >= 10); }],
    ['/api/news', data => assert.ok((data.items ?? data.news)?.length > 0)],
    ['/api/players/simple?limit=10', data => { assert.ok(data.player); assert.ok(data.player.recentMatches?.length > 0); }],
  ].map(([path, validate]) => async () => {
    const response = await request(path);
    const data = await response.json();
    await writeFile(output + '/' + path.split('?')[0].replaceAll('/', '_') + (path.includes('q=') ? '_' + new URL(base + path).searchParams.get('q') : '') + '.json', JSON.stringify(data, null, 2));
    validate(data);
    return { path, status: 200, count: (data.items ?? data.news ?? data.events ?? data.player?.recentMatches)?.length, saved: data.saved, feedStatus: data.status, coverage: data.coverage, provider: data.events?.find(e => e.provider === 'PandaScore')?.provider, fixtures: data.details?.matches.length, cacheControl: response.headers.get('cache-control') };
  }),
];
// Keep the cold API request load bounded while still checking every result.
for (let start = 0; start < checks.length; start += 4) {
  const results = await Promise.allSettled(checks.slice(start, start + 4).map(check => check()));
  for (const result of results) {
    const entry = result.status === 'fulfilled' ? result.value : { failed: true, error: result.reason?.message || String(result.reason) };
    report.push(entry);
    console.log(JSON.stringify(entry));
  }
}
await writeFile(output + '/production-checks.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, report }, null, 2));
assert.ok(!report.some(check => check.failed), 'Production checks must all pass');
