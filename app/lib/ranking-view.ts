export type TrackedRank = {id:string;name:string;nickname:string;team:string;avatar:string|null;country:string|null;level:number|null;elo:number|null;matches:number|null;winRate:number|null};
export type RankSort = 'elo'|'matches'|'winRate';
export function topTracked(players:TrackedRank[],sort:RankSort) {
  return [...new Map(players.map(player=>[player.id,player])).values()].filter(player=>player[sort]!=null&&Number.isFinite(player[sort])).sort((a,b)=>b[sort]!-a[sort]!||(b.elo??-1)-(a.elo??-1)||a.id.localeCompare(b.id)).slice(0,10);
}
export function comparisonWinner(values:Array<number|null|undefined>,direction:'higher'|'lower'|'neutral'='higher',digits=2):number|null {
  if(direction==='neutral'||values.length!==2||values.some(value=>value==null||!Number.isFinite(value)))return null;
  const [a,b]=values.map(value=>Number(value!.toFixed(digits)));
  return a===b?-1:direction==='lower'?(a<b?0:1):(a>b?0:1);
}
