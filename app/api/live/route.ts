import { NextResponse } from "next/server";
import { findTopTeam, rankingSnapshot, topTeams, type TrackedPlayer } from "../../data/tracked-players";

/* eslint-disable @typescript-eslint/no-explicit-any -- FACEIT payloads are validated at runtime. */

export const runtime = "edge";

const FACEIT_DATA = "https://open.faceit.com/data/v4";
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60_000;
const STALE_TTL_MS = 6 * 60 * 60_000;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600";

type CacheEntry = { value: any; expiresAt: number; staleUntil: number };
type LiveResult = { body: any; status: number };
const liveGlobal = globalThis as typeof globalThis & {
  __cs2LiveCacheV5?: Map<string, CacheEntry>;
  __cs2LiveInflightV4?: Map<string, Promise<LiveResult>>;
};
const liveCache = liveGlobal.__cs2LiveCacheV5 ??= new Map<string, CacheEntry>();
const liveInflight = liveGlobal.__cs2LiveInflightV4 ??= new Map<string, Promise<LiveResult>>();

function liveResponse(result: LiveResult) {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.status === 200 ? { "Cache-Control": CACHE_CONTROL } : undefined,
  });
}

function officialHeaders() {
  const key = process.env.FACEIT_API_KEY?.trim();
  return key ? { accept: "application/json", authorization: `Bearer ${key}` } : null;
}

async function fetchOfficial(url: string, headers: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`FACEIT ${response.status}`);
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

