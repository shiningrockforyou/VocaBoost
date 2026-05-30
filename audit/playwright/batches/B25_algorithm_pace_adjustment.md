# B25 — Algorithm Pace Adjustment (Intervention Level)

**Priority:** P2
**Estimated duration:** 60–90 minutes (longitudinal — needs multi-day runs)
**Depends on:** B00, B22 (multi-day walk infrastructure).
**Personas:** Lazy Student (drives low review scores), Careful Student (baseline), Anxious Student (overcorrects).

## Why this exists

Chat-log pattern #9 — multiple students hit a "stuck at 6 words per day" state that confused everyone (TA, student, even david initially). The behavior was:

> [david] [오후 2:31] [1] 단어 시험에서, Review Test 점수가 계속 낮게 나오면, New Words진도가 늦춰집니다. 극단적인 경우 새 단어는 아예 안나오고 리뷰 테스트만 나와요.
> [2] 이런 경우, 계속 Day 6, 7, 8, 9 이어서 진행시켜주세요. They should do it until... they do well enough on review tests so that the regular pace of 80 (top) or 60 (core) words start appearing.

So the algorithm has a pace-suppression feedback loop: low review scores → fewer new words → student studies fewer words → still bad → more suppression → cycle. Recovery only happens once review scores improve over multiple sessions.

This batch verifies:
1. The suppression engages at the right threshold.
2. The suppression magnitude is correct.
3. Recovery works once review scores improve.
4. The UI communicates the suppressed state to the student (so they don't think the app is broken).

## Scenarios

### S01 — Baseline: high review scores keep full pace

**Persona:** Careful Student
**Goal:** When review test scores are consistently good, the new-word pace stays at the assigned value.

1. Walk Day 1 → Day 10 on standardList (pace=7).
2. Pass every review test (>95%).
3. Verify each day's new-word session shows exactly 7 new words.
4. Verify `class_progress.interventionLevel` stays at its initial value (likely 0.5 — the neutral midpoint).

### S02 — Low review scores trigger suppression

**Persona:** Lazy Student
**Goal:** Consistently bad review scores → pace drops.

1. Walk Day 1 → Day 10.
2. New-word test: pass each (since student does study).
3. Review test: score ~20% each day (random clicks).
4. Verify after some N days (likely 3-5), the new-word batch size starts dropping below 7.
5. By Day 10, batch should be ~3-4 words.
6. Track `interventionLevel` evolution; it should monotonically increase (or decrease, depending on sign convention).

**Pass criteria:** Pace drops over time; not all at once.

### S03 — Recovery from suppression

**Persona:** Lazy Student → Careful Student transition
**Goal:** Once review scores improve, pace recovers.

1. Continue from S02 (suppressed state).
2. Switch behavior: now answer review tests correctly (>90%).
3. Walk Day 11 → Day 20.
4. Verify pace gradually recovers toward 7.
5. By Day 20, pace should be back to or near 7.

**Pass criteria:** Recovery works.

### S04 — Extreme suppression: 0 new words

Per david's note: "극단적인 경우 새 단어는 아예 안나오고 리뷰 테스트만 나와요."

1. Continue S02 with even worse review scores (10% across 15 days).
2. Verify at some point pace drops to 0.
3. Student only sees review tests, no new words.
4. UI should communicate this clearly.

**Pass criteria:** Extreme state reachable; UI clear.

### S05 — Recovery from 0-pace state

1. Continue S04.
2. Now answer review tests at 100%.
3. Walk forward.
4. Verify pace eventually returns above 0.
5. Time to recovery: measure and document.

### S06 — Suppression threshold edge

1. Score review tests right at the suppression threshold (whatever it is — probably some interventionLevel boundary).
2. Verify pace is on the boundary (e.g., 6 or 7 depending on the threshold behavior).
3. Tiny variations: 87% then 88% then 87%. Does pace oscillate?

**Pass criteria:** No rapid oscillation; algorithm should have hysteresis.

### S07 — Suppression while increasing review scores

**Persona:** Anxious Student doing inconsistent reviews
**Goal:** Mixed signals — alternating good and bad reviews.

1. Walk 10 days.
2. Even days: 95% review. Odd days: 30% review.
3. Track interventionLevel and pace each day.
4. Verify the algorithm produces a sensible average rather than wild swings.

### S08 — Pace adjustment respects pace ceiling

1. Setup: list with assigned pace=7.
2. Student does GREAT (100% on everything).
3. Walk 14 days.
4. Verify pace never exceeds 7 (algorithm shouldn't "reward" with more than assigned).

### S09 — Pace UI indication

For the suppressed-pace state:

1. Enter suppressed state (continue S02).
2. Open dashboard.
3. Look for any UI indication that pace is suppressed:
   - "You're studying X new words today (suppressed due to low review scores)."
   - Banner / tooltip / hint.
4. If no indication: MEDIUM finding (students will be confused — the chat log shows this exact confusion repeatedly).

### S10 — Pace UI for normal state

1. Same as S09 but with normal pace.
2. Verify the dashboard shows "X new words today" or similar.

### S11 — Pace doesn't change mid-day

1. Start a session with pace=7.
2. Mid-session (after card 3), simulate a Firestore write that bumps interventionLevel.
3. Continue session.
4. Verify the session uses pace=7 throughout (doesn't switch mid-flight to a lower pace).

### S12 — interventionLevel persisted correctly

1. Walk 5 days with mixed scores.
2. After day 5, log out, log back in.
3. Verify interventionLevel survives the round-trip.
4. Day 6: pace reflects the persisted interventionLevel.

### S13 — Two students with different intervention levels

1. Student A: high review scores, pace=7.
2. Student B: low review scores, pace=3.
3. Both take Day 8 test on same list.
4. Verify each sees their own pace's words (A: words for positions 49-56; B: words for positions 21-23).

### S14 — Pace 1 edge

If pace can drop to 1 word/day:
1. Get there.
2. Verify single-word session UI doesn't break.
3. Single-word test (1 question).
4. Pass/fail and recovery work.

### S15 — Pace and weekend skip interaction

1. studyDaysPerWeek=5, pace=7 normally → 35 words/week.
2. Suppress to pace=3 → 15 words/week.
3. Walk M-F at suppressed pace.
4. Saturday: no session.
5. Monday: next day's session with same suppressed pace.

**Pass criteria:** Pace is per-day, not per-week; weekends don't recompute.

## Severity reminder

S04 / S05 = MEDIUM (chat log showed students confused but not blocked). S06 = HIGH if oscillation. S09 = MEDIUM (UX clarity). Others LOW.
