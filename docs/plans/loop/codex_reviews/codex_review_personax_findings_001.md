# Codex review — PERSONAX_FINDINGS round 1

## Verdict

GO, with triage dispositions below.

The findings doc is directionally correct and backed by the certified `fleet3` artifacts. The main adjustment is classification: only F4 should become a first-priority new investigation. F1 should be folded into existing grading/save reliability work, F2 should update planning assumptions around #6, and F3 confirms the cycling/list-end problem rather than adding a separate product bug.

## Per-finding disposition

### F1 — grading/save transients

Disposition: known reliability area; fold into existing NEED_TO_FIX / CS-matrix items, do not open as a brand-new root-cause bug.

Evidence supports a real reliability signal:

- ~3 recovered transients across ~220 test-days.
- Examples include `gradeTypedTest` internal retry and “Couldn't Save Your Results” / retry-save behavior.
- Fleet still clean-passed because retries/recovery worked and final UI + Firebase oracles matched.

This is not benign noise: it is student-visible latency/flakiness and should be recorded with the observed rate. But it belongs under the existing grading/save reliability bucket, not as a separate architectural finding unless the rate rises or recovery fails.

Recommended action:

- Add the fleet rate and examples to the existing grading/save reliability item.
- Track it as a baseline: ~1.4% recovered transient rate in this audit.
- Escalate to standalone NEED_TO_FIX only if a future run shows persistent save failure, unrecovered grading failure, data loss, or materially higher rate.

### F2 — same-pace class move carries progress under `LIST_SCOPED_RECON`

Disposition: high-value planning correction; update #6/foundation/cycling assumptions.

The L16 artifact is clear:

- same list
- same pace
- new class
- `before csd=4/twi=320`
- after reconciliation `csd=4/twi=320`
- `carried=true`

So the classic “class change resets progress” issue does not reproduce for this same-list/same-pace reconciliation path under current flags.

This should narrow the #6 scope. It does not prove every class-change scenario is fixed:

- different pace transitions are separate;
- second-list focus issues are separate;
- list-end / cap cycling remains separate;
- durable list-owned progress is still broader than class-keyed lazy reconciliation.

Recommended action:

- Update the foundation/cycling plan so it no longer treats same-list/same-pace move reset as an open blocker under current `LIST_SCOPED_RECON`.
- Keep #6 open only for untested/narrower cases: different pace, list switch/focus, flag-off, stale/non-reconciled views, or paths that do not trigger reconciliation.

### F3 — list-end dead-end confirmed; orphan-log expectation appears stale/narrow

Disposition: confirms the cycling capstone need; do not treat as a separate new bug unless the cycling plan does not already cover it.

The audit confirms the product behavior:

- L13 post-cap phantom blocks.
- L14 full-freeze blocks.
- CSD/TWI stay frozen.
- Block signature is affirmative through UI/retake-gate.

That is exactly the list-end dead-end that per-student cycling is meant to resolve.

The missing `orphaned_attempt_flagged` log should not be treated as a failed block proof. In current code, orphan cleanup/logging is tied to reconciliation cleanup of review attempts beyond an anchor day (`review.studyDay > anchorDay`) and is log-only under `LIST_SCOPED_RECON`. The L13/L14 blocked paths are same-day completion-gate blocks; they do not necessarily satisfy the cleanup predicate or persist an orphan in the shape that cleanup scans.

Recommended action:

- Keep UI/retake-gate + frozen CSD/TWI as the primary proof for this blocked state.
- Mark the `orphaned_attempt_flagged` expectation as stale or too narrow for this scenario.
- If orphan observability is still desired, add a separate explicit log at the completion-gate rejection point rather than relying on reconciliation cleanup.

### F4 — full-freeze may be permanent stuck state

Disposition: top escalation; open a targeted NEED_TO_FIX investigation.

This is the strongest finding.

Code and evidence support the concern:

- `calculateInterventionLevel` uses the last three non-null review scores from `recentSessions`.
- `recentSessions` is appended in `recordSessionCompletion`.
- The full-freeze state produces `newWordCount=0`.
- Day-2+ completion then blocks because there is no same-day passed new-word attempt.
- A blocked day does not complete, so it likely does not append an improving `recentSessions` entry.
- Therefore the student may be unable to generate the high review scores needed to reduce intervention.

The fleet did not prove permanence; it proved persistence through d5-d8. That is enough to make this a high-priority candidate, not yet enough to claim confirmed permanent stuck.

Recommended next test:

- Build a focused recovery probe from an L14-like frozen state.
- Drive the blocked review with high/correct answers.
- Verify:
  - whether a review attempt is written;
  - whether `recentSessions` changes;
  - whether `interventionLevel` changes;
  - whether the next session ever gets `newWordCount > 0`;
  - whether CSD/TWI can advance without manual/admin intervention.

Expected result if the bug is real:

- high blocked reviews do not affect `recentSessions`;
- intervention remains pinned at `1.0`;
- every subsequent day remains review-only / retake-gate / CSD frozen.

If confirmed, this is a product bug. A likely fix direction is to avoid allowing intervention to reduce new-word allocation to exactly zero on a day that still requires a same-day new pass, or to provide a separate recovery path that records enough review improvement to lower intervention without requiring completion.

## Escalation order

1. F4 — investigate first. It is a plausible permanent stuck state.
2. F3 — keep as cycling capstone confirmation; update logging expectations.
3. F2 — update #6/foundation/cycling planning assumptions.
4. F1 — fold into grading/save reliability tracking with the fleet rate.

## Scope caveat

The findings are based on the certified 12 implemented personas only:

- L1-L9 except L10
- L13
- L14
- L16

The following remain unaudited in this cert and should not be inferred from these results:

- L10 cross-class #9 threshold/partial-day case
- L11 second-list focus footgun
- L12 dynamic throttle
- L15 seeded bad-anchor

## VERDICT

GO
