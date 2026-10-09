import {EnvHttpProxyAgent,setGlobalDispatcher} from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
for(const path of ['workers/account-settings','workers/scripts/cs2pro-data/settings']) {
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/${path}`,{headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},signal:AbortSignal.timeout(20000)}),d=await r.json();
 console.log(JSON.stringify({path,status:r.status,success:d.success,usageModel:d.result?.usage_model,defaultUsageModel:d.result?.default_usage_model,bindings:d.result?.bindings?.map(b=>({name:b.name,type:b.type,bucket_name:b.bucket_name})),limits:d.result?.limits,errors:d.errors?.map(e=>({code:e.code,message:e.message}))},null,2));
}
