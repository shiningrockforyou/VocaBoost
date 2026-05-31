# VR3 — Dashboard.jsx + ClassDetail.jsx + Settings/Login/Signup Findings Verification

**Label:** VR3  
**Date:** 2026-05-31  
**Scope:** Findings #3, #9, #10, #11, #18, #19, #37, #38, #42, #43, #44, #48, #49, #50, #51, #70  
**Reviewer:** Read-only source verification against CODE_REVIEW_2026-06-01.md claims  
**Method:** Direct source reads, no modifications.

---

## Per-Finding Analysis

---

### #3 — [HIGH] Student progress never loads for legacy (assignedLists-array) classes
**Cited location:** `src/pages/ClassDetail.jsx:186-200`  
**Claim:** `loadMembers` gates the progress fetch on `classInfo?.assignments`, and derives `listIds` via `Object.keys(classInfo.assignments)`. For legacy classes where `assignments` is undefined, `studentProgressMap` is never populated.

**Source (ClassDetail.jsx:185-201):**
```js
if (membersData.length > 0 && classInfo?.assignments) {
  setProgressLoading(true)
  try {
    const studentIds = membersData.map(m => m.id)
    const listIds = Object.keys(classInfo.assignments)
    if (listIds.length > 0) {
      const progressMap = await fetchStudentsProgressForClass(studentIds, classId, listIds)
      setStudentProgressMap(progressMap)
    }
  } catch (err) { ... }
  finally { setProgressLoading(false) }
}
```

**Dual-shape handling elsewhere in the file:**
- `loadAssignedLists` (line 204-206): `const assignments = classData.assignments || {}; const assignedListIds = classData.assignedLists || Object.keys(assignments)` — correctly handles both shapes.
- `availableLists` memo (line 313-318): `classInfo?.assignedLists ?? Object.keys(classInfo?.assignments || {})` — correctly handles both shapes.
- `loadMembers` (line 186): `classInfo?.assignments` guard — does NOT handle legacy shape. For a legacy class, `classInfo.assignments` is `undefined`, so the entire progress fetch block is skipped.

**VERDICT: CONFIRMED**  
**Evidence:** `ClassDetail.jsx:186` — guard `classInfo?.assignments` is falsy for legacy classes, so `fetchStudentsProgressForClass` is never called and `studentProgressMap` stays `{}`. The fix pattern already exists twice in the same file but was not applied to `loadMembers`. Severity is correctly HIGH.  
**True severity:** HIGH (confirmed)  
**Playwright-testable:** Yes — log in as a teacher, navigate to a class with `assignedLists` array (legacy shape), check Students tab: every student should show progress bars but all will show "Not started". Requires a seeded legacy-shape class doc.

---

### #9 — [MEDIUM] hasTestToday checks attempts across ALL lists
**Cited location:** `src/pages/Dashboard.jsx:1256`  
**Claim:** `testCompletedToday = hasTestToday(userAttempts)` passes the student's global attempt set (no list filter), so completing any test today flips the primary focus list's status to 'completed'.

**Source:**
- `loadUserAttempts` (Dashboard.jsx:340-351): calls `fetchUserAttempts(user.uid)` — no list filter in the call.
- `fetchUserAttempts` (db.js:2364-2376): queries `attempts` collection `where('studentId', '==', uid)` — all attempts for the user, no `listId` filter.
- `hasTestToday` (Dashboard.jsx:1092-1104): checks `attempts.some(attempt => date >= todayStart)` — no `listId` check inside the function.
- `panelCState` (Dashboard.jsx:1256): `const testCompletedToday = hasTestToday(userAttempts)` — passes the unfiltered global attempt set.
- Compare: `hasSessionToday(progress?.recentSessions)` at line 1255 — `recentSessions` is already scoped to `${getPrimaryFocus.classId}_${getPrimaryFocus.id}` key via `progressData`, so it IS list-specific.

**VERDICT: CONFIRMED**  
**Evidence:** `Dashboard.jsx:1256` — `hasTestToday(userAttempts)` where `userAttempts` contains all the user's attempts across all lists. The asymmetry with the adjacent `hasSessionToday` (which IS list-scoped via `progressData[key]`) is clear. Completing Test on List B today will mark List A as 'completed'.  
**True severity:** MEDIUM (confirmed)  
**Playwright-testable:** Yes — enroll student in two classes, complete test on List B today, navigate to Dashboard where List A is primary focus: dailyStatus shows 'completed' even though List A test not done. Requires multi-list seeded account.

---

