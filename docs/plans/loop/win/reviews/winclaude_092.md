# WinClaude r092 — ORDER 92: **LEG 3 DEPLOYED · LEG 4 NOT RUN (David paused) · BATON RETURNED**

**Date:** 2026-08-03 · **Executor:** WinClaude · **Baton rev in:** 176 → **out:** 177
**Handoff:** `claude_to_winclaude_092.md` · **Authority:** R2-31 + David Q3.

## VERDICT: `PAUSED_BY_DAVID_AFTER_LEG_3`

David called a pause mid-order and asked for the baton back. **Leg 92-2 was NOT executed** — I stopped at the
dry-run, before any write.

## PRODUCTION STATE RIGHT NOW — the authoritative record

| Surface | State |
|---|---|
| **Indexes** | ✅ **DEPLOYED** — 43 total (was 42); `grading_jobs (uid ASC, status ASC)` added, building |
| **Rules** | ❌ **NOT DEPLOYED** — refused at r091, re-scoped to your workstream. **`firestore.rules` untouched** |
| **Functions** | ✅ **DEPLOYED** — 24 total (was 17) |
| **`system_config/review_v2`** | ❌ **ABSENT — NOT SEEDED.** Leg 92-2 did not run |
| **Activation** | Nothing activated anywhere. No marker, no rehearsal classes, `enabled` does not exist |

## 1. LEG 92-1 — FUNCTIONS: DEPLOYED ✅

**Pre-deploy baseline captured:** 17 deployed functions, **zero** `reviewV2*`.

**Deployed surgically** — nine explicit `--only functions:<name>` targets, never a bare `--only functions`:
the seven `reviewV2*` callables (`ComposeSession`, `ComposeNewTest`, `ComposeRerun`, `SubmitAttempt`,
`CompleteDay`, `MintVisit`, `EvaluateThresholds`) + `resetProgress` and `reviewChallenge` (the two existing
callables whose code actually changed — both live in `foundation.js`, last modified at `ce09792`).

All nine reported success: 7 `Successful create`, 2 `Successful update`.

**Post-deploy verification (ANSI-stripped name diff of `functions:list` before vs after):**
- **before 17 → after 24**
- **REMOVED: NONE** ← the check that mattered
- **ADDED: exactly the seven `reviewV2*` callables**
- `resetProgress` / `reviewChallenge` updated in place, not recreated

**`RESET_V2_ENABLED === false` — verified from the deployed tree.** The uploaded source is HEAD
`b54c6e5`, where `foundation.js:2092-2094` reads the env override **only** under
`FIRESTORE_EMULATOR_HOST` and is otherwise a literal `false`. It is a source constant, not runtime config, so
the deployed tree is the authority.

**Honest limitation on that check:** `exports.version` (the deploy-provenance probe) was **not** in the
surgical deploy set, so **it still reports the SHA of the last full deploy, not `b54c6e5`.** Anyone calling it
to confirm this deploy will get a stale answer. That is inherent to surgical deploys — worth adding `version`
to the target list on a future deploy, or noting it permanently in `17_`.

## 2. LEG 92-2 — CONFIG DOC: NOT RUN

I read `seed-review-v2-config.mjs` in full first and it is sound — write-iff-absent, `.create()` (fails on a
concurrent appearance), never writes `firstEnabledAt`, never sets `enabled:true`, post-write self-verify with
exit 3. I was executing the **dry-run** when David paused. **No write was attempted.**

**Consequence of leaving it absent — and it is the safe direction:** per `config.js:72`, an absent config doc
is a **cold start ⇒ HOLD**, and every callable refuses on hold. So the newly deployed engine is now inert
*twice over*: `review_v2_dark` refusal **and** resolver HOLD. Nothing can reach it in this state, and no
client routes to it in any case.

## 3. NOT DONE — the commit half of order 92

Order 92 also asked me to commit the halt record (`17_` §7b), `change_action_log.md`, the new dormant
`src/services/reviewV2Client.js`, the `REVIEW_V2_CLIENT=false` flag, and `seed-review-v2-config.mjs`.
**I did not run it** — David paused before that point and I am not doing unrequested work during a pause.

**Those files remain uncommitted in the working tree.** Nothing is lost; either issue it again next round or
fold it into the following commit.

## 4. Standing state for whoever resumes

- The rules workstream is **yours** and remains the gate before the flip.
- **My r091 refinement stands and is worth carrying into `17_`:** the rules should land before **gate 4 (the
  26SM backfill)**, not merely before gate 5 (the flip). Between those two gates real label data exists in
  `study_states` with the field-immunity clauses not yet deployed, so backfilled labels would be
  client-forgeable in that window.
- Boundaries unchanged: **the global ON switch and the `RESET_V2` flip are David's** · no 26SM writes ·
  `system_config` only via the guarded scripts · hosting not deployed by me.

## STANDBY

Baton returned at rev **177**, `execDecision: PAUSED_BY_DAVID_AFTER_LEG_3`. Watcher stays armed.
