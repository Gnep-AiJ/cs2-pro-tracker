"use client";
import { useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import Modal from './Modal';
import { useLanguage } from './LanguageProvider';
import { number, useDate } from './TrackerWorkspace';
import { fuzzyScore, type EventDetails } from '../lib/pro-events';

export default function EventMatchStream({ details, query }: { details: EventDetails; query: string }) {
  const { t, language } = useLanguage(), date = useDate();
  const [chosenFilter, setFilter] = useState<string | null>(null), [limit, setLimit] = useState(6), [selectedId, setSelected] = useState<string | null>(null);
  const all = details.matches.filter(m => !query || m.teams.some(team => fuzzyScore(query, [team.name]) > 0));
  const filter = chosenFilter || (all.some(m => m.status === 'running') ? 'running' : all.some(m => m.status === 'scheduled') || !details.matches.length ? 'scheduled' : 'finished');
  const selected = details.matches.find(m => m.id === selectedId) || null;
  const rows = all.filter(m => filter === 'all' || m.status === filter).sort((a, b) => filter === 'finished' ? (b.beginsAt || '').localeCompare(a.beginsAt || '') : (a.beginsAt || '').localeCompare(b.beginsAt || ''));
  const filters = [['running', t('Live', '进行中')], ['scheduled', t('Upcoming', '赛程')], ['finished', t('Results', '赛果')]].filter(([status]) => details.matches.some(match => match.status === status) || chosenFilter === status);
  if (filters.length > 1 || chosenFilter === 'all') filters.push(['all', t('All', '全部')]);
  const entrants = selected ? selected.teams.map(team => ({ team: team.name, players: details.players.filter(player => player.team.toLowerCase() === team.name.toLowerCase()) })).filter(team => team.players.length) : [];
  const streams = [...(selected?.streams || [])].sort((a,b)=>Number(b.main)-Number(a.main)||Number(b.language===language)-Number(a.language===language)).slice(0,2);
  return <>
    {filters.length>1&&<div className="compact-controls"><div className="segmented">{filters.map(([id, name]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setLimit(6); }}>{name}<small> {id === 'all' ? all.length : all.filter(m => m.status === id).length}</small></button>)}</div></div>}
    {!rows.length && <div className="fixture-empty-inline"><CalendarDays size={20} /><span>{query && !all.length ? t('No matching team', '未找到匹配战队') : filter === 'scheduled' ? t('No further matchups published', '后续对阵尚未公布') : t('No matches in this selection', '当前筛选暂无比赛')}</span>{all.some(m => m.status === 'finished') && filter !== 'finished' && <button type="button" className="arena-button" onClick={() => setFilter('finished')}>{t('View results', '查看赛果')}</button>}</div>}
    <div className="fixture-stack">{rows.slice(0, limit).map(m => <button type="button" className="pro-fixture" key={m.id} aria-haspopup="dialog" onClick={() => setSelected(m.id)}><span className="fixture-time"><b>{date(m.beginsAt)}</b><small>{m.beginsAt&&Number.isFinite(Date.parse(m.beginsAt)) ? new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(m.beginsAt)) : '—'}{m.bestOf?` · BO${m.bestOf}`:''}</small>{m.round && <small>{m.round.replace(/:\s*.*\s+vs\.?\s+.*$/i, '')}</small>}</span><span className="fixture-duel">{m.teams.map((team, i) => <span className={`fixture-side ${i === 1 ? 'right' : ''}`} key={i}>{team.logo && <Image src={team.logo} alt="" width={26} height={26} unoptimized />}<strong>{team.name==='TBA'?t('TBA','待定'):team.name}</strong><b className={m.status === 'finished' && team.score != null && m.teams[1 - i]?.score != null && team.score > m.teams[1 - i].score! ? 'winner' : ''}>{number(team.score, 0)}</b></span>)}<span className="fixture-versus">{m.status === 'finished' ? t('Final', '结束') : m.status === 'running' ? t('Live', '进行中') : 'VS'}</span></span><ChevronRight size={16} /></button>)}</div>
    {rows.length > limit && <button type="button" className="more-button" onClick={() => setLimit(n => n + 8)}>{t('Show more matches', '加载更多比赛')}<ChevronDown size={14} /></button>}
    <Modal open={!!selected} onClose={() => setSelected(null)} title={t('Event match', '赛事对局')} id="event-match-title">{selected && <>
      <p className="event-match-context">{date(selected.beginsAt, true)}{selected.bestOf?` · BO${selected.bestOf}`:''}{selected.round ? ` · ${selected.round}` : ''}</p>
      <div className="scoreboard-duel">{selected.teams.map((team, i) => <div key={i}><span>{team.name}</span><strong>{number(team.score, 0)}</strong></div>)}</div>
      <p className="event-source-note">{selected.provider === 'PandaScore' ? 'PandaScore' : 'HLTV'} · {date(details.observedAt, true)}{details.saved?` · ${t('Saved','历史记录')}`:''}</p>
      {!!selected.maps?.length && <div className="event-game-list">{selected.maps.map(map => <div key={map.id}><strong>{map.name || `${t('Map', '地图')} ${map.position}`}</strong><span>{map.status==='running'?t('Live','进行中'):map.status==='finished'?t('Finished','已结束'):t('Upcoming','未开始')}</span><b>{map.winnerId ? `${selected.teams.find(team=>team.id===map.winnerId)?.name||'—'} · ${t('Winner','胜者')}`:'—'}</b></div>)}</div>}
      {entrants.length>0&&<details className="compact-disclosure"><summary>{t('Event rosters', '赛事阵容')}<ChevronDown size={15} /></summary><div className="event-match-entrants">{entrants.map(team => <div key={team.team}><h3>{team.team}</h3><p>{team.players.map(player=>player.name).join(' / ')}</p></div>)}</div></details>}
      <div className="arena-dialog-actions">{streams.map(stream=><a className={`arena-button ${stream.main?'primary':''}`} key={stream.url} href={stream.url} target="_blank" rel="noreferrer">{t('Stream','直播')} · {stream.language.toUpperCase()}<ArrowUpRight size={15}/></a>)}{selected.sourceUrl&&<a className="arena-button" href={selected.sourceUrl} target="_blank" rel="noreferrer">{t('Source', '数据来源')}<ArrowUpRight size={15} /></a>}</div>
    </>}</Modal>
  </>;
}
