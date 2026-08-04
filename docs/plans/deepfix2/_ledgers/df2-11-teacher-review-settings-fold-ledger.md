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

**IMPLEMENTATION STATUS (2026-08-04, OPUS implementer):** A1-A4 built; C1-C4 fixtured GREEN
(`df2-11-teacher-review-settings-fixtures.mjs` 42/0 · `-mutants.mjs` 6/6 killed, restore clean). SEAM =
PURE extraction into `src/utils/reviewSettingsAuthority.js` (a build-const gate cannot be flipped for the
emulator; db.js cannot load under node — see the fixture header). C5 (visual) = WinClaude, not this
implementer. D1 (doc truth-repair) = OUT of this implementer's allowed file set — repair reported, deferred.

## GROUP V — VERIFY BEFORE EDITING
[x] V1  **The two write modals + two writers + the doc shape** (scout §1-2, orch-verified §3).
        AssignListModal (`src/components/AssignListModal.jsx`, 239 lines) → 9-POSITIONAL `onAssign(...)`
        (:49) → `ClassDetail.handleAssignList` (:390) → `assignListToClass` (`db.js:805`, writes
        `classes/{classId}.assignments[listId]={pace,testOptionsCount,testMode,passThreshold,testSizeNew,
        reviewTestType,reviewTestSizeMin,reviewTestSizeMax,assignedAt}` at `db.js:829-840`, byte-verified).
        ClassDetail "Edit List Settings" modal (`ClassDetail.jsx:1128-1391`, block :1258-1319) →
        `handleSaveSettings` (:427) → `updateAssignmentSettings` (`db.js:877`, per-field patch). Assignment
        = a MAP ENTRY `assignments[listId]` in `classes/{classId}`, per-(class,list).
        → VERIFIED in code (read + grep): onAssign AssignListModal.jsx:49; handleAssignList ClassDetail.jsx:390;
          assignListToClass db.js:805 (write shape :829-840); Edit modal :1128-1396; handleSaveSettings :427;
          updateAssignmentSettings db.js:877. Only caller of each writer: ClassDetail.jsx:395 / :432 (grep).
[x] V2  **The dead min/max fields have NO live reader** (orch spot-verified). `reviewTestSizeMin/Max`
        dot-accessed ONLY at: settingsForm hydrate (`ClassDetail.jsx:275-276,416-417`), the writer's own
        validation (`db.js:929-938`), and JSDoc (`sessionTimeCalculator.js:30-31`, a util with ZERO
        external callers). The LIVE review size is `calculateReviewTestSize(interventionLevel)`
        (`studyService.js:545`) — called with NO min/max, so it uses internal constants
        (`studyAlgorithm.js:258-260`), never the assignment fields. ⇒ safe to FLAG-SCOPE (physical delete
        = DF2-02a, at the flip). `testSizeReview` is a SEPARATE ghost-read (DF2-46), NOT this fold's target.
        → VERIFIED, with a CORRECTION: the enumeration was INCOMPLETE — `src/utils/testConfig.js:36-37`
          ALSO reads `assignment.reviewTestSizeMin/Max` and echoes them into buildTestConfig's output
          (:61-62). BUT no consumer reads `config.reviewTestSizeMin/Max` (grep: MCQTest/TypedTest/
          DailySessionFlow/reviewV2Compose read only `testSizeReview`, the E2 ghost; TypedTest.jsx:317 is a
          comment). sessionTimeCalculator.js has ZERO external callers (grep empty). So the CONCLUSION holds
          (min/max drives no live behavior; the live size = calculateReviewTestSize with internal constants,
          studyService.js:545 / studyAlgorithm.js:258). Flag-OFF min/max is written identically ⇒ every reader
          unaffected; flag-ON min/max omission is behaviorally inert (echo-only, no consumer). Safe to swap.
[x] V3  **The flag-scoped render + save template is PROVEN byte-identical** (orch spot-verified). ClassDetail
        gates a whole section `{CYCLING_ENABLED && (<section>)}` (`:1360`) and conditions the save spread
        `...(CYCLING_ENABLED ? {cyclingEnabled:…} : {})` (`:448`) — flag-off ⇒ key omitted ⇒ no-op in the
        writer ⇒ byte-identical save. `REVIEW_V2_CLIENT` is a module-level build const
        (`featureFlags.js:243=false`); AssignListModal does not yet import featureFlags (trivial add).
        → VERIFIED: CYCLING render pattern ClassDetail.jsx:1360; save spread :448; nextListId spread :445.
          REVIEW_V2_CLIENT featureFlags.js:243 = false (imported into the fixture, asserted === false).
          AssignListModal had NO featureFlags import at HEAD (added it, AssignListModal.jsx:4).
