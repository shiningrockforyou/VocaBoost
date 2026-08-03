# WinClaude r097 — ORDER 97: **THE RULES DEPLOY — DEPLOYED ✅**

**Date:** 2026-08-04 · **Baton rev in:** 187 → **out:** 188 · **Project:** `vocaboost-879c2`
**Authority:** five Opus panel rounds → Codex r78 NO (blocker closed) → **Codex r79 YES** → this order.

## VERDICT: `DEPLOYED`

| Required report item | Value |
|---|---|
| **Pre-deploy live sha16** | `44914b60858a1dcd` (ruleset `d8f3e0d0-8e8b-4fe1-aff8-9aceb1d5f9c4`, 211 lines) |
| **Staged sha16** | `f40f91fce3693b82` |
| **Deployed ruleset id** | **`384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1`** (created 2026-08-03T20:08:33.994879Z) |
| **Post-deploy live sha16** | **`f40f91fce3693b82`** — byte-identical to the artifact |
| Post-deploy line count | 523 (was 211) |

**The P10d trap (`752981b78f532ebd`) did NOT ship.** The post-deploy fetch — the step designed to fail if
the wrong thing shipped — returns the artifact's own hash.

## Pre-flight: my standing clause, checked before anything ran

My clause was *"I will not deploy rules by any route until a Codex YES and its own order."* Both halves
verified before step 1:

- **Codex r79, read directly** (`codex_deepfix2_r79.md:3-7`): *"**Verdict: YES. PRESENTABLE: YES.** I
  reviewed frozen target `be1981f` and the exact merged-rules artifact at sha16 `f40f91fce3693b82` … I found
  no blocker to deploying this exact rules artifact as the remaining dark rules leg. Nothing in this verdict
  authorizes the client cutover or either activation switch."*
- **It names the same sha this order stages.** That is the property that makes the YES bind to *this* file
  rather than to a description of it.
- Codex's own scope limit is noted and honoured: it authorizes **the rules leg only** — not the client
  cutover, not either activation switch.

## The six steps — verbatim

**STEP 1 — freshness gate (read-only).** `node scripts/deepfix2/fetch-live-rules.mjs`
```
[live-rules] projects/vocaboost-879c2/rulesets/d8f3e0d0-8e8b-4fe1-aff8-9aceb1d5f9c4 (created 2026-06-28T15:20:00.299855Z)
[live-rules] 211 lines, sha256 44914b60858a1dcd…
```
Exact match on ruleset id, line count and sha ⇒ **base undrifted at my execution time**, refusal condition 1
cleared. (Re-proved independently here, not inherited from WSL's earlier run.)

**STEP 2 — snapshots taken before overwriting.**
`firestore.p10d.rules` (25,292 bytes — the P10d draft, which had no snapshot beside p6/p10c until now) and
`firestore.live.PRE_R79_DEPLOY.rules` (9,007 bytes — **the rollback artifact**).

**STEP 3 — verify before staging.**
```
artifact  = f40f91fce3693b82  (expect f40f91fce3693b82)   ✓
slot(P10d)= 752981b78f532ebd  (expect 752981b78f532ebd)   ✓
```
Conditions 2 and 3 cleared. The slot matching `752981b78f532ebd` also proves **nobody else had changed it**.

**STEP 4 — stage.** `Copy-Item … firestore.merged.rules firestore.rules -Force`
```
staged firestore.rules = f40f91fce3693b82   ✓  STAGE VERIFIED — safe to deploy
```
Condition 4 cleared.

**STEP 5 — deploy, surgical.** `firebase deploy --only firestore:rules --project vocaboost-879c2`
```
+  cloud.firestore: rules file firestore.rules compiled successfully
i  firestore: uploading rules firestore.rules...
+  firestore: released rules firestore.rules to cloud.firestore
+  Deploy complete!
```
`--only firestore:rules` throughout. **No hosting, no functions, no indexes.** (The output line
*"reading indexes from firestore.indexes.json"* is the CLI's standard firestore-target preamble; the
released artifact is rules only, and the index set was already deployed at r092.)

**STEP 6 — post-deploy verification.** `node scripts/deepfix2/fetch-live-rules.mjs`
```
[live-rules] projects/vocaboost-879c2/rulesets/384c9c7a-b9ec-4f17-95ab-b72fff9c5fd1 (created 2026-08-03T20:08:33.994879Z)
[live-rules] 523 lines, sha256 f40f91fce3693b82…
```
Condition 6 cleared. **Production now runs byte-identically the artifact Codex certified.**

## Boundaries honoured

- **No 26SM writes. No student data touched.** This deploy wrote rules only.
- **No commits, no branching, no stash, no reset.** Tree left dirty for WSL to commit the receipt.
- **No flag flips.** `REVIEW_V2_CLIENT` still false; **the global ON switch and the `RESET_V2` flip were not
  touched and remain David's alone.** Nothing activated for any student.
- Nothing under `live_baseline/` edited beyond the two step-2 snapshot copies (plus the two files
  `fetch-live-rules.mjs` rewrote by design at steps 1 and 6).
- Only `vocaboost-879c2` targeted, on every command.
- **The two onboarding overrides were used for exactly the two actions named** (writing `firestore.rules`,
  running one surgical deploy) and nothing else.

## Post-deploy state, and the one thing to note

`firestore.rules` in the working tree is now the **merged artifact**, not the P10d draft. That is a change to
what a future bare `firebase deploy` would ship — and it is an **improvement**: the deploy slot now holds the
reviewed, deployed ruleset instead of a trap whose own header said not to ship it. The P10d draft is
preserved at `audit/deepfix/task3/firestore.p10d.rules`, which is where it should have been all along.

**Rollback remains one command** if WSL's independent 262-case re-run against the fetched live rules
disagrees: restore `firestore.live.PRE_R79_DEPLOY.rules` and redeploy. Per the order, the restored file's sha
will not equal `44914b60858a1dcd` (LF vs CRLF) — the rule text is what matters, and I would not chase that
number.

**Handing back the fetched file exactly as the script wrote it**, for WSL's behavioural confirmation.

## STANDBY

Baton returned at rev **188**, `execDecision: DEPLOYED`. **The dark deploy is now COMPLETE — all four legs:**
indexes (r092) · functions (r092) · config doc (WSL, r093) · **rules (this round)**.

Remaining gates: (3) 25WT product rehearsal → (4) David's 26SM backfill go → (5) David's activation flip.
