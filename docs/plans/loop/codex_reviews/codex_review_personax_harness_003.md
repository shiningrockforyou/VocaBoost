# Codex review — PERSONAX_HARNESS round 3

## Verdict

NEEDS_FIXES.

The smoke diagnosis is coherent, but the claimed A/B/C fixes are not actually implemented in the code yet. This handoff should be treated as a fix plan, not as a patched harness ready for smoke rerun.

## Findings

### PH3-1 — Issue A fix is not applied: blocked L14 still submits all blanks

Severity: blocker.

The handoff says blocked-day review should be filled with full answers so the Submit button enables and the completion gate can reject the review-only day.

Current code still does this:

```js
const rvRes = await driveTierTest(page, seg, `${seg.tier}-d${localDay}-review-BLOCKED`, {
  nCorrect: seg.behavior === 'freeze' ? 0 : null
});
```

For L14 freeze, that is still `nCorrect: 0`, i.e. all blanks. That preserves the exact smoke failure: Submit can remain disabled and the harness never reaches the completion gate.

Required fix:

- Blocked-day review submit should use full answers (`nCorrect: null`) for both phantom and freeze blocked days.
- The low review scores that trigger freeze should remain on the pre-freeze green review days only.

### PH3-2 — Issue C fix is not applied: results Continue is still check-once and non-retryable

Severity: blocker.

The handoff says `returnFromResultsAndClearCompletion` should wait for the `^continue$` button and make absent Continue retryable/additively observable.

Current `lsr_ui.mjs` still does:

```js
if (await cont.isVisible().catch(() => false)) {
  await cont.click(...)
} else {
  findings.add('flow-gap', ...);
}
return clearCompletionIfPresent(page);
```

That is still a one-shot visibility check. If Continue renders late, the helper records a flow-gap but does not return a retryable signal to `advanceOneDay`. The day can still be "driven ok" while finalization never happened, pushing the failure to FB confirmation instead of retrying the driving step.

Required fix:

- Wait for `^continue$` with `waitVisibleTimed`.
- Return an additive status object or otherwise let the persona runner distinguish:
  - cleared successfully,
  - no Continue yet / retryable finalization miss,
  - no completion screen.
- In `advanceOneDay`, do not return `{ok:true}` until finalization has either been cleared or explicitly confirmed by the FB/UI postcondition.

### PH3-3 — Issue B fix is not applied: `dashReady` still only enforces class, not list

Severity: blocker.

The handoff says `dashReady(page, className, listTitle)` should enforce active class and active list by switching class, selecting list, verifying both labels, and retrying.

Current `dashReady` still has signature:

```js
async function dashReady(page, className)
```

and it only verifies class text:

```js
await switchClass(page, className, F);
...
if (await page.getByText(escRe(className)).first().isVisible())
```

No `listTitle` is threaded through, no `selectList(listTitle)` is called, and no active List label is verified. That means the observed wrong-list failure (`Base Camp != Ascent`) can still recur.

Required fix:

- Change `dashReady` to accept expected `{className, listTitle}` or equivalent.
- After `switchClass`, call `selectList(listTitle)`.
- Verify visible Class and List labels exactly.
- Retry the switch/select/verify loop.
- Update all call sites:
  - `advanceOneDay`
  - post-day confirmation loop
  - PH-2 reconciliation entry
  - any setup/transition call that relies on the active context.

### PH3-4 — B and C are related, but not the same root

Severity: medium.

The common theme is "transition/finalization waits are not deterministic enough." But the concrete failure modes are separate:

- C is results-route finalization: Continue did not render before the helper checked once.
- B is active-context correctness: after class transitions, the visible class/list focus can diverge from the intended segment.

They should be fixed as one hardening pass, but they need separate assertions:

- finalization-ready / Continue-ready / completion-cleared,
- active class/list exact match before every day drive.

One generic "wait until ready" is not sufficient unless it includes both predicates.

## Answers to claimsToCheck

1. Issue A: yes, full-answer fill on blocked days is correct. The block is caused by `newWordCount == 0` / missing same-day new pass, not review score. But code still uses blanks for freeze, so not fixed.
2. Issue C: waiting for Continue is necessary. I would also verify finalization before declaring the day driven-ok; otherwise the retry boundary remains too late.
3. Issue B: the primary-focus/list reversion diagnosis is plausible and supported by the wrong-list flow-gap. Enforce-context is the right fix. The beforeunload signal also argues for clean session-exit verification, but it does not replace list verification.
4. B and C share a reliability theme but are two assertions: finalization readiness and active context readiness.
5. The textual evidence is enough to implement the fixes. After patching, re-run affected smokes multiple times as planned; captured screenshots are useful but not required before patching.

## VERDICT

NEEDS_FIXES.
