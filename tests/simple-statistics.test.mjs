import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const playedAt = '2026-10-09T00:00:00Z';
const sample = { id: 'one', playedAt, map: 'nuke', result: 'L', kills: 0, deaths: 2, assists: 0, kd: 0, kr: 0, adr: 0, headshots: 0 };
const profile = { id: 'player-one', nickname: 'Zero', faceitNickname: 'zero', team: '', avatar: null, country: null, elo: null, level: null, ranking: { region: null, regionPosition: null, countryPosition: null }, lifetime: {}, recentMatches: [sample], frequentTeammates: [] };
const labFeed = { observedAt: playedAt, players: ['one','two'].map(id=>({id,name:id,lookup:id,eventPlayerId:'hltv-'+id,directoryTeam:'',checkedAt:playedAt,historyCheckedAt:playedAt,samples:Array.from({length:5},(_,i)=>({...sample,id:id+i,kills:null,deaths:null,kd:null,kr:null,headshots:null}))})),pairs:[],uniqueMatches:10,coverage:{stats:2,requested:2},stale:false };

async function component(path, player=profile) {
  const result = await build({ entryPoints: [new URL('../'+path, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')], bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',
    plugins:[{name:'component-boundaries',setup(builder) {
      builder.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:pathToFileURL(require.resolve(args.path)).href,external:true}));
      builder.onResolve({filter:/^next\/(?:link|image)$/},args=>({path:args.path,namespace:'test-ui'}));
      builder.onResolve({filter:/^lucide-react$/},()=>({path:'icons',namespace:'test-ui'}));
      builder.onResolve({filter:/\/LanguageProvider$/},()=>({path:'language',namespace:'test-ui'}));
      builder.onResolve({filter:/\/TrackerWorkspace$/},()=>({path:'resource',namespace:'test-ui'}));
      builder.onResolve({filter:/\/(?:SiteHeader|PerformanceChart)$/},()=>({path:'child',namespace:'test-ui'}));
      builder.onLoad({filter:/pro-lab-snapshot\.json$/},()=>({contents:JSON.stringify(labFeed),loader:'json'}));
      builder.onLoad({filter:/pro-events-snapshot\.json$/},()=>({contents:JSON.stringify({details:{'8244':{players:[]}}}),loader:'json'}));
      builder.onLoad({filter:/.*/,namespace:'test-ui'},args=>{
        if(args.path==='language')return {contents:"export const useLanguage=()=>({language:'zh',t:(en,zh)=>zh});"};
        if(args.path==='icons')return {contents:'const Icon=()=>null;export{Icon as ArrowDownUp,Icon as ArrowLeft,Icon as ArrowRight,Icon as ArrowUpRight,Icon as ChevronDown,Icon as Network,Icon as ShieldCheck,Icon as SlidersHorizontal,Icon as Trophy,Icon as Search,Icon as Check,Icon as X,Icon as RefreshCw,Icon as ChartNoAxesCombined,Icon as Activity,Icon as Crosshair,Icon as Flag,Icon as Globe2,Icon as History,Icon as Map,Icon as Shield,Icon as Swords,Icon as Target,Icon as Users,Icon as Building2,Icon as Factory,Icon as Landmark,Icon as Mountain,Icon as Trees,Icon as Waves};'};
        if(args.path==='resource')return {contents:"import{createElement}from'react';export const useResource=(url,initial)=>({data:url.includes('/api/players/')?"+JSON.stringify({player})+":initial,loading:false,error:false,refresh(){}});export const useDate=()=>value=>value||'';export const number=(value,digits=1,suffix='')=>value==null?'—':Number(value.toFixed(digits))+suffix;export const Notice=({children})=>createElement('p',null,children);export const MatchRows=({matches})=>createElement('div',{'data-match-count':matches.length},'对局记录');"};
        if(args.path==='child')return {contents:'export default function Child(){return null;}'};
        return {contents:"import{createElement}from'react';export default function Element({children,href,src,alt,className}){return createElement(href?'a':'img',{href,src,alt,className},children)};"};
      });
    }}] });
  try {return await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text+'\n// '+Math.random()).toString('base64'));} catch(error) {throw new Error('Component import failed: '+error.message);}
}

test('comparison hides metrics unavailable for either player while preserving real zero and signed values',async()=>{
  const {comparableRows}=await component('app/components/PlayerComparison.tsx');
  assert.deepEqual(comparableRows([{label:'zero',values:[0,0]},{label:'signed',values:[-1,2]},{label:'missing',values:[null,3]},{label:'invalid',values:[NaN,4]},{label:'absent',values:[2,undefined]}]).map(row=>row.label),['zero','signed']);
});
test('event comparison never turns missing kills into a zero K/D',async()=>{
  const {default:Comparison}=await component('app/components/PlayerComparison.tsx');
  const players=[{id:'ps-1',name:'A',team:'A',maps:10,kills:null,deaths:20,adr:0,kast:null,providerScore:null},{id:'ps-2',name:'B',team:'B',maps:10,kills:10,deaths:20,adr:0,kast:null,providerScore:null}];
  const html=renderToStaticMarkup(createElement(Comparison,{domain:'events',details:{id:'ps-99',players,statsObservedAt:null}}));
  assert.doesNotMatch(html,/K\/D|HLTV Rating|KAST|ENSI/);
  assert.match(html,/<th>ADR<\/th>/);assert.match(html,/<strong>0<\/strong>/);
});
test('fixed player board has one metric selector and omits unavailable Rating/Swing and nested navigation',async()=>{
  const {default:ProLab}=await component('app/components/ProLab.tsx');
  const html=renderToStaticMarkup(createElement(ProLab,{discovery:true,showNavigation:false}));
  assert.doesNotMatch(html,/lab-nav|metric-family|FACEIT Rating|Round Swing|API|缺失字段|覆盖与口径/);
  assert.match(html,/aria-label="排行指标"/);assert.match(html,/<option value="adr"/);
  assert.doesNotMatch(html,/<option value="kd"/);
  assert.match(html,/<b>0<\/b>/);
});
test('player profile opens actual matches and suppresses empty statistics, empty sections and AI entry',async()=>{
  const {default:Profile}=await component('app/components/CompactPlayerDetail.tsx');
  const html=renderToStaticMarkup(createElement(Profile,{nickname:'zero'}));
  assert.match(html,/<details open=""/);assert.match(html,/data-match-count="1"/);
  assert.doesNotMatch(html,/FACEIT Rating|Round Swing|区域排名|ELO|单场详细观测|缺失值|最长连胜|常见队友|数据分析|player-impact/);
  assert.match(html,/<dt>ADR/);assert.match(html,/<dd>0<\/dd>/);assert.match(html,/<dd>0%<\/dd>/);
});

test('performance chart starts on an available metric and keeps genuine zero without empty metric controls',async()=>{
  const {default:Chart}=await component('app/components/PerformanceChart.tsx');
  const html=renderToStaticMarkup(createElement(Chart,{matches:[{...sample,adr:null,kd:null,headshots:null,kr:0}]}));
  assert.match(html,/K\/R/);assert.match(html,/<svg/);assert.match(html,/0\.00/);
  assert.doesNotMatch(html,/ADR|HS%|Rating|Swing|暂无统计/);
  assert.equal(renderToStaticMarkup(createElement(Chart,{matches:[]})), '');
});
