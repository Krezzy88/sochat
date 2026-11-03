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
