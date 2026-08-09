"use client";

import {
  ChevronDown,
  ChevronRight,
  Flame,
  Gamepad2,
  Newspaper,
  RefreshCw,
  Radio,
  Search,
  Trophy,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rankingSnapshot, topTeams } from "../data/tracked-players";
import { readBrowserCache, writeBrowserCache } from "../lib/browser-cache";

type Tab = "faceit" | "news";
type RecentFaceitMatch = {
  id: string;
  playedAt: string | null;
  result: "W" | "L" | "D" | null;
  eloBefore: number | null;
  eloAfter: number | null;
  eloChange: number | null;
  map: string | null;
  mode: string;
};
type Player = {
  id: string;
  nickname: string;
  faceitNickname: string;
  team: string;
  role: string;
  avatar: string | null;
  country: string | null;
  faceitCountry: string | null;
  elo: number | null;
  level: number | null;
  ranking: { region: string | null; position: number | null };
  matchesToday: number | null;
  winsToday: number | null;
  lossesToday: number | null;
  eloChangeToday: number | null;
  lastMatchAt: string | null;
  recentMatches: RecentFaceitMatch[];
  dataAvailable?: boolean;
  identityStatus?: "verified" | "unavailable" | "unverified";
};
type NewsItem = {
  id: string;
  title: string;
  originalTitle: string;
  description: string;
  publishedAt: string | null;
  source: string;
  sourceUrl?: string;
  image: string | null;
  category: string;
  aiTranslated?: boolean;
};
type LiveFeed = {
  updatedAt: string;
  refreshSeconds: number;
  faceit: {
    configured: boolean;
    error: string | null;
    warning?: string | null;
    items: Player[];
    coverage?: { requested: number; profiles: number; recentStats: number; stale: number };
  };
};
type NewsFeed = { items: NewsItem[]; sources: string[]; error: string | null; updatedAt: string };
type OverviewPlayer = {
  id: string; nickname: string; team: string; avatar: string | null;
  matches: number; wins: number; losses: number; winRate: number;
  recentMatches: number; recentWins: number; recentLosses: number; recentWinRate: number; currentWinStreak: number;
};
type OverviewFeed = {
  mode: "today" | "recent";
  summary: { playerAppearances: number; activePlayers: number; wins: number; losses: number };
  insights: { trackedWinRate: number | null; winningPlayers: number; hottest: OverviewPlayer | null };
  leaders: OverviewPlayer[];
  focus: OverviewPlayer | null;
  coverage: { tracked: number; verified: number; returned: number };
  updatedAt: string;
};

const FACEIT_CLIENT_TTL = 60 * 60_000;
const NEWS_CLIENT_TTL = 12 * 60 * 60_000;

function playerSearchTarget(value: string) {
  const normalized = value.trim();
  return ["simple", "s1mple"].includes(normalized.toLowerCase()) ? "s1mple-" : normalized;
}

const tabs = {
  faceit: { href: "/faceit", label: "FACEIT", note: "职业选手今日 FACEIT 状态" },
  news: { href: "/news", label: "动态", note: "职业圈近期动态" },
};

export const siteNav = [
  { href: "/faceit", label: "FACEIT", icon: Gamepad2 },
  { href: "/rankings", label: "排行榜", icon: Trophy },
  { href: "/news", label: "动态", icon: Newspaper },
];

export function Logo() {
  return <div className="brand"><span className="brand-mark">C2</span><span><b>CS2</b><small>PRO TRACKER</small></span></div>;
}

function timeAgo(value: string | null) {
  if (!value) return "时间未知";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function fullTime(value: string | null) {
  if (!value) return "暂无记录";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)));
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty"><Radio size={27} /><h3>{title}</h3><p>{detail}</p></div>;
}

function Loading({ news = false, progress = 0 }: { news?: boolean; progress?: number }) {
  return <>{news ? <div className="news-loading-progress" role="status" aria-live="polite"><span><b>正在聚合近期动态</b><small>{Math.round(progress)}%</small></span><i><em style={{ width: `${progress}%` }} /></i><p>正在整理中文摘要，首次打开可能需要几秒。</p></div> : null}<div className="loading-grid">{[1, 2, 3, 4, 5, 6].map(i => <div className="skeleton-card" key={i}><i /><span /><b /></div>)}</div></>;
}

