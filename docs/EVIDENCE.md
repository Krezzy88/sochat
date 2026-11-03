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
