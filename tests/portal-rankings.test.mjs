import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
async function moduleFor(path,plugins=[]){const out=await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'native-next',setup(b){b.onResolve({filter:/^next\/server$/},()=>({path:new URL('../node_modules/next/server.js',import.meta.url).href,external:true}));}},...plugins]});return import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text+'\n//'+Math.random()).toString('base64'));}
test('comparison uses visible precision, preserves signed values and does not rank neutral sample counts',async()=>{
 const {comparisonWinner}=await moduleFor('app/lib/ranking-view.ts');
 assert.equal(comparisonWinner([1.43,1.22]),0);assert.equal(comparisonWinner([-3,-1]),1);
 assert.equal(comparisonWinner([0,0]),-1);assert.equal(comparisonWinner([0.004,0.003],'higher',2),-1);
 assert.equal(comparisonWinner([20,10],'lower'),1);assert.equal(comparisonWinner([20,10],'neutral'),null);
 assert.equal(comparisonWinner([null,2]),null);assert.equal(comparisonWinner([NaN,2]),null);
});
test('top ten is recomputed for each metric with null excluded, zero preserved and stable identity ties',async()=>{
 const {topTracked}=await moduleFor('app/lib/ranking-view.ts');
 const players=Array.from({length:12},(_,i)=>({id:String(i).padStart(2,'0'),elo:100+i,matches:12-i,winRate:i===0?null:i}));
 assert.equal(topTracked(players,'elo').length,10);assert.equal(topTracked(players,'elo')[0].id,'11');
 assert.equal(topTracked(players,'matches')[0].id,'00');assert.equal(topTracked(players,'winRate')[0].id,'11');
 assert.deepEqual(topTracked([{id:'b',elo:0},{id:'a',elo:0},{id:'x',elo:null}],'elo').map(p=>p.id),['a','b']);
});
test('tracked ranking reads immutable profiles, caches concurrent requests, preserves genuine zero and marks partial responses no-store',async()=>{
 const oldFetch=globalThis.fetch,oldKey=process.env.FACEIT_API_KEY;process.env.FACEIT_API_KEY='test-only';let calls=0;
 try{
 const route=await moduleFor('app/api/faceit/tracked-rankings/route.ts',[{name:'roster',setup(b){b.onResolve({filter:/data\/tracked-players$/},()=>({path:'roster',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"export const trackedPlayers=[{faceitPlayerId:'id-a',display:'A',team:'A'},{faceitPlayerId:'id-b',display:'B',team:'B'}]"}));}}]);
 globalThis.fetch=async url=>{calls++;const a=String(url).includes('id-a');return Response.json(String(url).endsWith('/stats/cs2')?{lifetime:{Matches:'0','Win Rate %':'0'}}:{player_id:a?'id-a':'wrong-id',nickname:'A',games:{cs2:{faceit_elo:2000,skill_level:8}}});};
 const responses=await Promise.all([route.GET(),route.GET()]);assert.equal(calls,4);
 const data=await responses[0].json();assert.equal(data.items.length,1);assert.equal(data.items[0].matches,0);assert.equal(data.items[0].winRate,0);assert.equal(data.partial,true);assert.equal(responses[0].headers.get('cache-control'),'no-store');
 await route.GET();assert.equal(calls,4);
 }finally{globalThis.fetch=oldFetch;if(oldKey==null)delete process.env.FACEIT_API_KEY;else process.env.FACEIT_API_KEY=oldKey;}
});

// Search must remain broader than the curated team directory.
test('player search resolves common aliases to the verified m0NESY ID without a name lookup',async()=>{
 const route=await moduleFor('app/api/search/players/route.ts');const oldFetch=globalThis.fetch;
 try {globalThis.fetch=async()=>{throw new Error('unexpected upstream lookup');};
 for(const q of ['monesy','m0NESY','m0ensy','moensy','simple','s1mple','s1mplecsgod']) {
  const response=await route.GET(new Request('http://local/api/search/players?domain=faceit&q='+q));const data=await response.json();
  assert.equal(data.items[0].id,['simple','s1mple','s1mplecsgod'].includes(q)?'ac71ba3c-d3d4-45e7-8be2-26aa3986867d':'93306681-bce6-4369-8c41-e0bdba2597ed');assert.equal(data.items[0].verified,true);
 }
 }finally{globalThis.fetch=oldFetch;}
});
test('unlisted names use exact FACEIT lookup, prioritize it, deduplicate IDs, and expose outages',async()=>{
 const route=await moduleFor('app/api/search/players/route.ts');const oldFetch=globalThis.fetch,oldKey=process.env.FACEIT_API_KEY;process.env.FACEIT_API_KEY='test-only';
 const id='11111111-1111-1111-1111-111111111111';
 try {
 const urls=[];globalThis.fetch=async url=>{urls.push(String(url));return Response.json(String(url).includes('/search/')?{items:[{player_id:id,nickname:'external-player'},{player_id:'22222222-2222-2222-2222-222222222222',nickname:'external-player-fan'}]}:{player_id:id,nickname:'external-player'});};
 const result=await (await route.GET(new Request('http://local/api/search/players?domain=faceit&q=external-player'))).json();
 assert.equal(result.items[0].id,id);assert.equal(result.items[0].verified,false);assert.equal(result.items.filter(p=>p.id===id).length,1);assert.ok(urls.every(u=>u.includes('external-player')));assert.equal(urls.length,2);
 globalThis.fetch=async()=>{throw new Error('offline');};const failed=await route.GET(new Request('http://local/api/search/players?domain=faceit&q=unlisted'));
 assert.equal((await failed.json()).partial,true);assert.equal(failed.headers.get('cache-control'),'no-store');
 }finally{globalThis.fetch=oldFetch;if(oldKey==null)delete process.env.FACEIT_API_KEY;else process.env.FACEIT_API_KEY=oldKey;}
});
test('match player filtering uses IDs and preserves saved tracked-only observations',async()=>{
 const {selectMatches}=await moduleFor('app/lib/faceit-matches.ts');
 const rows=[{id:'a',playedAt:'2026-10-09',tracked:[{id:'real',display:'donk'}],teams:[]},{id:'b',playedAt:'2026-10-08',tracked:[{id:'other',display:'donk'}],teams:[]}];
 assert.deepEqual(selectMatches(rows,'','all','recent',null,'real').map(r=>r.id),['a']);assert.equal(selectMatches(rows,'','all','recent',null,'missing').length,0);assert.equal(selectMatches(rows,'','all','recent',null).length,2);assert.equal(selectMatches(rows,'donk','all','recent',null).length,0);
 const verified={...rows[0],tracked:[{id:'93306681-bce6-4369-8c41-e0bdba2597ed',display:'m0NESY'}]};assert.equal(selectMatches([verified],'m0ensy','all','recent',null).length,1);
});
