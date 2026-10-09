"use client";

import { useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import type { PlayerSample } from "../lib/tracker-types";

/** One bar per observed match; missing statistics never become zero bars. */
export default function PerformanceChart({ matches }: { matches: PlayerSample[] }) {
  const { language, t } = useLanguage();
  const [metric, setMetric] = useState<'adr'|'kd'|'kr'|'headshots'|'rating'|'swing'>("adr");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sample = matches.slice(0, 20).toReversed();
  const specs = [{key:'adr',label:'ADR',digits:1,suffix:''},{key:'kd',label:'K/D',digits:2,suffix:''},{key:'kr',label:'K/R',digits:2,suffix:''},{key:'headshots',label:'HS%',digits:1,suffix:'%'},
    {key:'rating',label:'Rating',digits:2,suffix:''},{key:'swing',label:'Swing',digits:2,suffix:'%'}].filter(spec=>sample.some(match=>{const value=match[spec.key as typeof metric];return value!=null&&Number.isFinite(value);}));
  const active = specs.find(s=>s.key===metric) || specs[0];
  if (!active) return null;
  const key = active.key as typeof metric;
  const values = sample.flatMap(match => match[key] == null || !Number.isFinite(match[key]) ? [] : [match[key]!]);
  const signed=key==='swing';
  const ceiling = key === "adr" ? Math.max(100, Math.ceil(Math.max(...values, 0) / 50) * 50) : key==='headshots'?100:Math.max(signed?1:2,Math.ceil(Math.max(...values.map(Math.abs),0)));
  const floor=signed?-ceiling:0;
  const y=(value:number)=>120-(value-floor)/(ceiling-floor)*98;
  const format=(value:number|null|undefined)=>value==null||!Number.isFinite(value)?'—':`${value.toFixed(active.digits)}${active.suffix}`;
  const step = 584 / Math.max(1, sample.length);
  const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", { month: "short", day: "numeric" }).format(new Date(value)) : "—";
  const selected = sample.find(match => match.id === selectedId) || sample.at(-1);
  return <div className="performance-chart">
    <div className="chart-heading"><span><ChartNoAxesCombined size={15} />{t("Match performance", "逐场表现")}<small>{values.length} {t('matches','场')}</small></span><div className="segmented">{specs.map(spec => <button type="button" key={spec.key} aria-pressed={key === spec.key} onClick={() => setMetric(spec.key as typeof metric)}>{spec.label}</button>)}</div></div>
    {values.length ? <svg viewBox="0 0 640 156" role="img" aria-label={`${t("Recent matches, oldest to newest", "近期比赛，从旧到新")} · ${active.label}`}>
      {[floor,(floor+ceiling)/2,ceiling].map(value => <g key={value}><line x1="40" x2="624" y1={y(value)} y2={y(value)} stroke="#344051" strokeDasharray="3 5" /><text x="30" y={y(value)+4} textAnchor="end" fill="#9baabf" fontSize="10">{value}</text></g>)}
      {sample.map((match, index) => {
        const value = match[key], x = 40 + index * step + step * 0.17, width = step * 0.66;
        const valid=value!=null&&Number.isFinite(value),height=valid?Math.abs(y(value)-y(0)):0;
        return <g key={match.id} onClick={() => setSelectedId(match.id)}><title>{`${date(match.playedAt)} · ${match.map || "—"} · ${format(value)} · ${match.result || "—"}`}</title>{!valid ? <text x={x + width / 2} y={y(0)-3} textAnchor="middle" fill="#738197" fontSize="12">—</text> : <rect x={x} y={Math.min(y(value),y(0))} width={width} height={Math.max(1,height)} rx="3" stroke={selected?.id === match.id ? "#ffe7d8" : "none"} strokeWidth="1" fill={index === sample.length - 1 ? "#ff9a64" : match.result === "W" ? "#7bad9b" : "#788ba6"} />}</g>;
      })}
      <text x="40" y="146" fill="#9baabf" fontSize="10">{date(sample[0]?.playedAt || null)}</text><text x="624" y="146" fill="#ffc096" textAnchor="end" fontSize="10">{t("Latest", "最新")} · {date(sample.at(-1)?.playedAt || null)}</text>
    </svg> : <p className="scope-note">{t("No statistics", "暂无统计")}</p>}
    <div className="chart-legend"><span><i />{t("Win", "胜场")}</span><span><i />{t("Other", "其他")}</span><span><i />{t("Latest", "最新")}</span></div>
    {selected && <div className="chart-selection"><label><span>{t("Match", "单场")}</span><select aria-label={t("Chart match", "图表单场比赛")} value={selected.id} onChange={event => setSelectedId(event.target.value)}>{sample.map(match => <option key={match.id} value={match.id}>{date(match.playedAt)} / {match.map || "—"} / {match.result || "—"}</option>)}</select></label><b aria-live="polite">{active.label} <strong>{format(selected[key])}</strong></b></div>}
  </div>;
}
