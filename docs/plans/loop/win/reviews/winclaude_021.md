# WINCLAUDE round 21 — M-NET re-run (s51-53) — still INVALID at uid precondition

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MNET_RERUN`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_021.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T11:12Z (net-r21, students s51–s53)
- **execDecision:** `NOT_CLEAN` — **0/3, all INVALID again at the uid precondition. The "< s135 = provisioned" theory is DISPROVEN — but I disambiguated the root cause + found the known-good pool.**

---

## FINAL manifest (verbatim)
```
▶ deepfix M-NET net-r21 — BASE=http://localhost:5173 tier=base list=LSR Base Camp (audit clone) students=3
  → NET-1 …  ⚠️ NET-1 INVALID — no uid for lsr_s51@vocaboost.test
  → NET-2 …  ⚠️ NET-2 INVALID — no uid for lsr_s52@vocaboost.test
  → NET-3 …  ⚠️ NET-3 INVALID — no uid for lsr_s53@vocaboost.test
=== M-NET (net-r21) === NOT_CLEAN — 0/3
```
Raw log empty again; `classId: null`. Died at the same precondition, before any browser work.

## The r20 theory is wrong — but here's the actual root cause (disambiguated)
WSL-Claude's repoint assumed **s51–s53 are "< the ~s135 ceiling = provisioned."** They are **NOT** — `no uid` for all three. So the seeded `lsr_s*` Auth pool is **non-contiguous** (has gaps), not a solid 1..135 range.

**Mechanism (grepped the runner — pointer, not a fix):**
- `lsr_deepfix_netresilience.mjs:131` → `const uid = await FB.uidByEmail(email)` — a **forward email→uid Admin lookup**, done at **:132 BEFORE the login at :153**. If the account doesn't exist, `uidByEmail` returns null → `no uid` → INVALID, fail-fast.
- Contrast with M-MIG (which resolved uids fine in mig-r19): it goes the **other direction** — it enumerates already-existing Firestore docs and resolves `email` *from* each doc's `uid` (`admin.auth().getUser(uid)`, migrate_audit.mjs:179). So M-MIG only ever sees accounts that already exist; it never forward-resolves an arbitrary email.
- **Conclusion:** `no uid` = the account genuinely **does not exist** for that email (same requirement M-UI's login has — M-UI would've said "student login failed"; M-NET just fails one step earlier).

## ★ The known-good pool (this is the actionable part)
Accounts proven to EXIST this session:
- **s41–s50** — used across M-UI rounds 3–12 (logins succeeded) → they exist, **but they're the polluted pool** (the RS-1/RO-S1 accumulation).
- **s130–s135** — used in M-UI r16 + M-MIG r17–19; **their uids resolved cleanly in mig-r19** (cohort uids hXSKzDlS, w0qimnAT, OYJ5NYWk, l7bIs5RS, d1LmoxgW, PXmLkDFD). **Proven-existing + Admin-resolvable.**
- **s51–s53 and s136–138 do NOT exist** (both `no uid`).

## Fix direction (yours)
1. **Point M-NET at s130–s135** — proven-existing and Admin-resolvable. (Trade-off: they carry some prior state from r16–19; M-NET only needs 3, and its own `resetStudentState` at :150 may clear enough — or seed a clean day-1.)
2. **OR** confirm the actual seeded `lsr_s*` membership before picking (the pool is non-contiguous — guessing "any number < ceiling" fails).
3. **OR** the robust fix: have M-NET **provision/create** the student account (or resolve the uid *after* a login that auto-provisions) instead of assuming a pre-existing account — then any email works. That's your call on whether account-creation is in-scope for the harness.

## Still not exercised (unchanged from r20)
Died at the uid precondition again → the **degradation helpers (offline/slow-3G/fail-once) and the readAttempts oracle are STILL unexercised**; the resilience property remains **untested**. No CDP/`setOffline`/`route` errors (never reached them). No Submit-disabled signal (never reached the test).

## Artifacts
`findings/deepfix_net_net-r21.{json,md}` · `findings/B_LIST_PROGRESS_PHASE1_DFN_net-r21.md` (raw — empty). No screenshots (died before any page).

## For WSL-Claude (deliverable)
Not the students' provisioning ceiling — the pool is **non-contiguous** and s51-53 simply don't exist. Repoint M-NET at the **proven-existing s130–s135** (mig-r19 evidence), or make the runner provision-then-resolve. Then the 3 degradation scenarios finally exercise. No resilience result yet.

## Executor discipline / hygiene
Executor-only, no edits (only grepped the runner for the resolution mechanism). `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; nothing provisioned/written (died at lookup). No 26SM/prod. No commits/branches. No classifier gate.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_021.md`.
- `baton.json` → `turnOwner="claude"`, `revision=42`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T11:14Z`.
- Watcher re-backgrounded at baseline 42. Dev server up on 5173.
