# D1-02 — Day-1 Completion Test: audit_multidevice_01_top

**Label:** D1-02  
**Account:** audit_multidevice_01_top@vocaboost.test  
**Class:** k8tzOiiwotBbtJS3uTiv (TOP), List: 8RMews2H7C3UJUAsOBzR  
**Bundle:** index-CflgDyCK.js (live prod — https://vocaboostone.netlify.app)  
**Run date:** 2026-05-31  
**Classification: COMPLETED_PASS**

---

## Summary

Day-1 completed end-to-end on live prod. Account started fresh (CSD=0), reached the new-word test, answered all 30 questions correctly with canonical definitions typed char-by-char, received a 100% score, and Firestore advanced CSD to 1 with exactly one attempt document.

---

## Flow Observed

| Step | Outcome |
|---|---|
| Login (email+password) | PASS — redirected to dashboard |
| Dashboard → Start Today's Session | PASS — navigated to `/session/{classId}/{listId}` |
| "Start Studying" intro screen | PASS — customization overlay dismissed, flashcard phase began |
| H2 guard (stale/resume screen) | N/A — account was fresh, no stale screen |
| Flashcard study phase (Step 1 of 3) | PASS — 5 cards dismissed ("I know this word"), then Skip to Test |
| Session Menu → Skip to Test → Start Test | PASS — "Ready for the Test?" modal confirmed via "Start Test" button |
| New-word TEST (Step 2 of 3): 30 questions | PASS — all 30 inputs on single page, answered char-by-char |
| Submit Test | PASS — grading completed in ~13s |
| Results screen | PASS — "100% — 30 of 30 correct" |
| CSD advance (0 → 1) | PASS |
| Attempt doc written | PASS — exactly 1 doc |

---

## Assertions

| Assertion | Result | Detail |
|---|---|---|
| Reached Day-1 test | PASS | testInputVisible=true, 30 inputs found |
| B2 strand ("Unsupported field value: undefined") | PASS (not seen) | 0 console errors |
| New-word slice [0, pace) | PASS | 80 words at positions 0–79 verified |
| CSD before → after | PASS | 0 → 1 |
| Exactly one Day-1 attempt | PASS | 1 attempt doc created |
| Orphan docs | NONE | 0 orphan attempts |
| Console errors | NONE | 0 errors captured |

---

## Firestore Evidence

**Before:**
- `class_progress.currentStudyDay` = 0
- `attempts` = 0

**After:**
- `class_progress.currentStudyDay` = 1
- `class_progress.totalWordsIntroduced` = 80
- `attempts` = 1
  - ID: `oGsmh7KnI0XfU9xYixMJ7PbuVvq2_vocaboost_test_k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new_1780261092287_3b27ofg5v`
  - score: 100, studyDay: 1, type: new
- `study_states` = 80 (unchanged — pre-existing)
- `session_states` = 1

---

## UI Notes

- The test phase (Step 2 of 3) renders ALL 30 questions on a single page, not question-by-question.
- Grading completed in ~13s (expected ~19s).
- "Skip to Test" is in Session Menu (⋮ button), opens a "Ready for the Test?" modal with "Keep Studying" / "Start Test" buttons.
- The "Start Studying" button appears on a flashcard customization overlay at session entry.

---

## STATUS BLOCK

```
account:               audit_multidevice_01_top@vocaboost.test
reached test?:         YES
classification:        COMPLETED_PASS
B2 strand?:            NO
new-word slice correct?: YES (80 words, positions 0–79)
CSD before→after:      0 → 1
duplicate attempts?:   NO (exactly 1)
console errors:        NONE
orphan docs:           NONE
Day-1 OK?:             YES
```
