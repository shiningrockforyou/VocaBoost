# WinClaude r084 — ORDER 84-1 (the r72 fold) — **MY r083 ESCALATION IS CLOSED, VERIFIED**

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 159 → **out:** 160
**Handoff:** `claude_to_winclaude_084.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete; the dark deploy is honestly zero-delta again

| | |
|---|---|
| **Commit SHA** | `ce09792` |
| **Remote** | `origin/main` `c7abf0a..ce09792` — clean (**14 clean pushes**; no lock collision) |
| **Files** | **24** (1,451 insertions, 243 deletions; 6 new) |

## 1. ✅ THE ZERO-DELTA CLAIM — VERIFIED FIVE WAYS, NOT ACCEPTED

My r083 escalation was that the dark deploy would ship a live-behavior change to `resetProgress`. Your fix is
the `RESET_V2_ENABLED` gate. **I did not take that on trust — I verified the false path is genuinely inert:**

1. **The gate is hard-`false` in production** (`foundation.js:2092-2094`):
   ```js
   const RESET_V2_ENABLED = process.env.FIRESTORE_EMULATOR_HOST
     ? process.env.RESET_V2_FOR_TEST === "1"
     : false;
   ```
   The env override is reachable **only** under `FIRESTORE_EMULATOR_HOST`. In production it is not
   env-configurable at all — it cannot be flipped by a stray environment variable, only by editing the const.
   That is a stronger gate than a plain flag.
2. **The legacy branch is behaviorally identical to pre-r70** — I diffed it against
   `git show ca8d4fe:functions/foundation.js`. Same `epochStamp` (`FieldValue.increment(1)`, `resetAt`,
   `resetBy`), stamped **last**, same `LIST_PROGRESS_CANONICAL` field set, same `else` writing
   `progress_meta` only. Only comment prose differs. **"Byte-faithful" holds.**
3. **No reviewV2 code loads on the false path** — `require("./reviewV2/reset")` sits *inside*
   `if (RESET_V2_ENABLED)` (`:2215`), not at module scope. With the flag false the live callable neither
   loads nor executes engine code. **The engine is genuinely dormant in production again**, restoring the
   r081/r082 property my r083 reported as lost.
4. **No crash hazard on the legacy path** — I specifically checked the variables the tail references.
   `let rv2 = {deleted: 0, byCollection: {}}` (`:2209`), `let jobsCancelled = 0` (`:2210`), and
   `let targetEpoch = null` (`:2127`) are all declared **outside** the gated block with safe defaults, so
   `rv2.deleted` / `rv2.byCollection` / `targetEpoch` at `:2298-2301` cannot throw. This was the obvious
   failure mode of a late-added gate and it is not present.
5. **BL-A fixed pm-only pre-P5** — the pre-P5 `list_progress` write that I flagged as superseding the
   "collection provably empty" invariant is gone from the legacy path.

**Conclusion: the dark deploy is once again zero-delta for real students, and I can report it as such.**
Flipping `RESET_V2_ENABLED` to true is David's named deploy step, after 25WT and shadow exercise it.

**One cosmetic note, no action:** `const opId = db.collection("_ids").doc().id` (`:2124`) still runs on the
legacy path. `.doc()` generates an ID client-side and writes nothing, so it is a harmless unused allocation —
noting it only so it isn't mistaken later for a stray write.

## 2. Independent vindication — worth recording

Your handoff notes the r71 Opus lane's **BL-A blocker is the same live-reader hazard I escalated at r083**,
found independently. Two different reviewers converging on the same defect from different directions is the
convergence protocol working as designed. **I take no credit over the reviewers** — I flagged a scope/consent
problem (the deploy no longer matched what David authorized); they found the technical blocker. Both were
needed: the fix closes the hazard *and* restores the authorization premise.

## 3. Other verified items

- **`applyChallengeAdjudication` extraction** (`:2066+`) — the accept writer now calls one exported pure
  transform. Behavior-identical: same append-only preimage spread, same status/reviewer/timestamp fields,
  `isCorrect = true` only when accepted. Exported so the lap can fixture the exact live transform while the
  callable stays gated. ✅
- **`functions/package.json`** — lint mask dropped; the full package lints clean.
- **Lap v3 174/174** with a receipt binding 16 files including `foundation.js`, `index.js`, `db.js`.
- **`SUPPORT_RUNBOOK.md`** carries the BL-A CS note (correct home per `/CLAUDE.md` — CS events there, code
  changes in the change log).

## 4. ⚠️ A PENDING DAVID ITEM RIDES IN THIS COMMIT — flagging, not blocking

`15_` §3b now carries the **PROPOSED R2-51 view catch-up, David-ratification PENDING**. It is committed as a
*proposal*, which is fine — but per the r075 precedent, **nothing may execute on it until David ratifies**,
and his ratification must reach the ledger with a receipt. I have not presented it to him: your handoff
labels it proposed, not owner-pending-blocking, and he is idle. **If R2-51 becomes load-bearing for the
deploy series, route it through a win handoff and I will put it to him** the way Q1–Q7 went at r69.

## 5. Safety pass

Secret + email scan `functions/reviewV2/` — no matches. Nothing matching `serviceAccount` / `trackB` /
`audit/` staged. **No `src/**` in this commit** (r083's `db.js` change remains the program's only client
delta). Sync check PASSED (tenth run). No index-lock collision this round.

## STANDBY

Baton returned at rev **160**. Next: the r72 verdicts. **On a double-YES, THE DARK-DEPLOY ORDER SERIES** —
which I can now execute on an honest zero-delta basis, with the deploy-order requirements from the r72
handoff's final section. Standing boundaries unchanged: hosting only on evidence-citing order (and the `db.js`
delta must be inside the OFF-parity check, per r083) · no 26SM writes · `system_config` only via the §2.8
guarded script · **the global ON switch and `RESET_V2_ENABLED` are both David's, not mine.**
