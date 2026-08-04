# NAMESPACE-RESERVATION — FOLD LEDGER (NEED_TO_FIX 19+22, decided as a SET)

Built from `20_RV2_NAMESPACE_RESERVATION.md` (the CANONICAL design — union of two parallel drafts;
`20_ENGINE_...` is a superseded pointer) + the two cards, read in full — not a notification. **PLAN
state** (renamed from `-PLAN` when work begins). Design proves THREE mouths; the cards name two. Not
implemented, not deployed. Guard vocabulary: G1=Leg 2 (rules) · G2=M2 (submitVocabAttempt) · G3=M1
(gradeTypedTest).

**WHAT THIS FOLD DOES:** reserve the server-owned `rv2_` prefix at all three client→global-collection
boundaries, so a classmate can no longer plant an undeletable document at another student's engine
attempt/job id. Closes the PERMANENT-DENIAL blockers 19 + 22. Does NOT close 23 (carded, E-row).

## GROUP V — VERIFY BEFORE EDITING (a guard is "inert" only if no live writer exists)
[x] V1  **rv2_ is client-derivable and server-reserved, NOT a namespace fence.**
        `engineDocId = \`rv2_${uid}_${presentationId}\`` (`composer.js:132`); used for attempts
        (`callables.js:551`) and grading_jobs (`typedGrading.js:270`). Client holds its presentationId
        (`reviewV2Client.js:191`), uids enumerate from `classes.studentIds`.
[x] V2  **No legit client flow supplies an `rv2_` id to ANY of the three boundaries** ⇒ the guard denies
        nothing legitimate. `grep -rn "rv2_" src/` = only the `rv2_compose_invalid_day` LOG NAME. Legacy
        ids are `{uid}_{testId}_{nonce}` (`MCQTest.jsx:700`, `TypedTest.jsx:817`) / `..._automarker`
        (`foundation.js:1022`). Engine writes are Admin-SDK at different call sites.
[x] V3  **V-A (rules create):** `firestore.rules:301-317` allows any authed user to create
        `attempts/rv2_{victim}_{pid}` with own studentId; delete creator-only (`:394-396`); victim
        blocked at `callables.js:623-625`.
[x] V4  **V-B (callable create, BYPASSES rules):** `submitVocabAttempt` takes client `context.attemptDocId`
        (`index.js:532`); `assertCanWriteAttempt` (`:306-313`) never checks the docId SHAPE; `writeAttempt`
        writes via Admin SDK (`:471`); `GRADE_TOKEN_ENFORCED=false` (`:67`) ⇒ writer-API guard silent.
        Reachable independent of `REVIEW_V2_CLIENT` (attacker calls the deployed callable directly).
[x] V5  **V-C (grading_jobs claim, BYPASSES rules):** rules deny all client grading_jobs writes
        (`firestore.rules:417`); the squat is via `gradeTypedTest` client key (`index.js:1048-1051`,
        `GRADE_JOB_ENABLED=true`); uid-check-first (`:936-938`) makes it permanent.
[x] V6  **The engine's own writes must stay untouched** — `submitAttempt` derives `attemptId` server-side;
        the engine grader keys off `engineDocId`. G1/G2/G3 sit at the LEGACY/rules boundaries only.

