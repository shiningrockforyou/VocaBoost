# Free-Navigation Model — remove forced progression, gate only unreached words

**Date:** 2026-07-16 · **Status:** design sketch for a direction decision (vs. continuing to harden the gated model).

## The model in one rule
A list is an ordered array of words `[0..N)`. A student has a **frontier** = `totalWordsIntroduced` (twi) — the
furthest they've been introduced. Everything behind the frontier is **theirs, freely**:

> **Free within `[0, frontier)`** — study, re-study, review any word/segment, in any order, any number of times.
> **The only gate: `[frontier, N)`** — unreached words. To reach them, the student takes the *next* new-words
> segment, which moves the frontier forward. New segments are **offered, never forced.**

That's it. No day-completion gate, no throttle, no review-only deadlock, no "pass the new-word test first."
"Day N" stops being a gated state and becomes a **label** (a segment slice), derived from the frontier.

## What gets DELETED
- **The Day-2+ completion gate** ("먼저 새 단어 시험을 통과해야 합니다") — this *is* the #11 wall. Gone.
- **The intervention throttle** — `interventionLevel → newWordCount=0 → review-only deadlock`. Gone. The student
  chooses review vs. new words; the system never forces 0 new words.
- **Review-only "days" as a forced state** — review becomes an always-available mode, not a gated day.
- **`currentStudyDay` as an authoritative/defended value** — derived from the frontier (`ceil(twi / segment)`),
  display-only. No day-guard, no completion write, no cross-class csd reconciliation.
- **The whole `#11` family** — freezes, throttle-resets, list-end walls — structurally impossible.

## What STAYS (the part that actually teaches)
- **Spaced-repetition review scheduling** — per-word `study_states` (mastery/NEEDS_CHECK/due) unchanged; the app
  surfaces "N words due for review." This is the pedagogy; keep it.
- **Mastery tracking + grading** (typed/MCQ tests) — used to *inform* (mastery %, due count), not to *gate*.
- **The frontier (twi)** — the one durable progression value. Already student+list-scoped and monotonic.
- **Teacher assignment** — `pace` becomes the *suggested* segment size + a soft target, not a hard gate.

## "Offer new segments when it comes time"
The dashboard suggests advancing the frontier ("Ready for the next 40 words?") — optionally softened by a nudge
when the review backlog is large ("You've got 180 words due — review first?"). But it's a **suggestion**: the
student can take new words anytime, or stay in review. Default flow can still be learn-then-review; just not enforced.

## Data & migration — mostly DELETION, not restructuring (low risk)
- `class_progress`: keep `totalWordsIntroduced` (the frontier — already present). `currentStudyDay` → derived/
  display-only. `interventionLevel`, forced `recentSessions` logic → dropped (keep for stats if wanted).
- `study_states`, `attempts`: unchanged.
- **Cross-class carry becomes trivial:** frontier = `max(twi)` across the student's classes on that list;
  study_states merge by union/most-mastered. Both are monotonic → no csd position to reconcile. The hard,
  bug-prone part of `LIST_SCOPED_RECON` (defending a day position) simply **stops existing**.
- Migration = *remove enforcement*, not move data. Nothing to backfill or delete destructively.

