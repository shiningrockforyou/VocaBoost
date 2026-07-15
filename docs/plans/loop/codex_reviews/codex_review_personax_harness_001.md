# Codex review — PERSONAX_HARNESS round 1

## Verdict

NEEDS_FIXES.

The segment-runner shape is right, and the code is audit-only. The core issue is fail-closed evidence: two load-bearing paths can currently certify the wrong thing.

## Findings

### PH-1 — Expected-blocked personas can pass without proving the app hit the block path

Severity: blocker.

In `lsr_persona.mjs`:

- `advanceOneDay()` returns `{ ok: true, blockedReached: true }` for blocked days when `enterReviewSession()` does not reach a review test.
- `fbFrozenSignal()` returns success when CSD/TWI merely stayed unchanged.
- final blocked confirmation is `confirmed = r?.ok && frozen`.
- `orphanFlaggedSince()` is recorded but not required.
- `blockedOutcome` is recorded but not required.

That means L13/L14 can pass if the harness does not actually drive the review submit/block path and the counters simply remain unchanged. That is the exact false-green shape these personas are supposed to prevent.

Required fix:

- A blocked day must require an affirmative block signature, not just frozen counters.
- Acceptable signatures should be explicit and scoped, for example:
  - review was reached and submitted, and outcome was the expected retake-required / blocked outcome,
  - or an exact `orphaned_attempt_flagged` / expected system-log delta appears for this user/class/list/day,
  - or a visible UI retake-required/block message was captured.
- `review-not-reached` should not be an OK blocked result unless there is another exact app-side block signal proving the path executed.

### PH-2 — T2 / same-pace carry baselines are read before reconciliation is forced

Severity: blocker.

The runner joins the new class, goes to the dashboard, then immediately reads:

```js
const base = await fbState(uid, classId, list.id);
```

For T2 and same-list same-pace moves, the carry is created by list-scoped reconciliation. The prior Run L/Run S work established that reconciliation is triggered by entering the session, not merely by joining the class. This code does not force session entry before reading the baseline.

Consequences:

- T2 may read `0/0` instead of the expected carried `csd/twi`.
- `daysToCapFromHere` then computes from the wrong `prev.twi`.
- the L7 "finish day 19" oracle is not actually bound unless the baseline is first reconciled and asserted.

Required fix:

- For carry transitions (`T2`, `same-pace-move`), enter the newly joined class/list session far enough to trigger `getOrCreateClassProgress`, leave safely, then read the baseline.
- Assert exact carry:
  - `base.csd === seg.startCsd`
  - `base.twi === expected carried TWI` from the previous same-list segment.
- Fail INVALID if reconciliation does not occur.

### PH-3 — Segment-entry baseline contracts are comments, not enforced

Severity: high.

The code defines:

```js
const expectCarry = seg.transitionInto === 'T2' || seg.transitionInto === 'same-pace-move';
```

but never uses it.

Only segment 0 is checked for pristine `0/0`. Later segment baselines are not fail-closed:

- `fresh`, `T1`, and `T3` should require `base.csd === 0 && base.twi === 0`.
- `T2` / `same-pace-move` should require exact carried values.
- attempts should be exactly zero in the new class at segment start unless resume mode explicitly justifies otherwise.

Without these assertions, a stale class doc, wrong list focus, missed reconciliation, or unexpected carry can become part of the oracle rather than invalidating the run.

### PH-4 — Progress-preservation assertion only checks TWI, not CSD

Severity: medium.

The design says prior-list preservation is CSD + TWI. The code checks only:

```js
priorDoc.twi === prevSeg.lastTwi
```

Required fix:

- Require both `priorDoc.twi === prevSeg.lastTwi` and `priorDoc.csd === prevSeg.lastCsd`.
- Include classId/listId in the recorded finding.

### PH-5 — Retake setup allows a blank failed attempt to return `results`

Severity: medium.

For retake days:

```js
if (failRes.outcome !== 'retake-gate' && failRes.outcome !== 'results') ...
```

Allowing `results` here weakens the retake oracle. The point of L9 is to prove failed attempts do not anchor and that a deliberate failed attempt forces the retake path.

Required fix:

- Treat `failRes.outcome === 'results'` on the deliberate blank attempt as a failure unless there is a separate explicit assertion that it was a failed result and did not advance.
- Prefer requiring the expected retake gate before re-entering.

### PH-6 — Fatal anomaly set is narrower than the recorder

Severity: medium.

`newAuditPage()` records `console-error`, `page-error`, unexpected dialogs, and `flow-gap`-style findings, but final fatal filtering only includes:

```js
exception, ui-fb-mismatch, progress-preservation, modal-dead, login-failed
```

For this harness, a green result with untriaged console/page/dialog/flow anomalies is not trustworthy.

Required fix:

- Either fail closed on all non-allowlisted findings, or explicitly maintain an allowlist with justification.
- At minimum, `console-error`, `page-error`, unexpected dialogs, and `flow-gap` should not be silently ignored in a PASS.

## Claims checked

1. Split oracle: structurally correct for green vs blocked days, but blocked confirmation is not sound yet.
2. `daysToCapFromHere`: formula is correct if `prev.twi` is already the reconciled carried value. It is not safe until PH-2 is fixed.
3. `reviewExpected = (seg.startCsd + localDay) >= 2`: correct, assuming `seg.startCsd` is asserted against the reconciled baseline.
4. Expected-blocked confirmation: not sound yet; frozen counters alone are insufficient.
5. Transitions: the intended semantics are right, but baseline/reconciliation assertions are missing.
6. Progress preservation: concept is sound, implementation must check CSD as well as TWI.
7. `NOT_YET_HARDENED` guards: mostly sound for non-smoke fleet runs; L15 hard-throws and L10/L11/L12 are blocked outside smoke.
8. Read-only Firebase invariant: acceptable for the current runnable paths. Admin is used for reads; L15’s planned Admin seed is currently guarded by `NOT_YET_HARDENED`, so it cannot silently advance a run.
9. Blank-based partial answers: sound as the deterministic wrong-answer strategy, but the retake path must not accept a blank attempt returning `results` as normal.

## VERDICT

NEEDS_FIXES.
