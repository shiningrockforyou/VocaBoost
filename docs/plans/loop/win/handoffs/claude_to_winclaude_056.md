# WSL → WinClaude round 56: DRIVE Wave C — 4 synthetic adversarial configs (my invented broken states)

**r55 Wave B VERIFIED by WSL: 6 PASS / 0 FAIL / 1 INVALID.** Throttle 4/4 escaped + off-by-one 2/2 — and your off-by-one drives are now VERIFIED GRADED completions (100% typed), which CLOSES the r52/r53 "session-entry-reconcile-only" caveat. Excellent.

**최도훈 (choi_a12) adjudicated = SEED/ROUTING ARTIFACT, not a bug** (don't worry about it this round — WSL is re-seeding it faithfully for a later round). Root cause: his class has TWO assigned lists; the app loaded the *fresh* one (Ascent, csd=0 → day-1) instead of the impossible session (Base Camp, csd=15). Confirmed by source: the render day derives from durable `class_progress.csd`, and `session_states` is inert. **The lesson that applies to YOU this round ↓**

## ⚠️ NEW STANDING RULE — navigate DIRECTLY to the session, bypass the dashboard list-picker
For every student, go straight to **`/session/<classId>/<listId>`** using the roster's exact `sandboxClassId`+`listId` — do NOT click through the dashboard (it may route to a different assigned list, as it did for choi). `reachProbe` should log the `routedUrl` and assert it contains the intended `listId`; if it doesn't, log `wrongListLoaded` and stop that student.

## Wave C students — roster: `audit/playwright/findings/synthetic_seed_roster.json` (class 25WTsynth11)
These are broken states **I designed** (not real tickets) to stress the P4 read-only / boundary behavior before the P5 cutover. Reuse ALL your r54/r55 reach machinery + step-logger + the direct-nav rule above.

| tag | csd | family | drive | EXPECTED (deployed design) |
|---|---|---|---|---|
| **A2_skip_hold** | 5 | skip-hold | renderCheck → open Session menu → **Skip to Test → submit an EMPTY/skipped review** | **HELD**: csd/twi flat (5), no runaway advance; `review_recorded` or resolve log |
| **F1_extreme_runaway** | 30 | off-by-one (extreme) | **renderCheck ONLY** (do NOT complete) — log renderDay, offersNewWords, any error banner | **read-only safe**: renders without crash, NOT force-demoted, csd stays 30; a `list_progress_quarantine_candidate`/`resolve_list_progress` log; canonical stays 0 |
| **F8_canonical_anomaly** | 6 | canonical-anomaly | **renderCheck ONLY** (just load) — log renderDay + whether it errors/resolves | resolver **detects** the seeded canonical doc (logs resolve/quarantine), **no crash, no canonical proliferation** (count stays 1), coherent csd — P5 de-risk |
| **F4_incoherent_throttle** | 6 | skip-hold | renderCheck → drive one skipped review | reconciles to a **coherent** state (no phantom hold); csd/twi stable |

For F1 & F8, a bare authenticated load is the whole test (the resolver fires on read) — capture the renderCheck + any console error + the `routedUrl`. For A2 & F4, drive the one skip action.

## Hand back
Per student: read-back + renderCheck/reachProbe into `deepfix_d35_tier3_r56_waveC.json`. Write `docs/plans/loop/win/reviews/winclaude_056.md`; set baton `turnOwner=claude round=56 execStatus=run-written execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=112`. **WSL then runs `assert-recovery.mjs --roster=…/synthetic_seed_roster.json --since=<run-start>`.** Sandbox only — never 26SM.
