# B07 — Network Resilience

**Priority:** P0
**Estimated duration:** 60–90 minutes
**Depends on:** B00.
**Personas:** Distracted Student (intermittent), Recovering Student (offline → online), Rushed Student (slow networks make race conditions worse).

## Goal

Every Firestore write the student does must survive the realistic failure modes: short outages, slow networks, intermittent flakes, server 500s, dead-stalled connections. The student should never lose work because of network conditions; they should at most have to wait or retry.

This batch is the hostile-environment test for the persistence stack. It overlaps with B02/B03 but goes broader (every write path, not just test submission).

## The matrix

For each scenario, exercise at least three of the following conditions (declare which in the findings):

| Condition | Setup |
| --- | --- |
| Online clean | (default) |
| Offline | `await context.setOffline(true)` |
| Slow 3G | route handler with 800ms delay per request |
| Intermittent | route handler that 503s every Nth request |
| Server 500 (specific endpoint) | `route.fulfill({ status: 500 })` for matched URL pattern |
| Server stalled | route handler never calls `route.continue()` |
| DNS flake | block specific host via route, then unblock |

## Scenarios

### S01 — Offline at app load

**Persona:** Recovering Student
**Goal:** Offline at boot — the app must not crash; it must surface an offline indicator if available.

1. Set context offline.
2. `page.goto('/')`.
3. Expected: app loads (HTML+JS are cached after a prior visit, or vite serves them; the issue is Firestore data, not assets).
4. If app shows a connection error or offline banner, that's acceptable.
5. Crash / white screen = BLOCKER.

---

### S02 — Offline during test, comes back online

**Persona:** Recovering Student
**Goal:** Mid-test offline → online recovery.

1. Begin MCQ test. Answer 10 questions.
2. Context offline.
3. Answer 5 more questions (these should persist to localStorage via the auto-save effect, not Firestore).
4. Reload the page.
5. Recovery prompt: should still appear (localStorage), with all 15 answers.
6. Click Resume. Answer 5 more (total 20 answered).
7. Context online.
8. Continue, finish test, submit.
9. Expected: submit succeeds, attempt doc has all 20 answers.

**Pass criteria:** No data loss across the offline gap.
**Failure → BLOCKER.**

---

### S03 — Submit during slow 3G (800ms per request)

**Persona:** Rushed Student
**Goal:** UI must show loading state; double-click guards must hold; no race issues.

1. Slow-3G route handler active throughout.
2. Begin MCQ. Answer all questions.
3. Click Submit ONCE.
4. Loading state visible (spinner, "Submitting…" text, button disabled).
5. Submit completes within ~10s (3 writes × 800ms + overhead).
6. Single attempt doc, single timesTestedTotal increment.

**Failure → HIGH** if duplicate submit, missing loading state, or timeout.

---

### S04 — Submit during slow 3G + double-click

**Persona:** Rushed Student
**Goal:** Slow + double-click is the worst case.

1. Slow-3G active.
2. Begin MCQ, answer, double-click Submit.
3. Single submit doc, single counter increment.

**Failure → HIGH.**

---

### S05 — Submit, first attempt 500s, retries succeed

**Persona:** Recovering Student
**Goal:** withRetry behaves on transient server errors.

1. Route: attempt-write returns 500 on first call, then succeeds.
2. Begin test, answer, submit.
3. Backoff visible if logged; results screen appears after the retry succeeds.
4. Single attempt doc, single counter.

---

### S06 — Submit, ALL retries fail

**Persona:** Recovering Student
**Goal:** Hard failure surface.

