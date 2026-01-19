# apBoost Acceptance Criteria - Exhaustive List

## 1. Core Features & Question Types

### 1.1 Timed Sections
- [ ] Each section has its own countdown timer
- [ ] Timer displays in MM:SS format in the header
- [ ] Timer updates every second
- [ ] Timer pauses when user clicks "Pause" (if enabled)
- [ ] Timer pauses when browser/tab closes (via beforeunload)
- [ ] Timer pauses on mobile when app backgrounded >30 seconds
- [ ] Timer continues when tab is backgrounded on desktop
- [ ] Timer continues during network disconnect
- [ ] Timer syncs to Firestore every 30 seconds
- [ ] When timer expires, section auto-submits
- [ ] Timer expiration while offline queues auto-submit action

### 1.2 Question Flagging
- [ ] Each question has a flag toggle button
- [ ] Clicking flag icon toggles the flag state
- [ ] Flagged questions show 🚩 icon in Question Navigator
- [ ] Flagged questions listed separately in Review Screen summary
- [ ] Flag state persists across question navigation
- [ ] Flag state syncs to Firestore (debounced 2-3s)
- [ ] Flag state survives browser refresh/crash (via IndexedDB queue)
- [ ] Flagging does NOT affect scoring

### 1.3 Highlighter Tool
- [ ] Highlighter button appears in tool area for stimulus content
- [ ] Click and drag to highlight text in stimulus
- [ ] Default highlight color is yellow
- [ ] Color options available: yellow, green, pink, blue
- [ ] Click highlighted text to remove highlight
- [ ] Multiple highlights allowed per question
- [ ] Highlights persist across question navigation
- [ ] Highlights sync to Firestore (debounced)
- [ ] Highlights survive browser refresh/crash
- [ ] Highlights visible in review mode (read-only)
- [ ] Uses window.getSelection() to detect selected text
- [ ] Calculates character offsets from selection
- [ ] HighlightRange stores: start, end, color
- [ ] Wraps text in spans based on highlight ranges
- [ ] Handles overlapping highlights gracefully
- [ ] Color CSS: yellow-200, green-200, pink-200, blue-200
- [ ] Select text → color picker popup appears
- [ ] Color picker shows 4 color swatches

### 1.4 Strikethrough Tool
- [ ] Click MCQ answer option to toggle strikethrough
- [ ] Struck-through options show gray text with line through
- [ ] Can still select a struck-through option
- [ ] Strikethrough persists across question navigation
- [ ] Strikethrough syncs to Firestore (debounced)
- [ ] Strikethrough survives browser refresh/crash
- [ ] Strikethrough visible in review mode
- [ ] Small "X" button next to each MCQ option (or right-click)
- [ ] Toggle behavior: click once = strikethrough, click again = remove
- [ ] Styling: text-decoration: line-through, color: text-muted, opacity: 0.6
- [ ] Strikethrough does NOT affect ability to select option

### 1.5 Line Reader Tool
- [ ] Toggle button activates line reader overlay
- [ ] Only current line(s) visible through overlay
- [ ] Configurable: 1-3 visible lines
- [ ] Drag overlay to move position
- [ ] Arrow keys move the focus line
- [ ] Works on long passages
- [ ] Darkened overlay above and below focus area
- [ ] Clear/focused area shows current line(s)
- [ ] Click on overlay repositions focus
- [ ] Absolute positioned with pointer-events: none for clear area
- [ ] Tracks scroll position to maintain relative position
- [ ] Settings button to change visible line count

### 1.6 Section Locking
- [ ] Cannot navigate back to previous sections
- [ ] currentSectionIndex only increments, never decrements
- [ ] "Back" button disabled on first question of a section (if previous section exists)
- [ ] Clear visual indication that previous section is locked
- [ ] Matches real Bluebook behavior

### 1.7 Session Persistence (Resume Tests)
- [ ] Closing browser mid-test sets status to PAUSED
- [ ] Reopening test shows "Resume" prompt
- [ ] Resume restores exact question position (currentSectionIndex, currentQuestionIndex)
- [ ] Resume restores all answer selections
- [ ] Resume restores timer state (remaining time)
- [ ] Resume restores all annotations (highlights, strikethroughs)
- [ ] Resume restores flag states

### 1.8 Instruction Screen (Pre-Test)
- [ ] InstructionScreen component displays before test starts
- [ ] Shows test title and subject
- [ ] Lists all sections with: name, question count, time limit
- [ ] Shows total test time (calculated from sections)
- [ ] Warning: "Once you begin, you cannot pause the timer"
- [ ] Warning: "You cannot return to previous sections"
- [ ] "Begin Test" button starts the test
- [ ] "Cancel" button returns to dashboard
- [ ] If resuming: Shows "Resume Test" with position summary (Section X, Question Y)

### 1.9 Test Dashboard (APDashboard)
- [ ] Fetches available tests for current user
- [ ] Displays tests as card grid (responsive: 1/2/3 columns)
- [ ] TestCard shows: test name, subject, total time, section count
- [ ] TestCard shows assignment info if applicable: due date, max attempts
- [ ] TestCard shows session status if in progress
- [ ] Status badges: "Not Started" (gray), "In Progress" (blue), "Completed" (green)
- [ ] Click card navigates to InstructionScreen
- [ ] Loading state shows skeleton cards
- [ ] Empty state if no tests available

### 1.10 APTestSession Page States
- [ ] State: `loading` - Shows SessionSkeleton component
- [ ] State: `instruction` - Shows InstructionScreen component
- [ ] State: `testing` - Shows main test interface (Question + Navigator)
- [ ] State: `review` - Shows ReviewScreen (full page)
- [ ] State: `submitting` - Shows submit progress modal
- [ ] Orchestrates: useTestSession, useTimer, useAnnotations, useDuplicateTabGuard
- [ ] Layout: Header, Question area, Bottom navigation bar
- [ ] Header shows: Section X of Y, section type, timer, menu button

### 1.11 PassageDisplay Component
- [ ] Displays stimulus content (text, image, passage)
- [ ] Integrates highlighter tool
- [ ] Integrates line reader overlay
- [ ] Toolbar: [Highlight color picker] [Line Reader toggle] [Clear All]
- [ ] Scrollable if content exceeds viewport
- [ ] Only shows in HORIZONTAL layout questions

### 1.12 ToolsToolbar Component
- [ ] Floating toolbar for tool controls
- [ ] Highlighter dropdown with 4 color swatches
- [ ] Line reader toggle button with icon
- [ ] Clear all highlights button
- [ ] Shows current highlight color as selected

---

## 2. Question Types

### 2.1 MCQ (Multiple Choice - Single Answer)
- [ ] Displays question text
- [ ] Displays 4-10 answer options (A through J)
- [ ] Options support text content
- [ ] Options support images (with alt text)
- [ ] Clicking option selects it (radio button behavior)
- [ ] Only one option can be selected
- [ ] Selected option visually highlighted
- [ ] Selection syncs to Firestore
- [ ] Auto-scored on test submit
- [ ] correctAnswers array contains single value (e.g., ["B"])

### 2.2 MCQ_MULTI (Multiple Choice - Multiple Answers)
- [ ] Displays question text
- [ ] Displays answer options with checkboxes
- [ ] Multiple options can be selected simultaneously
- [ ] correctAnswers array contains multiple values (e.g., ["A", "C"])
- [ ] If partialCredit: true, partial points awarded for partially correct selections
- [ ] If partialCredit: false, must select exactly the correct options for credit

