# Phase 8 free demo deployment

Status: DEPLOYED at https://sochat.onrender.com. Public HTTPS functional checks and
three real Gemini/embedding browser smoke cases passed on 2026-11-04 with disposable
synthetic data. The owner confirmed Paid Tier 1 and explicitly authorized testing;
free-only API cost is no longer a release condition. Hosting remains on the selected
Render/Neon free plans. This is a portfolio demo, not a financial-record service.
Owner confirmed deployed commit 7586e2d84ee0954980f11a18f363bcd24a1230af, matching
the successful CI candidate. Hosted restore remains unverified.

## Owner-selected topology

Browser -> Render Free (React + Node API, same HTTPS origin) -> new Neon Free
PostgreSQL 18. Gemini is server-side only. Two hosting dashboards; one public app
URL. No Vercel service, paid domain or MongoDB migration is required.

- [Render Free](https://render.com/docs/free): sleeps after 15 idle minutes; cold
  start can take about a minute. Usage, outbound traffic and build constraints
  apply. Do not add keep-awake automation. Its free PostgreSQL expires in 30 days,
  so render.yaml provisions no database; Neon is separate.
- [Neon plans](https://neon.com/docs/introduction/plans): free compute/storage/
  egress quotas and scale-to-zero apply. Read actual current limits in the owner's
  console; do not promise unlimited/permanent free availability. Select PG18 on a
  NEW empty project and a nearby region supported by the free accounts.
- [Gemini pricing](https://aistudio.google.com/docs/pricing): the owner confirmed
  Paid Tier 1 and explicitly allowed real hosted tests despite the initial $0
  preference. Only synthetic data was used. No API request billing total is inferred
  from token estimates. Free Tier instructions below describe the initial option;
  the current owner-approved paid key is also allowed. Provider processing/retention
  depends on the configured project/tier.

Free hosting is conditional on staying within provider plans/quotas; Gemini costs
are separate. Generation caps remain 10/30 per user/global daily and are operational
caps, not a hard currency budget. Semantic consent defaults off. No quotas, billing
settings or provider access were increased for the hosted tests.

## Ready artifacts

- render.yaml: one free service with manual deploys and generated session secret.
- docker/app.Dockerfile: non-root combined React/API image; SERVE_WEB=true, binds
  HOST=0.0.0.0 and provider PORT, healthcheck /readyz. No additional frontend proxy.
- The API uses an explicit APP_ORIGIN if set, otherwise Render's documented
  [RENDER_EXTERNAL_URL](https://render.com/docs/environment-variables) only when
  RENDER=true. It still validates an exact HTTPS origin in production. This avoids
  guessing a service hostname before Render assigns it. For a custom domain set
  APP_ORIGIN deliberately; arbitrary alternate/preview origins are not allowed.
- `.dockerignore` excludes env files, `.local` and the owner inbox; private labels,
  local backups and credentials never enter image context. Runtime serves only
  built apps/web/dist, not source files or configuration.
- Hashed static assets are immutable-cacheable; HTML/auth/API stay no-store.
  Static and API requests receive Helmet/security and HTTPS/origin checks.

## Access and publication gate

Owner signs in personally to Render/Neon and Google AI Studio. Never send passwords,
API keys, connection URLs or access tokens in chat/PRs/screenshots/VITE_* variables.
Provider signup/terms, project billing tier and account ownership are owner tasks.
Before publication approve the exact branch/commit and destination accounts, source
publication and provisioning only free synthetic-demo resources. Confirm before
copying an existing key to a new host. No local owner/demo data is uploaded.

## Deployment sequence (after approval)

1. Publish the reviewed Phase 8 branch, create a draft PR and observe both CI jobs
   passing on the exact candidate SHA. Do not auto-merge the older open Phase 7 PR
   or deploy an outdated main. Free public source/demo publication remains explicit.
2. In Neon create a NEW Free PG18 project/database, with no owner-data import. Copy
   the direct connection URL into Render DATABASE_URL secret, not chat or git.
   Direct endpoint avoids transaction-pool compatibility questions for migrations/
   session settings. Require TLS/certificate verification (Neon recommends
   [verify-full](https://neon.com/docs/connect/connect-securely)); do not turn off
   certificate verification. The runtime pg pool is bounded to ten connections.
3. Create a Free Render Blueprint/service from render.yaml at the reviewed branch.
   Review the plan as Free before creation. Required settings:

| Variable                        | Value/source                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| DATABASE_URL                    | Secret: NEW Neon direct TLS URL, not native/local Docker PG                 |
| SESSION_SECRET                  | Blueprint-generated 256-bit secret, not local demo secret                   |
| GEMINI_API_KEY                  | Secret: owner-approved project/tier (Paid Tier 1 currently authorized)      |
| GEMINI_MODEL                    | Verified available gemini-3.5-flash-lite                                    |
| NODE_ENV / HOST / SERVE_WEB     | production / 0.0.0.0 / true                                                 |
| PORT                            | Provider default; do not force a different public URL port                  |
| APP_ORIGIN                      | Leave absent for Render default URL; explicit exact HTTPS for custom domain |
| TRUST_PROXY_HOPS                | 1, the immediate Render ingress                                             |
| MONEY_PROFILE                   | owner-confirmed-v2                                                          |
| LLM_DAILY_CAP_PER_USER / GLOBAL | 10 / 30                                                                     |
| ENABLE_RLS / OTEL_ENABLED       | false / false for initial managed-host demo                                 |

Existing Docker RLS stays unchanged. Managed-host RLS is a separate admin opt-in:
the current FORCE RLS script was validated with privileged Docker roles and MUST
NOT be applied blindly to Neon. Non-superuser auth/system queries and role
membership need separate review. Owner-scoped API predicates/isolation tests
remain mandatory. Hosted RLS protection is not claimed. 4. Startup migrations use the advisory lock on the fresh DB. Healthcheck /readyz
intentionally accepts the provider's internal HTTP probe; it does not prove
browser TLS/cookies or complete frontend/API usability. 5. Observe the actual Render URL/SHA/CI run URLs. Verify public acceptance below,
record measured evidence and obtain owner confirmation before marking deployed.
Keep manual deploys until these gates are satisfied; no automatic paid fallback.

## Public acceptance

- HTTPS app/hashed assets load with security headers, no secrets in bundles.
- `/api/auth/csrf` reaches the same origin, JSON/no-store response, Secure/HttpOnly/
  SameSite=Lax cookie; browser session survives reload. Actual hosted TLS/forwarded
  protocol behavior must be checked; local self-signed rehearsal is not a public
  certificate or provider-edge validation.
- Wrong Origin fails. Synthetic register/login/logout and expiry behavior work.
  Parsing saves nothing; user confirms. Exact/shorthand/multi-item amounts, dates,
  edits, reports/budgets/goals work. Stale 409 and UUID replay protections are intact.
- CSV contains only intended owned rows and latest edits; account deletion logs out
  and removes its data. Native Excel/Numbers import is a distinct manual check.
- Real Gemini smoke only after owner approval of the billing tier; record real provenance,
  attempts, tokens and ambiguity. No rules/fake run is a model accuracy result.
- Measure one cold start and one warm journey separately. Render may show its own
  loading page; no SLA/performance score is promised. App non-JSON upstream replies
  have a friendly retry message. Do not hide free-tier latency in claimed timings.

## Backup, restore and rollback

Use only the new hosted DB's direct TLS credentials via ignored secret/env files,
not command arguments or screenshots. `pg_dump -Fc` to owner-only files outside git;
rehearse `pg_restore --no-owner --no-acl` into a SEPARATE disposable PG18 DB. Check
representative synthetic rows/totals, migration checksums and app reads. The local
non-superuser restore rehearsal is recorded in EVIDENCE; hosted restore remains
NOT VERIFIED. Free instant-restore windows are not independent long-term backups.
Before upgrades the owner chooses retention and verifies backup; archives can
contain account/session data. No paid storage or automatic backup job is created.

Keep the previous compatible app SHA. Code rollback does not reverse a forward
migration. Never edit applied migrations, drop columns or restore over live data
without a reviewed maintenance plan. Account deletion does not erase old backups
or provider retention.

## Remaining Phase 8 gates

Hosted CI and public HTTPS/functional/real-provider smoke passed; see EVIDENCE.md
and docs/measurements/hosted-*.json. Owner confirmed the Live deployment is commit 7586e2d. Hosted backup/restore
remains unverified.
An untouched set of at least 50 held-out cases, five consenting student sessions
and an actual video of at most two minutes are still required. See USER_TESTING.md
and docs/release/HELDOUT_PROTOCOL.md. Phase 8 remains IN PROGRESS.

## Guarded restore rehearsal for 1.0

`scripts/restore-rehearsal.mjs` defaults to a dry run and never prints credentials.
Use a private mode-0600 env file with BACKUP_SOURCE_URL and RESTORE_TARGET_URL.
The target must be a separately created, empty database named `sochat_restore_*`.
Set SOCHAT_PG_BIN to PostgreSQL 18 command-line tools if they are not installed at
`/Library/PostgreSQL/18/bin`. Remote connections require TLS configuration.

```sh
node --env-file=.local/restore.env scripts/restore-rehearsal.mjs
# After reviewing source, target and backup retention:
node --env-file=.local/restore.env scripts/restore-rehearsal.mjs --execute
```

Execution exports a repeatable-read source snapshot, dumps it to a private archive,
restores without owner/ACL changes into the empty target, then compares selected
ledger/account table counts and the transaction amount sum. It refuses a nonempty
target and never drops a database. Artifacts remain in ignored .local/backups;
operator chooses retention/deletion and removes the disposable target afterwards.
Success does not certify every field, retention, RPO/RTO or provider availability.
This script has not been executed against the hosted production database.

`/healthz` is process liveness; `/readyz` verifies database connectivity and returns
503 when unavailable, without returning database details or contacting Gemini.

TLS note: the rehearsal normalizes remote require/prefer/verify-ca aliases to
verify-full and supplies PGSSLROOTCERT=system to libpq tools unless an explicit CA
path is configured. Node pg and pg_dump have different trust-store defaults.
Local non-TLS disposable databases retain sslmode=disable. Failures report only
phase and a safe reason, never raw child stderr or connection strings.
See https://www.postgresql.org/docs/18/libpq-ssl.html.
