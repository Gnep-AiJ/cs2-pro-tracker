import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadPureModule(path) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const data = await loadPureModule("app/lib/event-data.ts");
const locale = await loadPureModule("app/lib/locale.ts");

test("language preserves explicit choices and browser preference order", () => {
  assert.equal(locale.resolveLanguage("zh", "en", ["en-US"]), "zh");
  assert.equal(locale.resolveLanguage(null, "en", ["zh-CN"]), "en");
  assert.equal(locale.resolveLanguage(null, null, ["en-US", "zh-CN"]), "en");
  assert.equal(locale.resolveLanguage(null, null, ["fr", "zh-TW"]), "zh");
  assert.equal(locale.resolveLanguage("invalid", "invalid", ["de"]), "en");
});

test("event scope excludes qualifiers and unknown competition families", () => {
  for (const name of ["IEM Cologne", "Intel Extreme Masters Dallas"]) assert.equal(data.classifyImportantEvent(name), "iem");
  assert.equal(data.classifyImportantEvent("BLAST Open Rotterdam"), "blast");
  assert.equal(data.classifyImportantEvent("PGL Major"), "major");
  for (const name of ["IEM Closed Qualifier", "BLAST Open Qualifier", "PGL Regional", "ESL Challenger", "Local Cup", "PGL Academy", "Major RMR"]) assert.equal(data.classifyImportantEvent(name), null);
});

test("dated official snapshot preserves numeric points, roster and source", async () => {
  const raw = await readFile(new URL("../docs/evidence/valve-standings-2026-10-05.md", import.meta.url), "utf8");
  const saved = JSON.parse(await readFile(new URL("../app/data/valve-snapshot.json", import.meta.url), "utf8"));
  assert.equal(saved.snapshotDate, "2026-10-05");
  assert.deepEqual(data.parseValveStandings(raw, saved.sourceUrl), saved.items);
  assert.equal(saved.items.length, 100);
  assert.equal(saved.items[0].rank, 1);
  assert.ok(saved.items.every(row => row.sourceUrl.startsWith("https://github.com/ValveSoftware/") && Number.isFinite(row.points)));
  assert.deepEqual(data.parseValveStandings("| --- | --- |\nnot a table", saved.sourceUrl), []);
});

test("match normalization never invents scores and rejects cancelled matches", () => {
  const fixture = { id: 10, league: { name: "IEM" }, serie: { full_name: "Cologne" }, tournament: { name: "Playoffs" }, status: "not_started", opponents: [{ opponent: { id: 1, name: "A" } }, { opponent: { id: 2, name: "B" } }], results: [{ team_id: 1, score: 0 }], scheduled_at: "2026-10-07T10:00:00Z", number_of_games: 3 };
  assert.deepEqual(data.normalizeEventMatch(fixture).teams.map(team => team.score), [null, null]);
  assert.equal(data.normalizeEventMatch({ ...fixture, status: "canceled" }), null);
  assert.deepEqual(data.normalizeEventMatch({ ...fixture, status: "finished" }).teams.map(team => team.score), [0, null]);
  assert.equal(data.optionalNumber(null), null);
  assert.equal(data.optionalNumber(""), null);
  assert.equal(data.optionalNumber(false), null);
  assert.equal(data.optionalNumber("0"), 0);
});

test("comparison exposes missing metric coverage and uses selected map samples", () => {
  const sample = [
    { result: "W", map: "de_mirage", adr: 100, kd: 2, kr: 1, headshots: 50, playedAt: "2026-10-07" },
    { result: "L", map: "de_nuke", adr: null, kd: null, kr: null, headshots: null, playedAt: "2026-10-06" },
    { result: "W", map: "de_mirage", adr: 0, kd: 0, kr: 0, headshots: 0, playedAt: "2026-10-05" },
  ];
  const all = data.summarizeSample(sample, 10);
  assert.equal(all.matches, 3);
  assert.deepEqual(all.adr, { value: 50, count: 2 });
  assert.equal(all.from, "2026-10-05");
  const map = data.summarizeSample(sample, 1, "de_mirage");
  assert.equal(map.matches, 1);
  assert.equal(map.winRate, 100);
  assert.equal(data.summarizeSample(sample, 5, "de_dust2").winRate, null);
});
