# Acceptance Criteria Audit: Sections 5.6 to 5.8

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 32
- ✅ Implemented: 23
- ⚠️ Partial: 4
- ❌ Missing: 5
- ❓ Unable to Verify: 0

---

## Section 5.6: Duplicate Tab Detection

### 5.6.1 Token Architecture

#### Criterion: sessionId identifies test attempt (Firestore + URL)
- **Status:** ✅ Implemented
- **Evidence:**
  - [useTestSession.js:24](src/apBoost/hooks/useTestSession.js#L24) - accepts testId parameter
  - [apSessionService.js:48](src/apBoost/services/apSessionService.js#L48) - sessionId generated as `${userId}_${testId}_${Date.now()}`
  - [APTestSession.jsx:40](src/apBoost/pages/APTestSession.jsx#L40) - testId from useParams()
- **Notes:** Session ID is properly used to identify test attempts across Firestore and URL routing.

#### Criterion: sessionToken identifies current "owner" of session (Firestore, updated on takeover)
- **Status:** ✅ Implemented
- **Evidence:**
  - [apSessionService.js:53](src/apBoost/services/apSessionService.js#L53) - sessionToken generated in createOrResumeSession
  - [useDuplicateTabGuard.js:28-46](src/apBoost/hooks/useDuplicateTabGuard.js#L28-L46) - claimSession updates sessionToken
  - [useHeartbeat.js:47-50](src/apBoost/hooks/useHeartbeat.js#L47-L50) - checks sessionToken for takeover detection
- **Notes:** sessionToken is properly managed for ownership tracking.

#### Criterion: instanceToken identifies specific browser tab (memory only)
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:15-21](src/apBoost/hooks/useDuplicateTabGuard.js#L15-L21)
- **Notes:** Uses `crypto.randomUUID()` with fallback to timestamp+random string. Created via useMemo so it's stable for the component lifecycle but not persisted.

---

### 5.6.2 Detection Methods

#### Criterion: BroadcastChannel API for same browser, instant detection
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:70-97](src/apBoost/hooks/useDuplicateTabGuard.js#L70-L97)
- **Notes:** Creates BroadcastChannel with name `ap_session_${sessionId}`, posts SESSION_CLAIMED messages, and listens for claims from other tabs.

#### Criterion: Firestore token check for cross-browser detection on heartbeat (≤15s)
- **Status:** ✅ Implemented
- **Evidence:**
  - [useHeartbeat.js:9](src/apBoost/hooks/useHeartbeat.js#L9) - `HEARTBEAT_INTERVAL = 15000` (15 seconds)
  - [useHeartbeat.js:47-50](src/apBoost/hooks/useHeartbeat.js#L47-L50) - checks `sessionData.sessionToken !== instanceToken`
- **Notes:** Heartbeat runs every 15 seconds and checks if another instance has taken over.

---

### 5.6.3 Behavior

#### Criterion: Same browser, new tab → first tab shows "moved" modal instantly
- **Status:** ✅ Implemented
- **Evidence:**
  - [useDuplicateTabGuard.js:76-80](src/apBoost/hooks/useDuplicateTabGuard.js#L76-L80) - onmessage handler sets isInvalidated
  - [APTestSession.jsx:394-400](src/apBoost/pages/APTestSession.jsx#L394-L400) - shows DuplicateTabModal when isInvalidated
- **Notes:** BroadcastChannel provides instant cross-tab notification in the same browser.

#### Criterion: Different browser → first browser shows modal within 15s
- **Status:** ✅ Implemented
- **Evidence:** [useHeartbeat.js:47-50](src/apBoost/hooks/useHeartbeat.js#L47-L50) - detects takeover during heartbeat
- **Notes:** Will detect within one heartbeat cycle (15s max).

#### Criterion: Different device → first device shows modal within 15s
- **Status:** ✅ Implemented
- **Evidence:** Same as above - Firestore-based detection works cross-device
- **Notes:** Cross-device detection uses same heartbeat mechanism.

#### Criterion: Later tab ALWAYS wins
- **Status:** ✅ Implemented
- **Evidence:**
  - [useDuplicateTabGuard.js:84-91](src/apBoost/hooks/useDuplicateTabGuard.js#L84-L91) - new tab claims session on mount
  - [useHeartbeat.js:57](src/apBoost/hooks/useHeartbeat.js#L57) - heartbeat updates sessionToken to current instanceToken
- **Notes:** New tabs claim the session immediately, making them the owner.

#### Criterion: First tab becomes read-only
- **Status:** ✅ Implemented
- **Evidence:**
  - [APTestSession.jsx:436](src/apBoost/pages/APTestSession.jsx#L436) - `disabled={isSubmitting || isInvalidated}`
  - [APTestSession.jsx:444](src/apBoost/pages/APTestSession.jsx#L444) - FRQTextInput disabled
  - [APTestSession.jsx:450-454](src/apBoost/pages/APTestSession.jsx#L450-L454) - AnswerInput disabled
  - [APTestSession.jsx:467](src/apBoost/pages/APTestSession.jsx#L467) - Flag button disabled
- **Notes:** All interactive elements are disabled when isInvalidated is true.

---

### 5.6.4 useDuplicateTabGuard Hook

#### Criterion: Generates instanceToken with crypto.randomUUID() on mount
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:15-21](src/apBoost/hooks/useDuplicateTabGuard.js#L15-L21)
- **Notes:** Uses crypto.randomUUID with fallback for older browsers.

#### Criterion: Returns: instanceToken, isInvalidated, takeControl
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:128-132](src/apBoost/hooks/useDuplicateTabGuard.js#L128-L132)
- **Notes:** All three values returned as documented.

#### Criterion: Creates BroadcastChannel: `ap_session_${sessionId}`
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:73](src/apBoost/hooks/useDuplicateTabGuard.js#L73)
- **Notes:** Channel name matches specification exactly.

#### Criterion: Posts SESSION_CLAIMED message with token on mount
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:86-89](src/apBoost/hooks/useDuplicateTabGuard.js#L86-L89)
- **Notes:** Posts message with type and token after 500ms delay.

#### Criterion: Listens for SESSION_CLAIMED from other tabs
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:76-81](src/apBoost/hooks/useDuplicateTabGuard.js#L76-L81)
- **Notes:** onmessage handler checks for SESSION_CLAIMED type.

#### Criterion: Sets isInvalidated=true when different token detected
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:79](src/apBoost/hooks/useDuplicateTabGuard.js#L79)
- **Notes:** Sets state when token doesn't match current instance.

#### Criterion: takeControl() updates sessionToken in Firestore, broadcasts new claim
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:50-64](src/apBoost/hooks/useDuplicateTabGuard.js#L50-L64)
- **Notes:** Calls claimSession() and broadcasts SESSION_CLAIMED message.

#### Criterion: Cleans up BroadcastChannel on unmount
- **Status:** ✅ Implemented
- **Evidence:** [useDuplicateTabGuard.js:103-111](src/apBoost/hooks/useDuplicateTabGuard.js#L103-L111)
- **Notes:** Closes channel and clears timeout in cleanup function.

---

## Section 5.7: Timer Behavior (Lenient Mode)

#### Criterion: Browser/tab closed → Timer pauses (beforeunload)
- **Status:** ❌ Missing
- **Evidence:**
  - [useTestSession.js:208-220](src/apBoost/hooks/useTestSession.js#L208-L220) - beforeunload only shows warning, doesn't pause timer
  - [useDuplicateTabGuard.js:115-126](src/apBoost/hooks/useDuplicateTabGuard.js#L115-L126) - beforeunload is empty (just comment)
- **Notes:** The timer is not paused on beforeunload. The session remains IN_PROGRESS, but no PAUSED status is set. Timer state is saved periodically (every 30s) but not on close.

#### Criterion: Tab backgrounded (desktop) → Timer continues
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js:75-102](src/apBoost/hooks/useTimer.js#L75-L102) - uses setInterval
- **Notes:** JavaScript timers continue running in backgrounded tabs (though may be throttled by browser).

#### Criterion: App backgrounded (mobile) >30s → Timer pauses
- **Status:** ⚠️ Partial
- **Evidence:** No mobile-specific pause logic found in useTimer or useTestSession
- **Notes:** There is no explicit mobile background detection using visibilitychange with >30s threshold. The timer will be throttled by mobile browsers but not explicitly paused.

#### Criterion: Network disconnect → Timer continues locally
- **Status:** ✅ Implemented
- **Evidence:** [useTimer.js](src/apBoost/hooks/useTimer.js) - timer is purely local, no network dependency
- **Notes:** Timer is local-only and continues regardless of network status.

#### Criterion: User clicks "Pause" → Timer pauses (if enabled)
- **Status:** ⚠️ Partial
- **Evidence:**
  - [useTimer.js:47-48](src/apBoost/hooks/useTimer.js#L47-L48) - pause() function exists
  - No pause button found in APTestSession.jsx UI
- **Notes:** The pause function is implemented in useTimer but no user-facing "Pause" button is provided in the test interface.

#### Criterion: Return to paused session → Show "Resume" prompt
- **Status:** ⚠️ Partial
- **Evidence:**
  - [InstructionScreen.jsx](src/apBoost/components/InstructionScreen.jsx) - receives existingSession prop
  - [APTestSession.jsx:262-268](src/apBoost/pages/APTestSession.jsx#L262-L268) - passes existingSession to InstructionScreen
- **Notes:** The instruction screen can show resume information, but since PAUSED status is never set (see first criterion), this flow may not work as intended for crash recovery.

---

## Section 5.8: Submit Flow

### 5.8.1 Normal Submit (Queue Empty)

#### Criterion: Check queue.length === 0
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:406-408](src/apBoost/hooks/useTestSession.js#L406-L408)
```javascript
if (queueLength > 0) {
  await flushQueue()
}
```
- **Notes:** Checks and flushes queue before completing submit.

#### Criterion: Write status: COMPLETED and completedAt to Firestore
- **Status:** ✅ Implemented
- **Evidence:** [apSessionService.js:222-232](src/apBoost/services/apSessionService.js#L222-L232) - completeSession function
- **Notes:** Sets status to COMPLETED and completedAt with serverTimestamp.

#### Criterion: Create ap_test_results document
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:126-156](src/apBoost/services/apScoringService.js#L126-L156)
- **Notes:** Creates result document with all required fields.

#### Criterion: Redirect to results page
- **Status:** ✅ Implemented
- **Evidence:** [APTestSession.jsx:189-191](src/apBoost/pages/APTestSession.jsx#L189-L191)
```javascript
if (resultId) {
  navigate(`/ap/results/${resultId}`)
}
```
- **Notes:** Navigates to results page after successful submit.

---

### 5.8.2 Submit with Pending Queue

#### Criterion: Show "Syncing your answers..." modal with progress
- **Status:** ❌ Missing
- **Evidence:** No modal component for sync progress found in APTestSession.jsx
- **Notes:** The submit flow flushes the queue but doesn't show a progress modal to the user.

#### Criterion: Aggressive flush: retry every 2s
- **Status:** ⚠️ Partial
- **Evidence:** [useOfflineQueue.js:255-261](src/apBoost/hooks/useOfflineQueue.js#L255-L261)
```javascript
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
}
```
- **Notes:** Uses exponential backoff (2s, 4s, 8s, 16s) rather than fixed 2s aggressive retry.

#### Criterion: On success: complete submit normally
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:406-411](src/apBoost/hooks/useTestSession.js#L406-L411)
- **Notes:** After flush completes, proceeds to create test result.

#### Criterion: On failure for 30s+: show "Unable to sync" modal
- **Status:** ❌ Missing
- **Evidence:** No "Unable to sync" modal found
- **Notes:** There is no modal shown after extended sync failure. The submit will simply fail.

#### Criterion: "Unable to sync" shows: keep tab open, check connection, keep trying
- **Status:** ❌ Missing
- **Evidence:** No such modal found
- **Notes:** Required UI for failed sync not implemented.

#### Criterion: [Keep Trying] button available
- **Status:** ❌ Missing
- **Evidence:** No such button found
- **Notes:** Required UI for failed sync not implemented.

#### Criterion: No JSON backup option - user warned, their choice if they close
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:210-215](src/apBoost/hooks/useTestSession.js#L210-L215)
```javascript
if (queueLength > 0) {
  e.preventDefault()
  e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
}
```
- **Notes:** Shows browser warning when there are unsaved changes. No JSON backup option (as specified).

---

## Recommendations

### High Priority

1. **Implement PAUSED Status on Close (5.7)**
   - Add logic to set session status to PAUSED in beforeunload handler
   - Save current timer state to Firestore on close
   - Files to modify: [useTestSession.js](src/apBoost/hooks/useTestSession.js), [apSessionService.js](src/apBoost/services/apSessionService.js)

2. **Implement Submit Progress Modal (5.8.2)**
   - Create a SyncingModal component showing sync progress
   - Show "Syncing your answers..." with progress indicator
   - Add "Unable to sync" state after 30s with "Keep Trying" button
   - Files to create: `src/apBoost/components/SyncingModal.jsx`
   - Files to modify: [APTestSession.jsx](src/apBoost/pages/APTestSession.jsx)

3. **Mobile Background Timer Pause (5.7)**
   - Add visibilitychange listener with 30s threshold for mobile
   - Pause timer when app backgrounded on mobile for >30s
   - Files to modify: [useTimer.js](src/apBoost/hooks/useTimer.js)

### Medium Priority

4. **Optional Pause Button (5.7)**
   - Consider adding a user-facing pause button to the test interface
   - This may need to be configurable per-test (some tests allow pause, some don't)
   - Files to modify: [APTestSession.jsx](src/apBoost/pages/APTestSession.jsx)

5. **Aggressive Flush on Submit (5.8.2)**
   - Change from exponential backoff to fixed 2s retry during submit flow
   - Add timeout counter for the 30s failure threshold
   - Files to modify: [useOfflineQueue.js](src/apBoost/hooks/useOfflineQueue.js)

### Patterns Observed

- **Good:** Token architecture for duplicate tab detection is well-implemented with both instant (BroadcastChannel) and delayed (Firestore heartbeat) detection methods.
- **Good:** The offline queue with IndexedDB provides good data loss protection for normal operation.
- **Gap:** Timer pause on close/background is incomplete, which could lead to unexpected timer behavior during session recovery.
- **Gap:** Submit flow lacks user feedback during sync, which could cause confusion if sync takes time or fails.
