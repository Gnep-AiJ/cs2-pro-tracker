import { readAdvanced, summarizeLab, type LabFeed } from './pro-lab';
import type { PlayerProfile, PlayerSample } from './tracker-types';

const advancedKeys = Object.keys(readAdvanced({})) as Array<keyof ReturnType<typeof readAdvanced>>;
const baseKeys = ['kills', 'deaths', 'adr', 'kr', 'headshots'] as const;

/** Join observations by both player and match identity; live non-missing fields win. */
export function enrichProfileWithArchive(player: PlayerProfile, feed: LabFeed, now = Date.now()): PlayerProfile {
  const observed = Date.parse(feed.observedAt);
  if (feed.version !== 1 || !Number.isFinite(observed) || observed > now + 60_000) return player;
  const archived = feed.players.find(row => row.id === player.id);
  if (!archived) return player;
  const samples = new Map(archived.samples.map(sample => [sample.id, sample]));
  return { ...player, archive: { observedAt: feed.observedAt, storage: feed.storage, stale: now - observed > 12 * 3600_000 }, recentMatches: player.recentMatches.map(match => {
    const saved = samples.get(match.id);
    if (!saved) return match;
    const merged: PlayerSample = { ...match };
    for (const key of baseKeys) if (merged[key] == null && saved[key] != null && Number.isFinite(saved[key])) merged[key] = saved[key]!;
    if (!merged.map && saved.map) merged.map = saved.map;
    const advancedAt = Date.parse(saved.advancedObservedAt || '');
    if (!Number.isFinite(advancedAt) || advancedAt > now + 60_000) return merged;
    let used = false;
    const previous = new Set(match.advancedArchiveFields || []);
    const fields = [...previous];
    for (const key of advancedKeys) {
      const value = saved[key];
      if ((merged[key] == null || previous.has(key)) && value != null && Number.isFinite(value)) {
        merged[key] = value;
        if (!previous.has(key)) fields.push(key);
        used = true;
      }
    }
    if (used) { merged.advancedObservedAt = saved.advancedObservedAt; merged.advancedArchiveFields = fields; }
    return merged;
  }) };
}

/** Compare disjoint recent windows. This is observed change, not a prediction. */
export function recentFormChange(matches: PlayerSample[]) {
  const seen = new Set<string>();
  const rows = matches.filter(m => !seen.has(m.id) && !!seen.add(m.id)).slice(0, 10);
  const current = summarizeLab(rows.slice(0, 5), 5), previous = summarizeLab(rows.slice(5, 10), 5);
  return { current, previous, adr: current.adr.n === 5 && previous.adr.n === 5 ? current.adr.value! - previous.adr.value! : null,
    kr: current.kr.n === 5 && previous.kr.n === 5 ? current.kr.value! - previous.kr.value! : null };
}
