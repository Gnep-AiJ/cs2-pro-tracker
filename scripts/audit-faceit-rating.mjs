import {fetch,EnvHttpProxyAgent} from 'undici';
import {mkdir,writeFile} from 'node:fs/promises';
const key=process.env.FACEIT_API_KEY?.trim();if(!key)throw new Error('FACEIT_API_KEY missing');
const dispatcher=new EnvHttpProxyAgent(),id='e5e8e2a6-d716-4493-b949-e16965f41654',root='outputs/faceit-rating-audit-20261008';
const report={checkedAt:new Date().toISOString(),playerId:id,requests:[]};
function fields(value,path='',out=[]){if(!value||typeof value!=='object')return out;for(const [name,child] of Object.entries(value)){const at=`${path}/${name}`;if(/rating|swing/i.test(name))out.push({path:at,value:typeof child==='object'?null:child});if(child&&typeof child==='object')fields(child,at,out);}return out;}
async function read(path){const response=await fetch('https://open.faceit.com/data/v4'+path,{dispatcher,headers:{accept:'application/json',authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});if(!response.ok){report.requests.push({path,status:response.status});return null;}const data=await response.json();report.requests.push({path,status:response.status,matchingFields:fields(data),items:data.items?.length??null,playerStatKeys:[...new Set((data.items||[]).flatMap(row=>Object.keys(row.stats||{})))]});return data;}
await read(`/players/${id}`);
await read(`/players/${id}/stats/cs2`);
const recent=await read(`/players/${id}/games/cs2/stats?offset=0&limit=20`);
const match=recent?.items?.[0]?.stats?.['Match Id'];
if(typeof match==='string'){await read(`/matches/${encodeURIComponent(match)}`);await read(`/matches/${encodeURIComponent(match)}/stats`);}
await mkdir(root,{recursive:true});await writeFile(root+'/data-api.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,requests:report.requests.map(({playerStatKeys,...rest})=>({...rest,playerStatFields:playerStatKeys?.length}))},null,2));
