# Codex review — DEEPFIX_TASK3_P9 round 1

Verdict: NEEDS_FIXES

VERDICT blockers=1 high=2 med=1 nits=0

## Scope reviewed

P9 cycling capstone draft:

- `docs/plans/loop/x/plan.md`
- `audit/deepfix/task3/P9_impl_notes.md`
- `src/config/featureFlags.js`
- `src/services/studyService.js`
- `functions/foundation.js`
- `src/services/db.js`
- `src/pages/DailySessionFlow.jsx`
- `src/pages/MCQTest.jsx`
- `src/pages/TypedTest.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/ClassDetail.jsx`

Validation run:

- `npm run build` passed.
- Vite warnings are the existing dynamic/static import chunking and large chunk warnings.

## Finding P9-1 — BLOCKER — Cycling never activates in the main session path because `cyclingEnabled` is not passed into `initializeDailySession`

The global/per-assignment two-key gate is implemented in `isCyclingActive(assignmentSettings)`, but the main callers drop the per-assignment key before calling `initializeDailySession`.

Evidence:

- `src/services/studyService.js:66-68`:
  - `isCyclingActive(assignmentSettings)` requires `CYCLING_ENABLED && assignmentSettings?.cyclingEnabled === true`.
- `src/pages/DailySessionFlow.jsx:574-586` calls `initializeDailySession` with a newly constructed object containing pace/test settings, but not `cyclingEnabled`.
- `src/pages/MCQTest.jsx:315-321` and `src/pages/TypedTest.jsx:374-380` do the same for standalone new-word paths.
- `src/services/studyService.js:1236-1242`, `1284-1290`, and `1478-1484` do the same for PDF/debug helpers.

Result: even if the global `CYCLING_ENABLED` flag is flipped and the assignment has `cyclingEnabled:true`, `initializeDailySession` sees no per-assignment key, so:

- `cycling` remains false.
- `cyclingActive` remains false.
- cap removal never happens.
- `resolveVirtualRange` is not used from session init.
- `isListComplete` stays the legacy list-end condition.

So the feature is effectively nonfunctional in the primary student flow.

Required fix:

- Thread `assignment.cyclingEnabled === true` into every `initializeDailySession` call site that is deriving settings from an assignment object.
- Include the standalone Typed and MCQ paths, PDF helpers, and debug helper.
- Add a small assertion/test/harness check: with global flag enabled and assignment cycling enabled, `initializeDailySession` returns `cyclingActive:true` for a finished list and `newWordCount > 0`.

## Finding P9-2 — HIGH — Cross-class unlock rule from §3b is not implemented

The plan requires: any assigned class with cycling enabled unlocks cycling for that student+list, and all of that student's classes on the list show lap-aware continuation with an affordance such as "cycling enabled via {className}".

The draft is still per-current-class:

- `Dashboard.jsx` uses `klass.assignments?.[list.id]?.cyclingEnabled` / focus assignment state.
- `ClassDetail.jsx` displays cycling based on that list's assignment in that class.
- `initializeDailySession` receives only the launching class's assignment settings.
- I did not find a scan of the student's other enrolled classes for the same list to resolve a list-level cycling capability.

This means a student can still dead-end or show non-lap-aware progress in class B even though class A assigned the same list with cycling enabled. That violates the per-student-per-list unlock rule in `x/plan.md §3b`.

Required fix:

- Add a resolver for effective cycling capability at student+list scope:
  - current class assignment enables cycling, OR
  - any other enrolled/assigned class for the same list enables cycling.
- Return/display the source class where needed.
- Use that effective capability consistently in session init and dashboard/class display surfaces.
- If cross-class unlock is intentionally deferred, P9 cannot be GO against v5 as written; the plan must be changed and re-reviewed.

## Finding P9-3 — HIGH — `cycleLength := positions.length` is not consistently used; several live cycling paths use `wordCount`

The plan is explicit that `positions.length` is the single canonical modulus for lap math, display, and review bounding. The implementation uses `positions.length` only inside `resolveVirtualRange`, but uses list `wordCount` elsewhere.

Evidence:

- `studyService.js:110-116` correctly uses ordered word docs and `positions.length` inside `resolveVirtualRange`.
- `studyService.js:272-283` reads `lists/{listId}.wordCount` for `cycleLength`.
- That `cycleLength` then controls review pool lap-bounding at `studyService.js:541-543`.
- Dashboard/ClassDetail display also uses `list.wordCount` as the denominator.

If `wordCount` ever drifts from the actual ordered word-position array length, the wrapped new-word lookup and the review/display lap math disagree. Example: if `positions.length=100` and `wordCount=120`, `resolveVirtualRange` wraps at 100, while review/display still think the lap is 120. That can include the wrong review pool and show the wrong lap boundary.

The notes flag this as U6, but `x/plan.md §2` made the one-modulus rule a correctness requirement, not a cosmetic preference.

Required fix:

- Derive `cycleLength` from the same ordered positions source used by `resolveVirtualRange`, or centralize a helper that returns both `cycleLength` and virtual range data.
- Use that value for `computeLapView`, review pool lap bounds, failed-carryover lap bounds, and display.
- If a cached list-level `cycleLength` is desired, make that a separate audited invariant; do not silently substitute mutable `wordCount` for the canonical modulus.

## Finding P9-4 — MED — Typed standalone path is explicitly not lap-aware

`P9_impl_notes.md` U10 says `TypedTest.jsx` was not touched, but the route exists and calls `getNewWords` directly:

- `TypedTest.jsx:383` calls `getNewWords(listId, config.newWordStartIndex, config.newWordCount)` with no cycling argument.
- The same standalone block also fails to pass `cyclingEnabled` into `initializeDailySession`.

This is partially covered by P9-1, but it deserves separate tracking because MCQ was amended while Typed was left behind. If direct/standalone Typed routes are live or recoverable, a cycling typed assignment can still fail at the finished-list boundary.

Required fix:

- Update Typed standalone the same way as MCQ.
- Add a direct Typed route check or formally prove the standalone path is unreachable for cycling assignments.

## U1–U12 adjudication summary

- U1 global flag: accepted. The two-key gate is a safe strengthening for dormant rollout.
- U2 lap-aware M4: directionally accepted. Dropping the `wordsRemaining` cap under cycling is consistent with monotonic virtual TWI; M4 still checks virtual `nwsi === serverTwi`, range consistency, allocation count, and study day.
- U3 review-only × laps: still owed; not a blocker for dormant draft, but must be a pre-enable validation.
- U4 inline badge: acceptable as the chosen acknowledgement unless product explicitly wants an interstitial.
- U5 intervention carry/reset: product decision; not a correctness blocker for dormant code.
- U6 canonical cycle length: not acceptable as currently implemented; see P9-3.
- U7 `advanceForChallenge` clamp: acceptable as a consistency edit, assuming no broader challenge migration is implied.
- U8 Start-over terminal: not harmful while gated, but its live semantics depend on resolving P9-2.
- U9 cross-class unlock: not acceptable as currently implemented; see P9-2.
- U10 Typed standalone: not acceptable as currently implemented; see P9-4.
- U11 PDF physical sort: cosmetic/deferred.
- U12 blind-spot unaffected: plausible, but should be covered by the pre-enable persona run because accept-reset changes physical study-state semantics.

## Bottom line

Do not mark P9 converged yet. The draft is dormant and build-clean, but it is not a correct implementation of the v5 plan when enabled. The per-assignment gate is not threaded into the main session path, the cross-class unlock rule is missing, and the canonical cycle-length invariant is violated.
