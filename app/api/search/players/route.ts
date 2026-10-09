import { NextResponse } from 'next/server';
import { searchablePlayers as trackedPlayers } from '../../../data/tracked-players';
import { fuzzyScore } from '../../../lib/pro-events';
import { getProEvent } from '../../../lib/pro-event-feed';
import { faceitNickname } from '../../../lib/faceit-nickname';
export const runtime='edge';
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams,q=(params.get('q') || '').trim(),domain=params.get('domain') || 'events',id=params.get('event') || '8244';
  if(q.length>40 || /[\u0000-\u001f]/.test(q) || !['events','faceit'].includes(domain))return NextResponse.json({error:'invalid_query'},{status:400});
  if(domain==='events' && !/^(?:ps-)?\d{1,8}$/.test(id))return NextResponse.json({error:'invalid_event'},{status:400});
  const feed=domain==='events'?await getProEvent(id):null;
  const details=feed?.details;
  if(domain==='events' && !details)return NextResponse.json({error:'event_not_found'},{status:404});
  const candidates:Array<{id:string;name:string;team:string;lookup:string;avatar:string|null;maps:number|null;verified:boolean;aliases:string[]}>=domain==='events' ? (details?.players||[]).map(p=>({...p,lookup:p.id,verified:true,aliases:trackedPlayers.find(t=>fuzzyScore(p.name,[t.display])===100)?.aliases || []})) : trackedPlayers.filter(p=>p.faceitPlayerId).map(p=>({id:p.faceitPlayerId!,name:p.display,team:p.team,lookup:p.lookup,avatar:null,maps:null,verified:true,aliases:[p.lookup,...p.aliases]}));
  const items=candidates.map(p=>({...p,score:fuzzyScore(q,[p.name,...p.aliases,p.team])})).filter(p=>p.score>0);
  const key=process.env.FACEIT_API_KEY;
  let partial=false;
  if(domain==='faceit' && q.length>=2 && !items.some(p=>fuzzyScore(q,[p.name,...p.aliases])===100)) {
    if (!key) partial=true;
    else {
      const nickname=faceitNickname(q), base='https://open.faceit.com/data/v4';
      const search=new URL(`${base}/search/players`);search.searchParams.set('nickname',nickname);search.searchParams.set('game','cs2');search.searchParams.set('limit','12');
      const urls=[search.toString()];
      if (/^[a-zA-Z0-9_.-]{2,32}$/.test(nickname)) urls.unshift(`${base}/players?nickname=${encodeURIComponent(nickname)}&game=cs2`);
      const responses=await Promise.allSettled(urls.map(async url=>{
        const r=await fetch(url,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(6000)});
        if (r.status===404) return [];
        if (!r.ok) throw new Error('unavailable');
        const raw:unknown=await r.json();
        if (!raw || typeof raw!=='object') return [];
        const data=raw as {items?:unknown;player_id?:unknown;nickname?:unknown;avatar?:unknown};
        return (Array.isArray(data.items)?data.items:[data]) as Array<{player_id?:unknown;nickname?:unknown;avatar?:unknown}>;
      }));
      for(const result of responses) {
        if(result.status==='rejected'){partial=true;continue;}
        for(const p of result.value) {
          if (!p || typeof p.nickname!=='string' || typeof p.player_id!=='string' || !/^[0-9a-f-]{36}$/i.test(p.player_id)) continue;
          const score=p.nickname.toLowerCase()===nickname.toLowerCase()?110:fuzzyScore(nickname,[p.nickname]);
          if (!score) continue;
          const existing=items.find(i=>i.id===p.player_id);
          if (existing) {existing.score=Math.max(existing.score,score);continue;}
          const known=candidates.find(i=>i.id===p.player_id);
          items.push({...known,id:p.player_id,name:known?.name||p.nickname,lookup:p.nickname,team:known?.team||'FACEIT',avatar:typeof p.avatar==='string'?p.avatar:null,maps:null,verified:!!known,aliases:known?.aliases||[],score});
        }
      }
    }
  }
  items.sort((a,b)=>b.score-a.score || Number(b.verified)-Number(a.verified) || Number(b.maps!=null)-Number(a.maps!=null) || a.name.localeCompare(b.name));
  const saved=!!feed&&(feed.saved||feed.details.saved);
  return NextResponse.json({items:items.slice(0,12).map(p=>({id:p.id,name:p.name,lookup:p.lookup,team:p.team,avatar:p.avatar,maps:p.maps,verified:p.verified})),partial,saved,observedAt:details?.observedAt||null},{headers:{'Cache-Control':partial||saved?'no-store':'public, max-age=30, s-maxage=120'}});
}
