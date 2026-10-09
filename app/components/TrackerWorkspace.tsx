"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownUp, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ChevronDown, CircleDot, Database, Layers3, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Trophy, X } from "lucide-react";
import MapBadge from "./MapBadge";
import SiteHeader from "./SiteHeader";
import PerformanceChart from "./PerformanceChart";
import CircuitOverview from "./CircuitOverview";
import PlayerComparison from "./PlayerComparison";
import PlayerSearch, { type PlayerCandidate } from "./PlayerSearch";
import ProLab from './ProLab';
import { useLanguage } from "./LanguageProvider";
import { topTeams, trackedPlayers } from "../data/tracked-players";
import valveSnapshot from "../data/valve-snapshot.json";
import { importantEventFamilies } from "../lib/event-data";
import type { Domain, Section, EventsFeed, StandingsFeed, LivePlayer, PlayerProfile, PlayerSample } from "../lib/tracker-types";

type OfficialFeed = { items: Array<{ player_id: string; nickname: string; position: number; faceit_elo: number | null; country: string | null }>; updatedAt: string; start: number };
type DailyFeed = { players: Array<{ id: string; nickname: string; team: string; recentMatches: number; recentWins: number; recentWinRate: number; currentWinStreak: number }>; updatedAt: string; coverage: { returned: number; verified: number } };
type LiveFeed = { faceit: { items: LivePlayer[]; error?: string | null; coverage?: { profiles: number; requested: number } }; updatedAt: string };

export function useResource<T>(url: string | null, initial: T | null = null) {
  const [state, setState] = useState<{ data: T | null; error: boolean; loading: boolean; url: string | null }>({ data: initial, error: false, loading: !!url, url });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState(previous => ({ data: previous.url === url ? previous.data : null, loading: true, error: false, url }));
      void fetch(url, { signal: controller.signal, cache: "no-cache" }).then(async response => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json() as T;
        if (!controller.signal.aborted) setState({ data, loading: false, error: false, url });
      }).catch(() => { if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: true })); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [url, revision]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { previousData:state.data, data: state.url === url ? state.data : null, loading: state.url !== url || state.loading, error: state.url === url && state.error, refresh };
}
export function number(value: number | null | undefined, digits = 1, suffix = "") {
  return value == null || !Number.isFinite(value) ? "—" : `${Number(value.toFixed(digits)).toLocaleString()}${suffix}`;
}
export function useDate() {
  const { language } = useLanguage();
  return (value: string | null | undefined, withTime = false) => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", { month: "short", day: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).format(new Date(value)) : "—";
}
export function Notice({ loading, retry, children }: { loading?: boolean; retry?: () => void; children: React.ReactNode }) {
  const { t } = useLanguage();
  return <div className={`compact-notice ${loading ? "is-loading" : ""}`} role="status">{loading ? <RefreshCw size={16} className="spin" /> : <CircleDot size={16} />}<span>{children}</span>{retry && <button type="button" onClick={retry}>{t("Retry", "重试")} <RefreshCw size={13} /></button>}</div>;
}

function Sources({ domain }: { domain: Domain }) {
  const { t } = useLanguage();
  return <details className="compact-disclosure source-disclosure"><summary><span>{t("Sources", "数据来源")}</span><ChevronDown size={14} /></summary><div className="disclosure-body source-links">{domain==="events"?<><a href="https://github.com/ValveSoftware/counter-strike_regional_standings" target="_blank" rel="noreferrer">Valve <ArrowUpRight size={12}/></a><a href="https://www.hltv.org/events" target="_blank" rel="noreferrer">HLTV <ArrowUpRight size={12}/></a></>:<a href="https://www.faceit.com/" target="_blank" rel="noreferrer">FACEIT <ArrowUpRight size={12}/></a>}</div></details>;
}

