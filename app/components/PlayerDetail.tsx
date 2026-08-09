"use client";

import { ArrowLeft, ChevronRight, ExternalLink, Gamepad2, Newspaper, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RecentMatch = {
  id: string;
  playedAt: string | null;
  result: "W" | "L" | null;
  mode: string;
  score: string | null;
  opponent: string | null;
  competitionName: string;
  region: string | null;
  map: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  kd: number | null;
  adr: number | null;
  headshots: number | null;
};

type MapSummary = { map: string; matches: number; wins: number; winRate: number; kd: number | null; adr: number | null; kills: number | null };
type MapPool = { map: string; matches: number | null; wins: number | null; winRate: number | null; averageKills: number | null; averageKd: number | null; averageKr: number | null; adr: number | null; headshots: number | null };
type Teammate = { id: string; nickname: string; avatar: string | null; matches: number; wins: number; winRate: number };

type Player = {
  id: string;
  nickname: string;
  faceitNickname: string;
  team: string;
  role: string;
  avatar: string | null;
  coverImage: string | null;
  faceitUrl: string | null;
  verified: boolean;
  country: string | null;
  elo: number | null;
  level: number | null;
  ranking: { region: string | null; regionPosition: number | null; country: string | null; countryPosition: number | null };
  lastMatchAt: string | null;
  today: { matches: number; wins: number; losses: number };
  recentSummary: { sampleSize: number; wins: number; losses: number; winRate: number | null; streak: string | null };
  lifetime: {
    matches: number | null;
    wins: number | null;
    winRate: number | null;
    averageKd: number | null;
    averageHeadshots: number | null;
    longestWinStreak: number | null;
    currentWinStreak: number | null;
    adr: number | null;
    entryRate: number | null;
    entrySuccessRate: number | null;
    clutch1v1: number | null;
    clutch1v2: number | null;
    utilityDamagePerRound: number | null;
    flashesPerRound: number | null;
    enemiesFlashedPerRound: number | null;
    sniperKillRate: number | null;
  };
  recentPerformance: { sampleSize: number; kills: number | null; deaths: number | null; assists: number | null; kd: number | null; kr: number | null; adr: number | null; headshots: number | null };
  recentMaps: MapSummary[];
  mapPool: MapPool[];
  frequentTeammates: Teammate[];
  recentMatches: RecentMatch[];
};

type Section = "overview" | "maps" | "matches";

const nav = [
  { href: "/faceit", label: "FACEIT", icon: Gamepad2 },
  { href: "/rankings", label: "排行榜", icon: Trophy },
  { href: "/news", label: "动态", icon: Newspaper },
];

function flag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)));
}

