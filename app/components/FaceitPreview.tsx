"use client";
import Link from 'next/link';
import {ArrowUpRight,Gamepad2} from 'lucide-react';
import {useLanguage} from './LanguageProvider';
import {number,useResource} from './TrackerWorkspace';
import {rankLab,type LabFeed} from '../lib/pro-lab';
import snapshot from '../data/pro-lab-snapshot.json';

export default function FaceitPreview(){
  const {t,language}=useLanguage();
  const resource=useResource<LabFeed>('/api/faceit/lab',snapshot as LabFeed),feed=resource.data||snapshot as LabFeed;
  const since=new Date(Date.parse(feed.observedAt)-30*86400000).toISOString();
  const rows=rankLab(feed.players,'adr',20,'all',5,'all',since).slice(0,3);
  return <section className="faceit-preview"><div className="reading-block-heading"><div><h2><Gamepad2 size={17}/>{t('Pro players on FACEIT','职业选手 FACEIT 近况')}</h2><p>{t('Recent damage leaders · separate from event statistics','近期伤害表现 · 与赛事统计分开')}</p></div><Link href={`/faceit?lang=${language}`}>{t('Explore players','查看选手')}<ArrowUpRight size={15}/></Link></div><div className="pulse-rows">{rows.map(row=><Link key={row.player.id} href={`/players/${encodeURIComponent(row.player.lookup)}?lang=${language}&playerId=${row.player.id}`}><span><strong>{row.player.name}</strong><small>{row.player.directoryTeam}</small></span><span><b>{number(row.summary.adr.value)}</b><small>ADR · {row.summary.adr.n} {t('matches','场')}</small></span><ArrowUpRight size={14}/></Link>)}</div></section>;
}
