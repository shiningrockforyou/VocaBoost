# DF2-51-a FOLD LEDGER — the past-day model (pure derivation, no UI, no I/O)
Brief: `docs/plans/deepfix2/_ledgers/df2-51a-model-BRIEF.md` (law) · design `22_DF2-51_PASTDAY_NAV_DESIGN.md`
§7 RATIFIED + findings F2/F3/F4 · shipping target `mockups/df2-51-extended.html`.
Fold 1 of 8 in the DF2-51 train. Runs in PARALLEL with 51-b (`src/services/restudyVisit.js`, disjoint file
set, NOT touched here). Ships NO user-visible change and is NOT flag-gated — nothing calls this module yet.

## GROUP V — VERIFY BEFORE EDITING (facts re-verified in code, 2026-08-05; line numbers as of this session)
[x] V1  SAME-VISIT PAIRING IS THE ENGINE'S OWN INVARIANT (F4's basis). `functions/reviewV2/visits.js`
        `recordRerunHalfInTxn` (:92-130): a passing rerun half sets ONE field on ONE visit doc, set-once
        (:108-110); `completed:true` flips ONLY when BOTH `newHalfAttemptId`/`reviewHalfAttemptId` are
        non-null on the SAME doc, in the SAME txn (:112-117) — the file header states it explicitly
        (:13-14): "Cross-visit pairing is impossible by construction." My model's `summarizeDayVisits`
        must not defeat this client-side via an OR-aggregate across different visits (PIP-CANON in the
        module header) — this is the fixture/mutant this row exists to protect (case F4-CROSS-VISIT, M1).
[x] V2  THE REVIEW HALF IS DAY-AGNOSTIC (F2 — `pips.review` is never `'na'`).
        `functions/reviewV2/callables.js` `reviewV2ComposeRerun`, review branch (:434-446): "Pool = the
        FULL currently-introduced range, sliced INSIDE the claim txn"; `logicalDay` is an identity tag
        only (design doc F2, `22_:200-204`). Confirmed: nothing in that branch reads the visited day's own
        anchor at all.
[x] V3  THE NEW HALF NEEDS THE DAY'S OWN PASSED ANCHOR; ABSENT ⇒ REFUSAL (F3 — the `'na'` pip's basis).
        `callables.js` rerun-new branch (:447-458): `foundation.deriveDayAnchorRange(uid, listId,
        visitedDay)`; no anchor ⇒ `{status:"no_evidence"}` (:452-454); empty slice ⇒ `{status:"empty_pool"}`
        (:458). `functions/foundation.js#deriveDayAnchorRange` (:996-1007) delegates to `getDayNewPass`
        (:819-839), whose OWN definition of "day has a new half" is: a `sessionType==="new"`,
        `studyDay===dayNumber` attempt with `passed===true` (:824,:831) exists. My model's `hasNewHalf`
        (`bestOriginalPass(dayAttempts,'new') !== null`) is the SAME predicate, computed over the injected
        `attempts` instead of a live query — verified byte-identical in spirit (passed-only filter, same
        two fields consulted).
[x] V4  THE RETEST STAMP + THE NON-ADVANCING GUARDS (why `originalAttemptsForDay` excludes `type:"retest"`).
        `callables.js:769`: `...(isRerunTxn ? {type: "retest", visitId: p.visitId ?? null} : {})` — a
        rerun's `studyDay` is STILL the visited day (`logicalDay: d.visitedDay`, :439/:461), so a rerun
        attempt for day N carries the SAME `studyDay`/`sessionType` shape as an ORIGINAL day-N attempt and
        would corrupt `studiedAt`/`testedAt`/`hasNewHalf` if not excluded. `functions/reviewV2/
        completion.js:323` (`consumed.type === "retest"` ⇒ `no_evidence`) and `:455`
        (`newTest.type === "retest"` ⇒ `no_evidence`) confirm the engine ITSELF treats a retest as never
        equivalent to an original completion — my exclusion mirrors that law rather than inventing a new
        one. Fixtured as case C-RETEST-NOT-ORIGINAL, mutant M5.
