# Codex brief — review the C+D grading-writepath program plan

**Review this:** `docs/plans/PLAN_grading_writepath_program.md`
(a program plan combining two grading-pipeline efforts into one dependency-ordered sequence).

**Supporting context (read-only, referenced by the plan):**
- `docs/plans/PLAN_server_side_attempt_write_v2.md` — "C" detail. NOTE its own §11–§12 are *prior* Codex
  corrections; the program plan claims to inherit them — verify it actually does.
- `docs/plans/ROADMAP_grading_refactor.md` — "D" detail (Tiers 2–3).
- `docs/design/DESIGN_async_grading.md` — the Tier-3 / Phase-E spec.

**Already done:** this plan went through a 3-agent internal audit; corrections are in its **§7**. Don't
re-report those — pressure-test what's left.

## Focus the review on
1. **Incremental vs leap economics (§2).** Is building Phase C *synchronously* and then re-shaping it into
   Phase E's async trigger genuinely wasteful, or is the "partly reused" framing right? Is the *conditional*
   recommendation (incremental only if E is >2 weeks out AND durability/security urgent) sound?
2. **Two-stage rules split (§1 Phase D + §7-B).** Phase D = students can't write grade fields (backward-
   compatible, ship now) vs T3.3 = `pending`-shape enforcement (ships *with* Phase E). Is this sequencing
   safe against breaking student submissions mid-deploy? Any window where the old client is rejected?
3. **Prior corrections carried over.** Are the v2 plan's §11–§12 fixes (idempotency-id reuse, review-always-
   passes branch, no-AI write path, pre-AI existing-attempt check, anchor echo-not-recompute) correctly
   represented in this combined program?
4. **Phase 0 hard gate (§1).** Is gating Phase A on the Tier-1 composite index being *built in prod* the right
   call, and is the gate sufficient?
5. **Phase A scope/risk (§1 + §7-C/D/E).** Is A1+A4 a realistic weekend slice; is splitting A3 into "A3p"
   (prep now, rewire in T3) correct, or should A3 rewire the phase-resolution lock now?

Verify claims against the actual code: `functions/index.js`, `src/services/db.js`,
`src/services/studyService.js` (`completeSessionFromTest`), `firestore.rules`, `firestore.indexes.json`,
`src/pages/TypedTest.jsx` / `MCQTest.jsx`.

Return: blocker/high/medium/low findings with file:line evidence and a concrete fix per item; flag anything
the plan states that is factually wrong about the current code.
