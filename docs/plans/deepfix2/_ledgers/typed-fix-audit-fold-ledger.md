# TYPED-FIX-AUDIT FOLD LEDGER — built from re-verified code, the audit report itself being lost

SOURCE NOTE: the original typed-leg audit lived in the previous session's /tmp scratchpad and was
wiped with it. Every finding below was therefore RE-DERIVED FROM CODE in this session before planning
(GROUP V), not copied from a remembered summary. Codex r78's items 3 and follow-up are quoted from
`docs/plans/loop/codex_reviews/codex_deepfix2_r78.md:76-84` (read in full, in repo).

## GROUP V — VERIFY BEFORE EDITING

[x] V1  The live `gradeTypedTest` job key is CLIENT-SUPPLIED, with no namespace restriction.
        `functions/index.js:1048` — `jobAttemptDocId = (writeContext || gradeContext || null)?.attemptDocId`
        `functions/index.js:1049` — that value IS `gradeJob.jobKey`; `:1051` claims it; `GRADE_JOB_ENABLED = true` (`:104`).
        ⇒ a client may name `rv2_<presentationId>` and claim/populate the ENGINE's job.

[x] V2  The client possesses its own `presentationId` (so the key above is guessable BY DESIGN, not by brute force).
        `src/services/reviewV2Client.js:152-153` — `submitAttempt({presentationId, answers})` sends it.

[x] V3  A payload written by the LIVE path is CONSUMABLE by the engine's cached path (the poisoning is reachable,
        not merely nameable). Live payload shape `functions/index.js:1136-1141` = `{results, gradeToken,
        gradeTokenCreatedAt, attemptDocId}`; the engine's acceptance test is `resultsOf()` =
        `Array.isArray(payload.results)` ONLY (`functions/reviewV2/typedGrading.js:102-104`).
        ⇒ live-written payload passes; the engine then builds rows from it (`:185`, `:237`).

[x] V4  The engine's own persist DOES write provenance that the read side never checks — i.e. the fix needs no
        new field, only enforcement. Write: `typedGrading.js:215-216` persists `{results, source: "reviewV2",
        presentationId}`. Read: `:182-187` uses `resultsOf(claim.payload)` with NO check of `source`,
        `presentationId`, word set, or response text.

[x] V5  Nothing else in the tree reads `grading_jobs.payload.source` or `.presentationId`, so ENFORCING them
        cannot break an existing consumer (grep `source: "reviewV2"` / `payload.presentationId`).

[x] V6  `completeDay` maps engine rows to graduation by wordId with NO presentation binding (Codex r78 item 3).
        `functions/reviewV2/completion.js:601-603` maps `rows.filter(r => typeof r.wordId === "string")`;
        `:397-402` fetches the presentation doc — so the binding SOURCE is already in hand at that point.

[x] V7  The `rv2_` attempt replay returns early on `aSnap.exists` without proving the existing doc is a
        fully-stamped engine attempt claimed by THIS presentation (Codex r78 follow-up).
        `functions/reviewV2/callables.js` — the `attemptRef.get()` / exists early-return path.

## GROUP A — DELTAS

[x] A1  THE CACHED-GRADE PROVENANCE + ANSWER-SHEET BINDING (closes BOTH the poisoning blocker and the
        EVIDENCE: VERIFIED BY ME: `usableCachedResults` at BOTH seams — typedGrading.js:263 (`return_cached`) AND :304 (`already_graded`); `resultsOf` deleted. Fixtures C1-C7 + CASE TS. Mutants M-A1a/M-A1b/M-A1-PREFIX-CONSUMER/M-A1-SIBLING-CALL-SITE all KILLED.
        binding finding at ONE seam — the engine's cached path, `typedGrading.js:182-187`).
        A cached payload is usable ONLY if it proves it was written by the engine, FOR this presentation,
        and GRADES THE ANSWER SHEET NOW BEING SUBMITTED. Otherwise: fail CLOSED (refusal DATA, zero writes).
        BYPASS SET — the ways a foreign/stale grade can arrive at this seam, one fixture each:
          · create      — client PRE-SEEDS `rv2_<pid>` via live gradeTypedTest before ever submitting  → C1
          · update      — client re-grades to OVERWRITE an engine-written cache                        → C2
          · delete      — client deletes the job then re-seeds it (rules deny; assert the DENIAL)       → C3
          · set-merge / set-overwrite — direct client write to grading_jobs (rules deny; assert)        → C3
          · FieldValue.delete() — strip `source`/`presentationId` off an engine cache to dodge the check → C3
          · delete-then-recreate SEQUENCE — poison, let the engine consume, delete, re-poison           → C4
          · batch / transaction — same poison inside a batch/txn                                        → C3
          · a different path — the SAME payload cached under a DIFFERENT presentation's key (cross-presentation
            replay: grade presentation P1, submit P2)                                                   → C5
          · as a third party — another student's uid claiming this job (already denied at
            `index.js:936-938`; assert it, do not assume it)                                            → C6
          · as a teacher — a teacher account poisoning a student's job key                              → C6
        OTHER LEG (mandatory): the LEGITIMATE lost-response replay — engine writes the cache, the worker
        dies, the retry MUST still reuse it with ZERO grader calls. The whole point of the cache.        → C7

