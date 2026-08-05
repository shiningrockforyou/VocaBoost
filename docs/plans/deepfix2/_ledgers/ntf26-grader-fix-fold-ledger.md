# NTF-26 GRADER FIX — FOLD LEDGER (built from the FULL brief + the two assessment evidence JSONs)

Fold: `ntf26-grader-fix` · 2026-08-04/05 · brief `_ledgers/ntf26-grader-fix-BRIEF.md`
Defect: `NEED_TO_FIX.md` item 26 — ≥~10 identical rows of the literal string "answer"/"answer1" in ONE
`gradeTypedTest` call are ALL marked correct (schema confusion: `student` reads as placeholder data at
scale, and "Default to CORRECT" resolves the ambiguity the wrong way). Measured, 3/3 runs, promptSha
`153ba85f92a24caf` — `evidence/ntf26-grader-leniency-{baseline,round2}.json`.
COMMITTED-NOT-DEPLOYED: this fold ships NO deploy. The live path for 947 students is unchanged until
`functions-deploy-engine` runs (David executes).

EVERY NUMBER BELOW IS DERIVED FROM (never typed into) these two receipts:
  · `docs/plans/deepfix2/evidence/ntf26-grader-fix-postfix.json`   (harness, RUNS=3, live model)
  · `docs/plans/deepfix2/evidence/ntf26-heuristic-fixtures.json`   (leg-3 cases + mutants + wiring)
Post-fix promptSha `7345c8d4a2d92ada` (5986 chars) · functions/index.js sha16 `6b650d2fdc71a8f2`.

FOLLOW-UP ROUND (post-audit, same fold): the independent auditor REFUTED A1's original
"the over-tightening hazard did not materialise". It DID materialise — see A1 and E5. Leg 1's wording
was softened (2 iterations, the ceiling), case (g) was added to the harness, and the residue is
recorded honestly rather than closed. Wording history: `bfdf8f22165faa61` (v1, over-tight) →
`3a49cbf6b00f5fc2` (v2, fixed (g) but REOPENED the exploit at 19/20) → `7345c8d4a2d92ada` (SHIPPED).

## GROUP V — VERIFY BEFORE EDITING  (a guard is only "inert" if no live writer exists)

[x] V1  The prompt to harden is ONE template literal, uniquely anchored, with NO `${}` interpolation.
        VERIFIED pre-edit: `grep -c "const systemMessage = \`" functions/index.js` = 1; the literal ran
        :1356-1437 with rules 1-4 at :1360-1364, "Everything else is CORRECT" at :1366 (count 1),
        `<examples>` :1369-1425, the 4 WRONG examples :1410-1424; `awk 'NR>=1356&&NR<=1437 && /\$\{/'`
        returned NOTHING. Post-edit the literal is `functions/index.js:1450-1526`, still exactly 1
        anchor occurrence, still no interpolation (harness extraction succeeded — it hard-fails on `${`
        at grader-regression.mjs:70-73).
[x] V2  The blank / self-ref pre-filters are REAL and run before the AI, and `answersToGrade` is the
        exact list the AI sees. `isBlankResponse` `functions/index.js:168`; `isSelfReferencing` :179;
        the chain `gradeable`:1304 → `blankAnswers`:1306 → `nonBlank`:1309 → `selfRefAnswers`:1312 →
        `answersToGrade`:1315 (pre-edit numbering). ⇒ leg 3 inserted AFTER that chain, now at
        `functions/index.js:1402-1424`, NOT at :168.
[x] V3  `finishGrading` takes ONE flat array of `{wordId,isCorrect,reasoning}` and TWO exits reach it:
        the no-AI-needed early return (pre-edit :1338-1340) and the graded return (:1598).
        `combinedResults` (pre-edit :1519-1521) is the merge point; post-grade validation :1544-1584
        only ever downgrades `true→false`, so a pre-AI `false` cannot be re-upgraded. BOTH exits now
        carry the new rows — `functions/index.js:1430-1434` (early) and :1621 (merge) — and BOTH are
        fixtured live (W1/W2 below), which is what proves the early exit is not a dropped-rows bug.
