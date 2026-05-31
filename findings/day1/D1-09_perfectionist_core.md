# D1-09 Perfectionist CORE — Day-1 Completion Test

**Label:** D1-09
**Account:** audit_perfectionist_01_core@vocaboost.test
**Class:** CORE (LVjBTFuYE8FbPG34pVAt) — "25WT 2차 CORE OFFLINE"
**List:** aRGjnGXdU4aupiS8SlXR — "25WT2 CORE Vocabulary (v2)"
**Student UID:** pGqG1GT5Y3ZU5WT7e0smwqWQWdb2
**Executed:** 2026-05-31T20:58:17Z (successful run timestamp)
**Bundle:** index-CflgDyCK.js (prod — https://vocaboostone.netlify.app)

---

## Classification: COMPLETED_PASS

---

## Status Block

| Field | Value |
|-------|-------|
| Account | audit_perfectionist_01_core@vocaboost.test |
| CORE testMode | **typed** |
| Reached test? | **YES** |
| Classification | **COMPLETED_PASS** |
| B2 strand (Unsupported field value: undefined)? | **NONE** |
| Final-answer integrity under edit churn (correct?) | **YES** — stored `studentResponse` == final typed value; edit churn did NOT corrupt |
| New-word slice correct? | **YES** — newWordStartIndex=0, newWordEndIndex=59, wordsIntroduced=60 (== pace) |
| CSD before → after | **0 → 1** (users/{uid}/class_progress/{classId}_{listId}.currentStudyDay) |
| Console errors | **NONE** |
| Orphan docs | **NONE** |
| Day-1 OK? | **YES** |

---

## Details

### CORE Config (from Firestore classes.assignments)
- Pace: **60** words/day
- testMode: **typed**
- testSizeNew: **25**
- passThreshold: **90%**
- reviewTestType: mcq

### Session Flow (observed end-to-end)

1. **Login** → dashboard shows "Start Today's Session" button ✓
2. **H2 guard** → dashboard shows Day 1 session only (Day 2 not accessible) ✓
3. **Session start** → navigates to `/session/LVjBTFuYE8FbPG34pVAt/aRGjnGXdU4aupiS8SlXR` ✓
4. **Flashcard modal** → "Customize Your Flashcards" setup modal appears; dismissed via "Start Studying" button ✓
5. **Study phase** (Step 1 of 3) → 60 flashcards, all pre-mastered "60 of 60 mastered"; clicked "I know this word (C)" for each ✓
6. **Completion modal** → after all 60 cards marked, "All Mastered" modal appeared with "Keep Studying" and "Start Test" buttons; clicked "Start Test" ✓
7. **Test phase** (Step 2 of 3) → "New Words Test — Day 1", 25 questions in LIST FORMAT (all shown simultaneously), one "Submit Test" button ✓
8. **Churn test** on Q1 (word: "malady") → heavy edit churn applied; final typed value correctly stored ✓
9. **Submit** → "Submit Test" clicked; grading completed in ~9s ✓
10. **Results** → "Completed Day 1 session", 100%, 25/25 correct ✓

### Edit Churn Test (Audit Issue #10)
- **Q1 word:** malady
- **Correct answer:** "a disease or illness"
- **Churn sequence:** Type full text → Backspace 14 chars → Retype erased portion → Type "abc" → Backspace 3
- **Final typed value in input:** `correct answer for this word`
- **Final stored `studentResponse`:** `correct answer for this word`
- **Match:** YES ✓ — edit churn did NOT corrupt the stored answer
- **AI graded:** isCorrect=true (AI accepted fallback text — grading permissiveness noted, out of scope for audit item #10)

### Firestore State

| Collection | Field | Before | After |
|-----------|-------|--------|-------|
| users/{uid}/class_progress/{cid}_{lid} | currentStudyDay | 0 | **1** |
| users/{uid}/class_progress/{cid}_{lid} | totalWordsIntroduced | 0 | **60** |
| attempts | count for this student | 2 | **3** (+1 for D1-09 run) |
| users/{uid}/study_states | count | 0 | **60** |
| users/{uid}/sessions | day 1 session | absent | present (wordsIntroduced=60, wordsTested=25) |

### New-Word Slice Verification
- **Pace:** 60
- **newWordStartIndex:** 0
- **newWordEndIndex:** 59
- **words[0..59]** studied and tested ✓
- **wordsIntroduced=60** in session doc ✓
- Slice is correct: Day-1 introduces indices 0-59 (first 60 words of the list)

### CSD Advancement
- Stored in: `users/{uid}/class_progress/{classId}_{listId}.currentStudyDay`
- system_log type=`csd_twi_reconciled` confirmed: stored={csd:0,twi:0} → applied={csd:1,twi:60}
- CSD advanced from 0 to **1** ✓

### Attempt Details
- Attempt ID: `pGqG1GT5Y3ZU5WT7e0smwqWQWdb2_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780261165859_odizkn6an`
- score: 100 (100%), totalQuestions: 25
- passed: true
- studyDay: 1, isFirstDay: true
- All 25 answers graded isCorrect: true

### Orphan Docs
NONE — no docs in sessions_draft, pending_sessions, or draft_attempts collections for this student.

### Console Errors
NONE — no JavaScript errors observed during the session.

---

## Notes

- **CSD storage location:** `users/{uid}/class_progress/{classId}_{listId}` subcollection (NOT the top-level `class_progress` collection, which is empty in this database)
- **Word storage location:** `lists/{listId}/words` subcollection (NOT as a `words` field in the list document)
- **streakDays=0** and `lastStudyDate=null` on class_progress after completion — streak tracking did not increment. Not blocking.
- **2 prior failed attempts** existed before D1-09 run (from debugging runs, studyDay=1, passed=false, score=0). The D1-09 run added +1 (passed=true). Total=3 for studyDay=1.
- **Flashcard phase behavior:** When all 60 words are pre-mastered, the "All Mastered" modal appears after all cards are cycled through, providing the "Start Test" CTA.
- **Test format:** LIST (all 25 questions on one page with individual inputs + one "Submit Test" button). NOT sequential one-at-a-time format.

---

*Generated by D1-09 audit agent. Evidence screenshots: /app/findings/evidence/D1-09/*
*Logs: /app/findings/agent_logs/D1-09.jsonl*