[x] A2  ANSWER-SHEET IDENTITY, defined explicitly rather than by implication: the cached grade binds to the
        EVIDENCE: typedGrading.js:135 `answerSheetKey` (sha256 of wordId->normalized-response pairs, sorted). Fixtures C11 + TS S3. Mutant M-A2 KILLED (12 red).
        (wordId → submitted response text) pairs actually graded. Same words + same text ⇒ reuse; any drift ⇒
        fail closed. Recorded in `18_TYPED_LEG_DESIGN.md §5.4` as law, not just as code.
        BYPASS SET — every way a sheet can DRIFT from the one that was graded, one fixture each (C11):
          · update      — same word set, one response's TEXT changed (the core substitution)
          · create      — a word PRESENT in the cache but ABSENT from this submit
          · delete / FieldValue.delete() — a word submitted now that the cache never graded (added row)
          · set-merge / set-overwrite — same words+text but a DIFFERENT presented ORDER (must still reuse:
            order is not identity — the OTHER-LEG control for this row)
          · delete-then-recreate SEQUENCE — blank→filled→blank on the same wordId across submits
          · batch / transaction — two concurrent submits with different sheets on one key
          · a different path — same sheet text under a different presentationId (overlaps C5, asserted here too)
          · as a third party / as a teacher — covered by C6 (uid fence), asserted not assumed
        WHITESPACE/CASE NORMALISATION is part of the identity definition and is fixtured, because the grader
        already trims (`typedGrading.js:195`) — the binding must use the SAME normalisation or a legitimate
        replay fails closed on a trailing space.

[x] A3  COMPLETEDAY WORDID↔PRESENTATION BINDING (Codex r78 item 3, defense in depth): engine rows may only
        EVIDENCE: completion.js:601-622 — rows filtered to `consumedPresentation.presentedWordIds`; legacy leg preserved by the `serverPresentedIds === null` branch. Fixtures TG. Mutant M-A3 KILLED.
        graduate wordIds that the SERVER presented (`completion.js:601-603` vs the presentation fetched at
        `:397-402`). A row naming a word outside the presented set is not graduation evidence.
        BYPASS SET (fixtures C8, one case each): extra wordId · substituted wordId · duplicate wordId ·
        reordered rows · rerun mode · legacy (epoch-less) attempts MUST be unaffected (the live-regression
        control). MUTANT C10c removes the binding and must turn the lap red.

[x] A4  RV2_ REPLAY PROVENANCE (Codex r78 follow-up): the `aSnap.exists` early return must fail CLOSED
        EVIDENCE: callables.js:120-151 `isEngineAttemptFor` (studentId+presentationId+resetEpoch+full gatePosture+engineResult) at the replay early-return. Fixtures TR. Mutant M-A4 KILLED.
        unless the existing doc is a fully-stamped engine attempt for THIS presentation — never infer
        provenance from the document NAME.
        BYPASS SET (fixtures C9, one case each): pre-seeded doc at the predictable id (pre-lockdown window) ·
        legacy-shaped doc at that id · doc stamped for a DIFFERENT presentationId · another uid's doc ·
        the LEGITIMATE replay (fully-stamped, this presentation, this uid) must still return the normalized
        envelope with ZERO writes — the other leg. MUTANT C10d removes the check and must turn the lap red.

## GROUP C — FIXTURES + MUTANTS  (engine-emulator-lap.mjs; every count re-derived from evidence)

[x] C1  poisoned-BEFORE-submit: live `gradeTypedTest` seeds `rv2_<pid>`, then engine submit ⇒ refusal, ZERO attempt writes
        EVIDENCE: CASE TX C1 poisoned-before-submit via the REAL gradeTypedTest route.
[x] C2  poisoned-AFTER-engine-cache (overwrite attempt) ⇒ engine's own grade still canonical
        EVIDENCE: CASE TX C2 overwrite-after-engine-cache.
[x] C3  direct client writes to `grading_jobs` (create/update/delete/merge/overwrite/FieldValue.delete/batch/txn)
        EVIDENCE: rules-matrix CASE GJ1-GJ17 (18 assertions): create/update/delete/merge/overwrite/FieldValue.delete(field+whole)/batch/txn/sequence/third-party/teacher/unauth + GJ15 survival + GJ16/GJ17 docId-name premise. Re-run by me: 262/262.
        ⇒ DENIED by rules (`firestore.merged.rules:415` block) — asserted in the rules matrix, not assumed
