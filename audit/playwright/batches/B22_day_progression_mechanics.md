# B22 — Day Progression Mechanics

**Priority:** P0 — moved into the rollout-gate group based on the issue chat log analysis.
**Estimated duration:** 3–4 hours (longitudinal; multiple multi-day walks).
**Depends on:** B00; ideally B02/B03 happy paths to confirm single-test correctness first.
**Personas heavily used:** Careful Student, Korean Native Typist, ESL Learner, Anxious Student, Class-Switcher, Confused First-Timer, Habitual Refresher.

## Why this exists

Reviewing the two-month TA chat log (Jan–Feb 2026 winter intensive), the single most-reported pattern — appearing on essentially every workday — was: "student passed test, but next day they still see the previous day's words" or its inverse, "student jumped from Day 1 to Day 3." Around 30+ distinct incidents.

Many of those bugs were fixed during that period. This batch is **exploratory regression prevention** — it doesn't reproduce specific known bugs; it constructs realistic multi-day journeys and verifies invariants hold day after day across the cross-product of persona, transition type, and disruption.

## ⚠ Server-time caveat (read before running)

The longitudinal scenarios in this batch advance the client clock via `helpers/time.js` `installTimeShim()`, which shims `Date.now()` on the page. **This does NOT affect Firebase `serverTimestamp()` values** — those come from Google's server clock and cannot be shimmed from the browser.

