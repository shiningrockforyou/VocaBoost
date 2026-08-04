# CUTOVER-C COMPLETE — FOLD LEDGER (route day completion through completeDay, flag-gated)

Built from the cutover-c scout report (2026-08-04, file:line throughout) + the completeDay contract, read
in full — not a notification. Behind `REVIEW_V2_CLIENT` (still false): the day's completion — CSD/TWI
advance, graduation, streak — moves from the client (`completeSessionFromTest` / `updateClassProgress` /
`graduateSegmentWords`) to the engine's `completeDay` callable. The client stops computing the advance,
the graduation, and the streak; it sends the engine the attempt IDS and consumes the result.

**SCOPE LINE (E1):** this fold routes the TEST-DRIVEN completion only (`completeSessionFromTest`, called
from `MCQTest.jsx:976` + `TypedTest.jsx:1268`). The EMPTY-REVIEW / no-test auto-complete (`completeSession`
in `DailySessionFlow.jsx:~1727`, the all-mastered day) has NO attempt evidence, so `completeDay` returns
`no_evidence` — it CANNOT route through the engine and STAYS LEGACY (E1). This fold stops at the
test-driven day-completion, exactly as cutover-b carved all of completion out of ITS fold.

## GROUP V — VERIFY BEFORE EDITING (a guard is "inert" only if no live writer exists)

[x] V1  **What the client computes at completion today, and where each field is server-derived under the
        engine** (scout §2). CSD/TWI: client `updateClassProgress` (`progressService.js:563-639`, writes
        `class_progress/{classId}_{listId}`) ⇐ `completeDay` partial `txn.update` (`completion.js:711-731`)
        writes the SAME doc. Graduation: client `graduateSegmentWords` (`studyService.js:1519-1578`, RANDOM
        pick, writes `study_states.status=MASTERED`+`returnAt`) ⇐ engine `computeGraduation`
        (`completion.js:131-178`, DETERMINISTIC queue-order, writes `study_states.reviewRestingUntil` only —
        and the composer reads only `reviewRestingUntil`, `composer.js:20-26`, so flag-on compose+complete
        agree). Streak: client `calculateUpdatedStreak` (`progressService.js:500-549`, overwrites
        `class_progress.streakDays`) ⇐ engine `streak_credits/{kstDate}` idempotent ledger
        (`completion.js:743-750`). Day-2+ evidence gate: client query (`studyService.js:1874-1930`) ⇐
        engine in-txn verification (`completion.js:310-524`). ⇒ every value the client computes is
        server-derived under the engine; the fold sends IDs, not computed values.

[x] V2  **THE ATTEMPT-ID SLOT MAPPING — VERIFIED, matches the ledger's assumption.** Confirmed in code
        (completion.js :316-343 consumed/classId-bound, :444-483 newTest/not classId-bound; callables.js
        :753-757 `attempt.classId = p.classId`, the compose-time classId, i.e. `classIdParam` — same value
        threaded through DailySessionFlow.jsx:548/1117 → MCQTest/TypedTest). At the call site: `kind =
        rv2Handle.source === 'composeNewTest' ? 'new' : 'review'` (mirrors MCQTest.jsx:749's OWN submit-leg
        derivation); `kind==='review'` fills `consumedAttemptId=result.id`/`consumedAttemptClassId=
        classIdParam`; `kind==='new'` fills `newTestAttemptId=result.id`, consumed stays null·null (a
        new-word completion never has a prior review this day — Day 1 has no review pool, and Day 2+ 'new'
        submissions never reach completion per `isSessionFinalTest`). THE OTHER slot on a new-word day
        completing via review: resolved BEFORE the `completeDayV2` call (not after, unlike legacy) via
        `getNewWordAttemptForDay` (already imported at both pages) — same query legacy uses internally,
        proven to find REAL engine attempts too (same `attempts` collection, same field shape). Pure mapper:
        `rv2CompletionAttemptIds` (`src/services/reviewV2Complete.js`). Fixtures: pure
        `cutover-c-complete-fixtures.mjs` CASE "V2/MAPPING" (7 checks) + emulator
        `cutover-c-complete-emulator.mjs` CASE CC-NEWDAY (real engine ids, V2 slot-mapping assertion at
        :262-263). Call sites: `MCQTest.jsx:996-1017`, `TypedTest.jsx` (analogous, ~7 lines later).

