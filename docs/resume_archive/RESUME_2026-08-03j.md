# RESUME — DEEPFIX2 (2026-08-03: r78 fix ON ORIGIN · Codex re-gate r79 handed)

## PRODUCTION (live-verified)
Indexes 43 ✅ · functions 24 ✅ (zero removed) · `system_config/review_v2` SEEDED DARK ✅ · rules NOT
deployed (the one remaining leg) · client PINNED `ce09792` · **Netlify BUILDS STOPPED** · NOTHING
ACTIVATED. Students see no difference. **WSL cannot push — every push is a WinClaude order**
[[wsl-claude-has-no-git-push]]. (Read-only `ls-remote` works via `git -c http.sslBackend=gnutls` —
the shared checkout's `.git/config` pins Windows `schannel`.)

## START HERE EVERY TURN
`bash scripts/deepfix2/session-start.sh` · before publishing ANY claim: `node scripts/deepfix2/gate.mjs`
· plan a fold with `--plan` BEFORE editing. Rationale: docs/plans/deepfix2/EXECUTION_DISCIPLINE.md.
Four skills auto-fire: folding-review-findings · verifying-agent-work · verifying-published-claims ·
ordering-deploys. The baton watcher now lives IN THE REPO (`scripts/deepfix2/baton-watcher.sh`) — the
old per-session /tmp copy died with its session while session-start printed "relaunched".

## THE RULES ARTIFACT — state after Codex r78 → re-gate r79
`audit/deepfix/task3/live_baseline/firestore.merged.rules` · **244/244 matrix · 15/15 mutants killed**
· frozen sha16 `f40f91fce3693b82` · **on origin/main at `be1981f`** (win order 96 PUSHED; verified by
my own ls-remote, not by report). Panels: Opus r1-r5 folded · **Codex r78 = NO**: engine MARKERS were
immutable but engine EVIDENCE was not — an answers-array replacement on an engine-stamped attempt
passes completeDay's count arithmetic while letting the client pick which words graduate.
**CLOSED, agent-authored** (fourth consecutive same-class finding ⇒ authoring delegated, verification
kept): `isEngineStampedAttempt()` hoisted ABOVE the student|teacher OR (firestore.merged.rules:367),
cases AE1-AE15, mutant M15, M14 re-pointed. **Re-verified 2026-08-03 by THIS session on a fresh
harness** (emulator v1.22.0): canonical 244/244 · pre-fix artifact `def5231f5be328c2` reproduced at
234/244 with exactly the ten expected failures · M15 kill signature AE1-AE6 matches the committed
evidence byte-for-byte.
**NOW: Codex round 79 (the FINAL GATE re-entry) — handoff
docs/plans/loop/handoffs/claude_to_codex_deepfix2_r79.md.** A YES authorizes writing the rules deploy
order; a NO names the blocker. **NO COMMITS while Codex holds the baton** (r78 process finding). NOT
in the fix and disclosed as open: Codex item 3 (completeDay wordId↔presentation binding,
completion.js:602) + the rv2_ replay-provenance fixture — both carded onto typed-fix-audit.

## AWAITING DAVID
**Anyone can self-register as a teacher** (`Signup.jsx:124-149` → `db.js:254`), and the LIVE ruleset lets
ANY teacher read/write EVERY student's subcollections regardless of class membership. Live today, NOT
caused by DEEPFIX2. Three options carded at the bottom of NEED_TO_FIX.md. **His call.**

## THEN, in order
typed-fix-audit (two typed binding fixes + Codex r78 item 3 + replay-provenance fixture; typed leg is
audited NO and ships as code, not as a claim) → DF2-51 client cutover (wrapper + dormant flag exist) →
25WT rehearsal → shadow audit → **David's backfill go** → **David's flip**. DF2-10 adoption legs stay
DEFERRED until after the rehearsal.
