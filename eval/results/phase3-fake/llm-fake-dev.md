# llm extraction evaluation (fake)

Generated: 2026-11-03T02:53:44.570Z. Config: llm. Split: dev.

The 65 synthetic seed cases and reference rules share an author. FakeProvider always asks for clarification; fake accuracy/cost/latency is not Gemini performance. Unlabeled owner inbox is excluded.

Source commit: 43bb70573ef886f35d210c0aae043f9879694fda. Working tree dirty: false.
Dataset SHA-256: 525fbdfaac8e80d3470aa43203f41c01fe2eee829d638e12df401a11a8122839.

| Metric | Correct / total | Accuracy |
| --- | --- | --- |
| Exact case | 1 / 65 | 1.54% |
| amount_vnd | 0 / 70 | 0.00% |
| category | 0 / 70 | 0.00% |
| occurred_on | 0 / 70 | 0.00% |
| type | 0 / 70 | 0.00% |

Clarification: TP=5, FP=60, FN=0, TN=0.
Precision: 7.69%. Recall: 100.00%.

Items are aligned by order. Each field denominator is the sum of max(expected items, predicted items) per case; extra/missing items count as errors. Null fields are scored by exact equality. Exact case also requires matching item count and clarification state. Undefined ratios are n/a (null in JSON).

## Failures (64)

### seed-001

