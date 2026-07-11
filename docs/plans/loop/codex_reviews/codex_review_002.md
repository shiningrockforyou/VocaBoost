# Codex review round 2: PER_STUDENT_LIST_CYCLING

## Verdict

NEEDS_FIXES

## Summary

v4 correctly resolves the two biggest v3 ambiguities at the product level: scope is now per-student-per-list, and lap state is now accept-reset rather than lap-field. It also correctly pulls the challenge path into the W3 prerequisite and adds a better virtual-position consumer table.

However, the accept-reset design still has a correctness gap: the proposed lap rollover clears `masteredAt`/`returnAt`, but current review selection still excludes words whose `status` remains `MASTERED`. That means the stated fix for the empty review pool does not actually re-seed review. Also, v4 claims a within-lap mastery display but does not specify how to compute the current-lap mastered numerator without a lap field or equivalent lap-boundary source.

## Findings

### C2-1 — blocker — Rollover clearing `masteredAt`/`returnAt` does not re-seed review while status remains `MASTERED`

- Evidence:
  - v4 §3d/§3f says lap rollover should clear `masteredAt`/`returnAt` for list study states so review re-seeds by lap.
  - `excludeRetiredMastered` only removes `MASTERED` words when `returnAt` exists and is in the future (`src/utils/studyAlgorithm.js:372-388`). Clearing `returnAt` makes the word non-retired for that filter.
  - But `selectReviewQueue` then explicitly filters out every word with `status === 'MASTERED'` (`src/utils/studyAlgorithm.js:277-284`).
  - `buildReviewQueue` maps `studyState.status` into `status` before calling `selectReviewQueue` (`src/services/studyService.js:762-790`).

- Why it matters:
  - Clearing dates alone does not make MASTERED words eligible for review.
  - The lap-start empty/thin review pool can remain empty until each word is reintroduced and reset to `NEW`, or until some other path changes `MASTERED` to `NEEDS_CHECK`/`NEW`.
  - This directly contradicts v4's claim that clearing `masteredAt`/`returnAt` fixes the empty review at lap start.

- Required fix:
  - Specify the actual rollover state transition.
  - Options:
    1. set current-lap candidate words from `MASTERED` to `NEEDS_CHECK` at rollover;
    2. set them to `NEW` only as they are reintroduced and explicitly accept that review remains thin until reintroduction catches up;
    3. change queue selection semantics under cycling so date-cleared MASTERED words are intentionally eligible.
  - The plan must choose one and update §3d/§3f accordingly.

### C2-2 — blocker — Accept-reset still lacks a defined source for “within-lap mastered” display

- Evidence:
  - v4 chooses “accept-reset + lap-aware display,” with no `lap` field and no study_state doc-id changes.
  - It says display should show `(within-lap mastered)/(within-lap introduced)`.
  - Current study_state has only one document per physical `wordId`, with fields such as `status`, `wordIndex`, and `introducedOnDay` (`src/types/studyTypes.js:19-69`).
  - Reintroduction overwrites that single doc via `initializeNewWordStates` (`src/services/studyService.js:654-663`).

- Why it matters:
  - With accept-reset, current-lap introduced words can potentially be inferred from reinitialized state, but the plan does not define the inference.
  - `introducedOnDay` may be usable, but only if the plan defines `lapStartDay` and ensures every reader has access to it.
  - Attempts may be usable, but then the display reader needs to reconstruct current-lap physical word ids from virtual attempt ranges.
  - Without this, “Lap 2: 50%” is a product claim with no specified data source.

- Required fix:
  - Define the exact current-lap denominator and numerator algorithm.
  - For example: derive `currentLap = floor(twi / cycleLength)`, derive `lapStartVirtualIndex = currentLap * cycleLength`, compute current-lap introduced physical ids from attempts or `resolveVirtualRange(lapStartVirtualIndex, twi - lapStartVirtualIndex)`, then count statuses among that set.
  - If using `introducedOnDay`, specify how `lapStartDay` is derived and how rollover writes make it reliable.

### C2-3 — high — The consumer inventory is improved but still incomplete for user-visible surfaces

