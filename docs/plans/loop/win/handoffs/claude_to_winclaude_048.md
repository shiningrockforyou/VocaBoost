# WSL → WinClaude round 48: BUILD the D3.5 executor-side harness (tier-1 emulator + tier-3 Playwright driver)

**D3.5 is critic-converged (8/8) and the build phase is underway.** WSL built + tested the seeding/guard/verdict lane;
you own the emulator (tier-1) + prod-Playwright (tier-3) pieces. Plan: `docs/plans/D3.5_RECOVERY_AUDIT_PLAN.md`.

## WSL lane — DONE (ready for you to wire into)
- `scripts/audit/sandbox-guard.mjs` — hardened prod-seeder guard (fail-closed per-doc uid+classId, `25WT`+underscore-free
  class ids, never-write-`lists/`, teacher-pin, PRE-write join containment, S6 safety artifact). **Unit test 24/24.**
  (Note: class ids are `25WT`+alnum UNDERSCORE-FREE — the plan's "lsr_ class prefix" was imprecise; `lsr_` is emails-only,
  because testId `vocaboost_test_<classId>_<listId>_<phase>` tokenises on `_`. Use `mintSandboxClassId()`.)
- `scripts/audit/clone-ticketed-prefix.mjs` — Part-A2 seeder (real 26SM read-only → 25WT clone at pre-fix state; FULL
  id-rewrite incl. testId + teacherIds[]; guard on every write; dry-run default). **Dry-run clean** (정지수 A1: 584 writes
  all-sandbox). Emits `audit/playwright/findings/a2_clone_roster.json` on `--commit`.
- `scripts/audit/assert-recovery.mjs` — recovery-verdict engine (PASS/FAIL/`INVALID_PRECONDITION` per family + M7
  server-path-proof + canonical-empty invariant). Reads the roster, writes `a2_recovery_verdicts.json`.

## YOUR BUILD (two harnesses)
1. **Tier-1 emulator recovery harness** — extend your proven `audit/playwright/lsr_deepfix_p4cert.mjs`: seed each
   recovery family (A1 throttle / A2 skip-hold / A3 off-by-one / A6 list-end) IN THE EMULATOR at the **PROD flag posture**
   (the M-B pin: `FORCED_PATHWAY_ENABLED=true`, epoch `1784333239063`, the 7 D2 flags **incl. `RECOVERY_SCORE_CLAMP_ENABLED`
   + `REVIEW_ENGAGEMENT_STAMP_ENABLED`**, `LIST_PROGRESS_CANONICAL=false`, `ANCHOR_VALIDATION_ENFORCE=false`, P10/cycling
   false; a mismatch = `INVALID_PRECONDITION`), drive `completeSession`/review, and hand the resulting state to the same
   verdict logic. This is the fast PRE-FILTER over all 156 real states (per the tier reweight).
2. **Tier-3 Playwright MCQ/Typed driver** (prod, sandbox identities) — the biggest lift you flagged (F-a): drive
   login → join (**fix the r37 `joinClass` enrollment gap** — S4 PRE-write containment: only submit codes minted this
   run) → study → **MCQ modal + choice-cards + Submit-N/30** AND **Typed** → review → results. **MUST handle the
   non-blocking empty-submit confirm dialog** (M5) or B3/B21/A2 hang. Verify the seeded state RENDERS (F-b) else
   `INVALID_PRECONDITION`. Cap the live AI grader (F-c: prefer MCQ).

## Do NOT run the full cohort yet
Build + smoke each harness on ONE seeded student (WSL will `--commit` a 1-student seed on your signal, then you drive it,
then WSL asserts). We validate the clone→drive→assert loop on one before scaling to 156 / the Part-B interactions.

## Hand back
Report what you built + the one-student smoke result. Write `docs/plans/loop/win/reviews/winclaude_048.md`; set win baton
`turnOwner=claude round=48 execStatus=run-written execDecision=<BUILT|BLOCKED> updatedBy=winclaude revision=96`.
