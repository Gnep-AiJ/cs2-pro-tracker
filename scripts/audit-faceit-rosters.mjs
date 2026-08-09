import { readFileSync } from "node:fs";
import { ProxyAgent, fetch } from "undici";

const identitySource = readFileSync(new URL("../app/data/tracked-players.ts", import.meta.url), "utf8");
const identityBlock = identitySource.match(/const faceitPlayerIds:[\s\S]*?\n};/)?.[0] || "";
const identities = [...identityBlock.matchAll(/^\s*(?:"([^"]+)"|([a-zA-Z0-9_-]+)):\s*"([a-f0-9-]{36})",?$/gm)]
  .map(([, quotedName, bareName, playerId]) => ({ display: quotedName || bareName, playerId }));

if (!identities.length) throw new Error("No pinned FACEIT player IDs found");

const key = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((line) => line.startsWith("FACEIT_API_KEY="))
  ?.slice("FACEIT_API_KEY=".length)
  .trim();

if (!key) throw new Error("FACEIT_API_KEY is missing from .env.local");

const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
const headers = { accept: "application/json", authorization: `Bearer ${key}` };

async function getJson(url) {
  const response = await fetch(url, { dispatcher, headers });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // Status is enough when FACEIT does not return JSON.
  }
  return { status: response.status, json };
}

const rows = [];
for (const identity of identities) {
  const [profile, stats] = await Promise.all([
    getJson(`https://open.faceit.com/data/v4/players/${identity.playerId}`),
    getJson(`https://open.faceit.com/data/v4/players/${identity.playerId}/stats/cs2`),
  ]);
  rows.push({
    display: identity.display,
    expectedPlayerId: identity.playerId,
    actualPlayerId: profile.json?.player_id ?? null,
    faceitNickname: profile.json?.nickname ?? null,
    status: profile.status,
    identityMatch: profile.json?.player_id === identity.playerId,
    verified: profile.json?.verified === true,
    level: profile.json?.games?.cs2?.skill_level ?? null,
    elo: profile.json?.games?.cs2?.faceit_elo ?? null,
    matches: Number(stats.json?.lifetime?.Matches || 0),
  });
}

const failures = rows.filter((row) => row.status !== 200 || !row.identityMatch);
console.log(JSON.stringify({ profiles: rows, pinned: rows.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;

const monesyId = identities.find((identity) => identity.display === "m0nesy")?.playerId;
const monesy = monesyId ? await getJson(`https://open.faceit.com/data/v4/players/${monesyId}`) : { status: 404, json: null };
if (monesy.status === 200) {
  const history = await getJson(`https://open.faceit.com/data/v4/players/${monesy.json.player_id}/history?game=cs2&offset=0&limit=1`);
  const matchId = history.json?.items?.[0]?.match_id;
  if (matchId) {
    const [details, stats] = await Promise.all([
      getJson(`https://open.faceit.com/data/v4/matches/${matchId}`),
      getJson(`https://open.faceit.com/data/v4/matches/${matchId}/stats`),
    ]);
    const round = stats.json?.rounds?.[0];
    const samplePlayer = round?.teams?.[0]?.players?.[0];
    console.log(JSON.stringify({
      sampleMatch: {
        id: matchId,
        detailStatus: details.status,
        statsStatus: stats.status,
        detailKeys: Object.keys(details.json ?? {}),
        result: details.json?.results ?? null,
        teamKeys: Object.keys(round?.teams?.[0] ?? {}),
        teamStats: round?.teams?.map((team) => team.team_stats) ?? [],
        playerStatsKeys: Object.keys(samplePlayer?.player_stats ?? {}),
        samplePlayer,
      },
    }, null, 2));
  }
}
