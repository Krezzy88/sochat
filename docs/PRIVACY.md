# Privacy and retention

SổChat is a personal expense tracker developed as a portfolio project. The 1.0
worktree is being prepared for personal use; deployment readiness requires the
operational checks in V1_PLAN.md. It has no analytics, advertising trackers,
bank linking or OCR. The Settings page contains the in-app privacy explanation.

Stored: email/display name, argon2id password hash, server-side sessions, confirmed
transactions, budgets, goals/contributions, idempotency responses, extraction cache
and usage/rate counters. Password plaintext is not retained. Session cookies are
httpOnly and tokens are not stored in localStorage. Draft financial payloads remain in React memory. Goal creation additionally stores
only an opaque per-account retry UUID in sessionStorage for recovery after reload;
it contains no amount, name, note or authentication credential and is removed on
resolved recovery/success (or when the tab session ends).

Gemini receives one message and the current Vietnam calendar date, together with
the fixed extraction instructions/schema. It does not receive account ID/email,
other ledger entries, session credentials or tools. Message text may itself contain
personal information: do not enter any. Provider-side processing/retention depends
on the configured Gemini service/account; this project cannot promise provider
zero retention. CI/tests use FakeProvider and never send messages to Gemini.

Ledger/profile data persists until edited/deleted or account deletion. Idempotency
records persist until account deletion to preserve retry semantics. Sessions expire
after seven days; production pruning is enabled. Cache and rate-counter expiration is lazy; daily user usage remains until account deletion and global anonymous usage is retained.
physical purge scheduling and backup retention require deployment configuration.
There is no claim of immediate physical erasure from disks or external backups.
Operational extraction logs contain only outcome, latency and token counts, never
message text, emails, passwords or credentials. No retention policy for hosting logs
or backups is established before hosting is chosen; these remain deployment tasks.

Settings exports all transactions as CSV, not a full account archive. Export is
chunked within one read-only repeatable-read snapshot. Slow streams are terminated
after 30 seconds; retry if the download is incomplete. Account deletion is irreversible and
removes user-owned database rows and all user sessions through foreign-key cascade;
a regression test checks every public table with user_id. Anonymous sessions and
global aggregate quota counts contain no account reference. Provider logs and any
future external backup copies are not erased by a PostgreSQL cascade.

## Owner-approved optional AI inputs (2026-11-03)

Semantic search is OFF for every account unless explicitly enabled in Settings.
Consent is stored per account and enforced server-side. Turning it on does not
start indexing or searching automatically.

Voice was removed at the owner’s request before deployment. The UI requests no
microphone permission and there is no audio upload/transcription endpoint.

Semantic: a fresh explicit preparation confirmation authorizes up to eight bounded
requests (up to 160 notes) from the latest 1,000 nonempty ledger notes, with progress
and a stop control. Individual requests send up to 20 sanitized transaction notes
per request to Gemini Embedding 2. Numeric strings, email addresses, URLs and common
API-key patterns are removed; the payload excludes transaction amounts, account IDs
and timestamps. This is minimization, not reliable anonymization: names, locations,
spelled-out numbers and other personal details may remain in notes. Search sends
the sanitized search phrase. Embeddings are derived personal data stored with the
owner and transaction IDs. Note edits invalidate them; transaction/account deletion
cascades; disabling semantic consent deletes that user's vectors. A consent change
is checked again before committing an indexing response. Already transmitted data
cannot be recalled from the provider.

Read-only questions send only the question and current date. Draft revision sends
only the new instruction and draft indices/types/categories, excluding existing
amounts, notes and dates. All totals and delta arithmetic run in SQL/TypeScript;
models produce only validated intents/plans. No model-generated SQL or autonomous
ledger changes. Chat history remains in page memory and resets on navigation/reload.

OpenTelemetry records fixed route templates, method, response status, duration and
trace IDs. No request bodies, notes, amounts, account identifiers, cookies or raw
exceptions are instrumented. No automatic HTTP/SQL instrumentation or external
collector is enabled. The opt-in hardening Compose file logs locally; log rotation
and retention remain deployment configuration. CI uses mocked transport solely for
deterministic regressions; separately labeled owner-authorized local checks use the
real Gemini API and synthetic accounts. Historical pre-removal audio checks are
labeled as such and do not describe current product features.

## Owner-provided development evaluation

Owner explicitly authorized the 50 voluntarily supplied development phrases to be
sent to Gemini and approved their labels, then revised the bare-number policy.
Approved labels/raw outputs live only in ignored owner-only `.local/owner-dev`
files. Public evidence contains aggregate metrics/hashes, never the new raw outputs
or financial labels. These phrases are not held-out data. The evaluation process
uses a separate capped memory budget, never changes the web application's caps and
never inspects the owner's saved ledger. The demo profile now explicitly defines
bare monetary 1–999 as thousands, while dates/times/quantities remain excluded;
all proposals require human review and no extraction writes ledger rows.

## Account email

Google authentication is not in current scope. Email/password accounts may request
verification or recovery only when the mail provider is configured. Resend receives
the recipient address and one-use link; these are never sent to Gemini. Token
hashes and expiry are stored in PostgreSQL, not token plaintext. Expired token rows
are purged lazily on new mail requests. New requests replace prior links. Password
change invalidates pending reset tokens; reset revokes the account's sessions.
Verification is recorded but does not retroactively block existing accounts.
Provider mail delivery/storage retention must be configured and disclosed before
activation; no promise of deletion from the provider is made.
