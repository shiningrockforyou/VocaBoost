# Batch B14G Retest Findings: FIX-1, FIX-2, FIX-10

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** COMPLETE
**Scenarios Covered:** B14G-001 (FIX-1 retest), B14G-002 (FIX-2 retest), B14G-004 (FIX-10 retest)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900
- **Auth:** student10@apboost.test / Student123!
- **Test:** test_micro_full_1 (AP Microeconomics Practice Exam)
- **Context:** Retest of consolidated fixes from findings_B14_consolidated_fixes.md

---

## Scenario Results

### B14G-001 Retest: FIX-1 (Stale closure in useOfflineQueue.js)
- **Status:** PASS
- **Evidence:** 3 ANSWER_CHANGE items queued in IndexedDB while offline, flushed to Firestore within 1 second of network restore. No TDZ/ReferenceError console errors observed.
- **Notes:** `scheduleFlush` now uses `flushQueueRef.current?.()` indirection. The `handleOnline` event listener correctly calls `scheduleFlush(500)` via the ref, avoiding the stale closure bug. Confirmed no initialization order errors.

### B14G-002 Retest: FIX-2 (reconcileQueue content-based comparison)
- **Status:** FAIL
- **Evidence:** After answering Q15=A online (flushed to Firestore), answering Q15=B offline (IDB pending), closing the page, and opening a new page to the same URL, the UI shows Q15=A (from Firestore) — the offline answer B is lost. reconcileQueue debug logs are absent, confirming the function never executes its logic. IDB still holds 2 pending items after resume.
- **Notes:** Content-based comparison code IS present in source (lines 662-681 of useTestSession.js). The bug is a DB initialization race condition — `reconcileQueue` runs before `dbRef.current` is set in `useOfflineQueue`, causing `getPendingItems` to return `[]` prematurely, which sets `reconciledRef.current = true` and prevents future runs.

### B14G-004 Retest: FIX-10 (Heartbeat recovery speed)
- **Status:** DOCUMENTED (FIX-10 not yet applied; current behavior measured)
- **Evidence:** "Connection unstable" banner appears after 46,503ms offline (3 failed heartbeats at HEARTBEAT_INTERVAL=15000ms). After network restore, "Connection unstable" clears at ~1s, "Reconnected" banner appears at ~2s. Recovery measured as fast due to the existing `visibilitychange` handler calling `doHeartbeat()` immediately on context restore.
- **Notes:** FIX-10 would add `window.addEventListener('online', doHeartbeat)` to `useHeartbeat.js`. Current recovery of ~2s is acceptably fast in the Playwright context. On a real browser, if the tab is not regaining focus, recovery would wait up to 15s for the next heartbeat interval. FIX-10 remains recommended to guarantee sub-5s recovery in all scenarios.

---

## Findings

### Blockers
> None

---

### High-Priority

#### [FINDING-B14G-001]: reconcileQueue DB race condition causes permanent offline answer loss

