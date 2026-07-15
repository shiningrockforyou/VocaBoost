# Codex review — PERSONAX_HARNESS round 4

## Verdict

GO / CONVERGED-OK for the next smoke wave.

The A/B/C fixes are now actually implemented. Syntax is clean, and the code matches the approved fix direction from round 3.

## Checks

### A — blocked-day review full-fill

Accepted.

The blocked path now calls:

```js
driveTierTest(..., { nCorrect: null })
```

So L14 no longer submits an all-blank blocked-day review. That should enable Submit and let the app reach the intended completion-gate rejection. The low review scores that trigger freeze remain on pre-freeze green review days, which is correct.

### C — wait for results Continue + finalization verification

Accepted.

`returnFromResultsAndClearCompletion()` now waits for the results `Continue` button via `waitVisibleTimed` and returns an additive status object:

```js
{ onResults, continueClicked, cleared }
```

Existing callers ignore the return value, so this is backward-compatible in the current repo.

`advanceOneDay()` now gates `ok:true` on:

```js
pollAdvanced(uid, classId, listId, oracle.expCsd, oracle.expTwi)
```

That is the right place to catch finalization misses. A day is no longer considered driven successfully merely because the test result page appeared.

Operational caveat: retrying `finalization-miss` can still produce a noisy failure if the first attempt persisted but progress did not advance, because a second drive may create an extra attempt and the later exact attempt-count check will reject it. That is acceptable for smoke because it fails closed. If this becomes common, add a targeted recovery path that tries to finalize the existing result before re-driving the test.

### B — active class/list enforcement

Accepted.

`dashReady(page, className, listTitle)` now:

- switches class,
- selects the target list,
- reads visible active context,
- verifies class and list,
- retries up to four times,
- fails closed if the context cannot be established.

Threading `list.title` through `advanceOneDay`, post-day confirmation, and PH-2 forced reconciliation is correct.

The lenient handling for an unread/empty list label is acceptable for smoke because a wrong-list drive still cannot falsely PASS: FB confirmation is scoped to the intended `{classId, listId}`. If future smokes still show wrong-list flake, tighten this to require exact list label whenever `listTitle` is supplied.

### pollAdvanced green-day coverage

Accepted.

For green days, the harness expects both:

- `csd === oracle.expCsd`
- `twi === oracle.expTwi`

That is correct for steady, retake, threshold, throttle green days, and exact-cap final days. Retake has `dNew=2`, but CSD/TWI still advance once, so `pollAdvanced` remains valid.

### PH-2 forced reconciliation interaction

Accepted.

The PH-2 path now calls:

```js
dashReady(student, className, list.title)
enterSessionOnly(...)
leaveSessionViaQuit(...)
```

That should force reconciliation while preserving the no-attempt/no-advance baseline contract. The subsequent baseline assertions still catch accidental attempts or progress mutation.

## Syntax

Checked:

```text
node --check audit/playwright/lsr_persona.mjs
node --check audit/playwright/lsr_ui.mjs
```

Both passed.

## VERDICT

GO / CONVERGED-OK.
