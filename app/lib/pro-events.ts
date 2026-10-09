export type EventPlayer = { id: string; name: string; team: string; sourceUrl: string; avatar: string | null; maps: number | null; kills: number | null; deaths: number | null; assists: number | null; adr: number | null; kast: number | null; providerScore: number | null; rating?:number|null;ratingMaps?:number|null;ratingSource?:string|null;ratingObservedAt?:string|null };
export type ProMatchMap = { id: string; position: number; name: string | null; status: 'scheduled' | 'running' | 'finished'; winnerId: number | null; beginsAt: string | null; endsAt: string | null };
export type ProMatch = { id: string; sourceUrl: string; beginsAt: string | null; bestOf: number | null; status: 'scheduled' | 'running' | 'finished'; provider?: 'PandaScore'; round?: string; maps?: ProMatchMap[]; streams?: Array<{ url: string; language: string; main: boolean }>; liveUrl?: string | null; teams: Array<{ id?: number; name: string; logo: string | null; score: number | null }> };
export type BigEvent = { id: string; name: string; startsAt: string; endsAt: string; location: string; prize: string; teams: number | null; logo: string | null; sourceUrl: string; selection: 'HLTV Big Event' | 'HLTV Featured' | 'PandaScore S/A'; statsUrl: string | null; provider?: 'PandaScore'; providerTier?: 's' | 'a'; providerTournamentIds?: number[]; providerPlayers?: EventPlayer[] };
export type EventDetails = { id: string; matches: ProMatch[]; players: EventPlayer[]; maps: Array<{ name: string; count: number }>; observedAt: string; statsObservedAt: string | null; sourceUrl: string; statsUrl: string | null; saved: boolean; statsSaved: boolean;ratingStatus?:'ready'|'partial'|'unavailable'|'unconfigured' };
export type ProEventsFeed = { events: BigEvent[]; details: EventDetails; observedAt: string; saved: boolean };