function PlayerCard({ player }: { player: Player }) {
  const available = player.dataAvailable !== false;
  const active = (player.matchesToday || 0) > 0;
  const recent = player.recentMatches || [];
  const recentWins = recent.filter(match => match.result === "W").length;
  const recentLosses = recent.filter(match => match.result === "L").length;
  const recentWinRate = recentWins + recentLosses ? Math.round((recentWins / (recentWins + recentLosses)) * 100) : 0;
  const eloProgress = Math.max(8, Math.min(100, ((player.elo || 2000) - 2000) / 35));
  return <motion.article layout className={`player-card ${active ? "is-active" : ""}`} whileHover={{ y: -4 }} transition={{ duration: .2 }}>
    <div className="card-button player-card-link">
      <div className="player-top">
        <div className="player-avatar"><span>{player.nickname.slice(0, 2)}</span>{player.avatar ? <img src={player.avatar} alt={`${player.nickname} FACEIT 头像`} loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}<i className={active ? "online" : ""} /></div>
        <div className="player-id"><span>{countryFlag(player.country)} {player.team}</span><h3>{player.nickname}</h3><small>{player.role} · LV.{player.level ?? "--"}</small></div>
        <span className={`activity-badge ${active ? "hot" : ""}`}>{!available ? (player.identityStatus === "unverified" ? "身份待核验" : "暂未同步") : active ? <><Flame size={12} /> 今日活跃</> : "今日未开打"}</span>
      </div>
      <div className="elo-block"><span>FACEIT ELO</span><strong>{player.elo?.toLocaleString() || "--"}</strong><em>{player.lastMatchAt ? `最近比赛 ${timeAgo(player.lastMatchAt)}` : "暂无比赛记录"}</em></div>
      <div className="elo-track"><i style={{ width: `${eloProgress}%` }} /></div>
      <div className="player-stats">
        <span>{player.ranking?.position && player.ranking.region ? <Link className="rank-entry" href={`/rankings?region=${encodeURIComponent(player.ranking.region)}&player=${encodeURIComponent(player.id)}`} aria-label={`在排行榜中查看 ${player.nickname}`}><small>{player.ranking.region} 排名</small><b>#{player.ranking.position.toLocaleString()}</b></Link> : <><small>区域排名</small><b>--</b></>}</span>
        <span><small>近况</small><b><i className="win">{recentWins} 胜</i> <i className="loss">{recentLosses} 负</i></b></span>
        <span><small>近期胜率</small><b>{recent.length ? `${recentWinRate}%` : "--"}</b></span>
      </div>
      <Link className="expand-hint" href={`/players/${encodeURIComponent(player.nickname)}`} aria-label={`查看 ${player.nickname} 的个人数据与比赛记录`}><span>查看个人数据与比赛记录</span><ChevronRight size={16} /></Link>
    </div>
  </motion.article>;
}

function NewsCard({ item, featured, expanded, toggle }: { item: NewsItem; featured: boolean; expanded: boolean; toggle: () => void }) {
  return <motion.article layout className={`news-card ${featured ? "featured" : ""}`} whileHover={{ y: -3 }}>
    <button type="button" className="card-button" onClick={toggle} aria-expanded={expanded}>
      <div className="news-image"><Newspaper size={30} />{item.image ? <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}<span>{item.category}</span></div>
      <div className="news-copy"><div><span>{item.source}</span>{item.aiTranslated ? <em>AI 中文摘要</em> : null}<time>{timeAgo(item.publishedAt)}</time></div><h3>{item.title}</h3><p>{item.description || "该来源暂未提供摘要，可查看原始来源。"}</p><span className="read-more">{expanded ? "收起内容" : "展开阅读"}<ChevronDown size={15} className={expanded ? "rotate" : ""} /></span></div>
    </button>
    <AnimatePresence initial={false}>{expanded && <motion.div className="inline-detail news-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
      <span>{item.category} · {item.source}</span><p>{item.description || item.originalTitle}</p><small>{fullTime(item.publishedAt)} · 内容摘要</small>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看原始来源 <ChevronRight size={14} /></a> : null}
    </motion.div>}</AnimatePresence>
  </motion.article>;
}

