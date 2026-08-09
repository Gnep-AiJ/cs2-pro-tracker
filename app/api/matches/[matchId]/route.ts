import { NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any -- FACEIT match statistics use dynamic field names. */

export const runtime = "edge";

const FACEIT_DATA = "https://open.faceit.com/data/v4";

function officialHeaders() {
  const key = process.env.FACEIT_API_KEY?.trim();
  return key ? { accept: "application/json", authorization: `Bearer ${key}` } : null;
}

async function fetchOfficial(url: string, headers: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`FACEIT ${response.status}`);
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

function values(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function number(value: unknown) {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stat(stats: Record<string, unknown>, ...keys: string[]) {
  const entries = Object.entries(stats || {}).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value] as const);
  for (const key of keys) {
    const found = entries.find(([normalized]) => normalized === key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (found) return number(found[1]);
  }
  return null;
}

function text(stats: Record<string, unknown>, ...keys: string[]) {
  const entries = Object.entries(stats || {}).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value] as const);
  for (const key of keys) {
    const found = entries.find(([normalized]) => normalized === key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (found?.[1] != null && String(found[1]).trim()) return String(found[1]).trim();
  }
  return null;
}

function extractScoreboard(payload: any) {
  const root = payload?.payload ?? payload;
  const rounds = Array.isArray(root) ? root : values(root?.rounds || root?.items || root?.data);
  const round = rounds.find(candidate => values(candidate?.teams).length >= 2);
  if (!round) return { map: null, scoreboard: [] };
  const roundStats = round?.roundStats || round?.round_stats || {};
  const scoreboard = values(round?.teams).map((team) => {
    const teamStats = team?.teamStats || team?.team_stats || {};
    return {
      name: (text(teamStats, "Team", "Team Name") || String(team?.nickname || team?.name || "Team")).replace(/^team_/i, ""),
      score: stat(teamStats, "Final Score", "Team Score", "Score"),
      won: stat(teamStats, "Team Win") === 1,
      firstHalfScore: stat(teamStats, "First Half Score"),
      secondHalfScore: stat(teamStats, "Second Half Score"),
      overtimeScore: stat(teamStats, "Overtime Score"),
      players: values(team?.players).map((candidate) => {
        const playerStats = candidate?.playerStats || candidate?.player_stats || candidate?.stats || candidate || {};
        const kills = stat(playerStats, "Kills", "kill", "i6");
        const deaths = stat(playerStats, "Deaths", "death", "i8");
        return {
          id: String(candidate?.playerId || candidate?.player_id || candidate?.id || ""),
          nickname: String(candidate?.nickname || candidate?.playerNickname || candidate?.player_nickname || "Unknown"),
          kills,
          deaths,
          plusMinus: kills != null && deaths != null ? kills - deaths : null,
          assists: stat(playerStats, "Assists", "assist", "i7"),
          kd: stat(playerStats, "K/D Ratio", "KD Ratio", "K/D", "c2"),
          kr: stat(playerStats, "K/R Ratio", "KR Ratio", "K/R", "c3"),
          adr: stat(playerStats, "ADR", "Average Damage Per Round", "Damage / Round", "c10"),
          headshotPercent: stat(playerStats, "Headshots %", "Headshot %", "HS %", "c4"),
          mvps: stat(playerStats, "MVPs", "MVP", "i9"),
          firstKills: stat(playerStats, "First Kills"),
          clutchKills: stat(playerStats, "Clutch Kills"),
        };
      }),
    };
  });
  return {
    map: String(roundStats?.Map || roundStats?.map || round?.i1 || "").replace(/^de_/, "") || null,
    scoreboard,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const id = decodeURIComponent(matchId).trim();
  const playerId = new URL(request.url).searchParams.get("playerId")?.trim() || "";
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || (playerId && !/^[a-zA-Z0-9-]{8,80}$/.test(playerId))) {
    return NextResponse.json({ error: "比赛标识格式不正确" }, { status: 400 });
  }
  const headers = officialHeaders();
  if (!headers) return NextResponse.json({ error: "FACEIT 数据服务尚未配置" }, { status: 503 });

  try {
    const [matchResult, statsResult] = await Promise.allSettled([
      fetchOfficial(`${FACEIT_DATA}/matches/${encodeURIComponent(id)}`, headers),
      fetchOfficial(`${FACEIT_DATA}/matches/${encodeURIComponent(id)}/stats`, headers),
    ]);
    if (statsResult.status === "rejected") throw statsResult.reason;
    const detail = matchResult.status === "fulfilled" ? matchResult.value : {};
    const extracted = extractScoreboard(statsResult.value);
    const detailTeams = values(detail?.teams);
    const roster = new Map(detailTeams.flatMap(team => values(team?.roster)).map(player => [String(player?.player_id || ""), player]));
    const scoreboard = extracted.scoreboard.map((team, index) => {
      const normalizedName = team.name.toLowerCase().replace(/^team_/, "");
      const source = detailTeams.find(candidate => String(candidate?.name || "").toLowerCase().replace(/^team_/, "") === normalizedName) || detailTeams[index] || {};
      return {
        ...team,
        avatar: typeof source?.avatar === "string" ? source.avatar : null,
        rating: number(source?.stats?.rating),
        winProbability: number(source?.stats?.winProbability),
        players: team.players.map(player => {
          const profile = roster.get(player.id) || {};
          return {
            ...player,
            avatar: typeof profile?.avatar === "string" ? profile.avatar : null,
            level: number(profile?.game_skill_level),
          };
        }),
      };
    });
    const pickedMap = String(detail?.voting?.map?.pick?.[0] || "");
    const mapEntity = values(detail?.voting?.map?.entities).find(entity => entity?.guid === pickedMap || entity?.game_map_id === pickedMap) || values(detail?.voting?.map?.entities)[0];
    const startedAt = Number(detail?.started_at);
    const finishedAt = Number(detail?.finished_at);
    return NextResponse.json({
      match: {
        id,
        playerId: playerId || null,
        competitionName: String(detail?.competition_name || "FACEIT Matchmaking"),
        region: String(detail?.region || "").toUpperCase() || null,
        mode: String(detail?.game_mode || detail?.match_type || "5v5"),
        playedAt: Number.isFinite(finishedAt || startedAt) && (finishedAt || startedAt) > 0
          ? new Date((finishedAt || startedAt) * 1000).toISOString()
          : null,
        durationMinutes: Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt > startedAt
          ? Math.round((finishedAt - startedAt) / 60)
          : null,
        map: extracted.map || String(mapEntity?.name || pickedMap).replace(/^de_/, "") || null,
        mapImage: typeof mapEntity?.image_lg === "string" ? mapEntity.image_lg : typeof mapEntity?.image_sm === "string" ? mapEntity.image_sm : null,
        faceitUrl: typeof detail?.faceit_url === "string" ? detail.faceit_url.replace("{lang}", "en") : null,
        demoUrl: Array.isArray(detail?.demo_url) && typeof detail.demo_url[0] === "string" ? detail.demo_url[0] : null,
        scoreboard,
      },
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "该场比赛的完整统计暂时无法读取" }, { status: 502 });
  }
}
