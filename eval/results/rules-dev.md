# Rules extraction evaluation

Generated: 2026-11-03T01:45:14.197Z. Config: rules. Split: dev.

The 65 supplied synthetic dev seed cases were written by the developer who wrote the reference rules. Their score is not representative of real users. Additional owner-labeled data must be assessed separately.

Source commit: 0624c7ece2861a269ac33601e50cbc405e8307e6. Working tree dirty: false.
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
