# WINCLAUDE round 14 — validate the "neutral" wordmap fix (M-WB + M-UI)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_NEUTRAL_VALIDATE`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_014.md`
- **git:** `a967f54` dirty · **runs:** M-WB `winclaude-wb-r14` (21:48–21:54Z, 4 scn) + M-UI `winclaude-ui-r14` (RO-S1)
- **execDecision:** `NOT_CLEAN` (M-WB 0/4, M-UI 0/1) — **BUT the "neutral" fix is VALIDATED and it advanced 3 of 5 scenarios past the answer gate into their REAL oracles. The wordmap has MORE gaps (W-RA4/W-RA4b).**

---

## Headline: my r13 diagnosis was correct — the answer gate now clears (partly)
Two pieces of hard proof the "neutral"/wordmap fix worked:
- **M-WB CUT-5 — I opened `DFWB_CUT5_winclaude-wb-r14.png`:** it's now a **GREEN "Completed Day 2 session · 100% · 3 of 3 correct"** with a **"Continue" button present**. Words this time were **`sound` ✓, `reserved` ✓, `canvas` ✓ — all answered** (Day *2*, not the Day-1 scheme/agenda/neutral set). No blank word. The pass gate is cleared.
- **M-UI RO-S1 — verdict moved** from `csd 0->0` (r12/r13, stuck sub-92%) to **`csd 0->2`** — it now passes the gate and advances.

## FINAL manifests (verbatim)
```
— M-WB (winclaude-wb-r14) —
❌ W-RA3g FAIL    — positive arm: csd 4->4 (want +1 — gate should have been skipped)
❌ W-RA4  FAIL    — exception: TimeoutError locator.click 30000ms — submit button <button disabled>
❌ W-RA4b FAIL    — exception: TimeoutError locator.click 30000ms — submit button <button disabled>
⚠️ CUT-5  INVALID — no NEW attempt doc created (outcome=results) — save leg not observed
⛔ 2 fatal (= the W-RA4/W-RA4b submit-timeout exceptions)   FINAL: NOT CLEAN — 0/4

— M-UI (winclaude-ui-r14) —
❌ RO-S1  FAIL    — RO-S1: csd 0->2 (want 0->1); no passed new attempt recorded   FINAL: NOT CLEAN — 0/1
```

## Per-scenario: what actually changed (r13 → r14)
| Scenario | r13 | r14 | Read |
|---|---|---|---|
| **RO-S1** (UI) | `csd 0->0` (sub-92%, neutral blank) | **`csd 0->2` (want 0->1)** | ✅ gate cleared → **NEW real oracle: csd OVER-advances (2 not 1)** |
| **CUT-5** (WB) | no attempt doc, sub-92% | **100% Day-2, Continue present** (screenshot) | ✅ answered fully → remaining INVALID is now the **save-leg / no-attempt-doc** issue, a *different* finding |
| **W-RA3g** (WB) | flow-gap "Continue never appeared" | **no flow-gap**; oracle FAIL `csd 4->4 (gate should have been skipped)` | ✅ test completes now → **NEW real white-box oracle: gate-skip not happening** |
| **W-RA4 / W-RA4b** (WB) | submit `<button disabled>` timeout | **STILL** submit `<button disabled>` timeout | ❌ unchanged → a **different word is still blank** for their word-set |

## The handoff's decisive sub-question: "which word is now blank?"
- **CUT-5 → NONE** — the screenshot shows `sound/reserved/canvas` all answered (100%). So "neutral" *was* the gap for the Day-1/Day-2 sets these hit.
- **W-RA4 / W-RA4b → cannot be named from a screenshot** — their submit button stayed **disabled**, so the flow **never reached a results screen** (no `lsr_nocontinue`/results shot exists for them this run). The blank field is on the *test* screen, which isn't captured. **So: "neutral" was NOT the only gap — W-RA4/W-RA4b exercise a different day/word-set that still has a missing wordmap entry.** To name it you'll need either a `shot()` on the *disabled-submit test screen* (to see the empty field), or an audit of `wordmap.json` coverage against W-RA4's day words. (Reporting the gap, not guessing the word.)

## The REAL oracle findings now surfacing (past the answer gate)
These are the actual test results the fix unlocked — for your diagnosis:
1. **RO-S1: `csd 0->2 (want 0->1)`** — a new-word day that passes now advances csd by **2**, not 1 (+ "no passed new attempt recorded"). Over-advance, or oracle/pace expectation? Real state finding.
2. **W-RA3g: `csd 4->4 (want +1 — gate should have been skipped)`** — the positive-arm gate-skip didn't take; csd flat despite completion. Real white-box finding.
3. **CUT-5: 100% pass but `no NEW attempt doc created — save leg not observed`** — the attempt-doc write leg wasn't observed even though the session completed. Real (or flag-off) save-leg finding.

## Artifacts
`findings/deepfix_wb_winclaude-wb-r14.{json,md}` · `findings/deepfix_ui_winclaude-ui-r14.{json,md}` · raw logs `…DFWB_winclaude-wb-r14.md` / `…DFX_winclaude-ui-r14.md` · screenshot **`DFWB_CUT5_winclaude-wb-r14.png`** (the 100% proof). (`lsr_nocontinue_W_RA3g_pos.png` / `lsr_nocontinue_CS_11_mismatch.png` are **stale r13** files, not this run.)

## For WSL-Claude (deliverable)
- **Fix confirmed + diagnosis validated:** "neutral" added → CUT-5 hits 100% (screenshot) and RO-S1 advances. Good.
- **But wordmap still incomplete:** W-RA4/W-RA4b remain submit-disabled → another missing word in their day-set. Recommend a **wordmap coverage audit** (or a shot-on-disabled-submit so I can name the word next run). Neutral was not the only gap.
- **Three real oracles now open** (the actual frontier): RO-S1 `csd 0->2` over-advance · W-RA3g gate-skip `csd 4->4` · CUT-5 save-leg/no-attempt-doc.

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox 25WT/`lsr_*` only; new `…-r14` classes left in place. No 26SM/prod. No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_014.md`.
- `baton.json` → `turnOwner="claude"`, `revision=28`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-14T21:59Z`.
- Watcher re-backgrounded at baseline 28. Dev server up on 5173.
