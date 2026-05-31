# B27 — Longitudinal Word-Correctness (Day 1→20+, NO FABRICATION)

**Priority:** P0 — the redesigned run. Answers "do the CORRECT words show up, every day, for ~20 days?" — coverage the first audit never achieved (B22 marked it CAVEAT/unverified). Validated by the careful/TOP canary (see findings_B27_careful.md): harness works, no fabrication, and it caught a real BLOCKER (F01, now fixed on branch audit/fix-mastered-review-exclusion).

## HARD RULES (the point of this redesign — non-negotiable)

1. **NO FABRICATION. Admin SDK is READ-ONLY.** Never write class_progress/attempts/study_states/any domain doc via Admin SDK. The first audit polluted production by fabricating docs with wrong keys (orphan classId-only class_progress) → 5 false-positive findings. State advances ONLY by completing real sessions in the browser so the app writes through submitTestAttempt/getOrCreateClassProgress/graduateSegmentWords with correct keys.
2. **UI-only seeding.** Each day = actually completing that day's session in the browser (login → session → study or Skip-to-Test → typed new-word test → review test on Day 2+ → results).
3. **Admin SDK = verification + config only.** READ class_progress at users/{uid}/class_progress/{classId}_{listId}, study_states, attempts, word docs, and the class assignments map. Never write.
4. **Post-run self-check (every agent):** query users/{uid}/class_progress and confirm you created NO new classId-only orphan doc; confirm all your attempts use the correct classId+listId id format. Report in HARNESS NOTES.

## Environment (verified)
- Chromium /ms-playwright/chromium-1223; PLAYWRIGHT_BROWSERS_PATH=/ms-playwright; @playwright/test 1.60.0. Run node/playwright FROM /app (cwd=/app); /tmp → MODULE_NOT_FOUND. OWN headless Chromium; NOT mcp__playwright__*; ALWAYS `await browser.close()` in finally (close every context — memory matters).
- **/app/package.json is `type:module` → ALL .js are ES MODULES.** Import helpers with `import` (NOT require — require returns {} silently). Write driver scripts as .mjs under /app/e2e/audit/.
- Firebase Admin SDK works from /app (scripts/serviceAccountKey.json) — READ ONLY here.
- Target https://vocaboostone.netlify.app (production vocaboost-879c2). Typed grading real (~19s/call); budget for ~10–20 sessions × ~30 answers per persona.
- Login: e2e/audit/helpers/auth.js `loginAs(page, personaId, opts)` (loads '/' then client-routes to /login; submit "Continue"; lands '/'). Reach tests via Skip to Test (session menu aria-label "Session menu" → "Skip to Test" → confirm). Never deep-link (Netlify 404).
- Word position cache: /app/e2e/audit/B27/word_position_cache.json (full 3381-word position map, built live by the canary). Use it to map presented word strings → list positions instead of re-fetching all words.

## The expected-word model — USE THE SHARED HELPER (ESM), DO NOT REINVENT
`import * as expected from '/app/e2e/audit/helpers/expectedWords.js'` — pure functions ported verbatim from src/utils/studyAlgorithm.js, verified 8/8 behavioral checks:
- `expectedNewWordRange(twiBefore, dailyPace, interventionLevel, listSize)` → new-word slice [startIndex,endIndex].
- `calculateSegment(day, studyDaysPerWeek, twi, dailyPace, interventionLevel)` → review segment range (null on Day 1).
- `partitionReviewEligibility(segmentWordStates, segment, nowMs)` → {eligibleIds, retiredIds} — MASTERED-within-21-days are RETIRED, must NOT appear in review.
- `checkPresentedWords({phase, presentedPositions, expectedRange, eligibleIds, retiredIds})` → [] clean, else violation strings.
- `calculateInterventionLevel(recentReviewScores)` → 0..1 from last-3 review scores.

**Resolve real config at runtime (read-only):** read the class doc `assignments[listId]` for actual dailyPace/studyDaysPerWeek/testMode/passThreshold. Do NOT hardcode pace.

## ⚠ CANARY LESSONS — apply these or you waste the run

**H2 (CRITICAL — the canary wasted ~15 of 25 iterations to this):** at session start the app can show a STALE cached "Step 5 / session complete" from the prior day instead of the new day's Step 1. Before treating a session as begun, VERIFY the dashboard-shown day advanced and you're actually at Step 1 (new-words study) — if you see a stale Step 5/complete screen, navigate back to dashboard and re-enter the session until the real new day loads. Do NOT count a stale-Step-5 iteration as a completed day (that produced no-op days in the canary).

**Post-test TWI for segment math (kills false positives):** the segment/eligibility calculation must use the **post-new-word-test** totalWordsIntroduced (read class_progress AFTER the new-word test completes), NOT the pre-test value. The canary's pre-test-TWI usage produced 11–30 false-positive "not in eligible segment pool" violations per session. Sequence: complete new-word test → read updated TWI from Firestore → THEN compute calculateSegment/expected ranges for the review check.

**Model noise vs real bug:** only report a review-word violation as a finding when it's confirmed against post-test TWI AND the word's study_state. A "not in eligible pool" that disappears under post-test TWI is noise, not an app bug.

**HARNESS FIX 1 — USE IDENTITY-BASED REVIEW CHECK (mandatory).** The old position-based check produced false positives (a MASTERED word existing at position X ≠ the word the UI served at X is mastered). For the review test, use `checkReviewWords({ presentedWordStates, segment, nowMs })` from expectedWords.js, where presentedWordStates = the words the UI ACTUALLY served, each as `{ wordId, position, preStatus, preReturnAtMs }` with preStatus/preReturnAt read from study_states BEFORE this session. A real F01 leak = a served word whose own pre-session status is MASTERED with future returnAt. Do NOT flag by position. (checkNewWords stays position/range-based for new words.)

