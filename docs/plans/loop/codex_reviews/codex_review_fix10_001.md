# Codex review round 1: FIX10_DESIGN

## Verdict

NEEDS_FIXES

## Summary

The root cause is correct. The bug is an app-side self-race:

1. final-test submit writes a passed attempt;
2. `TypedTest.jsx` / `MCQTest.jsx` call `getOrCreateClassProgress()` only to take a progress snapshot;
3. under `LIST_SCOPED_RECON`, that call reconciles from the just-written attempt and writes the advanced CSD/TWI;
4. `completeSessionFromTest()` then calls `recordSessionCompletion()` → `updateClassProgress()`, which sees `expectedDay = current.currentStudyDay + 1` and rejects the completion as stale.

The proposed primary fix direction is also right: the pre-completion snapshot read must be non-reconciling.

But v1 is not implementation-ready because its sample fallback reintroduces the same race, and the flag-off equivalence requirement needs to be made explicit in the implementation shape.

## Findings

### F10-1 — BLOCKER — The create-if-missing fallback reintroduces the race

The plan’s §3 sample says:

```js
const progress = await getClassProgress(user.uid, classIdParam, listId)
  ?? (await getOrCreateClassProgress(user.uid, classIdParam, listId)).progress;
```

That fallback is unsafe in exactly the failure window this plan is fixing. At this point the attempt has already been written. If the progress doc is missing or briefly unreadable, falling back to `getOrCreateClassProgress()` will reconcile from the just-written attempt and can advance CSD/TWI before `completeSessionFromTest()` runs.

Relevant code:

- `getOrCreateClassProgress()` creates missing docs at `src/services/progressService.js:117-127`;
- then reconciles and writes CSD/TWI at `src/services/progressService.js:248-271`;
- `updateClassProgress()` can create the progress doc itself during completion at `src/services/progressService.js:477-485`.

Required v2 change:

- Remove the `getOrCreateClassProgress()` fallback from the snapshot path.
- If the pure read returns null under `LIST_SCOPED_RECON`, build a local default snapshot object only, or create a bare doc without reconciliation.
- Prefer the simplest shape: use `getClassProgress(...) ?? createClassProgress(classIdParam, listId)` for the snapshot values, then let `completeSessionFromTest()` / `updateClassProgress()` perform the real write.

This may require importing `createClassProgress` from `src/types/studyTypes.js`, or adding a small non-reconciling helper if you want to avoid constructing the default in the page.

### F10-2 — HIGH — The snapshot swap must be explicitly flag-gated

I agree with R1. The swap should be flag-gated.

Under flag-on, `getOrCreateClassProgress()` has the reconciling side effect that creates this bug. Under flag-off, changing the snapshot read timing/source is unnecessary and risks changing Run L byte-equivalence.

Relevant code:

- `TypedTest.jsx` currently imports only `getOrCreateClassProgress` from `progressService` at `src/pages/TypedTest.jsx:17`;
- `MCQTest.jsx` same at `src/pages/MCQTest.jsx:18`;
- `LIST_SCOPED_RECON` is available from `src/config/featureFlags.js` and is already used in `studyService.js`.

Required v2 implementation shape:

```js
const progress = LIST_SCOPED_RECON
  ? ((await getClassProgress(user.uid, classIdParam, listId)) ?? createClassProgress(classIdParam, listId))
  : (await getOrCreateClassProgress(user.uid, classIdParam, listId)).progress;
```

Same in both `TypedTest.jsx` and `MCQTest.jsx`.

### F10-3 — MEDIUM — Fix B should not be part of the first implementation

Fix B proposes changing `updateClassProgress()` so `sessionSummary.day === current.currentStudyDay` returns success instead of `dayGuardRejected`.

I would not ship this in the initial fix. Fix A removes the known same-tab self-race at the source. Fix B changes the duplicate-day guard semantics in a reconciliation-adjacent service used by both pages and by future cross-class flows.

The proposed condition is narrow, but still broad enough to hide a genuine duplicate finalization if the current day already advanced through a different path. Returning success there can also skip session-record creation / recentSessions updates depending on how the caller interprets the returned progress. That makes it a behavior change, not just a defensive no-op.

Required v2 change:

- Scope v2 to Fix A only.
- Keep Fix B as a separately justified follow-up only if a post-Fix-A test still finds a residual same-day collision.
- If Fix B is later revived, it needs its own design: what exact fields prove the existing completion came from the same attempt/day, and what side effects are intentionally skipped.

## Confirmed claims

### C1 — `getClassProgress()` is pure read

Confirmed. `src/services/progressService.js:498-509` only reads `users/{uid}/class_progress/{classId}_{listId}` and returns null or doc data. No writes, no reconciliation.

### C2 — completion re-reads progress fresh

Confirmed. `recordSessionCompletion()` calls `updateClassProgress()` at `src/services/studyService.js:610-617`, and `updateClassProgress()` does its own `getDoc(progressRef)` at `src/services/progressService.js:438`.

The snapshot values are not passed into completion.

### C3 — completion can create the progress doc

Confirmed. If the progress doc does not exist, `updateClassProgress()` writes a new doc at `src/services/progressService.js:477-485`.

So the snapshot path does not need to call `getOrCreateClassProgress()` for creation.

### Typed and MCQ both affected

Confirmed.

- Typed snapshot read: `src/pages/TypedTest.jsx:979`.
- MCQ snapshot read: `src/pages/MCQTest.jsx:718`.
- Both then call `completeSessionFromTest()`.

## Answers to open questions

1. Is `class_progress` guaranteed present by completion time?
   Usually yes because session init uses `getOrCreateClassProgress()`, but the fix should not rely on it. Null is safe if the snapshot uses local default values and completion creates the real doc.

2. Is Fix B needed?
   Not for the known bug. Do not include it in the first implementation.

3. Does anything else rely on the snapshot call's reconcile side-effect?
   I found no legitimate dependency in the completion block. Retake recovery reads `progressSnapshot` and restores the captured fields (`TypedTest.jsx:1141-1178`, `MCQTest.jsx:859-897`). For a “before completion” snapshot, unreconciled stored progress is the correct value.

4. Is `impossible_phase_detected` related?
   Not proven by this plan. Keep it out of scope unless a later test ties it directly to the same snapshot race.

## Required v2 changes

1. Remove the `getOrCreateClassProgress()` fallback from the flag-on snapshot path.
2. Explicitly flag-gate the swap with `LIST_SCOPED_RECON`.
3. Define the null snapshot behavior as local default snapshot values, or a non-reconciling bare create. Do not reconcile.
4. Drop Fix B from the first implementation; keep it as a deferred separate defense only if Fix A is insufficient.

VERDICT: NEEDS_FIXES
