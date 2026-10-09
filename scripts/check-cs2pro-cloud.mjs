import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { mkdir, writeFile } from 'node:fs/promises';
setGlobalDispatcher(new EnvHttpProxyAgent());
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const headers={Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`};
const paths=['tokens/verify','pages/projects/cs2pro','r2/buckets/cs2pro-data'];
const report=[];
for(const path of paths){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`,{headers,signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 report.push({path,status:response.status,success:data.success,errors:data.errors?.map(e=>({code:e.code,message:e.message})),result:path.includes('pages/')?{name:data.result?.name,production:data.result?.canonical_deployment?.id,bindings:Object.keys(data.result?.deployment_configs?.production?.env_vars || {}),r2:data.result?.deployment_configs?.production?.r2_buckets}:path.includes('r2/')?{name:data.result?.name}: {status:data.result?.status}});
 if(path.includes('pages/')&&data.success){await mkdir('outputs/release-20261008',{recursive:true});await writeFile('outputs/release-20261008/before.json',JSON.stringify({id:data.result?.canonical_deployment?.id,url:data.result?.canonical_deployment?.url,r2:data.result?.deployment_configs?.production?.r2_buckets},null,2));}
}
console.log(JSON.stringify(report,null,2));
