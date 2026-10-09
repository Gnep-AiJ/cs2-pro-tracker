"use client";
import snapshot from '../data/valve-snapshot.json';
import { useLanguage } from './LanguageProvider';
import { useResource, useDate } from './TrackerWorkspace';
import type { StandingsFeed } from '../lib/tracker-types';
import { useState } from 'react';
export default function ValveStandings() {
  const { t } = useLanguage(), date = useDate();
  const [limit,setLimit]=useState(20);
  const resource = useResource<StandingsFeed>('/api/events/standings', snapshot as StandingsFeed), feed = resource.data || snapshot;
  return <div className="valve-standings"><div className="valve-heading"><div><span>Valve VRS</span><h3>{t('World ranking','全球战队排名')}</h3></div><time>{feed.snapshotDate}</time></div><p className="scope-note">{resource.loading?t('Updating…','更新中…'):feed.stale||resource.error?t('Saved standings','历史积分'):t('Official standings','官方积分')}{feed.updatedAt?' · '+date(feed.updatedAt,true):''}</p><table className="valve-table"><thead><tr><th>#</th><th>{t('Team','战队')}</th><th>{t('Points','积分')}</th></tr></thead><tbody>{feed.items.slice(0,limit).map(team=><tr key={team.rank} className={team.rank<=3?'valve-podium':''}><td>{team.rank}</td><td><a href={team.sourceUrl} target="_blank" rel="noreferrer"><strong>{team.name}</strong></a><small>{team.roster.join(' · ')}</small></td><td><b>{team.points.toLocaleString()}</b></td></tr>)}</tbody></table>{feed.items.length>limit&&<button type="button" className="stream-more" onClick={()=>setLimit(n=>n+20)}>{t('Show more teams','更多战队')}</button>}<a className="arena-text-link" href={feed.sourceUrl} target="_blank" rel="noreferrer">{t('Valve source','Valve 官方来源')}</a></div>;
}
