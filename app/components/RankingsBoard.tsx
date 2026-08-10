"use client";

import { Activity, ChevronLeft, ChevronRight, Flame, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readBrowserCache, writeBrowserCache } from "../lib/browser-cache";
import SiteHeader, { Logo } from "./SiteHeader";

type RankingItem = {
  player_id: string;
  nickname: string;
  country: string | null;
  position: number;
  faceit_elo: number;
  game_skill_level: number;
};

type RankingFeed = {
  region: string;
  country: string | null;
  targetPlayerId: string | null;
  targetPosition: number | null;
  start: number;
  end: number;
  items: RankingItem[];
  updatedAt: string;
};

type DailyPlayer = {
  id: string;
  nickname: string;
  team: string;
  avatar: string | null;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  recentMatches: number;
  recentWins: number;
  recentLosses: number;
  recentWinRate: number;
  currentWinStreak: number;
  lastMatchAt: string | null;
};

type DailyFeed = {
  players: DailyPlayer[];
  coverage: { tracked: number; verified: number; returned: number };
  updatedAt: string;
};

type Insight = {
  status: "generated" | "fallback";
  title: string;
  summary: string;
  highlights: Array<{ playerId: string; label: string; note: string }>;
};

type RankingView = "official" | "daily";
type DailyMetric = "wins" | "activity" | "streak";

const regions = ["EU", "NA", "SA", "SEA", "OCE"];
const countries = [
  ["", "全部国家"], ["cn", "中国"], ["ru", "俄罗斯"], ["ua", "乌克兰"],
  ["kz", "哈萨克斯坦"], ["kr", "韩国"], ["us", "美国"], ["br", "巴西"],
];
const metrics: Array<{ id: DailyMetric; label: string; note: string }> = [
  { id: "wins", label: "今日胜场", note: "胜场优先" },
  { id: "activity", label: "今日活跃", note: "场次优先" },
  { id: "streak", label: "近期连胜", note: "近 10 场" },
];
const RANKING_CLIENT_TTL = 60 * 60_000;
const INSIGHT_CLIENT_TTL = 60 * 60_000;
const RELEASE_VERIFIED_PLAYER_COUNT = 44;

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)));
}

function dailyPrimary(player: DailyPlayer, metric: DailyMetric) {
  if (metric === "activity") return `${player.matches} 场`;
  if (metric === "streak") return player.currentWinStreak ? `${player.currentWinStreak} 连胜` : `${player.recentWinRate}%`;
  return `${player.wins} 胜`;
}

function dailySecondary(player: DailyPlayer, metric: DailyMetric) {
  if (metric === "streak") return `近 ${player.recentMatches} 场胜率 ${player.recentWinRate}%`;
  return `${player.wins} 胜 ${player.losses} 负 · 胜率 ${player.winRate}%`;
}

