import { NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any -- FACEIT payloads are validated at runtime. */

export const runtime = "edge";

const FACEIT_DATA = "https://open.faceit.com/data/v4";
const REGIONS = new Set(["EU", "NA", "SA", "SEA", "OCE"]);
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600";

function officialHeaders() {
  const key = process.env.FACEIT_API_KEY?.trim();
  return key ? { accept: "application/json", authorization: `Bearer ${key}` } : null;
}

async function fetchOfficial(path: string, headers: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${FACEIT_DATA}${path}`, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`FACEIT ${response.status}`);
    return await response.json() as any;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = String(params.get("region") || "EU").toUpperCase();
  const country = String(params.get("country") || "").toLowerCase();
  const playerId = String(params.get("player") || "");
  const requestedOffset = Math.max(0, Math.min(10_000, Number(params.get("offset") || 0) || 0));
  if (!REGIONS.has(region)) return NextResponse.json({ error: "赛区不受支持" }, { status: 400 });
  if (country && !/^[a-z]{2}$/.test(country)) return NextResponse.json({ error: "国家代码格式不正确" }, { status: 400 });
  if (playerId && !/^[a-f0-9-]{36}$/i.test(playerId)) return NextResponse.json({ error: "选手 ID 格式不正确" }, { status: 400 });
  const headers = officialHeaders();
  if (!headers) return NextResponse.json({ error: "FACEIT 数据服务尚未配置" }, { status: 503 });

  try {
    const suffix = country ? `&country=${encodeURIComponent(country)}` : "";
    let offset = requestedOffset;
    let targetPosition: number | null = null;
    if (playerId) {
      const positionPayload = await fetchOfficial(`/rankings/games/cs2/regions/${region}/players/${encodeURIComponent(playerId)}?limit=1${suffix}`, headers);
      targetPosition = Number.isFinite(Number(positionPayload?.position)) ? Number(positionPayload.position) : null;
      if (targetPosition) offset = Math.max(0, targetPosition - 6);
    }
    const payload = await fetchOfficial(`/rankings/games/cs2/regions/${region}?offset=${offset}&limit=50${suffix}`, headers);
    return NextResponse.json({
      region,
      country: country || null,
      targetPlayerId: playerId || null,
      targetPosition,
      start: payload?.start ?? offset,
      end: payload?.end ?? offset,
      items: Array.isArray(payload?.items) ? payload.items : [],
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch {
    return NextResponse.json({ error: "FACEIT 排行榜暂时无法读取" }, { status: 502 });
  }
}
