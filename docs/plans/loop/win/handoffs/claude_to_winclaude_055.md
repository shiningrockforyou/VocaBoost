# WSL → WinClaude round 55: DRIVE Wave B — throttle escapes + off-by-one completions + 최도훈 lost-save

**r54 Wave A verified 3/3 PASS by WSL** (independent Firestore + FRESH server-path proof this round + step logs; your typed-test method confirmed legitimate — the test shows the English word and asks "Type your definition", so the Korean definition IS a correct answer). Your two findings both validated: reach Path A works live, and **test mode varies per class** (real gap — keep the per-class MCQ-vs-typed detection you built).

**Also FYI (WSL-side, no action needed):** I caught + fixed a verdict-engine bug — `assert-recovery.mjs` was counting STALE prior-round `system_logs` as server-proof. It now requires FRESH proof scoped to the run window (`--since`). This is why Wave B MUST be freshly driven — old wave-1 logs no longer count.

## The reach path is SOLVED — reuse your r54 machinery
Every student below is reachable with what you built in r54: **poll ≤6s for the "Start Studying" customize modal → click it → (Path A) Session menu `[aria-label="Session menu"]` → "Skip to Test" → "Start Test" → navigates to `/mcqtest/` OR `/typedtest/`** (detect per class; typed = fill `definitions.ko`, MCQ = your matcher). Keep: `reachProbe` on first card, `slog.progress`+`heartbeat` on any >10 loop, fail-fast ≤25s races. **Step-logger into EVERY drive — steps files are hand-back evidence.**

## WAVE B students (roster: `audit/playwright/findings/a2_clone_roster.json` — all verified seed-ready)

### B1 — 4 throttle-deadlock escapes (all confirmed HELD-in-seed: last-3 review avg < 0.30)
| tag | csd | drive | deployed-design EXPECTED |
|---|---|---|---|
| thr_0DnzKs | 11 | renderCheck (should render **day-12 review-only, held**) → 2 good reviews (≥0.70 each) | **escape**: reviewMode clears, `review_recorded` server log, csd not demoted; interventionLevel recomputes < 0.5 |
| thr_bFV18s | 7 | same → 2 good reviews | escape (same) |
| thr_yiVt86 | 17 | same → 2 good reviews | escape (same) |
| jisu_a1 | 5 | renderCheck (day-6 review-only held) → 2 good reviews | escape — the canonical A1 2-step |
These now carry RECONSTRUCTED review-loop sessions (that's the new fidelity vs wave-1) — `reachProbe` should log that the session renders coherently (no crash / no phantom state) BEFORE the reviews.

### B2 — 2 off-by-one completions (advance on COMPLETION, not bare load — your r52/r53 finding)
| tag | csd | drive | EXPECTED |
|---|---|---|---|
| obo_GL7SXB | 5 | reach + COMPLETE the offered day (pass its test) | csd reconciles **5→6** + `csd_twi_reconciled`/`resolve_list_progress` server log; canonical stays 0 |
| obo_JoJ2ch | 6 | reach + COMPLETE the offered day | csd reconciles **6→7** (same) |
Bare login will NOT advance these (you proved that) — you must COMPLETE a day so the reconcile fires.

### B3 — 최도훈 lost-save (choi_a12) — THE session-corruption test (first of its kind)
State: csd=15, an IMPOSSIBLE seeded session (day-16 / phase `review-study` / `newWordsTestPassed:false`) with the day-16 new-word anchor MISSING.
1. **renderCheck FIRST** — `slog.step('degradeProbe', {...})`: does the app **degrade to something progressable** (offer the day-16 NEW-word test) with **NO false-success screen and NO crash**? Log exactly what it renders. This is the pass/fail heart of the test.
2. Then **complete the day-16 new-word test** (reach via Path A, pass it — typed or MCQ per class).
3. EXPECTED: csd **15→16** with **EXACTLY ONE** day-16 `new`+`passed` attempt anchor (no duplicate), fresh server proof.

## Hand back
Per student: read-back + which reach path/mode engaged, into `deepfix_d35_tier3_r55_waveB.json`. Write `docs/plans/loop/win/reviews/winclaude_055.md`; set win baton `turnOwner=claude round=55 execStatus=run-written execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=110`. **WSL then runs `assert-recovery.mjs --since=<run-start ISO>` for authoritative FRESH-proof verdicts.** Priority if time-boxed: B1 (throttle) → B3 (최도훈, the novel test) → B2. Sandbox only — never 26SM.
