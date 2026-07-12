# Codex Review — FIX10_OVERLAY_CODE round 1

## Verdict

NEEDS_FIXES

## Scope reviewed

- Handoff: `docs/plans/loop/handoffs/claude_to_codex_fix10overlay_001.md`
- Plan: `docs/plans/loop/fix10/plan.md` §8
- Harness under review: `audit/playwright/lsr_fix10_overlay.mjs`
- Reference harness/helper code:
  - `audit/playwright/lsr_runSL_phase1.mjs`
  - `audit/playwright/lsr_ui.mjs`
- App data model checked:
  - `src/services/progressService.js`
  - `src/services/studyService.js`
  - `src/services/sessionService.js`
  - `src/services/db.js`

## Summary

The green-mode primary oracle is mostly sound: it asserts UI success, `recentSessions`, session doc creation, session-state completion, no day-guard log, and no in-window reconciliation. That is the right discriminator for #10 because the broken build can still end at the same CSD/TWI through reconciliation.

However, the harness as written has three material correctness gaps:

1. red-mode cannot actually exercise the Day-2 review cells on the broken build as claimed;
2. the `csd_twi_reconciled` window can false-red on a fixed build because the app does not await the session-entry log write;
3. fatal findings are ignored in red-mode verdicting.

These need correction before the overlay can be treated as a reliable gate.

## Findings

### F10O-1 — BLOCKER — red-mode Day-2 cells are structurally unreachable on the broken build

The harness claims `FIX10_EXPECT=red` can verify the pre-fix #10 signature across the full 4-cell matrix, including Day-2 review-final cells.

Current Day-2 setup:

- `lsr_fix10_overlay.mjs` drives Day-1 setup via `driveNewPass(page, className, 1, ...)`.
- Then it drives Day-2 new via `driveNewPass(page, className, 2, ...)`.
- Only after that does it measure Day-2 review-final with `measureCompletion`.

Problem: on the broken pre-fix build, Day-1 final completion is itself one of the #10-triggering paths. `driveNewPass(... day 1 ...)` rejects any rebuild:

```js
if (rb !== 'clean') return { ok: false, reason: `unexpected-rebuild:${rb}` };
```

So on the broken build, the Day-2 cells will usually fail during setup before reaching the measured Day-2 review-final completion. Because `measured.length < CELLS.length` is handled as `INCOMPLETE`, red-mode cannot produce the claimed full 4-cell red confirmation.

This does not invalidate green-mode by itself, but it does invalidate the stated “fixed=green, broken=red, both Day-1 and Day-2+” contract.

Required fix options:

- either implement a valid red-mode Day-2 precondition path that can reach Day-2 review on a broken build without using the broken Day-1 final completion as setup;
- or explicitly scope red-mode to the cells it can actually reproduce and change the verdict contract/documentation accordingly;
- or make red-mode use an owner-approved seeded Day-2 fixture if you decide that crosses the read-only UI boundary intentionally.

Do not leave the current claim in place.

### F10O-2 — HIGH — d6 can false-red because session-entry reconciliation logging is async and unawaited

The plan correctly requires the completion window to exclude legitimate session-entry reconciliation. The harness tries to do this by opening the window after `driveNewWordsToTest` / `driveReviewToTest` reaches the test page:

```js
const before = {
  recon: await logCount('csd_twi_reconciled', uid, classId),
  ...
};
```

But the app logs reconciliation like this:

- `progressService.js:253` calls `logSystemEvent('csd_twi_reconciled', ...)` without `await`.
- `db.js:90-97` writes the log asynchronously via `addDoc(... serverTimestamp())`.

Therefore, a legitimate session-entry reconciliation can be triggered before the harness opens `before`, but the `system_logs` document may land after `before` is counted. In that case a fixed build can show:

```js
after.recon === before.recon + 1
```

even though no completion-block reconciliation occurred. That would make `d6_noRecon` false and produce a false-red/fail for a correct build.

Required fix:

