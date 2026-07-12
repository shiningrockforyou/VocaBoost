# Run S-Long DESIGN — CONVERGED (GO)

**Final design:** `docs/plans/loop/runslong/plan.md` (v4). **Verdict:** Codex `GO` (round 3,
`codex_reviews/codex_review_runslong_003.md`) + the initial 3-agent audit + Claude verification agree.
**This is a DESIGN GO, not product certification** — implementation + a live run against the deployed build
still required.

## Loop summary
- **Initial 3-agent audit** (correctness / anti-false-green / UI-feasibility): 12 findings — false-green traps
  (reassignment-never-asserts-fresh-B, self-healing masks resets, threshold is a client bug, no bound
  manifest), the Phase-1-only deployed reality, and UI-feasibility blockers (Admin-boundary, manual-pass,
  rebuild dead-end). Correctness pass VERIFIED the underlying #6/#9 fixes are correct against code.
- **2 owner rulings** (David): read-only Firebase reads allowed per-day (not substituting UI checks; never
  written to advance a run); rebuild screen diagnosed in Phase 1.
- **Codex** (after a caught misroute where it reviewed FIX_9 code instead): r1 NEEDS_FIXES (RSL-1 blocker per-day
  oracle + RSL-2/3 high + RSL-4) → r2 NEEDS_FIXES (RSL-5 high persona-8 band + RSL-6 med verdict state) →
  r3 GO.

## The converged design (implementation-ready, Phase-1 first)
- **Phase 1 — the day-primitive** (bulletproof `advanceOneDay` + rebuild diagnosis + fail-closed per-day
  confirmation); exit gate = one student, 16 consecutive confirmed-persisted days + a written rebuild
  diagnosis. Phase-1 green certifies the PRIMITIVE only.
- **Phase 2 — personas** (12 CS-grounded + 8b); **Phase 3 — reassignments + N-student fleet.**
- **Oracles:** UI-primary + Firebase read-only corroboration; per-persona CHECKPOINT sequences (not single
  deltas); active-doc + drive-load-then-read convergence (Phase-1 lazy-recon reality); fresh-B precondition;
  bound persona×day manifest; 6 distinct verdict states (PASS/EXPECTED-RED/UNEXPECTED-RED/BLOCKED/UNRUN/INVALID).
- **#9-dependent personas GATED** on deployed Fix #9 + Run S S-1/S-3 passing (else BLOCKED).

## Implementation note (Codex GO)
Persona-8b (full-freeze) must be its own manifest entry + verdict row, not an implicit subcase of persona-8.

## Sequencing reality
Run S S-1/S-3 is currently blocked by the live-UI "rebuild" flakiness. **Phase 1 of this plan (the day-primitive
+ rebuild diagnosis) is the shared foundation that also unblocks S-1/S-3** — so building it first serves both.

## NEXT (owner)
This is a plan GO. **No harness code until David's explicit implementation go-ahead** (standing rule).
On go-ahead: implement Phase 1 (day-primitive) first; nothing scales until it's green.