[x] V5  THE BOOKMARK IS A SCALAR, NOT A PER-DAY MAP (governs `bookmarkedDayForList`'s shape + the
        `derivePastDays({bookmarks})` parameter semantics). `15_H6_SCHEMAS_AND_CONTRACTS.md:196`: "restudy
        bookmark | field on `users/{uid}`: `restudyBookmarks.{classId}_{listId} = day`" — AT MOST one
        bookmarked day per (classId,listId); "never server authority" (owner-writable UI pref). Confirmed
        also at `22_:326`: "belt-and-braces client rule: a bookmark beyond the frontier is ignored" — my
        `derivePastDays` loop only ever emits rows `1..currentStudyDay`, so a bookmark beyond that range
        can never match any row's `day` — the ignore-rule holds by construction, no extra code needed
        (fixtured as case BOOKMARK-BEYOND-RANGE, confirming the citation rather than assuming it).
[x] V6  EPOCH CLEANUP IS ASYNC/BEST-EFFORT, NOT A READ-TIME GUARANTEE — why this module trusts its inputs
        and takes no `resetEpoch` parameter (the brief's prescribed `derivePastDays` signature has none).
        `functions/reviewV2/reset.js:24`: "deletes are STALE-ONLY (`resetEpoch < targetEpoch`)"; `:54-55`
        lists `restudy_visits`/`restudy_completions` as cleanup targets. This is a sweep, not a
        transactional invariant at the moment a client reads — so epoch-correctness of the injected
        `attempts`/`visits` is the CALLER's job. Documented in the module header, not silently assumed.
[x] V7  THE MIRRORED CONVENTIONS (header style, DI idiom, zero imports) — `src/utils/streakAuthority.js`
        (header :1-47: "PURE — zero imports, zero Firestore, zero `../firebase.js`"; `deriveAccountStreak`
        takes `now` injected, :116) and `src/utils/dayStatusAuthority.js` (header :14-19: "ZERO Firestore
        verbs and ZERO imports"; `phaseOracle` injected, :51-62; `attemptsForList`/`csdForRow` as small
        per-caller extraction helpers, :76-106) — both re-read in full this session. My module matches:
        zero imports (grep-proof below), every input injected, small named extraction helpers
        (`bookmarkedDayForList` mirrors `attemptsForList`'s role), a documented enum
        (`DAY_STATES`/`PIP_STATES` mirror the `RV2` frozen-object idiom in `src/services/
        reviewV2Client.js:39-95`).
[x] V8  `practice_limit_reached` IS NOT IN ANY FROZEN CLIENT STATUS LIST TODAY (confirms decision (h)'s
        "carded", and confirms my `canRetestTyped` must not import/re-declare the server's exact string).
        `src/services/reviewV2Client.js`'s `RV2` object (:39-95) has no `PRACTICE_LIMIT_REACHED` member;
        grep for `practice_limit_reached` under `src/` returns zero matches (2026-08-05, this session).
        `functions/aiMetering.js#practiceLimitRefusal` (:421-427) returns only `{status, scope, message}`
        — no window key — so `canRetestTyped`'s `metering.windowKey` must be CALLER-STAMPED, not
        server-supplied; documented in the module header and that function's own doc comment.

## GROUP A — DELTAS
[x] A1  NEW PURE MODULE `src/utils/pastDayAuthority.js` — zero imports, zero Firestore/React/firebase.
        Exports: `DAY_STATES`, `PIP_STATES` (frozen enums) · `isLiveAttempt`, `originalAttemptsForDay`,
        `bestOriginalPass` (attempts-side, the day's ORIGINAL completion evidence) · `visitsForDay`,
        `summarizeDayVisits` (visits-side, PIP-CANON) · `bookmarkedDayForList` (H6 scalar extraction) ·
        `deriveDayState` (the ONE five-way state derivation, brief item 2) · `derivePips` (brief item 3) ·
        `deriveDayRow`, `derivePastDays` (brief item 1's exact prescribed signature
        `{currentStudyDay, attempts, visits, bookmarks}`), `deriveTodayRow` (the non-actionable today row,
        kept deliberately separate — see the module's own doc comment for why) · `canRetestTyped` (brief
        item 4, presentation-only predicate). This is not a closure/guard row (nothing is being denied or
        protected; it is a brand-new pure derivation with no prior guard to bypass) — no BYPASS SET applies;
        the GROUP C fixture list below is this row's completeness proof instead.
        NOT DONE differently from the brief: nothing — the signature, the five states, the pip rule, and
        the predicate all match the brief's items 1-4 as specified (shape choices documented inline and in
        the report: pip/row shapes, `bookmarks` semantics, canonical-visit PIP-CANON, `type:"retest"`
        exclusion, earliest-pass tiebreak, `canRetestTyped`'s snapshot shape).

## GROUP C — FIXTURES + MUTANTS
[x] C1  Pure fixtures, `scripts/deepfix2/df2-51a-model-fixtures.mjs` — plain node, no emulator, no network.
        RESULT (from `docs/plans/deepfix2/evidence/df2-51a-model-pure.json`): 115 checks, 0 failures,
        `pass:true`.
        Cases (brief-required + judgment-call coverage): both-halves/one-visit → re-completed + full pips ·
        no-new-half → dashed pip, never "incomplete" (state can still reach `tested`) · bookmark precedence
        (chip flips, pips do not) · untouched day (original attempts present, zero visits) · re-completed
        via one visit (explicit) · CROSS-VISIT MUST NOT PAIR (F4 — two visits, each one different half,
        neither completed ⇒ state `tested`, pips NOT both `on`) · a genuine completed visit wins over a
        newer empty "practice" visit (recency does not override real completion) · today excluded from
        `derivePastDays`, `deriveTodayRow` shape separately · empty/missing/undefined inputs at every
        entry point degrade to `[]`/safe defaults, never throw · a later passing RERUN must not masquerade
        as the original completion (studiedAt/testedAt/hasNewHalf stay anchored to the live attempt) ·
        Day-1 asymmetry (no review phase ⇒ `testedAt` null, state/pips unaffected) · `canRetest` stays true
        even when `canRestudy` is false · bookmark beyond `currentStudyDay` is ignored (V5) ·
        `bookmarkedDayForList` edge cases (missing map, class/list mismatch, non-integer/negative/zero
        stored value) · multiple passes for one (day,sessionType) resolve to the EARLIEST · `canRetestTyped`:
        no metering info ⇒ true; refused same window ⇒ false; refused STALE window ⇒ true (rollover);
        refused with no window info either side ⇒ conservative false · enum shape (`DAY_STATES`/
        `PIP_STATES` frozen, exact literal values) · GREP-PROOF: zero import/require statements and no
        case-insensitive `firebase`/`firestore`/`react` substring in the module's CODE with comments
        stripped first (the false-positive class `dashboard-df2-33-fixtures.mjs`'s header warns about).
[x] C2  Mutants, `scripts/deepfix2/df2-51a-model-mutants.mjs` — in-place `[MUTANT]`-marked edits to the
        REAL module, each restored + sha-verified after. Six, covering the brief's 3 named clauses plus 3
        of my own judgment-call clauses:
          M1  cross-visit pairing (PIP-CANON → OR-aggregate) — kills F4-CROSS-VISIT (pips)
          M2  today-exclusion inverted (`day <= csd` → `day <= csd + 1`, phantom row) — kills TODAY-EXCLUDED
          M3  no-new-half special case dropped (`'na'` branch removed) — kills F3-DASHED-PIP
          M4  bookmark precedence dropped (state checks tier before bookmark) — kills BOOKMARK-PRECEDENCE
          M5  `type:"retest"` exclusion dropped (`isLiveAttempt` always true) — kills C-RETEST-NOT-ORIGINAL
          M6  `canRetestTyped` window-rollover dropped (always trusts a stale refusal) — kills the STALE-
              WINDOW-ROLLS-OVER case
        Each must turn ≥1 fixture red (exit non-zero) and the source file must restore byte-identical.
        RESULT (from `docs/plans/deepfix2/evidence/df2-51a-model-mutants.json`): 6/6 killed, `pass:true`,
        every `restoredOk:true`, no `[MUTANT` residue left in the tree (checked after the run).

## GROUP D — TRUTH REPAIRS
[x] D1  None found. First-time build of a not-yet-consumed module; no prior published sentence in
        NEED_TO_FIX.md / change_action_log.md / the design doc describes this module's current state
        incorrectly (grepped `pastDayAuthority` across `docs/` and root `*.md` before writing — zero
        pre-existing mentions to correct).

## GROUP E — CARDED, NOT THIS ROUND
[x] E1  The engine's OWN day-completion helpers are not uniformly rerun-safe. `functions/foundation.js
        #dayReviewExists` (:842-857) checks ANY review attempt for `(uid,listId,studyDay)` with no
        `type!=="retest"` filter and no `passed` filter — looser than my client-side `originalAttemptsForDay`
        + `bestOriginalPass`. Not a wireframe contradiction and not something this brief authorizes touching
        (`functions/**` is frozen for this feature, design doc §5) — reported as an observation for whoever
        next touches that helper, not fixed here.
[x] E2  `canRetestTyped`'s metering snapshot shape (`{refused, scope, windowKey}`) is invented by this fold
        (brief: "shape yours") and is NOT wired to any real caller yet — 51-d (retest launch + cap
        rendering) is the fold that will populate it from `reviewV2Client.js`'s classifiers per decision
        (h). Recorded here so 51-d's implementer knows the shape exists and where the header documents it,
        rather than inventing a second one.

## CLOSE
[x] every row ticked with file:line + fixture ref — V1-V8, A1, C1-C2, D1, E1-E2 all [x] above.
[x] evidence re-run AFTER the last edit — the pure suite's FINAL run (115/0) happened AFTER the mutants
    script restored the module, confirming the tree the evidence certifies is the tree left on disk (not a
    stale in-progress or mutated copy).
[x] all shas re-stamped — both evidence JSONs' `sourceShas`/`targetSha16` (`b879091ed97d113d`) match
    `sha256sum src/utils/pastDayAuthority.js`'s own prefix, re-verified independently in the report.
[x] numbers re-derived from the evidence file, never typed — 115/0 and 6/6 in this ledger and the report
    are copy-pasted from the two evidence JSONs' own `total`/`failed`/`mutants` fields, not hand-typed.
[x] change log row (ABSOLUTE path) — proposed row TEXT given in the report; NOT written to
    `/app/change_action_log.md` by this fold (hard constraint: the orchestrator appends it).
[x] `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/df2-51a-model-fold-ledger.md` — run AFTER
    this CLOSE section was finalized; verbatim output in the report (both `--plan` and the closing run).
[~] commit — CARDED, not this session: hard constraint forbids `git add`/`git commit` for an implementer
    sub-agent; committing (if the orchestrator chooses to) is its job, not this fold's.
[x] VISUAL CHECK — N/A, stated plainly rather than claimed: this fold ships no user-visible change and
    nothing calls the module yet (brief's own constraints section); there is no render to check. The
    WinClaude visual order belongs to 51-h (batched, end of the whole DF2-51 train, design doc §"FOLD
    SPLIT" item 8).
[x] footprint — touched ONLY: `src/utils/pastDayAuthority.js` (new), `scripts/deepfix2/df2-51a-model-
    fixtures.mjs` (new), `scripts/deepfix2/df2-51a-model-mutants.mjs` (new),
    `docs/plans/deepfix2/evidence/df2-51a-model-pure.json` (new),
    `docs/plans/deepfix2/evidence/df2-51a-model-mutants.json` (new), this ledger (new). Nothing staged;
    `src/services/restudyVisit.js` (the parallel 51-b agent's file) never opened for write.
