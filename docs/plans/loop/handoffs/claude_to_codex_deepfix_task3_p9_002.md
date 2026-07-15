# Claude → Codex: DEEPFIX Task 3 P9 (CYC) — round 2 (delta)

> **TASK = DEEPFIX_TASK3_P9, round 2.** Round 1 = NEEDS_FIXES (blocker=1 P9-1, high=2 P9-2/P9-3, med=1 P9-4). All
> 4 folded + orchestrator H1-verified. **Re-review ONLY the delta.** Write
> `/out/reviews/codex_deepfix_task3_p9_002.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The fixes (all keep the double-gate + flag-off byte-equivalence)
- **P9-1 (BLOCKER):** fixed at the ROOT — `initializeDailySession` (`studyService.js:355`) now SELF-RESOLVES cycling
  via the new `resolveEffectiveCycling(userId, listId)`; the old per-assignment `isCyclingActive` gate (which the
  curated settings object dropped) is REMOVED. Every session caller flows through init → all activate. The
  harness asserts Codex's exact check (enabled + FINISHED list → `cyclingActive:true`, `newWordCount>0`,
  `isListComplete:false`).
- **P9-2 (HIGH):** §3b cross-class unlock — pure `deriveEffectiveCycling(studentClasses, listId)` (unlocked iff ANY
  enrolled class assigns the list with `cyclingEnabled`; returns the source class) + `resolveEffectiveCycling`
  reusing the EXISTING `fetchStudentClasses` (fails closed on read error). Used in init + Dashboard (in-memory over
  `studentClasses`), with the "cycling enabled via {className}" affordance. ClassDetail (teacher, no cheap
  per-student cross-class data) uses class-own flag OR the `twi > cycleLength` "demonstrably cycling" signal.
- **P9-3 (HIGH):** canonical `getCycleLength(listId)` = `positions.length` via `getCountFromServer(query(words,
  orderBy('position')))` — the SAME population `resolveVirtualRange` wraps. Now the modulus for review lap-bound,
  failed-carryover bound, session `lapView`, AND Dashboard/ClassDetail denominators (`cycleLengths` maps).
  `wordCount` is no longer the modulus in any cycling math (transient fallback only while the count loads).
- **P9-4 (MED):** TypedTest self-resolves cycling via the shared init change + passes `config.cyclingActive` into
  `getNewWords` (identical to MCQ).

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
- Flag-off byte-equivalence VERIFIED: `resolveEffectiveCycling:100` returns `{enabled:false}` BEFORE any
  `fetchStudentClasses` read; Dashboard (`:653/:1108/:1715/:2099`) + ClassDetail (`:91/:287/:429`) gate EVERY
  cycling path on `CYCLING_ENABLED` → flag-off = empty `cycleLengths` + legacy path, no added read.
- Harness `audit/deepfix/task3/p9_assert.mjs` 15/15; parser ×10; eslint delta 0; `phase9_diff.patch` regenerated
  (git-apply-clean + round-trip).

## Re-review (delta)
1. **P9-2 correctness:** is `deriveEffectiveCycling` right (any-class-unlock, source-class surfaced)? Does the
   ClassDetail `twi > cycleLength` proxy ever false-positive/negative? Cross-class byte-equivalence off?
2. **P9-3:** is `getCycleLength` truly the SAME ordered-positions source as `resolveVirtualRange` in ALL consumers
   now? Any residual `wordCount`-as-modulus?
3. **P9-1:** the self-resolving init — any caller that BYPASSES init and still needs cycling? Any new read on the
   flag-off path (perf/equivalence)?
4. New integration issues from the resolver refactor. Convergence = 0 blockers/0 high → **P9 GO** (dormant; U3
   review-only×laps remains the owed pre-enable validation).
