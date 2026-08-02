# WinClaude r082 — ORDER 82-1: **THE DARK BUILD, CODE-COMPLETE**

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 155 → **out:** 156
**Handoff:** `claude_to_winclaude_082.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete

| | |
|---|---|
| **Commit SHA** | `ca8d4fe` |
| **Remote** | `origin/main` `7178887..ca8d4fe` — clean (**12 clean pushes running**) |
| **Files** | **20** (3,518 insertions, 36 deletions; 15 new) |

8 engine modules · `functions/index.js` wiring · `flip-review-v2.mjs` + `engine-emulator-lap.mjs` ·
codex r70 handoff/ready · win files · `AGENTS.md`.

## 1. ✅ THE `index.js` DIFF IS EXACTLY WHAT YOU CLAIMED — verified line by line

You asked me to confirm the only existing-file change is the reviewV2 require + 6 re-exports. `git diff
functions/index.js` shows **one hunk at the tail**: a comment block, `const reviewV2 =
require("./reviewV2/callables")`, and exactly six `exports.reviewV2*` lines (ComposeSession, ComposeRerun,
SubmitAttempt, CompleteDay, MintVisit, EvaluateThresholds). **Nothing else in the file is touched** — no
existing export altered, no import reordered, 2,189 lines above the hunk unchanged.

## 2. 🔒 THE FLIP SCRIPT — READ IN FULL, BECAUSE IT IS THE THING DAVID PARKED

`scripts/deepfix2/flip-review-v2.mjs` is the mechanism for the global ON switch. Committing it flips nothing,
but I read all 150 lines before letting it into history. **It codifies the parking correctly:**

- **Header, verbatim:** *"THE SWITCH IS DAVID'S [frozen — stage (5) of DF2-14; NEVER run by an agent on its
  own judgment]."*
- **Dry-run by default** — `:101-107` exits before any write unless `--execute`.
- **Activation needs two independent human artifacts** — `--yes-i-am-david` (`:80-82`) **and** `--lapReceipt`
  (`:83-91`) that must show a pass **and be ≤30 minutes old**. A stale or failing receipt refuses.
- **Pre-asserts** (`:70-78`): config exists · `enabled !== true` · **`rehearsalClassIds` EMPTY** · no
  `shadow_registry/window` doc. The rehearsal list being empty at the flip is the mutual exclusion I described
  at r075 — audit posture and activation cannot coexist.
- **Re-asserted inside the transaction** (`:114-120`), so the pre-check race is closed; `enabled:true` and
  `firstEnabledAt:serverTimestamp` are written **together** (R2-48), marker write-IFF-absent.
- **Post-verify** (`:134-148`) with exit 3 on any mismatch.

**One honest limitation, stated for the record:** `--yes-i-am-david` is a *procedural* gate, not a technical
one — nothing stops an agent from typing it. The protection is the standing instruction, not the flag.
**So, restated: I will not run this script in activation mode, and I will not run `--kill` either** (per `16_`
§2.8 the global kill switch is never exercised by the audit) — not on your order, not on my own judgment,
only on David's explicit instruction. If a future handoff orders it, I will refuse and escalate to him.

## 3. Dark-by-construction — verified, not assumed

- `callables.js:109` — `throw new HttpsError("failed-precondition", "review_v2_dark")`. Every callable
  refuses while dark; pre-flip only `rehearsalClassIds` members are served (the rehearsal carve-out).
- `callables.js:94` / `:409` — `readStatus === "hold"` handled distinctly from OFF (the r48 cold-start law
  carried through into the engine, not just the resolver).
- `config.js` unchanged in substance from r081's audit; the dark config still resolves every real class to
  gate-OFF and stamping-ineligible.
- **Nothing is deployed by this commit.** Deploy happens only on your dark-deploy order series.

## 4. Safety pass

- **Secret + email scan across `functions/reviewV2/`** (private keys, `sk-`/`AIza` tokens, client secrets,
  inline passwords, email addresses) — **no matches**.
- **Post-stage path audit** — nothing matching `serviceAccount`, `trackB`, or `audit/` staged.
- **`AGENTS.md` staged for the first time**, as your order directed. I read it before allowing it in: 30 lines
  of repo agent instructions for the Codex baton watcher (`watch-for-codex.ps1` usage). Benign, no secrets.
  Noting the change of posture — it had been on my standing-exclusion list since r070 because no order named
  it; this order does, so it is in.
- Sync check PASSED (eighth run); no index-lock collision.

## 5. On the checkpoint review running against the working tree

Understood — the commit changed no bytes, so the reviewers' target is unaffected and now durable at `ca8d4fe`.
Worth noting for their benefit: the tree they are reviewing is **byte-identical to what is now on `origin/main`**,
so any finding can be cited against a pushed SHA rather than a local worktree.

## STANDBY

Baton returned at rev **156**. Next expected: checkpoint-fold commits if the reviewers force changes, then
**the dark-deploy series** — functions/rules/indexes, all `enabled:false`, `rehearsalClassIds` resolver
confirmed present (r081). **Global ON switch: parked for David.**
