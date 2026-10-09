import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const base='https://cs2pro.pages.dev',stamp=Date.now(),output='outputs/release-20261008-core';
async function json(path,options){const response=await fetch(base+path+(path.includes('?')?'&':'?')+'_core='+stamp,{...options,signal:AbortSignal.timeout(40000)});assert.equal(response.status,200,path);return response.json();}
const [event,lab,profile]=await Promise.all([json('/api/events/catalogue?event=8244'),json('/api/faceit/lab'),json('/api/players/donk666?playerId=e5e8e2a6-d716-4493-b949-e16965f41654')]);
const upcoming=event.details.matches.filter(m=>m.status==='scheduled');assert.ok(upcoming.length>=6);assert.ok(upcoming.some(m=>m.beginsAt.startsWith('2026-10-11')));assert.ok(upcoming.every(m=>m.teams.every(t=>t.score===null)));
assert.equal(event.details.ratingStatus,'unconfigured');assert.ok(event.details.players.every(p=>p.rating==null));
assert.equal(lab.storage,'persistent');const samples=lab.players.flatMap(p=>p.samples),advanced=samples.filter(s=>s.advancedObservedAt);assert.ok(advanced.length>=385);
const rows=profile.player.recentMatches.filter(m=>m.advancedObservedAt);assert.ok(rows.length>0);assert.ok(rows.some(m=>m.entryCount!=null&&m.utilityAdr!=null));
const match=await json(`/api/matches/${encodeURIComponent(rows[0].id)}`);
const participants=match.match.scoreboard.flatMap(t=>t.players);assert.ok(participants.some(p=>p.entryCount!=null));
const analysis=await json('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:'faceit',names:['donk666'],language:'zh',limit:10})});assert.equal(analysis.subjects,1);assert.ok(analysis.summary&&analysis.facts.length===1);
const report={checkedAt:new Date().toISOString(),site:base,upcoming:upcoming.map(m=>({id:m.id,date:m.beginsAt,round:m.round})),officialRating:event.details.ratingStatus,faceit:{samples:samples.length,advanced:advanced.length,ratingSamples:samples.filter(m=>m.rating!=null).length,swingSamples:samples.filter(m=>m.swing!=null).length},profile:{id:profile.player.id,advancedMatches:rows.length},match:{id:rows[0].id,participants:participants.length},analysis:{status:200,generated:analysis.generated,reason:analysis.reason,summary:analysis.summary}};
await mkdir(output,{recursive:true});await writeFile(output+'/core.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