[x] V4  **The server field contract** (scout §8). `config.js:163-174` validation (present-but-malformed ⇒
        HOLD; absent/null ⇒ frozen default): `reviewPassThreshold` int [1,100] · `reviewQueueSize` int
        [1,500] · `reviewTestSize` int [1,500] · `reviewGateEnabled` boolean · `reviewTestType` 'mcq'|'typed'.
        Defaults (`:28-32`): threshold 92 · queueSize 60 · testSize 30. Precedence (`:125-159`): global
        `system_config/review_v2.enabled=false` ⇒ OFF everywhere; else `asg.reviewGateEnabled=false` ⇒ OFF
        for that assignment. Client validation MIRRORS this (UX guard; the SERVER is the authority).
        → VERIFIED against config.js: intOk [1,100]/[1,500]/[1,500] :164-171; gateOk boolean :166-167; typeOk
          mcq|typed :168-169; DEFAULTS 92/60/30 :28-32; modality-law default mcq :192. Client mirror =
          src/utils/reviewSettingsAuthority.js (ints REJECT, gate COERCE, type DEFAULT mcq). NO contradiction.
[x] V5  **Flag-off byte-identity targets + the threshold-collision guard.** Flag-off, BYTE-IDENTICAL: both
        modals' render, both writers' `assignments[listId]` output, the ClassDetail read card (:799-820), and
        the `handleAssignList`/`handleSaveSettings` callers. **Do NOT merge** the new review `reviewPassThreshold`
        (default 92) with the existing new-word `passThreshold` (default 95, `db.js:834`) — two distinct fields,
        distinct labels.
        → VERIFIED distinct: new-word passThreshold default 95 (db.js:834, unchanged); review reviewPassThreshold
          default 92 (reviewSettingsAuthority.js REVIEW_SETTINGS_DEFAULTS; asserted by C2). Separate labels
          "Pass Threshold (%)" vs "Review Pass Threshold (%)" (AssignListModal.jsx / ClassDetail.jsx new group).

