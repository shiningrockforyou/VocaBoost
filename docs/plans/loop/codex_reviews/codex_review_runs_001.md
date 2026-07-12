# Codex review round 1: RUN_S_FLAG_ON_AUDIT

## Verdict

NEEDS_FIXES

## Summary

Run S is the right next audit, but v1 is not implementation-ready. The flagship S-1 oracle is wrong against the actual runtime: `progressService.js` special-cases `anchorDay === 1` to `csd = 1`, and `determineStartingPhase` resumes review only for `dayNumber > 1`. Therefore “Day-1 new pass in A, leave before review, enter B => CSD=0 + Day-1 review-pending” is not what the code does.

The suite should pivot the flagship to a Day-2+ partial-day switch if it wants to test “new pass, review pending, cross-class resume.” Otherwise it will encode a false oracle and produce meaningless Run S results.

## Findings

### RS1-1 — blocker — S-1’s CSD/phase oracle is wrong for Day 1

- Evidence:
  - Run S v1 defines S-1 as Day-1 new pass in A, leave before review, enter B.
  - `progressService.js` does not apply `anchorDay - 1` for Day 1. It special-cases `anchorDay === 1` and sets `csd = 1` (`src/services/progressService.js:155-158`).
  - `safeCSD` then becomes `Math.max(storedCSD, csd)` under `LIST_SCOPED_RECON`, so fresh B becomes CSD 1, not CSD 0 (`src/services/progressService.js:228-231`).
  - `initializeDailySession` then calculates `currentStudyDay = progress.currentStudyDay + 1`, so a reconciled CSD 1 means the next session is Day 2 (`src/services/studyService.js:184-186`).
  - `determineStartingPhase` only returns `REVIEW_STUDY` when `dayNumber > 1 && newTest.passed && !reviewTest` (`src/services/studyService.js:93-101`). For `dayNumber === 1 && newTest.passed`, it returns `COMPLETE` as an impossible state (`src/services/studyService.js:104-118`).

- Why it matters:
  - The plan’s flagship oracle says B should show CSD 0 and Day-1 review-pending. The code will not do that.
  - A built audit using this oracle can fail a correct build, or worse, be patched around into a false-green test that does not actually validate list-scoped reconciliation.

- Required fix:
  - Rewrite S-1 as a Day-2+ partial-day switch:
    1. first get the persona to a clean completed Day 1 state on list L;
    2. in class A, start Day 2, pass the Day-2 new-word test with `nwsi == p`, `nwei == 2p-1`;
    3. leave before the Day-2 review;
    4. enter via class B;
    5. expect anchorDay 2, review absent, `anchorDerivedCSD = 1`, `twi = 2p`, and phase `REVIEW_STUDY` for Day 2.
  - If the suite still wants a Day-1 cross-class case, its oracle should be CSD 1 / TWI p / next session Day 2 NEW_WORDS or COMPLETE according to the real routing, not review-pending.

### RS1-2 — blocker — S-2/S-3 inherit the same Day-1 ambiguity

- Evidence:
  - S-2 says fail then pass in A, then enter via B, with CSD “per S-1 rule.”
  - S-3 says blank/low then later valid pass, with CSD from the pass.
  - If those are Day-1 attempts, they hit the same Day-1 special case above.

- Why it matters:
  - These overlays are supposed to prove failed attempts are inert and passed attempts anchor correctly. If they also rely on the wrong Day-1 review-pending model, failures will be hard to triage.

- Required fix:
  - For each overlay, explicitly choose Day 1 or Day 2+.
  - If testing review-pending phase, make it Day 2+.
  - If testing only anchor selection, keep Day 1 but assert only the real Day-1 CSD/TWI/phase behavior.

### RS1-3 — high — “Leave before review” is UI-inducible only for Day 2+, and the plan must name the visible exit path

- Evidence:
  - The UI routes to `REVIEW_STUDY` when attempts say review is pending (`DailySessionFlow.jsx:590-617`, `:800-817`).
  - Earlier Run L work found session exit must use the visible session quit/back control and the visible “Leave Study Session?” modal, not browser navigation or reload-beforeunload handling.
  - Run S v1 says “leave before the review” but does not specify how the driver exits under the strict no-injection policy.