### #10 — [MEDIUM] Off-by-one: 0-based completedDays vs 1-based expectedDay
**Cited location:** `src/pages/Dashboard.jsx:186-194`  
**Claim:** `completedDays = progress?.currentStudyDay ?? 0` (0-based) is subtracted from `expectedDay = calculateExpectedStudyDay(...)` (1-based). A new on-track user on day 1 yields `0 - 1 = -1`, rendering "1 behind."

**Source (Dashboard.jsx:186-194):**
```js
const completedDays = progress?.currentStudyDay ?? 0
const studyDaysPerWeek = assignment?.studyDaysPerWeek ?? 5
const programStartDate = progress?.programStartDate?.toDate?.() || progress?.programStartDate
const expectedDay = calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)

const difference = completedDays - expectedDay
const isAhead = difference > 0
const isBehind = difference < 0
const isOnTrack = difference === 0
```

**Source (studyTypes.js:159-196):** `calculateExpectedStudyDay` returns `Math.max(studyDays, 1)` — minimum return value is **1** (1-based). On day 0 (program start), it returns 1.

**Interpretation:** On the first day of the program, `currentStudyDay = 0` (user has not completed any day yet), `expectedDay = 1`. So `difference = 0 - 1 = -1`, `isBehind = true`, showing "1 behind" when the user is on track.

Also note: line 198 shows `const displayDay = completedDays + 1` — the component already recognizes `currentStudyDay` is 0-based and adds 1 for display. The `difference` calculation does not apply the same correction.

**VERDICT: CONFIRMED**  
**Evidence:** `Dashboard.jsx:191` — `difference = completedDays - expectedDay` where `completedDays` is 0-based `currentStudyDay` and `expectedDay` is 1-based (minimum 1 from `calculateExpectedStudyDay`). New users or users on Day 1 will always show "1 behind." The `displayDay` correction at line 198 (adding 1) was done for the display but not for the pace comparison.  
**True severity:** MEDIUM (confirmed)  
**Playwright-testable:** Yes — log in as a student on day 1 of a program (currentStudyDay=0, programStartDate=today), check the progress stats widget: it will show "1 behind" instead of "On track."

---

### #11 — [MEDIUM] loadStudentClasses swallows/leaks errors with no catch
**Cited location:** `src/pages/Dashboard.jsx:526-541`  
**Claim:** `try/finally` with no `catch`. A `fetchStudentClasses` rejection produces an unhandled rejection and leaves the UI with no failure indication.

**Source (Dashboard.jsx:526-537):**
```js
const loadStudentClasses = useCallback(async () => {
  if (isTeacher || !user?.uid) {
    return
  }
  setStudentClassesLoading(true)
  try {
    const classesData = await fetchStudentClasses(user.uid)
    setStudentClasses(classesData)
  } finally {
    setStudentClassesLoading(false)
  }
}, [isTeacher, user?.uid])
```

**VERDICT: CONFIRMED**  
**Evidence:** `Dashboard.jsx:526-537` — `try { ... } finally { ... }` with no `catch` block. A rejection from `fetchStudentClasses` becomes an unhandled promise rejection (the function is called from a `useEffect` at line 541 with no surrounding error handler). No `classError` or similar state is set, so the UI silently shows an empty classes list. Every other async loader in the file (e.g., `loadTeacherLists` lines 353-367, `loadUserAttempts` lines 340-351) has a proper `catch` block.  
**True severity:** MEDIUM (confirmed)  
**Playwright-testable:** Yes — simulate Firestore error for fetchStudentClasses (network throttle/offline), navigate to Dashboard as student: empty state renders with no error message, and browser console shows unhandled rejection.

---

### #18 — [MEDIUM] Every class mutation re-fetches all members + per-student aggregate stats (N+1)
**Cited location:** `src/pages/ClassDetail.jsx:170-201, 242-251`  
**Claim:** Every mutating handler calls `loadClass()`, producing a new `classInfo` object that re-runs the `loadMembers` effect, triggering a full roster + `fetchStudentAggregateStats` per member + `fetchStudentsProgressForClass`.

**Source:**
- Effect at line 242-251: `useEffect(() => { if (classInfo) { loadAssignedLists(classInfo) } ... if (classInfo?.id) { loadMembers() } }, [classInfo, loadAssignedLists, loadMembers])`
- `loadMembers` (line 170-201): calls `fetchStudentAggregateStats(docSnap.id)` for each member (line 179) + `fetchStudentsProgressForClass(studentIds, classId, listIds)` (line 192).
- Mutation handlers calling `loadClass()`: `handleAssignList` (line 328), `handleSaveSettings` (line 372), `handleUnassignList` (line 391), `handleRemoveStudent` (line 409), `handleRemoveSelectedStudents` (line 450).

