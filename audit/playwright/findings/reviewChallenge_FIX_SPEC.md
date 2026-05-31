# reviewChallenge rework — fix spec (db.js ~2567-2696)

Bundles the B28/Codex/CODE_REVIEW findings on reviewChallenge. **Production-sensitive: affects real grade calculations and 354 pending challenges.** Done piecemeal by risk: #5 applied (safe); atomicity + day-advance specced for careful review (NOT blind-patched).

## APPLIED NOW — #5 score-denominator inflation (HIGH, safe, zero corruption risk)
reviewChallenge recomputed `newScore = correctCount / updatedAnswers.length`. The original score (submitTestAttempt) uses `correctCount / answeredWords.length` and persists that count as `totalQuestions`. When `updatedAnswers.length < totalQuestions` (skipped/partial attempt) the smaller denominator inflates the score — and it runs even on REJECTION, and can flip passed false->true. **Fix applied:** use `denom = attemptData.totalQuestions || updatedAnswers.length`; `newScore = denom>0 ? round(correct/denom*100) : 0`. Can only make scores more correct. esbuild-parse OK.

## ⚠️ RETRACTION (2026-06-01): the day-advance block is NOT dead code
An earlier version of this spec wrongly claimed the day-advance block throws (undefined `phase`) and has a `dailyPace = 0` placeholder → "never fires." **That was FALSE.** Verified against the actual code AND origin/main:
- `phase` IS defined locally: `const phase = testIdParts[testIdParts.length - 1]` (~line 2687) = 'new'/'review'. No ReferenceError.
- `const dailyPace = assignment?.pace || 20` (~line 2728) — real, not a placeholder (origin/main has ZERO `dailyPace = 0`).
- **The block IS LIVE and advances `currentStudyDay + 1` in production** when an accepted challenge flips a failing new-word/review test to passing (`oldScore < passThreshold && newScore >= passThreshold`). This is a SECOND day-advance path besides completeSession.
Removing it would DELETE a real feature, not clean up dead code. (My apologies — corrected.)

## THE REAL CSD-via-challenge bug (matches user's memory of "CSD advancing/not-advancing improperly with challenge")
The block fires and advances the day, but:
1. **NO stale-day guard (over-advance).** It computes `currentDay = progress.currentStudyDay` at review time and writes `currentDay + 1`, regardless of which day the CHALLENGED attempt was for. If a teacher approves a challenge for an OLD test (e.g. student is on Day 10, challenge is for Day 3's failing test that now passes), the student's day still jumps 10→11 — a wrong/extra advance. updateClassProgress has an `expectedDay` guard for exactly this; this path has none. With 354 pending challenges, some are for old days → real over-advance risk.
2. **Non-atomic.** Sequential getDoc(progress) → updateDoc(progress), plus the earlier attempt + study_state + history writes — no transaction. Partial failure leaves inconsistent day/score/state.
3. **Double-fire on re-review is blocked** (challengeStatus must be 'pending'), so the same challenge can't advance twice — good. But concurrency on two DIFFERENT challenges of the same attempt is unguarded.
4. Parse robustness: checked all 969 real challengeable attempts — single clean shape `vocaboost_test_CLASS_LIST_new`; `phase`/`listId` parse correctly. So the "doesn't advance due to bad testId parse" mode is NOT hitting real data today. (Would break on retake-suffixed or legacy testIds if those ever become challengeable.)

### Decision needed (product) — day-advance is a REAL feature; choose how to fix it
- **(A) Keep the feature, ADD a stale-day guard + make atomic.** Only advance if the challenge's attempt is for the current day boundary — i.e. `attemptData.studyDay === currentDay + 1` (or `=== currentDay`, depending on intended semantics) — else update score/study_state but DON'T touch currentStudyDay. Wrap in runTransaction. This keeps challenge-driven progression but stops the over-advance. RECOMMENDED.
- **(B) Remove day-advance from challenge entirely.** Approving a challenge fixes the score + study_state but never advances the day (student advances only via normal completeSession). Simpler; changes current behavior (teachers lose challenge-driven progression). Only if that progression isn't wanted.
- Do NOT "remove as dead code" — it's live (my earlier wrong rec).

## SPEC — atomicity (#24 / Codex #1 family) — NOT yet applied (needs the day-advance decision first)
reviewChallenge does sequential non-transactional writes: attempt (answers+score+passed) → study_state (PASSED) → [broken day-advance]. submitChallenge similarly RMWs attempt.answers + user.challenges.history. Partial failure leaves inconsistent state (354 pending challenges exposed).
**Fix (after day-advance decision):** wrap reviewChallenge's writes in `runTransaction` — read attempt (+ class doc for threshold, + class_progress if option B) first, then write attempt + study_state (+ class_progress) atomically. Re-verify challengeStatus==='pending' inside the txn (idempotency: concurrent double-review rejected). Do the same for submitChallenge (attempt.answers + challenges.history in one txn). NOTE: study_state is in a user subcollection — Firestore transactions can span it; ensure all reads precede writes.

## Why piecemeal
#5 is unambiguous and can't corrupt → applied. Atomicity is a transactional restructure of live grading code, and it's entangled with the broken day-advance — applying it blind from a sandbox (no app/test run) onto code that affects 354 real challenges is the kind of change that warrants the day-advance decision + ideally dev review first. Delivered as spec, not a guessed patch.

## Verification (when atomicity is applied)
- Unit: challenge on a skipped-question attempt → score uses totalQuestions denom (no inflation); rejection does NOT change score/passed.
- Concurrency: two parallel reviewChallenge on same answer → exactly one applies.
- (If option B) old-day challenge approval → day does NOT advance; current-day → advances exactly once.