[x] V3  **THE INVERSION — `already_completed` is a terminal SUCCESS, not today's `dayGuardRejected` error**
        (scout §4). Today a duplicate/late completion is a client-computed `expectedDay` mismatch
        (`progressService.js:571-581`, `dayGuardRejected` — ERROR-shaped; caller rebuilds session state at
        `studyService.js:1988-1996`). Under the engine, `already_completed` is a SERVER-arbitrated race
        outcome, SUCCESS-shaped, "re-run NOTHING" (`completion.js:19-23`) — the SAME shape cutover-b
        established for `attempt_written{replayed:true}` (`reviewV2Submit.js:299-311`). ⇒ A2 maps
        `already_completed` onto the day-DONE success path, NEVER onto `dayGuardRejected`; conflating them
        masks a real race or treats a normal idempotent replay as an error.

[x] V4  **The completeDay status census.** Terminal: `completed` · `already_completed`. Refusals as DATA
        (from `resolveAndGate` + `deriveEpoch` + `loadCanonicalWordsStrict` + `completeDay`): `no_evidence` ·
        `day_guard_rejected` · `reset_in_progress` · `reset_epoch_mismatch` · `queue_invalid` ·
        `presentation_invalid` · `list_words_malformed` · legacy-fallback `config_hold`/`review_v2_dark` +
        the thrown trio (`class_not_found`/`not_enrolled`/`list_not_assigned`, via `classifyThrownRefusal`).
        VERIFY the exact set `reviewV2CompleteDay` reaches (`callables.js:847-887` + `completion.js`) — a
        census grepping only the callable MISSES statuses that pass through from the gate/epoch/word-load
        helpers (the same trap NTF-21 hit). Handle EVERY one, following cutover-b's routing.

[x] V6  **Flag-off parity is a DESIGN obligation.** `REVIEW_V2_CLIENT=false` ⇒ `completeSessionFromTest` /
        `completeSession` / `updateClassProgress` / `graduateSegmentWords` / `recordReviewOutcome`
        BYTE-IDENTICAL. New branches gated at the call sites (`MCQTest:976`, `TypedTest:1268`) only; no
        shared helper mutated in place. C2 proves it (static byte-level, like cutover-a/b).

## GROUP A — DELTAS
[x] A1  Route the TEST-DRIVEN completion through `completeDay` behind the flag: at the
        `completeSessionFromTest` call sites, when the rv2 handle is active, call
        `completeDay({classId, listId, logicalDay, consumedAttemptId, consumedAttemptClassId,
        newTestAttemptId})` with the V2 ids, instead of the legacy completion; the server advances/
        graduates/streaks and the client stops computing them.
        BYPASS SET (one fixture each): first completion (create) · duplicate/concurrent completion
        (`already_completed`, re-run nothing) · completion after a reset (epoch moved ⇒
        `reset_epoch_mismatch`/`reset_in_progress`, refuse) · consumed attempt of the WRONG class (classId
        mismatch ⇒ refuse, `completion.js:329`) · a new-word day (BOTH consumed+newTest ids) vs a
        review-only day (consumed only) · the no-evidence case (E1 — assert it STAYS legacy, never reaches
        completeDay) · a third party's attempt id · a teacher-driven completion.
        OTHER LEG: flag-off, the legacy completion (`completeSessionFromTest` + `updateClassProgress` +
        `graduateSegmentWords` + `recordReviewOutcome`) byte-identical.
        CLOSED: `src/services/reviewV2Complete.js` (new adapter) + `MCQTest.jsx:996-1017` (else branch
        :1043-1100 is the untouched legacy call) + `TypedTest.jsx` analogous. Gated on `rv2Handle &&
        !rv2Fallback` (rv2Fallback hoisted out of the submit try so the completion site can read it —
        MCQTest.jsx:734-742, TypedTest.jsx:1008-1017 — a pure scope change, flag-off no-op since rv2Handle
        is always null). All 8 bypass-set items covered 1:1 by emulator CASEs (cutover-c-complete-emulator.mjs):
        CC-CREATE(create) · CC-DUP+CC-CONCURRENT(duplicate/concurrent) · CC-RESET(after a reset) ·
        CC-WRONGCLASS(wrong class) · CC-NEWDAY vs CC-REVIEWONLY(new-word vs review-only) · E1 CARVE in the
        pure fixture + CC-NOEVIDENCE(no-evidence) · CC-THIRDPARTY · CC-TEACHER. Evidence:
        docs/plans/deepfix2/evidence/cutover-c-complete-{pure,emulator,mutants}.json.

