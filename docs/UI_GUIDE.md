# UI Guide

## 2026-10-09 — Portal hierarchy update

Current navigation: FACEIT, Events, News. Rankings, Compare and Find player share the top action row. Official FACEIT rankings open by default; tracked TOP 10 uses a separate tab with only ELO, lifetime matches and win-rate sorting. Plain aligned tables replace stacked expandable rankings. Orange identifies FACEIT, blue events, gold Valve standings and purple news. Comparison marks each meaningful metric leader or tie. Preserve permanent contact/support access and both original QR images. This section supersedes older secondary-action placement. See `PORTAL_UI_20261009.md`.

## 2026-10-09 — Simplified interface

This section supersedes the expanded secondary-tool directions below. FACEIT remains first and Events second. FACEIT has a match stream and two secondary actions: rankings and comparison. Remove shared-match and AI-analysis entry points. Do not add repeated inner navigation to a dialog. Event fixtures are always primary; personal statistics/comparison are offered only when real usable data exists.

Follow the user-supplied FACEIT references for hierarchy: neutral black surfaces, restrained orange selection, clearly aligned table headings, prominent scores and a separate player-identity panel. Keep mobile layouts in one column; hide unsupported metrics and completely empty sections. Never estimate unavailable values. Source and observation date may be compact; implementation notes and metric-processing explanations belong in documentation, not the interface.

`CreatorContact` is shared by the permanent `ContactAccess` dialog and the community page. Contact and support are explicit separate choices. Preserve the original contact QR `/wechat-community-qr-v1.png` and the user-supplied WeChat payment QR `/wechat-support-qr.png`, their bytes and unoptimized rendering. Both original-image links must work. Do not replace one code with the other.

The implementation and verification record is `UI_SIMPLIFICATION_20261009.md`. This is a local change; no deployment is authorized.

## 2026-10-09 — Current match-first design

This section supersedes the events-first and expanded-form-board directions below. Home and the first navigation item are FACEIT; Events is second. Preserve the existing React/Vinext architecture, bilingual preference rules and source honesty.

FACEIT starts with one featured match and a compact recent-match stream. Match rows expose available teams, scores, map, date and tracked players; opening a row loads the roster and full scoreboard. Rankings, player comparison, statistics, player lookup and filters are dialogs. Use distinct feature cards, compact rows, buttons and disclosures; do not fill the initial screen with parallel dashboard cards.

Events start with major-event fixtures/results. Player performance, comparison, analysis, rosters and Valve standings are secondary. PandaScore S/A tiers plus main-event exclusions define scope; exclude qualifiers, academy and small events. Do not describe this selection as measured heat, viewership or global popularity. Native PandaScore series and tournament identities must remain exact; historical HLTV/Ensigame samples cannot be attached to new player IDs by name guessing.

Use short labels and direct Chinese copy: FACEIT 对局、精选对局、近期对局、赛程与赛果、榜单、对比、统计、筛选、联系我. Avoid slogans, staged reading instructions and implementation commentary in primary content. Put necessary coverage/metric caveats in the source disclosure; keep the current source, date and saved/partial state visible.

`ContactAccess` is mounted by the root layout on every page. The original WeChat QR asset `/wechat-community-qr-v1.png` must remain available and unoptimized. Preserve the community route and an original-image link. Never remove or replace the contact entry during redesign.

Use `app/arena.css` after the existing compact/editorial styles. Check 360px and desktop in both languages: no horizontal page scrolling; long team/player names wrap; tables reflow; primary targets reach 44px where practical; dialogs stay within the viewport, support Escape and return focus. Multiple maps have separate scoreboards. Zero scores remain zero and missing Rating/Swing stay unavailable.

Current changes are local only. Full tests and browser acceptance remain pending for this iteration; no release is authorized by this document. The design/source/acceptance record is `MATCH_FIRST_REDESIGN_20261009.md`. Historical sections below are preserved for traceability.

## 2026-10-08 — Current reading order and controls

Events open fixtures/results, followed by five qualified individual performers and a separate FACEIT preview. The three event tabs are Schedule & results / Player form / Player compare. Analysis, sources, roster, official standings and cross-domain observations are secondary disclosures. FACEIT opens the individual form board directly; metric buttons stay visible and filters stay folded. This supersedes the event rail and four-tab direction below.

Use `app/editorial.css` after `app/compact.css`. Event selection is a searchable native modal dialog with logos, readable names and dates; never restore the unreadable native event select. All remaining native select/options require explicit foreground, background and dark color-scheme. Check the open control on Windows, not only its closed state. Verify desktop and 360px, both languages, native Escape/focus return and empty-versus-loaded fixtures before release. The concrete design and acceptance record is `UI_READING_ORDER_20261008.md`.

## 2026-10-07 — Current product implementation

The event panel uses a compact horizontal event rail, one selected event identity strip, and Data / Players / Compare / Analysis tabs. Fixtures and individual score tables are stacked; roster, sources and Valve team standings stay folded. Player comparison uses fuzzy selection and stable identities; team comparison is secondary. Expose partial provider coverage, saved observations and the score scale. Never substitute FACEIT statistics for event performance.

## 2026-10-07 — Current user direction

Events are first and default; FACEIT is second. The two navigation buttons are centered. Each domain has Data / Rankings / Compare / Analysis. English and Chinese follow URL choice, saved preference and browser language in that order. Short labels, meaningful graphics and player entry points take priority. Use a scoreboard identity strip, real-data charts, actual avatars, visible action buttons and stacked disclosures. Keep 360px layouts usable and secondary details folded. `app/compact.css` implements this direction; `docs/UI_DESIGN_REVIEW.md` records the GitHub design references and per-section review. Earlier rules below remain applicable where they do not conflict with this current user direction.

## Product direction

The interface is a compact Chinese CS2 professional-scene product, not a generic SaaS dashboard, game store, or decorative landing page. Information hierarchy and fast scanning take priority over visual effects.

## Visual rules

- Use a flat dark neutral base with orange as the main accent.
- Green and red are reserved for results and live status. Do not add decorative accent colors without a semantic role.
- Prefer borders, spacing, and typography over shadows, glows, gradients, and nested cards.
- Avoid repeated rounded icon tiles, excessive pills, gradient text, glass surfaces, and hover-lift animations.
- Keep cards square or lightly rounded. Circular shapes are reserved for avatars and status dots.
- Keep source, update time, coverage, and unavailable states visible.
- Do not hide incomplete upstream coverage behind optimistic copy.

## Mobile rules

- Design from 360 px width first; enhance at larger breakpoints.
- Top navigation must remain readable without horizontal page scrolling.
- Tables must reflow or scroll inside their own bounded container.
- Primary actions need at least 44 px touch height where practical.
- QR codes must use the original asset without lossy optimization and remain large enough to scan.
- Avoid placing critical meaning only in hover states.

## Content rules

- Use direct Chinese labels. Remove promotional, vague, or self-congratulatory wording.
- Separate observation from interpretation.
- Identify machine-generated summaries explicitly; always preserve the original source link.
- Do not promise profit sharing. Any future contributor reward wording must state conditions and refer to a later published rule.

## Review checklist

1. Is the first screen clear without decorative explanation?
2. Does each card expose a real decision or data point?
3. Are color, icon, and motion semantically necessary?
4. Does the 360 px layout retain hierarchy and readable copy?
5. Are loading, partial, empty, and upstream-error states honest?