**Every settings save** (`handleSaveSettings` line 372) calls `await loadClass()` → new `classInfo` object → effect fires → `loadMembers()` → N `fetchStudentAggregateStats` calls + `fetchStudentsProgressForClass`. A settings save that changed no membership triggers the full N+1 fan-out.

**VERDICT: CONFIRMED**  
**Evidence:** The `useEffect` at `ClassDetail.jsx:242` depends on `classInfo` (an object); every `loadClass()` call sets new `classInfo` via `setClassInfo(data)`, triggering the effect. `loadMembers` always calls `fetchStudentAggregateStats` per member in parallel and `fetchStudentsProgressForClass`. For a class with 30 students, a single settings save triggers 30+ reads.  
**True severity:** MEDIUM (confirmed) — can cause slow UI on large classes and may hit Firestore read quotas.  
**Playwright-testable:** Yes — open ClassDetail with network tab open, save settings, observe N+1 Firestore requests in network panel. (Not a visual defect, but observable.)

---

### #19 — [MEDIUM] CSV export vulnerable to delimiter breakage and formula injection
**Cited location:** `src/pages/ClassDetail.jsx:462-468`  
**Claim:** `handleExportSelectedStudents` joins `displayName`/`email` with no escaping — comma/quote/newline corrupts alignment; `=`/`+`/`-`/`@` prefix triggers formula injection in Excel/Sheets.

**Source (ClassDetail.jsx:459-477):**
```js
const handleExportSelectedStudents = () => {
  const membersList = members || []
  const selectedData = membersList.filter(m => selectedStudents.includes(m.id))
  const csvContent = [
    ['Name', 'Email'].join(','),
    ...selectedData.map(m => [
      m.displayName || 'N/A',
      m.email || 'N/A'
    ].join(','))
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv' })
  ...
}
```

**Analysis:**
- Fields are joined with `,` with no quoting or escaping. A `displayName` containing a comma (e.g. "Smith, John") will break the column alignment.
- A `displayName` starting with `=`, `+`, `-`, or `@` (e.g. `=SUM(A1:A10)`) will be interpreted as a formula when opened in Excel/Google Sheets — classic CSV injection.
- No newline escaping: a `displayName` with an embedded newline would break the row structure.
- These fields are user-controlled (students set their own display names via signup).

**VERDICT: CONFIRMED**  
**Evidence:** `ClassDetail.jsx:464-467` — raw `.join(',')` without quoting or sanitization. Both delimiter breakage (comma in name) and formula injection (`=`-prefixed name) are possible with user-controlled display names.  
**True severity:** MEDIUM (confirmed) — formula injection severity depends on whether the CSV is opened in a privileged context, but delimiter breakage is immediate data-corruption.  
**Playwright-testable:** Yes — create a student account with displayName `=SUM(1+1)` or `Smith, John`, export CSV from ClassDetail, open in spreadsheet: formula executes or columns misalign. Can be partially automated by checking the raw CSV blob content.

---

### #37 — [LOW] handleListSelection: unhandled rejection and optimistic state update before write confirmed
**Cited location:** `src/pages/Dashboard.jsx:277-288`  
**Claim:** The onClick awaits `updateUserSettings` with no try/catch, so a failed write is an unhandled rejection. Also claims "optimistic state update before write confirmed."

**Source (Dashboard.jsx:276-288):**
```js
const handleListSelection = async (list) => {
  setShowListSelector(false)
  await updateUserSettings(user.uid, {
    primaryFocusListId: list.id,
    primaryFocusClassId: list.classId,
  })
  setUserSettings((prev) => ({
    ...prev,
    primaryFocusListId: list.id,
    primaryFocusClassId: list.classId,
  }))
}
```

**Analysis:**
- No `try/catch` — a rejection from `updateUserSettings` becomes an unhandled rejection with no user feedback. CONFIRMED.
- The state update (`setUserSettings`) is **after** the `await`, so it only runs on success — the review's "optimistic state update before write confirmed" sub-claim is **false**. The update is not optimistic; it is pessimistic (runs only after `await` resolves). However `setShowListSelector(false)` at line 278 (before the await) closes the selector before the write confirms — minor UX issue but not a state corruption.

**VERDICT: PARTIAL**  
**Evidence:** `Dashboard.jsx:277-288` — unhandled rejection confirmed (no try/catch). The "optimistic state update before write confirmed" claim is inaccurate: `setUserSettings` at line 283 runs only after the successful `await`. The selector dismissal (`setShowListSelector(false)`) is pre-await but causes no data divergence. The unhandled rejection half is real; the optimistic-update characterization is wrong.  
**True severity:** LOW (confirmed for the unhandled rejection portion)  
**Playwright-testable:** Yes — throttle network to simulate failed write, click list selection: selector closes, no error shown, browser console shows unhandled rejection.

