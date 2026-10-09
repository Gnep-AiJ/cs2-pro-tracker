import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const headers={Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'};
async function json(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});return {status:response.status,body:await response.json()};}
const [schedule,feed,metrics]=await Promise.all([
 json(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/cs2pro-data/schedules`,{headers}),
 json(`https://cs2pro.pages.dev/api/faceit/lab?_verify=${Date.now()}`),
 json('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers,body:JSON.stringify({query:'query($accountTag:string,$start:string,$end:string){viewer{accounts(filter:{accountTag:$accountTag}){workersInvocationsAdaptive(limit:100,filter:{scriptName:"cs2pro-data",datetime_geq:$start,datetime_leq:$end}){sum{requests errors subrequests} dimensions{datetime scriptName status} quantiles{cpuTimeP50 cpuTimeP99}}}}}',variables:{accountTag:account,start:'2026-10-08T03:35:00Z',end:new Date().toISOString()}})})
]);
assert.equal(schedule.body.success,true);
assert.deepEqual(schedule.body.result.schedules.map(s=>s.cron),['17 */6 * * *']);
assert.equal(feed.status,200);assert.equal(feed.body.storage,'persistent');
const report={checkedAt:new Date().toISOString(),schedules:schedule.body.result.schedules.map(s=>s.cron),observedAt:feed.body.observedAt,players:feed.body.players.length,matches:feed.body.uniqueMatches,pairs:feed.body.pairs.length,coverage:feed.body.coverage,metricsStatus:metrics.status,metrics:metrics.body.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive||null,metricErrors:metrics.body.errors?.map(e=>e.message)||null};
await writeFile(process.argv[2]||'outputs/release-20261008/collector-readback.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
