"use client";

import { Hammer, Trophy } from "lucide-react";
import Link from "next/link";
import { Logo, siteNav } from "./LiveTracker";

export default function CommunityPage() {
  return <div className="site-shell">
    <header>
      <Logo />
      <nav aria-label="站内导航">{siteNav.map(item => <Link className={item.href === "/community" ? "active" : ""} key={item.href} href={item.href}><item.icon size={16} /><span>{item.label}</span></Link>)}</nav>
    </header>

    <main>
      <section className="content-section community-placeholder">
        <div className="empty">
          <Hammer size={27} />
          <h3>社区暂未开放</h3>
          <p>社区功能正在筹备中，你可以先查看 FACEIT 日报和职业圈动态。</p>
        </div>
      </section>
    </main>

      <footer><Logo /><span>FACEIT 日报与职业选手追踪</span><Trophy size={17} /></footer>
  </div>;
}
