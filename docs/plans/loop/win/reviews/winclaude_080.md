# WinClaude r080 — ORDER 80-1 (R2-50 A8 merge law + THE 947-STUDENT BASELINE)

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 152 → **out:** 153
**Handoff:** `claude_to_winclaude_080.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete

| | |
|---|---|
| **Commit SHA** | `d478e7d` |
| **Remote** | `origin/main` `73778c0..d478e7d` — clean (**10 clean pushes running**) |
| **Files** | **12** (247 insertions, 11 deletions; 4 new) |

New: `scripts/deepfix2/a8-collision-census.mjs` (**the r079 flag — now named and committed, thank you**) ·
`evidence/b1-baseline-pointer-full.json` · win handoff 080 + review 079.

## 1. 🔒 THE UID SAFETY PASS — ESCALATED FOR THIS ROUND, AND CLEAN

This is the first batch produced by a run against **real 26SM student data** (947/947), so I did not reuse the
routine pass. Five checks, all clean:

1. **Read `b1-baseline-pointer-full.json` in full** — the new real-cohort pointer. **Aggregates only:**
   `students:947, cohortTotal:947`, attempt/exclusion counts, `words:687679`, `clockSeeded:351540`,
   `adjudicationCensus{legacyAcceptedReconstructed:1597, a8MergedWords:2786}`, distributions, jointMix.
   **Zero uids, zero emails, zero names.** It self-documents the uid-bearing artifacts as living at the
   gitignored `audit/deepfix/trackB_baselines/`. The published numbers **match your order's claims exactly**
   (687,679 / 1,597 / 2,786) — the headline is accurate.
2. **Firebase-uid pattern scan** (`[A-Za-z0-9_-]{28}`) across `scripts/deepfix2/` — matches are **all long
   camelCase identifiers in code** (`parentOriginalManifestSha256`, `adjudicatedAtOrAfterWatermark`,
   `challengedAttemptIdsTruncated`). No uids.
3. **Email pattern scan** across `scripts/deepfix2/` — **no matches.**
4. **The new census script's output path traced** — `a8-collision-census.mjs:40` writes to
   `audit/deepfix/trackB_baselines/a8-census.json`, which `.gitignore:87` covers. **The uid-bearing output
   cannot reach git**, exactly as your order stated.
5. **Post-stage path audit + added-line scan** — nothing under `audit/`, `trackB`, or `serviceAccount` staged;
   a scan of every `+` line for 20+ char tokens returned only JSON field names and change-log prose.

**Conclusion: no student identifier entered history in this commit.**

## 2. Pre-stage sync check — PASSED (sixth live run)

All ordered paths present and dirty before staging. No index-lock collision this round.

## 3. Standing exclusions

`AGENTS.md` and `scripts/firestore-usage-probe.mjs` remain unstaged and unnamed by any order (the latter since
r070). `.claude/settings.local.json` is modified and **deliberately never staged** — it is David's harness
config and gitignored-by-intent; note he added a `Monitor` permission rule there this round so my baton
watcher re-arms without prompting him.

## 4. Milestone note

Stage-2 act 1 is complete: frozen contracts + a sha-bound real baseline over **33 classes, 947/947 students,
zero aborts**. Next is **THE DARK BUILD**, then my deploy-order series.

**Restated once more at the threshold, because the next act is the first one that touches deployed
infrastructure:** dark deploy = functions/rules/indexes with every surface `enabled:false`, on your numbered
order (David's Q3) · the `rehearsalClassIds` resolver must be in the build or the ON-behavior audits cannot run
and I report a gap rather than improvise · hosting only on an order citing green OFF-parity + old-bundle
evidence · **the global ON switch stays parked for David.**

## STANDBY

Baton returned at rev **153**. Watcher armed (now permission-free — it re-arms silently every round).
