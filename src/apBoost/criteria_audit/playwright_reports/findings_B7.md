# Batch B7 Findings: Teacher Dashboard & Gradebook (Re-Run)

**Agent:** Sonnet 4.6
**Date:** 2026-03-09
**Status:** COMPLETE
**Scenarios Covered:** T-01, T-02, T-03, T-04
**Re-Run:** Yes — verifying fixes for B7-001 through B7-005 and B0-001

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900 desktop
- **Auth:** teacher@apboost.test (Teacher), student@apboost.test (Student — fresh browser context for T-02)

---

## Fix Verification Summary

| Previous Finding | Description | Status |
|-----------------|-------------|--------|
| B7-001 | Student column showed email instead of display name | FIXED |
| B7-002 | Test column showed raw ID instead of title | FIXED |
| B7-003 | Test filter dropdown empty (no test options) | FIXED |
| B7-004 | Status "All" filter caused Firestore index error | FIXED |
| B7-005 | Quick action icons were plain ASCII letters | FIXED |
| B0-001 | Pending grading undercount on teacher dashboard | FIXED |

---

## Scenario Results

### T-01: Teacher Dashboard Load
- **Status:** PASS
- **Evidence:** H1 "Teacher Dashboard" present. All 4 quick action buttons render with correct hrefs and proper SVG icons (verified via DOM: each `<a>` contains an `<svg>` element). "My Tests (3)" section shows all 3 seeded tests with "15 MCQ, 2 FRQ" counts and Edit/Assign buttons. "Pending Grading (3)" matches gradebook's default Pending filter count (3). "My Classes (2)" with 5 students each is visible. "Go to Gradebook" link present.
- **Notes:** B7-005 FIXED — All quick action icons confirmed as proper SVGs. B0-001 status confirmed — dashboard shows Pending Grading (3), gradebook shows 3 pending. These now match. Pending count difference from original B0 finding (7 vs 2) was because seed data uses `Math.random()` to assign grading status — the count varies each seed run. Current seed produced 3 pending.

### T-02: Teacher Route Protection
- **Status:** PASS
- **Evidence:** Student account logs in successfully. All 3 teacher routes (`/ap/teacher`, `/ap/teacher/test/new`, `/ap/gradebook`) redirect to `/ap` (AP student dashboard). Student page text confirms they land on "AP Practice Tests" dashboard with test cards.
- **Notes:** Protection verified across all required teacher routes.

### T-03: Gradebook - View Pending Submissions
- **Status:** PASS
- **Evidence:** Gradebook loads with correct heading "Gradebook", subtitle "Review and grade student FRQ submissions". All 3 filter dropdowns present and populated. Default Status=Pending shows 3 submissions. Student column correctly shows "Maria Garcia", "Alex Johnson", "Ethan Williams" (display names, NOT emails). Test column correctly shows "AP Calculus AB Practice Exam", "AP Microeconomics Practice Exam" (titles, NOT IDs). Grade button (brand primary) present in each row. "Showing 3 submissions" count correct.
- **Notes:** B7-001 FIXED (display names). B7-002 FIXED (test titles). B7-003 FIXED (test filter populated). Table rows confirmed: `Maria Garcia  AP Calculus AB Practice Exam  2026. 3. 7.  Pending  Grade`.

### T-04: Gradebook - Filter by Test and Status
- **Status:** PARTIAL
- **Evidence:** Status=All successfully shows 13 rows with Complete status visible — B7-004 FIXED. Test filter shows all 3 test names — B7-003 FIXED. Selecting "AP Microeconomics Practice Exam" test filter returns 5 rows. Resetting to defaults restores 3 rows. **However:** Class filter returns 0 rows for both classes (AP Calculus AB Period 3 and AP Economics Period 1) when combined with Status=All. Console logs a Firestore index error for the class-filtered query.
- **Notes:** The class filter failure is a **new remaining issue** (or pre-existing issue now exposed). See FINDING-B7-006.

---

## Findings

### Blockers
> No blockers found.

---

### High-Priority

