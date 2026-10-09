import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

async function providerModule() {
  const result = await build({ entryPoints: [new URL('../app/lib/event-provider.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text + '\n// ' + Math.random()).toString('base64'));
}
const epoch = Date.parse('2026-10-09T12:00:00Z');
const title = { id: 13, slug: 'cs-2' };
const stage = (id = 10, overrides = {}) => ({ id, name: 'Group A', tier: 's', videogame_title: title, begin_at: '2026-10-01T00:00:00Z', end_at: '2026-10-14T00:00:00Z', country: 'GB', prizepool: '100000 USD',
  league_id: 1, league: { id: 1, name: 'ESL Pro League', url: 'https://pro.eslgaming.com/csgo/proleague/' },
  serie_id: 99, serie: { id: 99, full_name: 'Season 24 2026', begin_at: '2026-10-01T00:00:00Z', end_at: '2026-10-14T00:00:00Z' },
  teams: [{ id: 1, name: 'A' }], expected_roster: [{ team: { id: 1, name: 'A' }, players: [{ id: 7, name: 'player', kills: 999, adr: 999 }] }], ...overrides });
const fixture = (id = 1, overrides = {}) => ({ id, tournament: { id: 10 }, tournament_id: 10, serie_id: 99, serie: { id: 99 }, videogame_title: title, status: 'finished', begin_at: '2026-10-09T12:00:00Z', number_of_games: 3,
  opponents: [{ opponent: { id: 1, name: 'A' } }, { opponent: { id: 2, name: 'B' } }], results: [{ team_id: 1, score: 2 }, { team_id: 2, score: 0 }], ...overrides });
const event = { id: 'ps-99', providerTournamentIds: [10] };

async function withRuntime(run) {
  const oldFetch = globalThis.fetch, oldNow = Date.now, oldToken = process.env.PANDASCORE_API_TOKEN;
  let now = epoch;
  process.env.PANDASCORE_API_TOKEN = 'local-unit-test-credential';
  Date.now = () => now;
  try { await run(await providerModule(), milliseconds => { now += milliseconds; }); }
  finally { globalThis.fetch = oldFetch; Date.now = oldNow; if (oldToken === undefined) delete process.env.PANDASCORE_API_TOKEN; else process.env.PANDASCORE_API_TOKEN = oldToken; }
}

test('catalogue joins exact series, excludes lower tiers/qualifiers and exposes identities without invented stats', async () => {
  const provider = await providerModule();
  const events = provider.normalizeProviderCatalogue([
    stage(), stage(11, { name: 'Playoffs' }), stage(12, { name: 'Open Qualifier' }),
    stage(13, { tier: 'b' }), stage(14, { league: { id: 1, name: 'Women League' } }),
    stage(15, { videogame_title: { id: 1, slug: 'cs-go' } }), stage(16, { serie_id: 101 }),
    stage(17, { serie: { id: 199, full_name: 'Season 24 2025', begin_at: '2025-10-01T00:00:00Z', end_at: '2025-10-14T00:00:00Z' }, serie_id: 199 }),
    stage(18, { serie: { id: 200, full_name: 'Season 25 2027', begin_at: '2027-10-01T00:00:00Z', end_at: '2027-10-14T00:00:00Z' }, serie_id: 200 }),
  ], epoch);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'ps-99');
  assert.deepEqual(events[0].providerTournamentIds, [10, 11]);
  assert.equal(events[0].prize, '100000 USD');
  assert.equal(events[0].teams, 1);
  assert.equal(events[0].providerPlayers[0].id, 'ps-7');
  for (const key of ['maps', 'kills', 'deaths', 'assists', 'adr', 'kast', 'providerScore', 'rating']) assert.equal(events[0].providerPlayers[0][key], null);
  assert.equal(events[0].sourceUrl, 'https://pro.eslgaming.com/csgo/proleague/');
  assert.equal(provider.normalizeProviderCatalogue([stage(10, { teams: [], expected_roster: [], prizepool: null })], epoch)[0].teams, null);
});

test('fixture normalization preserves true zero scores and official streams without map-score fabrication', async () => {
  const provider = await providerModule();
  const value = fixture(1, { games: [{ id: 90, match_id: 1, position: 1, status: 'finished', winner: { id: 1 } }, { id: 91, match_id: 1, position: 2, status: 'not_started', winner: { id: 2 } }],
    streams_list: [{ raw_url: 'https://twitch.tv/official', language: 'en', official: true, main: true }, { raw_url: 'javascript:alert(1)', official: true }, { raw_url: 'https://twitch.tv/unverified', official: false }] });
  const match = provider.normalizeProviderFixture(value, 10);
  assert.deepEqual(match.teams.map(team => team.score), [2, 0]);
  assert.equal(match.maps[0].winnerId, 1);
  assert.equal(match.maps[0].name, null);
  assert.equal(match.maps[0].score, undefined);
  assert.equal(match.maps[1].winnerId, null);
  assert.deepEqual(match.streams, [{ url: 'https://twitch.tv/official', language: 'en', main: true }]);
  assert.deepEqual(provider.normalizeProviderFixture({ ...value, status: 'not_started' }, 10).teams.map(team => team.score), [null, null]);
  assert.deepEqual(provider.normalizeProviderFixture({ ...value, status: 'running' }, 10).teams.map(team => team.score), [2, 0]);
  assert.equal(provider.normalizeProviderFixture({ ...value, tournament_id: 11 }, 10), null);
  assert.equal(provider.normalizeProviderFixture({ ...value, videogame_title: { id: 3, slug: 'cs-go' } }, 10), null);
  for (const url of ['http://example.com', 'https://user:password@example.com', 'data:text/plain,a', 'https://example.com/\nsecret']) assert.equal(provider.providerLink(url), null);
});

test('major-event archive includes the previous six months without adding older or lower-tier events',async()=>{
 const provider=await providerModule();
 const dated=(id,end,tier='s')=>stage(id,{tier,serie:{id,full_name:'Archive 2026',begin_at:end,end_at:end},serie_id:id});
 const events=provider.normalizeProviderCatalogue([dated(301,'2026-06-20T00:00:00Z'),dated(302,'2026-01-20T00:00:00Z'),dated(303,'2026-06-20T00:00:00Z','b')],epoch);
 assert.deepEqual(events.map(e=>e.id),['ps-301']);
});

test('fixture requests are single flight and cache for five minutes; failed refresh keeps the original observation time', async () => withRuntime(async (provider, tick) => {
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    assert.ok(!String(url).includes('videogame_title'));
    assert.ok(String(url).includes('filter[tournament_id]=10'));
    await new Promise(resolve => setTimeout(resolve, 1));
    return Response.json([fixture(), fixture(2, { tournament: { id: 11 }, tournament_id: 11 }), fixture(3, { serie_id: 100 }), fixture(4, { videogame_title: { id: 3, slug: 'cs-go' } }), fixture(5, { videogame_title: undefined })]);
  };
  const results = await Promise.all(Array.from({ length: 12 }, () => provider.getProviderEventFixtures(event)));
  assert.equal(calls, 1); assert.equal(results[0].matches.length, 1);
  assert.equal(results[0].saved, false);
  const observedAt = results[0].observedAt;
  await provider.getProviderEventFixtures(event); assert.equal(calls, 1);
  tick(300001);
  globalThis.fetch = async () => { calls++; throw new Error('unavailable'); };
  const saved = await provider.getProviderEventFixtures(event);
  assert.equal(saved.saved, true); assert.equal(saved.observedAt, observedAt);
  await provider.getProviderEventFixtures(event); assert.equal(calls, 2);
  tick(30001);
  globalThis.fetch = async () => { calls++; return Response.json([fixture()]); };
  const refreshed = await provider.getProviderEventFixtures(event);
  assert.equal(refreshed.saved, false); assert.notEqual(refreshed.observedAt, observedAt); assert.equal(calls, 3);
}));

test('catalogue uses three bounded reads and ten-minute single-flight cache; a partial failure preserves the catalogue', async () => withRuntime(async (provider, tick) => {
  let calls = 0;
  globalThis.fetch = async url => {
    calls++;
    assert.ok(String(url).includes('filter[tier]=s,a'));
    return Response.json(String(url).includes('/running?') ? [stage()] : []);
  };
  const catalogues = await Promise.all(Array.from({ length: 10 }, () => provider.getProviderCatalogue()));
  assert.equal(calls, 3); assert.equal(catalogues[0].events.length, 1);
  tick(599999); await provider.getProviderCatalogue(); assert.equal(calls, 3);
  tick(2);
  globalThis.fetch = async url => { calls++; return String(url).includes('/upcoming?') ? new Response('', { status: 503 }) : Response.json([stage()]); };
  const saved = await provider.getProviderCatalogue();
  assert.equal(calls, 6); assert.equal(saved.saved, true); assert.equal(saved.observedAt, catalogues[0].observedAt);
  await provider.getProviderCatalogue(); assert.equal(calls, 6);
}));

test('shared outbound budget stops at 120 requests per hour across distinct events', async () => withRuntime(async (provider, tick) => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json([]); };
  for (let i = 1; i <= 120; i++) assert.ok(await provider.getProviderEventFixtures({ id: 'test-' + i, providerTournamentIds: [i] }));
  assert.equal(await provider.getProviderEventFixtures({ id: 'overflow', providerTournamentIds: [121] }), null);
  assert.equal(calls, 120);
  tick(3600001);
  assert.ok(await provider.getProviderEventFixtures({ id: 'next-hour', providerTournamentIds: [122] }));
  assert.equal(calls, 121);
}));

