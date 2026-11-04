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

## AI expansion and tenant RLS (2026-11-03)

Optional embedding transmission requires authenticated, CSRF-protected,
server-enforced per-account consent, default off. Model outputs use strict schemas.
Provider calls share the daily 10/user, 30/global budget and have route throttles/
timeouts; no automatic unbounded indexing/retries. Voice input, microphone
permission and the audio endpoint were removed before deployment at owner request.

Embeddings are indexed/queried only after owner filtering. Exact cosine and lexical
ranking operate on at most 1,000 owned notes; no global vector search then filtering.
Foreign keys bind each vector to its owner/transaction. Note updates invalidate
vectors. Disabling consent locks the preference row against concurrent indexing
commit and deletes existing vectors. In-flight transmitted data cannot be recalled.
Filtering is not anonymization. Unicode/novel credential formats and personal names
may survive; users must review what they put in notes and opt in knowingly.

`db/enable-rls.sql` is a separate administrator action, not a normal/native migration.
Authenticated handlers use a restricted NOLOGIN/NOBYPASSRLS role with transaction-
local owner context. Private tables enforce both USING/WITH CHECK; built-in categories
are readable. Tests intentionally omit ownership predicates, attempt foreign-owner
writes, fail transactions and reuse a one-connection pool concurrently. The complete
primary API integration fixture also runs under RLS. Missing predicates should fail
closed; RLS does not defend against a compromised backend choosing an arbitrary
owner context or direct database administrator access. Session/auth bootstrap and
global anonymous quota maintenance retain the privileged pool, with fixed queries.

The Docker demo was backed up before changes; native PostgreSQL was not modified.
Do not enable the application flag without first installing the policies/role.
Rollback disables the opt-in application role flag; preserve data and investigate,
rather than dropping policies or restoring an old backup over current writes.
