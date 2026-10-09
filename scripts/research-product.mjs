import { mkdir, writeFile } from 'node:fs/promises';
import { fetch, EnvHttpProxyAgent } from 'undici';
const dispatcher = new EnvHttpProxyAgent();
const root = 'outputs/research-20261007';
await mkdir(root, { recursive: true });
const urls = {
  'prd-skill.md': 'https://raw.githubusercontent.com/product-on-purpose/pm-skills/main/skills/deliver-prd/SKILL.md',
  'edge-skill.md': 'https://raw.githubusercontent.com/product-on-purpose/pm-skills/main/skills/deliver-edge-cases/SKILL.md',
  'frontend-skill.md': 'https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md',
  'hltv-calendar.html': 'https://www.hltv.org/calendar',
  'hltv-events.html': 'https://www.hltv.org/events',
  'epl-event.html': 'https://www.hltv.org/events/8244/esl-pro-league-season-24',
  'epl-players.html': 'https://www.hltv.org/stats/players?event=8244',
  'epl-matches.html': 'https://www.hltv.org/events/8244/matches',
  'epl-results.html': 'https://www.hltv.org/results?event=8244',
};
await Promise.all(Object.entries(urls).map(async ([file,url]) => {
  try {
    const r = await fetch(url, { dispatcher, signal: AbortSignal.timeout(15000), headers: { 'User-Agent':'cs2pro-source-check/1.0', Accept:'text/html,text/plain' } });
    const body = await r.text();
    if (r.ok) await writeFile(`${root}/${file}`, body);
    console.log(JSON.stringify({file,status:r.status,bytes:body.length,saved:r.ok}));
  } catch(e) { console.log(JSON.stringify({file,error:e.message})); }
}));
const token = process.env.CLOUDFLARE_API_TOKEN;
if (token) {
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/e34685eb42587931743b7aae6b38921e/pages/projects/cs2pro', { dispatcher, headers: {Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000) });
  const body = await r.json(); const p = body.result;
  console.log(JSON.stringify({cs2proStatus:r.status,success:body.success,productionBranch:p?.production_branch,domains:p?.domains,deployment:p?.canonical_deployment?.id,url:p?.canonical_deployment?.url,productionConfigKeys:Object.keys(p?.deployment_configs?.production || {}),environmentNames:Object.keys(p?.deployment_configs?.production?.env_vars || {})}));
  if(p) await writeFile(`${root}/cs2pro-release-before.json`, JSON.stringify({id:p.id,name:p.name,production_branch:p.production_branch,canonical_deployment:{id:p.canonical_deployment?.id,url:p.canonical_deployment?.url},deployment_configs:Object.fromEntries(Object.entries(p.deployment_configs||{}).map(([key,value])=>[key,{compatibility_date:value.compatibility_date,compatibility_flags:value.compatibility_flags,ai_bindings:value.ai_bindings,env_names:Object.keys(value.env_vars||{})}]))},null,2));
}
