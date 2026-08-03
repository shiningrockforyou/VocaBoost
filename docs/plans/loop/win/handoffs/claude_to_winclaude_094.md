# ORDER 94 — PUSH ONLY (five commits). No deploys, no production writes.

**From:** WSL Claude · **Round:** 94 · **Authority:** David's standing full-permission go, 2026-08-03,
plus his ruling that WSL never had push permission — pushes are yours.

## THE ONE LEG

```
git -C /app status --short        # EXPECT DIRTY OR CLEAN — either is fine, push regardless
git -C /app log --oneline -6      # expect 69a4b1a at HEAD
git -C /app push origin main
git -C /app rev-parse --short HEAD origin/main   # the two MUST match
```

**Expected HEAD: `69a4b1a`.** If HEAD is newer, push it anyway and say so. **A dirty worktree does NOT
block this** — `git push` ships committed history. **Do NOT commit, stash, checkout or reset anything**;
a stash would silently take in-flight work. If `git push` itself fails, report the error verbatim.

## WHAT IS IN THE FIVE COMMITS (context, not work for you)

`4fd98f7` r2 fold · `64d55ec` r3 fold · `10dde7c` execution-discipline tooling · `54e164d` skills +
plan gate · `69a4b1a` r4 fold.

The rules artifact has now been through **five review rounds**. Three of them found the *same* defect
class — a guard written for one operation while the sibling operations stayed open:
- `role` guarded on update only ⇒ delete-then-recreate restored self-elevation;
- the reset fence guarded on create+update ⇒ deleting the doc cleared it;
- `manualOverride` guarded on delete only ⇒ a student could CREATE a forged CS override anchor, and a
  teacher could STRIP the marker then delete the attempt.

**Root cause and fix worth your eyes:** each key list was written out once per operation, so editing one
copy left the siblings behind. Every list is now a single rules **function** used by all branches, which
makes that divergence impossible to write. Verification: **213/213 matrix · 12/12 mutants killed**,
artifact frozen at sha16 `a08c81ccc1d812eb`.

Also in these commits: a pre-publish gate (`scripts/deepfix2/gate.mjs`) that fails closed on unticked
plan rows, stale test scores and unsupported claims — it has already blocked four stale numbers from
being published — plus `session-start.sh` and three Claude skills.

## BOUNDARIES (unchanged)

- **NOTHING is deployed by this order.** No `firebase deploy`, no rules, no functions, no
  `system_config` writes.
- `/app/firestore.rules` still holds the UNSHIPPED P10 cutover and **is** the configured deploy path
  (my attempt to move it off was itself wrong and has been reverted). **Do not deploy rules by any
  route.** The real rules order will `cp` the merged artifact into that path, verify its sha, deploy,
  then re-baseline — and it is not authorized yet: Codex's final gate comes first.
- The global ON switch and the `RESET_V2` flip remain **David's alone**. No 26SM writes.

## RETURN

`execDecision: PUSHED` (or `HALTED_<reason>`), the pushed SHA, and confirmation that `origin/main`
equals local HEAD. Short review is fine.
