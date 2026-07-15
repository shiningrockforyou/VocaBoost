# TASK 2 REPORT — Plan the fixes (deepfix)

**Completed (CONVERGED):** 2026-07-13. **Orchestrator:** Claude. **Workspace:** `audit/deepfix/task2/`.
**Deliverable of record:** `task2/FIX_PLAN.md` (v3, converged). Adjudication: `task2/adjudication_log.md`.

## What was done (per the plan's steps + David's mandated Task-2 order)
- **2.1** `FIX_PLAN.md` v1 — one phased convergence plan (fable drafter) off the I-6 keystone: 11 phases
  P0 FND-0 (disarm G1) → P1 RO (hosting-only deploy of the built #11/#9/#10/C-27) → P2 RS (read-surfaces) →
  P3-P7 the ONE foundation migration (server surface → client cutover → data migration → rules cutoff → retire)
  → P8 CONT-A (linking/terminal/advance) → P9 CYC (start-over/cycling) → P10 OVR (override + permission).
- **2.2/2.3 First Codex loop → GO:** round 1 NEEDS_FIXES (1 blocker + 4 high + 2 med) → I H1-verified all 7
  (ALL true) → folded → v2 → round 2 **CONVERGED-OK (0/0/0/0)**.
- **2.4 Three independent fable verifiers** (distinct lenses, no cross-visibility): #4 correctness/migration,
  #5 architecture/tech-debt, #6 product/rollout → `task2/plan_review_fable{4,5,6}.md`.
- **2.5 Fold:** the verifiers raised **1 blocker + 7 high + meds**; I H1-verified EVERY finding against the tree
  (all true, none rejected — strong cross-verifier overlap) → folded → v3 (`adjudication_log.md` has the
  per-finding evidence + disposition).
- **2.6 Second Codex loop → GO:** round 3 **CONVERGED-OK (0/0/0/0)** on the v3 verifier-fold deltas.

## The converged plan (headline)
The plan sequences the **fastest live-harm reduction first** and the **one structural migration** as the spine:
- **P0/P1:** disarm the G1 landmine (in-tree flag, matches prod), then a **hosting-only** deploy (I-5: safe, no
  G1 re-arm) of the already-built #11/#9/#10/#4-UX fixes → unfreezes **183 walled + 6 day_guard students**.
- **P2:** read-surface truth (gradebook #8 + 2 indexes, testId-less rows, 6-site assignedLists, durable #5).
- **P3-P7:** the ONE migration — `class_progress/{classId}_{listId}` → `users/{uid}/list_progress/{listId}` +
  server-authoritative twi + server `completeSession`/`resetProgress` + one rules cutoff — dissolving CR-1
  (#6/#9/#12/Kaila, ~42 live strands) and securing cycling + override.
- **P8-P10:** David's forward design (list-linking + choice terminal + continuous advance now; start-over/cycling
  gated on the foundation) + the teacher grade-override (#14/#1) + the permission fix (#19).
Every phase: independently shippable/testable/reversible, tied to the F-4 H/P/B before/after metric, with an
explicit non-regression matrix (§5) and deploy gate (I-5 checklist; hosting-only vs functions-gated).

## Verification outcomes (H1) — what the adversarial process caught + corrected
- **Codex round 1 (7 findings, all folded):** the resolver-writes-before-migration ORDERING BLOCKER (P4 would
  lazily write canonical docs before the audited migration); the role rule breaking user-create; the reset-path
  cutover gap; the false "no live path changes" on the functions deploy; the non-durable `reviewOnlyDay` marker
  in the migration screen; the W2 marker assertion; the scoped commit manifest.
- **3 verifiers (1 blocker + 7 high, all folded):** F4-1 the read-only resolver dropping the day-guard's
  reconciliation-write baseline (completion-rejection loop) — the subtlest, most important; F4-2 server
  reviewOnlyDay must replicate all 3 predicate reasons; F4-3 the P6 role split breaks the live self-select
  teacher signup (provisioning must ship with it); F4-4/F6-1/F6-9 the P5 migration operational gaps (write-flip
  spec, off-peak window, honest reversibility); F5-HIGH-1 MCQ stays client-authoritative (N5 caveat + Phase-E
  follow-on); F5-HIGH-2 the 3rd twi writer (reviewChallenge) unrouted; F6-2/F6-3 the un-migrated teacher read
  path + CS toolchain; F6-4/F6-5 the CONT-A-fast/CYC-gated comms + the ~287 CS-pinned focus-yield gap.
- **Rejected: none** — every Codex and verifier finding was verified-true against code. **Cleared by verifiers:**
  the conflict rule vs all F-3 populations, the review-attempt evidence mechanism, the one-migration keystone
  (genuinely converges, no hidden second migration), P1 hosting-only safety.

## Decisions surfaced for David (§7 of the plan; none block planning; near-term flagged)
RO deploy timing · token-guidance zero-code fix (accepts are free / 30-day replenish) · start-over timeline vs the
"tonight" promise (CONT-A ships fast; CYC gated) · migration-day comms for the 36 strand students · role mechanism
(claim vs whitelist) · continuation (student-chooses vs auto-advance) · cycling knobs · per-write CS authorizations.

## Task-3 carryforwards (implementation notes from the review process)
1. The resolver read-only↔write mode-switch must be an explicit server-side flag/constant with tests proving P4
   cannot write a canonical `list_progress` doc.
2. "Same student/list lineage" must be concrete in the migration script (not prose).

## Next: Task 3 (implementation) — AUTHORIZED
H2 met (Codex GO + 3-agent verify + folded); David pre-authorized autonomous implementation once converged.
Implement the plan's phases LOCAL-ONLY / uncommitted / no-deploy / no-live-writes, phase by phase, per the I-6
backbone order (P0 → P2/RS → P3-P7 foundation → P8-P10), logging each phase + a diff artifact. The deploys (P1,
P3, P6), the live migration (P5), and the CS-toolchain live writes remain David/owner actions.
