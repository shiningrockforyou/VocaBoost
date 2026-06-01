# Loose Ends Wrap-up + Day-1 Results (2026-06-01)

## A. Day-1 persona run — ALL 10 COMPLETE (live prod, bundle index-CflgDyCK.js)
Goal: can a fresh student finish Day 1 with no issues? Result: **the Day-1 flow itself works for everyone; grading/word-selection/no-strand all clean. One mobile sync bug + one mobile-layout bug found.**

| # | Persona / class | Result | CSD | Notes |
|---|---|---|---|---|
| D1-01 | speedrunner / TOP | COMPLETED_NOPASS | 0→0 | first-word answers fail (correct); held day correctly |
| D1-02 | multidevice / TOP | COMPLETED_PASS | 0→1 | 100%, clean |
| D1-03 | slowlaptop / TOP | COMPLETED_PASS | 0→1 | slow cadence fine |
| D1-04 | trolling / TOP | COMPLETED_NOPASS | 0→0 | junk graded 0/30, no crash (correct) |
| D1-05 | phone / TOP (mobile) | **COMPLETED but NOT OK** | **1→1 (should be 2)** | **see F1/F2 below** |
| D1-06 | firsttimer / CORE | COMPLETED_PASS | →1 | CORE typed, pace 60, threshold 90 |
| D1-07 | recovering / CORE | COMPLETED_NOPASS | 0→0 | partial answers; held (correct) |
| D1-08 | rushed / CORE | COMPLETED_PASS | 0→1 | no double-submit under rush |
| D1-09 | perfectionist / CORE | COMPLETED_PASS | 0→1 | edit-churn → final answer stored correctly |
| D1-10 | hostile / CORE | COMPLETED_NOPASS | 0→0 | prompt-injection NOT accepted; no XSS; no crash |

**Universal positives:** 0 B2 strands, 0 console errors, 0 crashes, correct new-word slice, dedup holds, junk/injection correctly rejected, no orphan docs, no fabrication.

### NEW bugs from Day-1 (mobile, D1-05) — need follow-up
- **F1 (BLOCKER, mobile):** completed a Day-1 session at 390x844 — `session_state.phase=complete` and internal CSD=2, but **`class_progress.currentStudyDay` stayed at 1** (recentSessions empty, streak unchanged). A session-complete → class_progress sync failure on mobile. NEEDS reproduction on a 2nd mobile account before calling it mobile-only vs a general intermittent (desktop D1-02/03/06/08/09 all advanced fine, so it correlates with the mobile run — possibly a viewport/timing interaction, or a transient write failure). HIGH priority to confirm.
- **F2 (HIGH, mobile layout):** dashboard "Start Session" button sits ~17px below the 844px viewport fold on a standard iPhone → users must scroll to find how to start. Mobile CSS fix.
- **F3 (info):** Day-1 attempts carry `studyDay=2` in some cases (next-day index) — consistent with a known off-by-one display note; not corruption.

## B. Open follow-up patch items (FOLLOW-UP PATCH 2 — none deployed)
From the verified 63-finding review + B28 + recovery work. All are post-deploy follow-ups (the 2 BLOCKERs F01/B2 are already live-fixed):
- #2 (HIGH) retake skips processTestResults → mastery diverges (MCQTest+TypedTest)
- #1 (HIGH, TypedTest) submitError retry UI hidden in isSubmitting overlay
- #5 (HIGH) reviewChallenge score-denominator — **APPLIED (reviewChallenge_applied.patch), awaiting deploy**
- CSD-via-challenge stale-day guard — **APPLIED in same patch, awaiting deploy**
- #3 (HIGH) legacy assignedLists classes never load progress
- recovery answer pre-fill (VERIFY2 + VR1 #17) — routing fixed, answer repopulation not
- #36 recovery currentIndex clamp; #8 moveToReviewPhase error handling
- B28 HIGHs: challenge atomicity (runTransaction) — **specced in reviewChallenge_applied.README**; Dashboard conditional hooks
- NEW from Day-1: F1 mobile CSD-sync, F2 mobile Start-Session fold
- Themes/security tier: AUDIT_CAMPAIGN_MASTER.md (atomicity, post-pagination filtering, error-paths, data-shape, input-validation, grading rate-limit/injection)

## C. Other status
- Phantom enrollment: FIXED + backfilled + verified (103 students). Rule live.
- Guides: 4 updated, TA-first / study-first, no creds, deployed (1574922).
- ta@vocaboost.com account: user said keep (not deleting).
- reviewChallenge fixes: applied locally, delivered as patch, awaiting user deploy.
