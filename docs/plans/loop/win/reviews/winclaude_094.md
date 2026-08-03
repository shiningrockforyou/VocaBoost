# WinClaude r094 — ORDER 94: PUSH ONLY (five commits)

**Date:** 2026-08-03 · **Baton rev in:** 181 → **out:** 182

## VERDICT: `PUSHED`

- **Pushed SHA / local HEAD: `69a4b1a`** (exactly the expected HEAD — not newer)
- **`origin/main` == local HEAD: YES** · `git status -sb` → `## main...origin/main`, no ahead/behind
- Range: `4a2dc3e..69a4b1a` — all five commits landed:
  `4fd98f7` r2 fold · `64d55ec` r3 fold · `10dde7c` execution-discipline tooling ·
  `54e164d` skills + plan gate · `69a4b1a` r4 fold
- **No deploys, no writes, nothing activated.**

**Dirty tree:** 2 paths at push time, still 2 after. **I did not commit, stash, checkout, or reset.** Push
ships committed history only, so the in-flight work was never at risk.

## The defect-class finding is the important thing in this order

Three of five review rounds found **the same defect class**: a guard written for one operation while its
siblings stayed open.

| Round | The hole |
|---|---|
| r1/r2 | `role` update-only ⇒ **delete-then-recreate** walked around it |
| r3 | reset fence create+update ⇒ **delete** cleared it |
| r4 | `manualOverride` delete-only ⇒ a student could **CREATE a forged CS override anchor**, and a teacher could **strip the marker then delete** |

**Root cause named correctly:** each key list was written out once *per operation*, so editing one copy left
the siblings behind. **The fix is the right kind of fix** — every list is now a single rules *function* used
by all branches, which makes the divergence *impossible to write* rather than merely fixed this time. That is
a class-elimination, not a bug-swat, and it is why the count matters: 213/213 matrix, 12/12 mutants killed,
artifact frozen at `sha16 a08c81ccc1d812eb`.

**Worth stating plainly for the record:** this pattern is exactly why the rules leg was worth refusing at
r091 and re-scoping into its own workstream. Had the original order gone through, the merged file would have
shipped with at least the r1 `role` hole open — on top of the unshipped P10 cutover. Five rounds of adversarial
review on a security artifact is proportionate; two would not have been.

## The `firestore.rules` path correction — noted and endorsed

You record that your attempt to move the deploy path off `/app/firestore.rules` **was itself wrong and is
reverted**. Endorsed: `firebase.json` maps `rules → firestore.rules`, so that file *is* the deploy path, and
quietly repointing it would have split the "what deploys" question across two files — worse than the problem.
The right shape is the one you now have: **the artifact stays out of the deploy path until its own order
`cp`s it in, verifies the sha, deploys, and re-baselines.**

**`firestore.rules` still holds the unshipped P10 cutover. I will not deploy rules by any route** — not via
`--only firestore:rules`, not as a side effect of another target — until that order arrives with the Codex
final gate behind it. When it does, the r091 clause applies again: **strictly additive relative to the live
210-line base, verified by me, or refused.**

## Also noted

`scripts/deepfix2/gate.mjs` — a pre-publish gate that fails closed on unticked plan rows, stale scores, and
unsupported claims, and **has already blocked four stale numbers.** Good: that is the same failure mode as the
two false *premises* caught at r83 and r89 (documented claims drifting from reality), now caught mechanically
instead of by review.

## STANDBY

Baton returned at rev **182**. Watcher armed. Outstanding: the rules deploy order (post-Codex gate) — the only
remaining leg of the dark deploy.
