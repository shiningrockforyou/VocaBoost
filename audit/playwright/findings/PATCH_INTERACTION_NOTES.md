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

## From VR1 (test components) — bundle gaps in files I ALREADY edit (fold-in candidates)
- **#2 (HIGH) — resultsProcessedRef not reset on 'new' retake (MCQTest + TypedTest).** A retake's grading writes to the attempt doc but `processTestResults` is skipped (guard `if(!resultsProcessedRef.current)` stays true), so study_states/mastery never update for the retake → gradebook vs mastery diverge. Present in origin/main AND working tree; my bundle does NOT fix it. **Both files are already in the bundle** → STRONG fold-in candidate (set `resultsProcessedRef.current = false` in the 'new' retake branch of handleRetake in both). I introduced the retake "Try Again" button (#3 fix) which makes new-test retakes more reachable — so this gap is now MORE exercised by my own change. Should fix together.
- **#1 (HIGH, TypedTest only) — submitError retry UI hidden inside `{isSubmitting &&}` overlay.** TypedTest's save-failure error/retry never renders (isSubmitting=false by then). MCQTest is NOT affected (has a separate inline block). TypedTest is in the bundle → fold-in candidate. (Review overstated scope to both; really TypedTest only.)
- #17 (MED) recovery resume restores answers without validating vs regenerated testWords (validateTestState helper exists, unused) — adjacent to the recovery work; consider.

## POST-DEPLOY VERIFICATION RESULT (VERIFY2, 2026-06-01) — bundle is LIVE (461eeef / index-C45gL9DN.js)
- **F01: VERIFIED FIXED.** 0 MASTERED leaks across 7 sessions (lazy Days 19-24 + careful Day 25); mastered pool grew 96→466. Was 48 leaks. selectTestWords filter holds under pool collapse. CLOSED.
- **Crash recovery: PARTIALLY fixed.** lastPhase='NEW_TEST' now written (the fix); session survives crash + re-routes INTO the test. BUT inputs come back EMPTY — answers persist in localStorage (by wordId) but are NOT re-populated into the form on re-entry. Routing restored; answer pre-fill NOT. → NEW follow-up item, same root as VR1 #17 (recovery doesn't read stored answers back into testWords; validateTestState helper unused). Severity HIGH-ish (student lands on right test but must re-type). Do NOT mark recovery "fully fixed."
- Deep-link _redirects LIVE (all routes 200, CDN-level). /mcq-test retake route no 404. Graceful-close suppresses recovery (correct). 0 orphan docs.

## FOLLOW-UP PATCH 2 — confirmed items for the next patch (bundle already deployed)
HIGH/near: #2 (retake skips processTestResults), #1 (TypedTest submitError overlay), #5 (challenge score inflation), #3 (legacy assignedLists progress), **recovery answer pre-fill (new, from VERIFY2 + VR1 #17)**, #36 (recovery index clamp), #8 (moveToReviewPhase error handling). Plus the B28 HIGHs (phantom-enroll rule + 102-student backfill, challenge atomicity+stale-day guard, Dashboard hooks). Group per AUDIT_CAMPAIGN_MASTER themes.

## FOLD-IN DECISION (RESOLVED: bundle deployed → all go to follow-up)
If the bundle is NOT yet deployed, fold these in (all in files already edited): #36 (clamp), #2 (resultsProcessedRef reset, HIGH), #1 (TypedTest submitError overlay, HIGH). #8 (moveToReviewPhase error handling) is also same-file. That would make the bundle materially stronger. If already deployed → all go to a follow-up patch.

