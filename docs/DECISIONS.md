# Architecture decisions

## ADR-001: MVP stack

Date: 2026-11-03. Status: accepted by the owner-provided charter.

### Context

SổChat is a portfolio MVP for Vietnamese university students. The goal is a small,
testable responsive web app with reproducible engineering evidence. Scope is defined
by `docs/agent/PROJECT_CHARTER.md`; changes require an owner decision.

### Decision

- Node.js 22, strict TypeScript, Express 5 and zod for the API.
- React, Vite, TypeScript and Recharts for the Vietnamese dashboard.
- Vitest for unit tests, Testcontainers for real PostgreSQL integration tests and
  Playwright for browser tests; Docker Compose and GitHub Actions for reproducibility.
- npm workspaces separate `apps/api`, `apps/web` and `packages/parser`.
- The parser stays pure TypeScript with no I/O or runtime dependencies. Time is
  injected; dates follow `Asia/Ho_Chi_Minh`.
- Gemini only extracts from a single message, behind `ExtractionProvider`.
  Rules run first; all arithmetic, reporting and business rules use code/SQL.
  Tests/CI use a deterministic `FakeProvider` once implemented.

### Consequences

Phase 0 installs tooling only. Application dependencies are verified and installed
in their implementation phase. Node 22.23.4 and npm 10.9.4 are pinned for local/CI
consistency. The runtime guard rejects unsupported majors and Node 22 below 22.13,
the minimum required by the selected ESLint release. Node 22 remains the charter
baseline even though newer supported majors exist.

ESLint 10.14.0 and TypeScript 5.9.3 are deliberate compatible pins: the selected
typescript-eslint 8.72.1 supports ESLint 10 and TypeScript below 6.1. We do not blindly
adopt the registry's newer TypeScript major. Vite/React/Express/Gemini model versions
are not selected prematurely. See `EVIDENCE.md` for registry checks and CI action SHAs.

## ADR-002: PostgreSQL, SQL migrations and `pg`

Date: 2026-11-03. Status: accepted by the owner-provided charter.

### Context

The application needs relational ownership, account deletion, constrained money
values and month/year aggregation with explainable query plans.

### Decision

Use PostgreSQL 16, forward-only plain SQL migrations and the `pg` driver.
Repositories will use parameterized SQL and explicit per-user ownership predicates.
Store money as integer VND with `bigint`, never floats. The database implementation
and migration-runner choice belong to Phase 2; they are not implemented here.

### Consequences

Constraints and cascading deletion will be tested against real PostgreSQL 16.
SQL aggregation and covering indexes can be benchmarked directly with `EXPLAIN
(ANALYZE, BUFFERS)`. A monthly rollup is optional and needs the owner's own benchmark
evidence or explicit request. The kit's benchmark results do not justify adding it.
Transport serialization and JavaScript integer handling must be explicit when the
database and API are implemented. No ORM, rollup or database container is added in Phase 0.

## ADR-008: Forward-only transactional SQL migrations

Date: 2026-11-03. Status: implemented for Phase 2.

Use a small pg runner: one transaction with an advisory transaction lock, sorted
SQL files and SHA-256 checksums in schema_migrations. Reject missing, changed and
out-of-order applied migrations. A failure rolls back the entire pending batch.
DDL file contents are trusted source; runtime values always use query parameters.
No rollback migrations are supplied. Run with a database administrator connection;
future application credentials should not have DDL privileges.

## ADR-009: User-owned extraction cache and contribution integrity

Date: 2026-11-03. Status: implemented for Phase 2.

Partition cache keys by user and cascade cache deletion from users. Cache responses
can contain notes, so a globally shared response cache cannot meet account-deletion
requirements. Phase 3 must include local date, model and prompt version in cache
identity; no cache expiry policy is implemented yet. Contributions reference
(goal_id,user_id) together to prohibit cross-owner contributions at the database
boundary. Repositories additionally check category ownership and category type.
This does not introduce custom-category UI or endpoints.

## ADR-006: Retain covering index; do not add monthly rollup

Date: 2026-11-03. Status: accepted for Phase 2 after owner-run measurements.

On the owner's one-million-row synthetic PostgreSQL 18.6 workload (11 runs per
query/scenario), covering index p50 was 0.013 ms for month, 0.012 ms for daily and
0.092 ms for year; year p95 was 0.139 ms. All three retained covering plans used
Index Only Scan with zero heap fetches. See EVIDENCE.md and the retained benchmark
JSON for all samples and EXPLAIN ANALYZE BUFFERS plans.

