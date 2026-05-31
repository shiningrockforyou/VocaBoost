# VR5 — progressService.js + studyService.js + AuthContext.jsx Verification

**Label:** VR5  
**Date:** 2026-05-31  
**Scope:** Findings #6, #7, #28, #29, #30, #31, #56, #57, #58, #60  
**Method:** READ-ONLY source inspection against CODE_REVIEW_2026-06-01.md claims.  
**Files read:**
- `/app/src/services/progressService.js`
- `/app/src/services/studyService.js`
- `/app/src/contexts/AuthContext.jsx`
- `/app/src/services/db.js` (relevant sections)
- `/app/src/components/TeacherRoute.jsx`
- `/app/src/firebase.js`

---

## Per-Finding Analysis

---

### #6 — `updateClassProgress` non-atomic read-modify-write

**Claim (code review):** `getDoc → compute currentStudyDay+1, append to recentSessions, add wordsIntroduced → updateDoc` with no transaction. Two concurrent invocations both read the same value and both write, double-advancing the day, duplicating sessions, double-counting words. The "in-function day guard is a check-then-act on the same stale snapshot and does not protect against overlap."

**Actual code (`src/services/progressService.js:323-371`):**

```js
const snapshot = await getDoc(progressRef);                    // line 327
const current = snapshot.exists() ? snapshot.data() : DEFAULT_CLASS_PROGRESS;  // line 328

// Guard: Check if this is the expected next day
const expectedDay = (current.currentStudyDay || 0) + 1;        // line 331
if (sessionSummary.day && sessionSummary.day !== expectedDay) { // line 332
  return { id: docId, ...current }; // Return unchanged
}
// ... compute updates ...
await updateDoc(progressRef, updates);                          // line 361
```

**Verdict: CONFIRMED (with nuance)**

The guard at lines 331–335 checks `sessionSummary.day !== expectedDay` derived from `current.currentStudyDay`, which was read from the same stale `snapshot`. Under true concurrency:

1. Request A reads snapshot → `currentStudyDay=5`, `expectedDay=6`.
2. Request B reads snapshot before A's write → same `currentStudyDay=5`, `expectedDay=6`.
3. Both pass the guard (both see `sessionSummary.day === 6`).
4. Both write `currentStudyDay=6`, duplicating the session entry in `recentSessions` and double-adding `wordsIntroduced`.

The guard is a **check-then-act on the same stale read** — it prevents a *different-day* submission, but not a *same-day double-write*. It does NOT use a Firestore transaction, so the guard provides zero protection against concurrent calls with the same `sessionSummary.day`. No `runTransaction` or `FieldValue.increment` is used.

**Overlap with #16 (persistence audit):** The persistence audit #16 finding (CSD/TWI corruption) is addressed by the reconciliation in `getOrCreateClassProgress`, but `updateClassProgress` itself remains non-atomic. The `expectedDay` guard reduces duplicate-completion risk in normal use (e.g., double-click) but fails under concurrent tab/offline-replay scenarios where two calls arrive with the same day number before either write lands.

**True severity: HIGH** (confirmed as stated; guard materially mitigates single-machine double-click but not genuine concurrency)

**Testable via:** concurrency harness (two simultaneous `updateClassProgress` calls with the same `sessionSummary.day`)

---

### #7 — AuthContext demotes user to `student` on transient Firestore read failure

**Claim:** `loadProfile` catches any `getDoc` error and sets `{ ...firebaseUser, role: 'student' }`. The `getDoc` is the raw firebase import, not the `withRetry` wrapper. A transient error redirects a real teacher away from every teacher route.

**Actual code (`src/contexts/AuthContext.jsx:32-57`):**

```js
import { doc, getDoc } from 'firebase/firestore'   // line 11 — raw import, not withRetry

const loadProfile = async () => {
  try {
    const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))  // line 34 — raw getDoc
    const userData = userSnap.exists() ? userSnap.data() : {}
    if (isMounted) {
      setUser({
        ...firebaseUser,
        role: userData.role ?? 'student',     // line 39 — role from doc or 'student'
        ...
      })
    }
  } catch {
    if (isMounted) {
      setUser({
        ...firebaseUser,
        role: 'student',                       // line 49 — catch forces role: 'student'
      })
    }
  }
```

