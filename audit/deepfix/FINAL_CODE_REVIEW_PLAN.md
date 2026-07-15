# Final code review — 2 Fable agents + Codex (end-of-implementation gate)

**Directive (David, 2026-07-14):** at the END of the deepfix implementation — after **P9 converges + P10 done + P7
patch prepared** (full P0–P10 surface complete) — run a **full independent review of ALL implemented code** with
**2 Fable-model agents + Codex**, on top of the per-phase Codex reviews, BEFORE the Task-6 Playwright audit runs.

## Scope — the full implemented deepfix surface
- **Cloud Functions:** `functions/index.js` (P0 disarm, P3 hooks, P6 provisionTeacher), `functions/foundation.js`
  (the whole server surface: completeSession / resolveListProgress / resetProgress / advanceForChallenge /
  review-marker / M4 / lap-aware cycling).
- **Services:** `src/services/db.js`, `src/services/studyService.js`, `src/services/progressService.js`.
- **Pages/UI:** `src/pages/TypedTest.jsx`, `MCQTest.jsx`, `DailySessionFlow.jsx`, `Dashboard.jsx`,
  `ClassDetail.jsx`, `Signup.jsx`, `src/components/**` (SessionSummaryCard etc.), `src/utils/testRecovery.js`,
  `src/utils/buildStamp.js`.
- **Config/rules/data:** `src/config/featureFlags.js`, `firestore.rules`, `firestore.indexes.json`.
- **Migration + CS toolchain:** `scripts/cs/deepfix-migrate-list-progress.mjs` (+ the retargeted sweep/manual-pass).

## Reviewers (3 independent; findings are candidates, not verdicts)
- **Fable A — correctness & data-integrity lens** (full surface): flag-off byte-equivalence per file; the twi/csd
  invariants (monotonic twi, non-demoting csd, anchor identity); reconciliation/migration correctness;
  fail-closed vs fail-open; live-student-stranding paths.
- **Fable B — security & integration lens** (full surface): rules cutoff + authz (role split, attempt lockdown,
  override union); the migration's forgery/quarantine screens; **cross-phase interaction bugs** (the thing the
  per-phase reviews structurally could not see — e.g. P4↔P6↔P9 flag-interaction, P5↔P7 sequencing).
- **Codex** — full adversarial pass via the baton (`DEEPFIX_TASK3_FINAL`), its usual depth.

## Process (H1 — never trust blindly)
1. Spawn the 2 Fable agents in parallel (each returns a structured findings list, most-severe first).
2. Flip the baton to Codex for the whole-surface pass.
3. **Orchestrator verifies EVERY finding against the actual code** before folding — dedupe across the 3 reviewers,
   adjudicate (accept/reject with V-now evidence), fold accepted fixes, re-review the delta until clean.
4. Only then is the implementation cleared for the **Task-6 Playwright audit** (Codex, pre-deploy).

## Status
⏳ **Pending** — blocked on implementation completion. Current gating item: **P9 folding Codex round-1 fixes**;
then P10, then P7 patch. This plan fires once those land. Recorded in memory `final-review-2fable-codex`.