### 2.3 FRQ (Free Response Questions)
- [ ] Displays question text with optional stimulus
- [ ] Supports subQuestions (parts a, b, c, etc.)
- [ ] Each subQuestion has: label, questionText, points, rubric
- [ ] For TYPED mode: text area input for each part
- [ ] For HANDWRITTEN mode: generates printable answer sheet PDF
- [ ] Answer sheet includes stimulus text/images
- [ ] Answer sheet has lined writing space for each part
- [ ] Student can upload scanned handwritten answer (PDF, JPG, PNG, HEIC, WebP)
- [ ] Multiple files can be uploaded and combined
- [ ] Uploaded files stored in Firebase Storage
- [ ] FRQ requires manual/AI grading (gradingStatus: PENDING)
- [ ] Teacher can grade each subQuestion independently
- [ ] Teacher can add comments per question
- [ ] Teacher can upload annotated PDF with feedback

### 2.3.1 FRQ Sub-Question Navigation (Critical)
- [ ] Each FRQ sub-question is a SEPARATE page/screen
- [ ] Navigation flow: Q1(a) → Q1(b) → Q1(c) → Q2(a) → Q2(b)...
- [ ] Full question prompt reprinted on each sub-question page
- [ ] Current sub-question visually highlighted
- [ ] Points displayed for current sub-question
- [ ] Navigator shows FLAT list of sub-questions: "1a 1b 1c 2a 2b 2c"
- [ ] Position tracking includes: sectionIndex, questionIndex, subQuestionLabel
- [ ] subQuestionLabel is null for MCQ questions
- [ ] goNext() handles sub-question advancement before question advancement
- [ ] goPrevious() handles sub-question navigation
- [ ] computeFlatIndex() calculates position across all sub-questions

### 2.3.2 FRQTextInput Component
- [ ] Auto-resize textarea (grows with content)
- [ ] Minimum height: 150px
- [ ] Maximum height: 400px (scrolls after)
- [ ] Optional character count display
- [ ] Placeholder: "Type your response here..."
- [ ] Saves on blur event
- [ ] Debounced save while typing
- [ ] Border uses design token: border-border-default
- [ ] Focus ring: ring-2 ring-brand-primary

### 2.4 SAQ (Short Answer Questions)
- [ ] Displays question text
- [ ] Single text area for response
- [ ] Requires manual grading

### 2.5 DBQ (Document-Based Questions)
- [ ] Displays multiple documents as stimulus
- [ ] Requires analysis of provided documents
- [ ] Requires manual grading

---

## 3. Data Model & Firestore

### 3.1 ap_tests Collection
- [ ] Contains: title, subject, testType, createdBy, isPublic
- [ ] testType: "EXAM" (full test) or "MODULE" (practice 1-2 sections)
- [ ] questionOrder: "FIXED" or "RANDOMIZED"
- [ ] sections array with: id, title, sectionType, timeLimit, questionIds
- [ ] sections include calculatorEnabled boolean (for future Desmos)
- [ ] MCQ sections have mcqMultiplier (single value)
- [ ] FRQ sections have frqMultipliers object (per-question)
- [ ] scoreRanges object for AP 1-5 conversion (customizable)
- [ ] totalTime is CALCULATED (not stored) from sum of sections
- [ ] createdAt and updatedAt timestamps

### 3.2 ap_stimuli Collection
- [ ] Supports shared stimuli across questions
- [ ] type: TEXT, IMAGE, PASSAGE, DOCUMENT, CHART
- [ ] content: text content or image URL
- [ ] title and source for reference/citation
- [ ] imageAlt for accessibility
- [ ] tags for filtering/search

### 3.3 ap_questions Collection
- [ ] testId can be null (question bank item)
- [ ] questionType: MCQ, MCQ_MULTI, FRQ, SAQ, DBQ
- [ ] questionDomain: unit (e.g., "Unit 3: Colonial America")
- [ ] questionTopic: specific topic within unit
- [ ] difficulty: EASY, MEDIUM, HARD
- [ ] format: VERTICAL (no stimulus) or HORIZONTAL (with stimulus)
- [ ] Can use stimulusId (shared) or inline stimulus object
- [ ] choiceA through choiceJ objects with text, imageUrl, imageAlt
- [ ] choiceCount auto-calculated
- [ ] correctAnswers array
- [ ] partialCredit boolean for MCQ_MULTI
- [ ] explanation for rationale after grading
- [ ] rubric for FRQ/SAQ/DBQ scoring guidelines
- [ ] points (base points before multiplier)
- [ ] subQuestions array for multi-part FRQ
- [ ] tags for filtering/search

### 3.4 ap_session_state Collection
- [ ] userId and testId references
- [ ] sessionToken for duplicate detection (unique per session)
- [ ] status: ACTIVE, PAUSED, COMPLETED
- [ ] currentSectionIndex and currentQuestionIndex
- [ ] sectionTimeRemaining object (seconds per section)
- [ ] answers object with value and markedForReview per question
- [ ] annotations object with highlights per question
- [ ] strikethroughs object with struck options per question
- [ ] lastHeartbeat timestamp
- [ ] lastAction timestamp
- [ ] startedAt and completedAt timestamps

### 3.5 ap_test_results Collection
- [ ] userId, testId, classId, assignmentId references
- [ ] attemptNumber (1, 2, or 3)
- [ ] isFirstAttempt boolean (for stats)
- [ ] sessionId reference
- [ ] answers object (MCQ: string, FRQ: object with parts)
- [ ] score, maxScore, percentage, apScore (1-5)
- [ ] sectionScores object with correct/total/points per section
- [ ] frqSubmissionType: TYPED, HANDWRITTEN, or null
- [ ] frqUploadUrl for student's scanned answer
- [ ] frqGradedPdfUrl for teacher's annotated PDF
- [ ] frqGrades object with subScores and comments per question
- [ ] gradingStatus: NOT_NEEDED, PENDING, IN_PROGRESS, COMPLETE
- [ ] startedAt, completedAt, gradedAt timestamps

### 3.6 ap_classes Collection
- [ ] name, subject, teacherId
- [ ] studentIds array
- [ ] createdAt and updatedAt timestamps
- [ ] Assignments stored separately in ap_assignments

### 3.7 ap_assignments Collection
- [ ] testId and classId references
- [ ] studentIds array (explicit list)
- [ ] dueDate (optional)
- [ ] maxAttempts (default: 3)
- [ ] assignedAt timestamp and assignedBy userId
- [ ] Only students in studentIds can access
- [ ] New students joining class do NOT auto-get old assignments

### 3.8 Firestore Indexes
- [ ] ap_session_state: userId + status
- [ ] ap_session_state: sessionToken
- [ ] ap_test_results: userId + testId + classId
- [ ] ap_test_results: testId + completedAt
- [ ] ap_test_results: userId + isFirstAttempt
- [ ] ap_assignments: classId + studentIds
- [ ] ap_assignments: testId
- [ ] ap_classes: teacherId
- [ ] ap_classes: studentIds
- [ ] ap_questions: subject + tags
- [ ] ap_questions: subject + questionDomain
- [ ] ap_questions: difficulty + questionType
- [ ] ap_stimuli: subject + tags

---

## 4. Scoring System

### 4.1 Score Calculation Flow
- [ ] Step 1: Calculate RAW SCORE per section (MCQ: count correct, FRQ: sum graded points)
- [ ] Step 2: Apply MULTIPLIERS (MCQ section × mcqMultiplier, FRQ questions × individual frqMultipliers)
- [ ] Step 3: Calculate TOTAL weighted score (sum all weighted section scores)
- [ ] Step 4: Convert to PERCENTAGE (totalWeighted / maxWeighted × 100)
- [ ] Step 5: Map to AP SCORE (1-5) using test.scoreRanges

### 4.2 MCQ Scoring
- [ ] 1 point per correct answer (before multiplier)
- [ ] 0 points for incorrect or unanswered
- [ ] Apply section's mcqMultiplier to raw score
- [ ] Auto-scored immediately on test submit

### 4.3 MCQ_MULTI Partial Credit
- [ ] If partialCredit: false, all-or-nothing scoring
- [ ] If partialCredit: true, partial points based on formula (TBD)
- [ ] Formula considers: correct selections, incorrect selections, missed answers

