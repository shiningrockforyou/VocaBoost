# DF2-11 TEACHER REVIEW-SETTINGS UI — FOLD LEDGER (client-only, flag-gated, LIVE teacher surface)

Built from the df2-11 mapping scout (2026-08-04, file:line throughout) + orchestrator spot-verification.
Behind `REVIEW_V2_CLIENT` (still false), the teacher assignment modals gain a REVIEW-SETTINGS group that
writes per-assignment overrides (`reviewPassThreshold`/`reviewQueueSize`/`reviewTestSize`/`reviewGateEnabled`
+ `reviewTestType`) the SERVER already reads (`config.js:163-192`); flag-OFF the modals render + write
BYTE-IDENTICALLY to today (the dead `reviewTestSizeMin/Max` block stays flag-off). This is DF2-11's
"menu simplification" leg, built INSIDE DF2-14's dark train — one exposure at the flip, no dead-lever period.

**WHY IT IS A REAL FOLD, not a quick win:** the scout found TWO write modals (AssignListModal +
ClassDetail's own "Edit List Settings" modal), TWO writers (`assignListToClass` + `updateAssignmentSettings`),
a ClassDetail read card, and a load-bearing tension — "byte-identical flag-off" vs "delete the dead
min/max" can BOTH hold only if the min/max→new-group swap is FLAG-SCOPED (physical delete rides the flip,
DF2-02a). LIVE surface: 26SM teachers use these modals today, so flag-off byte-identity is load-bearing.

**FLAG DECISION (orchestrator):** gate on `REVIEW_V2_CLIENT` — the SAME build constant as the whole client
cutover (a/b/c/d), not a new flag. One exposure at the flip, in sync with the rest of the client engine.
The client-rebuild-vs-server-`system_config.enabled` deploy ORDERING (so no dead-lever window opens) is a
DF2-14 CHOREOGRAPHY concern, carded E4 — not solved here.

## GROUP V — VERIFY BEFORE EDITING
[ ] V1  **The two write modals + two writers + the doc shape** (scout §1-2, orch-verified §3).
        AssignListModal (`src/components/AssignListModal.jsx`, 239 lines) → 9-POSITIONAL `onAssign(...)`
        (:49) → `ClassDetail.handleAssignList` (:390) → `assignListToClass` (`db.js:805`, writes
        `classes/{classId}.assignments[listId]={pace,testOptionsCount,testMode,passThreshold,testSizeNew,
        reviewTestType,reviewTestSizeMin,reviewTestSizeMax,assignedAt}` at `db.js:829-840`, byte-verified).
        ClassDetail "Edit List Settings" modal (`ClassDetail.jsx:1128-1391`, block :1258-1319) →
        `handleSaveSettings` (:427) → `updateAssignmentSettings` (`db.js:877`, per-field patch). Assignment
        = a MAP ENTRY `assignments[listId]` in `classes/{classId}`, per-(class,list).
[ ] V2  **The dead min/max fields have NO live reader** (orch spot-verified). `reviewTestSizeMin/Max`
        dot-accessed ONLY at: settingsForm hydrate (`ClassDetail.jsx:275-276,416-417`), the writer's own
        validation (`db.js:929-938`), and JSDoc (`sessionTimeCalculator.js:30-31`, a util with ZERO
        external callers). The LIVE review size is `calculateReviewTestSize(interventionLevel)`
        (`studyService.js:545`) — called with NO min/max, so it uses internal constants
        (`studyAlgorithm.js:258-260`), never the assignment fields. ⇒ safe to FLAG-SCOPE (physical delete
        = DF2-02a, at the flip). `testSizeReview` is a SEPARATE ghost-read (DF2-46), NOT this fold's target.
[ ] V3  **The flag-scoped render + save template is PROVEN byte-identical** (orch spot-verified). ClassDetail
        gates a whole section `{CYCLING_ENABLED && (<section>)}` (`:1360`) and conditions the save spread
        `...(CYCLING_ENABLED ? {cyclingEnabled:…} : {})` (`:448`) — flag-off ⇒ key omitted ⇒ no-op in the
        writer ⇒ byte-identical save. `REVIEW_V2_CLIENT` is a module-level build const
        (`featureFlags.js:243=false`); AssignListModal does not yet import featureFlags (trivial add).
[ ] V4  **The server field contract** (scout §8). `config.js:163-174` validation (present-but-malformed ⇒
        HOLD; absent/null ⇒ frozen default): `reviewPassThreshold` int [1,100] · `reviewQueueSize` int
        [1,500] · `reviewTestSize` int [1,500] · `reviewGateEnabled` boolean · `reviewTestType` 'mcq'|'typed'.
        Defaults (`:28-32`): threshold 92 · queueSize 60 · testSize 30. Precedence (`:125-159`): global
        `system_config/review_v2.enabled=false` ⇒ OFF everywhere; else `asg.reviewGateEnabled=false` ⇒ OFF
        for that assignment. Client validation MIRRORS this (UX guard; the SERVER is the authority).
[ ] V5  **Flag-off byte-identity targets + the threshold-collision guard.** Flag-off, BYTE-IDENTICAL: both
        modals' render, both writers' `assignments[listId]` output, the ClassDetail read card (:799-820), and
        the `handleAssignList`/`handleSaveSettings` callers. **Do NOT merge** the new review `reviewPassThreshold`
        (default 92) with the existing new-word `passThreshold` (default 95, `db.js:834`) — two distinct fields,
        distinct labels.

