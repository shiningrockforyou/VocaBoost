# PLAN — Grading & Write-Path Consolidation (C + D, one program)

Status: AUDITED (3-agent, 2026-06-25) — corrections in §7; read §7 alongside §1–§3. Owner: (orchestrator). Date: 2026-06-25.
Combines the two items the owner picked — **C** (`PLAN_server_side_attempt_write_v2.md`, finish Phases 3–4)
and **D** (`ROADMAP_grading_refactor.md`, Tiers 2–3) — into one dependency-ordered program, because they
touch the same files and their endpoints converge. Those two docs remain the **detailed specs**; this is
the program-level sequence, the overlap resolution, the deploy choreography, and the one open decision.

---

## 0. Thesis — C and D are one program, not two

Both rewrite the **grade → write → progress** path and both end at a **server-authoritative, locked-down**
attempt. If done independently they collide and redo each other's work. The convergence points:

| Concern | C (attempt-write v2) | D (grading refactor) | Resolution |
|---|---|---|---|
| Pass-threshold resolution | server `passThreshold` in `writeAttemptTxn` | **T2.1** `resolvePassThreshold` helper (client+server) | **one** helper, ported into `functions/` |
| Study-day derivation | (echoed in ctx) | **T2.2** `deriveAttemptStudyDay` | one helper feeds the write ctx |
| "is new test passed?" gate | — | **T2.3** `getNewWordGateStatus` (+`pending` enum) | the seam async (T3) plugs into |
| Progress write atomicity | **Phase 3**: progress into the txn (sync) | **T3.8-v2**: completion inside the grading trigger | **partly** reused — the *what-to-write* logic carries over, but a sync callable is re-shaped into an async trigger (§7-A). Sync C-P3 also only half-fixes durability (graduation moves server-side, but completion still fires client-reactively until E). |
| `attempts` rules lockdown | **Phase 4**: student can't write grade fields (backward-compatible) | **T3.3**: also enforce `pending`-shape on create | **related, NOT identical** (§7-B). Phase D's grade-field lockdown ships independently; the `pending`-shape rule ships **with** Phase E's client (the field doesn't exist until then). |
| The write itself | **Phase 1 (LIVE)** | T3.4 writes `pending` before grading | T3 changes *when* it writes; reuses P1's txn |

**Already done (don't re-plan):** C-Phase 1 (`writeAttemptTxn`/`submitVocabAttempt`/`gradeTypedTest`
writeContext) is **live & validated**. D-Tier 1 (correctness + list-scoped `getNewWordAttemptForDay` +
its composite index) is **shipped** (verified: index present in `firestore.indexes.json`, helper is
4-arg list-scoped at `db.js:3015`).

---

## 1. Sequence (dependency-ordered)

Each phase is backward-compatible and independently shippable. Risk rises as you go; value lands early.