### 4.4 FRQ Sub-Question Scoring
- [ ] Each subQuestion graded independently
- [ ] subScores object stores points per part (e.g., {a: 2, b: 3, c: 1})
- [ ] Total FRQ question score = sum of subScores
- [ ] Apply question's frqMultiplier to total
- [ ] Requires teacher/AI grading

### 4.5 AP Score Conversion
- [ ] Uses test.scoreRanges object
- [ ] Customizable ranges per test
- [ ] Default ranges: ap5: 80-100%, ap4: 65-79%, ap3: 50-64%, ap2: 35-49%, ap1: 0-34%
- [ ] Percentage falls within range → maps to AP score

---

## 5. Session State Management

### 5.1 Core Sync Strategy
- [ ] Firestore-first architecture (server is source of truth)
- [ ] Local storage (IndexedDB) is write-ahead queue only
- [ ] Answer change: debounced write (2-3s batch)
- [ ] Flag toggle: debounced write (2-3s batch)
- [ ] Annotation: debounced write (2-3s batch)
- [ ] Strikethrough: debounced write (2-3s batch)
- [ ] Question navigation: immediate write
- [ ] Section complete: immediate write
- [ ] Timer tick: local only, Firestore update every 30s
- [ ] beforeunload: set status → PAUSED immediately
- [ ] Test submission: immediate write

### 5.2 Write-Ahead Queue (IndexedDB)
- [ ] Queue schema: id, sessionId, localTimestamp, action, payload, status
- [ ] Action types: ANSWER_CHANGE, FLAG_TOGGLE, ANNOTATION_ADD, ANNOTATION_REMOVE, STRIKETHROUGH_TOGGLE, NAVIGATION, SECTION_COMPLETE, TIMER_SYNC, SESSION_PAUSE, SESSION_SUBMIT
- [ ] Status flow: PENDING → CONFIRMED → deleted
- [ ] All writes go through local queue before Firestore
- [ ] IndexedDB database name: ap_action_queue
- [ ] Queue persists after browser crash
- [ ] Queue handles concurrent writes safely
- [ ] Queue flushes automatically on reconnect

### 5.2.1 useOfflineQueue Hook
- [ ] Returns: addToQueue, flushQueue, queueLength, isOnline, isFlushing
- [ ] addToQueue(action) adds entry with PENDING status
- [ ] flushQueue() attempts to sync all pending items
- [ ] queueLength tracks number of pending items
- [ ] isOnline tracks navigator.onLine status
- [ ] isFlushing indicates sync in progress

### 5.3 Write Flow
- [ ] Step 1: Update React state (optimistic update - instant UI)
- [ ] Step 2: Write to IndexedDB queue with PENDING status
- [ ] Step 3: Debounce timer (2-3s) batches multiple actions
- [ ] Step 4: Write batch to Firestore
- [ ] On success: Delete from queue
- [ ] On failure: Keep in queue, retry later

### 5.4 Retry Strategy
- [ ] Exponential backoff: 2s → 4s → 8s → opportunistic mode
- [ ] After backoff exhausted, retry on:
  - [ ] Any user action
  - [ ] Network restored (online event)
  - [ ] Tab gains focus (visibilitychange)
  - [ ] Heartbeat succeeds

### 5.5 Heartbeat System
- [ ] Interval: 15 seconds
- [ ] Updates lastHeartbeat timestamp in Firestore
- [ ] Verifies sessionToken matches (detects tab takeover)
- [ ] On success: clear failure counter, attempt queue flush
- [ ] On failure: increment failure counter, retry up to 2 times
- [ ] After 3 consecutive failures: show "Connection unstable" banner
- [ ] On recovery: flush queued writes, hide banner

### 5.5.1 useHeartbeat Hook
- [ ] Accepts: sessionId, instanceToken
- [ ] Returns: isConnected, failureCount, lastHeartbeat
- [ ] isConnected false after 3 consecutive failures
- [ ] failureCount tracks consecutive failures
- [ ] lastHeartbeat is Date of last successful heartbeat
- [ ] Automatically attempts queue flush on success

### 5.6 Duplicate Tab Detection

#### 5.6.1 Token Architecture
- [ ] sessionId: identifies test attempt (Firestore + URL)
- [ ] sessionToken: current "owner" of session (Firestore, updated on takeover)
- [ ] instanceToken: identifies specific browser tab (memory only)

#### 5.6.2 Detection Methods
- [ ] BroadcastChannel API: same browser, instant detection
- [ ] Firestore token check: cross-browser, on heartbeat (≤15s)

#### 5.6.3 Behavior
- [ ] Same browser, new tab → first tab shows "moved" modal instantly
- [ ] Different browser → first browser shows modal within 15s
- [ ] Different device → first device shows modal within 15s
- [ ] Later tab ALWAYS wins
- [ ] First tab becomes read-only

### 5.6.4 useDuplicateTabGuard Hook
- [ ] Generates instanceToken with crypto.randomUUID() on mount
- [ ] Returns: instanceToken, isInvalidated, takeControl
- [ ] Creates BroadcastChannel: `ap_session_${sessionId}`
- [ ] Posts SESSION_CLAIMED message with token on mount
- [ ] Listens for SESSION_CLAIMED from other tabs
- [ ] Sets isInvalidated=true when different token detected
- [ ] takeControl() updates sessionToken in Firestore, broadcasts new claim
- [ ] Cleans up BroadcastChannel on unmount

### 5.7 Timer Behavior (Lenient Mode)
- [ ] Browser/tab closed → Timer pauses (beforeunload)
- [ ] Tab backgrounded (desktop) → Timer continues
- [ ] App backgrounded (mobile) >30s → Timer pauses
- [ ] Network disconnect → Timer continues locally
- [ ] User clicks "Pause" → Timer pauses (if enabled)
- [ ] Return to paused session → Show "Resume" prompt

### 5.8 Submit Flow

#### 5.8.1 Normal Submit (Queue Empty)
- [ ] Check queue.length === 0
- [ ] Write status: COMPLETED and completedAt to Firestore
- [ ] Create ap_test_results document
- [ ] Redirect to results page

#### 5.8.2 Submit with Pending Queue
- [ ] Show "Syncing your answers..." modal with progress
- [ ] Aggressive flush: retry every 2s
- [ ] On success: complete submit normally
- [ ] On failure for 30s+: show "Unable to sync" modal
- [ ] "Unable to sync" shows: keep tab open, check connection, keep trying
- [ ] [Keep Trying] button available
- [ ] No JSON backup option - user warned, their choice if they close

### 5.9 Session Resume Flow
- [ ] Load session from Firestore
- [ ] Check IndexedDB for pending queue items
- [ ] For each item: compare localTimestamp vs session.lastModified
- [ ] If item newer: apply to Firestore, delete from queue
- [ ] If item older: discard (stale)
- [ ] Use Firestore state (now authoritative)
- [ ] Show "Resume" modal if status was PAUSED

### 5.10 Conflict Resolution
- [ ] Firestore serverTimestamp() is authoritative
- [ ] Local timestamps for queue ordering only
- [ ] Local newer than Firestore → Apply local
- [ ] Firestore newer than local → Discard local
- [ ] Same timestamp → Last-write-wins (Firestore handles)

### 5.11 Data Loss Protection

#### Must Protect Against:
- [ ] Network blip (few seconds) → Queue + auto-retry
- [ ] Page refresh → beforeunload warning + resume
- [ ] Accidental tab close → beforeunload warning + resume
- [ ] Browser crash → IndexedDB persists + resume
- [ ] App/JS error → Error boundary + state preserved
- [ ] Server temporarily down → Queue locally + sync when back
- [ ] Slow connection → Loading states + generous timeouts

