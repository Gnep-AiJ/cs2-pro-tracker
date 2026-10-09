import type {EventDetails} from './pro-events';
export function mergeOfficialRatings(details:EventDetails,payload:unknown,now=Date.now()):EventDetails {
  const source=payload as {version?:number;ratings?:Array<Record<string,unknown>>}|null;
  if(source?.version!==1||!Array.isArray(source.ratings)||source.ratings.length>5000)return {...details,ratingStatus:'unavailable'};
  const valid=new Map<string,Record<string,unknown>>(),duplicates=new Set<string>();
  for(const row of source.ratings){
    if(row.eventId!==details.id||row.version!=='3.0'||typeof row.playerId!=='string'||!/^hltv-\d+$/.test(row.playerId))continue;
    if(typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<0||row.value>10||typeof row.maps!=='number'||!Number.isInteger(row.maps)||row.maps<1)continue;
    if(typeof row.sourceUrl!=='string'||!/^https:\/\/www\.hltv\.org\/(?:stats|matches)\//.test(row.sourceUrl)||typeof row.observedAt!=='string'||!Number.isFinite(Date.parse(row.observedAt))||Date.parse(row.observedAt)>now+60000)continue;
    if(duplicates.has(row.playerId))continue;
    if(valid.has(row.playerId)){valid.delete(row.playerId);duplicates.add(row.playerId);continue;}
    valid.set(row.playerId,row);
  }
  let count=0;
  const players=details.players.map(p=>{const row=valid.get(p.id);if(!row)return {...p,rating:null,ratingMaps:null,ratingSource:null,ratingObservedAt:null};count++;return {...p,rating:row.value as number,ratingMaps:row.maps as number,ratingSource:row.sourceUrl as string,ratingObservedAt:row.observedAt as string};});
  return {...details,players,ratingStatus:count===players.length?'ready':count?'partial':'unavailable'};
}
export async function withOfficialRatings(details:EventDetails):Promise<EventDetails>{
  const endpoint=process.env.RATING_FEED_URL?.trim();
  if(!endpoint)return {...details,ratingStatus:'unconfigured'};
  try{
    const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.hostname==='localhost'||/^(?:127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname))throw new Error('Invalid source URL');
    const token=process.env.RATING_FEED_TOKEN?.trim();const response=await fetch(url,{headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('Source unavailable');const raw=await response.text();if(raw.length>2000000)throw new Error('Source too large');
    return mergeOfficialRatings(details,JSON.parse(raw));
  }catch{return {...details,ratingStatus:'unavailable'};}
}
