# CS2 Pro Tracker — Agent Instructions

## Read first

Before changing code, read these files in order:

1. `README.md` — environment, commands, and product summary.
2. `docs/PROJECT_MAP.md` — entry points, data flow, and ownership by path.
3. `docs/UI_GUIDE.md` — visual and mobile interaction constraints.
4. `docs/DECISIONS.md` — decisions that must not be reversed accidentally.
5. `skills/cs2-pro-tracker/SKILL.md` — FACEIT normalization and product rules.

## Working rules

- Inspect the exact route, component, API, test, and styles involved before editing.
- Keep changes minimal. Preserve the React 19, Next.js/Vinext, Cloudflare Worker, and existing API structure.
- Treat all upstream fields as optional. Show unavailable states; never invent statistics.
- Keep `/api/live`, `/api/overview`, `/api/news`, and `/api/rankings` cache behavior aligned with `worker/index.ts`.
- Never cache a degraded response marked `Cache-Control: no-store`.
- Keep mobile behavior usable at 360 px width without horizontal page scrolling.
- Do not add dependencies, deploy, publish, or interact with GitHub unless the user explicitly requests it.
- Never expose `.env.local` or `FACEIT_API_KEY` in logs, documentation, output, or client code.
- After edits run `npm run lint` and `npm test`. Report warnings and anything not verified.

## Fast path map

- Pages: `app/**/page.tsx`
- Main navigation and FACEIT/news UI: `app/components/LiveTracker.tsx`
- Shared header and navigation definition: `app/components/SiteHeader.tsx`
- Community content: `app/components/CommunityPage.tsx`
- Player and match details: `app/components/PlayerDetail.tsx`, `app/components/MatchDetail.tsx`
- Global styles: `app/globals.css`
- API routes: `app/api/`
- Tracked roster: `app/data/tracked-players.ts`
- Worker cache and AI summary boundary: `worker/`
- Tests: `tests/`
- Hosting identity: `.openai/hosting.json`
