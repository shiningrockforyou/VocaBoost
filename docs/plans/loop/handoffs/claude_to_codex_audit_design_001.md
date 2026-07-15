# Claude → Codex: DESIGN review — REVIEWONLY_AUDIT_DESIGN round 1 (Playwright acceptance audit)

> **TASK = REVIEWONLY_AUDIT_DESIGN.** Review the Playwright acceptance-audit DESIGN at
> `/repo/docs/plans/PLAN_reviewonly_playwright_audit.md`. Write `/out/reviews/codex_review_audit_design_001.md`
> (my-side `docs/plans/loop/codex_reviews/codex_review_audit_design_001.md`), ending with
> `VERDICT blockers=.. high=.. med=.. nits=..` and `GO` or `NEEDS_FIXES`.

## Context
The Phase-1 code fix CONVERGED (REVIEWONLY_IMPL r3 GO). This design is the ACCEPTANCE AUDIT that must prove the
fix works end-to-end in a real browser before we trust it. A 3-agent audit (coverage / safety-isolation /
realism) runs in parallel on my budget; you are the external 4th pass.

## CRITICAL environment constraint (David): LOCAL ONLY — the audits run against `npm run dev`, NOT live
- The Playwright audits target **`http://localhost:5173`** (Vite dev server serving the LOCAL fixed working tree).
- The **live site `https://vocaboostone.netlify.app` has ACTIVE STUDENTS and must NEVER be the target or deployed
  to** this cycle. The harness (`audit/playwright/lsr_ui.mjs:14`) currently hardcodes `BASE` to the live URL —
  the design's §0 switches it to a localhost default + a fail-closed base guard. Judge that guard hard.
- Same Firebase backend; seed ONLY sandbox identities (`lsr_*@vocaboost.test`, `25WT` classes); NEVER `26SM`.

## What to verify (surgical — the design doc + the named harness/code files; do NOT open-ended-search the repo)
1. **Coverage & no false-pass:** does §2's RA1–RA8 map every plan §8 acceptance test (1,2,3,4,4b,5,5b,6,7,8) to a
   scenario whose oracle would actually FAIL if the fix regressed? Especially: RA1 recovery-closes (later day
   newWordCount>0), RA3/RA4b the gate STILL BLOCKS, RA6 (your ROI2-1 case) asserts BOTH "terminal shown / no
   empty review test" AND "no csd/recentSessions/sessions advance." Is the Fix-#9 REVIEW_STUDY-resume case
   (reviewOnlyDay + real passing attempt → real score persists, NOT null) covered?
2. **Oracle correctness:** are the csd/twi/`recentSessions`/`sessions` assertions faithful to how the code writes
   them (`studyService.js` completeSessionFromTest / `progressService.js` updateClassProgress)?
3. **Fail-closed certification:** §5 manifest — can a scenario that never ran be counted PASS? Is server-down /
   base-guard-trip / INVALID a NON-cert (exit 1)? Identity-bound?
4. **The three open questions (§6)** — give a concrete ruling on each:
   - (Q1) seed `class_progress.twi`+`study_states` for list-end vs DRIVE to list-end — which avoids an invalid
     reconciliation anchor (`csd_anchor_invalid`) while still reproducing the real `initializeDailySession` path?
   - (Q2) is a `page.evaluate` sessionStorage injection a faithful proxy for stale/forged client state, or does the
     app overwrite `dailySessionState` at navigateToTest before completion, nullifying RA4b?
   - (Q3) organic interv→1.0 (drive low reviews) vs seed a pinned-1.0 `recentSessions` window — which is
     deterministic enough for RA1/RA2?

## Requested decision
`GO` (design is coverage-complete, false-pass-safe, and fail-closed local-only → proceed to build the harness +
run on the local server) or `NEEDS_FIXES` (section/scenario + concrete edit).
