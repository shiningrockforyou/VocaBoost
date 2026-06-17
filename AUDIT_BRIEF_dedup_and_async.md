# Codex Audit Brief — deduplication, async-grading readiness, architecture health

You are auditing the VocaBoost React/Firebase codebase (`/app`). Three goals, in priority order:
**(A)** measure & map the duplication so it can be safely consolidated, **(B)** pressure-test the
async-grading design in `DESIGN_async_grading.md`, **(C)** assess overall architecture health and name the
highest-leverage structural fixes. This is a **read-only audit**: produce findings + concrete
recommendations + a patch PLAN. Do NOT change code unless explicitly asked in a follow-up.

Context docs to read first: `DESIGN_async_grading.md`, `STATUS_AND_AUDIT_PLAN.md`,
`DESIGN_per_list_progress.md`, `change_action_log.md` (recent rows = this session's patches:
connection-logging, Fix F threshold, Fix H studyDay, in-session retake guard #1/#2, #7 attempt-authoritative
resume). The owner runs `npm run build` and all `firebase deploy` (the auditor environment cannot deploy).

Output a single report: `AUDIT_REPORT_dedup_and_async.md` with sections A/B/C, each finding tagged
**[Blocker] / [High] / [Medium] / [Nitpick]**, every claim citing `file:line`, and each recommendation
marked **{extract-now} / {fold-into-async} / {defer}**.

---

## A. Deduplication audit (PRIMARY)

The owner's concern: surgical patches this session followed existing duplication instead of fixing it, and
the codebase is accreting toward spaghetti. Quantify it precisely, then propose the minimal consolidation.

**A1. Threshold resolution.** Find EVERY site that resolves a pass threshold (the
`passThreshold > 0 ? x/100 : DEFAULT` / `|| 95` / `|| 0.95` / `?? 0.95` pattern, and every `useState(0.95)`).
Start points: `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`, `src/pages/DailySessionFlow.jsx`,
`src/services/studyService.js`, `src/services/progressService.js`, `src/pages/Dashboard.jsx`. For each:
file:line, what it feeds (display vs verdict), and whether it can diverge from the server's verdict.
Deliver: a single proposed `resolvePassThreshold(assignment)` signature + the exact list of sites it
replaces + which sites are DISPLAY-only (keep) vs VERDICT (must match server).

**A2. "Is the new-word test passed?" decision.** Map every independent computation of this gate
(`score >= threshold`, `newWordsTestPassed`, `newWordAttemptPassed`, `requiresNewWordRetake`,
`attemptsSayReviewPending`, `startPhase === REVIEW_STUDY`). Classify each as: (i) legit defense-in-depth
lock, (ii) redundant recomputation that should read a single source, or (iii) a divergence risk (two sites
that could disagree). Recommend the canonical source (attempt-derived) and which call sites collapse to
reading it.

**A3. studyDay derivation.** Fix H copy-pasted the same derivation into TypedTest and MCQTest
(`getNewWordAttemptForDay(... csd+1)` blocks, ~4 sites). Confirm, and propose a single
`deriveStudyDay(...)` helper (signature + sites). Flag any behavioral drift between the two copies.

**A4. TypedTest vs MCQTest twins.** These two large files (~1570 / ~1438 lines) implement
submit/attempt-write/studyDay/threshold/completion separately. Identify the shared concerns that are
duplicated vs genuinely divergent (MCQ is client-graded, no cloud call — that part SHOULD differ).
Recommend what to extract into shared hooks/services (e.g. `useTestSubmission`,
`submitAttempt`/`completeFromTest` wrappers) and what to leave alone. Estimate LOC reduction.

**A5. Other duplication sweep.** Date/streak math, `getStartOfToday`/week helpers, attempt-fetch queries,
session_state read/write wrappers, PDF payload threshold hardcodes (`Dashboard.jsx` ~1800/1835). List any
3+-copy pattern with a single-home recommendation.

