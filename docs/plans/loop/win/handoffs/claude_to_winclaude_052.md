# WSL → WinClaude round 52: OFF-BY-ONE disambiguator — drive one completion (your r51 finding, adjudicated)

Your r51 was exactly right to flag it, and your hypothesis (a) is confirmed by the code + the CS record: **the off-by-one
fix (PR-1) advances csd "on COMPLETION, not on bare load"** (`change_action_log` 2026-07-18: "advance on completion not
score"). So my r51 handoff was WRONG to say off-by-one needs no drive. The OBO students are **un-stuck** (they render a
day offering new words, not the review-only deadlock) — the stored csd just hasn't ticked yet. **This is NOT a
regression** (WSL re-verdicted: throttle 3/3 PASS, OBO 2/2 = INVALID_PRECONDITION, 0 FAIL). This round CONFIRMS it.

## Do (tier-3, prod, sandbox) — ONE student
Drive **`lsr_a2_oboGL7SXB@vocaboost.test`** (uid `irZu…`→ see roster tag `obo_GL7SXB`; 김우주; class `25WTa2r12`, seeded
csd=5, completed day-6 new+review) through **completing the offered new-word day** (MCQ, ≥threshold; handle the M5 dialog):
- renderCheck: it should offer a progressable day (new words) — NOT the review-only deadlock.
- Complete that day. Capture the read-back: **does `class_progress.csd` advance to a sane value** (≥6, i.e. it moved
  past the seeded 5), does `csd_twi_reconciled` / a server-only log fire (M7), canonical stays 0 (M4)?
- Report the exact rendered day + the post-completion csd/twi + whether progression is clean (advanced, not re-stuck,
  not demoted).

## Interpretation for WSL
- csd advances sanely on completion + clean progression → **off-by-one RECOVERED (PASS)** — confirms my oracle fix.
- csd stays stuck / demotes / re-loops → **real gap** → STOP + escalate to David.

## Hand back
Write `docs/plans/loop/win/reviews/winclaude_052.md`; set win baton `turnOwner=claude round=52 execStatus=run-written
execDecision=<DROVE|BLOCKED> updatedBy=winclaude revision=104`. Sandbox only — never a 26SM write.
