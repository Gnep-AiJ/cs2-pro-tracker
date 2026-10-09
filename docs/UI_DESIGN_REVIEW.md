# CS2 UI review — 2026-10-07

References read: [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md). Guidance is adapted to the user's compact esports brief; no global skill installation, framework changes or runtime dependencies.

## Design plan

- Palette: pitch `#0c0f14`, surface `#171c23`, rule `#343c48`, ink `#f2f4f7`, CS orange `#ff9a64`, observed wins `#8bceac`.
- Type: existing system sans for bilingual content, condensed treatment for names and score numerals, existing monospace for tabular statistics. No font download.
- Layout: centered Events / FACEIT header; short title with actions; one compact summary band; four button tabs; stacked rows and disclosures. Secondary detail uses a profile strip and one match chart. Do not spread all details into cards.
- Distinctive device: the CS scoreboard. Opponent sides, real names, actual points and match samples carry the visual identity. Decorative mock match scores, fake event logos and random metrics are excluded.
- Revise generic defaults: remove numbered eyebrows, repeated method copy, identical empty cards, tiny main metrics, inactive search on non-search tabs, and charts accessible only by hover.

```text
brand             [Events | FACEIT]          language
title                                    primary action
real ranking / selected roster overview
[Data][Rankings][Compare][Analysis]          search
section-specific graphic + stacked actionable rows
collapsed sources
```

## Per-surface review

| Surface | Finding | Required change |
| --- | --- | --- |
| Events data | Catalogue dominated an empty schedule | Real dated Valve overview, concise availability, expandable series |
| Events rankings | Long undifferentiated ledger | Leading teams visual, points bars, player buttons, 10-row pagination |
| Events compare | Plain table only | Side-by-side team identities, relative points bars, linked roster |
| Events analysis | Empty notice before clicking | Visible rank/points evidence and short sourced result |
| FACEIT data | Player names dominated | Actual avatars, recent result strip, expandable match chart |
| FACEIT rankings | Unstructured links | ELO/form scale, ranking context, bounded pages |
| FACEIT compare | Plain names and table | Selected profiles, measured dual bars, per-metric sample counts |
| FACEIT analysis | Generic empty panel | Selectable player, explicit 10-match evidence, grounded AI result |
| Player | Metrics too small, hover-only chart | Larger score strip, chart selection details, 5/10/20 match windows |
| Mobile | Small controls and crowding | 360px verification, 44px controls, internal table scroll |

## Verification

- Production build and artifact validation passed; 21/21 tests passed.
- TypeScript passed. ESLint has zero errors and 10 existing warnings in legacy code.
- Browser checks covered Events and FACEIT data, rankings, compare and analysis; verified linked player profiles and actual source/sample labels.
- Player chart: 10/20-match windows update counts and averages; ADR/K/D switches and the single-match selector update displayed values.
- At 360px, no horizontal page overflow; centered domain navigation, sticky header, language switching and player search were checked.
- Fixed cross-domain section state leaking from FACEIT Analysis into Events; Events now opens its intended data section.
- Authenticated FACEIT and Workers AI requests succeeded. Invalid or unavailable AI output falls back to a sourced numeric summary.
- Screenshots are saved locally under `outputs/ui/`. No production deployment or AdSense review was performed.

## Data limits

Professional event schedules still require a PandaScore token. Individual professional-event Rating/ADR is not present in Valve standings or FACEIT. Player entry links are verified FACEIT identities and say so. The temporary Cloudflare token was verified against Workers AI and configured only in this project's ignored local environment. This is local work, not a production deployment.
