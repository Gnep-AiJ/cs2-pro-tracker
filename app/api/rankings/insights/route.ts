import { NextResponse } from "next/server";

export const runtime = "edge";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_CANDIDATES = 8;
const REQUEST_TIMEOUT_MS = 8_000;
const INVALID_SUMMARY_PATTERN = /职业选手数据变化|数据变化|有所提高|有所下降|表现出色|状态出色|提升|下滑|回升|改善|变差/i;

type RankingMode = "wins" | "activity" | "streak";

type Candidate = {
  id: string;
  nickname: string;
  team: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  recentMatches: number;
  recentWinRate: number;
  currentWinStreak: number;
};

type Insight = {
  status: "generated" | "fallback";
  title: string;
  summary: string;
  highlights: Array<{ playerId: string; label: string; note: string }>;
};

function safeText(value: unknown, maxLength: number) {
  return String(value || "").replace(/[^\p{L}\p{N}_.\- ]/gu, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function safeNumber(value: unknown, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, Math.round(number))) : 0;
}

function usesOnlyKnownNumbers(value: string, allowed: Set<number>, ignored: string[] = []) {
  const comparable = ignored.reduce((text, item) => text.replaceAll(item, ""), value);
  const numbers = (comparable.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return numbers.length > 0 && numbers.every(number => allowed.has(number));
}

function knownNumbers(players: Candidate[]) {
  return new Set(players.flatMap(player => [
    player.matches,
    player.wins,
    player.losses,
    player.winRate,
    player.recentMatches,
    player.recentWinRate,
    player.currentWinStreak,
  ]));
}

function normalizeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CANDIDATES).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const id = safeText(source.id, 64);
    const nickname = safeText(source.nickname, 32);
    if (!id || !nickname) return [];
    return [{
      id,
      nickname,
      team: safeText(source.team, 32) || "战队未标注",
      matches: safeNumber(source.matches, 20),
      wins: safeNumber(source.wins, 20),
      losses: safeNumber(source.losses, 20),
      winRate: safeNumber(source.winRate, 100),
      recentMatches: safeNumber(source.recentMatches, 10),
      recentWinRate: safeNumber(source.recentWinRate, 100),
      currentWinStreak: safeNumber(source.currentWinStreak, 10),
    }];
  });
}

function fallbackInsight(mode: RankingMode, players: Candidate[]): Insight {
  const first = players[0];
  if (!first) return {
    status: "fallback",
    title: "等待今日比赛数据",
    summary: "当前已收录选手尚未产生可用记录",
    highlights: [],
  };

  const title = mode === "wins"
    ? `${first.nickname} 暂居今日胜场榜首`
    : mode === "activity"
      ? `${first.nickname} 是今日最活跃选手`
      : first.currentWinStreak > 0
        ? `${first.nickname} 延续 ${first.currentWinStreak} 场连胜`
        : `${first.nickname} 近期胜率领先`;
  const summary = mode === "streak"
    ? `${first.team} 的 ${first.nickname} 近 ${first.recentMatches} 场胜率 ${first.recentWinRate}%`
    : `${first.team} 的 ${first.nickname} 今日完成 ${first.matches} 场，取得 ${first.wins} 胜 ${first.losses} 负`;
  const highlights = players.slice(0, 3).map((player, index) => ({
    playerId: player.id,
    label: index === 0 ? "当前领先" : `榜单第 ${index + 1}`,
    note: mode === "wins"
      ? `今日 ${player.wins} 胜，胜率 ${player.winRate}%`
      : mode === "activity"
        ? `今日完成 ${player.matches} 场比赛`
        : `${player.currentWinStreak} 场连胜，近期胜率 ${player.recentWinRate}%`,
  }));
  return { status: "fallback", title, summary, highlights };
}

function parseGenerated(value: unknown, players: Candidate[], fallback: Insight): Insight {
  let source = value;
  if (typeof source === "string") {
    const cleaned = source.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try { source = JSON.parse(cleaned); } catch { return fallback; }
  }
  if (!source || typeof source !== "object") return fallback;
  const record = source as Record<string, unknown>;
  const summary = String(record.summary || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const validSummary = !INVALID_SUMMARY_PATTERN.test(summary)
    && players.some(player => summary.includes(player.nickname))
    && usesOnlyKnownNumbers(summary, knownNumbers(players), players.map(player => player.nickname));
  const highlights = (Array.isArray(record.highlights) ? record.highlights : []).slice(0, 3).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const rank = safeNumber(entry.rank, players.length);
    const player = rank > 0 ? players[rank - 1] : null;
    if (!player) return [];
    const label = String(entry.label || "").replace(/\s+/g, " ").trim().slice(0, 12);
    const note = String(entry.note || "").replace(/\s+/g, " ").trim().slice(0, 54);
    return label && note && usesOnlyKnownNumbers(note, knownNumbers([player]), [player.nickname])
      ? [{ playerId: player.id, label, note }]
      : [];
  });
  return validSummary && highlights.length === 3
    ? { status: "generated", title: fallback.title, summary, highlights }
    : fallback;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }
  const mode: RankingMode = ["activity", "streak"].includes(String(body.mode)) ? body.mode as RankingMode : "wins";
  const players = normalizeCandidates(body.players);
  if (!players.length) return NextResponse.json({ error: "缺少可分析的选手数据" }, { status: 400 });

  const fallback = fallbackInsight(mode, players);
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store", "x-ai-insight": "binding-missing" } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "你是严谨的 CS2 职业比赛数据分析助手。只根据输入的当前榜单写中文看点，不改变排序，不补充未提供的信息，不评价选手水平，不描述提高、下降或其他时间变化。summary 必须包含至少一名输入选手的 nickname 和一个输入中的阿拉伯数字。只返回 JSON，包含 summary 和恰好 3 条 highlights；每条 highlight 必须引用输入中的 rank，并在 note 中使用至少一个输入中的阿拉伯数字。",
          },
          { role: "user", content: JSON.stringify({ mode, players: players.map((player, index) => ({ rank: index + 1, ...player })) }) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              highlights: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    rank: { type: "integer" },
                    label: { type: "string" },
                    note: { type: "string" },
                  },
                  required: ["rank", "label", "note"],
                },
              },
            },
            required: ["summary", "highlights"],
          },
        },
        max_tokens: 420,
        temperature: 0.1,
      }),
    });
    if (!response.ok) throw new Error(`Workers AI ${response.status}`);
    const payload = await response.json() as { result?: { response?: unknown } };
    const insight = parseGenerated(payload.result?.response, players, fallback);
    return NextResponse.json(insight, {
      headers: { "Cache-Control": "private, max-age=1800", "x-ai-insight": insight.status },
    });
  } catch {
    return NextResponse.json(fallback, { headers: { "Cache-Control": "no-store", "x-ai-insight": "fallback" } });
  } finally {
    clearTimeout(timeout);
  }
}
