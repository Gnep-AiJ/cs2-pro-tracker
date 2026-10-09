import type { AdvancedStats } from './pro-lab';

type NumericStats = Partial<AdvancedStats> & { kills?: number | null; deaths?: number | null; assists?: number | null; kd?: number | null; kr?: number | null; adr?: number | null; headshotPercent?: number | null };
export type ScoreMetric = { key: string; en: string; zh: string; values: number[]; digits: number; suffix?: string };
const known = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function scoreboardColumns(players: NumericStats[]) {
  return [
    { key: 'kda', label: 'K / D / A', fields: ['kills', 'deaths', 'assists'] },
    { key: 'kd', label: 'K/D', fields: ['kd'] },
    { key: 'adr', label: 'ADR', fields: ['adr'] },
    { key: 'hs', label: 'HS%', fields: ['headshotPercent'] },
  ].filter(column => players.some(player => column.fields.some(field => known(player[field as keyof NumericStats]))));
}

export function extraScoreMetrics(player: NumericStats): ScoreMetric[] {
  const values: ScoreMetric[] = [];
  const single = (key: keyof NumericStats, en: string, zh: string, digits = 0, suffix = '') => {
    const value = player[key];
    if (known(value)) values.push({ key, en, zh, values: [value], digits, suffix });
  };
  const pair = (key: string, en: string, zh: string, wins: keyof NumericStats, attempts: keyof NumericStats) => {
    const win = player[wins], count = player[attempts];
    if (known(win) && known(count)) values.push({ key, en, zh, values: [win, count], digits: 0 });
  };
  single('kr', 'K/R', 'K/R', 2);
  single('rating', 'Rating', 'Rating', 2);
  single('swing', 'Swing', 'Swing', 2, '%');
  single('firstKills', 'Opening kills', '首杀');
  pair('entry', 'Entry wins / attempts', '破点成功 / 次数', 'entryWins', 'entryCount');
  pair('clutch1', '1v1 wins / attempts', '1v1 成功 / 次数', 'clutch1Wins', 'clutch1Count');
  pair('clutch2', '1v2 wins / attempts', '1v2 成功 / 次数', 'clutch2Wins', 'clutch2Count');
  single('utilityAdr', 'Utility ADR', '道具 ADR', 1);
  single('enemiesFlashed', 'Enemies flashed', '致盲敌人');
  single('doubleKills', '2-kill rounds', '双杀回合');
  single('tripleKills', '3-kill rounds', '三杀回合');
  single('quadroKills', '4-kill rounds', '四杀回合');
  single('pentaKills', '5-kill rounds', '五杀回合');
  return values;
}
