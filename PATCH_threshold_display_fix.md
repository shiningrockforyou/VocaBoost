# Patch: pass-threshold mislabel ("below 95%") + UI/server pass-verdict split + guide text + error-mechanism codes

Contains Changes F-1..F-3 (threshold), G-1..G-5 (error classification — layered
errors: human message + mechanism code + correlation ref), and H-1..H-2 (wrong-day
attempt stamping when session context is lost — root cause of "already did the
review but it keeps reappearing").

Self-contained; independent of PATCH_day2_passer_session_desync.md (apply either order,
both touch different lines; this one touches TypedTest/MCQTest PATH-B blocks and the
help guides only).

## Evidence / symptom
- Screenshot 2026-06-10: Ryan Han (26SM SAT Inter A1, class threshold **92%**) failed a
  Day-3 typed test at 90% and the result card said "Your score is below **95%**".
- Stored thresholds are fine: every active 26SM assignment = 92 (Bridge classes = 90).
  **No active class uses 95.** So any "95%" a student sees is a fallback, not config.
- Server-side attempt verdicts are CORRECT (passed computed against the class doc) —
  today's 21 students scoring 92–94 all have `passed=true`.
- The bug is client-side only, but real: the SAME wrong value drives the UI pass/fail
  (`passed = score >= retakeThreshold`), so a **92–94% scorer on an affected launch
  path sees "Did not pass → Try Again" while the server recorded a pass** → confused
  students, unnecessary retakes, "teacher sees pass / student told fail" reports.

## Root cause
`TypedTest.jsx` and `MCQTest.jsx` resolve the display/UI threshold from three launch
paths:
- PATH A (testConfig from the session flow): correct — `buildTestConfig` uses the real
  `assignment.passThreshold ?? 95`.
- PATH C (no state; fetches the class doc): correct.
- **PATH B (legacy `wordPool` via navigation state): uses
  `(assignmentSettings?.passThreshold || 95)` and NEVER consults the class doc.** If the
  passed-in settings lack `passThreshold`, the UI silently runs at 95.
- Additionally both components initialize `useState(0.95)`, so any path that fails to
  call `setRetakeThreshold` renders 95.

## Change F-1 — `src/pages/TypedTest.jsx` (PATH B block, ~line 304)

**FIND:**
```js
      // PATH B: Legacy wordPool provided (backwards compatibility)
      if (wordPool && wordPool.length > 0) {
        // Apply assignment settings if provided
        if (assignmentSettings) {
          setRetakeThreshold((assignmentSettings.passThreshold || 95) / 100)
        }
```

**REPLACE WITH:**
```js
      // PATH B: Legacy wordPool provided (backwards compatibility)
      if (wordPool && wordPool.length > 0) {
        // Resolve the pass threshold from the class doc when the navigation state
        // doesn't carry it. Defaulting to 95 here both mislabels the result card
        // ("Your score is below 95%") and makes the UI fail 92–94% scorers whose
        // attempts the server correctly marks passed (server reads the class doc).
        if (assignmentSettings?.passThreshold != null) {
          setRetakeThreshold((Number(assignmentSettings.passThreshold) || 95) / 100)
        } else if (classIdParam && listId) {
          try {
            const thrSnap = await getDoc(doc(db, 'classes', classIdParam))
            const thr = thrSnap.exists() ? thrSnap.data()?.assignments?.[listId]?.passThreshold : null
            setRetakeThreshold(((Number(thr) > 0 ? Number(thr) : 95)) / 100)
          } catch (thrErr) {
            console.warn('PATH B: could not resolve class passThreshold, using default', thrErr)
          }
        }
```

(The enclosing loader function is already async — `await` is legal here. `doc`,
`getDoc`, `db` are already imported in TypedTest.jsx.)

## Change F-2 — `src/pages/MCQTest.jsx` (PATH B block, ~line 255)

**FIND:**
```js
      if (wordPool && wordPool.length > 0) {
        // Apply assignment settings if provided
        const numOptions = assignmentSettings?.testOptionsCount || 4
        const threshold = (assignmentSettings?.passThreshold || 95) / 100
        setOptionsCount(numOptions)
        setRetakeThreshold(threshold)
```

**REPLACE WITH:**
```js
      if (wordPool && wordPool.length > 0) {
        // Apply assignment settings if provided
        const numOptions = assignmentSettings?.testOptionsCount || 4
        setOptionsCount(numOptions)
        // Resolve the pass threshold from the class doc when navigation state lacks
        // it (see TypedTest PATH B note: prevents the false "below 95%" label and a
        // UI fail-verdict that contradicts the server's pass for 92–94% scorers).
        if (assignmentSettings?.passThreshold != null) {
          setRetakeThreshold((Number(assignmentSettings.passThreshold) || 95) / 100)
        } else if (classIdParam && listId) {
          try {
            const thrSnap = await getDoc(doc(db, 'classes', classIdParam))
            const thr = thrSnap.exists() ? thrSnap.data()?.assignments?.[listId]?.passThreshold : null
            setRetakeThreshold(((Number(thr) > 0 ? Number(thr) : 95)) / 100)
          } catch (thrErr) {
            console.warn('PATH B: could not resolve class passThreshold, using default', thrErr)
          }
        }
```

(Verify `doc`/`getDoc`/`db` are imported in MCQTest.jsx — they are used elsewhere in
the file; if not present in the import list, add them.)

## Change F-3 — guide text: stop anchoring "95%" as THE threshold
No active class uses 95; guides should describe the threshold as class-specific.

**`public/help-student-ko.html` line ~722 — FIND:**
```html
      <li><strong>새 단어 테스트 (New Words Test)</strong> — 통과 기준(기본 95%)을 달성해야 합니다. 통과하지 못하면 <strong>다시 시도(Try Again)</strong> 버튼으로 재시험을 볼 수 있습니다.</li>
```
**REPLACE WITH:**
```html
      <li><strong>새 단어 테스트 (New Words Test)</strong> — 반별 통과 기준(예: 92%)을 달성해야 합니다. 기준은 선생님이 반마다 설정합니다. 통과하지 못하면 <strong>다시 시도(Try Again)</strong> 버튼으로 재시험을 볼 수 있습니다.</li>
```

**`public/help-student-ko.html` line ~972 — FIND:**
```html
      <div class="faq-question">Q. 테스트에서 95% 이상 받기가 너무 어려워요.</div>
```
**REPLACE WITH:**
```html
      <div class="faq-question">Q. 테스트 통과 기준을 넘기기가 너무 어려워요.</div>
```

**`public/help-student-en.html` line ~722 — FIND:**
```html
      <li><strong>New Words Test</strong> — You must reach the pass threshold (default 95%) to advance. If you don't pass, use <strong>Try Again</strong> to retake.</li>
```
**REPLACE WITH:**
```html
      <li><strong>New Words Test</strong> — You must reach your class's pass threshold (e.g., 92%) to advance. The threshold is set by your teacher for each class. If you don't pass, use <strong>Try Again</strong> to retake.</li>
```

**`public/help-student-en.html` line ~972 — FIND:**
```html
      <div class="faq-question">Q. It's hard to get above 95% on tests.</div>
```
**REPLACE WITH:**
```html
      <div class="faq-question">Q. It's hard to reach the pass threshold.</div>
```

**Then sweep:** search BOTH student guides for any remaining "95%" token that implies a
universal default and reword to class-specific phrasing ("반별 기준(예: 92%)" / "your
class's threshold (e.g., 92%)"). Leave the teacher guides' "95%로 설정하면…" example
alone — it is explicitly an example of a setting.

## Change G — differentiated error codes for test/grading failures

### Why
Every grading/connection failure currently collapses into one generic message
("Grading Failed — failed after 3 attempts"), so each TA report requires a manual
data investigation. The Firebase callable errors already carry gRPC-style codes
(`functions/unavailable`, `functions/deadline-exceeded`, …) — we just discard them.
This change adds the industry-standard layered error: actionable copy + short
mechanism code + correlation ref, plus code-aware retry and telemetry via the
existing `logSystemEvent`.

### G-1 — NEW FILE `src/utils/errorClassifier.js` (create with exactly this content)

```js
/**
 * Classify test-flow failures into stable mechanism codes (layered-error pattern:
 * human-readable message + short code + retry semantics).
 *
 * Firebase callable errors carry gRPC-style codes (functions/unavailable,
 * functions/deadline-exceeded, ...). Server-thrown grading errors arrive as
 * message strings. Both are mapped here.
 *
 * retryable: true = auto-retry sensible | false = don't auto-retry | 'when-online'
 * = wait for the browser's online event before retrying.
 */
export function classifyTestError(error) {
  const code = error?.code || ''
  const msg = String(error?.message || '')

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      code: 'NET-OFFLINE',
      retryable: 'when-online',
      message: '인터넷 연결이 끊겼습니다. 연결을 확인한 뒤 다시 제출해 주세요. 답안은 저장되어 있습니다.'
    }
  }
  if (code === 'functions/deadline-exceeded' || /deadline/i.test(msg)) {
    return {
      code: 'NET-TIMEOUT',
      retryable: true,
      message: '채점 요청이 제한 시간 안에 끝나지 않았습니다. 네트워크가 불안정할 수 있어요 — 잠시 후 다시 시도해 주세요. 답안은 저장되어 있습니다.'
    }
  }
  if (
    code === 'functions/unavailable' ||
    code === 'auth/network-request-failed' ||
    (error?.name === 'TypeError' && /network|fetch/i.test(msg))
  ) {
    return {
      code: 'NET-UNREACHABLE',
      retryable: true,
      message: '서버에 연결할 수 없습니다. 다른 사이트가 열리더라도 VPN·보안 프로그램·학교 방화벽이 원인일 수 있어요. 휴대폰 핫스팟으로 바꿔 다시 시도해 보세요.'
    }
  }
  if (code === 'functions/unauthenticated') {
    return {
      code: 'AUTH',
      retryable: false,
      message: '로그인이 만료되었습니다. 다시 로그인한 뒤 제출해 주세요. 답안은 이 브라우저에 저장되어 있습니다.'
    }
  }
  if (code === 'functions/invalid-argument' || /invalid input/i.test(msg)) {
    return {
      code: 'PAYLOAD',
      retryable: false,
      message: '제출 데이터에 문제가 있습니다. 다시 시도해도 안 되면 선생님께 이 코드와 함께 알려주세요.'
    }
  }
  if (/parse grading/i.test(msg)) {
    return {
      code: 'AI-PARSE',
      retryable: true,
      message: '채점 결과 처리 중 서버 측 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (학생 잘못이 아닙니다)'
    }
  }
  if (/anthropic|empty response|overloaded/i.test(msg)) {
    return {
      code: 'AI-UPSTREAM',
      retryable: true,
      message: '채점 AI가 일시적으로 응답하지 않습니다(서버 측 문제). 잠시 후 다시 시도해 주세요. (학생 잘못이 아닙니다)'
    }
  }
  return {
    code: 'UNKNOWN',
    retryable: true,
    message: '알 수 없는 오류로 채점에 실패했습니다. 답안은 저장되어 있으니 다시 시도해 주세요.'
  }
}

/** Wait for the browser to come back online (capped). */
export function waitForOnline(maxMs = 120000) {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(done, maxMs)
    function done() {
      clearTimeout(timer)
      window.removeEventListener('online', done)
      resolve()
    }
    window.addEventListener('online', done)
  })
}
```

### G-2 — `src/pages/TypedTest.jsx`: code-aware retry (replace `gradeWithRetry`, ~line 579)

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
  // AI grading with code-aware retry: classify each failure; don't burn retries on
  // non-retryable errors (auth/payload); wait for the `online` event when offline;
  // exponential backoff with jitter otherwise.
  const gradeWithRetry = async (answersToGrade) => {
    const MAX_RETRIES = 3
    const BASE_DELAY_MS = 10000   // 10s, then 20s, with jitter
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
        const classified = classifyTestError(error)
        console.error(`Grading attempt ${attempt}/${MAX_RETRIES} failed [${classified.code}]:`, error)
        logSystemEvent('typed_grading_attempt_failed', {
          code: classified.code,
          attempt,
          testId,
          classId: classIdParam || null,
          listId: listId || null,
          message: String(error?.message || '').slice(0, 200)
        })

        // Non-retryable (expired session, bad payload): fail fast with the code.
        if (classified.retryable === false) throw error
        // Last attempt - throw error
        if (attempt === MAX_RETRIES) throw error

        // Update UI to show we're retrying
        setRetryAttempt(attempt)

        if (classified.retryable === 'when-online') {
          await waitForOnline()
        } else {
          const delay = BASE_DELAY_MS * attempt + Math.floor(Math.random() * 3000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
  }
```

### G-3 — `src/pages/TypedTest.jsx`: classify the final failure (~line 817)

**FIND:**
```js
    } catch (err) {
      console.error('All grading attempts failed:', err)
      setGradingError('Failed to grade test after 3 attempts. Your answers are saved.')
      // Don't clear responses or words - they're preserved for manual retry
    } finally {
```

**REPLACE WITH:**
```js
    } catch (err) {
      console.error('All grading attempts failed:', err)
      const classified = classifyTestError(err)
      setGradingError(classified)
      logSystemEvent('typed_grading_failed_final', {
        code: classified.code,
        testId,
        classId: classIdParam || null,
        listId: listId || null,
        message: String(err?.message || '').slice(0, 200)
      }, 'error')
      // Don't clear responses or words - they're preserved for manual retry
    } finally {
```

### G-4 — `src/pages/TypedTest.jsx`: modal renders code + message + correlation ref (~line 1450)

`gradingError` is now an object `{code, message, retryable}` (object truthiness keeps
the `{gradingError && ...}` guard working).

**FIND:**
```js
              <h3 className="text-xl font-bold text-red-700 mb-4">
                Grading Failed
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                {gradingError}
              </p>
```

**REPLACE WITH:**
```js
              <h3 className="text-xl font-bold text-red-700 mb-4">
                Grading Failed{gradingError?.code ? ` [${gradingError.code}]` : ''}
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                {typeof gradingError === 'string' ? gradingError : gradingError?.message}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Ref: {testId || '-'} · 화면을 캡처해서 선생님께 보내면 빠르게 도와드릴 수 있어요.
              </p>
```

### G-5 — `src/pages/TypedTest.jsx`: imports (top of file)

**FIND:**
```js
import { submitTypedTestAttempt, withRetry } from '../services/db'
```

**REPLACE WITH:**
```js
import { submitTypedTestAttempt, withRetry, logSystemEvent } from '../services/db'
import { classifyTestError, waitForOnline } from '../utils/errorClassifier'
```

(`logSystemEvent(eventType, data, severity)` is already exported from
`src/services/db.js`. `testId`, `classIdParam`, `listId` are already in component
scope at both G-2 and G-3 sites.)

### G verification
- Parse-check `errorClassifier.js` (loader 'js') and `TypedTest.jsx` (loader 'jsx').
- Simulate offline (DevTools → Network → Offline) and submit → modal must show
  `[NET-OFFLINE]` and the Korean reconnect guidance; going back online should let the
  retry proceed without waiting the full backoff.
- Block the functions domain (DevTools request blocking) → `[NET-UNREACHABLE]`.
- Normal failure paths still preserve answers (Try Again works unchanged).
- Confirm `system_events` receives `typed_grading_failed_final` docs with `code`.

### G scope note
MCQ tests don't call the AI grader (no chronic failures there); their submit errors
already surface via `submitError`. If desired later, the same `classifyTestError`
can wrap MCQTest/TypedTest `submitTestAttempt` catches — deliberately out of scope
here to keep the diff small.

## Change H — fix wrong-day stamping on attempts when session context is lost

### Why (root cause of "이미 다 했는데 다시 떠요")
When a test launches WITHOUT `sessionContext.dayNumber` (lost/stale navigation state,
retake routes, resume edges), both test pages stamp the attempt with
`progress.currentStudyDay` — the **last COMPLETED day**, not the in-progress day
(CSD+1). Reconciliation defines "day N complete" as "a review attempt with
studyDay=N exists", so a current-day review stamped with the previous day can NEVER
complete the day → the day re-prompts forever.
Confirmed live 2026-06-10: 한승환 (Adv A1) took his day-3 review (100%) but it was
stamped studyDay=2 → day 3 kept re-prompting (manually re-attributed).

### Correct stamping rule for the fallback
- `new` test: a new-word test always concerns the day being worked → **CSD + 1**.
- `review` test: if a PASSED new-word attempt exists for day CSD+1 → this review
  completes the in-progress day → **CSD + 1**; otherwise it's a genuine retake of the
  last completed day → **CSD** (current behavior).
Also log a system event whenever the fallback fires, so we can see how often context
is being lost (it should be rare; frequent firing = a launcher bug to chase).

### H-1 — `src/pages/TypedTest.jsx` (~line 660)

**FIND:**
```js
        // Get studyDay from sessionContext, or fetch from progress if standalone test
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            // For standalone tests (retakes, direct navigation), use currentStudyDay as-is
            // DO NOT increment - only DailySessionFlow increments via sessionContext
            studyDay = progress.currentStudyDay || 0
          } catch (err) {
            console.error('Failed to fetch studyDay from progress:', err)
          }
        }
```

**REPLACE WITH:**
```js
        // Get studyDay from sessionContext, or derive it if the launch lost context.
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            const csd = progress.currentStudyDay || 0
            if (currentTestType === 'new') {
              // A new-word test always concerns the in-progress day.
              studyDay = csd + 1
            } else {
              // Review: stamping the wrong day makes the in-progress day impossible to
              // complete (reconciliation requires a review attempt for day N). If the
              // in-progress day's new test is already passed, this review belongs to
              // it; otherwise it's a retake of the last completed day.
              const nextDayNew = await getNewWordAttemptForDay(user.uid, classIdParam, csd + 1)
              studyDay = (nextDayNew && nextDayNew.passed === true) ? csd + 1 : csd
            }
            logSystemEvent('attempt_day_fallback', {
              testType: currentTestType, stamped: studyDay, csd,
              classId: classIdParam, listId, testId
            })
          } catch (err) {
            console.error('Failed to derive studyDay from progress:', err)
          }
        }
