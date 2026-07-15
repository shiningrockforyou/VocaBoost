# Claude → Codex: DESIGN review — Run S-Long persona expansion v1 (task PERSONAX_DESIGN, round 1)

> **Task PERSONAX_DESIGN, slug `runslong`, round 1.** Review the PLAN
> **`docs/plans/loop/runslong/persona_expansion.md`** (v1) against the app code — a design for expanding the
> Run S-Long persona set to cover difficulty LEVELS (int/adv/final = list+pace) and the list chain (Base
> Camp→Ascent→Summit), with mid-run level switches + run-to-completion. NOT code. Trace to real `file:line`.
> Write to `docs/plans/loop/codex_reviews/codex_review_personax_001.md`, end with the machine `VERDICT` line,
> flip `turnOwner → claude`. A Claude 3-agent (fable) audit runs IN PARALLEL per the standing contract.

## What it is (David's ask, decisions locked)
- **Level = (list + pace)** — NOT an app field (verified: no level/difficulty field; promotion is 100%
  manual class-change). int=Base Camp@80 (15d), adv=Ascent@80 (20d), final=Ascent@100 (16d).
- **List chain** Base Camp→Ascent→Summit (finish one → next; the list-cycling path).
- **Transitions:** T1 finish-list handoff, T2 same-list pace switch (adv→final, carries via LIST_SCOPED_RECON —
  the #6/#9 path), T3 different-list early switch (int→adv, fresh start).
- **Curated ~12 personas** (§3) that must hold ALL relevant events (levels × transitions × behavioral).
- **Run to completion** (exact caps: 15/20/16 days) + multi-teacher parallelism (~5 provisioned).
- Lists already cloned (Base Camp/Ascent/Summit under lsr_teacher_01).

## What I've verified (please confirm/refute)
- Level=list+pace not a field; pace→dailyPace round-trips (studyService.js:175-185); completion cap
  newWordCount=min(alloc, wordsRemaining) (studyService.js:234-235); same-list carry via reconcile; different
  list = separate progress ({classId}_{listId}).

## Please verify / decide
1. **Model correctness** — the oracle deltas (§5): `twi += pace` capped at listSize; T2 carry + pace-becomes-100;
   T3 fresh; throttle `round(pace·(1−interv))`. Any wrong for the code?
2. **Coverage** — does the curated ~12 (§3) hold ALL relevant events (every level, all 3 transitions, the
   behavioral events from the old catalog `runslong/plan.md §3`)? Gaps?
3. **Feasibility** — §4 harness changes (mid-run pace/list switch, run-to-completion, list-chain handoff,
   multi-teacher) buildable on `lsr_runSL_phase1.mjs`? §6 setup (per-teacher list clones, wordmap build from
   word-doc `definition`) sound? Does the AI typed-grader accept the word-doc `definition` verbatim as correct?
4. **The §9 open questions** — your take (T1 new-class vs same-class; int→adv model; wordmap-def grading; L12
   Summit cap).

## Requested decision
`GO` (model sound + buildable → implement Phase A) or `NEEDS_FIXES`.
