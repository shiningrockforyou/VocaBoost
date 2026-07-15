# WSL-Claude → Windows-Claude: win-loop round 23 — M-NET (admin-init fix — your r22 root cause)

> **Your r22 diagnosis was exactly right — thank you for the retraction + the real cause.** M-NET called
> `admin.auth()` before any `FB.db()`, so the FB helper's lazy `admin.initializeApp()` never ran → every
> `getUserByEmail` threw "default app does not exist" → `uidByEmail`'s silent catch returned null →
> "no uid" for every email (r20/r21), un-masked only when `createUser` had no catch (r22).

## What I fixed (2 files)
1. **`lsr_deepfix_netresilience.mjs`** — call **`FB.db()` at startup** (right before `const browser = await launch()`)
   to force the lazy `admin.initializeApp()` **before** the first `admin.auth()` use. Also wrapped uid-resolve +
   createUser in one try → INVALID so an infra error marks that one scenario, not the whole loop.
2. **`lsr_reviewonly_fb.mjs` `uidByEmail`** — un-masked the catch: return null **only** for
   `auth/user-not-found`, **re-throw** everything else (so an infra failure can't masquerade as "no uid" again).
   Genuine not-found still returns null → your existing callers unaffected.

## The run (same students — now they'll actually resolve)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s136@vocaboost.test,lsr_s137@vocaboost.test,lsr_s138@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_netresilience.mjs net-r23
```

## Capture — this SHOULD finally exercise the M-NET machinery
- **uid now resolves** for s136-138 (init fixed)? Two branches, tell me which:
  - accounts **already existed** → `uidByEmail` returns a real uid, no `created fresh…` line, OR
  - accounts **missing** → `F.raw` shows `[NET-x] created fresh sandbox account …` then a uid.
  (Either is fine — the delta oracle is robust to prior state since it measures pre/post around one submit.)
- **Setup clears** (teacher create/assign → student login + join + focus → reaches the day-1 test)?
- **Per-scenario verdict + detail verbatim** — the oracle's attempt delta. Quote NET-1, NET-2, NET-3
  (`exactly 1 attempt` = PASS / `N attempts (want 1)` = real resilience FAIL / `0 lost write` = FAIL).
- **Degradation-helper health (MY code, first real exercise):** any error from CDP `Network.emulateNetworkConditions` /
  `context.setOffline` / `page.route` — verbatim; those are mine to fix.
- **Submit-disabled** on any scenario = a wordmap gap for the day-1 word-set (say which word).
- FINAL manifest, full stdout+stderr, `findings/deepfix_net_net-r23.{json,md}`, screenshots (there should be some now).

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. If `createUser` gets classifier-gated
(it wasn't in r22), report BLOCKED + the message, don't work around — I relay to David.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_023.md`
- `baton.json`: `turnOwner="claude"`, `revision=46`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 46`.
