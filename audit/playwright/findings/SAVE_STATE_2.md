# VocaBoost Audit — Save State 2 (2026-05-31, late)

## Git / deploy
- Local `/app` == `origin/main` == prod commit **6e9dd4a** (0 ahead/0 behind, clean). Live bundle: `index-Q7YGdakV.js`.
- 6e9dd4a contains: B2 fix (saveSessionState strip-undefined + newWordScore=0), F01 build-time filter (buildReviewQueue), F01 selectReviewQueue backstop. All present in deployed bundle.
- My local working tree currently has the **quick-fixes patch edits applied but NOT committed** (Codex #3/#5/#7/#8): MCQTest.jsx, TypedTest.jsx, sessionService.js, studyAlgorithm.js, public/_redirects. Delivered as `vocaboost_quick_fixes.patch` (+ README). NOT yet on origin/main.

## Verified status of each fix
- **B2 (day-not-advancing strand): CONFIRMED WORKING in prod** (VERIFY: CSD advanced 17→18, zero "undefined" errors).
- **F01 (MASTERED-in-review): STILL LEAKING in prod — fix was ineffective.** VERIFY identity-verified 48 leaks across 4/6 lazy pool-collapse days (Day16=21, Day17=20). Root cause CONFIRMED in source: review TEST words come from MCQTest.jsx:322-328 / TypedTest.jsx:378-384 = `getSegmentWords()`→`selectTestWords()`, NEITHER filters MASTERED ("PATH C"). My selectReviewQueue backstop is on a path the test doesn't use. careful/normal-play = 0 leaks (PATH A ok) but doesn't stress it.

## IN FLIGHT (3 read-only investigators, launched ~16:25, ~30min)
- **MAP-TEST** (a...781f) → findings/F01_PATHMAP_test.md — every test-word population path + single chokepoint.
- **MAP-QUEUE** (a...272e) → findings/F01_PATHMAP_queue.md — every setReviewQueue path incl. complete-mode.
- **MAP-LIFECYCLE** (a...7825) → findings/F01_LIFECYCLE.md — is `status!=='MASTERED'` sufficient or need `returnAt>now`? (depends on when returnMasteredWords runs).
Goal: write ONE definitive F01 fix at the right chokepoint, no missed path. Then user deploys, I re-run lazy VERIFY → expect 0 leaks.

## OPEN — recovery issue (unresolved, user asking about it now)
- "Restart loses in-progress work" HIGH is **downgraded/unconfirmed**. Two harness artifacts muddied both re-tests: (1) fresh Playwright context wipes localStorage; (2) Skip-to-Test bypasses the `useEffect` (DailySessionFlow:382) that writes `lastPhase:'NEW_TEST'`, so recovery never triggers.
- Code reading says recovery SHOULD work: crash→reopen→DailySessionFlow checkTestRecovery (line 679) routes straight to test + TypedTest restores answers from `vocaboost_test_*` localStorage + shows recovery prompt. beforeunload sets intentional_exit on graceful close (→clears, intended) but NOT on crash (→recovers). The agent's proposed navigateToTest fix was WRONG (the write already exists at line 382).
- NOT confirmed working end-to-end (both tests contaminated). Only real remaining gap: **3-minute recovery window** (testRecovery.js) = MEDIUM/optional.
- **Owed: one clean re-test** — reach the test via real study→navigateToTest (NOT skip), preserve localStorage across simulated restart (persistent context), confirm answers restore.

## Codex findings (all 8 verified valid — CODEX_REVIEW.md)
- Patched in quick-fixes (uncommitted): #3 retake route+UI, #5 _redirects, #7 NEEDS_CHECK bucket, #8 updateSessionState strip-undefined.
- HELD for human review: #1 joinClass phantom enrollment (rules-vs-code: rules reject studentIds write), #2 challenge non-atomic + stale-day guard, #4 Dashboard conditional hooks. Plus npm audit (4 crit/12 high), 458 lint errors.

## Other confirmed product issues
- Empty correctDefinition (~5.5% words) crashes whole grading batch (HIGH) — data backfill + function skip-and-mark.
- Beginner ~90% just under 0.90 pass threshold → stuck (MEDIUM); compounded by #3 retake being broken.
- Grader slightly too lenient (reversed-meaning) (LOW).
- Doc: grading is Claude Haiku 4.5, not OpenAI.

## Confirmed GOOD (don't re-audit)
- 20-day continuous walk ACHIEVED (run_walk20.mjs, Date-constructor shim). CSD advances freely (no once-per-day gate; that was a misdiagnosis).
- AI grading on REAL data: ~96.8% acc, 0 false negatives, big improvement over old GPT grader. Production-ready.
- New-word selection, dedup under rapid submit, edit-churn integrity, intervention/suppression, Korean UTF-8: all pass.
- No fabrication / 0 orphan docs from harness.

## Reusable harness
- e2e/audit/B27/run_walk20.mjs (Date shim + H2 Move-On + fresh context).
- e2e/audit/helpers/expectedWords.js (checkReviewWords identity, checkNewWords).
- VERIFY pattern: deploy-gate on live bundle signatures → lazy pool-collapse + careful past-day-16 + B2 strand.

## Next actions (priority)
1. Await 3 MAP agents → write definitive F01 PATH-C fix → deliver patch → user deploys → re-run lazy VERIFY.
2. Clean recovery re-test (real study→navigateToTest flow, preserve localStorage).
3. Teacher-side audit B28 (batches/B28_teacher_side_audit.md ready) — covers Codex #1/#2/#4.
4. Commit quick-fixes patch (user/dev decision).

## Key gotchas
- Source files are CRLF — use perl/Edit carefully.
- node --check can't parse JSX (ERR_UNKNOWN_FILE_EXTENSION) — use esbuild.transformSync to validate.
- vite build unrunnable in sandbox (missing lucide-react dep + .vite-temp EACCES) — unrelated to edits.
- Bash output sometimes buffers/empties — write to /tmp file then Read.
- I cannot push/PR (no creds, no gh) — deliver patches; user applies. Sandbox auto-syncs to origin/main after user pushes.
- F01 RULE: only "fixed" when lazy pool-collapse VERIFY shows 0 identity-verified leaks. (Was wrong twice.)
