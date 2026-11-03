# Rules evaluation

Use Node 22 and npm 10 as documented in the root README.

```sh
npm run eval
npm run eval -- --config rules --split dev
```

Defaults: `eval/cases.jsonl`, `--split dev`, `--config rules`. Reports overwrite
`eval/results/rules-dev.json` and `rules-dev.md`. Use a different output directory
when preserving historical runs:

```sh
npm run eval -- --config rules --split dev --cases ./eval/cases.jsonl --out-dir /tmp/sochat-dev-eval
```

`--config llm` and `--config hybrid` now support `--provider fake` (default).
Only the explicit owner command `npm run eval:llm -- --config hybrid --split dev`
selects the real provider and loads .env; CI rejects real Gemini. See
[extraction instructions](../docs/EXTRACTION.md). Invalid options, invalid labels, empty selections or any
prediction failure cause a nonzero exit. Prediction failures still produce both reports.

## Dataset

The supplied 65 seed cases are copied byte for byte from `kit/eval/seed_cases.jsonl`
in `sochat-kit.zip`; all have `split: "dev"`. They and the reference rules were
written by the same developer, so their score is **not representative of real users**.
Keep results for future owner-collected data separate from seed-only results.

Each JSONL row contains `id`, `split` (`dev` or `heldout`), `text`, `now` and
`expected: { items, needs_clarification }`. Gold items contain `type`, `category`,
`amount_vnd` and `occurred_on`. Amount/date can be null only when clarification is
expected. Labels are checked for category/type agreement, amount bounds and real
calendar dates. IDs must be unique. `now` is injected and must include a timezone.

Collect at least 200 anonymized phrasing examples with at least 50 held out before
tuning. Label what the speaker meant, independently of parser predictions. Do not
include real names, account details or other sensitive financial records.

## Held-out discipline

`--split heldout` and `--split all` are supported for an explicitly authorized
owner-run evaluation. **Do not execute either without the owner's request.**
Before such a run, record the intended use; afterwards record the exact command,
source revision, dataset hash, results and updated held-out run count in
`docs/EVIDENCE.md`. Never tune on or edit held-out labels after viewing their scores.
The default loader selects dev before validating labels. CI and parser unit tests
evaluate only dev. Harness tests exercise split option syntax and skip an intentionally
unreadable dummy held-out row; they do not evaluate a held-out dataset.

## Metrics and provenance

- Per-field accuracy: amount, category, date, transaction type. Items align by order.
  The denominator sums `max(expected count, predicted count)` per case, so missing
  and extra predictions both count as errors. Null values match only null.
- Exact case requires equal item count, all four fields and clarification state.
- Clarification TP, FP, FN, TN, precision `TP/(TP+FP)` and recall `TP/(TP+FN)`.
  Undefined ratios are `null` in JSON and `n/a` in Markdown.
- Every report includes split/config, UTC generation time, SHA-256 of the entire
  dataset file, git source commit and dirty status when Git metadata is available.
  Generated report files themselves can make subsequent runs dirty; retain that flag.
- Failures show case IDs and scored fields/reasons, excluding notes and raw message
  text. Keep reports limited to synthetic or owner-approved anonymized material.

Provider reports include measured local p50/p95 and observed-token cost estimates.
Fake results are not Gemini measurements; real evaluation is owner-run. No
real-world accuracy claim is made.