## GROUP A — DELTAS
[ ] A1  **AssignListModal review group, flag-scoped.** Replace the UNCONDITIONAL min/max "Review Test
        Settings" section (`AssignListModal.jsx:165-217`) with `REVIEW_V2_CLIENT ? <new group> : <today's
        min/max section, byte-identical>`. New group: reviewPassThreshold (92) · reviewQueueSize (60) ·
        reviewTestSize (30) · reviewGateEnabled (default ON) · reviewTestType (mcq/typed) — English-only
        labels [R2-44], VISIBLE defaults, client validation per V4. Carry the new fields to the caller via
        an APPENDED options-object arg (keep the 9 positional intact ⇒ byte-identical flag-off callback).
        Fixture `df2-11-teacher-review-settings-fixtures.mjs`: flag-off callback byte-identical (C1) ·
        flag-on write (C2) · per-field validation (C3); flag-off RENDER parity = the C5 visual.
[ ] A2  **ClassDetail "Edit List Settings" modal — the SAME flag-scoped swap** (`ClassDetail.jsx:1258-1319`),
        saving via `updateAssignmentSettings`. Same new group, same labels/defaults/validation, same
        options-shaped patch. Flag-off byte-identical. Fixture: same
        `df2-11-teacher-review-settings-fixtures.mjs` (C1/C2/C3) + the C5 visual.
[ ] A3  **db.js writers accept + write the new fields, flag-scoped.** `assignListToClass` (`:829-840`) +
        `updateAssignmentSettings` (`:895+`): spread-conditional the new review keys (flag-on ⇒ written with
        validated values; flag-off ⇒ keys omitted ⇒ byte-identical, min/max as today). Client validation
        (clamp/reject out-of-range BEFORE write) mirrors V4. **BOTH writers get ALL fields** — do not repeat
        the `studyDaysPerWeek` asymmetry (scout §7). Do NOT physically remove min/max here (E1).
        Fixture `df2-11-teacher-review-settings-fixtures.mjs`: writer flag-off byte-identity (C1) + flag-on
        + validation (C2/C3).
[ ] A4  **ClassDetail read surface** (the per-list card `:799-820`). Flag-ON: display the review settings
        (threshold/queueSize/testSize/gate). Flag-OFF: byte-identical (no review settings shown, as today).
        Fixture: the C5 visual (render parity) — no new data logic beyond A3's writers.

## GROUP C — FIXTURES + MUTANTS
[ ] C1  Flag-OFF byte-identity of the WRITERS: flag-off, `assignListToClass` + `updateAssignmentSettings`
        produce the SAME `assignments[listId]` shape as HEAD (new keys ABSENT, min/max PRESENT). Test via
        the cleanest seam (a pure extraction of the assignment-object construction, or the emulator — the
        implementer picks, as streakAuthority did; `db.js` cannot load under plain node).
[ ] C2  Flag-ON write: the new fields are written with validated values + visible defaults; min/max omitted.
[ ] C3  Validation, one fixture (valid + invalid) PER field: reviewPassThreshold ∉ [1,100] → rejected/clamped
        · reviewQueueSize/reviewTestSize ∉ [1,500] → rejected/clamped · reviewGateEnabled coerced boolean ·
        reviewTestType ∉ {mcq,typed} → default mcq. Match the SERVER contract (V4).
[ ] C4  One MUTANT per validation clause (e.g. widen a range, or drop the enum guard) ⇒ the matching invalid
        fixture goes RED. Restore clean.
[ ] C5  **VISUAL CHECK (WinClaude order, 25WT):** flag-OFF, BOTH modals render UNCHANGED (the min/max block
        exactly as today) AND both still LOAD/SAVE. The new group is flag-ON only (dead until the flip).
        Batched with the pending dashboard-streak-authority-visual.

## GROUP D — TRUTH REPAIRS
[ ] D1  Any doc that says DF2-11 "DELETES the dead reviewTestSizeMin/Max" must read "FLAG-SCOPES the
        min/max→new-group swap; the PHYSICAL deletion rides the flip release (DF2-02a, one release)."
        Check `02_TASK_LIST.md:92,109` + `13_ROUND5_PANEL_RECORD.md:249-251` (the F2-15 tension) and repair
        at source if they assert an immediate delete.

## GROUP E — CARDED, NOT THIS ROUND
[ ] E1  **Physical deletion of `reviewTestSizeMin/Max`** (UI blocks + writer validation + the dead
        `sessionTimeCalculator.js` util) — rides the flip release with DF2-02a ("same modal, one release").
        Flag-off still uses them, so deleting now breaks byte-identity.
[ ] E2  **`assignment.testSizeReview` ghost-read** (`testConfig.js:31`, MCQ/Typed/DSF) — separate never-written
        field, DF2-46 post-flip cleanup. The engine already reads the server's `reviewTestSize`.
[ ] E3  **Force-pass UI + the exact-attempt resolver** — DF2-14 (no server resolver exists today, scout §6).
[ ] E4  **The flip DEPLOY ORDERING** (client `REVIEW_V2_CLIENT` rebuild vs server `system_config.enabled`
        write) so no dead-lever window opens — DF2-14 choreography, not this fold.

## CLOSE
[ ] every non-carded row ticked (file:line + fixture) [ ] evidence re-run after last edit [ ] shas re-stamped
[ ] numbers re-derived [ ] change log row [ ] gate.mjs (explicit ledger path; foreign reds enumerated) [ ] commit
[ ] **VISUAL CHECK** — WinClaude order (C5), batched with dashboard-streak-authority-visual. 25WT.
[ ] concurrent session shares the repo — stage explicitly   [ ] implementer (OPUS — live surface) PAIRED with an auditor