## Impact on the pending deepfix (what you can RETIRE vs. KEEP)
| Deepfix piece | Free-nav model |
|---|---|
| P4 `SERVER_PROGRESS_WRITE` / `completeSession` day-guard | **Retire** — no gated completion to guard |
| Intervention throttle / review-only completion (incl. the #11 fix you shipped) | **Retire** the throttle; the #11 fix becomes moot |
| csd/day reconciliation (the complex `LIST_SCOPED_RECON` day leg) | **Retire** — csd is derived |
| P9 Cycling ("start over") | **Retire the machinery** — "start over" = just re-study from index 0, already free navigation |
| P10 Override / manual-pass | **Mostly retire** — nothing to unstick; students self-advance |
| **P4 attempt-write lockdown / #1c forgery closure** | **KEEP** — grading integrity/security is independent of gating |
| **P10c teacherIds gradebook** | **KEEP** — teacher visibility is independent of gating |
| Migration scripts | **Repurpose** — a smaller migration to derive-csd + drop-throttle instead of the big canonical rewrite |

Net: the free model lets you **drop most of the remaining P4–P10 cutovers** (the ones hardening the gate) and keep
just the two that are really about *security* and *teacher visibility*, not progression.

## The tradeoff you're accepting (explicit)
A motivated student can race the frontier forward and skip review — the only gate is unreached words, not skipped
review. Per your spec that's fine (the student owns their pace); soft nudges discourage racing-without-retention
without blocking. The thing you'd lose vs. today is **forced pacing** — which, given it's the source of the freezes
and ~57 manual resets, and may not even be engaging correctly on the live build, is a feature worth losing.

## Scope comparison (the actual decision)
- **Keep hardening the gated model:** finish P4→P10 cutovers (functions deploys, soaks, migration, rules, claim
  backfill, cycling gate) — weeks of staged, irreversible cutovers, each defending the day-position that keeps
  breaking. Ongoing CS burden.
- **Move to free-nav:** one hosting release that (a) stops enforcing gates, (b) derives csd, (c) reworks the
  dashboard to segment-navigation + always-on review, (d) keeps the review engine. No server-authoritative-day
  foundation needed at all. Retire most of the deepfix. Ship the security/gradebook pieces on their own.

The free model is *less* code, *less* deploy risk, and deletes the entire class of bugs we spent this whole
program fighting — while keeping the review scheduling that's the real teaching value.

---

# RIGOR REVIEW (2026-07-16) — verified findings + revised recommendation

Ran the deepfix rigor on this design: 3 independent grounded adversarial reviewers (feasibility, teacher/pedagogy,
migration/data) + my own code + live-Firestore verification (H1). **Consensus: free-nav is a defensible
*destination*, but the "mostly deletion, low-risk, one hosting release, retire most of P4–P10" framing above is
materially WRONG.** Corrections, all verified:

### Verified corrections to the claims above
1. **"Keep the review engine unchanged" is impossible — the review scheduler *is* `currentStudyDay`.**
   `computeUnmasteredSegmentIds(pool, currentStudyDay, dpw)` (studyAlgorithm.js:188) rotates *which* words you
   review by the day counter; there is **no per-word due-date engine** (only the 21-day MASTERED `returnAt`). If
   csd goes display-only, free review returns the same slice forever. Free-nav needs a **newly designed** review
   scheduler + graduation trigger. Not deletion.
2. **"`twi` is student+list-scoped and monotonic" is false.** It's stored **per-class** (`classId_listId`); the
   student+list canonical doc is the *unshipped* P5. It's **not monotonic** (reconciliation demotes it, reset
   zeroes it). **Live scan (verified): 129 students have diverging twi across same-list docs; 27 are actively
   studying in the LOWER-twi class** — `max(twi)` corrupts them (teleport to stale list-end, review flood, teacher
   placement erased). Cross-class carry needs a **P5-shaped frontier-adjudication census**, not a load-time max.
3. **"Keep #1c security independent of gating" is half-true.** The forgery *validation*
   (`validateAttemptAnchorShadow`) asserts the **throttle** and the **csd counter** (2 of 3 legs). And "no server
   foundation" leaves the frontier **client-writable/forgeable** with the self-heal deleted — you must keep either
   the twi-anchor reconciliation leg *or* a server-owned frontier write (a mini-P4). "Just stop enforcing" is not
   an option.
4. **The "KEEP" pieces are welded to retired phases + the staged rules artifacts.** Every prepared rules file
   contains the progress write-denial → deploying one under a client-authoritative free-nav = **cohort-wide freeze
   in minutes**. #1c can't ship alone; teacherIds needs a *new* rules artifact. The `firestore.rules` P10d
   default-deploy trap remains.
5. **Streaks/stats/review-sizing + `attempts.studyDay` are day-coupled**; the CS toolchain (sweep, tripwires, scan
   scripts) assumes the gated model → **rebuild** required for an 800-student cohort. Rollback is **lossy** without
   anchor-writing insurance. 1,273 live `session_states` (574 active in 4d) → mixed-bundle mid-day migration hazard.

### Honest scope of a full free-nav migration
Not "one hosting release." Roughly: **a compressed P5 (frontier data census/fix) + a rules re-baseline + a small
server surface (frontier write / challenge / list-wide reset) + a review-scheduler redesign + a CS-tooling
rebuild.** Smaller than the full P3→P10 program, but firmly staged-migration territory — with live-student
blockers that must be adjudicated first.

### The pivotal product decision (must be answered before any code)
**Does advancing the frontier still require *passing* the segment's new-word test at the class `passThreshold`?**
- **Yes** → the teacher accountability contract (retake-until-pass, the compliance loop hagwon teachers pay for)
  survives; free-nav is sound but bigger than sketched.
- **No** → VocaBoost becomes a self-paced wordlist-with-quizzes; for this customer base that **undermines the
  product**. Say so out loud first.

### REVISED RECOMMENDATION — the lighter gate, not a full rebuild (near-term)
The honest comparison is not "free-nav vs finish all of P4–P10." It is **free-nav vs a lighter gate**:
1. **Floor the throttle** so `newWords` never hits 0 — one line (`Math.max(1, round(pace*(1-interv)))`,
   studyAlgorithm.js:107) = NEED_TO_FIX #11's own suggested fix. Kills the deadlock's *cause*.
2. **Ship Practice Mode v2** (already David-locked, PLAN_practice_mode_v2.md) for always-available review — the
   "free study" instinct, without deleting the scheduler.
3. **Simplify the day incrementally** (server-derive it, retire only the reconciliation complexity) — keep the
   gate + the teacher contract.

