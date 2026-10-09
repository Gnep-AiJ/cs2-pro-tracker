import {readFile,readdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(process.argv[2]);
const required=['CLOUDFLARE_API_TOKEN','FACEIT_API_KEY'];
const secrets=[...required,'PANDASCORE_API_TOKEN','RATING_FEED_TOKEN'].map(name=>({name,value:process.env[name]})).filter(s=>s.value);
if(required.some(name=>!process.env[name]))throw new Error('Cannot scan without the configured secret values');
let files=0;
async function walk(path){for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())await walk(p);else if(/\.(?:js|json|html|css|toml|mjs)$/.test(e.name)){const data=await readFile(p,'utf8');files++;for(const s of secrets)if(data.includes(s.value))throw new Error(`Release contains a configured ${s.name}; publishing blocked`);}}}
await stat(root);await walk(root);console.log(`Secret scan passed across ${files} release files.`);
