"use client";

import { Gamepad2, Newspaper, RefreshCw, Trophy, Users } from "lucide-react";
import Link from "next/link";

export const siteNav = [
  { href: "/faceit", label: "FACEIT", icon: Gamepad2 },
  { href: "/rankings", label: "排行榜", icon: Trophy },
  { href: "/news", label: "动态", icon: Newspaper },
  { href: "/community", label: "社区", icon: Users },
];

export function Logo() {
  return <div className="brand"><span className="brand-mark">C2</span><span><b>CS2</b><small>PRO TRACKER</small></span></div>;
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
  return <header>
    <Link href="/faceit" aria-label="返回 FACEIT 日报"><Logo /></Link>
    <nav aria-label="站内导航">{siteNav.map(item => <Link className={item.href === activeHref ? "active" : ""} key={item.href} href={item.href}><item.icon size={16} /><span>{item.label}</span></Link>)}</nav>
    <div className="header-status">{status}</div>
    {onRefresh ? <button type="button" className="refresh" onClick={onRefresh} disabled={refreshing} aria-label={refreshLabel}><RefreshCw size={16} className={refreshing ? "spin" : ""} /></button> : null}
  </header>;
}
