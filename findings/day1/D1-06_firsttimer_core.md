# D1-06: Day-1 Completion Test — First-Timer CORE

**Date:** 2026-05-31
**Account:** audit_firsttimer_01_core@vocaboost.test
**UID:** 1mUq9qM05yRJYYsQjy4juZ4tonr2
**Class:** CORE (LVjBTFuYE8FbPG34pVAt)
**List:** aRGjnGXdU4aupiS8SlXR
**Bundle:** index-CflgDyCK.js (live prod)
**Env:** https://vocaboostone.netlify.app

---

## Configuration (Read from Firestore Class Doc)

| Field | Value |
|-------|-------|
| testMode | typed |
| pace | 60 |
| testSizeNew | 25 |
| passThreshold | 90 |
| reviewTestType | mcq |
| testOptionsCount | 4 |

---

## Classification: **COMPLETED_PASS**

---

## Status Block

| Assertion | Result |
|-----------|--------|
| Account | audit_firsttimer_01_core@vocaboost.test |
| CORE testMode observed | typed |
| Reached test? | YES |
| Classification | COMPLETED_PASS |
| B2 strand? | NONE |
| New-word slice correct? | PASS — newWordStartIndex=0, newWordEndIndex=59 (inclusive; 60 words = pace) |
| CSD before→after | NO_DOC → 1 |
| One Day-1 attempt? | YES (exactly 1, no duplicates) |
| Console errors | NONE |
| Orphan docs | NONE |
| Day-1 OK? | **y** |

---

## Flow Summary

| Step | Result | Detail |
|------|--------|--------|
| Login | PASS | SPA warm at /, client-route to /login |
| Open session | PASS | URL: /session/LVjBTFuYE8FbPG34pVAt/aRGjnGXdU4aupiS8SlXR |
| H2 guard / Onboarding modal | PASS | "Customize Your Flashcards" modal dismissed via "Start Studying" button |
| Flashcard study | PASS | 60 × "I know this word (C)" clicks; 60/60 mastered |
| All cards reviewed modal | PASS | Appeared after 60th click; "Take Test" button required JS dispatchEvent |
| Navigate to typed test | PASS | URL: /typedtest/LVjBTFuYE8FbPG34pVAt/aRGjnGXdU4aupiS8SlXR |
| Fill 25 test inputs | PASS | All 25 inputs filled char-by-char with canonical definitions |
| Submit Test | PASS | Clicked Submit Test button in sticky footer |
| Grading | PASS | Score 100%, 25/25 correct, passed=true |
| Results page shown | PASS | "Step 2 of 3 — 100%, 25 of 25 correct" with Continue/Answers buttons |

---

## Firestore Assertions (Admin SDK READ-ONLY)

### Before (baseline)

```json
{
  "class_progress": [],
  "study_states": [],
  "attempts": [],
  "session_states": []
}
```

### After (post-test)

**class_progress** (path: `users/1mUq9qM05yRJYYsQjy4juZ4tonr2/class_progress/LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR`):
```json
{
  "currentStudyDay": 1,
  "totalWordsIntroduced": 60,
  "streakDays": 0,
  "classId": "LVjBTFuYE8FbPG34pVAt",
  "listId": "aRGjnGXdU4aupiS8SlXR",
  "progressSnapshot": {
    "currentStudyDay": 1,
    "totalWordsIntroduced": 60,
    "snapshotDayNumber": 1
  }
}
```

**attempts** (1 doc, no duplicates):
```json
{
  "id": "1mUq9qM05yRJYYsQjy4juZ4tonr2_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780261581743_t8imvukfb",
  "studyDay": 1,
  "sessionType": "new",
  "testType": "typed",
  "isFirstDay": true,
  "passed": true,
  "score": 100,
  "totalQuestions": 25,
  "skipped": 0,
  "newWordStartIndex": 0,
  "newWordEndIndex": 59,
  "wordsIntroduced": 60,
  "wordsReviewed": 0
}
```

**study_states subcollection** (`users/{uid}/study_states`): 60 docs created ✓

---

## Findings

No blockers or high-severity issues found. Day-1 completed successfully.

### Notes

- `class_progress` is stored in `users/{uid}/class_progress` subcollection (not root-level `class_progress` collection). The root collection query returns 0 docs — this is by design.
- `newWordEndIndex=59` is an inclusive 0-based index (words positions 0..59 = 60 words = pace=60). This is correct.
- The "All cards reviewed!" modal's "Take Test" button required JavaScript `dispatchEvent` click; Playwright's standard `.click()` was blocked by the `fixed inset-0 z-50` modal container overlay. This is a test-automation concern only, not a real user UX issue.
- `streakDays=0` after Day 1 is expected (streak increments on subsequent consecutive days).
- `lastStudyDate=null` after Day 1 — may be set on next day's login; not a blocker.

---

## Console Errors

None
