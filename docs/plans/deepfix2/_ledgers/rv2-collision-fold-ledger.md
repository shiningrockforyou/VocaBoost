# RV2-DOCID-COLLISION FOLD LEDGER — **ACTIVE** (renamed back from -PLAN; work has begun)

> Renamed back to `-fold-ledger` as promised the moment the first edit began, so `gate.mjs`
> now enforces every row again.

STATUS: **ACTIVE.** The rules deploy (order 97) is COMPLETE and verified, so the reason for holding is gone —
this change touches the very docId reasoning that the artifact being deployed reasons about
(`firestore.merged.rules` attempt-create docId guard + the `grading_jobs` comment), and the tree
cannot be committed while an executor holds the turn.

SOURCE: NEED_TO_FIX card 18, found by the typed-fix-audit lap; independently confirmed in code by me
(`presentations.js:398` `qId = queueDocId(classId,listId,logicalDay,resetEpoch)` → `:445`
`presentationId = ${qId}_p${seq}`; `:474`/`:489` for the rerun family — **no uid in any of them**),
and corrected by the audit (NOT "both students blocked").

## GROUP V — VERIFY BEFORE EDITING

[x] V1  The collision is in the DERIVED GLOBAL ids only, not in the presentation store.
        EVIDENCE: CONFIRMED. Every presentation/queue/counter/compose_key doc is under `users/{uid}/` (presentations.js:320-322, :348, :399, :462, :475, :522). The ONLY global collections deriving an id from presentationId are `attempts` and `grading_jobs`. Nothing else to move.
        `users/{uid}/review_presentations/{pid}` and `users/{uid}/review_queues/{qid}` are uid-scoped BY PATH,
        so they never collide. `attempts/{id}` and `grading_jobs/{key}` are TOP-LEVEL. Confirm no other
        global collection derives an id from `presentationId`.

[x] V2  Enumerate EVERY derivation site (must all move together or the legs split):
        EVIDENCE: CONFIRMED — exactly TWO production derivation sites: `callables.js:532` (`attemptId`) and `typedGrading.js:239` (`jobKey`). All other `rv2_` occurrences are lap fixtures or comments.
        `callables.js:532` `attemptId = rv2_${d.presentationId}` · `typedGrading.js:170`
        `jobKey = rv2_${presentationId}`. Grep for any third.

[x] V3  Enumerate every CONSUMER that binds to the derived id — changing the scheme without these is a
        EVIDENCE: CONFIRMED — consumers: `callables.js:788` writes `serverClaim.attemptDocId`; `completion.js:412` and `:482` COMPARE it; `presentations.js:365`/`:539`/`:551` initialise it. Plus lap fixtures at :140/:539/:650/:684. All must keep agreeing with whatever the derivation produces.
        silent evidence break: `callables.js:788` writes `serverClaim.attemptDocId`;
        `completion.js:412` and `:482` compare it; `presentations.js:365`/`:539`/`:551` initialise it.

[x] V4  Whether ANY id is already persisted in production under the OLD scheme. The engine is dark and
        EVIDENCE: CONFIRMED BY A READ-ONLY PRODUCTION QUERY: **0 documents with an `rv2_` id in `attempts` AND 0 in `grading_jobs`.** ⇒ NO MIGRATION. This is a pure forward-scheme change. (Legacy grading_jobs keys are already uid-prefixed — `{uid}_vocaboost_t…` — so a uid-bearing key is the existing convention, not a novelty.)
        the provenance scan found **0/41,680** attempts carrying an engine key, so the expected answer is
        "none" — but re-confirm before choosing migration-free.  ⇒ if zero, NO migration is needed and the
        change is pure forward-scheme.

[x] V5  Whether the deployed rules artifact constrains the NEW id shape. `attemptId.matches('.*[Mm]anual.*')`
        EVIDENCE: CONFIRMED against the DEPLOYED ruleset (`firestore.live.rules:312`): `&& !attemptId.matches('.*[Mm]anual.*')`. A uid containing 'manual' would make `rv2_{uid}_{pid}` match it — but that clause gates CLIENT creates only, and the engine writes attempts through the Admin SDK, which bypasses rules. So the engine is unaffected and the only effect is that such a client create is DENIED, which is the fail-safe direction. No new id shape is required.
        is denied for client creates — a uid-bearing id must not accidentally match it, and must still be
        deniable for client creation. Check against the DEPLOYED ruleset, not the draft.