[x] A2  Handle `already_completed` as a TERMINAL SUCCESS (day done, re-run nothing) — the V3 inversion,
        NOT `dayGuardRejected`. Translate the `completeDay` success payload
        (`graduationCount`/`newTwi`/`advancedToDay`/`streakCredited`) onto what the UI consumes
        (`SessionSummaryCard.jsx:23`; the legacy `{sessionId, progress, graduated}` return shape,
        `studyService.js:2026-2030`).
        BYPASS SET: two tabs completing the same day (winner `completed`, loser `already_completed`, BOTH
        land on the day-done UI) · a reload after completion (re-call ⇒ `already_completed`, no double
        advance) · a loser that must NOT re-graduate / re-streak / re-advance.
        CLOSED: `translateCompletedOutcome` (`reviewV2Complete.js`) normalizes `completed`/`already_completed`
        into ONE envelope; `already_completed`'s payload derives from `.completion` (completedTwi/logicalDay/
        graduationCount) when the fresh-winner top-level fields are absent. TRACED (not just asserted):
        `SessionSummaryCard.jsx:23`'s `summary.progress` is actually populated by DailySessionFlow.jsx
        re-reading `class_progress` FRESH (`getClassProgress`, DailySessionFlow.jsx:1646/1688) after
        navigating back, NOT from this return value — completeDay's txn writes the SAME doc
        (`durableProgressRef` = `users/{uid}/class_progress/{classId}_{listId}`, foundation.js:283/292,
        matching MCQTest.jsx:952-953's own path construction) so that fresh read already reflects the
        completion; this translation is still built to the A2 spec for shape parity + any future direct
        consumer (documented as a traced-but-not-load-bearing finding). BYPASS SET: CC-CONCURRENT (two tabs,
        both land on outcome:'completed') · CC-DUP (reload/re-call ⇒ already_completed, class_progress
        BYTE-UNCHANGED incl. updatedAt) · CC-DUP's structural argument (the CAS early-return, completion.js
        :265-299, skips graduation/streak/advance ENTIRELY for a loser — not just numerically idempotent)
        + M-C4-DROP-CAS mutant proving that early-return is load-bearing. C5 mutant
        (M-C5-INVERT-ALREADY-COMPLETED) pins the V3 inversion itself.
        FIXTURES: C3 (idempotency) + C5 (the inversion mutant).

## GROUP C — FIXTURES + MUTANTS
[x] C1  One case per A1 bypass row. `scripts/deepfix2/cutover-c-complete-emulator.mjs` — 8/8 bypass items,
        see A1's CLOSED note for the row→CASE mapping. 40 checks, 0 failures
        (docs/plans/deepfix2/evidence/cutover-c-complete-emulator.json).
[x] C2  FLAG-OFF PARITY — the legacy completion path byte-identical (both modalities).
        `cutover-c-complete-fixtures.mjs` CASEs "C2/MCQ"/"C2/TYPED"/"C2/FLAGS" — line-by-line anchors against
        the REAL MCQTest.jsx/TypedTest.jsx bytes (the legacy `completeSessionFromTest` call + its exact
        argument block + all 3 status checks survive verbatim inside the new `else`) + `git diff --stat`
        confirms ZERO bytes changed in the 5 named functions' files (studyService.js/progressService.js) —
        verified empty diff, not merely "I didn't touch it."
[x] C3  `already_completed` idempotency: winner completes; loser re-runs NOTHING (no double advance/
        graduate/streak). CC-DUP (emulator): `already_completed`, `replayed:true`, class_progress
        BYTE-UNCHANGED (currentStudyDay/totalWordsIntroduced/updatedAt), streak_credits count unchanged,
        completion-record count unchanged. C4 MUTANT: make the loser re-run the advance ⇒ C3 goes red.
        M-C4-DROP-CAS (completion.js `doneSnap.exists` early-return disabled + `txn.create`→`txn.set`) —
        KILLED, 4 red checks (replayed flips to false, updatedAt moves).