---

### #38 — [LOW] 7-Day Rhythm includes today even when today is a skipped weekend
**Cited location:** `src/pages/Dashboard.jsx:1202-1233`  
**Claim:** With `skipWeekends`, the loop seeds `currentDate = today` and only skips weekends when stepping backward, so the first bar uses today unconditionally — on Sat/Sun it shows a weekend that should be excluded.

**Source (Dashboard.jsx:1201-1233):**
```js
let currentDate = new Date(today)

for (let i = 0; i < 7; i++) {
  const date = new Date(currentDate)
  // ... push activity for currentDate ...
  activity.push({ date, formattedDate, reviewScore })

  currentDate.setDate(currentDate.getDate() - 1)
  if (skipWeekends) {
    while (isWeekend(currentDate)) {
      currentDate.setDate(currentDate.getDate() - 1)
    }
  }
}
```

**Analysis:** The weekend skip only applies when stepping to the **next** (previous) date — `currentDate` is decremented first, then any weekends are skipped. But `currentDate` starts as `today` and is used for `i=0` before any skip logic runs. If today is Saturday (day 6) or Sunday (day 0), `isWeekend(today)` is true but today is never checked before being added to `activity`. The 7-day chart will include a Saturday/Sunday bar that the `skipWeekends` setting is supposed to exclude.

**VERDICT: CONFIRMED**  
**Evidence:** `Dashboard.jsx:1202-1233` — `currentDate` initialized to `today`, used for loop iteration `i=0` before any weekend-skip logic. The weekend skip runs after pushing to `activity`, applying only to subsequent days. No pre-loop guard like `while (skipWeekends && isWeekend(currentDate)) currentDate.setDate(...)` exists.  
**True severity:** LOW (confirmed) — cosmetic/display-only; does not affect any stored data.  
**Playwright-testable:** Yes — run on a Saturday or Sunday, navigate to Dashboard as student with `studyDaysPerWeek <= 5`: the 7-day rhythm chart's first bar will be the current weekend day. (Requires running on an actual weekend, or mocking `new Date()`.)

---

### #42 — [LOW] Bulk student removal aborts midway on error, leaving partial state and stale UI
**Cited location:** `src/pages/ClassDetail.jsx:437-457`  
**Claim:** Sequential `for`-loop of awaits; if removal throws mid-batch, `setSelectedStudents([])` and `loadClass()` never run, leaving a stale UI.

**Source (ClassDetail.jsx:437-457):**
```js
const handleRemoveSelectedStudents = async () => {
  if (selectedStudents.length === 0) return
  ...
  setRemovingStudentId('bulk')
  try {
    const { removeStudentFromClass } = await import('../services/db')
    for (const studentId of selectedStudents) {
      await removeStudentFromClass(classId, studentId)
    }
    setSelectedStudents([])
    loadClass()
  } catch (err) {
    console.error('Failed to remove students:', err)
    alert('Failed to remove some students. Please try again.')
  } finally {
    setRemovingStudentId(null)
  }
}
```

**Analysis:** Yes — the `for...of` loop awaits each removal sequentially. If removal throws on student N (mid-batch), the `catch` block fires, `setSelectedStudents([])` and `loadClass()` are skipped. The UI shows the old roster with all originally selected students still marked as selected, while students 1..N-1 were actually removed from Firestore. The `alert` informs the user of a failure but does not refresh the UI.

**VERDICT: CONFIRMED**  
**Evidence:** `ClassDetail.jsx:446-451` — sequential `for...of await` with `setSelectedStudents([])` and `loadClass()` inside the `try` block after the loop. A mid-loop error skips both cleanup calls. The `finally` only clears `removingStudentId`.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — simulate a Firestore error on the second removal in a multi-student selection: UI stays stale, some students visually remain selected despite being removed. Requires network interception to fail specific requests.

---

### #43 — [LOW] navigator.clipboard.writeText promise rejection is unhandled
**Cited location:** `src/pages/ClassDetail.jsx:518-524`  
**Claim:** `writeText` is not awaited/caught; the Clipboard API rejects in insecure contexts, on denied permission, or when unfocused. Optimistic "copied" feedback shows regardless.

**Source (ClassDetail.jsx:518-524):**
```js
const handleCopyJoinCode = () => {
  if (classInfo?.joinCode) {
    navigator.clipboard.writeText(classInfo.joinCode)
    setFeedback('Join code copied to clipboard!')
    setTimeout(() => setFeedback(''), 3000)
  }
}
```

