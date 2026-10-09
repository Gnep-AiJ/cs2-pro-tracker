import snapshot from '../data/pro-events-snapshot.json';
import {withOfficialRatings} from './rating-feed';
import {fetchProviderFixtures,getProviderCatalogue,getProviderEventFixtures} from './event-provider';
import { mergeStats, parseBigEvents, parseEventPage, parseEventStats, type BigEvent, type EventDetails, type ProEventsFeed } from './pro-events';

export const savedEvents = snapshot.events as BigEvent[];
const savedDetails = snapshot.details as Record<string, EventDetails>;
const detailCache=new Map<string,{feed:ProEventsFeed;expires:number}>();
type Catalogue = {events:BigEvent[];observedAt:string;saved:boolean};
let catalogue: Catalogue | null=null, expires=0, pending:Promise<Catalogue>|null=null;
export async function getCatalogue():Promise<Catalogue> {
  if(catalogue && Date.now()<expires)return catalogue;
  if(pending)return pending;
  pending=(async()=>{
    const fallback={events:savedEvents,observedAt:snapshot.observedAt,saved:true};
    try {
      const provider=await getProviderCatalogue();
      if(provider?.events.length)return provider;
      const [calendar,listing]=await Promise.all([readPublic('https://www.hltv.org/calendar'),readPublic('https://www.hltv.org/events')]);
      const parsed=parseBigEvents(calendar,listing);
      if(parsed.length<3)return catalogue ? {...catalogue,saved:true} : fallback;
      const retained=savedEvents.filter(e=>Date.parse(e.endsAt)>=Date.now()-45*86400000 && !parsed.some(p=>p.id===e.id));
      return {events:[...retained,...parsed.map(e=>({...e,statsUrl:savedEvents.find(s=>s.id===e.id)?.statsUrl || null}))].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)),observedAt:new Date().toISOString(),saved:false};
    }catch{return catalogue ? {...catalogue,saved:true} : fallback;}
  })();
  try {catalogue=await pending;expires=Date.now()+(catalogue.saved?30_000:catalogue.events.some(e=>e.provider==='PandaScore')?10*60_000:60*60_000);return catalogue;}finally{pending=null;}
}
export async function getProEvent(id: string): Promise<ProEventsFeed | null> {
  const cached=detailCache.get(id);if(cached&&Date.now()<cached.expires)return cached.feed;
  const list=await getCatalogue();
  const event = list.events.find(e=>e.id===id)||savedEvents.find(e=>e.id===id); if(!event) return null;
  if(event.provider==='PandaScore') {
    const fixtures=await getProviderEventFixtures(event);
    const details:EventDetails= !fixtures && cached ? {...cached.feed.details,saved:true,statsSaved:true} : {id,matches:fixtures?.matches||[],players:event.providerPlayers||[],maps:[],observedAt:fixtures?.observedAt||list.observedAt,statsObservedAt:null,sourceUrl:event.sourceUrl,statsUrl:null,saved:fixtures?.saved??true,statsSaved:true,ratingStatus:'unavailable'};
    const feed={events:list.events,details,observedAt:list.observedAt,saved:list.saved};
    if(detailCache.size>=24)detailCache.delete(detailCache.keys().next().value!);
    detailCache.set(id,{feed,expires:Date.now()+(details.saved?30_000:300_000)});return feed;
  }
  const retained=savedDetails[id] || {id,matches:[],players:[],maps:[],observedAt:list.observedAt,statsObservedAt:null,sourceUrl:event.sourceUrl,statsUrl:event.statsUrl,saved:true,statsSaved:true};
  let details: EventDetails = {...retained,saved:true,statsSaved:true};
  const now = new Date().toISOString();
  const [page,stats] = await Promise.allSettled([
    readPublic(event.sourceUrl),
    event.statsUrl && Date.parse(event.startsAt)<=Date.now() ? readPublic(event.statsUrl) : Promise.resolve(null),
  ]);
  if(page.status==='fulfilled' && page.value) {
    const parsed=parseEventPage(page.value,event,now);
    if(parsed.players.length || parsed.matches.length) {
      details={...parsed,players:parsed.players.length?parsed.players:details.players,
        matches:parsed.matches.length?parsed.matches:details.matches,
        observedAt:parsed.matches.length?parsed.observedAt:details.observedAt,
        saved:!parsed.matches.length&&details.matches.length>0,
        maps:details.maps,statsObservedAt:details.statsObservedAt,statsSaved:true};
      const numeric=retained.players.filter(p=>p.maps!=null);
      details={...details,players:details.players.map(p=>{const s=numeric.find(s=>s.id===p.id);return s?{...p,maps:s.maps,kills:s.kills,deaths:s.deaths,assists:s.assists,adr:s.adr,kast:s.kast,providerScore:s.providerScore}:p;})};
    }
  }
  if(stats.status==='fulfilled' && stats.value) details=mergeStats(details,parseEventStats(stats.value,details.players),now);
  // Some future pages contain unrelated statistics. Never present them as future event results.
  if(Date.parse(event.startsAt)>Date.now())details={...details,players:details.players.map(p=>({...p,maps:null,kills:null,deaths:null,assists:null,adr:null,kast:null,providerScore:null,rating:null,ratingMaps:null})),maps:[],statsObservedAt:null,ratingStatus:'unavailable'};
  else details=await withOfficialRatings(details);
  try {
    const official = await fetchProviderFixtures(id);
    if (official) details = { ...details, matches: official.matches, saved: official.saved, observedAt: official.observedAt };
  } catch { /* A failed authorized provider preserves dated observations. */ }
  const feed={events:list.events.some(e=>e.id===id)?list.events:[event,...list.events],details,observedAt:list.observedAt,saved:list.saved};
  if(detailCache.size>=24)detailCache.delete(detailCache.keys().next().value!);
  detailCache.set(id,{feed,expires:Date.now()+300000});return feed;
}
async function readPublic(url: string) {
  // HLTV has no verified public API. Access requires a separately obtained license.
  if (new URL(url).hostname === 'www.hltv.org' && process.env.HLTV_AUTHORIZED_ACCESS !== 'true') throw new Error('hltv_license_required');
  const response=await fetch(url,{headers:{Accept:'text/html','User-Agent':'cs2pro-source-check/1.0'},signal:AbortSignal.timeout(5500)});
  if(!response.ok)throw new Error('source_unavailable');
  const html=await response.text();if(html.length>2_000_000)throw new Error('source_too_large');return html;
}
