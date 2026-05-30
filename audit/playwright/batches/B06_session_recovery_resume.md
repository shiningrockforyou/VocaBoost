# B06 — Session Recovery & Resume

**Priority:** P0
**Estimated duration:** 60–90 minutes
**Depends on:** B00, B02 (or B03) for at least one happy-path session to use as a baseline.
**Personas:** Distracted Student, Recovering Student, Rushed Student, Lazy Student.

## Goal

Every way a student can leave a test mid-flight (refresh, tab close, browser crash, sleep-then-wake, second tab, idle timeout) must end in a coherent state on return:
- Their progress is restored OR they're cleanly told they need to restart.
- No phantom attempts, no orphan sessions, no stuck "in-progress" status.

Recent audit findings flagged that `markIntentionalExit` flag persists on tab close (#7), `clearLocalSessionState` runs unconditionally in DailySessionFlow init (#3 in DailySession-specific findings), and `dailySessionState` for review-test recovery puts `reviewQueue: []` (#2). All three should be explicitly tested here.

## Scenarios

### S01 — Mid-MCQ refresh restores answers

**Persona:** Distracted Student
**Goal:** The single most common recovery flow.

1. Begin MCQ test on `standardList`.
2. Answer 15 of 30 questions.
3. Refresh page (F5).
4. Recovery prompt appears within 2 seconds. Prompt text matches expected ("Resume your test?" or similar).
5. Click Resume.
6. All 15 answers preserved, currentIndex restored to where they left off.

**Pass criteria:** Both answers and position restored.
**Failure → BLOCKER.**

---

### S02 — Mid-MCQ refresh BEYOND the recovery window

**Persona:** Lazy Student
**Goal:** Recovery is time-limited (3 minutes per testRecovery.js). After expiration, no stale prompt.

1. Begin MCQ. Answer 10 questions.
2. Shim `Date.now()` to advance 4 minutes (or wait actual time if not shimmable).
3. Refresh.
4. Expected: NO recovery prompt. Test starts fresh.
5. localStorage should be cleaned up automatically (getTestState clears expired records).

**Failure → MEDIUM** if the prompt appears with stale data; LOW if cleanup is delayed.

---

### S03 — Tab close while mid-test, return same session

**Persona:** Distracted Student
**Goal:** Tab close (Cmd+W or X) is the documented sketchy path due to the audit's finding #7 on `markIntentionalExit`.

1. Begin MCQ, answer 10 questions.
2. Close tab. Confirm "Leave site?" beforeunload prompt → click Leave.
3. Open new tab, navigate to app, log back in as same student.
4. Navigate back to the same test launch path.
5. Expected behavior (BEST CASE): Recovery prompt appears with the 10 answers.

**Known suspect outcome (audit finding):** No prompt appears; clearTestState was called because `wasIntentionalExit` returned true. **If this is what happens, file a HIGH finding citing audit item #7.**

**Pass criteria:** Recovery prompt with answers.
**Failure → HIGH** (because audit predicted this; confirm or refute).

---

### S04 — Click "Stay" on beforeunload, no false clear

**Persona:** Distracted Student
**Goal:** When the student clicks "Stay" (cancels the beforeunload), the intentional-exit flag must be cleared.

1. Begin MCQ. Answer 10 questions.
2. Trigger refresh (F5). Confirm beforeunload dialog. Click Stay.
3. Continue answering. Now answer 5 more.
4. Now genuinely refresh (F5) → click Leave.
5. Recovery prompt appears, all 15 answers restored.

**Pass criteria:** "Stay" did not poison the recovery flag.
**Failure → MEDIUM.**

---

### S05 — Mid-Typed-test refresh

**Persona:** Distracted Student
**Goal:** Same as S01 for Typed.

1. Begin typed test on `standardList`. Type answers for 10 prompts (these are partial; some short, some long).
2. Refresh.
3. Recovery prompt appears.
4. Click Resume. All 10 typed answers restored in their input fields including length and special chars.

**Pass criteria:** Typed answers character-for-character preserved.
**Failure → BLOCKER.**

---

### S06 — Refresh on the results screen (after submit succeeded)

**Persona:** Anxious Student
**Goal:** Refresh after a SUCCESSFUL submit must not re-prompt for recovery — the attempt was saved, the test is done.

1. Complete an MCQ test successfully.
2. On the results screen, refresh.
3. Expected: No recovery prompt. Student is taken to dashboard OR re-shown results from Firestore.

**Failure → MEDIUM** if recovery prompt appears (would be confusing).

---

### S07 — Mid-session (NEW_WORDS phase, pre-test) refresh

**Persona:** Distracted Student
**Goal:** DailySessionFlow auto-save covers the study phases too, not just tests.

1. Begin a Day-1 session on a list the student hasn't started.
2. In the NEW_WORDS phase, dismiss 15 of 25 cards.
3. Refresh.
4. Expected: Recovery prompt appears (per DailySessionFlow's `pendingLocalRecovery`). Or the session resumes automatically with the 15 dismissed cards counted out.
5. Audit-known suspect: the `clearLocalSessionState` call after pendingLocalRecovery wipes the backup before the auto-restore effect rebuilds it. If the student closes the tab between these two events, they restart from 0 dismissed.

**Pass criteria:** Resume restores 15 dismissed cards.
**Failure → HIGH** (matches audit finding).

---

### S08 — Mid-Review-study refresh

**Persona:** Distracted Student
**Goal:** Same as S07 but in REVIEW_STUDY phase.

1. Begin Day-2+ session. Get to REVIEW_STUDY phase.
2. Dismiss 5 of 10 review cards.
3. Refresh.
4. Resume → 5 dismissed cards preserved.

---

### S09 — Refresh between test phases (between NEW_WORD_TEST and REVIEW_STUDY)

**Persona:** Distracted Student
**Goal:** A refresh in the transitional moment after passing the new-word test must continue to REVIEW_STUDY.

1. Begin Day-2 session.
2. Complete new-word test successfully (pass threshold).
3. Refresh on the results-of-new-word-test screen.
4. Expected: Resume continues into REVIEW_STUDY with the right segmentWords.

**Failure → HIGH** if phase regresses to NEW_WORD_TEST or the review queue is wrong (audit finding #4 — stale closure on newWordFailedIds).

---

### S10 — Two tabs open simultaneously

**Persona:** Rushed Student
**Goal:** Two tabs open to the same student's same test. Behaviour must be deterministic.

1. Open tab A, log in, begin MCQ on `tinyList`.
2. Open tab B, log in same student, navigate to same test.
3. Expected:
   - Tab A shows a "Test taken over in another tab" or similar warning, OR continues normally if there's no duplicate-tab guard for non-apBoost tests.
   - Tab B starts the test fresh.
4. Tab B answers 3 questions, submits.
5. Tab A: what happens? Can it submit too? Should be blocked.

**Pass criteria:** Both tabs do not produce two attempt docs. Either the second tab is rejected, OR the first tab is invalidated.
**Failure → HIGH** if two attempts created (uses the same nonce → setDoc overwrites, fine; uses different nonces → duplicates, BAD).

---

### S11 — Phone-sleep simulation (visibilityChange + delay)

**Persona:** Distracted Student
**Goal:** Mobile phone goes to sleep mid-test, screen comes back on 5 minutes later.

1. Begin MCQ on `tinyList`.
2. Answer 3 questions.
3. Fire `document.visibilitychange` with `hidden=true` (via `page.evaluate`).
4. Wait 5 minutes of simulated time.
5. Fire visibilitychange with `hidden=false`.
6. Expected:
   - Test still resumable. Answers preserved.
   - DailySessionFlow has a visibility-handler that pauses timer if backgrounded >30s on mobile — verify it didn't auto-submit.

**Failure → MEDIUM** if auto-submit fires; LOW if timer drift confuses but no data loss.

---

### S12 — Active session, second login from different device

**Persona:** Recovering Student
**Goal:** Student logs in on phone while desktop test is in-flight.

1. Desktop tab: begin MCQ, answer 5 questions.
2. Open a "phone" context (Playwright `iPhone 13` device emulation).
3. Log in same student. Open the same test.
4. Expected: phone shows recovery prompt with the 5 answers (the localStorage is per-device, so probably it just starts fresh).
5. If both submit: each device generates its own nonce → could produce two attempt docs.

**Pass criteria:** Either device is gated (the other gets a warning), OR the gradebook can dedupe.
**Failure → HIGH** if both submit and produce two attempts with different IDs.

---

### S13 — Browser crash simulation (kill context without warning)

**Persona:** Recovering Student
**Goal:** No clean exit. The crash recovery is what students will experience after an OS-level kill.

1. Begin MCQ. Answer 8 questions.
2. `await context.close({ runBeforeUnload: false })` — simulates a hard kill.
3. New context. Log in same student. Navigate to test.
4. Expected: recovery prompt with 8 answers.

**Failure → BLOCKER.** If hard-kill recovery doesn't work, transient mobile-OS kills lose work.

---

### S14 — Resume from prior persona's incomplete session

**Persona:** Lazy Student
**Goal:** A session abandoned days ago doesn't auto-reappear in ways that confuse.

1. (Setup): Have a session from N days ago (use audit_state from B02/B03 if available; otherwise create one in setup).
2. Open the app today. Navigate to dashboard.
3. Expected: No mid-test recovery prompt for the old session (localStorage expired after 3 minutes; Firestore `session_states` may persist but should be marked abandoned).
4. Try to start a fresh session on the same list. Should work without ghost interference.

---

### S15 — Recovery prompt rejection ("Start Over")

**Persona:** Anxious Student
**Goal:** Clicking "Start Over" on the recovery prompt clears localStorage properly.

1. Begin MCQ, answer 5 questions.
2. Refresh. Recovery prompt appears.
3. Click "Start Over."
4. Expected: Test reloads fresh. localStorage cleared. The next refresh shows no recovery prompt.
5. Answer all questions, submit. Verify no stale state leaked.

## State updates

If any session was created or interrupted, update `audit_state.json.sessions[<key>] = { id, persona, lastPhase, timestamps }`.

## Evidence

Pay special attention to capturing localStorage state at each interesting moment. Use `await page.evaluate(() => JSON.stringify(localStorage))` and write to evidence files.

## Severity reminder

S01 / S05 / S13 = BLOCKER. S03 / S07 / S09 / S10 / S12 = HIGH. Everything else inherits from rubric.