For A: also produce a **dedup priority table** — pattern, #copies, divergence risk, effort, and tag
{extract-now} (do before async) vs {fold-into-async} (the refactor deletes it anyway, don't pre-extract).
Key judgment: do NOT recommend extracting something that §8 of `DESIGN_async_grading.md` is going to delete.

---

## B. Async-grading design review (validate `DESIGN_async_grading.md`)

Adversarially pressure-test the design. For each, confirm feasible against the actual code or raise a
[Blocker]/[High]:

**B1. Write-then-trigger-then-snapshot.** Verify the attempt write currently persists the raw `answers`
(incl. `studentResponse`) BEFORE grading (`submitTypedTestAttempt`, `src/services/db.js:~1276`). If grading
input isn't fully persisted at write time, that's a [Blocker] for async — specify exactly what must be added.

**B2. Idempotency.** The trigger must grade exactly once (`pending → graded` transactional / status guard).
Check the attempt docId is deterministic (per-session nonce) so retries/duplicate events can't double-grade
or re-introduce words. Identify every place an attempt is created and whether any could create duplicates.

**B3. The lock (§6).** Verify the two enforcement layers actually hold: (i) `determineStartingPhase`
(`studyService.js:57`) refuses REVIEW_STUDY without a graded+passed new attempt; (ii)
`completeSessionFromTest` refuses to complete when not passed. Confirm `pending`/`error` map to
"review blocked" everywhere, and hunt for ANY path (browser back/forward, bookmarked `?type=review`, stale
tab, history) that could complete a day without a server-written passing grade. This is the highest-value
check — the owner specifically wants the door LOCKED, not just hidden.

**B4. `AWAITING_GRADE` state.** Verify adding it to the phase machine (`SESSION_PHASE`, the resume blocks in
`DailySessionFlow.jsx`, and `determineStartingPhase`) is coherent and that re-entry while pending routes to
the grading screen (not a fresh test, not review). List every switch/branch on phase that must learn the
new state.

**B5. Completion timing.** v1 keeps completion client-reactive to the `graded` snapshot. Confirm
`completeSessionFromTest` can be driven from a snapshot transition without races against the reconciliation
in `getOrCreateClassProgress` (progressService) and the `automarker` review-attempt pattern. Flag any
double-completion or revert risk.

**B6. Rules & security.** Sketch-check §9 against `firestore.rules`: students create `pending` with
server-only fields null/forbidden; can't write `graded`/`score`/`passed` or mutate `isCorrect`; can't
update a graded attempt. Note that `isTeacher()` is a GLOBAL role (any teacher can write any student) —
acknowledge as known, don't block.

**B7. Sweeper & error handling.** Validate the `onSchedule` stale-pending sweeper approach
(`functions/index.js` already uses `onSchedule`). Confirm there's a defined terminal state for every
failure mode (no silent infinite `pending`).

**B8. Coexistence/migration (§10).** Confirm legacy attempts (no `gradingStatus`) are treated as `graded`
and that mixed old/new attempts can't corrupt the gate or reconciliation. Verify the deploy order
(functions+rules BEFORE client) is actually required and sufficient.

**B9. Consolidation contract (§8).** This is the crux: verify that the design, as written, actually
DELETES the client logic it claims (gradeWithRetry, client score, client pass verdict, threshold sites,
studyDay copy-paste, the sync modal) rather than adding a parallel path. If any part would end up running
BESIDE the new path, call it [Blocker] and say how to make it a replacement.

---

## C. Architecture health (general)

**C1.** Name the top 5 structural issues by support-load / corruption risk. Candidates from the session:
per-class vs per-list progress (`DESIGN_per_list_progress.md`), client-authoritative session_state
(partially fixed by #7 — verify the auto-save effect can no longer revert server/admin resets), threshold
duplication, TypedTest/MCQTest twins, scattered day/phase derivation, lack of a teacher "exception" surface.

**C2.** For each: is it being addressed by current direction (async grading, #7, per-list design), partially
addressed, or unaddressed? Recommend sequence.

**C3.** Regression check on THIS SESSION's patches (change_action_log rows dated 2026-06-17): confirm Fix #1
(handleReturnFromTest gate), Fix #2 (requiresNewWordRetake honored in both test pages), Fix F (PATH-B
threshold), Fix H (studyDay derivation + stale-context guard), and #7 (attempt-authoritative resume; removed
`sessionSaysReviewResume`) are internally consistent and don't conflict with each other or with the async
design. Flag any place two of these fixes overlap or fight.

**C4.** Confirm the deferred items are still tracked & correct: G (error classification — intentionally
skipped this session because it rewrites the same `gradeWithRetry` async will delete; verify skipping was
right), the `firestore.indexes.json` export (live reconciliation composites untracked in repo — risk a
future deploy drops them), the 7 same-list dual-enrollments.

---

## Deliverable format
`AUDIT_REPORT_dedup_and_async.md`:
1. **Executive summary** — are we spaghettifying? (yes/no/trending), and the 3 changes that most reduce
   complexity.
2. **A. Dedup** — findings + the priority table ({extract-now} vs {fold-into-async}) + proposed helper
   signatures.
3. **B. Async design** — per-item verdicts; any [Blocker] before build; the §8 consolidation-contract check.
4. **C. Architecture** — top-5 + sequence + regression check on this session's patches.
5. **Recommended build order** — reconcile with `DESIGN_async_grading.md` §12; flag disagreements.
Every claim: `file:line`. Every rec: tag + effort. No code changes in this pass.
