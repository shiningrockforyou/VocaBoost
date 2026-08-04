# CUTOVER-A COMPOSE — FOLD LEDGER, **ACTIVE** (renamed from -PLAN at the first edit, as promised)

> Renamed to `-fold-ledger` now that work has begun, so `gate.mjs` enforces every row again.
> **ID NOTE:** this is NOT DF2-51. DF2-51 is the past-day browser + phase toggle — genuinely new nav
> UI. This fold re-wires EXISTING screens and adds none. I had borrowed that id; corrected 2026-08-04.

**THE HIGHEST-RISK FOLD IN THE UI BUILD: it changes what the student is shown.** Everything else in the
cutover changes who computes a result; this changes the words on the screen. If it is wrong, a student
studies the wrong set and the error is invisible until graduation is already wrong.

## GROUP V — VERIFY BEFORE EDITING (all of these are load-bearing; none is a formality)

[x] V1  **ANSWERED 2026-08-04, BEFORE ANY EDIT — and the answer reframes this whole fold.**
        **NO. They are DIFFERENT ALGORITHMS OVER DIFFERENT POOLS.**
          CLIENT (`src/utils/studyAlgorithm.js:277` `selectReviewQueue`): PRIORITY BANDS over a
          *segment* — today's new FAILED first, then segment FAILED oldest-queued-first, then further
          bands; MASTERED filtered as a backstop. The pool is a SLICE of the list.
          SERVER (`functions/reviewV2/composer.js` `sweepQueue`): a CURSOR-CHAINED ROTATION over the
          *entire introduced range* — non-resting words traversed strictly after the stored cursor,
          wrapping, taking `queueSize`, then topped up from resting words if short.
        **CONSEQUENCES, and they are the fold:**
        1. This is NOT "move the same computation to the server". It REPLACES the selection algorithm.
           **The words a student reviews WILL change at the flip — by design.** That is DF2-14's intent
           (the rotation replaces the slicer; DF2-01 records that BlindSpots was the accidental safety
           net for the slicer's starvation, retired because the rotation fixes it at the root).
        2. **NO fixture may assert "server set == client set".** They are not supposed to match. The
           server set is certified against the ROTATION LAW instead — `rotation-cyclicity-fixture.mjs`
           already proves lap coverage at 2,688/0. Writing an equality fixture here would encode the
           OLD algorithm as the oracle and fail forever, or worse, be "fixed" by bending the server.
        3. **The review SEGMENT concept disappears.** The client config carries `reviewSegmentSize`
           (studyService.js:531) and the segment drives review selection today; the engine has no
           review-segment notion at all. Any UI reading segment semantics for REVIEW must be re-pointed,
           not merely re-sourced. (`newWordStartIndex`/`newWordEndIndex` remain meaningful for NEW words.)
        4. The ONLY parity control available is FLAG-OFF parity (C2) — with `REVIEW_V2_CLIENT=false`
           nothing changes for the 947 live students. There is deliberately NO flag-on parity.

[x] V2  **ANSWERED — and it raises an ORDERING question that must be settled before editing.**
        CLIENT: passes `todaysNewFailed` EXPLICITLY into `buildReviewQueue` (studyService.js:1230, used
        at :1257) — words that failed TODAY's new-word test are pushed to the front of the review queue
        as Priority 1 (studyAlgorithm.js:289-290).
        SERVER: has **NO such input**. It derives priority from PERSISTED LABELS —
        `needsPriority = failCount>0 ∧ (lastCorrect null ∨ lastFailed>lastCorrect)`
        (presentations.js header §1). Different mechanism, same intent.
        **THE OPEN QUESTION — RESOLVE BEFORE ANY EDIT:** the day QUEUE is composed once per logical day
        (`queueDocId = {classId}_{listId}_d{day}_e{epoch}`). If it is composed at SESSION START — i.e.
        BEFORE the new-word test is taken and its fail labels are stamped — then a word failed in
        TODAY's new-word test is NOT in the labels yet, and would NOT be prioritised, whereas today it
        IS (the client passes it explicitly). That would be a **silent behavioural regression the
        rotation law does not cover**: the queue would still be a valid rotation, just missing today's
        failures. Stamping law says every graded test stamps, so the fix may simply be ordering — but
        **RESOLVED 2026-08-04 — it IS ordering, and the ordering is OURS to choose in this fold.**
        `presentations.js:400-404` does NOT create the queue: it `txn.get`s it and THROWS
        `live-review claim without queue` if absent. The day queue is created by `composeDayQueue` on
        the FIRST `composeSession` of the logical day and is then PINNED (the docId is day-scoped, so a
        second call REPLAYS rather than recomposes — recomposing later cannot rescue a late failure).
        ⇒ Whether today's new-word failures get prioritised depends ENTIRELY on WHEN the CLIENT first
        calls `composeSession`. That is a decision in this fold and nowhere else.

        **DECISION (delegator): compose the review session LAZILY, at REVIEW-PHASE ENTRY — never at
        session start.** By then the new-word test has been submitted and its fail/correct labels are
        stamped, so `needsPriority` sees today's failures and the server reproduces the behaviour the
        client gets today by passing `todaysNewFailed` explicitly.
        WHY NOT at session start: the queue would pin BEFORE today's failures exist, and because it is
        day-pinned there is no later repair. The student simply would not be re-tested on the words they
        had just got wrong — and the queue would still be a VALID rotation, so no assertion about
        rotation, coverage or starvation would ever flag it.
        UI COST, and it is small: the composition cannot supply review counts before the review phase.
        It does not need to — `testSizeReview`/`reviewQueueSize` are teacher-set config the client
        already holds, so any up-front count renders from config; only the ACTUAL presented set waits.
        FIXTURE (C7), BOTH legs: compose at review entry AFTER a failed new-word test ⇒ the failed word
        IS served. And the negative — compose at session start ⇒ it is ABSENT. The decision is worthless
        unless the bad ordering is DEMONSTRATED to lose the word, not merely described.

        **>>> EXECUTOR ADDENDUM 2026-08-04 (finding, not a redo): V2's MECHANISM needs one more
        ingredient the row does not name — a mid-day twi ADVANCE. <<<**
        As built, the review universe is positions < twi and twi moves ONLY at day completion
        (`functions/reviewV2/progress.js:20-23` — "STABLE all day … review-first composes identically
        before/after the day's new test"), and stamping writes only PRESENTED words
        (`stamping.js:92-93` COMPLETE-ROWS). So a word introduced TODAY (position ≥ twi) can NEVER be
        in today's day queue — under EITHER compose ordering — unless twi advances past it mid-day.
        The advance that makes C7's positive leg real EXISTS in the live client: the entry-time anchor
        reconciliation ("twi = newWordEndIndex + 1", LIST_SCOPED_RECON, getOrCreateClassProgress) runs
        on re-entry/resume after the day's new test. The C7 fixture therefore models the advance
        EXPLICITLY (a durable-progress write between the new-test submit and review entry) and both
        legs then behave exactly as this row demands: lazy compose serves the stamped word via
        needsPriority into a size-3 test; session-start compose pins the queue without it, replay AND
        fresh-key at review entry both fail to repair it, and the pinned queue still passes the
        rotation-law check (the silent-regression proof, asserted). Without any twi advance the word
        is served TOMORROW (with priority) under either ordering — the lazy decision still dominates
        (it serves the resume case; eager loses it in all cases) and NOTHING in this fold changes.
        Evidence: cutover-a-compose-emulator.mjs CASE TIME (both legs), 0 red.

[x] V3  **ANSWERED — the server shuffles; the client must not assume queue order.**
        `presentations.js:43-44` states it as law: *"Presentation ORDER is shuffled in every path
        (selection is deterministic; display order is not)"*, implemented at `shuffled()` :122-129 and
        applied at :184-187 (priority PREFIX preserved, remainder shuffled).
        ⇒ `presentedWordIds` arrives PRE-SHUFFLED. The UI must render it in the given order and must NOT
        re-shuffle (which would destroy the preserved priority prefix) and must NOT sort it back into
        queue order. A set-membership assertion cannot catch either mistake — C1 must assert ORDER.

[x] V4  **ANSWERED — and the real finding is that refusals arrive on TWO CHANNELS, not one.**
        NO engine status escapes that the client cannot name: diffing every `status:` literal in
        callables/presentations/composer/completion against the frozen RV2 list leaves only `created`,
        `exists` and `replayed`, and none of those appears in callables.js — they are internal
        `composePresentation` return values that never reach a client.
        **BUT the frozen list MIXES two delivery mechanisms, which is a trap for this fold:**
          · RETURNED AS DATA — the protocol refusals (`config_hold`, `review_v2_dark`, `queue_invalid`,
            `empty_pool`, `compose_key_reused`, `invalid_compose_key`, `presentation_invalid`,
            `list_words_malformed`, `reset_in_progress`, `reset_epoch_mismatch`, …).
          · THROWN as `HttpsError`, and therefore surfacing as a `ReviewV2Error` from the wrapper
            (`reviewV2Client.js:122-131`) — `class not found` (not-found), `not enrolled`
            (permission-denied), `list not assigned` (failed-precondition), per `resolveAndGate`.
        `class_not_found` / `not_enrolled` / `list_not_assigned` are DECLARED in the frozen status list
        but are never returned as data — a UI that only switches on `result.status` will never see them
        and will surface a raw error instead of a reason.
        ⇒ **A1/A2 must handle BOTH channels.** Fixture C3 covers the data refusals; add C8 for the
        thrown ones. Also carded for D1: the frozen list should say which entries are thrown, or the
        next reader repeats this mistake.
        (Method note: my first pass used `[a-z_]+` on the client side and `[a-z_0-9]+` on the engine
        side, so `review_v2_dark` showed as a false gap. Re-run with matching classes. The lesson is the
        one that keeps recurring here — an asymmetric query looks exactly like a finding.)
        `compose_key_reused`, `queue_invalid`, `empty_pool`, …) and what the UI must do for EACH. A
        cutover that only handles the happy path strands a student on a blank screen.

[x] V5  **ANSWERED — and it names the most likely client bug in this fold: a RELOAD.**
        A composeKey is registered with a FINGERPRINT `{classId, listId, logicalDay, resetEpoch,
        sessionType, testType, kind, visitId|null}` (presentations.js:21-26):
          · same key + MATCHING fingerprint  ⇒ REPLAYS the existing presentation (lost-response recovery)
          · same key + MISMATCHED fingerprint ⇒ `compose_key_reused` — "a key never silently serves a
            different test"
          · malformed key ⇒ `invalid_compose_key` (token law: 8-128 of [A-Za-z0-9._-])
          · replay short-circuits BEFORE the write fence, so it still works under a reset lock; a FRESH
            claim under one is refused `reset_in_progress` / `reset_epoch_mismatch`
        **THE DANGER IS NOT KEY REUSE — THE SERVER GUARDS THAT. IT IS KEY LOSS.** `newComposeKey()`
        (reviewV2Client.js:137) mints a random key. If the client holds it only in component state, then
        a page RELOAD mid-test mints a NEW key, which is a fresh claim, which composes a **DIFFERENT
        TEST** — and the server cannot detect it, because a new key is legitimate by construction. The
        student loses the test they were taking and is silently handed another.
        ⇒ **The composeKey MUST be PERSISTED** (the codebase already uses sessionStorage on this path —
        studyService.js reads it around `completeSessionFromTest`), keyed so the SAME test recovers it,
        and regenerated ONLY on a deliberate retake.
        FIXTURE (C9): reload mid-test ⇒ the SAME presentationId comes back (replay), not a new one; and
        a deliberate retake ⇒ a DIFFERENT presentationId. Both legs, or the guard is untested.
        (`reviewV2Client.js:137`). Get this wrong in either direction and you either compose a different
        test on a retry, or replay a stale one on a real retake.

[x] V6  **ANSWERED, honestly: there is nothing to discover — it is a constraint I must impose.**
        `REVIEW_V2_CLIENT=false` (featureFlags.js:243) and NOTHING imports `reviewV2Client` today, so
        there is no existing gating to verify. That makes flag-off parity a DESIGN obligation of this
        fold rather than a property to confirm: every new branch gated at the call site, no shared
        helper mutated in place, and the legacy path reachable with the flag off byte-for-byte.
        C2 is the only thing that can prove it, so C2 is not optional.
        confirm the flag genuinely gates every new branch and no shared helper is mutated in place.

## GROUP A — DELTAS

[x] A1  **DONE 2026-08-04.** Behind `REVIEW_V2_CLIENT`, source the review STUDY set and the review TEST set from
        `composeSession` instead of computing them client-side; carry `presentationId` through to submit.
        IMPLEMENTED:
          · adapter `src/services/reviewV2Compose.js` (new; persisted composeKey + two-channel refusal
            routing + verbatim-order envelopes; fixture-injectable deps)
          · review entry composes LAZILY inside `buildReviewStudySet`
            (DailySessionFlow.jsx:542 — the ONE chokepoint all six review-entry paths flow through);
            STUDY set = day queue in server order (+ new-FAILED prepended STUDY-ONLY, de-duped)
          · review TEST set = `presentedWordIds` verbatim (navigateToTest override
            DailySessionFlow.jsx:1399,1445-1466 — bypasses selectTestWords re-sample/re-shuffle);
            TypedTest.jsx:310 renders served order (legacy shuffle gated off when rv2)
          · NEW test from `composeNewTest` at TEST ENTRY (prepareRv2NewTest DailySessionFlow.jsx:1097;
            goToNewWordTest:1140; retake fresh-key :1163); in-page retakes recompose fresh
            (MCQTest.jsx:990,1097 · TypedTest.jsx:1273,1384); modality follows the ENGINE testType
          · presentationId carried in `testConfig.rv2` + sessionStorage blob `rv2Presentation`
            (DailySessionFlow.jsx:1491; kept current across retakes MCQTest.jsx:968 / TypedTest.jsx:1252)
        FIXTURES: bypass set = emulator BS-CREATE/BS-REPLAY/BS-RETAKE/BS-RESET/BS-TABS/BS-OTHER/
        BS-THIRD/BS-TEACHER (cutover-a-compose-emulator.mjs, 0 red); pure ORDER cases (0 red).
        BYPASS SET — every way the student can end up seeing the WRONG set (one fixture each):
          · create      — first compose of a day
          · update      — a retake composing a NEW presentation (must differ; must not replay)
          · delete      — a reset mid-session (epoch changes ⇒ the old presentation must not be reused)
          · set-merge / set-overwrite — a second compose with the SAME composeKey (must REPLAY, not recompose)
          · delete-then-recreate SEQUENCE — reset then re-enter the same logical day
          · batch / transaction — two tabs composing concurrently
          · a different path — the new-word test vs the review test (`composeNewTest` vs `composeSession`)
          · as a third party — another student's presentationId offered to this session (must refuse)
          · as a teacher — a teacher viewing/driving a student's session
        OTHER LEG (mandatory): with the flag OFF, the legacy composition is UNCHANGED — same words, same
        order, same counts, for the same inputs.

[x] A2  **DONE 2026-08-04.** REFUSAL HANDLING — **the decision is already made by the existing contract, and checking it
        found a BUG in that contract.**
        IMPLEMENTED: `reviewV2Compose.js` routes BOTH channels — data `config_hold`/`review_v2_dark`
        AND the thrown trio by code (`not-found`/`permission-denied`/`failed-precondition`, bare and
        `functions/`-prefixed) ⇒ silent LEGACY fallback; EVERY other refusal ⇒ `blocked` with a
        rendered reason (`refusalReasonText`; unknown status ⇒ generic line — never blank, never
        silent legacy). Blocked renders through the pages' existing error surfaces (DSF setError
        screen · MCQ/Typed setError/setRetakeError). `compose_key_reused`/`invalid_compose_key`
        additionally DISCARD the dead persisted key (no silent auto-recompose loop; next deliberate
        entry mints fresh). D1's comment corrections landed (reviewV2Client.js:85-116).
        FIXTURES: pure CASE C3 + C8 + V5-discard (117 checks 0 red) · emulator RF-DATA + RF-THROWN +
        BS-TEACHER + BS-RESET (89 checks 0 red) — one case per status incl. both channels + unknown.
        `reviewV2Client.js:90-96` defines `NOT_SERVING = {config_hold, review_v2_dark, class_not_found,
        not_enrolled, list_not_assigned}` — "fall back to the legacy path rather than show an error.
        (A dark/held engine is the NORMAL pre-flip state.)" So: NOT_SERVING ⇒ silent legacy fallback;
        **every other refusal ⇒ BLOCK with a rendered reason, never a silent fallback**, because a silent
        fallback hides an engine that is refusing, which is precisely the signal the 25WT rehearsal exists
        to surface. Decision recorded; no longer open.

        **>>> BUG FOUND WHILE CHECKING IT (V4's two channels, now concrete): THREE OF THE FIVE
        NOT_SERVING STATUSES CAN NEVER REACH `isNotServing`. <<<**
        `class_not_found`, `not_enrolled` and `list_not_assigned` are THROWN as `HttpsError` by
        `resolveAndGate`, so the wrapper converts them to a `ReviewV2Error` (`reviewV2Client.js:122-131`)
        and they never arrive as `result.status`. `isNotServing(result)` therefore matches only
        `config_hold` and `review_v2_dark`. A client written the obvious way —
        `const r = await composeSession(); if (isNotServing(r)) useLegacy();` — would **throw an exception
        at an un-enrolled student instead of falling back**, which is the exact opposite of the documented
        intent, and it would do it on the most ordinary real-world case (a student dropped from a class).
        ⇒ This fold must route the thrown trio to the SAME legacy fallback, by code
        (`not-found` / `permission-denied` / `failed-precondition`), and D1 must correct the comment that
        currently implies all five arrive as data.

        BYPASS SET — every way a refusal can reach the student WITHOUT a rendered reason (one case each):
          · create      — refusal on the FIRST compose of the day
          · update      — refusal on a retake compose
          · delete      — refusal after a reset (epoch moved mid-session)
          · set-merge / set-overwrite — refusal on a REPLAY (same composeKey) rather than a fresh claim
          · FieldValue.delete() equivalent — the queue/presentation vanishing between compose and use
          · delete-then-recreate SEQUENCE — refuse, recompose, refuse again (must not loop silently)
          · batch / transaction — two tabs composing concurrently, one refused
          · a different path — the NEW-word compose (`composeNewTest`) vs the REVIEW compose
          · as a third party — a refusal carrying another student's identity
          · as a teacher — a teacher driving a student's session
          · **the THROWN channel** — each of the three above, arriving as `ReviewV2Error`
          · **an UNKNOWN status** — a future server status this client does not know: must render a
            generic reason, never a blank screen and never a silent legacy fallback
        OTHER LEG: `config_hold` / `review_v2_dark` DO fall back to legacy silently — that is the normal
        pre-flip state and must NOT render an error.

## GROUP C — FIXTURES + MUTANTS

[x] C1  One case per A1 bypass row. **DONE** — emulator BS-CREATE (create) · BS-RETAKE (update/retake,
        must-differ asserted) · BS-RESET (delete: epoch move ⇒ old presentation never reused;
        delete-then-recreate: refuse → discard → fresh compose under e1; reset LOCK blocks) ·
        BS-REPLAY (set-merge/overwrite: same composeKey ⇒ REPLAY, same presentationId+order) ·
        BS-TABS (batch/txn: two tabs, ONE queue, distinct presentations) · BS-OTHER (the new-word
        path vs review; families _n/_p; replay+retake laws on new) · BS-THIRD (foreign composeKey ⇒
        own presentation, no cross-user leak) · BS-TEACHER (teacher ⇒ thrown channel ⇒ legacy).
        ORDER asserted VERBATIM against the live server payload (V3), not set-membership.
        cutover-a-compose-emulator.mjs = 89 checks 0 red.
[x] C2  FLAG-OFF PARITY: the legacy path produces identical output for identical inputs. **Per V1 this
        is the ONLY parity control that exists** — flag-ON deliberately produces a DIFFERENT review set,
        so there is nothing to compare it against except the rotation law.
        **DONE, BY STRUCTURAL DEMONSTRATION — READ THE METHOD AND ITS LIMIT:**
          · reviewV2Client.js + studyService.js diffs are COMMENT-ONLY (mechanical grep over the
            diff: zero non-comment +/- lines).
          · Every deleted executable line in the 3 pages (20 total) was re-derived hunk-by-hunk:
            each is either an ADDITIVE import/param/state, a `REVIEW_V2_CLIENT`-gated branch whose
            flag-off leg is the ORIGINAL LINE VERBATIM (e.g. TypedTest.jsx:310-315 shuffle,
            navigateToTest wordPool ternary), a const→let, or a sync→async wrapper whose flag-off
            body reaches navigateToTest with no intervening await (same-tick execution).
          · Per-file eslint problem counts IDENTICAL to HEAD baseline (12/8/6/3 + clean new module);
            esbuild transform green on all six files.
        **LIMIT (say-it-loudly clause): NO RUNTIME/VISUAL demonstration was possible in this
        environment** — node_modules carries win32 natives (rollup + esbuild binaries), so
        `npm run dev`/`npm run build` cannot execute here at all (pre-existing; reinstalling
        node_modules was off-limits with a concurrent session writing the repo). The CLOSE-row
        visual check remains OPEN for the delegator's environment.
[x] C3  One case per refusal status from V4. **DONE** — pure CASE C3: config_hold/review_v2_dark ⇒
        legacy; 13 authority statuses ⇒ blocked-with-reason; UNKNOWN status ⇒ generic reason;
        malformed/empty payloads fail closed. Emulator RF-DATA drives the LIVE ones end-to-end:
        day_guard_rejected (both paths) · empty_pool (day 1) · list_end · reset_in_progress ·
        client_version_stale (blocked, force-refresh) · review_v2_dark + config_hold (legacy).
[x] C4  MUTANT: source the test set from the queue instead of `presentedWordIds`. **KILLED** —
        M-C4-TEST-SET-FROM-QUEUE applied to reviewV2Compose.js in place ⇒ pure suite exits 1 with
        2 red checks ("presented verbatim", "presented differs from queue"); restore sha-verified.
        cutover-a-compose-mutants.json.
[x] C7  V2's compose-timing fixture, BOTH legs (see V2 + the EXECUTOR ADDENDUM there). **DONE** —
        emulator CASE TIME: GOOD leg = new-test fail w9 (engine submit stamps, `stamped:1`) → twi
        advance (the reconciliation event, modeled explicitly per the addendum) → FIRST composeSession
        at review entry ⇒ w9 in queue AND selected by needsPriority into a size-3 test. BAD leg =
        composeSession at session start ⇒ queue pins without w9; after the identical fail/stamp/
        advance, BOTH the persisted-key replay AND a fresh-key recompose still lack w9 (queue
        day-pinned — demonstrated, not described); AND the bad queue equals the independent reference
        sweep over the at-pin-time universe — a valid rotation, nothing flags the loss.
[x] C8  One case per THROWN refusal (V4's second channel) — the UI must render a reason, not an error.
        **DONE** — pure CASE C8 (trio ⇒ legacy in BOTH code forms; internal/unauthenticated/
        invalid-argument/unavailable/deadline-exceeded/bare-Error ⇒ blocked WITH reason) + emulator
        RF-THROWN (live HttpsErrors: not-found/permission-denied/failed-precondition ⇒ legacy on
        both compose paths). Note the trio's UI is the SILENT LEGACY FALLBACK by contract (A2) —
        the "render a reason" duty applies to the NON-not-serving throws, which is what's asserted.
[x] C9  V5's reload/retake fixture, BOTH legs — reload replays the SAME presentation; retake mints a NEW one.
        **DONE** — emulator BS-REPLAY (same persisted storage ⇒ SAME presentationId + SAME order) /
        BS-RETAKE (freshKey ⇒ DIFFERENT presentationId, day-pinned queue) + the same pair on the
        new-test path (BS-OTHER) + pure C9/V5 key-persistence unit legs (scope shape, discard,
        malformed-stored re-mint, kind separation).
[x] C6  A case proving the served set obeys the ROTATION law (cursor advance + no starvation), since
        per V1 there is no client-set oracle to compare against. **DONE** — emulator ROT: 3-day lap,
        queueSize 4 over a 10-word universe; each day's served queue equals an INDEPENDENT reference
        cursor sweep (not imported from composer.js); full lap coverage (all 10 served, no
        starvation); day 4 wraps tail→head. NO server-set==client-set assertion anywhere (V1 law).
[x] C5  MUTANT: reuse a stale `composeKey` on a retake. **KILLED** — M-C5-STALE-KEY-ON-RETAKE
        (freshKey ignored) ⇒ pure suite exits 1 with 1 red check ("retake mints a NEW key");
        restore sha-verified. cutover-a-compose-mutants.json.

## GROUP D — TRUTH REPAIRS
[x] D1  Any doc claiming the client computes the review segment (studyService comments, 10_/18_).
        **DONE** — reviewV2Client.js:85-116 (frozen list now names the THROWN trio + NOT_SERVING
        comment corrected: only config_hold/review_v2_dark arrive as data; isNotServing docstring
        scoped to the data channel) · studyService.js:414-427 (segment comment now states the
        client-computed segment is the LEGACY flag-off model; engine rotation replaces it under
        REVIEW_V2_CLIENT). SEARCHED 10_REVIEW_GRADUATION_REDESIGN.md + 18_TYPED_LEG_DESIGN.md for
        client-segment claims: none found (10_'s only "segment" hit is the re-completion pips row,
        not a client-selection claim) — nothing to repair there.

## GROUP E — CARDED, NOT THIS ROUND
[~] E1  Submission, completion and refusal COPY are folds 51b/51c/51d. This fold stops at composition.
        (Carried for 51b: `testConfig.rv2` + the blob's `rv2Presentation` are the submit fold's
        handles; refusal COPY in reviewV2Compose.js is deliberately minimal pending 51d.)

## GROUP F — OPUS AUDIT FOLD (PASS WITH FINDINGS, 2026-08-04): F3 → F2 → F4 → F5 → F6
> Flag-on behaviour only. `REVIEW_V2_CLIENT` stays `false`; every change gated at its call site;
> flag-off legs byte-identical (the C2 doctrine). Fixtures live at the TESTCONFIG BOUNDARY: the
> override logic moves into PURE functions in `reviewV2Compose.js` (node-importable, the mutant
> driver's TARGET), and the pages call them at flag-gated call sites.

[x] FV1 **DONE 2026-08-04 — every claim below was verified before the first edit; two were
      load-bearing surprises: MCQ's first-render pool must travel as an ARGUMENT (state not yet
      committed), and SessionSteps is an orphan (the live F2 surface is SessionProgressSheet:154
      fed only by TypedTest:1798-1799).** VERIFY BEFORE EDITING — all confirmed in code BEFORE any edit:
      · MCQTest.jsx:218-223 draws distractors from `originalWords` state, BUT at the FIRST
        PATH-A call (:265-266) that state is still `[]` (same-tick setState), so generateQuestions
        falls back to `words` = wordsToTest — the pool fix MUST flow as an ARGUMENT, not state.
      · Full F3 narrowing-surface set (every way an rv2 testConfig reaches a page):
        (1) DSF navigateToTest override :1450-1453 + the `wordPool` var :1407-1408 (BOTH narrow);
        (2) MCQ in-page new-retake :1002-1003 (pool = presented only); (3) MCQ review-retake
        navigate :1115 (`originalWordPool: words`); (4) Typed review-retake navigate :1402 (same);
        (5) Typed in-page new-retake :1285 (also the F4 re-cap). Legacy PATH B/smart-selection are
        flag-off-only, untouched.
      · F2 live surfaces: "Words #x–y" renders in EXACTLY two components — SessionProgressSheet:152-155
        (live; fed ONLY by TypedTest:1798-1799 from sessionContext) and SessionSteps:106-108, which is
        IMPORTED BY NOTHING (src-wide grep; latent surface, same falsy-hiding conditional). MCQ's two
        sheet instances (:1472, Typed :1742) pass no range. Both components hide the whole line when
        start/end are falsy ⇒ null is a clean, honest, zero-new-markup fix. wordRangeStart/End reach
        NO write path (grep db.js/studyService/functions: zero hits) — display-only, null is safe.
      · F4 cap sites: TypedTest:305 (PATH A — flag-relevant), :1285 (rv2 retake leg — flag-relevant),
        :344/:458/:1310 (legacy-only paths — untouched). MAX_TYPED_TEST_WORDS=50 (:47);
        reviewTestSizeMax default 60 (testConfig.js:37).
      · F5 asymmetry: DSF:541 guards day inline (silent legacy); prepareRv2NewTest :1099-1103 has NO
        guard and passes `sessionConfig?.dayNumber` raw. `logSystemEvent(eventType, data, severity)`
        exists (db.js:104) and is ALREADY imported by DSF (:55), MCQ (:7), Typed (:7).
      · Fixture feasibility: studyAlgorithm.js is pure ("No Firestore dependencies") ⇒ the node
        fixture can import the REAL `buildTestConfig` (testConfig.js) and assert the ACTUAL object
        handed to the pages. Emulator toolchain present: ~/jre JDK 21 + ~/fbtools firebase-tools +
        scripts/serviceAccountKey.json — the emulator evidence (which pins reviewV2Compose.js sha)
        CAN be re-run after edits.

[x] F3  **DONE 2026-08-04.** IMPLEMENTED: `rv2DistractorPool` (reviewV2Compose.js:193) +
      `rv2TestConfigOverride` (:231). poolWords wired: review = day queue
      (DailySessionFlow.jsx:576), new = day's `newWords` (:1135). All five FV1 surfaces: DSF
      wordPool :1439-1441 + envelope :1488 · MCQ first-load argument (generateQuestions rv2Pool
      param :221, gated call :278-282) · MCQ rv2 new-retake :1021-1023 · MCQ review-retake
      navigate :1130-1139 · Typed review-retake navigate :1407-1416. FIXTURE: pure CASE F3/F6
      (fixtures.mjs:332 — real buildTestConfig in, page-bound object out; verbatim order; pool ⊇
      whole day queue; wordsToTest ⊆ pool; 4-option possible for every presented word). MUTANT
      M-F3-NARROW-POOL **KILLED** — 3 red: "originalWordPool contains the WHOLE day queue" /
      "pool is STRICTLY larger" / "4-option questions possible" (mutants.json).
      — was: HIGHEST — MCQ distractor pool silently narrowed to the presented subset (guess odds move,
      changes what the student is SCORED on). FIX: new pure `rv2DistractorPool({words, poolWords})`
      (presented verbatim first, then pool remainder de-duped ⇒ wordsToTest ⊆ originalWordPool
      invariant preserved) + pure `rv2TestConfigOverride({baseConfig, rv2, testPhase})` owning the
      whole flag-on override. poolWords sourced: review = the engine DAY QUEUE (the day's full
      serving universe — the segment is dead flag-on per V1.3); new = the day's `newWords` (exactly
      legacy's pool). Wire ALL FIVE surfaces from FV1; MCQ generateQuestions takes an rv2Pool arg
      whose ABSENT-case arm is the original ternary VERBATIM (flag-off byte-identical).
      FIXTURE: boundary case through the REAL buildTestConfig ⇒ full pool, verbatim order, subset
      invariant. MUTANT M-F3-NARROW-POOL (re-narrow to presented) must go RED.

[x] F2  **DONE 2026-08-04.** IMPLEMENTED inside `rv2TestConfigOverride` (reviewV2Compose.js:231 —
      review ⇒ wordRangeStart/End null; new ⇒ passthrough). Live surface TypedTest:1798-1799 →
      SessionProgressSheet:152-155 hides the line on falsy; DSF:1447-1453 legacy computation
      untouched. FIXTURE: pure CASE F2 (fixtures.mjs:377 — null/null for review incl. JSON
      round-trip; 21/30 passthrough for new). MUTANT M-F2-SEGMENT-RANGE-LABEL **KILLED** — 4 red:
      "review wordRangeStart is null" / "review wordRangeEnd is null" / "keys survive JSON as
      null" / "falsy ⇒ line hidden" (mutants.json).
      — was: Review word-range label reads the dead segment. DECISION: **no range at all** flag-on for
      the engine-composed REVIEW test — `rv2TestConfigOverride` nulls wordRangeStart/End (null, not
      undefined: keys survive JSON so the blob shape is stable); both consumers already hide the
      line when falsy ⇒ header reads "Day N" honestly, zero new markup (consistent with this fold's
      no-new-UI boundary; count is already on screen via the test's own progress label; copy is
      51d's). NEW-test label unchanged (newWordStart/EndIndex remain meaningful, V1.3). Flag-off:
      computation at DSF:1414-1420 untouched — the null only exists inside the rv2-gated override.
      FIXTURE: boundary case asserts review⇒null/null while new⇒passthrough. MUTANT
      M-F2-SEGMENT-RANGE-LABEL (re-point at the segment values) must go RED.

[x] F4  **DONE 2026-08-04.** IMPLEMENTED: `rv2ServedTypedWords` (reviewV2Compose.js:212) gated at
      TypedTest:305-314 (PATH A — flag-off leg is the original slice verbatim) and :1292-1295
      (rv2 retake leg, already flag-gated). Legacy caps :344/:458/:1310 untouched. FIXTURE: pure
      CASE F4 (fixtures.mjs:408 — 60⇒60, order verbatim, 120⇒120, defensive copy). MUTANT
      M-F4-RETRUNCATE-TYPED **KILLED** — 3 red: "60 served ⇒ 60 rendered" (got 50) / "order
      verbatim" / "120 served ⇒ 120 rendered" (mutants.json).
      — was: Typed truncation can guarantee a failing score (60 served, 50 answerable, denominator now
      server-derived ⇒ capped at 83% < 95%). DECISION: **honour the full presented set** — refusing
      would hard-block every 51-60-word class the moment the flag flips (a worse failure than a
      longer page), and adding a bigger silent cap would recreate the same bug at a new number; the
      ENGINE is the sizer (testSize ≤ reviewTestSizeMax ≤ teacher config). New pure
      `rv2ServedTypedWords(words)` = defensive copy, NEVER slices; gated at TypedTest:305 (flag-off
      leg = the original slice VERBATIM) and :1285 (already flag-gated leg). FIXTURE: 60⇒60 and
      120⇒120 (no hidden cap at ANY size). MUTANT M-F4-RETRUNCATE-TYPED (re-add slice(0,50)) must
      go RED.

[x] F5  **DONE 2026-08-04.** IMPLEMENTED: shared guard `invalidDayOutcome` (reviewV2Compose.js:262)
      as the FIRST statement of both surfaces (:327 review, :376 new — before any key mint);
      DSF:547 chokepoint drops the inline guard; both legacy legs log
      `rv2_compose_invalid_day` to system_logs (DSF:606-610 composeSession, :1146-1150
      composeNewTest). Retake surfaces inherit the guard via the adapter. FIXTURE: pure CASE F5
      (fixtures.mjs:424 — 7 bad days × both surfaces: legacy + via + logged once + engine never
      asked + no storage scope; day-1 boundary composes; freshKey+invalid leaves storage
      untouched). MUTANT M-F5-SILENT-DAY-FALLBACK **KILLED** — 28 red (7 days × 2 surfaces ×
      {via invalid_day, logged exactly once}) (mutants.json).
      — was: Silent legacy fallback at the chokepoint + surface asymmetry. FIX: the day guard moves INTO
      the adapter (both surfaces reconciled by construction) — first statement of BOTH
      composeReviewSessionV2 and composeNewTestV2: invalid `logicalDay` (non-integer or < 1) ⇒
      `{outcome:'legacy', via:'invalid_day', logicalDay}` + injectable `deps.logInvalidDay`
      (default console.error) BEFORE any key mint (no junk `d<undefined>` scope keys). DSF:541
      drops the inline guard (`if (REVIEW_V2_CLIENT)`), and BOTH legacy legs (chokepoint +
      prepareRv2NewTest) fire `logSystemEvent('rv2_compose_invalid_day', …)` when
      `via === 'invalid_day'` — observable in system_logs exactly like the existing
      csd_anchor_invalid / legacy_write_denied convention. Retake surfaces inherit the adapter
      guard (their `logicalDay` comes from a composed envelope; corruption now logs + legacies
      instead of round-tripping garbage). Outcome-'legacy' contract for callers is UNCHANGED (same
      fall-through), so no caller edit beyond the two log lines.
      FIXTURE: for each bad day (undefined/null/0/-1/1.5/'3'/NaN) × both surfaces: outcome legacy,
      via invalid_day, composeFn NOT called, logInvalidDay called once, storage untouched; day 1
      boundary still composes. MUTANT M-F5-SILENT-DAY-FALLBACK (re-silence: legacy without via/log)
      must go RED.

[x] F6  **DONE 2026-08-04 — numbers read from the evidence JSONs, none hand-typed.**
      PURE: **211 checks, 0 failures** (was 117; +94 boundary checks) — the F cases run the REAL
      `buildTestConfig` (on-disk bytes, specifier absolutized for node; drift-guarded), and the
      receipt now also binds testConfig.js + studyAlgorithm.js shas. MUTANTS: **6/6 killed**
      (M-C4 2 red · M-C5 1 red · M-F3 3 red · M-F2 4 red · M-F4 3 red · M-F5 28 red), restore
      sha-verified, target sha 6e5923e678c73fe7 == tree. EMULATOR: **89 checks, 0 failures**
      re-run against the EDITED adapter (receipt re-stamps the new reviewV2Compose.js sha; all
      emulator days are valid integers, so the F5 guard is inert there — verified by grep before
      the run). Pure suite re-run AFTER the mutant driver AND after the red-name capture runs, so
      its receipt certifies the RESTORED module bytes. eslint per-file problem counts vs 25ec1fb
      baseline (same method both sides): DSF 13=13 · MCQ 9=9 · Typed 7=7 · adapter 0 (new).
      LIMIT (as planned): the JSX call-site glue is still not EXECUTED here — covered by the pure
      boundary functions the pages now call + lint parse + the gated-call-site grep (every new
      identifier's call site verified inside a REVIEW_V2_CLIENT-gated context).
      — was: Coverage for the above (the reason F2/F3/F4 were invisible): extend
      cutover-a-compose-fixtures.mjs with the four cases above AT THE TESTCONFIG BOUNDARY (real
      buildTestConfig in, page-bound object out) and extend cutover-a-compose-mutants.mjs with the
      four mutants (driver already targets reviewV2Compose.js in place, restore sha-verified).
      EACH mutant must be observed RED; if one survives, SAY SO — do not weaken the fixture.
      LIMIT (stated up front): the JSX call-site glue itself still cannot be EXECUTED here (no DOM,
      no vite); it is covered by the pure boundary functions the pages now call, plus lint/transform
      + structural diff review — same standard as C2, stated as such.
      RE-RUN AFTER LAST EDIT: pure suite, mutant driver, AND the emulator suite (its evidence pins
      reviewV2Compose.js's sha — gate 3b fails otherwise); numbers into the rows below from the
      evidence JSONs, never hand-typed.

## CLOSE  (executor status 2026-08-04 — delegator finishes the last four)
[x] every row ticked with file:line + fixture ref
[x] evidence re-run AFTER the last edit — pure 117/0 · emulator 89/0 · mutants 2/2 killed · engine
    lap re-run 453/453 (all four evidence JSONs regenerated post-final-edit; the pure suite was
    re-run AFTER the mutant driver so its evidence certifies the RESTORED module bytes)
[x] all shas re-stamped — every evidence JSON carries sourceShas of the exact tree bytes it ran
[x] numbers re-derived from evidence — 117/0, 89/0, 2/2, 453/453 all read from the JSONs, none hand-typed
[x] change log row (ABSOLUTE path) — DELEGATOR (change_action_log.md is on the executor's
    do-not-touch list)
[x] `node scripts/deepfix2/gate.mjs` clean — will stay red until the delegator's close-out (open
    CLOSE rows + today's change-log row are the remaining trips)
[x] commit — DELEGATOR
[x] **VISUAL CHECK — CLOSED 2026-08-04 by win orders 98 + 99 (PASS_WITH_GAP then CLEAN).**
    DONE 2026-08-04 by the Windows executor (order 98, verdict PASS_WITH_GAP). I cannot run it here:
    node_modules holds win32 binaries, so vite will not start under WSL.
    **COVERED — including the load-bearing surface:** dashboard; review study across all 60 cards; and
    flag-off the review test composed **30 words from the 60-card queue** — the legacy testSize/queueSize
    behaviour, which is precisely where a leak into the flag-off path would have shown. Console: 79
    messages, ZERO errors, ZERO warnings, reproduced over SIX runs. `determineStartingPhase` confirmed
    the LEGACY phase engine is deciding. 25WT identity only; the flag was never flipped.
    **NOT COVERED — stated as a gap rather than glossed:**
      (a) the NEW-WORD compose path — **in THIS fold's scope** and unexercised, because the seeded account
          entered at Step 3 (Review Study) with the new-word phase already behind it;
      (b) submit → grade → completion — belongs to folds 51b/51c, and was blocked by the typed test's
          per-word input selectors not matching the driver.
    ⇒ (a) is chased by ORDER 99 (an MCQ review type seeded at day start, which the driver handles).
    **GAP (a) CLOSED by order 99, verdict CLEAN:** the new-word phase was driven end to end on a 25WT
    MCQ class at day start — new-word study (20 cards, 'Step 1 of 5', Korean + sample sentence) and the
    NEW-WORD TEST ('Step 2 of 5', 20 words) both render, and composition is the legacy 1:1 result. The
    executor avoided seeding honestly — a read-only survey of 317 25WT pairs found an account already at
    day start, so it SELECTED rather than wrote. Gap (b) submit→completion remains, correctly, with
    folds cutover-b/c. This row is now a genuine pass.
[x] a concurrent session is writing to this repo — stage explicitly, never `git add -A`
    (executor confirms: `.claude/settings.json` is dirty from the OTHER session — do not stage it
    with this fold)
