# PERSONAX (persona expansion) — Round 1 audit synthesis

Plan: `docs/plans/loop/runslong/persona_expansion.md` v1. Reviewers: 3 fable lenses (A correctness / B coverage
/ C feasibility) + Codex. Claude verifies EACH vs code, folds into v2. **Hold edits until all in.**

Status: Lens B ✅ · Lens A ⏳ · Lens C ⏳ · Codex ⏳

## Lens B — coverage & completeness — RECEIVED (11 findings). Core theme: the curated ~12 DROPPED 6 old events with NO out-of-scope declaration → violates David's "hold all relevant events."
Preliminary leans (VERIFY vs `plan.md §3` + code before applying):

| # | Sev | Finding | Lean |
|---|-----|---------|------|
| F1 | high | **#12 phantom-day EXPECTED-RED dropped** — yet L1-L5/L12 all drive to twi==listSize + T1 handoffs sit AT the boundary; §0 "review-only continues" may CONTRADICT #12's pinned dead-end. Nothing pins it → any boundary phantom = UNEXPECTED-RED mid-chain. | **ACCEPT** — 1-day probe to resolve review-only vs dead-end; pin the signature; make the post-cap day mandatory for ≥1 persona/pace |
| F2 | high | **#8b full-freeze (avg≤0.30→interv=1.0→0 new words) dropped** — only partial throttle (L10) survives; frozen-day (Δtwi=0, Δcsd=+1) × day-guard over long arc untested | **ACCEPT** — add L10b (frozen days then recover), pin Δtwi=0/Δcsd=+1, distinguish from #12 phantom |
| F3 | high | **partial-final-day branch never exercised + §4.4 "no partial" is FALSE for T2.** Solo caps divide evenly (dodge min(alloc,wordsRemaining)); L6 (adv@80 N→final@100) hits a partial tail unless N≡0 mod 5; N unpinned. David's "17-19d" should be an ASSERTED finish-day. | **ACCEPT** — pin L6 switch day (+ a partial-tail variant); §5 gets a `min(pace,wordsRemaining)` last-day oracle; delete false "no partial" |
| F4 | med-hi | **#10a seeded-survivor + #10b INVALID-ANCHOR (the CS-2026-06-21 founding incident) dropped** — new §5 has no pinned exception | **ACCEPT** — re-add an invalid-anchor persona (seed per RSL-4) OR explicit OUT-OF-SCOPE line |
| F5 | med | **#11 getPrimaryFocus footgun dropped** — and §9-Q1 makes it load-bearing: if T1 handoff = SAME class re-assigned, a focus-bump-to-new-list masquerades as fresh-Day-1 PASS | **ACCEPT** — resolve Q1; if same-class, add old-list-focus assertion to T1 oracle |
| F6 | med | **#9 intra-day CHECKPOINT oracle (RSL-1 blocker) not carried into L6/L11** — §5 is end-state only; B-high3 warned self-healing masks transient resets by day 16 → need per-day teeth | **ACCEPT** — import plan.md §3.1 checkpoint sequences; #10/day-guard assertion PER-DAY not just end-state; state #9-deploy preflight (§0.2) now satisfied |
| F7 | low-med | **#7 reload/quit-resume dropped** — resume-integrity untested on long arcs (rebuild-recovery retries ≠ coverage) | **ACCEPT** — fold a scripted mid-session reload + quit/resume into L2 (no new account) |
| F8 | low-med | **L12 inconsistent** ("2 handoffs" but arc = 1) + NO persona runs the full BC→Ascent→Summit triple chain; §8 "15-43d" matches no computable persona; chain personas' 2nd-list end condition unspecified | **ACCEPT** — fix L12; promote one persona to the full triple chain; specify each chain end condition; reconcile §8 day math |
| F9 | low | **pure #6 class-move (same list, SAME pace) + downward 100→80 switch un-modeled**; L6 confounds class-change with pace-change (one direction only); fresh-B/INVALID precondition (B-blocker1) not restated | **ACCEPT (partial)** — restate fresh-destination precondition in §4/§5; consider a same-pace move + a demotion variant |
| F10 | low | **student-owned progress preservation (#5 core) not in any oracle** — no check the abandoned/completed list's doc survives after T1/T3 | **ACCEPT** — §5: "after T1/T3, prior list's doc still shows pre-switch csd/twi (read-only)" |
| F11 | low | **L9 threshold pinning incomplete** — omits `newWordRetakeThreshold` + the 92(manual-pass.mjs:53)-vs-95(server) inconsistency | **ACCEPT** — carry both pins + the note |

**Net for v2 (pending A/C/Codex):** the plan needs an explicit **event-coverage ledger** — for EVERY old-catalog
event, either a persona covers it OR an OUT-OF-SCOPE line (a decision, not a silent gap). Re-add: #12 phantom
(F1), #8b freeze (F2), #10b invalid-anchor (F4), #7 reload/resume (F7, folded). Fix oracles: partial-tail (F3),
per-day checkpoint (F6), progress-preservation (F10), threshold pins (F11). Fix L12 + full triple chain (F8).
Resolve §9-Q1 (F5) — it gates the T1 handoff oracle.

## Codex — external — RECEIVED (NEEDS_FIXES). Corroborates Lens B + adds precise fixes.
| # | Sev | Finding | Lean |
|---|-----|---------|------|
| PX-1 | **blocker** | Coverage drops old events (== Lens B F1/F2/F4/F5/F7/F9). Requires a MANIFEST: catalog event → persona(s), NO unbound event; missing events → explicit deferred/out-of-scope table | **ACCEPT** — add the event-coverage manifest/ledger |
| PX-2 | high | **List-end "review-only continues" is WRONG** — `completeSessionFromTest` gates Day-2+ on a same-day passed NEW attempt → a post-cap review-only day is the PHANTOM edge, not clean continuation. Green PASS target = day reaching twi==listSize → hand off immediately; NO review-only in green path; post-cap review-only = pinned EXPECTED-RED (#12) | **ACCEPT — I had this wrong** (§0 line). Fold with F1 |
| PX-3 | high | **Throttle cap ≠ exact cap** (== Lens B F2/F3): L10 can't share the 15-day cap; needs dynamic per-session dayNewCount from the 3-review window; interv=1.0→newWords=0→phantom. Separate steady vs throttled cap; forbid interv=1.0 in partial-throttle (that's the freeze/EXPECTED-RED case) | **ACCEPT** |
| PX-4 | high | **T2 oracle needs exact timing + formula** (== Lens B F3/F6): timing cases (before-day / mid-day #9-checkpoint / after-day); pin L6 to switch BETWEEN completed days; formula `daysBeforeSwitch + ceil((1600 − twiAtSwitch)/100)`; keep partial-day cross-class review in L11 | **ACCEPT** |
| PX-5 | med | **T1 handoff = NEW class per next-list** (not same-class reassign — avoids entangling F02 focus footgun; same-class = separate footgun persona) (== Lens B F5) | **ACCEPT** |
| PX-6 | med | **Wordmap: verify BEFORE mass-build** — run a one-typed-test smoke per cloned list; gate Phase A on "generated-wordmap answer scores PASS" for Base Camp/Ascent/Summit; keep readTestRows retry | **ACCEPT** |
| PX-7 | med | **Harness is a NEW runner, not a light extension** — parameterize ALL FB reads by {student, classId, listId} (current global LIST); per-list+per-class attempt views for cross-class; per-transition checkpoint manifest before/after entry (not end-state only) | **ACCEPT** |

**Codex answers to §9 open questions (fold into v2):**
1. **T1 = NEW class** per next-list (primary chain); same-class new-list = separate focus/UX persona.
2. **T3 int→adv = early-switch/abandon** as PRIMARY (proves different-list fresh start); finish-first is covered by T1.
3. **Wordmap** = word-doc `definition` is right, but VERIFY one typed pass per list before the fleet.
4. **L12 Summit cap** = Ascent 1600/100=16 + Summit 800/100=8 = **24 study days**; NO post-cap review-only green day.

## ★ CONVERGENCE (Lens B + Codex) → v2 shape (pending Lens A + C)
1. **Event-coverage ledger** — every old-catalog event mapped to a persona OR explicit OUT-OF-SCOPE. Re-add:
   #12 phantom (pinned EXPECTED-RED), #8b full-freeze, #10b invalid-anchor, #7 reload/resume, #11 footgun,
   #6 same-pace class-move. (PX-1 / Lens B F1/F2/F4/F5/F7/F9.)
2. **List-end = hand off at twi==listSize; NO review-only green day; post-cap review-only = pinned #12
   EXPECTED-RED** (PX-2 / F1). Fix my §0 "review-only continues" claim.
3. **Steady cap ≠ throttled cap**; L10 dynamic dayNewCount; forbid interv=1.0 (→ #8b) (PX-3 / F2/F3).
4. **T2 oracle**: pin L6 switch between completed days + the exact formula; partial-tail case; #9 checkpoint
   in L11 per-day (PX-4 / F3/F6).
5. **T1 = new class** (PX-5 / F5); resolves §9-Q1 → footgun becomes its own persona.
6. **Wordmap Phase-A gate** (one typed pass per list) (PX-6 / §9-Q3).
7. **Harness = new parameterized runner** ({student,classId,listId} everywhere) + per-transition checkpoint
   manifests (per-day #10/day-guard teeth, not end-state only) (PX-7 / F6).
8. **Fix L12** + one full BC→Ascent→Summit triple chain; reconcile §8 day math (F8). Restate fresh-B
   precondition (F9). Progress-preservation oracle (F10). Threshold pins complete (F11).

## Lens A — correctness & data-model — RECEIVED. CONFIRMS the core model is CORRECT; fixes are precise.
**Verified-correct (do NOT re-litigate):** level=list+pace (no field); completion cap; **completion math exact,
no off-by-one** (day1=pace; 1200/80=15, 1600/80=20, 1600/100=16, 800/100=8, 24 total ✓); T2 same-list carry
(position carries, delta 100); T3 different-list fresh; L8 retake (passed-only anchor); L9 threshold (≥,
review always passes); L11 #9 cross-class (list-scoped attempts, REVIEW_STUDY resume, position-proven gate).
| # | Sev | Finding | Lean |
|---|-----|---------|------|
| A-F1 | high | Post-cap review-only day **dead-ends** at the Day-2+ gate: no new attempt → `requiresNewWordRetake` → csd frozen + the saved review attempt gets ORPHAN-FLAGGED (violates my §5 "no orphan review"). **EXCEPTION:** empty review segment (all-mastered) completes via `completeSession` (no new-word gate) → advances. (== PX-2/B-F1, with exact code) | **ACCEPT** — end arcs at cap day; post-cap = EXPECTED-BLOCKED/#12; exempt orphan-flag log from the end-state check |
| A-F2 | med | **`dailyPace==pace` is caller-dependent** — `initializeDailySession` computes `ceil(weeklyPace/dpw)`; round-trip holds ONLY via DailySessionFlow passing `weeklyPace=pace×dpw` with dpw=5. Standalone test-page route = `ceil(1.4×pace)` (80→112!); dpw=1 → `ceil(pace/2)`. **NEW invariant.** | **ACCEPT** — pin: every day entered via DailySessionFlow (enter-then-review does this); fixtures leave studyDaysPerWeek DEFAULT (5); assert weeklyPace=pace×5 |
| A-F3 | med | T2 finish day = N + ceil((1600−80N)/100): N=1..15 → 17-19; N=16..19 → **20** (= adv cap, not "between"). Pin L6 switch ≤15. (== PX-4) | **ACCEPT** |
| A-F4 | med | L10 throttle: **interv=0 until 3 review scores** (days1-4 always full pace; reviews start day2); avg0.60→interv=1/3→80→53. **Intervention RESETS to 0 on a T2 switch** (new class recentSessions empty). (== PX-3) | **ACCEPT** — add onset rule + no-carry note |
| A-F5 | low | pace 1-500 validated only on the UPDATE path (assignListToClass has no range check) | ACCEPT (citation) |
| A-F6 | low | reconcile is `progressService.js:103-340` (call site studyService.js:158), not studyService.js:156-185; determineStartingPhase is :60-138 | ACCEPT (citation) |

**Lens A also resolves §9-Q1 differently than Codex PX-5:** the T1 CARRY semantics are IDENTICAL whether new-class or same-class (progress key + reconcile scope are per-list). So new-class-per-list (Codex PX-5) is the right choice for CLEANLINESS (avoids the F02 focus footgun), NOT because carry differs. Fold: T1 = new class; footgun = separate persona (agrees).

## Lens C — feasibility & harness — RECEIVED. Buildable, but a RESTRUCTURE + concrete impl findings.
| # | Sev | Finding | Lean |
|---|-----|---------|------|
| C1 | high | Harness is run-global singletons (LIST/PACE consts; fbState bakes LIST.id + single classId; day loop hardcodes expTwi/expNew/expRev; teacher fixture once) → mid-run switches need a per-SEGMENT state machine (~150-line restructure). (== PX-7) | **ACCEPT** — reframe §4 as segments {teacher,class,list,pace,dayRange,expected} |
| C2 | high | **Concrete bug:** review-expected keyed on loop-local `dayNum` diverges from carried `csd` after T2 → app serves a review the harness won't drive. Fix `reviewExpected = (segmentStartCsd+localDay) >= 2` (== prev.csd>=1); T1 resets | **ACCEPT** |
| C3 | high | Runtime ~50% under: ≈260 study-days ≈ **19-20h seq / 5-6h parallel** (L10 throttle LENGTHENS to ~23d; L4 arc alone ~2.6-3h). **90-min `SL_MAX_MS` HARD-HALTS long arcs**; NO arc-resume → a day-30 flake burns the account + hours | **ACCEPT** — per-persona SL_MAX_MS; **arc checkpoint/resume**; budget 5-6h |
| C4 | med-hi | **Wordmap-grader SOUND** (traced: `gradeTypedTest` resolves answer server-side from `w.definition` `functions/index.js:736/818`; Haiku "Default to CORRECT" temp0.1 → verbatim def scores correct; already proven by the passing 16-day run). Risks: (a) EMPTY defs→blank→WRONG (assert NON-EMPTY, not key presence); (b) merge-into-wordmap.json COLLIDES same-word-diff-def across lists → use PER-LIST map; (c) promote §9-Q3 verify to Phase-A gate | **ACCEPT** — answers §9-Q3 |
| C5 | med | §4.8 review-reach hardening CORRECT + specified; adds: retried path must end with `returnFromResultsAndClearCompletion`; route retry through `dashReady` first | ACCEPT |
| C6 | med | Multi-teacher feasible (small script changes); `lsr_lists.json` shape change BREAKS the harness consumer (LISTS[0]) + TEACHER const → parameterize per persona | ACCEPT |
| C7 | med | **Behavioral drivers MISSING from §4:** L8 needs a RETAKE-LOOP driver (fail→dismiss→re-enter→retake→pass; attempt delta +2 breaks fbConfirm's exact newAttempts); `partialAnswers` must be **BLANK-based** (lenient AI grader can't be trusted to mark plausible-wrong text wrong; blanks are the only deterministic WRONG) | **ACCEPT** |
| C8 | low-med | §4.4 partial-final-day contradiction (== A-F3/B-F3/PX-4). Universal oracle `twi += min(paceEff, listSize−twi)` | ACCEPT |
| C9 | low | Phasing sound; **§4.8 + SL_MAX_MS raise + wordmap-build + grader-verify = Phase-A ENTRY gates** (Phase A fails without them) | ACCEPT |
| C10 | low | Spares thin; **dashReady doesn't call `selectList`** → different-list personas read the wrong list tile; fixture INVALID gate hardcodes one PACE/THR tuple → per-segment; §9-Q1 resolve before Phase B | ACCEPT |
| C-alt | — | **Simpler:** arc-checkpoint file (persona→last confirmed segment/day/expected) + resume-from-observed-FB mode (reuse state-aware advanceOneDay) beats per-day retry tuning | **ADOPT** |

## ★ ALL FOUR IN → v2 revision scope (consolidated A+B+C+Codex)
Core model CONFIRMED CORRECT (Lens A). v2 = substantial revision:
1. **Event-coverage LEDGER** — every old event → persona OR out-of-scope; re-add #12(pinned EXPECTED-RED)/#8b/#10b/#7/#11/#6 [B/PX-1].
2. **List-end: hand off AT cap; post-cap = EXPECTED-BLOCKED/#12 (unless empty segment→completes)**; kill "review-only continues" [A-F1/B-F1/PX-2].
3. **Throttle: dynamic per-day cap + onset (interv=0 until 3 reviews) + resets across T2** [A-F4/PX-3/C7].
4. **T2: switch≤15, exact formula, between-completed-days; universal `twi += min(paceEff, listSize−twi)`** [A-F3/PX-4/C2/C8].
5. **T1 = NEW class** [A/PX-5]; footgun (#11) = own persona.
6. **Pace invariant: enter via DailySessionFlow, studyDaysPerWeek DEFAULT (5)** [A-F2].
7. **Harness = SEGMENT state machine** {student,classId,listId,pace} everywhere; per-segment attempt baselines; reviewExpected on carried csd; per-transition checkpoint manifest [C1/C2/PX-7].
8. **Runtime honest (~5-6h parallel); per-persona SL_MAX_MS; ARC checkpoint/resume** [C3/C-alt].
9. **Wordmap: PER-LIST map, assert non-empty defs; Phase-A grader-verify gate** [C4/PX-6].
10. **Behavioral drivers: retake-loop driver + BLANK-based partialAnswers** [C7].
11. **Phase-A entry gates: §4.8 hardening + SL_MAX_MS + wordmap+grader-verify** [C9]. **selectList after class switch** [C10].
12. Fix L12 + full triple chain; progress-preservation oracle; threshold pins (#11 retakeThreshold+92/95); fresh-B precondition; citations [B-F8/F9/F10/F11, A-F5/F6].

## ★ CROSS-REVIEWER CONVERGENCE (A+B+Codex; Lens C pending) — v2 is a substantial revision
STRONG consensus on: (1) **list-end model was WRONG** — hand off at cap, post-cap = EXPECTED-BLOCKED/#12 [A-F1/
B-F1/PX-2]; (2) **event-coverage ledger** required [B-F1..F11/PX-1]; (3) **throttle cap dynamic + onset rule**
[A-F4/B-F2-F3/PX-3]; (4) **T2 oracle precise (switch≤15 + formula)** [A-F3/B-F6/PX-4]; (5) **T1=new class**
[A/PX-5]; (6) **pace round-trip invariant: enter via DailySessionFlow, dpw=5** [A-F2 — NEW]; (7) **harness = new
parameterized runner** [PX-7]. Core model CONFIRMED CORRECT by Lens A. → write v2 once Lens C lands.
