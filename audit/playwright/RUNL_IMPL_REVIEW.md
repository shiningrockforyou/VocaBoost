# Run L implementation — Codex review brief (2026-07-05)

Implements the **blessed** `RUNL_DESIGN_SPEC.md`. NOT yet run (per the discipline: review the implementation
before any run). Adversarially review for false-green paths + design-conformance. `RUNL_CODEX_REVIEW.md` (the
old broken-harness brief) is superseded.

## Files
- `lsr_runL_cases.json` — case defs (L1-T/M/R fresh + L2 collision; list TOP).
- `lsr_runL_fixture.mjs` — **Admin-free**: allocates 3 preflight-clean accounts to L1-T/M/R + pins `lsr_s04`
  (existing day-2, valid anchors) as L2's class-A; UI-joins each to its class → `runL_fixture_<runId>.json`.
- `lsr_runL_verify.mjs` — **read-only Admin**: `--pre` validates fixtures (L1 strict-fresh; L2 counterfactual),
  snapshots, clears stale; `--post` binds pre+activity+anomalies, asserts every per-case oracle, verdict.
- `lsr_runL.mjs` — **Admin-free** measured driver (L1-T/M/R completions; L1-R fail→intermediate→retry→pass;
  L2 select-B→enter→leave→reload→read-B-local) + bound anomaly artifact.

**Bound pipeline:** preflight → fixture → `verify --pre` → driver → `verify --post`. runId ties all artifacts;
buildId (`LSR_BUILD_ID`) bound across pre/activity.

## Design-conformance (how each spec point is met)
- **Strict "fresh"**: `--pre` fails L1 if any class_progress/session_states/attempts/list-study_states exist.
- **L2 counterfactual**: `--pre` fails unless A has a valid winning anchor (`wordsIntroduced` pos-int ==
  `nwei-nwsi+1`), day≥2, A&B assign the same list, B has no doc/attempts, and A's position > 0.
- **L1-R intermediate**: driver asserts retake-gate seen + success absent + dashboard still Day-1/0-words
  (`midDay`/`midWords`) + screenshot, BEFORE retry; `--post` requires **exactly one failed + one passed**.
- **Exact transitions**: `--post` requires CSD +1, TWI delta == the pass's `wordsIntroduced`, valid anchor.
- **L2 negative control**: `--post` requires ZERO new attempts, A doc unchanged, B doc absent/csd-0, visible
  B Day-1/0-words, and `focusStillB`.
- **Binding/anomaly/logs**: exact case set required; window-scoped new-attempt filter; flag-ON-only log deltas
  scoped to the run's users; fatal anomalies bound into the verdict.

## Self-disclosed concerns (please scrutinize)
1. **L2 focus retention** — I rely on `switchClass(B)` PERSISTING saved focus = B, so after reload the F02
   progress-preference (which favors A, the list with progress) does NOT snap focus back to A. If `switchClass`
   doesn't persist, `focusStillB` is false → the verifier voids the measurement (good) but L2 never certifies.
   Confirm `switchClass` persists the class pref.
