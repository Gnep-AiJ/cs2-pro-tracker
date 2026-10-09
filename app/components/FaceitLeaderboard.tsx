"use client";
import {useEffect,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useLanguage} from './LanguageProvider';
import {Notice,number,useDate,useResource} from './TrackerWorkspace';
import {topTracked,type TrackedRank,type RankSort} from '../lib/ranking-view';
type Official={items:Array<{player_id:string;nickname:string;position:number;faceit_elo:number|null;country:string|null;game_skill_level?:number;avatar?:string}>;updatedAt:string};
type Tracked={items:TrackedRank[];updatedAt:string;partial:boolean;requested:number};
export default function FaceitLeaderboard(){
 const {t,language}=useLanguage(),date=useDate();
 const [view,setView]=useState<'official'|'tracked'>('official'),[region,setRegion]=useState('EU'),[country,setCountry]=useState(''),[offset,setOffset]=useState(0),[sort,setSort]=useState<RankSort>('elo');
 useEffect(()=>{const params=new URL(location.href).searchParams,requested=params.get('region')?.toUpperCase(),nation=params.get('country')?.toLowerCase();const timer=setTimeout(()=>{if(requested&&['EU','NA','SA','SEA','OCE'].includes(requested))setRegion(requested);if(nation&&/^[a-z]{2}$/.test(nation))setCountry(nation);},0);return()=>clearTimeout(timer);},[]);
 const official=useResource<Official>(view==='official'?`/api/rankings?region=${region}&country=${country}&offset=${offset}`:null);
 const tracked=useResource<Tracked>(view==='tracked'?'/api/faceit/tracked-rankings':null);
 const resource=view==='official'?official:tracked;
 const rows=view==='official'?(official.data?.items||[]).map(p=>({id:p.player_id,name:p.nickname,nickname:p.nickname,team:'',avatar:p.avatar||null,country:p.country,level:p.game_skill_level??null,elo:p.faceit_elo,matches:null,winRate:null,rank:p.position})):topTracked(tracked.data?.items||[],sort).map((p,i)=>({...p,rank:i+1}));
 return <div className="leaderboard">
  <div className="leaderboard-tabs" role="group" aria-label={t('Ranking type','榜单类型')}><button type="button" aria-pressed={view==='official'} onClick={()=>setView('official')}>{t('FACEIT official','FACEIT 官方榜单')}</button><button type="button" aria-pressed={view==='tracked'} onClick={()=>setView('tracked')}>{t('Tracked top 10','收录选手 TOP 10')}</button></div>
  <div className="leaderboard-toolbar"><strong>{view==='official'?`${region} ${t('Rankings','排行榜')}`:t('CS2 lifetime','CS2 生涯数据')}</strong><div>{view==='official'?<><label>{t('Region','赛区')}<select value={region} onChange={e=>{setRegion(e.target.value);setOffset(0);}}>{['EU','NA','SA','SEA','OCE'].map(x=><option key={x}>{x}</option>)}</select></label><label>{t('Country','国家')}<select value={country} onChange={e=>{setCountry(e.target.value);setOffset(0);}}><option value="">{t('All countries','全部国家')}</option>{['cn','ru','ua','kz','kr','us','br'].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label></>:<div className="rank-sort" role="group" aria-label={t('Sort by','排序')} >{(['elo','matches','winRate'] as const).map(key=><button key={key} type="button" aria-pressed={sort===key} onClick={()=>setSort(key)}>{key==='elo'?'ELO':key==='matches'?t('Matches','场次'):t('Win rate','胜率')}</button>)}</div>}</div></div>
  {resource.loading?<Notice loading>{t('Loading rankings…','读取榜单…')}</Notice>:resource.error?<Notice retry={resource.refresh}>{t('Could not load rankings','榜单读取失败')}</Notice>:<>
  <div className="leaderboard-table-wrap"><table className="leaderboard-table"><thead><tr><th>#</th><th>{t('Player','选手')}</th>{view==='official'?<><th className="rank-country">{t('Country','国家')}</th><th>{t('Level','等级')}</th><th>ELO</th></>:<><th>ELO</th><th>{t('Matches','场次')}</th><th>{t('Win rate','胜率')}</th></>}</tr></thead><tbody>{rows.map(p=><tr key={p.id} className={p.rank<=3?'rank-podium rank-'+p.rank:''}><td><span className="rank-number">{p.rank}</span></td><td><Link className="rank-player" href={`/players/${encodeURIComponent(p.nickname)}?playerId=${p.id}&lang=${language}`}>{p.avatar?<Image src={p.avatar} width={40} height={40} alt="" unoptimized/>:<span className="rank-avatar">{p.name.slice(0,2)}</span>}<span><strong>{p.name}</strong>{p.team&&<small>{p.team}</small>}</span></Link></td>{view==='official'?<><td className="rank-country">{p.country?.toUpperCase()||'—'}</td><td>{p.level!=null?<span className={'skill-level level-'+p.level}>{p.level}</span>:'—'}</td><td className="rank-elo">{number(p.elo,0)}</td></>:<><td className={sort==='elo'?'rank-active-number':''}>{number(p.elo,0)}</td><td className={sort==='matches'?'rank-active-number':''}>{number(p.matches,0)}</td><td className={sort==='winRate'?'rank-active-number':''}>{number(p.winRate,0,'%')}</td></>}</tr>)}</tbody></table></div>
  {!rows.length&&<Notice>{t('No ranking entries','暂无榜单记录')}</Notice>}
  {view==='official'&&<div className="compact-pagination"><button type="button" disabled={!offset} onClick={()=>setOffset(x=>Math.max(0,x-50))}>{t('Previous','上一页')}</button><span>{offset/50+1}</span><button type="button" disabled={rows.length<50} onClick={()=>setOffset(x=>x+50)}>{t('Next','下一页')}</button></div>}
  <p className="scope-note">FACEIT · {date(resource.data?.updatedAt,true)}{view==='tracked'&&tracked.data?.partial?' · '+t('Partial update','部分更新'):''}</p></>}
 </div>;
}
