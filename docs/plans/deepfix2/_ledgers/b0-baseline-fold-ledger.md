# B0 BASELINE PRODUCER FOLD LEDGER — `scripts/deepfix2/b0-baseline.mjs`

**Why this fold exists.** `docs/plans/deepfix2/evidence/b0-derivability-study.md:486-513` (ORCHESTRATOR
VERIFICATION) records that the study's headline B0 rates did **not** reproduce on independent
recomputation (R2 99.695% vs 98.057%; R3 99.486% vs 98.621%) — a **window-definition** gap of 1.6 pts,
which is LARGER than the abort trigger R2 must detect (`21_DF2-14_FLIP_ABORT_CARD.md:92` — "new-word
submit success drops **at all**"). A hand-quoted rate makes the flip's safety signal unfalsifiable.
The remedy is a deterministic producer with an explicit window, a documented formula, and a
machine-readable receipt.

**Scope (David's 2026-08-05 ruling):** compute R2 · R3(+errCode) · R4a · R6(volume) · R7-typed.
R1 (auth) and R5 (teacher gradebook) are ACCEPTED AS MANUALLY WATCHED — emitted as explicit `null`
with that reason, never faked. R4b (browser exceptions) and R7-MCQ emitted `null` with their reasons.

---

## GROUP V — VERIFY BEFORE EDITING  (each row proved against PRODUCTION `vocaboost-879c2`, read-only)

[x] V1  `system_logs` has **no** `(type ASC, timestamp ASC)` composite index, so the obvious
        "count rows of type T in window W" aggregate is IMPOSSIBLE.
        PROOF: `/app/firestore.indexes.json` contains zero `system_logs` entries
        (`grep -n system_logs /app/firestore.indexes.json` → no match) and `"fieldOverrides": []`
        at `/app/firestore.indexes.json:959`. Live probe `probe2.mjs` key `A2`:
        `where('type','==','resolve_list_progress').where('timestamp','>=',…).count()` →
        `FAILED_PRECONDITION (9) … requires an index`. Type-only aggregate DOES work
        (`A1` → 597). CONSEQUENCE: the script must do ONE windowed `timestamp`-range page over
        `system_logs` and tally `type` in memory.

[x] V2  `attempts` has **no** `(sessionType, submittedAt)` or `(testType, submittedAt)` composite.
        PROOF: probe2 `B1`/`B3` → `FAILED_PRECONDITION (9)`. Range-only aggregate works
        (`B2` → 8,859 for 2026-07-22→2026-08-05). CONSEQUENCE: page `attempts` in-window and tally
        `sessionType`/`testType` in memory — one pass serves R2, R3 and R7's denominator.

[x] V3  `grading_jobs` has **no** `(status, createdAt)` composite. PROOF: probe2 `C4` →
        `FAILED_PRECONDITION (9)`; range-only `C3` → 4,849. Whole-collection status aggregates work:
        `graded` 17,275 · `claimed` 55 · `cancelled_reset`/`failed`/`pending`/`in_progress`/`error` 0
        (probe2 `C2`). CONSEQUENCE: page in-window, tally status in memory.

[x] V4  `collectionGroup('sessions')` CANNOT be time-filtered today. PROOF: probe2 `D2` →
        `requires a COLLECTION_GROUP_DESC index for collection sessions and field completedAt`;
        `D3`/`D4` → `COLLECTION_GROUP_ASC`; `D5` → same for `serverReviewOnlyDay`. A **single user's**
        subcollection DOES support it (`D7` ordered, probe3 `3` ranged → 5 docs). CONSEQUENCE: R6 fans
        out per active student (student set derived from the `attempts` pass), and the script REPORTS
        the missing index rather than creating it.

[x] V5  `sessions.serverReviewOnlyDay` — the R6 non-review discriminator — exists only on sessions
        completed from **2026-07-19** onward. PROOF: probe3 `5` — docs WITH the flag span
        2026-07-19T09:05:02Z → 2026-08-05T05:13:44Z (n=280); docs WITHOUT span 2026-06-16 →
        2026-07-21T03:47:26Z (n=100). In a 2026-07-22→2026-08-05 window: 522/524 carry it (probe3 `4`).
        Writer: `/app/src/services/studyService.js:1108` `serverReviewOnlyDay: data.reviewOnlyDay ?? null`.
        `serverReviewOnlyDay` vs `clientReviewOnlyDay` disagree on 8/522. CONSEQUENCE: the receipt must
        carry a per-window `discriminatorCoverage` and an `unknown` bucket — a pre-07-19 window is
        visibly degraded, not silently wrong.

[x] V6  The study's proposed proxy "`newWordScore != null` ⇒ non-review day" is **FALSE** and must not
        be used. PROOF: probe3 `4` crossTab — `srv=true|nwsNull=false` = 257, i.e. 257 review-only-day
        sessions carry a NON-null `newWordScore`. Only `serverReviewOnlyDay`/`clientReviewOnlyDay` are
        usable.

[x] V7  Failure-leg emitters exist and carry the discriminators the formulas need.
        PROOF (code): `attempt_write_failed_client` at `/app/src/pages/MCQTest.jsx:914` and
        `/app/src/pages/TypedTest.jsx:1215` — both pass `sessionType`, `testType`, `errCode`;
        `grading_attempt_failed` at `/app/src/pages/TypedTest.jsx:742` — passes `isFinal`, `timedOut`,
        `failedFast`, `online`, `errCode`; `progress_resolver_unavailable` at
        `/app/src/services/progressService.js:133`; `resolve_list_progress` at
        `/app/functions/foundation.js:1766,1900,1993`.
        PROOF (production, type-only aggregates, probe3 `1`): `resolve_list_progress` 37,165 ·
        `attempt_write_failed_client` 597 · `grading_attempt_failed` 1,447 ·
        `progress_resolver_unavailable` 99 · `grading_recovered` 117 · `attempt_write_failed` **0**
        (confirms the study's `db.js:175`-unreachable finding).

[x] V8  Timestamp-field completeness, per collection (the window filter silently drops fieldless docs):
        `attempts` 42,742 total vs 42,742 with `submittedAt` (probe2 `B4`/`B6`) — **no loss**.
        `grading_jobs` 17,330 vs 17,330 with `createdAt` (`C1`/`C6`) — **no loss**.
        `system_logs` 91,044 total vs 85,997 with `timestamp` (`A5`/`A4`) — **5,047 fieldless**, and
        probe3 `2` identifies them: `orphaned_attempt_flagged` (74/1500) and `orphaned_attempt_deleted`
        (7/1500), neither of which is an R-metric leg. CONSEQUENCE: documented as a named, non-impacting
        exclusion in the receipt.

[x] V9  `ops_metrics` is still empty in production — `count()` = 0 (probe2 `E1`), so NEED_TO_FIX #30's
        premise holds and derivation-from-history is the only available producer.

[x] V10 `attempts` synthetic rows are identifiable WITHOUT reading the `answers[]` array:
        the auto-marker writes `autoCompleted: true` (`/app/functions/foundation.js:1093`) and the
        manual-override row writes `manualOverride: true` (`/app/functions/foundation.js:2985`).
        CONSEQUENCE: project those two fields and report an `excludingSynthetic` variant instead of
        guessing.

---

## GROUP A — DELTAS

[x] A1  NEW FILE `/app/scripts/deepfix2/b0-baseline.mjs` — read-only deterministic B0 producer.
        Mandatory `--from`/`--to`; half-open UTC `[from, to)`; refuses without both. Emits
        `docs/plans/deepfix2/evidence/b0-baseline.json`. Fixtures: the mutant battery in C1 plus the
        `--verify` self-diff in A3.
        BYPASS SET — N/A, and here is why, path by path: this fold adds no rule, no guard and no
        write of any kind, so there is nothing to bypass. create · update · delete · set-merge ·
        set-overwrite · FieldValue.delete() · delete-then-recreate · batch · transaction · other path ·
        third party · teacher — ALL inapplicable: the script's only Firestore verbs are `.get()` and
        `.count().get()`, proved by the C2 grep over the committed file.

[x] A2  Formula documentation carried in BOTH the file header and every receipt metric entry
        (`formula`, `numerator`, `denominator`, `exclusions`, `caveats`), including the study's
        upper-bound caveat verbatim. Case: `node … --from … --to …` then inspect the receipt's
        `metrics.R2.caveats[0]`. BYPASS SET — N/A (documentation only; no write path exists).

[x] A3  `--verify` mode: recompute over the receipt's OWN stored window and diff every scalar against
        the stored receipt; non-zero exit on any drift. Case: run `--verify` immediately after a
        produce run (expect `IDENTICAL`), then against a hand-perturbed copy (expect drift).

---

## GROUP C — FIXTURES + MUTANTS

[x] C1  FOUR one-line mutants, each applied to a COPY in the scratchpad (the committed script is never
        touched) with the receipt redirected via `--out`, run over window [2026-08-01, 2026-08-04).
        Every mutant asserts its anchor matched EXACTLY ONCE. Results (read back from the receipts):
          M1 invert R2's success/failure classification  → R2 99.7207% → 0.2793%  (num 357 → 1)   -99.4413 pts
          M2 drop the `sessionType==='new'` filter       → R2 99.7207% → 99.8428% (num 357 → 635)  +0.1221 pts
          M3 invert R6's review-only-day discriminator   → R6 165 → 124 completions                 -41
          M4 invert PASS C's `graded` classification     → R7-B 99.7199% → 0.2801% (num 356 → 1)  -99.4398 pts
        Coverage: M1 exercises PASS A's failure leg, M2 PASS B, M4 PASS C, M3 PASS D — all four passes.
        M2's RATE delta is small by construction (0.12 pts) but its NUMERATOR moves +77.9%; that is
        exactly why the receipt records numerator and denominator and not only a rate.
        Runner: `scratchpad/run-mutants.sh` (session-local, not committed — the touch-list is three files).

[x] C2  READ-ONLY proof: the CS sweep's exact mutating-verb pattern greps CLEAN over the committed
        script (pasted in the report), and the receipt records `readOnlyProof`.

[x] C3  Structural-validity flag (`pass`) in the receipt is a SHAPE check (every in-scope metric
        present, every out-of-scope metric explicitly null-with-reason, denominators > 0 where a rate
        is claimed) — never a judgement on whether the numbers are good.

## GROUP D — TRUTH REPAIRS

[x] D1  The study's R6 discriminator advice (`b0-derivability-study.md:287-289`) implies
        `serverReviewOnlyDay` is universally present and (via the sampled doc) that `newWordScore:null`
        marks a review-only day. V5/V6 falsify both. The producer records the real coverage in the
        receipt (`metrics.R6.discriminatorCoverage`) so any consumer sees it; the study file itself is
        NOT edited (out of touch-list) and this row is the durable record of the correction.

[x] D2  The study's read-cost framing implies windowed per-type aggregates are available. V1/V2/V3
        falsify that: every in-window count in this producer is a PAGE, not an aggregate, and the
        receipt's `reads` block reports the true document-read cost plus the four index definitions
        that would remove it.

[x] C4  `--verify` DETECTS a perturbed receipt, not just a matching one. The pristine script was run
        `--verify` against each mutant receipt: all four reported DRIFT and exited 1 (M1 2 leaves,
        M2 4, M3 4, M4 4), and against the real receipt it reported IDENTICAL over 125 numeric/boolean
        leaves and exited 0. So the day-before-flip freeze check is falsifiable, not decorative.

## GROUP D2 — FINDINGS DISCOVERED WHILE IMPLEMENTING (not in the brief; reported, not silently fixed)

[x] D3  **REAL BUG, caught by this producer's own first run.** `grading_jobs.leaseExpiresAt` is raw
        epoch MILLISECONDS (a number), NOT a Firestore Timestamp — `/app/functions/index.js:1121,1134`
        write `leaseExpiresAt: now + GRADE_JOB_LEASE_MS` and `:1192,:1822` compare it numerically to
        `Date.now()`. Coercing it as a Timestamp yields null, so all 5 in-window never-graded jobs were
        mis-bucketed as "claimed with no lease" and R7's headline `neverGradedRate` printed **0.0000%**
        when the true value is **0.1031%** — the study's own key R7 figure, silently zeroed. Fixed by
        `toInstant()` (b0-baseline.mjs), documented in the receipt as
        `metrics.R7-typed.sourceB.leaseFieldType`, and pinned by a fail-closed structural check
        ("every claimed grading_job was classified by an actual lease value"). Verified against
        production: all 55 all-time `claimed` jobs carry `leaseExpiresAt`, all as numbers.

[x] D4  **The study's sharpest R3 claim does not survive windowing.** `b0-derivability-study.md:169-173`
        recommends watching `functions/permission-denied` because it is 471/597 = 78.9% of all
        attempt-write failures. Full type-scan of all 597 rows (read-only, 597 reads) shows those
        failures are an INCIDENT, not a rate: 436 of 471 fell in 2026-06 (360 on 2026-06-29 alone) and
        the LAST one is **2026-07-13**. In the recommended 14-day pre-flip window there are ZERO.
        So B0 for `functions/permission-denied` is **0 (zero occurrences)**, and the correct post-flip
        watch is "any occurrence at all", not "a rise above 78.9%". The receipt carries only the codes
        actually present in the window, which is the honest shape.

## GROUP E — CARDED, NOT THIS ROUND

[x] E1  R4b (uncaught browser exceptions) — no producer exists anywhere in `/app/src`
        (`b0-derivability-study.md:234-246`). Emitted as `null` with reason; a client error reporter is
        a separate fold.

[x] E2  R1 (auth) and R5 (teacher gradebook) — ACCEPTED AS MANUALLY WATCHED per David 2026-08-05.
        Emitted as `null` with that exact reason so the receipt is complete and the narrowing is
        explicit rather than silent.

[x] E3  The four missing indexes are REPORTED, never created — `firestore.indexes.json` is outside this
        fold's touch-list. Exact definitions live in the receipt's `missingIndexes` block and in the
        report.

[x] E4  `attempt_write_failed` (`/app/src/services/db.js:175`) is unreachable on the live callable path
        (production count 0, V7) — the study's secondary finding. Not fixed here; the producer simply
        does not depend on it.

## CLOSE
[x] every row ticked with file:line + fixture ref   [x] evidence re-run AFTER the last edit
[x] numbers re-derived from the receipt JSON, never typed
[x] change log row proposed in the report (ABSOLUTE path) — orchestrator appends
[x] `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/b0-baseline-fold-ledger.md` run
[~] commit — OUT OF SCOPE for this fold (implementer must not commit or stage)
