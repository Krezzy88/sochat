# Owner-supplied phrasing inbox

`owner-20261103.jsonl` preserves 50 distinct examples supplied by the owner on
2026-11-03. Their collection method and representativeness are not verified.
They are development candidates, not labeled evaluation cases and not held-out data.

Each row preserves the original text and has `label_status: pending_owner_confirmation`.
There is deliberately no invented `expected` label or `now` timestamp. This file is
not loaded by the default evaluator or parser unit tests. Do not pass it directly
to the evaluation harness, which requires validated gold labels and injected time.
The 65 original seed cases in ../cases.jsonl remain unchanged.

Before promotion to a separate owner-dev evaluation dataset:

1. Confirm slang values and abbreviations with the owner, including ambiguous usage.
2. Preserve clarification for unitless numbers unless the owner explicitly changes
   the product policy. Do not label from the parser's predictions.
3. Agree on a fixed evaluation time for relative dates, then label all scored fields
   and clarification state. Multiple purchases remain separate; do not silently
   merge food and delivery charges or invent a shared bill's total.
4. Resolve uncertain categories/intent per case with the owner. Never infer an
   accuracy score or report these as 50 independently verified real-user messages.

No rules were tuned and no evaluation or real LLM call was run on these examples
at intake. Future held-out examples should be separately reserved before tuning.