**Analysis:** `navigator.clipboard.writeText(...)` returns a Promise which is neither awaited nor `.catch`-chained. `setFeedback('Join code copied to clipboard!')` is called immediately (synchronously after the fire-and-forget call), so the success message always shows regardless of clipboard success or failure. In insecure contexts (non-HTTPS, blocked permission), the promise rejects silently plus logs an unhandled rejection.

**VERDICT: CONFIRMED**  
**Evidence:** `ClassDetail.jsx:519-521` — `navigator.clipboard.writeText(classInfo.joinCode)` with no `.then`/`.catch`/`await`, followed by immediate `setFeedback('Join code copied to clipboard!')`. Classic fire-and-forget with false success feedback.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — test in a non-HTTPS/insecure context or deny clipboard permission in browser settings: the "copied" banner still appears even though the clipboard write failed.

---

### #44 — [LOW] Review test Min/Max not validated as min <= max
**Cited location:** `src/pages/ClassDetail.jsx:1102-1140, 355-379`  
**Claim:** Min and Max are clamped 1..500 independently with no cross-field check, so a teacher can save min=60, max=30.

**Source (ClassDetail.jsx:1102-1140):**
- Min input (line 1107-1108): `min="1" max="500"`, `onBlur` clamps to `Math.max(1, Math.min(500, parseInt(...) || 30))`.
- Max input (line 1123-1124): `min="1" max="500"`, `onBlur` clamps to `Math.max(1, Math.min(500, parseInt(...) || 60))`.
- No cross-field validation between `reviewTestSizeMin` and `reviewTestSizeMax`.

**Source (ClassDetail.jsx:355-379) — `handleSaveSettings`:**
```js
const handleSaveSettings = async () => {
  if (!classId || !settingsModalList) return
  setFeedback('')
  setSavingSettings(true)
  try {
    await updateAssignmentSettings(classId, settingsModalList.id, {
      pace: settingsForm.pace,
      ...
      reviewTestSizeMin: settingsForm.reviewTestSizeMin,
      reviewTestSizeMax: settingsForm.reviewTestSizeMax,
    })
    ...
  }
```

No `reviewTestSizeMin <= reviewTestSizeMax` check before calling `updateAssignmentSettings`.

**VERDICT: CONFIRMED**  
**Evidence:** `ClassDetail.jsx:1111-1133` — both min/max inputs have independent `[1,500]` clamping; `handleSaveSettings` (line 355-379) sends the values directly to Firestore with no cross-field validation. A teacher can save `reviewTestSizeMin=100, reviewTestSizeMax=10` without error.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — open list settings modal, set Min=100, Max=10, click Save: no validation error shown, settings persist. Downstream behavior (review test size scaling inverted) requires additional verification.

---

### #48 — [LOW] loadClasses swallows errors, showing 'No classes enrolled' on failure
**Cited location:** `src/pages/Settings.jsx:36-43`  
**Claim:** `fetchStudentClasses` failure only `console.error`s; `studentClasses` stays `[]`, rendering "No classes enrolled" indistinguishably from a genuine empty state.

**Source (Settings.jsx:33-44):**
```js
const loadClasses = useCallback(async () => {
  if (!user?.uid || user?.role === 'teacher') return
  setClassesLoading(true)
  try {
    const classes = await fetchStudentClasses(user.uid)
    setStudentClasses(classes)
  } catch (err) {
    console.error('Failed to load classes:', err)
  } finally {
    setClassesLoading(false)
  }
}, [user?.uid, user?.role])
```

**Analysis:** The `catch` block only logs to console. `studentClasses` remains `[]`. No error state is set. The UI will render as if the student is enrolled in zero classes, with no indication that a load error occurred.

**VERDICT: CONFIRMED**  
**Evidence:** `Settings.jsx:39-41` — `catch (err) { console.error('Failed to load classes:', err) }` with no error state set. `studentClasses` stays `[]` (initialized at line 21), rendering the empty-enrollment UI on failure.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — throttle/block Firestore on Settings page: the progress reset section shows "no classes" with no error indicator. Console shows the error.

---

### #49 — [LOW] Email/password login double-navigates and can land on the wrong route
**Cited location:** `src/pages/Login.jsx:22-30, 41-53`  
**Claim:** `handleSubmit` calls `navigate(redirectTo)` while the `useEffect` watching `user` also navigates, creating a race that can produce wrong targets or flicker.

**Source (Login.jsx:22-30):**
```js
useEffect(() => {
  if (user) {
    const target = redirectTo !== '/' ? redirectTo
      : user.email?.endsWith('@apboost.test') ? '/ap'
      : '/'
    navigate(target, { replace: true })
  }
}, [user, navigate, redirectTo])
```

