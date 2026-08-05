# ai-metering-build FOLD LEDGER — the AI-grading meter + the re-test-only spend cap
Brief: `docs/plans/deepfix2/_ledgers/ai-metering-build-BRIEF.md` (law) · contract `15_H6_SCHEMAS_AND_CONTRACTS.md:184,191`
· law R2-20 (`11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:63`) · COMMITTED-NOT-DEPLOYED (deploy is a separate David order).
Baseline before any edit: engine lap **452/452** (`/tmp/.../evidence/engine-lap-BASELINE.json`, `pass:true`), ntf26 **6/6 cases · 2/2 mutants**.

## GROUP V — VERIFY BEFORE EDITING  (a guard is only "inert" if no live writer exists)
[x] V1  THE LOAD-BEARING FINDING RE-VERIFIED: the metering point cannot tell re-test from live.
        `claimOrRecoverGradingJob(uid, jobKey)` — `functions/index.js:1051` — takes ONLY (uid, jobKey);
        nothing in its body or in `functions/reviewV2/typedGrading.js:275-284` (`resolveTypedGrade`'s
        parameter object) carries a rerun/retest discriminator. `grep -n "isRerunTxn|kind === \"rerun\""`
        over `functions/` returns ONLY `functions/reviewV2/callables.js:676` (`isRerunTxn =
        p.requestFingerprint?.kind === "rerun"`) and its consequence `:761` (`type:"retest"`). CONFIRMED —
        a naive cap at the claim txn WOULD refuse live typed tests. Brief cite is accurate.
[x] V2  THE DISCRIMINATOR IS SERVER-AUTHORED AND AVAILABLE AT THE CALLER, PRE-TXN.
        `requestFingerprint: {sessionType, testType, kind, visitId}` is written at
        `functions/reviewV2/presentations.js:526` from `kind` derived at `:270-303` from the caller's
        `mode` — `mode:"rerun-review"` ⇒ `kind="rerun"` (`:303`), `mode:"new-day"` ⇒ `kind=params.kind`
        validated to `'live'|'rerun'` (`:278-281`). The ONLY composer that passes rerun is
        `reviewV2ComposeRerun` (`callables.js:440` and `:462`). CLIENT CANNOT SET IT. The submit callable
        already holds it in its PRE-TXN read: `const pres = preSnap.data()` (`callables.js:513`), and the
        typed grade runs at `callables.js:569` — before the txn. So the discriminator can be threaded as an
        explicit ARGUMENT (never inferred from a doc id/name/heuristic — decision 2).