function trackedRosterPlayer(name: string) {
  return trackedPlayers.find(player => player.faceitPlayerId && [player.display, player.lookup, ...player.aliases].some(alias => alias.toLowerCase() === name.toLowerCase()));
}
function RosterButtons({ roster }: { roster: string[] }) {
  const { language, t } = useLanguage();
  return <div className="roster-buttons">{roster.map(name => {
    const player = trackedRosterPlayer(name);
    return player ? <Link key={name} href={`/players/${encodeURIComponent(player.lookup)}?lang=${language}`} title={t("FACEIT player statistics", "FACEIT 选手统计")}>{name}<ArrowUpRight size={12} /></Link> : <span key={name} title={t("FACEIT account not verified", "FACEIT 身份尚未核验")}>{name}</span>;
  })}</div>;
}
function EventRankings({ feed, query }: { feed: StandingsFeed; query: string }) {
  const { language, t } = useLanguage();
  const [view, setView] = useState("teams");
  const [count, setCount] = useState(10);
  const players = feed.items.flatMap(team => team.roster.flatMap(name => {
    const player = trackedRosterPlayer(name);
    return player && `${name} ${team.name}`.toLowerCase().includes(query.toLowerCase()) ? [{ name, player, team }] : [];
  }));
  return <>
    <div className="compact-controls"><div className="segmented"><button type="button" aria-pressed={view === "teams"} onClick={() => setView("teams")}>{t("Teams", "战队榜单")}</button><button type="button" aria-pressed={view === "players"} onClick={() => setView("players")}>{t("Players", "选手入口")}</button></div><span>{feed.snapshotDate}</span><a href={feed.sourceUrl} target="_blank" rel="noreferrer">Valve <ArrowUpRight size={13} /></a></div>
    {view === "teams" ? <StandingRows feed={feed} query={query} /> : <>
      <p className="scope-note">{t("Players in Valve-ranked rosters with verified FACEIT identities. Profile statistics are FACEIT, not professional event ratings.", "Valve 阵容 · 已核验 FACEIT 身份。统计为 FACEIT 表现。")}</p>
      {players.slice(0, count).map(({ name, player, team }) => <Link className="simple-rank-row player-directory-row" href={`/players/${encodeURIComponent(player.lookup)}?lang=${language}`} key={`${team.rank}-${name}`}><span className="directory-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><strong>{name}<small>{team.name} · Valve #{team.rank}</small></strong><span className="directory-action">{t("Player stats", "选手数据")} <ArrowUpRight size={13} /></span></Link>)}
      {!players.length && <Notice>{t("No verified player found", "未找到已核验选手")}</Notice>}
      {players.length > count && <button type="button" className="more-button" onClick={() => setCount(value => value + 10)}>{t("Show more", "显示更多")} <ChevronDown size={13} /></button>}
    </>}
  </>;
}
function StandingRows({ feed, query, limit = 10 }: { feed: StandingsFeed; query: string; limit?: number }) {
  const { t } = useLanguage();
  const [count, setCount] = useState(limit);
  const rows = feed.items.filter(item => `${item.name} ${item.roster.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="compact-columns standing-columns"><span>#</span><span>{t("Team / roster", "战队／阵容")}</span><span>{t("Points", "积分")}</span><span /></div>
    {rows.slice(0, count).map(item => <details name="standing-record" className="compact-disclosure standing-row" key={item.rank}><summary><span className={`row-rank ${item.rank <= 3 ? "podium" : ""}`}>{String(item.rank).padStart(2, "0")}</span><span className="team-identity"><span className="team-monogram" aria-hidden="true">{item.name.slice(0, 2).toUpperCase()}</span><span className="row-identity"><strong>{item.name}</strong><small>{item.roster.join(" · ")}</small></span></span><span className="points-cell"><b className="numeric">{number(item.points, 0)}</b><span className="points-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, item.points / (feed.items[0]?.points || 1) * 100))}%` }} /></span></span><ChevronDown size={14} /></summary><div className="disclosure-body roster-body"><div><small>{t("Verified links open FACEIT player statistics", "已核验链接可查看 FACEIT 选手统计")}</small><RosterButtons roster={item.roster} /></div><a href={item.sourceUrl} target="_blank" rel="noreferrer">{t("Official record", "官方记录")} <ArrowUpRight size={13} /></a></div></details>)}
    {!rows.length && <Notice>{t("No results", "未找到结果")}</Notice>}
    {rows.length > count && <button className="more-button" type="button" onClick={() => setCount(value => value + 10)}>{t("Show more", "显示更多")} <ChevronDown size={13} /></button>}
  </>;
}

