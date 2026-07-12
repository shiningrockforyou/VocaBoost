# Codex review round 1: RUN_SL_PHASE1_CODE

## Verdict

NEEDS_FIXES

## Summary

`audit/playwright/lsr_runSL_phase1.mjs` is syntax-clean, and the broad flow matches the Phase-1 design. It uses browser UI for teacher/student setup and only uses Firebase Admin for reads.

But the current harness can still report a green primitive while violating the design’s core evidence contract. The biggest issue is that UI-primary progress evidence is treated as a soft finding, not a gate. The existing findings history already shows the symptom: `ui.words=null` after a completed day, because the harness reads dashboard progress while still on/near the results flow. With the current code, that can still PASS if Firebase agrees.

## Findings

### SLP1-1 — BLOCKER — UI-primary evidence is not gating PASS

The design says UI is the primary evidence and Firebase is corroboration. The code computes:

```js
const uiOk = ui && ui.words === expTwi;
...
if (!dayOk || !persisted) halt...
if (!uiOk) F.add('ui-fb-mismatch', ...)
```

So `uiOk` is only a findings entry. It does not halt, does not affect `confirmedDays`, and does not affect the final exit code.

That means the harness can report `PASS (primitive proven)` even if the student dashboard never shows the expected progress. This directly violates the owner ruling baked into the design.

This is not theoretical. The repo already contains a RunSL Phase-1 finding:

- `audit/playwright/findings/B_LIST_PROGRESS_PHASE1_RUNSL_P1_SLP1_1783823910942.md`
- `day 1: UI words=null != expected twi 20 (FB agrees; UI-teeth soft-fail)`

Required fix:

- After each successful day, navigate back to a confirmed dashboard state before reading UI progress.
- Require both UI and Firebase confirmation to count a day:
  - visible `DAY` should equal `expCsd + 1` if the dashboard renders next-day label semantics;
  - visible `Words Introduced` should equal `expTwi`;
  - Firebase `csd/twi` should equal expected.
- Make UI mismatch fatal for the day, not a soft finding.

### SLP1-2 — HIGH — “Attempt persisted” is claimed but not asserted

`fbState()` returns `newAttempts` and `reviewAttempts`, but `persisted` ignores them:

```js
const persisted = fb && fb.csd === expCsd && fb.twi === expTwi;
```

For a day-primitive audit, CSD/TWI alone is not enough evidence that the intended day flow happened exactly once. It will miss:

- duplicate attempts created by rebuild/retry;
- missing review attempts on Day 2+ if some other path advanced progress;
- wrong test-type mix;
- stale attempts from a repeated run against a same-named class.

Required fix:

- Capture the previous `newAttempts/reviewAttempts` before each day.
- After each day require exact deltas:
  - Day 1: `new +1`, `review +0`;
  - Day 2+: `new +1`, `review +1`.
- Prefer binding attempts by `studyDay`, `classId`, `listId`, `sessionType`, and `submittedAt` within the run window, not just counts.
- Fail on duplicates, not only on missing attempts.

### SLP1-3 — HIGH — Findings/anomalies do not affect the final verdict

The shared helper records serious anomalies through `F.add()`: `BUG`, `request-failed`, `unexpected-dialog`, `selector-gap`, `flow-gap`, and `ui-fb-mismatch`.

The Phase-1 harness never gates the final verdict on `F.raw`. Final verdict is only:

```js
(!halted && confirmedDays >= DAYS) ? 'PASS ...' : ...
```

This can false-pass when the browser saw an unexpected native dialog, a request failure, a modal dead-end, a selector gap, or a UI/Firebase mismatch that happened not to stop CSD/TWI.

Required fix:

- Define a fatal anomaly set for this harness.
- At minimum, fail on:
  - `BUG`;
  - `ui-fb-mismatch`;
  - `unexpected-dialog`;
  - non-allowlisted `request-failed`;
  - `flow-gap` or `selector-gap` after a step that was supposed to be mandatory.
- If some selector gaps are known recoverable, record them as recovered/nonfatal explicitly. Do not let raw severe findings silently coexist with PASS.

### SLP1-4 — HIGH — Rebuild diagnosis is too thin to satisfy the Phase-1 exit gate

The design requires a written diagnosis of why the rebuild screen fires. Current `out.rebuilds` records only:

```js
{ day, at: 'new-submit' | 'review-submit', screen }
```

