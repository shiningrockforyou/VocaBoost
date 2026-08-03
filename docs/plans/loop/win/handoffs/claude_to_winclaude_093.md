# ORDER 93 — PUSH ONLY (one leg, no deploys, no writes to production)

**From:** WSL Claude · **Round:** 93 · **Authority:** David, 2026-08-03, verbatim: *"have windows claude
push. remember wsl claude never had push permission"*.

## THE ONE LEG: push `main` to origin

Two commits are sitting local-only in the WSL worktree because I cannot push — that is by design, not a
broken credential, and I have now memorized it. They are already committed and the tree is clean.

```
git -C /app log --oneline -3      # expect 4a2dc3e at HEAD
git -C /app status --short        # expect EMPTY
git -C /app push origin main
git -C /app rev-parse --short HEAD origin/main   # the two MUST match
```

**Expected HEAD after push: `4a2dc3e`.** If HEAD is something *newer* than `4a2dc3e`, push it anyway and
say so in the review — it means I committed again after writing this order.

**AMENDED (baton rev 179): THE WORKTREE WILL BE DIRTY — push anyway.** Round 2 of the Opus panel
returned while this order was in flight and I am folding it now, so `git status` will show modified
files. That does NOT block a push: `git push` ships COMMITTED history, and the commits you are pushing
(`dfcda05`, `4a2dc3e`) are already sealed. **Push the committed HEAD and ignore the dirty tree.**
**Still do NOT commit, stash, checkout, or reset anything** — I own the fold and the log rows, and a
stash would silently take my in-flight work. If `git push` itself fails, report the error verbatim.

## WHAT IS IN THESE TWO COMMITS (context, not work for you)

1. `dfcda05` — the dark deploy's **leg 4**: `system_config/review_v2` seeded DARK and post-write verified
   (`enabled:false`, `firstEnabledAt:null`, `rehearsalClassIds:[]`, configVersion 1, 92/60/30). **THE
   DARK DEPLOY IS NOW COMPLETE** except the rules leg. Your r091 refinement is adopted into `17_ §7b`:
   rules land before **GATE 4**, not merely before gate 5.
2. `4a2dc3e` — **the rules workstream, authored and verified but NOT DEPLOYED.** Live base fetched
   read-only (ruleset `d8f3e0d0…`, 210 lines — the repo draft is 419, which quantifies exactly how right
   your r091 refusal was). Merged artifact + a 189-case emulator matrix (all green) + a per-clause
   mutation suite (6/6 mutants killed). An Opus panel reviewed it; round 2 is running now.

**Two hardening deltas beyond the spec, both verified inert in the client tree first** — worth your eyes
because they change *live* behavior at deploy time:
- **`role` is now CREATE-ONLY.** The live ruleset let ANY student rewrite their own `role`, and
  `isTeacher()` reads that field — so one write self-promoted a student to teacher, which then granted
  reading every other student's data, writing their progress records, and rewriting `ap_answer_keys`.
  Pre-existing live hole; this closes it.
- **The reset fence** (`resetAt`/`resetEpoch`/`resetInProgress`) is now client-unwritable, closing a
  path where a student could have erased their fail history *before* the GATE-4 backfill froze it as
  server truth. Production sweep found **zero** fence values across 2,519 progress docs, so nothing was
  ever forged.

## BOUNDARIES (unchanged)

- **NOTHING is deployed by this order.** No `firebase deploy`, no rules, no functions, no `system_config`
  writes. The rules artifact is NOT authorized for deploy — it still needs the Codex final gate (David's
  new sequencing: WSL+Opus converge first, Codex last) and then its own deploy order.
- `/app/firestore.rules` (the unshipped P10 draft) stays untouched. The artifact under review lives at
  `audit/deepfix/task3/live_baseline/firestore.merged.rules` and is deployed only by a future order.
- The global ON switch and the `RESET_V2` flip remain **David's alone**.
- No 26SM writes.

## RETURN

Flip the baton back with `execDecision: PUSHED` (or `HALTED_<reason>`), the pushed SHA, and confirmation
that `origin/main` equals local HEAD. Keep it short — this is a one-leg order.
