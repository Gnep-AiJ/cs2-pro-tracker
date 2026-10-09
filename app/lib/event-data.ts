import type { EventFamily, EventMatch, Standing, PlayerSample } from "./tracker-types";

export const importantEventFamilies = [
  { id: "major", name: "Major", url: "https://www.counter-strike.net/" },
  { id: "iem", name: "IEM", url: "https://pro.eslgaming.com/tour/cs/" },
  { id: "epl", name: "ESL Pro League", url: "https://pro.eslgaming.com/csgo/proleague/" },
  { id: "blast", name: "BLAST", url: "https://blast.tv/cs" },
  { id: "pgl", name: "PGL", url: "https://www.pglesports.com/" },
] as const;

export function classifyImportantEvent(name: string): EventFamily | null {
  if (/qualif|academy|challenger|regional|women|showmatch|closed|open qualifier|\brmr\b/i.test(name)) return null;
  if (/\bmajor\b/i.test(name)) return "major";
  if (/\biem\b|intel extreme masters/i.test(name)) return "iem";
  if (/esl pro league/i.test(name)) return "epl";
  if (/blast.*\b(open|rivals|bounty)\b/i.test(name)) return "blast";
  if (/\bpgl\b/i.test(name)) return "pgl";
  return null;
}

export function optionalNumber(value: unknown): number | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseValveStandings(text: string, sourceUrl: string): Standing[] {
  return text.split(/\r?\n/).flatMap(line => {
    const cells = line.split("|").map(cell => cell.trim());
    if (cells.length < 6 || !/^\d+$/.test(cells[1]) || !/^\d+(?:\.\d+)?$/.test(cells[2])) return [];
    const details = cells[5].match(/\[details\]\(([^)]+)\)/)?.[1];
    let detailUrl = sourceUrl;
    if (details && /^details\/[a-zA-Z0-9_./-]+\.md$/.test(details)) detailUrl = new URL(details, sourceUrl).href;
    return [{ rank: Number(cells[1]), points: Number(cells[2]), name: cells[3], roster: cells[4].split(",").map(value => value.trim()).filter(Boolean), sourceUrl: detailUrl }];
  }).slice(0, 100);
}

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { return value && typeof value === "object" ? value as RecordValue : {}; }
function text(value: unknown): string { return typeof value === "string" ? value.slice(0, 180) : ""; }
export function normalizeEventMatch(value: unknown): EventMatch | null {
  const row = record(value);
  const league = record(row.league), serie = record(row.serie), tournament = record(row.tournament);
  const event = [text(league.name), text(serie.full_name) || text(serie.name), text(tournament.name)].filter(Boolean).join(" · ");
  const family = classifyImportantEvent(event);
  const id = optionalNumber(row.id);
  if (!family || id == null) return null;
  const status = row.status === "finished" ? "finished" : row.status === "running" ? "running" : row.status === "not_started" ? "upcoming" : null;
  if (!status) return null;
  const results = Array.isArray(row.results) ? row.results.map(record) : [];
  const teams = (Array.isArray(row.opponents) ? row.opponents : []).map(value => record(record(value).opponent)).flatMap(team => {
    const teamId = optionalNumber(team.id);
    if (teamId == null || !text(team.name)) return [];
    return [{ id: String(teamId), name: text(team.name), score: status === "finished" ? optionalNumber(results.find(result => result.team_id === teamId)?.score) : null }];
  });
  const date = text(row.begin_at) || text(row.scheduled_at);
  return { id: String(id), name: text(row.name), event, family, status, teams,
    beginsAt: date && Number.isFinite(Date.parse(date)) ? date : null,
    bestOf: optionalNumber(row.number_of_games), detailedStats: row.detailed_stats === true };
}

export function summarizeSample(matches: PlayerSample[], limit: number, map = "all") {
  const seen=new Set<string>();
  const sample = matches.filter(match=>!match.id||(!seen.has(match.id)&&!!seen.add(match.id))).slice(0, limit).filter(match => map === "all" || match.map === map);
  const decided = sample.filter(match => match.result === "W" || match.result === "L");
  const average = (key: "kd" | "kr" | "adr" | "headshots") => {
    const values = sample.flatMap(match => match[key] == null || !Number.isFinite(match[key]) ? [] : [match[key]!]);
    return { value: values.length ? values.reduce((sum, number) => sum + number, 0) / values.length : null, count: values.length };
  };
  return { matches: sample.length, wins: decided.filter(match => match.result === "W").length,
    losses: decided.filter(match => match.result === "L").length, decidedMatches: decided.length,
    winRate: decided.length ? decided.filter(match => match.result === "W").length / decided.length * 100 : null,
    kd: average("kd"), kr: average("kr"), adr: average("adr"), headshots: average("headshots"),
    from: sample.at(-1)?.playedAt ?? null, to: sample[0]?.playedAt ?? null };
}
