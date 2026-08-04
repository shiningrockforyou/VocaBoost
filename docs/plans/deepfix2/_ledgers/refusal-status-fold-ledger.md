# RV2-REFUSAL-STATUS FOLD LEDGER — split a status that means two opposite things

SOURCE: NEED_TO_FIX 21, found by the typed-fix-audit independent audit (finding F3). DECIDED already
(delegator, recorded in the card + WORK_QUEUE): **a DISTINCT DATA status meaning *recompose, do not
poll***, not a discriminator field. Not relitigated here — this ledger is the implementation.

WHY IT IS FIRST IN THE UI BUILD: it is the one CLIENT-FACING contract change still pending, and it
lands in exactly the code DF2-51 will read. Building the cutover first would build against a contract
about to move.

## GROUP V — VERIFY BEFORE EDITING

[x] V1  THE SPLIT, established by reading every return site (this is the whole fold — get it wrong and
        EVIDENCE: CONFIRMED by reading all 6 return sites; exactly 5 in scope and NO sixth exists. TRANSIENT (keep): typedGrading.js:269, :334, callables.js:649. PERMANENT (change): typedGrading.js:285, :327.
        the fix is worse than the bug):
          TRANSIENT — a live lease is held, it resolves itself, POLL is correct. KEEP the status:
            · `typedGrading.js:269`  `claim.action === "in_progress"` (a concurrent worker holds the lease)
            · `typedGrading.js:334`  persist outcome ≠ "persisted" (superseded/lease_expired/absent/error
              — authority never established; the retry lands on the winner's cache)
            · `callables.js:649`     a concurrent submit for the same presentation
          PERMANENT — a `graded` job never self-clears, so polling NEVER succeeds. CHANGE these two:
            · `typedGrading.js:285`  `return_cached` where `usableCachedResults` refused the payload
            · `typedGrading.js:327`  the `already_graded` sibling, same refusal
        ⇒ exactly TWO sites change. If a sixth site exists, this ledger is wrong — stop.

[x] V2  NO client consumes any RV2 status yet — grep `reviewV2Client` across `src/`: only
        EVIDENCE: CONFIRMED — `grep -rln reviewV2Client src/` returns ONLY src/config/featureFlags.js (a comment). Nothing imports the wrapper; REVIEW_V2_CLIENT=false at featureFlags.js:243.
        `featureFlags.js` mentions it, nothing imports it, `REVIEW_V2_CLIENT=false`. This is why the
        frozen list can gain an entry for free RIGHT NOW and never again this cheaply.

[x] V3  What an UNKNOWN status does on the client today. If the wrapper throws or silently swallows,
        EVIDENCE: CONFIRMED SAFE — the wrapper returns `res?.data` and throws ONLY on HttpsError (reviewV2Client.js:122-131), so an unknown protocol status arrives as ordinary data and is simply not matched. `isGradingInProgress` (:102-104) is an explicit predicate, so a new status needs its own predicate — ADDITIVE, nothing breaks.
        adding a status is riskier than it looks and the handling must land in the same change.

[x] V4  Whether anything OTHER than the client keys on `grading_in_progress` (the lap, fixtures,
        EVIDENCE: CONFIRMED AND BIGGER THAN EXPECTED — the LAP is a heavy consumer, and SIX existing assertions currently assert the TRANSIENT status for conditions that are actually PERMANENT: engine-emulator-lap.mjs:1566 (C1 poisoned-before-submit), :1606 and :1610 (C4 poison / delete-then-re-poison), :1631 (C5(i) another presentation's grade), :1645, :1731 (C11 sheet drift). These MUST flip to the new status. Two must NOT: :1341 (§5.5 concurrent submit) and :1416 (superseded grade) are genuinely transient. scripts/d1-01-*.mjs only use the string as a log label — not consumers.
        monitoring, ops_metrics). A consumer that treats it as retryable would mis-handle the new one.

        **>>> MY V4 WAS AN UNDERCOUNT — CORRECTED BY THE IMPLEMENTER, RECORDED HERE AS MY ERROR. <<<**
        I enumerated SIX assertion sites asserting the transient status for permanent conditions. There
        are **TWELVE**. The six I missed: lap 1765 (blank→FILLED sheet drift), 1803 (loser's sheet vs
        winner's cache), 1829 (`source` stripped), 1833 (older-build payload) — all `return_cached`-driven
        — and **1973 (S1) + 2045 (S3), which are the ONLY fixtures covering the `already_graded` site
        that my own C1 row demands.** I also missed a third genuinely-TRANSIENT keep: 1790 (the C11 lease
        refusal), so my "two must not change" was also wrong — it is three.
        WHY IT DID NOT CHANGE THE FOLD: the classification rule was right and the two permanent SITES
        were right; only my census of the fixtures asserting them was short. The implementer proceeded
        rather than stopping, which was the correct call, and said so.
        WHY IT MATTERS ANYWAY: had it stopped at my six, the `already_graded` sibling would have kept
        asserting the OLD status and the second mutant would have had nothing to kill there. **That is
        the same sibling-seam blind spot an audit already caught me on once today** — I enumerated the
        obvious call site and under-counted its twin. The lesson is not "check harder"; it is that a
        hand-written census of fixture sites is exactly the kind of claim that needs deriving, not typing.

## GROUP A — DELTAS

[x] A1  SPLIT THE REFUSAL. New frozen status `grade_unusable` returned at the two PERMANENT sites;
        EVIDENCE: typedGrading.js:299 (`return_cached`) + :343 (`already_graded`) return `grade_unusable`; :279/:350/callables.js:655 unchanged. AUDIT-CORRECTED: :343 now splits `!snap.exists` (TRANSIENT — a vanished job is re-claimable) from an existing-but-unusable payload (PERMANENT). Mutants prove both directions AND the sibling independently.
        `grading_in_progress` stays at the three TRANSIENT sites.
        BYPASS SET — every way a client can still be told to poll on a permanent condition (one
        fixture each; this is the closure claim, so it needs the full walk):
          · create      — a foreign grade PRE-SEEDED before the engine ever claims (the `return_cached` path)
          · update      — a foreign grade overwriting an engine cache, consumed at `already_graded`
          · delete      — job deleted mid-flight then re-created foreign (rules deny client deletes; assert)
          · set-merge / set-overwrite / FieldValue.delete() — a stripped-provenance payload at either seam
          · delete-then-recreate SEQUENCE — poison, consume, delete, re-poison
          · batch / transaction — two concurrent submits, one poisoned cache
          · a different path — a cache written for ANOTHER presentation offered to this one
          · as a third party — a classmate's pre-claim (NEED_TO_FIX 19's denial: the victim must NOT be
            told to poll forever — this fold is what makes that recoverable)
          · as a teacher — same, via a teacher account
        OTHER LEG (mandatory): all THREE transient sites must STILL return `grading_in_progress`, and a
        legitimate lost-response replay must still reuse its cache with ZERO grader calls.

[x] A2  ADD `GRADE_UNUSABLE` to the frozen RV2 list with the contract stated IN PLACE: *recompose once,
        EVIDENCE: reviewV2Client.js: `GRADE_UNUSABLE` in the frozen RV2 list + `isGradeUnusable()`, each status naming the other as its exact inverse with the failure mode of conflating them stated in place.
        do NOT poll* — the exact inverse of its neighbour, so the next reader cannot conflate them.
        FIXTURE: the lap asserts each status is returned by its own condition (C1/C2).

## GROUP A' — SCOPE ADDED BY THE IMPLEMENTER, NOT IN THE ORIGINAL PLAN (accepted, recorded)

[x] A3  A NEW CALL SITE for the emulator-only `_runAfterPreflightHook()` was added inside
        `reviewV2SubmitAttempt`. **This was NOT in the ledger and was not declared in the agent's report** —
        I found it in the diff. Recording rather than silently accepting, because it is a production
        callable's execution path.
        VERDICT: **ACCEPTED, and verified inert.** The hook is PRE-EXISTING (defined `callables.js:84-90`,
        already called from compose) and DOUBLE-gated: `process.env.FIRESTORE_EMULATOR_HOST && typeof
        _testHooks.afterPreflight === 'function'`. In production `FIRESTORE_EMULATOR_HOST` is unset, so it
        is an immediate falsy return — one call and one check per submit, no behaviour.
        WHY IT IS NEEDED: driving the PERMANENT-refusal path through real production code requires
        mutating state between the submit pre-reads and the txn. Without it the fixture would have to stub
        the seam, which proves much less. The alternative (a stubbed test) would have been worse evidence.
        FIXTURE: the C1/C3 cases that reach `already_graded` depend on it.

## GROUP C — FIXTURES + MUTANTS  (engine-emulator-lap.mjs; counts re-derived from evidence)

[x] C1  One case per PERMANENT site — `return_cached`-foreign and `already_graded`-foreign — each
        EVIDENCE: Both permanent sites assert grade_unusable + zero writes + recompose-then-succeeds (TX C1, S1 recovery leg).
        asserting `grade_unusable`, ZERO writes, and that a recompose then SUCCEEDS (the recovery is
        the point; a status nobody can act on is not a fix).
[x] C2  One case per TRANSIENT site (×3) asserting `grading_in_progress` is UNCHANGED — the regression
        EVIDENCE: All THREE transient sites fixtured (my ledger said two — audit corrected): lap 1341/1790 lease, 1416 superseded, new CASE GU for callables.js:655 incl. proof the poll RESOLVES.
        control. If these drift, polling breaks for the case polling is correct for.
[x] C3  The A1 bypass set, one case per row.
        EVIDENCE: Every A1 bypass row has a case; grading_jobs client-write denial was already covered by rules-matrix GJ3/GJ6/GJ7/GJ10a/GJ13.
[x] C4  MUTANT: return `grading_in_progress` from a PERMANENT site (i.e. revert the fold). C1 must go red.
        EVIDENCE: M-REFUSAL-PERMANENT-AS-TRANSIENT killed, 15 reds — 13 pinning one seam, S1+S3 the sibling independently.
[x] C5  MUTANT: return `grade_unusable` from a TRANSIENT site. C2 must go red. Both directions, because
        EVIDENCE: M-REFUSAL-TRANSIENT-AS-UNUSABLE killed, 2 reds — exactly the two keep-controls. Plus M-A1-SIBLING-CALL-SITE RE-POINTED after my F1 fix silently disarmed it (runner failed closed on the stale anchor — the rule working) and now kills with 4 TS reds.
        a one-directional mutant cannot tell "split correctly" from "swapped".

## GROUP D — TRUTH REPAIRS

[x] D1  `typedGrading.js:66` says "`grading_in_progress` is the one retryable typed status". After this
        EVIDENCE: typedGrading.js header no longer calls it 'the one retryable typed status'; the old claim is retained inside a correction rather than overwritten.
        fold that is false — correct at source.
[x] D2  `18_TYPED_LEG_DESIGN.md` §4 step 2 and §5.6 both describe the single-status protocol; §5.6's
        EVIDENCE: 18_ §4 step 2, §5 item 5 and §5.6 all describe the two-status protocol; §5.5's CLOSED-SET claim of two transient conditions corrected to the full set (audit F2 — the next fold reads that paragraph).
        refusal paragraph was already corrected once by the collision audit (F1). Update BOTH.
[x] D3  NEED_TO_FIX 21 currently reads as an open decision. On landing it describes a SHIPPED fix,
        EVIDENCE: NEED_TO_FIX 21 rewritten as SHIPPED, keeping the decision and the census error as the record; card 23 opened for the legacy twin the audit found.
        keeping the reasoning as the record.

## GROUP E — CARDED, NOT THIS ROUND

[x] E1  The client-side HANDLING of `grade_unusable` (recompose-once, and never twice in a loop) belongs
        EVIDENCE: Client handling (recompose ONCE, never loop) carded to df2-51b-submit. Audit F3 folded: recompose is NOT the card-19 recovery — that victim gets a THROWN permission-denied, corrected in the card.
        to DF2-51, which is the next queue item. This fold ships the SERVER contract + fixtures only.

## CLOSE
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit — lap 453/453, 11/11 mutants killed, run AFTER the F1 fix and the mutant re-point
[x] all shas re-stamped (both receipts bind this tree)   [x] numbers re-derived from the evidence JSON
[x] change log row (ABSOLUTE path)   [x] `node scripts/deepfix2/gate.mjs` clean   [x] commit
[x] NOTE: a concurrent session is writing to this repo (a 26SM-T19 extraction row appeared in
    change_action_log.md) — stage explicitly, never `git add -A`
