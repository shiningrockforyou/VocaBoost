# WSL → WinClaude round 43: COMMIT EVERYTHING TOGETHER (David-authorized, post-D3-cert) + push

**David GO:** D3/P4 is CERTIFIED (r42, 10/10) → now commit the entire accumulated plan-of-record + convergence +
certification + evidence pile, which is currently **disk-only** (risk R-4). **This is a docs / audit-tooling /
evidence commit — it changes NO deployed client or functions behavior, so DO NOT run any `firebase deploy` or trigger
a Netlify rebuild of app code.** (featureFlags.js is already at `6bffe1c`, functions at `0ddbb34` — untouched here.)

## The CRLF hazard (do this cleanly — you flagged it at r37)
`.gitattributes = * text=auto` → a blind `git add -A` sweeps a repo-wide CRLF renorm storm + junk. Instead:
1. **`git add --renormalize .`** for the line-ending hygiene (the commit you flagged was needed).
2. **Targeted-add** the new plan-of-record / evidence / tooling:
   - `docs/plans/MASTER_TASK_LIST.md`, `docs/plans/MASTER_TASK_TRACKER.md`
   - `docs/plans/loop/CONVERGENCE_REPORT_v1.md`..`v4.md`, `docs/plans/loop/P4_CERT_INSTRUMENT_approach1.md`
   - `docs/plans/loop/handoffs/`, `docs/plans/loop/codex_reviews/`, `docs/plans/loop/ready/`, `docs/plans/loop/win/handoffs/`, `docs/plans/loop/win/reviews/`, both `baton.json`s
   - `audit/playwright/findings/deepfix_*` (r35–r42 incl. `deepfix_p4_behavioral_cert_0ddbb34.json`), `audit/playwright/lsr_deepfix_p4cert.mjs`, the other new audit scripts under `audit/`
   - `scripts/cs/scan-syslog-since.mjs`, `scripts/cs/scan-canonical-writepath.mjs`
   - `RESUME.md`, `docs/resume_archive/RESUME_2026-07-18.md`, `change_action_log.md`, `SUPPORT_RUNBOOK.md`
3. **EXCLUDE junk + secrets:** do NOT stage `.firebase/`, `agent_logs/`, `ai_*.json`, or any `.env*` / `serviceAccountKey.json` / `.lsr_secret.json` (all should be gitignored — **verify the final staged list has zero secrets**).
4. One commit is fine (David said "together"); split renormalize-hygiene vs content into 2 commits if that's cleaner — your call — but push them together.

## Commit + push
- On `main` (never branch). Message e.g. *"Post-crash recovery + 5-way convergence + D3/P4 behavioral certification (docs/evidence/audit-tooling; no deployed-code change)"* + the Co-Authored-By trailer.
- `git push` origin main. **No deploy.**

## Hand back
Report: the commit sha(s), a one-line summary of what landed, confirmation **zero secrets staged**, and the final
`git status` (should be clean or only-intentionally-unstaged). Write `docs/plans/loop/win/reviews/winclaude_043.md`;
set win baton `turnOwner=claude round=43 execStatus=run-written execDecision=<PUSHED|BLOCKED> updatedBy=winclaude revision=86`.
