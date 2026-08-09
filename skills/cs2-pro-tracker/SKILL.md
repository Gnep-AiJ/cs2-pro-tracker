---
name: cs2-pro-tracker
description: Build, maintain, debug, and extend the CS2 Pro Tracker website, including FACEIT player data, CS2 matches, pro-scene news, responsive UI, public-data normalization, and Sites deployment.
---

# CS2 Pro Tracker Skill

Use this skill when working on the CS2 Pro Tracker codebase or recreating the same kind of CS2 professional-player activity hub.

## Product boundary

Keep the product focused on three primary sections:

1. FACEIT — professional-player activity and detailed match statistics.
2. Matches — current and upcoming professional CS2 matches.
3. News — player, roster, interview, social, and transfer updates.

Do not turn the interface into a generic analytics template, game store, or HLTV clone. Prefer a compact dark esports portal with clear hierarchy, readable typography, restrained borders, and fast mobile scanning.

## Source rules

- Use real public data. Never ship mock statistics as if they are live.
- Keep a visible source link for news and match information.
- Treat every upstream field as optional because FACEIT payloads change.
- Do not invent unavailable values. Show a clear unavailable state instead.
- Cache outbound responses briefly to protect upstream sources and reduce page latency.
- Keep the tracked-player registry easy to extend.

## FACEIT data model

The current public website endpoints return compact keys for CS2 match statistics. Normalize them at the server boundary before sending data to UI components.

Known compact mappings used by this project:

| FACEIT key | Normalized field |
| --- | --- |
| `i1` | map |
| `i6` | kills |
| `i7` | assists |
| `i8` | deaths |
| `i9` | MVPs |
| `i13` | headshot kills |
| `i18` | score |
| `c2` | K/D ratio |
| `c3` | K/R ratio |
| `c4` | headshot percentage |
| `c10` | ADR |

Support both this compact representation and the named fields used by the documented FACEIT Data API. Do not label another metric as Rating. If an explicit Rating field is absent, state that it is unavailable from the current public response.

## Player-detail requirements

Each tracked player should expose:

- profile, avatar, country, role, team, FACEIT nickname, level, and ELO;
- today's matches, wins, losses, and ELO change;
- recent 30-match form, win rate, streak, ELO trend, and favorite maps;
- recent 10-match K-D-A, K/D, K/R, ADR, headshot percentage, MVPs, score, map, result, and ELO change;
- a coverage indicator showing how many requested matches returned detailed statistics.

Fetch detailed match statistics only when a player detail page is requested. Do not make every player-list card fan out into multiple match-detail requests.

## Interface rules

- Use a dark neutral background with restrained orange, green, and red signals.
- Avoid persistent decorative borders around every block.
- Keep primary numbers at least as readable as labels.
- Desktop match history may use a dense table; mobile must reflow into cards without horizontal scrolling.
- Navigation routes must be real URLs and remain usable with direct refreshes.
- Use clear empty, loading, and upstream-error states.

## News and matches

- Aggregate more than one source when possible.
- Deduplicate by canonical URL or normalized title.
- Show source name, publish time, and direct source URL.
- Keep summaries factual and short. Never imply an AI-generated summary is the original article.
- Prefer player-centric updates over generic esports news.

## Safe maintenance workflow

1. Read `.openai/hosting.json` and preserve the existing Sites identity.
2. Inspect the exact route or component being changed before editing.
3. Keep data normalization in server routes and presentation logic in components.
4. Run `npm run lint` after edits.
5. Run the production build or Sites checkpoint validation.
6. After deployment, call the production API for at least two tracked players and verify that coverage and real numeric fields are populated.
7. Confirm mobile layout whenever match-table columns change.

Useful production checks:

- detailed coverage should normally be `10/10` for active public profiles;
- K-D-A must be internally consistent with K/D;
- score must look like a score, never a UUID;
- the API response must not expose temporary debug payloads;
- missing Rating must remain `null` rather than being derived without a disclosed formula.

## Extension points

- Move the tracked-player registry into PostgreSQL when administrators need to edit it.
- Add Redis or edge caching for higher traffic.
- Add scheduled ingestion when historical retention is required.
- Add an authenticated official FACEIT Data API adapter behind the existing normalized response shape when an API key becomes available.
- Add a separate HLTV/event-stat adapter for event Rating; keep it visually and semantically distinct from FACEIT statistics.