1. Route: all attempt-writes return 500.
2. Submit.
3. After ~15s of retries (per withRetry's `totalTimeoutMs`), error UI appears with "Try Again" button.
4. Local recovery still intact (localStorage NOT cleared).
5. Take action: Network restored, click Try Again. Succeeds. Single doc.

---

### S07 — Submit with server stalled (never responds)

**Persona:** Recovering Student
**Goal:** Stalled connection — UI must not appear hung indefinitely.

1. Route: stall the attempt-write endpoint forever.
2. Submit.
3. After withRetry's `totalTimeoutMs = 15000`, error appears.
4. Local recovery intact.

**Failure → HIGH** if UI is permanently stuck with no error.

---

### S08 — isTransientError treats real offline errors correctly (verifies audit finding #9)

**Persona:** Recovering Student
**Goal:** Audit said `isTransientError` may not catch `'Failed to fetch'` errors (no `network`/`timeout` substring). Verify whether retry actually fires under wifi-drop conditions.

1. Begin test, answer.
2. Set context offline.
3. Submit.
4. Observe console: do you see "Retrying…" logs (withRetry's backoff) or an immediate "Failed to save…" error?

**Acceptable:** withRetry retries (1s, 2s, 4s) before giving up.
**Audit-confirmed bug:** Immediate failure with no retry → MEDIUM finding "isTransientError misses offline errors."

---

### S09 — Slow network + visibility change

**Persona:** Distracted Student
**Goal:** Slow 3G + tab backgrounded during submit. Does the submit complete?

1. Slow-3G active.
2. Begin test, answer, click Submit.
3. Within 200ms of clicking, fire visibilitychange → hidden.
4. Wait 5s, then unhide.
5. Submit should still complete (network requests don't pause on visibilitychange).

---

### S10 — Test save triggered by background tab loses focus

**Persona:** Distracted Student
**Goal:** The auto-save useEffect in DailySessionFlow fires on state change; verify nothing's racing across visibility.

1. Begin Day-1 session, dismiss 5 NEW_WORDS cards.
2. Quickly tab-away (visibilitychange hidden).
3. Wait 2s; tab-back.
4. Refresh.
5. Resume: all 5 dismissed cards preserved.

---

### S11 — Class join under offline (joinClass non-idempotent)

**Persona:** Hostile Student (but using a fresh-account variant)
**Goal:** Audit finding #15. joinClass is not idempotent.

1. Create a fresh student account.
2. Set context offline.
3. Paste a join code, click Join.
4. Expected: error UI ("Network error" or similar).
5. Online again, click Join.
6. Expected: succeed, single membership doc.

**Variant:** with two tabs, click Join simultaneously while online. Expected: studentCount increments by 1, not 2. **Failure → HIGH** per audit.

---

### S12 — List edit save under offline (no autosave)

**Persona:** Novice Teacher
**Goal:** ListEditor has no autosave; unsaved edits lost on close.

1. Log in as `noviceTeacher`. Open `standardList` in the editor.
2. Edit a word's definition (don't save).
3. Set context offline.
4. Click Save.
5. Expected: error UI; offer to retry.
6. Online. Retry save. Succeeds.

**Failure → MEDIUM** if silent failure.

---

### S13 — Server returns inconsistent error codes (400 vs 500)

**Persona:** Recovering Student
**Goal:** withRetry classifies error codes properly.

1. Route: attempt-write returns 400 "Bad Request" with no body.
2. Submit.
3. Expected: Immediate failure (400 is non-transient); error UI appears.
4. withRetry should NOT have retried (audit it via console).

---

### S14 — Many rapid writes under slow network (auto-save burst)

**Persona:** Rushed Student
**Goal:** DailySessionFlow auto-save can fire multiple times in fast succession. Slow network → some writes complete out of order. Audit finding #7 (DailySessionFlow).

1. Slow-3G active.
2. Begin session. Rapidly dismiss 10 NEW_WORDS cards in <2s.
3. Each dismiss triggers persistSessionState → saveSessionState (setDoc with merge).
4. After all dismissals, wait for network to drain.
5. Refresh.
6. Expected: ALL 10 dismissed cards reflected. (audit-suspect: last-write-wins where slow write #1 clobbers fast write #10.)

**Failure → HIGH** if fewer than 10 dismissed cards persist.

---

### S15 — Cloud Function timeout (Typed test grading)

**Persona:** Anxious Student
**Goal:** AI grading function exceeds its budget.

1. Begin typed test.
2. Route: stall `functions/grade` for 30s, then time out.
3. Submit.
4. Expected: gradeWithRetry retries (per its 3-attempts × 90s budget).
5. After 3 timeouts, error UI surfaces "Failed to grade…" with Try Again.

---

### S16 — Firestore listener disconnect during session

**Persona:** Distracted Student
**Goal:** Real-time listeners (heartbeats, session status) — if any exist for vocaBoost — must reconnect cleanly.

1. Begin session.
2. Offline for 30s.
3. Online.
4. Expected: any listener-driven UI (e.g. dashboard updates) reconnects within 10s.

(If vocaBoost has no real-time listeners, skip with note.)

## State updates

None (resilience tests don't create stable artefacts).

## Evidence

Network HAR is mandatory for every scenario — it's the proof.

## Severity reminder

S02 / S07 = BLOCKER. S03 / S04 / S06 / S08 / S11 / S14 = HIGH. Others MEDIUM/LOW.
