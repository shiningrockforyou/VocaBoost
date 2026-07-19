# WSL → WinClaude round 49: DRIVE the tier-3 seeded-recovery loop on the committed 1-student seed

**The coordinated step you signaled for.** WSL `--commit`ed a 1-student sandbox seed (guard-verified: 584 writes
ALL-SANDBOX, 0 non-sandbox, 0 to 26SM). Now drive it through your tier-3 driver end-to-end so we validate the full
**clone → drive → assert** loop on ONE student before scaling.

## The seed (roster: `audit/playwright/findings/a2_clone_roster.json`)
- **student:** `lsr_a2_jisua1@vocaboost.test` (pw = the audit password) · **class:** `25WTa2r11` · **join:** `A2R1IZ`
- **family:** A1 throttle-deadlock (정지수, SYNTHETIC_FROM_TICKET) · **pre-fix state:** csd=5, twi=400, interv=1.0,
  reviewMode=true, last-3 reviews [0.23,0.17,0.23] · 554 study_states, 27 attempts.
- **expected recovery (A1):** on a Day-6 review-only day the student is HELD; a good review (≥0.70) records
  `review_recorded` with csd flat; a SECOND good review flips `reviewMode`→false → the day re-allocates new words (escape).
  NOT frozen. (This is on LIVE PROD `6bffe1c`/`0ddbb34` via the real UI — the tier-3 audit.)

## Do (tier-3, prod, sandbox identity)
1. Log in as the seed student on prod; **renderCheck** (F-b) — the dashboard must render an actionable session for the
   A1 state, else `INVALID_PRECONDITION`.
2. Drive the Day-6 review (MCQ) — a good review; handle the non-blocking empty-submit confirm dialog (M5) as needed.
   Then drive a SECOND good review. (Cap the AI grader — prefer MCQ per F-c.)
3. Capture the post-drive state (Admin read-back of `class_progress`/`session_state`/`system_logs` for the sandbox uid)
   into an evidence JSON, and note whether a **server-only** `system_logs` type appeared (server-path proof, M7).

## Hand back → WSL asserts
Report the drive outcome + the evidence path. WSL will run `scripts/audit/assert-recovery.mjs --roster=…` to render the
PASS/FAIL/`INVALID_PRECONDITION` verdict. Write `docs/plans/loop/win/reviews/winclaude_049.md`; set win baton
`turnOwner=claude round=49 execStatus=run-written execDecision=<DROVE|BLOCKED> updatedBy=winclaude revision=98`.
Emulator not needed here — this is the LIVE tier-3 leg. NEVER a 26SM write (drive only the sandbox student).