- **Severity:** High-Priority
- **Scenario:** B14G-002 (FIX-2 retest)
- **Criteria Reference:** B14G-002 (from findings_B14_consolidated_fixes.md, FIX-2 section)
- **What Happened:** After answering Q15=A online (flushed to Firestore) and then Q15=B offline (1 pending IDB item), closing the browser tab and opening a new one caused the offline answer B to be permanently lost. The UI restored Q15=A from Firestore. reconcileQueue produced zero debug log output, confirming its logic block was never reached. The IDB retained its 2 pending items (ANSWER_CHANGE=B and TIMER_SYNC) unprocessed even after the Resume flow completed.
- **Expected:** reconcileQueue should detect the ANSWER_CHANGE item (Q15=B) as "fresh" (since Firestore has A, and A !== B), apply B to the local answers Map, and then flush B to Firestore. UI should show Q15=B after resume.
- **Screenshot/Evidence:** Screenshots in `screenshots_B14G_debug/`: `03_page2_instruction.png`, `04_page2_loaded.png`, `05_final_state.png`. Console output from `b14g_fix2_debug_results.json` confirms zero reconcileQueue log entries despite 2 pending IDB items.
- **File(s) to Fix:** `src/apBoost/hooks/useTestSession.js` (reconcileQueue useEffect, line ~646), `src/apBoost/hooks/useOfflineQueue.js` (getPendingItems gate)
- **How to Fix:** The root cause is a race: `reconcileQueue` fires when `session?.id` changes (from `undefined` to the real ID), but at that moment `dbRef.current` in `useOfflineQueue` may still be `null` (awaiting `openDatabase()` async callback). `getPendingItems` returns `[]` immediately because `if (!dbRef.current) return []`. `reconciledRef.current` is set to `true`. The function exits early. The reconcileQueue never re-runs because `reconciledRef.current` guards against it.

  **Solution — add a `dbReady` signal to `useOfflineQueue` and wait for it in reconcileQueue:**

  In `useOfflineQueue.js`, add a `dbReady` state:
  ```js
  const [dbReady, setDbReady] = useState(false)

  // In initDB(), after dbRef.current is set:
  async function initDB() {
    try {
      dbRef.current = await openDatabase()
      if (mounted) {
        setDbReady(true)   // Signal DB is ready
        await updateQueueLength()
      }
    } catch (error) {
      logError('useOfflineQueue.initDB', { sessionId }, error)
    }
  }
  ```

  Return `dbReady` from `useOfflineQueue`:
  ```js
  return {
    addToQueue, flushQueue, waitForFlush, queueLength, isOnline,
    isFlushing, isOpportunistic, isStorageFull, getPendingItems,
    deleteItems,
    dbReady,   // Add this
  }
  ```

  In `useTestSession.js`, destructure `dbReady`:
  ```js
  const { addToQueue, flushQueue, ..., getPendingItems, deleteItems, dbReady } = useOfflineQueue(session?.id)
  ```

  Add `dbReady` to the reconcileQueue effect's dependency array:
  ```js
  useEffect(() => {
    const reconcileQueue = async () => {
      if (!session?.id || !dbReady || reconciledRef.current) return  // Wait for DB
      reconciledRef.current = true
      // ... rest of reconcileQueue logic
    }
    reconcileQueue()
  }, [session?.id, dbReady, getPendingItems, deleteItems, flushQueue])  // Add dbReady
  ```

  This ensures reconcileQueue only runs after both the session AND the IDB are ready, preventing the race condition.

  **Alternative (simpler, no new state):** Add a retry loop inside `getPendingItems` that polls until `dbRef.current` is available, with a short timeout. But the `dbReady` state approach is cleaner and follows React patterns.

- **Acceptance Test:**
  1. Login as student10@apboost.test
  2. Navigate to `/ap/test/test_micro_full_1` → Begin/Resume
  3. Answer Q15=A (verify it flushes — wait 4 seconds, check IDB is empty)
  4. Use browser DevTools → Network → throttle to "Offline" mode
  5. Change Q15 to B (verify IDB shows 1 pending ANSWER_CHANGE item)
  6. Close the tab (while offline)
  7. Open a new tab, navigate to `/ap/test/test_micro_full_1`
  8. Resume Test
  9. Verify Q15 shows B selected (not A)
  10. Check browser console for `[APBoost:useTestSession.reconcileQueue] Applying 1 fresh queue items to UI`
  11. Q15=B should persist after going back online

---

### Medium-Priority

#### [FINDING-B14G-002]: FIX-10 heartbeat recovery — visibilitychange provides partial mitigation but online event listener still needed

