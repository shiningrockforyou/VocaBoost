# Patch-interaction notes — issues the vocaboost_ALL_fixes bundle touches but does NOT fully resolve (or slightly worsens)

Tracking interactions between my bundle and the CODE_REVIEW_2026-06-01 findings, surfaced during verification. These are NOT reasons to hold the bundle (it fixes 2 BLOCKERs + several HIGHs), but they must be addressed in a follow-up patch.

## From VR2 (session/blindspot) — both CONFIRMED real:

### #8 (MEDIUM) — moveToReviewPhase has no error handling (bundle does NOT fix)
`moveToReviewPhase` (DailySessionFlow.jsx ~937) calls `getSegmentWords` and a `Promise.all` over raw `getDoc` for failed words with no try/catch; `handleContinueToReview` has none either. A Firestore rejection silently hangs the Continue button. My `excludeRetiredMastered(...)` wrap sits on the RESULT of getSegmentWords — it does not add error handling. **Follow-up:** wrap these reads in try/catch with an error state; prefer withRetry helpers. (Same "error path destroys/hangs work" family as #1/#4.)

### #36 (LOW) — recovery currentIndex clamp mismatch (bundle slightly WORSENS)
`handleLocalRecoveryContinue` clamps `setCurrentIndex(Math.min(savedIndex||0, (studyQueue?.length||1)-1))` to the saved ID-list length, not the actually-restored queue length. My bundle wraps that restore path in `excludeRetiredMastered`, which can shrink the restored queue further → a larger index/queue mismatch → `currentWord` undefined / premature "all cards reviewed". **Follow-up (fold into bundle if re-rolling):** clamp against the FINAL restored queue length (after excludeRetiredMastered + the queueWordIds filter), i.e. `restoredQueue.length - 1`, not `studyQueue.length - 1`. Low severity but I introduced the interaction.

## Decision
- Bundle ships as-is (the 2 BLOCKER fixes outweigh these). 
- #36 fix is small and in a file I already edit — STRONG candidate to fold into the bundle BEFORE the user deploys, IF they haven't deployed yet. If already deployed, it goes in the follow-up patch.
- #8 is independent error-handling hardening — follow-up patch (part of the campaign's error-path sweep).

## From VR4 (db.js) — 11/11 confirmed (none touched by my bundle; all independent)
Notable: **#5 (HIGH) reviewChallenge score inflation** — recomputes score as `correctCount / updatedAnswers.length` instead of the persisted `totalQuestions`; on any skipped-question attempt this inflates the score and can flip passed false→true, even on REJECTION. Real teacher-facing correctness bug, independent of my bundle. #13/#27 (post-pagination filtering) + #24 (challenge RMW race) overlap Codex systemic patterns. #53 had a minor secondary over-claim (it IS list-scoped, not "all lists") — verifier corrected it.

## Verification-quality note (skeptical check on myself)
VR2 = 8/8 confirmed, VR4 = 11/11 confirmed. A near-100% confirm rate could mean (a) this review is genuinely high-quality (its file:line specificity supports that), or (b) the verifier agents are rubber-stamping. Evidence for (a): VR4 caught and corrected a #53 over-claim, and the earlier first CODE_REVIEW got many FALSE verdicts from me — so these agents DO push back. But before folding everything into the campaign, spot-check 2-3 "confirmed HIGH" items myself against raw code (esp. #5 denominator, #4 error overlay) rather than trust the aggregate. Do this after all 6 VR agents + B28 land.

(Append further interactions from VR1/VR3/VR5/VR6 as they report.)
