# apBoost Progress Tracker

> Long-term tracker for criteria audit compliance, fix plan execution, and remaining work.
> Update this file with dates/timestamps whenever progress is made.

---

## Change Log (This Tracker)

| Date | Time | What Changed |
|------|------|-------------|
| 2026-03-07 | 18:00 | Initial tracker created from full audit of criteria files + change_action_log_ap.md cross-reference |
| 2026-03-07 | 18:30 | Verified all items against current code. Closed #1 (section locking already works via flatNav design), #2 (all 6 needed indexes present), #4 (validation handled inline in services). Reclassified remaining P0s. Added execution plan. |
| 2026-03-07 | 19:00 | Created ARCHITECTURE.md (system design reference). Updated CLAUDE.md to reference both ARCHITECTURE.md (always read) and AP_BOOST_TRACKER.md (read for fix work). |
| 2026-03-07 | 19:45 | Replaced grouped work items with granular per-criterion checklist. Every remaining FAIL/PARTIAL criterion now tracked individually. |
| 2026-03-07 | 20:30 | Sprint 1 complete: TeacherRoute role guard (1.1), /ap/teacher/test/new route (1.2), queue reconciliation on resume (1.3). See change_action_log_ap.md 2026-03-07 entries. |
| 2026-03-07 | 21:00 | Sprint 2 complete: PDF download (2.1), Domain/Topic columns (2.2), class name (2.3), Next→Review (2.4), reconnect banner (2.5), FRQ instruction info (2.6), annotation indicators (2.7), seed data (2.8). |
| 2026-03-07 | 22:30 | Sprint 6 (P3 backlog) complete: 30+ items checked off. Error handling overhaul, offline queue enhancements, real-time gradebook, annotation validation, config expansion, report card improvements, student profile analytics. Scorecard updated to ~87%. |
| 2026-03-07 | 23:30 | MathJax integration + full seed data complete. MathText component, APMathProvider context, 4-point rendering integration. seedFullData.js with 3 full tests (Micro/Macro/Calc AB), 51 questions (LaTeX in Calc), 5 students, 2 classes, 3 assignments, 13 results. |

---

## Overall Progress

**Criteria audits written:** 2026-01-14
**Fix plans written:** 2026-01-14
**First fix wave:** 2026-01-14 (46 changes logged)
**Last change logged:** 2026-01-14

### Scorecard (post-fix-wave)

| Category | Total Criteria | Done | Remaining | % Complete |
|----------|---------------|------|-----------|------------|
| 1. Test-Taking Experience (1.1-1.12) | 105 | ~90 | ~15 | ~86% |
| 2. Question Types (2.1-2.5) | 47 | ~44 | ~3 | ~94% |
| 3. Data Models (3.1-3.8) | 86 | ~78 | ~8 | ~91% |
| 4. Scoring (4.1-4.5) | 17 | ~15 | ~2 | ~88% |
| 5. Offline & Sync (5.1-5.12) | 102 | ~82 | ~20 | ~80% |
| 6. Error Handling (6.1-6.7) | 38 | ~37 | ~1 | ~97% |
| 7. UI Components (7.1-7.7) | 47 | ~41 | ~6 | ~87% |
| 8. FRQ & Grading (8.1-8.6) | 65 | ~55 | ~10 | ~85% |
| 9. Report Card (9.1-9.4) | 34 | ~22 | ~12 | ~65% |
| 10. Analytics (10.1-10.9) | 48 | ~44 | ~4 | ~92% |
| 11. Teacher Workflow (11.1-11.5) | 36 | ~33 | ~3 | ~92% |
| 12-13. Roles & Routes (12.1-13.2) | 33 | ~24 | ~9 | ~73% |
| 14. Code Organization (14.1-14.4) | 28 | ~23 | ~5 | ~82% |
| 16. Hooks Overview (16.1-16.6) | 49 | ~44 | ~5 | ~90% |
| 17. Hooks Detailed (17.1-17.6) | 60 | ~55 | ~5 | ~92% |
| 18-19. Utilities (18-19) | 65 | ~42 | ~23 | ~65% |
| 20. Phase Verification (20.1-20.7) | 68 | ~56 | ~12 | ~82% |
| **TOTAL** | **~902** | **~785** | **~117** | **~87%** |

---

## Fix Wave Summary (2026-01-14)

The following critical/high items were **FIXED** during the Jan 14 fix wave, confirmed via change_action_log_ap.md:

### Critical Items Fixed
- [x] MCQ_MULTI UI (checkboxes in AnswerInput) + scoring (partial credit + all-or-nothing)
- [x] Timer auto-submit (handleTimerExpire with actual submission, AUTO_SUBMIT queueing)
- [x] Mobile background timer pause (visibilitychange with 30s threshold)
- [x] PAUSED status (localStorage pause marker, restored on resume)
- [x] Session resume includes PAUSED (getActiveSession queries both statuses)
- [x] FLAG_TOGGLE persistence (Firestore transaction, last-write-wins)
- [x] ANNOTATION_UPDATE persistence (transaction with ADD/REMOVE/CLEAR/TOGGLE operations)
- [x] Annotation restoration on resume (loadAnnotations wired in APTestSession)
- [x] Access control (canAccessTest + createOrResumeSession blocks unauthorized)
- [x] Teacher isolation in grading (teacherId filter on getPendingGrades)
- [x] 6 Firestore indexes added (ap_session_state, ap_tests, ap_classes, ap_assignments, ap_test_results x2)
- [x] FRQ multipliers in scoring (frqMultipliers support in createTestResult + calculateFRQScore)
- [x] Stimuli service created (apStimuliService.js with full CRUD)
- [x] SubmitProgressModal created (syncing state, queue count, 30s timeout, "Keep Trying")
- [x] Submit retry logic (2s retry loop + 30s timeout + retrySubmit)

### High Items Fixed
- [x] FRQ onBlur save (dedupe guard in FRQTextInput)
- [x] DBQ multi-stimulus support (DocumentSelector with tabs)
- [x] Line reader drag + scroll tracking (Pointer Events API)
- [x] Flagged questions listed in ReviewScreen summary
- [x] Overlapping highlights algorithm (boundary-sweep)
- [x] Strikethrough icon X + opacity 0.6
- [x] Max attempts display on APDashboard
- [x] ToolsToolbar sticky positioning
- [x] TestSessionMenu created (slide-up menu)
- [x] Menu button (hamburger) in header
- [x] Rubric and tags fields in question service + editor
- [x] Stimulus title rendering in PassageDisplay
- [x] ACTIVE alias for SESSION_STATUS
- [x] Field naming aliases (frqGradedPdfUrl, frqUploadUrl)
- [x] maxAttempts default changed to 3
- [x] Section lock visual indicator in header
- [x] pagehide handler for mobile Safari timer sync

