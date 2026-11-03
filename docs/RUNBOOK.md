# Runbook

## Local native development

Use Node 22.23.4/npm 10.9.4 and the dedicated local PostgreSQL 18 database described
in db/README.md. Keep .env ignored. Run npm ci, npm run db:migrate, then in separate
terminals LLM_PROVIDER=fake npm run api:start and npm run web:dev. Open
http://localhost:5173. Docker is not required for this native development path.
Never put API/database/session secrets in VITE_* variables.

## Isolated one-command container demo

```sh
docker compose --env-file /dev/null up --build --wait
# Open http://localhost:8080; register a synthetic account.
docker compose --env-file /dev/null down
```

This uses its own PostgreSQL 18 volume and fake extraction. It does not consume the
owner's .env, publish PostgreSQL/API ports or connect to native PostgreSQL. Only
127.0.0.1 web port 8080 is published. Local-only HTTP intentionally runs API in
development cookie mode with known synthetic credentials/session secret. Never
publish this configuration or reuse these secrets for production. Images default
to production mode; public hosting requires real secrets, HTTPS and trusted-proxy
configuration in a separately reviewed deployment. Phase 8 owns deployment.

Change SOCHAT_WEB_PORT if occupied; it also changes allowed APP_ORIGIN:

```sh
SOCHAT_WEB_PORT=18080 docker compose --env-file /dev/null up --build --wait
```

API migrations execute at startup under the existing advisory-lock migration runner.
Healthchecks gate startup. API/web processes run as node (UID 1000). API HOST defaults
to 127.0.0.1 natively; the image sets 0.0.0.0 for its internal network. The web image
serves the built SPA and proxies /api to the fixed API service. Hash navigation needs
no server route rewrite. No Gemini configuration is injected into the demo.

Shutdown preserves the demo volume. To intentionally erase only this demo's data,
run docker compose --env-file /dev/null down --volumes. Never use that command for
an unrelated project or a database containing records you need. Do not edit applied
SQL migrations: add a new forward-only migration. Back up real databases before
migration; there is no automatic production rollback/backup policy in this MVP.

## Verification

```sh
npm run lint
npm run typecheck
npm run test:coverage
npm run test:integration -- --coverage
npm run eval -- --config rules --split dev
npm run eval -- --config hybrid --provider fake --split dev
npx playwright install chromium
npm run e2e
# Against the running isolated Compose stack, on 18080:
npx playwright test --config playwright.compose.config.ts
```

Normal browser tests require free 3000/5173; they never reuse active owner servers.
Compose browser tests deliberately use 18080 and seven desktop journeys. CI runs
both the 14 desktop/mobile native journeys and these seven container journeys.
No held-out or real Gemini evaluation runs in CI. Owner-run real commands and
benchmark instructions remain in eval/README.md and db/README.md.

## Coverage gates

Calibrate each metric independently as floor(measured) minus 3, using retained
measurements rather than guessed targets:

| Suite / baseline                                     | Lines | Statements | Branches | Functions |
| ---------------------------------------------------- | ----- | ---------- | -------- | --------- |
| Unit measured Phase 6                                | 79.83 | 79.19      | 78.50    | 77.08     |
| Unit gate                                            | 76    | 76         | 75       | 74        |
| Integration measured Phase 5 source, Phase 4 fixture | 91.82 | 91.06      | 81.96    | 96.24     |
| Integration gate                                     | 88    | 88         | 78       | 93        |

Unit scope is runtime guard, parser, extraction and evaluation TS. Integration scope
is db/http TS. Tests are excluded. Server/CLI entrypoints outside those scopes,
React/HTML/CSS and container proxy code are not included in these line/branch
percentages. Browser V8 character ranges include bundled libraries and remain a
separate observation without a TypeScript coverage claim. Do not merge percentages
or quietly remove untested files to raise a score. New coverage scopes require a
new measured baseline and documented recalibration.

## CI and security

Actions are pinned to full commit SHAs. CI runs audit (high/critical gate), bounded
secret-pattern checks, lint/types, coverage, OpenAPI drift, rules/fake eval, both
browser modes, Compose build/start and Trivy filesystem vuln/secret/misconfiguration
scan. Trivy uses an exact image digest; it is not an unpinned installer action.
Reports are uploaded with 14-day retention, including failures. Never upload .env,
full authenticated Lighthouse reports or credential-bearing traces. Traces are off.

Dependabot checks npm and GitHub Actions weekly. Development moderate advisories
are disclosed rather than forced into incompatible downgrades. Filesystem scanning
does not prove that all base-image operating-system packages are patched; an image
scan and host/provider controls remain distinct checks. Hosted scan results must be
observed before claiming CI is green. No automatic merge or deployment is configured.
