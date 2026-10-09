# Player data refinement — 2026-10-08

## Delivered

- Player details now join the latest R2 observations by exact player ID and match ID. Previously the route used the bundled publication-time snapshot. Fresh Data API values take precedence; missing advanced observations can be filled from storage, with provenance and observation time.
- Storage errors, oversized objects, invalid or future timestamps fall back to the dated bundled observation. Stale archives are shown as delayed and are not cached as fresh responses.
- Individual charts support ADR, K/D, K/R and HS%, with optional Rating/Swing only when observed. Missing values remain missing; negative Swing uses a signed axis rather than a fabricated positive bar.
- A separate form strip compares the latest five matches with the preceding five. It requires five valid values in each group and deduplicates identities. It is an observed change, not a prediction.
- FACEIT analysis keeps the actual selected window and map scope. It includes stored entry/clutch/support metrics and a grounded bilingual summary. Caller-provided statistical facts are not accepted. Official Rating is not estimated.

## Evidence

- Full build and 48 tests passed. TypeScript passed. Lint: zero errors, ten pre-existing warnings. Release checks: thirteen rendered assets; twenty files passed the configured-secret scan.
- Only Pages project `cs2pro` was published. Deployment `c0844c29-22a5-48e5-b131-af73917785ce`; immutable URL `https://c0844c29.cs2pro.pages.dev`. Existing FACEIT secret, AI and PRO_DATA bindings preserved.
- Previous release `.cf-pages-release-cs2pro-20261008-core-v2` remains the immediate rollback. Current package `.cf-pages-release-cs2pro-20261008-profile-data`. Collector/R2 content was not mutated by this refinement.
- Production readback: 20 collected players, 391 player-match samples, 437 unique matches, 22 shared pairs. Current selected event: 39 fixtures, 80 entrants, ten provider-stat samples. Event coverage is still partial; an official HLTV Rating feed remains unconfigured.
- donk and magixx each returned 30 recent matches. Two hundred filled advanced fields per profile were individually checked against matching R2 observations. Both report persistent storage observed at `2026-10-08T06:17:23.057Z`.
- Chinese and English analysis returned real ten-match facts, ADR and entry success with effective sample sizes. Both AI outputs failed validation (`invalid_output`), so deterministic summaries were used. Validated AI prose is not claimed.
- Browser checked Chinese HS% chart, contribution disclosure and analysis result; 360px viewport had 345px document width and scroll width, chart width 291px. English switch and 20-match window visibly worked after a browser observation timeout; values changed to twenty-match statistics. Desktop viewport restored and Chinese player page left open.
- Screenshot: `outputs/ui/profile-data-production.png`. Readbacks: `outputs/release-20261008-profile-data/production.json` and `profile-data.json`.

## Remaining source blocker

The true FACEIT Statistics endpoint was located from official scripts, but an ordinary backend GET returned a 403 security challenge. Website Rating exists; current server collection has no successful authorized Statistics response. Required next input: official Statistics access or an authorized data export/feed, with schema and units. A Cloudflare token supplies hosting/AI access, not FACEIT Statistics authorization. See `CORE_DATA_20261008.md` for the exact audit evidence. No CAPTCHA or source protection was bypassed.