export default function RankingsBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<RankingView>("official");
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>("wins");
  const [region, setRegion] = useState(() => {
    const value = String(params.get("region") || "EU").toUpperCase();
    return regions.includes(value) ? value : "EU";
  });
  const [country, setCountry] = useState(() => String(params.get("country") || "").toLowerCase());
  const [targetPlayer, setTargetPlayer] = useState(() => String(params.get("player") || ""));
  const [offset, setOffset] = useState(() => Math.max(0, Number(params.get("offset") || 0) || 0));
  const [feed, setFeed] = useState<RankingFeed | null>(null);
  const [dailyFeed, setDailyFeed] = useState<DailyFeed | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [error, setError] = useState("");
  const [dailyError, setDailyError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setError(""); }
    const query = new URLSearchParams({ region, offset: String(offset) });
    if (country) query.set("country", country);
    if (targetPlayer) query.set("player", targetPlayer);
    try {
      const response = await fetch(`/api/rankings?${query}`);
      if (!response.ok) throw new Error("排行榜数据请求失败");
      const ranking = await response.json() as RankingFeed;
      setFeed(ranking);
      writeBrowserCache(`cs2:rankings:v16b:${query}`, ranking, RANKING_CLIENT_TTL);
    } catch {
      if (!quiet) setError("排行榜暂时无法读取，请稍后重试。");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [country, offset, region, targetPlayer]);

  const loadDaily = useCallback(async () => {
    setDailyLoading(true);
    setDailyError("");
    try {
      const response = await fetch("/api/overview", { cache: "no-cache" });
      if (!response.ok) throw new Error("职业选手日榜请求失败");
      setDailyFeed(await response.json() as DailyFeed);
    } catch {
      setDailyError("职业选手日榜暂时无法读取，请稍后重试。");
    } finally {
      setDailyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view !== "official") return;
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ region, offset: String(offset) });
      if (country) query.set("country", country);
      if (targetPlayer) query.set("player", targetPlayer);
      const cached = readBrowserCache<RankingFeed>(`cs2:rankings:v16b:${query}`);
      if (cached) { setFeed(cached); setLoading(false); }
      else { setFeed(null); setLoading(true); }
      void load(!!cached);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [country, load, offset, region, targetPlayer, view]);

  useEffect(() => {
    if (view !== "daily" || dailyFeed || dailyLoading) return;
    const timer = window.setTimeout(() => void loadDaily(), 0);
    return () => window.clearTimeout(timer);
  }, [dailyFeed, dailyLoading, loadDaily, view]);

  const dailyRanked = useMemo(() => {
    const players = dailyFeed?.players || [];
    if (dailyMetric === "streak") {
      return players.filter(player => player.recentMatches >= 5)
        .sort((a, b) => b.currentWinStreak - a.currentWinStreak || b.recentWinRate - a.recentWinRate || b.recentWins - a.recentWins || a.nickname.localeCompare(b.nickname));
    }
    const active = players.filter(player => player.matches > 0);
    if (dailyMetric === "activity") {
      return active.sort((a, b) => b.matches - a.matches || b.wins - a.wins || b.winRate - a.winRate || a.nickname.localeCompare(b.nickname));
    }
    return active.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.matches - a.matches || a.nickname.localeCompare(b.nickname));
  }, [dailyFeed, dailyMetric]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const requestInsight = async (retryOnce: boolean, key: string) => {
      try {
        const response = await fetch("/api/rankings/insights", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: dailyMetric, players: dailyRanked.slice(0, 8) }),
        });
        if (!response.ok) throw new Error("每日看点读取失败");
        const value = await response.json() as Insight;
        if (cancelled) return;
        setInsight(value);
        if (value.status === "generated") {
          writeBrowserCache(key, value, INSIGHT_CLIENT_TTL);
        } else if (retryOnce) {
          retryTimer = window.setTimeout(() => void requestInsight(false, key), 5_000);
        }
      } catch {
        if (!cancelled) setInsight(null);
      }
    };
    const timer = window.setTimeout(() => {
      if (view !== "daily" || !dailyFeed || !dailyRanked.length) { setInsight(null); return; }
      const key = `cs2:rankings:insight:v4:${dailyMetric}:${dailyFeed.updatedAt.slice(0, 13)}`;
      const cached = readBrowserCache<Insight>(key);
      if (cached) { setInsight(cached); return; }
      setInsight(null);
      void requestInsight(true, key);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [dailyFeed, dailyMetric, dailyRanked, view]);

  const updateFilter = (nextRegion: string, nextCountry: string) => {
    setRegion(nextRegion);
    setCountry(nextCountry);
    setTargetPlayer("");
    setOffset(0);
    const query = new URLSearchParams({ region: nextRegion });
    if (nextCountry) query.set("country", nextCountry);
    router.replace(`/rankings?${query}`, { scroll: false });
  };

  const changePage = (nextOffset: number) => {
    const safeOffset = Math.max(0, nextOffset);
    setOffset(safeOffset);
    setTargetPlayer("");
    const query = new URLSearchParams({ region, offset: String(safeOffset) });
    if (country) query.set("country", country);
    router.replace(`/rankings?${query}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeToday = dailyFeed?.players.filter(player => player.matches > 0).length || 0;
  const currentLoading = view === "official" ? loading : dailyLoading;

  return <div className="site-shell rank-shell">
    <SiteHeader activeHref="/rankings" status={view === "official" ? "FACEIT 官方排名" : "职业选手日榜"} onRefresh={() => void (view === "official" ? load() : loadDaily())} refreshing={currentLoading} refreshLabel="刷新排行榜" />

    <main>
      <div className="rank-view-switch" role="group" aria-label="排行榜类型">
        <button type="button" className={view === "official" ? "active" : ""} onClick={() => setView("official")}><Trophy size={16} /><span><b>官方排名</b><small>FACEIT 区域与国家榜</small></span></button>
        <button type="button" className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}><Flame size={16} /><span><b>职业日榜</b><small>已收录职业选手状态</small></span></button>
      </div>

      <section className={`rank-hero ${view === "daily" ? "rank-hero-daily" : ""}`}>
        <div><span>{view === "official" ? "FACEIT CS2" : "VERIFIED PRO DAILY"}</span><h1>{view === "official" ? "排行榜" : "职业日榜"}</h1><p>{view === "official" ? "查看官方区域榜、国家榜和职业选手所在位置。点击总览中的排名可直接定位。" : "基于已收录职业选手的公开 FACEIT 战绩排序，按今日胜场、活跃度与近期连胜查看状态。"}</p></div>
        {view === "official" ? <strong><Trophy size={28} /><span><small>{region} 赛区</small>{feed?.targetPosition ? `#${feed.targetPosition.toLocaleString()}` : "Top 1000"}</span></strong> : <strong><Activity size={28} /><span><small>今日出战</small>{dailyFeed ? `${activeToday} 人` : "读取中"}</span></strong>}
      </section>

      {view === "official" ? <section className="rank-panel">
        <div className="rank-filters"><div><span>赛区</span><nav>{regions.map(item => <button type="button" className={region === item ? "active" : ""} key={item} onClick={() => updateFilter(item, country)}>{item}</button>)}</nav></div><label><span>国家/地区</span><select value={country} onChange={event => updateFilter(region, event.target.value)}>{countries.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>

        <div className="rank-caption"><span>{country ? `${countries.find(item => item[0] === country)?.[1] || country} · ` : ""}{region} 排名</span><small>FACEIT 官方 ELO 排序 · 每页 50 名</small></div>
        {error ? <div className="rank-empty"><Trophy size={28} /><b>读取失败</b><p>{error}</p><button type="button" onClick={() => void load()}>重新加载</button></div> : loading ? <div className="rank-loading">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div> : feed?.items.length ? <div className="rank-list">{feed.items.map(item => {
          const highlighted = item.player_id === feed.targetPlayerId;
          return <Link href={`/players/${encodeURIComponent(item.nickname)}`} className={`rank-row ${highlighted ? "is-target" : ""}`} key={item.player_id}><b className="rank-position">#{item.position.toLocaleString()}</b><span className="rank-identity"><i>{countryFlag(item.country)}</i><strong>{item.nickname}</strong>{highlighted ? <em>当前选手</em> : null}</span><span className="rank-elo"><small>ELO</small><b>{item.faceit_elo?.toLocaleString() || "--"}</b></span><span className="rank-level">LV.{item.game_skill_level || 10}</span><ChevronRight size={18} /></Link>;
        })}</div> : <div className="rank-empty"><Trophy size={28} /><b>暂无排行记录</b><p>当前筛选没有返回 FACEIT 排名。</p></div>}

        <div className="rank-pagination"><button type="button" disabled={loading || offset === 0} onClick={() => changePage(offset - 50)}><ChevronLeft size={16} />上一页</button><span>第 {Math.floor((feed?.start ?? offset) / 50) + 1} 页</span><button type="button" disabled={loading || !feed?.items.length || feed.items.length < 50} onClick={() => changePage((feed?.start ?? offset) + 50)}>下一页<ChevronRight size={16} /></button></div>
      </section> : <section className="rank-panel daily-rank-panel">
        <div className="daily-rank-toolbar">
          <div><span>排序方式</span><nav>{metrics.map(metric => <button type="button" className={dailyMetric === metric.id ? "active" : ""} key={metric.id} onClick={() => setDailyMetric(metric.id)}><b>{metric.label}</b><small>{metric.note}</small></button>)}</nav></div>
          <small>{dailyFeed ? `已收录 ${RELEASE_VERIFIED_PLAYER_COUNT} 名核验选手` : "正在读取核验选手数据"}</small>
        </div>

        {dailyError ? <div className="rank-empty"><Flame size={28} /><b>读取失败</b><p>{dailyError}</p><button type="button" onClick={() => void loadDaily()}>重新加载</button></div> : dailyLoading ? <div className="rank-loading">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div> : dailyRanked.length ? <>
          <article className="rank-ai-brief">
            <div className="rank-ai-label"><Sparkles size={15} /><span>每日数据看点</span></div>
            <h2>{insight?.title || "正在整理今日榜单"}</h2>
            <p>{insight?.summary || "排名由公开比赛数据计算，文字看点不参与排序"}</p>
            {insight?.highlights.length ? <div className="rank-ai-highlights">{insight.highlights.map(item => {
              const player = dailyRanked.find(candidate => candidate.id === item.playerId);
              return player ? <Link href={`/players/${encodeURIComponent(player.nickname)}`} key={`${item.playerId}-${item.label}`}><b>{item.label}</b><span>{player.nickname}</span><small>{item.note}</small></Link> : null;
            })}</div> : null}
          </article>

          <div className="daily-podium">{dailyRanked.slice(0, 3).map((player, index) => <Link href={`/players/${encodeURIComponent(player.nickname)}`} className={`daily-podium-card podium-${index + 1}`} key={player.id}>
            <span className="daily-podium-rank">#{index + 1}</span>
            <span className="daily-podium-name"><small>{player.team}</small><strong>{player.nickname}</strong></span>
            <span className="daily-podium-score"><strong>{dailyPrimary(player, dailyMetric)}</strong><small>{dailySecondary(player, dailyMetric)}</small></span>
          </Link>)}</div>

          {dailyRanked.length > 3 ? <div className="rank-list daily-rank-list">{dailyRanked.slice(3).map((player, index) => <Link href={`/players/${encodeURIComponent(player.nickname)}`} className="rank-row daily-rank-row" key={player.id}><b className="rank-position">#{index + 4}</b><span className="rank-identity"><span><small>{player.team}</small><strong>{player.nickname}</strong></span></span><span className="rank-elo"><b>{dailyPrimary(player, dailyMetric)}</b><small>{dailySecondary(player, dailyMetric)}</small></span><ChevronRight size={18} /></Link>)}</div> : null}
        </> : <div className="rank-empty"><Flame size={28} /><b>{dailyMetric === "streak" ? "近期记录不足" : "今日尚无比赛"}</b><p>当前已收录选手没有可用于该排序的公开记录。</p></div>}
      </section>}
    </main>
    <footer><Logo /><span>{view === "official" ? "FACEIT 官方区域与国家排名" : "已收录职业选手公开 FACEIT 战绩"}</span><Trophy size={17} /></footer>
  </div>;
}
