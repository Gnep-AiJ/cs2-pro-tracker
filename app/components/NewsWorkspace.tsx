"use client";
import {useState} from 'react';
import Image from 'next/image';
import {ArrowUpRight,Newspaper} from 'lucide-react';
import SiteHeader from './SiteHeader';
import {useLanguage} from './LanguageProvider';
import {Notice,useResource,useDate} from './TrackerWorkspace';
type Item={id:string;title:string;originalTitle?:string;description:string;publishedAt:string|null;source:string;sourceUrl?:string;url?:string;image:string|null;category:string};
type Feed={items:Item[];updatedAt:string;warning?:string};
export default function NewsWorkspace(){
 const {t,language}=useLanguage(),date=useDate(),resource=useResource<Feed>('/api/news');
 const [source,setSource]=useState('all'),[limit,setLimit]=useState(12);
 const items=resource.data?.items||[],sources=[...new Set(items.map(item=>item.source))];
 const rows=items.filter(item=>source==='all'||item.source===source);
 return <div className="site-shell compact-shell news-shell"><SiteHeader activeHref="/news" status="CS2" onRefresh={resource.refresh} refreshing={resource.loading} refreshLabel={t('Refresh news','刷新动态')}/><main className="workspace-main news-main"><div className="news-heading"><Newspaper size={30}/><div><h1>{t('CS2 news','CS2 动态')}</h1><p>{t('Teams, players and tournaments','战队、选手与赛事资讯')}</p></div></div><div className="news-source-tabs" role="group" aria-label={t('News source','动态来源')}>{['all',...sources].map(value=><button type="button" key={value} aria-pressed={source===value} onClick={()=>{setSource(value);setLimit(12);}}>{value==='all'?t('All','全部'):value}</button>)}</div>{resource.loading&&!items.length?<Notice loading>{t('Loading news…','读取动态…')}</Notice>:resource.error?<Notice retry={resource.refresh}>{t('Could not load news','动态读取失败')}</Notice>:<><div className="news-ledger">{rows.slice(0,limit).map((item,i)=><article key={item.id} className={i===0&&item.image?'news-lead':'news-story'}>{item.image&&<Image src={item.image} width={560} height={300} alt="" unoptimized/>}<div><div className="news-meta"><b>{item.source}</b><time>{date(item.publishedAt)}</time></div><h2><a href={item.sourceUrl||item.url} target="_blank" rel="noreferrer">{language==='en'&&item.originalTitle?item.originalTitle:item.title}<ArrowUpRight size={16}/></a></h2>{i===0&&language==='zh'&&item.description&&<p>{item.description}</p>}</div></article>)}</div>{rows.length>limit&&<button type="button" className="stream-more" onClick={()=>setLimit(n=>n+12)}>{t('More news','更多动态')}</button>}{!rows.length&&<Notice>{t('No recent articles','暂无近期动态')}</Notice>}</>}{resource.data&&<p className="scope-note">{t('Updated','更新')} · {date(resource.data.updatedAt,true)}</p>}</main></div>;
}
