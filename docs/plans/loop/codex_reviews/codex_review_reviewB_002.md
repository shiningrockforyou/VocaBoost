# Codex review — RUNS_REVIEWB round 2

## Verdict

NEEDS_FIXES.

The RB-1 enter-then-review rework is the right direction and fixes the original dashboard-assumption bug. However, the S-1 final verdict can still pass without proving the Step-4 A re-entry assertion, because `out.steps.reenterA.entered` is recorded but not required.

## What is correct

### Step 3 now matches the Phase-1 app behavior

The B review path now does the right thing:

1. `dashReady(classBName)`
2. `enterSessionOnly(...)`
3. observe in-session state
4. `skipToTest(...)`
5. `driveTest(...)`

This is the correct harness model for Phase 1. B's dashboard may show class-local Day 1 / Start new words, but entering the session triggers reconciliation and should route to the Day-2 review.

The helper reuse is also acceptable. `enterSessionOnly` is effectively the requested `enterSessionAny`: it clicks the available study affordance and requires in-session evidence (`Card N of M`, `Session menu`, or `Quit session`).

### Step 3 is not obviously false-green

If B entry or review driving fails, the read-only oracle should fail because it requires:

- B `class_progress` at `csd=2/twi=40`
- a B review attempt for Day 2 with the correct `newWordStartIndex/newWordEndIndex`

So the main cross-class review completion claim is still data-bound.

## Required fix

### RB-2 — Step 4 can pass without proving A was re-entered

Severity: high for this audit.

Current Step 4:

```js
const entered = await enterSessionOnly(page, F, 's1-A-reenter');
...
out.steps.reenterA = { entered: entered.entered, retakePrompt: retakeInA, reReviewDay2 };
```

But the final verdict only gates:

```js
const noRetake = out.steps.reviewInB?.outcome !== 'retake-gate' && !out.steps.reenterA?.retakePrompt;
out.verdict = (liveOk && oracleClean && noRetake && bugFindings.length === 0) ? 'PASS' : ...
```

If A re-entry fails, then:

- `entered.entered === false`
- `retakePrompt` will likely be false because the page never reached the relevant screen
- `reReviewDay2` will likely be false for the same reason
- `oracleClean` can still be true from B's successful review completion and reconciliation reads

That means the audit can PASS without actually testing the "re-enter A; no retake/no re-review" UI path.

Fix: require A re-entry in the verdict and/or emit a fatal finding when it fails.

Suggested minimal patch:

```js
if (!entered.entered) F.add('fail', 'A re-entry did not reach an in-session screen');
```

and make the verdict explicit:

```js
const bReviewDriven =
  out.steps.reviewInB?.entered === true &&
  out.steps.reviewInB?.reached === true &&
  out.steps.reviewInB?.outcome === 'results';

const aReentryClean =
  out.steps.reenterA?.entered === true &&
  !out.steps.reenterA?.retakePrompt &&
  !out.steps.reenterA?.reReviewDay2;

out.verdict = (liveOk && oracleClean && bReviewDriven && aReentryClean && bugFindings.length === 0)
  ? 'PASS'
  : (!liveOk ? 'INVALID (flow incomplete)' : 'FAIL');
```

The exact naming is not important. The important part is that Step 4's UI path is not merely diagnostic.

## Non-blocking notes

### B result-page cleanup

After B's review `driveTest` returns `results`, the script does not call `returnFromResultsAndClearCompletion`. This is probably not a blocker for S-1 because the test component now completes the session at submit time, and the script does not need to start B's next day. But if this script is later extended to continue in B, it should use the same final-test cleanup helper.

### `reviewStudy` locator should remain diagnostic unless validation proves it stable

The new `reviewStudy` boolean is useful evidence, but the data oracle is stronger. If the text locator is brittle, do not make that exact text a hard gate. Gate the action/result instead: entered session, reached test, review outcome results, B review attempt exists with the correct range.

## VERDICT

NEEDS_FIXES.

The B enter-then-review fix is structurally correct. Add a fail-closed gate for Step 4 A re-entry before signing off.
