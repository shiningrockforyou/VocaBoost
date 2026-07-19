# WINCLAUDE round 59 — bare-reload LASTING check — ✅ DROVE (throttle 4/4 lasting; lost-save csd orphaned)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_R59_RELOAD_LASTING` · **execDecision:** `DROVE`. LIVE PROD, sandbox only, no 26SM. Direct-nav (all `containsListId=true`, settled past "Preparing…"). No reviews/tests — pure login+load+readback. Step-logged (`findings/steps/r59-*.jsonl`).

---

## Throttle escapes are LASTING — 4/4 PASS (David lasting-question #1: settled)
Fresh bare load of each escaped throttle student → the escape persists:

| tag | csd (unchanged) | reviewMode after fresh load |
|---|---|---|
| thr_0DnzKs | 11 | **false** ✅ |
| thr_bFV18s | 7 | **false** ✅ |
| thr_yiVt86 | 17 | **false** ✅ |
| jisu_a1 | 5 | **false** ✅ |

The r58 two-step escape is **durable** — a fresh session load does not revert `reviewMode` to throttled, and csd stays put. The throttle recovery lasts.

## Lost-save: TWI reconciled, but csd ORPHANED — PARTIAL/GAP (David lasting-question #2: settled)
`lostsave_bc_d6` across **two** bare reloads:

| signal | pre | after reload #1 | after reload #2 |
|---|---|---|---|
| csd | 5 | **5** | **5** (stuck) |
| twi | 400 | **480** (+80) | 480 |
| fresh logs | — | `resolve_list_progress`×4, **`csd_twi_reconciled`×1** | — |
| canonical | 0 | 0 | 0 |

**You were right that my r58 "no recovery" read was too early** — the day-6 anchor *did* persist, and on this fresh load the **twi reconciled 400→480** (+80, matching the anchor's `wordsIntroduced=80`) with a `csd_twi_reconciled` log. **But csd is stuck at 5** — and a **second** reload confirms it's **not progressive** (still 5/480). So the mid-list lost-save **partially** auto-recovers (twi/anchor) but leaves **csd orphaned** — an inconsistent state (80 day-6 words introduced, yet csd still says day-5-complete). **The manual CS pass is still needed to fix csd.**

**Contrast:** off-by-one students reconcile *csd* on the next load; this lost-save reconciles *twi* but not *csd*. So the deployed fix's read-time reconcile advances twi-from-anchor but does **not** advance csd for a mid-list missing-day-anchor.

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_r59_reload.json` (per-student pre/post read-backs, 2nd-reload result, verdicts; `runStart` for `--since`).
- `audit/playwright/findings/steps/r59-{lostsave_bc_d6,thr_0DnzKs,thr_bFV18s,thr_yiVt86,jisu_a1}.jsonl`.
- Driver: `audit/deepfix/task6/d35_r59_reload.mjs`.

## Hand back
`baton.json` → `turnOwner=claude round=59 execStatus=run-written execDecision=DROVE updatedBy=winclaude revision=118`. Watcher re-armed at baseline 118. **WSL runs `assert-recovery.mjs --since=2026-07-19T07:35:48.946Z`.** Throttle-escape-lasting is a clean win; the **twi-reconciled-but-csd-orphaned** lost-save result is the finding for your call — is csd-stuck-with-twi-advanced the intended "anchor persists, csd needs manual fix" design, or should the read-time reconcile also advance csd?
