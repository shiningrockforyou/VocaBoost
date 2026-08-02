# WinClaude r087 — ORDER 87-1 (the r75 fold) + **A MISPLACED-WRITE FINDING**

**Date:** 2026-08-03 · **Executor:** WinClaude · **Baton rev in:** 165 → **out:** 166
**Handoff:** `claude_to_winclaude_087.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete; one defect for you below

| | |
|---|---|
| **Commit SHA** | `e1c20ba` |
| **Remote** | `origin/main` `e9e8ac4..e1c20ba` — clean (**17 clean pushes**) |
| **Files** | **20** (858 insertions, 83 deletions; 8 new) |

## 1. 🔴 `functions/change_action_log.md` — A MISPLACED WRITE, AND THE r75 ROW NEVER REACHED THE REAL LOG

`git add -A functions/` swept in a **new file**: `functions/change_action_log.md`. I inspected it before
pushing.

- It is **one line**: the complete r75 change-log row (Codex's 5 items, the lock revert, lap 211/211 …).
- It is a **relative-path error** — the row was appended from inside `functions/` instead of the repo root.
- **Consequence:** the canonical `change_action_log.md` (1,486 lines) **does not contain the r75 row.** I
  verified: `grep -c "r75 FOLD" change_action_log.md` → **0**, and its last row is the **r74** fold.

**This breaks David's standing order** that every edit is row-logged in the root `change_action_log.md`, and
`/CLAUDE.md` places living logs at the repo root. The r75 fold — including a *reverted safety decision* — is
currently unlogged in the canonical record.

**I did not fix it.** The change log is outside my executor write scope and is yours to own; a
one-line file is trivial for you to relocate but I will not silently rewrite the project's audit record.

**Please, next round:** append the row to root `change_action_log.md` and `git rm functions/change_action_log.md`.
It is committed at `e1c20ba`, so nothing is lost — it is in the wrong place, not gone.

**Worth a moment's thought:** this is a *silent* failure mode. The write succeeded, no error surfaced, and the
only reason it was caught is that `add -A` on a directory revealed an unexpected new path. If any earlier
round wrote a log row from a subdirectory, the same thing happened without an `add -A` to expose it. A quick
`git status --porcelain | grep change_action_log` sanity check before your log writes would close it.

## 2. ✅ The composer revert — verified exactly as you described

`resetLockActive` is two `Boolean()` lines again:

```js
function resetLockActive(pmData, lpData) {
  return Boolean(pmData?.resetInProgress) || Boolean(lpData?.resetInProgress);
}
```

The r74 time-window version (`RESET_LOCK_TAKEOVER_MS`, `nowMs`, the `live()` helper) is gone from the
predicate. **Codex's reasoning is right and worth recording:** a crashed reset leaves a *partially deleted*
graph, so serving through a stale lock would expose an inconsistent state to a student — worse than the
lockout it was trying to fix. Liveness now comes only from the next reset op's takeover, and the sequence is
fixtured rather than asserted.

This is the **third** blocking-class finding in the §9 reset path (BL-A → the lockout → this revert of the
lockout fix). My r086 recommendation stands and I would now put it more strongly: **reset deserves the
heaviest weighting in the 25WT and shadow batteries** — crash-mid-cleanup, stale-lock takeover, and
concurrent-reset cases explicitly enumerated.

## 3. Sweep receipt — checked, clean

`evidence/list-position-sweep-receipt.json`: `{kind, projectId: "vocaboost-879c2", at, lists:46, clean:42,
gapped:0, duplicated:0, empty:4, scriptSha16}`. **Counts and a project id only — no uids, no list names.**
Note it does name the production project id, which is fine (it is in `.firebaserc` and every config), but
worth knowing the receipt is production-identifying.

## 4. Safety pass

Nothing matching `src/**`, `serviceAccount`, `trackB`, or `audit/` staged. Sync check PASSED (thirteenth run).
No index-lock collision.

## STANDBY

Baton returned at rev **166**. **On Codex r75 YES the checkpoint closes and MY DARK-DEPLOY SERIES BEGINS** —
the first infrastructure-touching action of the program. When that order arrives I will expect it to name:
the exact `firebase deploy --only` target list · the `system_config/review_v2` seed values
(`enabled:false, firstEnabledAt:null, rehearsalClassIds:[]`) · and confirmation that `RESET_V2_ENABLED`
remains `false` per David's ruling. **I will verify all three before deploying, and I will not deploy hosting.**
