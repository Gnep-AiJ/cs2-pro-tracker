"use client";

import { ArrowLeft, ExternalLink, Gamepad2, Newspaper, RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ScorePlayer = {
  id: string;
  nickname: string;
  kills: number | null;
  deaths: number | null;
  plusMinus: number | null;
  assists: number | null;
  kd: number | null;
  kr: number | null;
  adr: number | null;
  headshotPercent: number | null;
  mvps: number | null;
  firstKills: number | null;
  clutchKills: number | null;
  avatar: string | null;
  level: number | null;
};

type MatchTeam = {
  name: string;
  avatar: string | null;
  rating: number | null;
  winProbability: number | null;
  score: number | null;
  won: boolean;
  firstHalfScore: number | null;
  secondHalfScore: number | null;
  overtimeScore: number | null;
  players: ScorePlayer[];
};

type Match = {
  id: string;
  playerId: string | null;
  competitionName: string;
  region: string | null;
  mode: string;
  playedAt: string | null;
  durationMinutes: number | null;
  map: string | null;
  mapImage: string | null;
  faceitUrl: string | null;
  demoUrl: string | null;
  scoreboard: MatchTeam[];
};

const nav = [
  { href: "/faceit", label: "FACEIT", icon: Gamepad2 },
  { href: "/rankings", label: "排行榜", icon: Trophy },
  { href: "/news", label: "动态", icon: Newspaper },
];

function Logo() {
  return <div className="brand"><span className="brand-mark">C2</span><span><b>CS2</b><small>PRO TRACKER</small></span></div>;
}

function display(value: number | null, suffix = "") {
  return value == null ? "—" : `${value}${suffix}`;
}

function time(value: string | null) {
  if (!value) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function Team({ team, fallback }: { team?: MatchTeam; fallback: string }) {
  return <div className="match-v3-team">
    <div className="match-v3-team-avatar"><span>{(team?.name || fallback).slice(0, 2)}</span>{team?.avatar ? <img src={team.avatar} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}</div>
    <strong>{team?.name || fallback}</strong>
    <small>Rating {display(team?.rating ?? null)} · 预测胜率 {team?.winProbability != null ? `${Math.round(team.winProbability * 100)}%` : "—"}</small>
  </div>;
}

export default function MatchDetail({ nickname, matchId, playerId }: { nickname: string; matchId: string; playerId: string }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
      const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}${query}`, { cache: "no-store" });
      const payload = await response.json() as { match?: Match; error?: string };
      if (!response.ok || !payload.match) throw new Error(payload.error || "比赛数据请求失败");
      setMatch(payload.match);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "比赛统计暂时无法读取");
    } finally {
      setLoading(false);
    }
  }, [matchId, playerId]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(first);
  }, [load]);

  return <div className="site-shell detail-shell match-page-v3">
    <header>
      <Link href="/faceit" aria-label="返回 FACEIT 日报"><Logo /></Link>
      <nav aria-label="站内导航">{nav.map(item => <Link className={item.href === "/faceit" ? "active" : ""} key={item.href} href={item.href}><item.icon size={17} /><span>{item.label}</span></Link>)}</nav>
      <div className="header-status"><i />FACEIT 对局详情</div>
      <button type="button" className="refresh" onClick={() => void load()} disabled={loading} aria-label="刷新比赛统计"><RefreshCw size={17} className={loading ? "spin" : ""} /></button>
    </header>

    <main className="player-detail-main">
      <Link className="back-link" href={`/players/${encodeURIComponent(nickname)}`}><ArrowLeft size={17} />返回 {nickname} 的个人页</Link>
      {loading ? <div className="detail-loading"><i /><span>正在读取完整记分板…</span></div> : error ? <div className="detail-empty"><h2>记分板暂时不可用</h2><p>{error}</p><button type="button" onClick={() => void load()}>重新加载</button></div> : match ? <>
        <section className="match-v3-hero">
          {match.mapImage ? <img src={match.mapImage} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}
          <div className="match-v3-top"><span>{match.competitionName}</span><div>{match.faceitUrl ? <a href={match.faceitUrl} target="_blank" rel="noreferrer">FACEIT 比赛房间 <ExternalLink size={13} /></a> : null}{match.demoUrl ? <span className="match-demo-note">Demo 请前往 FACEIT 下载</span> : null}</div></div>
          <div className="match-v3-versus">
            <Team team={match.scoreboard[0]} fallback="队伍 1" />
            <div className="match-v3-score"><strong>{match.scoreboard[0]?.score ?? "—"}<i>:</i>{match.scoreboard[1]?.score ?? "—"}</strong><span>{match.map || "地图未知"}</span></div>
            <Team team={match.scoreboard[1]} fallback="队伍 2" />
          </div>
          <div className="match-v3-meta"><span>{time(match.playedAt)}</span><span>{match.region || "赛区未知"}</span><span>{match.mode}</span><span>{match.durationMinutes ? `${match.durationMinutes} 分钟` : "时长未知"}</span></div>
        </section>

        <section className="match-v3-scoreboards">
          {match.scoreboard.map((team, teamIndex) => <div className="match-v3-board" key={`${team.name}-${teamIndex}`}>
            <header><span className={team.won ? "win" : "loss"}>{team.won ? "胜方" : "负方"}</span><h2>{team.name}</h2><strong>{team.score ?? "—"}</strong></header>
            <div className="match-v3-table-wrap"><table><thead><tr><th>选手</th><th>K</th><th>D</th><th>+/-</th><th>A</th><th>K/D</th><th>K/R</th><th>ADR</th><th>HS%</th><th>MVP</th><th>首杀</th><th>残局</th></tr></thead><tbody>{team.players.map(row => {
              const current = !!playerId && row.id === playerId;
              return <tr className={current ? "current" : ""} key={row.id || row.nickname}><th><i><small>{row.nickname.slice(0, 2)}</small>{row.avatar ? <img src={row.avatar} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}</i><span>{row.nickname}<small>{current ? "当前选手" : row.level != null ? `LV.${row.level}` : ""}</small></span></th><td>{display(row.kills)}</td><td>{display(row.deaths)}</td><td className={(row.plusMinus || 0) >= 0 ? "positive" : "negative"}>{row.plusMinus == null ? "—" : `${row.plusMinus >= 0 ? "+" : ""}${row.plusMinus}`}</td><td>{display(row.assists)}</td><td>{display(row.kd)}</td><td>{display(row.kr)}</td><td>{display(row.adr)}</td><td>{display(row.headshotPercent, "%")}</td><td>{display(row.mvps)}</td><td>{display(row.firstKills)}</td><td>{display(row.clutchKills)}</td></tr>;
            })}</tbody></table></div>
          </div>)}
        </section>
      </> : null}
    </main>
  </div>;
}
