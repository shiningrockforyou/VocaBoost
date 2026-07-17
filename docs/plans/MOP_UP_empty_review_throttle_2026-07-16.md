> **⛔ WITHDRAWN 2026-07-16 — PREMISE REFUTED. DO NOT EXECUTE.**
> Adversarial verification (code-fidelity agent) + my direct check of raw attempt docs proved the core
> premise WRONG. `reviewScore=0` entries are **not** empty-served tests — they are real 30-question review
> tests the student **SKIPPED** (`totalQuestions:30, skipped:30, answers:[], score:0`, with real word
> segments, e.g. 이아연 day9 seg=[405..464]). TRUE empty-served tests (`totalQuestions:0`) record
> `score:100, passed:true` and appear as `reviewScore:null` in recentSessions — never 0; the app already
> handles them correctly. So the throttle on these students is driven by **genuine review skips**, not a
> bug. The fix would have erased real skip-signal and un-throttled students who aren't doing their reviews.
> Invalid scripts (`fix-empty-review-throttle.mjs`, `empty-review-sweep.mjs`) deleted. No writes were made.
> Kept for the record. See SUPPORT_RUNBOOK CS-2026-07-16.

# MOP-UP PLAN — Empty-Review Throttle Cleanup (CS-2026-07-16) [WITHDRAWN]

**Scope: TODAY's data mop-up ONLY (band-aid).** Root code fix (empty slice → record `null` not `0`) and
csd-inflation correction are explicitly **DEFERRED** — not in this change.

## Problem (grounded)
The review scheduler `computeUnmasteredSegmentIds` (studyAlgorithm.js) serves some study days an **empty**
review (0 words — the day-indexed slice lands past the unmastered pool). The app records that as
`reviewScore = 0`. Those fabricated 0s enter `recentSessions` and, via `calculateInterventionLevel`
(last-3 non-null `reviewScore`s, studyAlgorithm.js:66), pin the throttle high — falsely throttling students
whose **real** reviews are fine. The #11 fix (review-only days complete + advance csd) then runs them through
multiple empty days (the TA-reported 이아연 symptom: Day 8→11 with 0%s).

**Evidence (live 26SM read-only sweep, `scripts/cs/empty-review-sweep.mjs`):** 23 real students throttle-inflated
by empty tests (~16 fully un-throttle 1.00→0.00); 87 genuinely throttled students correctly untouched. 이아연:
nulls days [6,7,9,10], keeps real d8:77%/d11:73% → interv 1.00→0.00; she has **zero** genuine low reviews.

## The fix
`scripts/cs/fix-empty-review-throttle.mjs`: set `reviewScore = null` (the **correct** value for a 0-word test —
no words → no score) on ONLY entries with positive empty-attempt evidence (`answers.length===0` and no >0-word
attempt that day). Recompute `interventionLevel` + `stats` from the cleaned array. **Touch nothing else** — no
csd, twi, attempts, or anchors → no invalid-anchor risk (runbook golden rule). Reconciliation never rebuilds
`recentSessions` (only writer is progressService.js:589, append-only) → the fix sticks.

## Safety
- **Dry-run by default**; `--commit` required. Single-student capable (`--email=`/`--uid=`). `DUP`/`25WT` sandbox
  classes excluded from the cohort.
- **Rollback snapshot** on commit → `scripts/cs/backups/empty_review_2026-07-16.jsonl` (full before-state of
  `recentSessions`/`interventionLevel`/`stats` per doc).
- Original review scores also remain in the `attempts` records (only `recentSessions` is edited).

## Steps
0. **Verify (agents — grounded + adversarial, NO Codex).** 3 parallel lenses: (A) code-fidelity/correctness,
   (B) safety/adversarial/blast-radius, (C) independent live-data re-derivation. I verify every finding myself.
1. Integrity sweep BEFORE (`scripts/cs/data-integrity-sweep.mjs 26SM`) — baseline.
2. Commit 이아연 alone (`--email --commit`) → verify her recomputed interv=0 / next-session allocation.
3. Commit the batch (`26SM --commit`) — the 23 inflated docs.
4. Sweep AFTER + re-run `empty-review-sweep.mjs` → confirm 0 inflated remain, sweep still CLEAN.
5. Log → `change_action_log.md` (code/script) + `SUPPORT_RUNBOOK.md` CS-2026-07-16 (data intervention).

## Deferred (NOT today)
- **Root code fix:** empty review slice must record `reviewScore=null` / skip, not `0` — stops recurrence.
- **csd-inflation correction:** some students' day counter ran ahead of real progress (이아연 csd 11 vs ~8).
