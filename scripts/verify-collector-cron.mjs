import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
setGlobalDispatcher(new EnvHttpProxyAgent());
const account=process.env.CLOUDFLARE_ACCOUNT_ID,headers={Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'};
const url=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/cs2pro-data/schedules`;
async function schedule(cron){const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify([{cron}]),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.success)throw new Error(`Cannot configure cs2pro scheduled validation: ${r.status}`);}
const saved=JSON.parse(await readFile('outputs/release-20261008/collector.json','utf8'));
const original=saved.schedules.schedules.map(s=>({cron:s.cron}));
if(original.length!==1||original[0].cron!=='17 */6 * * *')throw new Error('Unexpected cs2pro schedule; stop without changing it');
let tail;
let buffer='';
try {
 await schedule('* * * * *');console.log('Temporary cs2pro-only scheduled smoke test; final schedule will be restored.');
 const result=await new Promise((resolve,reject)=>{
   tail=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','tail','cs2pro-data','--format','json','--config','collector.wrangler.jsonc'],{env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs'},stdio:['ignore','pipe','pipe']});
   // Cloudflare documents up to 15 minutes for schedule propagation.
   const timeout=setTimeout(()=>{tail.kill();reject(new Error('No successful production scheduled invocation within 20 minutes'));},1200000);
   tail.stdout.on('data',chunk=>{const text=chunk.toString();buffer+=text;if(/\\?"event\\?"\s*:\s*\\?"cs2pro_collection\\?"/.test(buffer)){clearTimeout(timeout);tail.kill();resolve(buffer);}if(buffer.length>100000)buffer=buffer.slice(-50000);});
   tail.stderr.on('data',chunk=>{const text=chunk.toString();if(text.includes('ERROR'))console.log('Collector tail reported an error; stored observations remain available.');});
   tail.on('error',error=>{clearTimeout(timeout);reject(error);});
 });
 await writeFile('outputs/release-20261008/production-cron.log',result);console.log('Observed a successful production cs2pro collection.');
}finally{
 if(tail)tail.kill();await schedule(original[0].cron);console.log('Restored cs2pro schedule: 17 */6 * * *');
 await writeFile('outputs/release-20261008/production-cron.log',buffer);
}
