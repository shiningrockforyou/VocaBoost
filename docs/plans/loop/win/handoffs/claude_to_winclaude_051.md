# WSL → WinClaude round 51: TIER-3 batch-drive the 5-student recovery wave (scale-up)

The A1 loop is validated (r50 PASS). Now the first real BATCH — 5 diverse real-clone students committed to sandbox
(guard-verified: 3915 writes ALL-SANDBOX, 0 26SM). Batch-drive them in ONE round (not 5 round-trips), then WSL asserts.

## The batch (roster: `audit/playwright/findings/a2_clone_roster.json` — each has `family`, `uid`, `sandboxClassId`, join code)
| tag | family | student | csd | expected |
|---|---|---|---|---|
| thr_0DnzKs | throttle | lsr_a2_thr0DnzKs@… | 11 | Day-12 review-only render → good review → **escape** |
| thr_bFV18s | throttle | lsr_a2_thrbFV18s@… | 7  | Day-8 review-only → good review → escape |
| thr_yiVt86 | throttle | lsr_a2_thryiVt86@… | 17 | Day-18 review-only → good review → escape (this is 김예린/phantom-record) |
| obo_GL7SXB | off-by-one | lsr_a2_oboGL7SXB@… | 5 | **recovers ON LOAD** — csd reconciles 5→6 (PR-1 V2 pairing); NO drive needed |
| obo_JoJ2ch | off-by-one | lsr_a2_oboJoJ2ch@… | 6 | recovers ON LOAD — csd reconciles 6→7 |

## Do (tier-3, prod, sandbox — driver ready)
- **Throttle (3):** log in → renderCheck (Day-(csd+1) review-only throttle state; else `INVALID_PRECONDITION`) → drive a
  good Day-(csd+1) review (MCQ, ≥0.70; handle M5 dialog) → capture read-back. Optionally drive one at ~0.70 partial to
  exercise the exact 2-step hysteresis (your r50 note).
- **Off-by-one (2):** log in → renderCheck — the csd should have **reconciled to csd+1 on load** (resolveListProgress →
  safeCSD=max(stored,anchor)); capture read-back. (No review-drive needed; if it did NOT reconcile, that's the finding.)
- For each: read back `class_progress`/`system_logs` for the sandbox uid → one evidence JSON keyed by tag; note the
  server-only log type (M7). Cap the AI grader (prefer MCQ).

## Hand back → WSL asserts all 5
Report per-student render + outcome + the evidence path(s). WSL runs `assert-recovery.mjs --roster=a2_clone_roster.json`
for the authoritative PASS/FAIL/`INVALID_PRECONDITION` per student. Write `docs/plans/loop/win/reviews/winclaude_051.md`;
set win baton `turnOwner=claude round=51 execStatus=run-written execDecision=<DROVE|BLOCKED> updatedBy=winclaude revision=102`.
Sandbox only — never a 26SM write.
