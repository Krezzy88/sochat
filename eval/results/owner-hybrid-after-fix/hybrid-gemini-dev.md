# hybrid extraction evaluation (gemini)

Generated: 2026-11-03T03:09:28.876Z. Config: hybrid. Split: dev.

The 65 synthetic seed cases and reference rules share an author; scores are not representative of real users. Unlabeled owner inbox is excluded. This is an explicit owner-run real Gemini evaluation.

Source commit: e56475315a8384440af548f6c4a41a968148e4ff. Working tree dirty: false.
Dataset SHA-256: 525fbdfaac8e80d3470aa43203f41c01fe2eee829d638e12df401a11a8122839.

| Metric | Correct / total | Accuracy |
| --- | --- | --- |
| Exact case | 65 / 65 | 100.00% |
| amount_vnd | 70 / 70 | 100.00% |
| category | 70 / 70 | 100.00% |
| occurred_on | 70 / 70 | 100.00% |
| type | 70 / 70 | 100.00% |

Clarification: TP=5, FP=0, FN=0, TN=60.
Precision: 100.00%. Recall: 100.00%.

Items are aligned by order. Each field denominator is the sum of max(expected items, predicted items) per case; extra/missing items count as errors. Null fields are scored by exact equality. Exact case also requires matching item count and clarification state. Undefined ratios are n/a (null in JSON).

## Failures (0)

## Operational metrics

```json
{
  "messages": 65,
  "provider_attempts": 1,
  "usage": {
    "input_tokens": 152,
    "output_tokens": 20,
    "total_tokens": 172
  },
  "no_provider_attempt_share": 0.9846153846153847,
  "rules_only_share": 0.9230769230769231,
  "latency_ms": {
    "p50": 0.050374999999917236,
    "p95": 3.813584000000219
  },
  "observed_token_estimate_usd_per_100_messages": null,
  "attempts_with_unknown_usage": 0,
  "pricing_caveat": "Owner-supplied USD/token rates; observed-token estimate only, not billing. Missing prices yield null. Failed HTTP calls can have unknown billable usage. Fake has no API cost."
}
```
