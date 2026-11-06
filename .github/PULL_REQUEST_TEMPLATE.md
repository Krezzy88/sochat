## Summary

- Describe the user-facing or architectural change and why it is needed.

## Engineering & Safety Boundaries

- [ ] No floating-point money calculations introduced (`BigInt` / integer VND preserved end-to-end).
- [ ] AI never writes directly to PostgreSQL, generates SQL, or computes financial totals.
- [ ] OpenAPI specification (`apps/api/openapi.json`) regenerated if HTTP contracts changed (`npm run api:openapi`).

## Verification

- [ ] `npm run lint` & `npm run typecheck`
- [ ] `npm run test:coverage`
- [ ] `npm run test:integration`
- [ ] `npm run e2e`
