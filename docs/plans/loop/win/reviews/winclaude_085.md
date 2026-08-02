# WinClaude r085 — ORDER 85-1 (the r73 fold)

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 161 → **out:** 162
**Handoff:** `claude_to_winclaude_085.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete

| | |
|---|---|
| **Commit SHA** | `58af1f1` |
| **Remote** | `origin/main` `ce09792..58af1f1` — clean (**15 clean pushes**; no lock collision) |
| **Files** | **21** (1,099 insertions, 132 deletions; 8 new) |

## 1. `firestore.indexes.json` — the one addition, verified

Diff is **exactly one appended object** and nothing else:

```json
{ "collectionGroup": "grading_jobs", "queryScope": "COLLECTION",
  "fields": [ {"fieldPath": "uid", "order": "ASCENDING"},
              {"fieldPath": "status", "order": "ASCENDING"} ] }
```

**Purely additive** — no existing index modified, reordered, or removed, and `fieldOverrides` untouched. That
matters more than usual here: index *deletions* break live queries at deploy time, additions cannot. This one
backs the §9 job-cancel query (`where uid == … where status == "claimed"`), which is on the RESET_V2 path and
therefore currently unused in production — the index is inert until that const flips.

`17_` correctly orders it **before** any RESET_V2 flip: the query would fail without it.

## 2. David's two rulings (receipts in `15_` §3b)

- **R2-51 RATIFIED** — the dual-class view catch-up, his verbatim principle. This closes the
  ratification-pending item I flagged at r084 §4. **No action needed from me** — I had held it pending, and it
  is now ratified with a receipt in the ledger, which is exactly the routing the r075 precedent asked for.
- **RESET_V2 flip = the sandbox-rehearsal phase.** This is the direct resolution of my r083 escalation. The
  ruling keeps `RESET_V2_ENABLED=false` through the dark deploy and moves the flip into 25WT/shadow, i.e. it
  makes the deploy *more* conservative, not less. **Nothing in it expands risk, so no re-escalation.**

**Net effect on my posture:** the dark deploy remains honestly zero-delta, and both items that were sitting on
David's desk (R2-51, the reset timing) are now closed with receipts.

## 3. New durable artifact

`docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md` — the deploy-card home, carrying my escalation's flip
step with David's timing ruling. Good: it means the deploy sequence is now a reviewed document rather than
living only in handoff prose, and the RESET_V2 ordering constraint survives any future compaction.

## 4. Safety pass

Secret + email scan `functions/reviewV2/` — no matches. Nothing matching `src/**`, `serviceAccount`,
`trackB`, or `audit/` staged (r083's `db.js` line remains the program's only client delta). Sync check PASSED
(eleventh run). Lap v3 receipt now 182/182.

## STANDBY

Baton returned at rev **162**. Next: the r73 verdicts. **On a double-YES: THE DARK-DEPLOY ORDER SERIES per
`17_`** — zero-delta, `RESET_V2_ENABLED` false through the deploy per David's ruling.

Boundaries unchanged: hosting only on an evidence-citing order (with the `db.js` delta inside the OFF-parity
check per r083) · no 26SM writes · `system_config` only via the §2.8 guarded script · **the global ON switch
and the `RESET_V2` flip are both David's.**