**Source (Login.jsx:41-53):**
```js
const handleSubmit = async (event) => {
  event.preventDefault()
  setError('')
  setIsSubmitting(true)
  try {
    await login(formState.email, formState.password)
    navigate(redirectTo, { replace: true })
  } catch (err) { ... }
  finally { setIsSubmitting(false) }
}
```

**Analysis:** After `login(...)` resolves, `onAuthStateChanged` fires asynchronously and sets `user` in context, triggering the `useEffect`. Meanwhile `handleSubmit` synchronously calls `navigate(redirectTo, { replace: true })`. Both navigate almost simultaneously.

The race:
- `handleSubmit` uses `redirectTo` (the pre-computed target, which defaults to `'/'` for non-ap routes).
- The `useEffect` uses the apBoost email check: if the user's email ends with `@apboost.test` AND `redirectTo === '/'`, the effect navigates to `/ap`.
- For an `@apboost.test` user logging in via email+password from the plain login page: `handleSubmit` navigates to `'/'`; then the `useEffect` fires (after context updates) and navigates to `'/ap'`. This results in double navigation with the second overriding the first.
- The Google sign-in path (lines 55-72) correctly does NOT call `navigate` in the handler, relying solely on the effect.

**VERDICT: CONFIRMED**  
**Evidence:** `Login.jsx:47` — explicit `navigate(redirectTo, { replace: true })` in `handleSubmit` after `await login(...)`, while the `useEffect` at line 22-30 also navigates when `user` updates. For apBoost email users, the two navigations compute different targets (`'/'` vs `'/ap'`), causing double navigation.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — log in with an `@apboost.test` email via email/password form, observe navigation history/URL: page briefly hits `'/'` then redirects to `'/ap'`. Network tab or React Router history can confirm double navigation.

---

### #50 — [LOW] Signup Google sign-in ignores apBoost redirect and always lands on '/'
**Cited location:** `src/pages/Signup.jsx:49-66`  
**Claim:** Both `handleSubmit` and `handleGoogleSignIn` hardcode `navigate('/')`, unlike Login which routes apBoost users to `/ap`.

**Source (Signup.jsx:41, 56):**
- `handleSubmit` line 41: `navigate('/')`
- `handleGoogleSignIn` line 56: `navigate('/')`

**Comparison with Login.jsx:**
- Login's `useEffect` (line 22-30): checks `user.email?.endsWith('@apboost.test')` and navigates to `'/ap'` when `redirectTo === '/'`.
- Login's `handleGoogleSignIn` does NOT call `navigate` — relies on the effect.
- Signup has NO equivalent `useEffect` watching `user` for redirect, so the hardcoded `navigate('/')` is the only navigation.

**VERDICT: CONFIRMED**  
**Evidence:** `Signup.jsx:41` and `Signup.jsx:56` — both paths hardcode `navigate('/')`. No email-domain check, no `useEffect` watching `user` for conditional redirect. An `@apboost.test` user signing up always lands on the vocaBoost root.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — sign up with an `@apboost.test` email via Google on the Signup page: after sign-up, lands on `'/'` instead of `'/ap'`.

---

### #51 — [LOW] Graduation year/month accepted without real validation
**Cited location:** `src/pages/Signup.jsx:36-37, 156-179`  
**Claim:** `gradYear`/`gradMonth` sent as raw `Number(value)` with only HTML `min`/`max` attributes and no JS range check before `createUserDocument`.

**Source (Signup.jsx:36-37):**
```js
gradYear: formState.gradYear ? Number(formState.gradYear) : null,
gradMonth: formState.gradMonth ? Number(formState.gradMonth) : null,
```

**Source (Signup.jsx:156-179):**
- `gradYear` input: `type="number" name="gradYear" min="2024" max="2035"` — HTML attributes only.
- `gradMonth` input: `type="number" name="gradMonth" min="1" max="12"` — HTML attributes only.
- No JS validation in `handleSubmit` (line 26-47) before calling `signup(...)`.

**Analysis:** HTML `min`/`max` constraints are enforced by the browser's native form validation when the user submits via the submit button. However:
1. The `type="number"` inputs do not use a `<form>` native validation path consistently — `handleSubmit` calls `event.preventDefault()` then processes manually.
2. HTML `min`/`max` on `type="number"` prevents the submit button from triggering native validation **only if** the browser considers the field in scope of form validation. Since `required` is not set on these fields, a browser may allow out-of-range values to pass.
3. Most critically, programmatic or keyboard entry can submit values outside the range: a user can type `2099` in the year field — the browser will show a native validation tooltip on form submit, but if the form validation doesn't block (optional fields without `required`), the value passes through.
4. No JS-side check for `gradMonth < 1 || gradMonth > 12` or `gradYear` outside a reasonable window exists in `handleSubmit`.