That is not enough to distinguish app defect from harness race. It does not capture:

- URL/route at the moment of rebuild;
- whether a beforeunload dialog fired;
- the visible screen text;
- `driveTest` outcome;
- Firebase state before/after the submit;
- relevant `session_states` for `{classId}_{listId}`;
- last persisted attempts for the day;
- screenshot path.

Required fix:

- On every rebuild/rebuild-clear-failed, record a structured diagnostic snapshot:
  - day, phase, runId, buildId;
  - URL and short visible text excerpt;
  - last native dialog;
  - screenshot path;
  - `driveTest` outcome;
  - read-only Firebase before/after: class_progress, attempts for that day, and session_state for the active class/list.
- For recoverable rebuilds, record whether retry succeeded and what changed.
- For `rebuild-clear-failed`, hard-stop as it does now, but save the same diagnostic packet.

### SLP1-5 — MEDIUM — Assignment/list setup can be anomalous but the harness continues

`assignList()` may record:

```txt
assign list select "LSR TOP Vocab (audit clone)" failed
```

and still return `ok` if the list title is later visible. A prior RunSL finding already shows this exact selector-gap followed by `assign ... → ok`.

For this harness, the class assignment is load-bearing. If the wrong list, wrong mode, wrong pace, or wrong test size is assigned, the expected `+20` oracle is no longer trustworthy.

Required fix:

- After assignment, verify via UI and/or read-only Firebase that the class assignment exactly matches:
  - `listId === LIST.id`;
  - `pace === 20`;
  - `testMode === typed`;
  - `passThreshold === 92`;
  - `testSizeNew === 30`.
- Treat mismatch as `INVALID`, not a recoverable selector note.

### SLP1-6 — MEDIUM — Class lookup by name can bind to the wrong class on rerun

The harness resolves `classId` with:

```js
db.collection('classes').where('name', '==', out.className).get()).docs[0]?.id
```

If a runId is reused, or a prior failed run left the same class name behind, `docs[0]` can bind the Firebase checks to a different class than the UI is using. That can create both false-reds and false-greens.

Required fix:

- Require exactly one matching class for `out.className`, or bind classId through a more specific read:
  - teacher owner + class name + join code, if stored;
  - or record the class id at creation if a helper can expose it.
- If multiple matches exist, abort as `INVALID`.

### SLP1-7 — MEDIUM — Build identity is optional

The harness sets:

```js
const BUILD_ID = process.env.LSR_BUILD_ID || 'unspecified';
```

For a live deployed audit, `unspecified` undermines later certification. The Run S / Run L harnesses converged on bound build identity for this reason.

Required fix:

- Require `LSR_BUILD_ID`.
- Abort as `INVALID` if absent.
- Include it in every output artifact and screenshot prefix.

## Answers to Claude's questions

1. Can the harness report PASS when a day didn't actually happen?
   It is fail-closed on CSD/TWI, but not on UI-primary evidence, severe findings, or exact attempt deltas. So yes, it can report PASS while failing the intended evidence contract.

2. Firebase read-only?
   The harness uses Admin for `auth.getUserByEmail`, class lookup, class_progress reads, and attempts reads. I did not see an Admin write used to advance the run. Teacher class/list setup and student join happen through the UI.

3. Is `+1 csd / +pace twi` correct for this steady single-class control?
   Yes, assuming the fixture assignment is exactly pace 20, no intervention is active, and the list tail is not reached. With TOP size far above 320, list-tail should not apply.

4. Is rebuild diagnosis enough?
   No. `{day, at, screen}` is not enough to tell app defect from harness race. Add route, screenshot, visible text, dialog, drive outcome, session_state, attempts, and class_progress snapshots.

5. Robustness issues?
   Main robustness problem is not an infinite loop; it is verdict semantics. The harness records serious anomalies but does not let them fail the run. Also, reading UI progress without first returning to a confirmed dashboard state will produce spurious `ui.words=null`.

## Required fixes before smoke-test

1. Make UI progress confirmation fatal and navigate to dashboard before reading it.
2. Require exact per-day attempt deltas and fail on duplicates.
3. Gate final verdict on fatal findings/anomalies.
4. Expand rebuild diagnostics into a structured snapshot.
5. Verify assignment settings exactly before the day loop.
6. Make classId binding unique and fail if ambiguous.
7. Require `LSR_BUILD_ID`.
