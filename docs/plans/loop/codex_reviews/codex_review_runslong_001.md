# Codex review round 1: RUN_S_LONG_DESIGN

## Verdict

NEEDS_FIXES

## Summary

Run S-Long v2 is much stronger than the earlier Run S designs: it correctly scopes itself to deployed Phase-1 behavior, uses UI as the primary evidence, treats Firebase as read-only corroboration, and avoids claiming abandoned class docs must converge before a reconciling load.

But two oracle issues would make the audit false-red or fail to exercise the intended code paths, and one sequencing issue would let the long suite run before the prerequisite flagship fix is behaviorally certified.

## Findings

### RSL-1 — BLOCKER — Persona-2 per-day ΔTWI is wrong/ambiguous for partial-day switch days

The plan says in §3.1:

> REVIEW_STUDY resume day (persona-2): Δtwi=0 (`nwCount=0`).

That is only true for the **review-completion substep** after the new-word anchor already exists. It is not true for the whole driven day when the audit itself does:

1. start from completed Day D-1;
2. pass Day D new words in A;
3. leave before review;
4. enter B;
5. complete the Day D review in B.

In correct Phase-1 behavior, the Day D new pass still creates the anchor and advances TWI to `anchor.newWordEndIndex + 1`. The #9 fix only ensures the subsequent B review completion does **not add the same new-word count again**.

So the expected checkpoints for a partial-day switch must be split:

- start of Day D: `csd=D-1`, `twi=previousTWI`;
- after A Day-D new pass + B reconciling load: `csd=D-1`, `twi=previousTWI + dayNewCount`;
- after B review completion: `csd=D`, `twi=previousTWI + dayNewCount`;
- after re-entering A: A converges to the same `csd=D`, `twi=previousTWI + dayNewCount`.

If the per-day oracle expects ΔTWI=0 from start-to-final, a correct build will false-red. If it skips the intermediate checkpoint, a broken build can still hide the #9 double-add until an end-state comparison.

Required fix:

- Define per-day oracle as checkpoint-based, not one ambiguous delta.
- For persona-2/#9 days, assert both:
  - anchor step adds the day’s new-count exactly once;
  - review completion adds zero additional TWI.

### RSL-2 — HIGH — Intervention persona must drive low review scores, not just “low-pass” new-word scores

Persona 8 says:

> deliberately low-pass to accrue intervention.

But `calculateInterventionLevel` uses the last three non-null `reviewScore` values, not new-word scores:

- `src/utils/studyAlgorithm.js:71-75` filters sessions by `reviewScore`;
- `src/utils/studyAlgorithm.js:77-97` returns intervention only after at least three review scores;
- `calculateDailyAllocation` then uses `Math.round(dailyPace * (1 - interventionLevel))`.

A low-but-passing new-word score alone will not accrue intervention. If the persona only manipulates new-word test results, the expected ΔTWI `< pace` will false-red or the intended intervention path will not be exercised.

Required fix:

- Specify that persona 8 intentionally produces low **review** scores over at least three completed sessions.
- Define the expected intervention for each affected day from the previous recentSessions review-score window.
- The expected new-count must be based on the intervention level computed at session initialization, not the score earned later in that same day.

### RSL-3 — HIGH — Run S-Long must gate #9 personas on deployed Fix #9 + Run S S-1/S-3 passing, or mark them expected-red

The plan says the correctness pass verified the underlying #6/#9 fixes against code, but Run S-Long is a live/deployed UI audit. Code review `GO` is not the same as deployed behavioral certification.

For persona 2 and any other #9-dependent path, the plan needs an explicit precondition:

- Fix #9 code deployed in the tested environment; and
- Run S S-1/S-3 acceptance has passed, or Run S-Long marks those personas as EXPECTED-RED/blocked.

Otherwise the long audit can spend hours driving a known-broken deployed build and produce noisy failures that are not informative, or worse, mix “harness failed” with “product expected-red.”

Required fix:

- Add a preflight gate: live build/provenance confirms the Fix #9 source is deployed, and Run S S-1/S-3 has passed against that build.
- If not met, persona-2/#9-dependent cases are `EXPECTED-RED (blocked on #9 deploy/Run S)`, not ordinary failures and not PASS.

### RSL-4 — MEDIUM — Persona-10 Admin seed is acceptable only as pre-run fixture setup with strict labeling

I do not consider persona-10’s pre-audit Admin manual-pass seed a blocker if it is treated as fixture setup, not as an audit action. The plan is right that manual support intervention is not UI-able today.

But the boundary should be explicit:

- browser closed;
- before runId/activity capture starts, or separately recorded as `fixtureSeed`;
- never used to repair or advance a run after the UI audit begins;
- excluded from “UI drove this day” claims;
- postverify must label persona-10 as “seeded support-state survival,” not “user achieved manual pass through UI.”

This keeps the owner’s “never write to advance a run” line intact.

## What is sound

- Phase-1 deployed reality is correctly stated: progress is still class-keyed and lazy-reconciled.
- Requiring convergence only after entering both classes is the correct Phase-1 oracle.
- Fresh-B precondition is necessary and correctly called out for the day-reset/reassignment path.
- UI-primary plus read-only Firebase corroboration is the right evidence model for this task.
- Bound persona×day manifest is necessary and should remain gating.
- Hard-stopping `rebuild-clear-failed` is correct; it should become a separate bug if app-side.
- Threshold persona correctly treats visible Pass/Fail as the primary evidence; the doc layer alone cannot catch #5.

## Answers to Claude's questions

1. Any remaining oracle that a correct Phase-1 build would false-red, or a broken build would pass?
   Yes. Persona-2 ΔTWI=0 is wrong if interpreted as whole-day delta. Persona-8 can miss intervention entirely if it drives low new-word scores instead of low review scores.

2. Is persona-10 Admin seed acceptable?
   Yes, with strict fixture labeling and only before the audit run starts. It must not be used mid-run to advance or repair a student.

3. Is the per-persona per-day expected-delta model complete?
   Not yet. It needs checkpoint deltas for partial-day switch days and review-score-based intervention deltas.

4. Is fresh-B + drive-load-then-read sufficient for #6/#9 at scale?
   For #6, yes. For #9, yes only after the checkpoint oracle is corrected and the suite is gated on deployed Fix #9 / Run S S-1/S-3.

5. Feasibility gaps beyond the agent audit?
   The main feasibility issue is sequencing: do not scale a 16-day fleet before the day primitive and the flagship Run S S-1/S-3 are green on the deployed build.

## Required v3 changes

1. Replace ambiguous per-day ΔTWI with checkpoint-based expected values for persona-2 partial-switch days.
2. Rewrite persona-8 to drive low review scores and compute intervention from the previous three review scores.
3. Add a live-build/Run-S prerequisite for #9-dependent personas, or mark them expected-red when unmet.
4. Tighten persona-10 seed language to distinguish fixture setup from UI-driven audit progress.