[x] C4  poison → consume → delete → re-poison SEQUENCE ⇒ still refuses
        EVIDENCE: CASE TX C4 + GJ10a/b delete-then-recreate sequence.
[x] C5  cross-presentation replay (cache from P1 offered for P2) ⇒ refuses
        EVIDENCE: CASE TX C5 cross-presentation replay (+ isolating variant).
[x] C6  third-party uid + teacher uid claiming the key ⇒ denied
        EVIDENCE: CASE TX C6 third-party uid + teacher uid (index.js:936-938 uid fence asserted, not assumed).
[x] C7  THE OTHER LEG: legitimate lost-response replay ⇒ SAME grade reused, `graderCalls === 0`
        EVIDENCE: OTHER LEG: legitimate lost-response replay reuses with ZERO grader calls; TS S2 proves the already_graded winner is canonical.
[x] C8  A3 fixtures: extra/substituted/duplicate/reordered wordIds ⇒ excluded from graduation;
        EVIDENCE: CASE TG: extra/substituted/duplicate/reordered wordIds excluded; TG C8(f) legacy epoch-less attempt UNAFFECTED (the live-regression control).
        legacy epoch-less attempt ⇒ UNCHANGED behaviour (the live-regression control)
[x] C9  A4 fixtures: pre-seeded / legacy-shaped / wrong-presentation / foreign-uid doc at `rv2_<pid>` ⇒ fail closed
        EVIDENCE: CASE TR: pre-seeded / legacy-shaped / wrong-presentation / foreign-uid docs all fail closed; TR(8) legitimate replay returns with zero writes.
[x] C10  MUTANT per new clause (remove the provenance check · remove the sheet binding · remove the wordId
        EVIDENCE: scripts/deepfix2/typed-seam-mutants.mjs — 7 mutants, ALL APPLIED + ALL KILLED (re-run by me: canonical 395/395). Stale anchor fails LOUD at :190-202.
        binding · remove the replay-provenance check) — each must turn the lap RED

## GROUP D — TRUTH REPAIRS

[x] D1  `typedGrading.js:13-16` header claims the key is "1:1 with a composed presentation … replay-safe by
        EVIDENCE: typedGrading.js header rewritten: the `rv2_` key space is a NAMING CONVENTION, not a namespace boundary (cites index.js:1048-1051 + reviewV2Client.js:152). Read and verified by me.
        construction, and collision-free against the legacy key space (client attempt nonces)".
        FALSE as written: the legacy key space is CLIENT-CHOSEN (`index.js:1048`), so `rv2_` is a naming
        convention, not a namespace boundary. Correct AT SOURCE + wherever 18_ repeats it.
[x] D2  `typedGrading.js:183-184` calls the cached path "a prior worker already graded this exact
        EVIDENCE: typedGrading.js:257 restated as ENFORCED; 18_ §5.6 'BOTH seams' now carries its evidence (CASE TS + M-A1-SIBLING-CALL-SITE) after the audit proved the claim was code-true but evidence-free.
        presentation" — true only AFTER A1 enforces it. Restate as enforced, with the fixture ref.
[x] D3  RESUME/WORK_QUEUE wording: typed leg is audited NO and ships as CODE, not as a claim (already true;
        EVIDENCE: RESUME.md rewritten — the fold's greens are explicitly NOT typed-leg readiness; NEED_TO_FIX 18 (rv2_ collision, blocks the rehearsal) and 21 (grading_in_progress vs its frozen contract, blocks DF2-51) are named as the standing blockers, and WORK_QUEUE carries both.
        keep it true after this fold — do NOT let this fold's greens read as typed-leg readiness).

## GROUP E — CARDED, NOT THIS ROUND

[x] E1  Whether the LIVE `gradeTypedTest` should reject client-supplied keys in the `rv2_` namespace at the
        EVIDENCE: Carded as NEED_TO_FIX card 19 (live gradeTypedTest key namespace) + WORK_QUEUE `gradejob-namespace`, blocker after:typed-fix-audit.
        SOURCE (defense in depth beyond the consumer-side check). It touches the live grading path used by
        947 students today, so it needs its own fold + deploy order — NOT bundled with dark engine code.
        Recorded in WORK_QUEUE + NEED_TO_FIX.

## CLOSE
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit (regen 19:52Z; `find functions scripts -newermt` confirms NO code edit post-dates it)
[x] all shas re-stamped (receipt artifacts re-hashed FROM THE TREE)   [x] numbers re-derived from the evidence JSON by script, never typed — gate NUMBERS + the new FREEZE matrix-sha check both clean
[x] change log row (ABSOLUTE paths, every number derived from the evidence JSON by script)   [x] `node scripts/deepfix2/gate.mjs` clean   [x] commit
[x] NO COMMIT while Codex holds the r79 baton — SATISFIED: Codex returned it (turnOwner=claude, rev 231, YES) before any commit; gate BATON confirms both batons idle
