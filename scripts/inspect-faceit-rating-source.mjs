import {fetch,EnvHttpProxyAgent} from 'undici';
import {readFile,writeFile} from 'node:fs/promises';
const root='outputs/faceit-rating-audit-20261008',urls=JSON.parse(await readFile(root+'/script-urls.json','utf8'));
const dispatcher=new EnvHttpProxyAgent(),findings=[],failures=[];
let cursor=0,bytes=0,completed=0;
const terms=/faceit.?rating|ratingService|rating\/v\d|round.?swing|consistencyScore|performanceRating/ig;
async function inspect(){while(cursor<urls.length&&bytes<60000000){const url=urls[cursor++];if(!url.startsWith('https://cdn-frontend.faceit-cdn.net/'))throw new Error('Unexpected resource host');try{const response=await fetch(url,{dispatcher,signal:AbortSignal.timeout(10000)});if(!response.ok){failures.push({url,status:response.status});continue;}if(Number(response.headers.get('content-length'))>5000000)continue;const source=await response.text();bytes+=source.length;const contexts=[];for(const m of source.matchAll(terms)){contexts.push({term:m[0],context:source.slice(Math.max(0,m.index-500),m.index+1000)});if(contexts.length>=15)break;}if(contexts.length)findings.push({url,contexts});}catch(e){failures.push({url,error:e.name});}finally{completed++;if(completed%40===0)console.log(JSON.stringify({completed,total:urls.length,bytes,matchedFiles:findings.length}));}}}
await Promise.all([inspect(),inspect(),inspect()]);
await writeFile(root+'/source-findings.json',JSON.stringify({checkedAt:new Date().toISOString(),completed,total:urls.length,bytes,findings,failures},null,2));
console.log(JSON.stringify({completed,total:urls.length,bytes,matchedFiles:findings.length,failures:failures.length}));
