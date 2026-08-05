# DF2-51-e FOLD LEDGER — the within-day Review / New-words toggle (FREE-NAV proper)
Brief: `docs/plans/deepfix2/_ledgers/df2-51e-toggle-BRIEF.md` (law) · design
`22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 RATIFIED (d) · shipping target
`mockups/df2-51-extended.html` §3 ("Today's session — Review / New words toggle").
Fold 5 of 8 in the DF2-51 train. Runs in PARALLEL with 51-f (`Dashboard.jsx`) — disjoint
file sets; `Dashboard.jsx` is never touched here.

## GROUP V — VERIFY BEFORE EDITING (facts re-verified in code, 2026-08-05, this session)
[x] V1  THE SERVER ALREADY PERMITS WITHIN-DAY MOVEMENT — neither compose callable requires
        the other phase first (re-verified independently, not just cited from the design doc).
        `functions/reviewV2/callables.js:228-318` (`reviewV2ComposeSession`, the review
        composer): its only preconditions are `resolveAndGate` (:236-240), `deriveEpoch`
        (:242-243), `loadCanonicalWordsStrict` (:244-249) and the day-queue/presentation
        compose (:258-279) — no read/check of any new-word attempt or new-test state anywhere
        in the function body. `functions/reviewV2/callables.js:325-379` (`reviewV2ComposeNewTest`,
        the new-word composer): same `resolveAndGate`/`deriveEpoch`/`loadCanonicalWordsStrict`
        preconditions, plus ONE extra guard — `d.logicalDay !== truth.frontierDay` (:356-358,
        the DAY guard, unrelated to phase order) — no read/check of any review attempt or
        review-completion state anywhere in the function body. Governs: the toggle needs no
        engine-side permission change; F5 in the design doc is independently confirmed, not
        just trusted.
[x] V2  THE ONLY CLIENT-SIDE FORCING MECHANISM IS `determineStartingPhase`, AND IT FIRES ONLY
        AT SESSION INIT/RESUME, NEVER AGAIN DURING AN ACTIVE SESSION — governs "the oracle
        stays single-source and is OUT of my touch-list" (I never call or edit it).
        `src/services/studyService.js:228-329` (`determineStartingPhase`) is called from
        exactly ONE site, `src/services/studyService.js:475`, inside `initializeDailySession`
        — its result is surfaced as `config.startPhase` and consumed ONLY inside
        `DailySessionFlow.jsx`'s init `useEffect` (the `attemptsSayReviewPending` branch,
        `DailySessionFlow.jsx:939-990` pre-edit) to decide where a NEW or RESUMING session
        lands. Nothing in this fold calls `determineStartingPhase`, imports it, or edits
        `studyService.js` — grepped after writing (GROUP C, S-import case).
[x] V3  `sessionConfig.newWordCount`/`sessionConfig.segment` ARE THE STABLE, ONCE-PER-SESSION
        FACTS "does this half exist today" — set exactly once by `initializeDailySession` and
        never recomputed mid-session. `src/services/studyService.js:530` (`newWordCount:
        nwCount`) — may be `0` on a review-only day (throttle/list-end/#9-resume,
        `studyService.js:1390-1398` mirror in foundation.js) or, per `studyService.js:467-470`'s
        own comment, transiently NEGATIVE on legacy over-introduction ("clamp... deferred to
        preserve byte-equivalence"). `src/services/studyService.js:535` (`segment`) stays
        `null` unless `cappedIds && cappedIds.length` (`studyService.js:437-448`) — null on
        Day 1 and, rarely, on a later day whose unmastered-pool slice is empty. Governs: my new
        availability predicates read exactly these two fields, `> 0` / `Boolean(...)`, never the
        fluctuating in-memory queue length (which changes every swipe and is not "no work
        today").
[x] V4  `moveToReviewPhase` ALREADY GUARDS ON THE SAME FACT V3 NAMES — reused verbatim, not
        re-derived. `src/pages/DailySessionFlow.jsx:1209-1214` (pre-edit): `if (!config?.segment)
        { console.warn('moveToReviewPhase: No segment available, skipping review phase'); return }`.
        My new `canOfferReviewPhase` predicate (DailySessionFlow.phaseToggle.js) reads
        `sessionConfig.segment` the SAME way — one fact, never two that could disagree. Governs:
        no parallel source of truth for "does review exist today".
[x] V5  A TEST NEVER RENDERS INSIDE `DailySessionFlow` — it always navigates to a SEPARATE
        route, so "disabled while a test is in flight" (design doc §3(d)) holds STRUCTURALLY,
        with no extra runtime check needed. `PHASES.NEW_WORD_TEST`/`PHASES.REVIEW_TEST`
        (`DailySessionFlow.jsx:88-95`) are declared but grepping every `setPhase(PHASES.` call
        site in the file (19 occurrences, pre-edit) shows NONE targets either — `navigateToTest`
        (`DailySessionFlow.jsx:1421-1559` pre-edit) computes `route = mode === 'typed' ?
        '/typedtest' : '/mcqtest'` (:1491) and calls `navigate(\`${route}/${classId}/${listId}\`,
        ...)` (:1553), leaving the DSF route entirely. Governs: the toggle renders only on
        `PHASES.NEW_WORDS`/`PHASES.REVIEW_STUDY` (the only two phases where `phase` state can
        equal a study phase while the student is looking at this component), so "disabled
        during a test" needs no separate flag.
[x] V6  THE DAY-ADVANCE EVIDENCE GATE IS SERVER-SIDE, UNTOUCHED BY THIS FOLD. `functions/
        foundation.js:1284` (`completeSession` onCall) — F-4 EVIDENCE REQUIREMENT at
        `:1400-1412`: `hasNewAnchor = !!dayNewPass && Number.isInteger(dayNewPass.
        newWordEndIndex)`; `if (!hasNewAnchor && !reviewOnlyDay) { return {status: 'no_evidence',
        ...} }` — a completion with neither a passed day-N new-word anchor nor a server-verified
        review-only reason is REFUSED, `currentStudyDay`/`totalWordsIntroduced` untouched.
        `functions/**` was NOT touched — `git diff --stat -- functions/` is empty (confirmed
        post-edit, in the report). Proof that my new code has no path to it: a source-text
        grep-proof (GROUP C, cases S3/S4 — PASSED) against the REAL post-edit file, confirming
        `moveToNewWordsPhase`/the two click-guard handlers contain none of `completeSession(`,
        `recordSessionCompletion(`, `setDoc(`, `updateDoc(`, `addDoc(`, `deleteDoc(`,
        `httpsCallable(`.
[x] V7  THIS ENVIRONMENT CANNOT PARSE JSX UNDER PLAIN NODE (re-verified independently this
        session, same class of fact as 51-c's own V11 — governs the one sibling pure-module
        file this fold adds, pre-authorized by the brief's own fixture-strategy text:
        "51-c hit this and put its pure logic in a sibling .js module. Follow that precedent if
        you need it, and say so"). This session: `ls node_modules/@esbuild/` → only `win32-x64`
        (no `@esbuild/linux-x64`); `find node_modules/@babel -maxdepth 1 -type d` lists
        `plugin-transform-react-jsx-self`/`-jsx-source` (Fast-Refresh dev helpers) only — no
        `plugin-transform-react-jsx` or `preset-react` anywhere under `node_modules/@babel`;
        `node -e "process.platform"` → `linux` this session (win32 binaries only, unusable).
        `DailySessionFlow.jsx` therefore cannot be `import`ed by plain node AT ALL. The brief's
        own required fixture cases ("a half with no work is not offerable"; "toggling changes
        only the phase, never progress/day") are only satisfiable by REAL execution (not just
        source-text grep) if that logic lives in a plain `.js` file — hence
        `src/pages/DailySessionFlow.phaseToggle.js` (NEW), mirroring `RestudyBrowser.viewModel.js` one
        layer lower (a single page's own extracted pure logic, not a shared multi-consumer
        utility — same placement precedent, `src/pages/`, not `src/utils/`).
[x] V8  `TabButton` IS AN EXISTING PRIMITIVE WITH EXACTLY THE active/disabled SHAPE NEEDED —
        reused rather than inventing a new segmented-pill control from raw
        Tailwind (governs "Design tokens only... reuse existing `src/components/ui/`
        components"). `src/components/ui/buttons/TabButton.jsx:1-45`: doc comment "Tab
        switching button (e.g., Lists/Students/Gradebook tabs)"; props `active`/`disabled`/
        `...props` (spreads `title`/`onClick` onto the native `<button>`); style tokens only
        (`border-brand-primary`, `text-brand-text`, `text-text-secondary`) — no raw Tailwind
        color. Already shipped and used: `src/pages/ClassDetail.jsx:791-799` (`<TabButton
        active={activeTab === 'lists'} onClick={...}>`). The design doc's C2 audit ("no
        toggle/switch primitive exists", `22_:112`) audited for a PILL/segmented-background
        control specifically and did not catalog `TabButton`'s underline-tab shape for this use
        — recorded as a named judgment call in the report, not a contradiction of the audit (it
        is still true no PILL exists).
[x] V9  `REVIEW_V2_CLIENT` IS STILL `false` TODAY. `src/config/featureFlags.js:243`: `export
        const REVIEW_V2_CLIENT = false;`. Re-confirmed via a LIVE import in the fixture script
        (case S2, PASSED) — not just a hand-read. Governs: flag-off byte-identical
        claim; this fold will never open `featureFlags.js` for write (not in touch-list).
[x] V10 ZERO NAMING COLLISIONS for every new identifier this fold introduces. Grepped
        `src/pages/DailySessionFlow.jsx` BEFORE editing for `moveToNewWordsPhase`,
        `canGoToReviewPhase`, `canGoToNewWordsPhase`, `activeTogglePhase`,
        `handleSelectReviewPhase`, `handleSelectNewWordsPhase`, `PhaseToggle`,
        `canOfferReviewPhase`, `canOfferNewWordsPhase`, `shouldRunPhaseToggle`,
        `PHASE_TOGGLE_COPY`, `TabButton` — zero matches (grep exit 1) for all. Governs: every
        GROUP A addition is a genuinely NEW identifier, not a silent shadow/collision.

## GROUP A — DELTAS (LANDED — verified against the live tree, GROUP C proves it)
[x] A1  `src/pages/DailySessionFlow.jsx:30` imports — added `TabButton` to the existing
        `src/components/ui` import (V8) and, at `:86-89`, imported the four new pure exports
        from the new sibling module (V7). Not a closure/guard row (an additive import) — no
        BYPASS SET applies. Fixture: case S6 (grep-proof both import lines exist exactly once
        — PASSED, `df2-51e-toggle-pure.json`).
[x] A2  `src/pages/DailySessionFlow.jsx:1241-1267` — NEW function `moveToNewWordsPhase`, the
        symmetric Review→New-words partner of the EXISTING, UNMODIFIED `moveToReviewPhase`
        (V4). Guards on `canOfferNewWordsPhase(sessionConfig)` (single-sourced, V3/V10),
        resets the SHARED flashcard cursor (`currentIndex`/`isFlipped`, mirroring
        `moveToReviewPhase`'s own reset — the two phases share one cursor), and flips `phase`.
        Calls ONLY `setCurrentIndex`/`setIsFlipped`/`setPhase` — never a completion/write call
        (V6). Not a closure/guard row in the security-BYPASS-SET sense (no pre-existing guard
        is being narrowed; this is new additive logic) — no BYPASS SET applies. Fixture: case
        S3 (grep-proof body contains no mutation call — PASSED) + mutant M2 (adds one — KILLED,
        `df2-51e-toggle-mutants.json`).
[x] A3  `src/pages/DailySessionFlow.jsx:2050-2070` — availability booleans
        (`canGoToReviewPhase`, `canGoToNewWordsPhase`, `activeTogglePhase`) and
        click-selection handlers (`handleSelectReviewPhase`, `handleSelectNewWordsPhase`), all
        single-sourced from the new pure module (V7) — computed once, consumed by both the
        disabled reason and the selection handler (brief: "reflect what is actually
        available... disable with a reason"). NOT a data-mutation closure row — this is a UI
        selection no-op (which phase to switch to), never a create/update/delete/security
        boundary, so the BYPASS SET (create/update/delete/set-merge/overwrite/
        delete-then-recreate/batch/transaction) does not apply; see A5 for this fold's one
        real closure row (the flag-off render gate). Each handler no-ops when unavailable OR
        when the target phase is already active (judgment call — prevents a redundant tap
        from silently discarding this-visit review-dismiss progress via `moveToReviewPhase`'s
        unconditional rebuild; documented in the report). Fixture: pure-module cases C1-C3
        (PASSED) + mutants M3-M6 (4/4 KILLED).
[x] A4  `src/pages/DailySessionFlow.jsx:2678-2720` — NEW component `PhaseToggle`, additive,
        placed beside `StudyPhase`/`RetakePrompt`/`CompletePhase` (existing file convention of
        local sibling components). Renders two `TabButton`s (V8) — Review / New words, in the
        wireframe's order — each `disabled` + `title`-with-reason when unavailable (mirrors
        `RestudyBrowser.jsx:130-131`'s pattern, the brief's own named 51-c precedent), plus the
        on-screen rule copy (`PHASE_TOGGLE_COPY.rule`, single-sourced with the fixture, "in the
        app's own voice" per the brief). `StudyPhase` itself received ZERO new props and stays
        byte-unchanged (`git diff` shows no hunk inside `StudyPhase`'s own body — confirmed in
        the report). Not a closure/guard row — no BYPASS SET applies. Fixture: case S7 (copy is
        actually wired into render — PASSED) + pure-module C4 (copy shape — PASSED).
[x] A5  `src/pages/DailySessionFlow.jsx:2233-2241` — render call site: `{REVIEW_V2_CLIENT &&
        (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (<PhaseToggle .../>)}`,
        inserted directly above the existing `{phase === PHASES.NEW_WORDS && (<StudyPhase
        .../>)}` block, inside the same content `<div>`. THIS IS THE CLOSURE ROW — it is the
        flag gate that makes flag-off byte-identical (decision (e), non-negotiable).
        BYPASS SET (mandatory for this closure claim): this is a RENDER gate, not a
        create/update/delete/set-merge/... data-mutation guard, so the data-mutation bypass
        set does not apply; the closure's own "other legs" are (i) `REVIEW_V2_CLIENT` forced
        true (would make the toggle render — proves the `&&` is load-bearing, not dead code)
        and (ii) the phase disjunct dropped for EITHER `NEW_WORDS` or `REVIEW_STUDY`
        individually (proves the toggle actually appears on BOTH study screens, not just one)
        — each its own fixture case + mutant (M1, M7 — both KILLED). OTHER LEG: the flag-ON,
        phase-condition-true render path itself is exercised by case S1/S2 (the anchor text +
        the live `REVIEW_V2_CLIENT===false` import — both PASSED).
[x] A6  NEW FILE `src/pages/DailySessionFlow.phaseToggle.js` — pure predicate + copy module
        (V7). Exports `canOfferReviewPhase`, `canOfferNewWordsPhase`, `shouldRunPhaseToggle`,
        `PHASE_TOGGLE_COPY`. Zero imports (mirrors `pastDayAuthority.js`/
        `RestudyBrowser.viewModel.js`'s own convention, confirmed by case C5). This is the ONE
        file outside the brief's literal "DailySessionFlow.jsx only" build-target line —
        justified by V7 and the brief's own fixture-strategy text; flagged here, in GROUP A,
        and in the report per the brief's explicit "say so". Not a closure/guard row — no
        BYPASS SET applies. Fixture: pure-module cases C1-C5 (full execution, not just grep —
        PASSED) + mutants M3-M6 (4/4 KILLED).

## GROUP C — FIXTURES + MUTANTS
[x] C1  Pure fixtures, `scripts/deepfix2/df2-51e-toggle-fixtures.mjs` — plain node, no
        emulator, no network, no browser, no build. RESULT (from
        `docs/plans/deepfix2/evidence/df2-51e-toggle-pure.json`, re-run AFTER the mutant
        restore): 71 checks, 0 failures, `pass:true`. Cases: C1
        `canOfferReviewPhase` (segment object → true; null/undefined/missing/non-object-falsy →
        false) · C2 `canOfferNewWordsPhase` (positive → true; 0 → false; negative → false
        [studyService.js over-introduction edge]; missing/null sessionConfig → false) · C3
        `shouldRunPhaseToggle` (available+different-phase → true; unavailable → false
        regardless of phase; available+same-phase → false; defensive default input) · C4
        `PHASE_TOGGLE_COPY` (frozen, non-empty distinct strings, rule contains the
        "order"/"tomorrow unlocks" substance) · C5 GREP-PROOF the pure module itself has zero
        imports/requires (mirrors `pastDayAuthority.js`'s own C8) · S1 the REAL
        `DailySessionFlow.jsx` render-gate anchor `REVIEW_V2_CLIENT && (phase ===
        PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) &&` immediately precedes
        `<PhaseToggle`, exactly once · S2 a LIVE import of the real `REVIEW_V2_CLIENT` is
        `false` today · S3 `moveToNewWordsPhase`'s REAL function body (balanced-brace
        extracted) matches none of `completeSession(|recordSessionCompletion(|setDoc(|
        updateDoc(|addDoc(|deleteDoc(|httpsCallable(` and DOES match
        `setPhase(PHASES.NEW_WORDS)` · S4 `handleSelectReviewPhase`/`handleSelectNewWordsPhase`
        bodies each call only their one expected mover and match none of the same banned-call
        list · S5 `moveToReviewPhase`'s REAL function body is BYTE-IDENTICAL to its pre-edit
        text (captured verbatim THIS session, before any edit — see V4's citation) — proves
        reuse, zero modification · S6 both new import lines each appear exactly once · S7
        `PHASE_TOGGLE_COPY.rule`/`.reviewUnavailable`/`.newWordsUnavailable` are each referenced
        inside `PhaseToggle`'s JSX (wired into render, not dead code) · S8 the toggle's
        `disabled`/`title` wiring references the SAME `canGoToReviewPhase`/
        `canGoToNewWordsPhase` booleans the click-guard consumes (single source, grep-proof) ·
        S9 `functions/foundation.js` still carries the F-4 evidence-gate anchor text cited in
        V6, binding that citation to real bytes, read-only (no import, no execution).
[x] C2  Mutants, `scripts/deepfix2/df2-51e-toggle-mutants.mjs` — one per new clause, 7 total,
        covering the brief's 2 named minimums plus 5 of this fold's own clauses. RESULT (from
        `docs/plans/deepfix2/evidence/df2-51e-toggle-mutants.json`): 7/7 killed, `pass:true`,
        every `restoredOk:true`; `grep -c "\[MUTANT" src/pages/DailySessionFlow.jsx
        src/pages/DailySessionFlow.phaseToggle.js` = 0/0 after the run (no residue).
          M1  FLAG-OFF GATE REMOVED (brief's 1st named minimum) — real in-place mutation of
              the REAL `DailySessionFlow.jsx` render-gate text (strips the `REVIEW_V2_CLIENT &&
              ` prefix), re-runs the S1 anchor check, requires RED, restores, sha-verifies.
              (DailySessionFlow.jsx is this fold's OWN, fully-owned build target — unlike
              51-c's M1 against shared `App.jsx`, no simulation is needed; stronger evidence
              than that precedent.)
          M2  A TOGGLE THAT ADVANCES/SUBMITS (brief's 2nd named minimum) — real in-place
              mutation adds a `completeSession()` call inside `moveToNewWordsPhase`'s body;
              re-runs S3, requires RED, restores, sha-verifies.
          M3  REVIEW AVAILABILITY IGNORED — `canOfferReviewPhase` in
              `DailySessionFlow.phaseToggle.js` always returns `true` — kills pure case C1.
          M4  NEW-WORDS AVAILABILITY IGNORED — `canOfferNewWordsPhase` always returns `true` —
              kills pure case C2.
          M5  CLICK-GUARD AVAILABILITY CHECK DROPPED — `shouldRunPhaseToggle` no longer returns
              `false` when `available` is false — kills pure case C3.
          M6  CLICK-GUARD ALREADY-ACTIVE CHECK DROPPED — `shouldRunPhaseToggle` no longer
              returns `false` when `targetPhase === activePhase` — kills pure case C3.
          M7  TOGGLE OFFERED ON ONLY ONE STUDY PHASE — real in-place mutation drops the
              `phase === PHASES.REVIEW_STUDY` disjunct from the render gate; re-runs S1,
              requires RED, restores, sha-verifies.
        M3-M6 mutate the REAL, SOLELY-OWNED `src/pages/DailySessionFlow.phaseToggle.js` in
        place (`[MUTANT ...]`-marked), require the REAL pure-fixture suite to exit non-zero,
        restore immediately, sha-verify the restore. M1/M2/M7 mutate the REAL
        `src/pages/DailySessionFlow.jsx` in place, require the relevant structural fixture
        case(s) to go red, restore immediately, sha-verify.
[x] C3  ESLINT SYNTAX GATE — `npx eslint src/pages/DailySessionFlow.jsx
        src/pages/DailySessionFlow.phaseToggle.js`: exit 1, 12 problems (3 errors, 9 warnings)
        — ALL pre-existing (HEAD, linted via `git show HEAD:src/pages/DailySessionFlow.jsx |
        npx eslint --stdin --stdin-filename src/pages/DailySessionFlow.jsx`, also exits 1 with
        the SAME 12 problems, same rule ids, same messages, only shifted by the constant
        line-insertion offset at each point — verified line-by-line in the report). DELTA:
        12 findings -> 12 findings, ZERO added. `DailySessionFlow.phaseToggle.js` alone: exit
        0, zero findings (new file, no HEAD predecessor to diff).

## GROUP D — TRUTH REPAIRS
[x] D1  None found. Grepped `moveToNewWordsPhase`, `PhaseToggle`, `phaseToggle`,
        "within-day toggle", `DF2-51-e`/`df2-51e` across `docs/*.md`, `NEED_TO_FIX.md`,
        `change_action_log.md`, `change_action_log_ap.md` BEFORE writing. ONE hit:
        `change_action_log.md:1560` — David's 2026-08-05 scope ruling ("df2-51 scope = CORE +
        EXTRAS — ... past-day browser + within-day toggle + ..."), which is the SCOPE DECISION
        this fold implements, not a claim the toggle already exists — no truth repair needed.

## GROUP E — CARDED, NOT THIS ROUND (so nothing is silently dropped)
[x] E1  THE WINCLAUDE VISUAL CHECK IS NOT THIS FOLD'S — `22_DF2-51_PASTDAY_NAV_DESIGN.md:253`
        assigns "one batched WinClaude visual order across the whole train" to 51-h, run LAST.
        WSL cannot run vite (brief's own constraint) — no build, no dev server attempted here.
        Recorded so a green fixture/mutant run is never mistaken for a browser check.
[x] E2  DECISIONS (h) TYPED-RETEST CAP RENDERING AND (i) NTF-27 RELOAD PERSISTENCE ARE 51-d'S
        (`22_:249`, "Owns: MCQTest.jsx, TypedTest.jsx, reviewV2Client.js") — this fold's toggle
        never touches either surface; recorded so they are not silently assumed covered here.
[x] E3  THE "SHOWN ONLY WHEN THE OTHER PHASE... IS INCOMPLETE" TEXT FROM THE DESIGN DRAFT'S
        §3(d) OPTION DESCRIPTION IS NOT IMPLEMENTED — the brief's own enumerated Build
        requirements (law for this fold) do not restate it, naming only the "no dead
        destination" (no-work) disable condition. Both buttons stay enabled+clickable even
        after their test is already passed, so a student can freely revisit either half's
        flashcards (consistent with "free-nav" and "the toggle changes the order, never the
        requirement"). If the orchestrator intends the narrower already-visited/complete gating
        too, that is a follow-up, not silently assumed here.
[x] E4  THE CLOSING `gate.mjs` RUN'S EVIDENCE-STALENESS GATE (GATE 3b) FAILS FOR REASONS
        OUTSIDE THIS FOLD'S TOUCH-LIST — diagnosed precisely, not fixed here, not silently
        hidden. `gate.mjs`'s EVIDENCE check scans EVERY file under
        `docs/plans/deepfix2/evidence/*.json` repo-wide (not scoped to the ledger path
        argument, which only scopes GATE 1/LEDGER) and flags any `sourceShas` entry whose
        pinned sha no longer matches the live tree. It flags THREE such receipts, each
        independently root-caused THIS session, none inside my touch-list:
        (i) `cutover-c-complete-pure.json` certifies `src/pages/DailySessionFlow.jsx @
        7ac6b92f5324c18f` — EXACTLY HEAD's sha (`git show HEAD:src/pages/DailySessionFlow.jsx
        | sha256sum` = `7ac6b92f5324c18f...`, confirmed) — so this evidence was FRESH before my
        edit and is now stale BECAUSE of my (brief-mandated, in-touch-list) edit to the one
        file this fold owns. `cutover-c-complete-fixtures.mjs`/its evidence belong to a
        DIFFERENT, already-landed fold (cutover-c) — re-running it is outside this fold's
        authorization (not named in the brief's touch-list) and I have not verified whether its
        assumptions still hold, so I do not silently re-run it.
        (ii) `dashboard-df2-33-pure.json` and (iii) `dashboard-streak-authority-pure.json`
        certify `src/pages/Dashboard.jsx @ b756400f26501f69` — also EXACTLY HEAD's sha,
        confirmed the same way — now stale because the PARALLEL 51-f session is actively
        editing `Dashboard.jsx` (156 insertions/1 deletion mid-session, confirmed via
        `git diff --stat -- src/pages/Dashboard.jsx`) — a file this brief explicitly forbids me
        from touching and I have not touched (`git diff --stat -- src/pages/Dashboard.jsx`
        shows zero lines attributable to any edit of mine).
        NEITHER staleness is inside this fold's touch-list to repair; both are cross-fold
        reconciliation, the orchestrator's job per CLAUDE.md's operating model. This fold's OWN
        evidence (`df2-51e-toggle-pure.json`/`df2-51e-toggle-mutants.json`) is internally
        sha-consistent with the CURRENT tree (re-verified in the report). The gate's separate
        FREEZE/NUMBERS/CLAIMS findings (all against `audit/deepfix/task3/live_baseline/*` and
        `17_DEPLOY_ORDER_REQUIREMENTS.md`) are unrelated to df2-51e entirely — no file either
        gate cites was read, touched, or is in this fold's scope.

## CLOSE
[x] every row ticked with file:line + fixture ref — V1-V10, A1-A6, C1-C3, D1, E1-E4 all [x] above.
[x] evidence re-run AFTER the last edit — the pure suite's FINAL run (71/0) happened AFTER the
    mutants script restored both `DailySessionFlow.jsx` and `DailySessionFlow.phaseToggle.js`,
    confirming the tree the evidence certifies is the tree left on disk (mirrors 51-a/51-c's own
    discipline). Neither file was touched again after that run.
[x] all shas re-stamped — `docs/plans/deepfix2/evidence/df2-51e-toggle-pure.json`'s
    `sourceShas` and `docs/plans/deepfix2/evidence/df2-51e-toggle-mutants.json`'s
    `targetShas16` were both produced by the LAST run (after the mutant restore) and are
    IDENTICAL (`435e8225c8605e74` / `dec10ce37015a58b`) — both evidence files certify the same
    final tree state, re-verified independently in the report.
[x] numbers re-derived from the evidence file, never typed — 71/0 and 7/7 in this ledger and
    the report are copy-pasted from the two evidence JSONs' own `total`/`failed`/`mutants`
    fields; the eslint 12/12 delta is copy-pasted from the two actual eslint runs' own output.
[x] change log row (ABSOLUTE path) — proposed row TEXT given in the report; NOT written to
    `/app/change_action_log.md` by this fold (hard constraint: the orchestrator appends it)
[x] `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/df2-51e-toggle-fold-ledger.md`
    — run, both `--plan` (ACCEPTED, 0 failures) and the closing run; verbatim output in the
    report. NOT globally clean: GATE 1 (LEDGER, the row scoped to THIS ledger) is clean, but
    the closing run also scans repo-wide state and surfaces GATE 3b (EVIDENCE) + pre-existing
    FREEZE/NUMBERS/CLAIMS findings that are outside this fold's touch-list — diagnosed and
    root-caused precisely at E4, not silently claimed clean, not fixed outside scope.
[~] commit — CARDED, not this session: hard constraint forbids `git add`/`git commit` for an
    implementer sub-agent; committing (if the orchestrator chooses to) is its job, not this
    fold's
