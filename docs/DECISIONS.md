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