## GROUP A — DELTAS
[x] A1  **G1 — rules attempts, ALL WRITE VERBS (canonical design Leg 2):** deny client
        **create · update · delete** for `attemptId.matches('rv2_.*')` (RE2 full-match ⇒ prefix). NOT
        create-only — `set({merge})` on a nonexistent doc is a create in different clothing, and the
        uniform per-verb deny needs no key-presence reasoning (the folding-skill's guard-every-verb rule).
        Land in `/app/firestore.rules` AND the three baseline artifacts in lockstep (§4 protocol). Extend
        `rules-matrix.mjs` + `rules-mutants.mjs`; re-run `run-rules-matrix.sh`.
        BYPASS SET (one matrix case each): create `rv2_` as a stranger · create `rv2_` as the named
        victim's uid-in-name-but-own-studentId · **update an `rv2_` doc (DENIED)** · **delete an `rv2_`
        doc (DENIED)** · **set-merge on a nonexistent `rv2_` id (DENIED — create in disguise)** · create a
        legit `{uid}_{testId}_{nonce}` (MUST still ALLOW — the false-DENY failure mode) · as a teacher
        (teacher creating for self as student — `rv2_` still denied) · a `manual`-id create (already
        denied, must stay denied).
        OTHER LEG: every pre-existing ALLOW branch in the live ruleset still passes (rules-matrix case 9
        regression sweep).
        DONE — ONE shared rules fn `isReservedEngineDocId(attemptId)` (`firestore.rules:181`, mirrored
        byte-identically into `firestore.merged.rules` + `firestore.live.rules`) called on CREATE
        (`firestore.rules:348`), UPDATE (`:419`, hoisted above the student|teacher OR), DELETE (`:451`).
        Fixtures: `rules-matrix.mjs` CASE RV1-RV14 (`:321`) — RV1 stranger-create, RV2 victim-self-create,
        RV3/RV12/RV13 update denied, RV4 delete denied, RV5 set-merge-on-nonexistent denied, RV6 teacher,
        RV7 legit `{uid}_{testId}_{nonce}` still ALLOWS (the false-DENY canary), RV8 manual sibling still
        denied, RV9 batch, RV10 txn, RV11 unauth, RV14 owner READ still allowed + doc survived; plus GJ16
        (`:318`, flipped from ALLOW-premise to DENY-by-name). Regression sweep CASE 9 intact. Matrix
        276/276 green (`rules-mutants-report.json` canonical, rules sha16 `4d8e511bf8a66176`).
[x] A2  **G2 — `submitVocabAttempt`/`writeAttempt`:** refuse `ctx.attemptDocId` matching `^rv2_` with
        `invalid-argument`, BEFORE the Admin-SDK write. UNCONDITIONAL (a security guard, not flag-gated).
        BYPASS SET (one fixture each): the ordinary first submit at `rv2_` (deny) · a legit
        `{uid}_{testId}_{nonce}` submit (allow, byte-identical to today) · re-submit / idempotent replay
        of a legit id (unchanged) · both modalities (mcq · typed) · sessionType review AND new (the
        new-word `newWordEndIndex` guard path) · as a third party (attacker's studentId, victim's
        rv2_ id) · via the deployed callable directly (not the client).
        DONE — shared validator `assertNotEngineReservedDocId` (`functions/index.js:321`) called at
        `submitVocabAttempt` (`:590`) BEFORE the idempotency read and the `writeAttemptTxn` Admin-SDK
        write. Fixtures: `namespace-reservation-emulator.mjs` cases G2-DENY-CREATE (deny + zero write),
        G2-ALLOW-MCQ, G2-ALLOW-TYPED (correctnessSource null — enforcement off), G2-ALLOW-NEW (anchor
        path), G2-REPLAY (idempotent), G2-THIRD-PARTY (attacker uid, victim id — denied by NAME). All
        cases invoke the callable directly via `fft.wrap` = the "deployed callable, not the client" row.
[x] A3  **G3 — `gradeTypedTest`:** refuse client `(writeContext||gradeContext).attemptDocId` matching
        `^rv2_` with `invalid-argument`, BEFORE `claimOrRecoverGradingJob`.
        BYPASS SET (one fixture each): claim `rv2_{victim}_{pid}` (deny) · a legit
        `{uid}_{testId}_{nonce}` claim (allow, cache/recover path unchanged) · the return_cached path
        with a legit id (unchanged) · the in_progress lease path (unchanged) · as a third party.
        DONE — the SAME validator on BOTH context fields (guard the sibling, not just the branch the
        reviewer named): `functions/index.js:1101` (writeContext), `:1102` (gradeContext), BEFORE the
        idempotency read and the grading-job claim. Fixtures: `namespace-reservation-emulator.mjs`
        G3-DENY-WRITECTX, G3-DENY-GRADECTX (deny + no job claimed), G3-ALLOW-CACHED (return_cached
        unchanged), G3-ALLOW-INPROG (live-lease → aborted, unchanged), G3-THIRD-PARTY.
## GROUP C — FIXTURES + MUTANTS + EVIDENCE
[x] C0  **G4 — retrospective read-only EVIDENCE scan ALREADY EXISTS** — the rv2-collision fold shipped
        `audit/deepfix/task3/live_baseline/rv2-docid-precondition-receipt.json`: a docId-PREFIX scan,
        **0 `rv2_` ids across 41,688 `attempts` and 16,732 `grading_jobs`** (read-only, projectId
        vocaboost-879c2). So the reserved namespace is empty today ⇒ the fix holds retrospectively, on
        the same standard as NEED_TO_FIX 20. Changes NO guard. **RE-RUN IT FRESH immediately before the
        deploy** (the corpus grows; a hit ⇒ a CS quarantine item, not a code change) — the scanner
        already exists, so C0 is confirm-not-author.
        CONFIRMED the receipt exists and reads 0/41,688 attempts + 0/16,732 grading_jobs. The FRESH
        pre-deploy re-run needs PRODUCTION credentials and is a pre-deploy step (E2) — NOT run in WSL
        (forbidden by the brief; the dev env talks to live prod).
[x] C1  One rules-matrix case per A1 bypass row (incl. the ALLOW-still-allowed case). — DONE: CASE RV
        (`rules-matrix.mjs:321`, RV1-RV14) + GJ16 (`:318`); RV7 is the ALLOW-still-allowed canary.
[x] C2  One emulator fixture per A2 bypass row (G2), incl. flag-off byte-parity of the legit path. — DONE:
        `namespace-reservation-emulator.mjs` G2-* (byte-parity = G2-ALLOW-MCQ/TYPED/NEW + G2-REPLAY).
[x] C3  One emulator fixture per A3 bypass row (G3), incl. the unchanged cache/lease paths. — DONE:
        `namespace-reservation-emulator.mjs` G3-* (G3-ALLOW-CACHED = return_cached, G3-ALLOW-INPROG = lease).
[x] C4  MUTANT G1: revert the rules clause ⇒ the `rv2_`-stranger DENY case goes red. — DONE:
        `rules-mutants.mjs` M16-rv2-namespace-guard-removed (`:119`, `isReservedEngineDocId` body →
        `return false`) KILLED, 267/276 (redden GJ16 + RV create/update/delete). Report:
        `audit/deepfix/task3/live_baseline/rules-mutants-report.json`.
[x] C5  MUTANT G2: drop the `submitVocabAttempt` `^rv2_` refusal ⇒ its deny fixture goes red. — DONE:
        `namespace-reservation-mutants.mjs` M-C5-DROP-G2 KILLED (emulator exit 1, 25/31).
        Evidence: `docs/plans/deepfix2/evidence/namespace-reservation-mutants.json`.
[x] C6  MUTANT G3: drop the `gradeTypedTest` `^rv2_` refusal ⇒ its deny fixture goes red. — DONE:
        `namespace-reservation-mutants.mjs` M-C6-DROP-G3 KILLED (emulator exit 1, 22/31). Restore clean.
[x] C7  A cross-boundary fixture proving the SAME victim id is now denied at ALL THREE boundaries —
        the "guard the sibling, not just the named site" proof this fold exists to make. — DONE:
        `namespace-reservation-emulator.mjs` CASE XB-CROSS asserts the literal id
        `rv2_student1_c1_l1_d3_e0_p1` is denied at G2 + G3 (both context fields) with zero squat docs;
        the identical string is denied at G1 in `rules-matrix.mjs` CASE RV1/RV2 (`VICTIM_ENGINE_ID`).

## GROUP D — TRUTH REPAIRS (correct at source, every doc that carries it)
[x] D1  **NEED_TO_FIX 22** — its "deny client creates matching the rv2_ prefix in rules (cheap,
        rules-only)" OPTION is INSUFFICIENT: the `submitVocabAttempt` callable is a rules-bypassing
        second create vector (V-B). Correct the card. (Done in this session's card edit — verify it holds.)
        VERIFIED — card 22's "⚠ CORRECTION 2026-08-04" names all three boundaries G1/G2/G3 and the
        Admin-SDK bypass; it holds, not re-edited. (Nit for orchestrator: it cites
        `20_ENGINE_NAMESPACE_RESERVATION.md §2`, now the superseded pointer — substance unaffected.)
[x] D2  **NEED_TO_FIX 19** — note that closing it at the source (G3) is the same fix family as 22's G2,
        and cross-reference 23. — DONE: card 19 "⚠ UPDATE 2026-08-04" block (names G3, same shared
        validator as G2, cross-refs 23 and its shrink).
[x] D3  **`rules-matrix.mjs` header** — the "/app/firestore.rules holds the UNSHIPPED P10 cutover" comment
        is stale (order 97 reconciled; sha16 f40f91fce3693b82 identical). Correct or card it — but note
        editing rules-matrix.mjs mid-fold changes a harness file, so sequence it with the harness edits.
        DONE — D3 TRUTH REPAIR note appended at `rules-matrix.mjs:12` (kept the stale line as history,
        recorded that /app/firestore.rules now runs the merged artifact and is edited in lockstep).
[x] D5  **BUNDLE NTF-20's owed comment repair into THIS rules change** (NTF-20's own instruction: never a
        standalone deploy — a comment-only edit would create false drift or force a zero-behaviour redeploy).
        Cite the provenance scan alongside the attempt-create guard at `firestore.merged.rules:133`/`:346`.
        This is the "next real rules change" NTF-20 was waiting for.
        DONE — NTF-20 both-legs citation added at `firestore.rules:134` (on `isEngineStampedAttempt()`'s
        comment, adjacent to the `:133` create-guard claim) and at the update-clause BROADER bullet
        (`:346` region), in all three lockstep artifacts, citing `engine-key-provenance-receipt.json`.
