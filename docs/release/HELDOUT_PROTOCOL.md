# Final held-out extraction protocol

Status: NOT RUN. No approved >=50-case untouched held-out set is available in the
current work. The prior 50 owner phrases are tuned dev and cannot be relabeled
held-out. Do not synthesize a test set and describe it as real-user evaluation.

1. Collect >=50 NEW, voluntarily supplied, anonymized fictional phrases (target
   total corpus >=200 across splits). No saved owner ledger or identifiers. Obtain
   consent to send these messages to Gemini before any request.
2. A human records intended items/categories/dates independently of model output.
   Use the fixed owner-confirmed-v2 convention; bare monetary 1–999 means thousands,
   four-digit/grouped VND remains literal, quantities/dates/times excluded. Include
   clear, multiple-item, date, quantity, conflict/discount, unknown-slang and invalid
   inputs so clarification positives are present. Do not tune on any held-out text.
3. Use the existing JSONL EvalCase format: unique id, split=heldout, text, injected
   timezone-aware now, expected.items and expected.needs_clarification. Resolve
   disputed labels BEFORE predictions. Freeze file hash, code commit, model,
   prompt version and money profile; owner approves the frozen set/run.
4. Create an ISOLATED evaluation PostgreSQL 18 database, apply migrations, supply
   its DATABASE_URL and an owner-approved Gemini key only in an ignored local env file.
   Paid provider testing is explicitly authorized under charter section 19; agree
   the bounded run budget before starting.
   Do not point evaluation commands at native owner, demo or hosted production DB.
   This harness writes a synthetic evaluation account/cache/quota state. Dedicated
   per-user/global caps must cover the authorized run (up to three generation
   attempts per unresolved case); decide the cap before starting, never silently
   increase it midway. Check provider limits before consuming the one held-out run.
5. On explicit owner authorization, execute ONCE, with the frozen profile:

```sh
MONEY_PROFILE=owner-confirmed-v2 node --env-file=.local/heldout.env --experimental-strip-types eval/run_eval.ts --provider gemini --config hybrid --split heldout --cases .local/heldout/approved.jsonl --out-dir .local/heldout/results/run-1
```

The env file contains the dedicated evaluation DB/provider credentials, never
VITE_* secrets. Do not use `npm run eval:llm` here: it loads the ordinary .env.
Explicit process environment takes precedence over node's env-file values.

6. Record run count=1 even if provider/network/quota failures occur; retain the
   attempt rather than silently retrying until a better score. Log the exact command,
   code/config/data hashes, start/end, provider attempts/tokens, failures, per-field
   and exact-case metrics, clarification precision/recall (n/a when undefined).
   Keep raw labels/results private. Publish only approved aggregate evidence.
7. Do not change held-out labels or tune on observed errors while calling it the
   same final test. A future fix requires a new untouched set/version and explicit
   approval. Updated user stories from sessions belong to dev unless held-out data
   was collected independently and frozen before any prediction.

The harness now passes MONEY_PROFILE to rules AND hybrid/provider guards and records
it in JSON/Markdown; this avoids evaluating standard units while deploying v2.
CI still uses only synthetic dev/FakeProvider transport and never real Gemini.
