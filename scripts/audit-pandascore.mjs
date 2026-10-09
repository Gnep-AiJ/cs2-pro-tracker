import { mkdir, writeFile } from 'node:fs/promises';
const token = process.env.PANDASCORE_API_TOKEN?.trim();
if (!token) throw new Error('PandaScore is not configured');
const directory = new URL('../outputs/redesign-20261009/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const path of ['tournaments/running', 'tournaments/upcoming', 'tournaments/past']) {
  const url = new URL(`https://api.pandascore.co/csgo/${path}`);
  // CS routes cover CS2. Validate the returned videogame rather than an undocumented title filter.
  url.searchParams.set('page[size]', '100');
  url.searchParams.set('filter[tier]', 's,a');
  url.searchParams.set('sort', path.endsWith('past') ? '-end_at' : 'begin_at');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => null);
  const headers = Object.fromEntries([...response.headers].filter(([name]) => /ratelimit|retry-after|total|page/i.test(name)));
  if (response.ok && Array.isArray(data)) await writeFile(new URL(`pandascore-${path.replace('/', '-')}.json`, directory), JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ path, status: response.status, count: Array.isArray(data) ? data.length : null, headers,
    sample: Array.isArray(data) ? data.slice(0, 4).map(row => ({ id: row.id, name: row.name, status: row.status, beginAt: row.begin_at, league: row.league?.name, series: row.serie?.full_name, tournament: row.tournament?.name, tier: row.tournament?.tier, results: row.results, games: row.games?.length })) : null }));
}
