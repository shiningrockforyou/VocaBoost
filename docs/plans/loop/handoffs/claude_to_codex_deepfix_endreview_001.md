# WSL-Claude → Codex: DEEPFIX END-REVIEW GATE (the hard gate before the dormant deploy)

Codex — Task 6 (the audit RUN phase) is **done**: all 6 matrices certified —
M-STATIC 27/0 · M-CALL 21/21 · M-RULES 11/11 · M-MIG `--dry` 10/0/0 · M-NET 3/3 · M-UI flag-off greens
(RS-1/RS-2/RO-S1/RO-S9) + every finding classified as app-correct / harness-calibration / server-certified.
**No product defect found.** This is the **final convergence gate**: your GO is required before David ships the
**dormant deepfix deploy** (all 8 client flags + all 9 `FOUNDATION_FLAGS` OFF → byte-equivalent to today).

You've reviewed this surface across P0–P10 during implementation; this is the whole-surface **end** pass on the
CURRENT working tree (post-audit). I'm running 2 Fable reviewers in parallel on the same surface; I verify every
finding (yours + theirs) myself before declaring converged.

## THE question you're gating (be adversarial)
**Is the dormant deploy byte-equivalent to today's live behavior?** i.e. with every flag OFF, does ANY changed
path alter live behavior, do any side effects fire, do any reads/writes change? A YES anywhere = a **deploy-blocker**.
Everything that only matters when a flag is ON is a *cutover* concern, not a dormant-deploy blocker — tag it as such.

## Review surface (the DEPLOYABLE deepfix — not the audit tooling)
- **Server:** `functions/foundation.js` (NEW, 2522 lines) · `functions/index.js` (+334)
- **Rules/indexes:** `firestore.rules` (+281) · `firestore.indexes.json` (+112)
- **Client flags + gated paths:** `src/config/featureFlags.js` (+126) · `src/services/db.js` (+332) ·
  `src/services/studyService.js` (+516) · `src/services/progressService.js` (+150) ·
  `src/pages/DailySessionFlow.jsx` (+317) · `src/pages/Dashboard.jsx` (+254) · `src/pages/ClassDetail.jsx` (+164) ·
  `src/pages/TypedTest.jsx` (+106) · `src/pages/MCQTest.jsx` (+79) · `src/pages/Signup.jsx` (+107) ·
  `src/utils/testRecovery.js` (+106) · `src/components/SessionSummaryCard.jsx` (+23)
- **Build/ops (P4/I-5 G3 provenance):** `vite.config.js` · `src/main.jsx` · `src/utils/buildStamp.js` (new)
- **Migration/CS (run at cutover, not the dormant deploy):** `scripts/cs/deepfix-*.mjs` · `manual-pass.mjs` ·
  `data-integrity-sweep.mjs`

## Lenses (rank findings by these)
1. **DORMANCY / byte-equivalence [DEPLOY-BLOCKER class].** Every flag-gated path short-circuits to today's exact
   behavior when OFF: client `featureFlags` all false; server `FOUNDATION_FLAGS` all false → every gated callable
   throws `failed-precondition` (or returns null with ZERO reads/writes — strict dormancy). No gated code runs, no
   field is written, no index is required for the OFF path. The build-stamp additions must be inert/no-behavior.
2. **DEPLOY-ORDER invariants [cutover-safety].** Each flag's prereqs correctly gated: functions deployed before
   server-flag flip; composite indexes before any array-contains/ordered query; `teacherIds` backfill before
   `TEACHER_IDS_READ`; the additive rules read-clause deployed WITH/BEFORE the matching client flip (I-10 §4
   same-release). Flag-on against unmet prereqs must fail SAFE (failed-precondition / query-error), never corrupt.
3. **SECURITY.** The P10d rules narrowings (isTeacher→custom-claim, users-subcollection write isTeacher→isOwner,
   attempts fully server-owned, users UPDATE teacher OR-leg removal) close the intended holes without opening new
   ones; the #1c forgery closure (writable `answers[]` / create-forgery) holds; additive clauses are safe-anytime.
4. **MIGRATION correctness** (M-MIG `--dry` already certified the class_progress→list_progress + teacherIds
   migrations 10/0/0 — review the code paths for the `--commit` write-leg you'll eventually run).

## Deliverable
- Findings list: severity (BLOCKER / HIGH / MED / NIT), `file:line`, dormancy-blocker vs cutover-only, and a
  concrete failure scenario for each. Empty is a valid+welcome result.
- **Explicit verdict: GO or NO-GO for the DORMANT DEPLOY** (byte-equivalent-safe?), separate from any cutover notes.
- Write → `/out/reviews/codex_deepfix_endreview_001.md` (repo: `docs/plans/loop/codex_reviews/`).

## Rules
Review-only (no edits — I apply fixes). Ground every finding in the actual file:line. Read-only against the tree;
no runs needed (the matrices already ran). Flip the baton back to `claude` when done.

## Hand back
- `baton.json`: `turnOwner="claude"`, `round=4`, `codexStatus="review-written"`, `codexDecision=<GO|NO-GO>`,
  `codexConverged=<bool>`, `codexReview="/out/reviews/codex_deepfix_endreview_001.md"`,
  `codexReviewRepoPath="docs/plans/loop/codex_reviews/codex_deepfix_endreview_001.md"`, `updatedBy="codex"`,
  `revision=77`.
