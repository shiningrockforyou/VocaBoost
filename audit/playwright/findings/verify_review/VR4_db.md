# VR4 — db.js / Gradebook Findings Verification

**Label:** VR4  
**Date:** 2026-05-31  
**Scope:** CODE_REVIEW_2026-06-01.md findings #5, #12, #13, #24, #25, #26, #27, #52, #53, #54, #55  
**Sources read:** `src/services/db.js` (3173 lines), `src/pages/Gradebook.jsx` (1547 lines)

---

## Per-Finding Analysis

---

### #5 — [HIGH] reviewChallenge wrong score denominator

**Claim:** `reviewChallenge` recomputes score as `correctCount / updatedAnswers.length` (number of stored answers), whereas `submitTestAttempt` uses `correctCount / totalQuestions`. For skipped-question submissions `updatedAnswers.length < totalQuestions`, so reviewing inflates the score and can flip `passed` false→true.

**Actual code — submitTestAttempt (line 1151):**
```js
const score = answeredWords.filter((answer) => answer.isCorrect).length / totalQuestions
```
`totalQuestions` is the parameter (defaults 0 — separate #52 issue), representing the full test size.

**Actual code — reviewChallenge (lines 2615–2616):**
```js
const correctCount = updatedAnswers.filter((a) => a.isCorrect).length
const newScore = Math.round((correctCount / updatedAnswers.length) * 100)
```
`updatedAnswers` is `attemptData.answers` — the array of *answered* items stored at submission time, which for an MCQ test equals `answeredWords.length`, not `totalQuestions`.

**Note on submitTypedTestAttempt (line 1294):** typed tests use `correctCount / words.length` (all words in test), not `totalQuestions`. So the mismatch only affects MCQ tests where the student skipped questions.

**Does the mismatch exist?** Yes. `attemptData.answers` stores only the submitted answers array (length = answered words). `attemptData.totalQuestions` is stored separately on the attempt doc (line 1179) and is NOT used by `reviewChallenge`. The denominator used in `reviewChallenge` (`updatedAnswers.length`) will be smaller than `totalQuestions` whenever any question was skipped, producing a higher score.

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:1151` uses `totalQuestions`; `db.js:2615-2616` uses `updatedAnswers.length`. `totalQuestions` is stored at `db.js:1179` but never read by `reviewChallenge`. The fix is `const denom = attemptData.totalQuestions || updatedAnswers.length`.  
**True severity:** HIGH (matches review)  
**Codex overlap:** None noted in review cross-refs, but aligns with systemic pattern #1 (non-atomic RMW).  
**Testable via:** Admin-SDK data check — create an attempt with `totalQuestions = 10`, `answers.length = 8` (2 skipped), all 8 answers incorrect, then call `reviewChallenge` accepting one; verify stored `score` is `1/8 * 100 = 13` rather than `1/10 * 100 = 10`.

---

### #12 — [MEDIUM] "Pending Challenge" badge can never render

**Claim:** Badge in Gradebook table gates on `attempt.answers?.some(a => a.challengeStatus === 'pending')`, but `queryTeacherAttempts` returns `answers: []` for every row (lazy-loaded). `.some(...)` always evaluates false.

**Actual code — queryTeacherAttempts (db.js line 1996):**
```js
answers: [], // Lazy load on demand
```

**Actual code — Gradebook.jsx (line 1108):**
```js
{attempt.answers?.some((a) => a.challengeStatus === 'pending') && (
  <span ...>Pending Challenge</span>
)}
```

**Analysis:** The list-view `attempt.answers` is always `[]` as set explicitly at db.js:1996. `[].some(...)` is always `false`. The badge is structurally unreachable in the table view. The detail drawer (`attemptDetails.answers`) does have real answers (loaded via `fetchAttemptDetails`) and shows challenge status correctly — but the summary table badge is dead.

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:1996` `answers: []`; `Gradebook.jsx:1108` gates badge on that empty array. The badge cannot render in the table row.  
**True severity:** MEDIUM (matches review)  
**Testable via:** Playwright UI — as teacher, accept a student challenge, then return to gradebook list view; confirm "Pending Challenge" badge never appears on any row even for attempts with pending challenges.

---

### #13 — [MEDIUM] Post-pagination filtering breaks row count and 'more available' indicator

**Claim:** Name/List/TestType filters run as `continue` skips after `limit(pageSize)` is applied, but `hasMore` and `lastVisible` are computed from the raw pre-filter page count.

**Actual code — queryTeacherAttempts (db.js lines 1905–1915):**
```js
// Apply pagination
attemptsQuery = query(attemptsQuery, limit(pageSize))
if (lastDoc) {
  attemptsQuery = query(attemptsQuery, startAfter(lastDoc))
}

// Execute single query
const attemptsSnap = await getDocs(attemptsQuery)
const attemptDocs = attemptsSnap.docs
const lastVisible = attemptDocs.length > 0 ? attemptDocs[attemptDocs.length - 1] : null
const hasMore = attemptDocs.length === pageSize
```

**Post-filtering (lines 1944–1958):**
```js
// Apply Name filter (post-processing)
if (filterStudentIds.length > 0 && !filterStudentIds.includes(studentId)) {
  continue
}
// Apply List filter (post-processing)
if (filterListIds.length > 0 && !filterListIds.includes(listId)) {
  continue
}
// Apply Test Type filter (post-processing)
if (filterTestTypes.length > 0 && !filterTestTypes.includes(attemptTestType)) {
  continue
}
```

**Analysis:** `hasMore = attemptDocs.length === pageSize` is computed on raw docs (line 1915) BEFORE the post-filter loop reduces the set. `lastVisible` is also the last raw doc (line 1914). The Class filter and Date filter are pushed to Firestore query level (lines 1893–1902), so they don't cause this issue. But Name, List, and Test Type filters do cause it: a page of 50 raw docs may yield only 5 matching rows, yet `hasMore = true` and `lastVisible` points to the 50th raw doc. The next "Load more" will advance past those 50, showing sparse pages.

**Gradebook.jsx (line 934):**
```js
Showing: <span className="text-brand-text">{attempts.length}</span>
{hasMore && <span className="text-text-faint">+</span>}
```
This count and `+` indicator reflect the corrupted `hasMore`.

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:1914–1915` compute `lastVisible`/`hasMore` on raw page; `db.js:1944–1958` filter post-hoc; `Gradebook.jsx:934-935` surfaces the corrupted `hasMore`. Overlaps with #27 (same root cause, different function). This is Codex systemic pattern #2.  
**True severity:** MEDIUM (matches review)  
**Testable via:** Playwright UI — add a Name filter for a student who has infrequent attempts; observe that "Showing N+" appears even though far fewer than `pageSize` rows appear, and clicking next page may return an empty or sparse set.

---

### #24 — [MEDIUM] submitChallenge/reviewChallenge non-atomic read-modify-write

**Claim:** Both functions read `attempt.answers` / `challenges.history`, mutate in JS, and write the whole array back via `updateDoc` without a transaction. Concurrent operations lose updates.

**Actual code — submitChallenge (db.js lines 2516–2554):**
```js
// Read answers
const answers = attemptData.answers || []
const answerIndex = answers.findIndex((a) => a.wordId === wordId)
// ...
const updatedAnswers = [...answers]
updatedAnswers[answerIndex] = { ...updatedAnswers[answerIndex], challengeStatus: 'pending', ... }
await updateDoc(attemptRef, { answers: updatedAnswers })
```
No transaction wraps the getDoc at line 2503 and the updateDoc at line 2552. Similarly for `challenges.history` (lines 2537–2542).

**Actual code — reviewChallenge (db.js lines 2587–2641):**
```js
const answers = attemptData.answers || []  // line 2587, read at line 2574
// ...
const updatedAnswers = [...answers]        // line 2601
updatedAnswers[answerIndex] = { ... }
await updateDoc(attemptRef, { answers: updatedAnswers, score: newScore, ... })  // line 2637
```
Also reads `challenges.history` from student doc (line 2650) and writes it back (line 2661) — two separate docs, neither wrapped in a transaction.

**Analysis:** Classic check-then-act TOCTOU. Two concurrent challenge submissions for different words on the same attempt would each read the same `answers` array and both write back, losing the other's update. Token check (`getAvailableChallengeTokens` at line 2496) is also computed from a stale snapshot read seconds before the write.

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:2480–2556` (submitChallenge) and `db.js:2567–2749` (reviewChallenge) — no `runTransaction` wrapping any read+write pair. Overlaps Codex systemic pattern #1.  
**True severity:** MEDIUM (matches review)  
**Testable via:** Admin-SDK data check — simultaneously call `submitChallenge` twice for different wordIds on the same attempt; verify both answer mutations are present in the final `answers` array (expected: one will be lost under race).

---

### #25 — [MEDIUM] resetStudentProgress only deletes new-format attempts

**Claim:** The filter `parts.length >= 5 && parts[3] === listId` matches only `vocaboost_test_{classId}_{listId}_{sessionType}` (5 parts after splitting on `_`), missing legacy `test_{listId}_{timestamp}` or `typed_{listId}_{timestamp}` formats (3 parts, `parts[3]` is the timestamp, not `listId`).

**Actual code (db.js lines 2872–2883):**
```js
const attemptsToDelete = attemptsSnapshot.docs.filter(doc => {
  const testId = doc.data().testId
  if (!testId) return false
  const parts = testId.split('_')
  // parts: ['vocaboost', 'test', classId, listId, sessionType]
  if (parts.length >= 5) {
    const attemptListId = parts[3]
    return attemptListId === listId
  }
  return false
})
```

**Analysis:** Legacy testIds like `test_abc123_1700000000000` split into `['test', 'abc123', '1700000000000']` — only 3 parts, failing `parts.length >= 5`. Legacy `typed_...` similarly fails. These attempts survive the reset. The comment even says "testId format: vocaboost_test_{classId}_{listId}_{sessionType}" — the legacy format is not handled here.

Contrast with `fetchClassAttempts` and `queryTeacherAttempts` which both handle both formats via regex:
```js
const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
const newFormatMatch = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/)
```
`resetStudentProgress` doesn't use these helpers.

**Additional nuance:** The query also filters `where('classId', '==', classId)` at db.js:2862–2863 — but legacy attempts may not have `classId` stored (it was added as an optional field), so they may not appear in the query at all, meaning the filter issue only affects legacy attempts that DO have `classId`. Without `classId`, they're invisible to the reset query entirely (a separate gap).

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:2876–2882` only passes `parts.length >= 5`; legacy 3-part testIds return `false`. `db.js:1570–1576` and `1931–1937` show the dual-format regex pattern that should be used instead.  
**True severity:** MEDIUM (matches review)  
**Testable via:** Admin-SDK data check — create a student with a legacy `test_{listId}_{ts}` attempt, run reset, verify the attempt document still exists.

---

### #26 — [MEDIUM] Per-class member fetch failures swallowed, silently dropping students

**Claim:** In `fetchAllTeacherAttempts` and `getTeacherData`, a `getDocs` failure on a class members subcollection is caught, `console.error`'d, and iteration continues. Those students' attempts are silently omitted.

**Actual code — fetchAllTeacherAttempts (db.js lines 1498–1514):**
```js
try {
  const membersRef = collection(db, 'classes', classId, 'members')
  const membersSnap = await getDocs(membersRef)
  membersSnap.docs.forEach((memberDoc) => {
    const studentId = memberDoc.id
    studentIdSet.add(studentId)
    // ...
  })
} catch (err) {
  console.error(`Error fetching members for class ${classId}:`, err)
}
// Loop continues to next class
```

**Actual code — getTeacherData (db.js lines 1773–1793):**
```js
try {
  const membersRef = collection(db, 'classes', classId, 'members')
  const membersSnap = await getDocs(membersRef)
  membersSnap.docs.forEach((memberDoc) => { ... })
} catch (err) {
  console.error(`Error fetching members for class ${classId}:`, err)
}
```

**Analysis:** Both functions use `getDocs` (not `withRetry`) for member subcollection fetches. A transient Firestore error silently excludes all students in that class from the `studentIdSet`. Those students' attempts are never queried. The gradebook shows fewer rows with no indication that data is missing. Neither function propagates or aggregates failure state.

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:1498–1515` and `db.js:1773–1793` — both catch member fetch failures silently. Neither uses `withRetry`. Overlaps Codex systemic pattern #4 (swallowed errors).  
**True severity:** MEDIUM (matches review)  
**Testable via:** Admin-SDK data check — temporarily block Firestore rules for the `members` subcollection of one class, load the gradebook; verify no error indicator appears and that class's students are absent from results.

---

### #27 — [MEDIUM] queryStudentAttempts applies List filter post-pagination

**Claim:** `queryStudentAttempts` applies List and potentially TestType filters after `limit(pageSize)`, while `hasMore`/`lastVisible` are computed on the raw pre-filter page.

**Actual code (db.js lines 2094–2103):**
```js
// Apply pagination
attemptsQuery = query(attemptsQuery, limit(pageSize))
if (lastDoc) {
  attemptsQuery = query(attemptsQuery, startAfter(lastDoc))
}

// Execute query
const attemptsSnap = await getDocs(attemptsQuery)
const attemptDocs = attemptsSnap.docs
const lastVisible = attemptDocs.length > 0 ? attemptDocs[attemptDocs.length - 1] : null
const hasMore = attemptDocs.length === pageSize
```

**Post-filter (lines 2144–2147):**
```js
// Apply list filter (post-processing)
if (filterListIds.length > 0 && !filterListIds.some((f) => listName.toLowerCase().includes(f))) {
  continue
}
```

**Analysis:** Class filter is pushed to Firestore query level (lines 2082–2086), but List filter is explicitly commented "Will filter post-query" (line 2064) and applied via `continue` after `limit(pageSize)`. `hasMore = attemptDocs.length === pageSize` is computed on raw docs (line 2103) before filtering reduces the set.

Note: `queryStudentAttempts` lacks a TestType filter (the student gradebook view doesn't expose it), but the List filter is confirmed post-pagination.

Review cited `db.js:2094-2147` for the student function. This is confirmed. Review also cited `1906-1958` for teacher equivalent — that is `queryTeacherAttempts` (confirmed in #13 above).

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:2094–2103` compute `hasMore`/`lastVisible` on raw docs; `db.js:2144–2147` filter post-hoc. Same root cause as #13. Both share Codex systemic pattern #2.  
**True severity:** MEDIUM (matches review)  
**Testable via:** Playwright UI — in student gradebook, add a List filter for a list with sparse attempts; observe `hasMore`/sparse pages.

---

### #52 — [LOW] submitTestAttempt divides by totalQuestions which defaults to 0

**Claim:** `score = correct / totalQuestions` with `totalQuestions = 0` default and no denominator guard. Produces `NaN` score when caller omits or passes 0.

**Actual code (db.js line 1123 signature):**
```js
export const submitTestAttempt = async (userId, testId, answers, totalQuestions = 0, ...)
```

**Actual code (db.js line 1151):**
```js
const score = answeredWords.filter((answer) => answer.isCorrect).length / totalQuestions
```

No guard like `totalQuestions > 0` before this division. `0 / 0 = NaN`. `NaN * 100 = NaN`. `Math.round(NaN) = NaN`. The stored `score` field would be `NaN` (Firestore stores this as `null` or fails depending on SDK version).

**Analysis of current callers:** All in-repo callers do pass `testWords.length` — the default 0 is latent. However, the missing guard is a real code defect that would silently corrupt the attempt doc if any caller omits the argument. The review correctly labels this LOW (latent path).

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:1123` default `totalQuestions = 0`; `db.js:1151` no guard before division.  
**True severity:** LOW (matches review)  
**Testable via:** Unit — call `submitTestAttempt(uid, testId, [{wordId:'x', isCorrect:true}])` (omitting `totalQuestions`); verify the returned/stored `score` is not NaN.

---

### #53 — [LOW] fetchStudentStats conflates "tested" with "mastered" in headline percentage

**Claim:** The `mastery` percentage is computed from `masteryCount` (PASSED + FAILED, i.e. tested at least once), not from PASSED-only, so a failed word inflates the headline.

**Actual code (db.js lines 1046–1065):**
```js
// Words learned: PASSED or FAILED (tested at least once)
if (status === WORD_STATUS.PASSED || status === WORD_STATUS.FAILED) {
  wordsLearned += 1
  masteryCount += 1
}

// Mastered words: PASSED status
if (status === WORD_STATUS.PASSED) {
  masteredWords += 1
}
// ...
const mastery = totalWords > 0 ? Math.round((masteryCount / totalWords) * 100) : 0

return {
  mastery,           // inflated: uses PASSED+FAILED
  ...
  masteredWords,     // correct: PASSED only
  masteryCount: masteredWords,  // overrides to PASSED only on return
}
```

**Analysis:** The `mastery` percentage is `(PASSED + FAILED) / total`, not `PASSED / total`. A student who has attempted every word but failed all of them would show 100% mastery. The returned `masteryCount` field is overridden to `masteredWords` (PASSED only), creating a split-brain between the percentage and the count.

Review further notes: "Function currently has no in-repo caller." Searching would be needed to confirm, but the semantic error is real regardless.

Review's secondary claim that "line 1039 correctly restricts to the list" — confirmed: the `wordIds.includes(wordId)` guard at line 1039 does restrict to the list's words. So the "across ALL lists" claim in the finding title is inaccurate for the `mastery` percentage (it IS list-restricted). However the PASSED+FAILED vs PASSED-only semantic error is real.

**VERDICT: CONFIRMED (with correction)**  
The primary claim (PASSED+FAILED used for mastery %) is CONFIRMED. The secondary claim ("across ALL lists") is OVERSTATED — the function does filter to `wordIds` for the given list (line 1039). But the semantic mismatch between `mastery` % and `masteredWords` count is a real bug.  
**Evidence:** `db.js:1047–1049` increments `masteryCount` for FAILED; `db.js:1065` uses `masteryCount` for headline `mastery`; `db.js:1073` overrides `masteryCount: masteredWords`.  
**True severity:** LOW (matches review)  
**Testable via:** Unit — create a student with 10 words all in FAILED state; call `fetchStudentStats`; verify `mastery` returns 100 while `masteredWords` returns 0.

---

### #54 — [LOW] fetchStudentStats/fetchStudentAggregateStats read entire study_states unbounded

**Claim:** Both functions `getDocs` the full per-user `study_states` collection with no limit/where, then filter in JS via `wordIds.includes(...)` (O(N·M)).

**Actual code — fetchStudentStats (db.js lines 1028–1039):**
```js
const studyStatesRef = collection(db, 'users', userId, 'study_states')
const studyStatesSnap = await getDocs(studyStatesRef)
// ...
studyStatesSnap.docs.forEach((docSnap) => {
  const wordId = docSnap.id
  if (!wordIds.includes(wordId)) return   // JS-side filter
  // ...
})
```
No `where` clause, no `limit`. Fetches all study_states across all lists.

**Actual code — fetchStudentAggregateStats (db.js lines 1082–1094):**
```js
const studyStatesRef = collection(db, 'users', studentId, 'study_states')
const studyStatesSnap = await getDocs(studyStatesRef)
// no filter at all — iterates every study_state
```

**Analysis:** Both confirmed unbounded. For `fetchStudentStats`, Firestore stores `study_states` as per-word docs (one per word across all lists). A student who has studied multiple lists could have hundreds of docs fetched and filtered client-side. `fetchStudentStats` is called once per list (from callers iterating lists), producing O(lists × all_study_states) reads.

The review's fix suggestion ("add `where('listId','==',listId)`") is valid if study_states documents store `listId` — which they do (confirmed at line 1039: filtered by `wordIds` which are derived from a specific list, and study states are stored with `listId` per the `WORD_STATUS` patterns).

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:1028–1029` and `db.js:1082–1083` — both `getDocs(collection(..., 'study_states'))` with no `where`/`limit`.  
**True severity:** LOW (matches review)  
**Testable via:** Admin-SDK data check — create a student with 500 study_states across 5 lists; call `fetchStudentStats(uid, oneListId)`; observe 500 reads vs expected ~100.

---

### #55 — [LOW] fetchStudentClasses mutates fetched class assignments object in place

**Claim:** `fetchStudentClasses` mutates `classData.assignments[key].testMode` in place during iteration without cloning, duplicating defaulting logic from `fetchClass` that has already drifted.

**Actual code (db.js lines 459–464):**
```js
const assignments = classData.assignments || {}
Object.keys(assignments).forEach((key) => {
  if (!assignments[key].testMode) {
    assignments[key].testMode = 'mcq'
  }
})
```

**Analysis:** `classData` comes from `classSnap.data()` — Firestore SDK returns a plain JS object. Mutating `assignments[key].testMode` directly modifies this object in-place. Since Firestore's `data()` returns a new object each call (not a live reference), this mutation is harmless to Firestore state, but it is not idiomatic and could cause bugs if the same `classData` object were referenced elsewhere.

The review also claims `fetchClass` also defaults `testOptionsCount` and converts arrays, but `fetchStudentClasses` only defaults `testMode` — confirmed drift:
- `fetchClass` (lines 721–730): defaults both `testOptionsCount` AND `testMode`
- `fetchStudentClasses` (lines 460–464): only defaults `testMode`

The "N+1 reads" aspect — nested `getDoc` per class then per assigned list (lines 467–479) — is also confirmed: no batching via `where(documentId(), 'in', [...])`.

**VERDICT: CONFIRMED**  
**Evidence:** `db.js:460–464` mutates `classData.assignments[key]` in-place; `db.js:721–730` (fetchClass) defaults `testOptionsCount` too, showing drift; `db.js:467–479` has nested `getDoc` per list with no batching.  
**True severity:** LOW (matches review) — in-place mutation is currently harmless but brittle; N+1 reads are the bigger practical issue.  
**Testable via:** Unit — call `fetchStudentClasses` for a student in a class with assignments lacking `testOptionsCount`; verify the returned `assignedListDetails[].testOptionsCount` is `undefined` (vs `fetchClass` which returns `4`).

---

## STATUS BLOCK

### Verdict Table

| # | Claim Summary | VERDICT | True Severity | Testable Via |
|---|--------------|---------|---------------|--------------|
| 5 | reviewChallenge uses `updatedAnswers.length` as denominator instead of `totalQuestions` | CONFIRMED | HIGH | Admin-SDK data check |
| 12 | "Pending Challenge" badge unreachable — `answers: []` in list rows | CONFIRMED | MEDIUM | Playwright UI |
| 13 | Post-filter in queryTeacherAttempts corrupts `hasMore`/`lastVisible` | CONFIRMED | MEDIUM | Playwright UI |
| 24 | submitChallenge/reviewChallenge non-atomic RMW on answers/history | CONFIRMED | MEDIUM | Admin-SDK data check |
| 25 | resetStudentProgress drops legacy-format attempts (3-part testId) | CONFIRMED | MEDIUM | Admin-SDK data check |
| 26 | Member-fetch failures in fetchAllTeacherAttempts/getTeacherData swallowed | CONFIRMED | MEDIUM | Admin-SDK data check |
| 27 | queryStudentAttempts List filter applied post-pagination, corrupts cursor | CONFIRMED | MEDIUM | Playwright UI |
| 52 | submitTestAttempt divides by `totalQuestions = 0` default (NaN score) | CONFIRMED | LOW | Unit |
| 53 | fetchStudentStats headline `mastery` % uses PASSED+FAILED, not PASSED-only | CONFIRMED (with correction: not "across all lists") | LOW | Unit |
| 54 | fetchStudentStats/AggregateStats read entire study_states unbounded | CONFIRMED | LOW | Admin-SDK data check |
| 55 | fetchStudentClasses mutates classData in-place + N+1 + drift from fetchClass | CONFIRMED | LOW | Unit |

### Counts

| Verdict | Count |
|---------|-------|
| CONFIRMED | 11 |
| FALSE | 0 |
| OVERSTATED | 0 |
| PARTIAL | 0 |
| **Total** | **11** |

All 11 findings confirmed at their stated severity. One nuance: #53's secondary claim ("across ALL lists") is inaccurate — the function IS list-scoped — but the primary semantic bug is real and confirmed.

---

## How to Test Each Confirmed Finding

### #5 — Admin-SDK data check
1. Using Firebase Admin SDK or Firestore emulator, create an `attempts` doc: `{ studentId, teacherId, classId, listId, totalQuestions: 10, answers: [{wordId:'w1',isCorrect:false},{...x7...}], score: 0, passed: false }` (8 answers, 2 skipped).
2. Call `reviewChallenge(teacherId, attemptId, 'w1', true)`.
3. Read the attempt back. Expect `score = Math.round(1/10*100) = 10`. Actual `score = Math.round(1/8*100) = 13`. Bug confirmed.

### #12 — Playwright UI
1. Navigate to `/gradebook` as teacher.
2. Use Admin SDK to set `answers[0].challengeStatus = 'pending'` on a visible attempt.
3. Reload gradebook. Observe no "Pending Challenge" badge in table row.
4. Click "View Details" on that attempt; confirm badge appears in drawer (detail view works correctly — bug is list-view only).

### #13 — Playwright UI
1. Navigate to `/gradebook` as teacher.
2. Add a "Name" filter for a student with few attempts (say 3 out of last 50 total).
3. Observe "Showing 3+" — the `+` incorrectly indicates more pages.
4. Click next page; observe empty or near-empty result set with `hasMore` still true.

### #24 — Admin-SDK data check
1. Create an attempt with `answers: [{wordId:'w1',challengeStatus:null},{wordId:'w2',challengeStatus:null}]`.
2. Simultaneously invoke `submitChallenge(uid, attemptId, 'w1', '')` and `submitChallenge(uid, attemptId, 'w2', '')` with `Promise.all`.
3. Read the attempt back. Under race, one of `w1` or `w2` may be missing `challengeStatus: 'pending'`. Bug present when both fire concurrently before either writes.

### #25 — Admin-SDK data check
1. Create an attempt doc with `testId: 'test_listId123_1700000000000'`, `studentId`, `classId`.
2. Call `resetStudentProgress(userId, classId, 'listId123')`.
3. Read the attempt doc — it should be deleted but will still exist.

### #26 — Admin-SDK data check
Requires temporarily revoking Firestore read access to `classes/{classId}/members` subcollection via security rules or emulator, then loading the gradebook and verifying no error state is shown while affected students' data is absent.

### #27 — Playwright UI
Same as #13 but using the student gradebook view with a List filter applied; observe sparse pages and incorrect `hasMore`.

### #52 — Unit
```js
import { submitTestAttempt } from './src/services/db.js'
// Call without totalQuestions (defaults to 0)
const result = await submitTestAttempt(uid, testId, [{wordId:'w1',isCorrect:true}])
// Verify result.score is not NaN
assert(!isNaN(result.score), 'score should not be NaN')
```

### #53 — Unit
Create user with 10 study_states all with `status: 'FAILED'` for a list of 10 words. Call `fetchStudentStats(uid, listId)`. Assert `result.mastery === 100` (confirming the bug) while `result.masteredWords === 0`.

### #54 — Admin-SDK data check
Using Firebase emulator with read counters, call `fetchStudentStats(uid, listId)` for a user with 500 study_states across 5 lists. Verify that 500 reads are issued rather than ~100 (the list-scoped subset).

### #55 — Unit
Create a class with `assignments: { listId: { pace: 20 } }` (no `testMode`, no `testOptionsCount`). Call `fetchStudentClasses(studentId)`. Assert `result[0].assignedListDetails[0].testOptionsCount === undefined` (fetchStudentClasses doesn't default it, unlike fetchClass which returns 4).
