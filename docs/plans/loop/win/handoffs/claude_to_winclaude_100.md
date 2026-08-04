# CLAUDE → WINCLAUDE — ORDER 100 (push the verified commits + the owed cutover-b visual check)

Two tasks. TASK 1 is a plain git push (backup — deploys NOTHING). TASK 2 is the owed flag-OFF visual check.

## TASK 1 — PUSH `main` to origin (backup only, NOT a deploy) — ⚠ MOVES ORIGIN FORWARD BY 17 COMMITS
Local `main` is **17 commits ahead of origin** — the 3 from this session PLUS ~14 from prior deepfix2
sessions that were never pushed. `git push origin main` moves ALL of them onto origin. This session's 3:
- `a7aadbf` — deepfix2 tooling (implementer/auditor agent-defs + `[>]` marker + save-state.sh)
- `9d73e98` — cutover-b-submit + namespace-reservation folds (BOTH auditor-verified GO; flag-gated behind
  `REVIEW_V2_CLIENT=false`; the namespace rules edit is committed but **NOT deployed** — prod rules unchanged)
- the operating-model finalize (CLAUDE.md + RESUME)
The ~14 prior commits are the accumulated local deepfix2 line (cutover-a, typed-fix-audit, rules work, etc.).
- **DO (only once David confirms the 17-commit push):** `git push origin main` (Windows-side — WSL cannot push).
- This backs up commits only. It deploys NOTHING (functions still `b54c6e5`; rules unchanged; folds behind a
  false flag). The production deploy is a SEPARATE, later, Codex-gated + David-authorized order.
- **REFUSAL:** if the push is REJECTED (non-fast-forward / conflict), STOP and report — do NOT force-push.

## TASK 2 — cutover-b flag-OFF VISUAL CHECK (the owed acceptance gate; queue item `cutover-b-visual`)
Prove the submit→grade→result path renders UNCHANGED flag-OFF (947 students are on this legacy path; the
new engine adapter is dead code while the flag is false).
- **25WT SANDBOX IDENTITIES ONLY, never 26SM** — the dev build writes to REAL production Firebase.
- **Do NOT flip `REVIEW_V2_CLIENT`** (stays false). Flag-ON verification is a separate later order.
- **Prefer an MCQ class** (typed tests bill real AI money). A day-start account hits the first-run
  "Customize Your Flashcards" modal — dismiss it EXPLICITLY (a selector behind it hangs silently, no error).
- **Drive end-to-end:** new-word test → submit → result card → review test → submit → result card.
  **Capture the console for the whole run** — ANY new error/warning is a finding even if the UI looks right.
- **Expected:** behavior identical to before cutover-b. The one known expected difference is NONE flag-off
  (the adapter only activates flag-ON).
- **REFUSAL:** if the dev server will not start, that is a REPORT, not something to fix. Do NOT edit source
  to make something render — if it does not render, that IS the finding.

## AFTER
Set the win baton `turnOwner=claude round=100 execDecision=<CLEAN|PASS_WITH_GAP|finding> updatedBy=winclaude`
with a PLAIN answer to: "does the flag-OFF submit→grade path render unchanged, with a clean console?" and
whether the push succeeded.
