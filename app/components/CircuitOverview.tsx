"use client";

import { ArrowUpRight, Trophy } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import type { StandingsFeed } from "../lib/tracker-types";

export default function CircuitOverview({ feed, onSelect }: { feed: StandingsFeed; onSelect: (name: string) => void }) {
  const { t } = useLanguage();
  const leaders = feed.items.slice(0, 8), maximum = leaders[0]?.points || 1;
  return <div className="circuit-overview">
    <div className="circuit-caption"><Trophy size={21} /><span><strong>Valve</strong><small>{t("Global standings", "全球排名")}</small></span></div>
    <div className="circuit-leaders">{leaders.slice(0, 3).map(team => <button type="button" key={team.rank} onClick={() => onSelect(team.name)}><span className="circuit-place">#{team.rank}</span><span><strong>{team.name}</strong><small>{team.points.toLocaleString()} {t("pts", "分")}</small></span><ArrowUpRight size={13} /></button>)}</div>
    <div className="circuit-chart"><svg viewBox="0 0 184 55" role="img" aria-label={t("Top eight teams, Valve points", "前八名战队的 Valve 积分")}><line x1="0" y1="53" x2="184" y2="53" stroke="#46505d" />{leaders.map((team, index) => <g key={team.rank}><title>#{team.rank} {team.name}: {team.points}</title><rect x={index * 23 + 3} y={53 - team.points / maximum * 47} width="15" height={team.points / maximum * 47} rx="2" fill={index === 0 ? "#ff9a64" : "#778796"} /></g>)}</svg><small>{feed.snapshotDate}</small></div>
  </div>;
}
