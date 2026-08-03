# RESUME — DEEPFIX2 (2026-08-03: **CODEX r79 = YES** · typed fold CLOSED · order 97 ready to issue)

## PRODUCTION (live-verified)
Indexes 43 ✅ · functions 24 ✅ (zero removed) · `system_config/review_v2` SEEDED DARK ✅ · rules **NOT
deployed — order 97 is written, verified and ready to issue** · client PINNED `ce09792` · **Netlify
BUILDS STOPPED** · NOTHING ACTIVATED. Students see no difference. **WSL cannot push — every push is a
WinClaude order** [[wsl-claude-has-no-git-push]]. Read-only remote checks DO work:
`git -c http.sslBackend=gnutls ls-remote origin refs/heads/main`; a fresh session also needs
`git config --global --add safe.directory /app`.

## START HERE EVERY TURN
`bash scripts/deepfix2/session-start.sh` · before publishing ANY claim or issuing ANY order:
`node scripts/deepfix2/gate.mjs` · plan a fold with `--plan` BEFORE editing.
Rationale: docs/plans/deepfix2/EXECUTION_DISCIPLINE.md. Four skills auto-fire. The baton watcher now
lives IN THE REPO (`scripts/deepfix2/baton-watcher.sh`). **gate.mjs now also checks the MATRIX sha, not
just the artifact sha** — the old gate printed "every published score matches" while the evidence
certified a harness that no longer existed.

## THE RULES LEG — CLEARED BY CODEX r79 (YES), ORDER WRITTEN, NOT YET ISSUED
Artifact `audit/deepfix/task3/live_baseline/firestore.merged.rules` · frozen sha16
**`f40f91fce3693b82`** (UNCHANGED throughout — it is what Codex certified and what the order verifies)
· on origin/main at `be1981f`. Review: `docs/plans/loop/codex_reviews/codex_deepfix2_r79.md`.
Current evidence, all re-derived: **262/262 matrix · 15/15 mutants** (matrix harness
`e251ee63541f8c71`). Codex certified the artifact against the then-244-case harness; the typed fold
added CASE GJ (18 grading_jobs assertions, purely additive, 0 removals), so the same artifact is now
verified by a LARGER matrix. Deploy slot `/app/firestore.rules` still holds the P10d trap
(`752981b78f532ebd`, **182/262**, `isTeacher()`→a custom claim nobody is backfilled with).

**TO ISSUE ORDER 97:** flip `docs/plans/loop/win/baton.json` to `turnOwner: winclaude`,
`taskId: RULES_DEPLOY_R79`, `handoff: docs/plans/loop/win/handoffs/claude_to_winclaude_097.md`,
revision +1 — **and remove the ⛔ NOT-ISSUED banner at the top of that handoff.** It was held only
because the gate failed while the typed ledger had open rows; that fold is now closed.

## THE TYPED FOLD — CLOSED, BUT THE TYPED LEG IS **NOT** READY [D3]
The security fold is closed and evidenced: **engine lap 395/395 · 7/7 typed-seam mutants killed**.
Authoring was delegated (the delegator is the wrong author for guard-shaped work) and independently
audited; the audit returned **PASS WITH FINDINGS** and every finding was folded:
- **F1 (high):** the `already_graded` sibling seam was correct as CODE but had ZERO evidence — the
  auditor reverted only that branch and the whole 376-case battery stayed green. Now pinned by
  **CASE TS** + mutant **`M-A1-SIBLING-CALL-SITE`** (killed, 4 red).
- **F2:** "both students blocked" was FALSE and contradicted by its own fixture — corrected in all
  three places it was published.
- **F3/F4:** carded (NEED_TO_FIX 21) and the "unforgeable" overclaim narrowed to "not forgeable today".

**DO NOT read these greens as typed-leg readiness.** Two carded blockers stand in front of it:
**NEED_TO_FIX 18** (`rv2_` ids collide across students in a class — blocks the 25WT rehearsal) and
**NEED_TO_FIX 21** (`grading_in_progress` returned for a permanent condition, contradicting its frozen
client contract — blocks DF2-51). The typed leg ships as CODE, not as a readiness claim.

## AWAITING DAVID
**Anyone can self-register as a teacher** (`Signup.jsx:124-149` → `db.js:254`), and the LIVE ruleset lets
ANY teacher read/write EVERY student's subcollections regardless of class membership. Live today, NOT
caused by DEEPFIX2. Three options carded at the bottom of NEED_TO_FIX.md. **His call.**

## THEN, in order
**issue order 97 (rules deploy)** → engine-key-provenance-scan (NEED_TO_FIX 20, cutover prerequisite;
the artifact comment's "presence proves server authorship" is true going forward but not historically —
its wording repair is deliberately POST-deploy so the certified sha stays valid) → rv2-docid-collision
(NEED_TO_FIX 18) → DF2-51 client cutover (needs NEED_TO_FIX 21 decided) → 25WT rehearsal → shadow audit
→ **David's backfill go** → **David's flip**. DF2-10 adoption legs stay DEFERRED until after the rehearsal.