- **Severity:** Medium-Priority
- **Scenario:** B14G-004 (FIX-10 retest)
- **Criteria Reference:** FIX-10 from findings_B14_consolidated_fixes.md
- **What Happened:** In Playwright testing, network restore triggers `visibilitychange` which calls `doHeartbeat()` immediately, producing a ~2s reconnect time. The "Connection unstable" banner correctly appears after ~46.5s offline (3 heartbeat failures × 15s each). After restore, the banner clears within 1s and "Reconnected" appears at 2s.
- **Expected per FIX-10:** `useHeartbeat.js` should add `window.addEventListener('online', handleOnline)` so that on any browser network restore (even without tab focus change), heartbeat fires immediately and reconnection is detected within 5s.
- **Screenshot/Evidence:** Screenshots in `screenshots_B14G_retest_v2/`: `14_14_unstable_banner.png` (banner after 46.5s), `16_16_reconnected_banner.png` (reconnected at 2s). Results documented in `b14g_retest_v2_results.json`.
- **File(s) to Fix:** `src/apBoost/hooks/useHeartbeat.js`
- **How to Fix:** Add an `online` event listener to trigger immediate heartbeat on network restore. In `useHeartbeat.js`, add this effect after the existing `visibilitychange` handler (after line 129):

  ```js
  // Add online event listener for immediate heartbeat on network restore
  useEffect(() => {
    const handleOnline = () => {
      if (sessionId && instanceToken) {
        logDebug('useHeartbeat', 'Network restored, triggering immediate heartbeat')
        doHeartbeat()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sessionId, instanceToken, doHeartbeat])
  ```

  This ensures recovery happens within ~1s of network restore (the heartbeat read+write takes ~100-500ms on good connections) rather than waiting up to 15s for the next interval tick.

- **Acceptance Test:**
  1. Open the test page and start a test session
  2. Block all network requests (DevTools → Network → Offline)
  3. Wait 50 seconds until "Connection unstable" banner appears
  4. Re-enable network
  5. "Reconnected" banner should appear within 5 seconds of network restore
  6. Without this fix: "Reconnected" may take up to 15 seconds (next heartbeat cycle)
  7. Check browser console for `[APBoost:useHeartbeat] Network restored, triggering immediate heartbeat`

---

### Nitpicks

- **Nit:** `HEARTBEAT_INTERVAL = 15000ms` means "Connection unstable" only appears after ~45 seconds offline. Students on school WiFi that drops for 30 seconds would never see the banner. Consider `MAX_FAILURES = 2` (30s to trigger) or `HEARTBEAT_INTERVAL = 10000ms` (30s to trigger) for more responsive feedback. This is low-priority as the current behavior does not cause data loss.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| `/ap/test/test_micro_full_1` | `Failed to load resource: net::ERR_INTERNET_DISCONNECTED` | Expected (offline simulation) |
| `/ap/test/test_micro_full_1` | `[APBoost:useHeartbeat.doHeartbeat] {message: Heartbeat write timed out after 5000ms}` | Expected (offline simulation — logError output) |
| `/` | `[APBoost:useHeartbeat.doHeartbeat] Session taken over by another instance` | Expected (multiple test runs, each creates new instance token) |

No unexpected errors. No `code.startsWith is not a function` errors (logError.js fix confirmed working).

---

## FIX-1 Detailed Evidence

**Test scenario:** student10 session at Q15, IDB cleared, Q15=A answered online, network blocked offline, Q15=B answered offline.

| Timestamp | Action | IDB Pending |
|-----------|--------|-------------|
| t=0 | Context offline | 0 |
| t=0.3s | Q15=B clicked offline | 1 (ANSWER_CHANGE val=B) |
| t=0s (restore) | Context online | 1 |
| t=1s after restore | Check IDB | 0 (flushed!) |

The `handleOnline` callback in `useOfflineQueue.js` (lines 95-106):
```js
const handleOnline = () => {
  setIsOnline(true)
  retryCountRef.current = 0
  setIsOpportunistic(false)
  if (flushTimeoutRef.current) {
    clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = null
  }
  scheduleFlush(500)  // <- This calls flushQueueRef.current?.() after 500ms
}
```

`scheduleFlush` (lines 247-254):
```js
const scheduleFlush = useCallback((delay) => {
  if (flushTimeoutRef.current) { clearTimeout(flushTimeoutRef.current) }
  flushTimeoutRef.current = setTimeout(() => {
    flushQueueRef.current?.()  // <- Always calls latest flushQueue
  }, delay)
}, [])  // [] deps: safe because ref breaks stale capture
```