**Route guard (`src/components/TeacherRoute.jsx:15`):**
```js
if (user?.role !== 'teacher') {
  return <Navigate to="/" replace />
}
```

**Verdict: CONFIRMED**

- `getDoc` is the raw Firebase import (line 11); `withRetry` is defined in `db.js` but is never imported or used in `AuthContext.jsx`.
- On any error (network blip, offline, security-rules latency) the `catch` block at line 45 executes with no role preservation, setting `role: 'student'`.
- `TeacherRoute` at line 15 hard-redirects anyone whose `user.role !== 'teacher'` to `/`.
- A teacher whose `loadProfile` throws during auth init is silently demoted and routed away from all teacher views.
- `initializing` is set `false` in the `finally` block (line 53), so the app proceeds with the degraded role.
- No retry, no error state, no preservation of a previously known role.

**True severity: HIGH** (confirmed as stated)

**Testable via:** Admin-SDK (configure Firestore rules to reject the read transiently, log in as teacher, observe route)

---

### #28 — Unbounded full-list reads on every session init / PDF / debug call

**Claim:** `getSegmentWords`, `getNewWords`, `getFailedFromPreviousNewWords`, `getBlindSpotPool` each do `getDocs(query(wordsRef, orderBy('position')))` with no limit. `initializeDailySession` (invoked by PDF/debug) calls `getSegmentWords` several times per flow.

**Actual code (`src/services/studyService.js:278-308, 538-550, 497-526, 638-646`):**

`getSegmentWords` (line 281):
```js
const wordsQuery = query(wordsRef, orderBy('position', 'asc'));  // NO limit
const wordsSnap = await getDocs(wordsQuery);
// ... then filters in JS by position range
```

`getNewWords` (line 540):
```js
const wordsQuery = query(wordsRef, orderBy('position', 'asc'));  // NO limit
const wordsSnap = await getDocs(wordsQuery);
// ... then filters by position in JS
```

`getFailedFromPreviousNewWords` (line 502):
```js
const wordsQuery = query(wordsRef, orderBy('position', 'asc'));  // NO limit
```

`getBlindSpotPool` (line 639):
```js
const wordsSnap = await getDocs(query(wordsRef, orderBy('position', 'asc')));  // NO limit
```

**Fan-out in PDF/debug paths:** `getTodaysBatchForPDF` calls `initializeDailySession` → `getOrCreateClassProgress`, then separately calls `getNewWords`, `getFailedFromPreviousNewWords`, and `getSegmentWords` (lines 770–788) — three full-collection reads. `getDebugSessionData` calls `initializeDailySession` + `buildReviewQueue` → `getSegmentWords` + another `getSegmentWords` directly (lines 1027–1032) — two full-collection reads.

**Verdict: CONFIRMED**

Every call fetches the entire words subcollection with no server-side position range filter, then discards out-of-range words in JS. A single PDF generation triggers 3+ full-collection reads.

**True severity: MEDIUM** (confirmed as stated)

**Testable via:** unit (mock Firestore, assert `limit`/`where` range clauses present) or Admin-SDK (read billing/read-count with large list)

---

### #29 — `graduateSegmentWords` can graduate NEVER_TESTED words to MASTERED

**Claim:** `getSegmentWords` synthesizes a default NEVER_TESTED state for words lacking one. `graduateSegmentWords` treats every segment word not in `failedWordIds` as eligible and randomly graduates `floor(segmentSize * testScore)` to MASTERED — so a never-tested word can be flipped to MASTERED.

**Actual code:**

`getSegmentWords` (lines 299–307) synthesizes NEVER_TESTED state for words without a study_states doc:
```js
studyState: studyStates[word.id] || {
  ...DEFAULT_STUDY_STATE,
  status: WORD_STATUS.NEVER_TESTED,   // synthetic fallback
  wordIndex: word.position,
  listId
}
```

