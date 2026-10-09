import { NextResponse } from 'next/server';
import { proCohort } from '../../../data/pro-cohort';
import snapshot from '../../../data/pro-lab-snapshot.json';
import type { LabFeed } from '../../../lib/pro-lab';
import { mergeMatchHistories, normalizeMatch, savedMatchFeed, selectMatches, type MatchFeed } from '../../../lib/faceit-matches';

export const runtime = 'edge';
const BASE = 'https://open.faceit.com/data/v4';
const TTL = 120_000;
let cached: MatchFeed | null = null, expires = 0, pending: Promise<MatchFeed> | null = null;

async function read(path: string, key: string) {
  const response = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('faceit_unavailable');
  return response.json();
}
async function collect(key: string): Promise<MatchFeed> {
  const histories: unknown[] = [];
  for (let offset = 0; offset < proCohort.length; offset += 6) {
    const results = await Promise.allSettled(proCohort.slice(offset, offset + 6).map(p => read(`/players/${p.id}/history?game=cs2&offset=0&limit=10`, key)));
    for (const r of results) if (r.status === 'fulfilled' && r.value && typeof r.value === 'object' && Array.isArray((r.value as { items?: unknown }).items)) histories.push(r.value);
  }
  if (!histories.length) throw new Error('histories_unavailable');
  const items = mergeMatchHistories(histories, proCohort).slice(0, 80);
  // 20 histories + at most 6 metadata requests. Full statistics load on demand.
  const featured = selectMatches(items.slice(0, 20), '', 'all', 'featured', null)[0];
  const targets = [...new Map([...items.slice(0, 5), ...(featured ? [featured] : [])].map(item => [item.id, item])).values()];
  const enriched = await Promise.allSettled(targets.map(async item => {
    const payload = await read(`/matches/${item.id}`, key);
    const match = normalizeMatch(payload, proCohort);
    if (!match || match.id !== item.id) return false;
    // Metadata can omit fields already supplied by history. Update real values
    // without replacing a complete roster or a genuine zero with missing data.
    const teams = item.teams.map((previous, index) => {
      const current = match.teams[index];
      const keepRoster = (item.rosterComplete && !match.rosterComplete) || previous.players.length > current.players.length;
      const players = (keepRoster ? previous.players : current.players).map(player => {
        const older = previous.players.find(p => p.id === player.id);
        const fresh = current.players.find(p => p.id === player.id) || player;
        return { ...player, ...fresh, nickname: fresh.nickname || older?.nickname || player.nickname,
          display: fresh.display || older?.display || player.display, avatar: fresh.avatar || older?.avatar || null,
          kills: fresh.kills ?? older?.kills ?? null, deaths: fresh.deaths ?? older?.deaths ?? null, adr: fresh.adr ?? older?.adr ?? null };
      });
      return { name: current.name ?? previous.name, score: current.score ?? previous.score, players };
    });
    const roster = teams.flatMap(team => team.players);
    const voting = payload && typeof payload === 'object' && 'voting' in payload ? payload.voting : null;
    const mapVote = voting && typeof voting === 'object' && 'map' in voting ? voting.map : null;
    const picks = mapVote && typeof mapVote === 'object' && 'pick' in mapVote ? mapVote.pick : null;
    Object.assign(item, match, {
      playedAt: match.playedAt || item.playedAt, status: match.status === 'UNKNOWN' ? item.status : match.status,
      map: Array.isArray(picks) && picks.length > 1 ? null : match.map ?? item.map,
      competition: match.competition ?? item.competition, region: match.region ?? item.region, mode: match.mode ?? item.mode,
      teams, tracked: [...new Map(roster.filter(player => player.tracked).map(player => [player.id, player])).values()],
      rosterComplete: teams.every(team => team.players.length === 5) && new Set(roster.map(player => player.id)).size === 10,
    });
    return true;
  }));
  return { items, observedAt: new Date().toISOString(), source: 'FACEIT Data API', status: histories.length === proCohort.length ? 'ready' : 'partial', coverage: { requested: proCohort.length, returned: histories.length, historiesPerPlayer: 10, enriched: enriched.filter(r => r.status === 'fulfilled' && r.value).length, bounded: true } };
}
export async function GET() {
  const key = process.env.FACEIT_API_KEY?.trim();
  if (!key) return NextResponse.json({ ...savedMatchFeed(snapshot as LabFeed), status: 'unconfigured' }, { headers: { 'Cache-Control': 'no-store' } });
  if (cached && expires > Date.now()) return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=120' } });
  pending ??= collect(key).finally(() => { pending = null; });
  try {
    const feed = await pending;
    if (feed.status === 'ready') { cached = feed; expires = Date.now() + TTL; }
    return NextResponse.json(feed, { headers: { 'Cache-Control': feed.status === 'ready' ? 'public, max-age=30, s-maxage=120' : 'no-store' } });
  } catch {
    const fallback = cached && Date.now() - Date.parse(cached.observedAt) < 6 * 3600000 ? { ...cached, status: 'saved', items: cached.items.map(m => ({ ...m, saved: true })) } : savedMatchFeed(snapshot as LabFeed);
    return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store' } });
  }
}