**HARNESS FIX 2 — RUN LOGOUT/LOGIN IN AN ISOLATED CONTEXT, LAST.** The logout/login scenario must NOT share the main walk's browser context — doing so leaves a stale Step-5 session that cascades H2 and blocks subsequent days. Run the full ~20-session walk FIRST in one context; then do the logout/login scenario at the very end in a FRESH browser context (or after the walk completes), so it can't poison the walk.

## MASTERED retirement lifecycle (now FIXED on branch — verify the fix holds OR confirm bug if running against unfixed prod)
- graduateSegmentWords (studyService.js:846) runs at session completion: graduates floor(segmentSize × reviewScore) RANDOM eligible segment words (eligible = whole segment minus words failed this test) → status MASTERED, returnAt = now+21d. Note: this is segment-wide & random, not per-word mastery; a NEVER_TESTED word can become MASTERED.
- returnMasteredWords (studyService.js:911) flips MASTERED→NEEDS_CHECK once returnAt passes (fires within a shimmed run since Timestamp.now honors Date.now).
- **F01 (FIXED on branch audit/fix-mastered-review-exclusion):** buildReviewQueue now filters MASTERED before selectReviewQueue. If this run is against code WITH the fix: assert NO MASTERED word (future returnAt) appears in any review test. If against UNFIXED prod: expect the F01 leak (MASTERED words in review when eligible pool < reviewCount) and document it — do NOT call it a new bug, it's known F01.
- Adjacent known gap (NOT fixed): selectReviewQueue has no NEEDS_CHECK branch either — watch whether returned/NEEDS_CHECK words can re-enter review; report if they can't (words could get stuck retired).

## Per-day procedure (walk ~20 sessions forward from the student's real current day — do NOT reset to Day 1, that needs fabrication)
1. Install Date.now shim at context creation; advance ~24h between sessions (handle weekend skip per studyDaysPerWeek). serverTimestamp NOT shimmed → apply server-time caveat to streak/lastStudyDate; assert on client day/CSD + word positions.
2. **Verify real new day loaded (H2 guard) before proceeding.**
3. Complete the day's session via UI per persona transform (type answers char-by-char from canonical answers; correct/wrong per persona).
4. Capture presented words for (a) new-word test and (b) review test; map to list positions via the cache.
5. **Read post-test TWI + current study_states (read-only); run the model checker** (expectedNewWordRange + calculateSegment + partitionReviewEligibility + checkPresentedWords). Record real violations only.
6. Capture Firestore state to findings/evidence/B27/<persona>/day_NN.json: class_progress (classId_listId doc), study_states status histogram (NEW/NEVER_TESTED/PASSED/FAILED/MASTERED/NEEDS_CHECK), attempt id+score+studyDay, MASTERED count + returnAt sample.
7. Assert: CSD +1/session; one attempt per (testType,sessionType,day); review only Day≥2; score in [0,100].

## NEW SCENARIO (user request) — logout/login mid-session, run ONCE per persona
B01 covered auth security (no fail-open; logout clears IndexedDB) but NOT work-preservation. On one chosen day per persona:
1. Start the new-word test, type/answer a few questions (answers now in localStorage recovery state).
2. Log OUT (via the app's logout — clears IndexedDB auth) WITHOUT submitting.
3. Log back IN as the same student.
4. Verify: is the in-progress attempt recoverable (recovery prompt appears, answers restored), or cleanly restartable, or is work silently LOST / state corrupted? Capture localStorage + Firestore before/after.
**Severity:** lost in-progress work or corrupted session after logout/login = HIGH (BLOCKER if a completed/submitted attempt is lost). Record under the persona's findings.

## Outputs
- findings/findings_B27_<persona>.md (from FINDINGS_TEMPLATE.md): ~20-row day table (day, CSD, new expected-vs-presented match?, review eligible-vs-presented match?, MASTERED count, drift?) + findings + a HARNESS NOTES section (no-fabrication confirmed? orphan docs created? model ran cleanly? H2 stale-Step-5 hit count?) + the logout/login scenario result.
- findings/evidence/B27/<persona>/day_NN.json for every session.
- Append JSONL to findings/agent_logs/<LABEL>.jsonl; status findings/agent_logs/<LABEL>.status.json. WRITE LOGS TO THAT EXACT PATH (not /app/agent_logs). mkdir -p first.
- DO NOT write audit_state.json or other agents' files. Admin SDK READ ONLY.

## Stop conditions
- Day 1 new words not [0,count-1], or Day-1 shows a review test → STOP (baseline broken).
- (If running WITH the F01 fix) a MASTERED word with future returnAt appears in review on ≥2 days → the fix regressed: event:"stop_condition_hit", status stopped, finish finding with day-N study_states + expected-vs-actual diff, STOP.
- Review serves words outside the eligible segment (post-test-TWI confirmed, not model noise) on ≥2 days → real bug, stop_condition_hit, STOP.
- Otherwise complete the walk. Session unreachable after bounded retry → mark that day blocked w/ reason, CONTINUE; don't lose the walk.

## Return STATUS BLOCK (final message is all I see)
Overall; sessions completed (N); real start→end day; correct NEW words every session (yes/no + drift days); correct REVIEW words every session accounting for MASTERED retirement (yes/no + drift days); MASTERED graduation fired + stayed retired correctly post-fix (yes/no + counts); logout/login mid-session result (work preserved? HIGH if lost); CSD +1/session held; reconciliation anomalies past ~day 8 (reconciliation only reads last-8 attempts); ANY orphan/fabricated docs created (must be NO); H2 stale-Step-5 occurrences; findings by severity; go/no-go.
