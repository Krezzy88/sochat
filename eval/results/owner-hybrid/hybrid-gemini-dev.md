# hybrid extraction evaluation (gemini)

Generated: 2026-11-03T03:00:09.745Z. Config: hybrid. Split: dev.

The 65 synthetic seed cases and reference rules share an author. FakeProvider always asks for clarification; fake accuracy/cost/latency is not Gemini performance. Unlabeled owner inbox is excluded.

Source commit: 45b6930006d23e6e32d6647687251ef8228d636f. Working tree dirty: false.
Dataset SHA-256: 525fbdfaac8e80d3470aa43203f41c01fe2eee829d638e12df401a11a8122839.

| Metric | Correct / total | Accuracy |
| --- | --- | --- |
| Exact case | 64 / 65 | 98.46% |
| amount_vnd | 69 / 70 | 98.57% |
| category | 70 / 70 | 100.00% |
| occurred_on | 70 / 70 | 100.00% |
| type | 70 / 70 | 100.00% |

Clarification: TP=5, FP=0, FN=0, TN=60.
Precision: 100.00%. Recall: 100.00%.

Items are aligned by order. Each field denominator is the sum of max(expected items, predicted items) per case; extra/missing items count as errors. Null fields are scored by exact equality. Exact case also requires matching item count and clarification state. Undefined ratios are n/a (null in JSON).

## Failures (1)

### seed-064

```json
{
  "id": "seed-064",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": null,
        "category": "mua_sam",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": true
  },
  "actual": {
    "items": [
      {
        "type": "expense",
        "category": "mua_sam",
        "amount_vnd": 150000,
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": true,
    "reasons": [
      "multiple_amounts"
    ]
  }
}
```

## Operational metrics

```json
{
  "messages": 65,
  "provider_attempts": 5,
  "usage": {
    "input_tokens": 775,
    "output_tokens": 246,
    "total_tokens": 1021
  },
  "no_provider_attempt_share": 0.9230769230769231,
  "rules_only_share": 0.9230769230769231,
  "latency_ms": {
    "p50": 0.037332999999989624,
    "p95": 1121.9339580000005
  },
  "observed_token_estimate_usd_per_100_messages": null,
  "attempts_with_unknown_usage": 0,
  "pricing_caveat": "Owner-supplied USD/token rates; observed-token estimate only, not billing. Missing prices yield null. Failed HTTP calls can have unknown billable usage. Fake has no API cost."
}
```