2. **L2 reconciliation trigger** — I assume `driveNewWordsToTest` reaching the session screen fires
   `getOrCreateClassProgress` for B (creating B's doc). Confirm that's the actual trigger vs. requiring a deeper step.
3. **L1-R retry path** — after `retake-gate`, I re-enter via `driveNewWordsToTest` for the pass. Confirm the
   retake is reachable that way (vs. a dedicated retake button), and that fail+pass yield exactly two `new`
   attempts (one failed, one passed).
4. **`driveTest` scope** — I assume it submits ONLY the current new-word test (no review) so L1 is Day-1-only.
5. **`study_states` schema** — the "fresh" + list-study check guesses `id.includes(listId) || data.listId`.
   Verify against the real schema.
6. **Only 3 clean accounts** — zero margin; a single flaky join strands the run. (Provision more `lsr_*` +
   re-preflight if needed.)
7. **Class-assignment shape** — `classAssignsList` checks `assignments` keys / `assignedLists`; confirm.

## Status
Syntax-clean; imports resolved; NOT run. Awaiting review; then a fixture+`--pre` smoke (cheap, read-only-ish)
before the full measured run.

---

## Round-1 fixes (2026-07-05) — all 11 addressed
1. **Invalid --pre can't certify** — `--pre` writes `valid:true/false`; `--post` FAILS unless `pre.valid===true`.
   All required visible assertions now NON-NULL-EXACT (`reqEq`/`reqTrue`): L1 `visibleDayAfter===2`; L1-R
   `retakeSeen/successAbsent===true`, `midDay===1`, `midWords===0`; L2 `selectedB/entered/focusStillB===true`,
   `bVisibleDay===1`, `bVisibleWords===0`.
3. **Class-specific L1 evidence** — `--pre` resolves+binds each L1 `classId`; `--post` filters attempts by
   `classId && listId && sessionType==='new'` and uses the exact `class_progress/{classId}_{listId}` doc. `--pre`
   verifies the assignment `testMode` matches the case mode.
4. **L2 interaction** — new `enterSessionOnly` helper (enter session, no study/test); driver uses it.
5. **L2 focus** — driver records `selectedB` (non-null bool) right after switch; `--post` requires
   `selectedB===true && focusStillB===true`.
6. **L2 backend** — exact pre/post attempt-ID set equality; A doc required present + unchanged; B doc must be
   absent or `csd===0 && twi===0`.
7. **Counterfactual** — `--pre` computes the winning valid list-wide anchor (max `nwei` among passed valid
   anchors, any class), binds its class as A, requires `winner.studyDay>=2`.
8. **Anomaly bind** — `--post` FAILS if the anomaly artifact is missing; checks its `runId`+`buildId`;
   `BUG`/`flow-gap`/`selector-gap` now fatal kinds.
9. **Log delta by ID** — `--pre` snapshots flag-ON-only log IDs scoped to run users; `--post` compares post IDs
   vs pre IDs (set difference), not timestamps.
10. **Strict-fresh** — L1 personas must have ZERO study_states (fully clean; simpler+stronger than list-scoping,
    valid because L1 personas are preflight-fully-clean).
11. **Build binding** — `LSR_BUILD_ID` REQUIRED (non-empty) and asserted equal across fixture/pre/activity/
    anomalies/post; missing ⇒ hard error.
12. **Fixture isolation** — `--pre` verifies exact enrolledClasses set (L1: exactly [classId]; L2: exactly
    [A,B]), target assignment presence, and mode.

---

## Round-2 fixes (2026-07-05) — all 6 + evidence contract
1. **Stale valid-pre** — `--pre` deletes pre/activity/verdict/anomalies BEFORE `admin.initializeApp` (any fallible init), so a cred/init/query failure on a reused runId can't leave a stale `valid:true` pre.
2. **L2 list binding** — driver selects+asserts BOTH `Class:B` and `List:L` before entry and after reload; `--post` requires `selectedB/selectedListL/focusStillB/focusListStillL === true`.
3. **L2 list-specific progress** — A/B `class_progress` lookups now require `classId && listId===LIST`.
4. **enterSessionOnly** — regex now includes the real `Start Session` dashboard button.
5. **L1 evidence** — attempt snapshot adds `testType` + `submittedAt(ms)`; `--post` requires `testType===mode`, submittedAt in the driver window, `outcome==='results'` (L1-R `passOutcome==='results'`), and **visible words === the pass's `wordsIntroduced`**.
6. **Artifact/anomaly binding** — runId checked on fixture/pre/activity/anomalies; EXACT required case-set equality on all four; timestamp ordering fixture≤pre≤activity.start≤end; anomaly time window bound; **anomalies now FAIL-CLOSED** (every finding fatal except an explicit benign allowlist — catches `modal-dead`/`prep-issue`).
- **Evidence contract** — per-case before/after screenshots (+ L1-R intermediate, L2 after-enter) and `F.step` visible-action logs throughout.

---

## Round-3 fixes (2026-07-05) — 4 gaps + 2 hardening
1. **L1 all-attempts validation** — `--post` requires EXACT total new-attempt count (T/M=1, R=2), rejects any `passed:null`, and validates `testType===mode` + submittedAt-in-window for EVERY new attempt (not just the pass).
2. **L2 explicit list selection + exact equality** — new `selectList` helper performs a visible list-selection action; driver uses EXACT normalized equality (not substring); `--post` also binds the persisted saved focus at the data layer (`primaryFocusListId===L`, `primaryFocusClassId===B`).
3. **Specific passed-results detection** — driver asserts the passed card heading (typed "Completed Day N session" / MCQ "New Words Test Passed!") + Continue button (`passedResults`), recorded as `passedHeadingSeen` and required in `--post` (replaces the broad `%/score` reliance).
4. **Fail-closed evidence** — `shot` returns success; L1 records + `--post` asserts the initial `visibleDayBefore===1`/`visibleWordsBefore===0` (so 1→2 is fully tested); `--post` requires the expected screenshot FILES to exist on disk.
- **Hardening:** fixture builder deletes any stale fixture before init; `validAnchor` now also requires `nwsi>=0` and a positive-integer `studyDay`.

---

## Round-4 fixes (2026-07-05) — stale-screenshot blocker + 4 corrections
1. **[BLOCKER] Stale screenshot reuse** — driver DELETES this run's expected PNGs up front; a `snap()` wrapper records only successfully-captured shots into `activity.shots`; `--post` requires each required shot to be BOTH in `activity.shots` AND present on disk. A reused runId after a failed run can no longer certify on old PNGs.
2. **L2 session-entry screenshot** — new `L2_inSession` capture immediately after `enterSessionOnly` (before returning/reloading), required by `--post` (the prior two were both post-reload).
3. **Driver pre-flight guard** — refuses to run unless the local `--pre` exists with `valid:true` and matching runId/buildId/exact case set — an accidental run after a failed `--pre` no longer burns the fresh personas.
4. **Fixture stale-artifact ordering** — `lsr_ui` is now **dynamic-imported AFTER** the stale-fixture delete, so a static-import/password failure can't leave a stale fixture.
5. **passedResults bounded waits** — exact heading + Continue now use bounded `waitFor` (15s/8s) instead of instant `isVisible`, avoiding timing-based false failures.

---

## Round-5 fixes (2026-07-05) — identity binding + ordering + spares
1. **[BLOCKER] Persona identity binding** — new `lsr_runL_digest.mjs` computes a deterministic SHA-256 fixture digest over per-case identity (id/email/role/mode/joinTarget/class/classB + runId/buildId/list). Stamped into pre/activity/anomalies; `--post` requires all three equal AND recompute-equal from the current fixture (a fixture edited after `--pre` flips the digest → rejected). PLUS per-case identity equality in `--post`: activity's email/role/mode/class/classB must equal fixture + pre. Verified: digest deterministic + changes on any identity edit.
2. **Ordering** — fixture stale-delete now precedes the `LSR_BUILD_ID` check (a missing build id can't leave a stale fixture).
3. **Spares** — provisioned lsr_s31–s36; preflight clean pool now **9** (was 3) — margin for the 3 L1 personas.

---

## Post-run-1 revision (2026-07-05) — real failures fixed per Codex's revised diagnosis
First measured run FAILED-CLOSED (no false PASS). Root causes were NOT harness-selector-only:
1. **APP DEFECT recorded** (`NEED_TO_FIX.md #7`): `db.js:502` `assignedLists || Object.keys(assignments)` — empty `[]` is truthy → dashboard shows "0 assigned lists". `25WT LSR-A TYPED` was in this split-brain → L1-T/R "test not reached". Fix direction noted; `--pre` strengthened.
2. **Fresh per-run classes** — fixture now CREATES classes via teacher UI (`25WT RUNL <case> <runId>`, list assigned, mode-correct) instead of reusing drift-prone persona classes. L2-A stays the persona's historical anchor class (data-layer only, never rendered → not effective-checked).
3. **Effective-assignment precondition** — `--pre` `classInfo` now replicates Dashboard semantics EXACTLY (`assignedLists || Object.keys(assignments)`, incl. the []-truthy bug) so a split-brain class is CAUGHT, not masked. Applied to L1 classes + L2-B (entered via dashboard); NOT to L2-A (anchor-only).
4. **L2 exit = visible Quit→Leave** — new `leaveSessionViaQuit` (click "Quit session" aria-label → "Leave Study Session?" modal → "Leave" → wait Dashboard), replacing the `goDashboard()` programmatic nav that left the session's beforeunload handler active (→ the unexpected native dialogs + reload timeout). `--post` requires `leftViaQuit===true`.
5. **Driver smoke** — new `lsr_runL_driversmoke.mjs`: runs the measured primitives (fresh class → study Day-1 → results card → enter→Quit→Leave) on a sacrificial account, NO binding/verdict. Catches driver-level breakage the fixture/--pre smoke can't. Run before any full measured run.

Result L1-M (MCQ) was CASE-LEVEL verified (csd1/twi80, exact oracle) even though the bound suite verdict was FAIL.