`graduateSegmentWords` (lines 863–866):
```js
// Segment-wide graduation: eligible = ALL words that didn't fail THIS test
// (Previously FAILED/NEVER_TESTED words may now be mastered after studying)
const failedIds = new Set(failedWordIds);
const eligibleWords = segmentWords.filter(w => !failedIds.has(w.id));
```

The comment explicitly acknowledges NEVER_TESTED words are included. There is **no status check** — any segment word not in `failedWordIds` (the words that failed *this specific test*) is eligible. A NEVER_TESTED word that never appeared in the test is not in `failedWordIds`, so it passes the filter and can be selected for graduation.

**Verdict: CONFIRMED**

The eligibility filter `w => !failedIds.has(w.id)` covers all words not explicitly failed in the current test. A NEVER_TESTED word (no study_states doc, synthesized status) that was never presented in the review test will not be in `failedWordIds` and can be graduated to MASTERED and hidden for 21 days, inflating mastery counts. The code comment ("NEVER_TESTED words may now be mastered after studying") provides justification for the design choice, but the claim is factually accurate: test-exclusion from a test you never took is not a valid mastery signal.

**True severity: MEDIUM** (confirmed as stated)

**Testable via:** unit (create segment with a mix of NEVER_TESTED and PASSED words, assert no NEVER_TESTED word is in `toGraduate`)

---

### #30 — `fetchStudentsProgressForClass` N+1 unbounded getDoc fan-out

**Claim:** For S students × L lists, builds S×L individual `getClassProgress` getDocs via `Promise.all` (e.g., 150 reads for 30 students × 5 lists) on every teacher load, with no batching.

**Actual code (`src/services/progressService.js:401-428`):**

```js
const promises = [];
for (const studentId of studentIds) {
  for (const listId of listIds) {
    promises.push(
      getClassProgress(studentId, classId, listId)   // one getDoc per student×list
        .then(...)
        .catch(...)
    );
  }
}
const results = await Promise.all(promises);
```

`getClassProgress` (lines 381–392) does exactly one `getDoc` per call:
```js
const snapshot = await getDoc(progressRef);   // line 385
```

**Verdict: CONFIRMED**

S students × L lists = S×L individual `getDoc` calls, all fired concurrently via `Promise.all`. For 30 students and 5 lists that is 150 Firestore reads per teacher page load. There is no `getAll`, `in`-query, or collectionGroup batch. The comment "Batch fetch:" (line 409) is misleading — it fires all reads at once but each is still an independent RPC.

**True severity: MEDIUM** (confirmed as stated)

**Testable via:** Admin-SDK (instrument read counts with known S×L values)

---

### #31 — `signup` writes `role: undefined` to Firestore when no role is provided

**Claim:** `signup` passes `role: gradData.role` (gradData defaults to `{}`), so role can be `undefined`. In db.js `userDocument = { role: docOverrides.role ?? 'student', ..., ...docOverrides }` — the trailing spread re-applies `role: undefined` after the fallback. With `ignoreUndefinedProperties` off, `setDoc` rejects, hard-failing account creation.

**Actual code (`src/contexts/AuthContext.jsx:68-97`):**

```js
const signup = async (email, password, name, gradData = {}) => {
  ...
  await createUserDocument(userCredential.user, {
    role: gradData.role,    // line 76 — role: undefined when gradData has no .role
    ...
  })
```

**`createUserDocument` in `src/services/db.js:189-232`:**

```js
const {
  profile: profileOverride,
  stats: statsOverride,
  settings: settingsOverride,
  ...docOverrides        // role: undefined lands here
} = payload

const userDocument = {
  role: docOverrides.role ?? 'student',   // line 220 — evaluates to 'student'
  ...
  ...docOverrides,                         // line 228 — re-spreads role: undefined, OVERWRITING 'student'
}
```

**Firebase initialization (`src/firebase.js:39-43`):**
```js
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)       // No getFirestore(app, { ignoreUndefinedProperties: true })
```

`ignoreUndefinedProperties` is **not set** in the Firestore initialization. The default for the Firestore JS SDK v9 is `false`.

**Verdict: CONFIRMED**

