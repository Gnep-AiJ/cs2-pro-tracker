"use client";
import {useRef,useState} from 'react';
import Image from 'next/image';
import {Check,ChevronDown,Search,Trophy,X} from 'lucide-react';
import {useLanguage} from './LanguageProvider';
import {useDate} from './TrackerWorkspace';
import {fuzzyScore,type BigEvent} from '../lib/pro-events';
import snapshot from '../data/pro-events-snapshot.json';

export default function EventChooser({events,value,onSelect}:{events:BigEvent[];value:string;onSelect:(id:string)=>void}) {
  const {t}=useLanguage(),date=useDate();
  const dialog=useRef<HTMLDialogElement>(null),search=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');
  const [calendar,setCalendar]=useState(false);
  const rows=(calendar?snapshot.events:events).filter(event=>!query||fuzzyScore(query,[event.name,event.location||''])>0);
  const [now,setNow]=useState(0);
  const groups=[{key:'running',label:t('Ongoing','进行中'),rows:rows.filter(e=>Date.parse(e.startsAt)<=now&&Date.parse(e.endsAt)>=now)},{key:'upcoming',label:t('Upcoming','即将开始'),rows:rows.filter(e=>Date.parse(e.startsAt)>now)},{key:'past',label:t('Recent results','近半年赛果'),rows:rows.filter(e=>Date.parse(e.endsAt)<now).sort((a,b)=>b.endsAt.localeCompare(a.endsAt))}];
  function open(){setNow(Date.now());setQuery('');dialog.current?.showModal();search.current?.focus();}
  function choose(id:string){onSelect(id);dialog.current?.close();}
  return <>
    <button type="button" className="event-chooser-trigger" onClick={open} aria-haspopup="dialog"><Trophy size={16}/>{t('Change event','选择赛事')}<ChevronDown size={14}/></button>
    <dialog ref={dialog} className="event-picker-dialog" aria-labelledby="event-picker-title" onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className="event-picker-content"><div className="event-picker-heading"><div><h2 id="event-picker-title">{t('Major events','热门赛事')}</h2><p>{calendar?'HLTV · '+t('Calendar saved','日历存档')+' '+date(snapshot.observedAt):events.some(event=>event.provider==='PandaScore')?'PandaScore · S / A':t('Saved events','赛事存档')}</p></div><form method="dialog"><button type="submit" className="picker-close" aria-label={t('Close event selection','关闭赛事选择')}><X size={18}/></button></form></div>
      <div className="event-directory-tabs" role="group" aria-label={t('Event directory','赛事目录')}><button type="button" aria-pressed={!calendar} onClick={()=>{setCalendar(false);setQuery('');}}>{t('Fixtures & results','赛程赛果')}</button><button type="button" aria-pressed={calendar} onClick={()=>{setCalendar(true);setQuery('');}}>HLTV {t('calendar','日历')}</button></div>
      <label className="event-picker-search"><Search size={17}/><input ref={search} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('Search event or city','搜索赛事或举办地')} aria-label={t('Search events','搜索赛事')} maxLength={60}/></label>
      <div className="event-picker-results">{groups.filter(group=>group.rows.length).map(group=><section className={'event-group '+group.key} key={group.key}><h3>{group.label}<small>{group.rows.length}</small></h3>{group.rows.map(event=>{const content=<>{event.logo?<Image src={event.logo} alt="" width={36} height={36} unoptimized/>:<Trophy size={28}/>}<span><strong>{event.name}</strong><small>{date(event.startsAt)} – {date(event.endsAt)}{event.location?` · ${event.location}`:''}</small></span>{!calendar&&value===event.id?<Check size={17}/>:null}</>;return calendar?<a key={event.id} className="event-choice" href={event.sourceUrl} target="_blank" rel="noreferrer">{content}<span aria-hidden="true">↗</span></a>:<button type="button" key={event.id} className={`event-choice ${value===event.id?'is-selected':''}`} aria-pressed={value===event.id} onClick={()=>choose(event.id)}>{content}</button>;})}</section>)}{!rows.length&&<p className="picker-empty">{t('No matching event. Try another name.','未找到赛事，试试其他名称。')}</p>}</div>
      </div>
    </dialog>
  </>;
}
