# Portal production release

User approved publishing the reviewed local version. Deployment started 2026-10-09 and verification completed 2026-10-10 in Asia/Singapore.

- Production: https://cs2pro.pages.dev/?lang=zh
- New deployment: `96182b24-fc93-451e-b3b8-67a069f5c689`, https://96182b24.cs2pro.pages.dev
- Previous production / rollback target: `c0844c29-22a5-48e5-b131-af73917785ce`, https://c0844c29.cs2pro.pages.dev
- Project `cs2pro`, verified production branch `main`. Retained existing `AI` and `PRO_DATA` / `cs2pro-data` bindings. Added only the existing PandaScore token as a production secret using Wrangler stdin; retained FACEIT secret. No credentials copied to public output.
- Artifact: `.cf-pages-release-cs2pro-20261009-portal-final`. Original release directories remain intact. No Git push, database migration or storage deletion.

## Validation

The reviewed candidate passed 77 tests, TypeScript, build, and lint (zero errors, ten existing warnings). Packaging validated 18 rendered assets across four routes; credential scan passed all 28 packaged text files. Post-release comparison verified all 17 homepage JavaScript/CSS assets byte-for-byte against the tested release package.

Production checks: homepage and legacy routes HTTP 200; FACEIT official EU leaderboard returned 50 players; FACEIT match feed returned 80 matches from all 20 requested histories; PandaScore returned 14 main events and 41 fixtures for the selected event; news returned 37 entries. `simple` and `m0ensy` resolve to verified IDs, with `simple` profile returning the correct s1mple ID and 30 recent matches. Contact and donation images have exact original bytes and SHA-256 values.

Valve initially returned its marked saved snapshot, failing the strict live-feed check. Two follow-up requests returned official 2026-10-05 standings with 100 teams and `stale: false`; the original failure and recovery evidence are both preserved. The exact transient upstream failure cannot be identified because the existing adapter returns its snapshot on fetch/parse failure without exposing diagnostics.

Browser production verification confirmed new homepage navigation, current FACEIT matches, and the contact dialog showing the original QR image. Repeated browser-tool timeouts prevented completing donation-tab and layout follow-up checks. Both interactions were tested locally before publication; production image integrity and published asset identity are confirmed. Do not describe this as a complete post-release browser regression.

HLTV calendar remains a clearly dated observation with original links; no new authorized live HLTV API has been obtained.

Evidence: `outputs/release-20261009-portal/{before,configured,after,production-checks,standings-recheck,acceptance}.json`, `deploy.log`, `home.png`, `contact.png`. Previous local verification is recorded in `outputs/portal-20261009/`.

## Rollback

The previously successful production deployment remains the rollback target. In the Cloudflare Pages project, use Rollback to this deployment for `c0844c29-22a5-48e5-b131-af73917785ce`; alternatively the documented Pages project deployment rollback API can select this exact ID. No rollback was executed during this release. Reference: https://developers.cloudflare.com/pages/configuration/rollbacks/
