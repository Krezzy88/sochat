# Phase 4 API

The Phase 5 React UI now consumes this API; see WEB.md. Phase 4 provides HTTP endpoints,
OpenAPI, authentication and persisted application logic. No new Gemini evaluation is
required to run the API in fake mode.

## Local run

Use the pinned Node 22.23.4 and npm 10.9.4 (`nvm install && nvm use`). Node 22 below
22.19 is now rejected because the OpenAPI validator requires 22.19+. PostgreSQL 18
and the local DATABASE_URL are already configured. Keep .env ignored and never send
credentials in chat. Set SESSION_SECRET to at least 32 random characters, not the
example placeholder. APP_ORIGIN defaults to http://localhost:5173 (Vite UI).

```sh
npm ci
npm run db:migrate
LLM_PROVIDER=fake npm run api:start
```

The API binds to 127.0.0.1:3000. GET /healthz returns status ok. GET /openapi.json
serves the contract; canonical generated artifact is apps/api/openapi.json.
`npm run api:openapi` regenerates it without connecting to PostgreSQL or Gemini.
`npm run test:integration` runs isolated PostgreSQL 18 HTTP/database suites with
FakeProvider; it never touches local user data. CI also runs these suites.

To enable Gemini later, deliberately configure LLM_PROVIDER=gemini and a current
GEMINI_MODEL/key locally. Startup performs a real model metadata preflight and parse
fallbacks can consume quota/cost. Phase 4 agent smoke checks use fake only.

## Client flow

1. GET /api/auth/csrf with credentials. Keep returned csrf_token in memory.
2. POST /api/auth/register or login as JSON with the cookie and X-CSRF-Token.
   Registration fields: email, password (12..128 chars), display_name. Login fields:
   email and password. Successful auth rotates the session and returns user and a
   **new** csrf_token. Use the new token for subsequent writes.
3. POST /api/chat/parse with message only. It returns editable proposals and flags;
   it does not insert ledger rows. Do not send identity or client-controlled time.
4. After the user confirms, POST /api/transactions/batch with items and a fresh UUID
   idempotency_key. Each item has type, category (technical key), amount_vnd, note
   and occurred_on. Strip parser confidence/flags/metadata; null amounts/dates must
   be resolved before save. Retries reuse the same key and semantic payload. Different
   payload under an existing key returns 409. Max 10 items per batch, all-or-nothing.
5. GET /api/me refreshes the profile and current CSRF token. Logout/account deletion
   destroy the session; the next login starts again with a new anonymous CSRF token.

All private routes require a valid session and existing user. All writes require
CSRF, including DELETE and login/register. Wrong Origin returns 403; another user's
resource ID/category returns 404. Unknown input fields, invalid calendar dates,
amounts outside 1..1e11 VND and malformed IDs/cursors return problem+json. Body limit
is 16 KiB. HTTPS, Secure cookies and an HTTPS APP_ORIGIN are mandatory in production.
Only configure TRUST_PROXY_HOPS when requests pass through that many trusted proxies.
It defaults to zero; tests prove forwarded IP headers cannot bypass default limits.

## Endpoint behavior

The complete method/path/input/output contract is in openapi.json. Main groups:

- Auth register/login/logout, anonymous CSRF bootstrap, me and account deletion.
- Categories: system plus owned categories; no category-management API is added.
- Transactions: batch confirmation, cursor list, PATCH/DELETE by id. List supports
  from/to (inclusive), category, type, cursor and limit 1..100. Sort is calendar date
  descending then numeric id descending. Opaque cursors are validated; they are not
  authorization tokens. Every page still filters by the authenticated owner.
- Month/year reports: exact totals, category groups, daily/monthly series and top
  expense notes; missing series entries are omitted, for the UI to fill as needed.
- Monthly budgets: GET/PUT and status. PUT upserts supplied category budgets
  atomically; omitted categories are left unchanged. Duplicate categories are invalid.
  Warning at >=80%, exceeded at >=100%; remaining is clamped at zero.
- Goals: GET list/item, POST/PATCH/DELETE and contributions. Contributions are separate
  progress records, not automatically created ledger transactions. Daily savings uses
  ceiling division of remaining integer VND by days left; completed goals return 0,
  and unfinished goals with expired/today deadlines return null. Progress is integer
  basis points capped at 10000. Contributions beyond target are allowed.
- GET /api/me/export streams all owned transactions as CSV in 500-row keyset chunks.
  It includes integer VND and escapes quotes/newlines/formula prefixes. This export
  is transactions-only, not a full account archive; no JSON/zip export is added.
  Concurrent edits/inserts may affect later chunks; it is not a point-in-time snapshot.

Saved money, sums and remaining values are decimal strings in JSON. Requests accept
safe integer numbers or decimal strings. Parse proposals retain bounded integer
numbers. All arithmetic for VND uses bigint/SQL; floats are not used for money.
Only bounded integer percentages/day counts are converted to JavaScript numbers.

Default throttles: CSRF bootstrap 60/IP/minute, register 10/IP/10 minutes, login
10/IP+email/10 minutes plus 50/IP/10 minutes, parse 20/user/minute and CSV export
3/user/minute. 429 includes Retry-After. Counts persist across restarts. Idempotency
records are retained until account deletion; later retention policy work must not
silently invalidate the retry guarantee. Session cookie TTL is 7 days; expired
session pruning is enabled in production, disabled for isolated tests/development.

## Tests and limitations

HTTP tests exercise real session storage, password hashing, CSRF, production cookie
flags, throttles, idempotency/concurrent retries, validation, cursor ordering,
correct report/budget/goal arithmetic, CSV protection and two-user isolation. Dynamic
account-deletion assertions cover every public table with user_id, including sessions,
idempotency/cache/usage/rate state. OpenAPI is generated and validated in tests.

No email verification/reset-password, OCR, bank linking, shared wallets, investment
or tax functionality is implemented. Security/privacy hardening remain later phases; Phase 5 now provides the React UI and Chromium e2e. Deployment and full security review are
later work; deployment proxy/HTTPS and hosted CI are not claimed verified locally.
