# CODEBASE_FACTS__UNK__1.10_to_1.12.md

**CHUNK_ID:** `UNK__1.10_to_1.12`
**Source doc:** "Fix Plan: Sections 1.10 to 1.12" (dated 2026-01-14)
**Generated:** 2026-01-14

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Session State Storage

- **Local State (Primary during session):** `useTestSession.js` manages all live session state:
  - `session` object from Firestore (loaded once, updated on write-through)
  - `answers` (Map), `flags` (Set), `position` - all local state
  - **Evidence:** `src/apBoost/hooks/useTestSession.js:28-43`
    ```javascript
    const [session, setSession] = useState(null)
    const [test, setTest] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [currentSubQuestionLabel, setCurrentSubQuestionLabel] = useState(null)
    const [answers, setAnswers] = useState(new Map())
    const [flags, setFlags] = useState(new Set())
    ```

- **IndexedDB Queue (Intermediate):** Pending writes stored in IndexedDB before flush
  - Database: `ap_boost_queue`, Store: `actions`
  - **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:8-11`
    ```javascript
    const DB_NAME = 'ap_boost_queue'
    const STORE_NAME = 'actions'
    const DB_VERSION = 1
    ```

- **Firestore (Persistent):** `ap_session_states` collection
  - **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:232`
    ```javascript
    await withTimeout(
      updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates),
      TIMEOUTS.FIRESTORE_WRITE,
      'Queue flush'
    )
    ```

### Key Fields During Submit/Flush

- `answers.<questionId>` - answer values
- `currentSectionIndex`, `currentQuestionIndex` - position
- `sectionTimeRemaining.<sectionId>` - timer state
- `lastAction` - server timestamp on each flush
- **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:201-228`

---

## 2) Write Paths

**Found: Yes**

### Submit Test Flow

1. **submitTest function** in `useTestSession.js:396-421`:
   ```javascript
   const submitTest = useCallback(async (frqData = null) => {
     if (!session?.id || isSubmitting) return null
     try {
       setIsSubmitting(true)
       timer.pause()
       if (queueLength > 0) {
         await flushQueue()
       }
       const resultId = await createTestResult(session.id, frqData)
       return resultId
     } catch (err) {
       logError('useTestSession.submitTest', { sessionId: session?.id }, err)
       setError(err.message || 'Failed to submit test')
       return null
     } finally {
       setIsSubmitting(false)
     }
   }, [session?.id, isSubmitting, timer, queueLength, flushQueue])
   ```
   **Evidence:** `src/apBoost/hooks/useTestSession.js:396-421`

### Call Sequence (Proven Order)

1. **Guard check:** `if (!session?.id || isSubmitting) return null` (line 397)
2. **Set submitting:** `setIsSubmitting(true)` (line 400)
3. **Pause timer:** `timer.pause()` (line 403)
4. **Flush queue (conditional):** `if (queueLength > 0) { await flushQueue() }` (lines 406-408)
5. **Create result:** `const resultId = await createTestResult(session.id, frqData)` (line 411)
6. **Return resultId** (line 413)
7. **Finally:** `setIsSubmitting(false)` (line 419)

### FlushQueue Write Path

- Location: `src/apBoost/hooks/useOfflineQueue.js:173-266`
- Writes happen via: `updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates)`
- All writes go through the queue first, then batch-flush to Firestore
- **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:230-235`

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### Retry Mechanism in flushQueue

- **Retry intervals:** Exponential backoff - 2s, 4s, 8s, 16s
- **Max retries:** 5 attempts
- **Implementation location:** `src/apBoost/hooks/useOfflineQueue.js:254-262`
  ```javascript
  } catch (error) {
    logError('useOfflineQueue.flushQueue', { sessionId }, error)
    retryCountRef.current++
    if (retryCountRef.current < 5) {
      const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
      scheduleFlush(delay)
    }
  }
  ```

### Retry Counter Reset

