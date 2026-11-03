# Backlog and owner decisions

## Open owner decisions

- Confirm the final product/repository name (working names: SổChat / `sochat`).
- Choose the license (MIT suggested; currently `UNLICENSED`).
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
- Phase 2/3 cache ownership/date identity is resolved by ADR-009/011. Cache expiration
  is lazy; review physical purge scheduling and usage-counter retention in Phase 6.
  Configure API pool statement/query timeouts during Phase 4.
- Phase 4: CSV is the charter's required export; JSON export and custom-category
  management mentioned in references are not automatic additions to the MVP.
- Phase 5: savings goals remain in the MVP. The charter's optional schedule-cut
  suggestion requires an owner decision before scope changes.

## Out of scope for v1

Receipt OCR, bank/e-wallet integration, tax/investment functionality, multi-currency,
shared wallets, native mobile apps, push notifications and AI financial advice.
These are recorded for context only; none is authorized for implementation.