- after reaching the final test page, drain/stabilize reconciliation logs before opening the measured window; for example, poll `logCount('csd_twi_reconciled', uid, classId)` until stable across at least two polls over a short settle interval, then set `before`;
- alternatively, use a timestamp/run marker that can distinguish session-entry logs from final-submit logs, but current log docs only have `serverTimestamp`, so count-stabilization is simpler.

The window boundary is conceptually right; the implementation needs to account for the app’s unawaited log write.

### F10O-3 — HIGH — fatal findings do not fail red-mode

The harness computes fatal findings:

```js
const fatals = (F.raw || []).filter(isFatal);
```

But the verdict only applies fatal findings in green mode:

```js
else if (EXPECT === 'green') {
  if (fatals.length) out.verdict = `FAIL ...`;
  ...
} else { // red
  if (redCells >= 2 && redCells === CELLS.length) out.verdict = `REPRO-CONFIRMED ...`;
  ...
}
```

This means `FIX10_EXPECT=red` can exit 0 with `REPRO-CONFIRMED` even if the run recorded fatal anomalies such as `unexpected-dialog`, `page-error`, `selector-gap`, `modal-dead`, or non-allowlisted request failures.

That violates the fail-closed contract and weakens “red for the right reason.”

Required fix:

- apply the fatal-finding gate before both green and red verdict branches;
- or make red-mode return a distinct invalid/fail state when fatal findings exist.

### F10O-4 — MEDIUM — pristine baseline does not check list-scoped `study_states`

The per-cell baseline checks class-scoped progress and attempts:

```js
base.csd === 0
base.twi === 0
base.newAttempts === 0
base.reviewAttempts === 0
```

That is necessary but incomplete for accounts reused against the same TOP list. `study_states` are list/word-scoped, not class-scoped. A reused student can have old list-specific word state while still showing zero progress/attempts for the newly created class.

This is more likely to cause an incomplete or false-red than a false-green, but it is still a harness reliability gap. The Run L and acceptance harnesses already moved toward stricter freshness for this reason.

Recommended fix:

- add a read-only baseline check that the student has no `study_states` for `LIST.id`, or only use accounts proven clean for this list;
- include session-state absence for the new `{classId}_{listId}` doc as a cheap extra check, though the fresh class makes that less likely to matter.

## Checks that passed

### Green primary oracle shape is correct

The six discriminators are the right family of assertions for a fixed build:

- results UI and no rebuild;
- `recentSessions` `+1` with day `N`;
- one new `users/{uid}/sessions` doc;
- `session_states/{classId}_{listId}.phase === 'complete'`;
- no new `day_guard_rejected_session_cleared`;
- no in-window `csd_twi_reconciled`, once F10O-2 is fixed.

This correctly avoids the non-discriminating CSD/TWI-only oracle.

### App data model assumptions mostly match code

Confirmed:

- successful `recordSessionCompletion` appends `recentSessions` via `updateClassProgress`;
- successful completion creates a `users/{uid}/sessions` doc;
- day-guard rejection returns before session doc creation;
- `SESSION_PHASE.COMPLETE` is the string `'complete'`;
- `csd_twi_reconciled` is emitted from `getOrCreateClassProgress`.

One nuance: `saveSessionState(... phase: COMPLETE ...)` happens before `recordSessionCompletion`, so the broken path can briefly stamp COMPLETE before the day-guard branch clears session state. The harness’s after-settle `phase === 'complete'` check is still useful because the rejection path attempts to clear the session state.

### Four green paths are plausibly exercised

The four cells map to the intended files and final-completion branches:

- TD1: Typed Day-1 new-final
- TD2: Typed Day-2 review-final
- MD1: MCQ Day-1 new-final
- MD2: MCQ Day-2 review-final

For post-fix green-mode, the setup should be capable of reaching all four paths if accounts are clean.

## Required changes before GO

1. Fix or rescope red-mode so its Day-2 claim is true.
2. Stabilize/drain session-entry reconciliation logs before opening the d6 completion window.
3. Apply fatal-finding gating to red-mode as well as green-mode.
4. Add or document a strict list-scoped freshness check for `study_states`.

## Final decision

VERDICT: NEEDS_FIXES