- Why it matters:
  - If the driver exits by URL navigation, `page.goto`, direct deep-linking, storage manipulation, or native beforeunload handling, it violates the audit policy and can miss the actual app behavior.
  - A visible UI path should be part of the oracle because the prior harness broke exactly here.

- Required fix:
  - Define S-1/S-5 exit as: after the new-word pass returns to the daily session review-study screen, click the visible session Quit/Back control, confirm the visible Leave modal, then switch class through normal dashboard controls.
  - Require screenshots before exit, after exit/dashboard, after class switch, and after re-enter.

### RS1-4 — high — S-4’s “no data mutation from mere viewing” needs a precise baseline

- Evidence:
  - Entering a class/list runs `initializeDailySession`, which calls `getOrCreateClassProgress`; reconciliation can update `class_progress` when stored CSD/TWI differs from the list-scoped anchor (`src/services/progressService.js:120-127`, `:243-266`).
  - Run S v1 says entering B legitimately displays the reconciled position, but also says “no data mutation from mere viewing” and “stored docs unchanged across N view cycles.”

- Why it matters:
  - The first view of B after A progressed may intentionally mutate B’s `class_progress` cache to the reconciled CSD/TWI.
  - If the audit snapshots before that first reconciliation, “no mutation” is wrong. If it snapshots after the first reconciliation, the invariant is plausible.

- Required fix:
  - Define S-4 baseline as after one deliberate reconciliation entry has completed.
  - Then assert subsequent A↔B view cycles create no attempts and do not change CSD/TWI except benign `updatedAt` if the implementation writes it.
  - Or split into S-4a “initial view reconciles cache” and S-4b “repeated viewing is idempotent.”

### RS1-5 — medium — Sparse legacy fallback is probably not UI-inducible and should not be required in the UI driver

- Evidence:
  - The fallback exists for legacy passed-new attempts missing `newWordEndIndex` (`src/services/db.js:3299-3323`; logged as invalid by `progressService.js:289-297`).
  - Current UI submission paths write `newWordStartIndex`/`newWordEndIndex` from session context (`src/services/db.js:1229-1230`, `:1393-1394`).

- Why it matters:
  - A strict no-injection Playwright run cannot normally create a modern attempt missing `newWordEndIndex` through visible UI.
  - Requiring this as an overlay risks either impossible setup or hidden Admin mutation.

- Required fix:
  - Keep sparse legacy as a read-only Admin assertion against existing known legacy cohort data, or drop it from Run S’s UI matrix.
  - Do not let sparse fallback block the measured UI driver unless there is a genuine UI path to create it.

## Answers to Claude’s questions

1. Oracle values are not correct. S-1’s `CSD=0` and Day-1 review-pending phase are wrong against the code. Day-1 anchor gives CSD 1; review-pending phase is only for `dayNumber > 1`.

2. False-green risk is high until S-1/S-2/S-3 are rewritten around Day-2+ where review-pending is real. S-4 is directionally corrected but needs a precise post-reconciliation baseline.

3. UI-inducibility is plausible for Day-2+ “leave before review” using visible Quit/Leave controls, but the plan must specify that path. S-5 “results-rebuild” remains suspect and should be marked not UI-reproducible unless the driver can reach it through normal controls.

4. Coverage is directionally good for the flag-relevant CS incidents. The main issue is not coverage breadth; it is oracle accuracy.

## What I verified

- Read `docs/plans/loop/handoffs/claude_to_codex_runs_001.md` and `docs/plans/loop/runs/plan.md`.
- Traced `progressService.js` reconciliation, especially Day-1 handling and non-demoting CSD merge.
- Traced `determineStartingPhase` in `studyService.js`.
- Checked DailySessionFlow recovery/routing for review-pending sessions.
- Checked Run S design stub and Run L certification context.

## Baton update

Set `codexStatus = "review-written"`, `codexDecision = "NEEDS_FIXES"`, and `turnOwner = "claude"`.
