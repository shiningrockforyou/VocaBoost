# PLAN — Run S-Long Persona Expansion: difficulty levels + list-chain — v3 (CONVERGED)

**Slug:** runslong · **Status:** **v3 — DESIGN CONVERGED (Codex round-3 `GO / CONVERGED-OK`, 2026-07-12).**
Loop closed over Codex r1 NEEDS_FIXES → r2 NEEDS_FIXES → r3 GO + a 3-agent fable audit; synthesis
`rounds/personax_r01_synthesis.md`. Ready to implement (Phase A) pending David's §9 scope decisions.
**Author:** Claude
**Scope (David):** expand Run S-Long to cover difficulty LEVELS (int/adv/final = list+pace) and the list chain
(Base Camp→Ascent→Summit), crossed with behavioral personalities, with mid-run level switches + run-to-
completion. Curated ~14 that holds ALL relevant events (enforced by an event LEDGER); foundation-first;
parallel across provisioned audit teachers.

> **v1→v2 (round-1 folds):** (1) list-end model CORRECTED — hand off AT cap; a post-cap review-only day
> DEAD-ENDS (`requiresNewWordRetake`) → it is the phantom-day EXPECTED-BLOCKED, not "review-only continues"
> [A-F1/B-F1/PX-2]. (2) EVENT-COVERAGE LEDGER added — re-added the 6 dropped events (#12/#8b/#10b/#7/#11/#6)
> or marked out-of-scope [B/PX-1]. (3) Throttle oracle = dynamic + onset rule + resets across T2 [A-F4/PX-3].
> (4) T2 oracle precise: switch≤15, exact formula, universal `twi += min(paceEff, listSize−twi)` [A-F3/PX-4/C8].
>
> **v2→v3 (round-2 folds, Codex GO):** (1) **L14 full-freeze → EXPECTED-BLOCKED** (interv=1.0→newWordCount=0→
> Day-2+ gate blocks; same dead-end as L13, distinct trigger) + flagged the possible STUCK-state as a candidate
> NEED_TO_FIX to record if reproduced [PX2-1]. (2) **Universal oracle SPLIT** — green (paceEff>0): Δtwi=min/
> Δcsd=+1; blocked (paceEff==0, non-empty review): EXPECTED-BLOCKED, empty-segment exception [PX2-2]. (3)
> evidence path fixed [PX2-3].
> (5) T1 = NEW class [A/PX-5]. (6) Pace invariant: enter via DailySessionFlow, dpw DEFAULT [A-F2]. (7) Harness =
> SEGMENT state machine + arc checkpoint/resume [C1/C2/C3]. (8) Wordmap PER-LIST + non-empty + Phase-A grader
> gate [C4]. (9) Retake-loop driver + BLANK-based partialAnswers [C7]. (10) Honest runtime ~5-6h parallel.

## 0. Verified app model (Lens A CONFIRMED correct; citations corrected)
- **"Level" is NOT a field** — it's (which list a class assigns) + (the `pace` integer). No level/difficulty in
  the assignment (`db.js:797-808/845-946`) or ClassProgress (`studyTypes.js:96-135`). Promotion = 100% manual
  class re-enroll (no `promote/levelUp` in the vocab domain).
- **Pace → allocation, CALLER-DEPENDENT (A-F2, load-bearing invariant):** `initializeDailySession` computes
  `dailyPace = ceil(weeklyPace / studyDaysPerWeek)` (`studyService.js:170-179`). It equals `assignment.pace`
  ONLY when entered via `DailySessionFlow` (passes `weeklyPace = pace × dpw`, `DailySessionFlow.jsx:558`) with
  `studyDaysPerWeek = 5` (default). Standalone test-page route = `ceil(1.4×pace)` (80→112!); dpw=1 →
  `ceil(pace/2)`. → **HARNESS INVARIANT:** every study day is entered via DailySessionFlow (the
  `enterSessionOnly→skipToTest` path), and every fixture leaves `studyDaysPerWeek` UNSET (default 5). Assert
  `assignment.studyDaysPerWeek ∈ {undefined,5}` in bind-verify.
- **Completion cap** — `newWordCount = min(allocation.newWords, wordsRemaining)` (`studyService.js:234-235`);
  twi advances by `wordsIntroduced` (`progressService.js:466`), stops at listSize. No auto-advance.
- **Post-cap day DEAD-ENDS (A-F1) —** newWordCount=0 → routes to REVIEW_STUDY (`DailySessionFlow.jsx:817-824`)
  → review submit → Day-2+ gate finds NO same-day new pass → `requiresNewWordRetake` (`studyService.js:1391-
  1401`) → csd FROZEN + "pass the new-word test first" (`TypedTest.jsx:1038-1044`) + the saved review attempt
  gets `orphaned_attempt_flagged` (log-only under the flag). **EXCEPTION:** empty review segment (all-MASTERED)
  → the no-review modal completes via `completeSession` (no new-word gate) → csd DOES advance. → the green path
  ends AT the cap; the post-cap day is the pinned **phantom EXPECTED-BLOCKED** (persona L13).
- **Reconcile** = `getOrCreateClassProgress` (`progressService.js:103-340`, call site `studyService.js:158`);
  `determineStartingPhase` (`studyService.js:60-138`). Same-list carry: anchor is student+list-scoped
  (`db.js:3250-3298`), `twi = anchor.nwei+1`, csd non-demoting. Different list → no anchor → fresh Day-1.
  **Intervention RESETS to 0 on a class switch** (new progress doc's recentSessions empty).

## 1. Lists (DONE) + word data + wordmap
Cloned under `lsr_teacher_01`: **Base Camp** `0HrPB6ej…` 1200w, **Ascent** `Hjrp1NuN…` 1600w, **Summit**
`cZGeAN5g…` 800w (verbatim word docs). Chain Base Camp→Ascent→Summit.
**Wordmap (C4):** build a PER-LIST wordmap from each list's word-doc `definition` (do NOT merge into
`wordmap.json` — same-word/diff-def collides across lists). Assert every used word has a **non-empty** def
(empty def → blank answer → deterministic WRONG; with THR=92 on 30 items, ≥3 gaps fails the day). **Phase-A
entry gate:** one live typed test per cloned list must PASS using the generated wordmap (the AI grader resolves
the answer server-side from `w.definition` + a lenient "default to CORRECT" rubric — `functions/index.js:736/
818/1199-1268` — so verbatim defs score correct; verify, don't assume).

## 2. Levels, transitions & completion oracle
| Level | Start list | Pace | Solo cap |
|-------|-----------|------|----------|
| int   | Base Camp | 80   | 15 d |
| adv   | Ascent    | 80   | 20 d |
| final | Ascent    | 100  | 16 d |
Summit: 800/80=10d, 800/100=8d.

**Universal per-day oracle (PX2-2 — split by whether the day can green-complete):**
- **GREEN days (`paceEffective > 0`):** `Δtwi = min(paceEffective, listSize − twi)`, `Δcsd = +1`. Covers exact
  caps, throttle days (paceEff = round(pace·(1−interv))), and the partial final day. NO bare "twi += pace".
- **BLOCKED days (`paceEffective == 0` — post-cap phantom L13, or full-freeze interv=1.0 L14 — with a NON-EMPTY
  review segment):** the day CANNOT complete: `newWordCount==0` → routes to review-study → the Day-2+
  completion gate requires a same-day passed new attempt → `requiresNewWordRetake`, csd/twi FROZEN, review
  attempt orphan-flagged. Expected = **EXPECTED-BLOCKED** (Δcsd=0, Δtwi=0). EXCEPTION: an EMPTY review segment
  (all-MASTERED) completes via the no-review path (Δcsd=+1). (`studyService.js:1391-1401`; A-F1/PX2-1/PX2-2.)

**Transitions (each a scripted teacher class-assign + student join between COMPLETED days D):**
- **T1 finish-list handoff** (BaseCamp→Ascent, Ascent→Summit): at cap, a NEW teacher class assigns the next
  list; student joins; fresh Day-1 on the next list (different list → no carry). **T1 = NEW class** (PX-5;
  carry semantics are identical either way, but new-class avoids the F02 focus footgun — that's persona L11).
- **T2 same-list pace switch** (adv→final on Ascent, 80→100): student joins a NEW class assigning the SAME
  Ascent at pace 100, BETWEEN completed days N (**pin N ≤ 15**). Reconciliation carries csd/twi; from day N+1,
  `Δtwi = 100` (capped). **Finish day = N + ceil((1600−80N)/100)** (N≤15 → 17-19; N=16..19 → 20). Intervention
  RESETS at the switch (new doc). Partial-day cross-class REVIEW is L10, not here (switch between completed days).
- **T3 different-list early switch** (int→adv BEFORE finishing Base Camp): join a NEW Ascent@80 class → fresh
  Day-1 on Ascent; Base Camp doc preserved (read-only oracle) but abandoned. (PX §9-A2: early-switch is the
  primary T3; finish-first is already T1.)
- **§T-rule — handoff-persona truncation (David 2026-07-12):** handoff personas (L4/L5) run the FIRST list to
  cap (proves completion + the T1 crossing), land fresh on the next list, run ~5–8 PARTIAL days, then STOP.
  Running the terminal list to ITS full cap is redundant with the L1/L2/L3 steady personas. This caps every arc
  at ≤~25d → fleet floor ≈1.9h @8-way (vs 3.4h for a 45d arc). A T1 handoff fires ONLY at cap, so the first
  list must complete; only the NEXT list is partial. The single-arc DOUBLE handoff (two consecutive rebaselines,
  ≥35d with these list sizes) is dropped from L4 — available as an OPTIONAL overnight long-arc persona if
  cross-transition state accumulation ever needs coverage.

## 3. Persona catalog (curated ~14) + EVENT-COVERAGE LEDGER
Each persona = {account, segments[], personality, per-segment oracle}. **The LEDGER (below) is the coverage
contract — Phase D asserts every event is bound to ≥1 persona OR explicitly deferred; a green fleet with an
unbound event is INVALID.**

| # | Level / arc | Personality / events |
|---|-------------|----------------------|
| L1 | int Base Camp→cap (15d) | steady; +one scripted mid-session reload + one quit/resume per 5 days (absorbs #7) |
| L2 | adv Ascent→cap (20d) | steady; longest solo; per-day #10/day-guard teeth hold over the arc |
| L3 | final Ascent@100→cap (16d) | steady; pace-100 oracle |
| L4 | int BaseCamp→cap → Ascent partial | **T1 handoff (BaseCamp→Ascent)**: first list to cap (15d) proves completion+crossing → fresh Day-1 on Ascent → run ~8 partial days → STOP (≈23d). Truncated from the 45d triple chain (David 2026-07-12, §T-rule); 2nd handoff (→Summit) dropped (needs ≥35d). Uniquely covers int-completion→Ascent. |
| L5 | adv Ascent→cap → Summit partial | **T1 handoff (Ascent→Summit @80)**: Ascent to cap (20d) → fresh Day-1 on Summit → run ~4 partial days → STOP (≈24d). Truncated from 20+10 (§T-rule). |
| L6 | final Ascent@100→cap→**Summit** (16+8=24) | T1 handoff @100 (§9-Q4) |
| L7 | adv Ascent@80 (N≤15) → **final @100** | **T2** same-list pace switch; finish 17-19; pin N |
| L8 | int BaseCamp (Nd) → **adv Ascent** early | **T3** different-list fresh; Base Camp doc preserved oracle |
| L9 | adv Ascent→cap | **retake**: some days fail→retake-loop→pass; failed attempt NEVER anchors; attempt Δ=+2 those days |
| L10 | final Ascent@100 | **threshold-edge (#5)**: pins passThreshold + newWordRetakeThreshold; scores just ≥thr; UI Pass, no retake loop; **+ partial-day cross-class review** (dual-class, leave-mid in A, finish review in B — #9 at pace 100) |
| L11 | adv, 2 lists on ONE class (2nd added mid-stream) | **getPrimaryFocus footgun (#11)**: default focus must NOT bump to Day-1 of the new list |
| L12 | int Base Camp | **partial-throttle (#8)**: review avg≈0.60 → interv≈0.33 → Δtwi=round(80·0.67)=53/day; dynamic cap (~23d); interv=0 days 1-4 |
| L13 | adv Ascent, driven to cap then ONE more day | **phantom-day EXPECTED-BLOCKED (#12)**: post-cap review-only → `requiresNewWordRetake`, csd frozen, orphan-flag — PINNED signature |
| L14 | int Base Camp | **full-freeze (#8b) = EXPECTED-BLOCKED (PX2-1)**: ≥3 review scores ≤0.30 → interv=1.0 → newWordCount=0 → Day-2+ gate BLOCKS (Δcsd=0, Δtwi=0, requiresNewWordRetake) — same dead-end as L13, distinct trigger. ★ **Also SURFACES a candidate product edge:** recovery may be a STUCK state (interv is from recentSessions, appended only on COMPLETION; a blocked day never records the improving review → interv stays 1.0). Investigate during the audit → possible NEED_TO_FIX. |
| L15 | adv Ascent (seeded) | **invalid-anchor survival (#10b, CS-2026-06-21)** — David 2026-07-12 INCLUDE: pre-seed a manual-pass attempt MISSING `newWordEndIndex` (controlled bad-anchor writer, NOT `scripts/cs/manual-pass.mjs` which writes a VALID anchor) → app reconciles → detects invalid anchor → logs `csd_anchor_invalid` to `system_logs`, does NOT corrupt csd/twi, student not stuck. PINNED signature. |
| L16 | adv Ascent, same-list SAME-pace class move | **pure #6 day-reset baseline** — David 2026-07-12 INCLUDE: Ascent@80 in class A → teacher reassigns to NEW class B assigning the SAME Ascent at the SAME pace 80 (NO pace change) → records CURRENT reset-on-class-change behavior as a PRE-FIX regression baseline (the foundation program fixes #6). Assert + record observed csd/twi delta at the move; NOT a green-required oracle. |

**EVENT-COVERAGE LEDGER** (every old-catalog + new event → persona | or OUT-OF-SCOPE with reason):
| Event | Bound to |
|-------|----------|
| int/adv/final steady + solo caps | L1/L2/L3 |
| T1 finish-list handoff (both edges, both paces) | L4/L5/L6 |
| Full BaseCamp→Ascent→Summit triple chain | L4 |
| T2 same-list pace switch (#4 cross-pace carry) | L7 |
| T3 different-list fresh (int→adv early) | L8 |
| Retake / failed-attempt-never-anchors (#6b) | L9 |
| Threshold-edge #5 (passThreshold + retakeThreshold pins; 92-vs-95 note) | L10 |
| Dual-class + cross-class review #9 + leave-mid-session (#2/#6a) | L10 |
| getPrimaryFocus 2nd-list footgun (#11) | L11 |
| Partial-throttle intervention (#8) | L12 |
| Phantom-day / list-completion EXPECTED-BLOCKED (#12) | L13 |
| Full-freeze interv=1.0 (#8b) | L14 |
| Reload / quit-resume integrity (#7) | folded into L1 |
| Student-owned progress preservation (#5) | oracle in §5 (checked on every T1/T3) |
| Invalid-anchor survival (#10b, CS-2026-06-21) | **L15** (seeded) — David 2026-07-12 re-pinned: controlled bad-anchor writer (no `newWordEndIndex`); assert `csd_anchor_invalid` log + no csd/twi corruption + not stuck |
| Support-seeded survivor (#10a) | **OUT-OF-SCOPE** — same reason as #10b |
| Same-list SAME-pace class move (pure #6 day-reset) | **L16** (pre-fix baseline) — David 2026-07-12 INCLUDE: documents CURRENT reset-on-class-change (pace UNCHANGED, isolated from L7's pace switch) before the foundation program fixes #6 |

## 4. Harness = a SEGMENT-based runner (C1/PX-7 — a rewrite, not a param swap)
Rebuild the outer loop of `lsr_runSL_phase1.mjs` around **segments**: `{teacherEmail, className, classId, listId,
listSize, pace, startCsd, dayRange, expectedAssignment}`. A persona = an ordered list of segments; the runner
executes each, driving days and confirming per-day, with switch events (new class + join) at segment
boundaries.
1. **Parameterize ALL FB reads** by `{student, classId, listId}` — `fbState`/`fbConfirm` take (classId, listId);
   `LIST`/`PACE`/`TEACHER` are per-segment, not module consts.
2. **Per-segment attempt baselines** — attempts in a new class start at 0 even when csd/twi carry (fbState
   filters classId); re-baseline the new/rev counters at each segment.
3. **reviewExpected on CARRIED csd (C2 bug fix)** — `reviewExpected = (segment.startCsd + localDay) >= 2`
   (== `prev.csd >= 1`), NOT the loop counter; T1 resets startCsd=0.
4. **Universal oracle** `Δtwi = min(paceEff, listSize − twi)`; paceEff = round(pace·(1−interv)) for throttle.
5. **Mid-run switch (T1/T2/T3):** teacher re-login → createClass + assignList(next list, pace) →
   readJoinCode → student joinClass → **selectList** (C10 — different-list personas must focus the new list) →
   re-bind classId, re-key fbState. T2 same-list → assert reconcile carried csd/twi; T1/T3 → assert fresh.
6. **Per-transition CHECKPOINT MANIFEST** (before/after session entry) — not end-state only; #10/day-guard +
   #9 cross-class checkpoint sequences (import `plan.md §3.1`) asserted PER DAY (self-healing masks transient
   resets by the arc's end — B-high3).
7. **Retake-loop driver (C7/L9):** fail (blank) → dismiss retake gate → re-enter → retake (careful) → pass;
   expected attempt Δ = +2 that day (fbConfirm exception).
8. **BLANK-based `partialAnswers(rows, nCorrect)` (C7):** the lenient AI grader can't be trusted to mark
   plausible-wrong text WRONG — blanks are the only deterministic WRONG. L9/L10/L12/L14 use blank-based partials.
9. **Review-reach hardening (§4.8 → Phase-A gate, C5):** `enterSessionOnly→skipToTest` (not the dashboard
   Review CTA); `review-not-reached` RETRYABLE; retry routes through `dashReady` first; retried path still ends
   with `returnFromResultsAndClearCompletion`. (The RB-1 pattern + typed-fill retry are prereqs.)
10. **Per-persona `SL_MAX_MS`** + **arc checkpoint/resume (C3/C-alt):** write a per-persona checkpoint (last
    confirmed segment/day/expected-state) to the findings JSON; a resume mode re-enters from the observed FB
    state (relax the pristine-baseline assert to "resume from checkpoint") so a day-30 flake doesn't burn the
    account + hours. Reuse the state-aware `advanceOneDay` resume.

## 5. Oracle model (per-segment; read-only FB, UI-primary)
- Steady day: `Δcsd=+1`, `Δtwi = min(paceEff, listSize−twi)`; UI DAY==csd+1, Words==twi.
- Throttle (L12): interv from last-3 non-null reviewScores, ramp `(0.75−avg)/0.45` clamped (≥0.75→0, ≤0.30→1),
  **0 until 3 reviews exist** (days 1-4 full pace); paceEff=round(80·(1−interv)); resets to 0 across a switch.
- Freeze (L14): interv=1.0 → paceEff=0 → **EXPECTED-BLOCKED** (Δcsd=0, Δtwi=0, requiresNewWordRetake) — NOT a
  frozen-but-advancing day (PX2-1). Distinct trigger from L13's cap. Flag the possible STUCK-state edge (§3 L14).
- Phantom (L13): post-cap day → csd FROZEN, `requiresNewWordRetake`, one `orphaned_attempt_flagged` (EXEMPT
  from the "no orphan" check — pinned EXPECTED-BLOCKED signature).
- Retake (L9): failed attempt never anchors (`passed==true` only); pass still advances once; attempt Δ=+2.
- Threshold (L10): score ≥ class.passThreshold → advances; UI Pass, NO retake loop; pins passThreshold +
  newWordRetakeThreshold (note the `manual-pass.mjs:53`=92 vs server=95 inconsistency).
- T2 (L7): between completed days N≤15; carry csd/twi; from N+1 Δtwi=100 (capped); finish = N+ceil((1600−80N)/100).
- T1 (L4/L5/L6): at cap → new class/list → fresh Day-1 (csd=1, twi=paceEff). **Progress-preservation:** after
  ANY T1/T3, the prior list's doc still shows its pre-switch csd/twi (read-only) — #5's core assertion.
- End-state: at each list's completion day, twi==listSize; no double-advance; no spurious rebuild/day_guard
  reject (the #10/Day-2/#9 fixes must hold PER-DAY across 15-45 day arcs).

## 6. Setup prerequisites (data — audit-infra)
- ✅ Tier lists cloned under lsr_teacher_01.
- **Provision `lsr_teacher_02..08`** (7 more → **8 total**, David 2026-07-12 to match the ~8-concurrent ceiling)
  and **clone the 3 tier lists under EACH**
  (`lsr_clone_lists.mjs` → teachers×CLONES loop; per-owner dupe check already safe). `lsr_lists.json` becomes
  per-teacher (its shape change breaks the harness LISTS[0] consumer → parameterize per persona).
- **Build per-list wordmaps** (§1) + assert non-empty; **Phase-A grader-verify gate** (one typed PASS per list).
- **Pristine students:** ~14 + spares; provision `lsr_s77+` (memory `sandbox-account-provisioning`).

## 7. Phasing (foundation-first; explicit gates)
- **Phase-A ENTRY GATES (must land first, C9):** (1) review-reach hardening + typed-fill retry; (2) per-persona
  `SL_MAX_MS` + arc checkpoint/resume; (3) per-list wordmaps built + non-empty; (4) grader spot-verify passes
  per list.
- **Phase A — variable-pace primitive:** segment runner + universal oracle. Prove L1/L2/L3 to their caps
  (validates pace 80/100, cap, DailySessionFlow-entry invariant). Gates all.
- **Phase B — transitions:** L7 (T2), L8 (T3), L4/L5/L6 (T1 + triple chain). One teacher suffices (owns all clones).
- **Phase C — behavioral × level:** L9/L10/L11/L12/L13/L14.
- **Phase D — fleet:** curated ~14 in parallel across the 6 teachers; **event-ledger check** (every event bound
  or deferred); end-state oracle for all; results doc (PASS / EXPECTED-BLOCKED / OUT-OF-SCOPE / INVALID — no
  silent gaps).

## 8. Runtime / concurrency (honest — C3)
~4-5 min/study-day; curated ~14 with arcs 15-45 days ≈ **260+ study-days ≈ 19-20 h sequential → ~5-6 h with
~5-6-way parallelism** across the provisioned teachers (L4 triple chain alone ≈ 3+ h). Arc checkpoint/resume
makes a mid-arc flake cheap (resume, not restart). Full cross-product deferred.

## 9. Resolved (round 1) + remaining open
RESOLVED (round 1): §9-Q1 T1=new class (A/PX-5); Q2 T3=early-switch primary (PX); Q3 wordmap grader SOUND,
verify per list (C4); Q4 L6 Summit = 24 study-days, no post-cap green day (PX/A).
**RESOLVED (David 2026-07-12):** (a) **#10b INCLUDED as L15** (seeded bad-anchor writer). (b) **pure same-pace
#6 INCLUDED as L16** (pre-fix regression baseline). (c) **L4 TRUNCATED to ≈23d** (first-list-cap + partial-next,
§T-rule) + L5→≈24d; the single-arc DOUBLE handoff dropped, offered as an optional overnight long-arc. Teachers
= **8** (match the 12-core ~8-concurrent ceiling). Fleet floor now ≈1.9h @8-way. NO open decisions remain.
