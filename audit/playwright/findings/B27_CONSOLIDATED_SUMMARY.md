# B27 + Real-Grading Consolidated Summary (2026-05-31)

Production audit of vocaBoost (https://vocaboostone.netlify.app, Firebase vocaboost-879c2). No fabrication: B27 advanced state only via real UI sessions; Admin SDK read-only. Real-grading used the live `gradeTypedTest` callable + read-only data.

## BLOCKERS

### B1 — F01: MASTERED ("retired") words leak into review (NOT fixed)
- **Verified by word identity** (not position) on the chronic-failure (lazy) persona: Day 10 served 9/30 and Day 11 served 5/30 review words whose own pre-session status was MASTERED with a future returnAt (2026-06-30).
- The deployed fix (`buildReviewQueue`, studyService.js:580 — `eligibleSegmentWords` filters `status===MASTERED`) is **present and correct for a freshly built queue**, but MASTERED words still reach the test — even on Day 11 where eligible (39) exceeded the quota (30). So the fresh-build path is not the source.
- **Prime suspect (hypothesis, needs dev trace):** `DailySessionFlow` persists the review queue to session state and restores it (`setReviewQueue(state.reviewQueue)`); the restored/persisted queue is served without re-filtering against current study_states. Strongly consistent with the H2 stale-session involvement and with Day-11 leaking despite a large eligible pool.
- `selectReviewQueue` (studyAlgorithm.js:215) also has only FAILED/NEVER_TESTED/PASSED buckets — no MASTERED/NEEDS_CHECK handling, so it can't self-protect.
- **Impact:** worst for the weakest students (chronic failers accumulate many MASTERED words → large fraction of review wasted re-testing retired words).
- **Fix direction:** re-filter the restored/persisted queue against current study_states at serve time; add MASTERED/NEEDS_CHECK handling to selectReviewQueue.
- Confirmed clean where mastered density is LOW (korean, anxious) — which is why earlier "fixed ×3" was a premature read; those never stressed pool collapse.

### B2 — Day does not advance: `newWordsTestScore: undefined`
- New-word-test completion writes `newWordsTestScore: undefined` → Firestore rejects the `session_states` setDoc (`Unsupported field value: undefined`) → session stranded mid-flow, CSD/TWI frozen. The "왜 day가 안 넘어가요" / lost-progress class. Reproduced by korean + lazy. One-line fix (omit the field or default it).

## HIGH

### H1 — Logout mid-test loses in-progress work (confirmed ×4: anxious, lazy, esl, speedrunner)
- Typed-test answers are written to localStorage, but on re-login there is **no recovery prompt and no auto-restore**; in-progress answers are silently lost. (Speedrunner confirmed answers ARE in localStorage; recovery path never surfaces them.)

### H2 — Stale "Step 5 / session complete" on session entry (anxious flagged as student-facing)
- After finishing a day, the next entry can show the prior day's completion screen instead of the new day's Step 1. Largely a harness obstacle, but anxious noted a real student-facing discoverability risk (students may not realize the next day is available). Verify in normal (non-shimmed) use.

## CLEAN / PASSED

- **AI grading — model quality (GRADE2):** verbatim-EN 20/20, Korean/code-switch/ESL ~100%, junk/echo/wrong-word/opposite all rejected, deterministic (temp 0.1), median ~1.8s. No 안이찬-style false negatives.
- **AI grading — REAL student data (REALGRADE + REALGRADE3):** model = **Claude Haiku 4.5** (NOT OpenAI; docs are stale). 41k real answers / ~130 students extracted; 800 distinct pairs ground-truthed.
  - New grader accuracy ~**96.8%**, recall **100%**, precision 97%.
  - **False negatives (genuinely-correct answer failed): 0** — the gate metric.
  - False positives ~2% — lenient on Korean near-synonyms / wrong-meaning edge cases (e.g. `arguably → 거의 틀림없이` reversed meaning accepted; rule #3 should catch this).
  - Old grader (GPT-4o-mini) had recall ~55.7% — rejected ~44% of correct answers (systematic harm, esp. Korean translations) AND a bug accepting blanks/junk. The refactor fixes both.
  - **Verdict: grading ACCEPTABLE / recommended for production.** Only tuning note: slightly too lenient.
  - **Triangulated across 3 independent re-grade runs** (110, 700, 800 pairs) — all three agree: **0 confirmed false negatives**, large recall gain over the old grader, ~2% lenient edge-case false positives. Robust conclusion.
  - Minor: transliteration rule inconsistent (renaissance/르네상스 → WRONG correctly, but chaise/체이스 → CORRECT — likely treated as an established loanword). Add a clarifying few-shot example.

### H3 (NEW, from real-grading) — Empty `correctDefinition` crashes a whole grading batch
- **1,015 distinct word/answer pairs (~5.5%) have an empty `correctDefinition`.** The `gradeTypedTest` callable validates each answer and throws a plain Error (surfaced to the client as `functions/internal`) if `correctDefinition` is missing/empty — which fails the **entire batch**, not just that item. The app (TypedTest.jsx) submits a test's answers as one batch, so a single word with a blank definition would crash grading for that student's whole test (ungraded / error).
- **Severity HIGH pending verification** that such words are actually served in live tests. Dev action: backfill/guard empty definitions, and make the function skip-and-mark rather than throw on a bad item so one word can't sink a batch.
- **New-word selection:** correct across all personas/days (range/intervention-aware).
- **Review-word selection:** correct EXCEPT the F01 pool-collapse leak.
- **Dedup under rapid double-submit (speedrunner):** 0 duplicate attempts.
- **Final-answer integrity under heavy edit churn (perfectionist):** 60/60 — audit issue #10 does not manifest.
- **Intervention/suppression:** correct (new words → 0 at IL=1.0; day still advances; no wrongful shrink).
- **Korean UTF-8 round-trip:** clean through client → Cloud Function → Firestore.
- **No fabrication:** 0 orphan docs created by any B27 agent; all attempts use correct classId_listId ids.

## RECOVERY PATHS (after a guard/interruption, does restart/re-entry land on the right path?)
Tested 6 scenarios (RECOVER agent). Summary: **path-correctness is mostly fine (5/6 land on the right day+phase, no corruption/dead-ends), but in-progress work is never preserved across a real restart/logout, and the B2 strand leaves students permanently stuck.**

| Scenario | Recovers to correct path? | In-progress work | Verdict |
|---|---|---|---|
| Browser restart mid new-word test | YES (Day N, study Step 1) | LOST | WORK_LOST_BUT_CORRECT_PATH (HIGH) |
| Browser restart mid review test | YES (Day N, review study) | LOST | WORK_LOST_BUT_CORRECT_PATH (HIGH) |
| **B2 strand (newWordsTestScore undefined)** | **NO — CSD stuck on Day N forever, silent loop** | n/a | **STUCK (BLOCKER)** |
| H2 stale-complete re-entry | YES — modal "Move On" clears state → dashboard | n/a | CLEAN_RESTART ✅ |
| Logout mid-test → re-login | YES (correct day/phase) | LOST | WORK_LOST_BUT_CORRECT_PATH (HIGH) |
| Duplicate-day guard probe | YES — routes to day N+1, doesn't block legit sessions | n/a | CLEAN_RESTART ✅ |

- **Work-loss mechanism:** `testRecovery.js` keeps answers in localStorage with a **3-minute** expiry; survives a same-session page refresh but a fresh context (browser restart, logout, cookie clear) = empty localStorage = 0% restored, no recovery prompt. Logout additionally sets `vocaboost_intentional_exit_*` which suppresses recovery.
- **B2 strand recovery = none:** after the undefined-score write is rejected, the attempt is saved `passed:false`, reconciliation sees no passed Day-N new test, CSD never increments; every re-login returns to the same day with no error. Confirmed root cause of "왜 day가 안 넘어가요". One-line guard fix in `DailySessionFlow.jsx persistSessionState`.
- New MEDIUMs: 3-min recovery window too narrow for real use (close laptop 10 min → expired); no logout button in test UI; H2 completion screen showed "DAY 21 COMPLETE" while modal said "Resume Day 20?" (display discrepancy, doesn't block).

## HARNESS NOTES (not product)
- H2 stale-Step-5 cascade limited longitudinal depth on several personas (need click-through-Step-5 recovery + fresh context per session).
- Browser OOM crashes (perfectionist, speedrunner) — auto-relaunched, no data loss.
- Logout UI locator gaps (no aria-label on profile/avatar) made the logout scenario inconsistent.
- REALGRADE2's 800-call `functions/internal` failure = payload used `correctAnswer` instead of required `correctDefinition` (+ a rate-limit burst); fixed in REALGRADE3 via smoke-gate + field mapping.

## DOC FIX
- CLAUDE.md / PROJECT_CONTEXT say grading is OpenAI — update to **Claude Haiku 4.5** (Anthropic SDK, functions/index.js).