**VERDICT: CONFIRMED**  
**Evidence:** `Signup.jsx:26-47` — `handleSubmit` calls `signup(...)` with raw `Number(formState.gradYear)` and `Number(formState.gradMonth)` with no JS range validation. `Signup.jsx:159,174` — only HTML `min`/`max` attributes, which are bypassable (no `required`, optional field). Invalid dates can reach Firestore.  
**True severity:** LOW (confirmed)  
**Playwright-testable:** Yes — submit signup form with `gradYear=1900` (bypassed via JS or DevTools manipulation of input value): account creates without error, invalid year stored in Firestore.

---

### #70 — [NITPICK] Clearing a numeric settings field silently resets to a default
**Cited location:** `src/pages/ClassDetail.jsx:969-983`  
**Claim:** `onBlur` does `parseInt(e.target.value,10) || 20`; clearing the field snaps to factory default 20 instead of the prior configured value. Repeats for multiple fields.

**Source (ClassDetail.jsx:975-980):**
```js
onBlur={(e) =>
  setSettingsForm((prev) => ({
    ...prev,
    pace: Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 20)),
  }))
}
```

- `parseInt('', 10)` returns `NaN`.
- `NaN || 20` evaluates to `20` — the hard-coded factory default.
- If the list's configured pace was, say, 30, clearing the input and blurring snaps to 20 (not 30).

**Other fields using the same pattern:**
- `testOptionsCount`: `|| 4` (line 996)
- `reviewTestSizeMin`: `|| 30` (line 1114)
- `reviewTestSizeMax`: `|| 60` (line 1132)
- `studyDaysPerWeek` and `passThreshold` would follow the same pattern elsewhere.

**VERDICT: CONFIRMED**  
**Evidence:** `ClassDetail.jsx:978` — `parseInt(e.target.value, 10) || 20` where `parseInt('', 10) = NaN`, `NaN || 20 = 20`. The prior value from `settingsForm` is not used as the fallback; the hard-coded factory default is. This is a UX regression where clearing and blurring a field silently changes its value.  
**True severity:** NITPICK (confirmed)  
**Playwright-testable:** Yes — open list settings with configured pace=30, clear the Pace input, click elsewhere (blur): input snaps to 20 (not 30). Easy to automate with Playwright click → triple-click → delete → tab → check value.

---

## STATUS BLOCK

### Per-Finding Verdict Table

| ID | Severity (Review) | VERDICT | Key Evidence (file:line) | True Severity | Playwright-Testable |
|----|-------------------|---------|--------------------------|---------------|---------------------|
| #3 | HIGH | **CONFIRMED** | `ClassDetail.jsx:186` — `classInfo?.assignments` guard skips legacy classes entirely; dual-shape fix exists at lines 205-206 and 315 but not here | HIGH | Yes |
| #9 | MEDIUM | **CONFIRMED** | `Dashboard.jsx:1256` — `hasTestToday(userAttempts)` passes global unfiltered attempt set; `hasSessionToday` is list-scoped | MEDIUM | Yes |
| #10 | MEDIUM | **CONFIRMED** | `Dashboard.jsx:191` — `completedDays - expectedDay` where `completedDays` is 0-based and `expectedDay` min=1 (1-based); display uses `+1` (line 198) but pace comparison does not | MEDIUM | Yes |
| #11 | MEDIUM | **CONFIRMED** | `Dashboard.jsx:526-537` — bare `try/finally` with no `catch`; unhandled rejection on failure, no error state set | MEDIUM | Yes |
| #18 | MEDIUM | **CONFIRMED** | `ClassDetail.jsx:242-251` + `170-201` — `useEffect` on `classInfo` re-triggers `loadMembers` on every mutation; `loadMembers` calls `fetchStudentAggregateStats` per member + `fetchStudentsProgressForClass` | MEDIUM | Yes (network tab) |
| #19 | MEDIUM | **CONFIRMED** | `ClassDetail.jsx:464-467` — raw `.join(',')` no quoting/escaping; user-controlled `displayName` can break delimiter or inject formula | MEDIUM | Yes |
| #37 | LOW | **PARTIAL** | `Dashboard.jsx:277-288` — unhandled rejection confirmed (no try/catch); "optimistic update before write" is **false** (`setUserSettings` runs after `await`) | LOW | Yes (for unhandled rejection) |
| #38 | LOW | **CONFIRMED** | `Dashboard.jsx:1202-1233` — `currentDate` starts as today without weekend check; weekend skip only applies when stepping backward; first bar always includes today | LOW | Yes (weekend only) |
| #42 | LOW | **CONFIRMED** | `ClassDetail.jsx:446-450` — sequential `for...of await`, `setSelectedStudents([])` and `loadClass()` inside `try` after loop; mid-loop error skips cleanup | LOW | Yes |
| #43 | LOW | **CONFIRMED** | `ClassDetail.jsx:519-521` — `navigator.clipboard.writeText(...)` not awaited/caught; `setFeedback('copied')` runs synchronously regardless | LOW | Yes |
| #44 | LOW | **CONFIRMED** | `ClassDetail.jsx:1111-1133` + `355-379` — independent `[1,500]` clamps, no cross-field `min <= max` check before save | LOW | Yes |
| #48 | LOW | **CONFIRMED** | `Settings.jsx:39-41` — `catch (err) { console.error(...) }` only; no error state set, `studentClasses` stays `[]` | LOW | Yes |
| #49 | LOW | **CONFIRMED** | `Login.jsx:47` + `22-30` — `handleSubmit` calls `navigate(redirectTo)` AND `useEffect` also navigates on user update; apBoost emails get different targets | LOW | Yes |
| #50 | LOW | **CONFIRMED** | `Signup.jsx:41, 56` — both paths hardcode `navigate('/')`, no apBoost email check; Login has the check, Signup does not | LOW | Yes |
| #51 | LOW | **CONFIRMED** | `Signup.jsx:36-37` + `159,174` — only HTML `min`/`max`; no JS range validation in `handleSubmit`; optional fields bypass native validation | LOW | Yes |
| #70 | NITPICK | **CONFIRMED** | `ClassDetail.jsx:978` — `parseInt('',10) || 20 = 20`; factory default used instead of prior configured value on clear+blur | NITPICK | Yes |

