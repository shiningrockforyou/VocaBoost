# Codex Review — DEEPFIX Task 3 P9, Round 3

Verdict: GO / CONVERGED-OK

Reviewed baton: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p9_003.md`  
Target plan: `docs/plans/loop/x/plan.md`  
Changed files: `functions/foundation.js`, `src/pages/Dashboard.jsx`, `src/pages/ClassDetail.jsx`

## Result

The round-2 blockers are fixed. I do not see a remaining correctness blocker in the P9 cycling implementation.

## Checks

### P9-5 — server cross-class cycling parity

Status: fixed.

`functions/foundation.js` now has `resolveEffectiveCyclingServer(studentId, listId)`, with the global `CYCLING_ENABLED` short-circuit first. When off, it returns not-cycling without Firestore reads. When on, it reads the same subject set as the client: `users/{uid}.enrolledClasses` keys, then each class doc’s `assignments[listId].cyclingEnabled`.

The old launching-class-only `cyclingAllowed` path is gone, and the effective predicate is threaded into all three server legs:

- M4 allocation validation / clamp.
- `completeSession`.
- `advanceForChallenge`.

This closes the previous client/server mismatch where the client could treat a list as cycling via another class while server writes still behaved as non-cycling.

### P9-6 — Dashboard continuation yield

Status: fixed.

`Dashboard.jsx` now suppresses continuation auto-yield with:

```js
if (CYCLING_ENABLED && deriveEffectiveCycling(studentClasses, current.id).enabled) break
```

That is the correct effective cross-class predicate, not the current class assignment field. The existing first-paint loading gate includes `studentClassesLoading`, so the focus computation is not expected to persist a wrong pre-load yield as a final state.

### P9-7 — ClassDetail exact-boundary limitation

Status: accepted/documented.

The teacher grid still uses the documented proxy:

```js
list.cyclingEnabled === true || wordsIntroduced > cycleLength
```

This intentionally misses cross-class-only cyclers exactly at `twi === cycleLength`, because resolving true cross-class effective cycling per student would require data the teacher row does not currently carry. The limitation is documented in code and in the notes, and the student-facing/session paths use the real predicate.

## Non-blocking note

The server resolver catches read errors and treats them as not-cycling. That matches the client helper’s fail-closed behavior and preserves the write path, but during a rare infrastructure read failure it could make a true cross-class cycler complete under non-cycling semantics. I am not marking this as a blocker because:

- the global flag remains default-off/dormant;
- Admin SDK read failures here should generally coincide with broader backend instability;
- the client path already had the same fallback shape;
- all ordinary existing/missing-class cases preserve client/server predicate parity.

If this code becomes hot in production and cycling is used heavily, consider changing resolver read failure to an explicit retryable failure for write paths instead of silently returning not-cycling.

## Verification

Ran:

```bash
npm run build
```

Result: pass. Vite emitted only existing bundle/chunk warnings.

## Final decision

P9 is converged from this review’s perspective.
