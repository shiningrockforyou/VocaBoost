# WSL-Claude → Codex round 8: CONSOLIDATED_ROADMAP_SEQ_GATE

## Objective
Adversarially review the **deploy SEQUENCING** of the consolidated roadmap that folds the CS-2026-07-17 fixes (PR-1/2/3)
into the **already-deployed** deepfix program, grounded in the LIVE deploy state. "Ready" = the sequencing + gate ladder is
coherent and safe to execute in order, or you name the ordering that breaks. This is a **plan/sequencing review, not a code
review** — the PR diffs don't exist yet (they get their own Codex round when built).

## Context / baseline (verified live this session — a prior plan had this WRONG)
- **Client `4b8452a` LIVE** (prod bundle stamp `shortSha:"4b8452a",dirty:false`); **deepfix FUNCTIONS deployed-DORMANT**
  (prod `completeSession` → `FAILED_PRECONDITION: SERVER_COMPLETE_SESSION_ENABLED=false`, a deepfix-only string). **Rules
  pre-deepfix.** All 11 `FOUNDATION_FLAGS` false; **`ANCHOR_VALIDATION_SHADOW=false` ⇒ M4 shadow clock UNSTARTED.** P0/P1/P2
  live-behavioral; P3–P10 dormant. (An earlier consolidation ran on a FALSE "undeployed / prod=14e49a4" premise — corrected;
  root cause: stale RESUME + a compaction dropped the 07-15 deploy fact + a git-log misread became a "verified baseline".)
- **FREENAV gate (your round 7, SOUND-WITH-CAVEATS) CLOSED by David as COEXISTENCE:** forced stays default (binary throttle),
  free-nav = a future per-class option built on the cutover base. Recorded in `docs/design/FREE_NAVIGATION_MODEL.md` (bottom).

## Changed/relevant files
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md` — the reconciled roadmap (spine = deepfix DEPLOY_ORDER + CS PRs).
- `docs/plans/SESSION_TODO_2026-07-17.md` — the same as an ordered task list (the concrete artifact; 3-Fable converged).
- `docs/design/FREE_NAVIGATION_MODEL.md` — the closed gate (coexistence section at bottom).

## Evidence / reference
- `docs/plans/CS_2026-07-17_ROOT_CAUSE_EFFORT.md` — PR-1/2/3 definitions + the locked pairing census (13/14 + 0 false-pairs).
- `audit/deepfix/task3/DEPLOY_ORDER.md` — the authoritative deepfix deploy sequence + preconditions + one-way doors.
- `audit/deepfix/task7/TASK7_FINAL_REPORT.md` — deepfix status.

## Claims (what I believe is now true)
- The big "consolidation" IS the staged deepfix P3–P10; the roadmap **deploys/sequences** it, it does not re-derive it.
- CS **PR-2's foundation mirrors** (OC-1 `review_recorded`/hold-shape, OC-2 V2 pairing, OC-3 engagement+grandfather into
  `foundation.js:615/638`, OC-4 the ABSENT server lap-reset) fold into the **P3 `--only functions` redeploy** and MUST be live
  **before the P4 flip**, else the cutover reverts hold-csd / re-mints I4.
- CS **PR-3 (binary throttle) must flip AFTER PR-1 pairing is live**, else it frees students into new-word days under the old
  predicate and re-mints stuck-pairing victims.
- The **server-authority infra (P3–P5) is direction-independent** (free-nav needs it too); only the policy layer forks.
- **PR-1/PR-2 are LIST_SCOPED_RECON / foundation-adjacent** → their DIFFS should route through this Codex gate before deploy
  (planned as a later round; per David's standing "LIST_SCOPED_RECON-adjacent fixes route through Codex").

## Verification performed
- 4 Fable agents (RC-1..4) + orchestrator prod probes established the live deploy map (client stamp, functions probe, flag reads).
- 3 Fable agents (TL-A/B/C) converged the task list; 5 real fixes folded (Task-6 over-claim, invented PR-1 gate, C2 precedence,
  D6/P8 false chain, D9 missing `legacy_write_denied` gate) + 2 critical (deploy legs marked David-owned; D5/P6's 4 hard gates restored).
- **A1** (M-STATIC flag-table) refreshed + **verified**: `node audit/playwright/lsr_deepfix_static.mjs --target=baseline` →
  **CLEAN 36/0/0** (fixed the stale GRADE_TOKEN_MINT row + added the 9 missing flags → full 17-server+10-client surface).
- Re-ran the pairing census (14 stuck, 13/14 drain, 0 false-pairs) and the ratchet-demotion census (naive rebuild demotes ~5
  active 26SM under V2 — the non-demoting ratchet must stay) myself.

## Questions for Codex (pressure-test these)
1. **Sequencing:** is the interleave of CS PR-1/2/3 into the deepfix DEPLOY_ORDER sound? Any ordering that violates a
   DEPLOY_ORDER precondition, an OC-1..7 constraint, or a NEED_TO_FIX invariant (#9/#10/#11/#16, non-demoting csd, cycling lap-reset)?
2. **Gate ladder:** is "PR-2 folds into the P3 functions redeploy → PR-3 flips before P4 → PR-1 (+census) before P5" the correct
   minimal-risk order? Any false-green / fail-open in the gate ladder — especially D5/P6's four hard gates + the ≥14-day M4 clock?
3. **Codex-before-ship:** is routing PR-1/PR-2 diffs through this gate before deploy the right call (they touch the pairing
   predicate + the deepfix-converged `foundation.js`)? Anything about the PLANS themselves that's unsafe to build?
4. **FREENAV closure:** does the COEXISTENCE close (forced default + free-nav as a future per-class MODE, not a migration) hold
   given your prior SOUND-WITH-CAVEATS, or does the per-class-mode framing introduce a trap?
5. Anything the drift-correction + the 3-Fable convergence missed?

## Known limitations / deferred scope
- PR-1/2/3 code diffs don't exist yet (this reviews the PLAN/sequencing).
- Task-6 acceptance residue (flag-ON M-UI pass, single-runId cert, your Task-6 end-gate, the BLOCKED prod-smoke STEP1) is separate
  and still open — roadmap D1.

## Requested decision
**GO** (sequencing sound, safe to execute in order) / **NEEDS_FIXES** (name the ordering/gate to change) / **DISAGREE**.
Write → `docs/plans/loop/codex_reviews/codex_review_008.md`. Flip baton → claude, round 8, `codexDecision=<verdict>`,
`updatedBy="codex"`, `revision=87`.
