# Database phase

Baseline: PostgreSQL 18; real integration tests use the official
`postgres:18.6-bookworm` image. Requires a running Docker-compatible runtime.
Tests create and remove their own containers; no local database is used.

```sh
npm ci
npm run test:integration
```

To migrate an explicitly selected development database, set DATABASE_URL locally
without printing credentials, then run `npm run db:migrate`. The migration command loads the ignored local .env file. Do not run against a database with unrelated tables.
Migrations use a transaction, advisory lock and checksums; never edit an applied file.
The CLI requires no Docker when an existing PostgreSQL server is used. PostgreSQL 18 local is the owner-approved development baseline; container tests use the same major version.

Repositories take the authenticated user ID supplied by the future API. They are
not authentication services. IDs and bigint sums stay decimal strings from pg;
write methods take bigint amounts. Dates are explicitly returned as SQL text where
needed to avoid host timezone conversion. Transaction list currently has a bounded
100-row limit; cursor/filter API behavior belongs to Phase 4.

## Owner-run benchmark

```sh
ROWS=1000000 RUNS=11 ./db/bench.sh > /tmp/sochat-benchmark.log
```

Uses an isolated temporary PostgreSQL 18 container and synthetic deterministic seed 20261103. Does not drop or touch a local database. Requires Node 22, installed npm
dependencies and Docker. Output is saved to db/results/benchmark.json, containing
PostgreSQL version, row/run counts, raw timing samples, p50/p95 and final EXPLAIN
(ANALYZE, BUFFERS, FORMAT JSON) plans for every query/scenario. One warm-up per query
is excluded. Scenarios: no reporting index, btree, covering index. No rollup is added.
Record host CPU/OS, Docker memory allocation and the source commit with your results.
For a quick owner smoke check use ROWS=10000 RUNS=3; those results cannot stand in
for the required million-row benchmark. Review reports for synthetic data only and
share the benchmark JSON to record actual measurements in EVIDENCE.md.

No benchmark has been run by the agent. Its implementation remains NOT VERIFIED
until the owner executes it. Preserve previous results before rerunning.

## Installed local PostgreSQL 18

Run once from your own terminal (passwords stay in hidden prompts):

```sh
/Library/PostgreSQL/18/bin/psql -h localhost -U postgres -d postgres -W -f db/setup-local.sql
```

This creates only role sochat_dev and database sochat_dev. Existing names cause an
error; do not drop existing databases to resolve it. Set the ignored .env variable
DATABASE_URL to a PostgreSQL connection URL for role sochat_dev and database
sochat_dev on localhost:5432, percent-encoding special characters in the password.
Do not send that URL in chat or commit it. Then run `npm run db:migrate`.
Local sochat_dev connectivity and migrations were verified on PostgreSQL 18.6 on
2026-11-03; see the latest EVIDENCE entry. Owner benchmark evidence remains pending.
