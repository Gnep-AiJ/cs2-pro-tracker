# Project Map

Current publication: the reviewed portal was deployed on 2026-10-09 and production verification completed on 2026-10-10 (Asia/Singapore). See [RELEASE_20261009_PORTAL.md](RELEASE_20261009_PORTAL.md). Earlier local-only notes below are historical checkpoints.

## 2026-10-09 — Portal additions

`FaceitLeaderboard.tsx` replaces the ranking-dialog contents; `/api/faceit/tracked-rankings` serves cached verified accounts and lifetime CS2 statistics, with ranking/comparison helpers in `ranking-view.ts`. `NewsWorkspace.tsx` supplies the third primary route. `ValveStandings.tsx` is opened beside `EventChooser.tsx`; the chooser separates PandaScore fixtures from dated HLTV calendar links. Current local verification: build, 74 tests, TypeScript pass; lint 0 errors/10 existing warnings. No deployment. See `PORTAL_UI_20261009.md`; this section supersedes older navigation descriptions.

## 2026-10-09 — Current paths and boundaries

This section supersedes the historical events-first map below. The redesign is local. Build, 70 tests and TypeScript passed; lint has no errors and 10 existing warnings. Desktop and 360px browser acceptance is recorded in `UI_SIMPLIFICATION_20261009.md`. Production was not updated.

| Area | Path | Current responsibility |
| --- | --- | --- |
| Home / FACEIT | `app/page.tsx`, `app/faceit/page.tsx`, `app/components/FaceitWorkspace.tsx` | FACEIT first: featured match and recent match stream; secondary tools in dialogs |
| Events | `app/matches/page.tsx`, `app/components/EventsWorkspace.tsx`, `app/components/EventMatchStream.tsx` | Major-event selection, fixtures/results first, secondary player samples and comparison |
| Navigation | `app/components/SiteHeader.tsx` | FACEIT first, Events second; preserve explicit language choice |
| Shared dialogs | `app/components/Modal.tsx`, `app/components/EventChooser.tsx` | Native dialogs, Escape, focus return and bounded scrolling |
| Match scoreboard | `app/components/MatchScoreboard.tsx`, `app/components/CompactMatchDetail.tsx` | On-demand rosters/statistics, separate maps, mobile reflow |
| Permanent contact / support | `app/layout.tsx`, `app/components/ContactAccess.tsx`, `app/components/CreatorContact.tsx`, `app/components/CommunityPage.tsx` | Shared contact/support content on every page; preserve both original QR images |
| Styles | `app/arena.css`, `app/compact.css`, `app/editorial.css` | Match hierarchy, compact rows, distinct feature card and dialog layouts; 360px without page overflow |
| Valve standings | `app/components/ValveStandings.tsx`, `app/api/events/standings/route.ts` | Dated official VRS standings, loaded when opened; separate from fixtures |

| Data path | Upstream / rule |
| --- | --- |
| `app/api/faceit/matches/route.ts`, `app/lib/faceit-matches.ts` | Official FACEIT Data API; 20 verified profiles × 10 recent histories, deduplicated by match ID; at most 26 requests per 120-second refresh, no full-scoreboard fan-out |
| `app/api/matches/[matchId]/route.ts` | Official FACEIT metadata and full statistics requested on opening; maps remain separate; missing fields stay unavailable |
| `app/lib/event-provider.ts` / `getProviderCatalogue` | Server-only PandaScore token; shared three-request catalogue with 10-minute cache; native `ps-` series identity and exact series/tournament grouping |
| `app/lib/pro-event-feed.ts`, `app/api/events/route.ts`, `app/api/events/catalogue/route.ts` | Selected-event five-minute cache and single-flight; at most three pages per tournament; dated fallback after provider failure |
| `worker/index.ts` | Five-minute edge cache for usable event responses; never cache `no-store` degraded responses |
| `app/data/pro-events-snapshot.json` and existing Ensigame observations | Preserve historical event identities and dated samples; never guess joins from old player IDs to PandaScore IDs |

