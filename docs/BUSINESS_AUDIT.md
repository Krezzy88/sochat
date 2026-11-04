# Business-rule audit — 2026-11-03–2026-11-04

Scope: current MVP plus approved AI/UX extensions, checked against the charter,
HTTP contracts, SQL/repository code, parser/extraction guards and web mutation flows.
This is a bounded engineering audit, not proof that every input/interleaving is bug-free.
No private owner ledger was inspected; all mutations/checks use isolated synthetic data.

## Findings corrected

| Finding                                                                   | Change                                                                                                                                           | Regression evidence                                                                                                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contributions could be counted twice after a lost POST response           | Required owner-scoped UUID, atomic insert/cache/replay, 409 on changed intent; frontend retains payload/key and locks edits on uncertain results | Concurrent duplicate requests return one contribution; changed payload rejected; failed intent rolls back; browser aborts a committed response then retries and still totals 30000 |
| Monthly/yearly totals and series could observe different concurrent edits | One read-only REPEATABLE READ transaction per report, with tenant-role support                                                                   | A second connection changes 50000 to 900000 between total and breakdown queries; response stays consistently 50000 while next read sees 900000                                     |
| Confirmation added income and expense into a misleading gross total       | Separate exact Tổng thu / Tổng chi summaries                                                                                                     | Existing confirmation/browser suite plus bigint calculation review                                                                                                                 |
| Indexing reported candidates rather than committed vectors                | Count actual inserted rows                                                                                                                       | Note changed while provider request runs: indexed=0, no stale vector persisted                                                                                                     |
| Semantic results could retain a transaction deleted during provider work  | Read current owned candidate rows again after embedding completes                                                                                | Concurrent deletion yields no returned transaction                                                                                                                                 |
| AI warnings could still prefill guessed money/dates                       | Keep unsafe rule fields unresolved; clear absent or over-reused model amounts; invalid explicit dates remain blank                               | Reproduced failing unitless/hallucinated-money and duplicate-mention cases before correction, then passed guards                                                                   |
| Keyword matching treated fragments as full words                          | Match normalized tokens instead of substrings; reject empty sanitized embedding text before quota use                                            | “phí” no longer matches “phim”; numeric-only text requires a description                                                                                                           |

The historical four-query retrieval baseline used the earlier substring scorer.
No live quality improvement is claimed from this change; representative retrieval
and held-out extraction evaluation are still outstanding. No live Gemini call was
made during the original audit. The follow-up below includes owner-authorized real
Gemini development evaluation.

## Rule matrix

| Area                 | Current rule / review outcome                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Amounts              | Integer VND; API fields from 1 to 100000000000; bigint arithmetic and sums. DB transaction CHECK matches. Some other DB tables only enforce positivity: direct administrator SQL is outside the API's upper-limit guarantee.   |
| Dates                | Calendar-valid ISO values; Vietnam day resolution. Reports use inclusive start/exclusive next-month or next-year bounds. Future transaction dates are explicit recorded dates, not a scheduling engine.                        |
| Extraction           | Rules first, strict model schemas, amount-in-message guard, calendar/category checks, ambiguity and editable human confirmation. Model plausibility is not a correctness guarantee.                                            |
| Transaction batches  | Atomic all-or-nothing save, per-owner replay key, conflicts on changed content; a replay can return its original response even if the original transaction was subsequently deleted, without recreating it.                    |
| Edits/deletes        | Owner predicates and RLS; required optimistic version on mutations; 409 preserves stale drafts; reports and budgets recalculate from live ledger rows.                                                                         |
| Reports              | Exact income/expense/net; snapshot-consistent breakdowns per response. Charts are approximate thousands, accessible tables retain exact money.                                                                                 |
| Budgets              | Monthly, per expense category; upsert keeps omitted categories; warning >=80%, reached/exceeded >=100%, remaining floor=0. Delete removes only that limit/month, not transactions.                                             |
| Goals                | Contributions are independent of income/expense ledger. Remaining floor=0; progress caps at 100%; overfunding allowed; daily target uses integer ceiling. Unfunded goals due today/past return null, completed goals return 0. |
| Future contributions | Owner explicitly chose immediate counting, including future dates. UI explains this; regression covers it. These are recorded contributions, not scheduled transfers.                                                          |
| Optional semantic AI | Default-off server consent; owner-first vector queries; invalidation on note edit, cascades on transaction/account delete, vectors deleted when disabled. Filtering is minimization, not anonymization.                        |
| Auth/data ownership  | Cookie sessions, CSRF, owner checks, private-table RLS on opted-in demo, account cascades and export isolation remain covered by integration tests. Email verification/reset remains outside approved scope.                   |
| CSV                  | Integer amounts, ISO dates, UTF-8 BOM, quoted cells/formula protection. All pages share one read-only REPEATABLE READ snapshot; 30-second stream bound; native Excel/Numbers import remains unverified.                        |

