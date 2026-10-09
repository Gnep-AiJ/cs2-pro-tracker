import { NextResponse } from "next/server";
import snapshot from "../../../data/valve-snapshot.json";
import { parseValveStandings } from "../../../lib/event-data";
import type { StandingsFeed } from "../../../lib/tracker-types";

export const runtime = "edge";
export async function getValveStandings(): Promise<StandingsFeed> {
  try {
    const year = new Date().getUTCFullYear();
    const response = await fetch(`https://api.github.com/repos/ValveSoftware/counter-strike_regional_standings/contents/live/${year}`, { headers: { "User-Agent": "CS2ProTracker", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(6_000) });
    if (!response.ok) throw new Error("Directory unavailable");
    const files: unknown = await response.json();
    if (!Array.isArray(files)) throw new Error("Invalid directory");
    const names = files.flatMap(file => typeof file?.name === "string" && /^standings_global_\d{4}_\d{2}_\d{2}\.md$/.test(file.name) ? [file.name as string] : []).sort();
    const name = names.at(-1);
    if (!name) throw new Error("No standings");
    const sourceUrl = `https://github.com/ValveSoftware/counter-strike_regional_standings/blob/main/live/${year}/${name}`;
    const raw = await fetch(`https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/live/${year}/${name}`, { signal: AbortSignal.timeout(6_000) });
    if (!raw.ok) throw new Error("Standings unavailable");
    const items = parseValveStandings(await raw.text(), sourceUrl);
    if (!items.length) throw new Error("Invalid standings");
    return { items, snapshotDate: name.slice(17, 27).replaceAll("_", "-"), sourceUrl, stale: false, updatedAt: new Date().toISOString() };
  } catch { return snapshot; }
}
export async function GET() {
  const feed = await getValveStandings();
  return NextResponse.json(feed, { headers: { "Cache-Control": feed.stale ? "no-store" : "public, max-age=300, s-maxage=3600" } });
}
