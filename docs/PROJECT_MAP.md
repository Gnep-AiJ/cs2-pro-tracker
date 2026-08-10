# Project Map

## Runtime entry points

| Area | Path | Responsibility |
| --- | --- | --- |
| Shared shell and top navigation | `app/components/LiveTracker.tsx` | FACEIT, news, and community content states |
| Shared header | `app/components/SiteHeader.tsx` | The only source of top-level navigation items |
| FACEIT page | `app/faceit/page.tsx` | Starts `LiveTracker` with the FACEIT state |
| News page | `app/news/page.tsx` | Starts `LiveTracker` with the news state |
| Community page | `app/community/page.tsx` | Starts `LiveTracker` with the community state |
| Rankings | `app/rankings/page.tsx`, `app/components/RankingsBoard.tsx` | Official FACEIT ranking view |
| Player detail | `app/players/[nickname]/page.tsx`, `app/components/PlayerDetail.tsx` | Detailed profile and recent matches |
| Match detail | `app/players/[nickname]/matches/[matchId]/page.tsx`, `app/components/MatchDetail.tsx` | Match room and scoreboard |

## Data boundaries

| API | Upstream | Notes |
| --- | --- | --- |
| `app/api/live/route.ts` | FACEIT Data API | Selected team profiles and recent history |
| `app/api/overview/route.ts` | FACEIT Data API | Cross-roster daily/recent overview |
| `app/api/players/[nickname]/route.ts` | FACEIT Data API | Detailed player data; fetch details only on demand |
| `app/api/matches/[matchId]/route.ts` | FACEIT Data API | Match metadata and statistics |
| `app/api/rankings/route.ts` | FACEIT Data API | Region and country rankings |
| `app/api/rankings/insights/route.ts` | Workers AI REST API | Text-only insights for deterministic tracked-pro rankings |
| `app/api/news/route.ts` | 5EPlay, HLTV, Dust2.us | Source aggregation and normalization |

`worker/index.ts` owns edge caching. `worker/translate-news.ts` may generate summaries for selected English news items. The tracked-pro daily ranking is calculated from FACEIT data before a small top-player payload is sent to Workers AI for text-only insights; AI never changes positions or statistics.

## Configuration and generated output

- `.env.local`: local secret values; never commit or print.
- `.env.example`: public variable names only.
- `.openai/hosting.json`: existing Sites identity; preserve the project ID.
- `vite.config.ts`: Vinext, Sites, Cloudflare bindings, and LAN host settings.
- `dist/`, `.vinext/`, `.wrangler/`: generated output; do not edit by hand.

## Verification

1. `npm run lint`
2. `npm test` — includes the production build and Node tests.
3. For local runtime work, verify the affected page and API over HTTP.