The trailing `...docOverrides` at line 228 re-spreads `role: undefined` after the `?? 'student'` fallback on line 220, resulting in `role: undefined` in the final document. With `ignoreUndefinedProperties` defaulting to `false`, calling `setDoc` with `role: undefined` will cause Firestore to throw "Value for argument 'data' is not a valid Firestore document. Cannot use 'undefined' as a Firestore value." This hard-fails account creation for any signup path that does not explicitly pass a role.

**Note:** The email signup UI does appear to pass a role (via the Signup page form), so this may be latent in production but is a correctness bug at the service layer. The `setUser` call at line 85 uses `gradData.role ?? 'student'` correctly, but by that point `createUserDocument` has already thrown.

**True severity: MEDIUM** (confirmed; severity may be HIGH if any signup path omits role)

**Testable via:** unit (call `signup` with `gradData={}`, assert no rejection / assert Firestore doc has role 'student')

---

### #56 — `getBlindSpotPool` caches count via `updateDoc` which throws if doc doesn't exist

**Claim:** `updateDoc(progressRef, {...})` rejects with "No document to update" when the `class_progress` doc isn't yet created; it's swallowed by try/catch, so the cache write silently fails and `getBlindSpotCount` always falls back to full recomputation. Currently latent — no caller passes `classId`.

**Actual code (`src/services/studyService.js:693-706`):**

```js
if (classId) {
  try {
    const docId = `${classId}_${listId}`;
    const progressRef = doc(db, `users/${userId}/class_progress`, docId);
    await updateDoc(progressRef, {          // throws if doc doesn't exist
      blindSpotCount: blindSpots.length,
      blindSpotCountUpdatedAt: Timestamp.now()
    });
  } catch (err) {
    console.warn('Failed to cache blind spot count:', err);   // silently swallowed
  }
}
```

**Callers:** All three call sites in the codebase (`BlindSpotsCard.jsx:31`, `BlindSpotCheck.jsx:61`, `BlindSpotCheck.jsx:301`) call `getBlindSpotPool(user.uid, listId)` **without** a `classId` argument. The `classId` defaults to `null`, so the `if (classId)` block never executes in production.

**Verdict: CONFIRMED (latent)**

The `updateDoc` bug is real — if `classId` is ever passed, a missing doc causes a silent failure. The "latent" qualifier is correct: no current caller passes `classId`, so no production impact today. The fix (`setDoc` with `{ merge: true }`) is straightforward.

**True severity: LOW** (confirmed as stated; latent, non-production impact)

**Testable via:** unit (call `getBlindSpotPool(uid, listId, classId)` with a non-existent class_progress doc, assert cache write completes)

---

### #57 — Orphaned-review cleanup only inspects the 8 most recent attempts

**Claim:** `cleanupOrphanedReviews` is fed only the 8 most-recent attempts (`getRecentAttemptsForClassList(..., 8)`), so orphan reviews outside that window are never deleted and persist.

**Actual code (`src/services/progressService.js:163-168`):**

```js
const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);  // line 163

// Clean up orphaned reviews (reviews for days beyond anchor)
if (anchorDay > 0) {
  await cleanupOrphanedReviews(userId, classId, listId, anchorDay, attempts);      // line 167
}
```

`cleanupOrphanedReviews` (lines 44–46) operates only on the supplied `attempts` array:
```js
const orphanedReviews = attempts.filter(
  a => a.sessionType === 'review' && a.studyDay > anchorDay
);
```

`getRecentAttemptsForClassList` (db.js:2987): `limit(maxResults)` — hard-capped at 8 docs ordered by `submittedAt desc`.

**Verdict: CONFIRMED**

An orphaned review from day 9 for a student currently on day 20 (i.e., beyond the 8-attempt window) will never be seen and never cleaned. The impact is limited as stated: CSD derives from `getMostRecentPassedNewTest` (a separate query), so undeleted orphans beyond the 8-window are dead rows that don't corrupt CSD. They do accumulate in the `attempts` collection.

**True severity: LOW** (confirmed as stated)

**Testable via:** Admin-SDK (seed >8 attempts with an orphaned review older than the window, call `getOrCreateClassProgress`, assert orphan survives)

