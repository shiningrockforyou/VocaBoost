# vocaBoost Audit — SAVE STATE
**Checkpoint:** 2026-05-31 ~09:00 KST. Written before launching the B27 11-persona fan-out.
**Orchestrator:** main Claude session (Opus). Batch agents: Sonnet. Target: PRODUCTION (live Netlify https://vocaboostone.netlify.app, Firebase vocaboost-879c2).

---

## TL;DR — where we are
1. **First audit (27 batches B00–B26): COMPLETE & AGGREGATED.** All 3 P0 gates green, 0 true BLOCKERs, security clean. Deliverables written.
2. **B27 redesign (no-fabrication longitudinal word-correctness): canary done, fix made, fan-out PENDING.** Canary (careful/TOP) validated the harness AND caught a real BLOCKER (F01).
3. **F01 fix: DEPLOYED.** PR #17 (branch claude/ecstatic-keller-Pz0Vi, commit 4bd325b) merged + deployed to live Netlify by the user.
4. **NEXT ACTION:** fan out B27 to the remaining 11 personas against the now-fixed live site. Everything is prepped.

---

## A. First audit (B00–B26) — DONE
- 27/27 batches, 27 findings files in `findings/findings_B*.md`, ~213 trials, 1497 evidence files.
- Deliverables: `findings/SUMMARY.md`, `findings/RECOMMENDATIONS.md`, `findings/EVIDENCE_INDEX.md`, `audit_state.json` rollup.
- All 3 P0 gates GREEN: B02/B03 persistence, B22 day-progression state machine, B26 AI grading. Security clean (B01 no fail-open, B13 no XSS, B12/B13 Firestore rules deny cross-student).
- 5 false positives caught+corrected vs Firestore ground truth (all rooted in B22 Admin-SDK prod pollution → orphan classId-only class_progress docs). Detail in SUMMARY "what wasn't tested / caveats".
- Confirmed HIGH cluster (multi-batch): challenge subsystem (non-atomic submitChallenge=#15, reviewChallenge double-day-advance, history race, lost pending badge — B23/B11/B19); joinClass silent-fail + studentCount drift (B12/B24/B16, =#11); newWordsTestScore:undefined→setDoc (B07/B08/B15/B14); no-Retake-button (B04/B11); tab-close wipes answers (B06); #13 teacher/student day mismatch REAL on real students (B18, multi-list aggregation, needs dev investigation). MEDIUM silent-state UX cluster (#3 review invisible, #9 pace silent, blind-spot false-verified). Plus Netlify _redirects (recommendation, not run-affecting).

## B. B27 redesign — IN PROGRESS
**Why:** user-requested after audit 1, to (a) eliminate fabrication (root cause of the 5 false positives) and (b) add missing word-correctness coverage across ~20-day walks.
**Locked decisions:** review begins Day 2 (existing behavior correct, no change); production backend (NO emulator); 12 word/day-affecting personas; ~20-day walks; no app fixes before audit reports them.

**Artifacts (all on disk, verified):**
- Spec: `audit/playwright/batches/B27_longitudinal_word_correctness.md` (74L) — includes HARD RULES (no fabrication, Admin-SDK read-only, UI-only), H2 stale-Step-5 guard, post-test-TWI fix, logout/login-mid-session scenario.
- Model: `e2e/audit/helpers/expectedWords.js` (88L, ESM — package.json is type:module, MUST use import not require). Verified 8/8 behavioral checks. Functions: expectedNewWordRange, calculateSegment, partitionReviewEligibility (MASTERED exclusion), checkPresentedWords, calculateInterventionLevel, newWordCount.
- Word cache: `e2e/audit/B27/word_position_cache.json` (full 3381-word position map, built live).
- Login helper fixed: `e2e/audit/helpers/auth.js` (loads '/' then client-routes /login; submit button "Continue"; lands '/').

**Canary result (agent CW, careful/TOP, app Day 4→15, 10 real sessions):** findings in `findings/findings_B27_careful.md` (reconstructed by orchestrator; agent's write was lost). Evidence: `findings/evidence/B27/careful/day_NN.json` (21 files).
- HARNESS WORKS: no-fabrication confirmed (0 orphan docs created; all attempts correct classId_listId format). Core redesign goal MET.
- NEW words correct every session (exact [twiBefore, twiBefore+pace) slice).
- **F01 BLOCKER (Firestore-verified real):** MASTERED words reappeared in review before returnAt and got re-tested/downgraded. Day 16: review served 27 words all MASTERED, eligibleForReview=7; histogram PASSED 55→85 = real progress regression.
- **F01 root cause CORRECTED by orchestrator** (canary's diagnosis was WRONG): NOT getStudyStatesForWords (that function is fine, batchSize declared line 248). REAL cause: buildReviewQueue (studyService.js:564) never excluded MASTERED before selectReviewQueue (which has no MASTERED branch). Confirmed by reading source.
- F02 MED: NEEDS_CHECK status undocumented; 21-day return fired in-run (Date.now shim artifact, correct behavior). F03 MED: "Completed Day N" shown on typed result while review still pending.

**MASTERED graduation logic (for reference):** segment-wide, random, score-proportional. graduateSegmentWords (studyService.js:846) at session completion graduates floor(segmentSize × reviewScore) RANDOM eligible segment words (eligible = whole segment minus this-test failures) → MASTERED, returnAt=now+21d. A NEVER_TESTED word can become MASTERED. returnMasteredWords (studyService.js:911) flips MASTERED→NEEDS_CHECK after 21d at session init. NOT per-word mastery — flagged as a possible product-design question separate from F01.

## C. F01 FIX — DEPLOYED
- Fix: buildReviewQueue filters `studyState.status !== WORD_STATUS.MASTERED` before selectReviewQueue.
- Local: branch `audit/fix-mastered-review-exclusion`, commit f38e383, +patch `audit/playwright/B27-F01-mastered-review-fix.patch` (verified applies clean on origin/main).
- Remote: user applied patch → PR #17, branch `claude/ecstatic-keller-Pz0Vi`, commit 4bd325b → **MERGED + DEPLOYED to live Netlify** (user confirmed "deployed").
- Cosmetic nit: patch appended a duplicate `| Date | File | Change |` header to change_action_log.md — harmless, user may trim.
- KNOWN ADJACENT GAP (not fixed): selectReviewQueue also has no NEEDS_CHECK branch — returned words may not re-enter review. Flagged for follow-up; B27 fan-out should watch for it.

## D. NEXT ACTION — B27 fan-out (READY TO LAUNCH)
Fan out B27 to the 11 remaining personas against the NOW-FIXED live site:
**korean, esl, lazy, anxious, advanced, beginner, speedrunner, perfectionist, rushed, distracted, classswitcher** (careful already done by canary).
- Run 4-wide (Sonnet), ~20-session walks each, per the B27 spec. Each: word-correctness check every session + the logout/login-mid-session scenario + post-run no-fabrication self-check.
- Because the fix is deployed: assert NO MASTERED word (future returnAt) appears in review (F01 should be RESOLVED). If it still leaks on ≥2 days → fix regressed, stop_condition_hit.
- Labels free to assign (canary used CW). Write findings/findings_B27_<persona>.md + evidence/B27/<persona>/day_NN.json + agent_logs/<LABEL>.{jsonl,status.json}.
- On completion: aggregate B27 results into the SUMMARY (F01 fix verification + word-correctness verdict across personas + logout/login findings).

## E. OPS NOTES / GOTCHAS
- Run all node/playwright FROM /app (cwd=/app); /tmp scripts throw MODULE_NOT_FOUND. ESM only (.mjs or import).
- Chromium /ms-playwright/chromium-1223; PLAYWRIGHT_BROWSERS_PATH=/ms-playwright; @playwright/test 1.60.0. Agents drive OWN headless chromium; NOT mcp__playwright__*; always browser.close() in finally.
- Admin SDK READ-ONLY in B27 (scripts/serviceAccountKey.json). Firestore paths: progress = users/{uid}/class_progress/{classId}_{listId}; study_states = users/{uid}/study_states; definitions nested doc.definitions.{en,ko}.
- ~800 leaked chrome procs persist (pkill sandbox-blocked); memory healthy (~8-10GB free), not a constraint; clears on teardown.
- Agent findings-file writes sometimes don't persist (B03, B17, B27-careful all needed orchestrator reconstruction from STATUS BLOCK) — VERIFY findings_BXX.md exists with real content at completion; reconstruct from the completion STATUS BLOCK + evidence if missing.
- VERIFY any contradictory/data-absence/"duplicate"/"missing" finding against Firestore before relaying — 6 such claims this run turned out to be false positives or mis-attributed (incl. one of my own aggregation errors on B17).
- HUMAN-ONLY (orchestrator does NOT do): run scripts/cleanup-audit-students.js (removes 50 audit accounts + B22-fabricated orphan docs); deploy; merge PRs.
- git in /app needs `git config --global --add safe.directory /app` (dubious-ownership); no push creds in this sandbox (no gh, no token) — pushes/PRs happen on the user's side.

## F. OUTSTANDING DECISIONS / FOLLOW-UPS
- Cleanup of 50 audit accounts + B22 orphan docs (human, post-audit).
- Fix order for the audit-1 HIGH cluster (challenge subsystem, joinClass, newWordsTestScore, etc.) — RECOMMENDATIONS.md has the order.
- NEEDS_CHECK-has-no-review-branch gap (follow-up after F01).
- MASTERED-is-random-not-per-word: product-design question to confirm intent.

---
## UPDATE 2026-05-31 ~09:35 — B27 fan-out wave 1 (F01 verification)
- Launched korean(K27)/esl(E27)/lazy(L27)/anxious(A27) against DEPLOYED F01 fix. (Over-launched w/ dup-guards; guards worked, 1 driver/persona.)
- **F01 FIX VERIFIED WORKING.** Checked all finalized day_NN.json: ZERO days where mastered-words-existed-pre-session AND appeared in review (TOTAL_REAL_F01_DAYS=0 across korean incl. deep days 6-16). The "F01 REGRESSION" stop L27(lazy) hit on day 6/10, and K27/esl raw violation counts, are ALL the checker's post-session-timing FALSE POSITIVE (flags words MASTERED *after* review completes; preMastered=0 on flagged days). esl agent self-identified this. So: deployed fix HOLDS; the model's checkPresentedWords needs a timing fix (compare review words against PRE-session study_states, not post).
- HARNESS BUG (mine): logout/login scenario run in SAME browser context as main loop → H2 stale-Step-5 CASCADE blocked most sessions (esl 2/20, lazy stopped at 2). FIX before wave 2: run logout/login in ISOLATED context, last.
- CHECKER BUG (mine): post-session-timing false positive on MASTERED-in-review. FIX: snapshot study_states BEFORE the review test; judge eligibility against that.
- CONFIRMED AGAIN: F02 newWordsTestScore:undefined setDoc failure — 5th sighting (B07/B08/B14/B15 + esl). Real, ship the 1-char fix.
- CONFIRMED clean: NO fabrication (0 orphan docs any persona); NEW word selection correct (exact slices); ESL grader fairness 100%.
- TODO before continuing: (1) fix checker timing + harness logout isolation, (2) re-run for deep F01 confirmation + word-correctness, (3) korean(day16+)/anxious still running — let finish but treat MASTERED-violation counts as suspect pending checker fix.

---
## UPDATE 2026-05-31 ~10:00 — F01 fix is PARTIAL (critical reconciliation)
- DEPLOYED: confirmed — live bundle /assets/index-D_TIUZ3r.js contains `eligibleSegmentWords` (my fix's variable). Fix IS in production. Agents claiming "not deployed" inferred it from seeing leaks — they can't observe deploy status; ignore that claim.
- FIX WORKS on normal/high-scorer path: korean (eligible pool ~78) = 0 real review violations across 17 days (orchestrator-verified pre-session histograms).
- **FIX IS INCOMPLETE on fully-suppressed path: lazy day_04 = 30/30 review words were MASTERED *pre-session* (statusHistogramPre.MASTERED=30, eligibleForReview=4). REAL leak (pre-session, not post-session-timing FP).** Mechanism hypothesis (NOT yet source-confirmed — output-rendering glitch blocked the grep): when eligible non-mastered pool (4) << reviewCount (~30), mastered words still reach the review TEST — likely a SECOND review-word selection path or a backfill that my buildReviewQueue filter doesn't cover. NEXT: confirm which function builds review TEST words (vs buildReviewQueue study queue) in DailySessionFlow.jsx; the real fix goes there too / or buildReviewQueue must cap reviewCount to eligible count.
- esl's "30 mastered in review day 7" WAS a post-session-timing false positive (preMASTERED=0 that day) — esl self-identified correctly. So: esl FP, lazy REAL. Both can be true — different days/state.
- CHECKER timing bug still real (judge review words vs PRE-session study_states) — but lazy day4 is real even under strict pre-session check.
- HARNESS: logout/login inline → H2 cascade (esl 2/20, lazy stopped). Fix: isolated context.
- NEW (needs verification, not yet confirmed): esl F-NEW-1 "CSD reset when canonical doc created" (could be orphan-doc artifact — VERIFY); esl F-NEW-2 "duplicate attempt docs 2/test" (VERIFY vs retake); F-NEW-3 NEEDS_CHECK no review path (matches known adjacent gap).
- CONFIRMED across personas: no fabrication (0 orphans); NEW-word selection correct; F02 newWordsTestScore:undefined = 5th sighting.
- STILL RUNNING: korean finished (17 days clean), anxious (~day5-6). lazy/esl done (partial).
- HONEST STATUS: F01 NOT fully resolved. My fix covered the common path but missed the suppressed/exhausted-pool path. Need a follow-up fix + re-verify. Do NOT tell user "F01 fixed".
