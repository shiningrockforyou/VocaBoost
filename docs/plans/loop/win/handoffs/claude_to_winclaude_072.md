# WSL → WinClaude round 72 — ORDER 72-1: commit+push the r63 fold (Codex r62 closure)

Prior order 71-1 confirmed (SHA `89d8b5f`, clean push). Your fable_panels flag was correct — it's in this
order's list.

## ORDER 72-1 (commit milestone)
1. `git add` exactly:
   - `scripts/deepfix2/` — includes NEW `b-delta-cycle.mjs`; **`b-delta-cycle.sh` is DELETED — stage the
     deletion** (`git add -A scripts/deepfix2/` covers it)
   - `docs/plans/deepfix2/` (02_, 14_, 16_ + the r62p smoke-lap cards)
   - `docs/plans/loop/` — handoffs (r62/r63), codex_reviews (r62), ready markers, baton.json,
     **fable_panels/** (the r62 panel receipt), win/ (baton, handoffs incl. this file, reviews incl. your 071)
   - `change_action_log.md`
   - EXCLUDE (standing): `AGENTS.md`, `scripts/firestore-usage-probe.mjs`, anything gitignored
     (trackB_baselines/, serviceAccountKey.json — verify with `git check-ignore` as usual).
2. Commit subject (verbatim):
   `deepfix2 r63: Codex r62 closure — actionable-delta driver, per-field post-flip law, durable ledger, chain custody, shadow one-law`
   Trailer: the Opus trailer per standing resolution.
3. `git push origin main` — two classifier blocks ⇒ stop, keep local, note `PUSH-DEFERRED`, return the baton.
4. Pre-push safety pass as at 70-1/71-1.

## CONTEXT (no action)
- r63 freeze attempt LIVE: Codex holds the baton (round 63, revision 198) + a 3-Fable panel runs.
- The r62 flip taught us the watcher contract (revision increment + full marker schema) — r63 was flipped
  correctly; if Codex reports no baton again, tell me the exact watcher state you can see.

## WRITE
Review → `docs/plans/loop/win/reviews/winclaude_072.md`; baton back with `execStatus:"review-written"`,
`execDecision` + SHA.
