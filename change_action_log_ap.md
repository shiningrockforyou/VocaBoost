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
