# WinClaude r090 — ORDER 90-1: **THE STAGE-2 CHECKPOINT CLOSES**

**Date:** 2026-08-03 · **Executor:** WinClaude · **Baton rev in:** 172 → **out:** 173
**Handoff:** `claude_to_winclaude_090.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — checkpoint closure in history

| | |
|---|---|
| **Commit SHA** | `b54c6e5` |
| **Remote** | `origin/main` `3cb6e40..b54c6e5` — clean (**20 clean pushes**) |
| **Files** | **13** (283 insertions, 54 deletions; 6 new) |

**Codex r77 = YES ("PRESENTABLE: YES. The Stage-2 checkpoint is converged") + Opus r74 = YES. Both lanes
closed.** Engine lap 220/220, re-bound after the final tightening.

## 1. Order verification

- `17_` §8 updated **UNCONFIRMED ⇒ RULED** with David's verbatim receipt — the r088/r089 loop is fully closed
  on both sides.
- **Branch rule retired** as requested; no branch strategy will be built.
- Codex's non-blocking precision note closed: a **present-but-non-integer `skipped` now refuses** rather than
  being coerced.
- `src/` unchanged; per David's ruling this push builds but publishes nothing. **Client-deploy warning
  language dropped from my reports from here on**, as you asked.
- Safety pass clean; sync check PASSED (sixteenth run); no lock collision.

## 2. ✅ CORRECT CALL: not issuing the deploy series without David's go

You prepared the dark-deploy series and **deliberately did not issue it**, asking David first. **I endorse
that and would have raised it if you hadn't** — with one clarification, so the ask is precise rather than
open-ended:

**David already granted Q3 at r69** — *"CONFIRM the dark deploy (functions + rules + indexes, all
`enabled:false`) — granted in-session; formal record here"* — and reaffirmed it under his end-to-end
directive. So the *authorization* exists. What has changed since he gave it is worth putting in front of him
as a **delta, not a re-ask**:

1. The deploy now includes a **new composite index** (`grading_jobs` uid+status) — additive, but it is a
   production index build.
2. It ships the **rebuilt `resetProgress`**, gated `RESET_V2_ENABLED=false`, verified zero-delta (r084).
3. It ships **`firestore.rules`** — the one genuinely outward-facing leg, which you have correctly given its
   own additivity verification before execution.

**My recommendation for the ask:** confirm those three deltas against the Q3 he already gave, rather than
asking him to re-authorize from scratch. He has been explicit that he wants the run to complete and dislikes
re-litigating settled grants — a precise delta-confirm respects both.

## 3. What I will verify when the order arrives

Restated so the deploy order can be written to match, and so nothing is ambiguous at execution time:

| Leg | My pre-execution check |
|---|---|
| **indexes** | diff is additive-only; no index removed or field-order changed (removals break live queries) |
| **rules** | the additivity verification you named — **no existing allow-rule narrowed**; I will not deploy this leg on a diff I cannot read as strictly additive |
| **functions** | `RESET_V2_ENABLED === false` in the deployed tree; `reviewV2` callables refuse `review_v2_dark` |
| **config doc** | seeded `{enabled:false, firstEnabledAt:null, rehearsalClassIds:[]}` — and **written only via the §2.8 guarded script**, never by hand |
| **hosting** | **not in scope, not deployed** |

Order the legs as `17_` has them (indexes → rules → functions → config doc); I will run them **sequentially,
reporting each before starting the next**, so a failure stops the train rather than cascading.

## STANDBY

Baton returned at rev **173**. Gate 1 achieved, **gate 2's build half now converged and closed**. Awaiting
David's go, then the deploy series — the program's first production backend deploy.

Unchanged: **the global ON switch and the `RESET_V2` flip are David's** · no 26SM writes · `system_config`
only via the guarded script.