PandaScore S/A tiers plus main-event exclusions determine scope; this is not a measured popularity/viewership ranking. Fixtures access does not imply paid individual statistics or live round data. The 120-requests/hour local isolate budget and 429 cooldown protect each process; they do not coordinate the whole account across isolates. Strict account-wide enforcement requires shared scheduling or a Durable Object.

HLTV has no verified official public API in this project. The event adapter disables HLTV page reads by default; `HLTV_AUTHORIZED_ACCESS=true` requires authorized access. Historical observations stay dated. ENSI /10 remains separate from HLTV Rating, and Valve VRS remains separate from match data.

`.env.local` remains ignored and server-only. Do not print credentials or copy them into client code, docs or generated receipts. Data architecture: `MATCH_FIRST_REDESIGN_20261009.md`; final simplified UI and acceptance: `UI_SIMPLIFICATION_20261009.md`.

## Historical map — 2026-10-08 and earlier

The following original sections are retained for traceability. Apply the current map above where behavior differs.

## Runtime entry points

| Area | Path | Responsibility |
| --- | --- | --- |
| Event workspace | `app/components/EventsWorkspace.tsx` | Big Events, fixtures, individual samples, comparison and analysis |
| FACEIT workspace | `app/components/FaceitWorkspace.tsx`, `app/components/ProLab.tsx` | Individual form board and comparison; folded filters and secondary official standings |
| Event selection | `app/components/EventChooser.tsx` | Searchable modal with event names, logos and dates |
| FACEIT preview | `app/components/FaceitPreview.tsx` | Separate qualified player preview below event results |
| Shared data helpers | `app/components/TrackerWorkspace.tsx` | Resource hooks, dates, profile and official-ranking disclosures |
| Individual selection | `app/components/PlayerSearch.tsx`, `app/components/PlayerComparison.tsx` | Fuzzy candidates, stable IDs, same-domain metrics |
| Language | `app/components/LanguageProvider.tsx`, `app/lib/locale.ts` | English / Chinese preference and browser detection |
| Charts and styles | `app/components/CircuitOverview.tsx`, `app/components/PerformanceChart.tsx`, `app/compact.css`, `app/editorial.css` | Source-based graphics, reading order and readable controls |
| Home / Events | `app/page.tsx`, `app/matches/page.tsx` | Starts the Events workspace |
| Legacy content | `app/components/LiveTracker.tsx` | News and contact states |
| Shared header | `app/components/SiteHeader.tsx` | The only source of top-level navigation items |
| FACEIT page | `app/faceit/page.tsx` | Starts the FACEIT workspace |
| News page | `app/news/page.tsx` | Starts `LiveTracker` with the news state |
| Community page | `app/community/page.tsx` | Starts `LiveTracker` with the community state |
| Rankings | `app/rankings/page.tsx` | FACEIT workspace, Rankings tab |
| Player detail | `app/players/[nickname]/page.tsx`, `app/components/CompactPlayerDetail.tsx` | Profile, 5/10/20-match charts, maps and history |
| Match detail | `app/players/[nickname]/matches/[matchId]/page.tsx`, `app/components/CompactMatchDetail.tsx` | Match room and scoreboard |

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
| `app/api/events/route.ts`, `app/api/events/catalogue/route.ts` | HLTV public event/calendar pages; Ensigame available sample | Live refresh with dated verified fallback; future statistics withheld |
| `app/api/search/players/route.ts` | Event rosters; curated FACEIT identities and FACEIT search | Partial names and small typing errors; explicit selection required |
| `app/api/events/standings/route.ts` | Valve GitHub | Latest official standings; dated saved fallback |
| `app/api/analysis/route.ts`, `worker/player-analysis.ts` | Server facts + production Workers AI binding | Individual English / Chinese summaries; validated output and deterministic fallback |

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