#### [FINDING-B7-006]: Class Filter Always Returns Zero Results — Missing Composite Firestore Indexes and classId Field in Results
- **Severity:** High-Priority
- **Scenario:** T-04
- **Criteria Reference:** 11.3 (gradebook filters — Class dropdown), 11.4 (real-time gradebook)
- **What Happened:** When any class is selected in the "Class:" filter on the gradebook (e.g., "AP Calculus AB Period 3"), the table shows 0 results for both classes regardless of status filter. The console logs:
  ```
  [APBoost:APGradebook.onSnapshot] {function: APGradebook.onSnapshot, context: Object, type: unknown, message: The query requires an index. You can create it here: https://console.firebase.google.com/...zdElkEAEaDwoLY29tcGxldGVkQXQQAhoMCghfX25hbWVfXxAC, code: failed-precondition}
  ```
  This occurs because the `where('classId', '==', classFilter)` + `orderBy('completedAt', 'desc')` query requires a composite index on `ap_test_results` for `teacherId + classId + completedAt`, which does not exist in `firestore.indexes.json`. Additionally, even if the index were added, the seed result documents do NOT contain a `classId` field (the seed `setDoc` calls in `seedFullData.js` lines 1090–1120 do not set `classId`), so the filter would still return 0 results for seed data.
- **Expected:** Selecting "AP Calculus AB Period 3" should filter results to show only test results from students in that class. "AP Economics Period 1" should show Micro and Macro results from those students.
- **Screenshot/Evidence:** `b7_t04_class_calc_filter.png` — table shows "No submissions found matching your filters." Console error present. Verified both `class_calc_p3` and `class_econ_p1` return 0 rows.
- **File(s) to Fix:**
  - `firestore.indexes.json`
  - `src/apBoost/utils/seedFullData.js`
- **How to Fix:**

  **Part 1 — Add composite indexes to `firestore.indexes.json`:**
  Add the following index entries in the `"indexes"` array. These cover class filter alone and class filter combined with test filter:
  ```json
  {
    "collectionGroup": "ap_test_results",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "teacherId", "order": "ASCENDING" },
      { "fieldPath": "classId", "order": "ASCENDING" },
      { "fieldPath": "completedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "ap_test_results",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "teacherId", "order": "ASCENDING" },
      { "fieldPath": "classId", "order": "ASCENDING" },
      { "fieldPath": "gradingStatus", "order": "ASCENDING" },
      { "fieldPath": "completedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "ap_test_results",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "teacherId", "order": "ASCENDING" },
      { "fieldPath": "testId", "order": "ASCENDING" },
      { "fieldPath": "classId", "order": "ASCENDING" },
      { "fieldPath": "completedAt", "order": "DESCENDING" }
    ]
  }
  ```
  Then deploy: `firebase deploy --only firestore:indexes`

  **Part 2 — Add `classId` to seed result documents in `seedFullData.js`:**
  In `seedFullData.js`, the `setDoc` calls for test results (lines 1090–1120) need a `classId` field. For Micro and Macro results, students belong to `class_econ_p1`. For Calc results, students belong to `class_calc_p3`:
  ```js
  // Micro result (class_econ_p1)
  await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, `result_micro_student${studentNum}`), {
    ...microResult,
    teacherId: actualTeacherId,
    studentName: student.displayName,
    studentEmail: student.email,
    testTitle: 'AP Microeconomics Practice Exam',
    classId: 'class_econ_p1',  // ADD THIS
  })

  // Macro result (class_econ_p1)
  await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, `result_macro_student${studentNum}`), {
    ...macroResult,
    teacherId: actualTeacherId,
    studentName: student.displayName,
    studentEmail: student.email,
    testTitle: 'AP Macroeconomics Practice Exam',
    classId: 'class_econ_p1',  // ADD THIS
  })

  // Calc result (class_calc_p3)
  await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, `result_calc_student${studentNum}`), {
    ...calcResult,
    teacherId: actualTeacherId,
    studentName: student.displayName,
    studentEmail: student.email,
    testTitle: 'AP Calculus AB Practice Exam',
    classId: 'class_calc_p3',  // ADD THIS
  })
  ```
- **Acceptance Test:**
  1. Add the 3 composite indexes to `firestore.indexes.json` and deploy.
  2. Re-seed data (click "Seed Full Test Data" in teacher dashboard developer tools).
  3. Navigate to `/ap/gradebook`.
  4. Change Status to "All". Verify 13 rows appear.
  5. Select "Class: AP Calculus AB Period 3". Verify only Calc AB results appear (4 rows: result_calc_student1 through result_calc_student3 plus possibly a 4th).
  6. Select "Class: AP Economics Period 1". Verify Micro and Macro results appear (10 rows: 5 Micro + 5 Macro).
  7. No Firestore index errors in console.

