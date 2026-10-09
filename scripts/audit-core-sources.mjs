import {fetch,EnvHttpProxyAgent} from 'undici';
import {mkdir,writeFile} from 'node:fs/promises';
const root='outputs/core-data-20261008';await mkdir(root,{recursive:true});
const dispatcher=new EnvHttpProxyAgent();
const sources=[['event','https://www.hltv.org/events/8244/esl-pro-league-season-24'],['match','https://www.hltv.org/matches/2398749/spirit-vs-m80-esl-pro-league-season-24'],['fixtures','https://www.hltv.org/matches?event=8244']];
for(const [name,url] of sources){try{const r=await fetch(url,{dispatcher,headers:{Accept:'text/html','User-Agent':'cs2pro-source-check/1.0'},signal:AbortSignal.timeout(15000)});const html=await r.text();if(r.ok&&html.length<2000000)await writeFile(`${root}/${name}.html`,html);console.log(JSON.stringify({name,url,status:r.status,length:html.length,classes:[...new Set([...html.matchAll(/class="([^"]*(?:upcoming|match-table|stats-content|rating|match-wrapper)[^"]*)"/g)].map(m=>m[1]))].slice(0,40)}));}catch(error){console.log(name,error.name);}}
