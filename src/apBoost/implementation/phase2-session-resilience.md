# Phase 2: Session Resilience

> **Goal:** No data loss, handles network issues, duplicate tabs

## Prerequisites
- Phase 1 complete and verified
- Read `ap_boost_spec_plan.md` sections: 4.3-4.14 (Session State Management)
- Read plan file Part 8 (Error Handling Strategy)

---

## Step 2.1: useOfflineQueue Hook

**File:** `hooks/useOfflineQueue.js`

**Purpose:** Queue writes to IndexedDB, flush to Firestore when online.

```javascript
export function useOfflineQueue(sessionId) {
  return {
    addToQueue: (action) => void,
    flushQueue: () => Promise<void>,
    queueLength: number,
    isOnline: boolean,
    isFlushing: boolean,
  };
}
```

**IndexedDB Schema:**
```javascript
// Database: ap_action_queue
{
  id: string,              // UUID
  sessionId: string,
  localTimestamp: number,  // Date.now()
  action: string,          // "ANSWER_CHANGE", "FLAG_TOGGLE", etc.
  payload: object,
  status: "PENDING" | "CONFIRMED"
}
```

**Action Types:**
| Action | Payload |
|--------|---------|
| `ANSWER_CHANGE` | `{ questionId, value }` |
| `FLAG_TOGGLE` | `{ questionId, markedForReview }` |
| `NAVIGATION` | `{ currentSectionIndex, currentQuestionIndex }` |
| `TIMER_SYNC` | `{ sectionTimeRemaining }` |
| `SESSION_SUBMIT` | `{ status: "COMPLETED" }` |

**Retry Strategy:**
1. On failure: exponential backoff (2s, 4s, 8s)
2. After 3 failures: switch to opportunistic mode
3. Retry on: online event, visibility change, user action

**Verification:**
- [ ] Queue persists after browser crash
- [ ] Flushes on reconnect
- [ ] Handles concurrent writes

---

## Step 2.2: useHeartbeat Hook

**File:** `hooks/useHeartbeat.js`

**Purpose:** 15-second server ping, verify session validity.

```javascript
export function useHeartbeat(sessionId, instanceToken) {
  return {
    isConnected: boolean,
    failureCount: number,
    lastHeartbeat: Date | null,
  };
}
```

**Behavior:**
- Every 15s: update `lastHeartbeat` in Firestore
- On success: check `sessionToken` matches (detect takeover)
- After 3 consecutive failures: trigger disconnected state

**Verification:**
- [ ] Heartbeat updates Firestore
- [ ] Detects session takeover
- [ ] Tracks failure count

---

## Step 2.3: ConnectionStatus Component

**File:** `components/ConnectionStatus.jsx`

**Banner when connection lost:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠ Connection unstable - your progress is being saved locally   │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface ConnectionStatusProps {
  isConnected: boolean;
  isSyncing: boolean;
}
```

**States:**
- Connected: No banner
- Disconnected: Yellow warning banner
- Reconnected: "Syncing..." briefly, then hide

**Verification:**
- [ ] Shows on disconnect
- [ ] Hides on reconnect
- [ ] Shows syncing state

---

## Step 2.4: useDuplicateTabGuard Hook

**File:** `hooks/useDuplicateTabGuard.js`

**Purpose:** Detect duplicate tabs using BroadcastChannel + Firestore.

```javascript
export function useDuplicateTabGuard(sessionId) {
  const instanceToken = useMemo(() => crypto.randomUUID(), []);

  return {
    instanceToken: string,
    isInvalidated: boolean,
    takeControl: () => Promise<void>,
  };
}
```

**Detection Methods:**

1. **BroadcastChannel (same browser, instant):**
```javascript
const channel = new BroadcastChannel(`ap_session_${sessionId}`);
channel.postMessage({ type: 'SESSION_CLAIMED', token: instanceToken });
channel.onmessage = (event) => {
  if (event.data.token !== instanceToken) {
    setIsInvalidated(true);
  }
};
```

2. **Firestore token check (cross-browser, on heartbeat):**
```javascript
if (session.sessionToken !== instanceToken) {
  setIsInvalidated(true);
}
```

**Behavior:**
- On mount: claim session (update `sessionToken` in Firestore)
- On detection: set invalidated, show modal
- "Use This Tab": re-claim session
- "Go to Dashboard": navigate away

**Verification:**
- [ ] Same-browser detection instant
- [ ] Cross-browser detection within 15s
- [ ] "Use This Tab" works

---

## Step 2.5: DuplicateTabModal Component

**File:** `components/DuplicateTabModal.jsx`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ⚠ Session Active Elsewhere                  │
│                                                                 │
│    This test is already open in another browser tab.            │
│                                                                 │
│    To prevent data conflicts, you can only have one             │
│    active session at a time.                                    │
│                                                                 │
│              [Use This Tab]    [Go to Dashboard]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface DuplicateTabModalProps {
  onTakeControl: () => void;
  onGoToDashboard: () => void;
}
```

**Verification:**
- [ ] Modal blocks interaction
- [ ] Buttons work correctly

---

## Step 2.6: APErrorBoundary Component

**File:** `components/APErrorBoundary.jsx`

**React Error Boundary for crash recovery:**

```jsx
class APErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logError('APErrorBoundary', { componentStack: errorInfo.componentStack }, error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

**ErrorFallback shows:**
- "Something went wrong" message
- "Try Again" button
- "Return to Dashboard" link
- Note: "Your answers are saved locally"

**Verification:**
- [ ] Catches render errors
- [ ] Shows fallback UI
- [ ] Retry works

---

## Step 2.7: Integrate into useTestSession

**File:** `hooks/useTestSession.js`

**Update to integrate all resilience hooks:**

```javascript
export function useTestSession(testId, assignmentId) {
  // Existing state...

  // Add resilience
  const { addToQueue, flushQueue, queueLength, isOnline } = useOfflineQueue(sessionId);
  const { isConnected, failureCount } = useHeartbeat(sessionId, instanceToken);
  const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(sessionId);

  // Update setAnswer to use queue
  const setAnswer = useCallback((answer) => {
    // Optimistic local update
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));

    // Queue for Firestore
    addToQueue({
      action: 'ANSWER_CHANGE',
      payload: { questionId: currentQuestion.id, value: answer }
    });
  }, [currentQuestion, addToQueue]);

  // Add beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (queueLength > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [queueLength]);

  return {
    // ...existing returns
    isConnected,
    isInvalidated,
    takeControl,
    queueLength,
  };
}
```

**Verification:**
- [ ] Answers queue correctly
- [ ] beforeunload warning shows
- [ ] All hooks integrated

---

## Utilities

### logError.js

**File:** `utils/logError.js`

```javascript
export function logError(functionName, context, error) {
  const errorInfo = {
    function: functionName,
    context,
    message: error?.message || String(error),
    code: error?.code,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
  };

  console.error(`[${functionName}]`, errorInfo);

  // Future: send to error tracking service
}
```

### withTimeout.js

**File:** `utils/withTimeout.js`

```javascript
export async function withTimeout(promise, ms, operation) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}
```

---

## Final Verification Checklist

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
