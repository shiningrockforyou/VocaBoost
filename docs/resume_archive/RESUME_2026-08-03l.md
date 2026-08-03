# RESUME — DEEPFIX2 (2026-08-03: **THE DARK DEPLOY IS COMPLETE — all four legs live, nothing activated**)

## PRODUCTION (live-verified)
Indexes 43 ✅ · functions 24 ✅ (zero removed) · `system_config/review_v2` SEEDED DARK ✅ · **rules DEPLOYED 2026-08-03 (order 97): ruleset `384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1`, 523 lines, sha16 `f40f91fce3693b82` — byte-identical to the certified artifact** · client PINNED `ce09792` · **Netlify
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

## THE RULES LEG — **DEPLOYED AND INDEPENDENTLY VERIFIED**
Production runs ruleset `384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1` (created 2026-08-03T20:08:33.994879Z, 523 lines, sha16
`f40f91fce3693b82`) — the exact artifact Codex certified at r79. **Verified by me, not accepted from the
executor's report:** I re-fetched production read-only (byte-identical to their handback) and re-ran the
full matrix against those fetched bytes — **262/262 green**. The P10d trap did NOT ship.

**ROLLBACK, if ever needed:** `audit/deepfix/task3/live_baseline/firestore.live.PRE_R79_DEPLOY.rules` is
the exact pre-deploy production ruleset — restore it to `firestore.rules` and redeploy. Its sha will NOT
equal `44914b60858a1dcd` (LF vs CRLF); the rule text is what matters, do not chase that number.
The P10d draft is preserved at `audit/deepfix/task3/firestore.p10d.rules`.

**A POST-DEPLOY TRAP THAT WAS CAUGHT AND FIXED:** the deploy made BOTH whole-file baselines in
`rules-mutants.mjs` become the artifact itself (`firestore.live.rules` was re-baselined by
`fetch-live-rules.mjs`; `/app/firestore.rules` was staged from the artifact). Both mutations would have
scored a perfect green, and the runner fails closed on that — so it would have read as a DEFECT rather
than a stale path. Repointed at the two preserved snapshots. **STILL OWED: the artifact-comment repair**
(NEED_TO_FIX 20 — `firestore.merged.rules:133`/`:346` reason from a create guard that did not exist
historically; the claim is true, its stated reason is not). Safe to do now: the sha is no longer
load-bearing for an unexecuted order.

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
~~verify the order-97 outcome~~ **DONE — deployed and independently re-verified at 262/262 against bytes
fetched from production** → ~~engine-key-provenance-scan~~ **DONE: 41,680 attempts scanned, ZERO
carrying any engine key, 0 quarantine candidates — Codex r79's qualification is now measured, not argued
(the artifact COMMENT repair is still owed, deliberately POST-deploy)** → rv2-docid-collision
(NEED_TO_FIX 18 — **fold ledger already written and gate-`--plan` ACCEPTED at
`<scratch>/rv2-collision-fold-ledger.md`; explicitly NOT started, because it changes the docId scheme the
deploying artifact reasons about**) → DF2-51 client cutover (needs NEED_TO_FIX 21 decided) → 25WT rehearsal → shadow audit
→ **David's backfill go** → **David's flip**. DF2-10 adoption legs stay DEFERRED until after the rehearsal.