[x] D4  **`typedGrading.js:32` / `callables.js:619`** — the "naming convention, not a namespace boundary"
        comments are HONEST descriptions of the hole; after the fold, append that the boundary is now
        enforced at G1/G2/G3 (do NOT delete the description — it explains WHY the guards exist).
        DONE — append-only at `typedGrading.js:42` and `callables.js:628`; both keep the original
        hole-description and add that the mouths are now guarded and the consumer check stays load-bearing.

## GROUP E — CARDED, NOT THIS ROUND
[x] E1  **NEED_TO_FIX 23 — SHRINKS once the namespace is reserved (canonical design Leg 3).** G3 kills the
        pre-seeding LEVER at the source: a client can no longer cache into `rv2_*` job keys, and
        legacy-on-legacy pre-seeding needs predicting another student's nonce. The residual self-seed
        caches a genuine grade of the caller's OWN answers — no forgery value. So 23's owed work SHRINKS to
        (a) CONFIRMING those two sentences on the live client flow (`TypedTest.jsx:710-718` → `index.js:1048`)
        — written into NTF-23 when this fold lands — plus (b) a CARDED consumer-side acceptance test on the
        legacy `return_cached` branch (`index.js:1052`) as defense-in-depth, **explicitly NOT a pre-flip
        blocker once the namespace is reserved.** Confirm this shrink holds; it is a Codex-checkpoint question.
        CONFIRMED the shrink holds in analysis + recorded a dated forward-pointer on card 23 (NOT enacted:
        the shrink is a Codex-checkpoint decision, question 3 of the canonical design). 23 NOT implemented.
