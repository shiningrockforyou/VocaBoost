# WSL → Codex round 41: PROGRAM REVIEW — DEEPFIX 2 (consolidated: deepfix remainder + unified container + free-nav mode + UX/messaging)

David-directed 2026-07-25: free-nav (pass-to-advance **DECIDED YES**) + the unified session container + the UX/status-messaging
layer are to be implemented TOGETHER and reconciled with the remaining deepfix program into ONE task list — **DEEPFIX 2**.
You are 1 of 6 in the convergence panel (3 Fable + 2 Opus + you; WSL synthesizes). The 5 internal agents run lenses:
completeness, sequencing, reconciliation-fidelity, live-cohort risk, product/scope. **Your lens: architecture + sequencing,
with authority on everything you previously gated** (r36/r37 review-pass, r39 tokens, r40 unified-state, the freenav hard gate).

## READ (in order)
1. `docs/plans/deepfix2/00_ORIENTATION.md` — goals, pickup point, governing decisions, constraints, convergence protocol
2. `docs/plans/deepfix2/02_TASK_LIST.md` — the consolidated waves W0-W6 + parallel tracks + §3 reconciliation table + open decisions
3. `docs/plans/deepfix2/01_SOURCES.md` — the source inventory (governing ★ docs)
4. Refresh as needed: `docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md` §10-§12 (mode seam, ship-together, messaging register),
   `docs/design/UNIFIED_SESSION_STATE_MAP.md` (3×-Fable-audited ground truth incl. §11 redundancy + §16 audit log),
   `docs/design/FREE_NAVIGATION_MODEL.md` (the 07-24 banner + CONSISTENCY section + pass-to-advance closure),
   `docs/plans/MASTER_TASK_LIST.md` (deepfix1 record — D4-D9 gates that must travel intact).

## PRESSURE-TEST (priority order)
1. **Sequencing correctness.** (a) DF2-10 (review-pass gate) as Wave 1 = the FIRST functions pin-move off `0ddbb34` — is the
   task list's gate set for that deploy sufficient (clean tree, re-cert, David auth), and is G6 ordering (gate BEFORE
   extraction) preserved everywhere? (b) Waves 2-3 (client-only container) intentionally run BEFORE Wave 4 (canonical/P5) —
   §8/§9 said the CLIENT increments don't need canonical; confirm nothing in W3 (esp. DF2-33 Dashboard unification and
   DF2-31 exit channel) secretly depends on single-writer canonical or on a functions change. (c) Wave-4 internal order
   (census → migration → scheduler → frontier-writes → rules) — right? (d) Anything that should be EARLIER (e.g., G-QUAR
   screen before P5 is noted — sufficient?).
2. **Reconciliation fidelity.** §3 table: every remaining deepfix1 item dispositioned correctly? Gates that must travel
   (D4's pre-work list, D5's four hard gates, D8's R3-last ordering, M4 clock) — anything dropped or weakened? Is absorbing
   E1/E2/E3 into the container waves right, or does any deserve independent life?
3. **The ship-together model** (§12.1, orientation §1.5): one client train, staged activation, byte-identity falsifier.
   Sound? Any hidden coupling that breaks "container works alone"?
4. **Free-nav build shape** (W4-W5): pass-to-advance=YES via the ONE consolidated G-PASS (incl. authoritative `passed:true`
   short-circuit) — is DF2-43's server-owned frontier surface correctly scoped (mini-P4)? Does the rules plan (DF2-44 a/b
   lineage) respect your r-gate caveats (never P10d, R3 last, new artifact for coexistence)?
5. **Gaps.** What's MISSING from the program entirely? (You know this codebase's traps.)

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r41.md` — verdict per section (SOUND / SOUND-WITH-GAPS / UNSOUND + specifics),
then set baton: `turnOwner=claude`, `round=41`, `codexStatus=review-written`, `codexDecision=DONE`, `updatedBy=codex`,
`revision=155`, `codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_deepfix2_r41.md`.
