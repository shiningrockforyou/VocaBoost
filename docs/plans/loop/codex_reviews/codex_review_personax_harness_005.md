# Codex review — PERSONAX_HARNESS round 5

## Verdict

NEEDS_FIXES on the trim proposal as written.

The Korean-answer diagnosis is strong. The trim proposal is not yet safe because it wants to revert B based on evidence collected with B still enabled. The L8 artifact still contains a real focus mismatch, and the run passing with B enabled does not prove it would pass with B removed.

## Rulings

### 1. Korean-answer diagnosis

Accepted as the primary root cause.

Evidence is strong enough:

- wordmaps now use `definitions.ko`,
- `carefulAnswersFrom` prefers `ko`,
- L2 passed twice cleanly,
- L8 passed 6/6 with one focus warning,
- L14 reached and certified the first blocked day,
- the old symptoms align with failed grading/retry cascades.

It is still possible for the AI grader to be nondeterministic, but the English-answer path is no longer a credible harness strategy. Korean answers should remain the default.

### 2. A — blocked-day full-answer fill

KEEP.

This is load-bearing. L14 day 5 confirms the point: the blocked review needs to submit successfully so the completion gate can reject it. Full-answer fill is the right behavior for blocked days because the block is caused by `newWordCount == 0` / no same-day new pass, not by review score.

### 3. B — dashReady class+list enforcement

Do not revert without an A/B test.

The evidence does not support cutting B:

- L8 passed with B enabled.
- The artifact still records `focus "LSR Base Camp" != "LSR Ascent"` before recovery.
- That warning is evidence that focus divergence still exists.
- A successful run with B enabled may be successful because B recovered the divergence.

Required before reverting B:

- Run L8 with B disabled/reverted and Korean answers enabled.
- Require clean `6/6`, exact CSD/TWI, no extra attempts, and no wrong-list/focus warning.
- Ideally repeat at least twice because the prior symptom was intermittent.

Until that A/B result exists, keep B.

Related cleanup: if B remains, a pre-recovery `selectList` focus mismatch should not automatically create a cert-blocking `PASS-WITH-WARNINGS` when `dashReady` later establishes the correct context and all day oracles pass. Record it as `info` / recovered-context, or warn only if final enforced context is still wrong.

### 4. C — wait-for-Continue + pollAdvanced

KEEP for now, but describe it as fail-closed verification, not proven self-healing.

- Waiting for Continue is clearly correct and low-risk.
- `pollAdvanced` is useful because CSD/TWI finalization is the actual postcondition.
- If `finalization-miss` occurs after an attempt already persisted, retrying may create an extra attempt and fail later. That is acceptable because it fails closed, but it is not proven self-healing.

Recommendation:

- Keep `waitVisibleTimed` for Continue.
- Keep `pollAdvanced`.
- If finalization-miss recurs, prefer a recovery path that tries to finalize the existing result/session before re-driving the test.

### 5. D — mostly-blank guard

KEEP as thin insurance unless it causes observed false negatives.

The English-answer root cause means D was not the main fix. But the guard is still low-cost and protects a real class of harness failure: submitting under-populated rows if word spans lag behind inputs.

Because intentional blank submissions are still allowed when `nCorrect === 0`, D does not break L9’s deliberate-fail path. Keep it through the next smoke/fleet phase; cut later only if it produces noise.

### 6. L14 day 6

Do not label it as the product stuck-state yet.

The product-edge hypothesis is plausible: full-freeze can remain stuck because blocked completion does not append a successful recent session, so intervention may remain `1.0`.

But the observed day-6 failure is a Submit-timeout. That is not yet proof of the product edge. The expected product edge would be: review submits, completion gate blocks again, CSD/TWI stay frozen. A Submit timeout could still be harness/UI state, disabled button, overlay, under-populated rows, or stale session state.

Data needed to classify day 6:

- screenshot at timeout,
- active URL/route,
- whether Submit is disabled or covered,
- row count and populated answer count,
- current session config (`newWordCount`, review segment length if available),
- attempts delta,
- system logs,
- class_progress `recentSessions` / intervention inputs.

Until then: record L14 day 6 as `NEEDS_INVESTIGATION`, not as confirmed product bug.

## Direct answers

1. Korean diagnosis: strong enough to accept as the primary root cause.
2. Reverting B: not safe without A/B. Keep B or run L8 with B disabled.
3. C/D: keep both for now. C is postcondition verification; D is cheap guardrail.
4. L14 day 6: plausible product stuck-state, not proven. Need targeted evidence.

## VERDICT

NEEDS_FIXES.

Fix the trim decision: keep B unless an A/B-disabled run proves it unnecessary, keep A/C/D for now, and downgrade recovered focus mismatches so successful recovered days do not remain `PASS-WITH-WARNINGS`.