[x] V4  The engine typed leg consumes the SAME grader, grade-ONLY.
        `functions/reviewV2/typedGrading.js:144` `defaultGrade` → :146 `surface.gradeTypedTest.run(
        {data:{answers, listId, classId}, auth:{uid}})` → reads `res.results` (:150); `buildTypedRows`
        :228-260 reads `verdict.isCorrect` (boolean) + `verdict.reasoning`. A pre-AI `{wordId,
        isCorrect:false, reasoning}` row is INDISTINGUISHABLE from an AI row to that consumer ⇒ the
        engine gets `isCorrect:false` + student-facing reasoning, NOT `ungradeable`. PROVEN by fixture
        W1/W2, which call that exact `.run()` entry point and assert row count, order and verdicts.
[x] V5  `functions/index.js` IS require-safe under plain node (`node -e "require('/app/functions/
        index.js')"` → `LOADED_OK keys= 25`), and a NON-callable object export already exists at
        `functions/index.js:2379` `exports._gradingJobs = {…}`, whose own comment (:2375-2378) records
        WHY that is deploy-inert: "the runtime loader only registers exported functions carrying
        `__endpoint`". ⇒ the brief's preferred option (export a pure helper from index.js) is
        available; NO new module was created. Re-verified post-edit: `_uniformFiller.__endpoint` is
        `false` while `gradeTypedTest.__endpoint` is `true`.
[x] V6  THREE repo scripts extract the prompt with the SAME regex — `scripts/grader-regression.mjs:69`,
        `scripts/grader-check-english-def.mjs:38`, `scripts/grader-replay-yyj.mjs:37`
        (`/const systemMessage = \`([\s\S]*?)\`;/`). ⇒ the prompt edit MUST NOT introduce a backtick or
        a `${`. It did not: the post-edit extraction returns 5391 chars / promptSha `bfdf8f22165faa61`
        and the harness ran green against it. The other two scripts are UNTOUCHED and still match.
[x] V7  The exploit STILL REPRODUCES ON THIS CHECKOUT before any edit. `RUNS=1` 20×"answer" one-call
        probe against the extracted live prompt → promptSha `153ba85f92a24caf`, systemChars 4774,
        **20/20 marked CORRECT** (`EXPLOIT REPRODUCED ON THIS CHECKOUT: true`). Re-proved a second way
        AFTER the edits, with the SHIPPING instrument, against a byte-copy of the OLD prompt: batch
        (a) 20/20, (b) 10/10, (c) 20/20 and (f) 20/20 all FALSE-ACCEPT, 2/6 cases passed, exit 1
        (`SECTIONS=batch PROMPT_FILE=<pre-fix copy>`). That second run is what proves the new batch
        cases are NOT vacuous — they fail on the old prompt and pass on the new one.

## GROUP A — DELTAS

