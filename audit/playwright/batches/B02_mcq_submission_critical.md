# B02 — MCQ Submission Critical Path

**Priority:** P0 — verifies the recent persistence fixes (#1, #3, #4, #5 from audit_findings_persistence.md). If any scenario here fails as BLOCKER, the persistence work I just did is wrong and rollout halts.
**Estimated duration:** 60–90 minutes
**Depends on:** B00.
**Personas heavily used:** Careful Student, Rushed Student, Recovering Student, Hostile Student.

## What changed recently (context)

Within the last week:
- `MCQTest.jsx:448` — `clearTestState` moved from start of `handleSubmit` to the success-path tail.
- `MCQTest.jsx:491` order — `processTestResults` now runs AFTER `submitTestAttempt` succeeds.
- `MCQTest.jsx` — added `resultsProcessedRef` guard to prevent Try-Again double-incrementing.
- `db.js:submitTestAttempt` — accepts deterministic `attemptDocId`; uses `setDoc` instead of `addDoc` when supplied.
- `testRecovery.js` — added `getOrCreateAttemptNonce(testId)`.

Every scenario below targets one or more of those invariants.

## Pre-flight

Before scenarios, capture a Firestore baseline:
- Read `attempts` for each of the seeded students (should be empty after B00 unless prior batches ran).
- Read `study_states` for `carefulStudent` (should contain only NEW words from seeded list, no `timesTestedTotal` or `lastTestedAt`).
- Snapshot to `evidence/B02/B02_baseline_firestore.json`.

## Scenarios

### S01 — Happy path: Careful Student finishes a new-word MCQ test

**Persona:** Careful Student
**Goal:** Baseline success. If this fails, nothing else in the batch can be trusted.

1. Log in as `carefulStudent`. Navigate to dashboard.
2. Pick primaryClass → tinyList. Click "Start Today's Session."
3. Step through the new-word study phase (5 cards). Dismiss each card.
4. Click into MCQ test for the new words.
5. Answer all 5 questions correctly.
6. Click "Submit."
7. Wait for results screen.
8. Capture:
   - Console log throughout (no errors expected).
   - Network HAR including the Firestore writes.
   - Screenshot `B02_S01_results.png`.

**Assertions:**
- Results screen shows correct count = 5/5.
- Exactly ONE attempt doc exists in `attempts` with `studentId = carefulStudent.uid`, `testType = 'mcq'`, `sessionType = 'new'`, `score = 100`.
- Document ID matches the pattern `${uid}_${testId}_${nonce}` (deterministic — log the testId and verify the nonce came from localStorage during the test).
- All 5 corresponding `study_states` for the tested words have `timesTestedTotal = 1`, `lastTestedAt ≈ now`, `status = PASSED`.
- localStorage key for the test is gone (clearTestState ran).

**Failure → severity:** BLOCKER if no attempt doc; HIGH if doc exists but counts off.

---

### S02 — clearTestState ordering (verifies fix #1)

**Persona:** Recovering Student
**Goal:** Prove that a transient network failure during submit does NOT eat the student's answers.

1. Log in as `recoveringStudent`. Start an MCQ test for `standardList` (50 questions).
2. Answer 30 questions.
3. Set up a Playwright route to FAIL the next call to the function that writes the attempt:
   ```js
   await page.route('**/firestore**/**', (route, req) => {
     if (req.method() === 'POST' && req.url().includes('write')) {
       // Force first attempt to 500
       fulfilledOnce ? route.continue() : (fulfilledOnce = true, route.fulfill({ status: 503 }))
     } else route.continue()
   })
   ```
   (Adapt selector to actual Firestore write endpoint observed in S01's HAR.)
4. Click Submit.
5. Wait for the submit-error UI to appear (text "Failed to save your test results" or similar — capture the exact string from the source).
6. Without clicking Try Again, REFRESH the page (F5).
7. Assert:
   - **Recovery prompt appears.** Text contains words like "resume" or "saved test."
   - Click "Resume."
   - All 30 answers are still selected (read the radio inputs).
8. Take screenshots before refresh, after refresh, after recovery accept.

**Pass criteria:** Answers survive the refresh. localStorage retained the `testRecovery` state because `clearTestState` was NOT called before the failed submit.

**Failure → BLOCKER.** This is the headline fix; if it doesn't hold, students lose work the moment networks blip.

---

### S03 — processTestResults order (verifies fix #3)

**Persona:** Hostile Student (we're inspecting Firestore between writes; might as well use the introspection persona)
**Goal:** Prove that study_states are mutated ONLY after the attempt doc lands.

1. Log in as `hostileStudent`. Enroll in `primaryClass` (one-off, NOT persisted to audit_state). Start an MCQ test.
2. Answer all questions.
3. Set up a route to STALL (never call `route.continue()`) the attempt-write endpoint.
4. Click Submit.
5. Wait until the spinner has been visible for 5 seconds — long enough that processTestResults could have run if mis-ordered.
6. Without releasing the stall, snapshot `study_states` for the tested words.

   **Assertion:** `timesTestedTotal` is unchanged from baseline (still 0). `status` is not PASSED/FAILED. `lastTestedAt` is unset.

7. Release the stall (`route.continue()`). Wait for completion.
8. Re-snapshot `study_states`.

   **Assertion:** `timesTestedTotal = 1`, `lastTestedAt ≈ now`, status updated.

9. Snapshot attempt doc; assert exists with correct fields.

**Pass criteria:** Phase 2 (processTestResults) ran AFTER phase 1 (attempt write).
**Failure → BLOCKER.** Split-brain is back.

---

### S04 — Try-Again does NOT double-increment counters (verifies fix #4)

**Persona:** Rushed Student
**Goal:** A failed-then-retried submit increments timesTestedTotal exactly once.

1. Log in as `rushedStudent`. Start an MCQ test on `tinyList`.
2. Answer all 5 questions.
3. Configure route to fail submit twice, succeed on the third try (Playwright route callback with a counter).
4. Click Submit. Observe "Failed to save…" error after the first failure.
5. Click "Try Again." Observe second failure.
6. Click "Try Again." Observe success → results screen.
7. Snapshot `study_states` for the tested words.

**Assertions:**
- `timesTestedTotal` = 1 (not 3, not 2).
- `timesCorrectTotal` matches expected (1 per correct word, not multiplied).
- Exactly ONE `attempts` doc exists for this test session.

**Failure → HIGH.** Double-counting corrupts mastery stats and intervention level.

---

### S05 — Idempotent attempt doc ID under withRetry (verifies fix #5)

**Persona:** Recovering Student (fresh test run)
**Goal:** A network-acked-but-client-missed submit produces ONE attempt doc on retry, not two.

1. Log in. Start an MCQ test on `tinyList`.
2. Answer all questions.
3. Configure route: when the attempt-write endpoint is hit, let it complete on the server but close the client connection AFTER the server response begins — simulate the "Firestore wrote but client missed the ack" case. (Easiest implementation: respond with `route.continue()` then immediately drop the connection on the client side via `context.close()` on a child context, OR use `route.fulfill({ status: 200 })` and then on the second call let it through normally.)
4. Observe withRetry firing a second attempt-write to the same docId.
5. After completion, list ALL docs in `attempts` for this student/test combo.

**Assertions:**
- Exactly ONE doc exists.
- Doc ID matches the deterministic pattern (read the nonce from localStorage at step 2 and confirm it's part of the ID).

**Failure → HIGH.** Duplicate attempts in the gradebook = teacher sees the same test twice.

---

### S06 — Refresh-then-retry edge case (known limitation)

**Persona:** Recovering Student
**Goal:** Verify the documented limitation that refresh+retry CAN double-increment study_states. Don't fix; just document the current behaviour so we know what students might hit.

1. Start MCQ test, answer all questions.
2. Configure route to FAIL submit's processTestResults step (but allow attempt write to succeed). This is the case where the attempt landed but study_states didn't.
3. Click Submit. Note that the result screen appears (per current code, processTestResults failure is swallowed).
4. Quickly REFRESH the page before navigating away.
5. … this should land you on the dashboard (test is over per the attempt doc), but verify the recovery flow doesn't re-fire processTestResults.

**Outcome:** If the recovery flow does re-fire it, study_states get +2 increment. Record as MEDIUM "known limitation" with audit link.

**Don't gate rollout on this — it's a documented gap.**

---

### S07 — Practice mode does not write attempts

**Persona:** Anxious Student (typical practice-mode user)
**Goal:** Practice mode is local-only.

1. Log in as `anxiousStudent`. Find a passed list with practice mode available.
2. Start an MCQ in practice mode.
3. Answer all questions, submit, observe results.
4. Confirm:
   - No new `attempts` doc.
   - No `study_states` writes.
   - localStorage `testRecovery` is cleared after success (cleanup still happens for practice mode).

**Failure → HIGH if attempts doc created in practice mode (treats practice as graded).**

---

### S08 — Submit with zero answers (lazy persona)

**Persona:** Lazy Student
**Goal:** Empty / sparse submission doesn't crash and doesn't corrupt data.

1. Log in as `lazyStudent`. Start MCQ for `tinyList`.
2. Without answering any question, click Submit.
3. Confirm:
   - Either: a validation error appears ("Please answer at least one question").
   - OR: submit goes through with score 0.
4. If validation: assert no attempt doc, no study_states writes.
5. If submit-with-0: assert exactly one attempt doc, study_states all marked FAILED with `timesTestedTotal = 1`.

**Failure → MEDIUM** if behaviour is inconsistent across reruns.

### S09 — Double-click Submit (race)

**Persona:** Rushed Student
**Goal:** Double-clicking Submit must not produce double-submit.

1. Start MCQ. Answer all questions.
2. Click Submit twice in quick succession (`page.dblclick`).
3. Wait for results.
4. Assert exactly one `attempts` doc.
5. Assert `study_states.timesTestedTotal = 1`.

**Failure → HIGH.** Combined with S05, both must hold for the dedup story to be coherent.

### S10 — Submit while last answer is still being clicked

**Persona:** Rushed Student
**Goal:** Verify `answersRef` saves the synchronous click; nothing's lost in a setState race.

1. On the last question, simulate: click an option AND click Submit within the same JS tick (use `Promise.all([click1, click2])` or evaluate the two events in one expression).
2. Wait for results.
3. Assert the answer for that question is recorded as the option chosen (read from the attempt doc's answers array).

**Failure → MEDIUM** if the answer is silently dropped.

### S11 — Browser console must be clean

**Persona:** Careful Student
**Goal:** No silent errors during the happy path.

1. Re-run S01 with console capture turned on.
2. Filter out known noise (React DevTools, vite HMR).
3. Assert no `console.error` calls, no uncaught promise rejections.

**Failure → LOW** unless the error indicates a real bug.

### S12 — Multiple test launches don't collide

**Persona:** Careful Student
**Goal:** After S01 (which submitted one test), launching the same test type a second time creates a fresh attempt with a fresh nonce, not an overwrite.

1. Immediately after S01 completes, go back to dashboard, start the same test again (review this time, since new is passed).
2. Answer all questions, submit.
3. Confirm:
   - A SECOND attempt doc exists with a DIFFERENT docId from S01's.
   - Old testRecovery key is gone (cleared by S01's success); a NEW nonce was generated for this run.

**Failure → HIGH** if doc IDs collide (second submit overwrote first).

## State updates

After this batch:
- `audit_state.json.attempts[carefulStudent_S01]` ← attempt doc reference.
- `audit_state.json.attempts[carefulStudent_S12]` ← second attempt doc.
- `audit_state.json.attempts[recoveringStudent_S02]` ← recovered-then-submitted attempt.
- (etc.)

## Evidence

For every scenario, capture:
- Pre-submit screenshot (with answers visible).
- Post-submit screenshot (results or error).
- Console log filtered to `error` + `warn`.
- Network HAR.
- Firestore snapshot before and after.

Store in `findings/evidence/B02/`.

## Severity reminder

S02 / S03 / S05 failing = BLOCKER. S04 / S09 / S12 = HIGH. Everything else inherits from the rubric.

Move on to B03 immediately after; B03 mirrors this structure for the Typed test path.
