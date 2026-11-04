# Verification evidence

## 2026-11-03 — Phase 0 bootstrap

Implementation commit: `a204926d4a0755f5f7cd1e0140d85c7d9173693a`
(`chore: bootstrap phase 0 workspaces and quality checks`). This evidence document
is recorded in a subsequent documentation commit.

Environment: Darwin arm64, macOS 27.0.1 (`uname -sm`, `sw_vers -productVersion`).
CPU model: NOT VERIFIED (`sysctl -n machdep.cpu.brand_string` denied by sandbox).
PostgreSQL: not installed or exercised as part of this phase.
The system Node was v26.0.0 / npm 11.12.1. Verification used an isolated temporary
Node **v22.23.4** / npm **10.9.4** installation; no system version was changed.

### Version verification

Commands actually run against the npm registry:

```sh
npm view typescript version engines --json
npm view typescript@5.9.3 version engines --json --fetch-retries=0
npm view eslint version engines --json --fetch-retries=0
npm view @eslint/js version engines --json --fetch-retries=0
npm view typescript-eslint version engines --json
npm view typescript-eslint@8.72.1 peerDependencies --json --fetch-retries=0
npm view prettier version engines --json
npm view vitest version engines --json
npm view @vitest/coverage-v8 version engines --json
npm view @types/node@22 version --json --fetch-retries=0
npm view node@22 version engines --json
npm view npm@10 version --json --fetch-retries=0
```

Selected exact pins: TypeScript 5.9.3; ESLint 10.14.0; @eslint/js 10.0.1;
typescript-eslint 8.72.1; Prettier 3.9.10; Vitest and @vitest/coverage-v8 5.1.0;
@types/node 22.20.5. The npm registry's latest TypeScript was 7.0.2, while
typescript-eslint's peer range was `>=4.8.4 <6.1.0`; the selected TypeScript pin
fits that range. ESLint 10 requires Node `^20.19.0 || ^22.13.0 || >=24`.
The initially tried ESLint 9.39.5 emitted an end-of-support warning and was replaced
with the verified maintained major before the implementation commit.

