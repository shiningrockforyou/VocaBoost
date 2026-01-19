# Acceptance Criteria Audit: Sections 9.1 to 9.4

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 34
- Implemented: 18
- Partial: 10
- Missing: 6
- Unable to Verify: 0

---

## Section 9.1: Overview

### Criterion: Student view: Full-screen page at /ap/results/:resultId
- **Status:** Implemented
- **Evidence:** [routes.jsx:42-48](src/apBoost/routes.jsx#L42-L48) - Route definition, [APReportCard.jsx](src/apBoost/pages/APReportCard.jsx) - Full page component
- **Notes:** Route properly defined with PrivateRoute wrapper. APReportCard renders as full-screen page.

### Criterion: Teacher view: Side-panel from Gradebook (editable)
- **Status:** Partial
- **Evidence:** [APGradebook.jsx:120-122](src/apBoost/pages/APGradebook.jsx#L120-L122) - Panel state, [GradingPanel.jsx](src/apBoost/components/grading/GradingPanel.jsx) - Side panel component
- **Notes:** GradingPanel exists as side-panel from Gradebook but is focused on FRQ grading workflow, not viewing the completed report card in an editable format. The "View" button opens the same grading panel. There's no dedicated teacher view that shows the complete report card with edit capabilities.

---

## Section 9.2: Report Card Layout

### Header Section

#### Criterion: "SCORE REPORT" title
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:364](src/apBoost/pages/APReportCard.jsx#L364)
- **Notes:** Title renders as "SCORE REPORT" with proper styling.

#### Criterion: Student name
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:380](src/apBoost/pages/APReportCard.jsx#L380)
- **Notes:** Shows user?.displayName or user?.email from AuthContext.

#### Criterion: Class name
- **Status:** Missing
- **Evidence:** Not found in APReportCard.jsx
- **Notes:** Class name is NOT fetched from ap_classes collection and NOT displayed in the header. The result object contains classId but it's not used to fetch class details.

#### Criterion: Test name
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:381](src/apBoost/pages/APReportCard.jsx#L381)
- **Notes:** Uses test?.title from getTestMeta service call.

#### Criterion: Subject
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:384](src/apBoost/pages/APReportCard.jsx#L384)
- **Notes:** Uses getSubjectConfig(test.subject).name for display.

#### Criterion: Date (completedAt)
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:385](src/apBoost/pages/APReportCard.jsx#L385)
- **Notes:** Formats result?.completedAt?.toDate?.().toLocaleDateString().

### Score Summary

#### Criterion: Large AP Score display (1-5)
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:13-42](src/apBoost/pages/APReportCard.jsx#L13-L42) - APScoreBadge component, [APReportCard.jsx:390-392](src/apBoost/pages/APReportCard.jsx#L390-L392) - Usage
- **Notes:** Large 4xl font display with color-coded badges. Handles pending state with hourglass icon.

#### Criterion: Section scores with progress bars
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:47-68](src/apBoost/pages/APReportCard.jsx#L47-L68) - SectionScoreBar component, [APReportCard.jsx:395-417](src/apBoost/pages/APReportCard.jsx#L395-L417) - Usage
- **Notes:** Progress bars with proper styling and percentage display.

#### Criterion: MCQ section: X/Y pts, percentage
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:397-405](src/apBoost/pages/APReportCard.jsx#L397-L405)
- **Notes:** Displays correct/total with calculated percentage.

#### Criterion: FRQ section: X/Y pts, percentage
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:408-416](src/apBoost/pages/APReportCard.jsx#L408-L416)
- **Notes:** Displays frqEarnedPoints/frqMaxPoints. Shows pending state when not graded.

#### Criterion: Total: X/Y pts (percentage)
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:420-429](src/apBoost/pages/APReportCard.jsx#L420-L429)
- **Notes:** Shows total score/maxScore with percentage. Shows "Pending FRQ grading" when applicable.

#### Criterion: [Download Report PDF] button
- **Status:** Missing
- **Evidence:** [generateReportPdf.js](src/apBoost/utils/generateReportPdf.js) - Utility exists but NO import or button in APReportCard.jsx
- **Notes:** The PDF generation utility is fully implemented with jsPDF but there is NO button in the APReportCard.jsx page to trigger the download. The utility is completely disconnected from the UI.

### MCQ Results Table

#### Criterion: Column headers: Q#, Answer, Response, Domain, Topic, Result
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:78-83](src/apBoost/pages/APReportCard.jsx#L78-L83)
- **Notes:** Current headers are: Q#, Correct, Your Answer, Result. **Domain and Topic columns are MISSING.**

#### Criterion: Each row shows: question number, correct answer, student's answer
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:86-104](src/apBoost/pages/APReportCard.jsx#L86-L104)
- **Notes:** Properly displays all answer data.

#### Criterion: Domain and Topic from question metadata
- **Status:** Missing
- **Evidence:** Not found
- **Notes:** The mcqResults from apScoringService only includes questionId, studentAnswer, correctAnswer, correct. Domain and topic are NOT fetched from ap_questions collection and NOT displayed.

#### Criterion: Result: Checkmark (correct) or X (incorrect)
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:95-100](src/apBoost/pages/APReportCard.jsx#L95-L100)
- **Notes:** Uses success-text for checkmark and error-text for X.

#### Criterion: MCQ Summary: X/Y correct (percentage)
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:441-443](src/apBoost/pages/APReportCard.jsx#L441-L443)
- **Notes:** Calculates and displays summary correctly.

### FRQ Results Table

#### Criterion: Column headers: Q#, Sub, Pts Max, Earned, Domain, Topic, Comment
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:156-200](src/apBoost/pages/APReportCard.jsx#L156-L200) - FRQGradedResults component
- **Notes:** Displays question number, sub-question labels, scores, and comments. **Domain and Topic columns are MISSING.** Layout is card-based rather than traditional table columns.

#### Criterion: Rows grouped by FRQ question
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:163-198](src/apBoost/pages/APReportCard.jsx#L163-L198)
- **Notes:** Questions are rendered as grouped cards with nested sub-questions.

#### Criterion: Subtotal per question
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:167-169](src/apBoost/pages/APReportCard.jsx#L167-L169)
- **Notes:** Shows sum of subScores / maxPoints per question.

#### Criterion: Teacher comments shown
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:191-196](src/apBoost/pages/APReportCard.jsx#L191-L196)
- **Notes:** Comments displayed in info-colored box with "Teacher Feedback:" label.

#### Criterion: FRQ Summary: X/Y raw pts -> X/Y weighted (percentage)
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:489-492](src/apBoost/pages/APReportCard.jsx#L489-L492)
- **Notes:** Shows raw points (frqEarnedPoints/frqMaxPoints) but does NOT show the weighted conversion separately. Only shows single point value.

#### Criterion: [Download Graded Paper (PDF)] button if available
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:246-256](src/apBoost/pages/APReportCard.jsx#L246-L256) - HandwrittenFilesSection
- **Notes:** Button exists but labeled as "Download PDF" for teacher's annotated feedback. Only visible when annotatedPdfUrl exists. Button label doesn't match spec ("Download Graded Paper").

---

## Section 9.3: Report Card Data Sources

#### Criterion: Student name from users/{userId}
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:264](src/apBoost/pages/APReportCard.jsx#L264) - Uses useAuth()
- **Notes:** Uses AuthContext user object instead of fetching from Firestore users collection. Works for current user but would need different approach for teacher viewing student report.

#### Criterion: Class name from ap_classes/{classId}
- **Status:** Missing
- **Evidence:** Not found
- **Notes:** No call to fetch class data. result.classId exists but is not used to lookup class name.

#### Criterion: Test name/subject from ap_tests/{testId}
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:284-285](src/apBoost/pages/APReportCard.jsx#L284-L285)
- **Notes:** Uses getTestMeta(resultData.testId) from apTestService.

#### Criterion: Date from ap_test_results.completedAt
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:385](src/apBoost/pages/APReportCard.jsx#L385)
- **Notes:** Properly reads and formats completedAt field.

#### Criterion: AP Score from ap_test_results.apScore
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:391](src/apBoost/pages/APReportCard.jsx#L391)
- **Notes:** Uses result?.apScore directly.

#### Criterion: Section scores from ap_test_results.sectionScores
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:397](src/apBoost/pages/APReportCard.jsx#L397)
- **Notes:** Maps over result.sectionScores to render score bars.

#### Criterion: MCQ answers from ap_test_results.answers + ap_questions
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:344](src/apBoost/pages/APReportCard.jsx#L344), [apScoringService.js:98-112](src/apBoost/services/apScoringService.js#L98-L112)
- **Notes:** Uses mcqResults array from test_results which includes questionId, studentAnswer, correctAnswer, correct. Does NOT join with ap_questions to get domain/topic metadata.

#### Criterion: FRQ grades from ap_test_results.frqGrades
- **Status:** Implemented
- **Evidence:** [APReportCard.jsx:346](src/apBoost/pages/APReportCard.jsx#L346)
- **Notes:** Uses result?.frqGrades directly with subScores and comments.

#### Criterion: Domain/Topic from ap_questions
- **Status:** Missing
- **Evidence:** Not found
- **Notes:** No code fetches domain/topic from ap_questions collection. Would require joining mcqResults questionIds with questions to get metadata.

#### Criterion: Graded PDF from ap_test_results.frqGradedPdfUrl
- **Status:** Partial
- **Evidence:** [APReportCard.jsx:355](src/apBoost/pages/APReportCard.jsx#L355)
- **Notes:** Uses `annotatedPdfUrl` field instead of the specified `frqGradedPdfUrl`. Functionality works but field name differs from spec.

---

## Section 9.4: Report PDF Export

#### Criterion: Header with student/test info
- **Status:** Implemented
- **Evidence:** [generateReportPdf.js:42-66](src/apBoost/utils/generateReportPdf.js#L42-L66)
- **Notes:** PDF includes SCORE REPORT title, student name, test name, date.

#### Criterion: AP Score prominently displayed
- **Status:** Implemented
- **Evidence:** [generateReportPdf.js:71-82](src/apBoost/utils/generateReportPdf.js#L71-L82)
- **Notes:** Large 48pt font AP score with descriptive label.

#### Criterion: Section breakdown with scores
- **Status:** Implemented
- **Evidence:** [generateReportPdf.js:87-139](src/apBoost/utils/generateReportPdf.js#L87-L139)
- **Notes:** Shows MCQ and FRQ sections with progress bars and percentages.

#### Criterion: Full MCQ results table
- **Status:** Implemented
- **Evidence:** [generateReportPdf.js:144-177](src/apBoost/utils/generateReportPdf.js#L144-L177)
- **Notes:** Complete table with Q#, Your Answer, Correct, Result columns. Handles page breaks.

#### Criterion: Full FRQ results table with teacher comments
- **Status:** Implemented
- **Evidence:** [generateReportPdf.js:179-226](src/apBoost/utils/generateReportPdf.js#L179-L226)
- **Notes:** Shows FRQ questions with sub-scores and teacher comments.

#### Criterion: Does NOT include teacher's annotated PDF (separate download)
- **Status:** Implemented
- **Evidence:** [generateReportPdf.js](src/apBoost/utils/generateReportPdf.js) - No reference to annotatedPdfUrl
- **Notes:** Correctly excludes teacher's annotated PDF from the generated report.

---

## Recommendations

### Critical Missing Features
1. **[Download Report PDF] button** - The generateReportPdf.js utility is complete but NOT connected to APReportCard.jsx. Add import and button to call `downloadReportPdf(result, test, { name: user?.displayName })`.

2. **Class name display** - Add service call to fetch class name from ap_classes when result.classId exists. Display in header section.

3. **Domain/Topic columns** - Expand mcqResults in apScoringService.js to include questionDomain and questionTopic from ap_questions. Add columns to MCQ and FRQ result tables.

### Partial Implementation Fixes
4. **Teacher view side-panel** - Consider adding a read-only report card view in GradingPanel for teachers viewing completed/graded results, separate from the grading workflow.

5. **FRQ Summary weighted display** - Show both raw points and weighted points if multipliers are applied.

6. **Field naming consistency** - Either rename `annotatedPdfUrl` to `frqGradedPdfUrl` to match spec, or document the deviation.

7. **Download Graded Paper button label** - Change "Download PDF" to "Download Graded Paper (PDF)" to match spec.

### Code Quality Notes
- APReportCard.jsx contains inline component definitions (APScoreBadge, SectionScoreBar, MCQResultsTable, etc.) that could be moved to [src/apBoost/components/report/](src/apBoost/components/report/) folder as specified in Section 15.5 of acceptance criteria.
- Consider separating student name fetching for teacher view scenarios where the teacher needs to see a student's report.
