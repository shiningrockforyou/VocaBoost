# AP Boost Change Action Log

> **Instructions for Claude:** Log every apBoost code change to this file. Add a new row for each modification with the date, file path, and a brief description of what changed.

| Date | File | Change |
|------|------|--------|
| 2026-01-12 | ap_boost_spec_plan.md | Added Section 3.4: FRQ Submission & Grading Flow (typed vs handwritten modes, answer sheet PDF generation, upload flow, teacher grading interface, grading states) |
| 2026-01-12 | ap_boost_spec_plan.md | Added Section 3.5: Report Card (Results View) - layout wireframe, data sources, PDF export spec |
| 2026-01-12 | ap_boost_spec_plan.md | Updated ap_test_results collection: added frqSubmissionType, frqUploadUrl, frqGradedPdfUrl, frqGrades, gradingStatus fields |
| 2026-01-12 | ap_boost_spec_plan.md | Updated folder structure: added APReportCard.jsx, APGradebook.jsx pages; grading/ and report/ component folders; apGradingService.js, apStorageService.js services; generateAnswerSheetPdf.js, generateReportPdf.js, fileUpload.js utils |
| 2026-01-12 | ap_boost_spec_plan.md | Updated Appendix B Routes: added /ap/results/:resultId, /ap/teacher/gradebook routes |
| 2026-01-12 | ap_boost_spec_plan.md | Added testType (EXAM/MODULE) to ap_tests, ap_assignments collection (junction table), attempt tracking fields to ap_test_results |
| 2026-01-12 | ap_boost_spec_plan.md | Added Section 4.15: Error Handling Conventions (error boundary, async patterns, null handling, timeouts, user messages) |
| 2026-01-12 | ap_boost_spec_plan.md | Updated Section 4.7: Timer Behavior - clarified mobile backgrounding (pause after 30s hidden) |
| 2026-01-12 | ap_boost_spec_plan.md | Updated folder structure - added APErrorBoundary.jsx, ErrorFallback.jsx, SessionSkeleton.jsx, logError.js, withTimeout.js, validateSession.js |
| 2026-01-12 | ap_boost_spec_plan.md | Major update to Section 3.1 (ap_tests): Added questionOrder, scoreRanges (customizable AP 1-5), removed totalTime (now calculated), added section fields (sectionType, calculatorEnabled, mcqMultiplier, frqMultipliers) |
| 2026-01-12 | ap_boost_spec_plan.md | Added Section 3.1 (ap_stimuli): New collection for shared stimuli with type, content, source, imageAlt fields |
| 2026-01-12 | ap_boost_spec_plan.md | Major update to Section 3.1 (ap_questions): Renamed prompt→questionText, added questionType (MCQ_MULTI), individual choice fields (choiceA-J with imageUrl/imageAlt), choiceCount, format (VERTICAL/HORIZONTAL), questionDomain, questionTopic, difficulty, correctAnswers array, partialCredit, explanation, subQuestions for FRQ |
| 2026-01-12 | ap_boost_spec_plan.md | Added Section 3.3: Scoring Flow - calculation process, example with multipliers, partial credit for MCQ_MULTI, FRQ sub-question scoring |
| 2026-01-12 | ap_boost_spec_plan.md | Updated Section 3.2 Indexes: Added ap_stimuli indexes, questionDomain and difficulty filters |
| 2026-01-12 | ap_boost_spec_plan.md | Added Section 3.6: Exam Analytics Dashboard - filters (multi-select class/student), color scale table, MCQ grid wireframe, MCQ detail modal, MCQ detailed view, FRQ grid wireframe, student list with columns |
| 2026-01-12 | ap_boost_spec_plan.md | Added APStudentProfile stub page at /ap/teacher/student/:userId |
| 2026-01-12 | ap_boost_spec_plan.md | Updated folder structure: added APExamAnalytics.jsx, APStudentProfile.jsx pages; analytics/ component folder (PerformanceGrid, MCQSquare, FRQCard, QuestionDetailModal, MCQDetailedView, StudentResultsTable, FilterBar); apAnalyticsService.js; performanceColors.js, generateQuestionsPdf.js utils |
| 2026-01-12 | ap_boost_spec_plan.md | Updated Appendix B Routes: added /ap/teacher/analytics/:testId, /ap/teacher/student/:userId |
| 2026-01-12 | ap_boost_spec_plan.md | Major update to Section 5.1: Added question display format clarification (VERTICAL=1 column no stimulus, HORIZONTAL=2 columns with stimulus) |
| 2026-01-12 | ap_boost_spec_plan.md | Major update to Section 5.2: Replaced navigation dots with bottom bar + slide-up modal navigation system |
| 2026-01-12 | ap_boost_spec_plan.md | Updated Section 5.4: Redesigned Review Screen as full page with question grid boxes |
| 2026-01-12 | ap_boost_spec_plan.md | Renumbered Section 5.5 (Connection Status Banner) and 5.6 (Duplicate Tab Modal) |
| 2026-01-12 | ap_boost_spec_plan.md | Added TODO note to Section 3.3.3 (Partial Credit) for formula to be revisited later |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Removed timer warning thresholds from Section 1.5 (Time Expiry Behavior) |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Updated Timer Architecture - removed onWarning and warningThresholds |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Updated QuestionNavigator references from "dot navigation" to "slide-up modal navigation" |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Updated useTimer hook spec - removed warning-related props |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Updated QuestionNavigatorProps interface for modal-based navigation |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Updated component style patterns - replaced dot styles with box styles |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Updated verification checklist for new navigation UI |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Expanded Phase 1 with detailed service function signatures (apTestService, apSessionService, apScoringService) |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added hook specifications (useTestSession, useTimer) with full return type documentation |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added component props interfaces (TestCard, InstructionScreen, QuestionDisplay, AnswerInput, TestTimer, QuestionNavigator, ReviewScreen, APReportCard) |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added data flow diagram showing Firestore ↔ Session Service ↔ Local State architecture |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added styling approach: Tailwind CSS with apBoost theme colors and component style patterns |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added complete route definitions for student and teacher routes |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added Part 7: State Shapes (Session, TestResult, UIState TypeScript interfaces) |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added Part 8: Error Handling Strategy (APError class, ErrorCodes, recovery flows) |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added Part 9: Testing Strategy (unit tests for services/hooks, integration tests) |
| 2026-01-12 | squishy-giggling-pearl.md (plan) | Added Part 11: Implementation Order (Phase 1 Day-by-Day breakdown, 10 days) |
| 2026-01-12 | src/apBoost/implementation/ | Created implementation folder with phase-specific markdown plans |
| 2026-01-12 | src/apBoost/implementation/phase1-foundation.md | Phase 1 plan: folder structure, routes, services, hooks, components for MCQ test-taking |
| 2026-01-12 | src/apBoost/implementation/phase2-session-resilience.md | Phase 2 plan: offline queue, heartbeat, duplicate tab detection, error boundary |
| 2026-01-12 | src/apBoost/implementation/phase3-frq-support.md | Phase 3 plan: FRQ sub-question navigation, typed input, grading panel |
| 2026-01-12 | src/apBoost/implementation/phase4-tools.md | Phase 4 plan: highlighter, strikethrough, line reader annotation tools |
| 2026-01-12 | src/apBoost/implementation/phase5-teacher-flow.md | Phase 5 plan: teacher dashboard, test editor, question bank, class assignment |
| 2026-01-12 | src/apBoost/implementation/phase6-frq-handwritten.md | Phase 6 plan: PDF answer sheet generation, file upload, grading panel updates |
| 2026-01-12 | src/apBoost/implementation/phase7-analytics.md | Phase 7 plan: performance grids, question detail modal, student table, PDF exports |
| 2026-01-12 | src/apBoost/implementation/README.md | Implementation folder README with workflow and phase overview |
| 2026-01-12 | src/apBoost/utils/apTypes.js | Created: Constants for question types, session status, collections, etc. |
| 2026-01-12 | src/apBoost/utils/apTestConfig.js | Created: AP subject configs, time formatting utilities |
| 2026-01-12 | src/apBoost/routes.jsx | Created: Route definitions for /ap, /ap/test/:testId, /ap/results/:resultId |
| 2026-01-12 | src/apBoost/index.js | Created: Export barrel file for apBoost module |
| 2026-01-12 | src/App.jsx | Added: apBoost routes import and integration |
| 2026-01-12 | src/apBoost/pages/APDashboard.jsx | Created: Test list page with TestCard component, loading states |
| 2026-01-12 | src/apBoost/pages/APTestSession.jsx | Created: Main test interface with instruction/testing/review views |
| 2026-01-12 | src/apBoost/pages/APReportCard.jsx | Created: Results display with AP score, section scores, MCQ table |
| 2026-01-12 | src/apBoost/components/APHeader.jsx | Created: Header with AP branding and user info |
| 2026-01-12 | src/apBoost/components/InstructionScreen.jsx | Created: Pre-test instruction display with section breakdown |
| 2026-01-12 | src/apBoost/components/QuestionDisplay.jsx | Created: Question renderer supporting VERTICAL and HORIZONTAL formats |
| 2026-01-12 | src/apBoost/components/AnswerInput.jsx | Created: MCQ radio button group with strikethrough support |
| 2026-01-12 | src/apBoost/components/QuestionNavigator.jsx | Created: Bottom bar + slide-up modal navigation |
| 2026-01-12 | src/apBoost/components/ReviewScreen.jsx | Created: Full-page review with question grid and summary |
| 2026-01-12 | src/apBoost/components/TestTimer.jsx | Created: Countdown timer display in MM:SS format |
| 2026-01-12 | src/apBoost/services/apTestService.js | Created: Functions for fetching tests, questions, assignments |
| 2026-01-12 | src/apBoost/services/apSessionService.js | Created: Session CRUD, answer saving, flag toggling, timer sync |
| 2026-01-12 | src/apBoost/services/apScoringService.js | Created: MCQ scoring, AP score calculation, result creation |
| 2026-01-12 | src/apBoost/hooks/useTimer.js | Created: Timer hook with start/pause/resume/reset controls |
| 2026-01-12 | src/apBoost/hooks/useTestSession.js | Created: Core session management hook combining all state |
| 2026-01-12 | src/apBoost/utils/seedTestData.js | Created: Seed data script for development testing |
| 2026-01-12 | src/apBoost/utils/logError.js | Created: Centralized error logging utility with context support |
| 2026-01-12 | src/apBoost/utils/withTimeout.js | Created: Promise timeout wrapper for network operations |
| 2026-01-12 | src/apBoost/hooks/useOfflineQueue.js | Created: IndexedDB-backed offline queue with retry logic |
| 2026-01-12 | src/apBoost/hooks/useHeartbeat.js | Created: 15-second server ping, session takeover detection |
| 2026-01-12 | src/apBoost/hooks/useDuplicateTabGuard.js | Created: BroadcastChannel + Firestore duplicate tab detection |
| 2026-01-12 | src/apBoost/components/ConnectionStatus.jsx | Created: Banner for disconnected/syncing states |
| 2026-01-12 | src/apBoost/components/DuplicateTabModal.jsx | Created: Modal for session active elsewhere |
| 2026-01-12 | src/apBoost/components/APErrorBoundary.jsx | Created: React error boundary for crash recovery |
| 2026-01-12 | src/apBoost/components/ErrorFallback.jsx | Created: Fallback UI with retry and dashboard links |
| 2026-01-12 | src/apBoost/hooks/useTestSession.js | Updated: Integrated useOfflineQueue, useHeartbeat, useDuplicateTabGuard; added beforeunload handler |
| 2026-01-12 | src/apBoost/pages/APTestSession.jsx | Updated: Added ConnectionStatus, DuplicateTabModal, APErrorBoundary wrapper |
| 2026-01-12 | src/apBoost/components/FRQTextInput.jsx | Created: Auto-resizing textarea for FRQ answers with character count |
| 2026-01-12 | src/apBoost/components/FRQQuestionDisplay.jsx | Created: FRQ question renderer with sub-question highlighting, stimulus support |
| 2026-01-12 | src/apBoost/components/QuestionDisplay.jsx | Updated: Added FRQ delegation to FRQQuestionDisplay, subQuestionLabel prop |
| 2026-01-12 | src/apBoost/hooks/useTestSession.js | Updated: Added FRQ sub-question navigation (flatNavigationItems, goToFlatIndex), FRQ answer format |
| 2026-01-12 | src/apBoost/components/QuestionNavigator.jsx | Updated: Support flat navigation items for FRQ sub-questions (1a, 1b, 1c, etc.) |
| 2026-01-12 | src/apBoost/pages/APTestSession.jsx | Updated: Added FRQ support with FRQTextInput, subQuestionLabel, flat navigation |
| 2026-01-12 | src/apBoost/pages/APReportCard.jsx | Updated: Added partial results support (awaiting grade), FRQ submitted answers display, FRQ graded results |
| 2026-01-12 | src/apBoost/services/apGradingService.js | Created: getPendingGrades, getResultForGrading, saveGrade, calculateFRQScore functions |
| 2026-01-12 | src/apBoost/components/grading/GradingPanel.jsx | Created: Side panel for FRQ grading with score inputs and comments |
| 2026-01-12 | src/apBoost/pages/APGradebook.jsx | Created: Teacher grading list page with filters and grading panel |
| 2026-01-12 | src/apBoost/routes.jsx | Updated: Added /ap/gradebook route for teacher grading |
| 2026-01-12 | src/apBoost/hooks/useAnnotations.js | Created: Annotation hook managing highlights, strikethroughs, line reader state with persistence support |
| 2026-01-12 | src/apBoost/components/tools/Highlighter.jsx | Created: Text highlighting component with color picker popup, selection handling |
| 2026-01-12 | src/apBoost/components/tools/LineReader.jsx | Created: Focus line reader overlay with keyboard navigation (arrow keys) |
| 2026-01-12 | src/apBoost/components/tools/ToolsToolbar.jsx | Created: Toolbar for highlight color, line reader toggle, visible lines, clear all |
| 2026-01-12 | src/apBoost/components/tools/PassageDisplay.jsx | Created: Stimulus display integrating Highlighter, LineReader, ToolsToolbar components |
| 2026-01-12 | src/apBoost/components/QuestionDisplay.jsx | Updated: Added annotation props, integrated PassageDisplay for HORIZONTAL layout with text stimulus |
| 2026-01-12 | src/apBoost/components/AnswerInput.jsx | Updated: Added strikethroughs Set and onStrikethrough callback props for answer elimination |
| 2026-01-12 | src/apBoost/hooks/useTestSession.js | Updated: Exported addToQueue for annotation persistence |
| 2026-01-12 | src/apBoost/pages/APTestSession.jsx | Updated: Integrated useAnnotations hook, connected highlight/strikethrough/line reader to QuestionDisplay and AnswerInput |
| 2026-01-12 | src/apBoost/services/apTeacherService.js | Created: Teacher service with getTeacherTests, createTest, updateTest, deleteTest, getTeacherClasses, createAssignment, getPendingGradingCount, publishTest |
| 2026-01-12 | src/apBoost/services/apQuestionService.js | Created: Question service with searchQuestions, createQuestion, updateQuestion, deleteQuestion, addQuestionsToSection, removeQuestionFromSection, reorderSectionQuestions |
| 2026-01-12 | src/apBoost/pages/APTeacherDashboard.jsx | Created: Teacher home page with quick actions, tests list, pending grading count, classes list |
| 2026-01-12 | src/apBoost/pages/APTestEditor.jsx | Created: Test editor page with section management, question assignment, score ranges configuration |
| 2026-01-12 | src/apBoost/pages/APQuestionBank.jsx | Created: Question bank with filters (subject, type, difficulty, domain), search, preview modal, picker mode for test editor |
| 2026-01-12 | src/apBoost/pages/APQuestionEditor.jsx | Created: Question editor for MCQ/FRQ with choice editor, sub-question editor, metadata |
| 2026-01-12 | src/apBoost/pages/APAssignTest.jsx | Created: Test assignment page wrapper for AssignTestModal |
| 2026-01-12 | src/apBoost/components/teacher/AssignTestModal.jsx | Created: Modal for assigning tests to classes with due date, max attempts, FRQ mode settings |
| 2026-01-12 | src/apBoost/routes.jsx | Updated: Added teacher routes (/ap/teacher, /ap/teacher/test/:testId/edit, /ap/teacher/test/:testId/assign, /ap/teacher/questions, /ap/teacher/question/:questionId/edit) |
| 2026-01-12 | src/apBoost/utils/generateAnswerSheetPdf.js | Created: PDF answer sheet generation using jsPDF with question prompts and writing spaces |
| 2026-01-12 | src/firebase.js | Updated: Added Firebase Storage import and export, storage emulator connection |
| 2026-01-12 | src/apBoost/services/apStorageService.js | Created: Storage service with validateFile, uploadFRQAnswerSheet, uploadGradedPdf, getFileDownloadUrl, deleteUpload, formatFileSize |
| 2026-01-12 | src/apBoost/components/FileUpload.jsx | Created: Drag-and-drop file upload component with preview, progress, validation |
| 2026-01-12 | src/apBoost/components/FRQHandwrittenMode.jsx | Created: Handwritten submission flow with 4 steps (download PDF, write, scan, upload) |
| 2026-01-12 | src/apBoost/components/grading/GradingPanel.jsx | Updated: Added HandwrittenViewer component for uploaded images/PDFs with zoom, rotate, navigation; annotated PDF upload section |
| 2026-01-12 | src/apBoost/services/apGradingService.js | Updated: saveGrade now accepts annotatedPdfUrl parameter for handwritten feedback |
| 2026-01-12 | src/apBoost/pages/APReportCard.jsx | Updated: Added HandwrittenFilesSection for viewing uploaded files and teacher's annotated PDF download |
| 2026-01-12 | src/apBoost/pages/APTestSession.jsx | Updated: Added FRQ submission type choice screen, handwritten mode view with FRQHandwrittenMode, frqSubmissionType and uploadedFiles state |
| 2026-01-12 | src/apBoost/hooks/useTestSession.js | Updated: submitTest now accepts frqData parameter for handwritten submission info |
| 2026-01-12 | src/apBoost/services/apScoringService.js | Updated: createTestResult now accepts frqData and stores frqSubmissionType, frqUploadedFiles, annotatedPdfUrl fields |
| 2026-01-13 | src/apBoost/utils/performanceColors.js | Created: Performance color thresholds (>85% green, 70-85% lime, 60-70% yellow, 50-60% orange, <50% red) with getPerformanceColor, getPerformanceInfo, getAPScoreColor utilities |
| 2026-01-13 | src/apBoost/services/apAnalyticsService.js | Created: Analytics aggregation service with getTestAnalytics, calculateQuestionPerformance, calculateResponseDistribution, calculateFRQPerformance, calculateSummaryStats, getStudentResults, getClassesForFilter, getStudentsForFilter |
| 2026-01-13 | src/apBoost/components/analytics/FilterBar.jsx | Created: Multi-select dropdown filters for classes and students with apply button |
| 2026-01-13 | src/apBoost/components/analytics/MCQSquare.jsx | Created: Single question performance square with color coding based on percentage |
| 2026-01-13 | src/apBoost/components/analytics/PerformanceGrid.jsx | Created: Grid of MCQSquare components with color legend and summary stats |
| 2026-01-13 | src/apBoost/components/analytics/QuestionDetailModal.jsx | Created: Modal showing question text, stimulus, and response distribution bars (green/red for correct/incorrect) |
| 2026-01-13 | src/apBoost/components/analytics/FRQCard.jsx | Created: FRQ performance card with nested SubQuestionSquare components showing sub-question performance |
| 2026-01-13 | src/apBoost/components/analytics/MCQDetailedView.jsx | Created: Expanded list view showing all questions with inline response distributions |
| 2026-01-13 | src/apBoost/components/analytics/StudentResultsTable.jsx | Created: Sortable student results table with Name, Email, MCQ, FRQ, Total, AP Score columns and report links |
| 2026-01-13 | src/apBoost/pages/APExamAnalytics.jsx | Created: Main analytics dashboard with summary cards, AP score distribution, MCQ grid/detailed toggle, FRQ cards, student results table |
| 2026-01-13 | src/apBoost/utils/generateReportPdf.js | Created: PDF report card generation using jsPDF with student info, AP score, section breakdown, MCQ results table, FRQ grades |
| 2026-01-13 | src/apBoost/utils/generateQuestionsPdf.js | Created: PDF questions export for teachers with includeAnswers and includeStimuli options |
| 2026-01-13 | src/apBoost/routes.jsx | Updated: Added APExamAnalytics import and /ap/teacher/analytics/:testId route |
