# Reading order and control repair

User-authorized scope: cs2pro redesign, production release and obsolete generated-file cleanup only.

The previous screen exposed catalogue, duplicate selectors, metric highlights, four generic tabs and nested FACEIT tabs before the useful records. The supplied Windows screenshot demonstrates unreadable native event options. These are product and control defects, not a request for additional decoration.

Design: match-centre reading order. Show the selected event, concrete fixtures/results, a short qualified player board, then a separate FACEIT preview. FACEIT opens the curated individual board directly. Comparison belongs to a player action; AI and official standings remain secondary disclosures. Preserve old direct links, real data, explicit coverage and separate event/FACEIT metrics.

Palette: pitch #0c0f14, surface #151b23, raised #202a36, rule #354150, ink #edf3fb, action #ffab76. Existing system sans gives readable bilingual copy; restrained numeric figures distinguish measured values. No new fonts or dependencies. Use a single selected-event identity and ordered rows, not a grid of generic cards.

Replace the event select with a native modal dialog containing a search field and normal keyboard-operable choice buttons. Escape, modal focus containment and focus return use browser dialog behavior. Give all remaining native selects and options explicit dark foreground/background plus color-scheme. Verify opening the actual options, not only the closed select.

Acceptance: desktop and 360px Chinese/English; event search/selection, outside/Escape close and focus return; score/sample integrity; default results when schedules are absent; player search, filters, expanded rows and individual comparisons. Run repository lint, tests/type/build, production asset/API readback. Keep the last deployed local release and observation/source archives when clearing older generated packages.

## Release evidence

- Published to https://cs2pro.pages.dev; deployment `6978e5d7-20c8-4b3d-9ba4-0f7560d4349f`. Prior deployment `7a4517e1-df5a-461e-b14e-61997805da57` and its local `lab-final` package remain available for rollback.
- Build and 37/37 existing tests passed after the asynchronous fixture-filter repair. Type checking passed. Lint has zero errors and ten existing warnings. Packaged HTML referenced 13 valid assets across four routes; actual configured secret scan passed across 20 files.
- Browser review: readable event modal and names/logos/dates; `beijing` returns IEM Beijing; native Escape closes and returns focus to the trigger. Chinese event page at 360px and English FACEIT page were inspected. On production, 360px document width is 345px with viewport width 360px; default selection is Results 33, with five actual results shown. Clicking Compare donk exposes same-event samples, and `dnok` finds donk as a selectable identity.
- FACEIT filters are folded and expand to explicit period, match-window, map, outcome and minimum-sample selects. Colors and dark color-scheme were applied. The browser's native-popup click/capture and final full-page capture timed out; an actual native-option popup screenshot was not obtained. Do not claim every platform's native menu appearance was visually verified. The replacement event modal was visually verified and its screenshot retained at `outputs/ui/reading-event-chooser.png`; the preview mobile screenshot is at `outputs/ui/reading-mobile.png`.
- Read-only production verification confirmed 11 important events, 33 fixtures/results, 80 entrants and ten available individual statistic samples; future stats withheld. FACEIT persistent collection has 20 players, 437 matches and 22 shared-match pairs. Both tested live player profiles and fuzzy search are available. Existing FACEIT secret, AI and R2 bindings remain intact. Report: `outputs/release-20261008-reading/production.json`. The scheduled collector's next automatic run was not verified by this UI release.
- Removed 18 explicitly inventoried obsolete generated packages, 82,874,751 bytes (79.04 MiB). Verified 217 protected source, secret, observation and rollback/new-package files unchanged by hash. Receipt: `outputs/release-20261008-reading/cleanup-receipt.json`. Retained the preceding `lab-final` and new `reading-final` packages; did not touch other projects.
