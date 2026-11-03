# Approved AI expansion — 2026-11-03

Owner authorizes implementation and real local Gemini testing, requesting approval
before high-risk actions. Deliver incrementally before public deployment:

1. Read-only natural-language questions with typed intents, allowlisted SQL, exact
   code-generated totals, visible filters and links to supporting transactions.
2. Multi-turn draft corrections, explicit human confirmation and idempotent saves.
3. Voice was explored/tested, then removed at the owner’s request before deploy.
4. Semantic/keyword hybrid search only after a labeled retrieval baseline justifies
   embeddings/pgvector. Include per-user filtering and deletion of derived data.
5. OpenTelemetry with operational metadata only, and separately tested PostgreSQL
   RLS with pool/session isolation. Introduce neither as an unverified badge.

Do not send ledger history/aggregates to Gemini for narrative generation without
explicit privacy review. First read-only questions send only the question/current
date: Gemini extracts filters, backend executes fixed owner-scoped queries and
renders answers. No model-authored SQL or arithmetic. Ambiguous/out-of-scope
questions require clarification. No autonomous financial advice, bulk write/delete,
public deployment, paid infrastructure or production data migration without review.
These stages extend the original extraction-only charter; they are planned, not
all shipped. Each stage needs synthetic real-provider checks and deterministic
security regressions. Existing held-out data is not used for tuning.

## Current stage

Stage 1 first slice is implemented: one-month totals with optional one-category
filter, read-only exact SQL results and paginated matching-transaction evidence.
Comparisons, arbitrary date ranges and multi-category questions require clarification
in this slice. The UI displays interpreted filters for user verification. Stage 2
and later stages are still planned, not claimed complete.

## Implemented expansion update — 2026-11-03

The owner approved both privacy-sensitive inputs only after explicit user opt-in,
default off, and RLS only for the backed-up Docker demo. The following are now
implemented locally (superseding the earlier stage-1-only status above):

- One chat composer and in-page conversation for recording, monthly read questions,
  draft corrections and explicit idempotent confirmation. History is ephemeral.
- Model edit plans; code applies bounded integer delta arithmetic. Multiple drafts
  require an explicit numbered target. No conversational edit writes the ledger.
- Voice UI, audio endpoint and consent were removed at owner request; a forward
  migration drops the unused preference while retaining applied migration history.
- Explicit owner-scoped note indexing and semantic/keyword ranking. An eight-note,
  four-query synthetic baseline measured keyword top-1 1/4 vs hybrid 3/4. One query
  remained wrong; this tiny author-designed set is not general accuracy evidence.
- PostgreSQL portable exact vector ranking at bounded personal-ledger size. pgvector
  ANN is deferred pending scale/recall measurements; no extension is required locally.
- OpenTelemetry SDK spans/metrics limited to operational metadata, plus restricted
  transaction-local tenant RLS. No external observability service or autopilot writes.

Realtime voice, unrestricted date comparisons, narrative financial advice and
unbounded vector indexing are outside this increment. Phase 8 deployment, student
validation and the final held-out run remain owner-gated and unclaimed.

Owner scope correction: voice is excluded from the final expansion. Historical
voice measurements are retained only as dated engineering evidence, not a shipped
feature claim.
