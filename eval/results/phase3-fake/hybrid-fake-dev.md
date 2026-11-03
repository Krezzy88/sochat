# hybrid extraction evaluation (fake)

Generated: 2026-11-03T02:52:08.410Z. Config: hybrid. Split: dev.

The 65 synthetic seed cases and reference rules share an author. FakeProvider always asks for clarification; fake accuracy/cost/latency is not Gemini performance. Unlabeled owner inbox is excluded.

Source commit: 43bb70573ef886f35d210c0aae043f9879694fda. Working tree dirty: false.
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
  "provider_attempts": 5,
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0
  },
  "no_provider_attempt_share": 0.9230769230769231,
  "rules_only_share": 0.9230769230769231,
  "latency_ms": {
    "p50": 0.03149999999999409,
    "p95": 0.43737500000000296
  },
  "observed_token_estimate_usd_per_100_messages": 0,
  "attempts_with_unknown_usage": 0,
  "pricing_caveat": "Owner-supplied USD/token rates; observed-token estimate only, not billing. Missing prices yield null. Failed HTTP calls can have unknown billable usage. Fake has no API cost."
}
```
