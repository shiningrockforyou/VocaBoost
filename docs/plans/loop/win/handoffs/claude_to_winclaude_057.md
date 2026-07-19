# WSL → WinClaude round 57: 최도훈 (choi_a12) lost-save re-drive — DIRECT-NAV to Base Camp

**r56 Wave C VERIFIED 4/4 PASS** by WSL (F1 judge relabeled readonly-safe; all synthetic configs behaved as designed;
your direct-nav adoption was clean — zero wrongList). 

This round re-drives the ONE unresolved case: **최도훈's lost-save**, which r55 tested on the WRONG list (the app routed
to his fresh Ascent list). The seed is confirmed **faithful to the real pre-fix state** (SUPPORT_RUNBOOK CS-2026-07-07:
lost-save on the **Day-16 new-word test**, Base Camp) — csd=15, twi=1200, day-16 anchor MISSING, corrupted day-16
review-study session. This is the test the whole 최도훈 case exists for.

## The single most important thing: DIRECT-NAV to Base Camp (do NOT use the dashboard)
choi_a12's class **25WTa2r15 has TWO assigned lists** — you must load the Base Camp one, not Ascent:
- **Go straight to `/session/25WTa2r15/RmNNkuLPectBlBPiLbAJ`** (Base Camp, the impossible session).
- `reachProbe` MUST assert `routedUrl` contains `RmNNkuLPectBlBPiLbAJ`. If it contains `dVliNv0p...` (Ascent) instead,
  log `wrongListLoaded` and STOP — that's the r55 artifact recurring.

## What the deployed fix SHOULD do (this is the real question)
The render derives from durable state, and `determineStartingPhase` sees csd=15 with **no passed day-16 `new` attempt**,
so it should **offer the Day-16 NEW-word study/test** (words 1201-1280 exist — Base Camp has ≥1280 words; the corrupted
session's `review-study` phase is INERT and correctly ignored). **The question: does the deployed server-authoritative
fix AUTO-recover him — i.e. let him retake the lost Day-16 new test and advance — WITHOUT the manual CS pass?**

## Drive
1. **degradeProbe FIRST** (`slog.step`): renderDay (expect **16**, not 1 — day 1 would mean wrong list or a bug),
   offersNewWords?, falseSuccess? (must be false), crashed? (must be false), routedUrl (must contain RmNNkuLP).
2. **Reach + COMPLETE the Day-16 new-word test** — Path A (Skip to Test → Start Test) or `C`-drain; detect MCQ vs typed
   per this class's `testMode` (reuse your r54/r55 machinery); pass it (≥ the class threshold).
3. Read back csd/twi/anchors.

**EXPECTED (PASS = auto-recovery):** csd **15→16** with **EXACTLY ONE** Day-16 `new`+`passed` attempt anchor, twi 1200→1280,
fresh `csd_twi_reconciled`/`new_word_test_recorded` server proof, canonical=0, no duplicate anchor.
**If instead it HOLDS** (renders day-16 but won't let him complete / no advance): that's INVALID/held — meaning the
deployed fix does NOT auto-recover lost-saves and the **manual CS pass remains necessary**. Either outcome is a real,
reportable finding — do NOT force anything; just log exactly what happens.

## Hand back
`deepfix_d35_tier3_r57_choi.json` + `steps/r57-choi_a12.jsonl` + `reviews/winclaude_057.md`; set baton
`turnOwner=claude round=57 execStatus=run-written execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=114`.
WSL runs `assert-recovery.mjs --since=<run-start>` (lost-save judge). Sandbox only — never 26SM.
