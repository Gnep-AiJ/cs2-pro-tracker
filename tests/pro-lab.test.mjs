import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {build} from 'esbuild';
async function pure(path){const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);}
const lab=await pure('app/lib/pro-lab.ts'),boards=await pure('app/lib/player-boards.ts');
const now='2026-10-08T03:00:00Z';
const match={id:'match1',playedAt:'2026-10-07T12:00:00Z',map:'mirage',sides:[['a','b','u1','u2','u3'],['c','u4','u5','u6','u7']],winner:0};
const players=['a','b','c'].map(id=>({id,eventPlayerId:`hltv-${id}`,name:id,lookup:id,directoryTeam:'directory',samples:[],checkedAt:now,historyCheckedAt:now}));
const state={version:1,observedAt:now,collectionStartedAt:now,players,matches:[match],coverage:{history:3,stats:3,requested:3,clipped:false}};
test('shared records are deduplicated across tracked histories and separate sides correctly',()=>{
  const merged=lab.mergePublicMatches([match],[{...match,map:null}],now);
  assert.equal(merged.matches.length,1);assert.equal(merged.matches[0].map,'mirage');
  const feed=lab.buildLabFeed({...state,matches:[match,match]},'persistent',Date.parse(now));
  assert.equal(feed.uniqueMatches,1);assert.equal(feed.pairs.length,3);
  assert.equal(feed.pairs.find(p=>p.ids.join()==='a,b').together,1);
  assert.equal(feed.pairs.find(p=>p.ids.join()==='a,c').against,1);
  const invalid=lab.buildLabFeed({...state,matches:[{...match,sides:[match.sides[0],['a',...match.sides[1].slice(1)]]}]});assert.equal(invalid.pairs.length,0);
  assert.equal(lab.buildLabFeed(state,'persistent',Date.parse(now)+13*3600000).stale,true);
});
test('history normalization requires a finished unique ten-player roster, not guessed parties',()=>{
  const row={match_id:'one',finished_at:1791374400,teams:{faction1:{players:match.sides[0].map(player_id=>({player_id}))},faction2:{players:match.sides[1].map(player_id=>({player_id}))}},results:{winner:'faction1'}};
  assert.equal(lab.readHistory({items:[row]})[0].winner,0);
  assert.equal(lab.readHistory({items:[{...row,finished_at:0}]}).length,0);
  assert.equal(lab.readHistory({items:[{...row,teams:{}}]}).length,0);
  assert.equal(lab.readHistory({items:[{...row,teams:{...row.teams,faction2:row.teams.faction1}}]}).length,0);
});
test('metrics keep zero values, exclude unknown results and use the window before map filters',()=>{
  const sample=(id,map,kills,deaths,adr,result='W')=>({id,map,kills,deaths,adr,result,kr:null,headshots:null,playedAt:now});
  const samples=[sample('1','mirage',20,0,100),sample('2','nuke',10,10,0,'L'),sample('3','mirage',null,5,null,null)];
  const all=lab.summarizeLab([...samples,samples[0]],20);
  assert.equal(all.matches,3);assert.equal(all.kd.value,3);assert.equal(all.kd.n,2);
  assert.equal(all.adr.value,50);assert.equal(all.adr.n,2);assert.equal(all.winRate.value,50);assert.equal(all.winRate.n,2);
  assert.equal(lab.summarizeLab(samples,2,'mirage').matches,1);
  assert.equal(lab.summarizeLab(samples,2,'mirage').kd.value,null);
  assert.equal(lab.summarizeLab(samples,20,'all','L').winRate.value,0);
  assert.equal(lab.summarizeLab([{...samples[0],playedAt:'2026-01-01'},samples[1]],20,'all','all','2026-09-08T00:00:00Z').matches,1);
  assert.equal(lab.summarizeLab([{...samples[0],playedAt:null}],20,'all','all','2026-09-08T00:00:00Z').matches,0);
});
test('rank eligibility uses metric coverage and ties retain cohort rank after search',()=>{
  const sample={id:'m',map:'mirage',kills:5,deaths:5,adr:90,kr:1,headshots:0,result:'W',playedAt:now};
  const group=players.map((p,i)=>({...p,samples:Array.from({length:5},(_,n)=>({...sample,id:`m${n}`,adr:i===2?null:90}))}));
  const ranks=lab.rankLab(group,'adr',20,'all',5);assert.equal(ranks.length,2);assert.deepEqual(ranks.map(p=>p.rank),[1,1]);
  assert.equal(ranks.filter(p=>p.player.id==='b')[0].rank,1);
  assert.equal(lab.rankLab(group,'adr',20,'all',10).length,0);
});
test('event ranks exclude missing metrics and short samples without inventing ratios',()=>{
  const entries=[{id:'a',maps:10,kills:100,deaths:50,adr:80,kast:70,providerScore:8},{id:'b',maps:4,kills:200,deaths:50,adr:120,kast:80,providerScore:9},{id:'c',maps:10,kills:null,deaths:50,adr:80,kast:null,providerScore:null}];
  assert.equal(boards.eventMetric(entries[2],'kd'),null);
  assert.deepEqual(boards.rankEventPlayers(entries,'adr',5).map(p=>p.rank),[1,1]);
  assert.equal(boards.rankEventPlayers(entries,'kast',5).length,1);
});
test('history retention excludes future records and reports an explicit cap',()=>{
  const out=lab.mergePublicMatches([],[match,{...match,id:'old',playedAt:'2026-01-01T00:00:00Z'},{...match,id:'future',playedAt:'2030-01-01T00:00:00Z'},{...match,id:'2'}],now,1);
  assert.equal(out.matches.length,1);assert.equal(out.clipped,true);
});
test('collector preserves the last good publication when all sources fail',async()=>{
  const compiled=await build({entryPoints:[new URL('../worker/pro-collector.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,write:false,format:'esm',platform:'node'});
  const {collectProData}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const previous=globalThis.fetch;let writes=0;
  globalThis.fetch=async()=>{throw new Error('upstream failed');};
  try {await assert.rejects(()=>collectProData({FACEIT_API_KEY:'test',PRO_DATA:{get:async()=>({json:async()=>state}),put:async()=>{writes++;}}},now),/stored observations preserved/);assert.equal(writes,0);}finally{globalThis.fetch=previous;}
});
test('published real observations preserve explicit identity joins and sample provenance',async()=>{
  const saved=JSON.parse(await readFile(new URL('../app/data/pro-lab-snapshot.json',import.meta.url),'utf8'));
  assert.equal(saved.players.length,20);assert.equal(new Set(saved.players.map(p=>p.id)).size,20);
  assert.ok(saved.uniqueMatches>0&&saved.pairs.length>0);assert.ok(saved.players.every(p=>/^hltv-\d+$/.test(p.eventPlayerId)));
  assert.ok(saved.players.every(p=>new Set(p.samples.map(s=>s.id)).size===p.samples.length&&p.checkedAt));
  assert.ok(saved.pairs.every(p=>p.matches.every(m=>m.id&&m.playedAt)&&p.together+p.against>0));
});