- Resets to 0 on successful flush: `retryCountRef.current = 0` (line 251)
- Resets to 0 when coming back online: `retryCountRef.current = 0` (line 88)
- **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:88, 251`

### Online/Offline Detection

- Uses `navigator.onLine` and event listeners
- **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:53, 86-103`

### No Submission-Level Retry/Timeout

- **NOT FOUND:** There is NO retry loop at the `submitTest` level
- **NOT FOUND:** There is NO timeout/elapsed-time tracking for overall submission
- `submitTest` simply calls `flushQueue()` once and `createTestResult()` once
- If either fails, error is set and function returns null

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Test Header Rendering

- **Location:** `src/apBoost/pages/APTestSession.jsx:402-411`
  ```jsx
  <header className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <span className="text-text-secondary text-sm">
        Section {position.sectionIndex + 1} of {test?.sections?.length || 1}:{' '}
        {currentSection?.title || 'Multiple Choice'}
      </span>
    </div>
    <TestTimer timeRemaining={timeRemaining} />
  </header>
  ```

- **Header contains:**
  - Section label (e.g., "Section 1 of 2: Multiple Choice")
  - TestTimer component
  - **NO menu button/hamburger currently exists**

### Review Screen Entry

- **Location:** `src/apBoost/pages/APTestSession.jsx:351-384`
- **Entered via:** `view === 'review'` condition
- **Triggered from:** `handleGoToReview` (line 172) which is called from QuestionNavigator's "Go to Review Screen" button
- **Submission triggered from:** `onSubmit={handleSubmit}` prop passed to ReviewScreen (line 377)
- **Evidence:** `src/apBoost/pages/APTestSession.jsx:171-174, 377`

### ToolsToolbar Rendering

- **Location:** Rendered inside `PassageDisplay` at `src/apBoost/components/tools/PassageDisplay.jsx:59-73`
- **Toolbar placement:** OUTSIDE the scroll container
  ```jsx
  <div className="flex flex-col h-full">
    {/* Toolbar - shrink-0, not inside overflow container */}
    {showToolbar && isText && (
      <div className="shrink-0 pb-3 mb-3 border-b border-border-default">
        <ToolsToolbar ... />
      </div>
    )}
    {/* Content area - THIS is the scroll container */}
    <div className="flex-1 overflow-auto relative" ref={contentRef}>
      ...
    </div>
  </div>
  ```
- **Evidence:** `src/apBoost/components/tools/PassageDisplay.jsx:57-76`

---

## 5) Must-Answer Questions (Checklist)

### 1) Where exactly is `isSubmitting` defined, and who sets/unsets it?

**Answer:**
- Defined in `useTestSession` hook as local state
- Set by `submitTest` function
- **Evidence:** `src/apBoost/hooks/useTestSession.js:32`
  ```javascript
  const [isSubmitting, setIsSubmitting] = useState(false)
  ```
- **Set true:** `src/apBoost/hooks/useTestSession.js:400`
- **Set false:** `src/apBoost/hooks/useTestSession.js:419` (in finally block)

---

### 2) During submission, what UI changes happen today?

**Answer:**
1. **ReviewScreen submit button:** Shows spinner + "Submitting..." text
   - **Evidence:** `src/apBoost/components/ReviewScreen.jsx:138-145`
     ```jsx
     {isSubmitting ? (
       <>
         <svg className="animate-spin h-4 w-4" ...>...</svg>
         Submitting...
       </>
     ) : (
       isFinalSection ? 'Submit Test' : 'Submit Section'
     )}
     ```

2. **Buttons disabled:** Both "Return to Questions" and submit button disabled
   - **Evidence:** `src/apBoost/components/ReviewScreen.jsx:128, 135`
     ```jsx
     disabled={isSubmitting}
     ```

3. **QuestionDisplay/AnswerInput disabled:** `disabled={isSubmitting || isInvalidated}`
   - **Evidence:** `src/apBoost/pages/APTestSession.jsx:436, 444, 451`

4. **FRQHandwrittenMode:** Shows "Submitting..." in button
   - **Evidence:** `src/apBoost/components/FRQHandwrittenMode.jsx:261`
     ```jsx
     {isSubmitting ? 'Submitting...' : 'Submit Test'}
     ```

