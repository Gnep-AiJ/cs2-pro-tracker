"use client";

import { Gamepad2, Globe2, Newspaper, RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

export const siteNav = [
  { href: "/faceit", label: "FACEIT", english: "FACEIT", icon: Gamepad2 },
  { href: "/matches", label: "赛事", english: "Events", icon: Trophy },
  { href: "/news", label: "动态", english: "News", icon: Newspaper },
];

export function Logo() {
  return <div className="brand"><span className="brand-mark">C2<span /></span><span className="brand-wordmark"><b>CS2<span>PRO</span></b><small>TRACK THE GAME</small></span></div>;
}
export default function SiteHeader({
  activeHref,
  status,
  onRefresh,
  refreshing = false,
  refreshLabel = "刷新数据",
}: {
  activeHref: string;
  status: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
}) {
  const { language, setLanguage, t } = useLanguage();
  return <header className={"portal-header section-"+activeHref.split("/")[1]}>
    <Link href={`/?lang=${language}`} aria-label={t("Home", "首页")}><Logo /></Link>
    <nav aria-label={t("Navigation", "站内导航")}>{siteNav.map(item => <Link aria-current={item.href === activeHref || item.href === "/faceit" && activeHref === "/" ? "page" : undefined} className={item.href === activeHref || item.href === "/faceit" && activeHref === "/" ? "active" : ""} key={item.href} href={`${item.href}?lang=${language}`}><item.icon size={16} /><span>{t(item.english, item.label)}</span></Link>)}</nav>
    <div className="header-actions"><div className="header-status">{status}</div>
    <div className="language-switch" role="group" aria-label={t("Language", "语言")}><Globe2 size={14} /><button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button><button type="button" aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>中文</button></div>
    {onRefresh ? <button type="button" className="refresh" onClick={onRefresh} disabled={refreshing} aria-label={refreshLabel}><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button> : null}
    </div>
  </header>;
}
