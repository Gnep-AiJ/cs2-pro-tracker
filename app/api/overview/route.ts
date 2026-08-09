import { NextResponse } from "next/server";
import { trackedPlayers } from "../../data/tracked-players";

/* eslint-disable @typescript-eslint/no-explicit-any -- FACEIT payloads are validated at runtime. */

export const runtime = "edge";

const FACEIT_DATA = "https://open.faceit.com/data/v4";
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60_000;
const STALE_TTL_MS = 6 * 60 * 60_000;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600";

type CacheEntry = { value: any; expiresAt: number; staleUntil: number };
const overviewGlobal = globalThis as typeof globalThis & {
  __cs2GlobalOverviewV1?: CacheEntry;
  __cs2GlobalOverviewInflightV1?: Promise<any>;
};

function officialHeaders() {
  const key = process.env.FACEIT_API_KEY?.trim();
  return key ? { accept: "application/json", authorization: `Bearer ${key}` } : null;
}

async function fetchHistory(playerId: string, headers: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${FACEIT_DATA}/players/${encodeURIComponent(playerId)}/history?game=cs2&offset=0&limit=10`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FACEIT ${response.status}`);
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

function chinaDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function matchTime(match: any) {
  const timestamp = Number(match?.finished_at || match?.started_at);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000).toISOString() : null;
}

function resultFor(match: any, playerId: string): "W" | "L" | null {
  const factions = ["faction1", "faction2"] as const;
  const ownFaction = factions.find(key => {
    const players = Array.isArray(match?.teams?.[key]?.players) ? match.teams[key].players : [];
    return players.some((candidate: any) => candidate?.player_id === playerId);
  });
  if (!ownFaction || !match?.results?.winner) return null;
  return match.results.winner === ownFaction ? "W" : "L";
}

async function buildOverview() {
  const headers = officialHeaders();
  if (!headers) throw new Error("FACEIT 数据服务尚未配置");
  const verified = trackedPlayers.filter(player => player.faceitPlayerId);
  const today = chinaDay(new Date());
  const results = await Promise.allSettled(verified.map(async player => {
    const payload = await fetchHistory(player.faceitPlayerId!, headers);
    const history = Array.isArray(payload?.items) ? payload.items : [];
    const todayMatches = history.filter((match: any) => {
      const playedAt = matchTime(match);
      return playedAt && chinaDay(new Date(playedAt)) === today;
    });
    const wins = todayMatches.filter((match: any) => resultFor(match, player.faceitPlayerId!) === "W").length;
    const losses = todayMatches.filter((match: any) => resultFor(match, player.faceitPlayerId!) === "L").length;
    const recentResults = history.map((match: any) => resultFor(match, player.faceitPlayerId!)).filter((result: string | null): result is "W" | "L" => result === "W" || result === "L");
    const recentWins = recentResults.filter((result: string) => result === "W").length;
    const recentLosses = recentResults.filter((result: string) => result === "L").length;
    const currentWinStreak = recentResults.findIndex((result: string) => result !== "W");
    const ownEntry = todayMatches.flatMap((match: any) => [
      ...(Array.isArray(match?.teams?.faction1?.players) ? match.teams.faction1.players : []),
      ...(Array.isArray(match?.teams?.faction2?.players) ? match.teams.faction2.players : []),
    ]).find((candidate: any) => candidate?.player_id === player.faceitPlayerId);
    return {
      id: player.faceitPlayerId,
      nickname: player.display,
      team: player.team,
      avatar: typeof ownEntry?.avatar === "string" ? ownEntry.avatar : null,
      matches: todayMatches.length,
      wins,
      losses,
      winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0,
      recentMatches: recentResults.length,
      recentWins,
      recentLosses,
      recentWinRate: recentResults.length ? Math.round((recentWins / recentResults.length) * 100) : 0,
      currentWinStreak: currentWinStreak === -1 ? recentResults.length : currentWinStreak,
      lastMatchAt: todayMatches[0] ? matchTime(todayMatches[0]) : null,
    };
  }));
  const players = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  if (players.length === 0) throw new Error("FACEIT 历史记录全部读取失败");
  const activePlayers = players.filter(player => player.matches > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.matches - a.matches || String(b.lastMatchAt).localeCompare(String(a.lastMatchAt)));
  const recentLeaders = players.filter(player => player.recentMatches >= 5)
    .sort((a, b) => b.recentWinRate - a.recentWinRate || b.currentWinStreak - a.currentWinStreak || b.recentWins - a.recentWins);
  const leaders = activePlayers.length
    ? [...activePlayers, ...recentLeaders.filter(player => !activePlayers.some(active => active.id === player.id))].slice(0, 3)
    : recentLeaders.slice(0, 3);
  const hottest = [...activePlayers].filter(player => player.matches >= 2)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.matches - a.matches)[0] || activePlayers[0] || recentLeaders[0] || null;
  const totalWins = players.reduce((sum, player) => sum + player.wins, 0);
  const totalLosses = players.reduce((sum, player) => sum + player.losses, 0);
  return {
    mode: activePlayers.length ? "today" : "recent",
    summary: {
      playerAppearances: players.reduce((sum, player) => sum + player.matches, 0),
      activePlayers: activePlayers.length,
      wins: totalWins,
      losses: totalLosses,
    },
    insights: {
      trackedWinRate: totalWins + totalLosses ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : null,
      winningPlayers: activePlayers.filter(player => player.wins > 0).length,
      hottest,
    },
    leaders,
    focus: leaders[0] || null,
    coverage: {
      tracked: trackedPlayers.length,
      verified: verified.length,
      returned: players.length,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const now = Date.now();
  const cached = overviewGlobal.__cs2GlobalOverviewV1;
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.value, { headers: { "Cache-Control": CACHE_CONTROL } });
  }
  if (!overviewGlobal.__cs2GlobalOverviewInflightV1) {
    overviewGlobal.__cs2GlobalOverviewInflightV1 = buildOverview().finally(() => {
      overviewGlobal.__cs2GlobalOverviewInflightV1 = undefined;
    });
  }
  try {
    const value = await overviewGlobal.__cs2GlobalOverviewInflightV1;
    overviewGlobal.__cs2GlobalOverviewV1 = { value, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_TTL_MS };
    return NextResponse.json(value, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch {
    if (cached && cached.staleUntil > now) return NextResponse.json(cached.value);
    return NextResponse.json({ error: "今日总览暂时无法读取" }, { status: 502 });
  }
}