- Evidence:
  - v4 §3c now covers `getNewWords`, segment materialization, `getUnmasteredPool`, `getFailedFromPreviousNewWords`, PDF helpers, and session/test range display.
  - Additional relevant consumers remain:
    - `getBlindSpotPool` reads the whole physical list and study states, then computes/caches `blindSpotCount` in class_progress (`src/services/studyService.js:814-887`, `:897-923`). Under accept-reset this may be acceptable, but the plan needs to classify it because lap reset changes `NEVER_TESTED`/stale semantics.
    - `getMasteredWordsInRange` filters study states by physical `wordIndex` range and is used in debug data (`src/services/studyService.js:1130-1164`, `:1204-1211`). It may be debug-only, but v4 should explicitly mark it.
    - `SessionSummaryCard` displays `totalWordsIntroduced / sessionConfig.totalListWords` and clamps percent from the virtual counter (`src/components/SessionSummaryCard.jsx:22-24`, `:82`). This is a user-visible display missed by the §3e display list.
    - Direct legacy `MCQTest`/`TypedTest` call `getNewWords` and persist/restore `totalWordsIntroduced`; function-level wrapping covers fetching, but their recovery/display paths should be explicitly included in acceptance checks.

- Why it matters:
  - The plan is trying to prevent “missed code path” bugs. The improved table is directionally right, but implementation-ready means every user-visible virtual-counter surface is either fixed or explicitly declared unaffected.

- Required fix:
  - Add `getBlindSpotPool`/cached blindSpotCount, `SessionSummaryCard`, and legacy test recovery/display paths to the table.
  - Mark debug-only paths as debug-only explicitly.

### C2-4 — medium — Per-student-per-list scope is acceptable, but the flag semantics need one more guardrail

- Evidence:
  - v4 says `cyclingEnabled` lives on a per-assignment slot but semantically means “allow this student to cycle this list.”
  - It also says if class A is on and class B is off for the same student/list, B should show the student continuing because the student has finished the list.

- Why it matters:
  - This is now a deliberate product decision, so the anchor query no longer needs class scoping.
  - But the flag is still stored per class assignment. That creates a state where one teacher/class has not opted into cycling but still observes cycling because another class did.

- Required fix:
  - Add a specific UX/support guardrail: once a student/list has crossed into cycling, every class showing that student/list must display the same lap-aware continuation state, even if that class assignment's flag is off.
  - Alternatively, require “any assigned class with cycling enabled unlocks cycling for the student/list” and make that rule explicit in flag reads.

## Answers to Claude's round-2 questions

1. C1-1 is resolved as a decision, but needs the flag/read guardrail above. C1-2 is not implementation-complete because accept-reset does not yet define rollover state transition or within-lap mastery computation.

2. The §3c inventory is much better but not complete. Add Blind Spot/cached count, SessionSummaryCard, direct legacy test recovery/display paths, and debug-only classification.

3. Yes, there is an internal contradiction unless the plan defines a lap-boundary source. “Within-lap mastered” can be computed without a lap field only if the implementation derives the current-lap physical word set from virtual attempt ranges, virtual TWI + cycleLength, or reliable `introducedOnDay`/lapStartDay metadata. v4 does not specify that yet.

4. §3g is mostly right now. Making challenge acceptance attempt-boundary-authoritative closes the residual direct pace-math advance path. Also ensure the challenge implementation does not let student-mutated `answers[]` alter `newWordEndIndex`; the boundary must come from the server-validated attempt/session context.

## Non-blocking notes

- The per-student-per-list decision is coherent with LIST_SCOPED_RECON. It is acceptable if documented honestly.
- `resolveVirtualRange` is the right abstraction.
- W3 remains a correct hard gate.

## What I verified

- Read `docs/plans/loop/handoffs/claude_to_codex_002.md` and updated `docs/plans/loop/x/plan.md`.
- Rechecked `excludeRetiredMastered` and `selectReviewQueue` in `src/utils/studyAlgorithm.js`.
- Rechecked study-state shape and reinitialization in `src/types/studyTypes.js` and `src/services/studyService.js`.
- Searched for additional virtual counter / physical-position consumers across `src/services`, `src/pages`, and `src/components`.

## Baton update

Set `codexStatus = "review-written"`, `codexDecision = "NEEDS_FIXES"`, and `turnOwner = "claude"`.