[x] V6  Whether `grading_jobs` rules still bind: the doc is server-written only (`allow create,update,delete:
        EVIDENCE: CONFIRMED (`firestore.live.rules:415-418`): `grading_jobs` read is gated on `resource.data.uid == request.auth.uid` — a FIELD, not the docId — and all client writes are `if false`. Re-keying the document changes nothing about who can read or write it.
        if false`), and the owner-read rule keys on `resource.data.uid` — confirm a uid-scoped KEY does not
        change who can read what.

## GROUP A — DELTAS

[x] A1  UID-SCOPE THE TWO DERIVED GLOBAL IDS, together, in one change.
        DONE as `rv2_{uid}_{presentationId}` from ONE shared function, so the two legs CANNOT drift:
          · `functions/reviewV2/composer.js:117` `engineDocId(uid, presentationId)` (exported :448)
          · `functions/reviewV2/callables.js:550` `attemptId  = engineDocId(uid, d.presentationId)`
          · `functions/reviewV2/typedGrading.js:260` `jobKey   = engineDocId(uid, presentationId)`
        Placed in composer.js because it already owns the deterministic docId scheme (`queueDocId`,
        `cursorDocId`) and requires only crypto/firestore/config.js ⇒ the new
        `typedGrading → composer` edge creates NO require cycle (verified by load + the lap).
        CONSUMERS (V3) NEEDED NO CHANGE — they carry the VALUE, not the scheme: `callables.js:807`
        writes `serverClaim.attemptDocId`, `completion.js:412`/`:482` compare it,
        `presentations.js:365`/`:539`/`:551` initialise it. Lap fixtures at `:140`/`:539`/`:650`/`:684`
        use hand-written ids ("attE1") and are untouched by design.
        BYPASS SET — every row fixtured, see C2. OTHER LEG — see C3.
        Original ledger candidate text kept: `rv2_{uid}_{presentationId}` for both
        `attempts/{id}` and `grading_jobs/{key}`; bypass set = create · update · delete · set-merge ·
        set-overwrite · FieldValue.delete() · delete-then-recreate SEQUENCE · batch · transaction ·
        a different path (SAME presentationId under a DIFFERENT uid) · third party · teacher.

[x] A2  DECIDED (delegator, not delegated): **uid goes in the DERIVED id, NOT in presentationId**
        DECISION + REASON: `presentationId` is already uid-scoped BY PATH, so it does not need the uid;
        and it is written into review_presentations, registered in compose_keys, echoed to the client and
        compared in several places — changing it has a far wider blast radius than the defect warrants.
        The defect is precisely that a PER-USER id is used to key GLOBAL collections, so the scope belongs
        exactly where that transition happens: at the derivation. Principle to carry forward: **when an id
        crosses from a scoped namespace into a global one, it must acquire the scope it is losing.**
        (`presentations.js:445`). The latter fixes it at the root for any future derived id but changes a
        value already written into `review_presentations` documents and echoed to the client.
        Record the choice and its reason in 18_ — not just in code.
        FIXTURE: whichever option is chosen, C1 (two students, one class) is the case that
        discriminates them — and if the PRESENTATION id is changed, add a case asserting the client-echoed
        presentationId and the stored review_presentations docId still agree (they are the same value today).

## GROUP C — FIXTURES + MUTANTS

