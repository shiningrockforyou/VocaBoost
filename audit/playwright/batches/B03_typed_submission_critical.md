# B03 — Typed Submission Critical Path

**Priority:** P0 — verifies fixes #2, #3, #4, #5 for the TypedTest path, plus the AI-grading wrinkle that doesn't exist in MCQ.
**Estimated duration:** 90–120 minutes (longer because AI grading is slow).
**Depends on:** B00, B02 (run B02 first so you've internalised the MCQ pattern).
**Personas heavily used:** Careful Student, Rushed Student, Recovering Student, Hostile Student, Anxious Student (challenge flow).

## What's different from MCQ

- **AI grading is in the loop.** The submit path is: `clearTestState (now NOT called) → gradeWithRetry (≤5 min) → submitTypedTestAttempt → processTestResults`. Each leg can fail.
- **Practice mode shows AI rationale.** Fields read in results screen: `gradedResults[*].reasoning`.
- **Korean definitions exist** for some lists — the AI is supposed to handle that.

The recent fix moved `clearTestState` from line 618 (top of handleSubmit) to AFTER the entire success chain. The window where work could be lost is now ~zero; previously it was the full ~5 minute grading window.

## Pre-flight

- Snapshot baseline as in B02.
- Verify the Cloud Function for AI grading is reachable (it's required for Typed tests). If unavailable in this environment, mark batch as SKIPPED with reason "Cloud Function unavailable" — do not attempt to mock the AI response inline, since that defeats the point.

## Scenarios

### S01 — Happy path: Careful Student finishes a typed test

**Persona:** Careful Student
**Goal:** Baseline; the AI grading path works end-to-end.

1. Log in as `carefulStudent`. Navigate to dashboard. Find a list with a typed-test option for new words.
2. Begin a typed test (~5 questions on `tinyList`).
3. For each prompt, type a correct definition. Use the actual definition text from the seeded list.
4. Click "Submit."
5. Observe loading state ("Grading…" or similar).
6. Wait up to 90s for grading to complete (the function may take up to 90s per attempt; the audit can wait up to 4 minutes total).
7. Results screen appears with per-question AI feedback.

**Assertions:**
- Exactly one `attempts` doc with `testType = 'typed'`.
- All `study_states.timesTestedTotal = 1` for the tested words.
- `attempts.frqUploadUrl` and related FRQ fields are null (FRQ is an apBoost concept, should not appear here).
- `aiReasoning` populated for each answer in the attempt doc.

**Failure → BLOCKER.**

---

### S02 — clearTestState moved past AI grading (verifies fix #2)

**Persona:** Recovering Student
**Goal:** Prove that a tab close during AI grading does NOT eat the student's typed answers.

1. Log in. Begin a typed test on `standardList` (50 prompts → use the smaller test size setting if available, else just 30 prompts).
2. Type a definition for each prompt — make this a real test of input handling: include one with a long answer (>200 chars), one with em-dashes, one with Korean characters if input method allows.
3. Configure a Playwright route to STALL the gradeWithRetry function call (intercept `**/functions/**` calls).
4. Click Submit.
5. Observe "Grading…" appears.
6. While stalled, REFRESH the page (Ctrl+R).
7. After refresh, expect:
   - The test recovery prompt appears.
   - On "Resume," all typed answers are back in the input fields including the long answer and special chars.

**Pass criteria:** answers survive refresh during grading.
**Failure → BLOCKER.** This is the headline fix for TypedTest.

---

### S03 — clearTestState moved past attempt write

**Persona:** Recovering Student
**Goal:** Verifies the same ordering as B02 S02 but for the Typed path.

1. Begin a typed test. Type answers.
2. Configure route: grading succeeds normally, attempt-write FAILS once with 503 then succeeds.
3. Click Submit.
4. Observe grading complete, then submit-error UI appears briefly, then withRetry retries successfully, then results screen.

**Assertions:**
- Exactly one attempts doc (idempotent ID held).
- Single timesTestedTotal increment (resultsProcessedRef held).
- localStorage cleared after success.

**Failure → HIGH.**

---

### S04 — Grading retry independent of submit retry

**Persona:** Recovering Student
**Goal:** The AI grading has its own retry (`gradeWithRetry` does 3 attempts at 90s each). Verify it doesn't conflict with the submit retry.

1. Begin a typed test.
2. Configure route: grading function fails twice with 503, succeeds on 3rd attempt.
3. Click Submit.
4. Observe retry attempt counter UI (the page may display "Retry attempt 1 of 3" — capture exact text).
5. After ~3 minutes (worst case), grading succeeds, submit proceeds, results screen.

**Assertions:**
- No duplicate Cloud Function invocations beyond the documented 3 attempts.
- Exactly one attempts doc.
- AI rationale displayed in results.

**Failure → MEDIUM.** UI confusion would just confuse; data is safe.

---

### S05 — Tab close mid-grading must not orphan

**Persona:** Distracted Student
**Goal:** The student closes the tab while grading is in flight. On next login, what state are they in?

1. Begin typed test, type answers.
2. Stall grading via route.
3. Close the tab (`context.close()`).
4. New context, log in as same student.
5. Navigate to dashboard, then back to the same test.

**Acceptable outcomes (any of):**
- A: Recovery prompt appears, answers restored. (Best.)
- B: Test resumes from scratch, no answers; but ALSO no attempt doc was created. (Acceptable; student redoes the test.)

**Unacceptable:**
- C: An attempt doc was created with empty or partial answers (HIGH).
- D: Student is locked out of starting the test again (HIGH).

---

### S06 — AI grading consumes Korean definition properly

**Persona:** Careful Student
**Goal:** Korean definition list works; AI grading handles `definitions.ko`.

1. Begin typed test on `koreanList`.
2. For each prompt, type the English definition (the AI should accept English even though Korean is the primary `definitions.ko`).
3. Submit, wait for grading, observe results.
4. Assert all answers graded as correct (since they match the canonical English definition).

**Failure → MEDIUM** if the AI mis-grades a Korean-defined word; LOW if the issue is just rationale phrasing.

---

### S07 — Long answer (>500 chars)

**Persona:** Anxious Student (over-explainer)
**Goal:** A very long answer doesn't crash anything.

1. Begin typed test. On first prompt, type a 600-character answer (paste in lorem ipsum or write a long response).
2. Submit normally.
3. Assert: results show, attempt doc contains the full 600-char answer in `answers[0].studentResponse`.

**Failure → MEDIUM** if truncated; HIGH if crash.

---

### S08 — Special characters

**Persona:** Lazy Student
**Goal:** em-dash, smart quotes, emoji, Korean glyphs round-trip through grading.

1. Begin test on `specialCharsList`.
2. Type answers with mixed Unicode (paste a recipe of em-dash, "smart quotes", 🎉 emoji, 한국어).
3. Submit, observe results.

**Assert:** All special chars preserved exactly in the attempt doc and on the results screen.

**Failure → HIGH** if data is mangled (encoding bug).

---

### S09 — Empty answer

**Persona:** Lazy Student
**Goal:** Submitting all-blank doesn't crash; behaviour matches the documented validation.

1. Begin typed test on `tinyList`.
2. Leave every input blank.
3. Click Submit.
4. Expected: validation error "Please answer at least one question." (Matches db.js:1282 check.)

**Failure → MEDIUM** if it goes through silently with score 0; HIGH if crash.

---

### S10 — Paste-then-submit race (verifies the TypedTest responses-from-state vulnerability)

**Persona:** Rushed Student
**Goal:** Audit finding #10 from the persistence audit — TypedTest reads `responses` directly from React state, not a ref. The last keystroke before submit may be lost.

1. Begin typed test.
2. For the LAST question, paste a long answer via clipboard.
3. Immediately click Submit (within 50ms of the paste event).
4. Wait for grading and results.
5. Assert: the pasted answer is present in the attempt doc's answers.

**Failure → MEDIUM.** Audit-known issue; record as confirmed/refuted.

---

### S11 — Try Again after failed grading, then succeed

**Persona:** Anxious Student
**Goal:** Try Again UI after a grading failure properly recovers.

1. Begin typed test.
2. Route: grading fails all 3 attempts.
3. Click Submit. Observe error.
4. Click "Try Again" or "Retry Grading."
5. Route: now allow grading to succeed.
6. Assert results appear, single attempt doc, no double-increment.

**Failure → MEDIUM.**

---

### S12 — Practice mode does not write attempts (typed variant)

Same as B02 S07 but for typed test. AI grading still runs (so the student sees feedback), but no attempt doc, no study_states writes.

---

### S13 — Console must be clean during happy path

Same shape as B02 S11.

---

### S14 — Second typed test on the same list creates separate attempt

Same as B02 S12.

---

### S15 — Simulation mode setTimeout cleanup (audit finding cross-check)

**Persona:** —
**Goal:** Audit noted that TypedTest line 134 schedules `setTimeout(handleSubmit)` for simulation auto-mode without unmount cleanup. Verify by navigating away during a simulation run.

1. Enable simulation auto-mode (if there's a UI toggle).
2. Start a typed test in auto-mode.
3. While auto-typing is happening, navigate away to dashboard.
4. Assert no `setState on unmounted component` warning in console; no spurious attempt doc created.

**Failure → MEDIUM.**

## State updates

Update `audit_state.json.attempts` with each successful run's attempt doc reference, keyed by `<persona>_<scenarioId>`.

## Evidence

Same shape as B02 — screenshots, console, HAR, Firestore snapshots per scenario.

Special focus: capture the `gradeWithRetry` retry-attempt UI text exactly. The audit will reference this in B07 (network resilience) when checking retry messaging.

## Severity reminder

S02 / S03 = BLOCKER. S05 / S07 / S08 / S10 = HIGH. S04 / S06 / S11 / S15 = MEDIUM. Console-only issues = LOW.