export function plain(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_,n) => String.fromCodePoint(Math.min(0x10ffff,Number(n)))).replace(/\s+/g, ' ').trim();
}
function attr(html: string, name: string) { return html.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]?.replace(/&amp;/g, '&') || ''; }
// Bounded class extraction preserves nested elements without treating partial HTML as data.
export function blocks(html: string, tag: string, className: string) {
  const result: string[] = [];
  const opening = new RegExp(`<${tag}\\b[^>]*\\bclass="[^"]*"[^>]*>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = opening.exec(html)) && result.length < 250) {
    if (!attr(match[0], 'class').split(/\s+/).includes(className)) continue;
    const closing = new RegExp(`</?${tag}\\b[^>]*>`, 'g'); closing.lastIndex = opening.lastIndex;
    let depth = 1, token: RegExpExecArray | null;
    while ((token = closing.exec(html))) { depth += token[0].startsWith('</') ? -1 : 1; if (!depth) break; }
    if (depth === 0) result.push(html.slice(match.index, closing.lastIndex));
  }
  return result;
}
function first(html: string, tag: string, cls: string) { return blocks(html,tag,cls)[0] || ''; }
function image(html: string, cls?: string) {
  const tags = [...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]);
  const node = cls ? tags.find(tag=>attr(tag,'class').split(/\s+/).includes(cls)) : tags[0];
  const src = attr(node || '', 'src');
  return /^https:\/\/(?:img-cdn\.hltv\.org|ensigame\.com)\//.test(src) ? src : null;
}
function numeric(value: string): number | null { const token = plain(value).match(/^[+-]?\d+(?:\.\d+)?/); return token ? Number(token[0]) : null; }
function epoch(value: string) { const n = Number(value); return n > 1e12 && n < 5e12 ? new Date(n).toISOString() : null; }
function isoDate(text: string, year: number): string | null { const n=Date.parse(`${text} ${year} 12:00:00 GMT`); return Number.isFinite(n) ? new Date(n).toISOString() : null; }
export function parseBigEvents(calendar: string, listing: string, now = Date.now()): BigEvent[] {
  const bigIds = new Set([...listing.matchAll(/<a href="\/events\/(\d+)\/[^\"]+" class="a-reset standard-box big-event"/g)].map(m=>m[1]));
  const featuredIds = new Set([...listing.matchAll(/<a href="\/events\/(\d+)\/[^\"]+"[^>]*class="[^"]*ongoing-event[^"]*"/g)].map(m=>m[1]));
  const events: BigEvent[]=[];
  for(const block of blocks(calendar,'div','event-tooltip-wrapper')) {
    const top=first(block,'a','event-tooltip-top'), href=attr(top,'href'), id=href.match(/^\/events\/(\d+)\//)?.[1];
    if(!id || (!bigIds.has(id) && !featuredIds.has(id))) continue;
    const name=plain(top); if(/award|qualif|showmatch/i.test(name)) continue;
    const fields=Object.fromEntries(blocks(block,'div','event-tooltip-bottom-row').map(row=>[plain(first(row,'div','event-tooltip-bottom-text')),plain(first(row,'div','event-tooltip-bottom-info'))]));
    const dates=fields.Date?.split(' - '); const year=Number(name.match(/\b20\d{2}\b/)?.[0]);
    if(!year || !dates?.length) continue;
    const startsAt=isoDate(dates[0],year), endsAt=isoDate(dates[1] || dates[0],year);
    if(!startsAt || !endsAt || Date.parse(endsAt)<now-45*86400000 || Date.parse(startsAt)>now+120*86400000) continue;
    events.push({id,name,startsAt,endsAt,location:fields.Location || '',prize:fields['Prize pool'] || '',teams:numeric(fields.Teams || ''),logo:image(top,'night-only') || image(top),sourceUrl:`https://www.hltv.org${href}`,selection:bigIds.has(id)?'HLTV Big Event':'HLTV Featured',statsUrl:null});
  }
  return [...new Map(events.map(e=>[e.id,e])).values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
export function parseEventPage(html: string, event: BigEvent, observedAt: string): EventDetails {
  const matches: ProMatch[]=[];
  // The published knockout bracket includes the entire event's future matches,
  // including dated semi-finals/finals whose entrants are still undecided.
  for(const attribute of html.matchAll(/\bdata-slotted-bracket-json="([^"]+)"/g)) {
    if(attribute[1].length>300000)continue;
    try {
      const bracket=JSON.parse(attribute[1].replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&'));
      if(!Array.isArray(bracket.rounds))continue;
      for(const round of bracket.rounds.slice(0,32))for(const [key,slot] of Object.entries(round)) {
        if(!/^slot\d+$/.test(key)||!slot||typeof slot!=='object')continue;
        const matchup=(slot as {matchup?:Record<string,unknown>}).matchup;
        const match=matchup?.match as Record<string,unknown>|undefined;
        const href=typeof match?.matchPageURL==='string'?match.matchPageURL:'';
        const id=href.match(/^\/matches\/(\d+)\/[^?#]+$/)?.[1];
        if(!id||String(match?.matchId)!==id||matchup?.score!=null||match?.status!=='Normal')continue;
        const teams=['team1','team2'].map(key=>{
          const team=matchup?.[key] as {name?:string;description?:string;logo?:{nightLogoURL?:string;dayLogoURL?:string}}|undefined;
          const logo=team?.logo?.nightLogoURL||team?.logo?.dayLogoURL||null;
          return {name:team?.name||team?.description||'TBA',logo:logo&&/^https:\/\/img-cdn\.hltv\.org\//.test(logo)?logo:null,score:null};
        });
        matches.push({id,sourceUrl:`https://www.hltv.org${href}`,beginsAt:epoch(String(match?.startTime)),bestOf:numeric(String(match?.numberOfMaps)),status:'scheduled',round:String(round.roundName?.name||bracket.name||''),teams});
      }
    }catch { /* A malformed bracket does not discard verified group results. */ }
  }
  for(const row of blocks(html,'a','bottom-row')) {
    const href=attr(row,'href'), id=href.match(/^\/matches\/(\d+)\//)?.[1]; if(!id) continue;
    const teams=['team-1','team-2'].map(cls=>{const block=first(row,'div',cls);return {name:plain(first(block,'span','text-ellipsis')) || attr(block.match(/<img[^>]*>/)?.[0]||'', 'alt') || 'TBA',logo:image(block,'night-only') || image(block),score:null as number|null};});
    const left=numeric(first(row,'div','score-left')),right=numeric(first(row,'div','score-right'));
    const finished=left!=null && right!=null;
    if(finished) {teams[0].score=left; teams[1].score=right;}
    const date=row.match(/data-unix="(\d+)"/)?.[1] || '';
    matches.push({id,sourceUrl:`https://www.hltv.org${href}`,beginsAt:epoch(date),bestOf:numeric(plain(first(row,'div','group-right')).replace(/^bo/i,'')),status:finished?'finished':'scheduled',teams});
  }
  const players: EventPlayer[]=[];
  for(const box of blocks(html,'div','team-box')) {
    const team=plain(first(box,'div','text'));
    for(const m of box.matchAll(/<a href="(\/player\/(\d+)\/[^\"]+)">([^<]+)<\/a>/g)) players.push({id:`hltv-${m[2]}`,name:plain(m[3]),team,sourceUrl:`https://www.hltv.org${m[1]}`,avatar:null,maps:null,kills:null,deaths:null,assists:null,adr:null,kast:null,providerScore:null});
  }
  return {id:event.id,matches:[...new Map(matches.map(m=>[m.id,m])).values()],players:[...new Map(players.map(p=>[p.id,p])).values()],maps:[],observedAt,statsObservedAt:null,sourceUrl:event.sourceUrl,statsUrl:event.statsUrl,saved:false,statsSaved:false};
}
export function normalizeName(value: string) {return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/[^\p{L}\p{N}]/gu,'');}
export function parseEventStats(html: string, roster: EventPlayer[]) {
  const section=html.slice(html.indexOf('At least half the maps'));
  const table=first(section,'table','w5-ent-table');
  const headers=[...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>plain(m[1]));
  // Do not shift columns silently if the provider changes its schema.
  if(headers.length!==9 || headers[1]!=='M' || headers[6]!=='ADR' || headers[7]!=='KAST') return {players:[],maps:[]};
  const players: EventPlayer[]=[];
  for(const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]); if(cells.length!==9) continue;
    const name=plain(first(cells[0],'span','w5-ent-person__nick')),sourceUrl=attr(cells[0],'href');
    const original=roster.find(p=>normalizeName(p.name)===normalizeName(name));
    const maps=numeric(cells[1]),providerScore=numeric(cells[8]);
    if(!name || !/^https:\/\/ensigame\.com\/players\/cs-2\//.test(sourceUrl) || !maps || maps>200 || providerScore==null || providerScore<0 || providerScore>10) continue;
    players.push({...original,id:original?.id || `ensi-${sourceUrl.split('/').at(-1)}`,name:original?.name || name,team:original?.team || '',sourceUrl,avatar:image(cells[0],'w5-ent-person__pic'),maps,kills:numeric(cells[2]),deaths:numeric(cells[3]),assists:numeric(cells[4]),adr:numeric(cells[6]),kast:numeric(cells[7]),providerScore});
  }
  const maps=blocks(html,'li','w5-tp-maps__row').flatMap(row=>{const name=plain(first(row,'span','w5-tp-maps__name')),count=numeric(first(row,'span','w5-tp-maps__count'));return name && count!=null ? [{name,count}] : [];});
  return {players,maps};
}
export function mergeStats(details: EventDetails, stats: ReturnType<typeof parseEventStats>, observedAt: string): EventDetails {
  if(!stats.players.length) return details;
  const ids=new Set(stats.players.map(p=>p.id));
  // A fresh provider-qualified subset replaces the previous subset. Retaining
  // unlisted numeric records would incorrectly give old stats a new timestamp.
  return {...details,players:[...stats.players,...details.players.filter(p=>!ids.has(p.id)).map(p=>({...p,maps:null,kills:null,deaths:null,assists:null,adr:null,kast:null,providerScore:null}))],maps:stats.maps,statsObservedAt:observedAt,statsSaved:false};
}
export function fuzzyScore(query: string, values: string[]): number {
  const q=normalizeName(query); if(!q) return 1;
  let best=0;
  for(const value of values) {
    const n=normalizeName(value); if(n===q) return 100;
    if(n.startsWith(q)) best=Math.max(best,90);
    else if(n.includes(q)) best=Math.max(best,70);
    else if(q.length>=3 && Math.abs(n.length-q.length)<=2) {
      let prev=Array.from({length:n.length+1},(_,i)=>i), before=prev;
      for(let i=1;i<=q.length;i++) {
        const row=[i];
        for(let j=1;j<=n.length;j++) {
          row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(q[i-1]===n[j-1]?0:1));
          if(i>1 && j>1 && q[i-1]===n[j-2] && q[i-2]===n[j-1]) row[j]=Math.min(row[j],before[j-2]+1);
        }
        before=prev;prev=row;
      }
      if(prev[n.length]<=Math.min(2,Math.floor(q.length/3))) best=Math.max(best,50-prev[n.length]);
    }
  }
  return best;
}