[x] C1  INVERTED IN PLACE, not deleted — `engine-emulator-lap.mjs` CASE TR item (10), now :2154-2216.
        (Ledger said :1898-1915; the block had drifted to :2096-2131 pre-edit. Line drift only — the
        case and its assertions were exactly as described. NOT a false premise.)
        The colliding INPUT is asserted FIRST ("two students in one class still derive the SAME
        presentationId") so the fixture cannot silently stop testing the defect if presentationId ever
        changes. Then, each labelled `(INVERTED)` with the old assertion quoted in a comment:
        both students land · TWO documents each with its own owner+grade · each id IS the uid-scoped
        derivation and the OLD `rv2_{pid}` holds NOTHING · each presentation claims its OWN attempt.
[x] C2  `engine-emulator-lap.mjs:2227` CASE RC — 40 assertions, one section per bypass row:
        create · update · delete · set-merge · set-overwrite · FieldValue.delete() ·
        delete-then-recreate SEQUENCE · batch (ONE atomic commit CROSS-PLANTING both students) ·
        transaction (two CONCURRENT submits of ONE presentationId — the shape that previously
        guaranteed a loser) · a different path (same pid, different uid) · third party (student B
        claims A's FULL uid-scoped grading-job key through the LIVE `gradeTypedTest`) · teacher.
        Each set-merge/set-overwrite/batch row also asserts the OLD colliding id is now INERT.
[x] C3  CASE RC "SOLO" rows, class `cSolo`: lands identically · idempotent replay returns the SAME
        normalized envelope · replay performs ZERO writes (updateTime frozen + collection size fixed) ·
        `completeDay` still binds its evidence through the derived id.
[x] C4  MUTANT `M-A1-UID-SCOPE-REVERT` (`typed-seam-mutants.mjs:119-129`, file composer.js) reverts
        `engineDocId` to `rv2_${presentationId}` — ONE edit reverting BOTH legs, i.e. exactly the
        pre-fix state. KILLED. Evidence `docs/plans/deepfix2/evidence/typed-seam-mutants.json`:
        mode "crash", exit 1, redCount 3, ALL THREE in the collision canary:
          · "RC0 BOTH students land — neither is refused, neither replays the other"
            got ["attempt_written",false,100,"presentation_invalid",null,null]
          · "RC0 the SERVER-RETURNED ids are uid-scoped and distinct"
            got ["rv2_cZ_LZ_d3_e0_p1",null,true]
          · "RC0 nothing is written at the id the OLD unscoped scheme derived"  got [true,1]
        WHY A CANARY EXISTS (`engine-emulator-lap.mjs:177` CASE RC0, placed FIRST): every case from CB
        onward dereferences a document at the derived id, so a scoping revert kills the lap with a
        TypeError at `:1027` before CASE RC/TR ever run — a red run that names NO assertion. RC0 is
        crash-free by construction (it asserts on the ids the SERVER returns, never on a document it
        assumes exists). The runner was also taught to fall back to the in-run `  RED …` lines when the
        lap crashes, so a crashed mutant no longer reports "killed by nothing".
[x] C5  CASE RC TYPED rows, class `cTy` — typed FROM THE FIRST COMPOSE. NOTE (a fixture bug caught by
        the lap, not by review): for a live review the modality is the DAY QUEUE SNAPSHOT's
        (`presentations.js:407`), so the first attempt — flipping `reviewTestType` on a class whose
        day-3 queue already existed — kept composing MCQ and the "typed" fixture was green while never
        being typed. Now asserted explicitly (`testType === "typed"` for both students) before use.
        Both students land · SEPARATE grading job per student under its OWN key with its OWN `uid` ·
        nothing at `grading_jobs/rv2_{pid}` · each sheet graded exactly once · the second student's
        submit (which is what used to throw `permission-denied`) asserted to throw NOTHING.

## GROUP D — TRUTH REPAIRS

[x] D1  DONE (delegator). `NEED_TO_FIX.md` and `docs/plans/deepfix2/WORK_QUEUE.md` are on the
        EVIDENCE: NEED_TO_FIX card 18 retitled to FIXED and rewritten to describe the fix (engineDocId at composer.js:117 used by callables.js:550 + typedGrading.js:260), keeping the audit-corrected impact statement as the historical record and adding the namespace-not-a-fence warning and the crash-free-canary lesson. WORK_QUEUE `rv2-docid-collision` marked [x] with the same substance.
        do-not-touch list for this delegation ("I am editing those"). Card 18 + the queue item still
        describe the DEFECT and must be turned into the FIX, keeping the corrected impact statement
        (first student lands, second refused) as the historical record.
[x] D2  `18_TYPED_LEG_DESIGN.md` §3 (new CORRECTION block) + §4 step 2 corrected AT SOURCE, including
        WHY the uid did NOT go into presentationId, the published principle, the zero-migration
        finding, and the fixture/mutant refs. The pre-existing §3 D1 correction was also updated:
        "a student can claim `rv2_{their presentationId}`" → `rv2_{any uid}_{any presentationId}`,
        since the uid scoping is a NAMESPACE and not a fence.
[x] D3  `callables.js:32`/`:34` (+ a new D3 paragraph naming the false claim), `:117`
        (`isEngineAttemptFor` header) and `:613` (the in-txn comment); `typedGrading.js:13-25`
        (+ `:165`); and `functions/index.js:2202`, which repeated the same key shape.

## GROUP E — CARDED, NOT THIS ROUND

[x] E1  `gradejob-namespace` (NEED_TO_FIX 19) stays separate: it touches the LIVE grading path for 947
        EVIDENCE: carded as NEED_TO_FIX 19 + WORK_QUEUE `gradejob-namespace`; still deliberately separate.
        students and needs its own fold + deploy order.

## CLOSE
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit — BY ME, not quoted: lap 445/445 · 8/8 mutants killed · deployed rules still 262/262
[x] all shas re-stamped (both receipts sha-bound to this tree)   [x] numbers re-derived from the evidence JSON
[x] change log row (ABSOLUTE path)   [x] `node scripts/deepfix2/gate.mjs` clean   [x] commit
[x] the order-97 hold is moot — the deploy COMPLETED and was independently verified before this fold began