Node 22 LTS support was checked against the
[official release page](https://nodejs.org/en/about/previous-releases).
No Gemini model, Docker image or future application dependency is selected here.

```sh
git ls-remote https://github.com/actions/checkout.git refs/tags/v4.3.1
# 34e114876b0b11c390a56381ad16ebd13914f8d5 refs/tags/v4.3.1
git ls-remote https://github.com/actions/setup-node.git refs/tags/v4.4.0
# 49933ea5288caeca8642d1e84afbd3f7d6820020 refs/tags/v4.4.0
```

Those exact SHAs, with tag comments, are pinned in `.github/workflows/ci.yml`.

### Local checks

For this session, commands used this temporary toolchain PATH:

```sh
export PATH=/private/tmp/sochat-phase0-runtime/node_modules/node/bin:/private/tmp/sochat-phase0-runtime/node_modules/.bin:$PATH
node --version  # v22.23.4
npm --version   # 10.9.4
npm run lint
npm run typecheck
npm test
npm run test:coverage
```

Trimmed actual output:

```text
All matched files use Prettier code style!
tsc --noEmit: exit 0
Test Files  1 passed (1)
Tests       10 passed (10)
Statements  80% (4/5)
Branches    88.88% (8/9)
Functions   100% (1/1)
Lines       80% (4/5)
```

Coverage includes only `scripts/check-runtime.mjs`. The three workspace entry
points are empty placeholders and excluded; there is no application coverage claim.
No coverage threshold is imposed yet. The unexecuted CLI-entry call accounts for
the uncovered line in the unit coverage report; the hook ran during installation.

### Clean-clone acceptance

```sh
git clone --no-hardlinks /Users/tranphantrungkien/project/sochat /private/tmp/sochat-phase0-clone-a204926
cd /private/tmp/sochat-phase0-clone-a204926
# Use the temporary Node 22 PATH shown above, or nvm use on another machine.
npm ci && npm run lint && npm run typecheck && npm test && npm run test:coverage
```

Result: every command exited 0. `npm ci` installed 146 packages; lint and typecheck
passed; 10 tests passed with 0 failures. Coverage was 80% statements/lines, 88.88%
branches and 100% functions for the runtime guard. `git status --short` printed
nothing after the run. GitHub CI is NOT VERIFIED.

### Mutation check

Temporarily changed `Number(parts[1]) !== 22` to `Number(parts[1]) < 22` in
`scripts/check-runtime.mjs`, allowing later Node majors with minor >= 13.
The first run with nine tests survived: the newer-major fixtures both used minor 0,
so the separate minimum-minor check still rejected them. Added the Node `24.13.0`
case to test major rejection independently.

Re-ran `npm test` with the same mutation:

```text
FAIL rejects unsupported Node 24.13.0 with an actionable error
AssertionError: expected [Function] to throw an error
Tests 1 failed | 9 passed (10)
MUTATION_EXIT_CODE: 1
RESTORED: True
```

Restored the production file in a `finally` block and ran `npm test` again:
**10 passed, 0 failed**. The committed guard contains the original `!== 22` rule.

### Dependency audit

`npm audit --json` exited 1: **11 moderate**, **0 high**, **0 critical** dependency
entries, deriving from one minimatch advisory:
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
glob-pattern denial of service, affected range `<11.0.1`.
These are development-tool dependencies; no application dependencies exist yet.
The audit suggested incompatible historical downgrades, so no force fix or untested
transitive-major override was applied. This remains an explicit backlog item.

### Reference and evaluation hygiene

`cmp` confirmed all three files in `docs/agent` match the supplied Markdown files
byte for byte. `git diff --check` passed before the implementation commit.

The kit's 65 seed cases and parser rules were written by the same developer;
their reported score is **not representative** of real phrasing. No kit test,
parser evaluation, held-out case or benchmark was run in Phase 0.
Held-out runs in this project: **0**.

### NOT VERIFIED / owner tasks

- GitHub-hosted CI, branch protection and PR status: NOT VERIFIED; no push or PR
  has been made. The workflow is configured, not claimed green on GitHub.
- Docker/PostgreSQL/API/web/Gemini: future phases, not exercised here.
- TODO(owner): confirm name/license, Gemini-model preference, hosting preference
  and whether at least 50 anonymized real phrasing examples already exist.
- TODO(owner): collect at least 200 labeled examples, including at least 50 held
  out before tuning. Do not share secrets or real financial records.
- To verify on the owner's Node 22 setup: `npm ci && npm run lint && npm run typecheck && npm test`.
- When ready to verify remote CI: `git push -u origin feat/phase-0`, open a PR to
  `main`, inspect the CI check and configure branch protection if authorized.
- Phase 1 starts only after the owner's next `go`.

## 2026-11-03 — Phase 1 parser and rules evaluation

Implementation commits: `98a943c33af426b511733a1346fecec79b01eb26`
(`feat: add deterministic Vietnamese parser and rules evaluation`) and
`0624c7ece2861a269ac33601e50cbc405e8307e6`
(`fix: normalize evaluation report trailing newline`). Branch:
`feat/phase-1`, based on completed Phase 0. Reports and this evidence entry are
recorded in a subsequent documentation commit. No remote push or PR was made.

Environment rechecked: Darwin arm64, macOS 27.0.1 (`uname -sm`,
`sw_vers -productVersion`). All commands below use Node v22.23.4 and npm 10.9.4
from the isolated Phase 0 toolchain PATH. No Docker, database or real LLM was used.

### Changes and dependency verification

- `packages/parser/src/{index,types,text,amounts,dates,classify}.ts`: strict typed,
  deterministic, no-I/O parser with `parseMessage(message, nowIso): ParseResult`.
- Parser regression, baseline and property tests; 500-code-point limit, structured
  flags/questions, integer-only money and validated calendar dates.
- `eval/{evaluate,run_eval}.ts`, harness tests, unchanged seed cases and reports.
- Parser package exports TypeScript source. Root commands use Node's verified
  type stripping for evaluation; TypeScript retains `noEmit` and strict checking.
- CI now also runs dev/rules evaluation. README, `docs/PARSER.md` and
  `eval/README.md` describe the public contract and evaluation discipline.

```sh
npm view fast-check version engines --json --fetch-retries=0
# { "version": "4.10.2", "engines": { "node": ">=12.17.0" } }
npm install --save-dev --save-exact fast-check@4.10.2 --no-fund
```

fast-check is a root development dependency; the parser package has **no runtime
dependencies**. The installer still reports 11 moderate development dependency
entries from the existing audit backlog. No force fix or unrelated upgrade was applied.

### Test-first regressions

Before fixes, the reference JavaScript was copied unchanged from the ZIP into
`packages/parser/src/index.ts` so Vitest could run the new tests against its behavior.
This was a temporary baseline, not a claimed strict TypeScript port. The final
implementation was then split into explicitly typed modules and typechecked.

```sh
npm test -- packages/parser/src/regressions.test.ts
```

Initial actual result: **22 failed / 22 tests**. Cases covered:

- Above 100,000,000,000 VND, unsafe integers and a 400-digit amount that overflows
  JavaScript Number in the reference: now null and `amount_out_of_range`.
- ASCII/Unicode negative signs (including spaced signs): null and `negative_amount`.
- `0k` and `0đ`: null and `zero_amount`.
- `1.5.2tr` and `1,5,2tr`: null and `malformed_amount`, rather than a valid-looking suffix.
- More than 500 characters: no items and `message_too_long`.
- Empty, whitespace and emoji-only messages: Vietnamese clarification questions.
  The reference already returned `needs_clarification: true` without throwing for
  these inputs; those three tests failed specifically because it had no `questions` field.
- Invalid calendar dates, including `31/02` and a leap day invalidated by the
  implicit previous-year fallback: null dates and `invalid_date`.

After fixes: **22 passed / 22 tests**. The original 65 dev cases also pass unchanged.
An additional test-first review found four failures (90 passed / 94 in
`parser.test.ts`) for `1tr2345`, `35k50`, `1tr2k` and `1tr 2 người`; these were fixed
to reject malformed suffixes and avoid treating a quantity as fractional money.
No floating-point multiplication or rounding is used for money normalization.
The final whitespace check also caught an extra blank line at the end of generated
Markdown. A test reproduced it (1 failed / 24 harness tests), then the renderer was
fixed and the full clean-clone checks were repeated for commit `0624c7e...`.

### Property-based verification

`properties.test.ts` runs four properties with **seed 20261103**, **2,000 generated
cases each** (8,000 property iterations per complete test run):

1. Arbitrary Unicode messages do not throw, repeat deterministically and return
   only valid calendar dates or null.
2. Arbitrary Unicode/numeric-heavy messages yield safe positive integer amounts
   no greater than 1e11, or null (including the exported amount extractor).
3. Date-shaped inputs return valid calendar dates or null.
4. Folding preserves UTF-16 offsets relative to NFC input.

These are generated-input invariants, not a claim of real-world extraction accuracy.

### Mutation check

Temporarily changed the internal bigint cap from `100_000_000_000n` to
`1_000_000_000_000n`, then ran:

```sh
npm test -- packages/parser/src/regressions.test.ts
```

Actual trimmed output:

```text
FAIL rejects and flags 100000000001
FAIL rejects and flags 100000001k
AssertionError: expected false to be true
Tests 2 failed | 20 passed (22)
MUTATION_EXIT_CODE: 1
RESTORED: True
```

The original source was restored in a `finally` block, then the same command passed
all 22 tests. The committed cap is 100,000,000,000 VND.

### Clean-clone acceptance and coverage

```sh
git clone --no-hardlinks /Users/tranphantrungkien/project/sochat /private/tmp/sochat-phase1-clone-0624c7e
cd /private/tmp/sochat-phase1-clone-0624c7e
export PATH=/private/tmp/sochat-phase0-runtime/node_modules/node/bin:/private/tmp/sochat-phase0-runtime/node_modules/.bin:$PATH
node --version
npm --version
npm ci && npm run lint && npm run typecheck && npm test && npm run test:coverage && npm run eval -- --config rules --split dev
```

Actual trimmed output:

```text
v22.23.4
10.9.4
added 148 packages, and audited 152 packages
All matched files use Prettier code style!
tsc --noEmit: exit 0
Test Files 5 passed (5)
Tests 154 passed (154)
Statements 95.15% (314/330)
Branches   93.16% (259/278)
Functions  94.87% (37/39)
Lines      96.63% (287/297)
```

Every command exited 0. Coverage includes parser source, evaluation source and the
runtime guard, excluding test files. The empty API/web placeholders are not measured.
Parser line coverage was 100%, statement coverage 98.02%, branch coverage 95.8% and
function coverage 100%. High coverage is not proof of complete Vietnamese understanding.
CLI paths run in child processes do not all contribute to the parent coverage report.

### Dev evaluation results

The retained [JSON report](../eval/results/rules-dev.json) and
[Markdown report](../eval/results/rules-dev.md) were copied from the clean-clone run
at the generation time recorded in their metadata. They identify source commit `0624c7e...`,
`working_tree_dirty: false`, config `rules` and split `dev`.

The seed file was byte-compared with `kit/eval/seed_cases.jsonl` from the ZIP:
**identical**, SHA-256
`525fbdfaac8e80d3470aa43203f41c01fe2eee829d638e12df401a11a8122839`.
All 65 rows are dev; no held-out dataset was added or evaluated.

| Metric                  | Correct / total | Result |
| ----------------------- | --------------- | ------ |
| Exact case              | 65 / 65         | 100%   |
| Amount                  | 70 / 70         | 100%   |
| Category                | 70 / 70         | 100%   |
| Date                    | 70 / 70         | 100%   |
| Type                    | 70 / 70         | 100%   |
| Clarification precision | 5 / 5           | 100%   |
| Clarification recall    | 5 / 5           | 100%   |

Clarification counts: TP=5, FP=0, FN=0, TN=60. Failures: 0.
The per-field denominator counts max(expected items, predicted items), aligned by
order, penalizing both missing and extra items. Undefined ratios are null/n/a.
Harness tests verify metric arithmetic, bad labels/options, failure exit status and
both report formats using synthetic dev fixtures.

**The supplied seed set was written by the developer who wrote the reference rules.
Its 100% result is not representative of real users.** No accuracy claim is made
for owner-collected messages. Held-out runs this phase: **0**. Cumulative held-out
runs in the project: **0**. Split-option tests only inspect arguments and skip a
dummy unreadable held-out row; they never evaluate held-out examples.

### Local secret handling

A key was found in a concurrent edit to the tracked `.env.example` and appeared in
an inspection tool's diff output. It was preserved in ignored `.env` with file mode
0600, and the example was restored to a blank key. No key is in the Phase 1 commits,
reports or this document; no real API call was made. The owner should revoke/replace
that key because it appeared in tool output. `.env` remains local and is not loaded
by the parser, tests or evaluation command.

### NOT VERIFIED / risks / owner tasks

- GitHub-hosted CI and branch protection: **NOT VERIFIED**. The workflow was updated;
  the equivalent local commands pass, but there is no remote run URL or PR claim.
- Real-world accuracy, held-out accuracy, LLM behavior, database performance and
  application features are **NOT VERIFIED** and belong to later phases.
- Keyword categories, number words, conflicting natural-language dates and trailing
  non-money clauses retain baseline limitations described in `docs/PARSER.md`.
- TODO(owner): collect/label at least 200 anonymized phrasing examples, including at
  least 50 held out before tuning. Keep real financial records and secrets out of the dataset.
- Owner verification command: `npm ci && npm run lint && npm run typecheck && npm test`;
  then `npm run eval -- --config rules --split dev` to reproduce the dev report.
- No held-out command is requested now. Only run it on the owner's explicit request,
  then record the command/results and increment the cumulative run count.
- Existing license/model/hosting questions remain open in `docs/BACKLOG.md`.
- Stop at the Phase 1 gate. Phase 2 requires the owner's next `go`.

## 2026-11-03 — Phase 2 persistence (owner acceptance pending)

Implementation commit: `c7c421b816a04339d2d6e5cfc3f0d24493c11341` on
`feat/phase-2`. Node 22.23.4 / npm 10.9.4, Darwin arm64. Docker Desktop was started
for disposable integration containers; existing local databases were not modified.

The owner explicitly requested moving from PostgreSQL 16 to the installed local
PostgreSQL 18. The charter and active agent instructions were updated accordingly;
ADR-010 supersedes the earlier baseline decisions. Existing reference snippets and
historical evidence remain reference material. The official image tag
`postgres:18.6-bookworm` was checked on https://hub.docker.com/_/postgres and then
successfully exercised by Testcontainers. A baseline upgrade is not a speed claim.

### Files and design

- SQL migrations 001/002, pg migration runner with advisory lock, transaction,
  checksum verification and ordering checks; rollback/checksum behavior tested.
- Aggregate repositories: users, categories, transactions, budgets, goals and
  contributions, reports and cache. All runtime query values are parameterized.
  Trusted migration SQL and catalog table identifiers are the explicit exceptions;
  catalog identifiers are validated before quoting in the deletion test.
- Cache now has user ownership and cascades on account deletion. Contributions have
  a composite foreign key binding goal and owner. Private category references are
  checked by repository SQL. Full authentication/endpoints remain Phase 4 work.
- Fixed-seed benchmark (20261103), dedicated disposable container, no destructive
  local database reset, timing samples and EXPLAIN ANALYZE BUFFERS JSON output.
- Local role/database provisioning script and instructions. No monthly rollup.

### Dependency verification

Commands: `npm view pg version engines --json --fetch-retries=0`,
`npm view @types/pg version --json --fetch-retries=0`, and
`npm view @testcontainers/postgresql version engines --json --fetch-retries=0`.
Selected versions: pg 8.23.1 (Node >=16), @types/pg 8.23.1, PostgreSQL Testcontainers
12.2.1. Exact versions installed; lockfile retained. Installation reported 18 moderate
vulnerability entries and an upstream glob deprecation; these are not claimed fixed.

### Commands and actual results

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration -- --coverage
bash -n db/bench.sh
```

Lint, strict typecheck and shell syntax checks exited 0. Existing unit suite:
**154 passed, 0 failed**. Final PostgreSQL 18 integration suite: **13 passed, 0 failed**.
Coverage for database TypeScript (migration runner and repositories), excluding
integration-test source: lines **86.66% (52/60)**, statements **85.93% (55/64)**,
branches **70.58% (12/17)**, functions **100% (30/30)**. CLI-only migration paths are
not fully covered. This is not coverage for all future API behavior.

Integration assertions cover empty-database migrations/repeat execution, failed
batch rollback, modified migration rejection, amount CHECKs (zero, negative, >1e11,
inclusive maximum), first-of-month budgets, category uniqueness including NULL
system ownership, cross-owner contributions, id-based mutation/read isolation,
private-category references, list/cache/budget isolation, dynamic zero-residue
account deletion across every table with user_id, and hand-computed month/year totals.
Daily output is checked for expected row count; broader daily-series fixtures can
be added with the reporting API.

The initial PostgreSQL 16 suite had 12 setup failures because TRUNCATE users CASCADE
also removed system categories. Cleanup was corrected to DELETE users, preserving
shared categories. Then all 12 passed on 16 and on 18; the additional migration
rollback/checksum test brought the final 18 suite to 13 passing tests.

### Mutation check (PostgreSQL 18)

Temporarily changed the transaction CHECK from `amount_vnd > 0` to `amount_vnd >= 0`,
then ran `npm run test:integration` against a fresh container:

```text
FAIL rejects invalid money 0n
AssertionError: promise resolved "{ id: '1' }" instead of rejecting
Tests 1 failed | 12 passed (13)
MUTATION_EXIT_CODE: 1
RESTORED: True
```

Restored the migration in a finally block. Re-run with coverage: **13 passed**.
No mutated migration was committed.

### Local PostgreSQL and owner tasks

`/Library/PostgreSQL/18/bin/psql` exists. The elevated check
`/Library/PostgreSQL/18/bin/pg_isready -h localhost` reported accepting connections
on localhost:5432. An administrator connection using `psql -w -h localhost -U
postgres -d postgres` failed with `fe_sendauth: no password supplied`. No password
was guessed or requested in chat. Authenticated local server version, provisioning
and local migration are **NOT VERIFIED** pending the owner's local configuration.

Owner chose SQL setup instructions. Run from the project directory:

```sh
/Library/PostgreSQL/18/bin/psql -h localhost -U postgres -d postgres -W -f db/setup-local.sql
```

The script prompts for passwords locally and creates only sochat_dev role/database;
existing names cause a safe stop. Fill DATABASE_URL in ignored .env, preserving other
local secrets. Do not paste the connection URL in chat. Then run `npm run db:migrate`
or tell the agent the local configuration is ready so it can run that command.

Owner-only benchmark command (not run by the agent):

```sh
ROWS=1000000 RUNS=11 ./db/bench.sh > /tmp/sochat-benchmark.log
```

Share `db/results/benchmark.json` with host CPU/OS/Docker memory allocation and
source revision. The report contains p50/p95 and EXPLAIN ANALYZE BUFFERS plans for
baseline/btree/covering scenarios. Benchmark runtime and million-row seed execution
remain **NOT VERIFIED**; bash syntax and TypeScript checks alone do not verify them.

| Scenario | Month       | Daily       | Year        | Plans       |
| -------- | ----------- | ----------- | ----------- | ----------- |
| Baseline | TODO(owner) | TODO(owner) | TODO(owner) | TODO(owner) |
| Btree    | TODO(owner) | TODO(owner) | TODO(owner) | TODO(owner) |
| Covering | TODO(owner) | TODO(owner) | TODO(owner) | TODO(owner) |

ADR-006 defers rollup until owner evidence or an explicit request. No benchmark
numbers were copied from the kit. Remote CI/PR and clean-clone installation of this
phase are **NOT VERIFIED**. CI includes the integration command; no remote green
claim is made. Held-out runs remain 0. No LLM call was made.

Phase 2 implementation is available, but its gate is **pending**, especially the
owner benchmark evidence and local provisioning. Do not advance automatically to
Phase 3 or claim full Phase 2 acceptance.

## 2026-11-03 — Owner local-setup completion audit

Source: Phase 2 implementation c7c421b; previous evidence 547096c. Owner asked to
check readiness for the Phase 2 gate. No benchmark was executed by the agent.

- A local-only inspection found a duplicated DATABASE_URL assignment prefix in
  ignored .env. Removed only the extra prefix, preserved the other variables and
  file permissions 0600, and never displayed the connection URL/password.
- Connection through pg using `node --env-file=.env --input-type=module` succeeded.
  `SELECT version(),current_database(),current_user` returned PostgreSQL **18.6**
  on aarch64-apple-darwin24.6.0, database **sochat_dev**, role **sochat_dev**.
- schema_migrations was initially absent (42P01). Verified public had zero tables
  before applying migrate(pool) through the checked-in runner. Migration succeeded:
  001_schema.sql and 002_reporting_indexes.sql. Tables: users, categories,
  transactions, budgets, goals, goal_contributions, llm_cache, schema_migrations.
  No unrelated database or existing table was changed.
- Re-ran `npm run lint && npm run typecheck && npm test`: all exited 0; **154 unit
  tests passed**. `npm run test:integration`: **13 passed** on isolated PostgreSQL 18.
- The real local database is now verified; the prior pending-credentials and
  pending-local-migration status is superseded by this entry.
- Neither db/results/benchmark.json nor /tmp/sochat-benchmark.log existed at audit
  time. No benchmark figures/plans can yet be accepted or recorded. The Phase 2
  benchmark table above remains TODO(owner); its gate is still pending that evidence.

Owner next command (Node 22, dependencies installed, Docker Desktop running):

```sh
ROWS=1000000 RUNS=11 ./db/bench.sh > /tmp/sochat-benchmark.log 2>&1
```

This benchmark uses a disposable PostgreSQL 18 container, not sochat_dev. Once it
finishes, the agent can inspect db/results/benchmark.json and record actual timings
and plans, with host/Docker environment details. Remote CI remains NOT VERIFIED;
no held-out evaluation or Gemini call occurred.

Post-migration verification: `npm run db:migrate` exited 0 on the existing local
schema (checksum/idempotency check); `git check-ignore .env` returned `.env`.

## 2026-11-03 — Owner benchmark accepted; Phase 2 gate ready

Owner reported completing the benchmark. The agent inspected the resulting JSON
and matching log without rerunning the benchmark. This entry supersedes the earlier
pending benchmark status and, together with the preceding local-setup audit,
completes Phase 2's implementation acceptance requirements. Await owner go for Phase 3.

Owner command previously supplied:

```sh
ROWS=1000000 RUNS=11 ./db/bench.sh > /tmp/sochat-benchmark.log 2>&1
```

Retained artifact: [benchmark.json](../db/results/benchmark.json). The JSON and
/tmp/sochat-benchmark.log are byte-identical. SHA-256:
`81fdf8b2216ab6882731b170fff63393dbf904b8d8fcf293b10cfc5ccc1d3ade`.

Generated at 2026-11-03T02:14:25.512Z (09:14:25, 3 November 2026 in Vietnam).
Requested/seeded workload: 1,000,000 transactions, 1,000 synthetic users, seed
20261103, 11 measured runs for each of nine query/scenario combinations, one warm-up
excluded per combination. The script completed its generate_series insertion;
actual row count is not separately recorded in this report and the disposable
container has already been removed. No independent post-run count is claimed.

Database version reported by the run:

```text
PostgreSQL 18.6 (Debian 18.6-1.pgdg12+2) on aarch64-unknown-linux-gnu, compiled by gcc (Debian 12.2.0-14+deb12u1) 12.2.0, 64-bit
```

Host audit: Apple M2, Darwin arm64, macOS 27.0.1. Current Docker allocation observed
at audit: 8 CPUs, 8,319,770,624 bytes RAM; Docker Engine 29.9.2. Commands:
`uname -sm`, `sw_vers -productVersion`, `sysctl -n machdep.cpu.brand_string`,
`docker info --format '{{json .MemTotal}} {{json .NCPU}} {{json .ServerVersion}}'`.
These resource settings were observed after the run, not embedded in its metadata.

Source checkout at audit: `c1bf776230367500b53519030acf17101062d502` (implementation
c7c421b). git diff confirmed benchmark script, seed and migration files unchanged.
The report does not embed a source commit or source hash; this association is
reconstructed from the checkout and cannot independently prove the exact code
used by the earlier process.

### Validation and measured results

Python validation checked exactly nine unique scenario/query combinations, all 99
samples finite and nonnegative, 11 per combination, and recomputed every median
and nearest-rank p95 from raw samples. Every check passed. With only 11 samples,
nearest-rank p95 is the maximum observed sample; tails remain weakly estimated.

| Scenario | Query | p50 ms | p95 ms | Scan in retained plan           |
| -------- | ----- | ------ | ------ | ------------------------------- |
| baseline | month | 20.954 | 22.738 | Seq Scan (parallel)             |
| baseline | daily | 22.761 | 24.036 | Seq Scan (parallel)             |
| baseline | year  | 23.291 | 24.717 | Seq Scan (parallel)             |
| btree    | month | 0.026  | 0.034  | Bitmap Heap / Index Scan        |
| btree    | daily | 0.023  | 0.031  | Bitmap Heap / Index Scan        |
| btree    | year  | 0.161  | 0.185  | Bitmap Heap / Index Scan        |
| covering | month | 0.013  | 0.025  | Index Only Scan; heap fetches 0 |
| covering | daily | 0.012  | 0.021  | Index Only Scan; heap fetches 0 |
| covering | year  | 0.092  | 0.139  | Index Only Scan; heap fetches 0 |

Month/daily filter October 2026 expenses; year groups both income and expense over 2026. All target synthetic user 500, which owns about 1,000 of the million rows.
The retained month/daily index plans read 25 candidate entries, retain 23 expenses;
the year plan reads 271 candidate entries. Thus these are selective per-user reports,
not whole-population aggregation timings. Times are PostgreSQL EXPLAIN execution
milliseconds, excluding client/network, connection setup, authentication and API
serialization. The workload is synthetic, sequential and warmed; retained plans
show shared-buffer hits with zero reads. No concurrent-write, cold-cache or remote
hosting performance claim follows from this experiment.

ADR-006 now retains the covering index and defers rollup. No rollup migration or
benchmark was added, and no unmeasured rollup comparison is claimed.

### Retained EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)

Each block below is the final measured plan for that query/scenario. Its execution
time may differ from the median because it is the last run, not the median run.
Complete timing samples are retained in the linked JSON artifact.

<details>
<summary>baseline / month</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Sorted",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 21679.55,
    "Total Cost": 21682.84,
    "Plan Rows": 11,
    "Plan Width": 40,
    "Actual Startup Time": 18.929,
    "Actual Total Time": 20.807,
    "Actual Rows": 8,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": ["category_id"],
    "Shared Hit Blocks": 12422,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Gather Merge",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 21679.55,
        "Total Cost": 21682.58,
        "Plan Rows": 26,
        "Plan Width": 16,
        "Actual Startup Time": 18.923,
        "Actual Total Time": 20.799,
        "Actual Rows": 23,
        "Actual Loops": 1,
        "Disabled": false,
        "Workers Planned": 2,
        "Workers Launched": 2,
        "Shared Hit Blocks": 12422,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Sort",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Startup Cost": 20679.52,
            "Total Cost": 20679.55,
            "Plan Rows": 11,
            "Plan Width": 16,
            "Actual Startup Time": 12.346,
            "Actual Total Time": 12.347,
            "Actual Rows": 7.67,
            "Actual Loops": 3,
            "Disabled": false,
            "Sort Key": ["category_id"],
            "Sort Method": "quicksort",
            "Sort Space Used": 25,
            "Sort Space Type": "Memory",
            "Shared Hit Blocks": 12422,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0,
            "Workers": [
              {
                "Worker Number": 0,
                "Sort Method": "quicksort",
                "Sort Space Used": 25,
                "Sort Space Type": "Memory"
              },
              {
                "Worker Number": 1,
                "Sort Method": "quicksort",
                "Sort Space Used": 25,
                "Sort Space Type": "Memory"
              }
            ],
            "Plans": [
              {
                "Node Type": "Seq Scan",
                "Parent Relationship": "Outer",
                "Parallel Aware": true,
                "Async Capable": false,
                "Relation Name": "transactions",
                "Alias": "transactions",
                "Startup Cost": 0,
                "Total Cost": 20679.33,
                "Plan Rows": 11,
                "Plan Width": 16,
                "Actual Startup Time": 1.342,
                "Actual Total Time": 12.318,
                "Actual Rows": 7.67,
                "Actual Loops": 3,
                "Disabled": false,
                "Filter": "((occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date) AND (user_id = '500'::bigint) AND (type = 'expense'::txn_type))",
                "Rows Removed by Filter": 333326,
                "Shared Hit Blocks": 12346,
                "Shared Read Blocks": 0,
                "Shared Dirtied Blocks": 0,
                "Shared Written Blocks": 0,
                "Local Hit Blocks": 0,
                "Local Read Blocks": 0,
                "Local Dirtied Blocks": 0,
                "Local Written Blocks": 0,
                "Temp Read Blocks": 0,
                "Temp Written Blocks": 0,
                "Workers": []
              }
            ]
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.065,
  "Triggers": [],
  "Execution Time": 20.821
}
```

</details>

<details>
<summary>baseline / daily</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Sorted",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 21679.55,
    "Total Cost": 21683.03,
    "Plan Rows": 26,
    "Plan Width": 36,
    "Actual Startup Time": 19.67,
    "Actual Total Time": 21.769,
    "Actual Rows": 16,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": ["occurred_on"],
    "Shared Hit Blocks": 12422,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Gather Merge",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 21679.55,
        "Total Cost": 21682.58,
        "Plan Rows": 26,
        "Plan Width": 12,
        "Actual Startup Time": 19.66,
        "Actual Total Time": 21.752,
        "Actual Rows": 23,
        "Actual Loops": 1,
        "Disabled": false,
        "Workers Planned": 2,
        "Workers Launched": 2,
        "Shared Hit Blocks": 12422,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Sort",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Startup Cost": 20679.52,
            "Total Cost": 20679.55,
            "Plan Rows": 11,
            "Plan Width": 12,
            "Actual Startup Time": 12.869,
            "Actual Total Time": 12.87,
            "Actual Rows": 7.67,
            "Actual Loops": 3,
            "Disabled": false,
            "Sort Key": ["occurred_on"],
            "Sort Method": "quicksort",
            "Sort Space Used": 25,
            "Sort Space Type": "Memory",
            "Shared Hit Blocks": 12422,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0,
            "Workers": [
              {
                "Worker Number": 0,
                "Sort Method": "quicksort",
                "Sort Space Used": 25,
                "Sort Space Type": "Memory"
              },
              {
                "Worker Number": 1,
                "Sort Method": "quicksort",
                "Sort Space Used": 25,
                "Sort Space Type": "Memory"
              }
            ],
            "Plans": [
              {
                "Node Type": "Seq Scan",
                "Parent Relationship": "Outer",
                "Parallel Aware": true,
                "Async Capable": false,
                "Relation Name": "transactions",
                "Alias": "transactions",
                "Startup Cost": 0,
                "Total Cost": 20679.33,
                "Plan Rows": 11,
                "Plan Width": 12,
                "Actual Startup Time": 2.628,
                "Actual Total Time": 12.841,
                "Actual Rows": 7.67,
                "Actual Loops": 3,
                "Disabled": false,
                "Filter": "((occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date) AND (user_id = '500'::bigint) AND (type = 'expense'::txn_type))",
                "Rows Removed by Filter": 333326,
                "Shared Hit Blocks": 12346,
                "Shared Read Blocks": 0,
                "Shared Dirtied Blocks": 0,
                "Shared Written Blocks": 0,
                "Local Hit Blocks": 0,
                "Local Read Blocks": 0,
                "Local Dirtied Blocks": 0,
                "Local Written Blocks": 0,
                "Temp Read Blocks": 0,
                "Temp Written Blocks": 0,
                "Workers": []
              }
            ]
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.046,
  "Triggers": [],
  "Execution Time": 21.784
}
```

</details>

<details>
<summary>baseline / year</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Sorted",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 20642.48,
    "Total Cost": 20683.31,
    "Plan Rows": 272,
    "Plan Width": 44,
    "Actual Startup Time": 21.107,
    "Actual Total Time": 23.014,
    "Actual Rows": 19,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": [
      "(date_trunc('month'::text, (occurred_on)::timestamp with time zone))",
      "type"
    ],
    "Shared Hit Blocks": 12438,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Gather Merge",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 20642.48,
        "Total Cost": 20676.37,
        "Plan Rows": 291,
        "Plan Width": 20,
        "Actual Startup Time": 21.084,
        "Actual Total Time": 22.991,
        "Actual Rows": 271,
        "Actual Loops": 1,
        "Disabled": false,
        "Workers Planned": 2,
        "Workers Launched": 2,
        "Shared Hit Blocks": 12438,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Sort",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Startup Cost": 19642.46,
            "Total Cost": 19642.76,
            "Plan Rows": 121,
            "Plan Width": 20,
            "Actual Startup Time": 14.414,
            "Actual Total Time": 14.418,
            "Actual Rows": 90.33,
            "Actual Loops": 3,
            "Disabled": false,
            "Sort Key": [
              "(date_trunc('month'::text, (occurred_on)::timestamp with time zone))",
              "type"
            ],
            "Sort Method": "quicksort",
            "Sort Space Used": 30,
            "Sort Space Type": "Memory",
            "Shared Hit Blocks": 12438,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0,
            "Workers": [
              {
                "Worker Number": 0,
                "Sort Method": "quicksort",
                "Sort Space Used": 27,
                "Sort Space Type": "Memory"
              },
              {
                "Worker Number": 1,
                "Sort Method": "quicksort",
                "Sort Space Used": 27,
                "Sort Space Type": "Memory"
              }
            ],
            "Plans": [
              {
                "Node Type": "Seq Scan",
                "Parent Relationship": "Outer",
                "Parallel Aware": true,
                "Async Capable": false,
                "Relation Name": "transactions",
                "Alias": "transactions",
                "Startup Cost": 0,
                "Total Cost": 19638.27,
                "Plan Rows": 121,
                "Plan Width": 20,
                "Actual Startup Time": 0.207,
                "Actual Total Time": 14.37,
                "Actual Rows": 90.33,
                "Actual Loops": 3,
                "Disabled": false,
                "Filter": "((occurred_on >= '2026-01-01'::date) AND (occurred_on < '2027-01-01'::date) AND (user_id = '500'::bigint))",
                "Rows Removed by Filter": 333243,
                "Shared Hit Blocks": 12346,
                "Shared Read Blocks": 0,
                "Shared Dirtied Blocks": 0,
                "Shared Written Blocks": 0,
                "Local Hit Blocks": 0,
                "Local Read Blocks": 0,
                "Local Dirtied Blocks": 0,
                "Local Written Blocks": 0,
                "Temp Read Blocks": 0,
                "Temp Written Blocks": 0,
                "Workers": []
              }
            ]
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.055,
  "Triggers": [],
  "Execution Time": 23.029
}
```

