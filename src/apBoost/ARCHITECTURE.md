# apBoost Architecture

> System design reference for the AP exam practice platform.
> Read this before making changes to understand how the pieces fit together.

---

## Module Boundary

apBoost is an isolated module within VocaBoost. It imports from the parent app but never modifies parent files.

```
VocaBoost (parent)
  |-- src/contexts/AuthContext.jsx   <-- apBoost imports user/auth
  |-- src/firebase.js                <-- apBoost imports db, storage
  |-- src/components/PrivateRoute.jsx
  |
  +-- src/apBoost/                   <-- ALL apBoost code lives here
        |-- pages/         10 page components
        |-- components/    28 UI components
        |-- services/      9 Firestore service modules
        |-- hooks/         6 React hooks
        |-- utils/         8 utilities + constants
        +-- routes.jsx     Route definitions (mounted at /ap/*)
```

The single integration point is `App.jsx`, which imports apBoost routes.

---

## Data Flow

```
User Action (click answer, flag question, highlight text)
      |
      v
  APTestSession.jsx (page) -- renders UI, passes callbacks
      |
      v
  useTestSession (orchestrator hook) -- manages all state
      |
      +---> Local state update (answers Map, flags Set, position)
      |
      +---> useOfflineQueue.addToQueue(action)
                |
                +---> IndexedDB (immediate, survives crash)
                |
                +---> Debounced flushQueue()
                        |
                        v
                    Service layer (apSessionService, apScoringService, etc.)
                        |
                        v
                    Firebase Firestore (ap_* collections)
```

**Key insight:** User actions write to IndexedDB first (instant, offline-safe), then flush to Firestore on a debounced schedule. The UI never waits for Firestore writes.

---

## Hook Composition

`useTestSession` is the central orchestrator. It composes 5 specialized hooks:

```
useTestSession(testId, assignmentId)
  |
  +-- useTimer(timeLimit, onExpire)
  |     Countdown timer with pause/resume. Calls handleTimerExpire on zero.
  |
  +-- useOfflineQueue(sessionId)
  |     IndexedDB write-ahead queue. Deduplicates ANSWER_CHANGE by questionId.
  |     Exponential backoff retry (2s, 4s, 8s, 16s, max 5 attempts).
  |
  +-- useHeartbeat(sessionId, instanceToken)
  |     15-second Firestore ping. Detects session takeover (token mismatch).
  |     Tracks failureCount, reports isConnected after MAX_FAILURES=3.
  |
  +-- useDuplicateTabGuard(sessionId)
  |     BroadcastChannel (fast) + Firestore sessionToken (reliable).
  |     Prevents two tabs from editing same session simultaneously.
  |
  +-- useAnnotations()
        Manages highlights Map, strikethroughs Map, lineReader state.
        Queues changes via ANNOTATION_UPDATE action type.
```

These hooks are independent - they don't import each other. `useTestSession` wires them together (e.g., passes queue's `addToQueue` to annotation persistence).

---

## Session Lifecycle

```
NOT_STARTED ----startTest()----> IN_PROGRESS
                                    |
                              [visibilitychange    [timer expires]
                               or pagehide]             |
                                    |            handleTimerExpire()
                                    v                   |
                                 PAUSED                 v
                                    |              COMPLETED
                              [tab refocused]          |
                                    |          createTestResult()
                                    v                   |
                              IN_PROGRESS          ap_test_results
                                    |              (scored + saved)
                              [submit clicked]
                                    |
                                    v
                              COMPLETED
```

- **PAUSED** is set via localStorage pause marker on pagehide/visibilitychange (30s threshold)
- **Resume** detects IN_PROGRESS or PAUSED sessions via `getActiveSession()`
- **Auto-submit** on timer expiry queues an AUTO_SUBMIT action for offline resilience

---

## Navigation Model

Sections are independent time blocks. Navigation is locked within the current section.

```
Test
  |-- Section 0 (MCQ, 60 min)
  |     Questions: [q1, q2, q3, q4, q5]
  |     flatNavigationItems: [1, 2, 3, 4, 5]
  |
  |-- Section 1 (FRQ, 40 min)
        Questions: [q6 (has sub-questions a,b,c), q7 (has a,b)]
        flatNavigationItems: [1a, 1b, 1c, 2a, 2b]
```

**Flat indexing:** FRQ sub-questions are flattened into the navigation list. `goToFlatIndex(3)` in Section 1 would navigate to question 7, sub-question "a". This lets QuestionNavigator treat all items uniformly.

**Section locking:** `flatNavigationItems` is recomputed per-section. Navigation functions (goToQuestion, goToPrevious, goToFlatIndex) are bounded within the current section's items. Cross-section back-navigation is impossible by design.

---

## Answer Storage

```javascript
// MCQ: simple value
answers.set('questionId_1', 'B')

// MCQ_MULTI: array of selected choices
answers.set('questionId_2', ['A', 'C', 'D'])

// FRQ with sub-questions: nested object
answers.set('questionId_3', { a: 'Essay text...', b: 'Part b answer...' })
```

Firestore writes use dot-notation paths for sub-questions: `answers.${questionId}.${subQuestionLabel}`

---

## Offline Resilience Strategy

**Problem:** Students take tests on unreliable connections (school WiFi, mobile data). No answer can be lost.

**Solution:** Write-ahead queue with multiple recovery paths.

