# Fix Spec — for dev review (NOT auto-applied)

Line-anchored to the working tree on branch `audit/fix-mastered-review-exclusion`. Diffs are illustrative; apply by intent (line numbers may shift). No deploy/commit done here.

**Deploy state confirmed:** local is ahead of `origin/main` by only the F01 commit (`f38e383`, studyService.js +11/-1). No `newWordsTestScore` sanitize exists in either local or deployed code (`grep -c` = 0 both). So B2 is a genuine un-fixed bug, not a deploy gap.

---

## BLOCKER 1 — B2: `newWordsTestScore: undefined` strands the session ("왜 day가 안 넘어가요")

**Root cause (verified):** `completeSessionFromTest` in `src/services/studyService.js`. On Day 2+ it derives `newWordScore` from a prior attempt; if `getNewWordAttemptForDay` returns nothing it only `console.warn`s (line 1142-1144) and leaves `newWordScore === undefined`. Then line 1147-1152 writes that `undefined` into `session_states`:
```js
// studyService.js:1146-1152  (Day 2+ path)
await saveSessionState(userId, classId, listId, {
  newWordsTestScore: newWordScore,        // ← undefined when no prior attempt found
  newWordsTestPassed: newWordScore >= threshold,
  reviewTestScore: reviewScore,
  phase: SESSION_PHASE.COMPLETE
});
```
Firestore rejects the entire `setDoc` (`Unsupported field value: undefined`), so `phase` never reaches COMPLETE, the day never advances, and on every re-login the student is back on the same day. The Day-1 path (line 1125-1129) is safe because `newWordScore = testResults.score` is always defined.

**Fix A (targeted — default the score):** at line 1142-1144, give `newWordScore` a safe fallback instead of leaving it undefined:
```js
} else {
  console.warn(`completeSessionFromTest: Could not find new word attempt for day ${dayNumber}`);
  newWordScore = 0;   // ← was implicitly undefined; default so the session_states write is valid
}
```
(Pick `0` vs `null` deliberately: `newWordsTestPassed: newWordScore >= threshold` must stay boolean — `null >= n` is `false`, `0 >= n` is `false`; both are fine, but `0` keeps the field numeric like the Day-1 path. If you prefer "unknown," use `null` AND drop it from the write — see Fix B.)

**Fix B (defense in depth — sanitize every session_states write).** Add a strip-undefined inside the shared writer so no caller can ever poison it again. In `src/services/sessionService.js`, `updateSessionState` (line 163-175) and the `saveSessionState` writer both `setDoc(..., {merge:true})` — add:
```js
export async function updateSessionState(userId, classId, listId, updates) {
  if (!userId || !classId || !listId) throw new Error('Missing required parameters for updateSessionState');
  const docId = getSessionDocId(classId, listId);
  const sessionRef = doc(db, `users/${userId}/session_states`, docId);
  const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)); // ← add
  await setDoc(sessionRef, { ...clean, lastUpdated: Timestamp.now() }, { merge: true });
}
```
Do the same in `saveSessionState` (the writer used by DailySessionFlow.jsx:300 and studyService.js:1125/1147). **Recommend BOTH A and B** — A fixes the logic (an undefined score is meaningless), B prevents the whole class of bug.

**Confidence: HIGH.** Matches every observed symptom (Day-2+ only; review-only/suppressed sessions; exact error string; permanent stuck-on-day).

---

## BLOCKER 2 — F01: retired (MASTERED) words still served in review

**Status:** the build-time filter (commit f38e383) is present in local AND deployed bundle but is INSUFFICIENT. Identity-verified leak persists — lazy Days 10-11, WALK20 Days 16-19 — INCLUDING Day 11 where eligible pool (39) exceeded quota (30) yet 5 MASTERED words were served. So a path other than a fresh `buildReviewQueue` is the source. Affects ANY student past ~16 study days (mastered pool grows large), not just chronic failers.

`src/services/studyService.js buildReviewQueue` (~580) already filters MASTERED before `selectReviewQueue`. Two-part fix:

**Fix A (HIGH confidence — structural backstop).** `selectReviewQueue` (`src/utils/studyAlgorithm.js:215`) has only FAILED / NEVER_TESTED / PASSED buckets and no MASTERED exclusion, so it can't self-protect if a mastered word reaches its input by any path. Add one line at the top:
```js
export function selectReviewQueue(segmentWords, reviewCount, todaysNewFailed = []) {
  // Backstop: never serve a still-retired MASTERED word, regardless of caller/restore path.
  segmentWords = (segmentWords || []).filter(w => w.status !== 'MASTERED');
  // ...existing logic unchanged...
}
```
This makes the leak structurally impossible no matter which path builds the pool.

**Fix B (MEDIUM confidence — needs dev confirm; likely the actual trigger).** `DailySessionFlow.jsx` persists `reviewQueue` and restores it on resume (`setReviewQueue(state.reviewQueue)` — grep `setReviewQueue` / `state.reviewQueue` around lines 1015/1139/1171/1220). A queue built BEFORE words graduated is replayed AFTER they became MASTERED → leak even when a fresh build wouldn't. Fix: on resume, either rebuild via `buildReviewQueue` rather than trusting the persisted array, or filter the restored array against current study_states (drop MASTERED-with-future-returnAt). *Dev should confirm the restore site; Fix A alone closes the leak, but B removes the stale-queue source.*

**Adjacent (separate enhancement, not the leak):** `selectReviewQueue` also has no NEEDS_CHECK bucket, so words returned from mastery may never re-enter review (could get stuck retired). Consider adding NEEDS_CHECK as eligible.

---

## HIGH 1 — In-progress work lost on browser restart / logout

`testRecovery.js` stores answers in localStorage with a **3-minute** expiry (see `saveLocalSessionState`, used at DailySessionFlow.jsx:391). A fresh context (restart/logout/cookie clear) = empty storage = 0% restored, no prompt. Logout also sets `vocaboost_intentional_exit_*` which suppresses recovery. Recovery *routing* is fine (5/6 scenarios land on correct day/phase) — this is purely lost typed answers.
**Fix options (product call):** widen the window to hours; and/or persist in-progress answers to Firestore `session_states` (already written per phase) instead of localStorage-only; don't let `intentional_exit` suppress recovery when there are unsaved mid-test answers; at minimum show a "your answers weren't saved" notice so the loss isn't silent.

---

## HIGH 2 — Empty `correctDefinition` crashes a grading batch (pending live-exposure check)

~1,015 distinct word/answer pairs (~5.5%) have empty `correctDefinition`. `functions/index.js gradeTypedTest` validates each answer and THROWS on a missing field — failing the WHOLE batch; since a test submits as one batch, a student's entire typed test errors.
**Fix:** (1) data — backfill blank `definition` fields on word docs; (2) function — make per-item validation skip-and-mark-ungradeable instead of throwing, so one bad word can't sink a batch. **Do the read-only live-exposure check first** (are blank-definition words in active class lists?). Confidence HIGH on pattern.

---

## MEDIUM
- **Beginner pass-threshold trap:** one-word synonyms score ~90%, fractionally under the 0.90 threshold → typed test "fails" → day can't advance, repeatedly. Behaviorally correct but systematically stalls beginners. Review threshold / answer-key breadth for beginner-CORE lists.
- **Grader slightly too lenient:** accepts some reversed-meaning answers (e.g. `arguably → 거의 틀림없이`). Add a clarifying reversed-meaning few-shot to the prompt (functions/index.js). Low priority — favors students.
- **3-min recovery window too short; no logout button in test UI; H2 modal day-number mismatch** ("DAY 21 COMPLETE" vs "Resume Day 20?").

## DOC FIX
CLAUDE.md / PROJECT_CONTEXT say grading is OpenAI — it's now **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`, Anthropic SDK, functions/index.js). Old grader was GPT-4o-mini; refactor switched to Haiku.

---

## Suggested order & post-fix verification
1. **B2** (Fix A + B) — unblocks day progression + strand recovery. Smallest, highest impact.
2. **F01** (Fix A backstop now; B after confirming restore site).
3. **Empty correctDefinition** — live check → data backfill + function skip-and-mark.
4. **H1 logout/restart work-loss.**
5. MEDIUMs + doc fix.

After 1-3 deploy, re-run (harnesses saved, reusable):
- `lazy` chronic-failure walk → expect 0 F01 leaks under pool collapse.
- `careful` walk past Day 16 (`e2e/audit/B27/run_walk20.mjs`) → expect 0 F01 leaks under correct play.
- B2 strand + recovery scenarios (RECOVER) → expect CSD advances, no permanent stuck.