What this means for B22:
- **Client-visible day progression** (dashboard CSD, "Day N" label, today's-session card state) **CAN be validated** by this batch.
- **Server-timestamped invariants** (e.g. `recentSessions[].date` ordering, `lastSessionAt`, `lastStudyDate`, streak math driven by server-side comparisons) **CANNOT be cleanly validated** with this shim. If the test passes a day boundary client-side but Firestore stamps everything with real-now, the day-N entry will have today's real timestamp, not the shimmed day-N timestamp.
- **The invariant set below distinguishes the two.** Invariants 1, 4 (client-visible) are fully validated. Invariants 2, 3, 8 (server-timestamp-derived) are validated only insofar as the algorithm derives them from `submittedAt` which IS a server timestamp.
- For full server-time validation, **a separate B22-emulator pass** is required (start `firebase emulators:start` then re-run with the time-shimming flags the emulator supports). That pass is out of scope for the default audit run against production.

Document any findings that involve server-time fields explicitly as "client-time scenario, server-time field — caveat applies" in findings_B22.md.

## What "exploratory" means here

- Walk Day 1 → Day 14 for each persona. Don't predetermine what's expected at each step beyond the core invariants below.
- At every day transition, capture full Firestore state (class_progress, attempts, study_states, session_states) to `findings/evidence/B22/`.
- Look for drift between expected and observed: CSD off by one, recentSessions length mismatch, streakDays wrong, attempt-doc duplicates, study_state increments accumulating, words shown on Day N+1 belonging to Day N or Day N+2.
- Don't bias scenarios toward known-broken paths; instead, vary the persona + disruption combination broadly and let drift surface where it will.

## Core invariants (assert after every day)

1. `class_progress.currentStudyDay` advances by exactly 1 per completed day.
2. `class_progress.recentSessions.length` = min(daysCompleted, MAX_RECENT_SESSIONS).
3. `class_progress.streakDays` advances by 1 on completed-day, resets to 0 on day-gap > studyDaysPerWeek.
4. Words shown on Day N's new-word test fall within `[pace*(N-1), pace*N - 1]` of the list's word position range.
5. Exactly one `attempts` doc per (testType, sessionType, day) tuple per student.
6. `study_states.timesTestedTotal` for a word equals the number of distinct day-test events that included that word.
7. No `attempts` doc has score outside [0, 100].
8. `class_progress.lastStudyDate` is the most recent attempt's submittedAt.

## Infrastructure helpers needed

See PLAN.md "Multi-day longitudinal scenarios" — install Date.now shim via `addInitScript`; use `__advanceTime` to skip 24h between sessions; use `completeDay(page, persona, {dayNumber, classKey, listKey})` helper to drive each day's full flow.

Use `captureFirestoreState` after every day. Store under `findings/evidence/B22/<persona>/day_NN.json`. The day-over-day diff is the audit's primary artefact.

## Scenarios

### S01 — Careful Student, 14-day clean walk on standardList

**Persona:** Careful Student
**Goal:** Establish the baseline. If THIS fails, nothing else in the batch is interpretable.

1. Use `standardList` (50 words, pace=7, studyDaysPerWeek=5).
2. Anchor time at 2026-06-01 09:00 KST (a Monday).
3. For day in 1..10 (10 study days, skip 2 weekends):
   - Run `completeDay(page, carefulPersona, {dayNumber: day, classKey: 'primaryClass', listKey: 'standardList'})`.
   - Assert all eight invariants above.
   - Advance time to next study day (handle weekend skip).
4. Verify final state:
   - `currentStudyDay = 10`.
   - All 50 words have `timesTestedTotal ≥ 1`.
   - 10 `attempts` docs total (no review tests on Day 1 → 10 new-word attempts + 9 review attempts = 19 docs).

**Pass criteria:** Every invariant holds every day.
**Failure → BLOCKER.**

---

### S02 — Korean Native Typist, 14-day walk with Korean responses

**Persona:** Korean Native Typist
**Goal:** Verify that Korean-typed typed-test answers round-trip through grading and don't break day progression.

1. Same shape as S01 but with `koreanList` (or `standardList` with definition_ko populated).
2. Typed test responses are the canonical Korean translation:
   - Word `anthology` → student types `(시 등의) 선집`.
   - Word `coalesce` → student types `결합하다, 합체하다`.
3. Verify that the AI grader accepts Korean (or, per design, gracefully rejects with a clear status the dispute flow can handle).
4. Assert invariants every day.

**Pass criteria:** Korean responses round-trip without encoding loss. Day progression matches S01's English baseline.
**Failure → BLOCKER** if Korean strings are mangled in the attempt doc; **HIGH** if grading is unfairly strict on Korean (false negatives that would force every Korean student to dispute).

---

### S03 — ESL Learner, 14-day walk with imperfect English

**Persona:** ESL Learner
**Goal:** Verify that realistic Korean-student English (missing articles, mis-pluralizations, wrong tense) doesn't tank scores. This is the demographic majority.

1. Same shape as S01.
2. For each typed answer, apply the ESL transform: strip articles, mis-pluralize, swap a tense.
3. Expected: still passes most tests (grader should be tolerant per david's note in the chat log: "I have also made the AI grading a bit more lenient").
4. When a test fails, retake — Speed Runner style or Careful retake.
5. Verify day progression eventually matches S01's by Day 14.

**Pass criteria:** ESL-imperfect English passes at a rate comparable to canonical English. If the rate is dramatically lower (>20% gap), MEDIUM finding — grader needs tuning.

---

### S04 — Walk with a refresh at every day transition

**Persona:** Habitual Refresher
**Goal:** Refreshing right after submit must not break day advancement (chat-log pattern: "rebooted browser and still didn't advance").

1. Same walk as S01.
2. After each test submission, immediately F5 the page before navigating elsewhere.
3. Verify CSD advanced and the dashboard reflects it.

**Pass criteria:** No day stuck at N when N+1 was expected.

---

### S05 — Walk with a tab close + reopen at every day transition

**Persona:** Recovering Student variant
**Goal:** Tab close immediately after submit. Chat log finding: David repeatedly asked TAs whether students closed the window quickly after submit.

1. Same walk.
2. After each "Continue" press on results screen, hard-close the browser context (`context.close({runBeforeUnload: false})`).
3. Open new context, log in same student.
4. Verify CSD reflects the completed day.

**Pass criteria:** Day always advances; never "stuck."

---

### S06 — Walk with double-clicks on every submit

**Persona:** Rushed Student
**Goal:** Double-click pattern david explicitly suspected.

1. Same walk.
2. Every Submit click is replaced with `Promise.all([click, click])` (two rapid clicks).
3. Verify single attempt per test, day advances.

**Pass criteria:** No duplicate attempts, no day-skip.

---

### S07 — Walk with a multi-tab race at every transition

**Persona:** Confused First-Timer (often opens multiple tabs accidentally)
**Goal:** Multi-tab activity at the moment of transition.

1. Same walk.
2. At each "results → continue" moment, open a SECOND tab to dashboard while the first tab is mid-transition.
3. Verify CSD is consistent across both tabs (after each refresh).

**Pass criteria:** Both tabs eventually agree on CSD = N.

---

### S08 — Walk with challenge-driven passes

**Persona:** Anxious Student
**Goal:** Chat log: students who passed Day N test via challenge often hit weird states the next day.

1. Same walk shape.
2. On the new-word test each day, deliberately get 4 of 7 wrong by submitting incorrect English (e.g. swap synonyms to mismatch the canonical).
3. After submit, raise challenges on all 4 incorrect items. Acting as both student and teacher (via two contexts), accept all challenges.
4. Verify the day advances per the challenge-driven pass rule.
5. The challenge teacher accept might double-advance per audit finding #11 — capture state to verify CSD advances by exactly 1 per day.

**Pass criteria:** Even with challenge-driven passes, CSD advances cleanly by 1 per day.
**Failure → HIGH** if any day skips or stalls.

---

### S09 — Walk where Day N test fails the threshold

**Persona:** Lazy Student
**Goal:** Failure path. Test fails → retake → eventually passes → day advances.

1. Same walk.
2. On Day 5, deliberately answer such that score < retakeThreshold (0.95). e.g. answer half "idk".
3. Retake button must appear.
4. Click Retake. Same words appear (no fresh sample).
5. Now answer correctly; pass.
6. Verify day still advances to Day 6 the next session.

**Pass criteria:** Retake flow works; day eventually advances.

---

### S10 — Walk where review test fails repeatedly

**Persona:** Lazy Student
**Goal:** Low review scores → pace algorithm engages (B25 covers this in depth; here just verify it doesn't BREAK day advancement).

1. Walk Day 1 → Day 7.
2. On every review test, answer 20% correctly (intentionally bad).
3. Observe: new-word pace may drop (per B25), but day should still advance.
4. After 7 days, verify `currentStudyDay = 7` even if `pace` (number of new words per day) has been suppressed to 3 or 4.

**Pass criteria:** Day advances regardless of review score.

---

### S11 — Walk skipping a weekend day

**Persona:** Careful Student
**Goal:** Friday session → next session should be Monday for studyDaysPerWeek=5 lists.

1. Walk Day 1 → Day 5 (M-F).
2. Advance to Saturday.
3. Dashboard: try to start session.
   - Expected: either no session available OR practice mode only.
4. Advance to Sunday: same.
5. Advance to Monday: Day 6 available.
6. Verify streakDays = 5 (not broken by weekend).

**Pass criteria:** Weekend skip works; streak preserved.

---

### S12 — Walk skipping multiple days (vacation pattern)

**Persona:** Distracted Student
**Goal:** Student studies M-W, skips Thu-Sun (4 days off), returns Monday.

1. Walk Day 1 → Day 3 (M, T, W).
2. Advance 4 days (skip Thu, Fri, Sat, Sun).
3. Monday: start session.
4. Should be Day 4 (algorithm continues from where they left, doesn't catch up).
5. Streak: depends on studyDaysPerWeek. For 5: Thu/Fri missed → streak reset. For 7: streak reset.

**Pass criteria:** Day advances correctly post-gap; streak reflects gap.

---

### S13 — New student starting on Day 1 mid-program

**Persona:** Confused First-Timer
**Goal:** Chat log Feb 16: new students joining late should start at Day 1 of the list, not at the current cohort's day.

1. Day 7 has already passed for existing students (use S01's final state).
2. Today, a NEW student (Confused First-Timer) joins primaryClass via joinCode.
3. New student: dashboard shows Day 1.
4. New student takes Day 1 test, walks through Day 1 → Day 4.
5. Verify that existing students' progress is untouched.

**Pass criteria:** New student isolated correctly.

---

### S14 — Pace-7 vs pace-3 lists side by side

**Persona:** Careful Student enrolled in two classes
**Goal:** Two lists with different paces shouldn't interfere.

1. Student enrolled in primaryClass (standardList, pace=7) and secondaryClass (a list with pace=3 — create one if needed in B00 reseed).
2. Walk Day 1 → Day 5 for BOTH simultaneously (alternate days, one then the other).
3. Verify each list's CSD independent.
4. Verify primary focus list selection works correctly with two active.

**Pass criteria:** Two lists progress independently; no cross-contamination.

---

### S15 — Challenge accepted by teacher mid-day, then student starts next day

**Persona:** Anxious Student
**Goal:** Cross-batch with B19. The chat log shows teacher accepting a challenge can advance the student's day; verify this works cleanly.

1. Day 3 test: 22/25, just below pass. Student raises 3 challenges (need 3 to cross the 23 threshold).
2. Teacher accepts all 3 challenges.
3. Student returns to dashboard.
4. Day advances to Day 4 (currentStudyDay = 4 in Firestore).
5. Student takes Day 4 session; passes; day advances to 5.

**Pass criteria:** Teacher-accept-driven day advance works; subsequent days still advance normally.

---

### S16 — Walk after a wifi-blip mid-day (academy WiFi simulation)

**Persona:** Academy-WiFi Student
**Goal:** With 800ms RTT + 5% packet loss as the persistent network condition, walk 5 days.

1. Apply academywifi network conditions globally.
2. Walk Day 1 → Day 5.
3. Some submits will retry; withRetry should hold up.
4. Verify no duplicate attempts, no day-skip.

**Pass criteria:** Walk completes despite poor network; invariants hold.

---

### S17 — Walk on mobile viewport (phone-only student)

**Persona:** Phone-Only Student
**Goal:** Many real students study on phone. Some layout / scroll / button-position bugs only show up there.

1. Apply phone viewport throughout.
2. Walk Day 1 → Day 5.
3. Verify all buttons reachable, no horizontal scroll, no test-blocking layout issues.
4. Submit, recovery, navigation all work via touch.

**Pass criteria:** Walk completes on mobile.

---

### S18 — Walk on slow CPU

**Persona:** Slow-Laptop Student
**Goal:** Old laptops with throttled CPU may surface race conditions that fast hardware hides.

1. Apply `client.send('Emulation.setCPUThrottlingRate', {rate: 4})` via CDP.
2. Walk Day 1 → Day 5.
3. Look for races: spinner stuck, double-render, autosave conflict.

**Pass criteria:** Walk completes; nothing visually broken.

---

### S19 — Class-Switcher walk (mid-program transfer)

**Persona:** Class-Switcher
**Goal:** Mid-program CORE → TOP transfer (the 민사랑 case). Cross-references B24 but does the multi-day walk variant here.

1. Walk Day 1 → Day 7 in CORE class (CORE list).
2. On Day 8, enroll in TOP class via joinCode.
3. Dashboard: which list does the student see first? Both? Primary focus changed?
4. Walk Day 1 → Day 5 of TOP list (since TOP starts at Day 1 for them).
5. Meanwhile CORE list should still show their previous progress and allow continuation.

**Pass criteria:** Both lists' progress is preserved independently. The student can continue either or both.

---

### S20 — Concurrent multi-student walks (load shape)

**Persona:** 5 different student personas in parallel
**Goal:** Simulate the academy reality of ~10 students taking tests at the same minute.

1. Open 5 Playwright contexts in parallel.
2. Each runs S01's walk concurrently (Careful, Korean, ESL, Anxious, Rushed).
3. Verify all 5 complete; no cross-talk; each Firestore state isolated.

**Pass criteria:** All 5 complete without interference.

---

### S21 — Repeat S01 with the academy-wifi network condition AND multi-tab race

**Persona:** Academy-WiFi + Confused First-Timer combo
**Goal:** Two real conditions stacked.

1. Same as S07 but with the network condition.
2. Walk 5 days.
3. Verify invariants.

**Pass criteria:** Walk completes; no day stuck.

## Findings reporting

For B22 specifically, the findings_B22.md should include:

- **Daily walk summary table** — one row per (persona, day) with: CSD before, CSD after, attempt-doc count, study_states writes count, pass/fail, drift?
- **Drift events** — any day where invariants didn't hold, with day-N and day-(N-1) Firestore snapshots diff'd.
- **Persona × disruption matrix** — heatmap of where each persona's walk hit issues.

If a single drift event is found, that's a HIGH finding. If a pattern (same drift on multiple personas / days), BLOCKER.

## Stop conditions

- If S01 (Careful baseline) fails on day 3+, STOP — the baseline is broken and nothing else in B22 is interpretable.
- If S02 (Korean) fails to round-trip Korean, STOP and file BLOCKER — your Korean-typing students cannot use the app.
- Otherwise continue all 21 scenarios.

## Evidence

`findings/evidence/B22/<persona>/day_NN.json` for every day of every walk. Critical for diffing.

`findings/evidence/B22/walks_matrix.csv` — final summary table.