1. **IndexedDB queue** - Every action (answer, flag, annotation) is written to IndexedDB before Firestore. Survives browser crash, tab close, offline periods.

2. **Deduplication** - ANSWER_CHANGE actions are deduplicated by (questionId, subQuestionLabel). Only the latest value is kept. Same for FLAG_TOGGLE.

3. **Retry with backoff** - Failed flushes retry at 2s, 4s, 8s, 16s intervals, up to 5 attempts.

4. **Heartbeat monitoring** - 15s pings detect disconnection. After 3 consecutive failures, UI shows disconnected banner.

5. **Duplicate tab prevention** - BroadcastChannel for fast same-browser detection, Firestore sessionToken for cross-browser/device. "Use This Tab" modal for takeover.

6. **Timer safety** - pagehide/visibilitychange handlers sync timer to Firestore. Mobile Safari uses pagehide (visibilitychange unreliable there). 30s background threshold before pausing.

7. **Auto-submit** - Timer expiry queues AUTO_SUBMIT action. If offline, the submit will execute when connection returns.

---

## Scoring Pipeline

```
Submit Test
    |
    v
flushQueue() -- ensure all answers are in Firestore
    |
    v
createTestResult(testId, sessionId, userId, ...)
    |
    +-- MCQ: calculateMCQScore(answers, questions, multiplier)
    |         Single-select: 1 point if correct, 0 if wrong
    |         Multi-select: (correct - incorrect) / total (partial credit)
    |
    +-- FRQ: frqMaxPoints calculated from subQuestions * frqMultipliers
    |         Actual scoring is manual (teacher grades via GradingPanel)
    |
    +-- AP Score: percentage mapped to 1-5 via test.scoreRanges
    |             (customizable per test, falls back to DEFAULT_SCORE_RANGES)
    |
    v
ap_test_results document
    gradingStatus: NOT_NEEDED (MCQ only) | PENDING (has FRQ)
```

---

## Service Layer

Each service is a plain module (no classes) exporting async functions. All talk directly to Firestore.

| Service | Responsibility |
|---------|---------------|
| `apTestService` | Test CRUD, access control (`canAccessTest`), question resolution |
| `apSessionService` | Session lifecycle, answer/flag/timer writes |
| `apScoringService` | Score calculation, result creation |
| `apGradingService` | Teacher FRQ grading, score recalculation |
| `apQuestionService` | Question bank CRUD, search, section management |
| `apAnalyticsService` | Performance aggregation, response distributions |
| `apTeacherService` | Teacher dashboard data, test publishing, assignments |
| `apStimuliService` | Shared stimulus CRUD |
| `apStorageService` | Firebase Storage uploads, file validation |

---

## Firestore Collections

All prefixed with `ap_` to isolate from VocaBoost data.

| Collection | Indexed By | Purpose |
|------------|-----------|---------|
| `ap_tests` | createdBy + createdAt | Test definitions with sections |
| `ap_questions` | subject, type, difficulty, tags | Question bank |
| `ap_stimuli` | type | Shared passages/images |
| `ap_session_state` | testId + userId + status | Active test sessions |
| `ap_test_results` | gradingStatus, teacherId | Completed attempts with scores |
| `ap_classes` | teacherId + name | Teacher class rosters |
| `ap_assignments` | testId + assignedAt | Test-to-class assignments |

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Flat navigation | Sub-questions flattened into nav list | Uniform navigation for MCQ and FRQ; section locking is implicit |
| Server-side stale session detection | Scheduled Cloud Function every 60s | Industry standard; covers cross-device resume, crash, power loss without client cooperation |
| localStorage pause markers (fast fallback) | Supplement to server-side check | Instant same-device detection; fires before 60s server interval |
| Teacher-controlled FRQ mode | Not student choice | Ensures consistent submission format for grading |
| IndexedDB queue name | `ap_boost_queue` (not `ap_action_queue`) | Already deployed; rename would break existing sessions |
| PENDING -> deleted queue flow | No CONFIRMED intermediate status | Simpler; the action either succeeds (delete) or retries |
| IN_PROGRESS as canonical status | ACTIVE is alias only | Avoid migration; alias provides spec compatibility |
| Array for frqUploadedFiles | Not single frqUploadUrl | Supports multi-file handwritten submissions |
| Direct Firestore imports | Not through db.js retry wrapper | apBoost services handle their own error patterns |

---

## Where to Put New Code

| You're building... | Put it in... |
|--------------------|-------------|
| A new page/view | `pages/` + add route in `routes.jsx` |
| A reusable UI piece | `components/` (or subdirectory like `analytics/`, `tools/`) |
| Firestore read/write logic | `services/` (one service per collection or domain) |
| Shared state logic | `hooks/` (compose into useTestSession if session-related) |
| Constants, enums, helpers | `utils/` (apTypes.js for enums, apTestConfig.js for subject data) |
| Static assets (logos, images) | `/public/apBoost/` |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `AP_BOOST_TRACKER.md` | Progress tracker with remaining work items and sprint plan |
| `criteria_audit/` | Per-section pass/fail audits against acceptance criteria |
| `criteria_audit/fix_plans/` | Detailed fix instructions with code snippets |
| `implementation/` | Original phase-by-phase build guides |
| `change_action_log_ap.md` (root) | Chronological log of all code changes |
