import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code=await readFile(new URL('../app/lib/pro-events.ts',import.meta.url),'utf8');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const parser=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const snapshot=JSON.parse(await readFile(new URL('../app/data/pro-events-snapshot.json',import.meta.url),'utf8'));

test('published big-event calendar and future statistics preserve provenance',()=>{
  assert.ok(snapshot.events.length>=5);
  for(const e of snapshot.events){assert.ok(e.sourceUrl.startsWith('https://www.hltv.org/events/'));assert.ok(Date.parse(e.endsAt)>=Date.parse(e.startsAt));}
  assert.ok(snapshot.details['8244'].matches.length>=30);
  assert.equal(snapshot.details['8244'].players.length,80);
  for(const id of ['8932','8245'])assert.ok(snapshot.details[id].players.every(p=>p.maps===null&&p.adr===null&&p.providerScore===null));
});
test('fuzzy identity matching supports partial names, case, leet and typos',()=>{
  assert.equal(parser.fuzzyScore('don',['donk']),90);
  assert.equal(parser.fuzzyScore('monesy',['m0NESY-']),100);
  assert.equal(parser.fuzzyScore('ZYWO',['ZywOo']),90);
  assert.ok(parser.fuzzyScore('dnok',['donk'])>0);
  assert.equal(parser.fuzzyScore('football',['donk','Spirit']),0);
});
test('score parser does not turn scheduled zero placeholders into results',()=>{
  const event=snapshot.events[0];
  const pair='<div class="group-team team-1 text-ellipsis"><span class="text-ellipsis">A</span></div><div class="group-team team-2 text-ellipsis"><span class="text-ellipsis">B</span></div>';
  const row=`<a href="/matches/1/a-b" class="bottom-row"><div data-unix="1791383400000"></div>${pair}<div class="group-right">bo3</div></a>`;
  const d=parser.parseEventPage(row,event,'2026-10-07T00:00:00Z');
  assert.equal(d.matches[0].status,'scheduled');assert.deepEqual(d.matches[0].teams.map(t=>t.score),[null,null]);
  const result=parser.parseEventPage(row.replace('</a>','<div class="score-left">2</div><div class="score-right">0</div></a>'),event,'2026-10-07T00:00:00Z');
  assert.equal(result.matches[0].status,'finished');assert.deepEqual(result.matches[0].teams.map(t=>t.score),[2,0]);
  assert.equal(parser.parseEventPage('<div>challenge</div>',event,'2026-10-07').matches.length,0);
});
test('provider data stays on its own scale and K/D comes from observed totals',()=>{
  const d=snapshot.details['8244'];const p=d.players.find(p=>p.name==='donk');
  assert.equal(p.kills,183);assert.equal(p.deaths,141);assert.equal(p.adr,91);
  assert.ok(p.providerScore>=0&&p.providerScore<=10);
  assert.equal(parser.parseEventStats('<table class="w5-ent-table"><th>changed schema</th></table>',d.players).players.length,0);
});
test('a fresh provider subset does not renew the timestamp of unlisted old statistics',()=>{
  const old=snapshot.details['8244'];const first={...old.players[0],maps:12};
  const merged=parser.mergeStats(old,{players:[first],maps:[]},'2026-10-08T00:00:00Z');
  assert.equal(merged.players.find(p=>p.id===first.id).maps,12);
  assert.ok(merged.players.filter(p=>p.id!==first.id).every(p=>p.maps===null&&p.adr===null&&p.providerScore===null));
  assert.equal(merged.players.length,old.players.length);
});
