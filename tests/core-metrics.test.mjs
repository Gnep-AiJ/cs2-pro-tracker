import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
async function module(path){const result=await build({entryPoints:[new URL(`../${path}`,import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);}
const lab=await module('app/lib/pro-lab.ts'),events=await module('app/lib/pro-events.ts'),ratings=await module('app/lib/rating-feed.ts');
const profileArchive=await module('app/lib/profile-archive.ts'),profileData=await module('worker/profile-data.ts');
test('persistent player enrichment joins exact identities, preserves fresh zeroes and rejects future observations',()=>{
 const now=Date.parse('2026-10-08T12:00:00Z'),observedAt='2026-10-08T06:00:00Z';
 const player={id:'one',recentMatches:[{id:'a',adr:0,kills:20,rating:null},{id:'b',adr:null,rating:1.1}]};
 const feed={version:1,observedAt,storage:'persistent',players:[{id:'one',samples:[{id:'a',adr:90,kills:25,entryCount:4,entryWins:2,advancedObservedAt:observedAt},{id:'b',adr:80,rating:1.4,advancedObservedAt:observedAt},{id:'c',adr:100,advancedObservedAt:observedAt}]}]};
 const result=profileArchive.enrichProfileWithArchive(player,feed,now);
 assert.equal(result.recentMatches.length,2);assert.equal(result.recentMatches[0].adr,0);assert.equal(result.recentMatches[0].kills,20);assert.equal(result.recentMatches[0].entryWins,2);
 assert.equal(result.recentMatches[1].rating,1.1);assert.equal(result.recentMatches[1].adr,80);assert.equal(result.archive.storage,'persistent');
 assert.deepEqual(profileArchive.enrichProfileWithArchive({...player,id:'other'},feed,now).recentMatches,player.recentMatches);
 assert.equal(profileArchive.enrichProfileWithArchive(player,{...feed,observedAt:'2030-01-01'},now),player);
 assert.equal(profileArchive.enrichProfileWithArchive(player,feed,now+24*3600000).archive.stale,true);
 const newer={...feed,players:[{id:'one',samples:[{...feed.players[0].samples[0],entryWins:3}]}]};
 assert.equal(profileArchive.enrichProfileWithArchive(result,newer,now).recentMatches[0].entryWins,3);
});
test('recent form uses disjoint complete five-match windows and never compares sparse samples',()=>{
 const rows=Array.from({length:10},(_,i)=>({id:String(i),adr:i<5?100:80,kr:i<5?1:0.8}));
 assert.equal(profileArchive.recentFormChange(rows).adr,20);
 assert.ok(Math.abs(profileArchive.recentFormChange(rows).kr-0.2)<1e-8);
 assert.equal(profileArchive.recentFormChange(rows.slice(0,9)).adr,null);
 assert.equal(profileArchive.recentFormChange([rows[0],...rows]).adr,20);
 assert.equal(profileArchive.recentFormChange(rows.map((r,i)=>i===7?{...r,adr:null}:r)).adr,null);
});
test('analysis enrichment retains the selected match window and excludes other player and map samples',async()=>{
 const observedAt=new Date().toISOString(),feed={version:1,observedAt,players:[{id:'one',samples:[{id:'a',entryCount:10,entryWins:5,advancedObservedAt:observedAt},{id:'excluded',entryCount:20,entryWins:20,advancedObservedAt:observedAt}]},{id:'two',samples:[{id:'a',entryCount:10,entryWins:10,advancedObservedAt:observedAt}]}]};
 const bucket={get:async()=>({size:1000,json:async()=>feed})};
 const response=await profileData.enrichAnalysisResponse(Response.json({domain:'faceit',language:'zh',facts:[{name:'one',playerId:'one',matchIds:['a'],matches:1,wins:1,adr:{value:90,count:1}}]}),bucket);
 const value=await response.json();assert.equal(value.facts[0].entrySuccess.value,50);assert.equal(value.facts[0].entrySuccess.n,1);assert.equal(value.facts[0].rating.value,null);assert.equal(value.facts[0].playerId,undefined);assert.match(value.summary,/ADR 90.0/);assert.match(value.summary,/50.0%/);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('storage failures and oversized or invalid feeds preserve a dated fallback',async()=>{
 for(const bucket of [{get:async()=>{throw new Error('offline');}},{get:async()=>({size:3000000,json:async()=>{throw new Error('should not read');}})},{get:async()=>({size:5,json:async()=>({version:1,observedAt:'2030-01-01',players:[]})})}]){
   const feed=await profileData.readProfileArchive(bucket);assert.equal(feed.storage,'snapshot');assert.ok(feed.players.length>=20);
 }
 const error=Response.json({error:'bad'},{status:400});assert.equal(await profileData.enrichPlayerResponse(error),error);
});
test('published knockout data includes future event dates and TBA finals, not only today',async()=>{
 const html=await readFile(new URL('./fixtures/epl-bracket-20261008.html',import.meta.url),'utf8');
 const parsed=events.parseEventPage(html,{id:'8244',sourceUrl:'https://www.hltv.org/events/8244/esl-pro-league-season-24'},'2026-10-08T00:00:00Z');
 assert.equal(parsed.matches.length,6);assert.ok(parsed.matches.every(m=>m.status==='scheduled'&&m.teams.every(t=>t.score===null)));
 assert.equal(parsed.matches.find(m=>m.id==='2398757').beginsAt,'2026-10-11T15:00:00.000Z');
 assert.equal(parsed.matches.find(m=>m.id==='2398753').teams[0].name,'Falcons');
 assert.equal(parsed.matches.find(m=>m.id==='2398757').teams[0].name,'TBA');
 assert.equal(events.parseEventPage('<div data-slotted-bracket-json="invalid"></div>',{id:'8244'},'2026-10-08').matches.length,0);
});
test('named official rating and negative swing are preserved; score, K/D and missing fields never become rating',()=>{
 assert.equal(lab.readAdvanced({Score:42,'K/D Ratio':2}).rating,null);
 assert.equal(lab.readAdvanced({Rating:'1.21','Round Swing':'-2.34%'}).rating,1.21);
 assert.equal(lab.readAdvanced({Rating:'1.21','Round Swing':'-2.34%'}).swing,-2.34);
 assert.equal(lab.readAdvanced({'Entry Count':2,'Entry Wins':3}).entryWins,null);
 assert.equal(lab.readAdvanced({Rating:true}).rating,null);
});
test('entry and clutch rates use total attempts, exclude missing data, and retain genuine zero wins',()=>{
 const samples=[{id:'a',entryCount:10,entryWins:5,clutch1Count:1,clutch1Wins:0,clutch2Count:1,clutch2Wins:0},{id:'b',entryCount:2,entryWins:2,clutch1Count:0,clutch1Wins:0,clutch2Count:0,clutch2Wins:0},{id:'c',entryCount:null,entryWins:null}];
 const result=lab.summarizeLab(samples);
 assert.equal(result.entrySuccess.value,7/12*100);assert.equal(result.entrySuccess.n,2);assert.equal(result.entrySuccess.attempts,12);
 assert.equal(result.clutchSuccess.value,0);assert.equal(result.clutchSuccess.attempts,2);
 assert.equal(result.rating.value,null);assert.equal(result.rating.n,0);
 assert.equal(lab.summarizeLab([{id:'none',clutch1Count:0,clutch1Wins:0,clutch2Count:0,clutch2Wins:0}]).clutchSuccess.value,null);
});
test('multi-map or invalid detailed responses cannot silently enrich a single recent-match sample',()=>{
 const round={teams:[{players:[{player_id:'one',player_stats:{'First Kills':3,'Entry Count':4,'Entry Wins':3}}]}]};
 assert.equal(lab.readMatchAdvanced({rounds:[round]})[0].stats.firstKills,3);
 assert.equal(lab.readMatchAdvanced({rounds:[round,round]}).length,0);
});
test('official event ratings require event, identity, version, source, date and their own sample count',()=>{
 const detail={id:'8244',players:[{id:'hltv-21167',maps:9,providerScore:8}]};
 const row={eventId:'8244',playerId:'hltv-21167',version:'3.0',value:1.2,maps:6,sourceUrl:'https://www.hltv.org/stats/players/21167/donk',observedAt:'2026-10-08T00:00:00Z'};
 const result=ratings.mergeOfficialRatings(detail,{version:1,ratings:[row]},Date.parse('2026-10-08T12:00:00Z'));
 assert.equal(result.players[0].rating,1.2);assert.equal(result.players[0].ratingMaps,6);assert.equal(result.players[0].maps,9);assert.equal(result.players[0].providerScore,8);
 for(const changed of [{eventId:'999'},{version:'ENSI'},{sourceUrl:'https://example.com/'},{value:'1.2'},{observedAt:'2030-01-01'}])assert.equal(ratings.mergeOfficialRatings(detail,{version:1,ratings:[{...row,...changed}]},Date.parse('2026-10-08T12:00:00Z')).players[0].rating,null);
 assert.equal(ratings.mergeOfficialRatings(detail,{version:1,ratings:[row,row,row]},Date.parse('2026-10-08T12:00:00Z')).players[0].rating,null);
});
test('real published advanced samples have explicit provenance and do not fabricate Rating',async()=>{
 const feed=JSON.parse(await readFile(new URL('../app/data/pro-lab-snapshot.json',import.meta.url),'utf8'));
 const samples=feed.players.flatMap(p=>p.samples);assert.ok(samples.filter(s=>s.advancedObservedAt&&s.entryCount!=null).length>300);
 assert.ok(samples.every(s=>s.rating==null||typeof s.rating==='number'&&s.rating>=0&&s.advancedObservedAt));
 assert.ok(samples.every(s=>s.entryWins==null||s.entryCount==null||s.entryWins<=s.entryCount));
});
test('a scheduled collection respects the bounded detail budget and deduplicates requests',async()=>{
 const {collectProData}=await module('worker/pro-collector.ts');const previous=globalThis.fetch;let calls=0,stored=null;
 globalThis.fetch=async url=>{calls++;const path=new URL(url).pathname;
   if(path.includes('/matches/')){const id=path.split('/')[4];return Response.json({rounds:[{teams:[{players:[{player_id:id,player_stats:{'Entry Count':4,'Entry Wins':2}}]}]}]});}
   const id=path.split('/')[4];return Response.json({items:path.includes('/history')?[]:[{created_at:1791399600,stats:{'Match Id':id,Map:'de_mirage',Kills:20,Deaths:15,ADR:80}}]});
 };
 try{await collectProData({FACEIT_API_KEY:'test',PRO_DATA:{get:async()=>null,put:async(key,value)=>{if(key==='state/v1.json')stored=JSON.parse(value);return {etag:'test'};}}},'2026-10-08T06:00:00Z');
   assert.equal(calls,44);assert.equal(stored.players.flatMap(p=>p.samples).filter(s=>s.advancedObservedAt).length,4);
 }finally{globalThis.fetch=previous;}
});
