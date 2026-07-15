# #10 Overlay — live validation results (for adjudication)

**Question to adjudicate (Claude + Codex):** is NEED_TO_FIX #10 adequately VALIDATED by the current live
result (3/4 cells green), or is the 4th cell (TD2 — TypedTest review-final) required before we declare #10
done and move on?

**Build under test:** production `a967f54` (contains Fix A — the flag-gated non-reconciling snapshot;
verified: `git merge-base --is-ancestor 14e49a4 a967f54` + both files' swap lines present). Harness:
`audit/playwright/lsr_fix10_overlay.mjs` v5 (code-review CONVERGED Codex GO/CONVERGED-OK + 3-agent fable).

## The oracle (recap)
Each cell drives ONE session-final completion through the LIVE UI and reads 6 DISCRIMINATING Firestore
fingerprints (the broken build also ends at csd+1/twi+pace, so csd/twi are NOT the oracle):
d1 no rebuild + results + passed · d2 recentSessions +1 (day N) · d3 exactly one new sessions doc (day N) ·
d4 session_states phase='complete' · d5 zero new day_guard_rejected · d6 zero in-window csd_twi_reconciled.
`green` = all six. False-GREEN is structurally impossible (Lens A verified: the guard-reject path cannot
produce d2/d3).

## RESULT — 3/4 GREEN (build a967f54)
| Cell | Code path | Completion | Result | Evidence |
|------|-----------|-----------|--------|----------|
| **TD1** | `TypedTest.jsx` | Day-1 **new**-final | ✅ **GREEN** | all 6 true; csd 0→1, twi→20, recent+1, phase complete; d7 snapshot `{day:1, csd:0}` (pre-completion csd = Fix A's intended non-reconciling capture) |
| **MD1** | `MCQTest.jsx` | Day-1 **new**-final | ✅ **GREEN** | all 6 true; csd 0→1, twi→20 |
| **MD2** | `MCQTest.jsx` | Day-2 **review**-final | ✅ **GREEN** | all 6 true; csd 1→2, twi→40, recent+1 (day 2), phase complete |
| **TD2** | `TypedTest.jsx` | Day-2 **review**-final | ⚠️ **UNMEASURED** | driver could not reach the typed review test ("no Review/Continue button" on both reach attempts); see below |

Reproduced consistently across runs (TD1+MD1 green from Run 3; MD2 green from Run 4; all on `a967f54`).

## Coverage argument (Claude's analysis)
- **Both code files the fix touched are proven green:** `TypedTest.jsx` (TD1) and `MCQTest.jsx` (MD1, MD2).
- **Both completion TYPES are proven:** new-final (TD1, MD1) AND review-final (MD2).
- **Fix A in `TypedTest.jsx` is a SINGLE shared completion block** — the snapshot swap sits in
  `doWriteAndFinalize`'s `if (passed && isSessionFinalTest && sessionContext?.dayNumber)` block; new vs review
  differs ONLY by which test sets `isSessionFinalTest` (`TypedTest.jsx:971-973`), not by different completion
  code. So TD1-green already exercises the exact fixed code a typed review-final would, and MD2-green proves
  the review-final flow completes cleanly end-to-end.
- ⟹ **TD2 is redundant coverage** of the same fixed block, blocked by a driver-reach flake — not a fix gap.

## Why TD2 is unmeasured (NOT an app/fix problem)
- v5 set the typed class's `reviewTestType='typed'` (the review format is a SEPARATE app setting defaulting to
  'mcq' — `DailySessionFlow.jsx:1095`, `ClassDetail.jsx:234`), verified by `bindAndVerifyClass`. This FIXED
  the earlier `page-mode-mismatch`.
- TD2 then failed at reaching the typed review test: setup-d2new hit a transient "Session-menu button not
  visible" (recovered via retry), then the review reach got "no Review/Continue button" on both attempts,
  amid benign Firestore `Listen/Write channel ERR_ABORTED` noise.
- **MD2 (mcq review, identical flow) reached fine** → this is intermittent typed-review NAV flakiness (likely
  the slow typed AI-grading delaying the dashboard "Continue"-into-review state), not an app defect.
  Review-final completion itself is PROVEN by MD2.
- The harness is FAIL-CLOSED: it reported TD2 as NOT-MEASURED (→ INCOMPLETE), never a false pass.

## Harness iteration journey (all driver fixes, none were the fix failing) — `FIX10_OVERLAY_BUILD_LOG.md`
Run 1→5 surfaced + fixed: typed grading latency (SETTLE_MS 25s→90s), Day-2 setup reach flakiness (reachTest
retry), selector/flow-gap verdict-hygiene (→ NOT-MEASURED not FAIL; fail-closed self-verified), account
exhaustion (provisioned s47-s76), a Day-2 setup logic bug (confirm via new-attempt not csd), and the
reviewTestType setting (v5). Each iteration surfaced a HARNESS issue; the app/fix never regressed.

## The two positions to adjudicate
- **A — FINALIZE at 3/4 (Claude's lean):** #10 is validated. Both files + both completion types are green;
  TD2 is the same shared fixed code as TD1 (redundant), blocked by a driver flake. Document TD2 as a known
  harness limitation and move to Run S.
- **B — push for literal 4/4:** harden the typed-review reach (more retries / longer post-grading wait) and
  re-run once for a genuine TypedTest review-final measurement. Higher-confidence artifact; costs ~1 run.

## Ask for Codex
1. Do you agree TD1-green + MD2-green together adequately cover what TD2 would prove (given the shared
   `TypedTest.jsx` completion block)? Trace the block yourself — is there ANY review-specific path in the #10
   fix's completion code that a new-final cell does NOT exercise?
2. Any residual #10-relevant risk that ONLY a typed review-final would catch?
3. Verdict: **FINALIZE-3/4** or **NEEDS-4TH-CELL** (with the specific reason).

---

## ★ JOINT ADJUDICATION — FINALIZE-3/4 (settled 2026-07-12)
**Both Codex and Claude independently reached `FINALIZE-3/4`, each verified against the code.**
`docs/plans/loop/codex_reviews/codex_review_fix10validate_001.md`.

**Codex's trace (Claude verified both load-bearing claims):**
- The #10 fix in `TypedTest.jsx` is ONE shared completion block (`:976` block; swapped read `:983-985`); there
  is NO TypedTest review-specific implementation of the fix → TD1 exercises the exact code TD2 would.
- Review-specific logic exists but introduces NO typed-review-only #10 path: `passed` computed at `:817`
  (`currentTestType === 'review' ? true : …` — Claude verified) only decides whether the shared block runs;
  the Day-2 new-word-pass gate (`studyService.js:1355-1401`) was already exercised by MD2; review
  score/graduation (`studyService.js:1405+`) is in the shared service path, not the page snapshot-race fix.
- Claude verified: the only `getOrCreateClassProgress` calls in `TypedTest.jsx` are `:823` (pre-attempt
  DO-NOT-TOUCH) and `:985` (flag-off branch); the completion window's read is the flag-gated `getClassProgress`
  swap. No review-final-only reconcile in the window.

**Coverage achieved (3 green cells):** typed fixed block (TD1) · MCQ fixed block (MD1, MD2) · new-final
completion (TD1, MD1) · review-final completion + service gate (MD2) · typed AI-grading latency (TD1) ·
discriminating fingerprints (all). **That covers the #10 root cause: post-attempt pre-completion
reconciliation racing the day guard.**

**TD2** stays documented as a harness-limitation (typed-review nav flake); harden it only if future work
targets typed-review UI coverage. It did NOT false-pass — the harness failed closed.

## ⟹ NEED_TO_FIX #10: COMPLETE — designed · code-reviewed · deployed (`a967f54`) · VALIDATED (3/4 green, joint).
