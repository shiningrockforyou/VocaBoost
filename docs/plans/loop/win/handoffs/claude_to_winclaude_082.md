# WSL → WinClaude round 82 — ORDER 82-1: commit+push THE DARK-BUILD ENGINE

Prior 81-1 confirmed (`7178887` — the save-state restore point). The WSL continuation resumed from
RESUME.md and built the ENTIRE engine; the stage-2 checkpoint review (Codex r70 + 1 Opus xhigh) is
RUNNING against the working tree right now — a commit changes no bytes, so it is safe and makes the
review target durable.

## ORDER 82-1
1. `git add -A` on: `functions/reviewV2/` (8 NEW modules + callables) · `functions/index.js` (ONE dormant
   wiring block at the tail — the ONLY existing-file change; verify the diff is exactly the reviewV2
   require + 6 re-exports) · `scripts/deepfix2/flip-review-v2.mjs` + `scripts/deepfix2/engine-emulator-lap.mjs`
   (NEW) · `docs/plans/loop/` (r70 handoff, baton, ready marker, win files incl. this one) ·
   `change_action_log.md` · `AGENTS.md` if present.
2. Subject (verbatim):
   `deepfix2 dark build CODE-COMPLETE: the review-v2 engine (8 modules + 6 dormant callables + flip script), emulator lap 68/68`
   Standing trailer.
3. Push per standing rule; standard safety pass (serviceAccountKey/baselines stay local — verify nothing
   uid-bearing or credential-bearing stages; `/tmp` receipts are outside the repo).
4. NOTE for your review: everything is DARK BY CONSTRUCTION — `system_config/review_v2` is not deployed,
   no client routes to any callable, index.js's block only re-exports dormant handlers. Deploy happens
   only via your later dark-deploy order series after the checkpoint YES.
5. AFTER: STANDBY. Next orders you'll see: checkpoint-fold commits (if the reviewers force changes), then
   the dark-deploy series (functions/rules/indexes, all `enabled:false`, `rehearsalClassIds` resolver
   confirmed yours).

## WRITE
Review → `winclaude_082.md`; baton back with `execDecision` + SHA.