function time(value: string | null) {
  if (!value) return "暂无记录";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function value(number: number | null, suffix = "", digits = 1) {
  return number == null ? "—" : `${Number(number.toFixed(digits))}${suffix}`;
}

function percent(number: number | null) {
  return number == null ? "—" : `${Math.round(number * 100)}%`;
}

function Logo() {
  return <div className="brand"><span className="brand-mark">C2</span><span><b>CS2</b><small>PRO TRACKER</small></span></div>;
}

function mapName(match: RecentMatch) {
  return (match.map || match.mode || "未知地图").replace(/^de_/i, "");
}

function RecentFormStrip({ matches, openMatches }: { matches: RecentMatch[]; openMatches: () => void }) {
  const recent = matches.slice(0, 5);
  const wins = recent.filter(match => match.result === "W").length;
  const losses = recent.filter(match => match.result === "L").length;
  const adrValues = recent.flatMap(match => match.adr == null ? [] : [match.adr]);
  const kdValues = recent.flatMap(match => match.kd == null ? [] : [match.kd]);
  const averageAdr = adrValues.length ? adrValues.reduce((sum, number) => sum + number, 0) / adrValues.length : null;
  const averageKd = kdValues.length ? kdValues.reduce((sum, number) => sum + number, 0) / kdValues.length : null;
  const latestResult = recent[0]?.result;
  const currentStreak = latestResult ? recent.findIndex(match => match.result !== latestResult) : 0;
  const streakLength = latestResult ? (currentStreak === -1 ? recent.length : currentStreak) : 0;

  return <div className="player-v3-form-strip" aria-label={`最近 ${recent.length} 场比赛状态`}>
    <div className="player-v3-form-result">
      <span><small>最近 {recent.length} 场</small><strong><i>{wins} 胜</i><em>{losses} 负</em></strong></span>
      <div className="player-v3-result-sequence" aria-label="最近比赛胜负，左侧为最新">
        {recent.map(match => <span className={match.result === "W" ? "win" : "loss"} key={match.id} title={`${mapName(match)} · ADR ${match.adr ?? "—"} · K/D ${match.kd ?? "—"}`}>
          <b>{match.result === "W" ? "胜" : match.result === "L" ? "负" : "—"}</b>
          <small>{mapName(match)}</small>
        </span>)}
      </div>
    </div>
    <div className="player-v3-form-metrics">
      <span><small>场均 ADR</small><strong>{value(averageAdr)}</strong></span>
      <span><small>场均 K/D</small><strong>{value(averageKd, "", 2)}</strong></span>
      <span><small>当前走势</small><strong>{streakLength ? `${latestResult === "W" ? "连胜" : "连败"} ${streakLength} 场` : "—"}</strong></span>
      <button type="button" onClick={openMatches}>查看完整比赛记录 <ChevronRight size={16} /></button>
    </div>
  </div>;
}

export default function PlayerDetail({ nickname }: { nickname: string }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/players/${encodeURIComponent(nickname)}`, { cache: "no-store" });
      const payload = await response.json() as { player?: Player; error?: string };
      if (!response.ok || !payload.player) throw new Error(payload.error || "FACEIT 数据请求失败");
      setPlayer(payload.player);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "FACEIT 数据暂时没有响应");
    } finally {
      setLoading(false);
    }
  }, [nickname]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(first);
  }, [load]);

  return <div className="site-shell detail-shell player-page-v3">
    <header>
      <Link href="/faceit" aria-label="返回 FACEIT 日报"><Logo /></Link>
      <nav aria-label="站内导航">{nav.map(item => <Link className={item.href === "/faceit" ? "active" : ""} key={item.href} href={item.href}><item.icon size={17} /><span>{item.label}</span></Link>)}</nav>
      <div className="header-status"><i />职业选手数据中心</div>
      <button type="button" className="refresh" onClick={() => void load()} disabled={loading} aria-label="刷新选手数据"><RefreshCw size={17} className={loading ? "spin" : ""} /></button>
    </header>

    <main className="player-detail-main">
      <Link className="back-link" href="/faceit"><ArrowLeft size={17} />返回 FACEIT 日报</Link>
      {loading ? <div className="detail-loading"><i /><span>正在读取选手资料与最近比赛…</span></div> : error ? <div className="detail-empty"><h2>暂时连接不上</h2><p>{error}</p><button type="button" onClick={() => void load()}>重新加载</button></div> : player ? <>
        <section className="player-v3-hero">
          {player.coverImage ? <img className="player-v3-cover" src={player.coverImage} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}
          <div className="player-v3-identity">
            <div className="player-v3-avatar"><span>{player.nickname.slice(0, 2)}</span>{player.avatar ? <img src={player.avatar} alt={`${player.nickname} FACEIT 头像`} onError={event => { event.currentTarget.style.display = "none"; }} /> : null}</div>
            <div><span>{flag(player.country)} {player.team} · {player.role}</span><h1>{player.nickname}{player.verified ? <ShieldCheck size={20} /> : null}</h1><small className="player-v3-level-line"><b>LV.{player.level ?? "—"}</b>{player.faceitNickname}</small>{player.faceitUrl ? <a href={player.faceitUrl.replace("{lang}", "en")} target="_blank" rel="noreferrer">FACEIT 官方主页 <ExternalLink size={13} /></a> : null}</div>
          </div>
          <div className="player-v3-hero-stats" aria-label="选手 FACEIT 摘要">
            <span className="primary"><small>当前 ELO</small><strong>{player.elo?.toLocaleString() || "—"}</strong></span>
            <span><small>{player.ranking.region ? `${player.ranking.region}${player.ranking.regionPosition && player.ranking.regionPosition <= 1000 ? " CHALLENGER" : " 区域排名"}` : "区域排名"}</small><strong>{player.ranking.regionPosition ? `#${player.ranking.regionPosition.toLocaleString()}` : "—"}</strong></span>
            <span><small>今日战绩</small><strong>{player.today.matches ? `${player.today.wins} 胜 ${player.today.losses} 负` : "未开打"}</strong></span>
            <p>{player.ranking.countryPosition ? `${flag(player.ranking.country)} 国家排名 #${player.ranking.countryPosition.toLocaleString()} · ` : ""}最近比赛 {time(player.lastMatchAt)}</p>
          </div>
        </section>

        <div className="player-v3-tabs" role="tablist" aria-label="选手数据分区">
          <button type="button" role="tab" aria-selected={section === "overview"} onClick={() => setSection("overview")}><span className="tab-label">数据概览</span></button>
          <button type="button" role="tab" aria-selected={section === "maps"} onClick={() => setSection("maps")}><span className="tab-label">地图数据</span></button>
          <button type="button" role="tab" aria-selected={section === "matches"} onClick={() => setSection("matches")}><span className="tab-label">比赛记录</span><span className="tab-count">{player.recentMatches.length}</span></button>
        </div>

        {section === "overview" ? <section className="player-v3-section" role="tabpanel">
          <div className="player-v3-kpis">
            <div><small>近 {player.recentSummary.sampleSize} 场胜率</small><strong>{value(player.recentSummary.winRate, "%", 0)}</strong><span>{player.recentSummary.wins} 胜 · {player.recentSummary.losses} 负</span></div>
            <div><small>平均 K/D</small><strong>{value(player.recentPerformance.kd, "", 2)}</strong><span>{value(player.recentPerformance.kills)} 杀 / {value(player.recentPerformance.deaths)} 死</span></div>
            <div><small>平均 ADR</small><strong>{value(player.recentPerformance.adr)}</strong><span>近 {player.recentPerformance.sampleSize} 场</span></div>
            <div><small>爆头率</small><strong>{value(player.recentPerformance.headshots, "%")}</strong><span>场均助攻 {value(player.recentPerformance.assists)}</span></div>
          </div>

          <div className="player-v3-overview">
            <div className="player-v3-form">
              <div className="player-v3-heading"><div><span>RECENT FORM</span><h2>近期状态</h2></div><p>按时间倒序排列，完整数据可进入比赛记录查看。</p></div>
              <RecentFormStrip matches={player.recentMatches} openMatches={() => setSection("matches")} />
            </div>
            <div className="player-v3-summary">
              <div className="player-v3-heading"><div><span>CAREER</span><h2>官方生涯数据</h2></div></div>
              <dl className="player-v3-career-grid">
                <div><dt>总比赛</dt><dd>{value(player.lifetime.matches, "", 0)}</dd><small>{value(player.lifetime.wins, "", 0)} 场胜利</small></div>
                <div><dt>生涯胜率</dt><dd>{value(player.lifetime.winRate, "%", 0)}</dd><small>FACEIT 官方统计</small></div>
                <div><dt>平均 K/D</dt><dd>{value(player.lifetime.averageKd, "", 2)}</dd><small>平均 ADR {value(player.lifetime.adr)}</small></div>
                <div><dt>平均爆头率</dt><dd>{value(player.lifetime.averageHeadshots, "%")}</dd><small>基于全部可用比赛</small></div>
                <div><dt>首杀成功率</dt><dd>{percent(player.lifetime.entrySuccessRate)}</dd><small>尝试率 {percent(player.lifetime.entryRate)}</small></div>
                <div><dt>残局胜率</dt><dd>{percent(player.lifetime.clutch1v1)}</dd><small>1v2 {percent(player.lifetime.clutch1v2)}</small></div>
                <div><dt>每回合道具伤害</dt><dd>{value(player.lifetime.utilityDamagePerRound)}</dd><small>闪光敌人 {value(player.lifetime.enemiesFlashedPerRound)}</small></div>
                <div><dt>当前连胜</dt><dd>{value(player.lifetime.currentWinStreak, "", 0)}</dd><small>最长 {value(player.lifetime.longestWinStreak, "", 0)} 场</small></div>
              </dl>
            </div>
          </div>
        </section> : null}

        {section === "maps" ? <section className="player-v3-section" role="tabpanel">
          <div className="player-v3-heading"><div><span>MAP PERFORMANCE</span><h2>地图表现</h2></div><p>近期数据统计最近 20 场；生涯数据来自 FACEIT 官方地图统计。</p></div>
          <div className="player-v3-table-wrap"><table className="player-v3-table"><thead><tr><th>地图</th><th>近期场次</th><th>近期胜率</th><th>近期 K/D</th><th>近期 ADR</th><th>生涯场次</th><th>生涯胜率</th></tr></thead><tbody>{player.mapPool.map(map => {
            const recent = player.recentMaps.find(item => item.map.toLowerCase() === map.map.toLowerCase());
            return <tr key={map.map}><th>{map.map}</th><td>{recent?.matches ?? "—"}</td><td>{recent ? `${recent.winRate}%` : "—"}</td><td>{value(recent?.kd ?? null, "", 2)}</td><td>{value(recent?.adr ?? null)}</td><td>{value(map.matches, "", 0)}</td><td>{value(map.winRate, "%", 0)}</td></tr>;
          })}</tbody></table></div>
          <div className="player-v3-heading teammate-heading"><div><span>RECENT TEAMMATES</span><h2>近期常见队友</h2></div><p>按最近 30 场同队次数排序</p></div>
          <div className="player-v3-teammates">{player.frequentTeammates.map(teammate => <div key={teammate.id || teammate.nickname}><i><small>{teammate.nickname.slice(0, 2)}</small>{teammate.avatar ? <img src={teammate.avatar} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}</i><span><b>{teammate.nickname}</b><small>{teammate.matches} 场同队 · {teammate.winRate}% 胜率</small></span></div>)}</div>
        </section> : null}

        {section === "matches" ? <section className="player-v3-section" role="tabpanel">
          <div className="player-v3-heading"><div><span>MATCH HISTORY</span><h2>最近比赛</h2></div><p>点击任意一场查看双方阵容与完整记分板</p></div>
          <div className="player-v3-match-columns" aria-hidden="true"><span>结果/地图</span><span>对手/比分</span><span>个人数据</span><span>操作</span></div>
          <div className="player-v3-matches">{player.recentMatches.map(match => <Link className={match.result === "W" ? "win" : "loss"} key={match.id} href={`/players/${encodeURIComponent(player.nickname)}/matches/${encodeURIComponent(match.id)}?playerId=${encodeURIComponent(player.id)}`}>
            <span className="player-v3-match-result"><b>{match.result === "W" ? "胜" : match.result === "L" ? "负" : "—"}</b><small>{mapName(match)}</small></span>
            <span className="player-v3-match-main"><span><strong>{match.opponent ? `对阵 ${match.opponent}` : "FACEIT 匹配对局"}</strong><b>{match.score || "—"}</b></span><small>{time(match.playedAt)} · {match.competitionName} · {match.region || "赛区未知"}</small></span>
            <span className="player-v3-match-stats">
              <span><small>K-D-A</small><strong>{match.kills == null ? "—" : `${match.kills}-${match.deaths ?? "—"}-${match.assists ?? "—"}`}</strong></span>
              <span><small>K/D</small><strong>{value(match.kd, "", 2)}</strong></span>
              <span><small>ADR</small><strong>{value(match.adr)}</strong></span>
              <span><small>爆头率</small><strong>{value(match.headshots, "%")}</strong></span>
            </span>
            <span className="player-v3-match-open">比赛详情 <ChevronRight size={17} /></span>
          </Link>)}</div>
        </section> : null}
      </> : null}
    </main>
  </div>;
}
