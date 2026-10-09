"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, ChevronDown, ChevronRight, Clock3, GitCompareArrows, Layers3, Search, Trophy, Users, X } from 'lucide-react';
import MapBadge from './MapBadge';
import SiteHeader from './SiteHeader';
import { useLanguage } from './LanguageProvider';
import { FaceitData, Notice, number, useDate, useResource } from './TrackerWorkspace';
import FaceitLeaderboard from './FaceitLeaderboard';
import PlayerComparison from './PlayerComparison';
import Modal from './Modal';
import MatchScoreboard from './MatchScoreboard';
import snapshot from '../data/pro-lab-snapshot.json';
import { findTrackedPlayer } from '../data/tracked-players';
import { fuzzyScore } from '../lib/pro-events';
import type { LabFeed } from '../lib/pro-lab';
import { savedMatchFeed, selectMatches, type FaceitMatch, type MatchFeed } from '../lib/faceit-matches';

const initial = savedMatchFeed(snapshot as LabFeed);
type Tool = 'rankings' | 'compare' | 'players' | 'filters' | null;

function Participants({ match }: { match: FaceitMatch }) {
  return <span className="match-participants">{match.tracked.slice(0, 4).map(p => <span key={p.id}>{p.avatar && <Image src={p.avatar} alt="" width={24} height={24} unoptimized />}<b>{p.display}</b></span>)}{match.tracked.length > 4 && <small>+{match.tracked.length - 4}</small>}</span>;
}
function MatchSummary({ match, featured = false }: { match: FaceitMatch; featured?: boolean }) {
  const { t } = useLanguage();
  const teams = match.teams.length === 2 && match.teams.every(team => team.name);
  return <div className={`match-summary ${featured ? 'featured' : ''}`}>
    {teams ? <div className="match-team-line"><span>{match.teams[0].name?.replace(/^team_/, '')}</span><strong>{number(match.teams[0].score, 0)}<i>:</i>{number(match.teams[1].score, 0)}</strong><span>{match.teams[1].name?.replace(/^team_/, '')}</span></div> : <div className="match-known-line"><Participants match={match} /><span>{t('Match details', '对局详情')}</span></div>}
    {teams && <Participants match={match} />}
  </div>;
}
export default function FaceitWorkspace({ initialTool = null }: { initialTool?: Tool }) {
  const { t } = useLanguage(), date = useDate();
  const resource = useResource<MatchFeed>('/api/faceit/matches', initial), feed = resource.data || initial;
  const [query, setQuery] = useState(''), [playerId, setPlayerId] = useState(''), [playerQuery, setPlayerQuery] = useState(''), [order, setOrder] = useState('recent'), [limit, setLimit] = useState(6);
  const [tool, setTool] = useState<Tool>(initialTool), [matchId, setMatchId] = useState<string | null>(null);
  useEffect(() => {
    const refresh = resource.refresh;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 120000);
    return () => clearInterval(timer);
  }, [resource.refresh]);
  useEffect(() => {
    function readUrl() {
      const params = new URL(location.href).searchParams;
      const section = params.get('section');
      const room = params.get('match') && /^[a-zA-Z0-9-]{8,80}$/.test(params.get('match')!) ? params.get('match') : null;
      setTool(room ? null : section === 'compare' ? 'compare' : section === 'rankings' ? 'rankings' : section === 'players' ? 'players' : initialTool);
      setMatchId(room);
    }
    const timer = setTimeout(readUrl, 0);
    window.addEventListener('popstate', readUrl);
    return () => { clearTimeout(timer); window.removeEventListener('popstate', readUrl); };
  }, [initialTool]);
  function openTool(next: Tool) {
    setTool(next);
    const url = new URL(location.href);
    if (next) { setMatchId(null); url.searchParams.delete('match'); }
    if (next && next !== 'filters') url.searchParams.set('section', next);
    else url.searchParams.delete('section');
    history.replaceState(history.state, '', url);
  }
  function openMatch(id: string | null) {
    setMatchId(id);
    const url = new URL(location.href);
    url.searchParams.delete('section');
    if (id) setTool(null);
    if (id) url.searchParams.set('match', id); else url.searchParams.delete('match');
    history.replaceState(history.state, '', url);
  }
  const matches = selectMatches(feed.items, query, 'all', order, null, playerId);
  const featured = matches.length > 1 && !query.trim() && !playerId && order === 'recent' ? selectMatches(matches.slice(0, 20), '', 'all', 'featured', null)[0] : null;
  const recent = featured ? matches.filter(match => match.id !== featured.id) : matches;
  const players = [...new Map(feed.items.flatMap(m => m.tracked).map(p => [p.id, p])).values()].map(p => ({...p, count: feed.items.filter(m => m.tracked.some(person => person.id === p.id)).length})).sort((a,b) => a.display.localeCompare(b.display));
  const chosenPlayer = players.find(p => p.id === playerId);
  const playerChoices = players.filter(p => fuzzyScore(playerQuery, [p.display, p.nickname, ...(findTrackedPlayer(p.display)?.aliases || [])]) > 0);
  const saved = !['ready', 'partial'].includes(feed.status) || resource.error;
  const title = tool === 'compare' ? t('Player comparison', '选手对比') : tool === 'rankings' ? t('Player rankings', '选手榜单') : tool === 'players' ? t('Find a player', '查找选手') : t('Choose a player', '按选手筛选');
  return <div className="site-shell compact-shell arena-shell"><SiteHeader activeHref="/faceit" status="CS2" onRefresh={resource.refresh} refreshing={resource.loading} refreshLabel={t('Refresh matches', '刷新对局')} /><main className="workspace-main arena-main">
    <div className="arena-heading"><h1>{t('FACEIT matches', 'FACEIT 对局')}</h1><div className="heading-actions"><button type="button" className="arena-button action-rank" onClick={() => openTool('rankings')} aria-haspopup="dialog"><Trophy size={16} />{t('Rankings', '榜单')}</button><button type="button" className="arena-button action-compare" onClick={() => openTool('compare')} aria-haspopup="dialog"><GitCompareArrows size={16} />{t('Compare', '对比')}</button><button type="button" className="arena-button action-search" onClick={() => openTool('players')}><Search size={16} />{t('Find a player', '查找选手')}</button></div></div>
    <div className="arena-status" role="status"><span className={`source-dot ${saved ? 'saved' : ''}`} /><span>{resource.loading ? t('Updating…', '更新中…') : saved ? t('Saved matches', '历史记录') : feed.status === 'partial' ? t('Partial data', '部分数据') : 'FACEIT'}</span><time>{date(feed.observedAt, true)}</time></div>
    {resource.error && <div className="arena-source-note">{t('Update failed. Showing saved matches.', '更新失败，显示历史记录。')}</div>}
    {featured && <button type="button" className="featured-match" aria-haspopup="dialog" onClick={() => openMatch(featured.id)}><div className="featured-match-top"><span><Layers3 size={16} />{t('Featured match', '精选对局')}</span><span>{date(featured.playedAt, true)}<ArrowUpRight size={17} /></span></div><div className="featured-match-content"><div className="featured-map"><MapBadge map={featured.map}/><small>{featured.competition || t('FACEIT match', 'FACEIT 对局')}</small></div><MatchSummary match={featured} featured /></div><div className="featured-match-bottom"><span><Users size={14} />{featured.tracked.length} {t('tracked pros', '名职业选手')}</span><span>{t('Roster & scoreboard', '阵容与记分板')}<ChevronRight size={16} /></span></div></button>}
      <section className="match-stream" aria-labelledby="match-stream-title"><div className="match-stream-heading"><h2 id="match-stream-title"><Clock3 size={17} />{t('Recent matches', '近期对局')}<small>{recent.length}</small></h2><div className="match-stream-order" role="group" aria-label={t('Match order', '对局排序')}><button type="button" aria-pressed={order === 'recent'} onClick={() => { setOrder('recent'); setLimit(6); }}>{t('Latest', '最新')}</button><button type="button" aria-pressed={order === 'featured'} onClick={() => { setOrder('featured'); setLimit(6); }}>{t('More pros', '多人同局')}</button></div></div>
        <div className="match-stream-search"><label><Search size={17} /><input type="search" value={query} maxLength={60} placeholder={t('Player, team or map', '选手、战队或地图')} aria-label={t('Search matches', '搜索对局')} onChange={e => { setQuery(e.target.value); setLimit(6); }} />{query && <button type="button" className="arena-icon-button" aria-label={t('Clear search', '清空搜索')} onClick={() => { setQuery(''); setLimit(6); }}><X size={15} /></button>}</label><button type="button" className={`arena-button ${playerId ? 'filter-active' : ''}`} onClick={() => { setPlayerQuery(''); openTool('filters'); }} aria-haspopup="dialog"><Users size={16} />{t('Players', '按选手')}</button></div>
        {playerId && <div className="active-filters"><span>{chosenPlayer?.display || t('Selected player', '已选选手')} · {matches.length} {t('matches', '场')}</span><button type="button" onClick={() => { setPlayerId(''); setLimit(6); }}>{t('All players', '全部选手')}<X size={13} /></button></div>}
        <div className="match-stream-rows">{recent.slice(0, limit).map(m => <button type="button" className="match-stream-row" aria-haspopup="dialog" key={m.id} onClick={() => openMatch(m.id)}><span className="stream-map"><MapBadge map={m.map} compact/><small>{m.status === 'FINISHED' ? t('Finished', '已结束') : t('Recorded match', '对局记录')}</small></span><MatchSummary match={m} /><span className="stream-time"><time>{date(m.playedAt, true)}</time><small>{m.tracked.length} {t('pros', '名职业选手')}</small></span><ChevronRight size={17} /></button>)}</div>
        {!matches.length && <Notice>{t('No matches found', '暂无匹配对局')}</Notice>}
        {recent.length > limit && <button type="button" className="stream-more" onClick={() => setLimit(n => n + 8)}>{t('Show more matches', '加载更多对局')}<ChevronDown size={16} /></button>}
      </section>
    <details className="compact-disclosure arena-sources"><summary>{t('Sources', '数据来源')}<ChevronDown size={15} /></summary><div className="disclosure-body"><p>FACEIT · {feed.coverage.returned}/{feed.coverage.requested} {t('profiles', '账号')} · {t('Latest 10 matches per profile', '每人最近 10 场')}</p><p>{t('“More pros” orders matches by tracked-player count. The feed covers collected CS2 profiles only.', '「多人同局」按收录选手人数排序，仅覆盖收录的 CS2 账号。')}</p><a href="https://docs.faceit.com/docs/data-api/" target="_blank" rel="noreferrer">FACEIT Data API<ArrowUpRight size={14} /></a></div></details>
    <Modal open={!!matchId} onClose={() => openMatch(null)} title={t('Match details', '对局详情')} id="match-details-title">{matchId && <MatchScoreboard key={matchId} matchId={matchId} />}</Modal>
    <Modal open={!!tool} onClose={() => openTool(null)} title={title} id="faceit-tool-title" className={tool === 'filters' ? 'filter-dialog' : tool === 'rankings' ? 'rankings-dialog' : ''}>
      {tool === 'rankings' && <FaceitLeaderboard />}
      {tool === 'compare' && <PlayerComparison domain="faceit" />}
      {tool === 'players' && <FaceitData query="" />}
      {tool === 'filters' && <div className="player-match-filter"><label><Search size={16}/><input type="search" value={playerQuery} onChange={e => setPlayerQuery(e.target.value)} placeholder={t('Search players in these matches', '搜索当前对局中的选手')} aria-label={t('Filter players', '筛选选手')}/></label><div className="player-filter-options"><button type="button" aria-pressed={!playerId} onClick={() => { setPlayerId(''); setQuery(''); setLimit(6); openTool(null); }}><Users size={22}/><strong>{t('All players', '全部选手')}</strong><small>{feed.items.length} {t('matches', '场')}</small></button>{playerChoices.map(p => <button type="button" key={p.id} aria-pressed={playerId === p.id} onClick={() => { setPlayerId(p.id); setQuery(''); setLimit(6); openTool(null); }}>{p.avatar ? <Image src={p.avatar} alt="" width={32} height={32} unoptimized/> : <span className="directory-avatar">{p.display.slice(0,1)}</span>}<strong>{p.display}<small>{p.nickname !== p.display ? p.nickname : 'FACEIT'}</small></strong><small>{p.count} {t('matches', '场')}</small></button>)}</div>{!playerChoices.length && <p>{t('No player in the current match list', '当前对局中没有该选手')}</p>}</div>}

    </Modal>
  </main></div>;
}
