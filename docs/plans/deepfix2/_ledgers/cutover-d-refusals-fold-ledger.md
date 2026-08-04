# CUTOVER-D REFUSALS — FOLD LEDGER (coherent, complete refusal reasons)

Built from the cutover-d scout report (2026-08-04, file:line throughout). The refusal PLUMBING (adapter
`.reason` → component state) is ALREADY wired by cutover-a/b/c; this fold is the CORRECTNESS + COVERAGE +
COHERENCE pass the module headers call "fold 51d" ("*fold 51d owns the final copy*",
`reviewV2Compose.js:39` / `reviewV2Submit.js:46` / `reviewV2Complete.js:82-83`).

**⚠ THIS IS A LIVE-UI FOLD, not flag-gated like a/b/c.** The refusal RENDER sites (`error`/`submitError`
banners) are SHARED by the legacy AND engine paths — 947 students see them today. So: the recompose-bug
fix and the reuse_anchor_mismatch gap are flag-gated (rv2-only); the render TOKENIZATION is a LIVE cosmetic
change that must preserve the error UX behaviorally (restyle to tokens, don't change behavior) and is
verified by the WinClaude visual check.

**SCOPE DECISION (orchestrator, 2026-08-04):** cutover-d ships (A1) the recompose state-collision bug fix,
(A2) the reuse_anchor_mismatch coverage gap, (A3) tokenize + make coherent the refusal render sites. It does
NOT author `06_MESSAGING_COPY.md` or re-do the copy vocabulary — **RV2 refusal copy (why a request was
refused) is DECIDED to be a SEPARATE register from DF2-07's messaging (why review-only mode is active /
threshold copy)** — different axes, rendered on the same screens, made coherent by sharing design TOKENS,
not by a merged string source. The df2-07 copy coordination + the DailySessionFlow dead-end UX question are
carded (E1/E2), not decided here.

