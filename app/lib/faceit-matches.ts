import type { LabFeed } from './pro-lab';
import { findTrackedPlayer } from '../data/tracked-players';

export type MatchPlayer = {
  id: string; nickname: string; display: string; avatar: string | null; tracked: boolean;
  kills: number | null; deaths: number | null; adr: number | null;
};
export type FaceitMatch = {
  id: string; playedAt: string | null; map: string | null; competition: string | null;
  region: string | null; mode: string | null; status: string; sourceUrl: string;
  teams: Array<{ name: string | null; score: number | null; players: MatchPlayer[] }>;
  tracked: MatchPlayer[]; rosterComplete: boolean; saved: boolean;
};
export type MatchFeed = {
  items: FaceitMatch[]; observedAt: string; source: 'FACEIT Data API';
  status: 'ready' | 'partial' | 'saved' | 'unconfigured' | 'unavailable';
  coverage: { requested: number; returned: number; historiesPerPlayer: number; enriched: number; bounded: boolean };
};
export type MatchIdentity = { id: string; name: string; lookup: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
export const finite = (value: unknown): number | null => value == null || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const timestamp = (value: unknown) => { const n = finite(value); return n && n < 1e11 ? new Date(n * 1000).toISOString() : null; };
export const roomUrl = (id: string) => `https://www.faceit.com/en/cs2/room/${encodeURIComponent(id)}`;

export function normalizeMatch(value: unknown, identities: MatchIdentity[], now = Date.now()): FaceitMatch | null {
  const m = record(value), id = text(m.match_id);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || (m.game && m.game !== 'cs2')) return null;
  const playedAt = timestamp(m.finished_at) || timestamp(m.started_at);
  if (playedAt && Date.parse(playedAt) > now) return null;
  const factions = record(m.teams), results = record(m.results), score = record(results.score);
  const teams = ['faction1', 'faction2'].map(key => {
    const team = record(factions[key]);
    const players = list(team.roster || team.players).flatMap(value => {
      const p = record(value), id = text(p.player_id), identity = identities.find(i => i.id === id);
      return id ? [{ id, nickname: text(p.nickname) || identity?.lookup || '', display: identity?.name || text(p.nickname) || '', avatar: text(p.avatar) || null, tracked: !!identity, kills: null, deaths: null, adr: null }] : [];
    });
    return { name: text(team.name) || text(team.nickname) || null, score: finite(score[key]), players };
  });
  const voting = record(m.voting), mapVote = record(voting.map), maps = list(mapVote.pick);
  // A series score must never be presented as the score for its first map.
  const map = maps.length === 1 ? text(maps[0]).replace(/^de_/, '') || null : null;
  const rosterComplete = teams.every(t => t.players.length === 5) && new Set(teams.flatMap(t => t.players.map(p => p.id))).size === 10;
  return { id, playedAt, map, competition: text(m.competition_name) || null, region: text(m.region) || null, mode: text(m.game_mode) || null,
    status: text(m.status) || (m.finished_at ? 'FINISHED' : 'UNKNOWN'), sourceUrl: roomUrl(id), teams,
    tracked: [...new Map(teams.flatMap(t => t.players).filter(p => p.tracked).map(p => [p.id, p])).values()], rosterComplete, saved: false };
}

export function mergeMatchHistories(payloads: unknown[], identities: MatchIdentity[], now = Date.now()): FaceitMatch[] {
  const unique = new Map<string, FaceitMatch>();
  for (const payload of payloads) for (const value of list(record(payload).items)) {
    const match = normalizeMatch(value, identities, now);
    if (!match || !match.tracked.length) continue;
    const previous = unique.get(match.id);
    if (!previous || match.teams.flatMap(t => t.players).length > previous.teams.flatMap(t => t.players).length) unique.set(match.id, match);
  }
  return [...unique.values()].sort((a, b) => (b.playedAt || '').localeCompare(a.playedAt || '') || a.id.localeCompare(b.id));
}

export function savedMatchFeed(feed: LabFeed): MatchFeed {
  const unique = new Map<string, FaceitMatch>();
  for (const p of feed.players) for (const sample of p.samples) {
    if (!sample.playedAt || Date.parse(sample.playedAt) > Date.parse(feed.observedAt)) continue;
    const player: MatchPlayer = { id: p.id, nickname: p.lookup, display: p.name, avatar: null, tracked: true, kills: sample.kills, deaths: sample.deaths, adr: sample.adr };
    const match = unique.get(sample.id) || { id: sample.id, playedAt: sample.playedAt, map: sample.map, competition: null, region: null, mode: null, status: 'FINISHED', sourceUrl: roomUrl(sample.id), teams: [], tracked: [], rosterComplete: false, saved: true };
    if (!match.tracked.some(p => p.id === player.id)) match.tracked.push(player);
    unique.set(match.id, match);
  }
  return { items: [...unique.values()].sort((a, b) => (b.playedAt || '').localeCompare(a.playedAt || '')).slice(0, 80), observedAt: feed.observedAt, source: 'FACEIT Data API', status: 'saved', coverage: { requested: feed.players.length, returned: feed.coverage.history, historiesPerPlayer: 20, enriched: 0, bounded: true } };
}

export function selectMatches(items: FaceitMatch[], query: string, map: string, order: string, since: string | null, playerId = '') {
  const needle = query.trim().toLowerCase();
  const identity = findTrackedPlayer(needle)?.faceitPlayerId;
  return items.filter(m => (!playerId || [...m.tracked, ...m.teams.flatMap(t => t.players)].some(p => p.id === playerId)) && (map === 'all' || m.map === map) && (!since || !!m.playedAt && m.playedAt >= since) && (!needle || (identity ? [...m.tracked, ...m.teams.flatMap(t => t.players)].some(p => p.id === identity) : [m.map, m.competition, ...m.teams.map(t => t.name), ...m.teams.flatMap(t => t.players).map(p => p.nickname), ...m.tracked.map(p => p.display)].some(v => v?.toLowerCase().includes(needle)))))
    .sort((a, b) => (order === 'featured' ? b.tracked.length - a.tracked.length : 0) || (b.playedAt || '').localeCompare(a.playedAt || '') || a.id.localeCompare(b.id));
}
