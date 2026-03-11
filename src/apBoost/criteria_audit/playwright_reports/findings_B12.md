# Batch B12 Findings: Data Correctness

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE
**Scenarios Covered:** B12 Data Correctness (full flow: student takes test, score verified, teacher verifies gradebook/analytics/profile)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900 (desktop)
- **Auth:** student@apboost.test (student phase), teacher@apboost.test (teacher phase)
- **Test Used:** AP Microeconomics Practice Exam (test_micro_full_1)
- **Result ID Generated:** 3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_5

---

## What Was Tested

1. Student logs in, navigates to Micro test, answers all 15 MCQ + 7 FRQ sub-questions, submits test
2. Report card is inspected for correct score display, per-question indicators, AP score, section subtotals
3. Teacher logs in, checks gradebook for the student's result
4. Teacher navigates to analytics for Micro test, checks class average, question difficulty, student list
5. Teacher views the student's result directly via `/ap/results/<id>`

### Answer Key Discovered During Test
Based on report card data, the MCQ answer key for test_micro_full_1 is:
Q1=B, Q2=B, Q3=B, Q4=A, Q5=A, Q6=B, Q7=B, Q8=B, Q9=B, Q10=B, Q11=B, Q12=A, Q13=A, Q14=B, Q15=B

Answers selected: Q1-Q10=A, Q11-Q15=B
Result: Q4, Q5, Q11, Q14, Q15 correct = **5/15 (33%)**

This confirms the scoring engine calculated 5 correct answers accurately. The data correctness audit reveals the score math is correct, but several critical data plumbing issues exist.

---

## Scenario Results

### B12-S1: MCQ Score Calculation
- **Status:** PASS
- **Evidence:** Report card shows "5/15 (33%)" in MCQ Summary. Per-question table shows correct answer (B column) vs student answer (A column) with correct/incorrect result column. All 15 rows present with accurate data.
- **Notes:** The scoring engine calculates correctly. Q4 correct=A/student=A, Q5 correct=A/student=A, Q11 correct=B/student=B, Q14 correct=B/student=B, Q15 correct=B/student=B all marked correct. All others marked incorrect. Math is exact.

### B12-S2: AP Score Projection
- **Status:** PASS (for pending state) / HIGH ISSUE (see B12-001)
- **Evidence:** AP Score shows "⏳ Pending" since FRQ is awaiting grading. This is correct behavior. The pre-FRQ MCQ-only score of 33% maps to AP 1 per DEFAULT_SCORE_RANGES (ap1.min=0, max=34).
- **Notes:** AP score projection while FRQ pending is correctly deferred (shows Pending badge, not a number).

### B12-S3: Per-Question Result Indicators
- **Status:** PASS
- **Evidence:** MCQ table has 16 rows (header + 15 data rows). Each row shows Q#, Domain, Topic, Correct Answer, Your Answer, and Result (✓ or ✗). Correct answers display letter "B" for most questions, "A" for Q4/Q5. Result column shows checkmark for Q4, Q5, Q11, Q14, Q15 and X for all others.

### B12-S4: Section Subtotals
- **Status:** PASS
- **Evidence:** Report card shows:
  - Section 1 (MCQ): 5/15 (33%)
  - Free Response: --/18 (pending)
  - Total: Pending FRQ grading
- **Notes:** The FRQ max points correctly calculated as 18 (via frqMaxPoints field).

### B12-S5: Performance by Domain
- **Status:** PASS
- **Evidence:** Domain breakdown shows:
  - Unit 1: Basic Economic Concepts: 0/2 (0%)
  - Unit 2: Supply and Demand: 2/3 (67%)
  - Unit 3: Production & Cost: 0/3 (0%)
  - Unit 4: Imperfect Competition: 1/3 (33%)
  - Unit 5: Factor Markets: 0/2 (0%)
  - Unit 6: Market Failure: 2/2 (100%)
- **Notes:** Domain performance calculates correctly based on mcqResults.questionDomain data.