function objectValues(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function chinaDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function playedAt(match: any) {
  const timestamp = Number(match?.finished_at || match?.started_at);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;
}

function resultFor(match: any, playerId: string): "W" | "L" | null {
  const factions = ["faction1", "faction2"] as const;
  const ownFaction = factions.find(key => objectValues(match?.teams?.[key]?.players)
    .some((candidate: any) => candidate?.player_id === playerId));
  if (!ownFaction || !match?.results?.winner) return null;
  return match.results.winner === ownFaction ? "W" : "L";
}

async function loadPlayer(tracked: TrackedPlayer, headers: HeadersInit) {
  if (!tracked.faceitPlayerId) throw new Error("FACEIT identity is not verified");
  const profile = await fetchOfficial(
    `${FACEIT_DATA}/players/${encodeURIComponent(tracked.faceitPlayerId)}`,
    headers,
  );
  const game = profile?.games?.cs2;
  if (profile?.player_id !== tracked.faceitPlayerId || !game) throw new Error("invalid FACEIT profile");

  const region = String(game.region || "").toUpperCase();
  const rankingPath = /^[A-Z]{2,4}$/.test(region)
    ? `${FACEIT_DATA}/rankings/games/cs2/regions/${encodeURIComponent(region)}/players/${encodeURIComponent(profile.player_id)}?limit=1`
    : null;
  const [historyPayload, rankingPayload] = await Promise.all([
    fetchOfficial(
      `${FACEIT_DATA}/players/${encodeURIComponent(profile.player_id)}/history?game=cs2&offset=0&limit=10`,
      headers,
    ),
    rankingPath ? fetchOfficial(rankingPath, headers).catch(() => null) : Promise.resolve(null),
  ]);
  const history = Array.isArray(historyPayload?.items) ? historyPayload.items : [];
  const recentMatches = history.map((match: any) => ({
    id: String(match?.match_id || ""),
    playedAt: playedAt(match),
    result: resultFor(match, profile.player_id),
    eloBefore: null,
    eloAfter: null,
    eloChange: null,
    map: null,
    mode: String(match?.game_mode || match?.match_type || "5v5"),
  })).filter((match: any) => match.id);
  const today = chinaDay(new Date());
  const todayMatches = recentMatches.filter((match: any) => match.playedAt && chinaDay(new Date(match.playedAt)) === today);

  return {
    id: profile.player_id,
    nickname: tracked.display,
    faceitNickname: profile.nickname,
    team: tracked.team,
    role: tracked.role,
    avatar: profile.avatar || null,
    country: tracked.country || profile.country || null,
    faceitCountry: profile.country || null,
    elo: game.faceit_elo ?? null,
    level: game.skill_level ?? null,
    ranking: {
      region: region || null,
      position: Number.isFinite(Number(rankingPayload?.position)) ? Number(rankingPayload.position) : null,
    },
    matchesToday: todayMatches.length,
    winsToday: todayMatches.filter((match: any) => match.result === "W").length,
    lossesToday: todayMatches.filter((match: any) => match.result === "L").length,
    eloChangeToday: null,
    lastMatchAt: recentMatches[0]?.playedAt || null,
    recentMatches,
    dataAvailable: true,
    identityStatus: "verified",
  };
}

function unavailablePlayer(tracked: TrackedPlayer) {
  return {
    id: `unavailable-${tracked.team}-${tracked.lookup}`,
    nickname: tracked.display,
    faceitNickname: tracked.lookup,
    team: tracked.team,
    role: tracked.role,
    avatar: null,
    country: tracked.country || null,
    faceitCountry: null,
    elo: null,
    level: null,
    ranking: { region: null, position: null },
    matchesToday: null,
    winsToday: null,
    lossesToday: null,
    eloChangeToday: null,
    lastMatchAt: null,
    recentMatches: [],
    dataAvailable: false,
    identityStatus: tracked.faceitPlayerId ? "unavailable" : "unverified",
  };
}

async function getFaceit(selectedPlayers: TrackedPlayer[]) {
  const headers = officialHeaders();
  if (!headers) return {
    items: selectedPlayers.map(unavailablePlayer), configured: false, error: "FACEIT 数据服务尚未配置", warning: null,
    coverage: { requested: selectedPlayers.length, profiles: 0, recentStats: 0, stale: 0 },
  };

  const settled = await Promise.allSettled(selectedPlayers.map(player => loadPlayer(player, headers)));
  const successful = settled.filter(result => result.status === "fulfilled").length;
  const items = settled.map((result, index) => result.status === "fulfilled" ? result.value : unavailablePlayer(selectedPlayers[index]));
  const failed = selectedPlayers.length - successful;
  return {
    items,
    configured: successful > 0,
    error: successful ? null : "FACEIT 数据暂时不可用",
    warning: failed ? `${failed} 名选手暂时未返回` : null,
    coverage: { requested: selectedPlayers.length, profiles: successful, recentStats: successful, stale: 0 },
  };
}

export async function GET(request: Request) {
  const selectedTeam = findTopTeam(new URL(request.url).searchParams.get("team"));
  const cacheKey = selectedTeam.slug;
  const now = Date.now();
  const cached = liveCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.value, { headers: { "Cache-Control": CACHE_CONTROL } });
  }

  const directory = {
    selectedTeam: selectedTeam.slug,
    totalPlayers: topTeams.reduce((sum, entry) => sum + entry.members.length, 0),
    ranking: rankingSnapshot,
    teams: topTeams.map(entry => ({
      slug: entry.slug,
      name: entry.name,
      rank: entry.rank,
      points: entry.points,
      members: entry.members.map(player => ({ nickname: player.display, faceitNickname: player.lookup })),
    })),
  };

  const existing = liveInflight.get(cacheKey);
  if (existing) return liveResponse(await existing);

  const pending = (async () => {
    try {
      const value = { faceit: await getFaceit(selectedTeam.members), directory, updatedAt: new Date().toISOString(), refreshSeconds: 3600 };
      liveCache.set(cacheKey, { value, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_TTL_MS });
      return { body: value, status: 200 };
    } catch {
      const stale = liveCache.get(cacheKey);
      if (stale && stale.staleUntil > now) return { body: stale.value, status: 200 };
      return { body: { faceit: { items: [], configured: true, error: "FACEIT 数据暂时不可用", warning: null }, directory, updatedAt: new Date().toISOString(), refreshSeconds: 3600 }, status: 502 };
    }
  })();
  liveInflight.set(cacheKey, pending);
  try {
    return liveResponse(await pending);
  } finally {
    if (liveInflight.get(cacheKey) === pending) liveInflight.delete(cacheKey);
  }
}
