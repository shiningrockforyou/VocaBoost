# Patch: Connection / grading-failure diagnostic logging (investigation)

Purpose: capture WHY typed-test grading calls fail, into `system_logs` (Firestore, which
is queryable/readable), so we can separate the failure modes instead of guessing:
- **slow/timeout** (call ran ~90s then died) → weak network / big test
- **fail-fast / unreachable** (died in <2s) → firewall / VPN / CORS / DNS
- **offline** (device lost connection)
- **server-side** (function returned an error code)

ADDITIVE ONLY — adds `logSystemEvent` calls + a diagnostic object. No behavior change.
WEB-ONLY (one file: `src/pages/TypedTest.jsx`). Apply on the REAL prod source, then
`npm run build` (build-gate) before deploy. Low risk: logging is wrapped/non-blocking;
worst case a log write fails silently.

NOTE: this is the client side, which is exactly where the "connection error / 튕김"
symptom lives (the call never completing). Server-side reasons (Anthropic down, parse
errors) appear in Google Cloud Functions logs; if you want those in `system_logs` too,
that's a separate Functions-side patch (say the word).

---

## Change L-1 — `src/pages/TypedTest.jsx` import (add logSystemEvent)

**FIND:**
```js
import { submitTypedTestAttempt, withRetry } from '../services/db'
```

**REPLACE WITH:**
```js
import { submitTypedTestAttempt, withRetry, logSystemEvent } from '../services/db'
```

(`logSystemEvent(eventType, data, severity)` is already exported from `services/db.js`
and writes to the `system_logs` collection.)

## Change L-2 — `src/pages/TypedTest.jsx`, replace `gradeWithRetry` (~line 579-610)

**FIND:**
```js
  // AI grading with retry logic
  const gradeWithRetry = async (answersToGrade) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 10000  // 10 seconds
    const TIMEOUT_MS = 90000      // 90 seconds per attempt

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const functions = getFunctions()
        const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', {
          timeout: TIMEOUT_MS
        })

        const result = await gradeTypedTest({ answers: answersToGrade })
        return result  // Success!

      } catch (error) {
        console.error(`Grading attempt ${attempt}/${MAX_RETRIES} failed:`, error)

        // Last attempt - throw error
        if (attempt === MAX_RETRIES) {
          throw error
        }

        // Update UI to show we're retrying
        setRetryAttempt(attempt)

        // Wait 10s before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
```

**REPLACE WITH:**
```js
  // AI grading with retry logic + diagnostic logging (connection-error investigation).
  // Logs go to system_logs via logSystemEvent (non-blocking). No behavior change.
  const gradeWithRetry = async (answersToGrade) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 10000  // 10 seconds
    const TIMEOUT_MS = 90000      // 90 seconds per attempt

    // Shared diagnostic context for this submission
    let payloadChars = -1
    try { payloadChars = JSON.stringify(answersToGrade).length } catch { /* ignore */ }
    const conn = (typeof navigator !== 'undefined' && navigator.connection) || {}
    const diagBase = {
      classId: classIdParam || null,
      listId: listId || null,
      testId: testId || null,
      studyDay: sessionContext?.dayNumber ?? null,
      testType: currentTestType || null,
      wordCount: Array.isArray(answersToGrade) ? answersToGrade.length : null,
      payloadChars,
      effectiveType: conn.effectiveType || null,   // '4g','3g','2g','slow-2g'
      downlinkMbps: (conn.downlink ?? null),        // approx bandwidth
      rttMs: (conn.rtt ?? null),                    // approx round-trip time
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const startedAt = Date.now()
      try {
        const functions = getFunctions()
        const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', {
          timeout: TIMEOUT_MS
        })

        const result = await gradeTypedTest({ answers: answersToGrade })

        // Succeeded — if it needed a retry, record that (tells us retries are saving people)
        if (attempt > 1) {
          logSystemEvent('grading_recovered', {
            ...diagBase, attempt, elapsedMs: Date.now() - startedAt,
            studentId: user?.uid || null,
          }, 'warning')
        }
        return result  // Success!

      } catch (error) {
        const elapsedMs = Date.now() - startedAt
        // The key diagnostic write — this is what we query to classify failures.
        logSystemEvent('grading_attempt_failed', {
          ...diagBase,
          studentId: user?.uid || null,
          attempt,
          isFinal: attempt === MAX_RETRIES,
          elapsedMs,
          timedOut: elapsedMs >= (TIMEOUT_MS - 1500),   // ran the full window => slow/timeout
          failedFast: elapsedMs < 2000,                 // died immediately => unreachable/offline
          online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
          errCode: error?.code || null,                 // e.g. functions/deadline-exceeded, unavailable
          errName: error?.name || null,
          errMessage: String(error?.message || '').slice(0, 300),
        }, 'error')
        console.error(`Grading attempt ${attempt}/${MAX_RETRIES} failed [${error?.code || '?'}, ${elapsedMs}ms]:`, error)

        // Last attempt - throw error
        if (attempt === MAX_RETRIES) {
          throw error
        }

        // Update UI to show we're retrying
        setRetryAttempt(attempt)

        // Wait 10s before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
```

(`classIdParam`, `listId`, `testId`, `sessionContext`, `currentTestType`, `user` are all
already in component scope at this site — same scope `handleSubmit` uses.)

---

## What each field tells us (how I'll read it)
- **`timedOut: true`** (elapsed ~90s) → the call reached the server but didn't return in
  time = slow network or a too-slow/large grading job. Correlate with `wordCount`/
  `payloadChars` (big tests like pace-100 classes) and `effectiveType`/`downlinkMbps`.
- **`failedFast: true`** (<2s) + `online:false` → device was offline.
- **`failedFast: true`** + `online:true` + `errCode: functions/unavailable` →
  unreachable backend = firewall/VPN/DNS (the "other sites work but this doesn't" case).
- **`errCode: functions/unauthenticated`** → session expired.
- **`errCode: functions/internal` / server messages** → server-side function error.
- **`grading_recovered`** count vs **`grading_attempt_failed isFinal:true`** count →
  how often retries rescue students vs. hard failures.
- Group by **`classId`** → is one class/network (e.g., 유라시아, the Vietnam cohort)
  over-represented? Group by **`effectiveType`** → is it correlated with slow devices?

## Verify after applying
1. esbuild parse-check `TypedTest.jsx` (loader 'jsx'); then `npm run build`.
2. Force a failure (DevTools → Network → Offline, submit a typed test) → confirm a
   `grading_attempt_failed` doc appears in `system_logs` with `online:false`,
   `failedFast:true`.
3. Normal grading still works unchanged (logging is additive).

## After it's live
Ping me — I'll query `system_logs` for `grading_attempt_failed` / `grading_recovered`
over a day and give you the breakdown: timeout vs unreachable vs offline vs server,
by class and by network type. That's the data that finally answers "what's actually
causing the connection errors."

## Deploy
Log to `change_action_log.md`. Web-only (1 file) → git push → Netlify. No functions/rules.
