# Approved AI expansion — 2026-11-03

Owner authorizes implementation and real local Gemini testing, requesting approval
before high-risk actions. Deliver incrementally before public deployment:

1. Read-only natural-language questions with typed intents, allowlisted SQL, exact
   code-generated totals, visible filters and links to supporting transactions.
2. Multi-turn draft corrections, explicit human confirmation and idempotent saves.
3. Short voice input with microphone permission and transcript review; realtime
   voice only after measured latency/cost and accessibility evaluation.
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