**Verdict: FIX-1 PASS.** The `flushQueueRef` indirection correctly ensures `flushQueue` (with current `isOnline=true`) is called after network restore.

---

## FIX-2 Detailed Evidence

**Test scenario:** student10 session at Q15, IDB cleared, Q15=A online (flushed), Q15=B offline (pending), page1 closed, page2 opened.

| Action | Result |
|--------|--------|
| IDB before Resume (page2) | 2 items: ANSWER_CHANGE val=B, TIMER_SYNC |
| reconcileQueue debug logs | NONE — function never logged |
| Answer shown after Resume | A (from Firestore) |
| IDB after Resume | 2 items still pending (not processed) |

**Root cause trace:**
1. Page2 mounts → `useOfflineQueue(session?.id)` initializes with `session?.id = undefined`
2. `initDB()` starts async — `dbRef.current = null` initially
3. `loadTest()` completes → `setSession(existingSession)` → `session?.id = real_id`
4. reconcileQueue useEffect fires (deps changed: `session?.id` went from undefined to real_id)
5. Inside reconcileQueue: `reconciledRef.current = false` → proceeds
6. `reconciledRef.current = true` ← SET IMMEDIATELY
7. `getPendingItems()` called → `if (!mountedRef.current || !dbRef.current || !sessionId) return []`
8. IF `dbRef.current` is still null at this point → returns `[]`
9. `if (pendingItems.length === 0) return` → exits early
10. Items in IDB are never processed, `reconciledRef.current` = true prevents future runs

**The FIX-2 content-based comparison code EXISTS in the source but is guarded by `if (pendingItems.length === 0) return` which fires before the comparison logic is reached.**

---

## FIX-10 Detailed Evidence

| Metric | Value |
|--------|-------|
| HEARTBEAT_INTERVAL | 15000ms |
| MAX_FAILURES | 3 |
| Time to "Connection unstable" | ~46.5s offline |
| Time to clear unstable banner | ~1s after restore |
| Time to "Reconnected" banner | ~2s after restore |
| Recovery mechanism active | visibilitychange handler (line 117-128 in useHeartbeat.js) |
| FIX-10 online event listener | NOT present in current source |

The fast 2s recovery in testing is because Playwright's `context.setOffline(false)` triggers `visibilitychange` which calls `doHeartbeat()` immediately. In a real browser where a user is on a fixed desktop and the network briefly drops without tab focus change, recovery would wait up to 15s.

---

## code.startsWith Regression Check

**Status: PASS** — No `code.startsWith is not a function` errors observed across all test runs. The `logError.js` fix (using `String(error?.code || '')`) is confirmed working.

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 3 |
| PASS | 1 (FIX-1) |
| FAIL | 1 (FIX-2) |
| DOCUMENTED | 1 (FIX-10) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 1 (B14G-001: reconcileQueue DB race) |
| Medium-Priority Found | 1 (B14G-002: FIX-10 not applied) |
| Nitpicks | 1 |

---

## Key Test Scripts (Evidence)

All scripts saved in `src/apBoost/criteria_audit/playwright_reports/`:
- `b14g_retest_final.mjs` — initial exploration run
- `b14g_retest_v2.mjs` — confirmed FIX-10 behavior, captured "Reconnected" at 2s
- `b14g_fix1_final.mjs` — confirmed FIX-1 PASS (3 items flushed in 1s)
- `b14g_fix2_test.mjs` — confirmed Q15=B in IDB, page reload while offline fails in Playwright
- `b14g_fix2_v2.mjs` — confirmed FIX-2 FAIL (Q15=A shown after Q15=B offline)
- `b14g_fix2_debug.mjs` — confirmed reconcileQueue never ran (0 log entries, IDB items unprocessed)

Screenshots saved in:
- `screenshots_B14G_retest_v2/` — FIX-10 evidence
- `screenshots_B14G_fix1/` — FIX-1 evidence
- `screenshots_B14G_final/` — FIX-2 data loss evidence
- `screenshots_B14G_debug/` — reconcileQueue non-execution evidence
