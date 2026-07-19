# WSL → WinClaude round 58: TWO fidelity re-tests (David-directed) — faithful throttle hysteresis + mid-list lost-save

Context: David's skepticism ("do the passes represent LASTING desired behavior?") surfaced two fidelity flaws WSL fixed:
1. **Throttle escapes were a seed artifact** — seeds left `reviewMode` unset, so students escaped on ONE review (dead-band
   persisted the wrong prior-mode). RE-SEEDED faithfully with `reviewMode=true`+`interventionLevel=1.0`.
2. **최도훈 lost-save was un-retakeable** on his trimmed 1200-word list. NEW mid-list lost-save seeded where the day's words
   genuinely exist.
Also fixed a **class-collision bug** (all students had been crammed into shared classes `25WTa2r11..`); every student below
is now in its OWN dedicated class. **Direct-nav is mandatory** (assert `routedUrl` contains the listId).

## TEST A — Faithful throttle hysteresis (4 students). The point: prove it takes TWO good reviews, not one.
Each is now seeded `reviewMode=true`+`interv=1.0` (a REAL throttled student). Deployed hysteresis = exit only when last-3
review avg > 0.50. One good review lands the avg in the dead-band (~0.49) → must STAY held; the second pushes it >0.50.

| tag | direct-nav URL | protocol |
|---|---|---|
| thr_0DnzKs | `/session/25WTa2r1thr0DnzKs/RmNNkuLPectBlBPiLbAJ` | renderCheck→ **review #1 (≥0.90)** → **READ-BACK** → **review #2 (≥0.90)** → READ-BACK |
| thr_bFV18s | `/session/25WTa2r1thrbFV18s/RmNNkuLPectBlBPiLbAJ` | same |
| thr_yiVt86 | `/session/25WTa2r1thryiVt86/RmNNkuLPectBlBPiLbAJ` | same |
| jisu_a1 | `/session/25WTa2r1jisua1/dVliNv0p9jqZYp9rfLpN` | same |

**EXPECTED (the faithful result):**
- renderCheck → **HELD** (review-only).
- **After review #1 → STILL HELD** (`reviewMode` still true, csd flat). ← the assertion that was FALSE before the fix.
- **After review #2 → ESCAPED** (`reviewMode` false, csd flat), `review_recorded` server proof.
- Log the read-back `{reviewMode, csd, interventionLevel}` after EACH review as its own step. If it escapes after #1, that
  reproduces the artifact (report it) — but with the faithful seed it should hold.

## TEST B — Mid-list lost-save (day's words EXIST → genuinely retakeable)
`lostsave_bc_d6` — Base Camp Day-6 lost-save (황정민-type): csd=5, twi=400, **day-6 new anchor MISSING**, corrupted day-6
review-study session. Day-6 words are indices 400-479 — they EXIST (list has 1200), so the retake is real.
- **Direct-nav** `/session/25WTa2r1lostsavebcd6/RmNNkuLPectBlBPiLbAJ`.
- degradeProbe: does it **offer the Day-6 NEW test**? (renderDay, offersNewWords, falseSuccess=false, crashed=false, routedUrl).
- Reach + **COMPLETE the Day-6 new test** (typed per class; pass ≥92%).
- **EXPECTED (auto-recovery):** csd **5→6**, twi **400→480**, EXACTLY ONE day-6 `new`+`passed` anchor, fresh
  `csd_twi_reconciled`/`new_word_test_recorded`, canonical=0, no duplicate. **If it holds without offering the retake** →
  report it (means the fix doesn't auto-recover even when words exist).

## Hand back
`deepfix_d35_tier3_r58_refidelity.json` + `steps/r58-*.jsonl` + `reviews/winclaude_058.md`; set baton `turnOwner=claude
round=58 execStatus=run-written execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=116`. WSL runs
`assert-recovery.mjs --since=<run-start>`. Sandbox only — never 26SM.
