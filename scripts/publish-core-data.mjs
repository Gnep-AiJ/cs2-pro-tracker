import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const output='outputs/release-20261008-core',account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw new Error('Missing Cloudflare credentials');
async function cloud(path){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});const d=await r.json();assert.ok(r.ok&&d.success,`Cloudflare read failed: ${r.status}`);return d.result;}
async function wrangler(args){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs',MINIFLARE_REGISTRY_PATH:'.wrangler/registry'}});p.on('error',reject);p.on('exit',n=>n===0?resolve():reject(new Error(`Wrangler exit ${n}`)));});}
const state=JSON.parse(await readFile('outputs/pro-lab/state/v1.json','utf8')),feed=JSON.parse(await readFile('outputs/pro-lab/public/v1.json','utf8'));
assert.equal(state.version,1);assert.equal(feed.players.length,20);assert.equal(state.coverage.history,20);assert.equal(state.coverage.stats,20);
const samples=feed.players.flatMap(p=>p.samples),advanced=samples.filter(s=>s.advancedObservedAt);
assert.ok(advanced.length>=300);assert.equal(feed.observedAt,state.observedAt);
const secrets=await cloud('/workers/scripts/cs2pro-data/secrets');assert.ok(secrets.some(s=>s.name==='FACEIT_API_KEY'));
await mkdir(output,{recursive:true});
for(const name of ['state','public'])await wrangler(['r2','object','get',`cs2pro-data/${name}/v1.json`,'--file',`${output}/rollback-${name}.json`,'--remote','--config','collector.wrangler.jsonc']);
const archive=(await readdir('outputs/pro-lab/observations')).sort().at(-1);
assert.equal(JSON.parse(await readFile(`outputs/pro-lab/observations/${archive}`,'utf8')).observedAt,state.observedAt);
for(const key of [`observations/${archive}`,'state/v1.json','public/v1.json'])await wrangler(['r2','object','put',`cs2pro-data/${key}`,'--file',`outputs/pro-lab/${key}`,'--content-type','application/json','--remote','--config','collector.wrangler.jsonc']);
await wrangler(['deploy','--config','collector.wrangler.jsonc']);
const after=await cloud('/workers/scripts/cs2pro-data/secrets');assert.ok(after.some(s=>s.name==='FACEIT_API_KEY'));
const schedules=await cloud('/workers/scripts/cs2pro-data/schedules');
await writeFile(`${output}/collector.json`,JSON.stringify({name:'cs2pro-data',bucket:'cs2pro-data',schedules,observedAt:feed.observedAt,samples:samples.length,advanced:advanced.length,rating:samples.filter(s=>s.rating!=null).length,secretNames:after.map(s=>s.name),rollback:['rollback-state.json','rollback-public.json']},null,2));
console.log(JSON.stringify({published:'cs2pro-data',observedAt:feed.observedAt,samples:samples.length,advanced:advanced.length,schedules}));