function EventsData({ feed, loading, error, query, retry, hasPlayerResults = false }: { feed: EventsFeed | null; loading: boolean; error: boolean; query: string; retry: () => void; hasPlayerResults?: boolean }) {
  const { t } = useLanguage();
  const date = useDate();
  const [status, setStatus] = useState("all");
  const [family, setFamily] = useState("all");
  const [limit, setLimit] = useState(20);
  const matches = (feed?.items || []).filter(item => (status === "all" || item.status === status) && (family === "all" || item.family === family) && `${item.event} ${item.name} ${item.teams.map(team => team.name).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const grouped = importantEventFamilies.filter(item => (family === "all" || item.id === family) && (matches.some(match => match.family === item.id) || item.name.toLowerCase().includes(query.toLowerCase())));
  return <>
    <div className="compact-controls"><div className="segmented" aria-label={t("Match status", "比赛状态")}>{[["all", t("All", "全部")], ["running", t("Live", "进行中")], ["upcoming", t("Upcoming", "即将开始")], ["finished", t("Results", "赛果")]].map(([id, label]) => <button type="button" key={id} aria-pressed={status === id} onClick={() => { setStatus(id); setLimit(20); }}>{label}</button>)}</div><select aria-label={t("Event series", "赛事系列")} value={family} onChange={event => { setFamily(event.target.value); setLimit(20); }}><option value="all">{t("All series", "全部系列")}</option>{importantEventFamilies.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
    {loading ? <Notice loading>{t("Loading matches…", "读取比赛…")}</Notice> : error || feed?.status === "unavailable" ? <Notice retry={retry}>{t("Match data unavailable", "比赛数据暂不可用")}</Notice> : feed?.status === "unconfigured" ? <Notice>{t("Schedule data unavailable · browse event series below", "赛程数据暂不可用 · 可浏览下方赛事系列")}</Notice> : !matches.length ? <Notice>{t("No matches in this selection", "当前筛选暂无比赛")}</Notice> : null}
    {feed?.status === "partial" && <Notice>{t("Partial coverage", "数据覆盖不完整")}</Notice>}
    {matches.slice(0, limit).map(match => <details className="compact-disclosure event-match" key={match.id}><summary><time>{date(match.beginsAt, true)}</time><span className="row-identity"><strong>{match.teams.length ? match.teams.map(team => team.name).join(" / ") : match.name}</strong><small>{match.event}</small></span><b className={`match-status ${match.status}`}>{match.status === "finished" ? match.teams.map(team => number(team.score, 0)).join(" : ") : match.status === "running" ? t("LIVE", "进行中") : match.bestOf ? `BO${match.bestOf}` : "—"}</b><ChevronDown size={14} /></summary><div className="disclosure-body"><span>{match.event}</span><span>{t("Source: PandaScore", "来源：PandaScore")}</span></div></details>)}
    {matches.length > limit && <button className="more-button" type="button" onClick={() => setLimit(value => value + 20)}>{t("Show more", "显示更多")}</button>}
    <div className="block-heading"><h2><Layers3 size={15} />{t("Event series", "赛事系列")}</h2><span>{grouped.length} {t("series", "个系列")}</span></div>
    <div className="series-stack">{grouped.map((item, index) => <details name="event-series" className="compact-disclosure series-row" key={item.id}><summary><span className={`series-emblem series-emblem-${item.id}`} aria-hidden="true">{["M", "I", "E", "B", "P"][importantEventFamilies.indexOf(item)] || String(index + 1)}</span><span className="row-identity"><strong>{item.name}</strong><small>{item.id === "major" ? t("Valve championship", "Valve 锦标赛") : item.id === "epl" ? t("Professional league", "职业联赛") : t("International circuit", "国际巡回赛")}</small></span><span className="row-tag">{t("Main event", "主赛事")}</span><ChevronDown size={14} /></summary><div className="disclosure-body"><span>{t("Schedules & results follow verified provider coverage.", "赛程与结果以已核验的数据覆盖为准。")}</span><div className="row-actions"><button className="secondary-button" type="button" onClick={() => { setFamily(item.id); setStatus("all"); }}>{t("View matches", "查看比赛")} <ArrowRight size={13} /></button><a href={item.url} target="_blank" rel="noreferrer">{t("Official site", "官方网站")} <ArrowUpRight size={13} /></a></div></div></details>)}</div>
    {!grouped.length && !matches.length && !hasPlayerResults && <Notice>{t("Try a team or event name", "请尝试战队或赛事名称")}</Notice>}
    {feed?.bounded && <p className="scope-note">{t("Limited provider pages · this is not a complete event archive", "数据源分页有上限 · 当前结果不是完整赛事档案")}</p>}
  </>;
}

export function MatchRows({ player, matches }: { player: PlayerProfile; matches: PlayerSample[] }) {
  const { language, t } = useLanguage();
  const date = useDate();
  return <div className="sample-matches">{matches.map(match => <Link className={`profile-match-row result-${match.result === 'W' ? 'win' : match.result === 'L' ? 'loss' : 'unknown'}`} key={match.id} href={`/players/${encodeURIComponent(player.nickname)}/matches/${encodeURIComponent(match.id)}?playerId=${encodeURIComponent(player.id)}&lang=${language}`}><b className="history-result">{match.result === 'W' ? t('W','胜') : match.result === 'L' ? t('L','负') : '—'}</b><span className="history-map"><MapBadge map={match.map}/><small>{date(match.playedAt, true)}</small></span><span className="numeric history-score">{match.score || '—'}</span><span>{match.kd!=null&&<><small>K/D</small><b>{number(match.kd, 2)}</b></>}</span><span>{match.adr!=null&&<><small>ADR</small><b>{number(match.adr)}</b></>}</span><ArrowUpRight size={13} /></Link>)}</div>;
}

function InlinePlayer({ nickname }: { nickname: string }) {
  const { language, t } = useLanguage();
  const resource = useResource<{ player: PlayerProfile }>(`/api/players/${encodeURIComponent(nickname)}`);
  const player = resource.data?.player;
  return <div className="inline-player">{resource.loading ? <Notice loading>{t("Loading stats…", "读取统计…")}</Notice> : resource.error || !player ? <Notice retry={resource.refresh}>{t("Stats unavailable", "统计暂不可用")}</Notice> : <>
    <div className="inline-metrics">{player.recentSummary.winRate!=null&&<span><small>{t("Win rate", "胜率")}</small><b>{number(player.recentSummary.winRate, 0, "%")}</b></span>}{player.recentPerformance.kd!=null&&<span><small>{t("Average K/D", "平均 K/D")}</small><b>{number(player.recentPerformance.kd, 2)}</b></span>}{player.recentPerformance.adr!=null&&<span><small>ADR</small><b>{number(player.recentPerformance.adr)}</b></span>}<span><small>{t("Matches", "场次")}</small><b>{player.recentPerformance.sampleSize}/{player.recentSummary.sampleSize}</b></span><Link href={`/players/${encodeURIComponent(nickname)}?lang=${language}`}>{t("Profile", "档案")} <ArrowUpRight size={13} /></Link></div>
    <MatchRows player={player} matches={player.recentMatches.slice(0, 3)} />
    <PerformanceChart matches={player.recentMatches.slice(0, 10)} />
  </>}</div>;
}
export function FaceitData({ query }: { query: string }) {
  const { language, t } = useLanguage();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerCandidate | null>(null);
  const [team, setTeam] = useState(topTeams[0].slug);
  const [opened, setOpened] = useState<string | null>(null);
  const resource = useResource<LiveFeed>(`/api/live?team=${encodeURIComponent(team)}`);
  const roster = query ? trackedPlayers.filter(player => `${player.display} ${player.lookup} ${player.team}`.toLowerCase().includes(query.toLowerCase())).slice(0, 20) : topTeams.find(item => item.slug === team)!.members;
  const items = resource.data?.faceit.items || [];
  const selectedTeam = topTeams.find(item => item.slug === team)!;
  return <>
    <div className="faceit-individual-search"><PlayerSearch domain="faceit" label={t("Find a player", "查找选手")} selected={selectedPlayer} onSelect={setSelectedPlayer} />{selectedPlayer && <Link className="primary-button" href={`/players/${encodeURIComponent(selectedPlayer.lookup)}?lang=${language}&playerId=${encodeURIComponent(selectedPlayer.id)}`}>{t("Open profile", "查看档案")} <ArrowUpRight size={14} /></Link>}</div>
    {!query && <div className="team-directory-banner"><span className="team-directory-mark" aria-hidden="true">{selectedTeam.name.split(' ').map(word => word[0]).join('').slice(0,3)}</span><div><small>{t("Team directory", "战队目录")}</small><h3>{selectedTeam.name}</h3><p>{selectedTeam.members.length} {t("listed players", "名收录选手")} · FACEIT</p></div><span className="team-directory-names">{selectedTeam.members.map(p => p.display).join(' / ')}</span></div>}

    <div className="compact-controls"><select value={team} onChange={event => { setTeam(event.target.value); setOpened(null); }} aria-label={t("Team directory", "战队目录")}>{topTeams.map(item => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select><span>{t("Browse by team · search all FACEIT accounts above", "按战队浏览 · 上方可搜索全站 FACEIT 账号")}</span>{resource.loading && <small>{t("Syncing…", "同步中…")}</small>}<button className="icon-button" type="button" onClick={resource.refresh} aria-label={t("Refresh", "刷新")}><RefreshCw size={14} /></button></div>
    {(resource.error || resource.data?.faceit.error) && <Notice retry={resource.refresh}>{t("Live profiles unavailable", "实时资料暂不可用")}</Notice>}
    <div className="compact-columns player-columns"><span>{t("Player", "选手")}</span><span>ELO</span><span>{t("Recent form", "近况")}</span><span /></div>
    {roster.map(entry => { const player = items.find(item => item.id === entry.faceitPlayerId); const recent = player?.recentMatches || []; return <details name="tracked-player" className="compact-disclosure compact-player-row" key={entry.display} onToggle={event => { if (event.currentTarget.open) setOpened(entry.lookup); }}><summary><span className="team-identity">{player?.avatar ? <Image className="row-avatar" src={player.avatar} width={34} height={34} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="directory-avatar" aria-hidden="true">{entry.display.slice(0, 1).toUpperCase()}</span>}<span className="row-identity"><strong>{entry.display}</strong><small>{entry.team}</small></span></span><b className="numeric">{number(player?.elo, 0)}</b><span className="form-dots" aria-label={t("Recent results, newest first", "近期胜负，左侧为最新")}>{recent.slice(0, 5).map(match => <i key={match.id} className={match.result === "W" ? "win" : match.result === "L" ? "loss" : "unknown"}>{match.result || "—"}</i>)}{!recent.length && <small>—</small>}</span><ChevronDown size={14} /></summary>{opened === entry.lookup && <InlinePlayer nickname={entry.lookup} />}</details>; })}
    {!roster.length && <Notice>{t("No tracked player found", "未找到收录选手")}</Notice>}
    {query.trim() && <Link className="lookup-link" href={`/players/${encodeURIComponent(query.trim())}?lang=${language}`}><Search size={13} />{t("Look up FACEIT nickname", "查询 FACEIT 昵称")} · {query.trim()} <ArrowUpRight size={13} /></Link>}
    <p className="scope-note">{t("Recent FACEIT matches", "近期 FACEIT 对局")}</p>
  </>;
}

export function FaceitRankings({ query,secondaryOnly=false }: { query: string;secondaryOnly?:boolean }) {
  const { language, t } = useLanguage();
  const [mode, setMode] = useState(secondaryOnly?"official":"lab");
  const [region, setRegion] = useState("EU");
  const [country, setCountry] = useState("");
  const [offset, setOffset] = useState(0);
  const [visible, setVisible] = useState(10);
  const official = useResource<OfficialFeed>(mode === "official" ? `/api/rankings?region=${region}&country=${country}&offset=${offset}` : null);
  const daily = useResource<DailyFeed>(mode === "recent" ? "/api/overview" : null);
  const sorted = [...(daily.data?.players || [])].filter(player => player.recentMatches >= 5).sort((a, b) => b.recentWinRate - a.recentWinRate || b.recentWins - a.recentWins);
  const resource = mode === "official" ? official : daily;
  const officialRows = (official.data?.items || []).filter(item => item.nickname.toLowerCase().includes(query.toLowerCase()));
  const recentRows = sorted.map((player,index)=>({...player,rank:index+1})).filter(player => `${player.nickname} ${player.team}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <div className="compact-controls">{!secondaryOnly&&<div className="segmented"><button type="button" aria-pressed={mode === "lab"} onClick={()=>setMode('lab')}>{t('Players','职业选手')}</button><button type="button" aria-pressed={mode === "official"} onClick={() => setMode("official")}>{t("Official ELO", "官方 ELO")}</button><button type="button" aria-pressed={mode === "recent"} onClick={() => setMode("recent")}>{t("Tracked form", "近期胜率")}</button></div>}{mode === "official" && <><select aria-label={t("Region", "区域")} value={region} onChange={event => { setRegion(event.target.value); setOffset(0); }}>{["EU", "NA", "SA", "SEA", "OCE"].map(value => <option key={value}>{value}</option>)}</select><select aria-label={t("Country", "国家")} value={country} onChange={event => { setCountry(event.target.value); setOffset(0); }}><option value="">{t("All countries", "全部国家")}</option>{["cn", "ru", "ua", "kz", "kr", "us", "br"].map(code => <option key={code} value={code}>{code.toUpperCase()}</option>)}</select></>}</div>
    {mode==='lab'?<ProLab query={query} discovery showNavigation={false}/>:resource.loading ? <Notice loading>{t("Loading rankings…", "读取榜单…")}</Notice> : resource.error ? <Notice retry={resource.refresh}>{t("Rankings unavailable", "榜单暂不可用")}</Notice> : mode === "official" ? <>
      <div className="ranking-labels"><span>{region} / FACEIT</span><span>ELO</span></div>
      {officialRows.slice(0, visible).map(item => <Link className="simple-rank-row visual-rank-row" key={item.player_id} href={`/players/${encodeURIComponent(item.nickname)}?lang=${language}`}><span className={`row-rank ${item.position <= 3 ? "podium" : ""}`}>{String(item.position).padStart(2, "0")}</span><strong>{item.nickname}<small>{item.country?.toUpperCase() || "—"}</small></strong><span className="points-cell"><b className="numeric">{number(item.faceit_elo, 0)}</b>{item.faceit_elo != null && <span className="points-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, item.faceit_elo / Math.max(1, ...officialRows.map(row => row.faceit_elo || 0)) * 100))}%` }} /></span>}</span><ArrowUpRight size={13} /></Link>)}
      {officialRows.length > visible && <button className="more-button" type="button" onClick={() => setVisible(value => value + 10)}>{t("Show more", "显示更多")} <ChevronDown size={13} /></button>}
      <div className="compact-pagination"><button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>{t("Previous", "上一页")}</button><span>{offset / 50 + 1}</span><button type="button" disabled={(official.data?.items.length || 0) < 50} onClick={() => setOffset(value => value + 50)}>{t("Next", "下一页")}</button></div><p className="scope-note">{t("Search filters the current page.", "搜索筛选当前页。")}</p>
    </> : <>
      {recentRows.slice(0, visible).map(player => <Link className="simple-rank-row visual-rank-row" key={player.id} href={`/players/${encodeURIComponent(player.nickname)}?lang=${language}&playerId=${player.id}`}><span className="row-rank">{player.rank}</span><strong>{player.nickname}<small>{player.team} · {player.recentMatches} {t("matches", "场")}</small></strong><span className="points-cell"><b className="numeric">{player.recentWinRate}% <small>{t("win rate", "胜率")}</small></b><span className="points-track form-track" aria-hidden="true"><i style={{ width: `${player.recentWinRate}%` }} /></span></span><ArrowUpRight size={13} /></Link>)}
      {recentRows.length > visible && <button className="more-button" type="button" onClick={() => setVisible(value => value + 10)}>{t("Show more", "显示更多")} <ChevronDown size={13} /></button>}
      <p className="scope-note">{t("Last 10 matches · minimum 5", "最近10场 · 至少5场")}{daily.data ? ` · ${daily.data.coverage.returned}/${daily.data.coverage.verified}` : ""}</p>
    </>}
  </>;
}

export default function TrackerWorkspace({ domain = "events", initialSection = "data" }: { domain?: Domain; initialSection?: Section }) {
  const { language, t } = useLanguage();
  const [section, setSection] = useState<Section>(initialSection==='analysis'?'data':initialSection);
  const [query, setQuery] = useState("");
  const events = useResource<EventsFeed>(domain === "events" && section === "data" ? "/api/events" : null);
  const standings = useResource<StandingsFeed>(domain === "events" ? "/api/events/standings" : null, valveSnapshot);
  const feed = standings.data || valveSnapshot;
  const playerResults = query.trim() ? feed.items.flatMap(team => team.roster.flatMap(name => {
    const player = trackedRosterPlayer(name);
    return player && `${name} ${player.lookup} ${team.name}`.toLowerCase().includes(query.trim().toLowerCase()) ? [{ name, player, team }] : [];
  })) : [];
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const requested = params.get("section"), search = params.get("q");
    const timer = window.setTimeout(() => {
      setSection(["data", "rankings", "compare"].includes(requested || "") ? requested as Section : initialSection==='analysis'?'data':initialSection);
      setQuery(search ? search.slice(0, 100) : "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [domain, initialSection]);
  const switchSection = useCallback((value: Section) => {
    setSection(value); setQuery("");
    const url = new URL(window.location.href); url.searchParams.set("section", value); url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const sections = useMemo(() => [
    { id: "data" as const, label: t("Data", "数据"), icon: CalendarDays }, { id: "rankings" as const, label: t("Rankings", "榜单"), icon: BarChart3 },
    { id: "compare" as const, label: t("Compare", "对比"), icon: ArrowDownUp },
  ], [t]);
  return <div className="site-shell compact-shell">
    <SiteHeader activeHref={domain === "events" ? "/matches" : "/faceit"} status="CS2" />
    <main className="workspace-main">
      <div className="workspace-heading"><div><h1>{domain === "events" ? t("Important events", "重要赛事") : "FACEIT"}<span className="heading-badge">CS2</span></h1><p className="workspace-scope">{domain === "events" ? "Major / IEM / ESL / BLAST / PGL" : t("Players · matches · performance", "选手 · 比赛 · 表现")}</p></div><div className="heading-actions"><button className="secondary-button" type="button" onClick={() => switchSection("compare")}><ArrowDownUp size={15} />{domain === "events" ? t("Compare teams", "战队对比") : t("Compare players", "选手对比")}</button><button className="primary-button" type="button" onClick={() => switchSection("rankings")}><Trophy size={15} />{t("View rankings", "查看榜单")}<ArrowRight size={14} /></button></div></div>
      <div className="workspace-context"><span><ShieldCheck size={13} />{domain === "events" ? "Valve" : "FACEIT Data API"}</span><span>{domain === "events" ? `${t("Ranking snapshot", "榜单快照")} ${feed.snapshotDate}` : t("Current profile · recent match samples", "实时档案 · 近期比赛样本")}</span><span className="context-tail">{domain === "events" ? t("5 main event series", "5 个主赛事系列") : t("Independent statistics", "独立统计")}</span></div>
      {domain === "events" && (section === "data" || section === "rankings") && <CircuitOverview feed={feed} onSelect={name => { switchSection("rankings"); setQuery(name); }} />}
      <div className="workspace-surface"><div className="workspace-toolbar" data-has-search={section === "data" || section === "rankings"}><div className="workspace-tabs" role="tablist" aria-label={t("Data sections", "数据分区")}>{sections.map(item => <button type="button" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} role="tab" aria-selected={section === item.id} key={item.id} onClick={() => switchSection(item.id)}><item.icon size={15} />{item.label}</button>)}</div><label className="workspace-search"><Search size={16} /><input type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder={domain === "events" ? t("Search events, teams, players", "搜索赛事、战队、选手") : t("Search players or teams", "搜索选手或战队")} aria-label={t("Search", "搜索")} />{query && <button type="button" aria-label={t("Clear search", "清空搜索")} onClick={() => setQuery("")}><X size={14} /></button>}</label></div>
      <div className="panel-title"><span><Database size={14} />{sections.find(item => item.id === section)?.label}<small>{domain === "events" ? t("PRO CIRCUIT", "职业赛事") : "FACEIT"}</small></span><span><SlidersHorizontal size={13} />{section === "data" ? t("Filter & explore", "筛选与浏览") : section === "rankings" ? t("Rankings", "榜单") : section === "compare" ? t("Players", "选手") : t("Matches", "对局")}</span></div>
      <section className="workspace-panel" id={`panel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`}>
        {domain === "events" ? <>
          {section === "data" && <>{playerResults.length > 0 && <div className="player-search-results"><div className="block-heading"><h2>{t("Players", "选手")}</h2><span>{playerResults.length}</span></div>{playerResults.slice(0, 4).map(({ name, player, team }) => <Link key={`${team.rank}-${name}`} className="simple-rank-row player-directory-row" href={`/players/${encodeURIComponent(player.lookup)}?lang=${language}`}><span className="directory-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><strong>{name}<small>{team.name} / FACEIT</small></strong><span className="directory-action">{t("Player stats", "选手数据")} <ArrowUpRight size={13} /></span></Link>)}</div>}<EventsData feed={events.data} loading={events.loading} error={events.error} query={query} retry={events.refresh} hasPlayerResults={playerResults.length > 0} /><details className="compact-disclosure snapshot-peek"><summary><span className="snapshot-icon"><Trophy size={17} /></span><span className="row-identity"><strong>Valve · {t("Top teams", "领先战队")}</strong><small>{feed.snapshotDate} · {feed.items.length} {t("teams", "支战队")}</small></span><span className="row-tag">{t("Top 5", "前 5 名")}</span><ChevronDown size={14} /></summary><div className="snapshot-table"><StandingRows feed={{ ...feed, items: feed.items.slice(0, 5) }} query={query} limit={5} /><button className="more-button" type="button" onClick={() => switchSection("rankings")}>{t("Full rankings", "完整榜单")} <ArrowRight size={14} /></button></div></details></>}
          {section === "rankings" && <><EventRankings feed={feed} query={query} />{(standings.error || feed.stale) && <p className="scope-note">{t("Using dated saved snapshot", "使用注明日期的保存快照")}</p>}</>}
          {section === "compare" && <PlayerComparison domain="faceit" />}
        </> : <>
          {section === "data" && <FaceitData query={query} />}
          {section === "rankings" && <FaceitRankings query={query} />}
          {section === "compare" && <PlayerComparison domain="faceit" />}
        </>}
      </section>
      </div>
      <Sources domain={domain} />
      <footer className="workspace-footer"><span>CS2 PRO TRACKER</span><div><Link href={`/news?lang=${language}`}>{t("News", "动态")}</Link><Link href={`/community?lang=${language}`}>{t("Contact", "联系")}</Link><span>{t("Unofficial", "非官方站点")}</span></div></footer>
    </main>
  </div>;
}