## GROUP A — DELTAS
[x] A1  **AssignListModal review group, flag-scoped.** Replace the UNCONDITIONAL min/max "Review Test
        Settings" section (`AssignListModal.jsx:165-217`) with `REVIEW_V2_CLIENT ? <new group> : <today's
        min/max section, byte-identical>`. New group: reviewPassThreshold (92) · reviewQueueSize (60) ·
        reviewTestSize (30) · reviewGateEnabled (default ON) · reviewTestType (mcq/typed) — English-only
        labels [R2-44], VISIBLE defaults, client validation per V4. Carry the new fields to the caller via
        an APPENDED options-object arg (keep the 9 positional intact ⇒ byte-identical flag-off callback).
        Fixture `df2-11-teacher-review-settings-fixtures.mjs`: flag-off callback byte-identical (C1) ·
        flag-on write (C2) · per-field validation (C3); flag-off RENDER parity = the C5 visual.
        → DONE: AssignListModal.jsx — import :4; new-group state + reset :16-19/:33-36; appended 10th arg
          (undefined flag-off) :55-63; render ternary (flag-OFF branch = today's block verbatim). Fixture C1
          (undefined 10th arg, 9 positional intact) + C2/C3 GREEN.
[x] A2  **ClassDetail "Edit List Settings" modal — the SAME flag-scoped swap** (`ClassDetail.jsx:1258-1319`),
        saving via `updateAssignmentSettings`. Same new group, same labels/defaults/validation, same
        options-shaped patch. Flag-off byte-identical. Fixture: same
        `df2-11-teacher-review-settings-fixtures.mjs` (C1/C2/C3) + the C5 visual.
        → DONE: ClassDetail.jsx — import :27; settingsForm init + hydrate (openSettingsModal, loadAssignedLists);
          handleSaveSettings flag-scoped swap `...(REVIEW_V2_CLIENT ? {new4} : {min,max})`; Edit-modal render
          ternary (flag-OFF branch = today's block verbatim). Fixture C1 (handleSaveSettings swap anchor) GREEN.
[x] A3  **db.js writers accept + write the new fields, flag-scoped.** `assignListToClass` (`:829-840`) +
        `updateAssignmentSettings` (`:895+`): spread-conditional the new review keys (flag-on ⇒ written with
        validated values; flag-off ⇒ keys omitted ⇒ byte-identical, min/max as today). Client validation
        (clamp/reject out-of-range BEFORE write) mirrors V4. **BOTH writers get ALL fields** — do not repeat
        the `studyDaysPerWeek` asymmetry (scout §7). Do NOT physically remove min/max here (E1).
        Fixture `df2-11-teacher-review-settings-fixtures.mjs`: writer flag-off byte-identity (C1) + flag-on
        + validation (C2/C3).
        → DONE: db.js — import assignReviewSettings/patchReviewSettings + REVIEW_V2_CLIENT; assignListToClass
          10th param `reviewOptions` + ternary swap `...(REVIEW_V2_CLIENT ? assignReviewSettings(reviewOptions)
          : {reviewTestSizeMin,reviewTestSizeMax})`; updateAssignmentSettings `if (REVIEW_V2_CLIENT)
          Object.assign(updates, patchReviewSettings(settings))`. BOTH writers get the 4 new keys. min/max
          write + validation blocks LEFT intact (E1). Validation mirrors V4 (reject/coerce/default). Fixture GREEN.
[x] A4  **ClassDetail read surface** (the per-list card `:799-820`). Flag-ON: display the review settings
        (threshold/queueSize/testSize/gate). Flag-OFF: byte-identical (no review settings shown, as today).
        Fixture: the C5 visual (render parity) — no new data logic beyond A3's writers.
        → DONE: ClassDetail.jsx read card — `{REVIEW_V2_CLIENT && (<>…Review: {…}% · Q{…} · T{…}[· gate off]</>)}`
          right after the "Test Options" span. Flag-OFF renders nothing ⇒ byte-identical. Data hydrated in
          loadAssignedLists (reviewPassThreshold/reviewQueueSize/reviewTestSize/reviewGateEnabled). C5 visual owed.

## GROUP C — FIXTURES + MUTANTS
[x] C1  Flag-OFF byte-identity of the WRITERS: flag-off, `assignListToClass` + `updateAssignmentSettings`
        produce the SAME `assignments[listId]` shape as HEAD (new keys ABSENT, min/max PRESENT). Test via
        the cleanest seam (a pure extraction of the assignment-object construction, or the emulator — the
        implementer picks, as streakAuthority did; `db.js` cannot load under plain node).
        → SEAM = PURE (reviewSettingsAuthority.js) + STATIC source anchors + the REAL imported flag value.
          C1 proves: REVIEW_V2_CLIENT === false; the new keys live ONLY inside the flag-gated branches
          (assignListToClass ternary, updateAssignmentSettings `if`); min/max write+validation NOT removed
          (E1); the two assemblers NEVER emit min/max; the callers keep the flag-off write identical
          (handleSaveSettings swap, AssignListModal undefined 10th arg). Evidence: 42/0.
[x] C2  Flag-ON write: the new fields are written with validated values + visible defaults; min/max omitted.
        → assignReviewSettings({}) = {reviewPassThreshold:92,reviewQueueSize:60,reviewTestSize:30,
          reviewGateEnabled:true}, never min/max; valid values written verbatim; patchReviewSettings sparse.
          reviewPassThreshold default 92 asserted DISTINCT from 95. Evidence: pure 42/0.
[x] C3  Validation, one fixture (valid + invalid) PER field: reviewPassThreshold ∉ [1,100] → rejected/clamped
        · reviewQueueSize/reviewTestSize ∉ [1,500] → rejected/clamped · reviewGateEnabled coerced boolean ·
        reviewTestType ∉ {mcq,typed} → default mcq. Match the SERVER contract (V4).
        → validateReviewField per field: ints REJECT (0/101/92.5, 0/501) + boundaries (1/100, 500) valid;
          gate coerces ('yes'/1 ⇒ false); type defaults ('dsf'/'' ⇒ mcq). Evidence: pure 42/0.
[x] C4  One MUTANT per validation clause (e.g. widen a range, or drop the enum guard) ⇒ the matching invalid
        fixture goes RED. Restore clean.
        → 6 mutants on reviewSettingsAuthority.js (threshold-upper, size-upper, lower-bound, integer-check,
          gate-coerce, type-enum) — 6/6 KILLED, restore clean, no residue. Evidence:
          df2-11-teacher-review-settings-mutants.json (pass:true).
[~] C5  **VISUAL CHECK (WinClaude order, 25WT):** flag-OFF, BOTH modals render UNCHANGED (the min/max block
        exactly as today) AND both still LOAD/SAVE. The new group is flag-ON only (dead until the flip).
        Batched with the pending dashboard-streak-authority-visual.
        → NOT THIS IMPLEMENTER (WSL cannot run vite). Orchestrator dispatches the WinClaude order. Flag-OFF
          RENDER parity is the one thing it must prove; the flag-OFF JSX branch is today's block verbatim.

## GROUP D — TRUTH REPAIRS
[x] D1  Any doc that says DF2-11 "DELETES the dead reviewTestSizeMin/Max" must read "FLAG-SCOPES the
        min/max→new-group swap; the PHYSICAL deletion rides the flip release (DF2-02a, one release)."
        Check `02_TASK_LIST.md:92,109` + `13_ROUND5_PANEL_RECORD.md:249-251` (the F2-15 tension) and repair
        at source if they assert an immediate delete.
        → DONE (orchestrator, out of the implementer's file set): `02_TASK_LIST.md:109` DF2-11 card corrected
          — the "DELETE the dead reviewTestSizeMin/Max fields" clause now reads "FLAG-SCOPE the min/max→
          new-group swap (…stay flag-OFF byte-identical; PHYSICAL delete rides DF2-02a's flip release — one
          release)". DF2-02a card (`:92`) ALREADY said "same modal, one release" (correct — left as is);
          13_'s F2-15 RAISED this exact tension ("defer the size-field UI to DF2-14 / ship it at the redesign
          launch") — the flag-scope-and-expose-at-flip approach IS that resolution (left as the historical
          record). Verified: grep of `02_TASK_LIST.md` no longer asserts an immediate delete for DF2-11.

## GROUP E — CARDED, NOT THIS ROUND
[~] E1  **Physical deletion of `reviewTestSizeMin/Max`** (UI blocks + writer validation + the dead
        `sessionTimeCalculator.js` util) — rides the flip release with DF2-02a ("same modal, one release").
        Flag-off still uses them, so deleting now breaks byte-identity.
[~] E2  **`assignment.testSizeReview` ghost-read** (`testConfig.js:31`, MCQ/Typed/DSF) — separate never-written
        field, DF2-46 post-flip cleanup. The engine already reads the server's `reviewTestSize`.
[~] E3  **Force-pass UI + the exact-attempt resolver** — DF2-14 (no server resolver exists today, scout §6).
[~] E4  **The flip DEPLOY ORDERING** (client `REVIEW_V2_CLIENT` rebuild vs server `system_config.enabled`
        write) so no dead-lever window opens — DF2-14 choreography, not this fold.

## CLOSE
[x] every non-carded row ticked (file:line + fixture) — V1-V5, A1-A4, C1-C4, D1 all [x] with file:line above;
    C5 [~] (WinClaude visual), E1-E4 [~] (carded).
    [x] evidence re-run after last edit — clean fixture run is the LAST evidence write (post-dates all edits).
    [x] shas re-stamped — the fixture recomputes sourceShas at run time; all MATCH the tree (verified).
[x] numbers re-derived — 42/0 (pure) + 6/6 (mutants) read from the evidence JSONs, never hand-typed.
    [x] change log row — written by the orchestrator 2026-08-04 (from the implementer's proposed text, verified).
    [x] gate.mjs (explicit ledger path; foreign reds enumerated) — --plan ACCEPTED + final: the fold's OWN checks
    GREEN (LEDGER all ticked · FREEZE · MUTANT · BATON · WATCHER · LOG); reds are FOREIGN (engine-lap-result +
    audit/deepfix/task3 + 17_DEPLOY — not this fold's artifacts; engine-lap re-runs at deploy).   [x] commit (orchestrator).
[~] **VISUAL CHECK** — WinClaude order (C5), batched with dashboard-streak-authority-visual. 25WT.
[x] concurrent session shares the repo — staged EXPLICITLY (9 footprint + D1 + change-log + queue; NOT .claude/settings, per the auditor's hygiene note).   [x] implementer (OPUS — live surface) PAIRED with an independent OPUS auditor — GO verdict (level-4: re-ran 42/0 + 6/6; all 6 flag-off surfaces byte-identical; validator mirrors config.js; reviewGateEnabled default-TRUE confirmed on every path).
