# WinClaude r089 — ORDER 89-1 (the r77 fold)

**Date:** 2026-08-03 · **Executor:** WinClaude · **Baton rev in:** 170 → **out:** 171
**Handoff:** `claude_to_winclaude_089.md` · **Authority:** B + E (David, r69).

## THE SHA (bind the r77 review to this)

# `3cb6e40`

`origin/main` `503b3ed..3cb6e40` · 12 files (396 insertions, 43 deletions; 5 new) · pushed first attempt.

## 1. ✅ THE NETLIFY QUESTION IS ANSWERED — YOUR §8 "UNCONFIRMED" IS NOW CONFIRMED, AND THE HOLD IS LIFTED

Your handoff recorded the lever as **UNCONFIRMED pending David's word**, and kept my frontend hold in place.
**David has since ruled, in-session, verbatim:**

> **"I turned off auto publishing so it is a non-issue. Continue"**

I recorded this at **baton rev 169** — your r89 write (rev 170) crossed it, so you were working from the
pre-ruling state. To close it explicitly:

- **Netlify auto-publish is OFF, by David's own action.** Your forensic read was correct — one `published`
  deploy (`ce09792`) against four `completed` builds was exactly the signature of a stopped auto-publish.
  Good inference from the evidence available to you.
- **THE FRONTEND HOLD IS LIFTED.** The client phase can be committed to `main` normally. **No branch strategy
  is needed** — please do not build one.
- **Q6 is now properly satisfiable**: builds run per push but production stays pinned until David publishes,
  so the OFF-parity and old-bundle checks can be evaluated against a built-but-unpublished deploy *before*
  release. That is a better gate than the original wording assumed.
- The already-live `db.js` change stays (teacher-path, additive, harmless). **No rollback indicated.**

Please update `17_` §8 from UNCONFIRMED to **CONFIRMED — David, 2026-08-03**.

## 2. Codex r76 #1 — a live defect from a false premise, worth recording plainly

You published a false premise about the legacy attempt writers, and the fence built on it **would have refused
every legitimate legacy review containing a skipped question**, stranding those students' day completions
through the flip window. Now fixed against the live writers, fixtured with a discriminating 28/30 case, and
the artifact's premise corrected.

**Recording it because the pattern matters, not to belabour it:** this is the second time a *documented
premise* — not a coding slip — produced a would-be live defect (the first was the r83 reset scope). Both were
caught by review rather than by testing, because a fixture written from the same false premise agrees with the
code. The r74 ledger discipline and the "other-leg rule" you adopted are the right response; **premise
statements in `15_`/`17_` deserve the same verify-against-live-code treatment that code diffs get.**

## 3. Order verification

- `src/` **unchanged** — confirmed pre-commit. Bundle byte-identical, and with production pinned this push
  publishes nothing regardless. Both of your assertions hold.
- Lap **220/220**.
- Safety pass: nothing matching `serviceAccount`, `trackB`, or `audit/` staged. Sync check PASSED (fifteenth
  run). No index-lock collision. Push succeeded first attempt (no repeat of the r88 two-minute timeout).

## STANDBY

Baton returned at rev **171**. Review target bound: **`3cb6e40`**.

Outstanding gate: Codex r77's verdict. On a YES the dark-deploy series begins — and with the Netlify question
closed, **both halves of gate 2 are now unblocked**: the backend deploy via `firebase deploy`, and the
frontend build committed to `main` as normal.
