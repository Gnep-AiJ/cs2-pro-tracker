"use client";
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowDownUp, ArrowUpRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import PlayerSearch,{type PlayerCandidate} from './PlayerSearch';
import {useLanguage} from './LanguageProvider';
import {trackedPlayers} from '../data/tracked-players';
import {summarizeLab} from '../lib/pro-lab';
import {comparisonWinner} from '../lib/ranking-view';
import {eventMetric} from '../lib/player-boards';
import type {PlayerProfile} from '../lib/tracker-types';
import type {EventDetails,EventPlayer} from '../lib/pro-events';
const fmt=(n:number|null|undefined,digits=2)=>n==null||!Number.isFinite(n)?'—':Number(n.toFixed(digits)).toLocaleString();
export function eventCandidate(p:EventPlayer):PlayerCandidate{return {id:p.id,name:p.name,lookup:p.id,team:p.team,avatar:p.avatar,maps:p.maps,verified:true};}
type ComparisonRow={label:string;values:Array<number|null|undefined>;digits?:number;suffix?:string;counts?:number[];secondary?:boolean;direction?:'higher'|'lower'|'neutral'};
export function comparableRows(rows:ComparisonRow[]) {return rows.filter(row=>row.values.length===2&&row.values.every(value=>value!=null&&Number.isFinite(value)));}
export default function PlayerComparison({domain='faceit',details,initialPlayerId}:{domain?:'events'|'faceit';details?:EventDetails;initialPlayerId?:string|null}) {
  const {language,t}=useLanguage();
  const source=details?.players.filter(p=>p.maps!=null) || [];
  const faceit=useMemo(()=>trackedPlayers.filter(p=>p.faceitPlayerId).slice(0,2).map(p=>({id:p.faceitPlayerId!,name:p.display,lookup:p.lookup,team:p.team,avatar:null,maps:null,verified:true})),[]);
  const initial=details?.players.find(p=>p.id===initialPlayerId);
  const defaults=source.length>=2?source:(details?.players || []);
  const initialRows=initial?[initial,defaults.find(p=>p.id!==initial.id)].filter((p):p is EventPlayer=>!!p):defaults.slice(0,2);
  const [selected,setSelected]=useState<Array<PlayerCandidate|null>>(domain==='events'?initialRows.map(eventCandidate):faceit);
  const [profiles,setProfiles]=useState<PlayerProfile[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false),[limit,setLimit]=useState(10),[map,setMap]=useState('all'),[loadedIds,setLoadedIds]=useState<string[]>([]);
  useEffect(()=>{if(domain!=='faceit')return;const p=new URL(location.href).searchParams.get('player');const entry=trackedPlayers.find(x=>x.lookup.toLowerCase()===p?.toLowerCase());if(!entry?.faceitPlayerId)return;const candidate={id:entry.faceitPlayerId,name:entry.display,lookup:entry.lookup,team:entry.team,avatar:null,maps:null,verified:true};const timer=setTimeout(()=>setSelected([candidate,faceit.find(x=>x.id!==candidate.id) || null]),0);return()=>clearTimeout(timer);},[domain,faceit]);
  const valid=selected.length===2&&selected.every(Boolean)&&selected[0]?.id!==selected[1]?.id;
  async function compare(){
    if(!valid)return;setLoading(true);setError(false);const ids=selected.map(p=>p!.id);
    try{const players=await Promise.all(selected.map(async p=>{const r=await fetch('/api/players/'+encodeURIComponent(p!.lookup)+'?playerId='+encodeURIComponent(p!.id));if(!r.ok)throw new Error('unavailable');return (await r.json() as {player:PlayerProfile}).player;}));setProfiles(players);setLoadedIds(ids);}catch{setError(true);}finally{setLoading(false);}
  }
  const current=valid&&profiles.length===2&&selected.every((p,i)=>p?.id===loadedIds[i]);
  const eventRows=selected.map(p=>details?.players.find(x=>x.id===p?.id));
  const maps=[...new Set(profiles.flatMap(p=>p.recentMatches.flatMap(m=>m.map?[m.map]:[])))].sort();
  const activeMap=map==='all'||maps.includes(map)?map:'all';
  const samples=current?profiles.map(p=>summarizeLab(p.recentMatches,limit,activeMap)):[];
  const rows=comparableRows(domain==='events'?[
    {label:'HLTV Rating 3.0',values:eventRows.map(p=>p?.rating),counts:eventRows.map(p=>p?.ratingMaps||0)},
    {label:t('Maps','图数'),values:eventRows.map(p=>p?.maps),digits:0,direction:'neutral' as const},
    {label:'K/D',values:eventRows.map(p=>p?eventMetric(p,'kd'):null)},
    {label:'ADR',values:eventRows.map(p=>p?.adr),digits:1},
    {label:'KAST',values:eventRows.map(p=>p?.kast),digits:1,suffix:'%'},
    {label:'ENSI /10',values:eventRows.map(p=>p?.providerScore)},
    {label:t('Kills','击杀'),values:eventRows.map(p=>p?.kills),digits:0,direction:'neutral' as const},
    {label:t('Deaths','死亡'),values:eventRows.map(p=>p?.deaths),digits:0,direction:'neutral' as const},
  ]:current?[
    {label:t('Win rate','胜率'),values:samples.map(p=>p.winRate.value),counts:samples.map(p=>p.winRate.n),digits:1,suffix:'%'},
    {label:'K/D',values:samples.map(p=>p.kd.value),counts:samples.map(p=>p.kd.n)},
    {label:'K/R',values:samples.map(p=>p.kr.value),counts:samples.map(p=>p.kr.n)},
    {label:'ADR',values:samples.map(p=>p.adr.value),counts:samples.map(p=>p.adr.n),digits:1},
    {label:'HS%',values:samples.map(p=>p.headshots.value),counts:samples.map(p=>p.headshots.n),digits:1,suffix:'%'},
    {label:'FACEIT Rating',values:samples.map(p=>p.rating.value),counts:samples.map(p=>p.rating.n)},
    {label:'Round Swing',values:samples.map(p=>p.swing.value),counts:samples.map(p=>p.swing.n),suffix:'%'},
    {label:t('Entry success','破点成功率'),values:samples.map(p=>p.entrySuccess.value),counts:samples.map(p=>p.entrySuccess.n),digits:1,suffix:'%',secondary:true},
    {label:t('Clutch success','残局成功率'),values:samples.map(p=>p.clutchSuccess.value),counts:samples.map(p=>p.clutchSuccess.n),digits:1,suffix:'%',secondary:true},
    {label:t('Utility ADR','道具 ADR'),values:samples.map(p=>p.utilityAdr.value),counts:samples.map(p=>p.utilityAdr.n),digits:1,secondary:true},
    {label:t('Enemies flashed','致盲敌人'),values:samples.map(p=>p.enemiesFlashed.value),counts:samples.map(p=>p.enemiesFlashed.n),digits:1,secondary:true},
  ]:[]);
  function renderTable(tableRows:ComparisonRow[]) {
    if(!tableRows.length)return null;
    return <div className="bounded-table"><table className="comparison-table"><thead><tr><th>{t('Metric','指标')}</th>{selected.map((p,i)=><th key={i}>{p?.name}</th>)}</tr></thead><tbody>{tableRows.map(row=><tr key={row.label}><th>{row.label}</th>{row.values.map((value,i)=>{const baseline=domain==='events'?eventRows[i]?.maps:samples[i]?.matches;const winner=comparisonWinner(row.values,row.direction,row.digits??2);return <td key={i} className={winner===i?'comparison-winning':winner===-1?'comparison-tied':''}><strong>{fmt(value,row.digits??2)}{row.suffix}</strong>{winner===i&&<span className="metric-outcome">{t('Leads','领先')}</span>}{winner===-1&&<span className="metric-outcome tied">{t('Tie','持平')}</span>}{row.counts&&row.counts[i]!==baseline&&<small>{row.counts[i]} {domain==='events'?t('maps','图'):t('matches','场')}</small>}<span className={'comparison-track side-'+i} aria-hidden="true"><i style={{width:Math.min(100,(value!-Math.min(0,...row.values.map(v=>v!)))/Math.max(0.001,Math.max(...row.values.map(v=>v!))-Math.min(0,...row.values.map(v=>v!)))*100)+'%'}}/></span></td>;})}</tr>)}</tbody></table></div>;
  }
  const moreRows=rows.filter(row=>row.secondary);
  return <>
    <div className="personal-compare-picker">{[0,1].map(i=><PlayerSearch key={i} domain={domain} eventId={details?.id} label={t('Player','选手')+' '+(i+1)} selected={selected[i] || null} onSelect={p=>setSelected(previous=>[i===0?p:previous[0] || null,i===1?p:previous[1] || null])}/>)}<button className="swap-players" type="button" aria-label={t('Swap players','交换选手')} onClick={()=>setSelected(([a,b])=>[b,a])}><ArrowDownUp size={18}/></button></div>
    {domain==='faceit'&&<div className="compact-controls"><select aria-label={t('Recent matches','近期场次')} value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[5,10,20].map(n=><option key={n} value={n}>{t('Last','最近')} {n} {t('matches','场')}</option>)}</select>{!!maps.length&&<select aria-label={t('Map','地图')} value={activeMap} onChange={e=>setMap(e.target.value)}><option value="all">{t('All maps','全部地图')}</option>{maps.map(m=><option key={m}>{m}</option>)}</select>}<button className="primary-button" type="button" disabled={!valid||loading} onClick={()=>void compare()}>{loading?t('Loading…','读取中…'):t('Compare','对比')}</button></div>}
    {!valid&&<p className="scope-note" role="status">{t('Choose two different players','请选择两名不同选手')}</p>}
    {error&&<p role="status">{t('Could not load players. Try again.','读取失败，请重试。')}</p>}
    <div className="comparison-duel">{[0,1].map(i=>{const p=selected[i],avatar=domain==='faceit'&&current?profiles[i].avatar:p?.avatar;return <div className="duel-side" key={i}>{avatar?<Image src={avatar} width={48} height={48} alt="" className="duel-avatar" unoptimized/>:<span className="duel-monogram">{p?.name.slice(0,2)||'?'}</span>}<span><small>{domain==='events'?p?.team:'FACEIT'}</small><strong>{p?.name || t('Choose player','选择选手')}</strong>{domain==='events'?p?.maps!=null&&<b>{p.maps} {t('maps','图')}</b>:current&&profiles[i].elo!=null&&<b>{fmt(profiles[i].elo,0)} ELO</b>}{domain==='faceit'&&current&&<small>{samples[i].matches} {t('matches','场')}{samples[i].from&&samples[i].to?' · '+samples[i].from.slice(0,10)+' – '+samples[i].to.slice(0,10):''}</small>}</span></div>;})}<span className="duel-vs">VS</span></div>
    {renderTable(rows.filter(row=>!row.secondary))}
    {!!moreRows.length&&<details className="compact-disclosure"><summary>{t('More statistics','更多统计')}<ChevronDown size={14}/></summary>{renderTable(moreRows)}</details>}
    {valid&&(domain==='events'||current)&&!rows.length&&<p className="scope-note">{t('No comparison data available','暂无可对比数据')}</p>}
    {domain==='events'?details?.statsObservedAt&&<p className="scope-note">{details.statsObservedAt.slice(0,10)} {details.statsUrl&&<a href={details.statsUrl} target="_blank" rel="noreferrer">Ensigame <ArrowUpRight size={12}/></a>}</p>:current&&<div className="compare-profile-links">{profiles.map(p=><Link key={p.id} href={'/players/'+encodeURIComponent(p.faceitNickname)+'?lang='+language+'&playerId='+encodeURIComponent(p.id)}>{p.nickname} · {t('Profile','档案')} <ArrowUpRight size={12}/></Link>)}</div>}
  </>;
}
