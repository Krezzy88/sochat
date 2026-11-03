# SổChat

A Vietnamese chat-to-ledger expense tracker for university students.

Status: **Phase 2 database and repositories**. Database migrations and repositories are available; there is no HTTP API or web application yet.
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

Parser/evaluation commands do not load `.env` or call Gemini. Database migrations load `.env`; integration tests require Docker and use isolated PostgreSQL 18.
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

The API and web entry points remain empty until their phase is authorized.
Root lint and typecheck commands cover all three workspaces. Root Vitest discovers
tests under `scripts`, `packages`, `eval` and `apps`. Coverage measures the runtime
guard, parser and evaluation harness; there is no API or web coverage yet.

## Parser and evaluation

```sh
npm run eval
# Explicit equivalent (rules only, dev only):
npm run eval -- --config rules --split dev
```

The pure TypeScript API is `parseMessage(message, nowIso): ParseResult`. It uses
injected time, exact bigint money normalization, structured flags and Vietnamese
clarification questions. Invalid amounts and dates stay unresolved. See the
[parser contract](docs/PARSER.md) and [evaluation guide](eval/README.md).

Reports are written to `eval/results/rules-dev.json` and `rules-dev.md`. The supplied
65 synthetic dev cases were written by the same developer as the reference rules;
their score is **not representative of real users**. Results and limitations are
recorded in [EVIDENCE](docs/EVIDENCE.md). Held-out evaluation requires the owner's
explicit request and is never part of unit tests or CI.

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

## Database

See [database setup and owner benchmark](db/README.md). Run `npm run test:integration`
with Docker running for the PostgreSQL 18 integration suite. The owner-run million-row benchmark and its limitations are recorded in EVIDENCE.md.
