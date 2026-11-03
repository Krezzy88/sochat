# Threat model

Assets: passwords, session/CSRF tokens, transaction notes, amounts, account identity,
provider credentials and quota. Actors: unauthenticated visitors, authenticated
users attempting cross-account access, malicious message authors and dependency
attackers. Browser → Express → PostgreSQL; Express → Gemini only for extraction.

| Threat                              | Existing mitigation                                                                           | Residual risk                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Account takeover                    | argon2id, generic login errors, IP/email throttles, rotated sessions                          | No MFA/reset flow in MVP; upstream abuse protection needed for public hosting |
| IDOR / SQL injection                | Parameterized queries, owner predicates, 404, two-user tests                                  | Application predicates are essential; RLS is not enabled                      |
| CSRF / session theft                | Synchronizer token on writes, origin checks, httpOnly/Lax cookies, Secure/HTTPS in production | Trusted proxy configuration and TLS require deployment verification           |
| XSS / CSV formulas                  | React text escaping, no raw HTML rendering, CSV quoting/formula protection, Helmet            | Dependency compromise remains possible                                        |
| Prompt injection / invented amounts | Fixed system prompt, schema/date/source-number guards, explicit confirmation                  | Extraction can still be wrong; never bypass human review                      |
| Data disclosure through logs        | Operational metrics only, generic HTTP/DB errors, redaction regression tests                  | Infrastructure access logs need separate deployment review                    |
| Resource exhaustion                 | JSON/text bounds, caps/timeouts, PostgreSQL throttles                                         | Application throttles are not network DDoS protection                         |
| Dependency compromise               | Lockfile, audit, Dependabot, CI secret-pattern check                                          | Moderate development-tool advisories remain tracked                           |

Account deletion cascades across user-owned tables, including sessions on other
devices, cache, usage, confirmation and rate state. Integration tests enumerate
all public user_id columns. Aggregate global provider counters have no user ID.
Do not log request bodies, credentials or raw provider/SQL errors. Demo uses
synthetic data only. Public-host TLS, backups, access control and log retention are
not verified by local tests. RLS is an owner-decided stretch and remains deferred.
