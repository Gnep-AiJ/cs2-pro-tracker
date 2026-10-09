"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownUp, ArrowLeft, ArrowUpRight, ChevronDown, RefreshCw, Activity, Crosshair, Flag, Globe2, History, Map, Shield, Swords, Target, Trophy, Users } from "lucide-react";
import { useState } from "react";
import MapBadge from "./MapBadge";
import SiteHeader from "./SiteHeader";
import PerformanceChart from "./PerformanceChart";
import { useLanguage } from "./LanguageProvider";
import { MatchRows, Notice, number, useDate, useResource } from "./TrackerWorkspace";
import type { PlayerProfile } from "../lib/tracker-types";
import {summarizeLab} from '../lib/pro-lab';
import {recentFormChange} from '../lib/profile-archive';

const hasNumber=(value:number|null|undefined):value is number=>value!=null&&Number.isFinite(value);
type ProfileMetric={label:string;value:number|null|undefined;digits?:number;suffix?:string;count?:number};
export default function CompactPlayerDetail({ nickname,playerId }: { nickname: string;playerId?:string }) {
  const { language, t } = useLanguage();
  const resource = useResource<{ player: PlayerProfile; updatedAt?: string }>('/api/players/'+encodeURIComponent(nickname)+(playerId?'?playerId='+encodeURIComponent(playerId):''));
  const player = resource.data?.player;
  const [count, setCount] = useState(10);
  const [windowSize, setWindowSize] = useState(10);
  const date = useDate();
  const matches = (player?.recentMatches || []).slice(0, windowSize);
  const sample=summarizeLab(matches,windowSize);
  const trend=recentFormChange(player?.recentMatches || []);
  const maps = [...new Set(matches.flatMap(match => match.map ? [match.map] : []))].map(map => ({ map, sample: summarizeLab(matches, windowSize, map) }));
  const mainMetrics:ProfileMetric[]=[
    {label:'ELO',value:player?.elo,digits:0},
    {label:t('Region rank','区域排名')+(player?.ranking.region?' · '+player.ranking.region:''),value:player?.ranking.regionPosition,digits:0},
    {label:t('Win rate','胜率'),value:sample.winRate.value,digits:0,suffix:'%'},
    {label:'K/D',value:sample.kd.value,digits:2,count:sample.kd.n},
    {label:'ADR',value:sample.adr.value,count:sample.adr.n},
  ];
  const detailedMetrics:ProfileMetric[]=[
    {label:'K/R',value:sample.kr.value,digits:2,count:sample.kr.n},{label:'HS%',value:sample.headshots.value,suffix:'%',count:sample.headshots.n},
    {label:'FACEIT Rating',value:sample.rating.value,digits:2,count:sample.rating.n},{label:'Round Swing',value:sample.swing.value,digits:2,suffix:'%',count:sample.swing.n},
    {label:t('Entry success','破点成功率'),value:sample.entrySuccess.value,suffix:'%',count:sample.entrySuccess.n},
    {label:t('Clutch success','残局成功率'),value:sample.clutchSuccess.value,suffix:'%',count:sample.clutchSuccess.n},
    {label:t('Utility ADR','道具 ADR'),value:sample.utilityAdr.value,count:sample.utilityAdr.n},
    {label:t('Enemies flashed','致盲敌人'),value:sample.enemiesFlashed.value,count:sample.enemiesFlashed.n},
  ].filter(metric=>hasNumber(metric.value));
  const careerMetrics:ProfileMetric[]=[
    {label:t('Matches','总场次'),value:player?.lifetime.matches,digits:0},{label:t('Win rate','胜率'),value:player?.lifetime.winRate,suffix:'%'},
    {label:t('Average K/D','平均 K/D'),value:player?.lifetime.averageKd,digits:2},{label:'HS%',value:player?.lifetime.averageHeadshots,suffix:'%'},
    {label:'ADR',value:player?.lifetime.adr},{label:t('Longest streak','最长连胜'),value:player?.lifetime.longestWinStreak,digits:0},
  ].filter(metric=>hasNumber(metric.value));
  const chartAvailable=matches.some(match=>['adr','kd','kr','headshots','rating','swing'].some(key=>hasNumber(match[key as keyof typeof match] as number|null|undefined)));
  const mapColumns=[['winRate',t('Win rate','胜率'),0,'%'],['kd','K/D',2,''],['adr','ADR',1,'']] as const;
  const availableMapColumns=mapColumns.filter(([key])=>maps.some(row=>row.sample[key].value!=null));
  return <div className="site-shell compact-shell compact-profile"><SiteHeader activeHref="/faceit" status="FACEIT" /><main className="workspace-main">
    <Link className="compact-back" href={'/faceit?lang='+language}><ArrowLeft size={13} />FACEIT</Link>
    <div className="profile-body"><aside className="profile-identity-panel"><div className="profile-banner" aria-hidden="true"><span>CS2</span></div><div className="profile-heading"><div>{player?.avatar ? <Image unoptimized width={96} height={96} className="profile-avatar" src={player.avatar} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} /> : <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">{(player?.nickname || nickname).slice(0,2).toUpperCase()}</span>}<span><span className="eyebrow">FACEIT</span><h1>{player?.nickname || nickname}</h1>{player?.team&&<small>{player.team}</small>}{player?.faceitNickname&&player.faceitNickname!==player.nickname&&<small>{player.faceitNickname}</small>}</span></div></div><div className="profile-badges">{player?.level!=null&&<span className={'skill-level level-'+player.level}>{player.level}</span>}{player?.country&&<span className="profile-country"><Flag size={13}/>{player.country.toUpperCase()}</span>}{player?.ranking.region&&<span className="profile-region"><Globe2 size={13}/>{player.ranking.region}</span>}</div><div className="profile-identity-actions"><Link className="secondary-button" href={'/faceit?section=compare&scope=public&player='+encodeURIComponent(nickname)+'&lang='+language}><ArrowDownUp size={14} />{t("Compare", "对比")}</Link>{player&&<a className="lookup-link" href={'https://www.faceit.com/'+(language === "zh" ? "zh" : "en")+'/players/'+encodeURIComponent(player.faceitNickname)} target="_blank" rel="noreferrer">FACEIT <ArrowUpRight size={13} /></a>}</div>{resource.data?.updatedAt&&<p className="scope-note">{t('Updated','更新')} · {date(resource.data.updatedAt,true)}</p>}</aside><div className="profile-main-panel">
    {resource.loading ? <Notice loading>{t("Loading profile…", "读取档案…")}</Notice> : resource.error || !player ? <Notice retry={resource.refresh}>{t("Profile unavailable", "档案暂不可用")}</Notice> : <>
      <div className="workspace-surface profile-surface"><div className="profile-controls"><span>{t("Recent matches", "近期对局")}</span><div className="segmented">{[5, 10, 20].map(size => <button type="button" key={size} aria-pressed={windowSize === size} onClick={() => setWindowSize(size)}>{size} {t("matches", "场")}</button>)}</div><button type="button" className="icon-button" onClick={resource.refresh} aria-label={t("Refresh", "刷新")}><RefreshCw size={14} /></button></div>
      <dl className="profile-metrics">{mainMetrics.filter(metric=>hasNumber(metric.value)).map(metric=><div key={metric.label}><dt>{metric.label==='ELO'?<Shield size={13}/>:metric.label==='K/D'?<Crosshair size={13}/>:metric.label==='ADR'?<Target size={13}/>:<Trophy size={13}/>}{metric.label}{metric.count!=null&&<small> {metric.count} {t('matches','场')}</small>}</dt><dd>{metric.label.startsWith(t('Region rank','区域排名'))?'#':''}{number(metric.value,metric.digits??1,metric.suffix||'')}</dd></div>)}</dl>
      <div className="profile-form-strip"><span><Swords size={14}/>{matches.filter(m=>m.result==='W').length} {t('wins','胜')}<i>/</i>{matches.filter(m=>m.result==='L').length} {t('losses','负')}</span><div className="form-dots" aria-label={t('Recent results, newest first','近期胜负，左侧为最新')}>{matches.slice(0,10).map(m=><i key={m.id} title={date(m.playedAt)} className={m.result==='W'?'win':m.result==='L'?'loss':'unknown'}>{m.result==='W'?t('W','胜'):m.result==='L'?t('L','负'):'—'}</i>)}</div></div><p className="scope-note">{sample.matches} {t("matches", "场")}{sample.from&&sample.to?' · '+date(sample.from)+' – '+date(sample.to):''}</p>
      <details open className="compact-disclosure"><summary><span className="profile-section-label"><History size={16}/>{t("Match history", "对局记录")}</span><ChevronDown size={14} /></summary>{matches.length?<><MatchRows player={player} matches={matches.slice(0,count)} />{count<matches.length&&<button className="more-button" type="button" onClick={()=>setCount(value=>value+10)}>{t("Show more", "加载更多")}</button>}</>:<Notice>{t('No recent matches','暂无近期对局')}</Notice>}</details>
      {chartAvailable&&<details className="compact-disclosure"><summary><span className="profile-section-label"><Activity size={16}/>{t("Match performance", "逐场表现")}</span><ChevronDown size={14}/></summary><PerformanceChart matches={matches}/>{(trend.adr!=null||trend.kr!=null)&&<div className="form-change"><span>{t('Last 5 vs previous 5','近 5 场 vs 前 5 场')}</span>{trend.adr!=null&&<b className={trend.adr>=0?'positive':'negative'}>ADR {trend.adr>=0?'+':''}{trend.adr.toFixed(1)}</b>}{trend.kr!=null&&<b className={trend.kr>=0?'positive':'negative'}>K/R {trend.kr>=0?'+':''}{trend.kr.toFixed(2)}</b>}</div>}</details>}
      {!!detailedMetrics.length&&<details className="compact-disclosure"><summary><span className="profile-section-label"><Crosshair size={16}/>{t("More statistics", "更多统计")}</span><ChevronDown size={14} /></summary><dl className="profile-career">{detailedMetrics.map(metric=><div key={metric.label}><dt>{metric.label}{metric.count!=null&&<small> · {metric.count} {t('matches','场')}</small>}</dt><dd>{number(metric.value,metric.digits??1,metric.suffix||'')}</dd></div>)}</dl>{player.archive&&matches.some(match=>match.advancedArchiveFields?.length)&&<p className="scope-note">{t('Saved statistics','统计存档')} · {date(player.archive.observedAt,true)}</p>}</details>}
      {!!maps.length&&<details className="compact-disclosure"><summary><span className="profile-section-label"><Map size={16}/>{t("Maps", "地图")}</span><ChevronDown size={14} /></summary><div className="bounded-table"><table><thead><tr><th>{t("Map", "地图")}</th><th>{t("Matches", "场次")}</th>{availableMapColumns.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{maps.map(({ map, sample: stats }) => <tr key={map}><td><MapBadge map={map} compact/></td><td>{stats.matches}</td>{availableMapColumns.map(([key,,digits,suffix])=><td key={key}>{stats[key].value!=null?number(stats[key].value,digits,suffix):null}</td>)}</tr>)}</tbody></table></div></details>}
      {!!careerMetrics.length&&<details className="compact-disclosure"><summary><span className="profile-section-label"><Trophy size={16}/>{t("Career", "生涯")}</span><ChevronDown size={14} /></summary><dl className="profile-career">{careerMetrics.map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd>{number(metric.value,metric.digits??1,metric.suffix||'')}</dd></div>)}</dl></details>}
      {!!player.frequentTeammates.length&&<details className="compact-disclosure"><summary><span className="profile-section-label"><Users size={16}/>{t("Frequent teammates", "常见队友")}</span><ChevronDown size={14} /></summary><dl className="profile-career">{player.frequentTeammates.map(item => <div key={item.id || item.nickname}><dt>{item.nickname}</dt><dd>{item.matches} {t("matches", "场")} · {item.winRate}%</dd></div>)}</dl></details>}
      </div>
    </>}
    </div></div>
  </main></div>;
}