Keep migration 002 only. These measured costs do not currently justify a second
aggregate representation and its write/reconciliation complexity. Rollup itself
was not benchmarked, so no relative rollup speedup or lack of benefit is claimed.
Revisit only for a measured production bottleneck or the owner's explicit request.
The workload is warm-cache and selective (one of 1,000 synthetic users); these
figures are database execution timings, not end-to-end API latency guarantees.
PostgreSQL 18 supersedes the original baseline per ADR-010.

## ADR-010: Owner-approved PostgreSQL 18 baseline

Date: 2026-11-03. Owner explicitly requested the installed local PostgreSQL 18.
Upgrade the charter and active instructions to 18. Develop against a dedicated
local database, and retain disposable PostgreSQL 18 Testcontainers for integration
tests and CI. This avoids mixing test fixtures with local data while keeping the
same major version. Earlier PostgreSQL 16 test results remain historical evidence,
not proof of 18 compatibility. No speedup is claimed without measurements.

## ADR-011: Guarded extraction with persistent attempt budgets

Date: 2026-11-03. Status: implemented for Phase 3, real-model evaluation owner-gated.

Use native Gemini REST behind ExtractionProvider and a deterministic scripted
FakeProvider. Model/key are env-only, with model metadata checked at explicit real
startup. Strict zod schema, valid-calendar checks, source amount guard and human
confirmation apply to every provider/cache proposal. Conservative rules ambiguity
survives model confidence. No calculations, tools, other transactions or user account
fields are sent to the model. See docs/EXTRACTION.md for the full boundary.

Use a user-scoped, date/model/prompt-version cache and PostgreSQL-serialized quota
reservations. Count each physical attempt, including retries, against user/global
limits; use operational server day independently of parsing's injected time. Global
counts contain no user references and survive account deletion, while all user-owned
state cascades. Migration 004 follows 002 with 003 intentionally unused; any future
rollup must use a later forward-only number. Do not edit applied migrations.

Preserve the parser's existing behavior and the untouched synthetic seed labels.
The 50 owner phrases and corrected slang glossary are not complete gold labels;
do not invent labels, tune against held-out data or claim real-user accuracy.

## ADR-012: Cookie sessions, synchronizer CSRF and API confirmations

Date: 2026-11-03. Status: implemented for Phase 4.

Use maintained express-session with connect-pg-simple and an explicitly migrated
sessions table. Cookies carry an opaque signed SID, httpOnly, SameSite=Lax and
Secure in production. Regenerate SID and CSRF after register/login; destroy SID on
logout. A generated user_id column references users so deleting an account removes
all sessions, including sessions on other devices. Authentication rechecks user
existence on every private request. Passwords use the maintained argon2 package,
explicit argon2id with library defaults; no password or session data is logged.

GET /api/auth/csrf initializes an anonymous session and synchronizer token. Every
state-changing endpoint, including login/register, requires that token in the
X-CSRF-Token header and its associated cookie. Validate token format and compare
with timingSafeEqual. Auth responses return the new token. Exact APP_ORIGIN checks
and credentialed CORS supplement CSRF; non-browser clients still need the token.
Production requires HTTPS; trust proxy defaults to 0 and is configured explicitly
for a trusted reverse proxy topology. Deployment must not blindly trust client
forwarded headers. No tokens are stored in localStorage.

Login limits use HMAC(IP + normalized email), plus an IP aggregate; parse limits
are per authenticated user. PostgreSQL atomic UPSERT counters work across API
workers. Keys contain no plaintext identity; known user counters cascade on delete.
Expired counters are lazily removed. This is MVP throttling, not an upstream DDoS
protection service.

Confirmation is POST /api/transactions/batch with a UUID idempotency_key in the
body. Revalidate every field and category ownership/type. One transaction reserves
the per-user key, inserts all items and stores the response. Concurrent retries
serialize on the unique key; mismatched payload returns 409 and failures roll back
both key and items. Parsing never writes ledger transactions. Cache/quota writes
from Phase 3 remain separate from ledger persistence. No raw source text is retained
by the confirmation API. Idempotency state cascades on account deletion.

OpenAPI 3.1 derives inputs/outputs from the same zod schemas registered with the
routes. Validate the generated artifact and its equality to the live contract.
The OpenAPI validator requires Node 22.19+, so the minimum declared Node 22 minor
and runtime guard are raised accordingly; the pinned Node remains 22.23.4.
