# Documentation

Start with the repository README for setup and product scope.

| Topic                         | Documents                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture and behavior     | [API](API.md), [Web](WEB.md), [Parser](PARSER.md), [Extraction](EXTRACTION.md)                                                                                |
| Security and privacy          | [Privacy](PRIVACY.md), [Threat model](THREAT_MODEL.md)                                                                                                        |
| Operations                    | [Deployment](DEPLOYMENT.md), [Runbook](RUNBOOK.md), [Authentication](release/AUTH_SETUP.md)                                                                   |
| Release status and validation | [1.0 plan](release/V1_PLAN.md), [Evidence](EVIDENCE.md), [User testing](USER_TESTING.md)                                                                      |
| Historical context            | [Decisions](DECISIONS.md), [Business audit](BUSINESS_AUDIT.md), [Evidence archive](archive/EVIDENCE_HISTORY.md), [Previous README](archive/README_HISTORY.md) |

`measurements/` contains recorded metrics; `screenshots/` contains reviewed visual
artifacts. `agent/` preserves project references. Historical records are retained
for traceability and should not be treated as current operating instructions.

Test configuration lives in `config/testing/`. Run checks through npm scripts.
Use `npm run clean` to remove reproducible local build/test outputs. Credentials,
private owner files and backup archives under `.local/` are deliberately preserved.