</details>

<details>
<summary>btree / month</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Sorted",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 117.77,
    "Total Cost": 118.1,
    "Plan Rows": 11,
    "Plan Width": 40,
    "Actual Startup Time": 0.014,
    "Actual Total Time": 0.017,
    "Actual Rows": 8,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": ["category_id"],
    "Shared Hit Blocks": 28,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Sort",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 117.77,
        "Total Cost": 117.83,
        "Plan Rows": 26,
        "Plan Width": 16,
        "Actual Startup Time": 0.014,
        "Actual Total Time": 0.014,
        "Actual Rows": 23,
        "Actual Loops": 1,
        "Disabled": false,
        "Sort Key": ["category_id"],
        "Sort Method": "quicksort",
        "Sort Space Used": 25,
        "Sort Space Type": "Memory",
        "Shared Hit Blocks": 28,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Bitmap Heap Scan",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Relation Name": "transactions",
            "Alias": "transactions",
            "Startup Cost": 4.79,
            "Total Cost": 117.16,
            "Plan Rows": 26,
            "Plan Width": 16,
            "Actual Startup Time": 0.004,
            "Actual Total Time": 0.011,
            "Actual Rows": 23,
            "Actual Loops": 1,
            "Disabled": false,
            "Recheck Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date))",
            "Rows Removed by Index Recheck": 0,
            "Filter": "(type = 'expense'::txn_type)",
            "Rows Removed by Filter": 2,
            "Exact Heap Blocks": 25,
            "Lossy Heap Blocks": 0,
            "Shared Hit Blocks": 28,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0,
            "Plans": [
              {
                "Node Type": "Bitmap Index Scan",
                "Parent Relationship": "Outer",
                "Parallel Aware": false,
                "Async Capable": false,
                "Index Name": "bench_btree",
                "Startup Cost": 0,
                "Total Cost": 4.79,
                "Plan Rows": 29,
                "Plan Width": 0,
                "Actual Startup Time": 0.002,
                "Actual Total Time": 0.002,
                "Actual Rows": 25,
                "Actual Loops": 1,
                "Disabled": false,
                "Index Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date))",
                "Index Searches": 1,
                "Shared Hit Blocks": 3,
                "Shared Read Blocks": 0,
                "Shared Dirtied Blocks": 0,
                "Shared Written Blocks": 0,
                "Local Hit Blocks": 0,
                "Local Read Blocks": 0,
                "Local Dirtied Blocks": 0,
                "Local Written Blocks": 0,
                "Temp Read Blocks": 0,
                "Temp Written Blocks": 0
              }
            ]
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.016,
  "Triggers": [],
  "Execution Time": 0.021
}
```

</details>

<details>
<summary>btree / daily</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Sorted",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 117.77,
    "Total Cost": 118.29,
    "Plan Rows": 26,
    "Plan Width": 36,
    "Actual Startup Time": 0.02,
    "Actual Total Time": 0.025,
    "Actual Rows": 16,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": ["occurred_on"],
    "Shared Hit Blocks": 28,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Sort",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 117.77,
        "Total Cost": 117.83,
        "Plan Rows": 26,
        "Plan Width": 12,
        "Actual Startup Time": 0.019,
        "Actual Total Time": 0.02,
        "Actual Rows": 23,
        "Actual Loops": 1,
        "Disabled": false,
        "Sort Key": ["occurred_on"],
        "Sort Method": "quicksort",
        "Sort Space Used": 25,
        "Sort Space Type": "Memory",
        "Shared Hit Blocks": 28,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Bitmap Heap Scan",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Relation Name": "transactions",
            "Alias": "transactions",
            "Startup Cost": 4.79,
            "Total Cost": 117.16,
            "Plan Rows": 26,
            "Plan Width": 12,
            "Actual Startup Time": 0.007,
            "Actual Total Time": 0.016,
            "Actual Rows": 23,
            "Actual Loops": 1,
            "Disabled": false,
            "Recheck Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date))",
            "Rows Removed by Index Recheck": 0,
            "Filter": "(type = 'expense'::txn_type)",
            "Rows Removed by Filter": 2,
            "Exact Heap Blocks": 25,
            "Lossy Heap Blocks": 0,
            "Shared Hit Blocks": 28,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0,
            "Plans": [
              {
                "Node Type": "Bitmap Index Scan",
                "Parent Relationship": "Outer",
                "Parallel Aware": false,
                "Async Capable": false,
                "Index Name": "bench_btree",
                "Startup Cost": 0,
                "Total Cost": 4.79,
                "Plan Rows": 29,
                "Plan Width": 0,
                "Actual Startup Time": 0.003,
                "Actual Total Time": 0.003,
                "Actual Rows": 25,
                "Actual Loops": 1,
                "Disabled": false,
                "Index Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date))",
                "Index Searches": 1,
                "Shared Hit Blocks": 3,
                "Shared Read Blocks": 0,
                "Shared Dirtied Blocks": 0,
                "Shared Written Blocks": 0,
                "Local Hit Blocks": 0,
                "Local Read Blocks": 0,
                "Local Dirtied Blocks": 0,
                "Local Written Blocks": 0,
                "Temp Read Blocks": 0,
                "Temp Written Blocks": 0
              }
            ]
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.025,
  "Triggers": [],
  "Execution Time": 0.031
}
```

</details>

<details>
<summary>btree / year</summary>

```json
{
  "Plan": {
    "Node Type": "Sort",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 1045.82,
    "Total Cost": 1046.49,
    "Plan Rows": 270,
    "Plan Width": 44,
    "Actual Startup Time": 0.143,
    "Actual Total Time": 0.144,
    "Actual Rows": 19,
    "Actual Loops": 1,
    "Disabled": false,
    "Sort Key": [
      "(date_trunc('month'::text, (occurred_on)::timestamp with time zone))",
      "type"
    ],
    "Sort Method": "quicksort",
    "Sort Space Used": 25,
    "Sort Space Type": "Memory",
    "Shared Hit Blocks": 275,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Aggregate",
        "Strategy": "Hashed",
        "Partial Mode": "Simple",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 1030.19,
        "Total Cost": 1034.92,
        "Plan Rows": 270,
        "Plan Width": 44,
        "Actual Startup Time": 0.138,
        "Actual Total Time": 0.141,
        "Actual Rows": 19,
        "Actual Loops": 1,
        "Disabled": false,
        "Group Key": [
          "date_trunc('month'::text, (occurred_on)::timestamp with time zone)",
          "type"
        ],
        "Planned Partitions": 0,
        "HashAgg Batches": 1,
        "Peak Memory Usage": 48,
        "Disk Usage": 0,
        "Shared Hit Blocks": 275,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Bitmap Heap Scan",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Relation Name": "transactions",
            "Alias": "transactions",
            "Startup Cost": 8.11,
            "Total Cost": 1028.02,
            "Plan Rows": 289,
            "Plan Width": 20,
            "Actual Startup Time": 0.023,
            "Actual Total Time": 0.114,
            "Actual Rows": 271,
            "Actual Loops": 1,
            "Disabled": false,
            "Recheck Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-01-01'::date) AND (occurred_on < '2027-01-01'::date))",
            "Rows Removed by Index Recheck": 0,
            "Exact Heap Blocks": 271,
            "Lossy Heap Blocks": 0,
            "Shared Hit Blocks": 275,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0,
            "Plans": [
              {
                "Node Type": "Bitmap Index Scan",
                "Parent Relationship": "Outer",
                "Parallel Aware": false,
                "Async Capable": false,
                "Index Name": "bench_btree",
                "Startup Cost": 0,
                "Total Cost": 8.04,
                "Plan Rows": 289,
                "Plan Width": 0,
                "Actual Startup Time": 0.011,
                "Actual Total Time": 0.011,
                "Actual Rows": 271,
                "Actual Loops": 1,
                "Disabled": false,
                "Index Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-01-01'::date) AND (occurred_on < '2027-01-01'::date))",
                "Index Searches": 1,
                "Shared Hit Blocks": 4,
                "Shared Read Blocks": 0,
                "Shared Dirtied Blocks": 0,
                "Shared Written Blocks": 0,
                "Local Hit Blocks": 0,
                "Local Read Blocks": 0,
                "Local Dirtied Blocks": 0,
                "Local Written Blocks": 0,
                "Temp Read Blocks": 0,
                "Temp Written Blocks": 0
              }
            ]
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.017,
  "Triggers": [],
  "Execution Time": 0.149
}
```

</details>

