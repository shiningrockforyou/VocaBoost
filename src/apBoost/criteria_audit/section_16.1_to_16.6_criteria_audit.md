# Acceptance Criteria Audit: Sections 16.1 to 16.6

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 49
- ✅ Implemented: 39
- ⚠️ Partial: 9
- ❌ Missing: 1
- ❓ Unable to Verify: 0

---

## Section 16.1: useTestSession Hook

### Criterion: Main orchestrator for test sessions
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:20-24](src/apBoost/hooks/useTestSession.js#L20-L24)
- **Notes:** Well-documented as "Core session state management hook"

### Criterion: Accepts: testId, assignmentId
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:24](src/apBoost/hooks/useTestSession.js#L24)
- **Notes:** `export function useTestSession(testId, assignmentId = null)`

### Criterion: Returns state: session, test, loading, error
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:449-453](src/apBoost/hooks/useTestSession.js#L449-L453)
- **Notes:** All four state values returned in the hook return object

### Criterion: Returns position: currentSection, currentQuestion, position object
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:456-458](src/apBoost/hooks/useTestSession.js#L456-L458)
- **Notes:** Position object includes sectionIndex, questionIndex, questionId, subQuestionLabel

### Criterion: Returns navigation: goToQuestion, goNext, goPrevious, canGoNext, canGoPrevious
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:461-467](src/apBoost/hooks/useTestSession.js#L461-L467)
- **Notes:** Also includes goToFlatIndex for FRQ sub-question navigation

### Criterion: Returns answers: answers Map, currentAnswer, setAnswer
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:474-477](src/apBoost/hooks/useTestSession.js#L474-L477)
- **Notes:** Answers stored as Map for fast lookup

### Criterion: Returns flags: flags Set, toggleFlag
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:480-481](src/apBoost/hooks/useTestSession.js#L480-L481)
- **Notes:** Flags stored as Set for fast lookup

### Criterion: Returns session control: startTest, submitSection, submitTest
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:484-486](src/apBoost/hooks/useTestSession.js#L484-L486)
- **Notes:** All three control functions implemented

### Criterion: Returns status: status, isSubmitting
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:489-490](src/apBoost/hooks/useTestSession.js#L489-L490)
- **Notes:** Status derived from session, isSubmitting is local state

### Criterion: Integrates: useOfflineQueue, useHeartbeat, useDuplicateTabGuard
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:50-52](src/apBoost/hooks/useTestSession.js#L50-L52)
- **Notes:** All three resilience hooks properly integrated

### Criterion: On mount: Load session or create new
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:159-206](src/apBoost/hooks/useTestSession.js#L159-L206)
- **Notes:** Loads test and checks for existing session with full state restoration

### Criterion: On answer change: Debounce save (1s-2s)
- **Status:** ⚠️ Partial
- **Evidence:** [useTestSession.js:350-358](src/apBoost/hooks/useTestSession.js#L350-L358)
- **Notes:** Uses addToQueue which has 1s debounce via scheduleFlush in useOfflineQueue. Criteria specifies 1s-2s, implementation uses 1s.

### Criterion: On navigation: Immediate Firestore save
- **Status:** ⚠️ Partial
- **Evidence:** [useTestSession.js:250-259](src/apBoost/hooks/useTestSession.js#L250-L259)
- **Notes:** Navigation goes through queue (addToQueue with NAVIGATION action), not directly to Firestore. Debounced at 1s, not immediate.

### Criterion: Tracks local state optimistically
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:332-348](src/apBoost/hooks/useTestSession.js#L332-L348), [useTestSession.js:367-376](src/apBoost/hooks/useTestSession.js#L367-L376)
- **Notes:** Both answers and flags update local state immediately before queuing

### Criterion: Adds beforeunload handler when queue not empty
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:209-220](src/apBoost/hooks/useTestSession.js#L209-L220)
- **Notes:** Warns user if queueLength > 0 on page close

---

## Section 16.2: useHeartbeat Hook

### Criterion: Accepts: sessionId, instanceToken
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:18](src/apBoost/hooks/useHeartbeat.js#L18)
- **Notes:** `export function useHeartbeat(sessionId, instanceToken)`

### Criterion: Returns: isConnected, failureCount, lastHeartbeat
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:122-128](src/apBoost/hooks/useHeartbeat.js#L122-L128)
- **Notes:** Also returns sessionTakenOver and reconnect function

### Criterion: 15-second interval pings Firestore
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:9](src/apBoost/hooks/useHeartbeat.js#L9), [useHeartbeat.js:90](src/apBoost/hooks/useHeartbeat.js#L90)
- **Notes:** `HEARTBEAT_INTERVAL = 15000` (15 seconds)

### Criterion: Updates lastHeartbeat field
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:54-61](src/apBoost/hooks/useHeartbeat.js#L54-L61)
- **Notes:** Uses serverTimestamp() for lastHeartbeat

### Criterion: Checks sessionToken matches instanceToken
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:47-50](src/apBoost/hooks/useHeartbeat.js#L47-L50)
- **Notes:** Sets sessionTakenOver if tokens don't match

### Criterion: After 3 failures: sets isConnected=false
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:10](src/apBoost/hooks/useHeartbeat.js#L10), [useHeartbeat.js:71-75](src/apBoost/hooks/useHeartbeat.js#L71-L75)
- **Notes:** MAX_FAILURES = 3, isConnected set false after reaching limit

### Criterion: On success: clears failure counter, attempts queue flush
- **Status:** ⚠️ Partial
- **Evidence:** [useHeartbeat.js:64-66](src/apBoost/hooks/useHeartbeat.js#L64-L66)
- **Notes:** Clears failure counter and sets isConnected/lastHeartbeat on success, but does NOT attempt queue flush (no access to queue from this hook)

---

## Section 16.3: useDuplicateTabGuard Hook

### Criterion: Accepts: sessionId
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:13](src/apBoost/hooks/useDuplicateTabGuard.js#L13)
- **Notes:** `export function useDuplicateTabGuard(sessionId)`

### Criterion: Returns: instanceToken, isInvalidated, takeControl
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:128-131](src/apBoost/hooks/useDuplicateTabGuard.js#L128-L131)
- **Notes:** All three values returned

### Criterion: Generates instanceToken on mount (crypto.randomUUID)
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:15-21](src/apBoost/hooks/useDuplicateTabGuard.js#L15-L21)
- **Notes:** Uses crypto.randomUUID() with fallback for older browsers

### Criterion: Creates BroadcastChannel for same-browser detection
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:71-73](src/apBoost/hooks/useDuplicateTabGuard.js#L71-L73)
- **Notes:** Channel named `ap_session_${sessionId}`

### Criterion: Checks Firestore sessionToken on heartbeat
- **Status:** ⚠️ Partial
- **Evidence:** N/A
- **Notes:** This check is performed by useHeartbeat hook (line 47-50), not useDuplicateTabGuard. The hooks work together but the responsibility is split.

### Criterion: Sets isInvalidated when another tab detected
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:76-80](src/apBoost/hooks/useDuplicateTabGuard.js#L76-L80)
- **Notes:** Listens for SESSION_CLAIMED messages from other tabs

### Criterion: takeControl() claims session ownership
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:50-64](src/apBoost/hooks/useDuplicateTabGuard.js#L50-L64)
- **Notes:** Updates Firestore and broadcasts to other tabs

---

## Section 16.4: useTimer Hook

### Criterion: Accepts: initialTime (seconds), onExpire callback, isPaused
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js:13-17](src/apBoost/hooks/useTimer.js#L13-L17)
- **Notes:** Also accepts optional onTick callback

### Criterion: Returns: timeRemaining, formatted (MM:SS), isExpired
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js:114-116](src/apBoost/hooks/useTimer.js#L114-L116)
- **Notes:** Uses formatTimeSeconds utility for MM:SS format

### Criterion: Returns: pause, resume, reset functions
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js:119-122](src/apBoost/hooks/useTimer.js#L119-L122)
- **Notes:** Also returns start function and isRunning state

### Criterion: Counts down every second
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js:75-95](src/apBoost/hooks/useTimer.js#L75-L95)
- **Notes:** setInterval with 1000ms interval

### Criterion: Calls onExpire when reaches 0
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js:84-89](src/apBoost/hooks/useTimer.js#L84-L89)
- **Notes:** Calls onExpire callback when newTime <= 0

### Criterion: No warning thresholds (simple countdown)
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js](src/apBoost/hooks/useTimer.js)
- **Notes:** No warning threshold logic present - simple countdown as specified

---

## Section 16.5: useOfflineQueue Hook

### Criterion: Accepts: sessionId
- **Status:** ✅ Implemented
- **Evidence:** [useOfflineQueue.js:51](src/apBoost/hooks/useOfflineQueue.js#L51)
- **Notes:** `export function useOfflineQueue(sessionId)`

### Criterion: Returns: addToQueue, flushQueue, queueLength, isOnline, isFlushing
- **Status:** ✅ Implemented
- **Evidence:** [useOfflineQueue.js:277-283](src/apBoost/hooks/useOfflineQueue.js#L277-L283)
- **Notes:** All five values returned

### Criterion: Uses IndexedDB database: ap_action_queue
- **Status:** ⚠️ Partial
- **Evidence:** [useOfflineQueue.js:9](src/apBoost/hooks/useOfflineQueue.js#L9)
- **Notes:** Database name is 'ap_boost_queue', not 'ap_action_queue' as specified

### Criterion: Queue entries: id, sessionId, localTimestamp, action, payload, status
- **Status:** ✅ Implemented
- **Evidence:** [useOfflineQueue.js:131-138](src/apBoost/hooks/useOfflineQueue.js#L131-L138)
- **Notes:** All fields present in queueItem object

### Criterion: Status flow: PENDING → CONFIRMED → deleted
- **Status:** ⚠️ Partial
- **Evidence:** [useOfflineQueue.js:238-249](src/apBoost/hooks/useOfflineQueue.js#L238-L249)
- **Notes:** Items go PENDING → deleted directly. No CONFIRMED status intermediate step.

### Criterion: Retry with exponential backoff: 2s → 4s → 8s
- **Status:** ✅ Implemented
- **Evidence:** [useOfflineQueue.js:258-261](src/apBoost/hooks/useOfflineQueue.js#L258-L261)
- **Notes:** `Math.pow(2, retryCountRef.current) * 1000` produces 2s, 4s, 8s, 16s

### Criterion: After 3 failures: opportunistic mode (retry on user action)
- **Status:** ❌ Missing
- **Evidence:** [useOfflineQueue.js:259](src/apBoost/hooks/useOfflineQueue.js#L259)
- **Notes:** Stops retrying after 5 failures (`retryCountRef.current < 5`). No opportunistic mode implemented.

### Criterion: Flushes on: online event, visibility change, successful heartbeat
- **Status:** ⚠️ Partial
- **Evidence:** [useOfflineQueue.js:86-91](src/apBoost/hooks/useOfflineQueue.js#L86-L91)
- **Notes:** Flushes on online event only. No visibility change handler. No heartbeat success integration.

---

## Section 16.6: useAnnotations Hook

### Criterion: Accepts: sessionId
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:20](src/apBoost/hooks/useAnnotations.js#L20)
- **Notes:** Also accepts optional addToQueue function

### Criterion: Returns highlights: Map<questionId, HighlightRange[]>
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:22](src/apBoost/hooks/useAnnotations.js#L22), [useAnnotations.js:227](src/apBoost/hooks/useAnnotations.js#L227)
- **Notes:** Highlights stored as Map with arrays of ranges

### Criterion: Returns: addHighlight(qId, range, color), removeHighlight(qId, index), clearHighlights(qId)
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:228-230](src/apBoost/hooks/useAnnotations.js#L228-L230)
- **Notes:** All three highlight management functions implemented

### Criterion: Returns strikethroughs: Map<questionId, Set<choiceId>>
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:25](src/apBoost/hooks/useAnnotations.js#L25), [useAnnotations.js:236](src/apBoost/hooks/useAnnotations.js#L236)
- **Notes:** Strikethroughs stored as Map with Sets

### Criterion: Returns: toggleStrikethrough(qId, choiceId)
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:237](src/apBoost/hooks/useAnnotations.js#L237)
- **Notes:** Toggle behavior implemented at lines 94-117

### Criterion: Returns lineReader: lineReaderEnabled, lineReaderPosition
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:242-243](src/apBoost/hooks/useAnnotations.js#L242-L243)
- **Notes:** Also returns lineReaderLines for visible line count

### Criterion: Returns: toggleLineReader(), moveLineReader(position)
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:245-246](src/apBoost/hooks/useAnnotations.js#L245-L246)
- **Notes:** Also includes moveLineReaderUp/Down and setVisibleLines

### Criterion: Returns: saveAnnotations(), loadAnnotations()
- **Status:** ⚠️ Partial
- **Evidence:** [useAnnotations.js:252-253](src/apBoost/hooks/useAnnotations.js#L252-L253)
- **Notes:** Has loadAnnotations() and exportAnnotations(), but no explicit saveAnnotations(). Saving is done through addToQueue callback.

### Criterion: HighlightRange: { start: number, end: number, color: string }
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:36-41](src/apBoost/hooks/useAnnotations.js#L36-L41)
- **Notes:** addHighlight accepts range object and adds color field

### Criterion: Stored in ap_session_state.annotations
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:45-49](src/apBoost/hooks/useAnnotations.js#L45-L49)
- **Notes:** Uses ANNOTATION_UPDATE action through queue which writes to session state

### Criterion: Debounced save to Firestore
- **Status:** ✅ Implemented
- **Evidence:** [useAnnotations.js:45](src/apBoost/hooks/useAnnotations.js#L45), [useOfflineQueue.js:154-156](src/apBoost/hooks/useOfflineQueue.js#L154-L156)
- **Notes:** Saves via addToQueue which has 1s debounce in scheduleFlush

---

## Recommendations

### High Priority Issues

1. **useOfflineQueue: Missing opportunistic mode** - After backoff exhaustion, the queue should retry on user actions, visibility changes, and successful heartbeats. Currently stops after 5 retries.

2. **useOfflineQueue: Missing visibility change flush** - Criteria specifies flushing on visibility change, but this is not implemented.

3. **Navigation not immediate** - Criteria specifies navigation should trigger immediate Firestore save, but current implementation goes through the debounced queue.

### Medium Priority Issues

4. **useHeartbeat: Should attempt queue flush on success** - The hook should have access to flushQueue and call it on successful heartbeat.

5. **IndexedDB database name mismatch** - Criteria specifies 'ap_action_queue' but implementation uses 'ap_boost_queue'.

6. **Missing CONFIRMED status in queue flow** - Criteria specifies PENDING → CONFIRMED → deleted flow, but implementation skips CONFIRMED.

### Low Priority Issues

7. **useAnnotations: saveAnnotations() function name** - Criteria specifies saveAnnotations() but implementation has exportAnnotations() instead.

8. **Firestore sessionToken check location** - The check is in useHeartbeat rather than useDuplicateTabGuard, but functionality is correct through hook integration.

### Patterns Observed

- All hooks exist and implement core functionality
- Good use of TypeScript-style JSDoc documentation
- Proper cleanup in useEffect returns
- Consistent error handling with logError utility
- Optimistic updates implemented throughout
- Good integration between hooks via useTestSession orchestrator