### Phase 0 — Baseline confirm (HARD GATE, no code)
Phase A's A2 refactors the list-scoped `getNewWordAttemptForDay`, whose composite index is the Tier-1
dependency — if that index isn't live/built in prod, the query silently returns null. **Gate before A:**
- The composite `attempts(studentId,classId,listId,sessionType,studyDay,submittedAt DESC)` index is
  **present and built** (Firebase console / `firebase firestore:indexes`). (Repo shows it in
  `firestore.indexes.json`; confirm it's actually deployed, not just tracked.)
- Recent typed attempts carry `writtenBy:'cloud-function'` (C-P1 serving) — sample 26SM, last 3 days.
- Don't start A until both pass.

### Phase A — D-Tier 2: collapse the duplicated grading logic  ·  BEHAVIOR-CORRECTING REFACTOR  ·  ~2–3 focused days
The foundation both C-P3 and D-T3 stand on. **Not "no behavior change"** — unifying the divergent threshold
sites intentionally *corrects* call sites that today use the wrong fallback (that's the point); so it needs
a data-integrity sweep + targeted student repro, not just a green build (§7-C). Realistic size: ~2–3 focused
days across ~13 files, not a Sunday afternoon (§7-D). A weekend-sized slice = **A1 + A4** (threshold helper +
status constants); **A2 + A3 follow on**.
- **A1 `resolvePassThreshold(assignmentOrSettings) → fraction`** — unify ~8 sites / 37 refs with divergent
  fallbacks/units (`testConfig.js:29-58`, `DailySessionFlow.jsx:591-598/308-311`, `studyService.js:229-232`
  & ~1136, `TypedTest.jsx:352-369/86`, `MCQTest.jsx:295-315/89`, `Dashboard.jsx:1800/1835`). Mark each site
  DISPLAY vs VERDICT. **Port the same logic into `functions/`** so server verdict == client display by
  construction. Accept: 0 ad-hoc `|| 95` / `|| 0.95` outside the helper.
- **A2 `deriveAttemptStudyDay({...}) → number`** — extract the copy-pasted day fallback + stale-context
  guard from both test pages (`TypedTest.jsx:713-755`, `MCQTest.jsx:536-591`) into `src/services/studyDay.js`
  (leaf util; verify no import cycle). Keeps the `attempt_day_*` telemetry. Removes ~40 lines/page.
- **A3 `getNewWordGateStatus(...) → 'not_submitted'|'pending'|'failed'|'passed'`** — one attempt-derived
  classifier for the ~27 "is it passed?" recomputations. **Decision (§7-E):** A3 is bigger than A1/A2 because
  rewiring `determineStartingPhase`/`completeSessionFromTest`/routing to read it touches the phase-resolution
  *lock* (the Tier-1 Blocker-#1 area). Either do A3 fully (extract **and** rewire, higher risk) or split it:
  **A3p** = define the helper+enum now (prep, unused), rewire in T3. Recommend **A3p** for the weekend — keep
  the lock untouched until the async work that needs it.
- **A4 `ATTEMPT_STATUS` constants** (`PENDING/IN_PROGRESS/GRADED/ERROR/NEEDS_TEACHER_GRADE`), shared
  client+`functions/`. Vocabulary only; legacy (no status) treated as `GRADED`.
- **Do NOT** pre-extract the TypedTest/MCQTest grading twins or `gradeWithRetry` — T3 deletes them.
- Deploy: client-only build/push (owner). No functions/rules/index change. **Lowest-stakes phase.**

### Phase B — C-Phase 2: finish the client cutover  ·  SMALL
Make the server-write path the only path: drop the flag-gated old `submit*Attempt` fallback from the test
flow (keep `submit*Attempt` for CS/manual e.g. `scripts/cs/manual-pass.mjs`). Removes the dual-writer
ambiguity before we restructure further. Client-only.

### Phase C — C-Phase 3: progress write into the transaction  ·  DURABILITY WIN  ·  MEDIUM
The remaining client-write-after-success: `completeSessionFromTest` writes `session_states`/`class_progress`/
graduation on the client *after* the grade returns. Crash there = corrupt session / lost graduation → stuck
student (this is the 손지우 class; CSD/TWI self-heal via reconciliation but **graduation + recentSessions do
not**). Move those writes server-side, atomic with the attempt.
- **Decision gate (§2):** build this synchronously now, OR fold straight into T3's trigger. The *logic*
  (what to write atomically) is identical either way — sync-now relocates into the trigger at T3.8-v2.
- Functions deploy (backward-compatible). Its own mini-audit (the v2 plan flags this).

### Phase D — attempt write lockdown  ·  SECURITY  ·  detailed spec = `PLAN_attempt_write_lockdown.md`
**Concrete spec lives in `PLAN_attempt_write_lockdown.md`** (W1 submitChallenge→callable, W2 server-only
create + empty-review-marker migration, W3 rules). Codex correction: an earlier draft here "preserved the
student `answers`-update branch" and "allowed student create" — **both are the forgery vectors**, so Phase D
must deny them, not preserve them:
- **student create → `false`** (server/Admin-SDK only); requires W2 first (finish create cutover + migrate the
  `DailySessionFlow.jsx:962` automarker) so nothing legitimate client-creates.
- **student `answers`-update branch → REMOVED** (`submitChallenge` becomes a callable, W1); kills the live
  #1c laundering. (This corrects the old "answers-only, preserve submitChallenge" line.)
- **student delete:** own attempt (reset) — kept. **teacher update:** kept until the override callable removes
  it (coordinate, don't pre-break; §7-F). **CS/Admin SDK:** unaffected.
- **Does NOT close MCQ forgery:** MCQ `isCorrect` is still client-*computed* at submit. True MCQ correctness
  authority is **deferred to Phase E** (server-owned option token / test-init snapshot) — NOT a "fast-follow,"
  and NOT closeable by `selectedOptionId` (forgeable; see `PLAN_server_authoritative_grading.md` §1/§8.3). §7-G.
- This Phase D is the **shared prerequisite** for the teacher-grade-override feature (its §0.4).
Rules deploy — staged, low-traffic window; functions live first.

### Phase E — D-Tier 3: async write-triggered grading  ·  CAPSTONE  ·  LARGE / MULTI-DAY
Full spec `DESIGN_async_grading.md`. An `onDocumentCreated` trigger grades server-side; client writes
`pending` first and listens; adds `AWAITING_GRADE` state + a "채점 중" screen; a stale-pending sweeper; a
teacher pending-grade queue; **deletes** `gradeWithRetry` + the client score/verdict (the §8 counts must
DROP — "replace, don't parallel"). Reuses A (helpers), C (atomic completion → trigger), D (rules). Requires
the full Playwright suite + deploy-choreography rehearsal. **Not a weekend; sequence last.**

---

## 2. The one real decision — incremental vs leap (for the owner)

- **Incremental (recommended):** A → B → **C (sync progress-in-txn)** → D (rules) → later E (async).
  Ships the durability fix (Phase C) and the security lockdown (Phase D) **soon**, in small backward-compatible
  deploys; Phase C's atomic-completion logic is later *relocated* into T3's trigger (T3.8-v2), not wasted.
  Lower per-step risk; value lands before the big async project.
- **Leap:** A → B → **E (async)** directly, letting the trigger own completion (skip standalone Phase C) and
  the rules (fold Phase D into E). Fewer total deploys, but one big risky UX+rules+function cutover with no
  durability win until it all lands.

**Honest trade (§7-H):** incremental is *lower per-step risk* but likely *more total work* — Phase C built
synchronously is partly re-shaped when E lands, and Phase C **alone doesn't fully fix the stuck-student bug**
(completion still fires client-reactively until E). So the recommendation is **conditional**:
- **Incremental** only if E is >~2 weeks out AND the durability/security wins are operationally urgent now
  (active stuck-student tickets, forgeable-attempt concern).
- Otherwise **leap** (A → B → E) — fewer deploys, E absorbs C's logic and the rules anyway.
Either way, **Phase A first** (both paths need it), then decide C-vs-E based on whether E is actually next.

## 3. Near-term slice (this weekend)

The weekend = **Phase A, scoped realistically** — start with **A1 (threshold helper) + A4 (status constants)**,
which is the genuinely weekend-sized, low-risk, high-value core (kills the threshold-divergence bug class:
threshold display, day-stamping, retake bypass). **A2** (study-day extract) and **A3p** (gate-status prep)
follow on — the full Phase A is ~2–3 focused days, **not** one afternoon (§7-D). No deploy choreography for A.
C/D/E are follow-on, each its own audit + coordinated deploy. Decide incremental-vs-leap (§2) only *after* A.

## 4. Deploy choreography (cross-cutting — the real risk)
- **A/B:** client-only build+push. No backend.
- **C:** functions deploy first (backward-compatible), client after.
- **D:** rules deploy in a low-traffic window; verify students still submit (challenge update + reset still
  allowed) and forged score writes now rejected.
- **E:** functions + rules FIRST, client SECOND (never write `pending` docs nothing grades); rehearse on a
  staging project or low-traffic window; rollback = revert client to sync, sweeper drains orphan pendings.
- I (Claude) **cannot** build/push/deploy (Windows node_modules mount + no creds) — **owner runs all builds
  & deploys**; I verify via live bundle hash + Korean-string greps.

## 5. Process discipline (answers "are we writing patch logs?")
- **Every code change → `change_action_log.md`** row (`| Date | File | Change |`), noting plan + "not
  committed/deployed" until the owner ships.
- **Each significant phase → a `PATCH_*.md`** root-cause/implementation write-up (matches the existing
  `PATCH_threshold_display_fix.md` etc. convention).
- **Each phase audited before deploy:** `/plan-audit` (3-agent) + Codex, per our norm.
- **Data-integrity sweep around every deploy (§7-I):** owner runs `scripts/cs/data-integrity-sweep.mjs 26SM`
  immediately **before** and **after** each phase deploy; accept = no increase in invalidAnchor / csdImplausible
  / reviewNoNewPass / ghostProgress / orphanTwi. Any increase → rollback. (Phase A especially: it touches the
  threshold/gate logic that the Tier-1 Blocker-#1 fix lived in.)
- **Verification when I can't deploy (§7-J):** after the owner builds+pushes, I confirm via live bundle hash +
  grep of the new symbols (`resolvePassThreshold` etc.) in the bundle + a targeted student repro (26SM:
  start a test, verify the displayed threshold == the assignment's, submit, verify the gate routes right).
- CS/data interventions (none expected here) → `SUPPORT_RUNBOOK.md`.

## 6. Out of scope (this program)
Teacher grade-override (separate plan; intersects Phase D rules + the override callable — sequence the rules
change once). Per-list progress refactor. Review-test real pass threshold. Tenant isolation (separate plan).
MCQ correctness authority (deferred to **Phase E** — server-owned option token / test-init snapshot; not a
post-Phase-D fast-follow, since `selectedOptionId` is forgeable).

---

## 7. Audit corrections (3-agent, 2026-06-25)

Note: one reviewer misread the plan as claiming **Phase A is already done** — it is not; only C-Phase 1 and
D-Tier 1 are marked done (§0). The findings below are the *verified* ones, folded into §0–§5 above.

- **A — "C-P3 relocated, not wasted" was overstated.** A synchronous Phase-C callable is *re-shaped* (not
  copy-pasted) into E's async trigger, and C-P3 alone leaves completion client-reactive (only graduation/
  recentSessions move server-side). → §0 table + §2 corrected to say "partly reused; partial durability win."
- **B — Phase D ≠ T3.3.** Phase D = students can't write grade fields (backward-compatible, deployable now).
  T3.3 = also enforce the `pending`-shape on create — that field doesn't exist until E, so it ships **with**
  E, not in D. → §0 table + §1 Phase D + §4 corrected.
- **C — "pure refactor / no behavior change" is false for A1.** Unifying divergent thresholds deliberately
  *corrects* wrong-fallback sites → needs the data-integrity sweep + repro, not just a green build. → §1 Phase A.
- **D — Phase A is ~2–3 focused days, not an afternoon** (~13 files, ~37 threshold refs). → §1 + §3 reset; weekend slice = A1+A4.
- **E — A3 is heavier than A1/A2** (rewiring the phase-resolution lock). → split into **A3p** (prep now,
  rewire in T3); recommend A3p for the weekend.
- **F — Coordinate Phase D with the teacher-grade-override plan.** Keep the `teacherId===caller` attempt-update
  branch until the override callable ships; that callable removes it. Don't pre-break it in Phase D. → §1 Phase D.
- **G — Phase D does NOT close MCQ forgery.** `isCorrect` stays client-supplied; MCQ correctness authority is
  **deferred to Phase E** (server-owned init), not a fast-follow — `selectedOptionId` is forgeable. → §1 Phase D + §6.
- **H — Incremental costs more total work and only half-fixes durability.** Recommendation made **conditional**
  (incremental only if E is >2 weeks out and the wins are urgent; else leap). → §2.
- **I — Per-phase data-integrity sweep** (before/after, no-regression acceptance). → §5.
- **J — Deploy-verification protocol** for a deploy-less Claude (bundle hash + symbol grep + targeted repro). → §5.
- **K — Phase 0 is a HARD GATE** on the Tier-1 index being live/built (else A2's query silently nulls). → §1 Phase 0.
- Carried from C's own Codex round (still apply): idempotency-id reuse, review-always-passes branch, no-AI
  write path, pre-AI existing-attempt check, anchor echo-not-recompute, user-stats deprecation already done
  server-side (don't re-introduce in A1). See `PLAN_server_side_attempt_write_v2.md` §11–§12.
