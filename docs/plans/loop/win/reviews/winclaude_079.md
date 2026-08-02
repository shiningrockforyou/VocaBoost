# WinClaude r079 — ORDER 79-1: **THE STAGE-1 FREEZE** 🏁

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 151 → **out:** 152
**Handoff:** `claude_to_winclaude_079.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — gate (1) is in history

| | |
|---|---|
| **Commit SHA** | `73778c0` |
| **Remote** | `origin/main` `23bef89..73778c0` — clean (**9 clean pushes running**) |
| **Files** | **8** (334 insertions, 14 deletions; 4 new) |

## 1. I VERIFIED THE FREEZE VERDICTS BEFORE COMMITTING THEM

This is the gate that opens stage 2 — the dark build and everything downstream toward production — so I read
the receipts rather than taking the headline on trust. **The claim checks out.**

| Reviewer | Verdict | Basis |
|---|---|---|
| **Codex r69** | **"STAGE-1 FREEZE: YES · Track B: GO TO STAGE 2"** | Round disposition DONE; "no remaining path in that scope that can produce a false PASS at B4 or corrupt student label data" |
| **Panel — LENS: authority** | **"STAGE-1 FREEZE: YES"** | Re-ran `delta-chain-fixture` 84/0, `rotation-cyclicity` 2,688/0, `node --check` 11/11, **recomputed evidence sha16 8/8 MATCH**, read the diff hunk-by-hunk ("no smuggled changes"), ran a 12-shape offline reducer battery from scratchpad |
| **Panel — LENS: gate** | **"STAGE-1 FREEZE: YES"** | "Under the contract this is not close"; 82+16=98 and 81+3=84 reconcile to the digit; only register-class items remain |
| **Panel — LENS: closure** | **"YES — unconditional under the contract"** | All three counts reproduce; 8/8 computed; frozen-bytes timeline holds; YES binds to the eight frozen sha16s |

**Four reviewers, four YES — verified independently, not relayed.** The panel explicitly preserved
independence from Codex ("Codex's r69 review not read"), and the authority lens honored the solo-lap
constraint rather than re-running the lap. This is a genuine freeze, not a paper one.

## 2. ⚠️ A NEW SCRIPT IS UNCOMMITTED — NOT IN YOUR PATH LIST

`scripts/deepfix2/a8-collision-census.mjs` is untracked and **was not staged** — your order named only
`02_TASK_LIST.md`, `docs/plans/loop/`, and `change_action_log.md`; `scripts/deepfix2/` was deliberately absent
this round. Same class of flag as `fable_panels/` at r071 and unnamed by any order so far.

**Name it in the next order if it should be in history.** Until then it lives only in the working tree.
(`scripts/firestore-usage-probe.mjs` remains in the same state, unnamed since r070.)

## 3. Pre-stage sync check + safety pass

Sync check PASSED (fifth live run) — all ordered paths present and dirty before staging. **No index-lock
collision this round** (two in the previous two rounds). Safety: secret scan `scripts/deepfix2/` no matches;
`.gitignore:33/87/88/89` hold; `AGENTS.md` and `firestore-usage-probe.mjs` unstaged;
`.claude/settings.local.json` untouched.

## 4. WHERE I STAND FOR STAGE 2

The frozen opening order, and my part in each step:

1. **B1 `--full` baseline** — running on WSL now, read-only. *Not mine.*
2. **Dark build** (writer + the frozen `rehearsalClassIds` resolver) — *not mine; WSL builds.*
3. **Emulator chain rehearsal** — mine if you order it; Java 21.0.9 + firebase-tools 14.27.0 green.
4. **DARK DEPLOY** — **mine.** `firebase deploy --only functions,firestore:rules,firestore:indexes`, every
   surface `enabled:false`, on your numbered order. David's Q3 confirm covers it.
5. **25WT rehearsal** — mine (dev server + Playwright, 25WT identities only).
6. **SHADOW COHORT** — mine for the Playwright battery (stratified ~30 accounts per `16_` §4-C).

**Unchanged boundaries, restated at the gate:** the global ON switch stays parked for David · hosting only on
an order citing green OFF-parity + old-bundle evidence · no 26SM writes · `system_config` only via the §2.8
guarded script that never writes `enabled`.

## STANDBY

Baton returned at rev **152**. Watcher armed. Ready for the dark-deploy order series.
