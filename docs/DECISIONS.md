# Decisions

## 2026-10-09 — Official rankings and source-aware portal

- Default to official FACEIT rankings; tracked-player TOP 10 is explicitly separate and dynamically sorted from verified account IDs and lifetime CS2 data. Never present this subset as the official global ranking.
- Put News third in primary navigation; remove workspace footer jumps and retain one global contact/support entry.
- Comparison leaders use numerical order at displayed precision; neutral volume metrics do not declare a winner.
- Extend major-event history from 45 to 180 days. Keep S/A main-event filtering, cache and request budgets. Dated HLTV calendar entries link to their original pages rather than inventing cross-provider fixture mappings.
- Valve standings receive a dedicated gold action next to event selection. Keep current architecture and original QR assets.

## 2026-10-09 — Reduce complexity; preserve contact and support

- The user authorized removing features to make the product easier to understand. Remove shared-match/statistics and AI entry points from primary workspaces. Preserve match-first FACEIT and fixture-first major events, with one comparison flow and a fixed ranking view.
- Reference the user-supplied FACEIT layouts for table alignment, score hierarchy and player identity. Do not recreate unrelated platform features or unavailable statistics. Hide empty metric controls and empty data sections; compact source/date labels remain.
- Contact and donation codes are distinct original assets, displayed through shared `CreatorContact`. Never remove either asset or permanent contact access during future redesign. The donation image was supplied by the user on 2026-10-09.
- Compare K/D consistently with `summarizeLab`; incomplete event kills/deaths cannot become zero. Metadata enrichment cannot erase valid history scores/maps/rosters. Map or modal selection must not leave two competing primary dialogs open.

## 2026-10-09 — FACEIT first, matches first; local redesign

These decisions supersede conflicting events-first, form-board-first and automatic HLTV-refresh decisions below. Historical entries remain unchanged for traceability.

- Home and the first navigation item use FACEIT; Events is second. A featured match and recent-match stream precede rankings, comparison and statistics. Secondary FACEIT tools use dialogs. Major events start with fixtures/results, with other views secondary.
- Keep the existing React 19, Next.js/Vinext and Worker structure; add no runtime framework or dependency for this redesign. Use compact rows, distinct feature cards, buttons, disclosures and bounded native dialogs. Primary Chinese copy uses short factual labels.
- The root layout mounts `ContactAccess` on every page. Preserve `/wechat-community-qr-v1.png`, its original bytes and unoptimized rendering, plus the community contact route. Contact information must never be removed by future UI changes.
- FACEIT histories use 20 verified profile IDs, 10 matches each, deduplicate by match ID and request at most six metadata enrichments. Cache each bounded refresh for 120 seconds. Full statistics load on demand; separate maps, genuine zero values and unavailable Rating/Swing remain distinct.
- PandaScore credentials are configured only in ignored local server environment. The three matches endpoints and three tournaments endpoints returned HTTP 200 under Fixtures access. This confirms fixture access only, not paid personal-statistics or live-round entitlements.
- `getProviderCatalogue` shares three catalogue requests and caches for 10 minutes. Group native `ps-` series by exact series ID and retain phase tournament IDs. Use S/A tiers with main-event exclusions; omit qualifiers, academy and small events. No measured popularity or viewer-count claim.
- Selected-event requests use five-minute single-flight caching, with at most three pages / 300 matches per series. The provider applies a local 120-requests/hour isolate budget and 429 cooldown; Worker event caching is five minutes. These are not an account-wide guarantee across isolates. A strict global budget requires shared scheduling or a Durable Object.
- There is no verified official public HLTV API. The event adapter disables HLTV page reads by default; enable `HLTV_AUTHORIZED_ACCESS` only after authorized access is confirmed. Preserve dated snapshots. ENSI /10 is a separate historical sample metric; Valve VRS is dated team standings, not fixtures or live results.
- Preserve old event/statistical samples, but never join historical HLTV/Ensigame player IDs to PandaScore players by guessed names. Event player samples must keep their original source and observation date.
- This iteration is local only. No new deployment, publication, paid subscription or external-account change is authorized. Final build, 63 tests, type checking, desktop/mobile/dialog/language checks and secret scanning passed locally; see `MATCH_FIRST_REDESIGN_20261009.md`.

## 2026-10-08 — Reading order and readable event controls