---

### 3) Is there any existing "progress modal" during submit?

**Answer: NO**
- No dedicated progress modal exists during submission
- Only inline button text changes to "Submitting..."
- DuplicateTabModal exists but is for duplicate tab warnings only
- QuestionNavigator has a modal but for navigation only
- **Evidence:** Searched entire `src/apBoost/components` - no "SubmitModal", "ProgressModal", or similar component found

---

### 4) Do `queueLength`, `isSyncing`, or `isFlushing` exist today?

**Answer: Yes, all three exist**

- **`queueLength`:** State in useOfflineQueue, exposed to useTestSession
  - **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:52`
    ```javascript
    const [queueLength, setQueueLength] = useState(0)
    ```
  - Exposed: `src/apBoost/hooks/useTestSession.js:50, 501`

- **`isFlushing`:** State in useOfflineQueue
  - **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:54`
    ```javascript
    const [isFlushing, setIsFlushing] = useState(false)
    ```
  - Exposed as `isSyncing` in useTestSession: `src/apBoost/hooks/useTestSession.js:500`
    ```javascript
    isSyncing: isFlushing,
    ```

- **`isSyncing`:** Alias for `isFlushing` in useTestSession return
  - **Evidence:** `src/apBoost/hooks/useTestSession.js:500`

---

### 5) What is the exact call sequence inside submission?

**Answer:** (Proven by code order in `useTestSession.js:396-421`)
1. Guard: `if (!session?.id || isSubmitting) return null`
2. `setIsSubmitting(true)`
3. `timer.pause()`
4. `if (queueLength > 0) { await flushQueue() }`
5. `await createTestResult(session.id, frqData)`
6. Return `resultId`
7. Finally: `setIsSubmitting(false)`

**Evidence:** `src/apBoost/hooks/useTestSession.js:396-421`

---

### 6) Is there any built-in retry loop for flush/submission?

**Answer:**
- **flushQueue has retry:** Yes, exponential backoff up to 5 retries (2s, 4s, 8s, 16s intervals)
  - **Evidence:** `src/apBoost/hooks/useOfflineQueue.js:257-261`
- **submitTest has NO retry:** Single call to `flushQueue()` and `createTestResult()`, no retry wrapper
  - **Evidence:** `src/apBoost/hooks/useTestSession.js:396-421` - no retry loop present

---

### 7) Is there any existing timeout/elapsed-time tracking for submission failures?

**Answer: NO**
- No `Date.now()` tracking for submission duration
- No `setTimeout` for submission timeout
- Only `retryCountRef` exists in useOfflineQueue for counting retries
- **Evidence:** Searched `src/apBoost/hooks/useTestSession.js` - no timeout-related tracking found for submission

---

### 8) Where is the test-session header defined, and are there buttons/icons currently?

**Answer:**
- **Location:** `src/apBoost/pages/APTestSession.jsx:402-411`
- **Current contents:**
  - Section label text: "Section X of Y: {title}"
  - TestTimer component
- **NO buttons/icons currently in header** (no menu, hamburger, or any other buttons)
- **Evidence:** `src/apBoost/pages/APTestSession.jsx:402-411`
  ```jsx
  <header className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <span className="text-text-secondary text-sm">
        Section {position.sectionIndex + 1} of {test?.sections?.length || 1}:{' '}
        {currentSection?.title || 'Multiple Choice'}
      </span>
    </div>
    <TestTimer timeRemaining={timeRemaining} />
  </header>
  ```

---

### 9) Is there any existing menu/panel/dropdown component in test session context?

**Answer: Partial**
- **QuestionNavigator slide-up modal:** Exists, pattern reusable
  - **Evidence:** `src/apBoost/components/QuestionNavigator.jsx:140-234`
- **HighlightDropdown in ToolsToolbar:** Small dropdown for color selection
  - **Evidence:** `src/apBoost/components/tools/ToolsToolbar.jsx:7-52`
