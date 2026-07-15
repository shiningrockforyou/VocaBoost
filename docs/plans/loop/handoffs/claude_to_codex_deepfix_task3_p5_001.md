# Claude → Codex: DEEPFIX Task 3 — review the P5 migration script DRAFT

> **TASK = DEEPFIX_TASK3_P5, round 1.** The FIX_PLAN Phase P5 (FND-3, the one-time class_progress→list_progress
> migration) is implemented as a `--dry`-only DRAFT: `/repo/scripts/cs/deepfix-migrate-list-progress.mjs` (660
> lines). It writes NOTHING until David authorizes `--commit`. Review it for correctness + safety — a wrong
> migration on the live 26SM cohort is the highest-stakes action in the program. ADJUDICATE the 10 uncertainties.
> Write `/out/reviews/codex_deepfix_task3_p5_001.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."
Trace the conflict rule + CSD screen to the plan + code. The migration MUST never regress twi/csd or promote a forged anchor.

## Read
- The SCRIPT: `/repo/scripts/cs/deepfix-migrate-list-progress.mjs` + `/repo/audit/deepfix/task3/P5_impl_notes.md` (the 10 uncertainties U1-U10 — adjudicate each).
- The SPEC: `/repo/audit/deepfix/task2/FIX_PLAN.md` **Phase P5** (the rule, the MANDATORY CSD-plausibility amendment, the per-population handling, the acceptance asserts) + `/repo/audit/deepfix/task1/investigations/inv_I6_foundation.md` §2 + `/repo/docs/plans/PLAN_list_progress_persist.md` §8.
- The DATA it must handle: `/repo/audit/deepfix/task1/firebase/CENSUS2_FINDINGS.md` (F-3: 36 LIVE-STRAND, 6 divergent, 72 stale, ~633 single-doc).
- Reconciliation semantics to match: `/repo/src/services/db.js:3239` (`getMostRecentPassedNewTest` anchor). The durable marker fact: `/repo/src/services/studyService.js:1448-1455` (`reviewOnlyDay` is NOT on the summary).

## Verify (priority)
1. **Conflict rule correctness:** TWI = anchor-validated max — does it replicate `db.js:3239` (passed-new, integer
   nwei≥0, max position, submittedAt tie-break)? Can it EVER select a forged/anchorless high (must QUARANTINE, never
   zero, never auto-promote)? CSD = max-plausible per-doc-own-anchor — correct?
2. **The CSD-plausibility screen (the mandatory amendment):** primary evidence = distinct post-anchor review
   ATTEMPTS `(classId,listId,studyDay)`, `submittedAt>anchor`, cap 1/studyDay (durable) — NOT the ephemeral marker.
   Is the ceiling (`anchorDay + evidence + slack` / threshold) correct — can it still QUARANTINE a legitimate
   long-recovering student (the 183 #11 population post-RO), or ADMIT an illegitimate csd? Does the N>1-consecutive
   dry-run assertion hold?
3. **Safety / write-guard:** is `--dry` genuinely write-free (the guard throws)? Is `--commit` gated
   (`--confirm-migrate=<cohort>`, refuses on any failed assert / quarantine>0 per [C7-2])? Backups before writes?
   Idempotent (migratedAt)? Legacy class_progress RETAINED (P7 deletes)?
4. **Per-population:** the 36 LIVE-STRAND → anchor jump; 6 divergent → fast-twi/slow-csd; 72 stale → collapse;
   ~633 single-doc → 1:1. Any population mis-handled? Do the hand-patched (manualOverride/manual-pass) values SURVIVE?
5. **Adjudicate U1-U10** (esp. U1 quarantine granularity pair-vs-exclude; U2 own-anchor fallback for
   LIST_SCOPED_RECON-carried csds not in the plan text; the 109-testId-lineage-fallback rate).

Per-finding: `severity · location (script:line / plan §) · problem · evidence · fix`. VERDICT + CONVERGED-OK if
0/0. GO = the migration is correct + safe to hand to David for a 25WT rehearsal → authorized 26SM run.
