"use client";
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowDownUp,ArrowLeft,ArrowRight,ArrowUpRight,ChevronDown,Network,ShieldCheck,SlidersHorizontal,Trophy} from 'lucide-react';
import {useLanguage} from './LanguageProvider';
import {useResource,Notice,number,useDate} from './TrackerWorkspace';
import PlayerSearch,{type PlayerCandidate} from './PlayerSearch';
import snapshot from '../data/pro-lab-snapshot.json';
import events from '../data/pro-events-snapshot.json';
import {fuzzyScore,type EventPlayer} from '../lib/pro-events';
import {rankLab,summarizeLab,type LabFeed,type LabMetric,type LabPlayer,type Pair} from '../lib/pro-lab';
const initial=snapshot as LabFeed;
type MetricSpec=[LabMetric,string,number,string,'core'|'impact'|'support'];
function metricSpecs(t:(en:string,zh:string)=>string):MetricSpec[]{return [
  ['rating','FACEIT Rating',2,'','core'],['adr','ADR',1,'','core'],['kd','K/D',2,'','core'],['kr','K/R',2,'','core'],['winRate',t('Win rate','胜率'),1,'%','core'],
  ['swing','Round Swing',2,'%','impact'],['firstKills',t('Opening kills','首杀'),1,'','impact'],['entrySuccess',t('Entry success','破点成功率'),1,'%','impact'],['clutchSuccess',t('1v1 / 1v2 wins','残局成功率'),1,'%','impact'],['multiKills',t('Multi-kill rounds','多杀回合'),1,'','impact'],
  ['utilityAdr',t('Utility ADR','道具 ADR'),1,'','support'],['enemiesFlashed',t('Enemies flashed','致盲敌人'),1,'','support'],['headshots',t('Headshots','爆头率'),1,'%','support'],['kills',t('Kills / match','场均击杀'),1,'','support']
];}
const portrait=(p:LabPlayer)=>events.details['8244'].players.find(e=>e.id===p.eventPlayerId)?.avatar || null;
const candidate=(p:LabPlayer):PlayerCandidate=>({id:p.id,name:p.name,lookup:p.lookup,team:p.directoryTeam,avatar:portrait(p),maps:null,verified:true});
function Identity({player,rank}:{player:LabPlayer;rank?:number}) {
  const avatar=portrait(player);
  return <span className="lab-identity">{rank!=null&&<b className={`lab-rank ${rank<=3?'top':''}`}>{String(rank).padStart(2,'0')}</b>}{avatar?<Image src={avatar} width={36} height={36} alt="" unoptimized/>:<span className="directory-avatar">{player.name.slice(0,1)}</span>}<span><strong>{player.name}</strong>{player.directoryTeam&&<small>{player.directoryTeam}</small>}</span></span>;
}
function MatchEvidence({pair,players}:{pair:Pair;players:LabPlayer[]}) {
  const {t,language}=useLanguage(),date=useDate(),p=players.find(p=>p.id===pair.ids[0]);
  return <div className="pair-evidence"><p className="scope-note">{t('Latest observed shared matches · each match counted once','最近公开同局记录 · 每场仅计一次')}</p>{pair.matches.map(m=><Link key={m.id} href={`/players/${encodeURIComponent(p?.lookup||'player')}/matches/${encodeURIComponent(m.id)}?playerId=${pair.ids[0]}&lang=${language}`}><span className={`pair-kind ${m.kind}`}>{m.kind==='together'?t('Same side','同队'):t('Opposite sides','对手')}</span><time>{date(m.playedAt,true)}</time><span>{m.map||t('Map pending','地图待补')}</span><ArrowUpRight size={12}/></Link>)}</div>;
}
function LabDuel({players,pairs,ids,limit,map,outcome,since}:{players:LabPlayer[];pairs:Pair[];ids:string[];limit:number;map:string;outcome:string;since:string|null}) {
  const {t}=useLanguage();const rows=ids.map(id=>players.find(p=>p.id===id)).filter((p):p is LabPlayer=>!!p);
  if(rows.length!==2||ids[0]===ids[1])return <Notice>{t('Choose two different collected players','请选择两名不同的收录选手')}</Notice>;
  const sums=rows.map(p=>summarizeLab(p.samples,limit,map,outcome,since));
  const metrics=metricSpecs(t).filter(([metric])=>sums.every(sum=>sum[metric].value!=null&&sum[metric].n>0));
  const pair=pairs.find(p=>ids.every(id=>p.ids.includes(id)));
  return <>
    <div className="lab-duel-head">{rows.map((p,i)=><div key={p.id}><Identity player={p}/><span>{sums[i].matches} {t('matches','场')} · {sums[i].from?.slice(0,10)||'—'} – {sums[i].to?.slice(0,10)||'—'}</span></div>)}<b>VS</b></div>
    {metrics.length?<div className="bounded-table"><table className="lab-comparison-table"><thead><tr><th>{t('Metric','指标')}</th>{rows.map(p=><th key={p.id}>{p.name}</th>)}</tr></thead><tbody>{metrics.map(([metric,label,digits,suffix])=>{const maximum=Math.max(1,...sums.map(s=>Math.abs(s[metric].value||0)));return <tr key={metric}><th>{label}</th>{sums.map((s,i)=><td key={i}><b>{number(s[metric].value,digits,suffix)}</b><small>{s[metric].n} {t('matches','场')}</small><span className={`lab-meter side-${i}`}><i style={{width:`${Math.abs(s[metric].value||0)/maximum*100}%`}}/></span></td>)}</tr>;})}</tbody></table></div>:<Notice>{t('No comparison data for this selection','当前筛选暂无对比数据')}</Notice>}
    {pair?<details className="compact-disclosure lab-pair-summary"><summary><Network size={15}/>{t('Public overlap','公开同局')} <b>{pair.together} {t('same-side','同队')} / {pair.against} {t('opponents','对手')}</b><ChevronDown size={13}/></summary><MatchEvidence pair={pair} players={players}/></details>:<p className="scope-note">{t('No shared match observed in this collection','当前采集未观测到共同比赛')}</p>}
  </>;
}
export default function ProLab({query='',eventPlayers,compact=false,discovery=false,initialView='board',showNavigation=true}:{query?:string;eventPlayers?:EventPlayer[];compact?:boolean;discovery?:boolean;initialView?:string;showNavigation?:boolean}) {
  const {t,language}=useLanguage(),date=useDate();
  const resource=useResource<LabFeed>('/api/faceit/lab',initial),feed=resource.data || initial;
  const [view,setView]=useState(compact?'network':initialView),[metric,setMetric]=useState<LabMetric>('adr'),[limit,setLimit]=useState(20),[map,setMap]=useState('all'),[minimum,setMinimum]=useState(5),[outcome,setOutcome]=useState('all'),[count,setCount]=useState(5),[kind,setKind]=useState('against'),[days,setDays]=useState(30);
  const players=useMemo(()=>eventPlayers?feed.players.filter(p=>eventPlayers.some(e=>e.id===p.eventPlayerId)):feed.players,[eventPlayers,feed.players]);
  const collection=useMemo(()=>players.map(candidate),[players]);
  const [selected,setSelected]=useState<Array<PlayerCandidate|null>>(players.slice(0,2).map(candidate));
  const [anchor,setAnchor]=useState<PlayerCandidate|null>(null);
  useEffect(()=>{if(!showNavigation&&initialView!=='duel')return;const params=new URL(location.href).searchParams,ids=[params.get('a'),params.get('b')];if(ids.every(Boolean)&&ids[0]!==ids[1]){const rows=ids.map(id=>players.find(p=>p.id===id));if(rows.every(Boolean)){const timer=setTimeout(()=>{setSelected(rows.map(p=>candidate(p!)));setView('duel');},0);return()=>clearTimeout(timer);}}},[players,showNavigation,initialView]);
  const maps=[...new Set(players.flatMap(p=>p.samples.flatMap(s=>s.map?[s.map]:[])))].sort();
  const since=days?new Date(Date.parse(feed.observedAt)-days*86400000).toISOString():null;
  const summaries=players.map(player=>summarizeLab(player.samples,limit,map,outcome,since));
  const specs=metricSpecs(t).filter(([key])=>summaries.some(summary=>summary[key].value!=null&&summary[key].n>0));
  const activeMetric=specs.some(spec=>spec[0]===metric)?metric:specs[0]?.[0]||'adr';
  const [,label,digits,suffix]=specs.find(spec=>spec[0]===activeMetric)||metricSpecs(t).find(spec=>spec[0]==='adr')!;
  const rankings=rankLab(players,activeMetric,limit,map,minimum,outcome,since),rows=rankings.filter(r=>fuzzyScore(query,[r.player.name,r.player.directoryTeam,r.player.lookup])>0);
  const ids=new Set(players.map(p=>p.id));
  const pairs=feed.pairs.filter(p=>p.ids.every(id=>ids.has(id))&&p[kind as 'together'|'against']>0&&(!anchor||p.ids.includes(anchor.id))&&(!query||p.ids.some(id=>{const p=players.find(p=>p.id===id)!;return fuzzyScore(query,[p.name,p.lookup,p.directoryTeam])>0;}))).sort((a,b)=>b[kind as 'together'|'against']-a[kind as 'together'|'against']||b.lastAt.localeCompare(a.lastAt)||a.ids.join().localeCompare(b.ids.join()));
  function compare(a:LabPlayer,b?:LabPlayer){const other=b||players.find(p=>p.id!==a.id);setSelected([candidate(a),other?candidate(other):null]);setView('duel');const url=new URL(location.href);url.searchParams.set('a',a.id);if(other)url.searchParams.set('b',other.id);history.replaceState(history.state,'',url);}
  function switchView(next:string){setView(next);setCount(5);const url=new URL(location.href);url.searchParams.delete('a');url.searchParams.delete('b');url.searchParams.set('view',next);url.searchParams.set('section',next==='duel'?'compare':'rankings');history.replaceState(history.state,'',url);}
  return <div className={`pro-lab ${compact?'is-compact':''}`}>
    {!compact&&!discovery&&<div className="lab-board-caption"><strong>{t('Player performance','选手表现')}</strong><span>{players.length} {t('players','名选手')}</span></div>}
    {showNavigation?<div className="lab-nav segmented">{[['board',t('Recent performance','近期表现'),Trophy],['duel',t('Compare players','选手对比'),ArrowDownUp],['network',t('Shared matches','同局记录'),Network]].map(([id,name,Icon])=><button key={String(id)} type="button" aria-pressed={view===id} onClick={()=>switchView(String(id))}>{typeof Icon!=='string'&&<Icon size={14}/>} {String(name)}</button>)}</div>:view!==initialView&&<button type="button" className="secondary-button" onClick={()=>switchView(initialView)}><ArrowLeft size={14}/>{t('Back','返回')}</button>}
    {view!=='network'&&<details className="filter-drawer"><summary><SlidersHorizontal size={15}/>{t('Filters','筛选')}<span>{days?`${days} ${t('days','天')}`:t('Any date','不限日期')} · {limit} {t('matches','场')} · {map==='all'?t('All maps','全部地图'):map}</span><ChevronDown size={14}/></summary><div className="lab-filters compact-controls"><select aria-label={t('Statistics period','统计日期')} value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,0].map(n=><option key={n} value={n}>{n?`${t('Last','近')} ${n} ${t('days','天')}`:t('Any date','不限日期')}</option>)}</select><select aria-label={t('Match window','场次窗口')} value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[5,10,20].map(n=><option key={n} value={n}>{t('Last','最近')} {n} {t('matches','场')}</option>)}</select><select aria-label={t('Map','地图')} value={map} onChange={e=>setMap(e.target.value)}><option value="all">{t('All maps','全部地图')}</option>{maps.map(m=><option key={m}>{m}</option>)}</select><select aria-label={t('Match outcome','胜负筛选')} value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="all">{t('All outcomes','全部胜负')}</option><option value="W">{t('Wins','获胜场')}</option><option value="L">{t('Losses','失利场')}</option></select>{view==='board'&&<select aria-label={t('Minimum metric sample','指标样本门槛')} value={minimum} onChange={e=>setMinimum(Number(e.target.value))}>{[5,10].map(n=><option key={n} value={n}>{t('At least','至少')} {n} {t('samples','个样本')}</option>)}</select>}</div></details>}
    {view==='board'&&<>
      {!!specs.length&&<div className="compact-controls"><label>{t('Rank by','排行指标')} <select aria-label={t('Rank by','排行指标')} value={activeMetric} onChange={e=>{setMetric(e.target.value as LabMetric);setCount(5);}}>{specs.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>}
      <div className="lab-board-caption"><span><Trophy size={13}/> {label}</span><span>{rankings.length} {t('players','名选手')} · {t('at least','至少')} {minimum} {t('matches','场')}</span></div>
      <div className="lab-table-heading"><span>{t('Rank / player','排名 / 选手')}</span><span>{label}</span><span>{t('Matches','场次')}</span><span aria-hidden="true"/></div>
      {rows.slice(0,count).map(row=><details className="lab-ranked-row" key={row.player.id} name="lab-ranked-player"><summary><Identity player={row.player} rank={row.rank}/><span className="lab-rank-value"><b>{number(row.summary[activeMetric].value,digits,suffix)}</b><span className="lab-meter"><i style={{width:`${Math.abs(row.summary[activeMetric].value||0)/Math.max(1,...rankings.map(r=>Math.abs(r.summary[activeMetric].value||0)))*100}%`}}/></span></span><small className="lab-sample">{row.summary[activeMetric].n} {t('matches','场')}</small><ChevronDown size={14}/></summary><div className="lab-row-expanded"><div className="lab-mini-metrics">{row.summary.adr.value!=null&&<span>ADR <b>{number(row.summary.adr.value)}</b></span>}{row.summary.kd.value!=null&&<span>K/D <b>{number(row.summary.kd.value,2)}</b></span>}{row.summary.headshots.value!=null&&<span>HS% <b>{number(row.summary.headshots.value,1,'%')}</b></span>}{row.summary.winRate.value!=null&&<span>{t('Win rate','胜率')} <b>{number(row.summary.winRate.value,1,'%')}</b></span>}</div><div className="compact-controls">{showNavigation?<button type="button" className="primary-button" onClick={()=>compare(row.player)}><ArrowDownUp size={14}/>{t('Compare player','对比此选手')}</button>:<Link className="primary-button" href={'/faceit?section=compare&player='+encodeURIComponent(row.player.lookup)+'&lang='+language}><ArrowDownUp size={14}/>{t('Compare player','对比此选手')}</Link>}<Link className="secondary-button" href={`/players/${encodeURIComponent(row.player.lookup)}?playerId=${row.player.id}&lang=${language}`}>{t('Profile','档案')} <ArrowUpRight size={13}/></Link><small>{t('Collected','采集')} {date(row.player.checkedAt,true)}</small></div><span className="scope-note">{row.summary.from?.slice(0,10)||'—'} – {row.summary.to?.slice(0,10)||'—'}</span></div></details>)}
      {!rows.length&&<div className="fixture-empty-inline"><Trophy size={20}/><span>{t('No players in this selection','当前筛选暂无选手')}</span><button type="button" className="secondary-button" onClick={()=>{setMap('all');setLimit(20);setMinimum(5);setOutcome('all');setDays(30);}}>{t('Reset filters','重置筛选')}</button></div>}
      {rows.length>count&&<button className="more-button" type="button" onClick={()=>setCount(n=>n+10)}>{t('Show more','显示更多')} <ChevronDown size={13}/></button>}
    </>}
    {view==='network'&&<>
      <div className="compact-controls"><div className="segmented"><button type="button" aria-pressed={kind==='against'} onClick={()=>setKind('against')}>{t('Opponents','对手交集')}</button><button type="button" aria-pressed={kind==='together'} onClick={()=>setKind('together')}>{t('Same side','同队交集')}</button></div><span>{pairs.length} {t('pairs','组')}</span></div>
      <PlayerSearch domain="faceit" collection={collection} label={t('Focus a collected player','聚焦收录选手')} selected={anchor} onSelect={setAnchor}/>
      {pairs.slice(0,count).map(pair=>{const [a,b]=pair.ids.map(id=>players.find(p=>p.id===id)!);const value=pair[kind as 'together'|'against'],maximum=pairs[0]?.[kind as 'together'|'against']||1;return <details className="lab-pair-row" name="lab-pair" key={pair.ids.join()}><summary><span className="lab-pair-names"><strong>{a.name}</strong><span className={`pair-connector ${kind}`}><i/><Network size={15}/><i/></span><strong>{b.name}</strong></span><span className="lab-rank-value"><b>{value}<small> {t('matches','场')}</small></b><span className={`lab-meter ${kind==='against'?'side-1':''}`}><i style={{width:`${value/maximum*100}%`}}/></span></span><ChevronDown size={13}/></summary><div className="lab-row-expanded"><div className="compact-controls"><span>{pair.together} {t('same-side','同队')} · {pair.against} {t('opponents','对手')}</span><button type="button" className="primary-button" onClick={()=>compare(a,b)}><ArrowDownUp size={13}/>{t('Compare this pair','对比这组')}</button></div><MatchEvidence pair={pair} players={players}/></div></details>;})}
      {!pairs.length&&<Notice>{t('No overlap observed for this selection','当前筛选未观测到公开交集')}</Notice>}
      {pairs.length>count&&<button type="button" className="more-button" onClick={()=>setCount(n=>n+10)}>{t('Show more','显示更多')} <ChevronDown size={13}/></button>}
      <p className="scope-note">{t('Same-side and opponent records','同队与对手按比赛阵营统计')}</p>
    </>}
    {view==='duel'&&<><div className="personal-compare-picker">{[0,1].map(i=><PlayerSearch key={i} domain="faceit" collection={collection} label={`${t('Collected player','收录选手')} ${i+1}`} selected={selected[i]||null} onSelect={p=>setSelected(old=>[i===0?p:old[0]||null,i===1?p:old[1]||null])}/>)}<button type="button" className="swap-players" aria-label={t('Swap players','交换选手')} onClick={()=>setSelected(([a,b])=>[b,a])}><ArrowDownUp size={16}/></button></div><LabDuel players={players} pairs={feed.pairs} ids={selected.flatMap(p=>p?[p.id]:[])} limit={limit} map={map} outcome={outcome} since={since}/><Link className="secondary-button" href={`/faceit?lang=${language}&section=compare&scope=public`}>{t('Compare any FACEIT account','对比任意 FACEIT 账号')} <ArrowRight size={13}/></Link></>}
    <div className="lab-source-line"><ShieldCheck size={13}/><span>FACEIT · {date(feed.observedAt,true)}{feed.stale?` · ${t('Saved','存档')}`:''}</span>{resource.error&&<button type="button" onClick={resource.refresh}>{t('Refresh','刷新')}</button>}</div>
  </div>;
}
