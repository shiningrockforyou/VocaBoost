# WINCLAUDE round 20 — M-NET first run — INVALID at UID precondition (before setup)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MNET_FIRST_RUN`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_020.md`
- **script:** `audit/playwright/lsr_deepfix_netresilience.mjs` (NEW, 6th matrix — first run)
- **git:** `a967f54` dirty · **run:** 2026-07-15T11:07Z (net-r20, students s136–s138)
- **execDecision:** `NOT_CLEAN` — **0/3, all INVALID (setup/harness), not resilience results. Died at the UID precondition BEFORE any browser setup.**

---

## FINAL manifest (verbatim)
```
▶ deepfix M-NET net-r20 — BASE=http://localhost:5173 tier=base list=LSR Base Camp (audit clone) students=3
  → NET-1 …
    ⚠️ NET-1 INVALID — no uid for lsr_s136@vocaboost.test
  → NET-2 …
    ⚠️ NET-2 INVALID — no uid for lsr_s137@vocaboost.test
  → NET-3 …
    ⚠️ NET-3 INVALID — no uid for lsr_s138@vocaboost.test
=== M-NET (net-r20) === NOT_CLEAN — 0/3
```
JSON: all three `INVALID`, `classId: null`. **Raw anomaly log is EMPTY** — the run never reached a teacher/class/join step.

## Setup did NOT clear — it died one step earlier than setup
This is **before** the calibrated `provisionClass` mirror even runs. The M-NET runner resolves each student's **UID as an upfront precondition** (Admin SDK / users lookup by email, for the `readAttempts` before/after oracle), and that lookup returned nothing for s136/137/138 → immediate INVALID, no browser work attempted (`classId=null`, empty log).

## Root cause (pointer, NOT a fix)
- **s136–s138 don't resolve to a UID.** Contrast: **s130–s135 worked** as recently as mig-r19 (their UIDs — hXSKzDlS, w0qimnAT, … — resolved fine for the Admin-SDK migration oracle). s136–138 are **brand-new, beyond the pool used all session.**
- Two candidate explanations for you to disambiguate:
  1. **s136–138 have no Firebase Auth account yet** — the sandbox `lsr_s*` pool was pre-seeded only up to ~s135, so there's nothing to resolve. (Auth login requires a pre-existing account, so a truly-never-created email has no uid.)
  2. **Ordering:** M-NET resolves the uid **before** logging the student in, so even if the account would be auto-provisioned on browser login (as M-UI does), the upfront lookup runs too early.
- **Fix direction (yours):** either point M-NET at **already-provisioned students** (e.g. s130–s135, or any ≤ the seeded ceiling), **or** move the uid resolution to **after** the browser login/provisioning step (mirror how M-UI reaches the student), **or** pre-create s136–138 accounts. The handoff's "setup mirrors provisionClass" is true, but the uid precondition runs ahead of it.

## What this run did NOT validate (flagging the gap)
Because it died at the uid precondition, **none of the new M-NET machinery was exercised**:
- The **degradation helpers** (`withOffline` / CDP slow-3G / `withFailOnce` route) — **unexercised**; no CDP/`setOffline`/`route` errors observed (can't confirm they work yet).
- The **`readAttempts` before/after oracle** — unexercised.
- The **resilience property** (exactly-1 attempt under degradation) — **untested** for all 3 scenarios.
- No Submit-disabled / wordmap-gap signal either (never reached the test).

So: no resilience result yet, and the new helpers still need their first real exercise once the student-resolution is fixed.

## Artifacts
`findings/deepfix_net_net-r20.{json,md}` · `findings/B_LIST_PROGRESS_PHASE1_DFN_net-r20.md` (raw — empty). No screenshots (died before any page).

## For WSL-Claude (deliverable)
M-NET's runner is wired but the **student-UID precondition fails for the fresh s136–138** (likely beyond the seeded account pool, and/or resolved before provisioning). Repoint M-NET at provisioned students (s130–135) or resolve the uid after login, hand me a re-run, and the 3 degradation scenarios + the readAttempts oracle can finally exercise. Nothing about the resilience property is known yet.

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; nothing provisioned/written (died at lookup). No 26SM/prod. No commits/branches. No classifier gate.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_020.md`.
- `baton.json` → `turnOwner="claude"`, `revision=40`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T11:09Z`.
- Watcher re-backgrounded at baseline 40. Dev server up on 5173.
