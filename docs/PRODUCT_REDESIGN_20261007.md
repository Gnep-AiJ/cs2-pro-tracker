# CS2PRO product specification — 2026-10-07

## Overview
The user rejected the current product because Events has no schedule and comparison is team-centric. The audience is CS2 viewers looking up important events, individual players and measured performance. No audience-growth or retention evidence exists yet; those outcomes remain hypotheses.

## Goals and success metrics
Release gates: at least five sourced important events; actual dated match fixtures/results when published; searchable individual player identities; two individual players compared within the same event or clearly identified FACEIT samples; Chinese/English; usable at 360px; production cs2pro readback. Baseline: no events without PandaScore, team-only event comparison, nickname-only lookup. Do not invent numbers, infer Valve Tier 1 from prize pool, or present old samples as live.

## User stories
- View ongoing and next big events, select one and expand its schedule/results.
- Search an incomplete player name, choose an identified candidate, see event data.
- Compare two individuals in one event; switch to FACEIT for recent public matches.
- Understand the source, sample size and observation time without long copy.

## Scope
Includes Events first, FACEIT second, per-domain Data/Rankings/Compare/Analysis, sourced event catalogue, public match observations, player fuzzy search, and cs2pro Pages deployment. Keep current framework and dependencies. No other Cloudflare project changes, betting predictions or fabricated official Rating. Future: licensed full historical event feeds and retention analytics.

## Solution design
One focused event at a time. Main screen: compact active event strip, horizontal/bounded event selector, four tabs, stacked fixtures with real identities/logos, folded methodology. Rankings default to individual event performance; Valve team standings are secondary. Compare uses two searchable individual identities, aligned context, observed metrics and sample counts. Event individual metrics must come from event scoreboards, never FACEIT. FACEIT reuses the same search interaction.

Palette: pitch #0c0f14, panel #171c23, line #343c48, ink #f2f4f7, match orange #ff9a64, result green #8bceac. Existing bilingual sans and tabular numerals. The concrete event schedule and player duels provide the visual hierarchy; remove the empty series catalogue and big generic statistic hero.

```text
CS2PRO             [赛事 | FACEIT]             EN/中文
Big Events         selected event, date and source
event selector     [Data][Players][Compare][Analysis]
focused match list OR individual leaderboard/duel
folded details and sources
```

## Technical considerations
HLTV public event/results pages and tournament operators establish event facts; Valve establishes standings and rules. Public HTML may return 403 or change; never bypass access controls. Persist verified normalized snapshots with provenance and reuse them if live retrieval fails; explicitly label timestamps and partial statistics. Re-fetch permitted pages with timeouts and edge cache. Missing values stay null. FACEIT exact IDs remain identity boundaries. Search is bounded and aborts obsolete requests.

## AI behavior and evaluation
Keep deterministic facts and comparisons available without AI. This release adds factual event summaries using measured observations; existing FACEIT AI remains labeled. Gates: no inferred causality/predictions, same-context metrics, absent metrics stay absent. Check available sample, empty sample and upstream failure separately. This functional case set does not establish a model error rate or audience benefit.

## Dependencies and risks
Public HTML blocking is high likelihood: retained sourced snapshot plus original links. Page shape changes: validate parser and reject incomplete replacements. Temporary Cloudflare credential expiry: existing AI binding and project environment take priority. Cloudflare release owner is the user; agent verifies target cs2pro and retains previous deployment ID.

## Milestones
1. Source discovery and requirements. 2. Ingestion/search/individual comparison. 3. Local tests and mobile checks. 4. Pages deploy and production API/browser readback.

## Open questions
Licensed full professional statistics are not configured. Release must expose observed coverage rather than claim complete official event ratings. User engagement remains unmeasured.

## Appendix
Applied [PRD Skill](https://github.com/product-on-purpose/pm-skills/blob/main/skills/deliver-prd/SKILL.md), [Edge Cases Skill](https://github.com/product-on-purpose/pm-skills/blob/main/skills/deliver-edge-cases/SKILL.md), and [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md). Reviewed HLTV events/calendar and Valve tournament-operation requirements. Public source files are retained in ignored outputs/research-20261007; normalized facts ship with source URLs.
