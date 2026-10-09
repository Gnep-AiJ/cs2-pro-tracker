# Product edge cases

## Feature overview
Important-event catalogue, fixtures/results, individual search/comparison and bilingual deployment. See PRODUCT_REDESIGN_20261007.md.

## Categories
| Input/state | Expected behavior | Priority |
| --- | --- | --- |
| Empty search | Relevant known individuals, bounded list | P1 |
| Partial/leet/case/accent nickname | Ranked identity candidates, never silently choose first | P1 |
| Ambiguous name | Show team/platform and require candidate selection | P1 |
| Over 40 characters/control input | Reject/limit query | P1 |
| Same player twice | Disable comparison | P1 |
| Different event sample | Do not merge or call FACEIT professional data | P1 |
| No player scoreboards | No fabricated Rating; source link and selected context | P1 |
| Source 403/timeout/changed HTML | Use last sourced snapshot, label saved/partial date | P1 |
| A future match passes its scheduled time | Label scheduled, not automatically live/finished | P1 |
| Missing numeric stat vs zero | Missing stays null; zero stays zero | P1 |
| Rapid query/context changes | Abort/ignore obsolete responses | P1 |
| Unknown future teams | TBA, no invented match pair | P1 |
| Bad AI output/expired credential | Deterministic factual summary | P1 |
| Mobile/long names | Wrap identities and bounded controls; no page overflow | P1 |

## Error messages and recovery
Use short bilingual source/status copy; keep selected event and candidates. Show refresh and original source links. Never replace usable saved facts with a broad empty error. Missing statistics do not require hidden setup instructions in the product.

## Test scenarios
Pure parsers: known event dates, known final score, upcoming null scores, missing stats and malformed HTML. Search: partial nickname, aliases, leet variants, no-match and long query. API: source unavailable retains nonempty calendar; invalid requests rejected. Browser: same-event personal duel, FACEIT personal duel, language switch, 360px, direct production navigation. Read production event feed, individual data, FACEIT data and hashed assets after release.
