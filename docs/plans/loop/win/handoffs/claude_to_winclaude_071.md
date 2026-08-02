# WSL → WinClaude round 71 — ORDER 71-1: commit+push the r62 closure batch

Prior order 70-1 confirmed received (SHA `5ff7fda`, both deviations logged; David resolved the trailer
question in-session — Opus trailer stands; push-block risk noted and this order is planned per your guidance:
**nothing downstream blocks on the push landing** — commit locally, attempt push, report either way).

## ORDER 71-1 (commit milestone)
1. `git add` exactly:
   - `scripts/deepfix2/` (whole dir — includes NEW `delta-chain-fixture.mjs`, `b-delta-cycle.sh`, and the
     modified `b-baseline.mjs`, `b1-expected-labels.mjs`, `b3-backfill-writer.mjs`, `b4-verify.mjs`,
     `b1-replay-lib.mjs`, `rotation-cyclicity-fixture.mjs`)
   - `docs/plans/deepfix2/` (02_, 10_, 11_, 14_, 15_, 16_, evidence/)
   - `docs/plans/loop/handoffs/` `docs/plans/loop/codex_reviews/` `docs/plans/loop/ready/`
     `docs/plans/loop/baton.json`
   - `docs/plans/loop/win/` (baton, handoffs, reviews — including this file)
   - `audit/deepfix/task3/firestore.review_v2.rules`
   - `change_action_log.md`
   - EXCLUDE: `AGENTS.md` (still not ours to stage), anything under `audit/deepfix/trackB_baselines/`
     (gitignored anyway), `scripts/serviceAccountKey.json` (gitignored — verify with `git check-ignore`).
2. Commit subject (verbatim):
   `deepfix2 r62: delta-chain closure — txn writer, bounded memory, integration fixture, ledger, doc-law`
   Trailer: the Opus trailer per David's standing resolution.
3. `git push origin main` — if the classifier blocks it twice, STOP pushing, keep the local commit, note
   `PUSH-DEFERRED` in your review, and return the baton. Do NOT wait for David.
4. Your own pre-push safety pass (as at 70-1): secret-scan the staged set; confirm gitignore holds for
   trackB_baselines/ + serviceAccountKey.json.

## CONTEXT (no action)
- r62 freeze attempt is LIVE: Codex holds the baton (round 62) + a 3-Fable panel runs simultaneously.
- The r60-gated orders (emulator matrix, dark deploy w/ the `rehearsalClassIds` resolver deliverable) remain
  QUEUED behind the freeze-YES — unchanged.

## WRITE
Review → `docs/plans/loop/win/reviews/winclaude_071.md`; baton back with `execStatus:"review-written"`,
`execDecision:"PUSHED"` or `"PUSH-DEFERRED"` + the SHA.
