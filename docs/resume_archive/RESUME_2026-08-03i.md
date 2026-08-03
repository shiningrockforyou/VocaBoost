# RESUME — DEEPFIX2 (2026-08-03: dark deploy COMPLETE · rules artifact converging)

## PRODUCTION (live-verified)
Indexes 43 ✅ · functions 24 ✅ (zero removed) · `system_config/review_v2` SEEDED DARK ✅ · rules NOT
deployed (the one remaining leg) · client PINNED `ce09792` · **Netlify BUILDS STOPPED** · NOTHING
ACTIVATED. Students see no difference. **WSL cannot push — every push is a WinClaude order**
[[wsl-claude-has-no-git-push]].

## START HERE EVERY TURN
`bash scripts/deepfix2/session-start.sh` · before publishing ANY claim: `node scripts/deepfix2/gate.mjs`
· plan a fold with `--plan` BEFORE editing. Rationale: docs/plans/deepfix2/EXECUTION_DISCIPLINE.md.
Three skills now auto-fire: folding-review-findings · ordering-deploys · verifying-published-claims.

## THE RULES ARTIFACT — state after panel r4
`audit/deepfix/task3/live_baseline/firestore.merged.rules` ·
**213/213 matrix · 12/12 mutants killed** · frozen sha16 `a08c81ccc1d812eb`.
Panels: r1 YES/NO · r2 YES/NO · r3 NO/NO · r4 NO/NO — every round folded.
**r4 found the same defect class a THIRD time** (`manualOverride` guarded on delete only ⇒ a student
could forge a CS override anchor, and a teacher could strip the marker then delete). **Fixed AND
root-caused:** every repeated key list is now a rules FUNCTION used by all branches, so a key can never
again be in one branch and missing from another.
**NEXT: one verification panel on this fold, then the CODEX FINAL GATE, then its own deploy order.**
Deploy is NOT authorized. The order must `cp` the artifact to `firestore.rules` (a staging slot that
today holds the unshipped P10 draft — 137/213, 30 live-flow regressions if shipped),
verify the sha, deploy, then re-run fetch-live-rules.mjs to re-baseline.

## AWAITING DAVID
**Anyone can self-register as a teacher** (`Signup.jsx:124-149` → `db.js:254`), and the LIVE ruleset lets
ANY teacher read/write EVERY student's subcollections regardless of class membership. Live today, NOT
caused by DEEPFIX2. Three options carded at the bottom of NEED_TO_FIX.md. **His call.**

## THEN, in order
DF2-12/13 typed grading → DF2-51 client cutover (wrapper + dormant flag exist) → 25WT rehearsal →
shadow audit → **David's backfill go** → **David's flip**. DF2-10 adoption legs stay DEFERRED until
after the rehearsal.
