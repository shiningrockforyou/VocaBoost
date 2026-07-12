# Codex Review — FIX10_CODE round 1

## Verdict

GO

CONVERGED-OK

## Scope reviewed

- Target plan: `docs/plans/loop/fix10/plan.md`
- Handoff: `docs/plans/loop/handoffs/claude_to_codex_fix10code_001.md`
- Diff snapshot: `docs/plans/loop/fix10/impl_diff.patch`
- Implementation synthesis: `docs/plans/loop/fix10/rounds/r02_impl_synthesis.md`
- Changed files:
  - `src/pages/TypedTest.jsx`
  - `src/pages/MCQTest.jsx`
- Supporting code checked:
  - `src/services/progressService.js`
  - `src/services/studyService.js`
  - `src/config/featureFlags.js`

## Findings

No blocker, high, or medium findings.

## Review notes

### 1. Race elimination

Status: correct.

In both final-completion blocks, the flag-on path now uses the pure read:

- `TypedTest.jsx:983-985`
- `MCQTest.jsx:722-724`

That replaces the previous post-attempt `getOrCreateClassProgress` call in the race window. The dangerous writer was inside `getOrCreateClassProgress` at `progressService.js:248-270`, where CSD/TWI reconciliation can log `csd_twi_reconciled` and `updateDoc` the class progress before `completeSessionFromTest` reaches the day guard.

After the patch, the flag-on sequence is:

1. attempt is written;
2. study state processing may run, but it does not write `class_progress`;
3. `getClassProgress` performs a pure `getDoc`;
4. optional snapshot is persisted without changing CSD/TWI;
5. `completeSessionFromTest` calls `updateClassProgress`;
6. `updateClassProgress` reads the current progress at `progressService.js:438` and applies the expected day update.

This removes the known self-race for both Day-1 final new-word completion and Day-2+ final review completion.

### 2. Null path

Status: correct.

`completeSessionFromTest` is outside the `if (progress)` block in both pages:

- `TypedTest.jsx:991-1022`
- `MCQTest.jsx:730-761`

If `getClassProgress(...)` returns `null`, the snapshot write is skipped and completion still runs. `updateClassProgress` self-creates the missing progress doc through its `setDoc` branch at `progressService.js:477-485`.

This matches the converged design and avoids the rejected fallback that would have reintroduced reconciliation.

### 3. Flag-off equivalence

Status: acceptable.

The read-source change is gated on `LIST_SCOPED_RECON`. Flag-off still calls:

```js
(await getOrCreateClassProgress(user.uid, classIdParam, listId)).progress
```

For app-written progress docs, the new `if (progress)` wrapper is behavior-equivalent because `getOrCreateClassProgress` returns a progress object. The `?? null` snapshot guards are also behavior-equivalent for normal app-created fields. For malformed/sparse documents, the new behavior is safer because it avoids letting undefined snapshot fields wedge completion; that is outside the flag-off equivalence contract for app-written docs and was accepted in the design review.

### 4. Parity / completeness

Status: correct.

The two new snapshot blocks are byte-identical between `TypedTest.jsx` and `MCQTest.jsx`.

The do-not-touch pre-attempt fallback calls remain in place:

- `TypedTest.jsx:823`
- `MCQTest.jsx:543`

Those are session-entry / study-day fallback reads, not the post-attempt race window.

No `progressService.js` change was introduced. Fix B is absent, as required.

### 5. Completion semantics

Status: correct.

`completeSessionFromTest` still routes through `recordSessionCompletion`, which calls `updateClassProgress` at `studyService.js:610-617`. The day-guard remains the authority at `progressService.js:441-451`, and the rebuild branch remains intact at `studyService.js:624-654`.

The fix changes only the pre-completion snapshot source under `LIST_SCOPED_RECON`; it does not weaken the day guard.

## Deployment note

This code is ready for the intended behavioral audit. The audit should still check the overlay conditions from the plan, especially:

- no rebuild/session-refreshed UI on legitimate final completion;
- one session document / one `recentSessions` entry;
- zero `day_guard_rejected_session_cleared` logs for the legitimate path;
- zero in-window `csd_twi_reconciled` events, with the window bounded to the final-attempt-to-completion interval.

## Final decision

VERDICT: GO

CONVERGED-OK
