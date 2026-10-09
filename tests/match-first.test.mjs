import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
async function module(path) {
  const result = await build({ entryPoints: [new URL(`../${path}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'native-next-response', setup(builder) { builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: new URL('../node_modules/next/server.js', import.meta.url).href, external: true })); } }] });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text + `\n// ${Math.random()}`).toString('base64')}`);
}
const data = await module('app/lib/faceit-matches.ts');
const provider = await module('app/lib/event-provider.ts');
const scoreboard = await module('app/lib/scoreboard-view.ts');
const identities = [{ id: 'verified-pro', name: 'donk', lookup: 'donk666' }];
const history = { match_id: '1-match-test', game: 'cs2', finished_at: 1791360000, results: { score: { faction1: '13', faction2: '0' } }, teams: { faction1: { nickname: 'team_donk', players: [{ player_id: 'verified-pro', nickname: 'donk666' }, ...Array.from({ length: 4 }, (_, i) => ({ player_id: `a${i}`, nickname: `a${i}` }))] }, faction2: { nickname: 'team_other', players: Array.from({ length: 5 }, (_, i) => ({ player_id: `b${i}`, nickname: `b${i}` })) } } };

test('match feed deduplicates by match ID, preserves zero scores and binds professionals by ID', () => {
  const items = data.mergeMatchHistories([{ items: [history] }, { items: [history] }], identities);
  assert.equal(items.length, 1);
  assert.equal(items[0].tracked.length, 1);
  assert.equal(items[0].teams[1].score, 0);
  assert.equal(items[0].rosterComplete, true);
  const impostor = structuredClone(history);
  impostor.teams.faction1.players[0].player_id = 'unverified';
  assert.equal(data.mergeMatchHistories([{ items: [impostor] }], identities).length, 0);
  assert.equal(data.normalizeMatch({ ...history, game: 'csgo' }, identities), null);
  assert.equal(data.normalizeMatch({ ...history, finished_at: 9999999999 }, identities), null);
  assert.equal(data.normalizeMatch({ ...history, voting: { map: { pick: ['de_nuke', 'de_mirage'] } } }, identities).map, null);
  assert.equal(data.finite(false), null);
});

test('saved observations do not fabricate a full roster or scores; filters use actual match fields', () => {
  const feed = data.savedMatchFeed({ observedAt: '2026-10-08T00:00:00Z', players: [{ id: 'e5e8e2a6-d716-4493-b949-e16965f41654', name: 'donk', lookup: 'donk666', samples: [{ id: '1-match-test', playedAt: '2026-10-07T00:00:00Z', map: 'nuke', kills: 0, deaths: 20, adr: 0 }] }], coverage: { history: 1 } });
  assert.equal(feed.status, 'saved');
  assert.equal(feed.items[0].teams.length, 0);
  assert.equal(feed.items[0].rosterComplete, false);
  assert.equal(feed.items[0].tracked[0].kills, 0);
  assert.equal(data.selectMatches(feed.items, 'donk', 'nuke', 'recent', null).length, 1);
  assert.equal(data.selectMatches(feed.items, '', 'mirage', 'recent', null).length, 0);
  assert.equal(data.selectMatches(feed.items, '', 'all', 'recent', '2026-10-08').length, 0);
});

test('authorized event mapping cannot mix tournaments or expose scheduled placeholder scores', () => {
  assert.equal(provider.providerTournament('8244', '{"8244":123}'), 123);
  assert.equal(provider.providerTournament('8244', 'broken'), null);
  const fixture = { id: 10, tournament: { id: 123 }, status: 'not_started', opponents: [{ opponent: { id: 1, name: 'A' } }, { opponent: { id: 2, name: 'B' } }], results: [{ team_id: 1, score: 0 }, { team_id: 2, score: 0 }] };
  assert.equal(provider.normalizeProviderFixture(fixture, 124), null);
  assert.deepEqual(provider.normalizeProviderFixture(fixture, 123).teams.map(t => t.score), [null, null]);
  assert.deepEqual(provider.normalizeProviderFixture({ ...fixture, status: 'finished' }, 123).teams.map(t => t.score), [0, 0]);
  assert.equal(provider.normalizeProviderFixture({ ...fixture, status: 'running' }, 123).status, 'running');
});

test('FACEIT feed uses bounded requests and does not cache failed or incomplete history', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.FACEIT_API_KEY;
  process.env.FACEIT_API_KEY = 'unit-test-key';
  const id = 'e5e8e2a6-d716-4493-b949-e16965f41654';
  const fixture = structuredClone(history); fixture.teams.faction1.players[0].player_id = id;
  let calls = 0, active = 0, maximum = 0;
  try {
    globalThis.fetch = async url => {
      calls++; active++; maximum = Math.max(active, maximum);
      await new Promise(resolve => setTimeout(resolve, 2)); active--;
      return Response.json(String(url).includes('/history?') ? { items: [fixture] } : fixture);
    };
    const route = await module('app/api/faceit/matches/route.ts');
    const response = await route.GET(), feed = await response.json();
    assert.equal(feed.status, 'ready'); assert.equal(feed.items.length, 1);
    assert.ok(maximum <= 6); assert.ok(calls <= 26);
    const before = calls; await route.GET(); assert.equal(calls, before);
    const failed = await module('app/api/faceit/matches/route.ts');
    globalThis.fetch = async () => { throw new Error('source_failed'); };
    const fallback = await failed.GET();
    assert.equal(fallback.headers.get('cache-control'), 'no-store');
    assert.equal((await fallback.json()).status, 'saved');
    delete process.env.FACEIT_API_KEY;
    const unconfigured = await failed.GET();
    assert.equal((await unconfigured.json()).status, 'unconfigured');
    assert.equal(unconfigured.headers.get('cache-control'), 'no-store');
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.FACEIT_API_KEY; else process.env.FACEIT_API_KEY = oldKey; }
});

test('match details keep each map separate and retain metadata when stats fail', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.FACEIT_API_KEY;
  process.env.FACEIT_API_KEY = 'unit-test-key';
  const detail = { ...history, teams: { faction1: { name: 'team_A', roster: [{ player_id: 'one', nickname: 'A' }] }, faction2: { name: 'team_B', roster: [{ player_id: 'two', nickname: 'B' }] } } };
  const round = (map, score) => ({ round_stats: { Map: map }, teams: [{ nickname: 'team_A', team_stats: { 'Final Score': score, 'Team Win': 1 }, players: [{ player_id: 'one', nickname: 'A', player_stats: { Kills: 13, Deaths: 15, ADR: 0, ... (map==='de_nuke'?{Headshots:8,'Headshots %':62}:{'Headshots %':62,Headshots:8}) } }] }, { nickname: 'team_B', team_stats: { 'Final Score': 0 }, players: [] }] });
  try {
    const route = await module('app/api/matches/[matchId]/route.ts');
    globalThis.fetch = async url => Response.json(String(url).endsWith('/stats') ? { rounds: [round('de_nuke', 13), round('de_mirage', 16)] } : detail);
    const response = await route.GET(new Request('https://test/api/matches/1-match-test'), { params: Promise.resolve({ matchId: '1-match-test' }) });
    const { match } = await response.json();
    assert.deepEqual(match.maps.map(m => m.map), ['nuke', 'mirage']);
    assert.equal(match.maps[1].scoreboard[0].score, 16);
    assert.equal(match.maps[0].scoreboard[0].players[0].adr, 0);
    assert.deepEqual(match.maps.map(m=>m.scoreboard[0].players[0].headshotPercent),[62,62]);
    globalThis.fetch = async url => String(url).endsWith('/stats') ? new Response('', { status: 404 }) : Response.json(detail);
    const partial = await route.GET(new Request('https://test/api/matches/1-match-test'), { params: Promise.resolve({ matchId: '1-match-test' }) });
    const result = await partial.json();
    assert.equal(partial.status, 200); assert.equal(partial.headers.get('cache-control'), 'no-store');
    assert.equal(result.match.statsAvailable, false); assert.equal(result.match.scoreboard[0].players[0].nickname, 'A');
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.FACEIT_API_KEY; else process.env.FACEIT_API_KEY = oldKey; }
});

test('original contact QR is preserved and contact access exists on all public page shells', async () => {
  const qr = await readFile(new URL('../public/wechat-community-qr-v1.png', import.meta.url));
  assert.equal(createHash('sha256').update(qr).digest('hex'), '39dd981dbe849cf3e8f810b7015736c62d2e87ac93c257592e5dcbdfc58191be');
  const support = await readFile(new URL('../public/wechat-support-qr.png', import.meta.url));
  assert.equal(createHash('sha256').update(support).digest('hex'), '0196f6379304cd5e7df086cf46ab40cb3a28d313fd81ab803026fb3d67399001');
  const { default: worker } = await import('../dist/server/index.js');
  for (const path of ['/', '/faceit', '/matches', '/rankings', '/news', '/community', '/players/donk666', '/players/donk666/matches/1-match-test']) {
    const response = await worker.fetch(new Request(`https://cs2pro.test${path}`, { headers: { Accept: 'text/html' } }), { ASSETS: { fetch: async () => new Response('') } }, { waitUntil() {}, passThroughOnException() {} });
    const html = await response.text();
    assert.equal(response.status, 200, path); assert.match(html, /class="contact-access"/, path); assert.match(html, /contact-title/, path);
  }
});

test('scoreboards hide unsupported metrics and incomplete pairs, preserving real zero values', () => {
  assert.deepEqual(scoreboard.scoreboardColumns([{ kills: null, kd: null, adr: null }]), []);
  assert.deepEqual(scoreboard.scoreboardColumns([{ kills: 0, kd: null, adr: 0 }]).map(column => column.key), ['kda', 'adr']);
  assert.deepEqual(scoreboard.extraScoreMetrics({ rating: null, swing: undefined, entryWins: 0, entryCount: null }), []);
  const metrics = scoreboard.extraScoreMetrics({ rating: 0, swing: -2, entryWins: 0, entryCount: 3, utilityAdr: 0 });
  assert.deepEqual(metrics.map(metric => metric.key), ['rating', 'swing', 'entry', 'utilityAdr']);
  assert.deepEqual(metrics.find(metric => metric.key === 'entry').values, [0, 3]);
  assert.deepEqual(scoreboard.extraScoreMetrics({ kr: NaN, enemiesFlashed: Infinity }), []);
});

test('native provider events select the current series and never renew stale catalogue observations', async () => {
  const oldFetch=globalThis.fetch, oldToken=process.env.PANDASCORE_API_TOKEN, oldNow=Date.now;
  let now=Date.parse('2026-10-09T12:00:00Z'),calls=0;
  process.env.PANDASCORE_API_TOKEN='unit-test-pandascore-key'; Date.now=()=>now;
  const title={id:13,slug:'cs-2'};
  const stage={id:10,name:'Playoffs',tier:'a',videogame_title:title,serie:{id:99,full_name:'2026',begin_at:'2026-10-01T00:00:00Z',end_at:'2026-10-11T00:00:00Z'},league:{id:2,name:'EPL',url:'https://example.org/'}};
  const fixture={id:1,tournament:{id:10},serie:{id:99},videogame_title:title,status:'running',opponents:[{opponent:{id:1,name:'A'}},{opponent:{id:2,name:'B'}}],results:[{team_id:1,score:1},{team_id:2,score:0}]};
  try {
    globalThis.fetch=async url=>{calls++; return Response.json(String(url).includes('/tournaments/running')?[stage]:String(url).includes('/tournaments/')?[]:[fixture]);};
    const route=await module('app/api/events/catalogue/route.ts');
    const response=await route.GET(new Request('https://test/api/events'));
    const feed=await response.json();
    assert.equal(feed.details.id,'ps-99'); assert.equal(feed.details.saved,false);
    assert.deepEqual(feed.details.matches[0].teams.map(t=>t.score),[1,0]);
    assert.match(response.headers.get('cache-control'),/s-maxage=300/); assert.equal(calls,4);
    const before=feed.observedAt;
    now+=601000; delete process.env.PANDASCORE_API_TOKEN;
    const stale=await route.GET(new Request('https://test/api/events'));
    const fallback=await stale.json();
    assert.equal(fallback.saved,true); assert.equal(fallback.observedAt,before);
    assert.equal(fallback.details.matches.length,1); assert.equal(fallback.details.observedAt,feed.details.observedAt);
    assert.equal(stale.headers.get('cache-control'),'no-store'); assert.equal(calls,4);
  } finally {globalThis.fetch=oldFetch;Date.now=oldNow;if(oldToken===undefined)delete process.env.PANDASCORE_API_TOKEN;else process.env.PANDASCORE_API_TOKEN=oldToken;}
});

test('FACEIT metadata retains history fields and complete rosters while accepting fresh real values', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.FACEIT_API_KEY;
  process.env.FACEIT_API_KEY = 'unit-test-key';
  const fixture = structuredClone(history);
  const proId = 'e5e8e2a6-d716-4493-b949-e16965f41654';
  fixture.teams.faction1.players[0].player_id = proId;
  fixture.teams.faction1.players[0].avatar = 'https://example.org/old-avatar.png';
  fixture.voting = { map: { pick: ['de_mirage'] } };
  fixture.competition_name = 'Ranked match'; fixture.region = 'EU'; fixture.game_mode = '5v5';
  const partial = { match_id: fixture.match_id, game: 'cs2', teams: {
    faction1: { roster: [{ player_id: proId, nickname: 'updated-pro' }] }, faction2: {},
  } };
  try {
    globalThis.fetch = async url => Response.json(String(url).includes('/history?') ? { items: [fixture] } : partial);
    const route = await module('app/api/faceit/matches/route.ts');
    const feed = await (await route.GET()).json(), item = feed.items[0];
    assert.equal(item.id, fixture.match_id); assert.equal(item.status, 'FINISHED');
    assert.equal(item.playedAt, new Date(fixture.finished_at * 1000).toISOString());
    assert.deepEqual(item.teams.map(team => team.score), [13, 0]);
    assert.deepEqual(item.teams.map(team => team.players.length), [5, 5]);
    assert.equal(item.rosterComplete, true); assert.equal(item.map, 'mirage');
    assert.equal(item.competition, 'Ranked match'); assert.equal(item.region, 'EU'); assert.equal(item.mode, '5v5');
    assert.equal(item.tracked[0].nickname, 'updated-pro');
    assert.equal(item.tracked[0].avatar, 'https://example.org/old-avatar.png');

    const fresh = structuredClone(fixture);
    fresh.results.score = { faction1: 0, faction2: 13 };
    fresh.voting.map.pick = ['de_nuke'];
    fresh.teams.faction1.players[0].nickname = 'fresh-pro';
    globalThis.fetch = async url => Response.json(String(url).includes('/history?') ? { items: [fixture] } : fresh);
    const freshRoute = await module('app/api/faceit/matches/route.ts');
    const updated = (await (await freshRoute.GET()).json()).items[0];
    assert.deepEqual(updated.teams.map(team => team.score), [0, 13]);
    assert.equal(updated.map, 'nuke'); assert.equal(updated.tracked[0].nickname, 'fresh-pro');

    fresh.voting.map.pick = ['de_nuke', 'de_mirage'];
    const seriesRoute = await module('app/api/faceit/matches/route.ts');
    assert.equal((await (await seriesRoute.GET()).json()).items[0].map, null);

    const wrong = { ...fresh, match_id: '1-other-match' };
    globalThis.fetch = async url => Response.json(String(url).includes('/history?') ? { items: [fixture] } : wrong);
    const wrongRoute = await module('app/api/faceit/matches/route.ts');
    const retained = (await (await wrongRoute.GET()).json()).items[0];
    assert.equal(retained.id, fixture.match_id); assert.equal(retained.map, 'mirage');
    assert.deepEqual(retained.teams.map(team => team.score), [13, 0]);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.FACEIT_API_KEY; else process.env.FACEIT_API_KEY = oldKey; }
});