```json
{
  "id": "seed-001",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 50000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-002

```json
{
  "id": "seed-002",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 25000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-003

```json
{
  "id": "seed-003",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 35000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-004

```json
{
  "id": "seed-004",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 45000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-005

```json
{
  "id": "seed-005",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 120000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-006

```json
{
  "id": "seed-006",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 60000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-007

```json
{
  "id": "seed-007",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 1800000,
        "category": "nha_tro",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-008

```json
{
  "id": "seed-008",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 5500000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-009

```json
{
  "id": "seed-009",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 85000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-010

```json
{
  "id": "seed-010",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 38000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-011

```json
{
  "id": "seed-011",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 90000,
        "category": "giai_tri",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-012

```json
{
  "id": "seed-012",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 75000,
        "category": "suc_khoe",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-013

```json
{
  "id": "seed-013",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 450000,
        "category": "hoa_don",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-014

```json
{
  "id": "seed-014",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 90000,
        "category": "hoa_don",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-015

```json
{
  "id": "seed-015",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 100000,
        "category": "hoa_don",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-016

```json
{
  "id": "seed-016",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 250000,
        "category": "mua_sam",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-017

```json
{
  "id": "seed-017",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 1200000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-018

```json
{
  "id": "seed-018",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 150000,
        "category": "suc_khoe",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-019

```json
{
  "id": "seed-019",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 1500000,
        "category": "mua_sam",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-020

```json
{
  "id": "seed-020",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 2500000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-021

```json
{
  "id": "seed-021",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 500000,
        "category": "nha_tro",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-022

```json
{
  "id": "seed-022",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 15000000,
        "category": "mua_sam",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-023

```json
{
  "id": "seed-023",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 1500000,
        "category": "nha_tro",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-024

```json
{
  "id": "seed-024",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 30000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-025

```json
{
  "id": "seed-025",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 120000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-026

```json
{
  "id": "seed-026",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 15000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-027

```json
{
  "id": "seed-027",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 5000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-028

```json
{
  "id": "seed-028",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 230000,
        "category": "mua_sam",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-029

```json
{
  "id": "seed-029",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 59000,
        "category": "giai_tri",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-030

```json
{
  "id": "seed-030",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 100000,
        "category": "giai_tri",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-031

```json
{
  "id": "seed-031",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 1250000,
        "category": "mua_sam",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-032

```json
{
  "id": "seed-032",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 2000000,
        "category": "nha_tro",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-033

```json
{
  "id": "seed-033",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 220000,
        "category": "hoa_don",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-034

```json
{
  "id": "seed-034",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 300000,
        "category": "suc_khoe",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-035

```json
{
  "id": "seed-035",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 45000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-036

```json
{
  "id": "seed-036",
  "expected": {
    "items": [
      {
        "type": "income",
        "amount_vnd": 3000000,
        "category": "tro_cap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-037

```json
{
  "id": "seed-037",
  "expected": {
    "items": [
      {
        "type": "income",
        "amount_vnd": 8000000,
        "category": "luong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-038

```json
{
  "id": "seed-038",
  "expected": {
    "items": [
      {
        "type": "income",
        "amount_vnd": 300000,
        "category": "lam_them",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-039

```json
{
  "id": "seed-039",
  "expected": {
    "items": [
      {
        "type": "income",
        "amount_vnd": 1200000,
        "category": "tro_cap",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-040

```json
{
  "id": "seed-040",
  "expected": {
    "items": [
      {
        "type": "income",
        "amount_vnd": 500000,
        "category": "thu_khac",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-041

```json
{
  "id": "seed-041",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 45000,
        "category": "an_uong",
        "occurred_on": "2026-11-01"
      },
      {
        "type": "expense",
        "amount_vnd": 60000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-01"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-042

```json
{
  "id": "seed-042",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 50000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      },
      {
        "type": "expense",
        "amount_vnd": 35000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-043

```json
{
  "id": "seed-043",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 25000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      },
      {
        "type": "expense",
        "amount_vnd": 5000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-044

```json
{
  "id": "seed-044",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 80000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-045

```json
{
  "id": "seed-045",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 20000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      },
      {
        "type": "expense",
        "amount_vnd": 25000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-046

```json
{
  "id": "seed-046",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 120000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-01"
      },
      {
        "type": "expense",
        "amount_vnd": 15000,
        "category": "hoc_tap",
        "occurred_on": "2026-11-01"
      },
      {
        "type": "expense",
        "amount_vnd": 40000,
        "category": "an_uong",
        "occurred_on": "2026-11-01"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-047

```json
{
  "id": "seed-047",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 30000,
        "category": "an_uong",
        "occurred_on": "2026-11-01"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-048

```json
{
  "id": "seed-048",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 70000,
        "category": "an_uong",
        "occurred_on": "2026-10-31"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-049

```json
{
  "id": "seed-049",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 90000,
        "category": "giai_tri",
        "occurred_on": "2026-11-01"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-050

```json
{
  "id": "seed-050",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 50000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-06"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": []
  }
}
```

### seed-051

```json
{
  "id": "seed-051",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 200000,
        "category": "an_uong",
        "occurred_on": "2026-10-30"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-052

```json
{
  "id": "seed-052",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 80000,
        "category": "hoc_tap",
        "occurred_on": "2026-10-15"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-053

```json
{
  "id": "seed-053",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 1800000,
        "category": "nha_tro",
        "occurred_on": "2025-12-20"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-054

```json
{
  "id": "seed-054",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 50000,
        "category": "an_uong",
        "occurred_on": "2026-11-01"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-055

```json
{
  "id": "seed-055",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 300000,
        "category": "an_uong",
        "occurred_on": "2026-10-03"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-056

```json
{
  "id": "seed-056",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 300000,
        "category": "mua_sam",
        "occurred_on": "2026-11-01"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-057

```json
{
  "id": "seed-057",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 5000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-058

```json
{
  "id": "seed-058",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 70000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-059

```json
{
  "id": "seed-059",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 7000,
        "category": "di_chuyen",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-060

```json
{
  "id": "seed-060",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 450000,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": false
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "llm_cap_reached"
    ]
  }
}
```

### seed-061

```json
{
  "id": "seed-061",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": null,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": true
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "bare_small_number",
      "llm_cap_reached"
    ]
  }
}
```

### seed-062

```json
{
  "id": "seed-062",
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
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "ambiguous_unit",
      "llm_cap_reached"
    ]
  }
}
```

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
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "multiple_amounts",
      "llm_cap_reached"
    ]
  }
}
```

### seed-065

```json
{
  "id": "seed-065",
  "expected": {
    "items": [
      {
        "type": "expense",
        "amount_vnd": 50,
        "category": "an_uong",
        "occurred_on": "2026-11-02"
      }
    ],
    "needs_clarification": true
  },
  "actual": {
    "items": [],
    "needs_clarification": true,
    "reasons": [
      "tiny_amount",
      "llm_cap_reached"
    ]
  }
}
```

## Operational metrics

```json
{
  "messages": 65,
  "provider_attempts": 50,
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0
  },
  "no_provider_attempt_share": 0.23076923076923078,
  "rules_only_share": 0,
  "latency_ms": {
    "p50": 0.05504200000001447,
    "p95": 0.5334589999999935
  },
  "observed_token_estimate_usd_per_100_messages": 0,
  "attempts_with_unknown_usage": 0,
  "pricing_caveat": "Owner-supplied USD/token rates; observed-token estimate only, not billing. Missing prices yield null. Failed HTTP calls can have unknown billable usage. Fake has no API cost."
}
```
