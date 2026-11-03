# hybrid extraction evaluation (fake)

Generated: 2026-11-03T07:19:05.643Z. Config: hybrid. Split: dev.

The 65 synthetic seed cases and reference rules share an author; scores are not representative of real users. Unlabeled owner inbox is excluded. FakeProvider always asks for clarification; fake metrics are not Gemini performance.

Source commit: e4dbdcad0d922bf68b72ab9e65d9cc04d3950e18. Working tree dirty: true.
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
    "p50": 0.03320899999999938,
    "p95": 0.4248330000000067
  },
  "observed_token_estimate_usd_per_100_messages": 0,
  "attempts_with_unknown_usage": 0,
  "pricing_caveat": "Owner-supplied USD/token rates; observed-token estimate only, not billing. Missing prices yield null. Failed HTTP calls can have unknown billable usage. Fake has no API cost."
}
```
