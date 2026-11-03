# Parser contract (Phase 1)

`packages/parser` has no runtime dependencies and no I/O. Its functions never
consult the system clock, access an environment variable, call an LLM or store a
transaction. All results are proposals requiring user confirmation before saving.

```ts
import { parseMessage } from '@sochat/parser';

const proposal = parseMessage(
  'Hôm qua ăn phở 50k, cà phê 25k',
  '2026-11-02T09:00:00+07:00',
);
// Two expense proposals dated 2026-11-01, with amounts 50000 and 25000.
```

The workspace exports TypeScript source. The evaluation CLI executes it with
Node 22's `--experimental-strip-types`, also verified locally. TypeScript checks
use `allowImportingTsExtensions` with `noEmit`; application build tooling is deferred
to its phase. Root scripts run the parser's tests and typecheck.

## Result

`ParseResult` contains `items`, `needs_clarification`, deduplicated machine-readable
`reasons` and Vietnamese `questions`. Each item contains type, category, amount,
original-language note, calendar date and flags. Category and transaction type form
a discriminated union. No confidence score is invented in this deterministic phase.

- `amount_vnd`: a positive safe integer no greater than 100,000,000,000, or `null`.
  All decimal/unit normalization uses bigint arithmetic. Conversion to a JSON-safe
  number happens only after the bound check; reporting and database arithmetic
  belong to code/SQL in later phases.
- `occurred_on`: a real `YYYY-MM-DD` calendar date, or `null` when an explicit date
  is invalid. An invalid date is never silently substituted with today.
- An ambiguous or invalid field triggers clarification. An invalid amount is `null`;
  a positive amount below 1,000 VND is retained but flagged `tiny_amount` for confirmation.
- `nowIso` must be an ISO instant with a timezone (`Z` or an explicit offset).
  Invalid injected time returns `invalid_now` without consulting the wall clock.
- Input is limited to 500 Unicode code points, counted before NFC normalization.
  Oversized input returns no items and `message_too_long`. Empty/emoji-only input
  returns no items and a Vietnamese question about the amount.

## Supported baseline

- `k/nghìn/ngàn`, `tr/triệu/củ`, `nửa triệu`, `rưỡi`, `1tr2`, `1tr25`, `35k5`,
  separated integer VND (`1.200.000`, `1,200,000`) and plain 4+ digit amounts.
- Exact decimal scaling (`1,5tr`, `1.001k`); fractional dong are rejected, never rounded.
- Dates: today, yesterday, two days ago, most recent weekday, previous-week weekday,
  `dd/mm[/yy|yyyy]`, and `ngày d tháng m [năm yyyy]`, using Vietnam's UTC+7 day.
  A yearless future date refers to the previous year and is revalidated, including leap days.
- Multiple items split on semicolons, newlines, `+`, `và` and commas outside numeric
  groups. A phrase without an amount can carry into the next item. Notes retain
  NFC Vietnamese text. A leading message date is inherited unless an item supplies its own.
- Multiple amounts in one item stay unresolved; the parser never adds them together.
- The category rules preserve the reference's explicit priority order.

## Limits and evaluation caveats

Number words such as `hai trăm nghìn`, arbitrary regional slang and general natural
language are not fully supported. `lít` explicitly requires clarification; its value
is not assumed. Category classification is a keyword baseline and can be wrong.
Conflicting natural-language dates and trailing non-money clauses are not exhaustively
interpreted. Confirmation remains mandatory even for results without flags.

Tests include the unchanged 65 synthetic dev seed cases, test-first regressions and
four fast-check properties (2,000 runs each; seed 20261103). Properties check arbitrary
Unicode input/determinism, safe bounded money, calendar validity and NFC offset alignment.
These checks establish invariants on generated inputs, not accuracy on real users.

See `EVIDENCE.md` for measured results, red/green regressions and the reverted money-cap
mutation. No held-out cases were run in Phase 1.
