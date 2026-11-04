# Test configuration

Run from the repository root using npm scripts:

- `npm test`: deterministic unit tests.
- `npm run test:coverage`: unit coverage.
- `npm run test:integration`: isolated PostgreSQL integration tests (Docker).
- `npm run e2e`: desktop/mobile browser journeys (Docker).
- `npm run test:gemini:ui`: explicitly authorized real-provider browser checks.

Other Playwright profiles use `npx playwright test --config config/testing/<file>`.
Listing tests with `--list` does not execute them. Live profiles are never part of
ordinary CI. Root Compose/Render/TypeScript files stay at their tool-default paths.
