import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const root = 'outputs/release-20261008-profile-data', base = 'https://cs2pro.pages.dev';
async function json(path, options = {}) {
  const response = await fetch(base + path + (path.includes('?') ? '&' : '?') + '_check=' + Date.now(), { ...options, signal: AbortSignal.timeout(40000) });
  assert.equal(response.status, 200, path);
  return response.json();
}
const lab = await json('/api/faceit/lab');
assert.equal(lab.storage, 'persistent');
const profiles = [];
for (const name of ['donk666', 'lilpeepfan-']) {
  const { player } = await json('/api/players/' + name);
  assert.equal(player.archive.storage, 'persistent');
  assert.equal(player.archive.observedAt, lab.observedAt);
  const archived = lab.players.find(p => p.id === player.id);
  assert.ok(archived);
  let fields = 0;
  for (const match of player.recentMatches) for (const key of match.advancedArchiveFields || []) {
    assert.equal(match[key], archived.samples.find(s => s.id === match.id)?.[key]); fields++;
  }
  assert.ok(fields > 0, name + ' archived advanced metrics');
  profiles.push({ name, id: player.id, archive: player.archive, matches: player.recentMatches.length, verifiedArchiveFields: fields });
}
const analyses = [];
for (const language of ['zh', 'en']) {
  const result = await json('/api/analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: 'faceit', names: ['donk666'], limit: 10, language }) });
  assert.equal(result.subjects, 1); assert.equal(result.facts[0].requestedMatches, 10);
  assert.ok(result.facts[0].entrySuccess.n > 0); assert.equal(result.facts[0].matchIds, undefined);
  assert.equal(result.archiveObservedAt, lab.observedAt); assert.ok(result.summary);
  analyses.push({ language, generated: result.generated, reason: result.reason, summary: result.summary, facts: result.facts });
}
await mkdir(root, { recursive: true });
const report = { checkedAt: new Date().toISOString(), site: base, samples: lab.players.flatMap(p => p.samples).length, profiles, analyses };
await writeFile(root + '/profile-data.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
