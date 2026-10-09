"use client";
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {ArrowDownUp,ArrowUpRight,BarChart3,CalendarDays,ChevronDown,MapPin,Search,Trophy,X} from 'lucide-react';
import SiteHeader from './SiteHeader';
import {useLanguage} from './LanguageProvider';
import {useResource,Notice,number,useDate} from './TrackerWorkspace';
import PlayerComparison from './PlayerComparison';
import Modal from './Modal';
import EventChooser from './EventChooser';
import EventMatchStream from './EventMatchStream';
import ValveStandings from './ValveStandings';
import {eventMetric,rankEventPlayers,type EventMetric} from '../lib/player-boards';
import snapshot from '../data/pro-events-snapshot.json';
import {fuzzyScore,type ProEventsFeed,type EventPlayer,type BigEvent,type EventDetails} from '../lib/pro-events';
type EventSection='data'|'rankings'|'compare';

function EventLogo({event}:{event:BigEvent}) {return event.logo?<Image className="event-brand-logo" src={event.logo} alt="" width={42} height={42} unoptimized/>:<span className="event-brand-placeholder"><Trophy size={26}/></span>;}
const eventMetrics:EventMetric[]=['rating','score','adr','kd','kast','kills'];
function availableMetrics(players:EventPlayer[],minimum=5){return eventMetrics.filter(metric=>rankEventPlayers(players,metric,minimum).length>0);}
function PlayerLedger({details,query,onCompare}:{details:EventDetails;query:string;onCompare:(p:EventPlayer)=>void}) {
  const {t}=useLanguage(); const [chosenMetric,setMetric]=useState<EventMetric|null>(null),[minimum,setMinimum]=useState(5);
  const metrics=availableMetrics(details.players),metric=chosenMetric&&metrics.includes(chosenMetric)?chosenMetric:metrics[0]||'adr';
  const ranked=rankEventPlayers(details.players,metric,minimum),indexed=new Map(ranked.map(r=>[r.player.id,r]));
  const rows=ranked.map(r=>r.player).filter(p=>fuzzyScore(query,[p.name,p.team])>0);
  const label=metric==='rating'?'HLTV Rating':metric==='score'?'ENSI /10':metric==='kd'?'K/D':metric==='kast'?'KAST':metric==='kills'?t('Kills','击杀'):'ADR',suffix=metric==='kast'?'%':'';
  return <>
    <div className="compact-controls"><div className="metric-buttons">{[['rating','HLTV Rating'],['score','ENSI /10'],['adr','ADR'],['kd','K/D'],['kast','KAST'],['kills',t('Kills','击杀')]].filter(([id])=>metrics.includes(id as EventMetric)).map(([id,label])=><button type="button" key={id} aria-pressed={metric===id} onClick={()=>setMetric(id as EventMetric)}>{label}</button>)}</div><select aria-label={t('Minimum maps','最低地图样本')} value={minimum} onChange={e=>setMinimum(Number(e.target.value))}>{[5,10].map(n=><option key={n} value={n}>{t('At least','至少')} {n} {t('maps','图')}</option>)}</select></div>
    <div className="lab-board-caption"><span>{label}</span><span>{ranked.length} {t('players','名选手')}</span></div>
    {rows.slice(0,20).map(p=>{const row=indexed.get(p.id),value=eventMetric(p,metric);return <details name="pro-player" className="lab-ranked-row" key={p.id}><summary><span className="lab-identity"><b className={`lab-rank ${(row?.rank||99)<=3?'top':''}`}>{row?String(row.rank).padStart(2,'0'):'—'}</b>{p.avatar?<Image src={p.avatar} width={36} height={36} alt="" unoptimized/>:<span className="directory-avatar">{p.name.slice(0,1)}</span>}<span><strong>{p.name}</strong><small>{p.team}</small></span></span><span className="lab-rank-value"><b>{number(value,metric==='kd'||metric==='score'||metric==='rating'?2:metric==='kills'?0:1,suffix)}</b>{row&&<span className="lab-meter"><i style={{width:`${row.value/Math.max(1,ranked[0]?.value||1)*100}%`}}/></span>}</span><small className="lab-sample">{(metric==='rating'?p.ratingMaps:p.maps)??'—'} {t('maps','图')}</small><ChevronDown size={13}/></summary><div className="lab-row-expanded"><div className="lab-mini-metrics">{p.adr!=null&&<span>ADR <b>{number(p.adr)}</b></span>}{eventMetric(p,'kd')!=null&&<span>K/D <b>{number(eventMetric(p,'kd'),2)}</b></span>}{p.kast!=null&&<span>KAST <b>{number(p.kast,1,'%')}</b></span>}{p.kills!=null&&p.deaths!=null&&<span>K / D / A <b>{p.kills} / {p.deaths} / {p.assists??'—'}</b></span>}</div><div className="compact-controls">{metrics.some(metric=>rankEventPlayers(details.players,metric).length>=2)&&<button type="button" className="primary-button" onClick={()=>onCompare(p)}><ArrowDownUp size={14}/>{t('Compare','对比')}</button>}<a className="secondary-button" href={p.sourceUrl} target="_blank" rel="noreferrer">{t('Source','来源')} <ArrowUpRight size={13}/></a></div></div></details>;})}
    {!rows.length&&<Notice>{t('No matching players','暂无匹配选手')}</Notice>}
  </>;
}
export default function EventsWorkspace() {
  const {language,t}=useLanguage(),date=useDate();
  const [requestedEvent,setEventId]=useState<string|null>(null),[section,setSection]=useState<EventSection>('data'),[query,setQuery]=useState(''),[comparePlayer,setComparePlayer]=useState<string|null>(null),[valveOpen,setValveOpen]=useState(false);
  useEffect(()=>{const params=new URL(location.href).searchParams;const e=params.get('event'),s=params.get('section');const timer=setTimeout(()=>{if(e&&/^(?:ps-)?\d{1,8}$/.test(e))setEventId(e);if(['data','rankings','compare'].includes(s||''))setSection(s as EventSection);},0);return()=>clearTimeout(timer);},[]);
  const fallbackId=requestedEvent||snapshot.events[0].id;
  const stored=snapshot.details[fallbackId as keyof typeof snapshot.details];
  const initial={events:snapshot.events,details:stored?{...stored,saved:true,statsSaved:true}:{id:fallbackId,matches:[],players:[],maps:[],observedAt:snapshot.observedAt,statsObservedAt:null,sourceUrl:'',statsUrl:null,saved:true,statsSaved:true},observedAt:snapshot.observedAt,saved:true} as ProEventsFeed;
  const resource=useResource<ProEventsFeed>(`/api/events/catalogue${requestedEvent?`?event=${requestedEvent}`:''}`,initial);
  const [eventCatalogue,setEventCatalogue]=useState<BigEvent[]>(snapshot.events as BigEvent[]);
  const observedEvents=resource.data?.events;
  useEffect(()=>{if(!observedEvents)return;const timer=setTimeout(()=>setEventCatalogue(observedEvents),0);return()=>clearTimeout(timer);},[observedEvents]);
  const refresh=resource.refresh;
  useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},300000);return()=>clearInterval(timer);},[refresh]);
  const feed=resource.data||initial,eventId=feed.details.id,events=resource.data?.events||eventCatalogue,event:BigEvent=events.find(e=>e.id===eventId)||snapshot.events.find(e=>e.id===eventId) as BigEvent||{id:eventId,name:t('Loading event…','读取赛事…'),startsAt:'',endsAt:'',location:'',prize:'',teams:null,logo:null,sourceUrl:'https://www.pandascore.co/',selection:'PandaScore S/A',statsUrl:null};
  const hasPerformance=availableMetrics(feed.details.players).length>0,canCompare=eventMetrics.some(metric=>rankEventPlayers(feed.details.players,metric).length>=2);
  const usdPrize=/^(\d+(?:\.\d+)?) United States Dollar$/.exec(event.prize||'');
  const prizeLabel=usdPrize?'$'+Number(usdPrize[1]).toLocaleString(language==='zh'?'zh-CN':'en-US'):event.prize;
  const activeSection=section==='rankings'&&hasPerformance||section==='compare'&&canCompare?section:'data';
  function switchSection(id:EventSection){setSection(id);const url=new URL(location.href);url.searchParams.set('event',eventId);url.searchParams.set('section',id);history.replaceState(history.state,'',url);}
  function chooseEvent(id:string){setEventId(id);setSection('data');setQuery('');setComparePlayer(null);const url=new URL(location.href);url.searchParams.set('event',id);url.searchParams.set('section','data');history.replaceState(history.state,'',url);}
  const compare=(p:EventPlayer)=>{setComparePlayer(p.id);switchSection('compare');};
  return <div className="site-shell compact-shell editorial-shell arena-events"><SiteHeader activeHref="/matches" status="CS2" onRefresh={resource.refresh} refreshing={resource.loading} refreshLabel={t('Refresh events','刷新赛事')}/><main className="workspace-main pro-events-main">
    <div className="workspace-heading reading-heading"><h1>{event.name}</h1><div className="heading-actions"><EventChooser events={events} value={eventId} onSelect={chooseEvent}/><button type="button" className="arena-button action-valve" aria-haspopup="dialog" onClick={()=>setValveOpen(true)}><Trophy size={16}/>Valve {t('Standings','积分榜')}</button></div></div>
    <div className="event-context-line"><EventLogo event={event}/><span><CalendarDays size={13}/>{date(event.startsAt)} – {date(event.endsAt)}</span>{event.location&&<span><MapPin size={13}/>{event.location}</span>}{event.teams!=null&&<span>{event.teams} {t('teams','支战队')}</span>}{prizeLabel&&<span>{prizeLabel}</span>}<a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={t('Event source','赛事来源')}>{event.provider||'HLTV'}<ArrowUpRight size={13}/></a><span className="event-observed" role="status">{resource.loading?`${t('Updating…','更新中…')} · `:resource.error||feed.details.saved?`${t('Saved matches','历史记录')} · `:''}{date(feed.details.observedAt,true)}</span></div>
    <div className="workspace-surface reading-surface"><div className="workspace-toolbar" data-has-search><h2 id="pro-data-title">{t('Fixtures & results','赛程与赛果')}</h2><label className="workspace-search"><Search size={15}/><input type="search" value={query} maxLength={40} onChange={e=>setQuery(e.target.value)} placeholder={t('Find a team','搜索战队')} aria-label={t('Search','搜索')}/>{query&&<button type="button" aria-label={t('Clear search','清空搜索')} onClick={()=>setQuery('')}><X size={14}/></button>}</label></div>
    <section className="workspace-panel reading-panel" role="region" id="pro-data" aria-labelledby="pro-data-title">
      {resource.error&&<Notice retry={resource.refresh}>{t('Update failed. Showing saved matches.','更新失败，显示历史记录。')}</Notice>}
      <EventMatchStream key={eventId} details={feed.details} query={query}/>
      {feed.details.players.length>0&&<details className="compact-disclosure"><summary>{t('Entrants','参赛选手')} <span>{feed.details.players.length}</span><ChevronDown size={14}/></summary><div className="disclosure-body entrant-grid">{[...new Set(feed.details.players.map(p=>p.team))].map(team=><div key={team}><strong>{team}</strong><span>{feed.details.players.filter(p=>p.team===team).map(p=>p.name).join(' · ')}</span></div>)}</div></details>}
    </section></div>
    {(hasPerformance||canCompare)&&<div className="compact-controls arena-secondary-tools">{hasPerformance&&<button type="button" className="arena-button" aria-haspopup="dialog" onClick={()=>switchSection('rankings')}><BarChart3 size={16}/>{t('Player results','赛事成绩')}</button>}{canCompare&&<button type="button" className="arena-button" aria-haspopup="dialog" onClick={()=>switchSection('compare')}><ArrowDownUp size={16}/>{t('Compare','对比')}</button>}</div>}
    <details className="compact-disclosure source-disclosure"><summary><span>{t('Sources','数据来源')}</span><ChevronDown size={14}/></summary><div className="disclosure-body compact-prose"><p>{event.provider||'HLTV'} · {date(feed.details.observedAt,true)}</p>{feed.details.statsObservedAt&&<p>Ensigame · {date(feed.details.statsObservedAt,true)} · ENSI /10</p>}<div className="source-links"><a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.provider||'HLTV'}</a>{event.statsUrl&&<a href={event.statsUrl} target="_blank" rel="noreferrer">Ensigame</a>}</div></div></details>
    <Modal open={valveOpen} onClose={()=>setValveOpen(false)} title={t('Valve team standings','Valve 战队积分榜')} id="valve-title" className="valve-dialog">{valveOpen&&<ValveStandings/>}</Modal>
    <Modal open={activeSection!=='data'} onClose={()=>switchSection('data')} title={activeSection==='compare'?t('Player comparison','选手对比'):t('Player results','赛事成绩')} id="event-tool-title">{activeSection==='rankings'&&<PlayerLedger key={eventId} details={feed.details} query="" onCompare={compare}/>} {activeSection==='compare'&&<PlayerComparison key={`${eventId}-${comparePlayer||''}`} domain="events" details={feed.details} initialPlayerId={comparePlayer}/>}</Modal>
  </main></div>;
}