#### Acceptable Loss (With Warning):
- [ ] User ignores "don't close" warning → Data lost
- [ ] User clears browser data → Data lost
- [ ] User in incognito + closes → Data lost
- [ ] User offline entire test, never reconnects → Data lost
- [ ] User's device dies → Physical loss

### 5.12 Edge Cases
- [ ] Browser crash mid-IndexedDB write → Atomic transaction rollback
- [ ] Device storage full → Catch QuotaExceededError, try flush, show warning
- [ ] Timer expires offline → Queue auto-submit, complete on reconnect
- [ ] Two tabs race to write → Last-write-wins via sessionToken
- [ ] Firestore quota exceeded → Exponential backoff, notify user
- [ ] User's clock wildly wrong → Use serverTimestamp for Firestore

---

## 6. Error Handling

### 6.1 Core Principles
- [ ] No silent failures - every error logged with context
- [ ] Fail fast - detect errors at boundaries
- [ ] Never empty catch blocks - must log or rethrow
- [ ] Validate at boundaries - check data shape from external sources

### 6.2 React Error Boundary
- [ ] APErrorBoundary wraps test session
- [ ] Catches render crashes
- [ ] Shows ErrorFallback UI
- [ ] ErrorFallback shows: "Something went wrong" message
- [ ] ErrorFallback shows: "Try Again" button (resets error state)
- [ ] ErrorFallback shows: "Return to Dashboard" link
- [ ] ErrorFallback shows: "Your answers are saved locally" note

### 6.2.1 APErrorBoundary Implementation
- [ ] Uses React.Component class (not functional)
- [ ] state: { hasError: boolean, error: Error | null }
- [ ] static getDerivedStateFromError returns { hasError: true, error }
- [ ] componentDidCatch logs error with componentStack
- [ ] Render returns ErrorFallback if hasError, else children
- [ ] "Try Again" resets state to { hasError: false }

### 6.3 Async Function Pattern
- [ ] Guard clauses at top - fail fast on invalid input
- [ ] Try/catch wraps main logic
- [ ] Log with full context (functionName, parameters, error)
- [ ] Handle by error type:
  - [ ] Network error → Queue for retry
  - [ ] Auth/permission error → Return AUTH error
  - [ ] Unknown error → Rethrow for Error Boundary

### 6.4 logError Utility
- [ ] Logs: function name, context, message, code, stack, timestamp
- [ ] Includes sessionId and userId if available
- [ ] Console.error in development
- [ ] Production: ready for error tracking service (Sentry, etc.)

### 6.5 Null/Undefined Handling
- [ ] External data (Firestore): Validate shape explicitly
- [ ] User input: Validate + show error message
- [ ] Optional fields: ?? or ?. acceptable
- [ ] Function parameters: Guard clause at top
- [ ] validateSessionData function checks all required fields

### 6.6 Timeouts and Loading States
- [ ] Initial session load: 10s timeout, full-page skeleton
- [ ] Save answer: 10s timeout, none (optimistic)
- [ ] Heartbeat: 5s timeout, none (silent)
- [ ] Submit test: 30s timeout, modal with progress
- [ ] Load question bank: 15s timeout, skeleton list
- [ ] withTimeout wrapper available

### 6.7 Error Types and User Messages
- [ ] Network/offline → "Connection lost. Your work is saved locally."
- [ ] Auth/permission → "Session expired. Please log in again."
- [ ] Validation → "Something's wrong with this question. Skipping."
- [ ] Timeout → "Taking too long. Retrying..."
- [ ] Unknown → "Something went wrong. Your work is saved."

---

## 7. UI/UX

### 7.1 Question Display Formats

#### HORIZONTAL Layout (Two-Column - With Stimulus)
- [ ] Left panel: Stimulus (passage, image, document)
- [ ] Right panel: Question + Answers
- [ ] Left panel has tools: Highlighter, Line Reader
- [ ] Resizable divider between panels (optional)

#### VERTICAL Layout (One-Column - No Stimulus)
- [ ] Single centered column
- [ ] Question text at top
- [ ] Answer options below
- [ ] No stimulus area

### 7.2 Header
- [ ] AP Logo displayed
- [ ] Section X of Y indicator
- [ ] Section type (Multiple Choice, Free Response)
- [ ] Timer display (MM:SS)
- [ ] Menu button [≡]

### 7.3 Navigation System

#### Bottom Navigation Bar
- [ ] [◄ Back] button for previous question
- [ ] "Question X of Y ▲" is clickable - opens navigator modal
- [ ] [Next ►] button for next question
- [ ] Back disabled on first question of section
- [ ] Next disabled on last question (shows "Review" instead)

#### Question Navigator Modal (Slide-Up)
- [ ] Slides up from bottom when "Question X of Y" clicked
- [ ] Grid of question boxes (numbered)
- [ ] Box states:
  - [ ] Answered: ■ (filled/colored blue)
  - [ ] Unanswered: □ (empty/white)
  - [ ] Flagged: 🚩 (flag icon)
  - [ ] Current: highlighted border
- [ ] Click box → Navigate to that question, modal closes
- [ ] "Go to Review Screen" button
- [ ] X button or click outside → Close modal

### 7.4 Review Screen (Full Page)
- [ ] Full page (not modal)
- [ ] Header with section info and timer
- [ ] "Review Your Answers" title
- [ ] Grid of question boxes (same states as navigator modal)
- [ ] Summary section:
  - [ ] Answered: X/Y count
  - [ ] Unanswered: count + list (Q4, Q6, etc.)
  - [ ] Flagged for review: count + list
- [ ] Warning if unanswered questions exist
- [ ] [Return to Questions] button
- [ ] [Submit Section] or [Next Section] button
- [ ] Click question box → Navigate back to that question

### 7.5 Connection Status Banner
- [ ] Appears below header when connection lost
- [ ] Yellow/warning background
- [ ] Text: "⚠️ Connection unstable - your progress is being saved locally"
- [ ] Auto-dismisses when connection restored
- [ ] Shows "Reconnected - syncing..." briefly (2s) on recovery

### 7.6 Duplicate Tab Modal
- [ ] Modal displayed when session active elsewhere
- [ ] Title: "⚠️ Session Active Elsewhere"
- [ ] Message explains only one active session allowed
- [ ] [Use This Tab] button → Takes over session
- [ ] [Go to Dashboard] button → Navigates away

### 7.7 Connection Status UI States
- [ ] Connected: No banner, everything normal
- [ ] Retrying (1-2 failures): No banner (silent retry)
- [ ] Disconnected (3+ failures): "Connection unstable" banner
- [ ] Reconnected: "Reconnected - syncing..." (2s)
- [ ] Submit pending: Modal with progress bar
- [ ] Submit failed: Modal with "Keep Trying" button

---

## 8. FRQ Submission & Grading

### 8.1 FRQ Submission Modes
- [ ] Student chooses mode per test (all-or-nothing)
- [ ] TYPED mode: Student types answers in browser
- [ ] HANDWRITTEN mode: Student downloads answer sheet, writes by hand, uploads scan
- [ ] Mode set by teacher when assigning test (frqSubmissionType field)
- [ ] InstructionScreen shows mode-specific instructions

### 8.2 Answer Sheet PDF Generation (Handwritten Mode)
- [ ] PDF includes AP Logo and "ANSWER SHEET" header
- [ ] Shows test name, student name field, date field
- [ ] For each FRQ section:
  - [ ] Question number and total points
  - [ ] Stimulus text/image reprinted
  - [ ] Question text
  - [ ] For each part (a, b, c): label, question text, points, lined writing space
- [ ] Downloadable PDF format

### 8.3 Handwritten Upload
- [ ] Supported formats: PDF, JPG, PNG, HEIC/HEIF, WebP
- [ ] Multiple files allowed (combined into single submission)
- [ ] "Upload Answer Sheet" button in FRQ section
- [ ] File picker opens (accepts PDF + images)
- [ ] Preview shown before final submit
- [ ] Files uploaded to Firebase Storage: ap_frq_uploads/{userId}/{resultId}/
- [ ] frqUploadUrl stored in ap_test_results
- [ ] Max file size: 10MB per file, 50MB total
- [ ] Compress images if needed before upload
- [ ] Upload progress indicator shown