### Counts

| VERDICT | Count |
|---------|-------|
| CONFIRMED | 15 |
| PARTIAL | 1 |
| OVERSTATED | 0 |
| FALSE | 0 |
| **Total** | **16** |

### Notes on Partial

- **#37:** The unhandled rejection claim is fully confirmed. The "optimistic state update before write confirmed" sub-claim is **false** — `setUserSettings` at line 283 executes after the `await`, not before. The `setShowListSelector(false)` at line 278 runs before the await but causes no data-state divergence. Severity is correctly LOW for the confirmed (unhandled rejection) portion.

### Playwright-Testable List (with test approach)

| ID | Test Approach |
|----|---------------|
| #3 | Teacher logs in → navigates to a class with `assignedLists` array shape (legacy) → Students tab → verify all rows show "Not started" despite real progress existing |
| #9 | Student enrolled in 2 lists → completes test on List B today → Dashboard with List A as primary → verify `dailyStatus` shows 'completed' / test badge shown |
| #10 | Student on Day 1 (currentStudyDay=0, programStartDate=today) → Dashboard → ListProgressStats widget shows "1 behind" instead of "On track" |
| #11 | Block Firestore on Dashboard load as student → verify no error message shown, empty classes list renders same as genuine zero enrollment |
| #18 | ClassDetail open with 20+ students → save settings → observe N+1 Firestore reads in network tab (DevTools) |
| #19 | Create student account with `displayName="=SUM(1+1)"` → teacher exports CSV → open CSV in spreadsheet → formula executes |
| #37 | Block `updateUserSettings` network call → click list selector → verify no error shown and unhandled rejection in console |
| #38 | Run on Saturday/Sunday → Dashboard as student with skipWeekends=true → 7-day chart first bar shows Saturday/Sunday |
| #42 | Multi-select 3 students → mock second removal to fail → verify first student removed but UI shows all still selected |
| #43 | Deny clipboard permission → click "Copy Join Code" → verify "copied" feedback appears despite failure |
| #44 | Open list settings modal → set Min=100, Max=10 → click Save → verify no validation error, confirm min>max values saved |
| #48 | Block Firestore on Settings page → verify no error UI shown, reset section shows "no classes" same as empty state |
| #49 | Log in with `@apboost.test` email via email/password form → observe double navigation (briefly hits `/` then `/ap`) |
| #50 | Sign up / Google sign-in with `@apboost.test` email on Signup page → verify lands on `/` not `/ap` |
| #51 | Submit signup with gradYear=1900 via DevTools `document.querySelector('[name=gradYear]').value = '1900'` → verify account created with invalid year |
| #70 | Open list settings → change Pace to 30 → save → reopen → clear Pace field → tab away → verify field shows 20 not 30 |
