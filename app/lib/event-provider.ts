import type { BigEvent, EventPlayer, ProMatch, ProMatchMap } from './pro-events';
import { optionalNumber } from './event-data';

type RecordValue = Record<string, unknown>;
export type ProviderCatalogue = { events: BigEvent[]; observedAt: string; saved: boolean };
export type ProviderFixtures = { matches: ProMatch[]; observedAt: string; saved: boolean };
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 240) : '';
const rows = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(record) : [];
const idNumber = (value: unknown): number | null => { const id = optionalNumber(value); return id != null && Number.isSafeInteger(id) && id > 0 ? id : null; };
const date = (value: unknown): string | null => { const input = text(value); return input && Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : null; };
const score = (value: unknown): number | null => { const result = optionalNumber(value); return result != null && Number.isSafeInteger(result) && result >= 0 ? result : null; };
const matchStatus = (value: unknown): ProMatch['status'] | null => value === 'finished' ? 'finished' : value === 'running' ? 'running' : value === 'not_started' ? 'scheduled' : null;
const isCs2 = (value: unknown) => { const title = record(record(value).videogame_title); return idNumber(title.id) === 13 && text(title.slug) === 'cs-2'; };
const sourceHome = 'https://www.pandascore.co/';

// These are outbound links only. Never accept script/data schemes or URL credentials.
export function providerLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020]/.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function providerTournament(eventId: string, mapping: string | undefined): number | null {
  try { return idNumber(record(JSON.parse(mapping || '{}'))[eventId]); } catch { return null; }
}

export function normalizeProviderFixture(value: unknown, tournamentId: number): ProMatch | null {
  const row = record(value), id = idNumber(row.id), nestedTournamentId = idNumber(record(row.tournament).id), topTournamentId = idNumber(row.tournament_id);
  if (!id || (nestedTournamentId ?? topTournamentId) !== tournamentId || (nestedTournamentId != null && topTournamentId != null && nestedTournamentId !== topTournamentId)) return null;
  // Direct callers may normalize legacy test/archive records without a title. Live reads below always require CS2.
  if (row.videogame_title != null && !isCs2(row)) return null;
  const status = matchStatus(row.status); if (!status) return null;
  const results = rows(row.results);
  const teams: ProMatch['teams'] = rows(row.opponents).flatMap(value => {
    const team = record(value.opponent), teamId = idNumber(team.id), name = text(team.name);
    return name && teamId ? [{ id: teamId, name, logo: providerLink(team.image_url), score: status === 'scheduled' ? null : score(results.find(r => idNumber(r.team_id) === teamId)?.score) }] : [];
  });
  if (teams.length > 2 || new Set(teams.map(team => team.id)).size !== teams.length) return null;
  while (teams.length < 2) teams.push({ name: 'TBA', logo: null, score: null });
  const maps: ProMatchMap[] = rows(row.games).slice(0, 32).flatMap(game => {
    const gameId = idNumber(game.id), position = idNumber(game.position), gameStatus = matchStatus(game.status);
    if (!gameId || !position || !gameStatus || (game.match_id != null && idNumber(game.match_id) !== id)) return [];
    const winnerId = gameStatus === 'finished' ? idNumber(record(game.winner).id) : null;
    return [{ id: 'pandascore-game-' + gameId, position, name: text(record(game.map).name) || null, status: gameStatus,
      winnerId: winnerId != null && teams.some(team => team.id === winnerId) ? winnerId : null, beginsAt: date(game.begin_at), endsAt: date(game.end_at) }];
  }).sort((a, b) => a.position - b.position);
  const streams = rows(row.streams_list).flatMap(stream => {
    const url = stream.official === true ? providerLink(stream.raw_url) : null;
    return url ? [{ url, language: text(stream.language), main: stream.main === true }] : [];
  });
  const live = record(row.live);
  return { id: 'pandascore-' + id, provider: 'PandaScore', sourceUrl: providerLink(record(row.league).url) || sourceHome,
    beginsAt: date(row.begin_at) || date(row.scheduled_at), bestOf: idNumber(row.number_of_games), status, round: text(row.name), teams,
    maps: [...new Map(maps.map(map => [map.id, map])).values()], streams: [...new Map(streams.map(stream => [stream.url, stream])).values()], liveUrl: live.supported === true ? providerLink(live.url) : null };
}

