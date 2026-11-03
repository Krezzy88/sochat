# SổChat

A Vietnamese chat-to-ledger expense tracker for university students.

Status: **Phase 0 bootstrap**. There is no running API, database or web application yet.
See [verification evidence](docs/EVIDENCE.md) for actual checks and limitations.

The MVP will support authentication, chat extraction with editable confirmation,
transaction management, month/year reports, monthly category budgets, simple savings
goals, CSV export and account deletion. OCR, bank linking, investment/tax features,
multi-currency and AI financial advice are outside the MVP.

## Local setup

Use Node.js **22.23.4** and npm **10.9.4**. With nvm installed:

```sh
nvm install
nvm use
npm install --global npm@10.9.4
npm ci
npm run lint
npm run typecheck
npm test
```

Other version managers can read `.node-version`. `.npmrc` rejects incompatible
engines; the install hook also checks Node 22.13+ within major 22. No system Node
installation is changed by this repository.

Optional commands:

```sh
npm run check:runtime
npm run test:coverage
npm run format
cp .env.example .env
```

Phase 0 does not load `.env`, require Docker, connect to PostgreSQL or call Gemini.
Never commit API keys or real personal/financial data. Tests and CI will use a
deterministic fake extraction provider when the LLM phase is implemented.

## Workspace

| Path              | Responsibility                                  | Implementation phase |
| ----------------- | ----------------------------------------------- | -------------------- |
| `packages/parser` | Pure deterministic Vietnamese parser            | 1                    |
| `apps/api`        | Express 5 + TypeScript API, PostgreSQL via `pg` | 4 (database in 2)    |
| `apps/web`        | React + Vite dashboard, Vietnamese UI           | 5                    |
| `scripts`         | Toolchain validation                            | 0                    |
| `docs/agent`      | Unmodified owner-supplied project documents     | Reference            |

Workspace entry points are intentionally empty until their phase is authorized.
Root lint and typecheck commands cover all three workspaces. Root Vitest discovers
tests under `scripts`, `packages` and `apps`. Coverage currently measures only the
runtime guard and says nothing about application correctness.

## Engineering boundaries

- Rules first; Gemini is an extraction fallback behind `ExtractionProvider`.
- All calculations and business logic run in code/SQL.
- Integer VND, PostgreSQL `bigint`, calendar dates in `Asia/Ho_Chi_Minh` and injected time.
- Parsing proposes transactions; saving always requires user confirmation.
- No real LLM calls in CI; no held-out evaluation without the owner's request.
- Metrics in the supplied kit are authoring-environment references, not results for this repo.

The implementation follows [the charter](docs/agent/PROJECT_CHARTER.md),
[phase instructions](docs/agent/AGENT_PROMPT.md) and
[reference snippets](docs/agent/REFERENCE_SNIPPETS.md). References must be adapted and
tested. [Architecture decisions](docs/DECISIONS.md) record the initial choices;
[the backlog](docs/BACKLOG.md) records deferred questions. Each phase stops at its gate.

License: **not selected**. `UNLICENSED` reserves rights until the owner decides;
MIT is a suggestion, not an approved license.
