import {spawn} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token||!process.env.FACEIT_API_KEY)throw new Error('Required cs2pro credentials are missing');
async function wrangler(args){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{stdio:'inherit',env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Wrangler exited ${code}`)));});}
const state=JSON.parse(await readFile('outputs/pro-lab/state/v1.json','utf8'));
if(state.version!==1||state.players.length!==20||state.coverage.history!==20||state.coverage.stats!==20)throw new Error('Initial collection is incomplete; refuse seed publication');
const archive=(await readdir('outputs/pro-lab/observations')).sort().at(-1);
for(const key of [`observations/${archive}`,'state/v1.json','public/v1.json'])await wrangler(['r2','object','put',`cs2pro-data/${key}`,'--file',`outputs/pro-lab/${key}`,'--content-type','application/json','--remote','--config','collector.wrangler.jsonc']);
await wrangler(['deploy','--config','collector.wrangler.jsonc']);
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/cs2pro-data/secrets`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:'FACEIT_API_KEY',text:process.env.FACEIT_API_KEY,type:'secret_text'}),signal:AbortSignal.timeout(20000)});
const data=await response.json();if(!response.ok||!data.success)throw new Error(`cs2pro collector secret configuration failed: ${response.status}`);
console.log('Configured FACEIT_API_KEY only on cs2pro-data.');
const schedule=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/cs2pro-data/schedules`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
const scheduled=await schedule.json();if(!schedule.ok||!scheduled.success)throw new Error('Cannot verify collector schedule');
await writeFile('outputs/release-20261008/collector.json',JSON.stringify({name:'cs2pro-data',bucket:'cs2pro-data',schedules:scheduled.result,seedObservedAt:state.observedAt,seedMatches:state.matches.length},null,2));
console.log(JSON.stringify({name:'cs2pro-data',schedules:scheduled.result},null,2));
