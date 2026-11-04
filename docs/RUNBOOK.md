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
Compose browser tests deliberately use 18080 and nine desktop journeys. CI runs
both the 18 desktop/mobile native journeys and these nine container journeys.
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

## Optional AI expansion / Docker hardening

Native migrations add preferences (default false) and derived-vector storage. They
DO NOT enable RLS or change the native PostgreSQL role. Semantic storage uses a
portable 768-element `double precision[]`, not a required PostgreSQL extension.
At the current bounded 1,000-note scope, exact owner-filtered search is intentional;
pgvector/ANN requires a measured scale/recall justification before adoption.

Before enabling demo RLS: stop writes, create a local owner-only backup outside the
repository (`umask 077`; `docker exec sochat-demo-db-1 pg_dump -U sochat_demo -d
sochat_demo > /private/tmp/<private-backup>.sql`), verify it, apply migrations, then:

```sh
docker exec -i sochat-demo-db-1 psql -v ON_ERROR_STOP=1 -U sochat_demo -d sochat_demo < db/enable-rls.sql
docker compose --env-file .env -p sochat-demo -f compose.yaml -f compose.gemini.yaml -f compose.hardening.yaml up --build --wait
```

The hardening override requires the role/policies to exist. It enables local-only
OpenTelemetry spans and 60-second metric exports. Do not attach an external
collector or enable auto instrumentation without privacy review. The SDK accepts
only localhost/collector endpoints. No raw bodies/errors/identity fields are added.
Check fixed `otel_trace` fields in local logs; do not copy all logs into reports.

In Settings, opt in to semantic notes. In Transactions,
explicitly index 20 notes at a time and search the indexed subset. Turning semantic
off deletes vectors; note edits invalidate vectors and need explicit reindexing.

Owner-authorized local real-provider checks (never CI; consume shared daily caps):

```sh
node --experimental-strip-types scripts/check-ai-expansion-live.ts
npx playwright test --config playwright.expansion.config.ts
```

Both require the real Gemini Docker demo and create/delete synthetic accounts.
The browser test can run with `SOCHAT_LIVE_FEATURES_ONLY=true` to check just the
remaining consent/index/search journey when chat has already been verified,
conserving the shared quota. Reports state which assertions ran. No microphone,
synthetic speech file or voice permission is required in the current product.
Do not increase/reset quota to bypass limits silently. Sanitized reports are saved
under docs/measurements; older voice results are explicitly historical.

## Revision/idempotency upgrade (migration 008)

Back up the Docker demo privately before upgrading. Never use `down -v`. Upgrade
API and web together; old clients lack required version fields and must reload.
Native PostgreSQL development migration is a separate owner operation, not part of
the Docker update. PATCH/DELETE transactions/goals require their observed `version`;
budget update/delete requires returned `id:version`, creation uses `0`. On 409 fetch
fresh data, review changes and retry explicitly; do not auto-retry stale edits.
Goal creation requires a per-intent UUID. After an unknown response retry the exact
payload/key. `GET /api/goals/creation-status/:key` is owner scoped and returns
saved/deleted/unknown for recovery; it does not disclose another owner's intent.
CSV uses a read-only snapshot until completion/disconnect, bounded to 30 seconds.

Owner-confirmed v2 slang and bare-money shorthand are explicitly enabled in `compose.gemini.yaml`; ordinary
native/CI defaults remain `MONEY_PROFILE=standard`. Private owner dev commands:

```sh
node --env-file=.env --experimental-strip-types scripts/probe-owner-dev.ts --owner-approved --tag <new-run-name>
node --experimental-strip-types scripts/score-owner-dev.ts --tag <new-run-name>
```

The scoring command requires the 50 owner-approved labels in ignored
`.local/owner-dev/approved.jsonl`. Probe outputs are private; a run tag cannot be
overwritten. Evaluation has a dedicated bounded 50-attempt memory quota and does
not bypass or change web quotas. Do not run in CI, publish raw phrases/labels or
report this tuned dev score as held-out accuracy. No current pricing is assumed.

## Phase 8 deployment rehearsal

Owner selected one Render Free Web/API service plus Neon Free PG18; see
DEPLOYMENT.md. This is separate from the existing local sochat-demo and native DB.
The new image optionally serves built React through the API's exact HTTPS origin.
Render's documented RENDER_EXTERNAL_URL is used only when RENDER=true and no explicit
APP_ORIGIN overrides it. Never set a wildcard Origin to support previews.

```sh
docker compose --env-file /dev/null -p sochat-phase8-check -f compose.release-test.yaml up --build --wait
npx playwright test --config playwright.release.config.ts
# Remove ONLY this disposable rehearsal stack, including its synthetic volumes:
docker compose --env-file /dev/null -p sochat-phase8-check -f compose.release-test.yaml down --volumes --remove-orphans
```

This rehearsal uses a non-superuser database owner, no real key and ephemeral local
self-signed TLS termination. It verifies browser Secure cookies and production-mode
same-origin behavior, not a real Render certificate/Neon TLS session. Test accounts
are deleted. It runs in CI on isolated fixture services and never calls Gemini or
loads owner .env. A real hosted URL and Free Tier account require separate acceptance.

### Full Compose browser suite and registration quotas

The expanded suite creates more than ten isolated synthetic accounts from one IP.
The real app keeps its default ten-registration window; do not raise production
limits to make tests pass. For the disposable `sochat-ci` stack on localhost:18080:

```sh
SOCHAT_COMPOSE_FIXTURE=sochat-ci npx playwright test --config playwright.compose.config.ts
```

Before each actor, a runner-only fixture clears anonymous rate counters in that
specific test DB. It checks the exact base URL, opt-in value and Compose project
label before executing fixed SQL. It never clears ledger/user rows or changes
application quotas. With no opt-in it performs no Docker/DB operation. Other hosts,
ports and projects are rejected; do not use this flag against the owner demo or
hosted resources. Integration tests still verify real throttling independently.