---

### Medium-Priority

> None identified in this re-run.

---

### Nitpicks

- **Nit:** The "Submitted" column in the gradebook shows dates in a locale-specific format: `2026. 3. 7.` (periods after year, month, day — Korean/East-Asian locale convention). This varies by end-user OS locale. Consider using an explicit locale format such as `new Date(result.completedAt.toDate()).toLocaleDateString('en-US')` or a fixed format like `{ month: 'short', day: 'numeric', year: 'numeric' }` in `APGradebook.jsx` line 73 (`GradebookRow` component's `completedDate` calculation).

- **Nit:** The "Pending Grading (X)" count on the teacher dashboard varies each time data is re-seeded because `seedFullData.js` line 846 uses `Math.random() > 0.3` to assign `gradingStatus`. This makes the count non-deterministic across seed runs. Consider using a fixed distribution in seed data for consistency during testing (e.g., hardcode specific students as PENDING and others as COMPLETE rather than random).

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| `/ap/gradebook` (Class filter active) | `[APBoost:APGradebook.onSnapshot] ... The query requires an index ... code: failed-precondition` | error |
| `/ap/gradebook` (Class filter active) | Same error fires twice (once per filter update) | error |

No errors on the teacher dashboard (`/ap/teacher`) or with Status/Test filters alone.

---

## Fix Verification Detail

### B7-001: Student Display Name — VERIFIED FIXED
- Previous state: Student column showed `maria.g@school.edu`
- Current state: Student column shows `Maria Garcia`, `Alex Johnson`, `Ethan Williams`
- Verification: Confirmed via row text extraction in audit script. No email addresses found.

### B7-002: Test Title — VERIFIED FIXED
- Previous state: Test column showed `test_calc_ab_full_1`
- Current state: Test column shows `AP Calculus AB Practice Exam`
- Verification: `testColumnShowsId: false`, `testColumnShowsTitle: true`

### B7-003: Test Filter Options — VERIFIED FIXED
- Previous state: Only "All Tests" in dropdown
- Current state: Options: "All Tests", "AP Calculus AB Practice Exam", "AP Macroeconomics Practice Exam", "AP Microeconomics Practice Exam"
- Verification: Selecting Micro filter returns 5 rows (correct).

### B7-004: Status All Filter — VERIFIED FIXED
- Previous state: Firestore index error, 0 rows on Status=All
- Current state: Status=All returns 13 rows with Complete/Pending badges visible
- Verification: `allStatusRowCount: 13`, `allStatusHasComplete: true`, no index error for this query

### B7-005: Quick Action SVG Icons — VERIFIED FIXED
- Previous state: Plain ASCII characters ("Q", "G", "C", "+")
- Current state: All 4 quick action links contain proper `<svg>` elements (Heroicons)
- Verification: DOM inspection confirmed `hasSvg: true` for all 4 target hrefs. SVG outerHTML contains proper viewBox attributes.

### B0-001: Pending Grading Count — VERIFIED FIXED
- Previous state: Dashboard showed 2, gradebook showed 7 (mismatch)
- Current state: Dashboard shows 3, gradebook shows 3 (match)
- Verification: `dashboardPendingCount === gradebookPendingRows` is `true`. Count differs from original B0 audit (7) because re-seed produces random status distribution.

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 4 |
| PASS | 3 |
| FAIL | 0 |
| PARTIAL | 1 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 1 |
| Medium-Priority Found | 0 |
| Nitpicks | 2 |

### Key Observations

1. **All 5 previous B7 findings confirmed fixed.** B7-001 through B7-005 are all resolved and verified via live application testing.

2. **B0-001 confirmed fixed.** Dashboard pending count now matches gradebook pending count.

3. **One new High-Priority finding identified (B7-006):** The class filter in the gradebook is entirely non-functional — both because Firestore composite indexes are missing for `classId` queries and because seed result documents do not contain a `classId` field. This was previously masked by the B7-004 issue (Status=All was broken, so class filter was never successfully tested). Now that Status=All works, the class filter failure is exposed.

4. **T-04 remains PARTIAL** due to B7-006. All other filter combinations (Status + Test) work correctly.
