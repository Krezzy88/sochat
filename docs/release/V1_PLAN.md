# SổChat 1.0 implementation plan

Owner authorized implementation on 2026-11-04. Student sessions, demo video and
multi-user evaluation collection are owner responsibilities, not invented results.

Release work, in order:

- [x] Core UX: ordinary note search without AI consent, clear loading/error/empty states,
      accessible mobile controls and reliable edit/delete/export flows.
- [x] AI retrieval: integrate useful search, remove manual repeated batch work;
      fresh per-action confirmation covers bounded preparation; no automatic sending
      on consent enable or transaction save. Existing daily AI caps remain unchanged.
- [x] Questions: bounded comparisons, largest expenses and budget usage with SQL
      calculations and inspectable evidence; no free-form financial advice.
- [x] Authentication implementation: password change/recovery,
      verification, revocation and abuse controls.
- [ ] Authentication activation: configure a verified mail sender; confirm
      actual inbox delivery before production release.
- [x] Operational implementation: guarded restore utility with synthetic rehearsal,
      migration/rollback procedure, health/error visibility, provider failure and cost controls.
- [ ] Hosted backup/restore: execute against an authorized source and a separate
      empty destination, verify retention and record the actual result.
- [x] Privacy: reconcile synthetic-demo documentation with real-data operation and
      explain provider processing/deletion accurately.
- [x] Release presentation: concise README, architecture and separate historical evidence.
- [x] Local verification: unit, database, browser and production build checks.
- [ ] Hosted verification: CI for the published candidate, backup/restore and actual
      provider activation/deployment; do not substitute local checks.

Do not migrate production, publish, send email or change billing automatically.
Do not mark production readiness from unit tests or historical evidence alone.

## Checkpoint: 2026-11-04, first implementation batch

Implemented locally (not published): ordinary owner-scoped literal note search,
100-character validation and OpenAPI update; reset filters; discard stale semantic
results and ledger answers when submitting a new request; localized result dates.
Added a PostgreSQL integration case covering case-insensitive search, literal SQL
wildcard characters, injection text, length rejection and cross-owner isolation.

Verification: typecheck, lint and production web build passed. All 97 database
integration tests passed using isolated Docker databases outside the sandbox.
The initial sandbox attempts could not access Docker; they were infrastructure
failures and are not recorded as passing runs. The previously reported 252 unit
checks predate this batch and must be rerun at the final release checkpoint.

Next: browser verification of ordinary search/reset, bounded AI question expansion,
then authentication and operational work listed above. No production database,
cloud setting, billing or AI consent semantics changed. Usage quota remaining is
not exposed to this coding session; no claim of automatic reset/resume is made.

## Checkpoint: password change

Implemented authenticated POST /api/auth/password and a Settings form. Requires
current password, enforces 12–128 characters, rejects unchanged passwords, hashes
with Argon2id and rate limits attempts. A compare-and-swap password update and
session deletion commit atomically; all sessions log out. Uses the system database
connection for session storage with explicit account predicates; tenant role has
no session-table grant. No grants or production migrations were changed.

Verification: 98 PostgreSQL integration tests, 252 unit tests, lint, typecheck and
web build passed. Integration first exposed the session-table privilege boundary;
fixed and rerun. Login correctness test resets disposable fixture counters before
checking old/new passwords, retaining product throttling unchanged.

Still pending: browser verification of Settings password form; emailed recovery,
AI query expansion/retrieval UX, operational restore and the remaining release
items. No email was sent and no external service configured. This is not a complete
1.0 release and has not been deployed.

## Checkpoint: monthly comparisons and presentation

Implemented optional validated compare_month intent, SQL totals for both periods
in one statement/snapshot and exact bigint expense difference in the response/UI.
Legacy one-month intents remain accepted. Gemini sees question/date only, never
ledger records or a SQL execution tool. Category, owner and empty-period behavior
are covered by database integration. All 99 database tests passed; 252 unit tests,
lint, typecheck and web build passed during this batch.

README now introduces the product concisely; prior content moved to
README_HISTORY.md with repository-relative links adjusted. Current release status
remains explicitly incomplete. Browser search/password tests were added; initial
failures were incorrect locators and an incorrect expected route after login,
not waived product failures. The corrected tests must finish before recording pass.

Question expansion still lacks largest-expense and budget-usage intents. No claim
of real Gemini accuracy for the new comparison intent: deterministic tests verify
SQL/contracts, and provider quality requires an explicit real evaluation.

## Checkpoint: Google and account email implementation

Added migration 009 for verified email timestamps, Google subject identities and
hashed one-use account tokens. Google starts only through CSRF-protected POST,
uses ten-minute state/nonce/PKCE, verifies ID tokens with google-auth-library and
never auto-links existing accounts by email. Explicit linking requires the current
session and matching email. Provider tokens are not persisted.

