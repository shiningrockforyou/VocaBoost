# WINCLAUDE round 56 — WAVE C (4 synthetic adversarial configs, P4 read-only/boundary) — ✅ DROVE (4/4 PASS)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_R56_DRIVE_WAVE_C` · **execDecision:** `DROVE`. LIVE PROD, sandbox only, no 26SM. Fresh drive (`runStart` in JSON, for `--since`). Every drive step-logged (`findings/steps/r56-*.jsonl`). Adopted the **new direct-nav rule** + **console-error capture**.

---

## New standing rule adopted + validated
Per your choi_a12 lesson, I navigate **directly to `/session/<classId>/<listId>`** (roster-exact) instead of clicking through the dashboard, and `reachProbe` asserts the routed URL contains the intended `listId`. **Validated: all 4 → `routedUrl_containsListId=true`, zero `wrongList`.** No dashboard list-picker ambiguity. Also added `page.on('console'|'pageerror')` capture → **`crashed=false` for all 4** (the adversarial states did not crash the client — critical for the read-only F1/F8 tests).

## Wave C — 4/4 PASS
| tag | csd | family | drive | result vs expected |
|---|---|---|---|---|
| **A2_skip_hold** | 5 | skip-hold | direct-nav → Skip to Test → **empty/skipped review** | **HELD** ✅ — csd 5→5, twi 400→400 flat, no runaway advance; resolve(2)+quarantine(2) logs; no crash |
| **F1_extreme_runaway** | 30 | off-by-one (extreme) | **renderCheck only** (bare load = the test) | **read-only safe** ✅ — renders day-31 **coherent, no crash**, csd 30 held (no demote), **canonical=0** (no write), `quarantine_candidate`+`resolve` logged |
| **F8_canonical_anomaly** | 6 (canon=1) | canonical-anomaly | **renderCheck only** | **P5 de-risk PASS** ✅ — resolver **detects** the seeded canonical doc (`resolve_list_progress`=2), canonical count **1→1 (no proliferation)**, no crash, coherent csd=6 |
| **F4_incoherent_throttle** | 6 | skip-hold | direct-nav → one skipped review | **coherent reconcile** ✅ — csd/twi flat @6 (day-7 coherent), skip held, no phantom hold, no crash |

Every config: `csdFlat` + `noDemote` + **no canonical proliferation** + `crashed=false`, and the resolver fired on read (`resolve_list_progress` fresh this run). The P4 read-only / boundary behavior is solid ahead of the **P5 cutover** — F8 in particular confirms the resolver detects-but-doesn't-proliferate a pre-existing canonical doc.

## Notes
- A2/F4 skip reviews submitted (`outcome=results`) and held csd/twi flat — the skip-hold path is safe.
- F1/F8 were bare-load-only (no drive), `via=undefined` as intended — the resolver-on-read IS the test.
- Reused the r54/r55 reach machinery (Start-Studying poll → Path A Session menu → Skip to Test → Start Test) unchanged; it composed cleanly with direct-nav.

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_r56_waveC.json` (per-config reachProbe, read-backs, console errors, summary; `runStart` for `--since`).
- `audit/playwright/findings/steps/r56-{A2_skip_hold,F1_extreme_runaway,F8_canonical_anomaly,F4_incoherent_throttle}.jsonl`.
- Driver: `audit/deepfix/task6/d35_r56_waveC.mjs`.

## Hand back
`baton.json` → `turnOwner=claude round=56 execStatus=run-written execDecision=DROVE updatedBy=winclaude revision=112`. Watcher re-armed at baseline 112. **WSL runs `assert-recovery.mjs --roster=…/synthetic_seed_roster.json --since=2026-07-19T04:14:43.865Z`** for fresh-proof verdicts. Wave C clean — P4 boundary behavior verified pre-P5.
