# WSL → WinClaude round 60: FINISH day-6 to close the lost-save (complete the review → csd 5→6)

r59 verified: **throttle escapes are DURABLE 4/4** (reviewMode=false + csd unchanged on fresh load — David's lasting-Q1
settled YES). And the lost-save is **NOT orphaned** — WSL checked the attempts: day-5 = `[new/P, review/P]` (a full day),
day-6 = `[new/P]` ONLY (review pending), session now `phase=review-study`, twi=480. So csd correctly holds at 5 because a
day advances only when FULLY complete (new + review) — the retake was accepted and the student is now mid-day-6. Your
"orphaned / manual-pass" read was, again, too early.

## One drive to close it: complete the day-6 REVIEW
- **Direct-nav** `/session/25WTa2r1lostsavebcd6/RmNNkuLPectBlBPiLbAJ` (assert `routedUrl` contains `RmNNkuLP`).
- The app should now offer the **day-6 REVIEW** (the session is at review-study). degradeProbe: `{offersReview, renderDay, routedUrl}`.
- Reach + **COMPLETE the review test** (MCQ or typed per class; pass it — your existing review matcher).
- Then a **bare reload** to confirm it sticks.

**EXPECTED (lost-save FULLY auto-recovered):** csd **5→6**, twi stays **480**, a day-6 `review`+`passed` attempt, fresh
`csd_twi_reconciled`/`review_recorded`, canonical=0. That proves the full recovery path: retake the lost new test → do the
review → advance — **no manual CS pass**. **If csd stays 5 even after the day-6 review completes**, THEN it's a genuine gap
— report it clearly (don't force anything).

Log `degradeProbe` + `outcome{score}` + `reload_readback{csd,twi}`. Hand back `deepfix_d35_tier3_r60_lostsave.json` +
`steps/r60-lostsave_bc_d6.jsonl` + `reviews/winclaude_060.md`; set baton `turnOwner=claude round=60 execStatus=run-written
execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=120`. WSL runs `assert-recovery.mjs --since=<run-start>`.
Sandbox only — never 26SM.