<details>
<summary>covering / month</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Hashed",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 5.28,
    "Total Cost": 5.42,
    "Plan Rows": 11,
    "Plan Width": 40,
    "Actual Startup Time": 0.011,
    "Actual Total Time": 0.012,
    "Actual Rows": 8,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": ["category_id"],
    "Planned Partitions": 0,
    "HashAgg Batches": 1,
    "Peak Memory Usage": 32,
    "Disk Usage": 0,
    "Shared Hit Blocks": 4,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Index Only Scan",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Scan Direction": "Forward",
        "Index Name": "transactions_user_date_cover_idx",
        "Relation Name": "transactions",
        "Alias": "transactions",
        "Startup Cost": 0.42,
        "Total Cost": 5.15,
        "Plan Rows": 27,
        "Plan Width": 16,
        "Actual Startup Time": 0.004,
        "Actual Total Time": 0.006,
        "Actual Rows": 23,
        "Actual Loops": 1,
        "Disabled": false,
        "Index Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date))",
        "Rows Removed by Index Recheck": 0,
        "Filter": "(type = 'expense'::txn_type)",
        "Rows Removed by Filter": 2,
        "Heap Fetches": 0,
        "Index Searches": 1,
        "Shared Hit Blocks": 4,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.031,
  "Triggers": [],
  "Execution Time": 0.02
}
```

</details>

<details>
<summary>covering / daily</summary>

```json
{
  "Plan": {
    "Node Type": "Aggregate",
    "Strategy": "Sorted",
    "Partial Mode": "Simple",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 0.42,
    "Total Cost": 5.62,
    "Plan Rows": 27,
    "Plan Width": 36,
    "Actual Startup Time": 0.008,
    "Actual Total Time": 0.013,
    "Actual Rows": 16,
    "Actual Loops": 1,
    "Disabled": false,
    "Group Key": ["occurred_on"],
    "Shared Hit Blocks": 4,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Index Only Scan",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Scan Direction": "Backward",
        "Index Name": "transactions_user_date_cover_idx",
        "Relation Name": "transactions",
        "Alias": "transactions",
        "Startup Cost": 0.42,
        "Total Cost": 5.15,
        "Plan Rows": 27,
        "Plan Width": 12,
        "Actual Startup Time": 0.006,
        "Actual Total Time": 0.008,
        "Actual Rows": 23,
        "Actual Loops": 1,
        "Disabled": false,
        "Index Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-10-01'::date) AND (occurred_on < '2026-11-01'::date))",
        "Rows Removed by Index Recheck": 0,
        "Filter": "(type = 'expense'::txn_type)",
        "Rows Removed by Filter": 2,
        "Heap Fetches": 0,
        "Index Searches": 1,
        "Shared Hit Blocks": 4,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.035,
  "Triggers": [],
  "Execution Time": 0.021
}
```

</details>

<details>
<summary>covering / year</summary>

```json
{
  "Plan": {
    "Node Type": "Sort",
    "Parallel Aware": false,
    "Async Capable": false,
    "Startup Cost": 34.5,
    "Total Cost": 35.19,
    "Plan Rows": 273,
    "Plan Width": 44,
    "Actual Startup Time": 0.083,
    "Actual Total Time": 0.084,
    "Actual Rows": 19,
    "Actual Loops": 1,
    "Disabled": false,
    "Sort Key": [
      "(date_trunc('month'::text, (occurred_on)::timestamp with time zone))",
      "type"
    ],
    "Sort Method": "quicksort",
    "Sort Space Used": 25,
    "Sort Space Type": "Memory",
    "Shared Hit Blocks": 5,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0,
    "Plans": [
      {
        "Node Type": "Aggregate",
        "Strategy": "Hashed",
        "Partial Mode": "Simple",
        "Parent Relationship": "Outer",
        "Parallel Aware": false,
        "Async Capable": false,
        "Startup Cost": 18.68,
        "Total Cost": 23.46,
        "Plan Rows": 273,
        "Plan Width": 44,
        "Actual Startup Time": 0.077,
        "Actual Total Time": 0.08,
        "Actual Rows": 19,
        "Actual Loops": 1,
        "Disabled": false,
        "Group Key": [
          "date_trunc('month'::text, (occurred_on)::timestamp with time zone)",
          "type"
        ],
        "Planned Partitions": 0,
        "HashAgg Batches": 1,
        "Peak Memory Usage": 48,
        "Disk Usage": 0,
        "Shared Hit Blocks": 5,
        "Shared Read Blocks": 0,
        "Shared Dirtied Blocks": 0,
        "Shared Written Blocks": 0,
        "Local Hit Blocks": 0,
        "Local Read Blocks": 0,
        "Local Dirtied Blocks": 0,
        "Local Written Blocks": 0,
        "Temp Read Blocks": 0,
        "Temp Written Blocks": 0,
        "Plans": [
          {
            "Node Type": "Index Only Scan",
            "Parent Relationship": "Outer",
            "Parallel Aware": false,
            "Async Capable": false,
            "Scan Direction": "Forward",
            "Index Name": "transactions_user_date_cover_idx",
            "Relation Name": "transactions",
            "Alias": "transactions",
            "Startup Cost": 0.42,
            "Total Cost": 16.48,
            "Plan Rows": 293,
            "Plan Width": 20,
            "Actual Startup Time": 0.008,
            "Actual Total Time": 0.048,
            "Actual Rows": 271,
            "Actual Loops": 1,
            "Disabled": false,
            "Index Cond": "((user_id = '500'::bigint) AND (occurred_on >= '2026-01-01'::date) AND (occurred_on < '2027-01-01'::date))",
            "Rows Removed by Index Recheck": 0,
            "Heap Fetches": 0,
            "Index Searches": 1,
            "Shared Hit Blocks": 5,
            "Shared Read Blocks": 0,
            "Shared Dirtied Blocks": 0,
            "Shared Written Blocks": 0,
            "Local Hit Blocks": 0,
            "Local Read Blocks": 0,
            "Local Dirtied Blocks": 0,
            "Local Written Blocks": 0,
            "Temp Read Blocks": 0,
            "Temp Written Blocks": 0
          }
        ]
      }
    ]
  },
  "Planning": {
    "Shared Hit Blocks": 0,
    "Shared Read Blocks": 0,
    "Shared Dirtied Blocks": 0,
    "Shared Written Blocks": 0,
    "Local Hit Blocks": 0,
    "Local Read Blocks": 0,
    "Local Dirtied Blocks": 0,
    "Local Written Blocks": 0,
    "Temp Read Blocks": 0,
    "Temp Written Blocks": 0
  },
  "Planning Time": 0.03,
  "Triggers": [],
  "Execution Time": 0.093
}
```

</details>

### Phase 2 completion and remaining verification limits

- Local PostgreSQL 18.6 connectivity and migration application: verified in prior audit.
- Empty-database migrations, SQL constraints, isolation, deletion and correct fixture
  report sums: 13 PostgreSQL 18 integration tests passed in prior audit.
- Lint/typecheck and 154 existing unit tests passed in prior audit. No source code
  changed in this documentation-only acceptance update, so those tests were not rerun.
- Reverted zero-amount constraint mutation: failure demonstrated and restoration
  verified by integration suite; coverage recorded above.
- Owner million-row benchmark, raw samples and all nine plans: inspected and accepted
  with the explicit provenance/workload caveats above. Rollup decision recorded.
- Remote GitHub CI/PR and clean-clone installation remain NOT VERIFIED; no hosted
  pass claim is made. No held-out evaluation or Gemini call occurred.

Phase 2 gate is ready for owner review. Do not implement Phase 3 until the next go.

## 2026-11-03 — Owner phrasing intake

Saved 50 distinct owner-supplied messages verbatim in
[eval/inbox/owner-20261103.jsonl](../eval/inbox/owner-20261103.jsonl). Validated JSONL,
unique IDs and dev-candidate status. These are unlabeled examples, not a verified
real-user study. No expected labels or injected timestamps were invented.
Slang values, abbreviations and clarification policy were sent to the owner for
confirmation. No parser changes, tuning, evaluation or LLM call was performed.
Original 65 seed cases retain SHA-256
`525fbdfaac8e80d3470aa43203f41c01fe2eee829d638e12df401a11a8122839`.
Held-out runs remain 0. Phase 3 is not started by this data-intake step.
No tests were rerun for this data/documentation-only update.

## 2026-11-03 — Owner glossary confirmation and requested web research

Owner retained unitless-number clarification and confirmed five abbreviations.
Recorded exact slang decisions, contextual research and source-quality limitations in
[SLANG_RESEARCH.md](../eval/inbox/SLANG_RESEARCH.md). Opened both owner-supplied
links and searched additional sources for cành, loét, xị and chục. The FPT article
has an internally inconsistent xị example; it was not treated as gold data. Loét
remains unresolved. No runtime code, seed labels, raw inbox messages or evaluation
results changed. No tests/evaluation/LLM calls were run for this documentation-only
update. Held-out runs remain 0. Case-level gold labels and injected time still need
review before promotion to an executable owner-dev dataset.

## 2026-11-03 — Owner correction: loét and xị

Owner explicitly confirmed loét = 100,000 VND and corrected xị from the earlier
10,000 to 100,000 VND. Updated the current glossary; the preceding research entry
is historical and its unresolved-loét status is superseded for this owner's data.
The web source was not newly verified as supporting loét; owner confirmation and
source evidence remain distinct. Unitless amounts still require clarification.
Raw inbox, runtime parser, seed labels and reports are unchanged. No tests, tuning,
evaluation or LLM calls were run for this documentation-only correction.

## 2026-11-03 — Phase 3 guarded extraction implementation

Implementation commits: `1f815f86e57bc9037f26c0665240d4c6ef57fc69` and
`43bb70573ef886f35d210c0aae043f9879694fda` (final evaluation-correctness fix),
branch feat/phase-3. Reports/evidence are in a later documentation commit.
Environment: same Darwin arm64/macOS 27.0.1 host, isolated Node 22.23.4/npm 10.9.4.
No real Gemini request, including model preflight, was made by the agent.

### Changes and source verification

- ExtractionProvider, scripted FakeProvider, native-fetch GeminiProvider and factory.
- Strict zod schema, real-calendar validation, source-amount guard and mandatory
  confirmation. Model-authored notes/questions are not echoed raw.
- Rules-first service with conservative ambiguity handling, timeout/retry budget,
  safe metric logging and per-user/date/model/prompt-version cache.
- PostgreSQL atomic per-user/global attempt budgets in migration 004. Every retry
  counts; account deletion removes owned state without refunding global spend limits.
- Forced llm mode, hybrid mode and rules evaluation with per-field/exact/clarification
  metrics, measured local latency, attempts, tokens, rules-only share and optional
  observed-token cost estimates. Real calls are explicitly owner-only and blocked in CI.
- Parser rules, original seed labels and raw owner inbox remain unchanged.

`npm view zod version engines --json --fetch-retries=0` returned 4.6.7; installed
as an exact API runtime dependency and recorded in package-lock.json. Native REST
avoids an additional SDK dependency. Official pages inspected before implementation:
[models](https://ai.google.dev/gemini-api/docs/models),
[model metadata endpoint](https://ai.google.dev/api/models),
[GenerateContent REST fields](https://ai.google.dev/api/generate-content) and
[gemini-3.5-flash-lite capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).
The model-specific page listed stable status and structured-output support. This
is documentary verification, not verification against the owner's API key/account.
The structured-output guide redirected to an inaccessible page; the accessible REST
reference's responseMimeType/responseJsonSchema fields were used instead.

### Clean-clone checks

```sh
git clone --no-hardlinks /Users/tranphantrungkien/project/sochat /private/tmp/sochat-phase3-final-43bb705
cd /private/tmp/sochat-phase3-final-43bb705
export PATH=/private/tmp/sochat-phase0-runtime/node_modules/node/bin:/private/tmp/sochat-phase0-runtime/node_modules/.bin:$PATH
npm ci && npm run lint && npm run typecheck && npm test && npm run test:coverage && npm run test:integration
```

All commands exited 0. npm ci installed 329 packages/audited 333. It reported 18
moderate vulnerability entries and a glob deprecation; no force fix was applied.

```text
All matched files use Prettier code style!
tsc --noEmit: exit 0
Unit: 7 files, 200 passed, 0 failed
Integration: 2 files, 16 passed, 0 failed
Statements 79.25% (508/641)
Branches   78.79% (405/514)
Functions  77.65% (73/94)
Lines      79.89% (469/587)
```

Coverage is the unit-run V8 report, not a merged unit/integration report. Included:
parser, extraction, evaluation and runtime guard. The database store is exercised
by integration tests but has partial unit coverage; the provider evaluation CLI
runs in child processes and reports 0% in parent coverage. These limitations are
retained rather than excluded to inflate a percentage. No new coverage threshold
is set; calibration remains Phase 7 work.

Tests cover wrong/unknown fields, categories inconsistent with type, bad calendar
dates, malformed/non-finite/negative/fractional/huge amounts, injection examples,
prompt-exfiltration requests, guarded hallucinated amounts, rules ambiguity, fake
failures, retry cap, ignored-cancellation timeout, cache corruption/user/date
isolation, operational-clock separation, safe log keys and redaction, and mocked
Gemini transport including model preflight, blocked/truncated output and sanitized
HTTP errors. CLI process tests verify fake execution and Gemini rejection in CI.

Real PostgreSQL 18 tests validate concurrent quota reservations from 20 connections
(total 5 admitted, no user above 3), day boundaries, cache expiry/ownership and
cascading cache/user-counter deletion with global count retained. Existing database
constraints, migrations, reports and zero-residue tests also pass.

### Failures found and mutation evidence

The native CLI process tests initially failed because constructor parameter
properties were not supported by Node strip-only execution. Replaced them with
erasable explicit fields; enabled erasableSyntaxOnly in TypeScript to prevent
recurrence. Both process tests subsequently passed.

A final test-first evaluation review found that forced llm mode could inherit
correct rule fields after a provider refusal. New test 'does not borrow rule
predictions when a forced LLM-only provider declines' failed, then passed after
separating the mode's fallback items. Hybrid mode still preserves partial rules
when asking for clarification. The final clean-clone checks use this corrected code.

Required mutation: temporarily disabled the source amount-presence check in
guardAmounts, ran the hallucination test, and restored the file in finally:

```sh
npm test -- apps/api/src/extraction/extraction.test.ts -t 'flags a hallucinated amount'
```

```text
FAIL flags a hallucinated amount and does not echo raw model notes
AssertionError: expected [] to include 'llm_amount_not_in_message'
Tests 1 failed | 44 skipped (45)
MUTATION_EXIT_CODE: 1
RESTORED: True
```

At that point the restored extraction suite passed 45 tests. The later model-only
independence test brought it to 46; final overall unit count is 200. The real guard
is committed, and 500,000 VND proposed for a 50k message remains flagged.

### Local database migration

`npm run db:migrate` exited 0 against the previously configured local sochat_dev
database, applying 004 without editing 001/002. No credentials were printed.
No real provider was initialized by migration. The optional 003 rollup was not added;
future migrations must use higher numbers rather than filling an applied-order gap.

### Rules and fake-only evaluation

Commands run from the final clean clone, writing outside it to preserve clean git
provenance, then copied unchanged into eval/results/phase3-fake:

```sh
npm run eval -- --config rules --split dev --out-dir /private/tmp/sochat-phase3-reports-43bb705
npm run eval -- --config hybrid --provider fake --split dev --out-dir /private/tmp/sochat-phase3-reports-43bb705
npm run eval -- --config llm --provider fake --split dev --out-dir /private/tmp/sochat-phase3-reports-43bb705
```

Rules/hybrid exited 0. Forced fake-llm exited 1 as expected for deliberately incorrect
predictions; both JSON/Markdown failure reports were retained. Every report records
source commit 43bb705..., working_tree_dirty=false and the unchanged seed dataset
SHA-256 525fbdfaac8e80d3470aa43203f41c01fe2eee829d638e12df401a11a8122839.

| Configuration                                                     | Exact cases | Attempts | Rules-only share | p50 ms   | p95 ms   | API cost per 100 |
| ----------------------------------------------------------------- | ----------- | -------- | ---------------- | -------- | -------- | ---------------- |
| [rules](../eval/results/phase3-fake/rules-dev.json)               | 65/65       | 0        | 92.31%           | 0.029916 | 0.199041 | $0 (no API call) |
| [hybrid / fake](../eval/results/phase3-fake/hybrid-fake-dev.json) | 65/65       | 5        | 92.31%           | 0.031500 | 0.437375 | $0 (no API call) |
| [llm / fake](../eval/results/phase3-fake/llm-fake-dev.json)       | 1/65        | 50       | 0.00%            | 0.055042 | 0.533459 | $0 (no API call) |

Rules and hybrid-fake: all four fields 70/70; clarification TP=5, FP=0, FN=0,
TN=60, precision/recall 100%. Fake llm: all four fields 0/70, TP=5, FP=60, FN=0,
TN=0, precision 5/65 and recall 5/5. Its 50 scripted calls always asked for
clarification; the remaining 15 cases hit the default per-user cap. Only the
no-item clarification seed case matched exactly. This intentional dummy is not an
LLM implementation's extraction-quality measurement, and cannot improve accuracy
by copying correct rule fields. Logs capture no message text.

**The 65 seeds and original rules share an author. These scores are not representative
of real users. Fake costs/latencies/accuracy do not measure Gemini.** Latencies are
single local passes over small synthetic cases, not remote/API/SLA benchmarks. Real
model rates and billable failed-request usage are not known, so owner-run estimates
may be null; no unverified real cost or latency is claimed.

### NOT VERIFIED / owner gate

- Real Gemini availability with the owner's key, actual structured-output acceptance,
  real extraction accuracy, billable cost and network latency: NOT VERIFIED.
- Remote GitHub CI and PR status: NOT VERIFIED. Local clean-clone checks pass; CI
  is configured for rules and fake only and has runtime guards against real Gemini.
- Fifty owner phrases remain unlabeled candidates. No new gold labels or confidence
  claims were invented. No held-out evaluation was run; cumulative held-out runs: 0.
- Cache expiry is lazy (24-hour eligibility), not a scheduled physical purge. API
  database statement timeouts, broader retention hardening and UI confirmation
  implementation remain later-phase work. Extraction itself saves no transaction.

Owner tasks: set a currently available GEMINI_MODEL in ignored .env; keep the key
local. A documented candidate is gemini-3.5-flash-lite, but startup checks actual
account access and there is no automatic fallback to a different model. Optional
current per-million-token pricing env fields enable estimates; blank means unknown.
Then run the real **dev** evaluation explicitly:

```sh
npm run eval:llm -- --config hybrid --split dev --out-dir eval/results/owner-hybrid
npm run eval:llm -- --config llm --split dev --out-dir eval/results/owner-llm
```

These requests consume daily caps and use a reserved synthetic evaluation account
in the selected local database. Read docs/EXTRACTION.md before running. The default
50-attempt user cap cannot cover all 65 forced-llm cases; choose a deliberate eval
cap if a complete comparison is desired, retaining the global spending bound.
Share resulting JSON reports (not credentials) for review. Continue independent
labeling toward at least 200 examples with at least 50 held out before tuning.

Phase 3 local implementation acceptance is met; stop at the owner real-evaluation
gate. No Phase 4 implementation is authorized by this report.

## 2026-11-03 — Owner real hybrid run and conflicting-amount correction

Owner supplied a terminal log and the retained
[real hybrid report](../eval/results/owner-hybrid/hybrid-gemini-dev.json), generated
at 2026-11-03T03:00:09.745Z on source 45b6930, model gemini-3.5-flash-lite.
The agent did not initiate or repeat the live evaluation. Its original JSON/Markdown
are preserved unchanged, including their original generic fake-provider caveat;
provider=gemini identifies this real run. Future report wording now distinguishes
real and fake provider context.

| Metric                        | Owner real run                       |
| ----------------------------- | ------------------------------------ |
| Exact cases                   | 64/65 (98.46%)                       |
| Amount                        | 69/70 (98.57%)                       |
| Category / date / type        | 70/70 each                           |
| Clarification                 | TP 5, FP 0, FN 0, TN 60              |
| Provider attempts             | 5                                    |
| Input / output / total tokens | 775 / 246 / 1021                     |
| Rules-only share              | 60/65 (92.31%)                       |
| Pipeline p50 / p95            | 0.037333 ms / 1121.933958 ms         |
| Observed-token cost estimate  | unknown (null; no prices configured) |

These are synthetic dev seed results, not real-user accuracy. Pipeline percentiles
mix 60 rules cases and 5 model cases; they are not provider-only p95 estimates.
No billing amount is inferred from tokens or a presumed free tier.

Only seed-064 differed: the model proposed 150,000 from a message containing both
200k and 150k. The system still correctly requested clarification with multiple_amounts;
no transaction was saved. The gold amount remained null and the gold label was not
changed to improve a score. A new regression test failed with 'expected 150000 to
be null', then the hybrid validator was changed to preserve the unresolved rules
proposal whenever conflicting amounts are present. This applies to both fresh
provider responses and cache hits; model-only evaluation remains independent of
rule fallback predictions. Fix commit: 3b2258a4e3bbcdb06321bd2b6f75d905f3646dd7.

`npm run lint && npm run typecheck && npm test` all exited 0 after the fix:
7 unit files, **201 passed, 0 failed**. No database schema changed; integration tests
were not repeated for this orchestration/report-wording correction. Previous
16-test PostgreSQL result remains recorded above. Coverage was not remeasured.

### Current local migration status

The pasted earlier ENOTFOUND base failure referred to an earlier URL configuration.
A credential-redacted check of the current env found localhost and sochat_dev;
connection succeeded to PostgreSQL 18.6. All three migration names were present:
001_schema.sql, 002_reporting_indexes.sql, 004_llm_limits.sql. `npm run db:migrate`
then exited 0 again. No local URL edit was needed in this audit, no credentials
were printed, and no unrelated data was modified.

### Offline verification, not a new live score

Attempted a read-only full replay of existing cached outputs with provider/network
calls disabled. The cache contained four entries, so a complete replay was not
possible; no full-dataset result was written or claimed. The cause of the missing
raw response is not inferred from cache count alone.

Then replayed **only seed-064** through the corrected HybridExtractor, using
PgExtractionStore.get and callbacks that prohibit quota reservation, cache writes
and provider calls. Result in
[offline-replay-after-fix.json](../eval/results/owner-hybrid/offline-replay-after-fix.json):
path=cache, amount=null, exact case=1/1, provider_calls=0. It records source 3b2258a
and identifies itself as an offline single-case replay. It measures no new API
latency or billing. Do not present it as a new 65/65 live Gemini run.

Real hybrid connectivity/output is now owner-verified by the retained run; the
post-fix full live hybrid score, model-only real evaluation, current token pricing
and remote CI remain NOT VERIFIED. Held-out runs remain 0. Phase 4 is not started.
A later owner rerun may reuse cache, so interpret attempts and latency accordingly;
use a new output directory to preserve the original report.

## 2026-11-03 — Owner post-fix hybrid evaluation accepted

Owner ran the requested post-fix dev command:

```sh
npm run eval:llm -- --config hybrid --split dev --out-dir eval/results/owner-hybrid-after-fix
```

The agent inspected and retained the generated JSON/Markdown without initiating
another Gemini request. Report generated at 2026-11-03T03:09:28.876Z, model
gemini-3.5-flash-lite, source e56475315a8384440af548f6c4a41a968148e4ff,
working_tree_dirty=false. Dataset SHA-256 matches the unchanged 65 dev seed cases.
Artifact: [post-fix hybrid report](../eval/results/owner-hybrid-after-fix/hybrid-gemini-dev.json).
Artifact SHA-256: a1d3a338659b5102a5de64328b5083dded6fa9d480ec101da73bf4120b69825d.

Validation assertions passed: provider/config/split, exact cases, all four field
counts, zero failures, dataset hash and observed attempt/token counts.

| Metric                          | Post-fix owner run                             |
| ------------------------------- | ---------------------------------------------- |
| Exact cases                     | 65/65                                          |
| Amount / category / date / type | 70/70 each                                     |
| Clarification                   | TP=5, FP=0, FN=0, TN=60; precision/recall=100% |
| Rules-only resolution share     | 60/65 (92.31%)                                 |
| Provider attempts in this run   | 1                                              |
| Input / output / total tokens   | 152 / 20 / 172                                 |
| Pipeline p50 / p95              | 0.050375 ms / 3.813584 ms                      |
| Cost estimate                   | null; current token prices not configured      |

This is an actual owner-run post-fix end-to-end hybrid result, unlike the earlier
single-case offline replay. It reuses the persistent cache and makes only one
new provider attempt. The 3.81 ms p95 mixes rules/cache/model processing and is
**not Gemini-only network latency**, nor evidence of a model speedup over the
previous 1121.93 ms mixed p95. No provider-only percentile can be estimated from
one new call. The original 64/65 report remains preserved alongside this one.

The 65 seeds were authored with the reference rules, so 100% here is not a
real-world accuracy claim. The 50 owner phrases remain unscored/unlabeled candidates;
held-out runs remain 0. Model-only real evaluation, a cache-cold three-way comparison,
real billed cost and hosted GitHub CI remain NOT VERIFIED. These limitations are
retained rather than filled with estimates or invented results.

Phase 3 local implementation and the owner post-fix hybrid check are accepted.
This resolves the requested post-fix hybrid gate; it does not claim completion of
all future dataset/cost experiments. No code changed in this evidence-only update,
so tests were not repeated; latest unit suite is 201 passed and existing database
suite is 16 passed. Phase 4 still requires the owner's explicit go.

## 2026-11-03 — Phase 4 authenticated HTTP API

Owner explicitly requested "go phase 4". Source commit:
`76cbd46106623868f1954f0d15212d03a76b025d` on `feat/phase-4`.
Environment: Darwin arm64, Node 22.23.4, npm 10.9.4. Disposable integration
databases use `postgres:18.6-bookworm`; development uses local PostgreSQL 18.
No agent-run Gemini request or held-out run occurred.

### Implementation

Added Express 5 routes, strict zod input/output contracts, problem+json, cursor
pagination and generated OpenAPI 3.1. Endpoint groups cover authentication, parse
proposals, idempotent confirmation, transactions, reports, budgets, goals and
contributions, CSV export and account deletion. See [API setup/contract](API.md)
and ADR-012 in [DECISIONS](DECISIONS.md). No React UI or out-of-scope feature added.

Registry/package documentation was checked before installing express 5.3.0,
argon2 0.45.2, express-session 1.19.0, connect-pg-simple 10.0.0, helmet 8.3.0,
supertest 7.3.1 and @apidevtools/swagger-parser 13.1.0. The maintained argon2
package is explicitly configured for argon2id. The OpenAPI validator requires
Node >=22.19; engines/runtime checks now require 22.19+ within major 22, while
the pin remains 22.23.4. The lockfile records exact dependency versions.

Migration 005 adds PostgreSQL sessions, per-user idempotency records and atomic
rate counters. A generated session user_id cascades on account deletion, including
other devices' sessions. Login rotates SID/CSRF; logout destroys the session.
Cookies are httpOnly/SameSite=Lax and Secure in production. Strict origin, CSRF
and explicit proxy trust are tested. Integer money arithmetic stays in bigint/SQL;
saved amounts/totals serialize as decimal strings.

### Clean-checkout verification

Cloned committed source without hardlinks, with no .env copied, then ran:

```sh
git clone --no-hardlinks /Users/tranphantrungkien/project/sochat /private/tmp/sochat-phase4-76cbd46
cd /private/tmp/sochat-phase4-76cbd46
# PATH selected isolated Node 22.23.4/npm 10.9.4; system installs unchanged.
npm ci
npm run lint
npm run typecheck
npm test
npm run api:openapi
git diff --exit-code -- apps/api/openapi.json
npm run test:integration -- --coverage
```

All commands exited 0. npm ci installed 451 packages, audited 455 and reported
**18 moderate vulnerabilities**. No forced downgrade/fix was applied; advisory
review remains Phase 6 work. This is not a clean dependency-audit claim.

| Check                          | Observed result                                           |
| ------------------------------ | --------------------------------------------------------- |
| ESLint / Prettier / TypeScript | passed                                                    |
| Unit suite                     | 7 files, 201 passed, 0 failed                             |
| PostgreSQL + HTTP integration  | 3 files, 50 passed, 0 failed                              |
| HTTP subset                    | 34 cases, including parameterized validation/isolation    |
| OpenAPI generation             | native Node execution passed, artifact unchanged          |
| OpenAPI validation             | SwaggerParser accepted 3.1; artifact equals live contract |
| Integration line coverage      | 91.82% (393/428)                                          |
| Integration statement coverage | 91.06% (418/459)                                          |
| Integration branch coverage    | 81.96% (250/305)                                          |
| Integration function coverage  | 96.24% (128/133)                                          |

Coverage includes apps/api/src/db and apps/api/src/http, excludes integration test
files, and is separate from unit coverage. It excludes server.ts/openapi.ts entry
points, extraction and future web code; it is not whole-application coverage.
HTTP-group line coverage is 92.66%; repository.ts line coverage is 100%, which is
not proof that every possible behavior is tested. No threshold was added.

HTTP tests use real argon2id/PostgreSQL sessions and cover SID/CSRF rotation,
logout/revocation, every private route without auth, CSRF on writes, Secure/HTTPS,
origin handling, tampered cookies, login/parse throttles and default forwarded-IP
resistance. They cover malformed IDs/JSON, unknown fields, calendar/money validation,
body size/content type, concurrent idempotent retries, payload conflict, whole-batch
rollback, cursor ordering/filter/edit/delete, exact report sums, 80/100% budget
boundaries, integer ceiling/expired goals, CSV protection and a 601-row export
crossing its 500-row chunk boundary.

Table-driven isolation covers every ID-taking transaction/goal/contribution route:
B receives 404 and A's data remains intact. Collection/profile/category, report,
budget and CSV assertions prevent A's values reaching B. Dynamic deletion checks
every public table with user_id for zero residual rows, including sessions,
idempotency/cache/quota/rate state. Both A sessions are revoked; B remains logged
in. Global aggregate LLM usage has no user reference, as designed in Phase 3.

An initial regression exposed malformed IDs throwing during BigInt conversion
(500). The guarded conversion now returns 400 and that HTTP test is retained.
CI now regenerates OpenAPI and rejects artifact drift before integration tests.
Hosted GitHub execution is **NOT VERIFIED** in this phase.

### Mutation check, reverted

Temporarily changed production transaction deletion from owner+id filtering to
id-only filtering (retaining SQL parameter shape), then ran:

```sh
npm run test:integration -- -t 'returns 404 for B attempting delete /api/transactions'
```

Observed: **1 failed, 46 skipped**, with
`expected 404 "Not Found", got 204 "No Content"`. This proves the test detects the
deliberately introduced cross-user deletion defect. Restored production code and
the complete 47-case suite passed. Added three more HTTP tests afterward; the final
clean-checkout 50-case suite above passed. An earlier attempt hit a test syntax
error and was not counted as mutation evidence.

### Native local PostgreSQL smoke

`npm run db:migrate` applied 005 successfully to configured local PostgreSQL 18.
Replaced the ignored local SESSION_SECRET placeholder with a cryptographically
random value and restricted .env permissions to 0600; no secret was printed or
committed, and other credentials were preserved. Started the actual Node server:
`LLM_PROVIDER=fake NODE_ENV=development npm run api:start`. Native fetch kept
cookies/CSRF/password only in memory and used a temporary synthetic account:

| Action                           | HTTP status                    |
| -------------------------------- | ------------------------------ |
| health / OpenAPI / CSRF          | 200 / 200 / 200                |
| register                         | 201                            |
| parse proposal                   | 200                            |
| confirm / same-key retry         | 201 / 201, same transaction id |
| month report                     | 200, expense_vnd="50000"       |
| create goal / CSV export         | 201 / 200                      |
| delete account / revoked session | 204 / 401                      |

Deleted the smoke account through the API; other local users/data were preserved.
Verified the temporary API command/PID and stopped it with SIGTERM. Testcontainers
use separate databases. Smoke preceded the last three HTTP tests and generic
pool/listen-error handling addition; final source passed clean-checkout verification.

### Gate and remaining limits

Phase 4 local acceptance is complete. UI/browser e2e, deployment proxy/HTTPS,
hosted CI, full security hardening and fresh real Gemini performance/cost remain
**NOT VERIFIED** here. Prior owner-run Gemini evidence is unchanged; held-out runs
remain **0**. No deployment, remote push/PR or Phase 5 implementation was performed.
Owner can inspect docs/API.md/OpenAPI or start fake mode; no new secret/benchmark
is required for this gate. Await explicit "go phase 5".

## 2026-11-03 — Phase 5 React web application

Owner explicitly requested "go phase 5". Implementation source:
`d06e7ce56feee38d050bb431e07eacb578f295f3` on `feat/phase-5`, based on accepted
Phase 4. Environment: Darwin arm64, isolated Node 22.23.4/npm 10.9.4, PostgreSQL
18.6 Testcontainers. No local .env or owner's development data was copied into tests.

### Delivered scope and dependency verification

React/Vite Vietnamese pages: register/login, Chat with editable confirmations,
transactions with filters/cursor/edit/delete, month/year reports, category budgets,
savings goals with contributions/edit/delete, Settings with CSV/logout/account
removal. Responsive sidebar/bottom navigation, synthetic-demo banner, labeled
controls, keyboard skip/focus, loading/empty/error/retry states, chart line/marker
and text distinctions with expanded table alternatives. No OCR, bank linking or
other future features. Code/SQL perform calculations; Gemini remains extraction-only.
No real Gemini call or held-out evaluation was initiated; held-out runs remain 0.

Registry versions/engines/peers were checked before installing React/react-dom/
react-is 19.3.1, Recharts 3.10.1, Vite 8.3.5, React type packages 19.3.0,
Playwright 1.64.1 and Lighthouse 13.6.0. Installed Playwright's pinned Chromium
156.0.8078.4 (revision 1248). Official references consulted: [Vite proxy](https://vite.dev/config/server-options),
[Playwright web servers](https://playwright.dev/docs/test-webserver),
[Recharts accessibility](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility).
No new runtime/framework major was selected without checking compatibility.

See [WEB.md](WEB.md), ADR-013 and the page modules in apps/web/src/pages. Frontend
requests use the existing cookie/CSRF API; no identity is taken from a client field
and no credentials/messages/ledger are stored in localStorage. Native VND labels use
bigint/Intl vi-VN. Chart coordinates are approximate thousands; exact money remains
in HTML tables. Confirm snapshots items/key on first attempt and reuses them after
uncertain network errors. Pending intent is memory-only, not durable across leaving
Chat/reloading; inspect saved transactions before submitting a new intent afterward.

### Clean-checkout commands and observed output

```sh
git clone --no-hardlinks /Users/tranphantrungkien/project/sochat /private/tmp/sochat-phase5-d06e7ce
cd /private/tmp/sochat-phase5-d06e7ce
# PATH selects isolated Node 22.23.4/npm 10.9.4.
npm ci
npm run lint
npm run typecheck
npm test
npm run api:openapi
git diff --exit-code -- apps/api/openapi.json
npm run test:integration
npm run e2e
```

All commands exited 0. npm ci installed 600 packages, audited 604 and reported
**21 moderate vulnerabilities**. No incompatible force/downgrade fix was applied;
current advisory review remains Phase 6 work. This is not a clean audit claim.

| Check                             | Actual result                     |
| --------------------------------- | --------------------------------- |
| ESLint / Prettier / TypeScript    | passed                            |
| Unit suite                        | 7 files, 201 passed, 0 failed     |
| PostgreSQL/HTTP regression        | 3 files, 50 passed, 0 failed      |
| Native OpenAPI generation / drift | passed / unchanged                |
| Production Vite build             | passed, 450 modules transformed   |
| Browser journeys, clean clone     | 14 passed, 0 failed, 26.7 seconds |
| Desktop Chromium                  | 7 passed                          |
| Pixel 7 Chromium emulation        | 7 passed                          |

The browser harness starts a disposable PostgreSQL 18 database and actual Express
session/API plus production Vite preview. It explicitly constructs FakeProvider,
uses a random test-only session secret, never loads .env and refuses reuse of local
servers. Temporary audit/smoke accounts are synthetic and deleted. Servers and
containers were stopped after verification; native PostgreSQL local data was not
changed during this phase.

Required full UI flow passed on both viewports: register → parse two items → assert
zero saved rows before confirmation → edit amount → confirm → verify report → create
quỹ/record contribution → download and inspect CSV → delete account → verify 401.
Further journeys cover unitless amount staying blank/unsaved until corrected;
response loss after the API committed then retry without duplication; transaction
edit/delete and persisted 80% budget warning; reload/session, keyboard skip, logout
and login; report error/retry and yearly exact table; 21-row cursor pagination,
income filter, goal edit and confirmed deletion. The full flow asserts no browser
pageerror and no body-width overflow at the tested viewports.

An early 12-case run found initial programmatic focus skipped the first keyboard
skip link. Corrected initial focus and prevented the skip link from changing the
page route; the retained keyboard test passes on both viewports. A later new filter
test initially timed out with an exact wrapped-label selector; using the select's
accessible combobox role resolved it. The final 14-case clean run above passed.

### Browser coverage, measured separately

Playwright V8 execution ranges are merged across all journeys and compared with
all built JavaScript chunks, including React/Recharts. This is UTF-16 character-range
coverage, **not TypeScript line/branch coverage**, and excludes API/HTML/CSS. Library
execution differs slightly between runs; no whole-app coverage claim or threshold.

| Run                              | Covered / total UTF-16 units | Percent |
| -------------------------------- | ---------------------------- | ------- |
| Working checkout, 14 journeys    | 304192 / 664677              | 45.77%  |
| Clean checkout, same 14 journeys | 304377 / 664677              | 45.79%  |

Artifacts: [working measurement](measurements/web-coverage.json),
[clean measurement](measurements/web-coverage-clean.json). Existing Phase 4 integration
line coverage remains its historical measurement; it was not remeasured/merged here.

### Mutation check, restored

Temporarily changed `pending.current ??=` to `pending.current =` in Chat confirmation,
so retry generates a new UUID rather than retaining its original idempotency key.
Ran:

```sh
npm run e2e -- --project=desktop-chromium --grep 'retry after'
```

Observed **1 failed**: expected transaction array length 1, received 2. The test first
allows the real API save to complete, then drops its response and clicks retry.
Production source was restored in a finally block. Final 14-case working and clean
runs passed, proving the regression test detects this real duplicate-save defect.

### Lighthouse and screenshot evidence

Built the production bundle, started `npm run e2e:serve`, then ran `npm run web:audit`.
The audit creates an isolated synthetic account and two transactions, uses cookie
headers only in memory, measures authenticated #chat/#dashboard and deletes its
account. Full reports are not retained because they may contain Cookie headers;
selected metrics only are written to [lighthouse.json](measurements/lighthouse.json).
Lighthouse 13.6.0, HeadlessChrome 156.0.8078.4, mobile simulated throttling: 150ms RTT,
1638.4 Kbps nominal throughput, 4x CPU slowdown. Each row is one local run.

| Page      | Performance / 100 | Accessibility / 100 | LCP   | TBT   | CLS   |
| --------- | ----------------- | ------------------- | ----- | ----- | ----- |
| Chat      | 92                | 100                 | 1.6 s | 0 ms  | 0.179 |
| Dashboard | 89                | 100                 | 1.9 s | 10 ms | 0.210 |

The first measurements were Chat 92/95 and Dashboard 89/96. Lighthouse identified
insufficient contrast in small muted/footer/table labels. Darkened those measured
colors and repeated both runs; final scores above have no failed automated
accessibility audits. [Before-contrast artifact](measurements/lighthouse-before-contrast.json)
is retained. These are neither hosted performance measurements, percentiles,
real-phone measurements nor a manual WCAG/screen-reader certification. Layout shift
remains a measured follow-up; no high-performance promise is inferred.

Captured and visually inspected actual synthetic Chat/Dashboard screenshots at
1280px desktop and Pixel 7 emulation. Review caught an overly broad CSS selector
showing focus outlines on every control; corrected to :is(...):focus-visible and
recaptured. On 2026-11-03 the owner explicitly replied **"Duyệt ảnh hiện tại"** to
approve README screenshots. Approved images are retained in docs/screenshots and
embedded in README. No image generation or invented UI data screenshot was used.
A temporary local preview returned 200 and was opened in the Codex browser panel;
its open request was queued, which is not itself proof of rendered-browser QA.
Screenshot inspection and Playwright supply the visual/browser evidence above.

### CI/publication gate

Workflow now installs pinned Playwright Chromium and runs the same production-build
journeys after unit/integration/rules/fake checks. GitHub read-only inspection found
Phase 4 PR #5 merged and confirmed origin/main's files equal the local Phase 4 base.
An initial `git push -u origin feat/phase-5` was rejected by automatic approval
review because publishing source to the public repository needed explicit user
authorization. No alternative write path was attempted. The owner then explicitly
replied **"Cho phép push và tạo draft PR"**; the same push succeeded and
[draft PR #6](https://github.com/Krezzy88/sochat/pull/6) was created against main.
No merge was performed.

Hosted verification is now **VERIFIED** for commit
`02a64262b4005d3270e7083d076bc8f4116c0cd1` (implementation d06e7ce plus local
evidence). [CI run 41592021904](https://github.com/Krezzy88/sochat/actions/runs/41592021904)
completed with conclusion **success**. Fetched job steps and decoded logs for job
125770686289: Ubuntu 24.04.5, lint/types/OpenAPI drift passed, 201 unit tests,
50 PostgreSQL/HTTP tests, rules/fake eval, Chromium installation and **14 e2e tests
passed** (34.7 s). CI browser execution ranges were 304197/664677 (45.77%); they
are not TypeScript line coverage. No real Gemini or held-out command is in this job.
This subsequent evidence-only update is separately committed; the linked run proves
the referenced source, not an unobserved later SHA. PR remains draft for owner review.

Safari/Firefox, real devices, assistive technology, full security/privacy hardening,
public deployment remain unverified. Owner has approved screenshots and branch publication;
no additional API key or benchmark is required. Phase 6 remains behind its explicit
go gate. No Phase 6 implementation or deployment was performed.

## 2026-11-03 — Phase 6 security/privacy local verification

Owner requested go phase 6. Implementation e9cd08d91edf892b45b3d2db486b09af90f455a7,
branch feat/phase-6. Darwin arm64, Node 22.23.4/npm 10.9.4, disposable PostgreSQL
18.6. Added explicit operational-log field selection and runtime-extra-field
regression; security/threat/privacy documents and Settings retention explanation;
Dependabot npm/actions monitoring and CI audit/ bounded tracked-file secret check.
Existing Helmet, strict CORS, Secure production cookie/HTTPS, CSRF and session
rotation/revocation remain covered by PostgreSQL HTTP tests. Dynamic deletion
assertions enumerate all public user_id columns, including all device sessions.
RLS remains deferred as an owner-decided stretch, not silently enabled.

Commands: npm run lint, npm run typecheck, npm run web:build, npm test all exited 0.
Unit result: 8 files, 202 passed. npm run test:integration: 3 files, 50 passed.
node scripts/check-secrets.mjs passed after staging/committing the new files;
this checks limited patterns and environment-file names, not every possible secret.

npm audit --json (network-enabled): 21 moderate entries, development tooling chains
including ESLint/minimatch, Testcontainers/archiver and Lighthouse/Sentry. Registry
fix suggestions include incompatible major downgrades; no force fix or claim of
zero development vulnerabilities. npm audit --omit=dev --json exited 0 and reported
0 total vulnerabilities. No dependency versions were changed. CI rejects high or
critical advisories; moderate entries remain explicitly tracked for upstream fixes.

Mutation: temporarily serialized the whole runtime event instead of its selected
fields in log.ts. npm test -- apps/api/src/extraction/log.test.ts failed (1 test),
with extra message/email/password/API-key/user fields present. Restored source in
finally; full 202-test suite passed. Existing provider-error log-redaction test
also passes. Operational logs contain no raw HTTP/provider/SQL objects.

npm run e2e built successfully but refused to start because localhost:5173 was
already occupied. Existing user server was not stopped or reused. The default-port attempt is not a passing browser result. No real
Gemini call, held-out evaluation or local user-data modification was performed.
No Phase 6 remote push/PR/hosted CI is claimed. Later deployment must verify TLS/
proxy topology, infrastructure access logs and backup/provider retention; database
cascade does not establish physical erasure from external copies. Stop at Phase 6 gate.

### Alternate-port browser verification

To avoid disturbing the occupied user server, cloned e9cd08d without hardlinks into
/private/tmp/sochat-phase6-e9cd08d and symlinked existing installed node_modules.
This is not a fresh npm ci claim. Only test origin/preview/API port references in
that temporary checkout were changed from 5173/3000 to 5273/3100; no application
logic was altered. npm run e2e exited 0: **14 passed**, 28.0 seconds, desktop/mobile
Chromium, disposable PostgreSQL 18/FakeProvider. It cleaned up its own servers.
Original checkout ports/configuration were left unchanged. Temporary screenshots
were not copied over the owner's approved Phase 5 README images.

npm run test:coverage also exited 0: 202 passed; configured unit-scope line coverage
79.83% (471/590), statements 79.19%, branches 78.50%, functions 77.08%. Scope is
runtime guard/parser/extraction/eval, not HTTP/React or combined application coverage.
Browser ranges in the alternate-port run were 304750/665050 (45.82%), including
bundled dependencies, not TypeScript lines. No coverage threshold added in Phase 6.

## 2026-11-03 — Phase 7 containers, CI gates and documentation

Owner requested go phase 7. Implementation commit
5321802a48f16ae88254697a74dac7024d4c49e2 on feat/phase-7. Native environment:
Darwin arm64, Node 22.23.4/npm 10.9.4; Docker Engine 29.9.2, Compose v5.6.1.
The owner independently merged Phase 6 PR #7; read-only GitHub inspection and
fetch confirmed origin/main's files match the local Phase 6 base. No merge here.

### Container implementation and exercised startup

Added multi-stage non-root API/web Dockerfiles and an isolated PostgreSQL 18.6
Compose service. Official node:22.23.4-bookworm-slim was pulled and its digest
verified as sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da;
both Dockerfiles pin that digest. Node image npm is 10.9.9, within the declared npm
10 range; native/CI pin remains 10.9.4. Build uses npm ci, runtime omits dev deps.
No .env, local node_modules or evaluation results enter the Docker build context.

API accepts HOST from trusted environment (native default remains loopback); image
sets 0.0.0.0 internally. Startup applies migrations through the existing runner.
Web serves built React and proxies /api to a fixed internal host, preserving cookie
headers. Healthchecks gate startup; only the web port is published to 127.0.0.1.
Known synthetic credentials and fake extraction are deliberately local-demo-only;
HTTP API development cookie mode is explicit. This is not a public TLS deployment.

Commands executed:

```sh
docker compose --env-file /dev/null -p sochat-phase7-check config --quiet
SOCHAT_WEB_PORT=18080 docker compose --env-file /dev/null -p sochat-phase7-check up --build --wait
npx playwright test --config playwright.compose.config.ts
node docker/smoke.mjs
docker compose --env-file /dev/null -p sochat-phase7-check exec -T api id -u
docker compose --env-file /dev/null -p sochat-phase7-check exec -T web id -u
docker compose --env-file /dev/null -p sochat-phase7-check down --volumes --remove-orphans
```

All restored-state commands exited 0. All three services became healthy; UID was
1000 for both applications. **7 Compose Chromium journeys passed** in 13.8 seconds:
full account/parse/edit-confirm/report/goal/CSV/delete flow, ambiguity, lost-response
retry, transaction/budget changes, session/keyboard/login, report retry/year table,
21-row cursor/filter and goal edit/delete. The native owner database and servers
were untouched. Only this temporary project's synthetic volume/network were removed.
This proves the Compose browser path, not production deployment/security/load.

### Gates and measured coverage

npm run lint, npm run typecheck, npm run test:coverage and tracked-file secret check
passed. Unit: **202 passed**, 8 files. npm run test:integration -- --coverage:
**50 passed**, 3 files, PostgreSQL 18.6. No new application feature was added.

| Scope                     | Lines           | Statements      | Branches        | Functions       |
| ------------------------- | --------------- | --------------- | --------------- | --------------- |
| Unit measured             | 79.83 (471/590) | 79.19 (510/644) | 78.50 (409/521) | 77.08 (74/96)   |
| Unit enforced gate        | 76              | 76              | 75              | 74              |
| Integration measured      | 91.82 (393/428) | 91.06 (418/459) | 81.96 (250/305) | 96.24 (128/133) |
| Integration enforced gate | 88              | 88              | 78              | 93              |

Each gate is floor(retained baseline metric) minus 3. Unit baseline is Phase 6;
integration baseline is the earlier 50-case suite and was remeasured here unchanged.
Unit excludes React/HTTP/container proxy and includes parser/extraction/eval/runtime
guard; integration includes db/http and excludes tests. Entry points outside these
configured sets are not counted. Browser V8 ranges are separate, not merged line
coverage. Full exclusions/calibration are documented in RUNBOOK.md.

Rules and FakeProvider dev commands both exited 0, 65/65 exact seed cases. Retained
in eval/results/phase7-fake with source e4dbdca and dirty=true recorded honestly.
Previously retained rules-dev reports were restored, not silently overwritten.
Synthetic seeds share an author with reference rules; these are not real-user or
Gemini performance results. No real Gemini call or held-out run; held-out remains 0.

### Mutation checks, restored

Changed the web proxy's internal API port from 3000 to 3001, rebuilt only this
project's web container and ran node docker/smoke.mjs. It failed with
`502 !== 200` at "web proxies API successfully". Restored source in finally, rebuilt
web and reran smoke: passed. Thus the retained CI smoke detects broken container
routing and checks that the session cookie survives the proxy.

Separately raised unit line threshold to 100 temporarily: all 202 tests passed but
command exited 1 with "Coverage for lines (79.83%) does not meet global threshold
(100%)". Restored calibrated 76 gate; full coverage command passed. This is coverage
gate evidence, distinct from the production proxy fault above.

### Trivy, artifacts and README traceability

Verified official registry image aquasec/trivy:0.75.0 at digest
sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa.
Ran its filesystem vuln,secret,misconfig scanners with HIGH,CRITICAL and exit-code 1
on a temporary source-only copy built from non-ignored repository files. The owner's
ignored .env was never copied/mounted. Exit 0: package-lock and both Dockerfiles had
zero reported findings at those severities. Scanner default suppresses dev package
vulnerabilities; npm audit separately covers development dependencies. No base-image
OS vulnerability scan is claimed from this filesystem result. Definitions are
current at execution, not a permanent security guarantee.

CI now runs unit/integration coverage gates, audit/secret checks, OpenAPI drift,
rules/fake eval, 14 native desktop/mobile journeys, Compose build/start/smoke and
7 container journeys. An independent Trivy job scans checked-out source. Upload
artifact version v7.0.2 was verified against the official tag and pinned to
cf430e030ddbb5b0abf93d22962f4752f3646cd9; reports retain 14 days, even on failure.
Checkout/setup-node retain their verified full SHA pins. No unpinned scanner setup
action, automatic merge, real-model/held-out command or public deployment is added.

README traceability review: feature list maps to app pages/API and browser tests;
architecture/pipeline diagrams map to web proxy, API/repository/extraction code;
owner hybrid table maps to the retained post-fix owner report; benchmark table is
copied from the retained 99-sample owner benchmark with its selective warm-cache
caveat. Privacy links map to docs/PRIVACY.md and THREAT_MODEL.md. Coverage commands/
thresholds map to configurations and measured counts above. Screenshots remain the
owner-approved Phase 5 artifacts; temporary Compose screenshots were removed.
Future ideas and owner tasks remain explicitly unimplemented.

At this local evidence commit, hosted Phase 7 CI/publication is NOT VERIFIED yet;
that acceptance condition requires pushing the reviewable feature branch and
observing the run. Phase 8 remains owner-gated: no host, demo link, user-test quotes,
held-out score or production backup/TLS guarantee was invented.

### Hosted Phase 7 verification accepted

Owner explicitly approved pushing feat/phase-7 and creating its draft PR. Push
succeeded and [draft PR #12](https://github.com/Krezzy88/sochat/pull/12) was created
against main; no merge or deployment. The earlier local-only CI limitation above
is resolved for source 9c0b8c117c12b530fe6cdd41a46a8d7d59a736aa.

[CI run 41596322856](https://github.com/Krezzy88/sochat/actions/runs/41596322856)
completed with conclusion success. Both jobs succeeded: Checks, coverage, browser
and Compose (job 125784414829), and Trivy filesystem scan (125784415162). Fetched
job logs confirm 202 unit, 50 integration, 14 native Chromium journeys (34.5 s),
Compose healthchecks/smoke and 7 container Chromium journeys (14.0 s). Unit and
integration line coverage remained 79.83% and 91.82%; all calibrated gates passed.
Audit, bounded secret check, lint/types, OpenAPI drift and rules/fake evaluations
passed. Compose cleanup succeeded. No real Gemini or held-out command ran.

Verified artifact verification-reports, ID 13212880459, 7608 bytes, digest
sha256:8002f7357addeaf148a8244f66f2c1fc43a543ec46e5345ff7d1fa373b6972f4,
not expired when inspected; retention expires 2026-11-17. Workflow uploads evaluation
reports, coverage and test-results under its declared paths. No authenticated
Lighthouse report, .env or real credential was part of the configured artifact.

This subsequent documentation-only commit records the referenced source's actual
run; it does not retroactively attribute that run to an unobserved future SHA.
Phase 7 implementation/local container and hosted CI acceptance are complete for
that source. PR remains draft, main unchanged, and Phase 8 awaits explicit owner go.

## 2026-11-03 — Pre-deploy playful UX and authorized real Gemini verification

Owner explicitly requested immediate implementation of the agreed UX improvements
and authorized actual local Gemini calls. Auth scope was narrowed by the owner to
clear validation/rules, password visibility and confirmation, retaining existing
sessions; no verification/reset-email feature. Scope/authorization is appended to
PROJECT_CHARTER.md. Source: 7612a60893624ae5c1926794016b1345b1183ffb on
feat/playful-ux-gemini. No public deployment or branch push was performed here.

### Delivered behavior

Code-native animated notebook mascot/stickers, stronger 2D outlines, larger labels,
plain Vietnamese task copy, responsive navigation and reduced-motion handling.
Grouped VND inputs are shared across confirmation, transaction editing, budgets,
goals/contributions; display 3.500.000 but submit integer strings, with positive/
maximum validation and digit-relative caret preservation. No float money math.
Auth adds confirmation, visibility, 12–128 guidance, Vietnamese validation, trimmed
identity fields and useful duplicate/throttle errors; confirmation is omitted from
the API payload. Hashing/session/CSRF/isolation rules remain unchanged.

Authenticated GET /api/chat/status exposes only provider kind. Parse proposals now
include provider alongside rules/llm/cache path. UI distinguishes configured Gemini,
rules-only processing, actual model fallback, reused results and unsuccessful AI
fallback. No UI label pretends a rules-only result was generated by Gemini.
OpenAPI artifact regenerated; no schema migration or new financial feature.

### Actual live model checks — separate from fake unit fixtures

Used the existing ignored .env key/model; never printed, embedded or committed the
key. Local LLM_PROVIDER changed to gemini. Model metadata preflight succeeded for
**gemini-3.5-flash-lite**. scripts/check-gemini-live.ts is explicit local-only and
prohibits CI; two synthetic inputs, at most three physical attempts within that
smoke's in-memory caps. Observed artifact: measurements/gemini-live-ux.json.

| Synthetic input          | Actual path | Attempts | Result                              |
| ------------------------ | ----------- | -------- | ----------------------------------- |
| mua mô hình lắp ráp 275k | rules       | 0        | 275000, no clarification            |
| ăn phở 35                | llm         | 1        | null amount, clarification retained |

The real attempt reported 153 input/39 output tokens, total 192. This confirms
connectivity/ambiguity handling, not representative accuracy or a new evaluation
score. Existing dev/held-out datasets were not changed; held-out runs remain 0.
There were additional authorized browser fallback calls below; three is the cap
of this standalone smoke, not a claim about total calls across all verification.
No billing estimate without prices, free-tier assumption or provider speed claim.

### Real container/browser verification

Added opt-in compose.gemini.yaml (API-only key/model, 10/user and 30/global daily
caps). Base Compose remains a credential-free deterministic demo/CI fixture. It is
not the provider used for the real browser results below. Started a separate
sochat-live-ux project on 18081, then applied the final override to existing
sochat-demo at http://localhost:8080. Its database volume/accounts were preserved;
no real user's rows were inspected or deleted. Only own synthetic test/audit users
were removed. The temporary 18081 project's synthetic volume/network were removed;
the delivered 8080 real-provider app remains running for owner review.

Commands (key contents never printed):

```sh
node --env-file=.env --experimental-strip-types scripts/check-gemini-live.ts
SOCHAT_WEB_PORT=18081 docker compose --env-file .env -p sochat-live-ux -f compose.yaml -f compose.gemini.yaml up --build --wait
npx playwright test --config playwright.live.config.ts
SOCHAT_TEST_URL=http://localhost:18081 npx playwright test --config playwright.compose.config.ts
docker compose --env-file .env -p sochat-demo -f compose.yaml -f compose.gemini.yaml up --build --wait
SOCHAT_TEST_URL=http://localhost:8080 npx playwright test --config playwright.compose.config.ts
npm run test:gemini:ui
```

Both seven-journey regression runs passed (15.4 s each) against actual Gemini-backed
APIs, including real ambiguous-input fallback, confirmation retry, budget/goal/
transaction/report/CSV/session/deletion. Rules-first clear cases correctly avoid
model calls. Test accounts were synthetic. The final targeted live smoke passed
1/1 (3.9 s), asserting provider=gemini, path=llm and attempts>0 on
"đóng phí workshop làm gốm 185k"; zero ledger rows before confirmation; grouped paste,
middle-caret edit, persisted amount "185000", 390px no body overflow and disabled
animation under reduced motion. Auth mismatch and visibility controls were checked.
Retained measurements/gemini-live-ui.json reports the final real attempt: 160 input,
116 output, 276 total tokens. It contains no credentials or user identity.

The first targeted browser run failed because Home on macOS did not place the caret
at the input beginning as assumed by the test. Replaced that OS-specific assumption
with explicit DOM caret positioning followed by a real key insertion; the repeated
smoke passed. Failed-run model calls are not represented as free or fake. This was
a test portability correction, not evidence of an unobserved input-code fix.

### Static, unit and database checks

npm run lint, npm run typecheck, npm run api:openapi and production container builds
passed. npm run test:coverage: **202 passed**, 8 files, measured unit-scope lines
79.69% (471/591), statements 79.06%, branches 78.20%, functions 76.28%; retained
Phase 7 gates passed. npm run test:integration -- --coverage: **50 passed**, 3 files;
lines 91.62% (394/430), statements 90.88%, branches 81.22%, functions 95.52%.
These suites use deterministic fixtures, not real-model output, and are not falsely
counted as Gemini tests. Their scopes exclude React/container proxy from line
coverage as previously documented. No dependency version changes or weakened gates.
Tracked-file secret check passed after staging all new files.

### Measured UX follow-up

Lighthouse ran against authenticated synthetic accounts in the actual container
app; it did not trigger extraction/provider generation. Kept prior Phase 5 reports.
First new mobile simulated-throttling run (measurements/lighthouse-ux.json): Chat
86 performance/100 accessibility, Dashboard 88/100; CLS 0.233/0.240. Reserved async
status space and hid the loading footer until content is ready, then measured again:

| Final local page | Performance | Accessibility | LCP   | TBT   | CLS |
| ---------------- | ----------- | ------------- | ----- | ----- | --- |
| Chat             | 98          | 100           | 2.5 s | 0 ms  | 0   |
| Dashboard        | 100         | 100           | 0.8 s | 40 ms | 0   |

Artifact: measurements/lighthouse-ux-final.json; Lighthouse 13.6.0, mobile simulated
throttling, production Vite bundle served by the container. These are single local
runs, not hosted percentiles, manual WCAG certification, a controlled performance
study or proof of ease of use for every age. No model latency/billing is inferred.

Actual desktop/mobile Chat and registration screenshots were captured/visually
inspected in docs/screenshots/ux. They are new review candidates; prior approved
README screenshots were not automatically replaced. No raster generation/external
tracking assets or fonts were added. Reduced-motion and overflow assertions passed.
See UX_REFINEMENT.md for current commands, contract and remaining human/browser
validation. This branch's hosted CI, Safari/Firefox, screen readers, broad-age human
usability and public deployment remain NOT VERIFIED. No new public push/PR/merge.

## 2026-11-03 — Approved staged AI expansion, first read-only slice

Owner grants operational access and asks to approve high-risk actions first. Chosen
stages are recorded in AI_EXPANSION.md and charter: read-only ledger questions,
then conversational draft revision, short voice input, measured semantic retrieval,
and separately reviewed telemetry/RLS. Only the first monthly-query slice ships
here; the other stages are not represented as implemented. Source:
3944406991afe928df4e9d3621758be745f22a52 on feat/playful-ux-gemini.

Added POST /api/assistant/query with existing auth/CSRF/strict message validation,
5/user/minute rate limit and shared daily quota reservation (10/user, 30/global).
Only a Gemini-configured app may call it; CI is prohibited. An 8-second, single-
attempt request sends question/current Vietnam date and a fixed structured-output
schema, never user identity, ledger rows or aggregates. Validated month/category
filters select existing parameterized owner-scoped report queries. Code/SQL calculate
integer totals and generate the answer/evidence URL; no AI SQL, monetary calculation,
financial advice or ledger mutation. Unsupported/multi-month requests are instructed
to clarify. Actual semantic intent accuracy remains unbenchmarked; UI displays the
interpreted filters so users can verify what was queried.

Chat includes Hỏi cuốn sổ, exact VND results and paginated matching transactions as
evidence. This slice supports one month/optional one category; comparative reports,
voice and arbitrary tool execution are not yet supported. API contract regenerated.
No DB migration, new dependency, historical-data transfer or public deployment.

Commands: npm run lint, npm run typecheck, npm run api:openapi, npm test all passed.
Unit: 9 files, **203 passed**. Added schema tests rejecting invalid dates/categories,
SQL and identity fields. npm run test:integration -- --coverage: **52 passed**,
3 files. New HTTP tests prove fake apps cannot invoke live inference, client account
IDs are rejected, two users get 50000 and 900000 independently, clarification/invalid
model filters/CI blocking work, outbound payloads omit private fixture notes/email,
and queries leave the ledger unchanged. Gemini transport is scripted in these
integration tests, not misrepresented as a real-model check.

Integration coverage: lines 91.00% (425/467), statements 90.03% (452/502), branches
81.43% (272/334), functions 94.40% (135/143); existing gates passed unchanged. Added
explicit *.test.ts exclusion to the integration coverage configuration when the
first colocated HTTP unit test would otherwise have been counted as unexecuted
production code. No production files were excluded to inflate a score. Unit suite
coverage was not remeasured for this slice.

Real-provider command:

```sh
npx playwright test --config playwright.query.config.ts
```

Actual Gemini-backed 8080 app with temporary synthetic user/rows. Latest run:
**1 passed**, 2.7 seconds. "Tháng 11 năm 2026 chi ăn uống bao nhiêu?" produced
month=2026-11/category=an_uong. SQL returned expense_vnd="50000", excluded a 90000
transport row, and the evidence table showed only the matching lunch. Ledger stayed
at two rows; finally removed this synthetic account via its authenticated API.
Artifact: measurements/assistant-query-live.json. It is a connectivity/one-example
flow check, not representative accuracy, provider latency benchmark or billing.
No held-out data was accessed, no real user's transactions were inspected or erased.

Rebuilt sochat-demo with the existing real Gemini override at localhost:8080; its
volume/accounts were preserved. New model calls use the already authorized local
credentials, never committed or printed. Hosted CI for this new source, retrieval
quality, other browsers and human usability remain NOT VERIFIED. No new public
push, merge, paid infrastructure or bulk mutation. Future high-risk changes need
owner review as requested.

## 2026-11-03 — Completed local AI/UX expansion, voice removed by owner

Source commits: `2ce021e0946c893608938748eac146f7fc6e63dc` and
`7cd3d94` (strict retrieval output contracts). Branch: feat/playful-ux-gemini.
This is pre-deploy work, not Phase 8 deployment or a new hosted CI result.
Owner explicitly authorized real local Gemini checks, default-off consent for
semantic notes, and RLS only on the Docker demo after a protected backup. Owner
subsequently removed voice from scope: audio controls/endpoint/permission are gone;
007_remove_voice drops its unused column without editing applied migration 006.

Implemented: one composer/history for expense proposals, one-month read questions
and unsaved draft corrections; manual intent override; accurate extraction/edit
provenance; exact code delta arithmetic; explicit idempotent save; evidence links.
Chat history/drafts are page memory; navigation/reload loss is explained. Optional
semantic search has explicit consent and 20-note indexing, 768-dimensional Gemini
embeddings, owner-first bounded exact cosine/keyword ranking, note invalidation,
account/transaction cascades and derived-data deletion on consent revocation.
Portable PostgreSQL arrays are deliberate; pgvector ANN remains deferred until
measured scale/recall need. No model SQL, model arithmetic or autonomous ledger writes.

Final local verification (Node 22.23.4/npm 10.9.4):

| Check                                       | Observed result                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| npm run lint / npm run typecheck            | Passed                                                                                               |
| npm run test:coverage                       | 213 tests; lines 79.69%, statements 79.06%, branches 78.20%, functions 76.28%                        |
| npm run test:integration -- --coverage      | 81 tests; lines 90.76%, statements 90.43%, branches 83.33%, functions 93.54%                         |
| npm run e2e                                 | 18 desktop/mobile journeys passed; includes clearly labeled mocked-transport client state regression |
| default isolated Compose + docker/smoke.mjs | Healthy and smoke passed, no real provider key                                                       |
| playwright.compose.config.ts                | 9 desktop container journeys passed                                                                  |
| OpenAPI generation/retained equality        | Passed generated schema validator and integration equality                                           |
| npm audit --audit-level=high                | No high/critical; 21 moderate development dependency advisories remain                               |
| tracked-file secret-pattern guard           | Passed; bounded patterns, not a full secret audit                                                    |

Coverage gates were not lowered and scopes were not pruned. Integration includes
new tenant, revision and semantic modules. Unit coverage scope remains runtime,
parser/extraction/eval; telemetry exporter has a separate allowlist unit test but
is not included in those historical coverage percentages. Browser V8 character
ranges include dependencies and are not TypeScript line coverage. Mutation check:
changed bigint delta addition to subtraction; revision unit test failed, mutation
was restored. New RLS test also fails closed for client queries outside BEGIN and
destroys a released connection with an open transaction before pool reuse.

Real model evidence: measurements/ai-expansion-live.json verified explicit delta
50000 + 20000 = 70000 with no ledger write and eight-note indexing. Four synthetic
retrieval queries measured keyword-substring top-1 1/4 vs hybrid 3/4; one query
incorrectly ranked tuition above medicine. These tiny author-designed fixtures are
not representative, held-out, confidence estimates or proof of general accuracy.
The real-provider browser continuation passed consent/index/search/revocation with
zero page errors; its report explicitly shows that the question/edit portion was
skipped to conserve quota. Earlier browser attempts reached successful real question,
revision and confirmation assertions before unrelated UI/device checks failed.
The final no-voice build was not rerun through a complete real-provider question/edit
journey: shared daily 30-call cap was reached and was not reset/increased. The exact
API calculation and final client state each have separate real/deterministic evidence.
Historical speech results are labeled pre-removal and are not current feature claims.
CI still uses deterministic provider/transport fixtures and does not call live Gemini.

RLS: a 0600 SQL backup was created outside Git before migrating/enabling policies.
Restoration into a temporary database in the same local cluster succeeded (13 public
tables), then that temporary DB was removed. Ten private tables plus users/categories
have owner policies; the demo runs with the explicit hardening override. Tests cover
missing owner predicates, forbidden foreign-owner writes, error rollback, concurrent
one-connection reuse, and the primary full API fixture under RLS. Native PostgreSQL
was unchanged. Privileged auth/session bootstrap is documented; RLS is not protection
against arbitrary backend/admin compromise. No real owner ledger rows were inspected.

OpenTelemetry: real Node SDK and local trace/metric exporters are enabled. Actual
handler spans were observed with fixed route, method, status and duration. Exporter
redaction test excludes private attributes; automatic HTTP/SQL instrumentation,
resource discovery and external collector are disabled. Scope excludes pre-handler
middleware rejection spans; this is not full distributed tracing across a deployment.

Final no-voice mobile-simulated Lighthouse observation against the authenticated
Docker-served production Vite build: Chat performance 97/accessibility 100;
Dashboard performance 100/accessibility 100. A prohibited aria-label on a generic
conversation div was found and corrected with log semantics before this measurement.
Artifact: measurements/lighthouse-ai-expansion.json. Two local runs, not hosted
performance or manual accessibility certification. Later label/output-contract
changes do not alter the measured initial-page layout; no new performance claim
beyond this observation is made.

New final screenshots are review candidates under screenshots/ux. Existing owner-
approved README screenshots were restored and remain unchanged. The isolated
sochat-predeploy test stack/volume was removed; sochat-demo remains healthy at
http://localhost:8080 with existing data and sessions preserved. Source and evidence
are local only: no new public push, merge, deployment, paid infrastructure, user
study or held-out run. See measurements/ai-expansion-verification.json for the
machine-readable check summary. Phase 8 still needs its owner deployment decision,
real student sessions and the separately authorized final held-out evaluation.

## 2026-11-03 — Daily-entry UI simplification

Removed repeated chat greetings, large illustration, duplicate panel heading and
hidden sidebar markup. Kept a short example and one composer. Provider diagnostics
and manual intent selection now live in a collapsed disclosure; semantic search is
collapsed above the transaction list. No calculation, parser, persistence or consent
policy changed. Mobile composer uses a 16px input font and compact spacing. Added
browser checks for first-screen input/Send visibility and disclosure behavior;
final results are recorded below. This is a concrete usability iteration, not a
claim of user-validated optimal UX. No additional live Gemini calls were made.

Final checks: lint/typecheck passed; 20 desktop/mobile browser journeys passed,
including input/Send in the initial viewport and collapsed advanced controls.
Docker demo rebuilt healthy at localhost:8080 with preserved data. Earlier
Lighthouse scores were not remeasured for this layout iteration. New chat images
are review candidates under screenshots/ux/streamlined-*.

## 2026-11-03 — Owner preferred pre-unification chat

Restored the expense/confirmation layout and separate Hỏi cuốn sổ form from
67d46f7. Retained current money/auth/consent/RLS/backend safeguards. Draft revision
has a separate optional form, with save/edit blocked while a revision is in flight.
No new real Gemini calls; prior unified/streamlined screenshots are historical
review candidates, not the current layout. Final browser results recorded below.

Restoration checks: lint, typecheck and bounded secret guard passed; 18 desktop/mobile
browser journeys passed, including a separate question preserving the pending draft
and a draft revision saved as exactly 70000. Mocked transport in this client regression
is explicitly labeled; no new live provider call was made. Local Docker is healthy.
Current screenshot candidates: screenshots/ux/restored-chat-*.

## 2026-11-03 — Transaction editor, CSV and UI review

Owner reported edit clicks appeared inert and provided a CSV plus UI screenshots.
The editor was rendered above the transaction table without scroll/focus management;
clicks below that area did not visibly bring it into view. Replaced it with a native
modal dialog, bounded to the viewport, keyboard focus/return and Escape cancellation.
Save errors now render inside the dialog; inputs lock while saving. Goal editing
also brings the existing form into view and focuses its first input.

The supplied private CSV was valid UTF-8 with comma quoting/CRLF but lacked a BOM.
Added UTF-8 BOM to server exports, retaining headers, integer VND, ISO dates,
streaming/ownership filters and formula-injection protection. Created a private
0600 BOM-corrected copy outside Git for the owner; no private CSV rows were committed.
Verified BOM bytes from the actual Docker endpoint with a deleted-after-test
synthetic account. Actual Excel/Numbers UI import was not tested; locale-dependent
comma import can still require explicit selection.

Styled previously bare semantic-search buttons, added spacing below filters and
above report sections, aligned report period controls with visible labels, and
prevented requests for incomplete years while typing. The browser download now
attaches/removes its link and delays object URL cleanup.

Validation: lint/typecheck and 81 PostgreSQL integration tests passed with unchanged
coverage gates (90.76% lines). Complete desktop/mobile suite: 20 passed. Additional
modal error/retry regression run after the final in-dialog alert fix: see command
`npm run e2e -- --grep 'editing a scrolled'` (2 desktop/mobile checks). Earlier
browser tests caught a period-label accessibility selector issue and a too-specific
label selector in the new modal test; both corrected. New synthetic screenshots:
screenshots/ux/edit-dialog-desktop.png and edit-dialog-mobile.png. No new real Gemini
calls, no new hosted CI, no claim that all possible UI defects are exhausted.

## 2026-11-03 — Unified action feedback and balanced report controls

Introduced an application-wide feedback provider. Successful saves/edits/deletes,
CSV download preparation, auth actions and AI preference updates use themed toasts;
query/search results, clarification and validation remain contextual data rather
than disappearing notifications. Toasts cap at three, auto-dismiss after seven
seconds, pause on hover or keyboard focus and have explicit dismiss controls.
They persist across page transitions and announce via polite status semantics.

Replaced native browser confirmations for transaction/goal deletion with styled
native dialog popups. Cancel receives initial focus, Escape cancels, focus returns
to the initiating control; no request occurs on cancellation. Enabling semantic AI
requires a themed consent popup with privacy text. Account deletion uses a themed
modal while retaining the typed XÓA requirement and displaying errors inside it.

Report period/month/year controls now use two equal grid columns with identical
52px control height, typography, borders and label baseline, including mobile.
Measured browser geometry checks require equal widths/heights/top positions within
one pixel. Local demo rebuilt healthy; no backend/database/calculation change and
no new real Gemini call.

Checks: lint/typecheck passed; 20 existing desktop/mobile browser journeys passed,
plus two focused desktop/mobile journeys for toast dismissal, Escape cancellation,
unchanged ledger on cancel, consent denial and equal report control geometry.
New real-app synthetic screenshots are review candidates in screenshots/ux:
action-toast-desktop, confirmation-desktop and period-controls-desktop/mobile.
No new hosted CI or human usability certification is claimed.

## 2026-11-03 — Complete monthly budget management

Owner reported missing budget edit/delete actions and an unusable time picker.
Added explicit per-card Sửa hạn mức/Xóa actions. Edit pre-fills and focuses the
existing limit, retains category/month identity, and offers save/cancel. Form
submission locks controls while pending; success uses the shared toast and errors
stay in their action context. Confirmed deletion removes only the authenticated
owner's category/month limit, never ledger transactions or another month/user.

Monthly budgets now have explicit Vietnamese month selection and a year input
(applies on blur or Enter), plus an explanation that limits cover the full month.
This does not introduce daily or arbitrary date-range budgets. Switching periods
while editing requires the shared confirmation popup before discarding the draft.
No schema migration or new Gemini call was needed. Added parameterized repository
DELETE and authenticated, CSRF-protected, validated API route; OpenAPI regenerated.

Validation: lint/typecheck passed. Full desktop/mobile suite: 24 passed. API/PostgreSQL
suite with RLS: 82 passed, coverage 90.83% lines / 90.50% statements / 83.40% branches /
93.61% functions, existing gates unchanged. Tests verify update, delete cancellation,
selected-month deletion, another-month retention, transaction preservation and other
owner isolation. The focused budget browser regression additionally checks canceled
period changes retain unsaved limits and typed years apply via Enter. Docker demo
rebuilt healthy with existing data preserved; no hosted CI/deployment claim.

## 2026-11-03 — Popup-based date selection

Owner approved the browser-native calendar shown in their screenshot. All existing
day inputs (chat confirmation, transaction filters/editor, goal deadline/contribution)
now use a shared CalendarInput that requests the native picker on click. Browsers
without showPicker retain the native input's normal calendar/keyboard behavior;
calendar visuals depend on OS/browser. Date values, required validation and payloads
remain native ISO calendar dates.

Monthly reports use a compact themed popup with month/year choices, explicit Apply
and Cancel/Escape, and focus return. Year-only reports and budget years use dropdowns,
so no year-format typing is necessary. Budget month selection and unsaved-edit
confirmation are preserved. Year choices cover the current year +/-100 and include
an existing selected year outside that window; backend date limits did not change.

The first full run passed 25/26 browser checks; the failure exposed a test-helper
race: text in a question result containing “đã lưu” was mistaken for save completion.
The helper now waits for the actual batch POST response and a specific save toast.
Final rerun results recorded below. No new Gemini calls or database migrations.

Final date-selection verification: 26 desktop/mobile Chromium journeys passed;
lint/typecheck/secret guard passed. The helper also tolerates the decorative toast
checkmark while matching the specific save message. Docker demo is healthy with
existing data preserved. Native OS calendar chrome was not separately automated
on Safari/Firefox; browser-native appearance can differ.

## 2026-11-04 — Business-rule audit completion

See BUSINESS_AUDIT.md for the complete rule matrix, corrected findings and explicit
remaining limits. Owner confirmed future-dated goal contributions count immediately;
this policy is recorded in the charter and shown beside contribution entry.

Corrections: snapshot-consistent monthly/yearly totals/breakdowns; atomic, owner-
scoped contribution idempotency with retained client replay payload; separated income
and expense confirmation totals; actual committed embedding counts; current-owned
row reads after provider work; whole-token lexical matching. Strengthened extraction
safety: unitless/invalid monetary ambiguities retain unresolved rule fields, explicit
invalid dates stay blank, model amounts absent from the message are cleared, and a
single money mention cannot prefill multiple model transactions. Cache reads pass
through the same guards. Reproduced guard failures before fixing them (500000/50000
incorrectly prefilled instead of null, and duplicate model money reuse).

Validation on synthetic data only: final unit coverage suite 215 passed; PostgreSQL/
RLS integration suite 89 passed; browser suite 28 desktop/mobile journeys passed.
Unit coverage: lines 80.13%, statements 79.51%, branches 78.61%, functions 77.22%.
Integration coverage: lines 90.92%, statements 90.60%, branches 84.91%, functions
93.75%; gates unchanged. Concurrency
fixtures modify data from a second connection between report reads, replay two
simultaneous contribution requests, and edit/delete rows during embedding work.
Browser drops a committed contribution response, locks its pending draft and retries
with the same UUID; contribution remains 30000 and ledger remains unchanged.

The initial snapshot regression's final verification queried a nonexistent single-
transaction GET route; corrected to the supported list route. A simultaneous unit
coverage cleanup removed integration's temporary report directory; integration
coverage was recollected sequentially after unit completion. Neither was treated
as business verification success until the final reruns passed.

No new real Gemini call, held-out run or owner ledger inspection was performed.
No schema migration was needed. Existing demo data is preserved. Contribution API
now requires a UUID replay key; reload an old web tab to load the matching client.
Goal creation metadata is still non-idempotent, pending client intent is memory-only,
concurrent same-account forms remain last-write-wins, and streamed CSV is not a
point-in-time snapshot. These limits are explicit in BUSINESS_AUDIT.md; this audit
is not an unconditional production-readiness or real-user AI accuracy claim.

Audited source commit: `6d98e3fc0e5162ec0eabbf1d63da87dbcd4a02ff`. Machine-readable validation summary:
measurements/business-audit.json. Local demo was rebuilt healthy with this source.

## 2026-11-04 — Production-hardening follow-up and owner dev evaluation

Code commit: `55513465c7831e1dfeb86e29bc1ade1a02a5100d`. The final dev probe
recorded a dirty tree containing only `compose.gemini.yaml` (the matching explicit
v2 deployment profile); parser/provider/API code matched that commit. Aggregate
record: measurements/production-hardening.json. Raw owner labels/predictions remain
private under ignored `.local/owner-dev` with owner-only permissions.

Closed the audit's three concrete implementation gaps: atomic owner-scoped goal
creation UUID replay with payload conflicts and a reload recovery receipt; required
optimistic versions on transaction/goal mutations and opaque budget id:version
checks including delete/recreate; a single read-only repeatable-read snapshot for
all CSV pages. Export response and individual queries have 30-second bounds. An
interrupted consumer rolls back/releases its snapshot. Old web clients must reload.
Goal reload recovery stores only a UUID, not the financial draft, in sessionStorage.
Transaction/contribution in-page retry payloads remain memory-only; no offline
outbox is claimed.

Final local checks: `npm run test:coverage` **246 passed**; `npm run
test:integration -- --coverage` **95 passed** against isolated PostgreSQL 18/RLS;
`npm run e2e` **34 passed** across desktop/mobile Chromium; `npm run
test:gemini:ui` **1 passed** against the upgraded Docker demo and real Gemini.
Unit coverage: lines 80.96%, statements 80.31%, branches 80.98%, functions 78.89%.
Integration: lines 91.38%, statements 90.86%, branches 84.95%, functions 93.75%.
Existing thresholds are unchanged. Lint/typecheck/OpenAPI generation/secret guard
and `git diff --check` passed. `npm audit --omit=dev --json`: **0 advisories**
observed at this run; this does not include development dependencies or promise
future advisory status. Browser JS-range measurement includes dependencies and is
not source/test branch coverage; retain its measured value without quality claims.

New regressions cover concurrent UUID creates, changed payloads, owner isolation,
recovery after deletion/reload, stale updates/deletes across all three entities,
budget ABA, 500-row export pagination during concurrent edit/insert, and snapshot
cleanup after consumer failure. Browser drops committed responses, retries, reloads
and opens two same-account tabs. Mutation proof: deliberately omitted money profile
from the extraction cache key; the profile-isolation regression failed (1 failed,
49 skipped), restored the code and reran the focused check (1 passed). Final full
unit suite passed after all changes. No mutation remains.

### Real owner development data (never held out)

Owner explicitly approved sending the 50 supplied phrases to Gemini and approved
the private labels, with cành=100000 VND. Under the previous missing-unit-asks
policy, the stored baseline scored **22/50 exact**, and the improved v1 profile
scored **49/50 exact**. The remaining mismatch was a label assigning 25000 to
“cf sáng 25” despite that policy. The owner then explicitly revised the convention:
bare monetary 1=1000, 10=10000, 100=100000. V2 implements this for 1–999, excluding
quantities/calendar/time and preserving literal four-digit/grouped VND values.
Twelve formerly unresolved labels were revised under that owner policy. Prior
labels/results are retained; do not portray v1→v2 as an unchanged-gold comparison.

Final real hybrid probe, `--tag verified-v2`, model `gemini-3.5-flash-lite`, injected
Vietnam date 2026-11-03: **50/50 exact cases; 55/55 each amount/category/date/type**.
**48 rules paths, 2 real Gemini generation attempts**; 814 input + 454 output =
1268 observed tokens, 3687 ms whole-run elapsed. These are hybrid results, not
50 independent LLM predictions. This same dev set informed tuning. V2 contains no
positive clarification labels; precision/recall are **n/a**, not 100%. Ambiguity
safety is covered separately by deterministic adversarial/unit tests. No billing
estimate without supplied current prices, representative-user claim or held-out
result is made. All intermediate local probes retained separate run names.

Live Docker smoke used a disposable synthetic account and real fallback (1 attempt,
492 observed tokens). It verified shorthand, version increments/stale 409, goal
replay/recovery, CSV, no automatic save, auth/money controls and responsive/reduced-
motion behavior, then deleted the account. screenshots/ux contains the new synthetic
captures; owner-approved README screenshots were preserved.

Before migration 008, created a private mode-0600 Docker `pg_dump -Fc` archive and
parsed the complete archive with `pg_restore -f /dev/null`. This is structural
verification, not a new restore rehearsal. Compose rebuilt healthy with existing
volume retained; migration metadata, Gemini v2 profile and RLS=true were checked
without inspecting owner ledger rows. Native PostgreSQL remained unchanged. No
public push, hosted CI, deployment, final held-out run or student interviews were
performed. Host TLS/secrets/backups/load, representative AI/user validation and
native spreadsheet/non-Chromium behavior remain Phase 8 work.

## 2026-11-04 — Phase 8 local deployment preparation

Code candidate: `0bc02c95a14bf5674c5c8448c024395c878116ba` on `codex/phase-8`.
Owner selected **Render Free combined Web/API + Neon Free PostgreSQL 18** after
considering Vercel and single-platform expiry limits. No Vercel config remains.
Machine-readable record: measurements/phase8-preparation.json. This prepares Phase 8;
it does not establish a live demo URL, hosted CI, user-study or held-out result.

Added a non-root combined image, optional static serving within the HTTPS/origin
middleware, immutable hashed-asset caching, provider PORT healthcheck and Render's
documented external-origin fallback when RENDER=true. Blueprint is free-only,
manual deployment, generated session secret, fresh Neon URL/key entered privately;
no managed database or paid fallback. Managed-host RLS remains an explicit separate
admin opt-in (false in the initial cloud profile); existing Docker RLS is unchanged.
The current privileged FORCE RLS script must not be applied blindly to a managed
non-superuser account. API ownership checks remain tested regardless of RLS.

Privacy: Docker context excludes ignored `.local`/env data and the owner inbox.
No local owner/demo ledger is a seed source. Non-JSON upstream startup replies now
produce a friendly retry message. No paid plan, public resource, secret upload or
real Gemini generation was performed during this preparation. Free model pricing
was checked in Google's documentation; the existing key's actual project tier was
not inspected or assumed. Provider limits, cold starts and hosted acceptance are
recorded in DEPLOYMENT.md.

Local checks actually run: lint/typecheck/OpenAPI drift/secret-pattern checks passed;
**248 unit tests**, **96 PostgreSQL integration tests**, **36 desktop/mobile browser
journeys**, **2 local production-mode HTTPS browser journeys** passed. Unit coverage:
lines 80.87%, statements 80.22%, branches 80.88%, functions 78.89%. Integration:
lines 91.57%, statements 91.03%, branches 85.08%, functions 94.25%. Gates unchanged.
Standard-profile rules and scripted hybrid seed dev CLI reports also passed in
/private/tmp; those scripted results are not real Gemini performance.

The HTTPS rehearsal uses ephemeral local self-signed TLS termination, isolated
PostgreSQL 18 and a NOSUPERUSER/NOBYPASSRLS DB owner. Final run derives the exact
origin from simulated Render metadata, serves React+API through the combined image,
checks browser Secure/HttpOnly/SameSite cookies across reload, shorthand, confirmed
versioned writes, stale 409, owned CSV and test-account deletion on desktop/mobile.
It is not a public Render certificate, Neon TLS or hosted latency measurement.

A real synthetic backup/restore rehearsal dumped the disposable DB with `pg_dump
-Fc` to a mode-0600 archive, restored into a separate DB using `--no-owner --no-acl`,
and verified one fixture transaction totaling exactly 35123 VND. No native or owner
DB was touched. After final browser checks the isolated rehearsal containers/volumes
were removed; the original sochat-demo's three containers remained healthy.
Hosted restore/retention is still an owner deployment check, not inferred from this.

Current full npm audit: **0 high/critical, 21 moderate**; the high/critical CI gate
passes, but no claim of zero advisories across all dependencies. Digest-pinned
Trivy 0.75.0 on a git archive of the exact code candidate returned **0 HIGH/CRITICAL
vulnerabilities, secrets and misconfigurations** in its filesystem scope (exit 0).
This excludes ignored credentials/private evaluation data and is not an image OS
scan, penetration test or hosted security certification. Render Blueprint passed
structural validation against https://render.com/schema/render.yaml.json with the
already installed Ajv 2020 implementation; optional format assertions disabled.
This is not a Render provisioning/API acceptance result.

Evaluation harness now applies/records MONEY_PROFILE consistently in rules and
hybrid CLI runs, preventing an accidental standard-versus-v2 policy mismatch in a
future held-out run. Regression uses one synthetic dev case only; mutation removed
the hybrid profile forwarding and failed as expected (1 failed, 1 passed, 2 skipped),
then restoration passed both profile checks (2 passed, 2 skipped). No mutation remains.
An initial retry browser regression targeted “Thử lại” instead of the actual “Thử
tải lại”; corrected the selector, then the full 36-journey suite passed. Typecheck
caught optional-property typing at the new server hook; fixed before acceptance.

Prepared USER_TESTING.md, private-session template, untouched held-out protocol and
a <=2-minute real UI recording script. There are **0 student sessions, 0 held-out
runs, no quotes and no recorded video** from this phase. Original tuned owner 50-case
dev set is never relabeled as held-out. Production-mode browser checks use synthetic
scripted provider behavior, not fake model-accuracy claims.

Read-only GitHub inspection found only the older open Phase 7 draft PR #12 and no
PR-triggered run for the preceding pre-deploy evidence commit; this does not prove
latest hosted CI. New candidate publication/CI and public deployment await the
owner's concrete approval/account access. Main was not merged and no draft PR was
closed. Phase 8 remains IN PROGRESS until actual hosted/user/held-out evidence exists.

### Phase 8 publication and CI fixture correction

Owner explicitly approved pushing codex/phase-8 and creating draft PR #13:
https://github.com/Krezzy88/sochat/pull/13. No merge or cloud deployment. The first
run https://github.com/Krezzy88/sochat/actions/runs/41773965546 was superseded/
cancelled when the branch synchronized the owner's already-published MIT LICENSE
from main commit 71cd17f. README/package metadata now reflects that owner decision.

Run https://github.com/Krezzy88/sochat/actions/runs/41774132561 on a0bb3bd passed
Trivy, lint/type/unit, integration, dev evaluation and the desktop/mobile suite,
but FAILED the expanded Compose browser stage: ten initial actors passed, then
all eight later registrations failed. The production default limits registration
to ten per IP/window; the expanded suite intentionally creates eighteen actors
behind one proxy IP. Do not describe this run as successful or raise app limits.

Correction is runner-only: explicit SOCHAT_COMPOSE_FIXTURE=sochat-ci resets anonymous
rate counters before each synthetic actor. Fixed localhost:18080, project name and
Docker label checks prevent targeting the owner demo/hosted app. No product flag,
API reset endpoint, quota increase or ledger-row deletion was added. Without opt-in
no Docker/DB operation occurs. Four guard regressions reject unintended targets.

Follow-up local verification: **252 unit tests**, lint/typecheck and the complete
**18 Compose browser journeys** passed; unit coverage/gates unchanged. Existing
monetary/RLS integration and production throttle checks remain intact. Rehearsal
used only a disposable sochat-ci stack; generated screenshots were kept privately,
not substituted for owner-approved README images. Hosted rerun is pending for this
fix; public HTTPS/Neon/Gemini Free Tier/held-out/student gates are still unverified.

### Phase 8 hosted CI and public deployment verification — 2026-11-04

Hosted CI finally PASSED both jobs for 7586e2d84ee0954980f11a18f363bcd24a1230af:
https://github.com/Krezzy88/sochat/actions/runs/41783820913. This includes the fixed
18-actor Compose fixture and two production-mode HTTPS checks; earlier failed/
cancelled attempts remain documented above. Draft PR #13 stays open, not merged.
The owner deployed https://sochat.onrender.com and explicitly confirmed its Live
commit is the same 7586e2d. CI source and deployed source therefore match.

Owner-provided Render log shows successful migrations, API start on port 10000 and
Live status. Independent HTTPS GET /healthz returned 200 with status=ok; root returned
200 with TLS verification successful. A public browser smoke used one disposable
synthetic actor: registration, Secure/HttpOnly/SameSite=Lax session across reload,
rules-only “phở 35” => 35000, no persistence before confirmation, actual UI edit to
45000, version increment/stale 409, SQL net=-45000, goal UUID replay, owned no-store
CSV and 390px layout all passed. Its account deletion/401 cleanup was verified.
Report: measurements/hosted-http-smoke.json. This run made zero model attempts.

The owner then confirmed the key is Paid Tier 1 and explicitly allowed real paid
hosted testing. No billing setting or daily quota was changed, and no Free Tier or
zero-cost API claim is made. The existing three real-provider browser cases ran
against the public URL, with retries=0 in the test runner and only synthetic data:

- Extraction/auth/money/confirmation/version/goal replay/CSV/mobile/reduced-motion
  smoke passed. Actual extraction path=llm, attempts=1, 405 input + 87 output =
  492 observed tokens, needs_clarification=false; human-confirmed amount 185000.
- Read-only question smoke interpreted November 2026 + food, SQL returned exactly
  50000, evidence excluded the 90000 transport row, and the two saved rows remained
  unchanged. The model never received authority to generate SQL or ledger totals.
- Expansion smoke excluded unsaved drafts from query totals, interpreted a +20000
  draft correction, code produced exactly 70000, exercised explicit semantic opt-in,
  real indexing/search, revocation UI and mobile layout; no page errors observed.

All **3 passed in 28.4 seconds**. Each case used a fresh synthetic actor and invoked
account cleanup in finally; the expansion case asserts deletion status 204. No
owner ledger or key was read/sent. Semantic search had one indexed synthetic note:
this is feature plumbing/consent verification, not representative ranking quality.
The question and revision outputs are also author-designed smoke cases, not a new
held-out evaluation. Only extraction exposed token usage; do not infer a whole-suite
billing total. Reports: hosted-gemini-ui.json, hosted-query.json,
hosted-expansion-ui.json in measurements/. Raw browser captures were kept privately;
historical local measurements and owner-approved README screenshots were restored.

Remaining gates are honest: no new untouched held-out set/run, no five-student
observations/quotes, no recorded demo video and no restore from the actual hosted
Neon database. Local synthetic restore success is not substituted for hosted
recovery. See USER_TESTING.md and release/HELDOUT_PROTOCOL.md for owner participation.
Deployment/smoke verification is complete; Phase 8 overall remains IN PROGRESS.

Private `.local` owner data and one-off verification artifacts are now excluded
from ESLint/Prettier consistently with git/Docker ignores. This does not exclude
production code or change measured coverage scopes/gates. Final lint/typecheck and
tracked-file secret checks passed before recording hosted evidence.