export default function LiveTracker({ initialTab = "faceit" }: { initialTab?: Tab }) {
  const tab = initialTab;
  const router = useRouter();
  const [liveFeed, setLiveFeed] = useState<LiveFeed | null>(null);
  const [overviewFeed, setOverviewFeed] = useState<OverviewFeed | null>(null);
  const [newsFeed, setNewsFeed] = useState<NewsFeed | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("spirit");
  const [newsCategory, setNewsCategory] = useState("全部");
  const [newsLimit, setNewsLimit] = useState(12);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setLoadingProgress(tab === "news" ? 6 : 0); }
    setError("");
    try {
      if (tab === "faceit") {
        const overviewRequest = fetch("/api/overview", { cache: "no-cache" });
        const response = await fetch(`/api/live?team=${encodeURIComponent(selectedTeam)}`);
        if (!response.ok) throw new Error("FACEIT 数据请求失败");
        const live = await response.json() as LiveFeed;
        setLiveFeed(live);
        writeBrowserCache(`cs2:live:v16b:${selectedTeam}`, live, FACEIT_CLIENT_TTL);
        if (!quiet) setLoading(false);
        const overviewResponse = await overviewRequest;
        if (overviewResponse.ok) {
          const overview = await overviewResponse.json() as OverviewFeed;
          setOverviewFeed(overview);
        }
      } else {
        const response = await fetch("/api/news");
        if (!response.ok) throw new Error("动态数据请求失败");
        const news = await response.json() as NewsFeed;
        setNewsFeed(news);
        writeBrowserCache("cs2:news:v16b", news, NEWS_CLIENT_TTL);
      }
    } catch { if (!quiet) setError("当前内容暂时无法加载，请稍后再试。"); }
    finally { if (!quiet) { setLoadingProgress(100); setLoading(false); } }
  }, [selectedTeam, tab]);

  useEffect(() => {
    const first = window.setTimeout(() => {
      let hasPrimaryCache = false;
      if (tab === "faceit") {
        const cachedLive = readBrowserCache<LiveFeed>(`cs2:live:v16b:${selectedTeam}`);
        if (cachedLive) { setLiveFeed(cachedLive); hasPrimaryCache = true; }
        else setLiveFeed(null);
      } else {
        const cachedNews = readBrowserCache<NewsFeed>("cs2:news:v16b");
        if (cachedNews) { setNewsFeed(cachedNews); hasPrimaryCache = true; }
        else setNewsFeed(null);
      }
      setLoading(!hasPrimaryCache);
      void load(hasPrimaryCache);
    }, 0);
    const interval = tab === "news" ? NEWS_CLIENT_TTL : FACEIT_CLIENT_TTL;
    const timer = window.setInterval(() => void load(true), interval);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [load, selectedTeam, tab]);

  useEffect(() => {
    if (tab !== "news" || !loading) return;
    const progressTimer = window.setInterval(() => setLoadingProgress(value => Math.min(92, value + Math.max(1, (92 - value) * .12))), 280);
    return () => window.clearInterval(progressTimer);
  }, [loading, tab]);

  const visiblePlayers = useMemo(() => {
    return liveFeed?.faceit.items || [];
  }, [liveFeed]);
  const categories = useMemo(() => ["全部", ...new Set((newsFeed?.items || []).map(item => item.category))], [newsFeed]);
  const filteredNews = useMemo(() => (newsFeed?.items || []).filter(item => newsCategory === "全部" || item.category === newsCategory), [newsCategory, newsFeed]);
  const visibleNews = useMemo(() => filteredNews.slice(0, newsLimit), [filteredNews, newsLimit]);
  const currentTab = tabs[tab];
  const totalPlayers = topTeams.reduce((sum, team) => sum + team.members.length, 0);

  return <div className="site-shell">
    <header>
      <Logo />
      <nav aria-label="站内导航">{siteNav.map(item => <Link className={item.href === currentTab.href ? "active" : ""} key={item.href} href={item.href}><item.icon size={16} /><span>{item.label}</span></Link>)}</nav>
      <div className="header-status"><i />职业赛场情报</div>
      <button type="button" className="refresh" onClick={() => void load()} disabled={loading} aria-label="刷新数据"><RefreshCw size={16} className={loading ? "spin" : ""} /></button>
    </header>

    <main>
      {tab === "faceit" && <section className="hero daily-report-hero">
        <div className="daily-report-heading">
          <div><span className="eyebrow">46 名职业选手 · 今日战绩</span><h1><span className="hero-h1-light">今日 FACEIT</span><em>状态日报</em></h1></div>
          <time>{overviewFeed ? `${fullTime(overviewFeed.updatedAt)} 更新 · UTC+8` : "正在同步数据 · UTC+8"}</time>
        </div>
        <div className="spotlight daily-hot-list"><div className="spotlight-label"><Flame size={15} /><span>今日手感火热榜</span></div>{overviewFeed?.leaders.length ? <div className="spotlight-leaders">{overviewFeed.leaders.map((player, index) => { const useToday = overviewFeed.mode === "today" && player.matches > 0; return <Link href={`/players/${encodeURIComponent(player.nickname)}`} key={player.id}><b>0{index + 1}</b><div className="spotlight-avatar"><span>{player.nickname.slice(0, 2)}</span>{player.avatar ? <img src={player.avatar} alt="" onError={event => { event.currentTarget.style.display = "none"; }} /> : null}</div><span><small>{player.team}</small><strong>{player.nickname}</strong></span><em><b>{useToday ? `${player.wins} 胜 ${player.losses} 负` : `${player.recentWins} 胜 ${player.recentLosses} 负`}</b><small>{useToday ? `${player.winRate}% · 今日` : `${player.recentWinRate}% · 近 10 场`}</small></em></Link>; })}</div> : <div className="spotlight-wait">{overviewFeed ? "暂无可用战绩" : "正在生成手感榜…"}</div>}</div>
      </section>}

      <section className={`data-strip data-strip-${tab}`}><div><Gamepad2 size={15} /><span>收录选手</span><b>{totalPlayers}</b></div>{tab === "faceit" ? <div><Trophy size={15} /><span>FACEIT 排行榜</span><Link href="/rankings">查看</Link></div> : <div><Newspaper size={15} /><span>近 30 天动态</span><b>{newsFeed?.items.length || 0}</b></div>}<small>{tab === "faceit" && overviewFeed ? `已收录 ${overviewFeed.coverage.returned} 名核验选手` : tab === "news" && newsFeed ? `${timeAgo(newsFeed.updatedAt)}更新` : "正在同步"}</small></section>

      <section className={`content-section content-section-${tab}`}>
        <div className="section-head"><div><span>{currentTab.note}</span><h2>{currentTab.label}</h2></div><p>{tab === "faceit" ? "选择战队查看完整阵容；点击选手查看个人数据与比赛记录。" : "聚合固定 CS2 信息源，仅展示最近 30 天内容。"}</p></div>
        {tab === "faceit" ? <div className="faceit-controls">
          <span className="mobile-team-label">选择战队</span>
          <div className="team-directory" aria-label="Valve 全球 Top 10 战队">{topTeams.map(team => <button type="button" className={selectedTeam === team.slug ? "active" : ""} key={team.slug} onClick={() => setSelectedTeam(team.slug)}><span><b>#{team.rank}</b><strong>{team.name}</strong><small>{team.points.toLocaleString()} pts</small></span></button>)}</div>
          <div className="ranking-note"><span>{rankingSnapshot.label} · {rankingSnapshot.date}</span><b>10 支战队 · {totalPlayers} 名成员</b></div>
          <form className="player-search-row" onSubmit={event => { event.preventDefault(); const query = playerSearchTarget(playerQuery); if (query) router.push(`/players/${encodeURIComponent(query)}`); }}><label><Search size={17} /><input value={playerQuery} onChange={event => setPlayerQuery(event.target.value)} placeholder="搜索 FACEIT 玩家，例如 s1mple" aria-label="搜索 FACEIT 玩家" /></label><button type="submit" disabled={!playerQuery.trim()}>搜索</button></form>
        </div> : null}
        {tab === "news" && newsFeed ? <><div className="source-row"><span>当前来源</span>{newsFeed.sources.map(source => <b key={source}>{source}</b>)}</div><div className="category-row" aria-label="动态分类">{categories.map(category => <button type="button" className={newsCategory === category ? "active" : ""} key={category} onClick={() => { setNewsCategory(category); setNewsLimit(12); }}>{category}</button>)}</div></> : null}

        {error ? <Empty title="暂时连接不上" detail={error} /> : loading || (tab === "faceit" ? !liveFeed : !newsFeed) ? <Loading news={tab === "news"} progress={loadingProgress} /> : tab === "faceit" ? (
          visiblePlayers.length ? <div className="players-grid team-player-grid">{visiblePlayers.map(player => <PlayerCard key={player.id} player={player} />)}</div> : <Empty title="暂无可用选手数据" detail="可使用上方搜索框查询其他 FACEIT 玩家。" />
        ) : visibleNews.length ? <><div className="news-grid">{visibleNews.map((item, index) => {
          const featured = index === 0 && !!item.image;
          return <NewsCard key={item.id} item={item} featured={featured} expanded={expanded === item.id} toggle={() => setExpanded(current => current === item.id ? null : item.id)} />;
        })}</div>{visibleNews.length < filteredNews.length ? <button type="button" className="load-more-news" onClick={() => setNewsLimit(limit => limit + 12)}>继续加载 {Math.min(12, filteredNews.length - visibleNews.length)} 条</button> : null}</> : <Empty title="该分类暂无近期动态" detail={newsFeed?.error || "该分类近 30 天暂无更新。"} />}
      </section>
    </main>
    <footer><Logo /><span>FACEIT 日报与职业选手追踪</span><Trophy size={17} /></footer>
  </div>;
}
