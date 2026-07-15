# Codex review — REVIEWONLY_DESIGN round 1

## Verdict

NEEDS_FIXES.

The root-cause direction is right: the Day-2+ completion gate blocks legitimate review-only days because it assumes every study day had assigned new words. That explains the L14 full-freeze deadlock and the list-end review-only dead-end.

But the current plan is not yet safe to implement as written. It treats `wordsIntroduced === 0` as the skip signal while acknowledging that this value is client/sessionStorage-derived. It also does not define how session state should represent a completed day with no new-word test. Those are load-bearing details, not optional hardening.

## Findings

### ROD-1 — The gate-skip condition must be authoritative, not raw `wordsIntroduced === 0`

Severity: high

The proposed code:

```js
const reviewOnlyDay = wordsIntroduced === 0;
if (!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore < threshold) {
  return { requiresNewWordRetake: true };
}
```

is not safe enough as the final design because `wordsIntroduced` currently comes from `sessionStorage.sessionConfig.newWordCount` under `LIST_SCOPED_RECON`.

That value is exactly the field a forged/stale client would want to set to `0` to skip the new-word gate. The plan says the blast radius is low because TWI is anchor-authoritative, but CSD is not harmless:

- CSD drives visible day number.
- CSD affects review segment/day-of-week selection.
- CSD affects streak/session history semantics.
- CSD is explicitly non-demoting under `LIST_SCOPED_RECON`, so an inflated CSD is sticky by design.

Required design fix:

Define an authoritative `reviewOnlyDay` predicate before implementation. At minimum, the plan should require re-deriving enough trusted state at completion time to prove one of these is true:

1. allocation legitimately assigned zero new words because intervention recomputed from persisted `recentSessions` is `1.0` / `allocation.newWords === 0`;
2. list end legitimately assigned zero because `wordsRemaining <= 0`;
3. the day is a review-resume where a same-day passed new-word attempt already exists, in which case the gate can be satisfied by that authoritative attempt rather than skipped.

This can still be client-side in the current architecture, but it must be derived from Firestore progress + assignment + list metadata + attempts, not trusted from sessionStorage alone. If that re-derivation is deferred to a future server-authoritative phase, this plan should explicitly say the current patch is not security-complete.

### ROD-2 — Review-only completion must not persist contradictory `newWordsTestPassed: false`

Severity: high

If the gate is skipped but the existing code remains otherwise unchanged, the Day-2+ branch still does:

```js
newWordScore = 0; // when no new attempt found
...
await saveSessionState(userId, classId, listId, {
  newWordsTestScore: newWordScore,
  newWordsTestPassed: newWordScore >= threshold,
  reviewTestScore: reviewScore,
  phase: SESSION_PHASE.COMPLETE
});
```

For a legitimate review-only day, this would stamp a durable session state that is both:

- `phase: COMPLETE`
- `newWordsTestPassed: false`

That is semantically wrong and can confuse UI/support/admin tooling. The prior day-guard fixes were explicitly about avoiding contradictory durable session state; this plan needs the same rigor.

Required design fix:

Specify review-only session-state semantics. For example:

- `newWordsTestScore: null`
- `newWordsTestPassed: null` or an explicit `newWordsAssigned: false` / `reviewOnlyDay: true` marker if schema allows
- `reviewTestScore: reviewScore`
- `phase: COMPLETE`

If existing consumers require a boolean, the plan must identify them and define the least misleading representation.

### ROD-3 — List-end behavior needs a no-review-work branch

Severity: medium

Review-only continuation is reasonable when there is an actual review segment/backlog. But list-end can also mean:

- `newWordCount === 0`
- `wordsRemaining <= 0`
- and potentially no meaningful review segment left.

The plan frames list-end as “review-only continuation” by default. That is probably correct as a bridge to cycling when review work exists, but it is not enough for an exhausted/no-review state. An empty review-only session should not be completable as a fake day.

Required design fix:

Add a branch for `newWordCount === 0 && !segment/reviewQueue`. Options:

- show a finished/list-complete state;
- route to cycling once the capstone exists;
- block with an explicit “no review work available” state.

Do not let an empty day advance CSD simply because `wordsIntroduced === 0`.

### ROD-4 — The plan should name the stored `interventionLevel` staleness

Severity: medium

The recovery path mostly works because `initializeDailySession` recalculates intervention from `progress.recentSessions`:

```js
const interventionLevel = calculateInterventionLevel(progress.recentSessions || []);
```

But `recordSessionCompletion` passes the session’s old `interventionLevel` into `updateClassProgress`, and `updateClassProgress` stores that value:

```js
interventionLevel: newIntervention
```

So after a successful review-only completion, `recentSessions` will be updated, but the stored `class_progress.interventionLevel` may still show the old intervention until the next session path recalculates from `recentSessions`.

This does not block the allocation recovery if all allocation paths recompute from `recentSessions`, but the plan should state that:

- allocation uses recalculated intervention, not the stored field;
- any UI/admin display of stored `interventionLevel` may lag or should be fixed separately.

### ROD-5 — Acceptance criteria must prove recovery, not just one completion

Severity: medium

The bug is “permanent stuck,” so the acceptance test must prove exit from the stuck state.

Required acceptance tests:

1. L14-like full-freeze:
   - enter `interventionLevel=1.0`;
   - complete a review-only day with high review score;
   - verify CSD increments and TWI stays flat;
   - verify `recentSessions` includes the review;
   - repeat enough high review-only days to make the last-three review average recover;
   - verify a later session assigns `newWordCount > 0`.
2. List-end with review backlog:
   - review-only completion advances CSD, TWI flat, no retake gate.
3. List-end with no review backlog:
   - no fake empty-day completion.
4. Negative gate test:
   - ordinary day with assigned new words and no passed new attempt still returns `requiresNewWordRetake`.
5. Forged/stale zero test:
   - if sessionStorage says `newWordCount=0` but authoritative re-derivation says new words were assigned, the gate must not be skipped.

## Answers to claimsToCheck

1. Root cause is plausible and probably central, but “only blocker” is not proven until session-state semantics and authoritative zero assignment are specified.
2. Raw `newWordCount==0` from sessionStorage is a real forge/stale-state concern. It needs re-derivation or an explicit security limitation.
3. CSD as session count is consistent with `LIST_SCOPED_RECON`, but consumers still use CSD for visible day/review scheduling; do not treat CSD inflation as harmless.
4. `wordsIntroduced === 0` is the right conceptual signal, but not the right trusted signal unless authoritatively re-derived.
5. Review-only continuation is right for full-freeze recovery and list-end-with-review-backlog. It is not sufficient for list-end-with-no-review-work.
6. Yes, this is a plausible independent foundation for cycling, but it needs the safeguards above before implementation.

## Required before GO

Revise the plan to:

- define an authoritative `reviewOnlyDay` predicate;
- specify review-only `session_state` fields;
- handle no-review-work list-end;
- name stored-intervention staleness;
- add recovery/negative/forgery acceptance tests.

## VERDICT

NEEDS_FIXES
