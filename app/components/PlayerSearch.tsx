"use client";
import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { Search, Check, X } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import {fuzzyScore} from '../lib/pro-events';
export type PlayerCandidate={id:string;name:string;lookup:string;team:string;avatar:string|null;maps:number|null;verified:boolean};
export default function PlayerSearch({domain,eventId='8244',label,selected,onSelect,collection}:{domain:'events'|'faceit';eventId?:string;label:string;selected:PlayerCandidate|null;onSelect:(player:PlayerCandidate|null)=>void;collection?:PlayerCandidate[]}) {
  const {t}=useLanguage(),id=useId();
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[items,setItems]=useState<PlayerCandidate[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false),[partial,setPartial]=useState(false);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      setLoading(true);setError(false);setPartial(false);
      if(collection){setItems(collection.map(p=>({...p,score:fuzzyScore(query,[p.name,p.lookup,p.team])})).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,10));setLoading(false);return;}
      void fetch(`/api/search/players?domain=${domain}&event=${eventId}&q=${encodeURIComponent(query)}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('search_unavailable');const d=await r.json() as {items:PlayerCandidate[];partial?:boolean};if(!controller.signal.aborted){setItems(d.items);setPartial(!!d.partial);}}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    },220);
    return()=>{clearTimeout(timer);controller.abort();};
  },[domain,eventId,query,open,collection]);
  return <div className="player-picker"><label htmlFor={id}>{label}</label><div className="player-picker-input"><Search size={16}/><input id={id} type="search" maxLength={40} value={open?query:selected?.name || ''} placeholder={t('Player or FACEIT nickname','选手名或 FACEIT 昵称')} onFocus={()=>{setOpen(true);setQuery('');setLoading(true);setItems([]);setError(false);}} onChange={e=>{setQuery(e.target.value);setOpen(true);setLoading(true);setItems([]);setError(false);onSelect(null);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}} aria-controls={`${id}-choices`}/>{selected && !open?<Check size={16}/>:<button type="button" aria-label={t('Close search','关闭搜索')} onClick={()=>setOpen(false)}><X size={14}/></button>}</div>
    {selected&&!open&&<small className="picker-context">{selected.team} · {domain==='events'?t('Event roster','赛事阵容'):selected.verified?t('Verified pro','核验职业选手'):'FACEIT'}</small>}
    {open&&<div className="player-picker-results" id={`${id}-choices`} role="group" aria-label={t('Player candidates','候选选手')}><div className="picker-caption">{loading?t('Searching…','搜索中…'):error?t('Search unavailable · retry by typing','搜索失败 · 修改输入重试'):partial?t('Some search results are unavailable','部分搜索结果暂不可用'):t('Choose a player','选择选手')}</div>{!loading&&!error&&!items.length&&<p>{partial?t('Try again shortly','请稍后重试'):t('No player found · try the FACEIT nickname','未找到选手，可尝试 FACEIT 昵称')}</p>}{items.map(p=><button key={p.id} type="button" onClick={()=>{onSelect(p);setOpen(false);}}>{p.avatar?<Image src={p.avatar} alt="" width={30} height={30} unoptimized/>:<span className="directory-avatar">{p.name.slice(0,1)}</span>}<span><strong>{p.name}</strong><small>{p.team} {domain==='events'&&p.maps!=null?`· ${p.maps} ${t('maps','图')}`:''}</small></span>{p.verified&&<Check size={13}/>}</button>)}</div>}
  </div>;
}