This keeps the pedagogy + teacher value, kills most of the freeze class, and avoids the live-data migration
blockers — at a fraction of the risk. **Free-nav stays the north-star destination**, reached via the staged
migration *if/when* the pass-to-advance decision and the frontier census justify it — not as a fast pivot.

---

## CODEX HARD GATE (verified 2026-07-16) — recommendation CONFIRMED, refined

Codex verdict on the revised recommendation: **SOUND-WITH-CAVEATS** (converged; found no reason to reject).
All caveats verified by me against the code (H1). They sharpen the *implementation*, not the direction.

1. **The throttle floor is a MULTI-WRITER INVARIANT, not literally one line.** The allocation math
   `round(dailyPace*(1-interventionLevel))` is duplicated in 4 writers — client `studyAlgorithm.js:107`, server
   `foundation.js:913` (the anchor forgery validator), `foundation.js:1861` (advanceForChallenge), legacy
   `db.js:3038`. The one-line client edit IS sufficient today (`SERVER_PROGRESS_WRITE=false`), but the floor must
   be a **shared helper / mirrored across every progression writer** before the server paths ever go live. The
   list-end cap is still allowed to produce zero.
2. **Bounded claim:** floor-throttle kills the **throttle-zero** deadlock; it does NOT solve the **list-end /
   finished-list wall** (`DailySessionFlow.jsx:845`, a separate terminal) — that's continuation/cycling, a
   separate product path. Practice Mode v2 covers "keep studying/reviewing," not "advance past list-end."
3. **Keep rules OUT of the lighter-gate release.** The repo `firestore.rules` is the undeployed P10d end-state
   (denies client progress+attempt writes) — a bare deploy freezes the cohort. Free-nav needs a *new* rules
   artifact, never a reuse of P10d.
4. **Practice Mode v2 must be explicitly non-progress / non-gradebook** by default, or it recreates the same
   product fork under a different name.
5. **Implementation prerequisite dominates:** the pass-to-advance fork is the dominant *product* decision, but a
   **server-owned/adjudicated frontier** is the dominant *implementation* prerequisite — any real free-nav
   migration is unsafe without it, regardless of the pass-to-advance answer.

### Final gated position
- **Near-term (recommended):** the lighter gate — (a) throttle floor as a multi-writer invariant, (b) Practice
  Mode v2 as non-canonical review access, (c) incremental day/authority simplification — **no P10d rules, no
  deleting the reconciliation/security legs.** Kills the throttle-zero freeze + gives free review, keeps the
  teacher pass-contract, dodges the live-data blockers.
- **Continuation/list-end** stays its own track (Practice Mode + a continuation decision).
- **Free-nav = staged north-star**, gated behind: the pass-to-advance product decision → a frontier
  census/adjudication → a server-owned frontier + new rules artifact → a review-scheduler redesign.

**Rigor complete:** 3 grounded adversarial reviewers + my code/live-data verification + Codex hard gate, all
converged. The recommendation is decision-ready.

---
## GATE CLOSED — 2026-07-17: COEXISTENCE (David's decision)

The FREENAV design gate (Codex round 7, verdict **SOUND-WITH-CAVEATS**, converged) is CLOSED. David's decision:
**free-navigation is NOT a replacement — it becomes a future per-class OPTION** (`navigationMode: 'forced' | 'free'`),
coexisting with the default forced-progression + intervention model.

- **Forced mode stays the DEFAULT.** The David-locked **BINARY** throttle (0 new words in review mode, hold-csd,
  review-required-to-advance; `FORCED_PATHWAY_FIX_PLAN_2026-07-16.md`) is its policy — this **SUPERSEDES the lighter-gate's
  "floor the throttle" leg (a)**. No longer contradictory: binary = forced-mode policy; free-nav mode has no throttle.
- **Free-nav = a per-class opt-in mode, built LATER** on the server-authoritative progress base (deepfix P3–P5 cutover),
  which delivers the server-owned frontier free-nav requires. The rigor-review hazards (server-owned frontier; `twi` per-class
  non-monotonic; scheduler == `currentStudyDay` → needs a new scheduler; #1c security legs; rules deny client progress writes →
  new rules clause) become the **free-nav-MODE design spec**. Codex's SOUND-WITH-CAVEATS holds — the caveats are its design inputs.
- **Lighter-gate legs (b) Practice Mode v2 [David-locked] and (c) day-simplify are ABSORBED** (Practice Mode v2 as-is;
  day-simplify = the deepfix's own server-derive of csd).
- **Pass-to-advance** becomes a per-mode question (forced = yes; free-nav-mode answer decided at design time).

Tracked: `SESSION_TODO_2026-07-17.md` E4 (north-star), `CONSOLIDATED_ROADMAP_2026-07-17.md`, memory `freenav-per-class-option`.
Baton: round 7 `FREENAV_DESIGN_GATE` resolved → superseded by round 8 (`CONSOLIDATED_ROADMAP_SEQ_GATE`).
