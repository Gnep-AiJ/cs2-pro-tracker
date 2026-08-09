import { NextResponse } from "next/server";
import { findTrackedPlayer } from "../../../data/tracked-players";

/* eslint-disable @typescript-eslint/no-explicit-any -- FACEIT payloads are validated at runtime. */

export const runtime = "edge";

const FACEIT_DATA = "https://open.faceit.com/data/v4";
const REQUEST_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 5 * 60_000;
const STALE_TTL_MS = 60 * 60_000;

type CacheEntry = { value: any; expiresAt: number; staleUntil: number };
type PlayerResult = { body: any; status: number };
const playerGlobal = globalThis as typeof globalThis & {
  __cs2PlayerCacheV4?: Map<string, CacheEntry>;
  __cs2PlayerInflightV4?: Map<string, Promise<PlayerResult>>;
};
const playerCache = playerGlobal.__cs2PlayerCacheV4 ??= new Map<string, CacheEntry>();
const playerInflight = playerGlobal.__cs2PlayerInflightV4 ??= new Map<string, Promise<PlayerResult>>();

function playerResponse(result: PlayerResult) {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.status === 200 ? { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=120" } : undefined,
  });
}

class FaceitHttpError extends Error {
  constructor(readonly status: number) {
    super(`FACEIT ${status}`);
  }
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
    if (!response.ok) throw new FaceitHttpError(response.status);
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

function parseNumber(value: unknown) {
  const number = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(number) ? number : null;
}

function lifetimeValue(lifetime: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (lifetime[key] != null) return parseNumber(lifetime[key]);
  return null;
}

function statText(stats: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (stats[key] != null && String(stats[key]).trim()) return String(stats[key]).trim();
  return null;
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value != null);
  return available.length ? Math.round((available.reduce((sum, value) => sum + value, 0) / available.length) * 100) / 100 : null;
}

function chinaDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET(_request: Request, { params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = await params;
  const rawNickname = decodeURIComponent(nickname).trim();
  const requestedNickname = ["simple", "s1mple"].includes(rawNickname.toLowerCase()) ? "s1mple-" : rawNickname;
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(requestedNickname)) {
    return NextResponse.json({ error: "FACEIT 昵称格式不正确" }, { status: 400 });
  }

  const knownPlayer = findTrackedPlayer(requestedNickname.toLowerCase());
  if (knownPlayer && !knownPlayer.faceitPlayerId) {
    return NextResponse.json({ error: "该职业选手的 FACEIT 身份尚未核验" }, { status: 409 });
  }
  const tracked = knownPlayer || { lookup: requestedNickname, faceitPlayerId: null, display: requestedNickname, team: "FACEIT", role: "玩家", country: "" };
  const cacheKey = knownPlayer?.faceitPlayerId || `${tracked.lookup.toLowerCase()}:${tracked.display.toLowerCase()}`;
  const now = Date.now();
  const cached = playerCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.value, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=120" } });
  }

  const existing = playerInflight.get(cacheKey);
  if (existing) return playerResponse(await existing);

  const pending = (async () => {
    try {
    const headers = officialHeaders();
    if (!headers) return NextResponse.json({ error: "FACEIT 数据服务尚未配置" }, { status: 503 });
    const profile = await fetchOfficial(knownPlayer
      ? `${FACEIT_DATA}/players/${encodeURIComponent(knownPlayer.faceitPlayerId!)}`
      : `${FACEIT_DATA}/players?nickname=${encodeURIComponent(tracked.lookup)}&game=cs2`, headers);
    const game = profile?.games?.cs2;
    if (!profile?.player_id || !game || (knownPlayer && profile.player_id !== knownPlayer.faceitPlayerId)) throw new Error("profile unavailable");

    const region = String(game.region || "").toUpperCase();
    const country = String(profile.country || "").toLowerCase();
    const rankingPath = /^[A-Z]{2,4}$/.test(region)
      ? `${FACEIT_DATA}/rankings/games/cs2/regions/${encodeURIComponent(region)}/players/${encodeURIComponent(profile.player_id)}?limit=1`
      : null;
    const [historyResult, lifetimeResult, detailedResult, regionRankResult, countryRankResult] = await Promise.allSettled([
      fetchOfficial(`${FACEIT_DATA}/players/${encodeURIComponent(profile.player_id)}/history?game=cs2&offset=0&limit=30`, headers),
      fetchOfficial(`${FACEIT_DATA}/players/${encodeURIComponent(profile.player_id)}/stats/cs2`, headers),
      fetchOfficial(`${FACEIT_DATA}/players/${encodeURIComponent(profile.player_id)}/games/cs2/stats?offset=0&limit=20`, headers),
      rankingPath ? fetchOfficial(rankingPath, headers) : Promise.resolve(null),
      rankingPath && /^[a-z]{2}$/.test(country)
        ? fetchOfficial(`${rankingPath}&country=${encodeURIComponent(country)}`, headers)
        : Promise.resolve(null),
    ]);
    const history: any[] = historyResult.status === "fulfilled" && Array.isArray(historyResult.value?.items) ? historyResult.value.items : [];
    const lifetimeRaw = lifetimeResult.status === "fulfilled" ? lifetimeResult.value?.lifetime || {} : {};
    const detailedItems: any[] = detailedResult.status === "fulfilled" && Array.isArray(detailedResult.value?.items) ? detailedResult.value.items : [];
    const regionRankPayload = regionRankResult.status === "fulfilled" ? regionRankResult.value : null;
    const countryRankPayload = countryRankResult.status === "fulfilled" ? countryRankResult.value : null;
    const detailedByMatch = new Map(detailedItems.map(item => [statText(item?.stats || {}, "Match Id"), item?.stats || {}]));
    const recentMatches = history.map((match: any) => {
      const factions = ["faction1", "faction2"] as const;
      const ownFaction = factions.find(key => objectValues(match?.teams?.[key]?.players)
        .some((candidate: any) => candidate?.player_id === profile.player_id));
      const opponentFaction = ownFaction === "faction1" ? "faction2" : ownFaction === "faction2" ? "faction1" : null;
      const ownTeam = ownFaction ? match?.teams?.[ownFaction] : null;
      const opponentTeam = opponentFaction ? match?.teams?.[opponentFaction] : null;
      const ownScore = ownFaction ? parseNumber(match?.results?.score?.[ownFaction]) : null;
      const opponentScore = opponentFaction ? parseNumber(match?.results?.score?.[opponentFaction]) : null;
      const timestamp = Number(match?.finished_at || match?.started_at);
      const stats = detailedByMatch.get(String(match?.match_id || "")) || {};
      return {
        id: String(match?.match_id || ""),
        playedAt: Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null,
        result: ownFaction && match?.results?.winner ? (match.results.winner === ownFaction ? "W" : "L") : null,
        mode: String(match?.game_mode || match?.match_type || "5v5"),
        score: ownScore != null && opponentScore != null ? `${ownScore}-${opponentScore}` : null,
        teamName: String(ownTeam?.nickname || "") || null,
        opponent: String(opponentTeam?.nickname || "") || null,
        competitionName: String(match?.competition_name || "FACEIT Matchmaking"),
        region: String(match?.region || game?.region || "").toUpperCase() || null,
        durationMinutes: Number(match?.finished_at) > Number(match?.started_at)
          ? Math.round((Number(match.finished_at) - Number(match.started_at)) / 60)
          : null,
        map: statText(stats, "Map")?.replace(/^de_/, "") || null,
        kills: lifetimeValue(stats, "Kills"),
        deaths: lifetimeValue(stats, "Deaths"),
        assists: lifetimeValue(stats, "Assists"),
        kd: lifetimeValue(stats, "K/D Ratio"),
        kr: lifetimeValue(stats, "K/R Ratio"),
        adr: lifetimeValue(stats, "ADR"),
        headshots: lifetimeValue(stats, "Headshots %"),
        mvps: lifetimeValue(stats, "MVPs"),
        rounds: lifetimeValue(stats, "Rounds"),
        damage: lifetimeValue(stats, "Damage"),
        tripleKills: lifetimeValue(stats, "Triple Kills"),
        quadroKills: lifetimeValue(stats, "Quadro Kills"),
        pentaKills: lifetimeValue(stats, "Penta Kills"),
        teammates: objectValues(ownTeam?.players).filter((candidate: any) => candidate?.player_id !== profile.player_id).map((candidate: any) => ({
          id: String(candidate?.player_id || ""),
          nickname: String(candidate?.nickname || "Unknown"),
          avatar: typeof candidate?.avatar === "string" ? candidate.avatar : null,
        })),
      };
    }).filter((match: any) => match.id);

    const today = chinaDay(new Date());
    const todayMatches = recentMatches.filter((match: any) => match.playedAt && chinaDay(new Date(match.playedAt)) === today);
    const wins = recentMatches.filter((match: any) => match.result === "W").length;
    const losses = recentMatches.filter((match: any) => match.result === "L").length;
    let streak = 0;
    const firstResult = recentMatches[0]?.result;
    if (firstResult === "W" || firstResult === "L") {
      for (const match of recentMatches) {
        if (match.result !== firstResult) break;
        streak++;
      }
    }

    const detailedMatches = recentMatches.filter((match: any) => match.kills != null);
    const mapGroups = new Map<string, any[]>();
    for (const match of detailedMatches) {
      const map = match.map || "unknown";
      mapGroups.set(map, [...(mapGroups.get(map) || []), match]);
    }
    const recentMaps = [...mapGroups.entries()].map(([map, matches]) => {
      const mapWins = matches.filter(match => match.result === "W").length;
      return {
        map,
        matches: matches.length,
        wins: mapWins,
        winRate: Math.round((mapWins / matches.length) * 100),
        kd: average(matches.map(match => match.kd)),
        adr: average(matches.map(match => match.adr)),
        kills: average(matches.map(match => match.kills)),
      };
    }).sort((a, b) => b.matches - a.matches || b.winRate - a.winRate);

    const teammateGroups = new Map<string, { id: string; nickname: string; avatar: string | null; matches: number; wins: number }>();
    for (const match of recentMatches) for (const teammate of match.teammates) {
      const key = teammate.id || teammate.nickname.toLowerCase();
      const current = teammateGroups.get(key) || { ...teammate, matches: 0, wins: 0 };
      current.matches++;
      if (match.result === "W") current.wins++;
      teammateGroups.set(key, current);
    }
    const frequentTeammates = [...teammateGroups.values()].sort((a, b) => b.matches - a.matches || b.wins - a.wins).slice(0, 8)
      .map(teammate => ({ ...teammate, winRate: Math.round((teammate.wins / teammate.matches) * 100) }));

    const lifetimeSegments: any[] = lifetimeResult.status === "fulfilled" && Array.isArray(lifetimeResult.value?.segments) ? lifetimeResult.value.segments : [];
    const mapPool = lifetimeSegments.filter(segment => segment?.type === "Map").map(segment => ({
      map: String(segment?.label || "unknown"),
      matches: lifetimeValue(segment?.stats || {}, "Matches"),
      wins: lifetimeValue(segment?.stats || {}, "Wins"),
      winRate: lifetimeValue(segment?.stats || {}, "Win Rate %"),
      averageKills: lifetimeValue(segment?.stats || {}, "Average Kills"),
      averageKd: lifetimeValue(segment?.stats || {}, "Average K/D Ratio"),
      averageKr: lifetimeValue(segment?.stats || {}, "Average K/R Ratio"),
      adr: lifetimeValue(segment?.stats || {}, "ADR"),
      headshots: lifetimeValue(segment?.stats || {}, "Average Headshots %"),
    })).filter(map => (map.matches || 0) > 0).sort((a, b) => (b.matches || 0) - (a.matches || 0));

    const value = {
      player: {
        id: profile.player_id,
        nickname: knownPlayer ? tracked.display : profile.nickname,
        faceitNickname: profile.nickname,
        team: tracked.team,
        role: tracked.role,
        avatar: profile.avatar || null,
        coverImage: profile.cover_featured_image || profile.cover_image || null,
        faceitUrl: profile.faceit_url || null,
        verified: profile.verified === true,
        activatedAt: profile.activated_at || null,
        country: tracked.country || profile.country || null,
        elo: game.faceit_elo ?? null,
        level: game.skill_level ?? null,
        ranking: {
          region: region || null,
          regionPosition: parseNumber(regionRankPayload?.position),
          country: country || null,
          countryPosition: parseNumber(countryRankPayload?.position),
        },
        lastMatchAt: recentMatches[0]?.playedAt || null,
        today: {
          matches: todayMatches.length,
          wins: todayMatches.filter((match: any) => match.result === "W").length,
          losses: todayMatches.filter((match: any) => match.result === "L").length,
        },
        recentSummary: {
          sampleSize: recentMatches.length,
          wins,
          losses,
          winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : null,
          streak: firstResult ? `${firstResult}${streak}` : null,
        },
        lifetime: {
          matches: lifetimeValue(lifetimeRaw, "Matches"),
          wins: lifetimeValue(lifetimeRaw, "Wins"),
          winRate: lifetimeValue(lifetimeRaw, "Win Rate %", "Win Rate"),
          averageKd: lifetimeValue(lifetimeRaw, "Average K/D Ratio", "K/D Ratio"),
          averageHeadshots: lifetimeValue(lifetimeRaw, "Average Headshots %", "Headshots %"),
          longestWinStreak: lifetimeValue(lifetimeRaw, "Longest Win Streak"),
          currentWinStreak: lifetimeValue(lifetimeRaw, "Current Win Streak"),
          adr: lifetimeValue(lifetimeRaw, "ADR"),
          entryRate: lifetimeValue(lifetimeRaw, "Entry Rate"),
          entrySuccessRate: lifetimeValue(lifetimeRaw, "Entry Success Rate"),
          clutch1v1: lifetimeValue(lifetimeRaw, "1v1 Win Rate"),
          clutch1v2: lifetimeValue(lifetimeRaw, "1v2 Win Rate"),
          utilityDamagePerRound: lifetimeValue(lifetimeRaw, "Utility Damage per Round"),
          flashesPerRound: lifetimeValue(lifetimeRaw, "Flashes per Round"),
          enemiesFlashedPerRound: lifetimeValue(lifetimeRaw, "Enemies Flashed per Round"),
          sniperKillRate: lifetimeValue(lifetimeRaw, "Sniper Kill Rate"),
        },
        recentPerformance: {
          sampleSize: detailedMatches.length,
          kills: average(detailedMatches.map((match: any) => match.kills)),
          deaths: average(detailedMatches.map((match: any) => match.deaths)),
          assists: average(detailedMatches.map((match: any) => match.assists)),
          kd: average(detailedMatches.map((match: any) => match.kd)),
          kr: average(detailedMatches.map((match: any) => match.kr)),
          adr: average(detailedMatches.map((match: any) => match.adr)),
          headshots: average(detailedMatches.map((match: any) => match.headshots)),
        },
        recentMaps,
        mapPool,
        frequentTeammates,
        recentMatches,
      },
      updatedAt: new Date().toISOString(),
    };
    playerCache.set(cacheKey, { value, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_TTL_MS });
    return { body: value, status: 200 };
    } catch (error) {
      if (error instanceof FaceitHttpError && error.status === 404) {
        return { body: { error: "没有找到这个 FACEIT 昵称" }, status: 404 };
      }
      const stale = playerCache.get(cacheKey);
      if (stale && stale.staleUntil > Date.now()) return { body: stale.value, status: 200 };
      return { body: { error: "FACEIT 数据暂时无法读取" }, status: 502 };
    }
  })();
  playerInflight.set(cacheKey, pending);
  try {
    return playerResponse(await pending);
  } finally {
    if (playerInflight.get(cacheKey) === pending) playerInflight.delete(cacheKey);
  }
}
