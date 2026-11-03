# Extraction pipeline (Phase 3)

Status: implementation validated with FakeProvider and PostgreSQL 18. No real Gemini
request or real-LLM accuracy/cost measurement has been performed by the agent.

## Production wiring

`createExtractor(pool, env)` is the future API startup hook. It uses PostgreSQL for
cache and quota state. `LLM_PROVIDER` defaults to fake; only fake/gemini are accepted.
Gemini startup requires `GEMINI_API_KEY` and `GEMINI_MODEL`, then calls the model
metadata endpoint and requires generateContent support. Missing credentials or an
unavailable model fail clearly; never silently substitute another model.

Official documentation checked on 2026-11-03:

- [Model metadata](https://ai.google.dev/api/models): GET v1beta/models/{model}.
- [GenerateContent](https://ai.google.dev/api/generate-content): POST
  v1beta/models/{model}:generateContent, systemInstruction, responseMimeType and
  responseJsonSchema, candidates/finishReason and token usage metadata.
- [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite):
  model ID gemini-3.5-flash-lite, stable and structured outputs supported. This is
  a documented candidate, not an account availability check or forced env default.

The structured-output guide redirected to a page inaccessible to the browsing tool;
the accessible official REST reference and model capabilities were used instead.
The native Node fetch adapter avoids an additional SDK dependency. All transport
unit tests inject mock fetch; no real model metadata request is made in CI.

## Safety contract

`HybridExtractor.parseHybrid(message, nowIso, authenticatedUserId, mode)` first runs
rules. In hybrid mode, clarification or category khac triggers the provider. Forced
llm mode exists for evaluation; invalid time and >500-code-point messages are rejected
before either mode calls a provider. Time is injected into parsing. Empty input and
unknown slang still require clarification; fully labeled owner-dev data is pending.

The provider input contains exactly one message and the injected Vietnam calendar
date, plus a fixed versioned system prompt and strict JSON schema. No account ID,
email/profile field, transaction history or tools is supplied. Personal information
that a user explicitly types inside the message is still part of that message;
this phase does not implement general PII redaction. Use synthetic/anonymized data.
Message strings are JSON-encoded data, not interpolated into system instructions.
Prompt delimiters are not a security boundary by themselves.

Every returned proposal requires human confirmation, regardless of flags. Nothing
is written to transactions by extraction. There is no advice or reporting logic in
the provider. All returned values are validated by strict zod objects: unknown
fields, wrong types/categories, >10 items, invalid calendar dates, fractional,
nonpositive or >1e11 amounts and invalid confidence are rejected. Provider errors,
HTTP bodies, garbage responses and model-authored notes/questions are never echoed
raw. Display notes are derived from the input message and must be rendered as text
by the future UI, never as HTML.

The amount guard trusts a number only if the rules amount extractor can find it in
the original message after normalization. Otherwise flag llm_amount_not_in_message
and ask for confirmation. This is deliberately conservative: unsupported slang or
number words are not legitimized just because the model guesses the intended amount.
Low confidence (<0.8) and tiny amounts are also highlighted. Existing rules ambiguity
cannot be erased by high model confidence. Rules confidence is null rather than a
fabricated probability. In hybrid mode, conflicting amounts retain the unresolved rules proposal rather
than selecting one of the model suggestions (including on cache hits). Partial rules items are preserved when the provider can only
ask a question. Forced llm mode never borrows rule predictions after a provider
refusal or failure; this keeps the model-only evaluation honest. Category/type consistency is checked before constructing proposals.

## Reliability, privacy and caps

- 8-second budget for provider attempts and retry delays (database query timeouts
  remain the future API pool configuration), at most two retries after the first attempt, only
  for transient/timeout errors; exponential delay with jitter fits the remaining
  deadline. AbortSignal cancels fetch; Promise.race bounds an injected provider
  that ignores cancellation. Malformed/schema output and permanent errors do not retry.
- Cache identity is SHA-256 of NFC/trimmed message, local date, prompt version and
  model, scoped separately by user_id. Cache hits are revalidated and guarded again.
  Prompt/schema policy changes should bump PROMPT_VERSION.
- Cache responses are eligible for 24 hours. Expired records are ignored and lazily
  deleted on the owner's next cache write; this is not a scheduled physical-deletion
  guarantee. Account deletion cascades all owned responses. Cache failures return
  clarification or safely skip cache writes; never bypass validation.
- Migration 004 adds per-user and aggregate daily attempt counters. A PostgreSQL
  advisory transaction lock serializes reservations across processes. Every retry
  consumes a reservation; failures do not refund it. User counters cascade on delete;
  a global count with no user/message information remains to preserve the global cap.
- Quotas use a server operational clock, independently of injected message/evaluation
  dates. The API must supply authenticated identity and server time, never client
  identity or timestamps for cap enforcement.
- Factory logs one JSON metric event per extraction attempt: latency, token counts
  and outcome only. No message, model output, email, ID, API key or raw error is logged.
  Evaluation captures those same safe metrics for reports. In-process memory stores
  are for fake tests only; they reset per process and are not production quota stores.

Default caps: 50 attempts/user/day and 500 globally/day. A cache hit costs no provider
attempt. Global locking is intentionally simple at MVP volume, not a high-throughput
quota service. There is no automatic background retention job or distributed
single-flight request coalescing in this phase.

## Owner steps

1. Keep Node 22 active. `npm run db:migrate` applies 004 to the selected local database.
2. Keep a Gemini key only in ignored .env and choose GEMINI_MODEL after checking
   current account availability. LLM_PROVIDER can stay fake for normal development.
3. Run real evaluation explicitly, on dev only:

```sh
npm run eval:llm -- --config hybrid --split dev --out-dir eval/results/owner-hybrid
npm run eval:llm -- --config llm --split dev --out-dir eval/results/owner-llm
```

These commands make real requests and consume caps. They create/reuse a reserved
synthetic evaluation account llm-evaluation@sochat.invalid in the local database;
cache/counters persist between runs. It has a non-login password hash. Do not use
an unrelated or production database. Both commands are prohibited when CI is set.
If a run hits caps, keep that outcome in the report; do not claim a full comparison.
The owner can adjust cap env settings deliberately before a later run.

Optional LLM_INPUT_USD_PER_MILLION and LLM_OUTPUT_USD_PER_MILLION are owner-supplied
current prices. Without nonblank prices, real estimated cost is null, not zero.
Reported costs cover observed token counts only, including reported thinking tokens;
failed requests can have unknown billable usage. They are not billing invoices.

Reports record provider/model/prompt, source commit/dirty flag, dataset hash, per-field
accuracy, exact cases, clarification precision/recall, p50/p95 local pipeline latency,
rules-only resolution share, attempts, token use and estimated cost per 100 messages.
Preserve results and report them to update EVIDENCE. FakeProvider always asks for
clarification and never reads gold labels; its metrics do not measure Gemini quality.
No held-out run is authorized by these commands. Phase 3 stops at its gate while
the owner runs real-LLM evaluation; Phase 4 requires the next explicit go.
