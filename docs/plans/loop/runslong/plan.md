# PLAN — Run S-Long: longitudinal multi-persona flag-ON stress audit — v4 (loop draft)

**Slug:** runslong · **Status:** DRAFT for the Claude⇄Codex review loop · **Author:** Claude
**Scope (David):** an EXTENSIVE flag-ON behavioral audit — N students of multiple CS-grounded personas,
each driven **16+ study days** through the live UI, with class/list re-assignments mid-stream, asserting
they ALL survive with consistent state. **FOUNDATION-FIRST** (prove a per-day drive primitive before scaling).
**v2 folds the 3-agent audit (`rounds/r01_agents_synthesis.md`) + David's two rulings** (below).

## 0. TWO DAVID RULINGS baked into v2
1. **Verification = UI-teeth + Firebase read-only confirmation (this task only).** David overrides the
   one-snapshot policy: **read-only Firebase reads are allowed freely per-day.** BUT they **do NOT substitute
   Teacher/Student UI checks** — the PRIMARY assertion for anything a real user experiences is UI-observable
   (dashboard "DAY N"/"Words Introduced", results "Pass" verdict, teacher gradebook). Firebase is the exact
   corroboration layer on top (CSD/TWI/attempt/anchor). **Never edit Firebase to make a run proceed** — no
   substituting a UI-able action with a write.
2. **The "rebuild" screen is diagnosed in Phase 1, not assumed.** Phase-1 exit gate includes instrumenting
   why the day-guard "session refreshed" screen fires; hard-stop the non-recoverable branch; if it's app-side,
   surface it as its own bug then.

## 0.1 DEPLOYED REALITY — this is a PHASE-1 audit (A-blocker1)
`LIST_SCOPED_RECON=true` but Phase 2 is NOT deployed: no `list_progress/{listId}` collection; progress stays
class-keyed `{classId}_{listId}` (`progressService.js:33`); reconciliation is **lazy** (session-init only;
`getClassProgress` does not reconcile, `:498-509`). So this suite audits **Phase-1 semantics**: the
**ACTIVE/last-launched** class_progress doc reconciles to the list-wide anchor. **Abandoned-class docs stay
stale until re-entered — that is CORRECT Phase-1 behavior, NOT a bug.** Single-doc convergence is a Phase-2
property, out of scope here (revisit when Phase 2 ships).