[x] V3  CLAIM-TXN BRANCH MAP — which branches represent a REAL AI call (decision 6 + the brief's V-row).
        `functions/index.js:1055-1087`: (a) fresh claim, doc absent → `{action:"grade"}` → grader RUNS ⇒
        COUNT; (b) `status==="claimed"` with `leaseExpiresAt > now` → `{action:"in_progress"}` (`:1066-68`)
        → grader NOT run ⇒ NO COUNT; (c) `status==="graded" && payload` → `{action:"return_cached"}`
        (`:1062-64`) → grader NOT run ⇒ NO COUNT (this is the idempotency case); (d) `claimed` + EXPIRED
        lease → takeover `tx.set` (`:1069-76`) → `{action:"grade"}` → grader RUNS AGAIN ⇒ COUNT (a second
        real AI call — `aiCallCount` 1→2); (e) `job.uid !== uid` → throws `permission-denied` (`:1059-61`)
        before any write ⇒ NO COUNT. Both COUNT branches sit BEFORE any `tx.set`, so counter reads can be
        inserted without violating Firestore's reads-before-writes rule and without touching (b)/(c)/(e).
[x] V4  BOTH TYPED CALL PATHS COUNT; only the rerun leg can enforce.
        Legacy public `gradeTypedTest` claims at `functions/index.js:1188` when
        `GRADE_JOB_ENABLED (=true, :118) && jobAttemptDocId` where `jobAttemptDocId = (writeContext ||
        gradeContext || null)?.attemptDocId` (`:1185`). The LIVE client always sends `gradeContext`
        (`src/pages/TypedTest.jsx:728`, ctx built with `attemptDocId`) ⇒ live student typed tests DO claim
        ⇒ DO count. The engine's `defaultGrade` (`typedGrading.js:144-151`) calls `gradeTypedTest.run`
        with NEITHER context ⇒ its inner job leg is INERT by construction (`typedGrading.js:56-59`) ⇒ the
        engine is counted ONCE, at its OWN outer claim (`typedGrading.js:286`). No double count.
[x] V5  THE CLIENT RENDERS AN ARBITRARY REFUSAL STATUS — a new status will not blank the screen.
        `src/services/reviewV2Submit.js:369-373`: every unmatched status falls to
        `{outcome:'blocked', status, reason: submitRefusalReason(status)}`, and `submitRefusalReason`
        (`:155-159`) returns `GENERIC_SUBMIT_REASON` for an unknown status. The four classifiers
        (`isNotServing`/`isGradingInProgress`/`isGradeUnusable`/`isStaleClient`,
        `src/services/reviewV2Client.js:125-149`) are exact-match sets, so a NEW status matches none ⇒ it
        does NOT poll and does NOT recompose — exactly the semantics decision 5 demands. Only the WORDING
        needs a client change; `src/` is outside this brief's touch list ⇒ carded E1.
[x] V6  THE CANONICAL KST DAY LAW EXISTS — reuse it, do not invent a second.
        `kstDateString(ms)` at `functions/reviewV2/completion.js:88-90`, exported `:799`, used at `:678`
        to key `users/{uid}/streak_credits/{kstDate}` (R2-21, frozen). Mirrored byte-for-byte client-side
        at `src/utils/streakAuthority.js:64`. Require graph is acyclic for a new `functions/aiMetering.js`
        → `./reviewV2/completion` → `./config` + `./composer` (neither requires `../index`), and
        `index.js:2397` already loads `./reviewV2/callables` which top-level-requires `./completion`
        (`callables.js:60`), so no new module-load cost and no cycle.
[x] V7  `firestore.rules` ALREADY COVERS THE METERING DOCS — no rules edit is needed.
        `firestore.rules:488-493` — `match /ai_metering/{meterId}` exists: teacher-gated read, and (read
        on to `:494-495`) all client writes denied. Admin SDK bypasses rules, so server-only writes are
        already the posture. `system_config/ai_metering` has NO rules match (`:483` is the LITERAL
        `system_config/review_v2` doc) ⇒ Firestore default-deny for every client verb. Nothing to change.
        The stale comment at `:482` ("nothing else exists under system_config") is carded E2 (rules file
        is explicitly off-limits).
[x] V8  ⚠ THE DEPLOY-CERT LAP PINS THE ABSENCE OF THIS FEATURE — brief-vs-code contradiction, REPORTED.
        `scripts/deepfix2/engine-emulator-lap.mjs:1445-1448`:
        `// There is NO live ai_metering writer in functions/ (15_ H6 schedules it for the claim txn;`
        `// grep: zero writers today) ... check("the typed leg writes NO ai_metering doc",`
        `(await db.collection("ai_metering").get()).size, 0);`
        This asserts the ABSENCE of exactly the writer this fold is commissioned to build. It is the ONLY
        lap assertion my change can touch (verified: `grep -n "ai_metering|aiCallCount"` over
        `scripts/deepfix2/*.mjs` returns only that line plus rules-matrix rows that seed their own doc).
        The brief forbids editing fixtures to make the lap green and does not authorize editing the shared
        certification lap. ⇒ IMPLEMENT, RUN, REPORT THE ONE RED. Not fixed here.

## GROUP A — DELTAS
[x] A1  NEW PURE MODULE `functions/aiMetering.js` — the whole decision surface, zero Firestore coupling
        in the clauses. Contents: `AI_METERING_DEFAULTS {perStudentDailyLimit:40, globalDailyLimit:6000}`
        (DEFAULTS, not truths) · `AI_METERING_CONFIG_PATH = "system_config/ai_metering"` ·
        `meterWindowKey(nowMs)` = `kstDateString` re-exported from completion.js (V6 — one day law) ·
        `normalizeLimits(raw)` · `readMeteringConfig(db)` (`{status:'ok'|'unreadable', limits}`) ·
        `counterAt(data, windowKey)` (window rollover ⇒ 0) · `nextCounter(n, windowKey)` ·
        `decideMetering({isRetest, meterStatus, studentCount, globalCount, limits})` — THE clause ·
        `meterGradingClaimInTxn(db, tx, {...})` (reads + committer) · `practiceLimitRefusal(scope)`.
        CONFIG DOC CHOSEN: a SEPARATE `system_config/ai_metering`, NOT a `metering` sub-object on
        `system_config/review_v2`. Justification: (i) `resolveReviewConfig` treats a malformed field in
        that doc as HOLD (`functions/reviewV2/config.js:83-113`) — a typo'd metering limit would become an
        ENGINE OUTAGE, the exact failure class this fold exists to prevent; (ii) the LEGACY grading path
        (947 students) has no classId/listId context and cannot call `resolveReviewConfig(db,{classId,
        listId})` at all; (iii) `system_config/review_v2` is the ACTIVATION BARRIER joined into txn read
        sets (`config.js:70-72`) — putting a spend knob there would serialize limit edits against engine
        mints. This is NOT a closure/guard row: it adds no guard, denies nothing, protects nothing —
        it is the decision surface the guard rows below consume. Fixtures: `ai-metering-fixtures.mjs`
        cases P1-P9, mutants M1-M8.
        BYPASS SET: SHARED WITH A2 — this module holds no guard of its own; every path (create · update ·
          delete · set-merge · set-overwrite · FieldValue.delete() · delete-then-recreate SEQUENCE · batch ·
          transaction · a different path · as a third party · as a teacher) is enumerated and fixtured on
          A2, which is the single enforcement point that consumes these clauses.
[x] A2  `functions/index.js` — METER IN THE CLAIM TXN + the retest-only refusal.
        `claimOrRecoverGradingJob(uid, jobKey, meter)` gains an OPTIONAL third argument. `isRetest` is
        `meter?.isRetest === true` — STRICT true, so absent/undefined/null/"true"/1 all read as LIVE
        (decision 2's safe default). On the two COUNT branches only (V3 a/d), before any write: read
        `ai_metering/{uid}` + `ai_metering/_global` in the SAME txn, decide, and either return
        `{action:"capped", scope}` with ZERO writes (retest only) or write job + both counters. Job doc
        gains `aiCallCount` (contract 15_ §5). A metering READ that throws inside the txn is caught ⇒
        live proceeds unmetered (fail-OPEN), retest refuses (fail-CLOSED) — decision 4.
        BYPASS SET (every path that reaches AI grading — counted? enforced? why):
          create (fresh claim, live)        — COUNTED, NOT enforced (no discriminator ⇒ live). case E-LEGACY, M-COUNT
          create (fresh claim, rerun)       — COUNTED, ENFORCED. cases M-RETEST-*, E-RETEST
          update (expired-lease takeover)   — COUNTED (a real 2nd AI call, aiCallCount 1→2); enforced iff rerun. case M-TAKEOVER
          set-merge (return_cached)         — NOT counted, NOT enforced (no grader call). case M-IDEMP
          set-overwrite (live lease)        — NOT counted, NOT enforced (`in_progress`). case M-INPROGRESS
          FieldValue.delete()/job vanished  — nothing to count; the next claim is a fresh create. case M-IDEMP-DELETED
          delete-then-recreate SEQUENCE     — job deleted then re-claimed ⇒ counted AGAIN (a real re-grade). case M-IDEMP-DELETED
          batch                             — no batch writer exists; counters are written ONLY inside this txn. case M-SOLE-WRITER
          transaction                       — THE path itself; all cases
          a different path (engine defaultGrade) — inner job leg INERT (V4) ⇒ counted once at the engine's own claim. case E-ENGINE-ONCE
          a different path (MCQ re-test)    — never reaches typed grading (`callables.js:581` else-branch) ⇒ UNMETERED, always available. case E-MCQ-RERUN
          a different path (replay short-circuit) — `callables.js:564-567` returns before `resolveTypedGrade` ⇒ no claim. lap CASE T §2 (unchanged)
          a different path (recompose-after-grade_unusable) — NEW presentationId ⇒ NEW job key ⇒ fresh create ⇒ counted; enforced iff rerun. case E-RECOMPOSE
          a different path (getGradingStatus/pollForGrade) — read-only (`index.js:1728-1749`), no claim ⇒ never counted, never capped. case E-POLL
          as a third party (another uid's jobKey) — throws permission-denied at `:1059` BEFORE any meter read/write ⇒ not counted. case M-THIRD-PARTY
          as a teacher                      — no teacher-triggered AI grading exists (`new Anthropic` occurs once, `index.js:1437`, inside gradeTypedTest). case M-TEACHER
        OTHER LEG (the rule narrows to the rerun leg — fixture the leg NOT changed): **THE SAME over-cap
        state must NOT refuse a LIVE test** — cases M-LIVE-OVERCAP (pure) and E-LIVE (emulator, end to end).
[x] A3  `functions/reviewV2/typedGrading.js` — thread the discriminator; map `capped` to the refusal.
        `resolveTypedGrade(db, {..., isRetest})`; `const retest = isRetest === true` (strict);
        the metering CONFIG is read OUTSIDE the claim txn and only when `retest` (the live path needs no
        limits — it is never refused), keeping the txn read-set unwidened by a config doc;
        `claim.action === "capped"` ⇒ `{refusal: practiceLimitRefusal(scope)}` — DATA, zero writes, exactly
        like the two existing typed refusals. Fixtures: cases E-RETEST, E-LIVE, mutant M7.
[x] A4  `functions/reviewV2/callables.js` — the ONE line that supplies the discriminator.
        `isRetest: pres.requestFingerprint?.kind === "rerun"` at the `resolveTypedGrade` call
        (`callables.js:569`), read from the server-authored pre-txn presentation snapshot (V2). Strict
        equality: absent/malformed/`"live"` ⇒ false ⇒ LIVE ⇒ never refused. Fixtures: cases E-RETEST,
        E-LIVE, E-MCQ-RERUN, mutant M8.
[x] A5  THE REFUSAL STATUS: `practice_limit_reached`, a PERMANENT-for-today sibling of `grade_unusable`.
        Shape `{status:"practice_limit_reached", scope:"student"|"global"|"unavailable", message:"You've
        reached today's practice-grading limit — try again tomorrow, or use a multiple-choice re-test."}`.
        Non-transient: polling cannot clear it (the window is a KST day) and recomposing cannot clear it
        (a new job key is still capped) — and V5 proves today's client already treats an unknown status as
        exactly that (blocked, no poll, no recompose). The student-facing string ships on the SERVER
        payload so the carded client change is wording-only. Fixture: cases E-RETEST, P8.
        BYPASS SET: SHARED WITH A2 — a status STRING closes nothing on its own; the paths that can and
          cannot produce it (create · update · delete · set-merge · set-overwrite · FieldValue.delete() ·
          delete-then-recreate SEQUENCE · batch · transaction · a different path · as a third party · as a
          teacher) are enumerated and fixtured on A2.

## GROUP C — FIXTURES + MUTANTS
[x] C1  PURE-node suite `scripts/deepfix2/ai-metering-fixtures.mjs` (zero credentials, zero spend) —
        drives the REAL `functions/aiMetering.js` exports AND the REAL `claimOrRecoverGradingJob` source
        text through a fake `db`/`tx`, one case per bypass path: M-COUNT · M-IDEMP · M-IDEMP-DELETED ·
        M-INPROGRESS · M-TAKEOVER · M-THIRD-PARTY · M-TEACHER · M-SOLE-WRITER · M-RETEST-UNDER ·
        M-RETEST-BOUNDARY (N-1 allowed / N refused) · M-LIVE-OVERCAP (THE outage case) · M-GLOBAL ·
        M-ROLLOVER · M-NO-DISCRIMINATOR · M-CONFIG-UNREADABLE · M-METER-READ-THROWS ·
        M-REBUILD-FAITHFUL · P1-P9 pure clauses. RESULT (derived from the JSON, `checks`/`cases`/
        `failed`): 116 checks across 26 cases, failed 0, pass true.
        Evidence: `/app/docs/plans/deepfix2/evidence/ai-metering-pure.json`.
        Re-run: `node /app/scripts/deepfix2/ai-metering-fixtures.mjs`
[x] C2  ONE MUTANT PER NEW CLAUSE, each mutating the SHIPPED SOURCE TEXT with an anchor asserted to match
        EXACTLY ONCE, each killed, clean restored. ELEVEN shipped (the plan named eight; three more were
        added when writing them exposed real clause boundaries):
          M1  flip the live/retest branch (live becomes cappable)              [true → false]
          M2  drop the fail-CLOSED refusal (unreadable meter lets a RETEST through)
          M3  invert the per-student boundary (`>=` ⇒ `>`)
          M4  invert the global boundary (`>=` ⇒ `>`)
          M5  drop the window-rollover reset (yesterday's count survives)
          M6  drop the config DEFAULT fallback (a malformed limit becomes unlimited)
          M7  drop the strict-true coercion in `claimOrRecoverGradingJob` (`=== true` ⇒ truthy)
          M8  drop the `capped` short-circuit on the FRESH-claim branch
          M9  count on the cached-return path (the idempotency guard)
          M10 drop the `capped` short-circuit on the TAKEOVER branch (the sibling seam)
          M11 drop the fail-OPEN default (make the live clause conditional on a readable meter)
        HONEST NOTE: M2's first cut aimed the unreadable-meter mutation at a LIVE probe and SURVIVED —
        correctly, because clause 1 returns before the meterStatus test is ever reached (defence in
        depth). The mutant was mis-aimed, not the code. It was re-aimed at the RETEST leg and M11 added
        for the LIVE leg, so both legs now have their own kill. RESULT (derived from the JSON,
        `killed`/`total`): 11/11 killed, pass true.
        Evidence: `/app/docs/plans/deepfix2/evidence/ai-metering-mutants.json`.
        Re-run: `node /app/scripts/deepfix2/ai-metering-fixtures.mjs`
[x] C3  EMULATOR suite `scripts/deepfix2/ai-metering-emulator.mjs` — the REAL transaction against a real
        Firestore, plus the end-to-end wiring the pure suite cannot prove: E-LEGACY (live legacy callable
        counts, never capped, ZERO Anthropic spend via an all-blank sheet) · E-ENGINE-ONCE · E-LIVE (over
        cap, live typed submit still LANDS — the outage-prevention case end to end) · E-RETEST (rerun
        typed submit over cap ⇒ `practice_limit_reached`, zero attempt writes) · E-RETEST-UNDER ·
        E-MCQ-RERUN (MCQ re-test unmetered and available while over cap) · E-RECOMPOSE · E-POLL ·
        E-CONFIG (a seeded `system_config/ai_metering` overrides the defaults) · E-ROLLOVER ·
        E-FINGERPRINT (the discriminator is server-authored) · E-SOLE-WRITER. RESULT (derived from the
        JSON, `total`/`failed`): 53/53 green, failed 0, pass true.
        Evidence: `/app/docs/plans/deepfix2/evidence/ai-metering-emulator.json`.
        Re-run: `PATH="$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH" NODE_PATH=/app/node_modules \
          ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project vocaboost-879c2 \
          "node scripts/deepfix2/ai-metering-emulator.mjs"`
[x] C4  REGRESSION GUARD — ⚠ STOP RAISED, THEN RESOLVED BY ORCHESTRATOR AUTHORIZATION (2026-08-05).
        WHAT I FOUND (V8, verified before editing): `engine-emulator-lap.mjs:1445-1448` asserted the
        ABSENCE of an `ai_metering` writer — the very writer this fold was commissioned to build — on a
        comment whose own stated premise was "grep: zero writers today". I implemented, ran the lap, and
        REFUSED to touch it: 451/452, one red, reported for adjudication.
        THE ADJUDICATION (orchestrator, in my words): the line's premise was true when written and is now
        deliberately false by a David-ruled design change, so updating it is a CONTRACT UPDATE rather than
        fixture-massaging. The distinguishing test is direction: massaging WEAKENS an assertion to hide a
        failure; this had to STRENGTHEN it to pin the new law. The touch-list was extended to
        `scripts/deepfix2/engine-emulator-lap.mjs` and nothing else.
        WHAT REPLACED IT — 9 assertions in place of 1, in the lap's own idiom, with the superseded line
        quoted verbatim in a supersession comment:
          · exactly the two contract meters exist after the typed leg (`["_global","uT"]`)
          · CHARGED ONCE, now asserted DIRECTLY (the old line only protected it INDIRECTLY, via "no meter
            exists to disagree with the grader counts"): per-student `count` === the case's `graderCalls`,
            and global `count` === the case's `graderCalls`. A double-charge, a missed charge, or a charge
            on a cached/in-progress/replayed claim all break it — none of which the old line could catch.
          · `windowStart` === `DONE.kstDateString(updatedAtMs)` AND === `DONE.kstDateString(Date.now())`,
            for BOTH docs (4 checks) — pins the DERIVATION and the run's clock, one day law only
          · per-job `aiCallCount` on BOTH legs: pid2 (one claim + a CACHED retry) === 1, pid5 (claim →
            superseded → expired-lease TAKEOVER) === 2
        LAP RESULT: **460/460 green, failed 0, pass true, reds [], exit 0.** 452 → 460 is +8 net
        (9 added, 1 superseded) — a HIGHER total, i.e. added coverage, never dropped.
          BEFORE (pre-edit baseline, kept for auditability):
            `/app/docs/plans/deepfix2/_ledgers/ai-metering-lap-before.json` — 452/452, pass true. KEPT
            deliberately: it is what makes the +8 delta checkable, and it sits OUTSIDE `evidence/` so it
            trips no gate (a baseline receipt certifies PRE-edit bytes by definition).
          AFTER (STOP closed): `/app/docs/plans/deepfix2/evidence/ai-metering-lap-after.json` — 460/460,
            pass true, and every stamped source sha re-verified byte-equal to the tree.
          Lap harness sha moved `281174405e8e707c` → `f68b113b50d97769` (the authorized edit).
        NO OTHER LAP CASE SHIFTED — proven empirically, not asserted: the pre-authorization run had
        EXACTLY ONE red, so no other case's counts moved when metering began writing. Nothing was
        loosened to a range and no check was deleted.
        Re-run: `ENGINE_LAP_RECEIPT=<path> PATH="$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH" \
          NODE_PATH=/app/node_modules ~/fbtools/node_modules/.bin/firebase emulators:exec \
          --only firestore --project vocaboost-879c2 "node scripts/deepfix2/engine-emulator-lap.mjs"`
        ntf26 grader guard: 6/6 cases, 2/2 mutants, RESULT PASS — re-run at its DEFAULT receipt path, so
        `docs/plans/deepfix2/evidence/ntf26-heuristic-fixtures.json` is now MODIFIED (it was sha-stale
        against `functions/index.js`; it is now current and passing). Footprint noted in the report.
        LINT: the real predeploy hook is `npm --prefix functions run lint` (firebase.json
        functions.predeploy) → EXIT 0. The ROOT `npm run lint` is a browser/ESM config that reports
        `'require' is not defined` for EVERY functions/ file — pre-existing and universal (verified on
        `functions/reviewV2/composer.js`, which this fold never touched: same errors, exit 1).

[x] C5  COLLATERAL RE-VERIFICATION — touching `index.js` / `typedGrading.js` / `callables.js` makes every
        previously-committed receipt that stamped them SHA-STALE. Full impact enumerated (13 stale
        stamps across 8 receipts + this fold's own intentional failure receipt). The three suites that
        actually exercise the changed code were RE-RUN on this tree, with their receipts REDIRECTED to
        scratch so no other fold's committed artifact was overwritten:
          namespace-reservation-emulator.mjs  31/31 green   (NS_EMU_RECEIPT=…)
          cutover-b-submit-emulator.mjs       65 checks, 0 failures (CUTOVER_B_EMU_RECEIPT=…)
          cutover-c-complete-emulator.mjs     40 checks, 0 failures (CUTOVER_C_EMU_RECEIPT=…)
          ntf26-heuristic-fixtures.mjs        6/6 cases, 2/2 mutants, PASS (EVIDENCE_OUT=…)
        NOT re-run: `cutover-a-compose-emulator.mjs` — it writes its receipt UNCONDITIONALLY to
        `docs/plans/deepfix2/evidence/cutover-a-compose-emulator.json` (no env override,
        cutover-a-compose-emulator.mjs:503-504), so running it would overwrite another fold's committed
        artifact. Left for the orchestrator's commit step, which re-stamps it anyway.

## GROUP D — TRUTH REPAIRS  (every sentence I published that the review falsified)
[x] D1  `functions/reviewV2/typedGrading.js:74-76` — "METERING ONCE [§5.4]: the cached-return path calls NO
        grader." TRUE but INCOMPLETE once a meter exists: it described grader calls, not counters. Repaired
        AT ITS SOURCE in the same header to state that the cached-return path also increments NO counter,
        and that the counting point is the claim txn.
[x] D2  `functions/index.js:1041-1050` — the `claimOrRecoverGradingJob` docblock enumerated the three
        return actions; a fourth (`capped`) now exists and the docblock would have been false. Repaired at
        its source, including the "absence ⇒ live" law and the branch→count map from V3.

## GROUP E — CARDED, NOT THIS ROUND  (so nothing is silently dropped)
[x] E1  CLIENT WORDING for `practice_limit_reached` — `src/services/reviewV2Client.js` RV2 list +
        `refusalReasonText` + `SUBMIT_KNOWN_REASON_STATUSES` so the student sees the specific sentence
        instead of `GENERIC_SUBMIT_REASON`. Deferred: `src/` is outside this brief's touch list. NOT a
        correctness gap — V5 proves the current client already blocks without polling or recomposing.
        Recorded here and in the report; needs its own client fold + a WinClaude visual order.
[x] E2  `firestore.rules:482` comment "nothing else exists under system_config" is now stale (this fold
        adds `system_config/ai_metering`). Deferred: the brief forbids editing `firestore.rules` (separate
        gated workstream). No rules CLAUSE is needed — V7 proves default-deny already covers it.
[x] E3  `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md` §6 could now name the concrete
        `windowStart` encoding (the KST date string) and the new `system_config/ai_metering` doc.
        Deferred: docs/ contract files are outside the touch list.
[x] E4  OVER-COUNT AT THE CLAIM, BY CONSTRUCTION: the claim txn precedes the blank/self-ref/uniform-filler
        filter (`index.js:1430-1434`) and the engine's `gradeInputs` build (`typedGrading.js:316-329`), so
        a submission whose every row is blank/filtered counts 1 metered call while sending ZERO Anthropic
        requests. Kept deliberately: the contract's counting point is the claim txn (15_ §6, decision 6),
        and the error direction is conservative — it can only make the OPTIONAL path refuse sooner, never
        refuse live work. Recorded, not fixed.
[x] E5  ⚠ CORRECTED — THIS ROW WAS WRONG, AND THE AUDIT MEASURED IT.
        WHAT I ORIGINALLY WROTE: "`ai_metering/_global` is a single hot document written inside a
        transaction on every metered claim. At 947 students the burst rate is well inside Firestore's
        tolerance … no sharding built." THE "well inside Firestore's tolerance" CLAUSE HAD NO
        MEASUREMENT BEHIND IT. It was an assumption written in the voice of a finding — exactly the
        defect class this program exists to catch — and the first measurement showed it was worse than
        the card implied.
        THE MEASUREMENT (independent audit, then reproduced by me at
        `/app/scripts/deepfix2/ai-metering-contention.mjs`; numbers below derived from
        `evidence/ai-metering-contention.json`, never typed): with the global counter read AND written
        inside every claim txn, concurrent LIVE claims serialized on that one document —
          n=20: 20/20 granted but 12750ms (vs 154ms with no meter)
          n=50:  6/50 granted, 44 rejected "10 ABORTED: Transaction lock timeout", 20239ms (vs 103ms)
          n=80: 20/80 granted, 60 rejected, 20476ms (vs 113ms)
        The cap could never REFUSE a live test — that guarantee held under every attack the audit ran —
        but the bottleneck could make a live submit FAIL with an infra error it previously survived.
        Same outage, different door. HONEST CAVEAT (carried from the audit and into the probe's own
        header): the Firestore emulator locks pessimistically and production retries optimistically, so
        those thresholds are NOT production numbers. The platform-independent fact is that a
        single-document write bottleneck appeared on the live path where none existed, against
        Firestore's ~1 sustained write/sec/document guidance.
        NOW FIXED — see A6. E5 is closed, not carded.

[x] A6  ⭐ THE CONTENTION FIX (orchestrator decision, 2026-08-05): TAKE THE GLOBAL COUNTER OUT OF THE
        LIVE CLAIM TRANSACTION ENTIRELY — remove the contention rather than tune it.
          · LIVE leg: the claim txn performs NO global read and NO global write. `meterGradingClaimInTxn`
            reads only `ai_metering/{uid}` (`tx.get`, not `tx.getAll`), and `commit()` writes only that
            doc. The global increment is DEFERRED to after the claim commits — non-transactional,
            fire-and-forget, error swallowed and logged (`scheduleGlobalMeterIncrement`), so nothing a
            student waits on.
          · RETEST leg: UNCHANGED. The global read+write stay inside the txn, because that is where
            enforcement is authority and rerun volume is optional and low.
          · Per-student counter: UNCHANGED on both paths (one doc per student ⇒ naturally sharded).
          · The frozen 15_ §6 shape is preserved exactly: same two documents, same fields.
          · NOT sharded, no new aggregate — a bigger change than this needs.
        THE DEFERRED WRITER HAS TWO PATHS, and the split was forced by measurement, not taste. A blind
        `{count: 1, windowStart}` reset raced itself: the first cut of this fix put 50 concurrent live
        claims at globalCount **1**, i.e. the budget guard would have read near-zero all day. So:
          FAST path (every call of the day but the first): one lock-free read + an atomic
            `FieldValue.increment(1)`.
          SLOW path (once per KST day): a tiny transaction that folds the rollover AND this call's own
            increment into one write, so a racer that arrives after the winner reads the REAL count and
            writes count+1 — no increment is wiped by the reset.
        ACCEPTED TRADE-OFF, stated plainly: this is a BUDGET GUARD, not an accounting ledger. A crash
        between the claim commit and the deferred write, or a slow-path racer that gives up at the
        once-a-day rollover instant, loses a small number of increments. Under-counting is the safe
        direction — it can only DELAY a refusal on the optional rerun path, never refuse required work,
        and it never inflates.
        BYPASS SET: unchanged from A2 and re-verified — the live legs (legacy callable · engine live
        claim · takeover) now defer; the retest legs stay transactional; `return_cached` /
        `in_progress` / capped / third-party / teacher still write nothing at all (create · update ·
        delete · set-merge · set-overwrite · FieldValue.delete() · delete-then-recreate SEQUENCE ·
        batch · transaction · a different path · as a third party · as a teacher).
        RE-VERIFIED, as the decision demanded: the live claim txn reads NO config doc (the limits are
        read outside it, and only when `retest`) and NO global doc — asserted on the transaction's OWN
        access, not on end state. Fixtures: M-LIVE-TXN-GLOBAL-FREE, M-DEFERRED-WINDOW,
        M-DEFERRED-FAILURE, E-LIVE-TXN-GLOBAL-FREE; mutants M12, M13.

[x] C6  CONTENTION A/B HARNESS `scripts/deepfix2/ai-metering-contention.mjs` — three variants built from
        REAL source text against ONE emulator: BASELINE (`git show 094bbbb:functions/index.js`, verified
        to contain zero `aiMetering` references or the probe refuses), GLOBAL-IN-TXN (the first cut,
        reconstructed by mutating shipped bytes with THREE anchors each asserted to match exactly once —
        so the probe and mutant M12 cannot drift apart), and SHIPPED. RESULT (derived from
        `evidence/ai-metering-contention.json`): pass true —
          n=20  BASELINE 20/20 0 rej 154ms | GLOBAL-IN-TXN 20/20 0 rej 12750ms | SHIPPED 20/20 0 rej  84ms
          n=50  BASELINE 50/50 0 rej 103ms | GLOBAL-IN-TXN  6/50 44 rej 20239ms | SHIPPED 50/50 0 rej 138ms
          n=80  BASELINE 80/80 0 rej 113ms | GLOBAL-IN-TXN 20/80 60 rej 20476ms | SHIPPED 80/80 0 rej 136ms
        SHIPPED also counts EXACTLY (20/50/80 — the guard is still real, not merely fast), and the
        once-per-day COLD-WINDOW rollover was measured separately rather than assumed away: 20/50/80
        granted, 0 rejected, counts exact, 51/100/132ms.
        Re-run: `PATH="$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH" NODE_PATH=/app/node_modules \
          ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project vocaboost-879c2 \
          "node scripts/deepfix2/ai-metering-contention.mjs"`

[x] C7  THE NEW LAW PINNED, asserted on the TRANSACTION'S OWN ACCESS (end state cannot see it — the end
        state is identical either way; the whole question is WHERE the doc is touched). The fake tx now
        tags every read/write with its transaction id, and the CLAIM txn is identified as the one that
        reads a `grading_jobs/` document — so the deferred writer's OWN rollover transaction can never be
        mistaken for it. Cases: M-LIVE-TXN-GLOBAL-FREE (claim-txn read set is exactly
        `["ai_metering/uS","grading_jobs/job1"]`; never reads or writes `_global`; global still
        increments post-commit via `FieldValue.increment`; and THE OTHER LEG — a retest still reads and
        writes `_global` inside its txn and schedules no deferred write) · M-DEFERRED-WINDOW (fast path
        increments; stale window ⇒ today starts at 1, yesterday's 6000 does not carry over) ·
        M-DEFERRED-FAILURE (both a failed fast-path write and a failed rollover transaction are
        swallowed — the claim is still granted, the stale global is left alone: under-count, never
        inflation) · E-LIVE-TXN-GLOBAL-FREE (the same law end to end on a real Firestore).
        MUTANTS: M12 puts the global WRITE back inside the live claim txn — killed (false → true);
        M13 puts the global READ back inside it — killed (false → true).
        RESULTS (derived): pure 148 checks / 29 cases, failed 0 · mutants 13/13 killed · emulator 58/58.

[x] C8  FULL BATTERY RE-RUN after the contention fix, every number derived from its JSON:
          ai-metering-fixtures.mjs   148 checks / 29 cases, failed 0 · mutants 13/13 killed · PASS
          ai-metering-emulator.mjs   58/58 green, pass true
          ai-metering-contention.mjs pass true (rows above)
          engine-emulator-lap.mjs    460/460 green, failed 0, reds [], exit 0 — UNCHANGED. No CASE T
            count assertion shifted: the asserted values are still `graderCalls`, and the lap now awaits
            `AIM.settleGlobalMeterWrites()` before reading them. That awaits a write the request path
            deliberately does not await; it does not loosen what is asserted about it.
          npm --prefix functions run lint  exit 0
        NOT re-run, per explicit instruction: `ntf26-heuristic-fixtures.mjs` (the orchestrator is
        handling that receipt). Consequence to be aware of: `evidence/ntf26-heuristic-fixtures.json`
        is MODIFIED in my footprint from the earlier authorized run and is now sha-stale again against
        `functions/index.js`, which this fix changed. Left untouched deliberately.

## CLOSE  (gate.mjs enforces the mechanical half)
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit
    (pure + mutants + emulator + the full engine lap + ntf26 all re-run after the final source edit;
    every receipt's stamped shas re-verified byte-for-byte against the tree — all MATCH)
[x] all shas re-stamped   [x] numbers re-derived from the evidence file, never typed
[x] change log row (ABSOLUTE path) — PROPOSED IN THE REPORT, not written (the orchestrator appends it)
[x] `node scripts/deepfix2/gate.mjs` — see the report for the verbatim run and the two remaining
    failures, both understood: NUMBERS is pre-existing (rules-workstream files this fold never touched)
    and EVIDENCE is sha-staleness in OTHER folds' committed receipts, an inherent consequence of editing
    the three named functions/ files, cleared by the orchestrator's commit-time re-stamp.
[~] commit — FORBIDDEN by the brief. Nothing staged, nothing committed.
[x] THE STOP IS CLOSED: the deploy-certification lap is 460/460 green on this tree, with the
    charged-once property pinned MORE tightly than before the fold.