export function normalizeProviderCatalogue(values: unknown[], now = Date.now()): BigEvent[] {
  const grouped = new Map<number, RecordValue[]>();
  for (const value of values) {
    const row = record(value), serie = record(row.serie), league = record(row.league), serieId = idNumber(serie.id), tournamentId = idNumber(row.id);
    if (!isCs2(row) || !serieId || !tournamentId || !['s', 'a'].includes(text(row.tier).toLowerCase())) continue;
    if ((row.serie_id != null && idNumber(row.serie_id) !== serieId) || (row.league_id != null && idNumber(row.league_id) !== idNumber(league.id))) continue;
    const name = [text(league.name), text(serie.full_name) || text(serie.name), text(row.name)].join(' ');
    if (/qualif|academy|showmatch|women/i.test(name)) continue;
    const startsAt = date(serie.begin_at) || date(row.begin_at), endsAt = date(serie.end_at) || date(row.end_at);
    if (!startsAt || !endsAt || Date.parse(endsAt) < now - 180 * 86400000 || Date.parse(startsAt) > now + 120 * 86400000 || Date.parse(startsAt) > Date.parse(endsAt)) continue;
    const current = grouped.get(serieId) || []; current.push(row); grouped.set(serieId, current);
  }
  return [...grouped].flatMap(([serieId, candidates]) => {
    // The same stage can appear in different temporal endpoints during a transition.
    const stages = [...new Map(candidates.map(stage => [idNumber(stage.id)!, stage])).values()];
    const serie = record(stages[0].serie), league = record(stages[0].league);
    if (!text(league.name) || !(text(serie.full_name) || text(serie.name))) return [];
    const startsAt = date(serie.begin_at) || stages.flatMap(stage => date(stage.begin_at) || []).sort()[0];
    const endsAt = date(serie.end_at) || stages.flatMap(stage => date(stage.end_at) || []).sort().at(-1);
    if (!startsAt || !endsAt) return [];
    const countries = [...new Set(stages.map(stage => text(stage.country)).filter(Boolean))];
    const prizes = [...new Set(stages.map(stage => text(stage.prizepool)).filter(Boolean))];
    const teams = new Set(stages.flatMap(stage => rows(stage.teams).flatMap(team => idNumber(team.id) || [])));
    const sourceUrl = providerLink(league.url) || sourceHome;
    const players = new Map<string, EventPlayer>();
    for (const stage of stages) for (const entry of rows(stage.expected_roster)) for (const player of rows(entry.players)) {
      const playerId = idNumber(player.id), name = text(player.name); if (!playerId || !name) continue;
      const key = 'ps-' + playerId, team = text(record(entry.team).name), previous = players.get(key);
      players.set(key, { id: key, name, team: previous && previous.team !== team ? '' : team, avatar: providerLink(player.image_url), sourceUrl,
        maps: null, kills: null, deaths: null, assists: null, adr: null, kast: null, providerScore: null, rating: null, ratingMaps: null, ratingSource: null, ratingObservedAt: null });
    }
    return [{ id: 'ps-' + serieId, name: text(league.name) + ' ' + (text(serie.full_name) || text(serie.name)), startsAt, endsAt,
      location: countries.join(' / '), prize: prizes.length === 1 ? prizes[0] : '', teams: teams.size || null,
      logo: providerLink(league.image_url), sourceUrl, selection: 'PandaScore S/A' as const, statsUrl: null,
      provider: 'PandaScore' as const, providerTier: stages.some(stage => text(stage.tier).toLowerCase() === 's') ? 's' as const : 'a' as const,
      providerTournamentIds: stages.map(stage => idNumber(stage.id)!).sort((a, b) => a - b), providerPlayers: [...players.values()] }];
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

const hour = 3600000, catalogueTtl = 600000, fixturesTtl = 300000, shortBackoff = 30000;
let windowStartsAt = 0, requestsUsed = 0, blockedUntil = 0;
// The budget is shared by every provider operation in one Worker isolate, not a global account guarantee.
async function request(path: string): Promise<{ values: unknown[]; total: number | null } | null> {
  const token = process.env.PANDASCORE_API_TOKEN?.trim(), now = Date.now();
  if (!token || now < blockedUntil) return null;
  if (!windowStartsAt || now >= windowStartsAt + hour) { windowStartsAt = now; requestsUsed = 0; }
  if (requestsUsed >= 120) return null;
  requestsUsed++;
  try {
    const response = await fetch('https://api.pandascore.co' + path, { headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      let delay = shortBackoff;
      if (response.status === 429) {
        const retry = response.headers.get('Retry-After'), seconds = optionalNumber(retry), timestamp = retry ? Date.parse(retry) : NaN;
        delay = seconds != null && seconds >= 0 ? seconds * 1000 : Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : hour;
        // A zero Retry-After still receives a brief retry guard; never retry in a tight loop.
        delay = Math.max(1000, delay);
      }
      blockedUntil = Math.max(blockedUntil, Date.now() + delay); return null;
    }
    const values: unknown = await response.json();
    if (!Array.isArray(values) || values.length > 100) { blockedUntil = Math.max(blockedUntil, Date.now() + shortBackoff); return null; }
    const total = score(response.headers.get('X-Total'));
    return { values, total };
  } catch { blockedUntil = Math.max(blockedUntil, Date.now() + shortBackoff); return null; }
}

let catalogueCache: { at: number; data: ProviderCatalogue } | null = null;
let cataloguePending: Promise<ProviderCatalogue | null> | null = null;
let catalogueRetryAt = 0;
export async function getProviderCatalogue(): Promise<ProviderCatalogue | null> {
  if (!process.env.PANDASCORE_API_TOKEN?.trim()) return null;
  const now = Date.now();
  if (catalogueCache && now < catalogueCache.at + catalogueTtl) return catalogueCache.data;
  if (cataloguePending) return cataloguePending;
  if (now < catalogueRetryAt || now < blockedUntil) return catalogueCache ? { ...catalogueCache.data, saved: true } : null;
  cataloguePending = (async () => {
    const responses = await Promise.all(['running', 'upcoming', 'past'].map(kind => request('/csgo/tournaments/' + kind + '?filter[tier]=s,a&page[size]=100&sort=' + (kind === 'past' ? '-end_at' : 'begin_at'))));
    if (responses.some(response => !response)) { catalogueRetryAt = Date.now() + shortBackoff; return catalogueCache ? { ...catalogueCache.data, saved: true } : null; }
    const values = responses.flatMap(response => response!.values), observedAt = new Date(Date.now()).toISOString(), events = normalizeProviderCatalogue(values);
    // A malformed/empty all-endpoint response should not erase a previously observed catalogue.
    if (!events.length && (values.length || catalogueCache)) { catalogueRetryAt = Date.now() + shortBackoff; return catalogueCache ? { ...catalogueCache.data, saved: true } : null; }
    const data = { events, observedAt, saved: false }; catalogueCache = { at: Date.now(), data }; catalogueRetryAt = 0; return data;
  })().finally(() => { cataloguePending = null; });
  return cataloguePending;
}

type FixtureCacheEntry = { at: number; data: ProviderFixtures | null; retryAt: number; pending: Promise<ProviderFixtures | null> | null };
const fixtureCache = new Map<string, FixtureCacheEntry>();
export async function getProviderEventFixtures(event: Pick<BigEvent, 'id' | 'providerTournamentIds'>): Promise<ProviderFixtures | null> {
  if (!process.env.PANDASCORE_API_TOKEN?.trim()) return null;
  const tournamentIds = [...new Set((event.providerTournamentIds || []).flatMap(value => idNumber(value) || []))].sort((a, b) => a - b);
  if (!tournamentIds.length || tournamentIds.length > 64 || tournamentIds.length !== event.providerTournamentIds?.length) return null;
  const key = event.id + ':' + tournamentIds.join(','), now = Date.now();
  let entry = fixtureCache.get(key);
  if (entry?.data && now < entry.at + fixturesTtl) return entry.data;
  if (entry?.pending) return entry.pending;
  if (now < (entry?.retryAt || 0) || now < blockedUntil) return entry?.data ? { ...entry.data, saved: true } : null;
  if (!entry) {
    // Bound isolate memory without removing a refresh currently in flight.
    if (fixtureCache.size >= 128) { const oldest = [...fixtureCache].find(([, item]) => !item.pending); if (oldest) fixtureCache.delete(oldest[0]); }
    entry = { at: 0, data: null, retryAt: 0, pending: null }; fixtureCache.set(key, entry);
  }
  const target = entry;
  target.pending = (async () => {
    const all: unknown[] = []; let complete = false;
    for (let page = 1; page <= 3; page++) {
      const response = await request('/csgo/matches?filter[tournament_id]=' + tournamentIds.join(',') + '&page[size]=100&page[number]=' + page + '&sort=begin_at');
      if (!response || response.values.length > 100) break;
      all.push(...response.values);
      const distinctIds = new Set(all.flatMap(value => idNumber(record(value).id) || []));
      if (response.values.length < 100 || (response.total != null && distinctIds.size >= response.total)) { complete = true; break; }
    }
    if (!complete) { target.retryAt = Date.now() + shortBackoff; return target.data ? { ...target.data, saved: true } : null; }
    const serieId = /^ps-(\d+)$/.exec(event.id)?.[1];
    const matches = all.flatMap(value => {
      const row = record(value), tournamentId = idNumber(record(row.tournament).id) ?? idNumber(row.tournament_id);
      if (!isCs2(row) || !tournamentId || !tournamentIds.includes(tournamentId)) return [];
      if (serieId && ((row.serie_id != null && String(idNumber(row.serie_id)) !== serieId) || (record(row.serie).id != null && String(idNumber(record(row.serie).id)) !== serieId))) return [];
      const match = normalizeProviderFixture(row, tournamentId); return match ? [match] : [];
    });
    // A nonempty response consisting entirely of wrong-game/wrong-event/malformed records is a failed observation.
    if (all.length && !matches.length) { target.retryAt = Date.now() + shortBackoff; return target.data ? { ...target.data, saved: true } : null; }
    const data: ProviderFixtures = { matches: [...new Map(matches.map(match => [match.id, match])).values()].sort((a, b) => (a.beginsAt || '').localeCompare(b.beginsAt || '')), observedAt: new Date(Date.now()).toISOString(), saved: false };
    target.data = data; target.at = Date.now(); target.retryAt = 0; return data;
  })().finally(() => { target.pending = null; });
  return target.pending;
}

// Compatibility path for an explicitly verified legacy HLTV → PandaScore tournament mapping.
export async function fetchProviderFixtures(eventId: string): Promise<ProviderFixtures | null> {
  const tournamentId = providerTournament(eventId, process.env.PANDASCORE_EVENT_MAP); if (!tournamentId) return null;
  return getProviderEventFixtures({ id: eventId, providerTournamentIds: [tournamentId] });
}