## 0.2 PREFLIGHT GATE for #9-dependent personas (RSL-3)
Run S-Long is a LIVE/deployed UI audit — a code-review GO on Fix #9 is NOT deployed-behavioral certification.
Before any #9-dependent persona (persona-2 partial-day switcher, and any cross-class review path) counts:
- **(a)** live build/provenance confirms the Fix #9 source is deployed in the tested environment, AND
- **(b)** Run S **S-1/S-3** acceptance has PASSED against that build.
If (a)+(b) are unmet, those personas are marked **`BLOCKED (prereq: #9 deploy / Run S S-1/S-3)`** — a
distinct state that is **NOT coverage** (the persona did not run → no product evidence), and NOT `EXPECTED-RED`
(reserved for EXECUTED cases with a pinned product-failure signature — RSL-6), NOT PASS, NOT ordinary FAIL.
So the long suite never spends hours mixing "harness failed" with "product expected-red" on an unvalidated
path, and a results doc can never read a never-run case as "expected-red but covered." (#6-only personas ungated.)

## 1. FOUNDATION-FIRST phasing (each gated; Phase-1 GREEN ≠ evidence for #6/#9 — B-nit12)
- **Phase 1 — the day-primitive.** `advanceOneDay`: drive one study day (new study→pass→review study→pass
  →complete) via UI; per-day fail-closed confirm (UI progress + Firebase read). **Exit gate:** one student,
  **16 consecutive days each cleanly recovered and confirmed-persisted** (NOT "zero rebuilds" — rebuilds may
  be app-side, C-med6), PLUS a written rebuild diagnosis (ruling #2). Phase-1 green certifies the PRIMITIVE
  ONLY — #6/#9 coverage is tied strictly to persona-2/3/4 greens with the fresh-B precondition (§5).
- **Phase 2 — personas.** Each persona layered on the primitive, proven over its arc.
- **Phase 3 — reassignments + fleet.** Mid-stream class/list events + N students; end-state oracle for all.

## 2. The day-primitive spec (Phase 1)
- **Clean landing:** reload to public entry, ACCEPT beforeunload (one-shot arm), VERIFY visible class==target
  (retry ×3), confirm a study affordance. (All from the S-1 build, `RUNS1_BUILD_LOG.md`.)
- **Rebuild handling (C-high4, two branches, distinct sentinels already wired `lsr_ui.mjs:385-386`):**
  `rebuild` (sessionCleared=true, "return to study screen") → reload+re-enter+re-drive, bounded retries.
  `rebuild-clear-failed` (sessionCleared=false, "tell your teacher", `TypedTest.jsx:1048`) → **HARD STOP**
  (infrastructure dead-end; log + halt). Diagnose cause per ruling #2.
- **Per-day confirmation (fail-closed, dual-layer):** (a) UI: `readVisibleProgress` shows the expected DAY /
  Words-Introduced; (b) Firebase read-only: the day's attempt(s) exist at the expected position AND the ACTIVE
  doc's CSD/TWI moved by the **persona's expected delta** (NOT a fixed +1/+pace — see §3.1). A day that didn't
  persist → STOP as INVALID (never silently continue). **Firebase is read-only; never written to advance.**
- **Deterministic answers:** `carefulAnswers` (pass) / `partialAnswers(rows, nCorrect)` (threshold/fail) —
  new helpers for personas 6/8/9 (C-med8). Fresh per-run classes + PRISTINE sandbox account per student.

## 3. Persona catalog (CS-grounded). Each: behavior + UI-teeth oracle + Firebase-confirm oracle.
1. **Steady baseline** — single class, pass daily. Certifies the PRIMITIVE only (not #6/#9). csd=16, twi=Σ
   daily new-counts.
2. **Partial-day switcher** (이주헌/박주하/손진욱; #9) — some days pass new in A, leave before review, finish
   review in B. **UI:** B review completes with NO retake gate; A re-entry shows no re-review. **FB:** no dup
   `new` attempt; B review carries A's anchor range; after driving a load in BOTH A and B, both docs csd=D.
3. **Class re-assigned mid-stream** (#6) — A days 1..8; teacher `removeStudent(A)` + student `joinClass(B)`
   ~D8 (there is NO teacher "move" primitive — C-high5); B days 9..16. **PRE (mirror L2, B-blocker1):**
   destination B must be FRESH (no `{B}_{L}` doc/attempts) at move-time — else INVALID. **UI:** dashboard in B
   shows "DAY 9" (not Day 1). **FB:** csd continues 9..16, no re-introduced words.
4. **Cross-pace carry-forward** (남세이/신예나/조준모) — **SEQUENTIAL** move to a different-pace class (A-med).
   **UI:** B resumes at the carried position. **FB:** `twi == greatest-passed-nwei+1` (reconciled anchor, NOT
   a study_states count); the accepted-skip boundary case (조준모 CS-07-07b: twi credits unstudied words) is a
   DEFINED PASS, not ambiguous (B-med9). Concurrent cross-pace CSD (the §5.1 pathological case) is Phase-2 — excluded.
5. **Promotion-ladder climber** (구기현) — **GATED on prerequisites (C-blocker2):** a TINY audit list
   (completion reachable in-arc) + a multi-list-capable teacher (`assignList` CORE-value-select fixed, or a
   teacher with ≥2 pre-assigned lists). Completes list-1, class-changes to list-2. **UI/FB:** list-2 starts
   clean; list-1 progress preserved (student-owned). If prereqs unmet → persona DEFERRED (not silently skipped).
6. **Dual-enrolled + blank retaker** (이서현/박시준) — 2 classes on the same list; some days a blank/low retake
   before passing. **UI:** the retake shows, then Pass. **FB:** failed attempt NEVER anchors (`passed==true`
   filter); no duplicate day; one shared position.
7. **Reload/quit-happy** — reload mid-session, quit+resume at boundaries daily. **UI:** resumes to exact
   (class,list,position,phase). **FB:** no duplicate attempt.
8. **Throttled/intervention (PARTIAL throttle)** — drive a **PINNED review-score band** over ≥3 sessions
   [RSL-2/RSL-5]: `calculateInterventionLevel` reads the last 3 non-null **`reviewScore`** values, returns 0
   until 3 exist, `1.0` when avg ≤ 0.30, else linear between 0.75 and 0.30 (`studyAlgorithm.js:71-97`) — low
   NEW-word scores do NOT accrue intervention. Persona-8 targets **avg review ≈ 0.60** (band `(0.30, 0.75)`)
   so intervention is PARTIAL, giving `0 < interventionLevel < 1`. **FB:** for each throttled day, `twi`
   advance == `round(pace·(1−interventionLevel))` with interventionLevel computed at session init from the
   PRIOR 3-review-score window (NOT the score earned later that day), and require **`0 < dayNewCount < pace`**
   (partial throttle, NOT a zero-new-word freeze — that overlaps persona-12's phantom-day path). csd still
   +1/day. **Full-freeze (avg ≤ 0.30 → interventionLevel=1.0 → 0 new words) is a SEPARATE pinned persona-8b**,
   not this ordinary throttled persona.
9. **Threshold-edge passer** (김나연/김호형/박혜린; #5) — **fixture PINS `passThreshold` (e.g. 92) AND
   `newWordRetakeThreshold`** on the sandbox class (server default is 95 — A-blocker2). Student scores just
   ≥ threshold. **UI IS THE TEETH:** results show "Pass", NO retake loop entered (the #5 client bug is
   doc-invisible — B-high4). **FB:** `score >= class.passThreshold` → advances. (Note inconsistency to flag:
   `manual-pass.mjs:53`=92 vs server=95.)
10. **Support-intervened survivor** (manual-pass, CS incidents) — **pre-audit Admin SEED as FIXTURE SETUP
    ONLY** [RSL-4, Codex-accepted]: browser CLOSED; written BEFORE runId/activity capture begins; recorded
    separately as `fixtureSeed` (NOT an audit action); **never used mid-run to advance or repair a student**;
    excluded from all "UI drove this day" claims; postverify labels it **"seeded support-state survival"**,
    NOT "user achieved a manual pass via UI". (A manual-pass is not a UI-able action → this is state setup,
    keeping the owner's "never write to advance a run" line intact.) Two variants: (a) VALID anchor via
    `manual-pass.mjs` → onward days advance, no `csd_anchor_invalid`; (b) **INVALID anchor missing
    `newWordEndIndex`** (CS-06-21 founding incident — B-med7) → studyDay-fallback fires, `csd_anchor_invalid`
    log delta, CSD/TWI==stored (non-demoting).
11. **getPrimaryFocus footgun** (박시은 CS-06-24b; 06-28b would've bumped 200/215) — teacher adds a SECOND list
    to the student's class mid-stream. **UI:** default focus STAYS on the active-progress list (not bumped to
    Day 1 of the new list); position preserved. (New — B-med8.)
12. **List-completer at Day-15/16 boundary** (최도훈/안예진/고아연) — reaches list end. **EXPECTED-RED with a
    PINNED signature (B-high5):** ONLY the list-completion dead-end (`newWordCount===0` phantom day) at
    `twi==wordCount`, with ZERO other anomalies. ANY other anomaly at that boundary (e.g. CS-07-07 lost-save
    `impossible_phase_detected`, missing new attempt) = **UNEXPECTED-RED**. Gated on the tiny-list prereq (§5-persona-5).

## 3.1 Per-day oracle = per-persona CHECKPOINT sequence (NOT a single delta) [A-high3/4, B-high3, RSL-1]
A single per-day Δ is ambiguous — a partial-switch day has DISTINCT intra-day checkpoints. Each persona-day
defines an ordered checkpoint list `(action → expected csd, twi)`:
- **steady day:** after new-pass+review-complete → Δcsd=+1, Δtwi=`round(pace·(1−intervention))` (==pace only
  when intervention=0 and not list-tail).
- **partial-day switch (persona-2/#9) — MUST be checkpoint-based [RSL-1 blocker]:**
  1. start of Day D: `csd=D−1`, `twi=prevTWI`.
  2. after A Day-D **new pass** + a B reconciling load: `csd=D−1`, `twi=prevTWI + dayNewCount` (the anchor
     step advances TWI ONCE — Δtwi is NOT 0 for the day; the #9 fix only stops the review step from
     re-adding it).
  3. after B **review completion**: `csd=D`, `twi=prevTWI + dayNewCount` (review adds ZERO — the #9 assertion).
  4. after re-entering A: A converges to `csd=D`, `twi=prevTWI + dayNewCount`.
  → assert BOTH "anchor adds dayNewCount exactly once" AND "review adds zero"; a whole-day Δtwi=0 would
  FALSE-RED a correct build, and skipping checkpoint 3 would let a broken build hide the #9 double-add until
  the end-state.
- **switch day (persona-3/4):** the fresh doc goes 0→(anchorDay|anchorDay−1)→+1 — a one-time jump, not +1.
- **intervention day (persona-8):** Δtwi = `round(pace·(1−interventionLevel))` where interventionLevel is the
  value computed AT SESSION INIT from the PRIOR window (§persona-8), < pace.
Fail-closed on EVERY checkpoint (self-healing masks transient resets by day 16 — B-high3): the per-day
checkpoints are the real teeth; the end-state oracle (§4) is corroboration, not the sole gate.

## 4. End-state integrity oracle (bound; UI-teeth + Firebase read-only)
Per student, after all days, assert (exact per-doc + UI-observable):
- **No day-reset:** the ACTIVE doc's csd is monotonic = total sessions studied; never dropped to 1 on a class
  change (read the ACTIVE doc; do NOT require abandoned docs to agree at rest — A-blocker1).
- **Convergence (multi-class):** only AFTER the driver enters BOTH classes (a reconciling load each), assert
  the docs agree; distinguish "diverged at rest but converges on load" (correct) from "diverges even after
  both loads" (#9 regression) (B-high2).
- **Position integrity:** twi == greatest passed-new nwei + 1; no re-introduced words (no dup `new` at a
  passed position); no twi>wordCount unless a pinned list-complete persona.
- **Anchor validity:** anchor = greatest-nwei passed-new; zero `csd_anchor_invalid`/`impossible_phase_detected`
  except the pinned persona-10b (invalid-anchor) / persona-12 signatures.
- **Data-integrity sweep** (`scripts/cs/data-integrity-sweep.mjs`, read-only) CLEAN before & after, sandbox-scoped.
- **Bound manifest (B-high6):** emit a persona×day manifest; the verdict enumerates catalog-vs-run, marks any
  absent persona/day UNRUN ("not covered", never absorbed into PASS), logs every truncation with reason. No
  silent subset (mirror Run L's REQUIRED-set check, `lsr_runL_verify.mjs:144`).
- **Verdict states (RSL-6 — distinct, non-overlapping):** `PASS` (executed + passed) · `EXPECTED-RED`
  (EXECUTED + matched a pinned product-failure signature, e.g. persona-12) · `UNEXPECTED-RED` (executed,
  unpinned failure = regression) · `BLOCKED` (prereq unmet, e.g. #9 deploy/Run S — did NOT run, NOT coverage)
  · `UNRUN` (dropped/skipped — NOT coverage) · `INVALID` (precondition violated). Only all-`PASS` (+ any
  `EXPECTED-RED` on pinned signatures) over the FULL manifest = certified; any `BLOCKED`/`UNRUN` means
  incomplete coverage, never a green.

## 5. Reassignment mechanics (Phase 3)
Reassignment = teacher `removeStudent(A)` + student `joinClass(B)` (no "move" primitive — C-high5). Per-persona
JSON timeline interleaved with the days. Faithful day-reset reproduction (does remove+rejoin create the fresh
`{B}_{L}` that WOULD reset without the flag?) is an explicit Phase-3 validation, asserted via the fresh-B PRE.
Teacher list-to-different-pace mid-stream via `editSettings` (feasible, C-confirmed).

## 6. Harness (mirror certified Run L bound pipeline)
`lsr_runSL_fixture.mjs` (teacher UI-creates classes; students join; pre-audit Admin SEED for persona-10 +
pristine-account provisioning, browser closed) → `lsr_runSL_verify.mjs --pre` (fresh-B + effective-assignment
+ per-persona counterfactual) → `lsr_runSL.mjs` (primitive + persona scripts + timeline; per-day fail-closed;
screenshots) → `lsr_runSL_verify.mjs --post` (§4 oracle, bound by runId+digest). Sandbox ONLY (25WT/`lsr_*`/
fresh `25WT RUNSL …`) — NEVER 26SM. Build log + runbook maintained.

## 7. OUT OF SCOPE (stated so absence ≠ coverage — B-med11)
This is a RECONCILIATION audit. NOT covered here (separate suites/plans): grader accuracy (CS-07-06b),
grade-token/save-path (CS-06-29), teacher gradebook query (NEED_TO_FIX #8), webview-freeze (CS-06-29D),
forgery/security (#1c) — the tautological "no forgery" oracle is REMOVED (no persona attempts a laundered
pass). Phase-2 single-doc convergence + concurrent cross-pace CSD (deferred to Phase-2 deploy).

## 8. Honest cost/scale (C-nit10)
16 days × ~3 min/day × N personas + recovery re-drives ≈ many hours sequential; personas 5/12 need >16 days
on a tiny list. Iterate on a proven subset; extend to the full fleet only after Phase-1's primitive is
bulletproof. The manifest makes any subset explicit, never read as full coverage.

## 9. Open questions (for the loop)
1. Persona-10 Admin SEED: is a pre-audit (browser-closed) manual-pass write acceptable as state-setup under
   ruling #1 (it's NOT a UI-able action), or must the support-intervention be represented differently?
2. Rebuild root cause (ruling #2) — resolve in Phase 1; may become its own app-fix task.
3. Multi-list teacher + tiny-list provisioning for personas 5/12 — build now or defer those personas to a
   later phase?
4. Fleet concurrency: N students in parallel contexts vs sequential (reliability vs wall-clock).
