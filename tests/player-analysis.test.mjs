import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../worker/player-analysis.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {explainPlayerResponse}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const payload={summary:'fallback',generated:false,reason:'unconfigured',language:'zh',domain:'events',facts:[{name:'donk',sampledMaps:10,kills:183,deaths:141,adr:91}]};
test('AI binding receives server facts and accepts a grounded sample summary',async()=>{
  let input;
  const response=await explainPlayerResponse(Response.json(payload),{run:async(_model,value)=>{input=value;return {response:JSON.stringify({summary:'donk 在 10 图样本中有 183 击杀，ADR 91。覆盖有限。'})};}});
  const output=await response.json();assert.equal(output.generated,true);assert.match(input.messages[1].content,/sampledMaps/);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('unsupported numbers, missing sample caveat and binding failures preserve data summary',async()=>{
  for(const summary of ['donk 在 10 图样本中 ADR 999。','donk ADR 91。','donk 在 10 图样本中 ADR 91。','donk 在 10 场样本中 ADR 91。覆盖有限。','donk 在 10 图样本中 kill-to-death 比率（KAST）为 91。']) {
    const response=await explainPlayerResponse(Response.json(payload),{run:async()=>({response:JSON.stringify({summary})})});assert.equal((await response.json()).summary,'fallback');
  }
  for(const ai of [undefined,{run:async()=>{throw new Error('unavailable');}}])assert.equal((await (await explainPlayerResponse(Response.json(payload),ai)).json()).generated,false);
  let called=false;const invalid=await explainPlayerResponse(Response.json({error:'invalid_request'},{status:400}),{run:async()=>{called=true;}});assert.equal(invalid.status,400);assert.equal(called,false);
});
