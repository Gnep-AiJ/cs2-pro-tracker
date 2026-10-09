import { proCohort } from '../app/data/pro-cohort';
import { buildLabFeed,mergePublicMatches,readHistory,readSamples,readMatchAdvanced,readAdvanced,type LabState,type LabPlayer } from '../app/lib/pro-lab';
type Env=Pick<CollectorBindings,'PRO_DATA'|'FACEIT_API_KEY'>;
export async function collectProData(env:Env,now=new Date().toISOString(),options:{detailLimit?:number;progress?:(done:number,total:number)=>void}={}) {
  if(!env.FACEIT_API_KEY)throw new Error('FACEIT key is not configured');
  const object=await env.PRO_DATA.get('state/v1.json'),previous=object?await object.json<LabState>():null;
  const players:LabPlayer[]=[],incoming:LabState['matches']=[];
  let historyCount=0,statsCount=0,cursor=0;
  const failures:Array<{id:string;kind:string}>=[];
  const raw:Array<{id:string;history:unknown;stats:unknown}>=[];
  async function read(path:string){const r=await fetch(`https://open.faceit.com/data/v4${path}`,{headers:{Authorization:`Bearer ${env.FACEIT_API_KEY}`},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`FACEIT ${r.status}`);const data=await r.json() as {items?:unknown[]};if(!Array.isArray(data.items))throw new Error('Invalid FACEIT collection');return data;}
  // Scheduled run: 40 list requests + at most 4 unique match details, then 4 R2 operations.
  await Promise.all(Array.from({length:3},async()=>{
    while(cursor<proCohort.length){const p=proCohort[cursor++],old=previous?.players.find(o=>o.id===p.id);
      const [h,s]=await Promise.allSettled([read(`/players/${p.id}/history?game=cs2&offset=0&limit=30`),read(`/players/${p.id}/games/cs2/stats?offset=0&limit=20`)]);
      raw.push({id:p.id,history:h.status==='fulfilled'?h.value:null,stats:s.status==='fulfilled'?s.value:null});
      const history=h.status==='fulfilled'?readHistory(h.value):[];
      if(h.status==='fulfilled'){historyCount++;incoming.push(...history);}else failures.push({id:p.id,kind:'history'});
      if(s.status==='fulfilled')statsCount++;else failures.push({id:p.id,kind:'stats'});
      const samples=s.status==='fulfilled'?readSamples(s.value,[...(previous?.matches||[]),...history],p.id).map(sample=>{
        const retained=old?.samples.find(s=>s.id===sample.id);
        if(!retained?.advancedObservedAt)return sample;
        const keys=Object.keys(readAdvanced({})) as Array<keyof ReturnType<typeof readAdvanced>>;
        return {...sample,...Object.fromEntries(keys.map(key=>[key,retained[key]??sample[key]??null])),advancedObservedAt:retained.advancedObservedAt};
      }):old?.samples||[];
      const maps=new Map(samples.filter(s=>s.map).map(s=>[s.id,s.map]));
      for(const m of history)m.map=maps.get(m.id)||null;
      players.push({...p,samples,checkedAt:s.status==='fulfilled'?now:old?.checkedAt||null,historyCheckedAt:h.status==='fulfilled'?now:old?.historyCheckedAt||null});
    }
  }));
  if(!historyCount&&!statsCount)throw new Error('All FACEIT sources unavailable; stored observations preserved');
  const pending=[...new Set(players.flatMap(p=>p.samples.filter(s=>!s.advancedObservedAt).map(s=>s.id)))];
  const selected=pending.slice(0,Math.max(0,Math.min(500,options.detailLimit??4)));
  const detailRaw:Array<{id:string;payload:unknown}>=[];let detailCursor=0,detailDone=0;
  await Promise.all(Array.from({length:3},async()=>{while(detailCursor<selected.length){const id=selected[detailCursor++];try{
    const r=await fetch(`https://open.faceit.com/data/v4/matches/${encodeURIComponent(id)}/stats`,{headers:{Authorization:`Bearer ${env.FACEIT_API_KEY}`},signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error(`FACEIT ${r.status}`);const payload:unknown=await r.json();const stats=readMatchAdvanced(payload);
    if(!stats.length)throw new Error('Unsupported or unavailable match statistics');
    detailRaw.push({id,payload});for(const player of players){const row=stats.find(p=>p.id===player.id),sample=player.samples.find(s=>s.id===id);if(row&&sample)Object.assign(sample,row.stats,{advancedObservedAt:now});}
  }catch {failures.push({id,kind:'advanced'});}finally {options.progress?.(++detailDone,selected.length);}}}));
  players.sort((a,b)=>proCohort.findIndex(p=>p.id===a.id)-proCohort.findIndex(p=>p.id===b.id));
  const merged=mergePublicMatches(previous?.matches||[],incoming,now);
  const state:LabState={version:1,observedAt:now,collectionStartedAt:previous?.collectionStartedAt||now,players,matches:merged.matches,coverage:{history:historyCount,stats:statsCount,requested:proCohort.length,clipped:merged.clipped}};
  const metadata={httpMetadata:{contentType:'application/json'}};
  // Publish only after durable state and immutable observations succeed.
  await env.PRO_DATA.put(`observations/${now.replaceAll(':','-')}.json`,JSON.stringify({observedAt:now,players,matches:incoming,raw,detailRaw,failures}),metadata);
  const committed=await env.PRO_DATA.put('state/v1.json',JSON.stringify(state),{...metadata,onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'}});
  if(!committed)throw new Error('Concurrent collection changed the state; previous publication preserved');
  await env.PRO_DATA.put('public/v1.json',JSON.stringify(buildLabFeed(state,'persistent')),metadata);
  return {observedAt:now,players:players.length,uniqueMatches:state.matches.length,coverage:state.coverage};
}
const collector={
  async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext){ctx.waitUntil(collectProData(env).then(report=>{console.log(JSON.stringify({event:'cs2pro_collection',...report}));}).catch(error=>{console.error(JSON.stringify({event:'cs2pro_collection_failed',message:error instanceof Error?error.message:'unavailable'}));throw error;}));},
  // No public ingestion or credential-bearing refresh endpoint.
  fetch(){return new Response('cs2pro scheduled data collector',{headers:{'Content-Type':'text/plain'}});},
};
export default collector;
