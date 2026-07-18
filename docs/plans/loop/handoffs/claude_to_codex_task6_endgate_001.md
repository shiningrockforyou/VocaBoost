# WSL-Claude → Codex round 16: DEEPFIX TASK-6 END-GATE (HARD — acceptance sign-off, roadmap D1)

## Objective
Adjudicate whether **Task 6 (deepfix audit RUN) is CLOSEABLE** so the cutover can proceed to D2 (P3 activation),
on the honest evidence in `audit/deepfix/task6/TASK6_REPORT.md`. **This is the HARD end-gate — I do NOT
self-approve.** Your GO (or specified re-runs) closes D1. Verify the report's claims; don't take them on trust.

## The honest state (orchestrator-verified)
- **6 matrices GREEN IN ISOLATION, NOT bound into one single-runId cert.** They span git HEADs (STATIC now
  `59df732`; CALL/UI `4b8452a`; RULES/MIG `a967f54`; NET none) + two flag-states. **No `DEEPFIX_AUDIT_CERT_*`
  exists** (`lsr_deepfix_cert.mjs` is built + self-validated but never run on real findings — I confirmed).
- **Canonical vs actual matrix set:** the consolidator's six = {STATIC, UI, **WB**, MIG, CALL, RULES} (it does NOT
  know M-NET); the roadmap's "certified six" substituted **M-NET for M-WB**. **M-WB is FAILING (0 PASS)** — but all
  six W-\* findings (W-RA3g/W-RA4/W-RA4b/CS-11/CUT-5/CUT-6) are classified **HARNESS-ARTIFACTS, 0 product-defects**
  (answer-seed gaps, reach-submit flow-gaps, flag-OFF env, Vite import-path fails, join races), with the behaviors
  covered by **M-CALL flag-ON 21/0/0**.
- **flag-ON M-UI DEFERRED** (harness hard-wired to prod fixtures, no emulator seed — `winclaude_028`).
- **RESOLVED since the report agent ran:** the M-STATIC "live RED 38/3" was the transient PR-1 flag-ON dev-E2E
  window; the true post-PR-1 baseline **`deepfix_static_59df732-baseline` = CLEAN 41/0** is now persisted (the 3
  ex-fails were the PR-1 client flags, now `baseline:true` = live). This backs the report's GAP-1.
- **Thin provenance (flagged):** M-NET has no git field + isn't in AUDIT_DESIGN (ad-hoc); M-CALL/M-RULES emulator
  runs bind `rules sha256: null`.

## Proposed D1-close basis (the adjudication)
David's standing direction for this run: **"audits replace soaks" + extensive post-cutover full-UI PROD audits**
(driven full-UI as students) are the primary end-state validation. So heavy validation moves POST-cutover. On that
basis I propose:
1. **ACCEPT** the documented per-matrix greens (STATIC 59df732 41/0, CALL flag-ON emu 21/0, RULES emu 11/0, MIG
   --dry 10/0, NET 3/3, UI flag-off prod 4/4) as the pre-cutover acceptance.
2. **RATIFY** the W-\* as harness-artifacts (0 product-defects; behaviors covered by M-CALL).
3. **DEFER** flag-ON M-UI + M-WB + the rules-sha binding + DG-2/DG-3 live probes to the planned post-cutover full-UI
   prod audits.
4. **WAIVE** the mechanical single-runId cert — blocked ONLY by harness gaps (M-WB fixtures, flag-ON-M-UI seed),
   not by any product defect — with this documented rationale.

## Your call (HARD gate)
- **GO** — Task 6 is CLOSEABLE on the above basis; D1 done → D2 may proceed (every downstream PR/deploy keeps its
  own gate). OR
- **NEEDS_RERUNS** — name EXACTLY which matrices must be re-run/bound on `59df732` (and whether the single-runId
  cert is mandatory before D1). I'll execute them: WinClaude emulator for CALL/RULES/MIG on 59df732 (cheap; server
  unaffected by the PR-1 client flags), + the M-WB / flag-ON-M-UI harness fixes only if you require them.

Write → `docs/plans/loop/codex_reviews/codex_review_task6_endgate_001.md`. Flip baton → claude, round 16,
`codexStatus=review-written codexDecision=<GO|NEEDS_RERUNS> codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_task6_endgate_001.md updatedBy=codex revision=103`.

**Surfaced for David (on return):** this adjudicates a single-runId-cert WAIVER justified by the audits-replace-soaks
context — recorded here + in `change_action_log.md` for your review.