- The supplied Windows screenshot exposed a real native-select contrast defect. EventChooser replaces that event select with a searchable native modal; remaining select/options have explicit dark colors.
- Events show fixtures/results first, then a qualified individual top five. Automatically choose results when loaded data has no scheduled fixtures. An explicit user filter remains authoritative.
- Event tabs describe content: Schedule & results, Player form and Player compare. AI and sources are secondary disclosures. FACEIT opens ProLab's individual form board directly with folded filters; old query links remain supported.
- Use the existing React, CSS and icons; no additional framework or dependency. The GitHub frontend-design reference informs hierarchy, not runtime architecture.
- Publication and cleanup are authorized for cs2pro only. Delete only inventoried obsolete generated release packages after production verification; retain the preceding deployed package, the new release, observations, secrets, source, evidence and dependencies.

## 2026-10-07 — Published Big Events and individual comparison

- Home and /matches now use EventsWorkspace; FACEIT keeps TrackerWorkspace. Events are primary and FACEIT secondary.
- Event selection follows the reviewed HLTV Big Event/Featured list. Valve tournament requirements and dated standings remain distinct; no inferred Tier 1 status.
- /api/events and /api/events/catalogue return the same usable catalogue and selected event observations. Catalogue refresh is hourly per isolate; edge caching is five minutes. Source failure preserves dated observations. PandaScore credentials are no longer required by this product path.
- Public HLTV event pages provide fixtures and roster identities. Blocked detailed-stat pages are not bypassed. Ensigame supplies the available qualified sample, currently ten EPL players; its own score is ENSI /10, never HLTV Rating. Future event statistics are withheld.
- Individual search supports partial names, case, leet spelling and small typing errors. Selection binds immutable HLTV/FACEIT IDs; curated pro identities are separated from public FACEIT accounts.
- Workers AI uses the existing AI binding in production. Only server-observed facts are sent; invalid numbers, wrong language, missing sample caveat or failures retain the deterministic summary. AI does not set scores or rankings.
- User explicitly authorized production publication to cs2pro only. Existing AdSense changes and old release artifacts remain intact. Rollback deployment metadata is retained under ignored outputs/research-20261007.
- The earlier local-only/PandaScore notes below record the previous iteration and are superseded for the current event workspace.


## 2026-10-07 — Events-first bilingual, player-centric workspace

- Home and `/matches` start `TrackerWorkspace` in Events; `/faceit` uses FACEIT, `/rankings` starts its Rankings tab. Legacy news/contact stay secondary.
- `LanguageProvider` owns language and persistence. `CompactPlayerDetail` and `CompactMatchDetail` share the new header and compact design.
- Valve standings are an official dated snapshot with a live refresh adapter; saved fallback is explicit. The raw 2026-10-05 source is retained in `docs/evidence/`.
- PandaScore fixtures require `PANDASCORE_API_TOKEN`. Missing credentials return an empty, unconfigured, non-cacheable feed. No generated event scores or scraped HLTV statistics.
- Valve roster player links use the curated, immutable FACEIT identity registry. FACEIT profiles never become professional-event player statistics.
- Per-match charts and 5/10/20 comparisons use observed samples, expose counts, and exclude missing values. No invented ELO history.
- `/api/analysis` retrieves facts on the server and uses Workers AI REST. Invalid/unavailable outputs fall back to a deterministic data summary. Temporary credentials are local and ignored; the prior local environment is preserved.
- Development shell caching is disabled: stale SSR markup caused hydration mismatches after UI edits. Released shells retain versioned caching.
- This work is local; no external deployment, global skill installation, or other-project changes.

## 2026-08-09 — Community is a top-level content state

- The top navigation includes FACEIT, rankings, news, and community.
- Community reuses the `LiveTracker` shell instead of maintaining its own header, main, and footer.
- Community is contact-only during its preparation stage. There is no feed, account system, posting, or backend.
- The supplied WeChat QR asset remains unoptimized to protect scan reliability.

## 2026-08-09 — AI is limited to editorial text

- Workers AI may summarize a small set of English news items.
- Workers AI may write a short daily insight from a pre-ranked subset of tracked professional players.
- Daily ranking positions are deterministic and must remain usable when AI is unavailable.
- Missing AI bindings must fall back to the original news payload.
- FACEIT, ranking, player, and match statistics never depend on Workers AI.

## 2026-08-09 — Degraded live data is not cacheable

- A live response with no usable FACEIT profiles uses `Cache-Control: no-store`.
- The Worker must respect `no-store` before writing to Cache API.
- Cache version changes are required when a persisted bad cache must be bypassed immediately.

## 2026-08-09 — Project-specific UI guidance wins

- External design skills are references, not installed runtime dependencies.
- `docs/UI_GUIDE.md` and `skills/cs2-pro-tracker/SKILL.md` are the project source of truth.
- Prefer a consistent editorial esports interface over generated style catalogs.
