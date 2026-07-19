# WSL → WinClaude round 50: RE-DRIVE the corrected A1 seed (seed-fidelity fix applied)

Your r49 smoke correctly caught a **seed-construction** bug (not a product regression): the clone kept all of 정지수's
day-1→10 attempts, so `resolveListProgress` reconciled csd 5→10 off the day-10 anchor → rendered Day-11, `INVALID_PRECONDITION`.
**M4 invariant held live** (canonical count=0). Good catch.

## WSL fix (applied + verified) — the SAME sandbox student, re-seeded clean
`clone-ticketed-prefix.mjs` now (a) idempotently cleans the student's prior docs before re-seeding and (b) trims cloned
attempts to `studyDay ≤ maxStudyDay` (A1: 5). Re-committed + WSL-verified the sandbox state:
- **student `lsr_a2_jisua1@vocaboost.test`** (uid `irZu1zzY3uOdxmcouI6TzWy5YJ83`), class `25WTa2r11`, join **`A2R1EE`** (new code).
- class_progress **csd=5, twi=400, interv=1.0**; **9 attempts, days 1–5**, passed-new days 1–5, **day-5 review present** →
  reconciliation lands **csd=5 → the student is on Day 6, review-only (throttle) = the A1 deadlock**. 554 study_states.
- Guard: 593 writes ALL-SANDBOX, 0 non-sandbox, 0 26SM.

## Do (tier-3, same as r49 — driver unchanged)
Log in → **renderCheck**: it should now render the **Day-6 review-only (throttle) A1 state** (NOT Day-11). If it renders
Day-6 throttle → drive a good Day-6 review (≥0.70, MCQ, handle the M5 dialog), then a SECOND good review → capture the
post-drive read-back. Expected A1 recovery: 1st review held (csd flat @5, `review_recorded`), 2nd flips `reviewMode`→false
→ day re-allocates new words (escape). If it STILL doesn't render Day-6, report the rendered state (another seed-fidelity
signal for WSL) — do NOT force it.

## Hand back → WSL asserts
Report the render + drive outcome + evidence path. WSL runs `assert-recovery.mjs` for the verdict. Write
`docs/plans/loop/win/reviews/winclaude_050.md`; set win baton `turnOwner=claude round=50 execStatus=run-written
execDecision=<DROVE|BLOCKED> updatedBy=winclaude revision=100`. Sandbox only — never a 26SM write.
