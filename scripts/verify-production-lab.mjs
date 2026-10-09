import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const base='https://cs2pro.pages.dev',stamp=Date.now(),output=process.argv[2]||'outputs/release-20261008';
async function json(path){const r=await fetch(`${base}${path}${path.includes('?')?'&':'?'}_audit=${stamp}`,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);return r.json();}
const [lab,event,future,search,donk,magixx]=await Promise.all([
 json('/api/faceit/lab'),json('/api/events/catalogue?event=8244'),json('/api/events/catalogue?event=8932'),json('/api/search/players?domain=faceit&q=dnok'),json('/api/players/donk666?playerId=e5e8e2a6-d716-4493-b949-e16965f41654'),json('/api/players/lilpeepfan-?playerId=1ace868a-d60c-46b8-a61e-f51d40d0305b')
]);
assert.equal(lab.storage,'persistent');assert.equal(lab.players.length,20);assert.ok(lab.uniqueMatches>0&&lab.pairs.length>0);
assert.ok(event.details.players.length>=20&&event.events.length>=5);assert.ok(future.details.players.every(p=>p.maps===null&&p.adr===null&&p.providerScore===null));
assert.ok(search.items.some(p=>p.id==='e5e8e2a6-d716-4493-b949-e16965f41654'));
assert.equal(donk.player.id,'e5e8e2a6-d716-4493-b949-e16965f41654');assert.equal(magixx.player.id,'1ace868a-d60c-46b8-a61e-f51d40d0305b');
assert.ok(donk.player.recentMatches.length>0&&magixx.player.recentMatches.length>0);
const html=[];
for(const path of ['/?lang=zh','/faceit?lang=zh&section=rankings','/players/donk666?lang=zh&playerId=e5e8e2a6-d716-4493-b949-e16965f41654']) {
 const r=await fetch(base+path,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const source=await r.text();
 if(path.startsWith('/?'))assert.ok(source.includes('event-picker-title')&&source.includes('Match centre'),'Published event chooser and reading order');
 if(path.startsWith('/faceit'))assert.ok(source.includes('Pro player form'),'Published FACEIT player board');
 const assets=[...new Set([...source.matchAll(/(?:src|href)="(\/assets\/[^"?]+\.(?:js|css))/g)].map(m=>m[1]))];
 assert.ok(assets.length>0);html.push({path,status:r.status,assets});
}
const assets=[...new Set(html.flatMap(r=>r.assets))];
const checked=await Promise.all(assets.map(async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);assert.ok(/javascript|text\/css/.test(r.headers.get('content-type')||''));await r.arrayBuffer();return {path,status:r.status,type:r.headers.get('content-type')};}));
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/cs2pro`,{headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},signal:AbortSignal.timeout(20000)});
const cloud=await response.json();assert.equal(cloud.success,true);const config=cloud.result.deployment_configs.production;
assert.equal(config.r2_buckets?.PRO_DATA?.name,'cs2pro-data');assert.ok(config.env_vars?.FACEIT_API_KEY);
const report={checkedAt:new Date().toISOString(),deployment:cloud.result.canonical_deployment.id,site:base,bindings:{r2:config.r2_buckets,secretNames:Object.keys(config.env_vars),ai:config.ai_bindings},lab:{observedAt:lab.observedAt,storage:lab.storage,players:lab.players.length,matches:lab.uniqueMatches,pairs:lab.pairs.length,coverage:lab.coverage},events:{events:event.events.length,fixtures:event.details.matches.length,roster:event.details.players.length,stats:event.details.players.filter(p=>p.maps!=null).length,futureStatisticsWithheld:true},search:true,profiles:[donk,magixx].map(p=>({id:p.player.id,name:p.player.nickname,matches:p.player.recentMatches.length})),html,assets:checked};
await mkdir(output,{recursive:true});await writeFile(`${output}/production.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,html:html.map(p=>({path:p.path,status:p.status})),assets:checked.length},null,2));
