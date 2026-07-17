# WSL-Claude → WinClaude round 30: PR-1 flag-ON dev-E2E (pre-flip UI evidence gate)

**Context:** CS PR-1 (the 14-stuck-students fix) is **Codex-GO'd** (round 12, `codex_review_pr1_002.md`) and the
fail-closed ship-gate census **PASSED** on the ship build (13/14 drain, 0 false-pairs). Codex's one remaining
pre-flip requirement is **UI/audit evidence on the exact flag-ON build.** This round produces it. David has
authorized full-auto + you are autonomous on deploys — but **this round is dev-server only, NO deploy yet.**

## Sandbox seeded for you (WSL, prod Firebase, sandbox identities — NEVER real students)
Three accounts reproduce PR-1's exact target shape (stale `session_state` phase=complete + reviewTestScore=0,
inflated csd) — real student states dup'd onto renamed sandbox copies:
- `dup_repro_a@vocaboost.test` (class `DUP_repro_Nys1FfB9Pkl1iyO5FYhx`, join `DRIKDN`)
- `dup_repro_b@vocaboost.test` (class `DUP_repro_k0j59bXvvtedgqi98apt`, join `DRX7W9`)
- `dup_repro_c@vocaboost.test` (class `DUP_repro_sO7jN85mL5ZsaBY1BbGm`, join `DRI8M0`)
Password: `audit/playwright/.lsr_secret.json`. These exercise all three PR-1 client legs (pairing readers +
re-entry guard + recovery guard). The pairing LOGIC itself is already census-certified on real data; this run
validates the flag-ON **client render/routing/UX**.

## Task — flag-ON dev server against PROD Firebase (NOT emulator)
1. In `src/config/featureFlags.js` set the 3 PR-1 flags TRUE: `REVIEW_PAIRING_V2`, `REENTRY_GUARD`,
   `RECOVERY_GUARD`. Run the Vite dev server (`npm run dev`, localhost:5173) pointed at **prod Firebase**
   (do NOT set VITE_USE_EMULATOR — these are prod sandbox accounts). **Guaranteed-restore:** flags back to
   `false` + `git diff --stat` on `src/config/featureFlags.js` empty at the end (the PR-1 diff on the OTHER
   src files is WSL-Claude's uncommitted work — leave it; only your temporary flag flip must be reverted).
2. Drive full-UI as a student (Playwright) for each `dup_repro_*` account:
   - **(a) Re-entry guard** — login → dashboard → start the day. EXPECT: no auto-complete dead-end / infinite
     "loading→complete" trap; the retake queue populates (buildReviewStudySet) and a real review is playable.
   - **(b) Pairing + advance** — complete the day's review. EXPECT: the previously-unpaired review renders,
     grades, and the day ADVANCES (csd increments; no re-freeze).
   - **(c) Recovery guard** — if a mid-session resume occurs, EXPECT intersected saved answers (no >100% score,
     no out-of-range index; empty intersection → fresh start).
3. **Flag-OFF sanity (one account):** flip the 3 flags back false, reload, confirm the LEGACY dead-end
   reproduces — proves the flags actually gate the behavior (byte-equivalence attestation).

## Discipline
SANDBOX ONLY (`dup_repro_*` / `lsr_*` / 25WT), NEVER 26SM real students. Executor-only — no source edits beyond
the temporary flag flip (report anything needing a code fix; WSL-Claude fixes it). No commit/push/deploy this round.

## Hand back
Per-account/per-step PASS/FAIL + `findings/deepfix_pr1_dev_e2e_r30.{json,md}` + screenshots (dashboard / session /
advance / re-entry). If the flag-ON dev-server choreography is blocked, say precisely what command failed — don't
improvise. Write `docs/plans/loop/win/reviews/winclaude_030.md`; set win baton `turnOwner=claude round=30
execStatus=run-written execDecision=<PASS|FAIL|BLOCKED> updatedBy=winclaude revision=60`.