test('nonempty invalid upstream records cannot replace an observed event with a fresh empty feed', async () => withRuntime(async (provider, tick) => {
  globalThis.fetch = async () => Response.json([fixture()]);
  const original = await provider.getProviderEventFixtures(event);
  tick(300001);
  globalThis.fetch = async () => Response.json([fixture(2, { videogame_title: { id: 3, slug: 'cs-go' } })]);
  const saved = await provider.getProviderEventFixtures(event);
  assert.equal(saved.saved, true); assert.equal(saved.observedAt, original.observedAt); assert.equal(saved.matches.length, 1);
  assert.equal(await provider.getProviderEventFixtures({ id: 'ps-100', providerTournamentIds: [10] }), null);
  globalThis.fetch = async () => Response.json([stage(3, { tier: 'd' })]);
  assert.equal(await provider.getProviderCatalogue(), null);
}));

test('429 Retry-After pauses all provider reads and defaults to one hour when missing', async () => withRuntime(async (provider, tick) => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }); };
  assert.equal(await provider.getProviderEventFixtures(event), null); assert.equal(calls, 1);
  tick(60000); assert.equal(await provider.getProviderCatalogue(), null); assert.equal(calls, 1);
  tick(60001);
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429 }); };
  assert.equal(await provider.getProviderEventFixtures(event), null); assert.equal(calls, 2);
  tick(3599999); assert.equal(await provider.getProviderCatalogue(), null); assert.equal(calls, 2);
  tick(2); globalThis.fetch = async () => { calls++; return Response.json([]); };
  assert.ok(await provider.getProviderEventFixtures(event)); assert.equal(calls, 3);
}));

test('HTTP-date retry and three-page bounds prevent loops and incomplete fixture replacement', async () => withRuntime(async (provider, tick) => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': new Date(epoch + 600000).toUTCString() } }); };
  await provider.getProviderEventFixtures(event);
  tick(599999); assert.equal(await provider.getProviderEventFixtures({ id: 'other', providerTournamentIds: [11] }), null); assert.equal(calls, 1);
  tick(2);
  globalThis.fetch = async () => { calls++; return Response.json(Array.from({ length: 100 }, (_, i) => fixture(i + 1))); };
  assert.equal(await provider.getProviderEventFixtures(event), null); assert.equal(calls, 4);
  tick(30001);
  globalThis.fetch = async url => { calls++; const page = Number(new URL(url).searchParams.get('page[number]')); return Response.json(Array.from({ length: 100 }, (_, i) => fixture((page - 1) * 100 + i + 1)), { headers: { 'X-Total': '300' } }); };
  const result = await provider.getProviderEventFixtures(event);
  assert.ok(result); assert.equal(calls, 7); assert.equal(result.matches.length, 300);
}));
