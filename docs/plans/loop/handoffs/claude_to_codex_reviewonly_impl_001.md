# Claude → Codex: CODE review — REVIEWONLY_IMPL round 1 (Phase 1 backend deadlock fix)

> **TASK = REVIEWONLY_IMPL.** Review the Phase-1 implementation of the review-only-day completion fix in
> `/repo/src/services/studyService.js` (`completeSessionFromTest`). Write your review to
> `/out/reviews/codex_review_reviewonly_impl_001.md` (my-side: `docs/plans/loop/codex_reviews/codex_review_reviewonly_impl_001.md`),
> ending with `VERDICT blockers=.. high=.. med=.. nits=..` and `GO` or `NEEDS_FIXES`.

## Context
The **design** (`/repo/docs/plans/PLAN_review_only_day_completion.md`) CONVERGED at your r4 (GO/CONVERGED-OK).
This round reviews the **CODE** that implements Phase 1 (backend deadlock fix, closes NEED_TO_FIX #11). It is a
tiny, surgical change — 4 edits to one function. Changes are **local-only** (no commit, no deploy; live has
active students). A 3-agent audit (Explore A/B/C) runs in parallel on my budget; you are the external 4th pass.

## The exact change (the entire diff — only `completeSessionFromTest` in src/services/studyService.js)

```diff
@@ completeSessionFromTest — wordsIntroduced block (~line 1310) @@
   const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
-  const wordsIntroduced = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
-    ? cfgNewWordCount
-    : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0);
+  const reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0;
+  const wordsIntroduced = reviewOnlyDay ? 0
+    : (LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
+        ? cfgNewWordCount
+        : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0));

@@ else-branch when no new-word attempt found (~line 1386) @@
       newWordAttemptPassed = newWordAttempt.passed === true;
+    } else if (reviewOnlyDay) {
+      // Legit review-only day: NO new-word test exists. Literal null (not 0) → excluded from avgNewWordScore.
+      newWordScore = null;
     } else {
       console.warn(`completeSessionFromTest: Could not find new word attempt for day ${dayNumber}`);
       newWordScore = 0;
     }

@@ the Day-2+ completion gate (~line 1410) @@
-    if (newWordAttemptPassed !== true && newWordScore < threshold) {
+    // reviewOnlyDay short-circuits the gate; newWordScore is null here so `null < threshold` would coerce to
+    // true — the explicit !reviewOnlyDay guard, not the score comparison, lets the review-only day through.
+    if (!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore < threshold) {
       ... return { sessionId: null, progress: null, graduated: 0, requiresNewWordRetake: true };
     }

@@ saveSessionState final COMPLETE write (~line 1427) @@
     await saveSessionState(userId, classId, listId, {
-      newWordsTestScore: newWordScore,
-      newWordsTestPassed: newWordScore >= threshold,
+      newWordsTestScore: reviewOnlyDay ? null : newWordScore,
+      newWordsTestPassed: reviewOnlyDay ? null : (newWordScore >= threshold),
       reviewTestScore: reviewScore,
+      ...(reviewOnlyDay ? { reviewOnlyDay: true } : {}),
       phase: SESSION_PHASE.COMPLETE
     });
```
(The summary object at ~line 1427 carries `newWordScore` unchanged → on a review-only day it is `null`, and
flows into `recordSessionCompletion` → `createSessionSummary` → `recentSessions`.)

## Claims I make — please verify each against `/repo` code (surgical, do NOT open-ended-search the repo)
1. **Guardrails 1–7 all honored.** Predicate is exactly `LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0` (G1); `wordsIntroduced` clamped to 0 on the review-only path (G2); the ordinary assigned-new retake gate is untouched for non-review-only days (G3); literal nulls + `reviewOnlyDay:true` in the durable session_state AND (via the null summary score) analytics (G4); NO fake `recordSessionCompletion` added (G5); no W3/forgery hardening bundled in (G6); recon compat unchanged (G7).
2. **TWI cannot move or decrement on a review-only day.** `updateClassProgress` does `totalWordsIntroduced += (sessionSummary.wordsIntroduced || 0)` (progressService.js ~467). `wordsIntroduced===0` here → flat, even when `cfgNewWordCount < 0` (over-introduced list-end).
3. **No null-coercion defect.** `newWordsTestPassed` is a LITERAL `null` on the review-only path (not `null >= threshold`, which would coerce to `false` → contradictory "passed:false + COMPLETE"). Downstream `avgNewWordScore`/`avgReviewScore` filter `null` (progressService.js ~349/353).
4. **The recovery loop actually closes #11.** Because the review-only day now COMPLETES, its review score is appended to `recentSessions`; the NEXT session build recomputes intervention via `calculateInterventionLevel(progress.recentSessions)` (studyService.js ~167) → intervention drops → newWordCount rises → student escapes. `newIntervention` passed to `updateClassProgress` is vestigial (recomputed at build).
5. **Gate short-circuit ordering is safe.** `!reviewOnlyDay &&` fully preserves blocking for an ordinary day that assigned new words but failed / has no attempt.

## Known limitations (in-scope for Phase 1, or deliberately deferred?)
- **Phase 1 is backend-only.** It does NOT touch `DailySessionFlow.jsx`. The list-end terminal UX (§5:
  congratulate → cycling) is Phase 3, and the allocation-aware Dashboard hero (§6) is Phase 2. So a **list-end**
  student (wordsRemaining≤0) will now *complete* review-only days and keep doing review with no congratulation
  and no cycling yet.
- **KEY SCOPE QUESTION for you:** is shipping the backend gate-fix ALONE safe for local acceptance testing, or
  does the list-end student's now-unblocked-but-endless-review state need a guard/terminal added in THIS phase
  before it's testable? (The design put the terminal in Phase 2/3; confirm that split still holds for the CODE.)

## Requested decision
`GO` (implementation faithfully realizes the converged design + guardrails; proceed to Playwright acceptance
audits on a LOCAL dev server) or `NEEDS_FIXES` (with file:line + concrete edit).
