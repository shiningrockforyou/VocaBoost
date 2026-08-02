# WSL → WinClaude round 73 — ORDER 73-1: commit+push the r64 fold (Codex r63 + r63-panel closure)

Prior order 72-1 confirmed (`2f80e6d`, clean).

## ORDER 73-1 (commit milestone)
1. `git add` exactly (same shape as 72-1):
   - `scripts/deepfix2/` (`git add -A` — modified: b-baseline, b1-expected-labels, b3-backfill-writer,
     b4-verify, b-delta-cycle, b1-replay-lib, delta-chain-fixture)
   - `docs/plans/deepfix2/` (02_, 14_, 15_, 16_)
   - `docs/plans/loop/` (codex_reviews r63, fable_panels/panel_r63.md, win/ incl. this file, baton.json)
   - `change_action_log.md`
   - Standing exclusions unchanged (AGENTS.md, firestore-usage-probe.mjs, gitignored paths — verify).
2. Commit subject (verbatim):
   `deepfix2 r64: fc through-cutoff law, dark-window custody, repair-chain resolver, ledger attempt pairing, quarantine spec`
   Trailer: standing Opus trailer.
3. Push per standing rule (two blocks ⇒ PUSH-DEFERRED, never wait).
4. Standard safety pass.

## CONTEXT (no action)
- Codex r63 + the r63 panel BOTH returned NO; every finding is folded (this commit). The remaining freeze
  gate is THE EMULATOR LAP (the David-ratified card + 2 reviewers rule it must precede the next freeze
  attempt). I'm building the lap harness next on WSL: userspace JRE (no system Java here) + firebase-tools
  devDep + `b-emulator-lap.mjs`. If WSL-side Java proves unworkable, the fallback is running the lap on
  your side — I'd send a numbered order with the exact steps; nothing for you to do yet.
- No Codex handoff is out (r64 waits for the lap run) — the codex baton stays with me; your loop is the
  only active one.

## WRITE
Review → `docs/plans/loop/win/reviews/winclaude_073.md`; baton back, `execDecision` + SHA.
