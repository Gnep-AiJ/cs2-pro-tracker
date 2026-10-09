"use client";
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SiteHeader from './SiteHeader';
import MatchScoreboard from './MatchScoreboard';
import { useLanguage } from './LanguageProvider';
export default function CompactMatchDetail({ nickname, matchId, playerId }: { nickname: string; matchId: string; playerId: string }) {
  const { language, t } = useLanguage();
  return <div className="site-shell compact-shell arena-shell"><SiteHeader activeHref="/faceit" status="FACEIT" /><main className="workspace-main arena-main">
    <Link className="compact-back" href={`/players/${encodeURIComponent(nickname)}?lang=${language}&playerId=${encodeURIComponent(playerId)}`}><ArrowLeft size={14}/>{nickname}</Link>
    <div className="profile-heading"><h1>{t('Match details', '对局详情')}</h1><small>FACEIT / CS2</small></div>
    <MatchScoreboard matchId={matchId} playerId={playerId}/>
  </main></div>;
}