```

Imports: add `getNewWordAttemptForDay` to the existing `../services/db` import in
TypedTest.jsx (it already exports it; `logSystemEvent` is added by Change G-5).

### H-2 — `src/pages/MCQTest.jsx` (~line 524)

**FIND:**
```js
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            // For standalone tests (retakes, direct navigation), use currentStudyDay as-is
            // DO NOT increment - only DailySessionFlow increments via sessionContext
            studyDay = progress.currentStudyDay || 0
            console.log('[DEBUG STUDYDAY] Using fallback:', {
              progressCurrentStudyDay: progress.currentStudyDay,
              calculatedStudyDay: studyDay
            });
          } catch (err) {
            console.error('Failed to fetch studyDay from progress:', err)
          }
        } else {
```

**REPLACE WITH:**
```js
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            const csd = progress.currentStudyDay || 0
            if (currentTestType === 'new') {
              // A new-word test always concerns the in-progress day.
              studyDay = csd + 1
            } else {
              // Review: if the in-progress day's new test is passed, this review
              // belongs to it (stamping the previous day would make the day
              // impossible to complete); otherwise it's a retake of the completed day.
              const nextDayNew = await getNewWordAttemptForDay(user.uid, classIdParam, csd + 1)
              studyDay = (nextDayNew && nextDayNew.passed === true) ? csd + 1 : csd
            }
            logSystemEvent('attempt_day_fallback', {
              testType: currentTestType, stamped: studyDay, csd,
              classId: classIdParam, listId
            })
            console.log('[DEBUG STUDYDAY] Using derived fallback:', {
              progressCurrentStudyDay: csd,
              calculatedStudyDay: studyDay
            });
          } catch (err) {
            console.error('Failed to derive studyDay from progress:', err)
          }
        } else {
```

Imports: ensure MCQTest.jsx imports `getNewWordAttemptForDay` and `logSystemEvent`
from `../services/db` (add to the existing import list if missing).
NOTE: verify the variable holding the test type in MCQTest at this site —
if it is named differently than `currentTestType` (e.g. `testType`), use that name.

### H-3 — validate a PROVIDED dayNumber too (stale-context guard, both files)

H-1/H-2 only fire when `sessionContext.dayNumber` is ABSENT. A STALE context (old tab,
restored sessionStorage from a previous day) supplies a wrong dayNumber that bypasses
the fallback entirely. Add a cheap sanity check right after the H-1/H-2 block in BOTH
files (the only legitimate stamps are CSD — review retake of the completed day — and
CSD+1 — the in-progress day):

**INSERT immediately AFTER the H-1/H-2 `if (!studyDay ...) { ... }` block (and its
`else { ... }` in MCQTest), in both files:**
```js
        // Stale-context guard: a provided dayNumber can also be wrong (old tab /
        // restored sessionStorage). Only CSD (review retake of the completed day)
        // and CSD+1 (the in-progress day) are legitimate stamps; anything else
        // would corrupt day-completion inference. Re-derive when clearly invalid.
        if (sessionContext?.dayNumber != null && user?.uid && classIdParam && listId) {
          try {
            const cpSnap = await getDoc(doc(db, `users/${user.uid}/class_progress`, `${classIdParam}_${listId}`))
            const csdNow = cpSnap.exists() ? (cpSnap.data().currentStudyDay || 0) : 0
            if (studyDay > csdNow + 1 || studyDay < csdNow) {
              const original = studyDay
              studyDay = currentTestType === 'new' ? csdNow + 1 : csdNow + ((await getNewWordAttemptForDay(user.uid, classIdParam, csdNow + 1))?.passed === true ? 1 : 0)
              logSystemEvent('attempt_day_context_invalid', {
                testType: currentTestType, provided: original, corrected: studyDay, csd: csdNow,
                classId: classIdParam, listId
              }, 'error')
            }
          } catch (e) { console.warn('stale-context day validation skipped:', e) }
        }
```
(Direct `getDoc` on class_progress — deliberately NOT `getOrCreateClassProgress`, to
avoid running full reconciliation on every submit. In MCQTest use its test-type
variable name if different from `currentTestType`.)

KNOWN AMBIGUITY (documented, not solved): if a stale context stamps exactly CSD on a
review while day CSD+1's new test is passed, the stamp is indistinguishable from a
legitimate completed-day review retake — H-3 lets it through. Closing this fully
requires the architectural fix (server-derived day completion), not a client guard.

### H verification
- Launch a review test with devtools sessionStorage cleared (context lost) while the
  in-progress day's new test is passed → submitted attempt must carry studyDay=CSD+1
  and the day must complete normally afterward.
- Retake a COMPLETED day's review from the gradebook → attempt stays stamped with
  that completed day (no change in behavior).
- `system_events` receives `attempt_day_fallback` docs — if these appear frequently,
  report it: something is still dropping sessionContext.

## Residual notes (not in this patch)
- `Dashboard.jsx` ~1800/1835 hardcode `newWordRetakeThreshold: 0.95` in **PDF-generation
  payloads** — unrelated to tests, cosmetic; skip.
- The in-session results card in DailySessionFlow uses `sessionConfig.retakeThreshold`
  — fixed by Change D in PATCH_day2_passer_session_desync.md (threshold derived from
  passThreshold).
- `useState(0.95)` initial value remains as last-resort default; after F-1/F-2 every
  launch path resolves the real threshold, so it should never render.
- Data anomalies found while auditing (owner to confirm intent):
  • `26SM 제주 SAT BRIDGE` assignment passThreshold = **100** (students must score
    perfect) — likely a typo for 90 (all other Bridge classes are 90).
  • Legacy class "SAT" passThreshold = **1** (≈1%, everything passes) — old test class.
  • 4 legacy assignments have no passThreshold (fall back to 95) — inactive classes.

## Verify after applying
1. esbuild parse-check TypedTest.jsx + MCQTest.jsx (loader 'jsx').
2. In a 92% class, fail a typed test at 90% → result card must say "below **92%**".
3. Score 93% in a 92% class via every entry point you can reach (normal session,
   retake, re-entry) → UI must show **pass** (no "Did not pass"), matching the server.
4. Open both student help guides → no "default 95%" phrasing remains.

## Apply & deploy
- Log changes to `change_action_log.md` (| Date | File | Change |).
- Web-only (2 jsx + 2 html + 1 new util js) → normal git push → Netlify. No
  functions/rules deploy.
- Apply order within this patch doesn't matter except: G-5 (imports) must land with
  G-2/G-3/G-4 in the same commit, or TypedTest breaks at runtime.
