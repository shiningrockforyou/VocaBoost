# WSL → WinClaude round 59: bare-reload LASTING check (fast) — throttle stays escaped + lost-save csd advances

r58 verified by WSL: **TEST A faithful throttle = 4/4 REAL 2-step PASS** (your step logs are the proof: readback_after_review_1
reviewMode=true → still held; readback_after_review_2 reviewMode=false → escaped). **TEST B correction:** the day-6 retake
DID persist a **valid anchor** (nwsi=400/nwei=479/wordsIntroduced=80/score=100) and the session self-corrected to
new-words-study — so the recovery UI worked; your "0 anchors / no recovery" read was just too early (async write). What's
unconfirmed is the **csd/twi advance**, which (like off-by-one) reconciles on the NEXT load, not in-session.

This round is a FAST bare-reload check (no test-taking) to settle two "lasting" questions David raised:

## Just LOG IN and LOAD each session, read back, done. NO reviews, NO tests. (direct-nav, assert routedUrl)
| tag | direct-nav URL | read-back → EXPECTED |
|---|---|---|
| lostsave_bc_d6 | `/session/25WTa2r1lostsavebcd6/RmNNkuLPectBlBPiLbAJ` | **csd should now be 6** (was 5) + twi **480** (was 400) — the valid day-6 anchor reconciles on this load. If csd stays 5 → the anchor is orphaned (real gap, manual pass needed). |
| thr_0DnzKs | `/session/25WTa2r1thr0DnzKs/RmNNkuLPectBlBPiLbAJ` | reviewMode still **false** (escape is LASTING across a fresh load), csd 11 |
| thr_bFV18s | `/session/25WTa2r1thrbFV18s/RmNNkuLPectBlBPiLbAJ` | reviewMode still **false**, csd 7 |
| thr_yiVt86 | `/session/25WTa2r1thryiVt86/RmNNkuLPectBlBPiLbAJ` | reviewMode still **false**, csd 17 |
| jisu_a1 | `/session/25WTa2r1jisua1/dVliNv0p9jqZYp9rfLpN` | reviewMode still **false**, csd 5 |

Per student log one `reload_readback` step: `{tag, csd, twi, reviewMode, routedUrl}`. Just: login → goto the URL →
wait for the session to settle (poll ≤8s past "Preparing your session...") → read class_progress → next. Fast.

## Hand back
`deepfix_d35_tier3_r59_reload.json` + `steps/r59-*.jsonl` + `reviews/winclaude_059.md`; set baton `turnOwner=claude
round=59 execStatus=run-written execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=118`. WSL runs
`assert-recovery.mjs --since=<run-start>`. Sandbox only — never 26SM.
