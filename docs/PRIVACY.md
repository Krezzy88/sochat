# Privacy and retention

SổChat is a student portfolio project. The demo is for synthetic data only, not
real personal or financial records. It has no analytics, advertising trackers,
bank linking or OCR. The Settings page contains the in-app privacy explanation.

Stored: email/display name, argon2id password hash, server-side sessions, confirmed
transactions, budgets, goals/contributions, idempotency responses, extraction cache
and usage/rate counters. Password plaintext is not retained. Session cookies are
httpOnly and tokens are not stored in localStorage. Drafts remain in React memory.

Gemini receives one message and the current Vietnam calendar date, together with
the fixed extraction instructions/schema. It does not receive account ID/email,
other ledger entries, session credentials or tools. Message text may itself contain
personal information: do not enter any. Provider-side processing/retention depends
on the configured Gemini service/account; this project cannot promise provider
zero retention. CI/tests use FakeProvider and never send messages to Gemini.

Ledger/profile data persists until edited/deleted or account deletion. Idempotency
records persist until account deletion to preserve retry semantics. Sessions expire
after seven days; production pruning is enabled. Cache/counter expiration is lazy;
physical purge scheduling and backup retention require deployment configuration.
There is no claim of immediate physical erasure from disks or external backups.
Operational extraction logs contain only outcome, latency and token counts, never
message text, emails, passwords or credentials. No retention policy for hosting logs
or backups is established before hosting is chosen; these remain deployment tasks.

Settings exports all transactions as CSV, not a full account archive. Export is
chunked and may reflect concurrent writes. Account deletion is irreversible and
removes user-owned database rows and all user sessions through foreign-key cascade;
a regression test checks every public table with user_id. Anonymous sessions and
global aggregate quota counts contain no account reference. Provider logs and any
future external backup copies are not erased by a PostgreSQL cascade.
