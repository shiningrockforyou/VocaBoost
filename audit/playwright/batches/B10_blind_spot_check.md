# B10 — Blind Spot Check

**Priority:** P1
**Estimated duration:** 30–45 minutes
**Depends on:** B00; ideally B04/B05 so the student has accumulated study data.
**Personas:** Anxious Student (heavy blind-spot user), Careful Student.

## Goal

Blind Spot is a separate testing flow from MCQ/Typed. Audit findings #6 and #7 from the persistence audit flagged:
- Blind Spot never writes an `attempts` doc (teachers can't see blind-spot results).
- Error path has no Try Again — single network blip = lost work.
- Answers indexed by `questionIndex`, not `wordId` (fragile to re-ordering).

Every scenario here cross-checks one of those.

## Scenarios

### S01 — Blind Spot happy path

1. Log in as `anxiousStudent`. From dashboard, find "Check Blind Spots" or equivalent.
2. Click Start. Take the test (~30 questions; adjust if blind-spot pool is smaller).
3. Answer all. Submit.
4. Results screen. No attempt doc check (Blind Spot doesn't create one — confirmed).
5. study_states for tested words updated.

### S02 — Network failure during submit (no Try Again)

1. Begin blind spot. Answer all.
2. Route: submit endpoint stalled.
3. Click Submit. Error appears after timeout.
4. Audit finding: only escape is "Back to Dashboard"; no Try Again.
5. If true: HIGH finding, "all 30 answers lost on transient failure."

### S03 — Re-ordering tolerance

1. Begin blind spot. Answer Q1, Q2, Q3.
2. (If possible) reload the questions in a way that changes their order. (May be hard without dev affordances; skip with note if not feasible.)
3. Submit. Verify each answer maps to the right word, not just the right index.

### S04 — Test More Blind Spots

1. After S01 success, click "Test More Blind Spots" (line 297-303 of BlindSpotCheck.jsx).
2. Verify the new test loads fresh; old answers don't persist.

### S05 — Blind spot pool exhaustion

1. After multiple S01 runs, the blind-spot pool may exhaust.
2. Verify the empty-pool UI is sane ("No words to review — great job!" or similar).

### S06 — Blind spot for a list with no prior data

1. As a student who hasn't studied yet, try to access blind spot.
2. Expected: pool is empty; sane empty-state UI.

### S07 — Submit during slow 3G

Same shape as B07 S03.

## Severity reminder

S02 = HIGH (audit-confirmed). S01 = BLOCKER if broken. Others MEDIUM/LOW.
