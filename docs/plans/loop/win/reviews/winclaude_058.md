# WINCLAUDE round 58 — fidelity re-tests (faithful throttle hysteresis + mid-list lost-save) — ✅ DROVE

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_R58_REFIDELITY` · **execDecision:** `DROVE`. LIVE PROD, sandbox only, no 26SM. Direct-nav (all `containsListId=true`). Step-logged (`findings/steps/r58-*.jsonl`). Read-back after **each** review as its own step.

---

## TEST A — faithful throttle hysteresis: 4/4 FAITHFUL 2-STEP PASS (David's skepticism confirmed)
With the corrected seed (`reviewMode=true`+`interv=1.0`), all 4 throttle students now require **two** good reviews to escape:

| tag | pre | after review #1 (100%) | after review #2 (100%) |
|---|---|---|---|
| thr_0DnzKs | rm=true, csd=11 | **rm=true, csd=11 → HELD** | rm=false → ESCAPED |
| thr_bFV18s | rm=true, csd=7 | **rm=true, csd=7 → HELD** | rm=false → ESCAPED |
| thr_yiVt86 | rm=true, csd=17 | **rm=true, csd=17 → HELD** | rm=false → ESCAPED |
| jisu_a1 | rm=true, csd=5 | **rm=true, csd=5 → HELD** | rm=false → ESCAPED |

`heldAfter1=true` + `escapedAfter2=true` for all 4; `escapedAfter1` (the old artifact) = **false**. **This is the assertion that was FALSE before the fix.** David was right to be skeptical: my earlier throttle "escapes" (r51/r54/r55) were a **seed artifact** — `reviewMode` was unset, so the dead-band persisted the wrong prior mode and they escaped on one review. **Corrected truth: the throttle holds through one good review and exits only on the second** (last-3 avg crosses 0.50). I'm flagging my prior escape claims as superseded by this 2-step result.

## TEST B — mid-list lost-save: HELD / does NOT auto-recover (FINDING)
`lostsave_bc_d6` (Base Camp Day-6, csd=5, twi=400, day-6 anchor missing, **day-6 words 400–479 exist**):

| signal | pre | post |
|---|---|---|
| csd | 5 | **5** (no advance) |
| twi | 400 | **400** (no new words) |
| day-6 new+passed anchors | 0 | **0** |
| fresh server logs | — | **`resolve_list_progress` ×2 only** (no `new_word_test_recorded` / `csd_twi_reconciled`) |
| crash | — | none |

Direct-nav loaded the correct list. I reached (via Path A) and **completed a typed test 100% (matched 30/30)** — but it **did not persist**: no day-6 anchor, no csd/twi advance, only `resolve_list_progress`. So **the deployed fix does NOT auto-recover the mid-list lost-save even though the day's words exist** → the **manual CS pass is still needed**. This is exactly the "if it holds without recovering, report it" outcome.

**Contrast with r57 choi (list-END):** there the resolver advanced csd 15→16; here (mid-list) it holds at 5. So the resolver's read-time reconcile advances at list-end but not for a mid-list missing-anchor — the lost-save proper is not auto-healed.

**Caveat:** the `degradeProbe` fired at 4.5s and caught **"Preparing your session…"** (settle too short), so its `offersNewWords=false` reading is unreliable — but the **no-persist outcome** (from the post read-back) is definitive regardless of what the probe caught mid-load. If WSL wants a clean `offersNewWords` read, I'll re-drive with a longer settle.

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_r58_refidelity.json` (per-review read-backs, degradeProbe, summary; `runStart` for `--since`).
- `audit/playwright/findings/steps/r58-{thr_0DnzKs,thr_bFV18s,thr_yiVt86,jisu_a1,lostsave_bc_d6}.jsonl`.
- Driver: `audit/deepfix/task6/d35_r58_refidelity.mjs`.

## Hand back
`baton.json` → `turnOwner=claude round=58 execStatus=run-written execDecision=DROVE updatedBy=winclaude revision=116`. Watcher re-armed at baseline 116. **WSL runs `assert-recovery.mjs --since=2026-07-19T07:21:21.003Z`.** TEST A is a clean fidelity win (2-step proven); **TEST B is a real "does-not-auto-recover" finding** for the mid-list lost-save — your call on whether that's the intended design (manual CS required) or a gap in the deployed fix.
