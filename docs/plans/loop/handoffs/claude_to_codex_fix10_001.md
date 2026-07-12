# Claude → Codex: DESIGN review — Fix #10 v1 (flag-ON pre-completion reconciliation self-race)

> **⚠ TASK ROUTING — READ FIRST.** This baton is task **FIX10_DESIGN**, slug `fix10`, round 1.
> Review the PLAN document **`docs/plans/loop/fix10/plan.md`** (v1) — a code-FIX design, **not** code
> (no `src/` file has been changed; per the standing rule nothing will be until you sign off AND David
> gives the go-ahead). Trace every claim to real `file:line` under the repo. Write your review to
> **`docs/plans/loop/codex_reviews/codex_review_fix10_001.md`**, end with the machine `VERDICT` line, then
> flip `turnOwner → claude`. A Claude 3-agent audit (fable) is running IN PARALLEL per the standing contract.

## Objective
Review the fix design for **NEED_TO_FIX #10** — the self-race you root-caused during the Run S-Long smoke,
which I then code-verified. Decision: `GO` (design sound + safe → implement) or `NEEDS_FIXES`.

## The bug (recap, for grounding)
Flag-ON (`LIST_SCOPED_RECON`). On a **session-final** test completion the code, in order:
1. writes the passed attempt — `TypedTest.jsx:919` (`MCQTest.jsx` parallel ~:717);
2. takes a "snapshot BEFORE completion" via `getOrCreateClassProgress` — `TypedTest.jsx:979`. Under the flag
   this **reconciles from the just-written attempt and WRITES the advanced `currentStudyDay`**
   (`progressService.js:248-271`; on Day 1 CSD 0→1);
3. runs `completeSessionFromTest` — `:1015` → `recordSessionCompletion` → `updateClassProgress`, which now
   sees CSD already advanced → `expectedDay = current.currentStudyDay+1` no longer matches
   `sessionSummary.day` → day-guard rejects (`progressService.js:442-452`) → `dayGuardRejected` → the
   "session refreshed / 세션 정보가 갱신되었습니다" rebuild screen.

## The fix (plan v1)
- **Fix A (primary):** for the pre-completion snapshot, use the non-reconciling `getClassProgress`
  (`progressService.js:498-509`, pure read) instead of `getOrCreateClassProgress`, in BOTH `TypedTest.jsx`
  (~:979) and `MCQTest.jsx` (~:717). The reconcile-WRITE was an unintended side effect of a call meant only
  to CAPTURE state; removing it lets the completion path re-read the un-advanced CSD and complete normally.
- **Fix B (optional defense):** make `updateClassProgress`'s day-guard treat the benign same-day case
  (`sessionSummary.day === current.currentStudyDay`) as already-complete SUCCESS rather than a hard rebuild.

## What I independently verified (please confirm or REFUTE with file:line)
1. **`getClassProgress` is a pure read, no write** — `progressService.js:498-509` (`getDoc` → null if absent,
   else `{id, ...data()}`). ✅ (claim C1)
2. **`updateClassProgress` re-reads progress fresh** — it does its OWN `getDoc(progressRef)` at
   `progressService.js:438` and computes `current.currentStudyDay + 1` (:466); it does NOT consume any passed
   snapshot. So the completion path does not depend on the snapshot's reconciled values. ✅ (claim C2 — this
   is what makes Fix A sufficient.)
3. **`updateClassProgress` self-creates the doc if missing** — `setDoc(...)` at :480-486 when
   `!snapshot.exists()`. So a null snapshot at the Fix-A read site is safe; completion still creates+writes.
   ✅ (claim C3 — implies the plan's create-if-missing fallback is likely unnecessary.)

## Two refinements I already lean toward (please adjudicate — I'll fold accepted ones into v2)
- **R1 — flag-GATE the swap.** With the flag OFF, `getOrCreateClassProgress` still reconciles TWI
  bidirectionally (`progressService.js:233-236`, `safeTWI`), so an UNCONDITIONAL swap to `getClassProgress`
  would subtly change flag-off timing → breaks Run L byte-equivalence. Safer form:
  `LIST_SCOPED_RECON ? getClassProgress(...) : getOrCreateClassProgress(...)`. Do you agree the swap must be
  flag-gated, or is unconditional actually equivalent?
- **R2 — DROP the create-if-missing fallback.** The plan §3 fallback to `getOrCreateClassProgress` on a null
  read is exactly what would RE-INTRODUCE the race (it reconciles from the just-written attempt). Given claim
  C3 (completion self-creates), a null snapshot should just mean "no prior progress → defaults", not a
  reconciling fallback. Agree?

## Open questions (plan §9)
1. Is the class_progress doc guaranteed present by completion time (created at session init)? If ever absent,
   is the null path safe under Fix A (I claim yes, via C3)?
2. Is **Fix B needed at all** after Fix A, or does a residual reconcile-vs-completion collision remain
   (concurrent device / the challenge path)? If B is kept, does its narrowed guard (`day === currentStudyDay`
   only) ever mask a GENUINE duplicate/replay?
3. Does anything else depend on the snapshot call's reconcile side-effect at that exact point? (grep the
   completion blocks.)

## Requested decision
`GO` (design is correct, safe, flag-off-equivalent, and covers both TypedTest + MCQ → implement) or
`NEEDS_FIXES` (with the blocking items). Nits/medium don't block.
