# WinClaude r095 — ORDER 95: PUSH ONLY (the Codex final-gate target)

**Date:** 2026-08-03 · **Baton rev in:** 183 → **out:** 184

## VERDICT: `PUSHED`

- **Pushed SHA / local HEAD: `0a7510f`** — exactly the expected commit, not newer
- **`origin/main` == local HEAD: YES** · `## main...origin/main`, no ahead/behind
- Range `69a4b1a..0a7510f`, one commit: *"rules panel r5 fold: close the docId synonym and the engine stamps"*
- **No deploys, no writes, nothing activated.** Dirty tree (2 paths) untouched — no commit, stash, checkout,
  or reset.

**The Codex final gate is now unblocked** — its review target is on `origin/main`.

## On the r5 YES — what makes it worth trusting

Recording this because it is the last review before a security artifact reaches production, and the *shape* of
the evidence matters more than the verdict:

- **Refactor-equivalence proven textually** — 62-vs-62 statement comparison. The r94 fix (collapsing per-op
  key lists into shared functions) was the highest-risk kind of change: a refactor of a security artifact.
  Proving the refactor changed no statements is the right proof for that specific risk.
- **1136-probe differential with ZERO new write allows** — the only number that answers "is it strictly
  additive?" empirically rather than by reading.
- **Evaluation-limit headroom MEASURED (~17×), with the crucial property that over-budget fails at COMPILE
  time.** That matters more than the ratio: a rules ruleset that exceeded its budget at *runtime* would
  produce silent denials in production — students blocked at random with no error trail. Compile-time failure
  makes that class impossible rather than unlikely.
- **12 function-swap mutants authored by the reviewer, all killed** — mutants written by the reviewer, not the
  author, are the ones that count.

The second lens found no rule-content reason to block (*"strictly safer than live on every surface I
probed"*), and its remaining items were **synonyms** — the same authority reachable by a different name:
`resetEpoch`'s mere *presence* being the engine/legacy discriminator, and the manual-anchor **docId** that
three CS consumers treat as equivalent to `manualOverride`, one of them a **migration writer over the
947-student cohort**. Both closed.

**That synonym class is the r94 defect class in a new dress** — a guard naming one route to an authority while
an equivalent route stays open. Five rounds, and the last two both found it. Worth carrying into the Codex
gate as a named thing to hunt rather than hoping it is exhausted.

## Boundaries — restated because the next order is the rules deploy

`firestore.rules` **still holds the unshipped P10 cutover and is still the configured deploy path**
(`firebase.json`: `rules → firestore.rules`). **I will not deploy rules by any route** — not
`--only firestore:rules`, not as a side effect of another target — until the post-Codex order arrives.

When it does, I will: verify the artifact's `sha16` matches `def5231f5be328c2` **before** it is copied into
the deploy path · read the resulting `firestore.rules` diff against the **live 210-line base** · deploy only
if I can read it as strictly additive · and re-baseline after. **Same clause as r091: additive, or refused.**

The global ON switch and the `RESET_V2` flip remain David's alone. No 26SM writes.

## STANDBY

Baton returned at rev **184**. Watcher armed. Outstanding: Codex's final gate, then the rules deploy order —
the last leg of the dark deploy.
