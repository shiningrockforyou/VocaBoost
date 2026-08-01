# Codex review — Round 40 `UNIFIED_SESSION_STATE`

## Verdict

`SOUND-WITH-GAPS`.

The direction is correct: UI should become a render of a derived session state, and the current duplicated phase/progress predicates are a real root cause of the recurring bugs. But the §8 convergence is also right that the original “one pure `record -> view-model` derivation” framing is incomplete. The safe architecture is:

1. **Entry derivation:** durable record + attempts + assignment + resolved inputs -> session-entry config / view state.
2. **Exit derivation:** write outcome / completion result -> post-submit UI state.

Those are different seams. Collapsing both into a single `deriveSessionState(record)` would lose important refusal/hold/idempotency outcomes.

## G0 — entry-only derivation vs write-time exit outcomes

Confirmed, with one wording correction.

The critic claim is materially right: `completeSession` returns statuses that cannot be reconstructed safely from the entry record alone.

Evidence:

- `functions/foundation.js:1360-1364` returns `already_completed` or `day_guard_rejected` from the transaction guard.
- `functions/foundation.js:1410-1412` returns `no_evidence` without advancing.
- `functions/foundation.js:1458-1491` returns `review_recorded` for hold-csd.
- `functions/foundation.js:1533-1607` maps those outcomes into different post-transaction/logging/return paths.
- `src/services/studyService.js:1014-1085` maps server statuses into client sentinels such as `dayGuardRejected` and `completionNotApplied`.
- `src/pages/DailySessionFlow.jsx:1552-1555` blocks the success UI for `completionNotApplied`.

Nuance: `review_recorded` does write parts of the progress record (`recentSessions`, `reviewMode`, stats/streak), so “never persisted to the record” is not literally true for every outcome. But the **outcome status itself** is not a stable entry-state field, and `no_evidence` / `day_guard_rejected` / `already_completed` are explicitly return-channel semantics. A later `record -> VM` read cannot distinguish “the submit was refused and should show a blocking message” from ordinary entry state without another channel.

Conclusion: §8 is right. The design needs a second `deriveWriteOutcomeView(lastWriteOutcome, currentEntryState)` or equivalent. Do not make `record -> VM` responsible for rendering post-submit holds/refusals.

## C1 — Dashboard exclusion from first increment

Confirmed.

Dashboard currently derives phase from class-scoped attempts:

- `src/pages/Dashboard.jsx:1620-1623` filters attempts by both `classId` and `listId` before calling `determineStartingPhase`.

The session/reconciliation path can be list-scoped under `LIST_SCOPED_RECON`:

- `src/services/db.js:3416-3423` queries by `studentId + listId` across classes.

Dashboard also applies a non-demoting `Math.max` over resolved vs stored CSD at `Dashboard.jsx:1613-1615`. Those inputs are intentionally not byte-identical to the session entry path. Routing Dashboard through the first extracted function would be a behavior change, not a safe refactor.

Conclusion: exclude Dashboard from the byte-identical first increment. Treat Dashboard as a later consumer with its own launch-vs-merged-view policy.

## G1 — `heldReason` semantics

Confirmed.

The simple `heldReason: 'low-reviews' | 'list-end'` model is wrong/incomplete.

Current code distinguishes at least these cases:

- Throttle/allocation-zero review-only hold: `allocationZero && !listComplete && !reviewStudyResume` can hold CSD under forced pathway (`foundation.js:1458-1463`, `studyService.js:1797-1800`).
- List-end review-only is not the same as hold. `listComplete` is one of the review-only reasons, but it is explicitly excluded from the throttle-hold branch.
- #9 review-study resume is also review-only but excluded from throttle hold (`reviewStudyResume`).
- Non-engaged/skip review can hold even when it is not list-end.

So the view model needs separate fields such as:

- `reviewOnlyReason`: `allocationZero | listComplete | reviewStudyResume | none`
- `completionPolicy`: `advance | hold | requireRetake | refuse`
- `holdReason`: only for true hold cases, e.g. `throttleReviewOnly | nonEngagedReview | reviewBelowThreshold`

Also confirmed: there is no existing general “stuck/held” UI banner to consolidate. That surface is a new UX feature, not a free side effect of refactoring.

## G3 — `determineStartingPhase` purity

Confirmed.

`determineStartingPhase` is not pure today because it logs `impossible_phase_detected` on the day-1-passed branch:

- `src/services/studyService.js:292-305`

Dashboard has a loading guard specifically to avoid firing that side effect while half-loaded:

- `src/pages/Dashboard.jsx:1581-1586`

Correct extraction: split the pure decision from the side effect. Example:

- `deriveStartingPhase(...) -> { phase, recoveredScores, anomalies }`
- caller decides whether/how to emit `logSystemEvent` for `anomalies`.

Do not silently move the log into the pure core.

## G4 — input assembly has ordered writes

Confirmed.

`initializeDailySession` is not just “async reads then pure derivation.” It has ordered side effects:

- `getOrCreateClassProgress` first, including reconciliation (`studyService.js:348-349`).
- `returnMasteredWords` before the unmastered-pool read (`studyService.js:351-355` before `:418-419`).
- Cycling capability and cycle length resolution before allocation/pool behavior (`studyService.js:390-405`).
- Unmastered-pool read depends on post-returned study states.

A naive `Promise.all` input assembly can change behavior, especially for expired MASTERED words returning to the pool. The first increment must specify an ordered assembly pipeline, not just a bag of inputs.

Additional wrinkle: `DailySessionFlow.jsx:570-574` currently calls `returnMasteredWords` and then calls `initializeDailySession`, which itself calls `returnMasteredWords`. That duplicate is probably harmless/idempotent, but it is another reason to test exact behavior before “cleaning up” assembly.

## G5 — flags and epoch as explicit inputs

Confirmed.

A shared derivation must not import client `featureFlags.js` in one runtime and server constants from `foundation.js` in the other. That would recreate the twin problem inside the “shared” function.

Pass flags/epoch as explicit parameters, including at least:

- `LIST_SCOPED_RECON`
- `FORCED_PATHWAY`
- `REVIEW_PAIRING_V2`
- `CYCLING_ENABLED`
- grandfather/completion-engagement epoch
- future `reviewPassThreshold` / review-pass-gate behavior

## G6 — sequence after review-pass gate

Agree.

The planned review-pass threshold changes hit exactly the decision surfaces this refactor would extract:

- `studyService.js:266-270` review selection/completion predicate.
- `studyService.js:312-321` complete-vs-review-study branch.
- Completion evidence and challenge/override paths documented in `docs/plans/D3.5_WORKITEM_review_pass_threshold.md`.

If unified-state extraction lands first, the review-pass gate either edits the newly extracted function immediately or reintroduces a parallel predicate. Sequence after review-pass, or explicitly co-design both in the same change. Given current queues, after review-pass is cleaner.

## Shared client/server module hazards

The plan should not assume `functions/` can directly import arbitrary `src/utils` code.

Risks:

- `functions/` is CommonJS and separate from the Vite client graph.
- Many `src/` modules import Firebase client SDK, React-side config, browser globals, or ESM-only code.
- `Date.now()`, `Timestamp`, timezone helpers, and flag imports must be injected/normalized.

Safe options:

1. Put a pure, dependency-free module in a shared package/folder with no Firebase/React/browser imports and consume it from both build systems; or
2. Generate/copy the pure module into both runtimes and run equality/differential tests across fixtures.

For the first increment, avoid server sharing entirely. Client-only extraction keeps the pinned functions cutover untouched.

## `session_state.phase` deletion / demotion

Directionally safe, but do not delete all session-state semantics.

The current session route already treats attempts/config as more authoritative than persisted phase in several places:

- `DailySessionFlow.jsx:599-638` uses `config.startPhase` from attempt history to resume complete/review states.
- `DailySessionFlow.jsx:779+` checks persisted COMPLETE but then has guards around attempts and recovery.
- `session_states` is also cleared on day-guard collision from the server path (`foundation.js:1533-1559`).

So deleting `session_state.phase` as an authoritative routing input is reasonable. But `session_states` and browser `sessionStorage.dailySessionState` still carry real crash/multi-tab/display data:

- dismissed words
- queues/segment snapshot
- test return payloads
- review attempts
- assignment/list continuation context

Those cannot be hand-waved into the entry derivation without preserving their exact current shape and migration behavior. The first increment should demote `phase`, not delete the broader scratch/recovery channels.

## What the critics missed / additional risks

1. **Exit-channel mapping currently loses some useful detail.** `recordSessionCompletionViaServer` maps `review_recorded` to a success-shaped `{ progress: data.progress || null }`, but the server return at `foundation.js:1584-1590` does not include a progress object. The UI currently tolerates that. A future exit-view derivation should carry explicit `advanced:false`, `progressDay`, `reviewMode`, and reason fields rather than relying on null progress.

2. **The first increment must preserve the returned config object field-for-field.** Current consumers read many fields directly: `newWordCount`, `newWordStartIndex`, `newWordEndIndex`, `segment.wordIds`, `reviewCount`, `reviewSegmentSize`, `reviewBacklogTotal`, `testSizeReview`, `retakeThreshold`, `cyclingActive`, `cycleLength`, `lapView`, recovered scores, and `isListComplete`. Do not introduce the §3 idealized VM shape in increment 1.

3. **Timestamp normalization must be part of the seam.** Attempt timestamps and Firestore `Timestamp` vs serialized dates affect pairing and grandfather logic. Normalize to epoch millis before the pure core.

4. **PDF/debug helpers are real callers.** `getTodaysBatchForPDF` and `getDebugSessionData` call `initializeDailySession`. Equivalence tests need to include them or explicitly accept changed side-effect timing.

5. **Local recovery is another state machine.** `src/utils/sessionRecovery.js` and `sessionStorage.dailySessionState` still determine study/test recovery. A unified container will not be correct unless local recovery has a named place in the state model.

## Correct first increment

I agree with §8’s corrected first increment, with the constraints below.

Do first:

- Extract only the pure core inside `initializeDailySession`.
- Route `initializeDailySession` alone through it.
- Keep Dashboard out.
- Keep server out.
- Keep `determineStartingPhase` exported, but split its pure decision from side-effect logging or wrap anomalies explicitly.
- Preserve the exact returned config shape.
- Re-call existing leaf utilities; do not edit `forcedPathway.js`, `reviewPairing.js`, or study-algorithm leaves.
- Make flags/epoch explicit parameters.
- Keep ordered assembly: progress/reconciliation -> return mastered -> cycling/list/pool reads -> pure derivation.
- Sequence after the review-pass threshold work, or co-design the predicates.

Verification required before coding beyond design:

- Golden fixtures for `initializeDailySession` output across flag matrix: `LIST_SCOPED_RECON`, `FORCED_PATHWAY`, `REVIEW_PAIRING_V2`, `CYCLING_ENABLED`.
- Fixtures for dual-class same-list, #9 resume, list-end, cycling lap boundary/straddle, expired-mastered return, impossible day-1 passed anomaly, review-only allocationZero, non-engaged skip, and future review-pass threshold.
- Differential test must compare full config objects, not just `phase`.

## Final recommendation

Proceed with the unified-state architecture only after the review-pass gate is settled and the full state enumeration is written. The immediate buildable slice is client-only extraction of `initializeDailySession`’s pure core with differential tests. Do not include Dashboard, server unification, canonical progress migration, or UI container deletion in that first increment.
