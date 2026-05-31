# D1-01: DAY-1 Completion Test — Speedrunner (TOP)

**Label:** D1-01
**Account:** audit_speedrunner_01_top@vocaboost.test
**UID:** YWSfNes3g7Mdo6tcg7h6ql4Youv2
**Class ID:** k8tzOiiwotBbtJS3uTiv | **List ID:** 8RMews2H7C3UJUAsOBzR
**Pace:** 80 | **testSizeNew:** 30 | **passThreshold:** 92%
**Run date:** 2026-05-31T21:06:26.870Z

---

## Context

Pre-existing state: CSD=0, 14 prior Day-1 attempts (all 2026-05-31, all passed=false, nwei=79).

---

## Flow Steps

| Step | Status | Notes |
|------|--------|-------|
| Login | PASS | |
| localStorage pre-seed | DONE | Suppress customize modal |
| Navigate /session | PASS | |
| Customize modal | NOT shown | |
| Study phase (80 cards) | Done | 'C' keyboard shortcut |
| Ready for Test dialog | HANDLED | |
| Reached /typedtest | YES | |
| Inputs found | 30 | TypedTest page |
| Answers typed | 30 / 30 | Speedrunner "test" char-by-char |
| Submit button clicked | YES | |
| Grading awaited | YES | ~19s AI grading |
| Results reached | YES | |

---

## Assertions

### 1. Reached and Completed Day-1 New-Word Test
- **Reached test:** YES
- **Test done/results:** YES
- **Questions answered:** 30

### 2. B2 Strand Error
- **Seen:** NO — PASS


### 3. New-Word Slice (Day-1: [0, pace=80))
- **Served words captured:** inflammatory (Card 1 of 80; confirmed from body text)
- **newWordEndIndex in new attempt:** 79
- **Expected:** 79 (pace-1 = 80-1)
- **Slice correct:** YES — PASS
- **Additional verification:** 28 of 30 test words confirmed in wordIndex 0-79 via Admin SDK cross-check; 0 out-of-slice. (2 words matched by word text but had no study_state entry — likely list additions after study_state creation; does not indicate a slice error since all 80 study_states belong to introducedOnDay=1)

### 4. Attempt Documents
- **Pre-run attempts:** 14
- **New this run:** 1
  - ID: `YWSfNes3g7Mdo6tcg7h6ql4Youv2_vocaboost_test_k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new_1780261586400_yzxvf5iyq`
    - studyDay: 1 | type: new | score: 0% | passed: false | nwei: 79
- **Duplicate this run:** NO

### 5. class_progress CSD
- **Before:** 0 → **After:** 0
- **Advanced:** NO

### 6. Orphan Docs
NONE

---

## Classification

**COMPLETED_NOPASS**

Day 1 test completed. Score < 92%. Expected for SPEEDRUNNER (answers "test" = wrong). CSD correctly held at 0. CORRECT behavior.

---

## Console Errors

None.

---

## Final Page State
- URL: https://vocaboostone.netlify.app/typedtest/k8tzOiiwotBbtJS3uTiv/8RMews2H7C3UJUAsOBzR
- Headings: ["Did not pass","Answers"]
- Body: Step 2 of 3

New Words Test — Day 1

Did not pass

Your score is below 92%

0%

0 of 30 correct

Try Again
Go to Dashboard
Answers
1
forensic
✗

Correct Answer

related to or used in courts of law

Your Answer

test

Challenge
2
revamp
✗

Correct Answer

to revise; to renovate

Your Answer

test

Challenge
3
agog (old English)
✗

Correct Answer

very eager or curious to hear or see something.

Your Answer

test

Challenge
4
redolent
✗

Correct Answer

strongly reminiscent or suggestive of someth

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | audit_speedrunner_01_top@vocaboost.test |
| Reached new-word test? | y |
| Classification | COMPLETED_NOPASS |
| B2 strand error seen? | n |
| New-word slice correct? | y |
| CSD before→after | 0 → 0 |
| Duplicate attempts (this run)? | n |
| Console errors | none |
| Orphan docs | NONE |
| Overall Day-1 OK? | y |