---

## Remaining Work - Granular Criteria Checklist

> Every remaining FAIL/PARTIAL criterion from the 25 audit files, cross-referenced against the Jan 14 fix wave.
> Items marked ~~strikethrough~~ were fixed in Jan 14. Unmarked items are STILL OPEN.
> Check the box when implementing. Update the tracker changelog with date/time.

---

### Section 1: Test-Taking Experience

#### 1.1 Timed Sections
- [x] ~~Timer auto-submits on expiry~~ (Fixed: handleTimerExpire with AUTO_SUBMIT queue)
- [x] ~~Timer expiry offline queues auto-submit~~ (Fixed: AUTO_SUBMIT action + checkPendingAutoSubmit)
- [x] ~~Mobile background >30s pauses timer~~ (Fixed: visibilitychange + 30s threshold)
- [x] ~~beforeunload sets PAUSED status~~ (Fixed: localStorage pause marker + restore logic)

#### 1.2 Question Flagging
- [x] ~~Flagged questions listed in ReviewScreen summary~~ (Fixed: shows Q# list like unanswered)
- [x] ~~Flag state survives refresh/crash~~ (Fixed: FLAG_TOGGLE idempotent flush via transaction)

#### 1.3 Highlighter
- [x] ~~Highlights survive refresh/crash~~ (Fixed: ANNOTATION_UPDATE flush with transaction)
- [x] ~~Overlapping highlights handled gracefully~~ (Fixed: boundary-sweep algorithm)
- [x] Highlights visible in review mode (read-only) | `APTestSession.jsx` | P2 — Done 2026-03-10 (pass exportAnnotations().highlights to ReviewScreen)

#### 1.4 Strikethrough
- [x] ~~Strikethrough icon changed to X~~ (Fixed: X icon + opacity-0.6 + text-text-muted)
- [x] ~~Strikethrough survives refresh/crash~~ (Fixed: ANNOTATION_UPDATE flush)
- [x] Strikethrough visible in review mode | `APTestSession.jsx` | P2 — Done 2026-03-10 (pass exportAnnotations().strikethroughs to ReviewScreen)
- [ ] Click MCQ option text to toggle (not just button) | `AnswerInput.jsx` | P3 - BY DESIGN: button approach is cleaner

#### 1.5 Line Reader
- [x] ~~Drag overlay to move position~~ (Fixed: Pointer Events API)
- [x] ~~Scroll position tracking~~ (Fixed: scrollTop state + scroll listener)

#### 1.6 Section Locking
- [x] ~~All criteria~~ (DONE: implicit via flatNavigationItems bounded per-section)

#### 1.7 Session Persistence
- [x] ~~Closing browser sets PAUSED~~ (Fixed: localStorage pause marker)
- [x] ~~Resume restores annotations~~ (Fixed: loadAnnotations wired in APTestSession)

#### 1.9 Dashboard
- [x] ~~Max attempts shown on test cards~~ (Fixed: "Attempts: X / Y" display)

#### 1.10 Page States
- [x] ~~Submit progress modal~~ (Fixed: SubmitProgressModal.jsx created)
- [x] ~~Menu button in header~~ (Fixed: hamburger SVG + TestSessionMenu)

#### 1.12 ToolsToolbar
- [x] ~~Floating/sticky toolbar~~ (Fixed: sticky top-0 z-10 in PassageDisplay)

---

### Section 2: Question Types

#### 2.2 MCQ Multi-Select
- [x] ~~All criteria~~ (Fixed: checkbox UI, array selection, partial credit scoring)

#### 2.3.2 FRQTextInput
- [x] ~~onBlur save handler~~ (Fixed: dedupe guard in FRQTextInput)

#### 2.5 DBQ
- [x] ~~Multi-document stimulus support~~ (Fixed: DocumentSelector with tabs)

---

### Section 3: Data Models

#### 3.1 ap_tests
- [x] ~~frqMultipliers for FRQ sections~~ (Fixed: frqMultipliers support in scoring)
- [x] totalTime calculation utility function | `apTestConfig.js` | P3 — Done 2026-03-07 (`calculateTotalTime` exists and verified)

#### 3.2 ap_stimuli
- [x] ~~Stimuli service created~~ (Fixed: apStimuliService.js with CRUD)
- [x] ~~Stimulus title rendering~~ (Fixed: title display in PassageDisplay)
- [x] Tags for stimulus filtering/search | `apStimuliService.js` | P3 — Done 2026-03-07 (tags field exists in service)

#### 3.3 ap_questions
- [x] ~~Rubric field in createQuestion~~ (Fixed: rubric textarea in editor)
- [x] ~~Tags field in createQuestion~~ (Fixed: tags input + array-contains query)
- [x] stimulusId lookup from ap_stimuli collection | `apTestService.js` | P3 — Done 2026-03-07 (getStimuliByIds resolves stimulusId refs)

#### 3.4 ap_session_state
- [ ] Answer object structure: spec wants `{value, markedForReview}` per question, current uses separate flaggedQuestions array | KEEP CURRENT | BY DESIGN: cleaner separation

#### 3.5 ap_test_results
- [x] ~~frqUploadUrl alias~~ (Fixed: alias field added)
- [x] ~~frqGradedPdfUrl alias~~ (Fixed: alias field added)

#### 3.6 ap_classes
- [x] createClass() service function | `apTeacherService.js` | P2 — Done 2026-03-07 (exists at line 380-397)

#### 3.7 ap_assignments
- [x] ~~maxAttempts default 3~~ (Fixed: default changed to 3)
- [x] ~~Student access control~~ (Fixed: canAccessTest + createOrResumeSession blocks)

#### 3.8 Firestore Indexes
- [x] ~~6 core indexes added~~ (ap_session_state, ap_tests, ap_classes, ap_assignments, ap_test_results x2)
- [x] ap_questions: subject+type composite index | `firestore.indexes.json` | P3 — Done 2026-03-07
- [x] ap_questions: subject+difficulty composite index | `firestore.indexes.json` | P3 — Done 2026-03-07
- [x] ap_questions: createdBy composite index | `firestore.indexes.json` | P3 — Done 2026-03-07
- [x] ap_test_results: testId+completedAt composite index | `firestore.indexes.json` | P3 — Done 2026-03-07
- [x] ap_stimuli: type composite index | `firestore.indexes.json` | P3 — Done 2026-03-07

---

### Section 4: Scoring

#### 4.1 Score Calculation
- [x] ~~FRQ multipliers applied in scoring~~ (Fixed: frqMultipliers in createTestResult + calculateFRQScore)

#### 4.3 MCQ_MULTI Partial Credit
- [x] ~~All criteria~~ (Fixed: calculateMCQMultiScore with partial credit formula)

#### 4.4 FRQ Sub-Question Scoring
- [x] ~~frqMultiplier application~~ (Fixed: saveGrade fetches test to apply multipliers)

---

### Section 5: Offline & Sync

#### 5.1 Core Sync Strategy
- [x] ~~Debounce is 1s, spec says 2-3s~~ | `useOfflineQueue.js` | P3 — Done 2026-03-07 (changed to 2.5s)
- [x] Navigation should be immediate write, not queued | `useTestSession.js` | P3 — BY DESIGN: queue+beforeunload is sufficient
- [x] ~~beforeunload sets PAUSED~~ (Fixed: localStorage pause marker)
- [x] Section complete should trigger immediate write | `useTestSession.js` | P3 — BY DESIGN: SECTION_COMPLETE action queued with flush

#### 5.2 Write-Ahead Queue
- [x] ~~FLAG_TOGGLE handler~~ (Fixed: transaction-based flush)
- [x] ~~ANNOTATION_UPDATE handler~~ (Fixed: transaction with ADD/REMOVE/CLEAR/TOGGLE)
- [x] Missing action types: SECTION_COMPLETE, SESSION_PAUSE | `useOfflineQueue.js` | P3 — Done 2026-03-07

#### 5.4 Retry Strategy
- [x] ~~Opportunistic mode after backoff exhaustion (retry on user action)~~ | `useOfflineQueue.js` | P2 — Done 2026-03-07
- [x] ~~Visibilitychange triggers queue flush~~ | `useOfflineQueue.js` | P2 — Done 2026-03-07
- [x] ~~Heartbeat success triggers queue flush~~ | `useHeartbeat.js`, `useTestSession.js` | P2 — Done 2026-03-07

#### 5.5 Heartbeat System
- [x] ~~On success: attempt queue flush~~ | `useHeartbeat.js` | P2 — Done 2026-03-07
- [x] On recovery: flush queued writes | `useTestSession.js` | P2 — Done 2026-03-07 (heartbeat onRecovery wired to flushQueue)

#### 5.7 Timer Behavior
- [x] ~~Mobile background >30s timer pause~~ (Fixed: visibilitychange + pagehide)
- [x] ~~beforeunload timer pause~~ (Fixed: localStorage marker)
- [ ] Optional user-facing "Pause" button (if enabled via config) | `APTestSession.jsx` | P3 - DEFERRED

#### 5.8 Submit Flow
- [x] ~~Sync progress modal~~ (Fixed: SubmitProgressModal with queue count)
- [x] ~~Aggressive 2s retry during submit~~ (Fixed: 2s retry loop + 30s timeout)
- [x] ~~"Keep Trying" button~~ (Fixed: retrySubmit in useTestSession)

#### 5.9 Session Resume
- [x] ~~Queue reconciliation: compare IndexedDB timestamps vs Firestore lastAction~~ | `useTestSession.js` | P0 — Done 2026-03-07
- [x] ~~Discard stale queue items (older than server state)~~ | `useTestSession.js` | P0 — Done 2026-03-07
- [x] Show "Resume" modal if status was PAUSED | `InstructionScreen.jsx` | P2 — Done 2026-03-10 (checks IN_PROGRESS || PAUSED, shows "session was paused" message)

#### 5.10 Conflict Resolution
- [x] ~~Compare local vs Firestore timestamps before applying~~ | `useTestSession.js` | P2 — Done 2026-03-07 (part of reconciliation)

#### 5.11 Data Loss Protection
- [x] beforeunload warning should trigger on IN_PROGRESS (not just queue>0) | `useTestSession.js` | P3 — Done 2026-03-07
- [x] Extended offline duration warning (5+ min) | `ConnectionStatus.jsx` | P3 — Done 2026-03-07
- [x] ~~Browser crash recovery: reconcile queue with Firestore~~ | `useTestSession.js` | P2 — Done 2026-03-07 (part of reconciliation)

#### 5.12 Edge Cases
- [x] ~~QuotaExceededError handling + UI banner~~ | `useOfflineQueue.js`, `ConnectionStatus.jsx` | P2 — Done 2026-03-07
- [x] Firestore quota-specific error detection | `useOfflineQueue.js` | P3 — Done 2026-03-07 (classifyError in logError.js)

---

### Section 6: Error Handling

- [x] Silent catch blocks in analytics/grading services | `apAnalyticsService.js`, `apGradingService.js` | P3 — Done 2026-03-07 (replaced with logError)
- [x] Services use console.error instead of logError | `apSessionService.js`, `apTestService.js` | P3 — Done 2026-03-07
- [x] No error type differentiation (network vs auth vs validation) | services | P3 — Done 2026-03-07 (classifyError)
- [x] No user-facing message for auth/permission errors | services | P3 — Done 2026-03-07 (getUserMessage)
- [x] No user-facing message for validation errors | services | P3 — Done 2026-03-07 (getUserMessage)
- [x] No user-facing timeout message ("Taking too long...") | services | P3 — Done 2026-03-07 (getUserMessage)
- [x] logError doesn't auto-extract sessionId/userId from context | `logError.js` | P3 — Done 2026-03-07 (context param accepts sessionId/userId)

---

### Section 7: UI Components

- [x] ~~Menu button [hamburger]~~ (Fixed: SVG icon + TestSessionMenu)
- [x] ~~"Next" button should show "Review" on last question~~ | `QuestionNavigator.jsx` | P1 — Done 2026-03-07
- [x] ~~"Reconnected" message should auto-dismiss after 2s~~ | `ConnectionStatus.jsx` | P1 — Done 2026-03-07
- [x] ~~Submit progress modal~~ (Fixed: SubmitProgressModal.jsx)
- [x] "View Report" should use icon instead of text in student table | `StudentResultsTable.jsx` | P3 — Done 2026-03-07

---

### Section 8: FRQ & Grading

- [x] ~~InstructionScreen: show FRQ submission mode info (typed vs handwritten)~~ | `InstructionScreen.jsx` | P1 — Done 2026-03-07
- [x] ~~Answer sheet PDF: AP logo not included~~ | `generateAnswerSheetPdf.js` | P2 — Done 2026-03-07
- [x] Answer sheet PDF: stimulus text truncated to 500 chars, no images | `generateAnswerSheetPdf.js` | P3 — Already implemented (500-char substring + text-only stimulus)
- [x] ~~Image compression before upload~~ | `imageProcessing.js` | P2 — Done 2026-03-07
- [x] Client-side image preview before upload (createObjectURL) | `FileUpload.jsx` | P3 — Done 2026-03-10 (localPreviews with URL.createObjectURL, cleanup on unmount)
- [ ] Student FRQ mode choice → BY DESIGN: teacher controls this | N/A | CLOSED

---

### Section 9: Report Card

- [x] ~~[Download Report PDF] button~~ | `APReportCard.jsx` | P1 — Done 2026-03-07
- [x] ~~Class name in report header~~ | `APReportCard.jsx` | P1 — Done 2026-03-07
- [x] ~~Domain column in MCQ results table~~ | `APReportCard.jsx`, `apScoringService.js` | P1 — Done 2026-03-07
- [x] ~~Topic column in MCQ results table~~ | `APReportCard.jsx`, `apScoringService.js` | P1 — Done 2026-03-07
- [x] FRQ weighted score display (not just raw) | `APReportCard.jsx` | P2 — Done 2026-03-07
- [x] Flagged questions: show list not just count | `APReportCard.jsx` | P3 — Done 2026-03-07

---

### Section 10: Analytics

- [x] ~~[Download Questions PDF] button in MCQ grid~~ | `APExamAnalytics.jsx` | P1 — Done 2026-03-07
- [x] ~~[Download PDF] button in FRQ section~~ | `APExamAnalytics.jsx` | P1 — Done 2026-03-07
- [x] "View Report" → icon instead of text | `StudentResultsTable.jsx` | P3 — Done 2026-03-07
- [x] ~~APStudentProfile page + route~~ | `APStudentProfile.jsx`, `routes.jsx` | P2 — Done 2026-03-07
- [x] ~~APStudentProfile: test history~~ | `APStudentProfile.jsx` | P2 — Done 2026-03-07
- [x] APStudentProfile: performance trends | NEW | P3 — Done 2026-03-07 (score trend bar chart)
- [x] APStudentProfile: strengths/weaknesses by domain | NEW | P3 — Done 2026-03-07 (domain analysis with strengths/weaknesses)

---

### Section 11: Teacher Workflow

- [x] ~~Question reordering within sections (up/down buttons)~~ | `APTestEditor.jsx` | P2 — Done 2026-03-07
- [x] Individual student search in AssignTestModal | `AssignTestModal.jsx` | P3 — Done 2026-03-07 (class search filter)
- [x] Gradebook: real-time updates via onSnapshot | `APGradebook.jsx` | P3 — Done 2026-03-07 (converted to onSnapshot)

---

### Section 12-13: Roles & Routes

- [x] ~~Role-based route protection (teacher vs student)~~ | `TeacherRoute.jsx`, `routes.jsx` | P0 — Done 2026-03-07
- [x] ~~Route: `/ap/teacher/test/new`~~ | `routes.jsx` | P0 — Done 2026-03-07
- [x] ~~Route: `/ap/teacher/student/:userId` → APStudentProfile~~ | `routes.jsx` | P2 — Done 2026-03-07
- [x] ~~Route: `/ap/teacher/classes` → class management~~ | `routes.jsx` | P2 — Done 2026-03-07
- [x] Route: `/ap/teacher/gradebook/:resultId` → gradebook with side-panel | `routes.jsx` | P3 — BY DESIGN: current gradebook covers this
- [x] Score ranges UI in APTestEditor | `APTestEditor.jsx` | P3 — Already exists (ScoreRangesEditor component)
- [x] ~~Class management page~~ | `APClassManager.jsx` | P2 — Done 2026-03-07

---

### Section 14: Code Organization

- [x] ~~performanceColors.js uses raw Tailwind (bg-green-500 etc.)~~ | `performanceColors.js` | P2 — Done 2026-03-07
- [x] ~~QuestionDetailModal uses raw Tailwind (bg-green-50 etc.)~~ | `QuestionDetailModal.jsx` | P2 — Done 2026-03-07
- [ ] No imports from /components/ui/ (Button, Modal) | 28 files | P3 — DEFERRED: incremental refactor
- [x] Services import from ../../firebase not ../../services/db | 8 services | P3 — BY DESIGN: db.js is VocaBoost-specific, not a generic wrapper

---

### Section 16-17: Hooks

- [x] ~~Heartbeat success should trigger queue flush~~ | `useHeartbeat.js` | P2 — Done 2026-03-07
- [x] ~~Opportunistic mode after 5 failures~~ | `useOfflineQueue.js` | P2 — Done 2026-03-07
- [x] ~~Visibilitychange queue flush trigger~~ | `useOfflineQueue.js` | P2 — Done 2026-03-07
- [x] HighlightRange type validation | `useAnnotations.js` | P3 — Done 2026-03-07 (range.start/end validation)
- [x] saveAnnotations() alias (currently exportAnnotations) | `useAnnotations.js` | P3 — Done 2026-03-07

---

### Section 18-19: Utilities

- [x] AP_SUBJECTS missing defaultTimeLimits per subject | `apTestConfig.js` | P3 — Done 2026-03-07
- [x] SECTION_TYPE_CONFIG extended config missing | `apTestConfig.js` | P3 — Done 2026-03-07
- [x] ~~AP logo in answer sheet PDF~~ | `generateAnswerSheetPdf.js` | P2 — Done 2026-03-07
- [x] ~~AP logo in report PDF~~ | `generateReportPdf.js` | P2 — Done 2026-03-07
- [x] ~~generateReportPdf returns jsPDF doc, should return Blob~~ | `generateReportPdf.js` | P2 — Done 2026-03-07
- [x] ~~generateQuestionsPdf returns jsPDF doc, should return Blob~~ | `generateQuestionsPdf.js` | P2 — Done 2026-03-07
- [x] ~~HEIC to JPEG conversion~~ | `imageProcessing.js` | P2 — Done 2026-03-07
- [x] ~~Image compression utility~~ | `imageProcessing.js` | P2 — Done 2026-03-07

---

### Section 19: Seed Data

- [x] ~~FRQ test with subQuestions array~~ | `seedTestData.js` | P1 — Done 2026-03-07
- [x] ~~Mixed MCQ+FRQ test~~ | `seedTestData.js` | P1 — Done 2026-03-07
- [x] ~~FRQ questions seeded~~ | `seedTestData.js` | P1 — Done 2026-03-07
- [x] ~~Sample ap_assignments document~~ | `seedTestData.js` | P1 — Done 2026-03-07
- [x] ~~Sample ap_classes document~~ | `seedTestData.js` | P1 — Done 2026-03-07

---

### Section 20: Phase Verification

- [x] Submit with pending queue shows sync progress (verify) | testing | P2 — Verified 2026-03-10 (SubmitProgressModal wired with queueLength & isSyncing)
- [ ] Cross-browser duplicate tab timing (verify) | testing | P3
- [x] ~~Annotations visible in review mode~~ | `ReviewScreen.jsx` | P2 — Done 2026-03-07
- [x] Question reordering via drag/buttons (verify) | testing | P2 — Verified 2026-03-10 (up/down arrow buttons in APTestEditor, persists via reorderSectionQuestions)

---

### Not Planned / Deferred

| Item | Decision | Reason |
|------|----------|--------|
| AI grading (OpenAI) | DEFERRED | Major feature, separate initiative |
| Student FRQ mode choice | BY DESIGN | Teacher control is intentional |
| IN_PROGRESS vs ACTIVE naming | RESOLVED | ACTIVE alias added |
| IndexedDB name (ap_boost_queue) | KEEP CURRENT | Rename breaks existing sessions |
| CONFIRMED queue status | SKIP | PENDING -> deleted is simpler |
| Resizable stimulus/question divider | DEFERRED | Optional UX enhancement |
| frqUploadedFiles naming | RESOLVED | Array better, aliases added |
| annotatedPdfUrl naming | RESOLVED | More descriptive, alias added |
| Answer object structure ({value, markedForReview}) | KEEP CURRENT | Separate flaggedQuestions array is cleaner |
| Click MCQ option text for strikethrough | BY DESIGN | Button approach is intentional |
| Optional user "Pause" button | DEFERRED | Not needed for MVP |
| Navigation immediate write (not queued) | BY DESIGN | Queue + beforeunload is sufficient |
| Section complete immediate write | BY DESIGN | SECTION_COMPLETE action queued with flush |
| Services import from db.js | BY DESIGN | db.js is VocaBoost-specific, not a generic Firestore wrapper |
| UI component imports from /components/ui/ | DEFERRED | Incremental refactor as files are touched |
| Gradebook side-panel route | BY DESIGN | Current gradebook layout covers this |
| B1-004: Unflag live verification | NOT A DEFECT | Code is correct (flags.delete); audit gap only — no code change needed |
| B10-002: Dev-mode ErrorBoundary test hook | SKIP | Developer tooling for auditors, not a production feature or bug |
| B11-001: Raw Tailwind highlight colors | BY DESIGN | No semantic design tokens for highlight colors; documented exception in useAnnotations.js |
| **Design Overhaul** | **DEFERRED** | Full UI/UX audit complete — buttons, cards, spacing, transitions, typography all need polish to match vocaBoost. See [design-overhaul/DESIGN_OVERHAUL_PLAN.md](design-overhaul/DESIGN_OVERHAUL_PLAN.md) |
| Review screen layout unification | DEFERRED | Review screen should use the same layout as question pages (header, Back/Next nav, navigator). Only the content area changes to show the review grid/summary. Currently it's a standalone full-page component with its own layout and no Back/Next buttons. |
| **App Entry Screen** (post-login chooser for AP vs Voca) | DEFERRED | Login currently redirects to `/` for all users. Consider: (1) Post-login entry screen letting students choose AP or VocaBoost, (2) Separate AP-specific login pages under `/ap/login`, (3) In-app navigation/switcher between VocaBoost and apBoost |
| Cross-app navigation (VocaBoost ↔ apBoost) | DEFERRED | No way to switch between apps once logged in. Future: add nav link/switcher in both app headers |

---

## Recommended Execution Order

### Sprint Overview (Updated 2026-03-07 after verification)

> Items #1, #2, #4 verified as DONE. Remaining: **29 active items** across 5 sprints.
> See **Execution Plan** section at bottom for detailed per-task instructions.

| Sprint | Focus | Items | Key Deliverables |
|--------|-------|-------|-----------------|
| 1 | Security & Routing (P0) | 3 | Role-based routes, /test/new route, queue reconciliation |
| 2 | Student Experience (P1) | 8 | PDF download, report columns, seed data, UX polish |
| 3 | Teacher Experience (P1-P2) | 5 | Analytics PDF, question reorder, class management, student profile |
| 4 | Resilience (P2) | 6 | Heartbeat flush, opportunistic retry, image compression |
| 5 | PDF & Polish (P2-P3) | 7+ | PDF logos, return types, backlog items |

---

## Reference: File Locations

### Criteria Audit Files
`src/apBoost/criteria_audit/section_X.X_to_X.X_criteria_audit.md`

### Fix Plans
`src/apBoost/criteria_audit/fix_plans/section_X.X_to_X.X_fix_plan.md`

### Codebase Facts
`src/apBoost/criteria_audit/fix_plans/CODEBASE_FACTS_X.X_to_X.X.md`

### Merged Fix Plans + Facts
`src/apBoost/criteria_audit/fix_plans/fix-plan-with-codebase-facts/X.X_to_X.X-fix-plan-with-codebase-facts.md`

### Change Log
`change_action_log_ap.md` (project root)

---

## Execution Plan (Written 2026-03-07)

> After verification, 3 P0 items were closed (already done). **29 active items remain** across 5 sprints.
> Each task includes: what to change, which files, and how to verify.

---

### Sprint 1: Security & Routing (P0) - 3 items

**Goal:** Make the app safe for real users.

#### Task 1.1: Role-based route protection (#6)
- **What:** Create `<TeacherRoute>` wrapper (or add `requiredRole` prop to PrivateRoute) that checks `user.role === 'teacher'`
- **Files:**
  - `src/components/PrivateRoute.jsx` - Add optional `role` prop, redirect non-teachers to `/ap`
  - `src/apBoost/routes.jsx` - Wrap all `/ap/teacher/*` and `/ap/gradebook` routes with role check
- **Verify:** Log in as student, navigate to `/ap/teacher` manually - should redirect to `/ap`

#### Task 1.2: Add `/ap/teacher/test/new` route (#3)
- **What:** Add route that creates a new test doc and redirects to the editor
- **Files:**
  - `src/apBoost/routes.jsx` - Add route for `/ap/teacher/test/new`
  - Option A: Point to APTestEditor with `isNew` prop (editor handles creation)
  - Option B: Create thin redirect component that calls `createTest()` then navigates to `/ap/teacher/test/:newId/edit`
- **Verify:** Click "Create New Test" on APTeacherDashboard - should create test and open editor

#### Task 1.3: Queue reconciliation on resume (#5)
- **What:** Before flushing queued items on reconnect, compare each item's timestamp against Firestore `lastAction`. Discard items older than server state.
- **Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` - Add `reconcileQueue(sessionId)` function called before `flushQueue`
  - `src/apBoost/services/apSessionService.js` - Add `getSessionTimestamp(sessionId)` helper
- **Verify:** Go offline, make changes, manually update Firestore with newer timestamp, come back online - stale items should be discarded

---

### Sprint 2: Student Experience (P1) - 8 items

**Goal:** Polish student-facing features.

#### Task 2.1: Wire Download Report PDF (#7)
- **What:** Add download button to APReportCard that calls `downloadReportPdf()`
- **Files:**
  - `src/apBoost/pages/APReportCard.jsx` - Import `downloadReportPdf` from utils, add button in header area
- **Verify:** View a completed test result, click download - PDF should download

#### Task 2.2: Domain/Topic columns in report (#8)
- **What:** Include domain/topic in mcqResults during scoring, display in report table
- **Files:**
  - `src/apBoost/services/apScoringService.js` - Add `questionDomain`, `questionTopic` to mcqResults objects in `createTestResult()`
  - `src/apBoost/pages/APReportCard.jsx` - Add Domain and Topic columns to MCQResultsTable
- **Verify:** Complete a test, view report - Domain/Topic columns visible with data

#### Task 2.3: Class name on report card (#14)
- **What:** Fetch class name from assignment/class data, display in report header
- **Files:**
  - `src/apBoost/pages/APReportCard.jsx` - Fetch class doc if `result.classId` exists, display name
- **Verify:** Complete an assigned test, view report - class name shown in header

#### Task 2.4: "Next" -> "Review" on last question (#12)
- **What:** Change Next button label when on last question
- **Files:**
  - `src/apBoost/components/QuestionNavigator.jsx` - Add `isLastQuestion` prop, conditionally render "Review" label
  - `src/apBoost/pages/APTestSession.jsx` - Compute and pass `isLastQuestion`
- **Verify:** Navigate to last question - button should say "Review" instead of "Next"

#### Task 2.5: Reconnection auto-dismiss (#13)
- **What:** Auto-hide "Reconnected" banner after 2 seconds
- **Files:**
  - `src/apBoost/components/ConnectionStatus.jsx` - Add `wasDisconnected` + `showReconnected` state, setTimeout to dismiss
- **Verify:** Go offline then online - "Reconnected" banner appears then fades after 2s

#### Task 2.6: InstructionScreen FRQ mode info (#10)
- **What:** Show FRQ submission type (typed vs handwritten) in instructions when test has FRQ
- **Files:**
  - `src/apBoost/components/InstructionScreen.jsx` - Add info box when test has FRQ sections, describing the submission mode
- **Verify:** Open instruction screen for FRQ test - see mode-specific instructions

#### Task 2.7: Review mode annotation display (#25)
- **What:** Show highlight/strikethrough indicators on question boxes in ReviewScreen
- **Files:**
  - `src/apBoost/components/ReviewScreen.jsx` - Accept annotations prop, show indicator (dot/icon) on questions that have annotations
- **Verify:** Highlight text during test, go to review - see annotation indicator on that question

#### Task 2.8: Seed data: FRQ + mixed tests (#11)
- **What:** Add FRQ test, mixed MCQ+FRQ test, sample class, and sample assignment to seed data
- **Files:**
  - `src/apBoost/utils/seedTestData.js` - Add FRQ questions (with subQuestions), FRQ-only test, mixed test, ap_classes doc, ap_assignments doc
- **Verify:** Run seed script - see 3 tests in dashboard (MCQ, FRQ, Mixed)

---

### Sprint 3: Teacher Experience (P1-P2) - 5 items

**Goal:** Complete teacher-facing workflows.

#### Task 3.1: Download PDF buttons in analytics (#9)
- **What:** Add "Export Questions PDF" button to APExamAnalytics
- **Files:**
  - `src/apBoost/pages/APExamAnalytics.jsx` - Import `downloadQuestionsPdf`, add button in header/toolbar
- **Verify:** Open analytics for a test, click export - PDF downloads with questions

#### Task 3.2: Question reordering in test editor (#19)
- **What:** Add up/down move buttons for questions within sections
- **Files:**
  - `src/apBoost/pages/APTestEditor.jsx` - Add move up/down buttons per question row, call `reorderSectionQuestions()` from apQuestionService
- **Verify:** Open test editor, move a question up/down - order persists after refresh

#### Task 3.3: Class management UI (#21)
- **What:** Create APClassManager page for teachers to create/edit classes and manage students
- **Files:**
  - `src/apBoost/pages/APClassManager.jsx` - New page with class list, create class form, student add/remove
  - `src/apBoost/routes.jsx` - Add `/ap/teacher/classes` route
  - `src/apBoost/pages/APTeacherDashboard.jsx` - Add "Manage Classes" link
- **Verify:** Navigate to class manager, create a class, add students - data persists

#### Task 3.4: APStudentProfile page (#20)
- **What:** Create student profile page showing all their test results for a class
- **Files:**
  - `src/apBoost/pages/APStudentProfile.jsx` - New page with student info, test history table, score trends
  - `src/apBoost/routes.jsx` - Add `/ap/teacher/student/:userId` route
- **Verify:** Click student name in analytics table - see their profile with test history

#### Task 3.5: Design token compliance (#22)
- **What:** Replace raw Tailwind colors with design tokens
- **Files:**
  - `src/apBoost/utils/performanceColors.js` - Replace `bg-green-500`, `bg-red-500`, etc. with `bg-success`, `bg-error`, etc.
  - `src/apBoost/components/analytics/QuestionDetailModal.jsx` - Replace `bg-green-50`, `text-green-700` with token equivalents
- **Verify:** Visual check - colors should look the same (tokens map to similar values)

---

### Sprint 4: Resilience (P2) - 6 items

**Goal:** Bulletproof the offline/sync layer.

#### Task 4.1: Heartbeat-triggered queue flush (#15)
- **What:** Flush offline queue when heartbeat succeeds after failures
- **Files:**
  - `src/apBoost/hooks/useHeartbeat.js` - Add `onRecovery` callback param, call it when connection restores
  - `src/apBoost/hooks/useTestSession.js` - Pass queue flush as onRecovery callback
- **Verify:** Go offline (heartbeat fails), come back - queue flushes immediately on next heartbeat success

#### Task 4.2: Opportunistic retry mode (#16)
- **What:** After backoff exhaustion, retry on next user action instead of giving up
- **Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` - Add `isOpportunistic` state, enter after max retries, trigger flush on next `addToQueue` call
- **Verify:** Force 5 failures, then answer a question - queue retries with the new answer

#### Task 4.3: Visibilitychange queue flush (#17)
- **What:** Flush queue when tab regains focus
- **Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` - Add `visibilitychange` listener, call `scheduleFlush` when `document.visibilityState === 'visible'`
- **Verify:** Queue items while tab is backgrounded, switch back - items flush

#### Task 4.4: QuotaExceededError handling (#18)
- **What:** Catch IndexedDB quota errors, show UI warning
- **Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` - Wrap IDB operations in try/catch for QuotaExceededError, expose `isStorageFull` state
  - `src/apBoost/components/ConnectionStatus.jsx` - Show storage full warning banner
- **Verify:** Hard to test naturally - unit test the error handling path

#### Task 4.5: Image compression before upload (#23)
- **What:** Compress images client-side before Firebase Storage upload
- **Files:**
  - `src/apBoost/utils/imageProcessing.js` - New utility with `compressImage(file, maxWidth, quality)` using canvas
  - `src/apBoost/components/FileUpload.jsx` - Call compressImage before upload for image files
- **Verify:** Upload a 5MB photo - uploaded file should be significantly smaller

#### Task 4.6: HEIC to JPEG conversion (#24)
- **What:** Convert HEIC files to JPEG before upload using heic2any
- **Files:**
  - `package.json` - Add `heic2any` dependency
  - `src/apBoost/utils/imageProcessing.js` - Add `convertHeicToJpeg(file)` with dynamic import
  - `src/apBoost/components/FileUpload.jsx` - Convert HEIC files before processing
- **Verify:** Upload a .heic file - should convert and upload as JPEG

---

### Sprint 5: PDF & Polish (P2-P3) - 4 items

**Goal:** Complete PDF features and minor polish.

#### Task 5.1: PDF logo embedding (#26)
- **What:** Add AP logo to generated PDFs
- **Files:**
  - `src/apBoost/utils/generateAnswerSheetPdf.js` - Load logo from `/apBoost/ap-boost-logo.png`, add via `doc.addImage()`
  - `src/apBoost/utils/generateReportPdf.js` - Same logo embedding
- **Verify:** Generate PDFs - logo visible in header

#### Task 5.2: PDF return type consistency (#27)
- **What:** Standardize all PDF generators to return Blob
- **Files:**
  - `src/apBoost/utils/generateReportPdf.js` - Change to return `doc.output('blob')`
  - `src/apBoost/utils/generateQuestionsPdf.js` - Same change
- **Verify:** All download functions work consistently

#### Task 5.3: Remaining low-priority items (#28-35)
- UI component reuse (28) - Large refactor, do incrementally as files are touched
- Service imports from db.js (29) - Update 8 service files to use retry-enabled db
- Debounce timing (30) - Change 1s to 2.5s in useOfflineQueue
- Firestore security rules (32) - Write and deploy rules for ap_* collections
- Accessibility (33) - Add ARIA labels, focus management incrementally
- Pagination (34) - Add cursor-based pagination to question bank
- Real-time gradebook (35) - Switch getDocs to onSnapshot in APGradebook

#### Task 5.4: Final verification pass
- Run through all 20 phase verification checklists in criteria_audit
- Update tracker with final pass/fail counts
- Mark all completed items

---

## Future: MathJax Integration & Full Seed Data (Post-P3) — COMPLETED 2026-03-07

> ~~Saved from planning session 2026-03-07. Execute after P3 backlog is cleared.~~

### Phase A: MathJax Integration
- Install `better-react-mathjax` (React wrapper for MathJax 3)
- Create `<MathText>` component — renders LaTeX delimiters (`$...$` inline, `$$...$$` display)
- Integrate into question rendering (~4 insertion points):
  - `QuestionDisplay.jsx` — question text
  - `AnswerInput.jsx` — MCQ choice text
  - `FRQQuestionDisplay.jsx` — FRQ prompt/sub-question text
  - `PassageDisplay.jsx` — stimulus content
- Wrap app (or AP routes) in `<MathJaxContext>`

### Phase B: Full Realistic Seed Data
- **3 full tests** (~15-20 questions each):
  - AP Microeconomics (MCQ + FRQ)
  - AP Macroeconomics (MCQ + FRQ)
  - AP Calculus AB (MCQ + FRQ, with LaTeX math notation)
- **Teacher accounts**: 1 teacher (use current user's UID), Firestore profile docs
- **Student accounts**: 5 fake students with Firestore profile docs (actual Auth accounts created manually in Firebase Console or via Admin SDK)
- **Classes**: 2 classes (Econ Period 1, Calc Period 3) with teacher + students linked
- **Assignments**: Tests assigned to classes
- **Completed test results**: Simulated results for students with varied scores (so analytics/gradebook pages have data)
- **FRQ grades**: Mix of graded + pending (so grading workflow can be tested)
- **Session states**: Completed sessions for score reports

### Notes
- Firebase Auth accounts can't be created client-side without signing each in — use Firebase Console or Admin SDK script for real Auth accounts
- Seed script is idempotent (uses `setDoc` with fixed IDs)
- Existing seed script at `src/apBoost/utils/seedTestData.js` will be extended

---

## Changelog

### Sprint 3 — 2026-03-07: Teacher Experience (P1-P2)
- **APExamAnalytics.jsx**: Added "Export Questions PDF" and "Export with Answers" buttons
- **APTestEditor.jsx**: Added question reorder (▲/▼) buttons with `handleMoveQuestion` and `reorderSectionQuestions`
- **apTeacherService.js**: Added class CRUD: `createClass`, `updateClass`, `deleteClass`, `addStudentToClass`, `removeStudentFromClass`
- **APClassManager.jsx**: Created class management page (class list, create form, student add/remove)
- **routes.jsx**: Added `/ap/teacher/classes` and `/ap/teacher/student/:userId` routes
- **APTeacherDashboard.jsx**: Added "Manage Classes" quick action
- **APStudentProfile.jsx**: Created student profile page with test history table
- **performanceColors.js**: Replaced all raw Tailwind colors with design tokens
- **QuestionDetailModal.jsx**: Replaced raw Tailwind colors with design tokens
- **Criteria resolved**: 11 items checked off (2× P1, 7× P2, 2× P2)

### Sprint 4 — 2026-03-07: Resilience (P2)
- **useHeartbeat.js**: Added `onRecovery` callback, triggers queue flush when connection restores after failures
- **useTestSession.js**: Passed `flushQueue` as `onRecovery` to useHeartbeat; exposed `isStorageFull`
- **useOfflineQueue.js**: Added opportunistic retry mode (enters after 5 failures, retries on next user action)
- **useOfflineQueue.js**: Added `visibilitychange` listener to flush queue when tab regains focus
- **useOfflineQueue.js**: Added `QuotaExceededError` detection with `isStorageFull` state
- **ConnectionStatus.jsx**: Added `isStorageFull` prop with error banner
- **APTestSession.jsx**: Wired `isStorageFull` through to ConnectionStatus
- **imageProcessing.js**: Created utility with `compressImage` (canvas-based), `convertHeicToJpeg` (dynamic import), `processImageFile`
- **FileUpload.jsx**: Integrated `processImageFile` for automatic compression and HEIC conversion before upload
- **Criteria resolved**: 10 items checked off (all P2)

### Sprint 5 — 2026-03-07: PDF & Polish (P2-P3)
- **pdfLogo.js**: Created shared logo loader with base64 caching
- **generateAnswerSheetPdf.js**: Added AP logo to header
- **generateReportPdf.js**: Added AP logo; changed return type from jsPDF→Blob; updated download function
- **generateQuestionsPdf.js**: Added AP logo to title page; changed return type from jsPDF→Blob; updated download function
- **useOfflineQueue.js**: Changed debounce from 1s to 2.5s per spec
- **Criteria resolved**: 6 items checked off (5× P2, 1× P3)

### Sprint 6 — 2026-03-07: P3 Backlog Completion
- **useOfflineQueue.js**: Added SECTION_COMPLETE and SESSION_PAUSE action handlers
- **useTestSession.js**: Updated beforeunload to warn on IN_PROGRESS status
- **ConnectionStatus.jsx**: Added extended offline warning (5+ minutes) with error-severity banner
- **apSessionService.js**: Replaced all 10 console.error calls with contextual logError()
- **apTestService.js**: Replaced all 6 console.error calls with contextual logError()
- **logError.js**: Added classifyError() (auth/permission/not_found/network/quota/validation) and getUserMessage()
- **APReportCard.jsx**: Added FRQ weighted score display, flagged questions list with correct/incorrect indicators, domain performance analysis with percentage bars
- **APStudentProfile.jsx**: Added score trend bar chart and domain analysis (strengths/weaknesses)
- **StudentResultsTable.jsx**: Changed "View Report" text link to document SVG icon
- **AssignTestModal.jsx**: Added class search filter (shown when >3 classes)
- **APGradebook.jsx**: Converted from getDocs to onSnapshot for real-time updates
- **useAnnotations.js**: Added HighlightRange validation; added saveAnnotations alias
- **apTestConfig.js**: Added defaultTimeLimits to all subjects; added 4 new subjects (Micro, Macro, Calc AB, Calc BC); added SECTION_TYPE_CONFIG
- **firestore.indexes.json**: Added 5 composite indexes (questions×2, results, questions-createdBy, stimuli)
- **Criteria resolved**: 30+ items checked off across sections 3, 5, 6, 7, 9, 10, 11, 12-13, 14, 16-17, 18-19

### Sprint 7 — 2026-03-07: MathJax Integration & Full Seed Data
- **package.json**: Added `better-react-mathjax` dependency
- **MathText.jsx**: Created component — detects LaTeX delimiters, renders via MathJax 3, falls back to plain text
- **APMathProvider.jsx**: Created MathJaxContext wrapper with tex inline/display config
- **routes.jsx**: Wrapped all AP routes in APLayout with MathJaxContext via layout route (Outlet)
- **QuestionDisplay.jsx**: MathText on question text + stimulus content (3 locations)
- **AnswerInput.jsx**: MathText on MCQ choice text
- **FRQQuestionDisplay.jsx**: MathText on question text, stimulus content, sub-question prompts (6 locations)
- **PassageDisplay.jsx**: MathText on stimulus title
- **seedFullData.js**: Created comprehensive seed script:
  - 3 full tests: AP Micro (15 MCQ + 2 FRQ), AP Macro (15 MCQ + 2 FRQ), AP Calc AB (15 MCQ + 2 FRQ with LaTeX math)
  - 51 total questions with realistic content, domains, topics, explanations
  - 1 teacher profile + 5 student profiles
  - 2 classes (Econ Period 1, Calc Period 3) with all students linked
  - 3 assignments (one per test)
  - 13 test results with varied scores (85%, 72%, 60%, 45%, 90% correct rates)
  - Mix of GRADED and PENDING FRQ statuses for grading workflow testing
