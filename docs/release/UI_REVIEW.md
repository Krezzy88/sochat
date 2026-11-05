# Workspace UI review — 2026-11-05

Base: `b630b75`. Branch: `codex/ui-consistency-polish`.

## Changes

- Remove the global “SỔ CÁ NHÂN” banner. Keep confirmation guidance beside the save action.
- Replace the verbose Gemini banner with a keyboard/touch-accessible icon and light. Green means Gemini is configured; gray means the provider is not Gemini; amber distinguishes loading/unknown status. This is configuration status, not a health probe or a guarantee that the next model call succeeds. Details close on Escape/outside press; failed status loads can be retried.
- Make fields in budget/goal/contribution editors use consistent spacing; keep period controls equal in size and corner radius, including Safari styling. Native Safari dropdowns now have explicit height and appearance so category controls cannot collapse to a thin system selector.
- Use a real button for the month-dialog trigger with focus restoration and native keyboard activation. Lighthouse caught the previous textbox's invalid `aria-expanded`; the corrected trigger also includes the visible month in its accessible name, and the final audit reports no failed accessibility checks.
- Restore focus to the actual confirmation invoker on Safari pointer activation, as well as transaction/account modal triggers. The initial WebKit run exposed the lost-focus bug; the corrected focused suite passes.
- On short desktop/tablet windows, put navigation in normal page flow at the top. Stop sticky editors from trapping content on short windows. Preserve document scrolling and mobile safe-area space; add scroll padding for fixed mobile navigation.
- Compact the empty-chat illustration/greeting so the message input appears sooner; confirmation drafts and the separate question form retain their behavior.
- Show one latest success toast instead of stacking notices over controls. Mobile toasts sit above navigation. Non-destructive confirmations use the primary action style; deletion confirmations keep the danger style.
- Wrap long notes/names/amounts and contain wide tables within their own scrolling region. Remove CSS for retired status/banner/account-token elements.

## Verification scope

`e2e/app.spec.ts` exercises all six authenticated routes with persisted synthetic transactions, a budget and a long-named goal. The resize sequence includes `320×800`, `768×800`, `1366×800`, `1024×500`, `800×450`, `640×400`, `390×500`. It checks document width, centered/uncovered last controls, reachable footer, equal period controls and month-popup focus. Login/register retain their five-viewport regression checks. Gemini indicator tests inject on/off/unavailable HTTP responses; they verify presentation, not a real model call. The UI does not change provider configuration, money logic, or saved financial data.

Private screenshots are under `.local/release/ui-polish/`; existing owner-approved README screenshots are preserved. Measured results are in [the review measurements](../measurements/ui-polish.json) and [Lighthouse output](../measurements/ui-polish-lighthouse.json).

Lighthouse covers two authenticated local production-build routes with synthetic data, mobile simulated throttling. It does not establish hosted performance or certify manual accessibility. WebKit profiles emulate desktop Safari/iPhone; they are not physical-device certification. High zoom, software keyboards and long content may require scrolling; content is not clipped to force a fixed-height page.

CI now includes focused WebKit workspace/modal regressions alongside the full Chromium suite. Remote CI and hosted deployment must still be verified separately from local results.

## Browser-specific follow-up

The expanded WebKit run initially passed 55/58 cases. Two failures came from using Tab to reach a link under macOS WebKit default navigation settings; the test now uses Option-Tab for WebKit while retaining Tab for Chromium. One mobile text-fill attempt left the controlled chat field empty; it did not reproduce in the targeted follow-up, which passed all four affected desktop/mobile cases. A subsequent expanded run passed 56/58; both report-navigation cases timed out at an empty chat input and passed when run separately. Route focus previously used a passive effect; it now runs before paint so it cannot be scheduled late into a newly visible page. A regression repeatedly navigates back to chat, fills it while AI status is deliberately pending, and verifies content/focus after status resolves. The report and new regression passed 12/12 repeated WebKit cases. This removes a late-focus risk; it does not prove every initial automation timeout had that cause. No blind retry was added to the suite. Final full-run results are recorded separately in the measurements.

## Final local results

Full Chromium: 60/60. Full WebKit after the follow-up: 60/60. Repeated WebKit navigation/input checks: 12/12. After the final CSS-only input-height normalization, the populated six-route resize/control test passed all four browser profiles (4/4). Lint, typecheck and production build pass. Lighthouse Chat and Dashboard each scored 100 for performance and accessibility, with no failed accessibility audits in the retained runs.
