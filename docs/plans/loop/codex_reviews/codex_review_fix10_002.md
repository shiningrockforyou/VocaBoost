# Codex Review — FIX10_DESIGN round 2

## Verdict

GO

CONVERGED-OK

## Scope reviewed

- Target plan: `docs/plans/loop/fix10/plan.md`
- Handoff: `docs/plans/loop/handoffs/claude_to_codex_fix10_002.md`
- Prior synthesis: `docs/plans/loop/fix10/rounds/r01_synthesis.md`
- Code paths checked:
  - `src/pages/TypedTest.jsx` final completion path
  - `src/pages/MCQTest.jsx` final completion path
  - `src/services/progressService.js` `getOrCreateClassProgress`, `getClassProgress`, `updateClassProgress`

## Findings

No blocker/high findings remain.

## Round-1 fixes rechecked

### F10-1 — fallback removed

Status: resolved.

The v2 plan removes the unsafe `getClassProgress(...) ?? getOrCreateClassProgress(...)` fallback. That matters because the fallback would have reintroduced the exact race: after the final attempt write, `getOrCreateClassProgress` can reconcile CSD/TWI before `completeSessionFromTest` calls `updateClassProgress`, causing the day guard to reject the legitimate completion.

The revised null path is correct:

- flag-on path does a pure `getClassProgress`;
- if the doc is absent, it skips `progressSnapshot` persistence;
- it still calls `completeSessionFromTest`;
- `updateClassProgress` re-reads current state and can self-create the progress doc.

This is safe against the code as written: `getClassProgress` is a pure `getDoc`, while `updateClassProgress` has a create path via `setDoc`.

### F10-2 — flag-gated read-source swap

Status: resolved.

The behavior-changing part is now gated on `LIST_SCOPED_RECON`. Flag-off continues to use `getOrCreateClassProgress`, preserving Run-L/legacy equivalence for the completion path.

The shared `if (progress)` block and `?? null` snapshot guards are acceptable. In normal flag-off behavior `getOrCreateClassProgress` returns a progress object, so `if (progress)` is not behavior-changing. The `?? null` guards are minor snapshot-shape hardening, not a reconciliation or completion semantic change. If an exact byte-for-byte diff is demanded later, those guards can be gated too, but I do not think that is necessary for this fix design.

### F10-3 — Fix B deferred

Status: resolved.

Deferring the same-day idempotency change is the right scope call. Fix A directly removes the known race source. Fix B should only be reconsidered if post-fix evidence shows an independent duplicate completion path still exists.

## Answers to handoff questions

### 1. Is the null-path skip safe?

Yes.

The dangerous variant was: pure read returns null, then `updateDoc(progressRef, { progressSnapshot })` throws, the catch swallows the completion path, and the valid session never completes. V2 avoids that by skipping snapshot persistence when `progress` is null and proceeding to `completeSessionFromTest`.

The tradeoff is acceptable: in the rare missing-doc case, retake snapshot protection is unavailable for that completion, but the primary completion is preserved and `updateClassProgress` can create the authoritative progress doc.

### 2. Is gating only the read source enough?

Yes.

The only intended semantic change is avoiding a reconciling read between attempt persistence and session completion. Gating that read-source change under `LIST_SCOPED_RECON` is sufficient.

Do not move the earlier study-day fallback reads at `TypedTest.jsx` / `MCQTest.jsx`; those are pre-attempt session-entry reads and are not the race being fixed.

### 3. Is “zero `csd_twi_reconciled` in the completion window” a valid overlay discriminator?

Yes, with one boundary condition: define the completion window tightly.

For the controlled overlay cases, after the final attempt write and before the completion result settles, a correct implementation should not call `getOrCreateClassProgress`, and `completeSessionFromTest` itself should complete through `updateClassProgress` rather than reconciliation. Therefore zero `csd_twi_reconciled` events in that window is a valid discriminator.

To avoid false reds, the audit should not include later dashboard reloads, session-entry probes, or other intentional reconciliation-triggering loads in the same window. The primary assertions should remain:

- no rebuild / session-refreshed branch;
- one new session doc;
- `recentSessions` gained exactly one entry for the completed day;
- session state reached `COMPLETE`;
- zero day-guard rejection logs.

The zero-reconciliation assertion is useful as a race detector, not as the sole oracle.

## Implementation notes for the next phase

- Both `TypedTest.jsx` and `MCQTest.jsx` need the same final-completion change.
- Both files must import `getClassProgress` and `LIST_SCOPED_RECON`.
- Keep the change limited to the final completion block after a passed final test.
- Do not alter the pre-attempt/session-entry `getOrCreateClassProgress` calls.
- Keep Fix B out of this patch unless new evidence proves Fix A is insufficient.

## Final decision

VERDICT: GO

CONVERGED-OK