Added Resend adapter, bounded recovery/verification requests, 30-minute reset and
24-hour verification links, exact-purpose single-use consumption, session revocation
and password-change invalidation of existing reset links. Responses do not disclose
registered email in bodies; timing equality is not claimed. Provider failures emit
only a safe event. Mailbox verification is recorded, not enforced retroactively.

UI includes Google login/link, forgot password, verification requests and token-link
pages; secret fragments are removed from history and links opened in an existing
tab are handled. Environment placeholders and AUTH_SETUP.md explain activation.
No OAuth client, sender domain or key has been configured; no real Google login or
email delivery is claimed. No external email was sent by these checks.

254 unit tests passed; 104 PostgreSQL integration tests passed, including explicit
linking, token expiration/reuse, verification under RLS and invalid Google callbacks.
Four focused desktop/mobile checks passed. Full browser regression is in progress;
a newly added filter-reset button collided with an old broad delete-button locator,
so its label is being clarified to 'Bỏ bộ lọc' before the final rerun.

Final account batch check: 254 unit, 104 PostgreSQL integration and all 40
full desktop/mobile browser cases passed. Initial full-browser run had four broad
locator collisions with filter reset; clarified label and reran all 40 successfully.
Account-page CSS/privacy copy adjusted afterwards; focused rerun follows.
Approved README screenshots and historical coverage artifact were restored after
capturing new synthetic screenshots privately. Provider configuration, real Google
login, real email delivery, hosted restore and other unfinished 1.0 scope remain
open. See measurements/v1-account-checks.json; do not call this a production release.

Final focused auth/browser rerun after CSS/privacy changes: all four passed.
Provider setup remains the required external activation step.

## Owner scope correction: Google removed — 2026-11-04

Owner withdrew Google login/linking. Removed endpoints, UI, library and local OAuth
credentials. Keep email/password login, password change, verification and recovery
from the pre-OAuth 1.0 plan. Email delivery remains pending provider setup. Earlier
Google checkpoints are historical evidence, not current features. Migration 009
is preserved unchanged to avoid checksum drift for any previously migrated DB;
its unused auth_identities table grants no login capability and is not queried.
No cloud configuration or live database was changed.

Google removal verification: typecheck, lint, production web build, 252 unit tests,
103 PostgreSQL tests and six focused desktop/mobile auth journeys passed.
No public push, cloud configuration change or production migration was performed.

## Final implementation scope: 1.0 repository work

Added SQL-backed largest-expense and budget-usage modes, with totals/details in one
repeatable-read snapshot. AI only interprets mode/month/category. Search now asks
fresh consent and processes bounded batches behind one action, shows indexed /
pending progress, supports stopping and respects original daily model quotas.
Only latest 1,000 nonempty transaction notes are candidates; at most eight batches
(160 notes) per confirmation. Remaining work pauses at quota boundaries; no claim
that all historic records are searched. Cancelling sends no notes or search query.

Added /readyz database probe and switched deployment health configuration to it;
/healthz remains process liveness. Updated product/privacy wording for intended
personal use without claiming production activation. Unconfigured email actions
are disabled. Prepared guarded backup/restore utility and actually rehearsed it
against a separate disposable synthetic PG18 container: selected table counts and
transaction amount sum matched after restore; no native/Neon DB was used.

External release dependencies remain: actual hosted backup/restore authorization
and credentials/empty target, email provider activation and actual delivery, then
reviewed publication/CI/deployment. Student sessions/video/data collection remain
owner responsibilities. Do not mark these dependencies complete from local tests.

Verification checkpoint: 253 unit, 106 PostgreSQL integration and 42 full browser
cases passed. Three explicitly authorized real Gemini synthetic intent checks
passed for largest expenses, budget usage and comparison; no representative
accuracy claim. Guarded restore actually passed on isolated synthetic PG18.
Historical approved screenshots/coverage were preserved; new captures remain local.
A later change restricts non-total question evidence links to expense entries;
final lint/typecheck/build and targeted integration checks follow below.

Final backend rerun after evidence filter: all 106 PostgreSQL cases passed.
Two additional desktop/mobile question-view checks passed using mocked transport;
these verify presentation, while the separate three real Gemini checks verify
synthetic provider wiring. Lint/typecheck/build passed. Local implementation is
complete within the documented bounded scope; external activation is still open.

## PR #14 CI follow-up

Published candidate 1697bd6 failed CI run 41836202281 at the existing integration
function-coverage gate (91.02% vs required 93%), despite all tests passing. Trivy
passed. Added two meaningful HTTP journeys: recovery with equal response bodies for
known/unknown email, CSRF rejection, old/new login and cross-session revocation;
and one-use verification that updates only the token owner's security state.
All 108 integration tests now pass locally with unchanged thresholds: statements
91.24%, branches 83.74%, functions 94.44%, lines 91.89%. No production code or
coverage threshold was altered to make the gate pass. A new CI run is required.