[~] E2  **The deploy.** G1 = rules deploy (947 students); G2/G3 = functions deploy of live callables.
        ordering-deploys discipline + Codex FINAL GATE on the pushed sha + David's authority. Not here.
        CARDED — this fold produces code + fixtures only. Deploy is E2, David's authority, out of scope.

## CLOSE
[x] every row ticked with file:line + fixture ref
[x] evidence re-run AFTER the last edit — rules matrix 276/276 · 16/16 rules mutants killed (incl. M16) ·
    G2/G3 emulator 31/31 · 2/2 G2/G3 revert-mutants killed, restore clean. All post-date the last edit.
[x] all shas re-stamped — rules AFTER-sha16 `4d8e511bf8a66176` (rules/merged/live identical) re-derived
    from `rules-mutants-report.json`, never typed; evidence JSONs carry `sourceShas` of the tree bytes.
[x] numbers re-derived — 276/276, 267/276 (M16), 31/31, 25/31 (M-C5), 22/31 (M-C6) all read from JSONs.
[x] change log row (ABSOLUTE path) — ORCHESTRATOR appends (change_action_log.md is on the do-not-touch
    list to avoid a concurrent-append clobber); proposed row text is in the implementer's report.
[x] `node scripts/deepfix2/gate.mjs` clean — MY fold's ledger + evidence pass; the remaining trips are
    cross-fold (5 pre-existing/other-fold evidence receipts whose `sourceShas` for index.js/callables.js/
    typedGrading.js no longer match — index.js was ALREADY stale pre-fold; callables/typedGrading changed
    only by the append-only D4 comments) + the change-log-row + BATON/WATCHER warnings. Detailed in report.
[x] commit — ORCHESTRATOR / WinClaude (WSL cannot git push; no git add/commit in this fold).
[x] NO visual check owed (backend + rules only — no front-end change).
[x] a concurrent session writes to this repo — staged explicitly by the orchestrator, never `git add -A`.
[x] delegated implementer PAIRED with an independent auditor told not to trust its self-report —
    ORCHESTRATOR runs the independent re-execution + diff audit (per the brief's close).
