# WINCLAUDE round 22 — M-NET auto-provision — createUser fails "no default app" → and it CORRECTS my r21 diagnosis

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MNET_AUTOPROVISION`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_022.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T11:20Z (net-r22, s136–s138)
- **execDecision:** `NOT_CLEAN` — 0/3, all INVALID. **Classifier ALLOWED it (no gate).** New evidence exposes an admin-init bug that ALSO likely invalidates my r21 "accounts don't exist" conclusion.

---

## Gate status: NOT blocked ✅
The `admin.auth().createUser` Admin write was **not** classifier-gated — the run proceeded (no BLOCKED, no relay needed). It failed on a code error, not a permission gate.

## FINAL manifest (verbatim)
```
▶ deepfix M-NET net-r22 — BASE=http://localhost:5173 tier=base list=LSR Base Camp (audit clone) students=3
  → NET-1 …  ⚠️ NET-1 INVALID — no uid + createUser failed for lsr_s136@vocaboost.test: Error: The default Firebase app does not exist. Make sure you call initializeApp() before using any of the Firebase services.
  → NET-2 …  ⚠️ NET-2 INVALID — no uid + createUser failed for lsr_s137@vocaboost.test: Error: The default Firebase app does not exist …
  → NET-3 …  ⚠️ NET-3 INVALID — no uid + createUser failed for lsr_s138@vocaboost.test: Error: The default Firebase app does not exist …
=== M-NET (net-r22) === NOT_CLEAN — 0/3
```

## Root cause — admin SDK is never initialized in M-NET (found by reading the code)
- The FB helper initializes admin **LAZILY, inside `db()`** — `lsr_reviewonly_fb.mjs:31-33`:
  ```js
  export function db() { if (_db) return _db; if (!admin.apps.length) { admin.initializeApp({...}); } _db = admin.firestore(); … }
  ```
  → `admin.initializeApp()` only runs the first time **`db()`** is called.
- M-NET (`lsr_deepfix_netresilience.mjs`) `import admin` (:20) and calls `admin.auth()` **before ever calling `db()`**:
  - `:131` `uidByEmail(email)` → `admin.auth().getUserByEmail` (reviewonly_fb.mjs:42)
  - `:137` `admin.auth().createUser({...})`
  Since no `db()` ran first, `admin` has no app → **"The default Firebase app does not exist."**
- **Fix direction (yours):** trigger the lazy init once (call `FB.db()`, or an explicit `initApp()`) **before** the first `admin.auth()` use in M-NET — then both uidByEmail and createUser work.

## ★★ CORRECTION to my r21 report — please re-read this
My r21 review concluded *"s51-53 and s136-138 don't exist; the seeded `lsr_s*` pool is non-contiguous."* **That is almost certainly WRONG, and I'm retracting it.** Here's why the r22 evidence overturns it:
- `uidByEmail` swallows errors: `lsr_reviewonly_fb.mjs:42` → `try { return (await admin.auth().getUserByEmail(email)).uid; } catch { return null; }`.
- In r20/r21, `admin` was **never initialized** (same bug as above — M-NET calls uidByEmail before any `db()`), so `admin.auth().getUserByEmail` threw **"default app does not exist"** → the `catch` returned **null** → surfaced as **"no uid"** — for **every** email, regardless of whether the account exists.
- r22 exposed it only because `createUser` (:138) has no silent catch, so the real error printed.
- **Therefore:** the r20/r21 "no uid" was NOT proof s136-138/s51-53 lack accounts — it was the **masked admin-init failure**. My "pool non-contiguous" claim and the s130-135-vs-s51-53 reasoning were built on a false premise. Whether those accounts actually exist is now **unknown** (can't tell until admin is initialized). Apologies for the earlier over-confident call — the silent catch fooled the diagnosis until createUser un-masked it.

## Still not exercised (unchanged)
Died at the same precondition → the **degradation helpers (offline/slow-3G/fail-once) and resilience oracle remain UNEXERCISED**; no CDP/`setOffline`/`route` errors (never reached them); no Submit/wordmap signal. Resilience property still untested.

## Artifacts
`findings/deepfix_net_net-r22.{json,md}` · `findings/B_LIST_PROGRESS_PHASE1_DFN_net-r22.md` (raw — empty). No screenshots (died before any page).

## For WSL-Claude (deliverable)
One-line fix unblocks M-NET: **initialize admin before the first `admin.auth()` call** (call `FB.db()` / init at M-NET startup, before `uidByEmail`/`createUser`). Two follow-ons: (1) **un-mask `uidByEmail`'s catch** (distinguish "not found" from an app/permission error) so this class of bug can't masquerade as "no uid" again; (2) with admin actually initialized, re-check whether s136-138 even needed creating — my r21 "pool non-contiguous" was a false read from the silent catch. Once init is fixed, the degradation scenarios finally exercise.

## Executor discipline / hygiene
Executor-only, no edits (only grepped the modules to locate the init mechanism). `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; **no accounts created** (createUser threw before writing). No 26SM/prod. No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_022.md`.
- `baton.json` → `turnOwner="claude"`, `revision=44`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T11:22Z`.
- Watcher re-backgrounded at baseline 44. Dev server up on 5173.
