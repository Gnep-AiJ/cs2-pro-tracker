export type AdvancedStats = {
  rating:number|null;swing:number|null;firstKills:number|null;entryCount:number|null;entryWins:number|null;
  clutch1Count:number|null;clutch1Wins:number|null;clutch2Count:number|null;clutch2Wins:number|null;
  utilityDamage:number|null;utilityAdr:number|null;enemiesFlashed:number|null;doubleKills:number|null;tripleKills:number|null;quadroKills:number|null;pentaKills:number|null;
};
export type LabSample = Partial<AdvancedStats> & {
  id:string; playedAt:string|null; map:string|null; result:'W'|'L'|null;
  kills:number|null; deaths:number|null; adr:number|null; kr:number|null; headshots:number|null;
  advancedObservedAt?:string|null;
};
export type LabPlayer = {id:string;eventPlayerId:string;name:string;lookup:string;directoryTeam:string;samples:LabSample[];checkedAt:string|null;historyCheckedAt:string|null};
export type PublicMatch = {id:string;playedAt:string;map:string|null;sides:string[][];winner:number|null};
export type LabState = {version:1;observedAt:string;collectionStartedAt:string;players:LabPlayer[];matches:PublicMatch[];coverage:{history:number;stats:number;requested:number;clipped:boolean}};
export type Pair = {ids:[string,string];together:number;against:number;lastAt:string;matches:Array<{id:string;playedAt:string;kind:'together'|'against';map:string|null}>};
export type LabFeed = Omit<LabState,'matches'> & {uniqueMatches:number;pairs:Pair[];range:{from:string|null;to:string|null};storage:'snapshot'|'persistent';stale:boolean};
export type LabMetric='rating'|'swing'|'adr'|'kd'|'kr'|'headshots'|'winRate'|'kills'|'firstKills'|'entrySuccess'|'clutchSuccess'|'utilityAdr'|'enemiesFlashed'|'multiKills';
const numeric=(v:unknown):number|null=>v==null||v===''||typeof v==='boolean'?null:Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const text=(v:unknown)=>typeof v==='string'?v:'';
export function readAdvanced(value:unknown):AdvancedStats {
  const stats=record(value),entries=Object.entries(stats).map(([key,value])=>[key.toLowerCase().replace(/[^a-z0-9]/g,''),value] as const);
  function field(...names:string[]){for(const name of names){const found=entries.find(([key])=>key===name.toLowerCase().replace(/[^a-z0-9]/g,''));if(found){const raw=found[1];if(raw==null||raw===''||typeof raw==='boolean')return null;const n=Number(String(raw).replace(/%$/,''));return Number.isFinite(n)?n:null;}}return null;}
  const count=(...names:string[])=>{const n=field(...names);return n!=null&&n>=0?n:null;};
  const rating=count('FACEIT Rating','Rating'),swing=field('Round Swing','Swing');
  const result={rating:rating!=null&&rating<=10?rating:null,swing:swing!=null&&Math.abs(swing)<=100?swing:null,
    firstKills:count('First Kills'),entryCount:count('Entry Count'),entryWins:count('Entry Wins'),
    clutch1Count:count('1v1Count'),clutch1Wins:count('1v1Wins'),clutch2Count:count('1v2Count'),clutch2Wins:count('1v2Wins'),
    utilityDamage:count('Utility Damage'),utilityAdr:count('Utility Damage per Round in a Match'),enemiesFlashed:count('Enemies Flashed'),
    doubleKills:count('Double Kills'),tripleKills:count('Triple Kills'),quadroKills:count('Quadro Kills'),pentaKills:count('Penta Kills')};
  // Impossible counts are missing data, not high performance.
  for(const [wins,attempts] of [['entryWins','entryCount'],['clutch1Wins','clutch1Count'],['clutch2Wins','clutch2Count']] as const)if(result[wins]!=null&&result[attempts]!=null&&result[wins]!>result[attempts]!)result[wins]=null;
  return result;
}
export function readMatchAdvanced(payload:unknown) {
  const rounds=array(record(payload).rounds);
  // A recent-match row is one match. Do not silently attach one map of a BO3.
  if(rounds.length!==1)return [];
  return array(record(rounds[0]).teams).flatMap(team=>array(record(team).players).flatMap(player=>{
    const p=record(player),id=text(p.player_id);return id?[{id,stats:readAdvanced(p.player_stats)}]:[];
  }));
}
function timestamp(v:unknown){const n=numeric(v);return n!=null&&n>0&&Number.isFinite(new Date(n*1000).getTime())?new Date(n*1000).toISOString():null;}