### 8.3.1 FRQHandwrittenMode Component
- [ ] Shows 4-step instructions: Download → Write → Scan → Upload
- [ ] Step 1: "Download Answer Sheet PDF" button
- [ ] Step 2: Instructions to print and write
- [ ] Step 3: Instructions to scan/photograph
- [ ] Step 4: "Upload Answer Sheet" button
- [ ] Timer continues during handwritten section
- [ ] Uploaded files list: filename, size, [Preview] [Remove] buttons
- [ ] [+ Add More Files] button
- [ ] [Submit Test] disabled until at least one file uploaded
- [ ] [Submit Test] enabled after upload

### 8.3.2 FileUpload Component (Reusable)
- [ ] accept prop: file types (e.g., "image/*,application/pdf")
- [ ] multiple prop: allow multiple files
- [ ] maxSize prop: max bytes per file
- [ ] maxFiles prop: max number of files
- [ ] Drag and drop zone
- [ ] File picker button
- [ ] Preview thumbnails for images
- [ ] Size display (KB/MB)
- [ ] Remove button per file
- [ ] Upload progress indicator
- [ ] isUploading state for loading feedback

### 8.4 Teacher Grading Interface
- [ ] Side-panel in Gradebook (similar to vocaBoost challenges)
- [ ] Shows student name and test name
- [ ] [View Student's Answer] button opens uploaded PDF/typed text
- [ ] For each FRQ question:
  - [ ] Question text and total points
  - [ ] Input fields for each subQuestion score
  - [ ] Comment field per question
- [ ] [Upload Annotated PDF] button for teacher's handwritten notes
- [ ] [Save Draft] button
- [ ] [Mark Complete] button

### 8.4.1 GradingPanel Component
- [ ] Opens as side panel from Gradebook list
- [ ] Shows student name, test name, submission type
- [ ] For typed: Shows student's text responses
- [ ] For handwritten: Shows PDF/image viewer
- [ ] Number input for each sub-question (0 to max points)
- [ ] Auto-calculates question total from sub-scores
- [ ] Textarea for comment per question
- [ ] [Save Draft] saves grades with status: IN_PROGRESS
- [ ] [Mark Complete] saves with status: COMPLETE
- [ ] On complete: recalculates total score, AP score

### 8.4.2 PDF Viewer (for Handwritten)
- [ ] Displays uploaded images/PDF pages
- [ ] Page navigation: [< Prev] [Next >], "Page X of Y"
- [ ] Zoom controls: [+] [-] buttons
- [ ] Rotate button [↻]
- [ ] Download original button
- [ ] Fits to container width by default

### 8.5 Grading States
- [ ] NOT_NEEDED: No FRQ section in test
- [ ] PENDING: Test completed, awaiting grading
- [ ] IN_PROGRESS: Teacher started but not finished
- [ ] COMPLETE: All FRQ graded, scores finalized

### 8.6 Teacher Annotated PDF
- [ ] Optional upload
- [ ] Stored at: ap_frq_graded/{resultId}/graded.pdf
- [ ] URL saved to frqGradedPdfUrl
- [ ] Displayed to student in Report Card with download button

---

## 9. Report Card (Results View)

### 9.1 Overview
- [ ] Student view: Full-screen page at /ap/results/:resultId
- [ ] Teacher view: Side-panel from Gradebook (editable)

### 9.2 Report Card Layout

#### Header Section
- [ ] "SCORE REPORT" title
- [ ] Student name
- [ ] Class name
- [ ] Test name
- [ ] Subject
- [ ] Date (completedAt)

#### Score Summary
- [ ] Large AP Score display (1-5)
- [ ] Section scores with progress bars
- [ ] MCQ section: X/Y pts, percentage
- [ ] FRQ section: X/Y pts, percentage
- [ ] Total: X/Y pts (percentage)
- [ ] [Download Report PDF] button

#### MCQ Results Table
- [ ] Column headers: Q#, Answer, Response, Domain, Topic, Result
- [ ] Each row shows: question number, correct answer, student's answer
- [ ] Domain and Topic from question metadata
- [ ] Result: ✓ (correct) or ✗ (incorrect)
- [ ] MCQ Summary: X/Y correct (percentage)

#### FRQ Results Table
- [ ] Column headers: Q#, Sub, Pts Max, Earned, Domain, Topic, Comment
- [ ] Rows grouped by FRQ question
- [ ] Subtotal per question
- [ ] Teacher comments shown
- [ ] FRQ Summary: X/Y raw pts → X/Y weighted (percentage)
- [ ] [Download Graded Paper (PDF)] button if available

### 9.3 Report Card Data Sources
- [ ] Student name from users/{userId}
- [ ] Class name from ap_classes/{classId}
- [ ] Test name/subject from ap_tests/{testId}
- [ ] Date from ap_test_results.completedAt
- [ ] AP Score from ap_test_results.apScore
- [ ] Section scores from ap_test_results.sectionScores
- [ ] MCQ answers from ap_test_results.answers + ap_questions
- [ ] FRQ grades from ap_test_results.frqGrades
- [ ] Domain/Topic from ap_questions
- [ ] Graded PDF from ap_test_results.frqGradedPdfUrl

### 9.4 Report PDF Export
- [ ] Header with student/test info
- [ ] AP Score prominently displayed
- [ ] Section breakdown with scores
- [ ] Full MCQ results table
- [ ] Full FRQ results table with teacher comments
- [ ] Does NOT include teacher's annotated PDF (separate download)

---

## 10. Exam Analytics Dashboard

### 10.1 Overview
- [ ] Teacher dashboard for analyzing test performance
- [ ] Route: /ap/teacher/analytics/:testId

### 10.2 Filters
- [ ] Classes multi-select dropdown
- [ ] Students multi-select dropdown
- [ ] When classes selected → auto-populate Students with class rosters
- [ ] Selecting class auto-checks all students from that class
- [ ] Can manually uncheck individual students
- [ ] Default: All classes, all students

### 10.3 Performance Color Scale (Fixed Thresholds)
- [ ] > 85%: Green (Excellent)
- [ ] 70-85%: Yellow-Green (Good)
- [ ] 60-70%: Yellow (Satisfactory)
- [ ] 50-60%: Orange (Needs Improvement)
- [ ] < 50%: Red (Critical)
- [ ] Thresholds are NOT configurable

### 10.4 MCQ Performance Grid
- [ ] One square per MCQ question
- [ ] Color-coded by % correct across selected students
- [ ] Shows: question number, percentage, color indicator
- [ ] Layout: flex-wrap (wraps to next row)
- [ ] [Download PDF] button to export questions
- [ ] [Detailed View] button to expand list view
- [ ] Click square → Opens Question Detail Modal

### 10.5 MCQ Question Detail Modal
- [ ] Shows question number
- [ ] Displays stimulus if applicable
- [ ] Shows question text
- [ ] Response Distribution bar chart:
  - [ ] Each option with percentage and student count
  - [ ] Green = Correct answer
  - [ ] Light Red = Incorrect answers
- [ ] Shows: Correct Answer, Domain, Topic
- [ ] [X Close] button

### 10.6 MCQ Detailed View
- [ ] Vertical list of all questions
- [ ] [← Back to Grid] button
- [ ] For each question:
  - [ ] Question number and % correct
  - [ ] Question text (truncated)
  - [ ] Response distribution: A: X% B: X% ✓ C: X% D: X%

### 10.7 FRQ Performance Grid
- [ ] FRQ questions as large rectangles
- [ ] Each rectangle contains nested sub-question squares
- [ ] FRQ card shows: question title, overall percentage, color
- [ ] Nested squares for each part (a, b, c, etc.)
- [ ] Shows average % (points earned / points possible)
- [ ] Color-coded using same scale as MCQ
- [ ] [Download PDF] button
- [ ] Click sub-question square → Could show rubric (future)

### 10.8 Student Performance List
- [ ] Below question grids
- [ ] Shows all students matching current filters
- [ ] Columns: Name, Email, MCQ, FRQ, AP Score, Report Card icon
- [ ] MCQ/FRQ shown as fractions (e.g., "32/40")
- [ ] Click student name → Navigate to APStudentProfile
- [ ] Click 📄 icon → Navigate to Report Card

### 10.9 Student Profile Page (Stub)
- [ ] Route: /ap/teacher/student/:userId
- [ ] Placeholder/stub page with TODO note
- [ ] Future features planned:
  - [ ] Student's AP test history
  - [ ] Performance trends
  - [ ] Strengths/weaknesses by domain
  - [ ] Comparison to class average

---

## 11. Teacher Flow Pages

### 11.1 APTeacherDashboard
- [ ] Shows teacher's overview
- [ ] Quick Actions section: [+ Create New Test] [Question Bank] [Gradebook]
- [ ] My Tests section: Grid of teacher's tests
- [ ] Each test card shows: name, question count, section types
- [ ] Test card has [Edit] [Assign] buttons
- [ ] Pending Grading section: Count and breakdown by test
- [ ] [Go to Gradebook] link
- [ ] My Classes section: List with student counts

### 11.2 APTestEditor Page
- [ ] Creates new test or edits existing
- [ ] Fields: Test Name, Subject (dropdown)
- [ ] Section management:
  - [ ] Add/remove sections
  - [ ] Drag to reorder sections
  - [ ] Per section: name, sectionType (MCQ/FRQ), time limit, multiplier
  - [ ] [+ Add Questions] button per section
- [ ] Question list within section:
  - [ ] Shows question preview
  - [ ] [Edit] [Remove] buttons per question
  - [ ] Drag to reorder questions
- [ ] Score Ranges configuration (AP 1-5 thresholds)
- [ ] [Save Draft] and [Save and Publish] buttons

### 11.3 APQuestionBank Page
- [ ] Browse all questions
- [ ] Filters: Subject, Type, Difficulty, Domain, Search text
- [ ] Question list with checkbox for bulk select
- [ ] Each row shows: type, domain, difficulty, question preview
- [ ] [Preview] button opens modal with full question
- [ ] [Edit] button to modify question
- [ ] [Add to Test] dropdown to select target test/section
- [ ] [+ Create Question] button
- [ ] Bulk action: [With Selected: Add to Test]

### 11.4 AssignTestModal Component
- [ ] Triggered from Test Editor or Teacher Dashboard
- [ ] Multi-select classes (checkboxes)
- [ ] Shows student count per class
- [ ] Search to add individual students
- [ ] Settings:
  - [ ] Due Date (optional date picker)
  - [ ] Max Attempts (number, default 3)
  - [ ] FRQ Mode: Typed / Handwritten dropdown
- [ ] [Assign to X students] button with count
- [ ] Creates ap_assignments document on submit

### 11.5 APGradebook Page
- [ ] Lists submissions needing grading
- [ ] Columns: Student, Test, Status, Action
- [ ] Status: "⏳ Pending" or "✓ Complete"
- [ ] Action: [Grade] or [View] button
- [ ] Filters: Test dropdown, Status dropdown, Class dropdown
- [ ] Click [Grade] opens GradingPanel side panel
- [ ] Updates in real-time when grading completes

---

## 12. User Roles

### 12.1 Student
- [ ] View available tests on dashboard
- [ ] Start and take tests
- [ ] Use annotation tools (highlight, strikethrough, line reader, flag)
- [ ] Submit tests
- [ ] View scores and review completed tests
- [ ] Download score reports

### 12.2 Teacher
- [ ] Create and edit tests
- [ ] Add questions from question bank or create new
- [ ] Configure sections (time limits, multipliers, question order)
- [ ] Customize score ranges for AP conversion
- [ ] Create and manage classes
- [ ] Assign tests to classes
- [ ] View student results and analytics
- [ ] Grade FRQ responses
- [ ] Upload annotated feedback PDFs
- [ ] Export questions and reports as PDFs

### 12.3 Admin
- [ ] Manage question bank
- [ ] Create public tests (isPublic: true)
- [ ] Access all teacher capabilities

---

## 13. Routes

### 13.1 Student Routes
- [ ] /ap → APDashboard (student home)
- [ ] /ap/test/:testId → APTestSession (take test)
- [ ] /ap/test/:testId/review → APTestReview (quick view after submit)
- [ ] /ap/results/:resultId → APReportCard (full results page)

### 13.2 Teacher Routes
- [ ] /ap/teacher → APTeacherDashboard
- [ ] /ap/teacher/gradebook → APGradebook
- [ ] /ap/teacher/gradebook/:resultId → APGradebook with side-panel open
- [ ] /ap/teacher/test/new → APTestEditor (create)
- [ ] /ap/teacher/test/:testId → APTestEditor (edit)
- [ ] /ap/teacher/questions → APQuestionBank
- [ ] /ap/teacher/analytics/:testId → APExamAnalytics
- [ ] /ap/teacher/student/:userId → APStudentProfile (stub)
- [ ] /ap/teacher/class/:classId → Class management

---

## 14. Architecture & Integration

### 14.1 Folder Structure
- [ ] All apBoost code in /src/apBoost/
- [ ] Pages in /src/apBoost/pages/
- [ ] Components in /src/apBoost/components/
- [ ] Services in /src/apBoost/services/
- [ ] Hooks in /src/apBoost/hooks/
- [ ] Utils in /src/apBoost/utils/
- [ ] Routes in /src/apBoost/routes.jsx
- [ ] Exports in /src/apBoost/index.js
- [ ] Static assets in /public/apBoost/

### 14.2 Integration with vocaBoost
- [ ] Single import in App.jsx
- [ ] All routes under /ap/*
- [ ] Reuse existing AuthContext
- [ ] Reuse existing ThemeContext and design tokens
- [ ] Import UI components from ../components/ui/
- [ ] Use same db, auth instances from ../services/db
- [ ] Separate collections with ap_ prefix

### 14.3 Removal Strategy
- [ ] Delete /src/apBoost/ folder
- [ ] Delete /public/apBoost/ folder
- [ ] Remove single import line from App.jsx
- [ ] (Optional) Delete ap_* Firestore collections

### 14.4 Design Tokens Usage
- [ ] Use tokens from /src/index.css
- [ ] Background: bg-base, bg-surface, bg-muted, bg-inset
- [ ] Text: text-text-primary, text-text-secondary, text-text-muted, text-text-faint
- [ ] Borders: border-border-default, border-border-strong, border-border-muted
- [ ] Radius: rounded-[--radius-card], rounded-[--radius-button], rounded-[--radius-input]
- [ ] Semantic: bg-success, bg-error, bg-warning, bg-info
- [ ] Brand: bg-brand-primary, bg-brand-accent, text-brand-text
- [ ] Shadows: shadow-theme-sm, shadow-theme-md, shadow-theme-lg
- [ ] NEVER use raw Tailwind values like bg-slate-100, text-gray-700

---

## 15. Components

### 15.1 Core Components
- [ ] APHeader.jsx: Header with AP branding
- [ ] APErrorBoundary.jsx: Catches render errors
- [ ] ErrorFallback.jsx: Error UI with retry/dashboard links
- [ ] TestTimer.jsx: Countdown timer per section
- [ ] QuestionDisplay.jsx: Renders question based on type
- [ ] AnswerInput.jsx: MCQ options, text input for FRQ
- [ ] QuestionNavigator.jsx: Question list with flag status
- [ ] ReviewScreen.jsx: Summary before submit
- [ ] ConnectionStatus.jsx: "Connection unstable" banner
- [ ] DuplicateTabModal.jsx: Block duplicate tab modal
- [ ] SessionSkeleton.jsx: Loading skeleton for session

### 15.2 Tool Components
- [ ] tools/Highlighter.jsx: Text highlighting tool
- [ ] tools/Strikethrough.jsx: Strike-through for MCQ options
- [ ] tools/LineReader.jsx: Focus line reader

### 15.3 Stimulus Components
- [ ] stimulus/PassageDisplay.jsx: Reading passages with tools
- [ ] stimulus/ImageDisplay.jsx: Images/charts

### 15.4 Grading Components
- [ ] grading/GradingPanel.jsx: Teacher side-panel for FRQ grading
- [ ] grading/FRQGradeInput.jsx: Per-question grade/comment inputs
- [ ] grading/StudentAnswerViewer.jsx: View typed or uploaded answers

### 15.5 Report Components
- [ ] report/ReportHeader.jsx: Student/test info header
- [ ] report/ScoreSummary.jsx: AP score + section breakdown
- [ ] report/MCQResultsTable.jsx: MCQ answer table
- [ ] report/FRQResultsTable.jsx: FRQ scores + comments table

### 15.6 Analytics Components
- [ ] analytics/PerformanceGrid.jsx: Shared grid for MCQ/FRQ squares
- [ ] analytics/MCQSquare.jsx: Individual MCQ question square
- [ ] analytics/FRQCard.jsx: FRQ card with nested sub-question squares
- [ ] analytics/QuestionDetailModal.jsx: Modal showing question + distribution
- [ ] analytics/MCQDetailedView.jsx: Expanded list view of all MCQ
- [ ] analytics/StudentResultsTable.jsx: Student list table
- [ ] analytics/FilterBar.jsx: Class/student multi-select filters

---

## 16. Hooks (Detailed)

### 16.1 useTestSession Hook
- [ ] Main orchestrator for test sessions
- [ ] Accepts: testId, assignmentId
- [ ] Returns state: session, test, loading, error
- [ ] Returns position: currentSection, currentQuestion, position object
- [ ] Returns navigation: goToQuestion, goNext, goPrevious, canGoNext, canGoPrevious
- [ ] Returns answers: answers Map, currentAnswer, setAnswer
- [ ] Returns flags: flags Set, toggleFlag
- [ ] Returns session control: startTest, submitSection, submitTest
- [ ] Returns status: status, isSubmitting
- [ ] Integrates: useOfflineQueue, useHeartbeat, useDuplicateTabGuard
- [ ] On mount: Load session or create new
- [ ] On answer change: Debounce save (1s-2s)
- [ ] On navigation: Immediate Firestore save
- [ ] Tracks local state optimistically
- [ ] Adds beforeunload handler when queue not empty

### 16.2 useHeartbeat Hook
- [ ] Accepts: sessionId, instanceToken
- [ ] Returns: isConnected, failureCount, lastHeartbeat
- [ ] 15-second interval pings Firestore
- [ ] Updates lastHeartbeat field
- [ ] Checks sessionToken matches instanceToken
- [ ] After 3 failures: sets isConnected=false
- [ ] On success: clears failure counter, attempts queue flush

### 16.3 useDuplicateTabGuard Hook
- [ ] Accepts: sessionId
- [ ] Returns: instanceToken, isInvalidated, takeControl
- [ ] Generates instanceToken on mount (crypto.randomUUID)
- [ ] Creates BroadcastChannel for same-browser detection
- [ ] Checks Firestore sessionToken on heartbeat
- [ ] Sets isInvalidated when another tab detected
- [ ] takeControl() claims session ownership

### 16.4 useTimer Hook
- [ ] Accepts: initialTime (seconds), onExpire callback, isPaused
- [ ] Returns: timeRemaining, formatted (MM:SS), isExpired
- [ ] Returns: pause, resume, reset functions
- [ ] Counts down every second
- [ ] Calls onExpire when reaches 0
- [ ] No warning thresholds (simple countdown)

### 16.5 useOfflineQueue Hook
- [ ] Accepts: sessionId
- [ ] Returns: addToQueue, flushQueue, queueLength, isOnline, isFlushing
- [ ] Uses IndexedDB database: ap_action_queue
- [ ] Queue entries: id, sessionId, localTimestamp, action, payload, status
- [ ] Status flow: PENDING → CONFIRMED → deleted
- [ ] Retry with exponential backoff: 2s → 4s → 8s
- [ ] After 3 failures: opportunistic mode (retry on user action)
- [ ] Flushes on: online event, visibility change, successful heartbeat

### 16.6 useAnnotations Hook
- [ ] Accepts: sessionId
- [ ] Returns highlights: Map<questionId, HighlightRange[]>
- [ ] Returns: addHighlight(qId, range, color), removeHighlight(qId, index), clearHighlights(qId)
- [ ] Returns strikethroughs: Map<questionId, Set<choiceId>>
- [ ] Returns: toggleStrikethrough(qId, choiceId)
- [ ] Returns lineReader: lineReaderEnabled, lineReaderPosition
- [ ] Returns: toggleLineReader(), moveLineReader(position)
- [ ] Returns: saveAnnotations(), loadAnnotations()
- [ ] HighlightRange: { start: number, end: number, color: string }
- [ ] Stored in ap_session_state.annotations
- [ ] Debounced save to Firestore

---

## 17. Services (Detailed)

### 17.1 apTestService.js
- [ ] getAvailableTests(userId, role) - Fetch tests for dashboard
- [ ] getTestWithQuestions(testId) - Fetch full test with all questions
- [ ] getTestMeta(testId) - Fetch test metadata only
- [ ] getAssignment(testId, userId) - Get assignment details

### 17.2 apSessionService.js
- [ ] createOrResumeSession(testId, userId, assignmentId) - Start or resume
- [ ] updateSession(sessionId, updates) - Update session state
- [ ] saveAnswer(sessionId, questionId, answer) - Save answer
- [ ] completeSession(sessionId) - Mark as completed
- [ ] getSession(sessionId) - Load existing session

### 17.3 apScoringService.js
- [ ] calculateMCQScore(answers, questions, section) - Count correct MCQ
- [ ] calculateAPScore(percentage, scoreRanges) - Map to AP 1-5
- [ ] createTestResult(session, test) - Create result document

### 17.4 apGradingService.js
- [ ] getPendingGrades(teacherId, filters) - Get submissions to grade
- [ ] getResultForGrading(resultId) - Get single result for grading
- [ ] saveGrade(resultId, grades, status) - Save draft or complete
- [ ] calculateFRQScore(grades, test) - Calculate FRQ total

### 17.5 apStorageService.js
- [ ] uploadFRQAnswerSheet(userId, resultId, files) - Upload student files
- [ ] uploadGradedPdf(resultId, file) - Upload teacher annotations
- [ ] getDownloadUrl(path) - Get download URL
- [ ] deleteUpload(path) - Delete uploaded file

### 17.6 apAnalyticsService.js
- [ ] getTestAnalytics(testId, filters) - Get aggregated results
- [ ] calculateQuestionPerformance(results, questions) - % correct per Q
- [ ] calculateResponseDistribution(results, questionId) - MCQ distributions
- [ ] calculateFRQPerformance(results, questions) - FRQ averages
- [ ] getStudentResults(testId, filters) - Student list with scores

### 17.7 apTeacherService.js
- [ ] getTeacherTests(teacherId) - Teacher's tests
- [ ] createTest(testData) - Create new test
- [ ] updateTest(testId, updates) - Update test
- [ ] deleteTest(testId) - Soft delete test
- [ ] getTeacherClasses(teacherId) - Teacher's classes
- [ ] createAssignment(assignmentData) - Create assignment
- [ ] getPendingGradingCount(teacherId) - Count needing grading

### 17.8 apQuestionService.js
- [ ] searchQuestions(filters) - Search question bank
- [ ] createQuestion(questionData) - Create new question
- [ ] updateQuestion(questionId, updates) - Update question
- [ ] addQuestionsToSection(testId, sectionId, questionIds) - Add to section
- [ ] removeQuestionFromSection(testId, sectionId, questionId) - Remove

---

## 18. Utilities (Detailed)

### 18.1 apTypes.js
- [ ] Question type constants: MCQ, MCQ_MULTI, FRQ, SAQ, DBQ
- [ ] Session status constants: NOT_STARTED, IN_PROGRESS, COMPLETED, PAUSED
- [ ] Grading status constants: NOT_NEEDED, PENDING, IN_PROGRESS, COMPLETE
- [ ] Difficulty constants: EASY, MEDIUM, HARD
- [ ] Format constants: VERTICAL, HORIZONTAL
- [ ] Subject constants for AP subjects

### 18.2 apTestConfig.js
- [ ] Subject configurations (name, default time limits)
- [ ] Default score ranges for AP 1-5 conversion
- [ ] Section type configurations

### 18.3 logError.js
- [ ] logError(functionName, context, error) function
- [ ] Logs: function, context, message, code, stack, timestamp
- [ ] Includes sessionId and userId if available
- [ ] Console.error in development
- [ ] Ready for production error tracking (Sentry)

### 18.4 withTimeout.js
- [ ] withTimeout(promise, ms, operation) function
- [ ] Wraps promise with timeout
- [ ] Rejects with descriptive error if timeout exceeded

### 18.5 validateSession.js
- [ ] validateSessionData(data) function
- [ ] Checks all required session fields exist
- [ ] Returns validation result with errors

### 18.6 generateAnswerSheetPdf.js
- [ ] generateAnswerSheetPdf(test, student) function
- [ ] Uses jspdf or pdf-lib library
- [ ] Includes AP logo, header with test/student info
- [ ] Each FRQ with stimulus, question text, parts
- [ ] Lined writing space for each part
- [ ] Page breaks between questions
- [ ] Returns Blob for download

### 18.7 generateReportPdf.js
- [ ] generateReportPdf(result, test, student) function
- [ ] Header with student/test info
- [ ] AP Score prominently displayed
- [ ] Section breakdown with scores
- [ ] Full MCQ results table
- [ ] Full FRQ results table with comments
- [ ] Returns Blob for download

### 18.8 generateQuestionsPdf.js
- [ ] generateQuestionsPdf(test, options) function
- [ ] options.includeAnswers: Show correct answers
- [ ] options.includeStimuli: Include stimulus content
- [ ] For teacher reference/review
- [ ] Returns Blob for download

### 18.9 fileUpload.js
- [ ] Handles FRQ file uploads
- [ ] Validates file types: PDF, JPG, PNG, HEIC, WebP
- [ ] Validates file sizes
- [ ] Converts HEIC to JPEG if needed
- [ ] Compresses images if needed

### 18.10 performanceColors.js
- [ ] PERFORMANCE_THRESHOLDS array with min, color, label
- [ ] getPerformanceColor(percentage) returns Tailwind color class
- [ ] getPerformanceLabel(percentage) returns text label
- [ ] Thresholds: >85% green-500, 70-85% lime-400, 60-70% yellow-400, 50-60% orange-400, <50% red-500

---

## 19. Seed Data Requirements

### 19.1 Test Document (ap_tests)
- [ ] At least one test with MCQ section for Phase 1 testing
- [ ] Test with FRQ section for Phase 3 testing
- [ ] Test with mixed MCQ + FRQ for full testing
- [ ] Includes: sections array, scoreRanges, questionOrder

### 19.2 Question Documents (ap_questions)
- [ ] MCQ questions with all choice fields (A-D minimum)
- [ ] MCQ questions with different formats (VERTICAL, HORIZONTAL)
- [ ] MCQ with stimulus for HORIZONTAL layout
- [ ] FRQ questions with subQuestions array
- [ ] Questions with different domains and difficulties

### 19.3 Assignment Document (ap_assignments)
- [ ] At least one assignment linking test to students
- [ ] studentIds array populated

---

## 20. Implementation Phase Verification Checklists

### Phase 1: Foundation MVP
- [ ] `/ap` shows test cards
- [ ] Click test → instruction screen
- [ ] "Begin Test" starts timer
- [ ] Answer MCQ, selection persists
- [ ] Bottom bar shows "Question X of Y"
- [ ] Click opens modal with grid boxes
- [ ] Navigate via boxes
- [ ] Flag questions, shows in grid
- [ ] "Go to Review Screen" → full page
- [ ] Submit → creates result
- [ ] Navigate to Report Card
- [ ] Shows AP score and MCQ table

### Phase 2: Session Resilience
- [ ] Close browser mid-test → resume exactly
- [ ] Open second tab (same browser) → first tab shows modal instantly
- [ ] Open in different browser → first browser shows modal within 15s
- [ ] "Use This Tab" → takes control
- [ ] Disconnect network → "Connection unstable" banner after ~45s
- [ ] Continue answering offline → works normally
- [ ] Reconnect → syncs, banner hides
- [ ] Refresh page → session resumes
- [ ] Submit with pending queue → shows sync progress
- [ ] Browser crash → reopen → queue replayed

### Phase 3: FRQ Support
- [ ] FRQ shows full question on each sub-question page
- [ ] Navigate 1a → 1b → 1c via Next
- [ ] Navigator shows flat sub-question boxes
- [ ] FRQ textarea saves correctly
- [ ] Submit → Report Card shows "Awaiting Grade" for FRQ
- [ ] Teacher sees pending grades in Gradebook
- [ ] Teacher can grade sub-questions
- [ ] "Mark Complete" → student sees updated score

### Phase 4: Tools
- [ ] Highlight text → color picker → highlight applied
- [ ] Click highlight → removes it
- [ ] Multiple colors supported
- [ ] Strikethrough option → visual feedback
- [ ] Can still select struck option
- [ ] Line reader toggle → overlay appears
- [ ] Arrow keys move line reader
- [ ] All annotations persist across navigation
- [ ] Annotations visible in review mode (read-only)

### Phase 5: Teacher Flow
- [ ] Teacher dashboard shows tests, classes, pending grading
- [ ] Create new test with sections
- [ ] Add questions from bank to test
- [ ] Create new questions
- [ ] Reorder questions via drag
- [ ] Assign test to class
- [ ] Set due date and max attempts
- [ ] Set FRQ submission mode
- [ ] Students see assigned tests in dashboard

### Phase 6: FRQ Handwritten
- [ ] Teacher assigns test with HANDWRITTEN mode
- [ ] Student sees handwritten instructions
- [ ] Download PDF button generates answer sheet
- [ ] Answer sheet has all questions and writing areas
- [ ] Upload accepts images and PDFs
- [ ] Multiple files supported
- [ ] Preview before submit
- [ ] Submit stores files in Firebase Storage
- [ ] `frqUploadUrl` stored in result
- [ ] Teacher can view uploaded files in grading panel
- [ ] Teacher can download original
- [ ] Teacher can upload annotated PDF
- [ ] Student sees annotated PDF after grading

### Phase 7: Analytics
- [ ] Analytics page loads for test
- [ ] Class/student filters work
- [ ] MCQ grid shows color-coded squares
- [ ] Click square → modal with distribution
- [ ] FRQ grid shows nested sub-question squares
- [ ] Detailed view shows all questions
- [ ] Student table with sortable columns
- [ ] Click student → profile page
- [ ] Click 📄 → report card
- [ ] Download Report PDF works
- [ ] Download Questions PDF works (teacher)
- [ ] Colors match threshold definitions

---

*Total Acceptance Criteria: 500+*
*Last Updated: Based on implementation docs in src/apBoost/implementation/*
