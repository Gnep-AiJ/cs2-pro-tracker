import {trackedPlayers} from '../../../data/tracked-players';
import type {TrackedRank} from '../../../lib/ranking-view';
export const runtime='edge';
type Feed={items:TrackedRank[];updatedAt:string;partial:boolean;requested:number};
let cached:Feed|null=null,expires=0,pending:Promise<Feed>|null=null;
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const numeric=(value:unknown)=>value==null||value===''||typeof value==='boolean'?null:Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
async function load():Promise<Feed>{
  const key=process.env.FACEIT_API_KEY?.trim();if(!key)throw new Error('unconfigured');
  const players=[...new Map(trackedPlayers.filter(p=>p.faceitPlayerId).map(p=>[p.faceitPlayerId,p])).values()];
  const items:TrackedRank[]=[];let partial=false;
  async function read(path:string){const r=await fetch('https://open.faceit.com/data/v4'+path,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(6000)});if(!r.ok)throw new Error('upstream');return record(await r.json());}
  // At most six requests at once; one cached profile and lifetime read per tracked identity.
  for(let start=0;start<players.length;start+=3){
    await Promise.all(players.slice(start,start+3).map(async p=>{
      try{
        const [profile,stats]=await Promise.all([read('/players/'+p.faceitPlayerId),read('/players/'+p.faceitPlayerId+'/stats/cs2').catch(()=>null)]);
        if(profile.player_id!==p.faceitPlayerId||typeof profile.nickname!=='string'||!record(profile.games).cs2)throw new Error('identity');
        const life=record(stats?.lifetime),game=record(record(profile.games).cs2),winRate=numeric(life?.['Win Rate %']);
        if(!stats)partial=true;
        items.push({id:p.faceitPlayerId!,name:p.display,nickname:profile.nickname,team:p.team,avatar:typeof profile.avatar==='string'?profile.avatar:null,country:typeof profile.country==='string'?profile.country:null,level:numeric(game.skill_level),elo:numeric(game.faceit_elo),matches:numeric(life?.Matches),winRate:winRate!=null&&winRate<=100?winRate:null});
      }catch{partial=true;}
    }));
  }
  if(!items.length)throw new Error('unavailable');
  return {items,updatedAt:new Date().toISOString(),partial,requested:players.length};
}
export async function GET(){
  try{
    if(!cached||Date.now()>expires){pending??=load().finally(()=>{pending=null;});cached=await pending;expires=Date.now()+(cached.partial?60000:3600000);}
    return Response.json(cached,{headers:{'Cache-Control':cached.partial?'no-store':'public, max-age=3600, s-maxage=3600'}});
  }catch{return cached?Response.json({...cached,partial:true},{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Rankings unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