---

### #58 — `calculateUpdatedStreak` mutates the passed-in Date via `setHours`

**Claim:** When `lastStudyDate` is a Date instance it isn't cloned before `setHours(0,0,0,0)`, mutating the caller's object. Currently harmless (the sole caller passes a fresh `.toDate()`), but a future shared-Date caller would be corrupted. `getExpectedPreviousDay` clones correctly.

**Actual code (`src/services/progressService.js:292-296`):**

```js
const lastDate = lastStudyDate instanceof Date
  ? lastStudyDate                                          // NO clone — assigns same reference
  : (lastStudyDate?.toDate?.() || new Date(lastStudyDate));
lastDate.setHours(0, 0, 0, 0);                            // mutates the passed-in Date
```

Compare `getExpectedPreviousDay` (lines 275-285) which correctly clones:
```js
const prev = new Date(fromDate);    // new Date(...) — explicit clone
prev.setDate(prev.getDate() - 1);
prev.setHours(0, 0, 0, 0);
```

**Caller in `updateClassProgress` (line 345):**
```js
const lastStudyDate = current.lastStudyDate?.toDate?.() || current.lastStudyDate || null;
```

`toDate()` on a Firestore Timestamp returns a **new** Date object each call, so the current sole caller is safe. However, if `current.lastStudyDate` is already a Date (e.g., during testing or from a non-Timestamp source), the mutation reaches the caller's object.

**Verdict: CONFIRMED (currently harmless)**

The mutation is real. The current caller always passes `toDate()` which creates a fresh Date, making this harmless in production today. The finding correctly identifies the risk for future callers and the inconsistency with `getExpectedPreviousDay`.

**True severity: LOW** (confirmed as stated)

**Testable via:** unit (pass a Date instance directly to `calculateUpdatedStreak`, assert original Date is not mutated)

---

### #60 — First-time Google sign-in can race `onAuthStateChanged`, persisting empty profile/role

**Claim:** `signInWithGoogle` creates the user doc only after the popup resolves and never force-updates context. Meanwhile `onAuthStateChanged`'s `loadProfile` can read the not-yet-created doc, setting `{}` profile/null stats and role 'student'. The email signup path handles this race but Google doesn't.

**Actual code (`src/contexts/AuthContext.jsx:103-129`):**

```js
const signInWithGoogle = async () => {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider)  // triggers onAuthStateChanged
    const firebaseUser = userCredential.user

    const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))

    if (!userSnap.exists()) {
      await createUserDocument(firebaseUser, { ... })   // doc created AFTER onAuthStateChanged fires
    }

    return firebaseUser     // NO setUser() call — no force-update
  }
```

**Email signup path (`src/contexts/AuthContext.jsx:84-95`) — correctly force-updates:**
```js
setUser({
  ...userCredential.user,
  role: gradData.role ?? 'student',
  profile: { ... },
  stats: null,
  settings: null,
})
```

**Verdict: CONFIRMED**

`signInWithPopup` triggers `onAuthStateChanged` immediately. The `loadProfile` call inside the listener reads the Firestore doc while `signInWithGoogle` is still awaiting `getDoc` for its own existence check. For a first-time user the doc doesn't exist yet; `loadProfile` reads `{}`, applies `role: userData.role ?? 'student'` (becomes `'student'`), and calls `setUser`. `signInWithGoogle` then creates the doc, but never calls `setUser` to update context — the stale `student` role persists until the next full reload that re-runs `loadProfile`.

The email signup path explicitly calls `setUser` after `createUserDocument` (lines 84–95) to avoid exactly this race. Google sign-in does not.

**True severity: LOW** (confirmed as stated; new Google sign-up lands as 'student' role until next login)

**Testable via:** Playwright (new Google sign-up → verify teacher teacher routes accessible without re-login) or Admin-SDK (sign up via Google, immediately check user.role in context)

---

## STATUS BLOCK

### Verdict Table

