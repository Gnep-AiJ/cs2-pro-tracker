"use client";
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ChevronDown, Download, Trophy } from 'lucide-react';
import MapBadge from './MapBadge';
import { useLanguage } from './LanguageProvider';
import { Notice, number, useDate, useResource } from './TrackerWorkspace';
import type { AdvancedStats } from '../lib/pro-lab';
import { extraScoreMetrics, scoreboardColumns } from '../lib/scoreboard-view';

export type ScorePlayer = Partial<AdvancedStats> & { id: string; nickname: string; avatar?: string | null; level?: number | null; kills: number | null; deaths: number | null; assists: number | null; kd: number | null; kr: number | null; adr: number | null; headshotPercent: number | null; mvps?: number | null };
export type ScoreTeam = { name: string; score: number | null; won: boolean; players: ScorePlayer[]; firstHalfScore?: number | null; secondHalfScore?: number | null; overtimeScore?: number | null };
export type MatchDetails = { id: string; competitionName: string; map: string | null; playedAt: string | null; region: string | null; status?: string; durationMinutes?: number | null; faceitUrl?: string | null; demoUrl?: string | null; scoreboard: ScoreTeam[]; maps?: Array<{ map: string | null; scoreboard: ScoreTeam[] }>; statsAvailable?: boolean };

export function Scoreboard({ match, playerId = '' }: { match: MatchDetails; playerId?: string }) {
  const { t, language } = useLanguage(), date = useDate();
  const [selected, setSelected] = useState(0);
  const maps = match.maps?.length ? match.maps : [{ map: match.map, scoreboard: match.scoreboard }];
  const mapIndex = Math.min(selected, maps.length - 1);
  const current = maps[mapIndex];
  const teams = current?.scoreboard || [];
  const columns = scoreboardColumns(teams.flatMap(team => team.players));
  const extras = teams.flatMap(team => team.players).map(player => ({ player, metrics: extraScoreMetrics(player) })).filter(row => row.metrics.length);
  return <>
    <div className="scoreboard-context"><span>{match.competitionName}</span><time>{date(match.playedAt, true)}</time>{match.region && <span>{match.region}</span>}{match.durationMinutes != null && <span>{match.durationMinutes} {t('min', '分钟')}</span>}</div>
    <div className="scoreboard-map-tabs" role="group" aria-label={t('Maps', '地图')}>{maps.map((m, i) => <button type="button" key={i} aria-pressed={mapIndex === i} onClick={() => setSelected(i)}><MapBadge map={m.map || `${t('Map', '地图')} ${i + 1}`} compact/></button>)}</div>
    {match.statsAvailable === false && <Notice>{t('Player statistics unavailable', '暂无选手统计')}</Notice>}
    <div className="scoreboard-duel">{teams.map((team, i) => <div key={i} className={team.won ? 'duel-winner' : ''}><span>{team.won && <Trophy size={15} aria-label={t('Winner','胜方')}/>} {team.name}</span><strong className={team.won ? 'positive' : ''}>{number(team.score, 0)}</strong></div>)}{!teams.length && <p>{t('No match data', '暂无对局数据')}</p>}</div>
    {teams.map((team, i) => <section className="scoreboard-team" key={i}><div className="scoreboard-team-title"><h3>{team.name}</h3>{team.firstHalfScore != null && team.secondHalfScore != null && <small>{t('Halves', '半场')} {number(team.firstHalfScore, 0)} / {number(team.secondHalfScore, 0)}{(team.overtimeScore ?? 0) > 0 && ` · OT ${team.overtimeScore}`}</small>}</div><div className="scoreboard-table"><table><thead><tr><th>{t('Player', '选手')}</th>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{team.players.map((p, n) => <tr className={p.id === playerId ? 'selected-player' : ''} key={p.id || n} style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))` }}><td><Link href={`/players/${encodeURIComponent(p.nickname || 'player')}?lang=${language}&playerId=${encodeURIComponent(p.id)}`}>{p.avatar && <Image src={p.avatar} alt="" width={25} height={25} unoptimized />}<span>{p.nickname || t('Unknown player', '未知选手')}</span></Link></td>{columns.map(column => <td key={column.key} data-label={column.label}>{column.key === 'kda' ? `${number(p.kills, 0)} / ${number(p.deaths, 0)} / ${number(p.assists, 0)}` : column.key === 'kd' ? number(p.kd, 2) : column.key === 'adr' ? number(p.adr) : number(p.headshotPercent, 0, '%')}</td>)}</tr>)}</tbody></table></div></section>)}
    {!!extras.length && <details className="compact-disclosure"><summary>{t('More statistics', '更多数据')}<ChevronDown size={15} /></summary><div className="impact-player-stack">{extras.map(({ player, metrics }, i) => <section className="impact-player" key={player.id || i}><h4>{player.nickname}</h4><dl>{metrics.map(metric => <div key={metric.key}><dt>{t(metric.en, metric.zh)}</dt><dd>{metric.values.map(value => number(value, metric.digits, metric.suffix)).join(' / ')}</dd></div>)}</dl></section>)}</div></details>}
    <div className="arena-dialog-actions"><a className="arena-button primary" href={`https://www.faceit.com/en/cs2/room/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer">{t('Open FACEIT room', '打开 FACEIT 房间')}<ArrowUpRight size={15} /></a>{match.demoUrl && /^https:\/\//.test(match.demoUrl) && <a className="arena-button" href={match.demoUrl} target="_blank" rel="noreferrer"><Download size={15} />Demo</a>}</div>
  </>;
}
export default function MatchScoreboard({ matchId, playerId = '' }: { matchId: string; playerId?: string }) {
  const { t } = useLanguage();
  const resource = useResource<{ match: MatchDetails }>(`/api/matches/${encodeURIComponent(matchId)}${playerId ? `?playerId=${encodeURIComponent(playerId)}` : ''}`);
  return resource.loading ? <Notice loading>{t('Loading match & scoreboard…', '读取对局与记分板…')}</Notice> : resource.error || !resource.data?.match ? <Notice retry={resource.refresh}>{t('Match details unavailable. Try again or open the FACEIT room.', '对局详情暂不可用，请重试或打开 FACEIT 房间。')}<a href={`https://www.faceit.com/en/cs2/room/${encodeURIComponent(matchId)}`} target="_blank" rel="noreferrer">FACEIT<ArrowUpRight size={14} /></a></Notice> : <Scoreboard key={matchId} match={resource.data.match} playerId={playerId} />;
}
