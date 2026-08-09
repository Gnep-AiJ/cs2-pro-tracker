"use client";

import { ChevronLeft, ChevronRight, Gamepad2, Newspaper, RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { readBrowserCache, writeBrowserCache } from "../lib/browser-cache";
import { Logo } from "./LiveTracker";

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

const regions = ["EU", "NA", "SA", "SEA", "OCE"];
const countries = [
  ["", "全部国家"], ["cn", "中国"], ["ru", "俄罗斯"], ["ua", "乌克兰"],
  ["kz", "哈萨克斯坦"], ["kr", "韩国"], ["us", "美国"], ["br", "巴西"],
];
const RANKING_CLIENT_TTL = 60 * 60_000;

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...code.toUpperCase().split("").map(char => 127397 + char.charCodeAt(0)));
}

export default function RankingsBoard() {
  const params = useSearchParams();
  const router = useRouter();
  const [region, setRegion] = useState(() => {
    const value = String(params.get("region") || "EU").toUpperCase();
    return regions.includes(value) ? value : "EU";
  });
  const [country, setCountry] = useState(() => String(params.get("country") || "").toLowerCase());
  const [targetPlayer, setTargetPlayer] = useState(() => String(params.get("player") || ""));
  const [offset, setOffset] = useState(() => Math.max(0, Number(params.get("offset") || 0) || 0));
  const [feed, setFeed] = useState<RankingFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
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
  }, [country, load, offset, region, targetPlayer]);

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

  return <div className="site-shell rank-shell">
    <header>
      <Logo />
      <nav aria-label="站内导航"><Link href="/faceit"><Gamepad2 size={16} /><span>FACEIT</span></Link><Link className="active" href="/rankings"><Trophy size={16} /><span>排行榜</span></Link><Link href="/news"><Newspaper size={16} /><span>动态</span></Link></nav>
      <div className="header-status">FACEIT 官方排名</div>
      <button type="button" className="refresh" onClick={() => void load()} disabled={loading} aria-label="刷新排行榜"><RefreshCw size={16} className={loading ? "spin" : ""} /></button>
    </header>

    <main>
      <section className="rank-hero"><div><span>FACEIT CS2</span><h1>排行榜</h1><p>查看官方区域榜、国家榜和职业选手所在位置。点击总览中的排名可直接定位。</p></div><strong><Trophy size={28} /><span><small>{region} 赛区</small>{feed?.targetPosition ? `#${feed.targetPosition.toLocaleString()}` : "Top 1000"}</span></strong></section>

      <section className="rank-panel">
        <div className="rank-filters"><div><span>赛区</span><nav>{regions.map(item => <button type="button" className={region === item ? "active" : ""} key={item} onClick={() => updateFilter(item, country)}>{item}</button>)}</nav></div><label><span>国家/地区</span><select value={country} onChange={event => updateFilter(region, event.target.value)}>{countries.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>

        <div className="rank-caption"><span>{country ? `${countries.find(item => item[0] === country)?.[1] || country} · ` : ""}{region} 排名</span><small>官方 ELO 排序 · 每页 50 名</small></div>
        {error ? <div className="rank-empty"><Trophy size={28} /><b>读取失败</b><p>{error}</p><button type="button" onClick={() => void load()}>重新加载</button></div> : loading ? <div className="rank-loading">{Array.from({ length: 10 }, (_, index) => <i key={index} />)}</div> : feed?.items.length ? <div className="rank-list">{feed.items.map(item => {
          const highlighted = item.player_id === feed.targetPlayerId;
          return <Link href={`/players/${encodeURIComponent(item.nickname)}`} className={`rank-row ${highlighted ? "is-target" : ""}`} key={item.player_id}><b className="rank-position">#{item.position.toLocaleString()}</b><span className="rank-identity"><i>{countryFlag(item.country)}</i><strong>{item.nickname}</strong>{highlighted ? <em>当前选手</em> : null}</span><span className="rank-elo"><small>ELO</small><b>{item.faceit_elo?.toLocaleString() || "--"}</b></span><span className="rank-level">LV.{item.game_skill_level || 10}</span><ChevronRight size={18} /></Link>;
        })}</div> : <div className="rank-empty"><Trophy size={28} /><b>暂无排行记录</b><p>当前筛选没有返回 FACEIT 排名。</p></div>}

        <div className="rank-pagination"><button type="button" disabled={loading || offset === 0} onClick={() => changePage(offset - 50)}><ChevronLeft size={16} />上一页</button><span>第 {Math.floor((feed?.start ?? offset) / 50) + 1} 页</span><button type="button" disabled={loading || !feed?.items.length || feed.items.length < 50} onClick={() => changePage((feed?.start ?? offset) + 50)}>下一页<ChevronRight size={16} /></button></div>
      </section>
    </main>
    <footer><Logo /><span>FACEIT 官方区域与国家排名</span><Trophy size={17} /></footer>
  </div>;
}