export function readHistory(payload:unknown):PublicMatch[] {
  return array(record(payload).items).flatMap(value=>{
    const m=record(value),teams=record(m.teams),result=record(m.results),id=text(m.match_id);
    const playedAt=timestamp(m.finished_at),sides=['faction1','faction2'].map(k=>array(record(teams[k]).players).map(p=>text(record(p).player_id)));
    if(!id||!playedAt||sides.some(s=>s.length!==5||s.some(p=>!p))||new Set(sides.flat()).size!==10)return [];
    return [{id,playedAt,map:null,sides,winner:result.winner==='faction1'?0:result.winner==='faction2'?1:null}];
  });
}
export function readSamples(payload:unknown,history:PublicMatch[],playerId:string):LabSample[] {
  const byId=new Map(history.map(m=>[m.id,m])),seen=new Set<string>();
  return array(record(payload).items).flatMap(value=>{
    const row=record(value),s=record(row.stats),id=text(s['Match Id']);if(!id||seen.has(id))return [];seen.add(id);
    const match=byId.get(id),side=match?.sides.findIndex(ids=>ids.includes(playerId))??-1;
    const adr=numeric(s.ADR),kr=numeric(s['K/R Ratio']),hs=numeric(s['Headshots %']);
    return [{id,playedAt:match?.playedAt || timestamp(row.created_at),map:text(s.Map).replace(/^de_/,'')||null,
      result:side>=0&&match?.winner!=null?match.winner===side?'W' as const:'L' as const:null,
      kills:numeric(s.Kills),deaths:numeric(s.Deaths),adr,kr,headshots:hs!=null&&hs<=100?hs:null,...readAdvanced(s)}];
  }).sort((a,b)=>(b.playedAt||'').localeCompare(a.playedAt||''));
}
export function mergePublicMatches(previous:PublicMatch[],incoming:PublicMatch[],now:string,limit=5000) {
  const byId=new Map<string,PublicMatch>();
  for(const m of [...previous,...incoming]) {
    if(!m.id||!Number.isFinite(Date.parse(m.playedAt))||Date.parse(m.playedAt)>Date.parse(now)||Date.parse(m.playedAt)<Date.parse(now)-90*86400000)continue;
    const old=byId.get(m.id);byId.set(m.id,{...m,map:m.map||old?.map||null});
  }
  const all=[...byId.values()].sort((a,b)=>b.playedAt.localeCompare(a.playedAt)||a.id.localeCompare(b.id));
  return {matches:all.slice(0,limit),clipped:all.length>limit};
}
export function buildLabFeed(state:LabState,storage:LabFeed['storage']='snapshot',now=Date.now()):LabFeed {
  const known=new Set(state.players.map(p=>p.id)),pairs=new Map<string,Pair>(),unique=new Map(state.matches.map(m=>[m.id,m]));
  for(const m of unique.values()) {
    if(m.sides.length!==2||m.sides.some(s=>s.length!==5)||new Set(m.sides.flat()).size!==10)continue;
    const participants=m.sides.flat().filter(id=>known.has(id)).sort();
    for(let a=0;a<participants.length;a++)for(let b=a+1;b<participants.length;b++) {
      const ids:[string,string]=[participants[a],participants[b]],key=ids.join('|');
      const kind=m.sides.some(side=>ids.every(id=>side.includes(id)))?'together':'against';
      const pair=pairs.get(key)||{ids,together:0,against:0,lastAt:m.playedAt,matches:[]};
      pair[kind]++;if(m.playedAt>pair.lastAt)pair.lastAt=m.playedAt;
      pair.matches.push({id:m.id,playedAt:m.playedAt,kind,map:m.map});pairs.set(key,pair);
    }
  }
  const dates=[...unique.values()].map(m=>m.playedAt).sort();
  const {matches:_,...rest}=state;void _;
  return {...rest,storage,stale:now-Date.parse(state.observedAt)>12*3600000,uniqueMatches:unique.size,
    range:{from:dates[0]||null,to:dates.at(-1)||null},pairs:[...pairs.values()].map(p=>({...p,matches:p.matches.sort((a,b)=>b.playedAt.localeCompare(a.playedAt)).slice(0,10)})).sort((a,b)=>(b.together+b.against)-(a.together+a.against)||a.ids.join().localeCompare(b.ids.join()))};
}
export function summarizeLab(samples:LabSample[],limit=20,map='all',outcome='all',since:string|null=null) {
  const seen=new Set<string>();
  const window=samples.filter(s=>!seen.has(s.id)&&!!seen.add(s.id)).slice(0,limit).filter(s=>(map==='all'||s.map===map)&&(outcome==='all'||s.result===outcome)&&(!since||!!s.playedAt&&s.playedAt>=since));
  function mean(field:'adr'|'kr'|'headshots'|'kills'|'rating'|'swing'|'firstKills'|'utilityAdr'|'enemiesFlashed') {const values=window.map(s=>s[field]).filter((v):v is number=>v!=null&&Number.isFinite(v)&&(field==='swing'||v>=0));return {value:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,n:values.length};}
  function rate(wins:Array<keyof AdvancedStats>,attempts:Array<keyof AdvancedStats>){const eligible=window.filter(s=>[...wins,...attempts].every(key=>s[key]!=null&&Number.isFinite(s[key])));const total=eligible.reduce((n,s)=>n+attempts.reduce((v,k)=>v+s[k]!,0),0);return {value:total>0?eligible.reduce((n,s)=>n+wins.reduce((v,k)=>v+s[k]!,0),0)/total*100:null,n:eligible.length,attempts:total};}
  const multi=window.filter(s=>[s.doubleKills,s.tripleKills,s.quadroKills,s.pentaKills].every(v=>v!=null&&Number.isFinite(v)));
  const decided=window.filter(s=>s.result==='W'||s.result==='L'),kd=window.filter(s=>s.kills!=null&&s.deaths!=null&&s.deaths>=0&&s.kills>=0),deaths=kd.reduce((n,s)=>n+s.deaths!,0);
  return {matches:window.length,adr:mean('adr'),kr:mean('kr'),headshots:mean('headshots'),kills:mean('kills'),
    rating:mean('rating'),swing:mean('swing'),firstKills:mean('firstKills'),utilityAdr:mean('utilityAdr'),enemiesFlashed:mean('enemiesFlashed'),
    entrySuccess:rate(['entryWins'],['entryCount']),clutchSuccess:rate(['clutch1Wins','clutch2Wins'],['clutch1Count','clutch2Count']),
    multiKills:{value:multi.length?multi.reduce((n,s)=>n+s.doubleKills!+s.tripleKills!+s.quadroKills!+s.pentaKills!,0)/multi.length:null,n:multi.length},
    kd:{value:deaths>0?kd.reduce((n,s)=>n+s.kills!,0)/deaths:null,n:kd.length},
    winRate:{value:decided.length?decided.filter(s=>s.result==='W').length/decided.length*100:null,n:decided.length},
    from:window.map(s=>s.playedAt).filter(Boolean).sort()[0]||null,to:window.map(s=>s.playedAt).filter(Boolean).sort().at(-1)||null};
}
export function rankLab(players:LabPlayer[],metric:LabMetric,limit=20,map='all',minimum=5,outcome='all',since:string|null=null) {
  const rows=players.map(player=>({player,summary:summarizeLab(player.samples,limit,map,outcome,since)})).filter(row=>row.summary[metric].value!=null&&row.summary[metric].n>=minimum)
    .sort((a,b)=>b.summary[metric].value!-a.summary[metric].value!||a.player.id.localeCompare(b.player.id));
  let rank=0;return rows.map((row,i)=>{if(i===0||row.summary[metric].value!==rows[i-1].summary[metric].value)rank=i+1;return {...row,rank};});
}
