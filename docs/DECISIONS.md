# Decisions

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
