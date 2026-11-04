# Backlog and owner decisions

## Open owner decisions

- Confirm the final product/repository name (working names: SổChat / `sochat`).
- License selection resolved: owner added MIT on main (commit 71cd17f); metadata aligned.
- Choose the Gemini model or delegate selection; verify current official support
  in Phase 3. Keep `GEMINI_MODEL` blank until then.
- Choose demo hosting before deployment; use synthetic demo data only.
- Owner supplied 50 unlabeled dev phrasing candidates on 2026-11-03; see
  eval/inbox. Confirm slang/abbreviation meanings, unitless-number policy and gold
  labels before evaluation. Collection provenance is not verified. Target at least
  200 labeled examples, with at least 50 held out before tuning.

## Clarifications to resolve before the relevant phase

- Development dependencies: `npm audit` reports 11 moderate dependency entries
  stemming from minimatch advisory GHSA-g3hv-75wg-m249; no high/critical findings.
  Revisit upstream fixes during security hardening. Do not apply the suggested
  incompatible downgrade/force fix blindly. See `EVIDENCE.md`.
  Phase 4 clean `npm ci` now reports 18 moderate entries after adding the HTTP and
  OpenAPI toolchain. Review the current advisory tree in Phase 6; the historical
  11-entry result is not the current dependency count. Phase 5 installation reports
  21 moderate entries after browser/audit tooling; review current advisories in Phase 6.
- Phase 2/3 cache ownership/date identity is resolved by ADR-009/011. Cache expiration
  is lazy; review physical purge scheduling and usage-counter retention in Phase 6.
  API pool statement/query timeouts were configured in Phase 4.
- Phase 4: CSV is the charter's required export; JSON export and custom-category
  management mentioned in references are not automatic additions to the MVP.
- Phase 5: savings goals remain in the MVP. The charter's optional schedule-cut
  suggestion requires an owner decision before scope changes.

## Out of scope for v1

Receipt OCR, bank/e-wallet integration, tax/investment functionality, multi-currency,
shared wallets, native mobile apps, push notifications and AI financial advice.
These are recorded for context only; none is authorized for implementation.

## Phase 5 measured follow-ups

- Local mobile Lighthouse shows layout shift during asynchronous startup/loading
  (Chat CLS 0.179, Dashboard 0.210). Consider stable loading placeholders if further
  performance work is authorized; these are local single-run measurements.
- Safari/Firefox, real-device and screen-reader validation remain unverified.
- Confirmation retries preserve their key only while the Chat component is mounted.
  A durable offline queue is outside MVP; inspect saved transactions after leaving
  an uncertain request rather than entering a duplicate as a new confirmation.
