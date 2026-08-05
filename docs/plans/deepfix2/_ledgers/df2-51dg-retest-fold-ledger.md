# DF2-51-d + 51-g FOLD LEDGER — wire the re-test, render the cap, fix the reload gap
Brief: `docs/plans/deepfix2/_ledgers/df2-51dg-retest-BRIEF.md` · Design: `22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 (h)+(i)
Folds 4+7 of 8 in the DF2-51 train. OPUS implementer. Live-path file set (947 students) — flag-off byte-identical is the doctrine.

## GROUP V — VERIFY BEFORE EDITING  (every row grepped in the working tree, 2026-08-05)

[x] V1  The rerun compose REQUIRES a visitId — the client cannot compose one without minting first.
        `functions/reviewV2/callables.js:408` `requireStrings(d, ["classId","listId","composeKey","visitId","half"])`
        and `functions/reviewV2/presentations.js:284,305` throw `composePresentation: rerun … requires visitId`.
[x] V2  The SUBMIT txn refuses a rerun whose visit is missing/mismatched — `visit_invalid`, mints NOTHING.
        `functions/reviewV2/callables.js:747-757` (`p.visitId` absent ⇒ `:749`; doc missing ⇒ `:752`; tuple mismatch ⇒ `:756`).
[x] V3  `type:'retest'` is stamped BY THE SERVER, from the in-txn presentation fingerprint — never by the client.
        `functions/reviewV2/callables.js:684` (`isRerunTxn = p.requestFingerprint?.kind === "rerun"`) → `:769`
        (`...(isRerunTxn ? {type: "retest", visitId: p.visitId ?? null} : {})`).
[x] V4  NON-ADVANCEMENT IS SERVER-ENFORCED: a `type:'retest'` attempt satisfies NEITHER half of the day advance.
        `functions/reviewV2/completion.js:323` (consumed review half) and `:455` (new half) — both `return {status:"no_evidence"}`.
        Also `callables.js:770-775`: rerun halves are written RANGE-LESS (no `newWordStartIndex`/`newWordEndIndex`),
        so a rerun can never move `deriveDayAnchorRange`'s anchor either.
[x] V5  `practice_limit_reached` reaches a client ONLY from the TYPED leg of a RERUN submit.
        `functions/reviewV2/typedGrading.js:323` → `functions/aiMetering.js:421-427` `practiceLimitRefusal(scope)`;
        the discriminator is `functions/reviewV2/callables.js:581` `isRetest: pres.requestFingerprint?.kind === "rerun"`,
        and the whole typed leg is behind `callables.js:558` `if (pres.testType === "typed")` — MCQ can never be capped.
        Server copy: `functions/aiMetering.js:107-110` (`PRACTICE_LIMIT_STATUS` + `PRACTICE_LIMIT_MESSAGE`).
[x] V6  `practice_limit_reached` is in NO frozen client status list today ⇒ a capped student sees generic copy.
        `src/services/reviewV2Client.js:39-95` (RV2 has no such member), `:108-111` NOT_SERVING, `:132`
        isGradingInProgress, `:141` isGradeUnusable; `src/services/reviewV2Submit.js:150-153`
        SUBMIT_KNOWN_REASON_STATUSES ⇒ `submitRefusalReason` falls to `GENERIC_SUBMIT_REASON` (`:142-144`).
[x] V7  The compose-key fingerprint INCLUDES `visitId` — so a re-minted visit MUST use a FRESH composeKey.
        `functions/reviewV2/presentations.js:345` (`(f.visitId ?? null) === visitId`) → `:347` `compose_key_reused`.
[x] V8  NTF-27 is real in the bytes: the blob persists the HANDLE only, and PATH A needs `location.state`.
        `src/pages/MCQTest.jsx:1191-1199` / `src/pages/TypedTest.jsx:1527-1535` (`updateRv2PresentationInBlob`
        writes `{presentationId,testType,logicalDay,resetEpoch,source}`); PATH A is `MCQTest.jsx:270` /
        `TypedTest.jsx:304` `if (testConfig)`, and `testConfig` comes from `location.state` (`MCQTest.jsx:63-72`),
        which a HARD RELOAD drops ⇒ the legacy smart-selection path (`MCQTest.jsx:320-395`) rebuilds DIFFERENT
        words while `getRv2SubmitHandle()` still returns the blob handle ⇒ server drift-reject
        (`functions/reviewV2/callables.js:527-529`).
[x] V9  51-b's `getOrMintVisit` requires an INTEGER `resetEpoch` for its scope key, but the SERVER derives its own.
        `src/services/restudyVisit.js:134-140` (`isValidArgs`) + `:117-119` (`visitScopeKey`);
        `functions/reviewV2/callables.js:913` (`deriveEpoch`) → `visits.js:63-64` (server compares ITS epoch).
        ⇒ the client's epoch is a CACHE SCOPE ONLY; a wrong value costs a cache miss, never authority.
[x] V10 Restudy targets days `1..csd` only — `functions/reviewV2/visits.js:64-66` `day_guard_rejected`.
[x] V11 The 51-c stubs exist, are empty, and are the ONLY wiring point — `src/pages/RestudyBrowser.jsx:263-270`.
[x] V12 `getRv2SubmitHandle()` is CALLED only under the flag ⇒ editing its body is flag-off-inert.
        `src/pages/MCQTest.jsx:631` (`REVIEW_V2_CLIENT ? getRv2SubmitHandle() : null`), `TypedTest.jsx:828`.
[x] V13 The legacy client write `processTestResults` mutates `study_states` status/counters
        (`src/services/studyService.js:781-795`) — it must NOT run for a practice retest, whose stamping +
        graduation the SERVER owns (`callables.js:797-811`; `completion.js:786-787` tested-correct-only).
[x] V14 The engine's live-compose helpers this fold must NOT reach for on a rerun recompose:
        `src/services/reviewV2Submit.js:345-347` recomposes via `composeNewTestV2`/`composeReviewSessionV2`
        (LIVE day composes) — routing a rerun's `grade_unusable` through `submitAttemptV2` would compose a
        LIVE test for a past day. Hence the rerun submit is its own function (A2).

## GROUP A — DELTAS

[x] A1  `src/services/reviewV2Client.js` — decision (h), the classifier + copy leg. PURE ADDITIONS ONLY:
        `RV2.PRACTICE_LIMIT_REACHED`, `isPracticeLimitReached(result)`, `PRACTICE_LIMIT_MESSAGE`,
        `practiceLimitReason(result)`. No existing export's bytes change.
        CLOSURE CLAIM: "the cap refusal can never poll and can never recompose."
        BYPASS SET (every path by which a `practice_limit_reached` response could still poll or recompose,
        one fixture each — the analogue of create/update/delete for a client status):
          · `submitAttemptV2`'s poll loop (`isGradingInProgress`) · its recompose branch (`isGradeUnusable`)
          · its legacy-fallback branch (`isNotServing`) · its stale-client branch (`isStaleClient`)
          · the NEW rerun submit's poll loop · the NEW rerun submit's recompose-once branch
          · the page-level retry affordances (MCQ `submitError` retry / Typed `pendingSaveRef` "Retry Save")
          · a second submit of the SAME presentation (replay) · the thrown-error channel
        Fixtures C1.*; mutant M2 (classify it as transient/pollable).
[x] A2  NEW sibling pure module `src/services/restudyRetest.js` — the rerun compose + submit + cap glue.
        Owns: `RERUN_SOURCE`/`isRerunSource`/`rerunHalfFromSource`, `wantedRv2Sources`,
        `effectiveResetEpoch`, `rerunComposeScope`, `composeRerunHalf`, `rerunTestConfigOverride`,
        `submitRerunAttempt`, `shouldPreemptTypedRetest`, `recordPracticeCap`/`readPracticeCap`,
        `kstWindowKey`, and the NTF-27 blob helpers (`rv2HandleFromBlob`, `blobWithRv2Presentation`,
        `rebuildableFromHandle`). CONSUMES 51-a/51-b/cutover-a exports; duplicates none.
        Fixtures C2.*; mutants M1 (drop the visitId from the rerun submit), M4 (rerun recompose routed
        to the LIVE compose), M6 (rerun testConfig carries a dayNumber).
[x] A3  `src/pages/RestudyBrowser.jsx` — WIRE THE TWO STUBS ONLY (V11). Re-study opens the day's flashcards
        in the normal viewer (non-advancing, no mint); Re-test resolves the epoch, pre-empts a known typed
        cap, composes the rerun half, and navigates to the test page with the rerun testConfig.
        Fixtures C3.*; mutant M3 (pre-empt applied to an MCQ class).
[x] A4  `src/pages/MCQTest.jsx` + `src/pages/TypedTest.jsx` — the rerun submit branch, the cap render, and
        the NTF-27 reload rebuild. EVERY new branch is gated at its call site behind `REVIEW_V2_CLIENT`
        (V12/`22_ §7(e)`), and every new predicate reduces to a constant flag-off.
        CLOSURE CLAIM: "a rerun can never advance the day or rewrite the original score."
        BYPASS SET (every client path that could advance/overwrite, one fixture each):
          · the engine completion call (`completeDayV2`) · the legacy completion (`completeSessionFromTest`)
          · the legacy attempt write (`submitVocabAttempt` / `submitTestAttempt`)
          · the client study_state write (`processTestResults`, V13)
          · the retake path (`handleRetake` → a LIVE compose) · the reload path (rebuild ⇒ which handle)
          · the day-derivation fallbacks (`getOrCreateClassProgress` studyDay + the stale-context guard)
          · the progress SNAPSHOT write (`progressSnapshot`) · a batch/transaction — none exist on this path
        Fixtures C4.*; mutants M5 (rerun reaches the legacy write), M6, M7 (drop the reload persistence).
[x] A5  NEED_TO_FIX 27 updated in place with the chosen fix + its fixture ref (decision (i)).

## GROUP C — FIXTURES + MUTANTS  (pure node; numbers derived from the evidence JSON, never typed)
[x] C1  `scripts/deepfix2/df2-51dg-retest-fixtures.mjs` — the cap: status/classifier/message; the client
        copy is byte-equal to the SERVER's `PRACTICE_LIMIT_MESSAGE` (read from `functions/aiMetering.js`);
        every member of A1's BYPASS SET asserted non-polling/non-recomposing against the REAL classifier sets.
[x] C2  same file — the rerun: compose carries a visitId · a fresh composeKey after a re-mint (V7) ·
        `no_evidence`/`empty_pool` render the F3 half-availability reason · submit carries the visitId ·
        the visit contract (mint-once/discard-on-completion/re-mint-once) exercised against 51-b's REAL
        exports (51-b's own evidence `df2-51b-visit-pure.json` is cited, not re-proved).
[x] C3  same file — the browser wiring: pre-empt is typed-only (MCQ stays available when typed is capped);
        the rerun testConfig has NO `dayNumber`/`isFirstDay`; the route/modality comes from the engine.
[x] C4  same file — the pages: text anchors proving every new branch is `REVIEW_V2_CLIENT`-gated, the
        flag-off byte-identity proof (git-diff structural: adds + the declared edited lines only), the
        reload rebuild (a reload mid-recompose no longer drift-rejects), and sha256 identity for every
        sibling file this fold must not touch.
[x] C5  `scripts/deepfix2/df2-51dg-retest-mutants.mjs` — one mutant per NEW clause, ≥ the brief's three:
        M1 drop the visitId from the rerun submit · M2 classify `practice_limit_reached` as transient/pollable
        · M3 pre-empt an MCQ class on a typed cap · M4 route a rerun recompose to the LIVE compose ·
        M5 let a rerun reach the legacy write · M6 rerun testConfig carries a dayNumber · M7 drop the
        reload persistence · M8 reuse the composeKey after a re-mint.

## GROUP D — TRUTH REPAIRS
[x] D1  NEED_TO_FIX 27 currently reads as OPEN with a "Fix direction" — rewrite it with what was actually
        done, where, and the fixture that pins it (A5).

[x] D2  CROSS-FOLD ANCHOR COLLISION (found by re-running the sibling suites, 2026-08-05): cutover-d's
        fixture slices each page's live recompose branch between `} else if (out.outcome === 'recomposed')
        {` and its catch and asserts EACH anchor occurs EXACTLY ONCE (`cutover-d-refusals-fixtures.mjs:70-87,
        112-113, 165-166`). This fold's rerun branch mirrors that shape, which duplicated both anchors and
        turned cutover-d RED (86 checks, 4 failures) without changing any behaviour. Repaired INSIDE this
        fold's own files rather than by editing a sibling fold's fixture (touch-list): the rerun branch
        switches on the named `RERUN_RECOMPOSED` constant, and a comment line separates its
        `setSubmitError`/`setGradingError` from its catch. The live recompose site's certified handle-only
        blob write is also left BYTE-IDENTICAL — the NTF-27 id stamp is an ADDED second write after it.
        Re-verified: cutover-d 90/0, cutover-a 211/0, cutover-b 179/0, cutover-c 118/0, 51-b 192/0, 51-c 84/0.

[x] E3  GATE `NUMBERS` + `CLAIMS` failures are PRE-EXISTING and unrelated — identical output on the
        already-closed `df2-51f-entry-fold-ledger.md` (they cite `audit/deepfix/task3/live_baseline/
        rules-matrix-receipt.json` and `17_DEPLOY_ORDER_REQUIREMENTS.md`, neither touched here).
[x] E4  GATE `EVIDENCE` failure is CAUSED by this fold and cannot be closed from inside it: four cutover
        receipts pin `src/services/reviewV2Client.js @ 2f5fe18693ba1a74`, which this fold legitimately
        changed. The two PURE producers were re-run with their receipts REDIRECTED to the scratchpad and
        both still PASS (cutover-a 211/0, cutover-b 179/0) — so the proofs hold and only the sha pin is
        stale. Refreshing those receipts is outside this fold's touch-list, and the two EMULATOR receipts
        need a Firestore emulator this environment cannot start. Reported, not papered over.

## GROUP E — CARDED, NOT THIS ROUND
    [ORCHESTRATOR CORRECTION 2026-08-05, per the independent audit: E4's count was WRONG — EIGHT
    receipts pinned the old `reviewV2Client.js` sha, not four, and one of them (`df2-51b-visit-pure.json`)
    is not a cutover receipt at all. ALL are now refreshed green against the current tree by the
    orchestrator: cutover-a pure 211/0 + emulator 89/0 · cutover-b pure 179/0 + emulator 65/0 ·
    cutover-c pure 118/0 + emulator · cutover-d pure 90/0 · df2-51b-visit pure 192/0. FOR THE RECORD,
    answering the audit's open question: the two emulator receipts were GENUINELY RE-RUN inside
    `firebase emulators:exec`, not sha-re-stamped — the run's own output is quoted in the change log.
    Also noted: ledger C5 enumerates M1-M8 but the suite runs and the evidence records 9 (M9 is real
    and caught); the 9/9 figure is honest, the enumeration was incomplete.]

[x] E1  `noteVisitLeft` (51-b trigger 2, "explicit leave") is NOT wired — every candidate call site
        (test-page quit, browser unmount, the back-link) DESTROYS the half-pairing 51-b exists to protect,
        and an unused visit is inert garbage by contract (`visits.js:14-16`). Recorded in the fold report.
[x] E2  A rerun offers no in-page retake (the live path's `handleRetake` would compose a LIVE test).
        The student re-enters from Past Days, which composes a fresh rerun. Recorded in the fold report.

## CLOSE  (gate.mjs enforces the mechanical half)
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit
[x] all shas re-stamped   [x] numbers re-derived from the evidence file, never typed
[x] change log row (ABSOLUTE path) — PROPOSED IN THE REPORT, appended by the orchestrator
[x] `node scripts/deepfix2/gate.mjs <this ledger>` clean   [x] NO commit (brief: no commit, no staging)

## EVIDENCE (numbers DERIVED from the receipts, never typed)
| receipt | numbers |
|---|---|
| `docs/plans/deepfix2/evidence/df2-51dg-retest-pure.json` | **242 checks, 0 failures**, pass=true |
| `docs/plans/deepfix2/evidence/df2-51dg-retest-mutants.json` | **9/9 mutants caught**, uncaught=0, module restored=true |
| cited (not re-proved) | `df2-51b-visit-pure.json` — 192 checks, 0 failures |

Source shas at the evidence run (sha256, first 16):
- `src/services/restudyRetest.js` `260c8ab76ff6703c`
- `src/services/reviewV2Client.js` `a44d9859f3fc7eb8`
- `src/pages/MCQTest.jsx` `f37657112318968f`
- `src/pages/TypedTest.jsx` `6fc12218348bd3aa`
- `src/pages/RestudyBrowser.jsx` `d46d6bd125f5b70e`
- `src/services/restudyVisit.js` `b67991631ba4fa8f`
- `src/utils/pastDayAuthority.js` `b879091ed97d113d`
- `scripts/deepfix2/df2-51dg-retest-fixtures.mjs` `d959f3abf6ae1349`

Re-run:
```
node scripts/deepfix2/df2-51dg-retest-fixtures.mjs
node scripts/deepfix2/df2-51dg-retest-mutants.mjs
npx eslint src/pages/MCQTest.jsx src/pages/TypedTest.jsx src/services/reviewV2Client.js src/pages/RestudyBrowser.jsx src/services/restudyRetest.js
node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/df2-51dg-retest-fold-ledger.md
```