### B12-S6: Gradebook Shows Student Result
- **Status:** FAIL — see B12-002 (Blocker)
- **Evidence:** Gradebook (filtered to Pending) shows only pre-existing seeded results. The new result from this audit run (3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_5) does NOT appear in the gradebook at all. Only an old Calc AB result for Alex Johnson appears (from seeded data with teacherId set).
- **Notes:** The gradebook queries `where('teacherId', '==', user.uid)` but createTestResult never writes a teacherId to the result document.

### B12-S7: Analytics Shows Updated Data
- **Status:** PARTIAL — see B12-003 (High)
- **Evidence:** Analytics student results table does show our new result (Alex Johnson, student@apboost.test, 5/15, 33%, AP Score 1). Analytics correctly includes all 16 results. Class average, question difficulty percentages, and AP distribution all appear.
- **Notes:** The analytics shows all attempts by all users including 4 prior attempts by the same student account and the teacher's own attempt. No deduplication or "latest attempt" view exists.

### B12-S8: Teacher View of Report Card Shows Correct Student Name
- **Status:** FAIL — see B12-004 (High)
- **Evidence:** When teacher navigates to `/ap/results/<student_result_id>`, the report card header shows "Student: Ms. Thompson" (the teacher's name) instead of "Student: Alex Johnson" (the actual student). This makes teacher review of student results misleading.

### B12-S9: Student Profile
- **Status:** SKIP — Analytics does not link to `/ap/teacher/student/:userId` profiles from the student results table rows. The analytics StudentResultsTable has no clickable student profile links visible. The gradebook Grade button only leads to the grading panel, not a profile view.
- **Notes:** The `handleStudentClick` function in APExamAnalytics.jsx exists (line 196) but is not wired to the StudentResultsTable rows rendering in the UI.

---

## Findings

### Blockers

#### [FINDING-B12-001]: Results missing teacherId — never appear in gradebook
- **Severity:** Blocker
- **Scenario:** B12-S6
- **Criteria Reference:** B12 Data Correctness — Gradebook shows correct score for student
- **What Happened:** After student submits the Micro test, the result document (ID: `3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_5`) is created in `ap_test_results` without a `teacherId` field. The gradebook (`APGradebook.jsx`) loads results via `getPendingGrades(teacherId)` in `apGradingService.js` which queries `where('teacherId', '==', teacherId)`. Without `teacherId` on the result, the result is invisible to every teacher's gradebook.
- **Expected:** The new Micro test result should appear in the gradebook of the teacher who owns the test (the teacher whose UID matches `test.createdBy`).
- **Screenshot/Evidence:** Screenshot `11_gradebook.png` — gradebook shows 3 pending items total, only the seeded Calc AB result for Alex Johnson. The newly created Micro result is absent.
- **File(s) to Fix:** `src/apBoost/services/apScoringService.js`
- **How to Fix:**
  In `createTestResult` (line 117), after loading the test (line 126), extract the test's `createdBy` field and set it as `teacherId` on the result document.

  Specifically, after line 129 where `test` is loaded:
  ```js
  // Get teacherId from test.createdBy
  const teacherId = test.createdBy || null
  ```

  Then in `resultData` (around line 225), add:
  ```js
  teacherId,  // Set from test.createdBy so gradebook can filter
  ```

  This ensures all results reference the teacher who created the test, enabling the gradebook `where('teacherId', '==', teacherId)` query to find them.

  Note: The `test` object is already loaded via `getTestWithQuestions(session.testId)` — check that `getTestWithQuestions` returns the `createdBy` field. If not, also update `getTestWithQuestions` in `apTestService.js` to include `createdBy` in the returned test data.

- **Acceptance Test:**
  1. Login as `student@apboost.test`, navigate to `/ap/test/test_micro_full_1`, complete and submit the test.
  2. Login as `teacher@apboost.test`, navigate to `/ap/gradebook`.
  3. The new Micro test result should appear in the Pending section with the student's name and score.

---

### High-Priority

#### [FINDING-B12-002]: Report card "Student:" shows logged-in user's name, not the test-taker's name
- **Severity:** High-Priority
- **Scenario:** B12-S8
- **Criteria Reference:** B12 Data Correctness — Student profile shows correct data; teacher grading workflow
- **What Happened:** When a teacher (Ms. Thompson) navigates to a student's report card at `/ap/results/3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_5`, the report header displays "Student: Ms. Thompson" — the teacher's own display name — instead of "Student: Alex Johnson" (the actual student who took the test). This means every teacher who views any student's report card sees their own name as the "Student".
- **Expected:** The "Student:" field should display the name of the user who took the test (i.e., look up the `result.userId` in the `users` collection).
- **Screenshot/Evidence:** Screenshot `14_teacher_report.png` — body text shows "Student: Ms. Thompson\n\nTest: AP Microeconomics Practice Exam". The result ID encodes the student's UID but the displayed name uses `useAuth().user.displayName`.
- **File(s) to Fix:** `src/apBoost/pages/APReportCard.jsx`
- **How to Fix:**
  In `APReportCard.jsx`, the relevant code is on line 470:
  ```jsx
  <p>Student: {user?.displayName || user?.email || 'Student'}</p>
  ```
  This uses `useAuth()` to get the currently logged-in user, which is wrong when a teacher views a student's result.

  Fix: Load the student's profile from Firestore using `result.userId`. The result document is already loaded in the component (stored in state as `result`). Add a `studentInfo` state that fetches the user profile:

  1. Add state: `const [studentInfo, setStudentInfo] = useState(null)`
  2. In the `useEffect` that loads the result (around line 40), after loading `result`, add:
     ```js
     if (result.userId && result.userId !== user?.uid) {
       // Fetch student's display name for teacher view
       const userDoc = await getDoc(doc(db, 'users', result.userId))
       if (userDoc.exists()) {
         setStudentInfo(userDoc.data())
       }
     } else {
       setStudentInfo(user)  // student viewing their own result
     }
     ```
  3. Change line 470 to:
     ```jsx
     <p>Student: {studentInfo?.displayName || studentInfo?.email || user?.displayName || 'Student'}</p>
     ```

- **Acceptance Test:**
  1. Login as `student@apboost.test`, take the Micro test, submit, note the result URL.
  2. Login as `teacher@apboost.test`, navigate to that result URL directly.
  3. Verify the report card header shows "Student: Alex Johnson" (or the student's actual display name), NOT "Ms. Thompson".

---

#### [FINDING-B12-003]: Analytics student results table missing student profile navigation
- **Severity:** High-Priority
- **Scenario:** B12-S9
- **Criteria Reference:** B12 Data Correctness — Student profile shows correct data
- **What Happened:** The analytics page (`/ap/teacher/analytics/test_micro_full_1`) shows a "Student Results" table with 16 entries. The table renders student names and scores, but clicking on any student name does not navigate to the student profile at `/ap/teacher/student/:userId`. The `handleStudentClick(userId)` function exists in `APExamAnalytics.jsx` (line 196: `navigate('/ap/teacher/student/${userId}')`) but is not passed to or called from `StudentResultsTable`.
- **Expected:** Clicking a student's name in the analytics table should navigate to `/ap/teacher/student/:userId` (the `APStudentProfile` page) showing that student's test history.
- **Screenshot/Evidence:** Screenshot `12_analytics_scroll.png` — student results table visible, no clickable link on student names. No profile links found by `page.evaluate` selector search.
- **File(s) to Fix:** `src/apBoost/components/analytics/StudentResultsTable.jsx`, `src/apBoost/pages/APExamAnalytics.jsx`
- **How to Fix:**
  In `APExamAnalytics.jsx`, find where `StudentResultsTable` is rendered (around line 283) and pass `onStudentClick={handleStudentClick}` as a prop:
  ```jsx
  <StudentResultsTable
    results={studentResults}
    onStudentClick={handleStudentClick}
    ...
  />
  ```
  In `StudentResultsTable.jsx`, accept the `onStudentClick` prop and attach it to student name cells:
  ```jsx
  // In the name cell:
  <button
    onClick={() => onStudentClick && onStudentClick(result.userId)}
    className="text-brand-primary hover:underline text-left"
  >
    {result.studentName}
  </button>
  ```

- **Acceptance Test:**
  1. Login as `teacher@apboost.test`, navigate to `/ap/teacher/analytics/test_micro_full_1`.
  2. Click on any student name in the "Student Results" table.
  3. Should navigate to `/ap/teacher/student/<userId>` showing the APStudentProfile page with that student's test history.

---

#### [FINDING-B12-004]: Gradebook student name lookup uses wrong field (studentId vs userId)
- **Severity:** High-Priority
- **Scenario:** B12-S6
- **Criteria Reference:** B12 Data Correctness — Gradebook shows correct student data
- **What Happened:** In `apGradingService.js`, `getPendingGrades()` attempts to look up the student's name using `data.studentId` (line 84: `if (data.studentId)`). However, `createTestResult` in `apScoringService.js` stores the user identifier as `userId` (not `studentId`). As a result, the student name lookup always falls back to "Unknown Student" for any result created via `createTestResult`.
- **Expected:** The gradebook should display the actual student name next to each pending result.
- **Screenshot/Evidence:** Screenshot `11_gradebook.png` — the seeded result for Alex Johnson does show the name "Alex Johnson" because seeded results have `studentId` set. However, any result created by the live application (via `createTestResult`) uses `userId` and would show "Unknown Student".
- **File(s) to Fix:** `src/apBoost/services/apGradingService.js`
- **How to Fix:**
  In `getPendingGrades()` (line 84), change `data.studentId` to `data.userId`:
  ```js
  // Before:
  if (data.studentId) {
    const userDoc = await getDoc(doc(db, 'users', data.studentId))

  // After:
  if (data.userId) {
    const userDoc = await getDoc(doc(db, 'users', data.userId))
  ```

- **Acceptance Test:**
  1. Login as `student@apboost.test`, complete the Micro test (after B12-001 fix ensures `teacherId` is saved).
  2. Login as `teacher@apboost.test`, navigate to `/ap/gradebook`.
  3. The student's result should appear with student name "Alex Johnson", not "Unknown Student".

---

### Medium-Priority

#### [FINDING-B12-005]: Analytics shows all attempts (no deduplication) — class average inflated
- **Severity:** Medium-Priority
- **Scenario:** B12-S7
- **Criteria Reference:** B12 Data Correctness — Analytics show correct data
- **What Happened:** The analytics page shows 16 entries in the "Student Results" table for a test that has 5 seed students plus 2 real accounts. Alex Johnson (student@apboost.test) appears 5 times (4 with 6/15 and 1 with 5/15), Ms. Thompson (teacher) appears once, and seed students appear multiple times with 2 attempts each. The class average (59%) and question difficulty percentages are computed across ALL attempts including duplicates, inflating the sample size and potentially skewing difficulty metrics.
- **Expected:** Analytics should either show only the most recent attempt per student, or provide a toggle between "All Attempts" and "Best/Latest Attempt" views. The class average should be computed from unique students (or latest attempt per student).
- **Suggested Fix:** In `apAnalyticsService.js`, `getStudentResults()` and `calculateSummaryStats()`, add an optional `deduplication` parameter (default: `'latest'`). When set to `'latest'`, filter results to keep only the highest `attemptNumber` per `userId` before computing stats:
  ```js
  // After filtering results by classIds/studentIds, deduplicate:
  if (deduplication === 'latest') {
    const latestByUser = {}
    for (const r of results) {
      const existing = latestByUser[r.userId]
      if (!existing || r.attemptNumber > existing.attemptNumber) {
        latestByUser[r.userId] = r
      }
    }
    results = Object.values(latestByUser)
  }
  ```
  The StudentResultsTable should still show all attempts with attempt numbers, but aggregate stats (average, AP distribution, question difficulty %) should use only the latest attempt.

---

#### [FINDING-B12-006]: APHeader has no logout button — student cannot log out from AP pages
- **Severity:** Medium-Priority
- **Scenario:** B12 (logistics)
- **Criteria Reference:** General UX / Authentication flow
- **What Happened:** `APHeader.jsx` displays only "AP Practice" (link to /ap), the user's display name, and a "VocaBoost" link (link to /). There is no Logout button. The only way to log out from AP pages is to navigate to the VocaBoost main page and use the HeaderBar logout. Navigating to `/login` while authenticated redirects to the VocaBoost dashboard instead of showing the login form.
- **Expected:** APHeader should include a logout button so students and teachers can log out directly from AP pages without needing to navigate to VocaBoost first.
- **Suggested Fix:** In `APHeader.jsx` (line 8), add a logout button using the `logout` function from `useAuth()`:
  ```jsx
  const { user, logout } = useAuth()
  // In the user info div (around line 29):
  <button
    onClick={logout}
    className="text-text-muted text-sm hover:text-text-secondary transition-colors"
  >
    Log out
  </button>
  ```

---

#### [FINDING-B12-007]: Analytics class average uses raw number (pts) not percentage — misleading display
- **Severity:** Medium-Priority
- **Scenario:** B12-S7
- **Criteria Reference:** B12 Data Correctness — Analytics show correct data
- **What Happened:** The analytics summary card shows "Average Score: 59% / 17 pts". The "17 pts" refers to the average raw MCQ points, not the percentage equivalent. This combination display is confusing because 17/15 would exceed 100%, and the relationship between "17 pts" and "59%" is not obvious (17 pts from MCQ + avg FRQ pts normalized to percentage).
- **Expected:** The analytics should clearly label what the numbers represent. If FRQ points are included in the "17 pts" figure, the denominator should also be shown (e.g., "17/26 avg pts") so teachers can understand the calculation.
- **Suggested Fix:** In `apAnalyticsService.js`, `calculateSummaryStats()`, ensure the points figure has context. In `APExamAnalytics.jsx`, update the display to show `X/Y avg pts` where Y is the maximum possible score, or split MCQ and FRQ average scores into separate labeled stats.

---

### Nitpicks

- **Nit:** The analytics FRQ performance section shows "0 students graded" for both FRQ questions even though seeded results (alex.j@school.edu, ethan.w@school.edu, etc.) have FRQ scores. The FRQ performance calculation may not be counting graded seeded results correctly.

- **Nit:** In the report card PDF header, the "Student:" field will also show the wrong name (teacher's name) when teacher downloads the PDF, compounding finding B12-002.

- **Nit:** The gradebook default filter is set to "Pending" status. When a result is never added to the gradebook (due to B12-001), teachers have no indication that gradeable submissions exist. An "unassigned submissions" or notification system would help.

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| No console errors were captured during this audit run. | — | — |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 9 |
| PASS | 4 (MCQ scoring, AP projection pending state, per-question indicators, section subtotals + domain breakdown) |
| FAIL | 2 (gradebook missing result, report card wrong student name) |
| PARTIAL | 1 (analytics shows result but without profile navigation) |
| SKIP | 1 (student profile — no navigation path found) |
| Blockers Found | 1 (B12-001: no teacherId on results → invisible to gradebook) |
| High-Priority Found | 3 (B12-002: wrong student name on report card; B12-003: no student profile nav; B12-004: wrong field name for student lookup) |
| Medium-Priority Found | 3 (B12-005: duplicate attempts in analytics; B12-006: no logout in APHeader; B12-007: average score display confusing) |
| Nitpicks | 3 |

### Key Data Correctness Verdict

**Score calculation (MCQ math): CORRECT.** The scoring engine accurately counts correct/incorrect answers, calculates percentages, and records domain breakdown. The report card displays all computed values accurately.

**Data plumbing (routing results to teacher): BROKEN.** Due to missing `teacherId` on result documents, results from non-assigned tests never surface in the teacher's gradebook. This is the single most critical data correctness gap found in B12.

**Report card student identity: WRONG.** A teacher viewing a student's report card sees their own name as "Student:", which is a significant data correctness failure for the teacher workflow.
