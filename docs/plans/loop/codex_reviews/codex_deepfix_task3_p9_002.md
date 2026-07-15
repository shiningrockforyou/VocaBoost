# Codex review — DEEPFIX_TASK3_P9 round 2

Verdict: NEEDS_FIXES

VERDICT blockers=1 high=1 med=1 nits=0

## Scope reviewed

Round-2 delta for prior findings:

- P9-1: `initializeDailySession` self-resolves effective cycling.
- P9-2: cross-class unlock.
- P9-3: `positions.length` cycle length.
- P9-4: Typed standalone path.

Files checked:

- `src/services/studyService.js`
- `src/pages/TypedTest.jsx`
- `src/pages/MCQTest.jsx`
- `src/pages/DailySessionFlow.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/ClassDetail.jsx`
- `functions/foundation.js`
- `audit/deepfix/task3/p9_assert.mjs`

Validation:

- `npm run build` passed.
- Vite warnings only: existing dynamic/static import chunking and large chunk warnings.

## What is fixed

The original P9-1 client activation blocker is fixed on the client:

- `initializeDailySession` now calls `resolveEffectiveCycling(userId, listId)` directly.
- Flag-off short-circuits before the `fetchStudentClasses` read.
- Typed standalone now passes `config.cyclingActive` into `getNewWords`, matching MCQ.

The original P9-3 cycle-length issue is mostly fixed on the client:

- `getCycleLength(listId)` counts the same ordered word-doc population that `resolveVirtualRange` wraps.
- `initializeDailySession`, review pool, failed-carryover, dashboard, and class detail now use this cycle length where loaded.

## Finding P9-5 — BLOCKER — Cross-class cycling is client-only; server validation/completion still checks only the launching class

Round 2 implements cross-class unlock on the client, but `functions/foundation.js` still evaluates cycling from only the launching/current class assignment.

Evidence:

- Client session init:
  - `studyService.js:99-107` resolves effective cycling by scanning the student's enrolled classes.
  - `studyService.js:355-361` uses that effective result for cap removal and `cyclingActive`.
- Server M4:
  - `functions/foundation.js:791` reads `classData?.assignments?.[ctx.listId]` for the current `ctx.classId`.
  - `functions/foundation.js:816-821` calls `cyclingAllowed(assignment)` using only that current-class assignment.
- Server completion:
  - `functions/foundation.js:985-999` uses the same current-class-only `cyclingAllowed(assignment)` for `isListComplete`, `reviewOnlyDay`, and `serverNewWordCount`.
- Server challenge advancement:
  - `functions/foundation.js:1684` reads `classSnap.data().assignments?.[listId]` from the attempt/current class.
  - `functions/foundation.js:1745-1750` uses current-class-only cycling for the clamp.

Failure case:

1. Student has list L in class A with `cyclingEnabled:true`.
2. Student enters list L from class B where `cyclingEnabled` is absent/false.
3. Client `resolveEffectiveCycling` returns enabled because class A unlocks the student+list.
4. Client removes the cap and writes/stamps a cycling virtual range.
5. Server M4/completeSession sees class B's assignment only and treats cycling as false.

Consequences:

- M4 can log `introduced_over_allocation` / anchor rejection for a valid cross-class cycling day.
- `completeSession` can treat the finished list as `listComplete`, derive `reviewOnlyDay`, and apply `wordsIntroduced=0` instead of advancing virtual TWI.
- `advanceForChallenge` can likewise apply the wrong non-cycling clamp.

This is exactly the cross-class unlock rule P9-2 was supposed to close. The client and server must use the same effective cycling predicate.

Required fix:

- Add a server-side effective cycling resolver for `{studentId, listId}` that checks all enrolled/assigned classes, or otherwise pass a server-verifiable effective cycling source into the server path.
- Use that same effective result in:
  - `validateAttemptAnchorShadow`
  - `completeSession`
  - `advanceForChallenge`
- Keep the global `CYCLING_ENABLED` short-circuit first.
- Add a harness case where class A enables cycling and class B launches the session; both client and server must advance virtual TWI consistently.

## Finding P9-6 — HIGH — Dashboard continuation-yield still uses current-class cycling, not effective cycling

The focus display uses `deriveEffectiveCycling`, but the continuation-yield break still checks only the current class assignment:

- `Dashboard.jsx:1108-1112` builds focus with effective `cyclingEnabled`.
- `Dashboard.jsx:1133-1135` in `resolveContinuation` still does `if (assignment.cyclingEnabled === true) break`.

If cycling is unlocked via another class, but the current class has `cyclingEnabled:false`, the continuation resolver can still auto-yield the finished cycling list to `nextListId`. That contradicts the P9 rule that an effectively cycling list never behaves as finished/dead-ended.

Required fix:

- In continuation resolution, gate yield using `deriveEffectiveCycling(studentClasses, current.id).enabled`, not only `klass.assignments[current.id].cyclingEnabled`.
- Preserve flag-off behavior by only doing this inside the `CYCLING_ENABLED` branch.

## Finding P9-7 — MED — ClassDetail `twi > cycleLength` proxy misses exact-boundary cross-class cyclers

ClassDetail does not have per-student cross-class data and uses:

- current class has `cyclingEnabled`, OR
- `wordsIntroduced > cycleLength`

Evidence: `ClassDetail.jsx:90-94`.

This avoids many false positives, but it false-negatives a real cross-class cycler at the exact first boundary (`twi === cycleLength`) before they begin lap 2. In that state the student is effectively cycling via another class, but the teacher view for this class still shows ordinary finished-list progress rather than the cross-class cycling affordance.

This is not as severe as the server mismatch, but it should be documented or fixed. If ClassDetail is expected to show the source-class affordance accurately, it needs either per-student effective cycling data or an explicit "unknown until lap advance" limitation.

## Notes

- `getCycleLength` now uses an aggregate count over the ordered word-doc population. That is acceptable for the P9-3 invariant: it is the same population `resolveVirtualRange` uses.
- `getCycleLength` returning 0 on error makes cycling fail closed to legacy/non-cycling. That is acceptable while dormant, but pre-enable validation should include count-query failure UX/telemetry if the product wants a controlled message instead of silent non-cycling.
- U3 review-only × laps remains owed as a pre-enable validation. I did not count it as a new implementation blocker in this round.

## Bottom line

Round 2 fixed the client-side activation and cycle-length issues, but P9 is not converged. The cross-class unlock is not implemented consistently across client and server, so the exact "enabled via another class" case can pass client init and then be rejected or zeroed by server-authoritative completion.
