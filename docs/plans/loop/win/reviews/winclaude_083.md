# WinClaude r083 — ORDER 83-1 (the r70 fold) + **A MATERIAL FINDING ON THE DARK DEPLOY**

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 157 → **out:** 158
**Handoff:** `claude_to_winclaude_083.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete, with one escalation recorded below

| | |
|---|---|
| **Commit SHA** | `c7abf0a` |
| **Remote** | `origin/main` `ca8d4fe..c7abf0a` — clean (**13 clean pushes running**) |
| **Files** | **28** (2,676 insertions, 654 deletions; 9 new) |

## 1. 🔴 ESCALATED TO DAVID: THE DARK DEPLOY IS NO LONGER BEHAVIOR-NEUTRAL FOR REAL STUDENTS

**This is the most important thing in this report and I have told David directly.**

David's Q3 grant authorized the dark deploy as *functions + rules + indexes, all `enabled:false`* — the
premise being **zero effect on the live 26SM cohort**. This commit changes that premise.

**The mechanism:** `resetProgress` (`foundation.js:2056+`) is a **live callable**,
`SERVER_RESET_PROGRESS_ENABLED = true` (`foundation.js:51`), and it is **NOT gated by
`system_config/review_v2.enabled`**. It has been rebuilt, and it now does
`require("./reviewV2/reset")` (`foundation.js:~2160`). **The engine is therefore no longer purely dormant —
a live production callable executes reviewV2 code.** That directly supersedes my r081/r082 verification that
nothing imported `reviewV2/`.

**What actually changes for a real student who resets after the dark deploy:**

| Change | Live impact |
|---|---|
| Fence-first ordering | epoch stamped in an opening txn (absolute `max(both)+1`) instead of `FieldValue.increment(1)` at the end |
| Reset lock | a concurrent second reset now gets `aborted / reset_already_running`; a crashed lock is takeover-eligible after 10 min |
| **Grading-job cancellation** | claimed `grading_jobs` for the list are set `cancelled_reset` and **`rows` deleted** — **NEW destructive behavior on a collection that exists in production TODAY** |
| Restudy bookmark clears | `restudyBookmarks.{classId}_{listId}` map-key deletes |
| Nine reviewV2 families | swept stale-epoch-only — **no-op in production today** (those collections are empty pre-flip) |
| **Pre-P5 `list_progress` write** | the fence stamps BOTH tombstones, which **supersedes the P4-era "collection provably empty" guarantee** — you logged this as a deliberate supersession in the code comment; flagging that it is a behavior change to a documented invariant, not just a reordering |

**Your handoff called this "the ONE live-behavior change… it deploys only with the dark train."** Accurate and
appreciated — but *"deploys only with the dark train"* is not a mitigation, because **the dark train is
exactly what makes it live.** The characterization David authorized ("all surfaces off") no longer fully
describes what the deploy does.

**What I did:** committed as ordered (a commit is not a deploy; nothing has changed for anyone yet), and
**escalated to David in-session** with the full mechanism, offering him the option to exclude reset from the
dark train or hold it until the shadow audit exercises it. **His answer will govern my dark-deploy execution.**
Until he rules, I will not treat "dark deploy = zero student impact" as true in any report.

**In fairness to the design** (recorded so this reads as a flag, not an alarm): the implementation is careful.
`reviewV2/reset.js` deletes **stale-epoch-only** (`resetEpoch < targetEpoch`), scoped to
`users/{uid}/{family}` filtered by `listId`; **untagged docs are deliberately left for manual audit, not
deleted**; the lock is **owner-cleared** by `opId`; asserts are re-read inside the txn. And 25WT rehearsal +
the shadow audit both sit between here and any real exposure.

## 2. The three surgical `foundation.js` changes — each verified

| Claimed | Verified |
|---|---|
| (a) §6b grading-preimage copy in the accept writer | append-only spread — `...(typeof answer.gradedIsCorrect === 'boolean' ? {} : {gradedIsCorrect: answer.isCorrect === true})`; an existing preimage is **never overwritten**; comment cites the law ✅ |
| (b) additive exports | `durableProgressRef` / `defaultProgressShape` / `mondayOfWeekTimestamp` / `deriveDailyPace` — additive only, no existing export altered ✅ |
| (c) `resetProgress` rebuilt to §9 | confirmed — and escalated per §1 above ✅ |

Diffstat confirms the surgical claim: `foundation.js` +130/−17, `index.js` **+1 line** (the
`reviewV2ComposeNewTest` export), `src/services/db.js` **+7 lines**.

## 3. `src/services/db.js` — the FIRST client-code change of the program

+7 lines at `~:2902`, the client mirror of the §6b preimage copy, same append-only shape, inside
`reviewChallenge` (a **teacher** action, not a student one).

**Consequence to note:** my r078 statement that *"zero `src/**` changes have passed through my hands"* is now
**superseded** — and so is the drift audit's "student-facing scope byte-identical." The shipped client bundle
will differ from the current one the moment hosting deploys. It is additive and low-risk, but **the
OFF-parity / old-bundle checks gating hosting (David's Q6) must be evaluated against this delta, not against
an assumed byte-identity.**

## 4. Safety pass

Secret + email scan across `functions/reviewV2/` — **no matches**. Post-stage path audit — nothing matching
`serviceAccount`, `trackB`, or `audit/`. `src/` staged = **`services/db.js` only** (no other client file
swept in). The new `engine-lap-result.json` receipt carries sha16s + counts, no uids. Sync check PASSED
(ninth run).

## 5. ⚠️ THIRD INDEX-LOCK COLLISION — the r077/r078 finding is still unfixed

`git commit` failed again on `index.lock`. Handled as before: **lock not deleted**, backgrounded an
`until [ ! -f .git/index.lock ]` waiter, **re-verified the staged index after it cleared** (28 files, `HEAD`
still `ca8d4fe`, `src/services/db.js` still staged), then committed.

Three collisions in seven rounds. `--no-optional-locks` has not solved it, as predicted at r078 — the fix is
**scope**: run no index-touching git command while I hold the baton. This remains the most likely cause of an
unattended stall.

## STANDBY

Baton returned at rev **158**. Next: the r71 verdicts fold, else **the dark-deploy order series on a
double-YES** — which I will not execute as "zero student impact" until David rules on §1.
**Global ON switch: parked for David.**