## Explicit remaining limits / decisions

- Goal creation is now idempotent. The client retains the exact in-page intent and
  a per-account, per-tab opaque UUID in sessionStorage (no financial payload). A
  recovery endpoint identifies committed/deleted requests after reload. If a request
  was not committed, re-enter the same fields with the retained key; changed payloads
  are rejected. Contribution/transaction pending payloads are still memory-only;
  inspect saved rows after navigating away during uncertain responses. This is not
  a durable offline outbox or cross-device retry mechanism.
- All transaction/goal PATCH and DELETE operations require the observed row version.
  Budgets use an opaque id:version token, preventing delete/recreate ABA conflicts.
  Conflicts return 409; users explicitly reload before replacing local drafts. Each
  independent page/report request has its own snapshot, not a global app snapshot.
- CSV uses one snapshot across all pages and aborts a slow stream after 30 seconds.
  Very large/slow exports may therefore require a retry. Native spreadsheet import
  and client network disconnect timing remain platform-dependent.
- AI may misunderstand meaning, categories or filters; visible interpretation and
  human confirmation remain necessary. Seed examples do not establish real-user
  accuracy. Semantic ranking may return weak matches; no calibrated score threshold
  or representative retrieval evaluation is claimed.
- No automatic transfers, bank balance reconciliation, bank linking, OCR, tax or
  financial advice. A displayed net is recorded income minus recorded expense,
  not a verified bank-account balance.
- Hosted CI for this branch, final held-out evaluation and the five student sessions
  remain separate gates. Native OS calendar behavior outside tested Chromium and
  actual native spreadsheet import remain outside this audit's evidence.

## Validation

Commands and final counts are recorded in EVIDENCE.md. Added PostgreSQL/RLS tests
for replay races, read-snapshot consistency, type/date/amount changes and budget
recalculation, goal rounding/deadline/overfunding, future contribution policy and
embedding concurrency. Browser test drops a real synthetic backend response after
commit and retries. Existing schema/amount/date, deletion, export and ownership
regressions were retained; coverage gates were not lowered.

## Production-hardening follow-up — 2026-11-04

Migration 008 adds database-managed revision counters to transactions, goals and
budgets. Required versions intentionally change mutation contracts: reload old web
clients before editing; API consumers must fetch current versions. Budget creation
uses version `0`; updates/deletes use the returned opaque token. Goal creation
requires a UUID idempotency key. Reusing a key with different data returns 409;
replaying a deleted creation returns the original response without resurrecting it.

Tests exercise concurrent duplicate goal creates, owner-scoped recovery, stale
edits/deletes for all three entities, budget delete/recreate, CSV reads across a
500-row boundary while another connection edits/inserts rows, and snapshot rollback
on a failed consumer. Browser journeys cover lost creation responses, recovery on
reload and real same-account two-tab conflicts. See EVIDENCE.md and the machine-
readable production-hardening measurement for final counts and AI dev caveats.
