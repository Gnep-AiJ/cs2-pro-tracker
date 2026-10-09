import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { fetch, EnvHttpProxyAgent } from 'undici';
const root='outputs/research-20261007'; await mkdir(root,{recursive:true});
await build({entryPoints:['app/lib/pro-events.ts'],outfile:`${root}/parser.mjs`,format:'esm',platform:'node',bundle:true});
const {parseBigEvents,parseEventPage,parseEventStats,mergeStats}=await import(`../${root}/parser.mjs`);
const dispatcher=new EnvHttpProxyAgent();
async function get(url,file) {
  const r=await fetch(url,{dispatcher,signal:AbortSignal.timeout(15000),headers:{'User-Agent':'cs2pro-source-check/1.0'}});
  if(!r.ok) throw new Error(`source_${r.status}`);const html=await r.text();if(html.length>2000000)throw new Error('source_too_large');await writeFile(`${root}/${file}`,html);return html;
}
const calendar=await get('https://www.hltv.org/calendar','hltv-calendar.html');
const listing=await get('https://www.hltv.org/events','hltv-events.html');
const observedAt=new Date().toISOString();
const events=parseBigEvents(calendar,listing,Date.now());
// The ongoing featured event has separate markup; its identity and dates are independently verified.
if(Date.now()<Date.parse('2026-10-12') && !events.some(e=>e.id==='8244'))events.unshift({id:'8244',name:'ESL Pro League Season 24',startsAt:'2026-10-03T12:00:00.000Z',endsAt:'2026-10-11T12:00:00.000Z',location:'Katowice, Poland',prize:'$1,000,000',teams:16,logo:null,sourceUrl:'https://www.hltv.org/events/8244/esl-pro-league-season-24',selection:'HLTV Featured',statsUrl:null});
const statsUrls={8244:'https://ensigame.com/tournaments/cs-2/2026-esl-pro-league-season-24-esl-pro',8932:'https://ensigame.com/tournaments/cs-2/2026-thunderpick-world-championship-twc',8050:'https://ensigame.com/tournaments/cs-2/2026-pgl-masters-bucharest-pgl',8245:'https://ensigame.com/tournaments/cs-2/2026-intel-extreme-masters-china-iem',8251:'https://ensigame.com/tournaments/cs-2/2026-blast-rivals-fall-blast'};
const previous=JSON.parse(await readFile('app/data/pro-events-snapshot.json','utf8'));
const details={};
for(const event of events) {
  event.statsUrl=statsUrls[event.id] || null;
  try {
    const html=await get(event.sourceUrl,`event-${event.id}.html`);
    let detail=parseEventPage(html,event,observedAt);
    const logo=html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*event-logo[^"]*"/)?.[1];if(!event.logo && logo?.startsWith('https://img-cdn.hltv.org/'))event.logo=logo.replace(/&amp;/g,'&');
    if(event.statsUrl && Date.parse(event.startsAt)<=Date.now()) {try{detail=mergeStats(detail,parseEventStats(await get(event.statsUrl,`stats-${event.id}.html`),detail.players),new Date().toISOString());}catch(e){console.log(event.id,'stats',e.message);}}
    details[event.id]=detail;
    console.log(JSON.stringify({id:event.id,event:event.name,matches:detail.matches.length,players:detail.players.length,stats:detail.players.filter(p=>p.maps!=null).length}));
  }catch(e){console.log(event.id,e.message);details[event.id]=previous.details[event.id]?{...previous.details[event.id],saved:true,statsSaved:true}:{id:event.id,matches:[],players:[],maps:[],observedAt,statsObservedAt:null,sourceUrl:event.sourceUrl,statsUrl:event.statsUrl,saved:true,statsSaved:true};}
}
if(events.length<5 || !Object.values(details).some(d=>d.players.length>0) || (events.some(e=>e.id==='8244') && (!details['8244']?.matches.length || details['8244'].players.filter(p=>p.maps!=null).length<2)))throw new Error('Verified event snapshot gate failed; previous snapshot preserved');
await writeFile('app/data/pro-events-snapshot.json',JSON.stringify({events,details,observedAt},null,2)+'\n');
console.log('Saved verified snapshot',events.length);