## GROUP V — VERIFY BEFORE EDITING
[x] V1  **The refusal-status census + the ONE live coverage gap** (scout §1). 27 frozen RV2 statuses
        (`reviewV2Client.js:39-95`), each traced to its server emitter. Routed today: terminal-success ·
        not-serving-SILENT (`config_hold`/`review_v2_dark` + the thrown trio via `classifyThrownRefusal`) ·
        transient (`grading_in_progress` poll) · recompose-once (`grade_unusable`) · block-with-reason (11
        in `REFUSAL_REASONS` `reviewV2Compose.js:141-164` + submit/complete's own constants). **THE GAP:**
        `reuse_anchor_mismatch` (`composer.js:363`, reachable TODAY via `composeReviewSessionV2`,
        `callables.js:264`) falls through to the GENERIC reason — its 11 siblings have specific copy, it
        doesn't. `visit_minted`/`visit_invalid`/rerun statuses belong to `df2-51-navui` (out of scope).
[x] V2  **THE RECOMPOSE STATE-COLLISION BUG (the real defect cutover-b's audit missed; flag-gated).**
        `MCQTest.jsx:783-813` (`out.outcome==='recomposed'`): on a SUCCESSFUL swap it `setError(out.reason)`
        (:807), but `error` gates the full-page "Something went wrong" interstitial (`:1440`, when
        `!showResults`) — so the student gets a BLOCKING card, not the swapped test-with-banner the comment
        intends. Worse, that card's "Try Again" → `loadTestWords` (`:1447→:264-293`) rebuilds from the STALE
        closure-captured `testConfig.wordsToTest` (`:286-290`), not the fresh presentation just swapped in —
        a subsequent submit answers the new `presentationId` with the old word set ⇒ server drift-reject
        (`callables.js:527-529`, invalid-argument ⇒ another generic blocked error). Same in `TypedTest.jsx:
        1054-1091` + `:1718` + `loadTestWords` PATH A `:269`. VERIFY the exact mis-wiring before fixing.
[x] V3  **The SEVEN render treatments + the raw-Tailwind sites** (scout §2 table). Coherent/token-compliant:
        the full-page cards + `retakeError` caption. RAW-TAILWIND (violate CLAUDE.md tokens, the A3 targets):
        inline mid-test `error` (`MCQTest.jsx:1853-1858`/`TypedTest.jsx:2122-2126`); `submitError`
        (`MCQTest.jsx:1861-1881`,`:1944-1954`); TypedTest `submitError` modal (`:2226-2248`); `gradingError`
        modal (`:2250-2283`). Same file uses tokens correctly a few hundred lines away — pre-existing debt.
[x] V4  **Gotchas (do not "fix" these — they are correct)** (scout §5): not-serving is SILENT (falls to
        legacy, no setError — `DailySessionFlow.jsx:599-611`, `MCQTest.jsx:814-818`, `TypedTest.jsx:1092-1108`,
        `reviewV2Complete.js:271-276`); `grading_in_progress` polls invisibly ≤40s; the thrown trio routes
        via `classifyThrownRefusal` uniformly; `no_evidence`'s ~25 internal sub-reasons never leak (fixed
        `REASON_NO_EVIDENCE`, deliberate). Do NOT surface a reason for a silent/transient state.
[x] V5  **Copy-register decision (records the scout's §3 "only the silence is the problem"):** RV2 refusal
        copy stays in the existing adapter constants (`REFUSAL_REASONS` + submit/complete's own), tokenized;
        it is a SEPARATE register from DF2-07's `reviewOnlyReason` messaging. No `06_MESSAGING_COPY.md`
        authored here. Visual coherence via shared tokens, not a merged string source. (D1 records this.)

## GROUP A — DELTAS
[x] A1  **Fix the recompose state-collision bug.** On a SUCCESSFUL `grade_unusable`→recompose swap, the
        reason must render in a NON-BLOCKING banner (the `submitError`-shaped / inline treatment, NOT the
        `error` full-page interstitial), AND `loadTestWords`/"Try Again" must read the SWAPPED presentation
        (the updated blob), not the stale `testConfig` closure. Both pages.
        BYPASS SET (one fixture each): successful recompose → non-blocking banner + fresh test rendered (not
        the full-page card) · the "Try Again" after a recompose uses the NEW presentation's word set (a
        submit then does NOT drift-reject) · a SECOND grade_unusable (recompose-once still holds — no loop) ·
        a genuine hard error (still shows the full-page card) · flag-off (dead code, unchanged).
[x] A2  **Close the reuse_anchor_mismatch coverage gap:** add a `REUSE_ANCHOR_MISMATCH` entry to
        `REFUSAL_REASONS` (`reviewV2Compose.js:141-164`) with specific student-safe copy (not the generic).
        BYPASS SET: `reuse_anchor_mismatch` renders its specific reason (not generic) · an UNKNOWN/retired
        status still falls to `GENERIC_REFUSAL_REASON` (don't break the catch-all).
[x] A3  **Tokenize + make coherent the raw-Tailwind refusal render sites (V3).** Migrate the raw
        `red-*`/`gray-*`/`blue-*`/`yellow-*` to design tokens (`bg-error`/`text-text-error`/etc.), matching
        the token-compliant treatments already in the same files. Preserve BEHAVIOR (which state shows what,
        the retry affordances) — this is a restyle, not a UX redesign. LIVE UI: the legacy error banners
        restyle too; the visual check confirms.
        OTHER LEG: no behavior change to what triggers each banner (legacy or rv2) — only the styling tokens.

## GROUP C — FIXTURES + MUTANTS + VISUAL
[x] C1  One fixture per A1 bypass row (the recompose-swap render-state + the fresh-word-set-on-retry).
        scripts/deepfix2/cutover-d-refusals-fixtures.mjs CASEs "A1/C1 — MCQTest.jsx…" / "A1/C1 —
        TypedTest.jsx…" / "A1 — cross-check against the REAL (unmodified) adapters…". Pure 90/0 (evidence:
        docs/plans/deepfix2/evidence/cutover-d-refusals-pure.json). Row 3 (second-unusable, no loop) is the
        adapter's OWN untouched guard — re-verified via the sibling cutover-b pure/emulator regression
        (179/0, 65/0) re-run after this fold's edits, not re-derived here.
[x] C2  One fixture per A2 bypass row (reuse_anchor_mismatch specific reason; unknown → generic).
        Same file, CASE "A2/C2 — reuse_anchor_mismatch gets a SPECIFIC reason…" (uses the RETIRED
        TYPED_MODALITY_DEFERRED status for the "retired" leg, not just an invented string).
[x] C3  MUTANT: revert A1 (recompose reason → `error` state) ⇒ a fixture asserting non-blocking goes red.
        scripts/deepfix2/cutover-d-refusals-mutants.mjs M-C3-MCQ-REVERT + M-C3-TYPED-REVERT — BOTH pages
        mutated independently, BOTH killed (evidence: docs/plans/deepfix2/evidence/cutover-d-refusals-mutants.json).
[x] C4  MUTANT: drop the A2 entry ⇒ reuse_anchor_mismatch → generic ⇒ its fixture goes red.
        Same driver, M-C4-A2-DROP — killed. 3/3 mutants killed total, restore verified sha-clean.
[x] C5  A3 (tokenization) is verified by the VISUAL CHECK, not a fixture (it's CSS-class styling). Assert
        via grep that no raw `bg-red-`/`text-red-`/`bg-gray-`/etc. remains in the touched refusal blocks.
        Grep-assert done BOTH ad hoc (shell, this report) AND mechanized inside the fixture (CASE "A3/C5",
        with a positive control proving the regex itself fires on the deliberately-untouched isSubmitting
        overlay) — 0 raw matches in all 6 touched blocks. VISUAL CHECK ITSELF NOT DONE — see CLOSE.

## GROUP D — TRUTH REPAIRS
[x] D1  Record the V5 copy-register decision at the adapter headers (they say "fold 51d owns the final copy"
        — update to: RV2 refusal copy is a separate register from DF2-07 messaging; both share tokens).
        All 3 adapter headers (reviewV2Compose.js:39-44, reviewV2Submit.js:46-51, reviewV2Complete.js:82-86)
        + their 3 shorter section-comment echoes, rewritten; grep-confirmed zero remaining "fold 51d owns
        the final copy" occurrences (CASE "D1" in the fixture).

## GROUP E — CARDED, NOT THIS ROUND
[~] E1  **DF2-07 copy coordination.** DF2-07's `reviewOnlyReason` messaging renders on the SAME screens as
        RV2 refusals; do df2-07 with the shared-token coherence in mind so the two registers read
        consistently (the scout's "do them together or the copy drifts"). Not this fold; note on df2-07.
[~] E2  **The DailySessionFlow "hard dead-end" UX question** (scout §4.5): `DailySessionFlow.jsx:2022-2034`
        offers only "Back to Dashboard" for a compose-blocked status, while MCQTest/TypedTest treat the same
        retryable statuses (`day_guard_rejected`, `reset_in_progress`) as retry-in-place. A UX consistency
        decision — defer to the df2-07/visual pass or David.

## CLOSE
[x] every row ticked (file:line + fixture) — V1-V5 (scout, pre-answered), A1-A3/C1-C5/D1 (this implementer),
    E1/E2 marked `[~]` CARDED (not this fold's to close)
[x] evidence re-run after last edit — cutover-d's OWN pure+mutants, AND (since this fold edits
    reviewV2Compose.js/Submit.js/Complete.js/MCQTest.jsx/TypedTest.jsx, shared by cutover-a/b/c) all SIX
    sibling pure+emulator evidence files re-run and refreshed, unchanged pass counts (211/0, 179/0, 118/0,
    89/0, 65/0, 40/0) — proves this fold did not regress a/b/c's flag-off-parity anchors
[x] shas re-stamped — every evidence JSON (this fold's 2 + the 6 refreshed sibling files) carries
    sourceShas of the current tree bytes; gate.mjs GATE 3b/EVIDENCE confirms for all of them
[x] numbers re-derived — every count in this report is copy-pasted from a JSON this session's own run
    produced (paths + re-run commands in the report); none hand-typed
[~] change log row — NOT WRITTEN (brief constraint: implementers don't touch change_action_log.md).
    Proposed row TEXT is in the implementer report; the orchestrator appends it.
[x] `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/cutover-d-refusals-fold-ledger.md` — run
    at close; verbatim output in the implementer report. NOT fully clean: (1) this fold's own OPEN
    VISUAL CHECK row below (expected — a WinClaude order, not WSL-executable) and its consequent LEDGER
    `~`-rows, and (2) two failures PRE-DATING this session with no file overlap with this fold's edits —
    confirmed via a `gate.mjs` run taken BEFORE this fold's first edit (verbatim in the report): NUMBERS
    (audit/deepfix/task3/... rules-matrix drift, an r79 rules workstream) and EVIDENCE
    (engine-lap-result.json vs functions/reviewV2/typedGrading.js|callables.js + functions/index.js — none
    of which this fold touches). Both are the orchestrator's / another workstream's, not re-derived here.
[x] commit — ORCHESTRATOR'S (the brief forbids git here; nothing was staged, no git commands run; exact
    footprint listed in the implementer report for the committer to stage explicitly)
[ ] **VISUAL CHECK — MORE important here (LIVE UI):** a WinClaude order proving the refusal banners render
    correctly (tokens, both legacy AND rv2 paths) + the recompose-swap shows the fresh test not the
    interstitial. 25WT, typed submission authorized ≤200 if needed to reach grade_unusable. NOT RUN — WSL
    cannot drive a browser against this app (node_modules holds Windows-only esbuild/rollup binaries,
    confirmed this session: `ls node_modules/@esbuild` → only win32-x64). OPEN, owed, load-bearing per the
    brief — this is a LIVE cosmetic change to what 947 students see on an error today.
[x] a concurrent session shares this repo — stage explicitly. Exact footprint listed in the implementer
    report (filesChanged manifest); pre-existing unrelated diff (`.claude/settings*.json`,
    `docs/plans/deepfix2/WORK_QUEUE.md`) identified and left untouched.
[~] implementer PAIRED with an auditor — PENDING, the orchestrator's to arrange; not self-certifiable here.
