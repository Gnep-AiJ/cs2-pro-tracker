import type {EventPlayer} from './pro-events';
export type EventMetric='rating'|'adr'|'kd'|'kast'|'kills'|'score';
export function eventMetric(player:EventPlayer,metric:EventMetric) {
  return metric==='kd'?player.kills!=null&&player.deaths!=null&&player.deaths>0?player.kills/player.deaths:null:
    metric==='score'?player.providerScore:player[metric]??null;
}
export function rankEventPlayers(players:EventPlayer[],metric:EventMetric,minimum=5) {
  const rows=players.filter(p=>{const maps=metric==='rating'?p.ratingMaps:p.maps;return maps!=null&&maps>=minimum&&eventMetric(p,metric)!=null;})
    .sort((a,b)=>eventMetric(b,metric)!-eventMetric(a,metric)!||a.id.localeCompare(b.id));
  let rank=0;return rows.map((player,i)=>{if(i===0||eventMetric(player,metric)!==eventMetric(rows[i-1],metric))rank=i+1;return {player,rank,value:eventMetric(player,metric)!};});
}
