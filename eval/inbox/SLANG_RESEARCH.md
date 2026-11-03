# Owner glossary decisions and source review

Reviewed: 2026-11-03. Scope: documentation for the 50 owner-dev candidates;
no runtime parser change, evaluation, gold-label invention or Phase 3 work.

## Explicit owner decisions

- Unitless amounts still require clarification. Do not infer thousands from price
  plausibility, e.g. pho 35, buffet 299 or multiple bare prices in one message.
- Owner confirmed cf = ca phe, dx (original đx) = do xang, tr = trua,
  hqua = hom qua, dt (original đt) = dien thoai, in this dataset's contexts.
  These are contextual abbreviations; tr remains an amount unit when attached to
  a number, and quantity words such as chai can refer to bottles rather than money.
- Latest owner correction: xị = 100,000 VND and loét = 100,000 VND. This
  supersedes the earlier owner statement xị = 10,000 VND. The correction names xị
  explicitly; do not automatically extend it to xịch without confirmation.
- Other owner-specified values: lit/lop/soi (lít/lốp/sọi) = 100,000 VND;
  chai/cu (chai/củ) = 1,000,000 VND; toi (tỏi) = 1,000,000,000 VND.
  These are owner-specified conventions, not a verified universal regional dictionary.
- Owner stated cành = trăm, without an explicit numeric VND value. A reviewed source
  suggests 100,000 VND, but retain the distinction between the exact owner statement
  and a normalized numeric interpretation until the dataset labels are confirmed.
- Owner has now explicitly defined loét. Owner has not explicitly defined chục;
  research supports chục = 10,000 VND in shortened price expressions.

## Sources and limitations

1. [FPT Shop: 1 lit, xi, chai](https://fptshop.com.vn/tin-tuc/danh-gia/1-lit-la-bao-nhieu-tien-167587).
   Commercial explanatory article. Supports lit 100,000, chai/cu 1,000,000 and toi
   1,000,000,000. Its xi section is internally inconsistent: it equates one xi to
   10,000 and two xi to 20,000, but five xi to 100,000. The last example cannot follow
   from the first two; do not import its table wholesale. Owner's stated xi convention
   is recorded independently rather than silently changed based on this page.
2. [Tripi: 1M, chai, cu](https://tripi.vn/blog/vi/doi-song/1m-1-chai-1-cu-co-gia-tri-bao-nhieu-trong-tien-te-tripi).
   Secondary commercial explainer supporting chai/cu 1,000,000, lit/lop/soi 100,000
   and toi 1,000,000,000. This is not proof of every speaker's intended amount.
3. [Basic Vietnamese, Culture Notes, Michigan State University Libraries](https://openbooks.lib.msu.edu/vietnamese/chapter/u13-culture-notes/).
   Language teaching material explicitly discusses omission of thousands in prices:
   mot chuc denotes 10,000 VND and ba chuc 30,000 VND. Thus 6 chuc suggests 60,000
   in that price context. This does not override the owner's unitless-number policy.
4. [Bartra: canh](https://bartrawealthadvisors.com.vn/1-canh-la-bao-nhieu-tien-viet-nam/).
   Secondary commercial article gives canh/lit 100,000 VND. Treat as a candidate
   interpretation consistent with colloquial shortened tram, not an authoritative
   standard or proof of the intended value of every owner example.

Searches included exact and contextual combinations for canh, loet, xi and chuc
with Vietnamese money amounts. No adequate source explicitly defining loét as a
money unit was located in this search. This is a search limitation, not proof that
no such usage or source exists. The later owner confirmation resolves loét for
this dataset, independently of web verification. It does not establish that the
cited FPT article supports loét = 100,000. Unresolved units must keep clarification behavior.
Do not expand this search into foreign currencies, market data or financial advice.

## Before executable labels or code

Keep raw inbox text unchanged. Case-level category choices, injected evaluation time,
multiple-item segmentation, numeric shorthand suffixes (e.g. lit 8) and remaining
uncertain units need gold-label review independently of parser predictions. Do not
use web-derived guesses to manufacture ground truth. Unknown or conflicting
interpretations must trigger clarification. Existing seed labels remain untouched.

## Effect on pending owner-dev labels

Using the latest explicit owner convention, 2 xị denotes 200,000 VND, 3 xị
denotes 300,000 VND, 3 loét denotes 300,000 VND and 5 loét denotes 500,000 VND.
These are deterministic arithmetic consequences of the owner convention, not
parser outputs or evaluated gold labels. No runtime code or seed case is changed.