[x] C5  MUTANT: map `already_completed` onto the error/`dayGuardRejected` path ⇒ a fixture asserting it is
        a SUCCESS goes red (pins the V3 inversion). M-C5-INVERT-ALREADY-COMPLETED
        (`reviewV2Complete.js`'s completed-status check narrowed to drop `ALREADY_COMPLETED`) — KILLED,
        7 red checks. docs/plans/deepfix2/evidence/cutover-c-complete-mutants.json: 2/2 mutants killed,
        restore clean, zero `[MUTANT` residue (grepped post-run).
[x] C6  Fixtures at the page/call-site boundary (`MCQTest:976`, `TypedTest:1268`), not only the adapter —
        cutover-a's audit showed defects hide when no fixture touches the pages. `rv2CompletionAttemptIds`
        (the extracted pure boundary builder, "V2/MAPPING" CASE) + CASEs "C6/CALL-SITE — MCQTest.jsx" /
        "C6/CALL-SITE — TypedTest.jsx": anchors on the ACTUAL kind-derivation, getNewWordAttemptForDay call
        shape, rv2CompletionAttemptIds/completeDayV2 call shapes, and the 3-way outcome branch, at both real
        call sites (no jsdom/react-testing-library in this repo — verified via package.json grep — so
        static anchors are the SAME idiom cutover-a/b already established for page coverage, not a shortfall).

## GROUP D — TRUTH REPAIRS
[ ] D1  Anything claiming the client advances / graduates / streaks the day (studyService / progressService
        comments; 10_/18_). Correct at source.
        NOT CLOSED — searched and found no unambiguous target: grepped studyService.js/progressService.js
        for "client advances/graduates/streaks/computes" (and variants) and grepped
        docs/plans/deepfix2/10_REVIEW_GRADUATION_REDESIGN.md + 18_TYPED_LEG_DESIGN.md for the same —
        zero matches in either. The function-level doc comments found (e.g. `graduateSegmentWords`'s
        header, studyService.js:1507-1518) describe what THAT function does when called — true whenever it
        runs (flag-off, or an engine-not-serving fallback) — not a false "the client is the only/permanent
        authority" claim. TENSION WITH V6: V6 is a settled fact requiring
        completeSessionFromTest/completeSession/updateClassProgress/graduateSegmentWords/recordReviewOutcome
        BYTE-IDENTICAL — even a comment-only edit inside those 5 functions would violate it, so I did not
        speculatively edit bytes there to satisfy an under-specified D1 pointer. Needs either a corrected
        file:line from whoever wrote this row, or an explicit V6 carve-out for comment-only edits.

## GROUP E — CARDED, NOT THIS ROUND
[x] E1  **The empty-review / no-test auto-complete (`completeSession`, `DailySessionFlow.jsx:~1727`) STAYS
        LEGACY** — no attempt evidence ⇒ `completeDay` returns `no_evidence`. Routing it needs its own
        design (an evidence-less completeDay variant, or a permanent legacy carve). Card it; this fold stops
        at the test-driven completion.
        ASSERTED (not routed — DailySessionFlow.jsx untouched, confirmed by empty `git diff`):
        `cutover-c-complete-fixtures.mjs` CASE "E1 CARVE" — DailySessionFlow.jsx never imports
        `reviewV2Complete.js`, never calls `completeDayV2`, and its legacy
        `recordSessionCompletion(user.uid, summary)` call survives verbatim.
[ ] E2  **DASHBOARD STALE-STREAK — sharpens NTF-25, belongs to `dashboard-streak-authority`.** `completeDay`'s
        partial update touches only 5 fields (`completion.js:715-723`) and NEVER `class_progress.streakDays`.
        So once cutover-c wins completions, `streakDays` FREEZES at its pre-flip value (nothing writes it on
        engine-owned days), and the Dashboard prefers it (`Dashboard.jsx:1399`). A direct consequence of THIS
        fold landing (flag-on). Record the freezing explicitly on `dashboard-streak-authority` (queued
        `after:cutover-c`) so it is not discovered cold.
        NOT CLOSED (out of THIS brief's file scope) — the brief scopes me to
        `src/pages/{MCQTest,TypedTest}.jsx` + a new `src/services/reviewV2Complete.js` + this ledger +
        `scripts/deepfix2/cutover-c-complete-*`; it does not name or attach a `dashboard-streak-authority`
        ledger, and "touch only the files your brief names" forbids finding and editing an unfamiliar
        tracker outside that list (risk of stomping a concurrent stream's own ledger). The finding above is
        independently RE-VERIFIED true in this session (completion.js:715-723 lists exactly 5 fields,
        `streakDays` absent) — relaying it to whoever owns `dashboard-streak-authority` is an orchestrator
        action, not mine.

## CLOSE
[ ] every row ticked with file:line + fixture ref   [ ] evidence re-run AFTER the last edit
[ ] shas re-stamped   [ ] numbers re-derived from evidence   [ ] change log row (ABSOLUTE path)
[ ] `node scripts/deepfix2/gate.mjs <this ledger path>` clean   [ ] commit
[ ] **VISUAL CHECK** — a WinClaude order (flag-OFF completion-path parity; typed submission authorized ≤200
    on 25WT). Seed/select a 25WT account that can complete a day.
[ ] a concurrent session shares this repo — stage explicitly, never `git add -A`
[ ] delegated implementer PAIRED with an independent auditor told not to trust its self-report