| ID | Severity (Review) | Verdict | True Severity | Notes |
|----|-------------------|---------|---------------|-------|
| #6 | HIGH | **CONFIRMED** | HIGH | Guard is check-then-act on stale read; no transaction; same-day double-write not prevented |
| #7 | HIGH | **CONFIRMED** | HIGH | Raw `getDoc` (no withRetry), catch sets `role:'student'`, TeacherRoute hard-redirects |
| #28 | MEDIUM | **CONFIRMED** | MEDIUM | No `limit` or range `where` in any of the four functions; PDF triggers 3+ full reads |
| #29 | MEDIUM | **CONFIRMED** | MEDIUM | Eligibility = `!failedIds.has(w.id)` with no status check; NEVER_TESTED words qualify |
| #30 | MEDIUM | **CONFIRMED** | MEDIUM | S×L individual `getDoc` calls via Promise.all; "batch" comment misleads |
| #31 | MEDIUM | **CONFIRMED** | MEDIUM | `...docOverrides` spread overwrites `?? 'student'` with `undefined`; `ignoreUndefinedProperties` not set |
| #56 | LOW | **CONFIRMED (latent)** | LOW | `updateDoc` throws on missing doc; swallowed; but no current caller passes `classId` |
| #57 | LOW | **CONFIRMED** | LOW | 8-attempt limit on cleanup input; orphans beyond window survive |
| #58 | LOW | **CONFIRMED (harmless)** | LOW | No clone on Date branch; caller uses `.toDate()` so currently safe |
| #60 | LOW | **CONFIRMED** | LOW | Google flow lacks `setUser` force-update; email signup does it correctly |

### Counts

| Verdict | Count |
|---------|-------|
| CONFIRMED | 8 |
| CONFIRMED (latent/harmless) | 2 |
| FALSE | 0 |
| OVERSTATED | 0 |
| PARTIAL | 0 |
| **Total verified** | **10** |

All 10 findings confirmed. Zero false positives in this slice.

### Recommended Test Approach per Confirmed Item

| ID | Test Approach | Rationale |
|----|--------------|-----------|
| #6 | **Concurrency harness** — fire two simultaneous `updateClassProgress` calls with identical `sessionSummary.day` against real/emulator Firestore, assert `recentSessions` has exactly 1 entry and `currentStudyDay` incremented by exactly 1 | Requires real I/O timing to expose TOCTOU |
| #7 | **Admin-SDK** — temporarily set Firestore rules to deny user doc reads, trigger login as a teacher-role user, assert `user.role` in context and TeacherRoute behavior | Needs controllable failure injection |
| #28 | **Unit** — mock `getDocs` to count calls with `limit`/`where` range constraints; assert `getNewWords(listId, 10, 5)` does not fetch entire collection | Easy to unit-test without Firestore |
| #29 | **Unit** — create a segment with known NEVER_TESTED words (no study_states doc), call `graduateSegmentWords` with `testScore=1.0` and empty `failedWordIds`, assert no NEVER_TESTED word appears in the batch write | Deterministic with seeded data |
| #30 | **Admin-SDK** — instrument Firestore read counters; call `fetchStudentsProgressForClass` with S=10, L=5; assert exactly 50 reads | Straightforward count verification |
| #31 | **Unit** — call `signup` with `gradData={}` (no role), assert `createUserDocument` is called with a resolved non-undefined role or assert the written Firestore doc has `role:'student'` | Mock `setDoc`, inspect argument |
| #56 | **Unit** — call `getBlindSpotPool(uid, listId, classId)` with no pre-existing class_progress doc; assert the function resolves (no unhandled rejection) and the cache write attempted `setDoc` with merge | Latent; worth guarding |
| #57 | **Admin-SDK** — seed 9+ attempts including an orphaned review beyond position 8; call `getOrCreateClassProgress`; assert orphan still exists in `attempts` collection | Demonstrates blind spot in cleanup |
| #58 | **Unit** — pass a `Date` instance to `calculateUpdatedStreak`; assert the original Date's hours/minutes/seconds are unchanged after the call | Pure function, no Firestore needed |
| #60 | **Playwright** — new Google sign-up (emulator); immediately navigate to a teacher-only route without reloading; assert redirect to `/` (proving stale student role) | Requires emulator + Playwright |
