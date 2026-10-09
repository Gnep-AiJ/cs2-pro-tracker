import snapshot from '../app/data/pro-lab-snapshot.json';
import { enrichProfileWithArchive } from '../app/lib/profile-archive';
import { summarizeLab, type LabFeed } from '../app/lib/pro-lab';
import type { PlayerProfile } from '../app/lib/tracker-types';
import { faceitSummary } from '../app/lib/analysis-facts';

export async function readProfileArchive(bucket?: Pick<R2Bucket, 'get'>): Promise<LabFeed> {
  if (bucket) try {
    const object = await bucket.get('public/v1.json');
    if (object && object.size <= 2_000_000) {
      const feed = await object.json<LabFeed>();
      if (feed.version === 1 && Array.isArray(feed.players) && Number.isFinite(Date.parse(feed.observedAt)) && Date.parse(feed.observedAt) <= Date.now() + 60_000 && feed.players.every(p=>typeof p.id==='string' && Array.isArray(p.samples))) return { ...feed, storage: 'persistent' };
    }
  } catch { /* The dated bundled observation remains usable. */ }
  return snapshot as LabFeed;
}

export async function enrichPlayerResponse(response: Response, bucket?: Pick<R2Bucket, 'get'>): Promise<Response> {
  if (!response.ok) return response;
  const payload = await response.clone().json() as { player?: PlayerProfile };
  if (!payload.player?.id || !Array.isArray(payload.player.recentMatches)) return response;
  const player = enrichProfileWithArchive(payload.player, await readProfileArchive(bucket));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  if (player.archive?.stale) headers.set('cache-control', 'no-store');
  return Response.json({ ...payload, player }, { status: response.status, headers });
}

export async function enrichAnalysisResponse(response: Response, bucket?: Pick<R2Bucket, 'get'>): Promise<Response> {
  if (!response.ok) return response;
  const payload = await response.clone().json() as { domain?: string; language?: string; facts?: Array<Record<string, unknown>> };
  if (payload.domain !== 'faceit' || !payload.facts?.length) return response;
  const feed = await readProfileArchive(bucket);
  const facts = payload.facts.map(fact => {
    const player = feed.players.find(p => p.id === fact.playerId);
    const ids = new Set(Array.isArray(fact.matchIds) ? fact.matchIds : []);
    // Preserve the route's actual window and map filter; never extend its sample.
    const selected = player?.samples.filter(m => ids.has(m.id) && !!m.advancedObservedAt && Date.parse(m.advancedObservedAt) <= Date.now()) || [];
    const summary = summarizeLab(selected, 20);
    const extras = Object.fromEntries((['rating', 'swing', 'entrySuccess', 'clutchSuccess', 'utilityAdr', 'enemiesFlashed'] as const).map(key => [key, { ...summary[key], value: summary[key].value == null ? null : Number(summary[key].value.toFixed(2)) }]));
    const { playerId: _, matchIds: __, ...visible } = fact; void _; void __;
    return { ...visible, ...extras };
  });
  return Response.json({ ...payload, facts, summary: faceitSummary(facts, payload.language === 'zh'), generated: false, reason: 'unconfigured', archiveObservedAt: feed.observedAt, archiveStale: Date.now()-Date.parse(feed.observedAt)>12*3600_000 }, { headers: { 'Cache-Control': 'no-store' } });
}