- **MultiSelectDropdown in FilterBar:** In analytics, not test session
  - **Evidence:** `src/apBoost/components/analytics/FilterBar.jsx:6-45`
- **No dedicated header menu component exists**

---

### 10) Where is `ToolsToolbar` rendered relative to the scroll container?

**Answer:**
- **Toolbar is OUTSIDE the scroll container** (cannot be sticky)
- **Evidence:** `src/apBoost/components/tools/PassageDisplay.jsx:57-76`
  ```jsx
  <div className="flex flex-col h-full">
    {/* Toolbar - OUTSIDE overflow container */}
    {showToolbar && isText && (
      <div className="shrink-0 pb-3 mb-3 border-b border-border-default">
        <ToolsToolbar ... />
      </div>
    )}
    {/* Content area - THIS is the overflow-auto container */}
    <div className="flex-1 overflow-auto relative" ref={contentRef}>
      ...
    </div>
  </div>
  ```
- Toolbar wrapper has `shrink-0` and is a sibling to the `overflow-auto` div
- **For sticky to work, toolbar must be INSIDE the scroll container**

---

### 11) Does PassageDisplay use overflow patterns that would affect sticky?

**Answer: Yes**
- **PassageDisplay structure:**
  - Outer: `<div className="flex flex-col h-full">` (no overflow)
  - Toolbar: `<div className="shrink-0 ...">` (fixed height, no overflow)
  - Content: `<div className="flex-1 overflow-auto relative">` (THIS scrolls)
- **Evidence:** `src/apBoost/components/tools/PassageDisplay.jsx:57-76`

- **Parent container (QuestionDisplay):**
  - `<div className="bg-surface rounded-[--radius-card] p-4 border border-border-default overflow-auto max-h-[60vh] lg:max-h-none">`
  - **Evidence:** `src/apBoost/components/QuestionDisplay.jsx:102`

- **Conclusion:** Current structure prevents sticky - toolbar is outside scroll container

---

### 12) What are the existing z-index/modal stacking conventions in apBoost?

**Answer:**
- **z-50:** Used for all modals and important overlays
  - DuplicateTabModal: `fixed inset-0 z-50`
  - QuestionNavigator modal: `fixed inset-0 z-50`
  - AssignTestModal backdrop: `z-40`, modal: `z-50`
  - QuestionDetailModal: `fixed inset-0 z-50`
  - GradingPanel: `z-50`
  - ToolsToolbar dropdown: `z-50`
  - Highlighter popup: `z-50`
- **Pattern:** Backdrop at z-40 or same level, modal content at z-50
- **Evidence:**
  - `src/apBoost/components/DuplicateTabModal.jsx:7`
  - `src/apBoost/components/QuestionNavigator.jsx:142`
  - `src/apBoost/components/teacher/AssignTestModal.jsx:141,146`
  - `src/apBoost/components/tools/ToolsToolbar.jsx:29`

---

## Summary of Key Findings

| Feature | Status | Location |
|---------|--------|----------|
| `isSubmitting` state | EXISTS | useTestSession.js:32 |
| Progress modal during submit | NOT FOUND | - |
| Queue flush retry | EXISTS (exp backoff) | useOfflineQueue.js:257-261 |
| Submission-level retry | NOT FOUND | - |
| Submission timeout tracking | NOT FOUND | - |
| Header menu button | NOT FOUND | APTestSession.jsx:402-411 |
| ToolsToolbar sticky | NOT IMPLEMENTED | PassageDisplay.jsx:57-76 |
| Modal z-index convention | z-50 | Multiple files |

---

## Corrections to Fix Plan Line Numbers

| Fix Plan Reference | Actual Location |
|-------------------|-----------------|
| APTestSession.jsx:32 (isSubmitting) | Incorrect - isSubmitting at line 81 (destructured from hook) |
| useTestSession.js:32 (isSubmitting state) | CORRECT |
| useTestSession.js:396-421 (submitTest) | CORRECT |
| ReviewScreen.jsx:138-144 (Submitting text) | CORRECT |
| PassageDisplay.jsx toolbar placement | Lines 59-73 (inside showToolbar block) |