[x] A1  LEG 1 — PROMPT HARDENING, add-only relative to HEAD, everything else byte-identical.
        (1) the rules paragraph — student value is ALWAYS literal typed text, never a
            placeholder/sample/template however many rows repeat it; filler that says nothing about
            the word it is answering is rule 3 WRONG in a request of 20 rows exactly as in one; THE
            ONE EXCEPTION IS NARROW AND PER-ROW — if that word's own definition is that very thing,
            that row is CORRECT, and it "excuses only the row whose meaning it actually is — every
            other row answered with the same filler is still WRONG"; repetition by itself is not
            wrongness.
        (2) TWO worked examples at the end of `<examples>`: `reply ← "answer" → CORRECT` then
            `vitriolic ← "answer" → WRONG`, in that order. The WRONG one is LAST deliberately (see
            below). "reply" is HELD OUT of case (g) on purpose, so (g) measures generalization.
        ADD-ONLY PROVED BY BYTE DIFF of the EXTRACTED prompt (HEAD vs shipped): **0 deleted lines**
        (`diff -u prompt-BEFORE.txt prompt-AFTER.txt | grep -c '^-[^-]'` = 0).
        4774 → 5986 chars; promptSha `153ba85f92a24caf` → `7345c8d4a2d92ada`.
        THE OVER-TIGHTENING HAZARD MATERIALISED — this row previously claimed it did not, and that
        claim was FALSE. The first wording enumerated filler as bare strings, and the model read the
        enumeration as a BLACKLIST: `ordeal ← "test"` went CORRECT (HEAD, 3/3) → WRONG (v1). That is
        a REGRESSION this fold introduced, and it is now FIXED (`ordeal` 3/3 CORRECT on the shipped
        wording, harness case (g)). [RESTATED by the ORCHESTRATOR per the delta re-audit — the first
        audit was NOT mismeasured; the verdicts are SPEC-SENSITIVE at the model's decision boundary:
        with the gloss "a reply, especially a sharp or witty one", rejoinder←"answer" is CORRECT on
        HEAD 3/3 (the audit's row); with case (g)'s gloss "a sharp reply", it is WRONG on HEAD 3/3
        (the implementer's row). Likewise solution←"answer" flips between glosses. Durable lesson: a
        green case (g) certifies THOSE THREE GLOSSES, not the class. The residual false-reject is
        PRE-EXISTING for the (g) row and v3 restores HEAD behavior on every other measured row —
        zero fold-caused false-rejects remain (delta audit, own runs).] Iteration 2 of 2 (`3a49cbf6b00f5fc2`) fixed
        all three (g) rows but REOPENED the exploit — batch (a) 19/20 correct — which is why the
        exception is now explicitly per-row and the WRONG example is last. Iteration ceiling reached;
        the residue is ACCEPTED and guarded, not silently closed (E5).
        BYPASS SET — enumerated and fixtured. NOTE the surface: this fold changes NO Firestore write
        path, so the verb list (create · update · delete · set-merge · set-overwrite ·
        FieldValue.delete() · delete-then-recreate SEQUENCE · batch · transaction) is N/A BY
        CONSTRUCTION — verified in the diff: 11 hunks, all inside one template literal, one pure
        helper, one pre-AI branch and one plain-object export; zero `db.`/`set(`/`update(`/rules
        edits. The real bypass surface is the GRADER'S INPUT SPACE, so the set is the leniency
        taxonomy from the assessment, each with its fixture and its post-fix result (RUNS=3):
          · A-filler (single) …………… harness singles culminate/dispel/grief/run → 9/9 PASS
          · B-plausible-EN (single) …… baseline JSON 0/3 accepted + harness `dispel` control PASS
          · C-plausible-KO (single) …… baseline JSON 0/3 accepted
          · D-unrelated-real (single) … baseline JSON 0/3 accepted
          · E-batch-filler ……………… (a) 20×"answer" 0,0,0 · (b) 10×"answer" 0,0,0 · (c) 20×"answer1" 0,0,0
          · F-batch-plausible ………… baseline JSON 0/20; re-covered by (e)'s positives staying green
          · MIXED ………………………… (d) 10 filler + 10 genuine INTERLEAVED → 10,10,10 correct (exactly the
            genuine half; zero collateral)
          · POSITIVES (over-tightening) (e) 20 genuine, all different → 20,20,20 + all 9 singles PASS
            incl. both Korean-acceptance rows and the 불협화믐 typo row
          · FILLER-STRING-IS-THE-MEANING (g), the audit's finding, singles expect TRUE:
            `solution ← "answer"` true,true,true · `ordeal ← "test"` true,true,true (the regression,
            now fixed) · `rejoinder ← "answer"` false,false,false = KNOWN-ACCEPTED, pre-existing on
            HEAD (E5). Held out of the prompt, so these measure generalization, not recall.
          · HEURISTIC-BYPASS-BY-VARIATION (f) 20 VARIED "answerN" → 0,0,0. NEW FINDING: this shape
            scored 20/20 on the OLD prompt, so it was a second live exploit the assessment never
            tested, and leg 3 does NOT catch it (identical strings only) — leg 1 alone closes it.
        OTHER LEG: the leg NOT changed is the false-REJECT leg (0992f5f's Korean-acceptance framing,
        rules 1/2/4, all 11 positive examples) — fixtured by the 9 unchanged singles + batch (e),
        both green across every wording iteration. That is exactly why the over-tightening slipped
        through the first time: the false-reject leg those fixtures cover is the KOREAN-ACCEPTANCE
        one, and the regression landed on a leg NOTHING covered — an ENGLISH word whose meaning IS
        the filler string. Case (g) is that missing coverage, and it exists because the audit
        found it, not because the fixture set predicted it.

[x] A2  LEG 2 — `scripts/grader-regression.mjs`: BATCH mode + machine-readable evidence.
        All 9 original single cases kept verbatim (`:79-89`) and the exit-code law kept and
        STRENGTHENED. Adds: the 20-triple assessment word bank `:94-115` (copied verbatim from the
        probe, so pre/post is apples-to-apples), batch cases (a)-(f) `:152-159`, per-row `expect`,
        `SECTIONS=singles|batch|all|none` `:57-59` (none = zero-spend dry run), `EVIDENCE_OUT` `:60`
        defaulting to `docs/plans/deepfix2/evidence/ntf26-grader-fix-postfix.json` with per-case
        per-row verdict arrays, `promptSha` and `sourceShas`.
        FOLLOW-UP: case (g) added as `CASE_G` (3 singles, expect TRUE) and run in the singles
        section; the 9-row `FIXTURE` block stays byte-identical (verified by diff against HEAD).
        `knownAccepted` is a per-row marker for a behaviour measured to be IDENTICAL on HEAD's
        prompt: it is graded, printed as `[KNOWN-ACCEPTED]` and recorded in the receipt every run,
        but does not fail the suite — so the harness stays usable as a pre-deploy gate WITHOUT the
        accepted defect being deleted or its expectation flipped to `false`.
        RESULT (receipt `totals`): cases 18, passed 18, falseRejectCases 0, falseAcceptCases 0,
        callErrorCases 0, unstableCases 0, knownAcceptedFailing 1 · `failed: 0` · exit 0.
        TWO CORRECTNESS FIXES made to the harness itself after the pre-fix run exposed them
        (`:182-211`, `:254-300`): (i) a row the model OMITS is now scored `false` — production-faithful
        (index.js scores an omitted word INCORRECT) — and recorded in `omittedRows`, instead of `null`
        which was being mis-counted as a false-accept; (ii) a CALL ERROR (the model emitting
        non-JSON — observed once on the OLD prompt for case (f)) is recorded as `error`/`CALL-ERROR`,
        never attributed to false-accept/false-reject, and now FAILS the suite, because in production
        that throw reaches the student as "Failed to grade test".

[x] A3  LEG 3 — `functions/index.js`: pre-AI uniform-filler guard (defense in depth, AI-independent).
        `UNIFORM_FILLER_MIN_ROWS = 8` :222 · `UNIFORM_FILLER_REASONING` :225 ·
        `normalizeUniformResponse` :233 (trim + lowercase) · `findUniformFillerGroups` :246 (pure) ·
        exported `exports._uniformFiller` :2386 (the `_gradingJobs` precedent, V5).
        Wired at :1402-1424 — AFTER the blank/self-ref filters (V2), BEFORE the AI: rows in any group
        of ≥8 identical normalized non-blank responses are marked `isCorrect:false` with student-facing
        reasoning and are NOT sent to the model; membership is by OBJECT IDENTITY, so it is exact even
        if two rows ever shared a wordId. Both `finishGrading` exits carry them (:1430-1434, :1621);
        `wordsJson` :1442 and `aiResults` :1600 now read `answersForAI`. ONE `logger.info` :1417-1422,
        counts + the normalized key only. ABSOLUTE threshold, NO percentage leg (brief is law).
        BYPASS SET (same input-space set as A1; leg 3 is the AI-independent half) — every path
        fixtured in `ntf26-heuristic-fixtures.json`, 6/6 cases + 6/6 rebuild cross-checks:
          · identical filler ≥8 rows ……… case 1: 8 rows → 8 flagged
          · below threshold ……………… case 2: 7 rows → 0 flagged          [kills mutant m1]
          · partial test ………………… case 3: 8 scattered among 30 → exactly those 8
          · case/whitespace variation … case 4: 8 variants → 1 group, 8 flagged  [kills mutant m2]
          · blanks ………………………… case 5: 12 blank/whitespace rows → 0 flagged
          · two sub-threshold groups … case 6: 4+4 → 0 flagged
          · per-row VARIED filler …… NOT caught here BY DESIGN (E2) — leg 1 owns it, harness (f)
          · engine leg ………………… V4 + wiring W1/W2 through the real `gradeTypedTest.run()`

## GROUP C — FIXTURES + MUTANTS

[x] C1  `scripts/deepfix2/ntf26-heuristic-fixtures.mjs` (new). Default run: ZERO API calls, ZERO
        spend, no credentials. Receipt `totals`: cases 6/6, crossChecks 6/6, mutants killed 2/2,
        wiring 2/2 (0 skipped), `pass: true`, `failed: 0`.
        Beyond the pure grouping, it also pins the WIRING, which the pure cases cannot see:
          · W1 all-filler → the early-return exit, 10 rows returned, all incorrect, order preserved,
            ZERO Anthropic calls and ZERO Firestore (`callerMayResolveList` returns false at
            `functions/index.js:950` before any read; `jobAttemptDocId` null ⇒ job leg inert).
          · W2 8 filler + 2 genuine → the combinedResults merge exit: 10 rows out, the 8 filler failed
            BY THE GUARD (exact reasoning string), the 2 genuine graded CORRECT by the model, order
            preserved. Costs one small Anthropic call, so it runs only when ANTHROPIC_API_KEY is set
            and self-reports SKIPPED (never silently "passed") when it is not.
[x] C2  Mutants mutate the SHIPPED SOURCE TEXT (`Function.prototype.toString` → string-replace →
        `new Function`), and each mutation ASSERTS its anchor matched exactly once — a mutation that
        did not apply is scored SURVIVED, not killed. A canonical no-mutation rebuild is cross-checked
        against the real export on all 6 cases first, so the substrate is proven faithful.
          · m1 `const UNIFORM_FILLER_MIN_ROWS = 8;` → `= 2;`  ⇒ KILLED by cases [2,6] (both required
            killers fired).
          · m2 `.trim().toLowerCase()` → identity            ⇒ KILLED by case [4].

## GROUP D — TRUTH REPAIRS

[x] D1  `scripts/grader-regression.mjs` header (:3-18) described the suite as if its coverage were
        general, with no hint that every case graded ONE word per call — and the assessment falsified
        that implied coverage: NTF-26 exists only at ≥~10 identical rows in a SINGLE call, so a
        singles-only suite could NEVER have caught it and its green runs were not evidence that it
        could. Corrected AT ITS SOURCE: `scripts/grader-regression.mjs:12-25` now carries the marked
        `[D1 TRUTH REPAIR]` note and describes the two sections explicitly.

## GROUP E — CARDED, NOT THIS ROUND

[x] E1  `NEED_TO_FIX.md:67` still prescribes the heuristic as "≥8 rows AND ≥80% of a test". The brief
        SUPERSEDES the percentage leg (absolute threshold only, so 8-of-30 IS caught — fixture case 3
        is exactly that shape). `NEED_TO_FIX.md` is OUTSIDE this fold's touch-list and is being edited
        by a concurrent session ⇒ NOT touched here; the correction is handed to the orchestrator in
        the fold report.
[x] E2  Leg 3 groups IDENTICAL normalized strings only, so per-row-varied filler
        ("answer1".."answer20") is NOT caught by the code heuristic — by design (the brief's
        decision). Post-fix it is caught by leg 1 alone (harness (f) → 0,0,0), but it scored 20/20 on
        the OLD prompt, so this class is real and is defended by ONE layer, not two. That is the known
        residual, and harness case (f) is its standing regression guard.
[x] E3  NO DEPLOY IN THIS FOLD. Every measurement here grades against the prompt as extracted from the
        WORKING TREE; production still runs promptSha `153ba85f92a24caf` and has NO leg-3 guard until
        `functions-deploy-engine` deploys. The exploit remains live for 947 students until then.
[x] E5  ACCEPTED FALSE-REJECT (the audit's finding, adjudicated SOFTEN-not-accept, partially closed).
        [ORCHESTRATOR ADDENDUM: real-world exposure IS measured — read-only scan of ALL 46 production
        lists / 66,141 words (2026-08-05, scratchpad filler-collision-scan.mjs, numbers in NEED_TO_FIX
        26): ZERO definitions begin with answer/reply/test/trial; 335 mid-definition mentions only.
        The rejoinder-class word does not exist in live data; the residual's live exposure is ~nil.]
        `rejoinder ← "answer"` is graded WRONG, 3/3 stable. MEASURED ON HEAD'S OWN PRE-FOLD PROMPT
        (`153ba85f92a24caf`, RUNS=3): also WRONG 3/3 — so this is a PRE-EXISTING behaviour that this
        fold neither introduced nor fixed, and shipping it is not a regression. The two rows this
        fold DID own are closed: `ordeal ← "test"` (regressed by wording v1) is CORRECT 3/3 on the
        shipped wording, and `solution ← "answer"` is CORRECT 3/3 throughout. Iteration ceiling (2)
        was reached: the wording that also carried `rejoinder` (`3a49cbf6b00f5fc2`) reopened the
        exploit at 19/20, which is not a trade this fold may make. Guarded by harness case (g),
        which grades the row every run and will show it flipping if a future prompt round fixes it.
        REAL-WORLD EXPOSURE is narrow: it needs a student to be tested on a rare word whose meaning
        IS a filler string AND to answer with exactly that bare string.
[x] E6  SEV-4 (audit, CARD ONLY — no fix in this fold, per orchestrator adjudication). On the
        no-AI-needed early exit the results array is BUCKET order, not PRESENTATION order:
        `functions/index.js` returns `[...uniformResults, ...blankResults, ...selfRefResults,
        ...malformedResults]`, whereas the graded path rebuilds presentation order via
        `gradeAnswers.map(...)`. PRE-EXISTING CLASS — before this fold the same exit already returned
        `[...blankResults, ...selfRefResults, ...malformedResults]`, so a test mixing blanks and
        self-refs already diverged; leg 3 makes it NEWLY REACHABLE (an all-filler test now takes that
        exit) and adds a fourth bucket. COSMETIC, not a correctness bug: every row carries its
        `wordId`, and the per-word results screen looks rows up by id
        (`src/pages/TypedTest.jsx:1149` `results.find((r) => r.wordId === word.id)`). The exposure is
        the raw array handed straight through at `src/pages/TypedTest.jsx:856`
        (`displayedRows = gradingResult.data.results`, consumed at :891/:1193). NOT fixed here:
        `TypedTest.jsx` is outside this fold's touch-list and the ordering belongs with whoever owns
        that render path. NOTE the fixtures do NOT catch it — W1's rows are all one bucket, so
        concatenation order happens to equal presentation order there.
[x] E4  `temperature: 0.1` and the model id are unchanged (brief constraint). Every batch result here
        is 3/3 stable (`unstableCases: 0`), but this is a probabilistic grader: the suite is the
        regression guard, not a proof of impossibility. Leg 3 is the part that does not depend on the
        model's mood — and it covers the identical-string class only (E2).

## CLOSE  (gate.mjs enforces the mechanical half)
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit
    (both receipts' `sourceShas` re-verified equal to the tree: functions/index.js `6b650d2fdc71a8f2`,
    grader-regression.mjs `e6ff53a61abbecff`, ntf26-heuristic-fixtures.mjs `3f0d090761970730`)
    [ORCHESTRATOR REPAIR per delta re-audit: the two shas above had been left at their v1-iteration
    values (`610f800fc0c334d7`/`cc371e26d89769cf`) — prose-only staleness; the receipts' own
    sourceShas were already correct and the gate reads those.]
[x] all shas re-stamped   [x] numbers re-derived from the evidence files, never typed
[x] change log row PROPOSED in the fold report (the orchestrator appends it; this fold writes no log)
[x] `node scripts/deepfix2/gate.mjs <this file>` run, its output quoted in the report, and every red
    enumerated against the pre-edit baseline captured before work. NOT ALL REDS ARE PRE-EXISTING —
    this row previously said they were, and that was wrong. THREE receipts were staled BY THIS FOLD,
    because they pin `functions/index.js`'s sha and this fold legitimately edits it:
    `cutover-b-submit-pure.json`, `namespace-reservation-emulator.json`,
    `namespace-reservation-mutants.json` (all recorded `a814ae821e19df14`, the pre-edit sha).
    Their producers are outside this fold's touch-list — and `namespace-reservation-mutants.mjs`
    edits `functions/index.js` IN PLACE, which must not run against a shared tree — so the
    orchestrator re-certifies them after this lands. The remaining reds (NUMBERS vs
    audit/deepfix/task3 + 17_, and `engine-lap-result.json`'s four bindings) are byte-identical to
    the pre-edit baseline and are foreign to this footprint.
[x] NO commit / NO staging / NO deploy / no feature-flag value changed (brief constraints)
[x] API key read from the scratchpad path at run time only; never printed, never persisted — both
    receipts and all source files verified to contain zero occurrences of it
