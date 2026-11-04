# Owner-approved pre-deploy refinement

The owner approved a playful 2D style, clear grouped VND entry, completion of the
existing auth UX, visible extraction provenance and agent-run real Gemini local
smokes on 2026-11-03. Email verification/password reset remain outside this scope.
Public deployment still requires the Phase 8 gate.

## Running the actual model locally

Keep GEMINI_API_KEY/GEMINI_MODEL in the ignored .env; never send keys in chat,
VITE_* variables, commits, full authenticated audit reports or command arguments.
The local provider has been set to gemini. For the container app:

```sh
docker compose --env-file .env -f compose.yaml -f compose.gemini.yaml up --build --wait
# http://localhost:8080
```

The override passes credentials only to API, opts into Gemini, and sets daily caps
10/user and 30/global. Existing confirmation, number/date guards, timeouts, cache
and quotas stay enabled. It does not force model calls for clear rule-resolved
messages. GET /api/chat/status is authenticated and returns provider kind only.
Parse responses explicitly identify provider and rules/llm/cache path. UI labels
reflect this provenance and distinguish failed fallback from rules-only success.

Base compose.yaml deliberately remains a credential-free FakeProvider test/demo
configuration. Real local verification uses the explicit override above. CI uses
scripted providers for deterministic failures, never silently presented as a real
model result. No Gemini key is copied into CI or the web image.

```sh
npm run check:gemini:live
npm run test:gemini:ui
# Optional different already-running live URL:
SOCHAT_LIVE_TEST_URL=http://localhost:18081 npm run test:gemini:ui
```

Live checks are explicit local commands, excluded from normal CI discovery. The
small smoke uses two synthetic inputs with at most three physical attempts total;
the browser smoke uses a synthetic user, verifies actual llm provenance, tests
editable grouped money and deletes only its account. These are not a representative
accuracy benchmark or held-out evaluation. Usage is measured; billed cost remains
unknown without pricing. Existing owner evaluation artifacts are preserved.

## UX contract

A code-native SVG notebook mascot, soft stickers, solid outlines and small bob/
blink/wave movements provide the 2D identity. Main task names, validation and
security text stay plain Vietnamese. No joke blames users for spending. Reduced
motion disables animations; larger labels and table alternatives remain available.
Loading-state footer/status layout is reserved to avoid async layout jumps.

Money inputs display grouped integer VND (3.500.000), accept grouped paste and
preserve digit-relative caret positions. Hidden form values and callbacks send
ungrouped integers; no float arithmetic is introduced. Zero, negative, non-integer
and >100 billion values remain rejected by UI/API. Form reset clears local draft
values. The visible currency unit/hint remains next to every amount field.

Auth supports password visibility, confirmation, 12–128 character rules, native
required/email validation with Vietnamese guidance, whitespace-only name rejection
and clear registration-conflict/throttle errors. Confirmation is client-only and
never sent to the strict API schema. Password manager/paste/space support remains;
no arbitrary uppercase/symbol requirement. Session/CSRF/hashing/isolation unchanged.

The running 8080 app was rebuilt using the real override without deleting its
PostgreSQL volume. Only temporary synthetic audit/test accounts were deleted. The
separate 18081 test stack is disposable and removed after verification. No real
user accounts, messages or transactions were inspected for these checks.

New screenshots are review candidates under docs/screenshots/ux. Existing README
screenshots retain their prior owner approval; new images are not automatically
substituted without review. Human usability across ages, assistive technology,
Safari/Firefox and public deployment still need verification.
