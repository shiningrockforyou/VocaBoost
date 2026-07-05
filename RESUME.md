# RESUME — current active work

> **This is the canonical resume file.** When the user says "resume," read this first, then any
> linked spec. **Rotate at each save-state:** copy this file to `docs/resume_archive/RESUME_<date>.md`
> (copy, don't move), then overwrite the active-stream section below with the new state. History lives
> in `docs/resume_archive/` (see its README).

---

## ▶ ACTIVE STREAM (updated 2026-07-04, evening): List progress is student-owned — plan SETTLED at v3.2, start Phase 0/1

**Task:** make list progress live with **student + list** (class confers only ACCESS + daily quota/policy).
Closes the class-change day-reset cluster (`NEED_TO_FIX.md` #6).
**Read the plan first:** `docs/plans/PLAN_list_progress_persist.md` — **v3.7, AUDIT-CLEAN (8 Codex rounds
+ 2 internal 3-agent rounds; Codex round-8 verdict "architecture-ready"), all decisions settled with
David.** Do NOT re-open the model questions; the doc's §12 lists every settled call, §13 the
consciously-accepted residual races (deferred to the grading rework, which owns the server primitives),
and §6 P5 the accepted dormant-tab cutoff residual. Key late corrections to know: centralized
`resolveListProgress` for ALL paths (reads fall back in-memory, writes hydrate), quarantine = resolve-to-
zero pre-flip + BLOCK backstop, cutoff = gate-early → 14-day no-legacy-write window → wildcard restructure.

**How the plan got here (audit lineage, full detail in plan Appendix A):**
v1 → 3-agent (Lens A/B/C, Opus) + Codex ×2 → v2 (server-claim architecture) → **David's principle reframe**
("progress is student-owned; class = access + quota") → v3 → fresh 3-reviewer + orchestrator re-audit
(Fable 5) → v3.1 (reset-resurrection, hydrate-on-miss, field-disposition table) → Codex round 3 → **v3.2**
(CSD merge rule, reset deletes legacy docs too, catch-up merge, pairing lineage, transactional hydration,
Phase-1 flag-gated; §13 accepted-risk inventory).

**Settled decisions (don't re-ask):** teacher visibility = shared truth incl. shared last-session cell;
day = session count (pacing badge reads per-class enrollment date); policy bundle follows the launching
class; §11 grading-session-key change deferred to grading rework; **Option B** — ship on client-writable
footing, `#1b`/`#1c` lockdown is a parallel high-priority track; `getPrimaryFocus` de-scoped (nice-to-haves
#3b).

**Phase 0 ✅ RUN (2026-07-04):** `dsg-edits/srv_validate/list_progress_audit.mjs` + report
`list_progress_audit_2026-07-04.json`. Numbers: 1043 (student,list) pairs / 766 students; **69 collision
pairs (62 in 26SM)**; **54 dual-enrolled in 26SM** (plan §13.1 corrected — the "≈zero" claim was wrong;
§5.4 guards are load-bearing); **quarantine total 70 but ZERO in 26SM** (all in retired/ext-cohort legacy
lists; David: leave ext alone — excluded from migration scope, revisit only if a retired student returns).

**Phase 1 ✅ IMPLEMENTED + AUDIT-CLEAN (Codex diff-review ×5, final verdict 2026-07-05: "no remaining
code-level blockers, safe to deploy flag OFF." NOT deployed — needs owner):**
- Backups: `dsg-edits/srv_validate/impl_backups_20260704/` (pre-change copies of all touched files).
- `src/config/featureFlags.js` — new `LIST_SCOPED_RECON = false`.
- `firestore.indexes.json` — **7 new attempts composites** (semantic diff verified vs backup):
  (studentId,listId,submittedAt) · (…,sessionType,studyDay,submittedAt) · (…,sessionType,submittedAt) ·
  (…,sessionType,passed,newWordEndIndex DESC,submittedAt DESC — also serves the >=0 range filter) ·
  (…,sessionType,passed,studyDay DESC) · (studentId,classId,listId,sessionType,studyDay,submittedAt ASC) ·
  (studentId,listId,sessionType,studyDay,newWordStartIndex,passed,submittedAt DESC — gate query, round 3).
- `src/services/db.js` — flag-gated: `getMostRecentPassedNewTest` list-scoped anchor by
  `newWordEndIndex DESC, submittedAt DESC` + studyDay-ordered sparse fallback [V7/C5-3];
  `getReviewForDay` → discriminated `{status: found|none|query-error}` (universal; sole caller updated)
  + anchor-class/temporal-lineage pairing [C3-6/C4-5]; `getRecentAttemptsForClassList` list-scoped;
  `getNewWordAttemptForDay` opt-in `{listScope}` (ONLY the completion gate opts in — TypedTest/MCQTest
  day-stamping call sites deliberately class-scoped [F1]). `getMostRecentNewTest` untouched (dead code —
  zero callers).
- `src/services/progressService.js` — CSD **non-demoting** `Math.max(stored, anchor)` under flag [C3-5]
  (twi stays anchor-authoritative); review pairing wired; `cleanupOrphanedReviews` **LOG-ONLY** under flag
  (`orphaned_attempt_flagged`, no delete) [C5-2]; query-error leaves CSD protected; `updateClassProgress`
  returns inert `dayGuardRejected` marker on duplicate-day rejection.
- `src/services/studyService.js` — Day-2+ gate uses `{listScope}` + **position-consistency** check
  (attempt.newWordStartIndex must equal sessionConfig.newWordStartIndex) [V4]; day-guard rejection →
  `clearSessionState` + `day_guard_rejected_session_cleared` system_log (flag-gated) [V9/§5.4].
- Verified: eslint = 11 pre-existing no-unused-vars only (0 new); all changes flag-gated (flag-off =
  legacy behavior); getReviewForDay's only caller updated.
- **Codex diff-review round 2 (2026-07-05, 4 findings, ALL FIXED):** (P1-1) query-error pins CSD to
  storedCSD exactly; missing anchor lineage → query-error, never a silent launching-class fallback.
  (P1-2) position-consistency fails CLOSED. (P1-3) day-guard rejection ABORTS completion
  (`requiresSessionRebuild`; TypedTest/MCQTest show "session refreshed — answers saved"); marker
  flag-gated. (P1-4) anchor can't be suppressed by malformed nwei. +TypedTest/MCQTest in touched set.
- **Codex diff-review round 3 (2026-07-05, 3 findings, ALL FIXED — flag stays OFF):** (P1r3-1)
  cross-class gate trust now requires `passed===true` IN THE QUERY (failed attempt can't mask a pass or
  leak its score into the local-threshold fallback; legacy score-fallback is launching-class-only by
  construction). (P1r3-2) bounded scans eliminated — gate uses an indexed equality query
  (**NEW 7th composite:** studentId,listId,sessionType,studyDay,newWordStartIndex,passed,submittedAt DESC);
  anchor uses type-scoped range filter `newWordEndIndex>=0` + limit(1) (reuses existing composite).
  (P1r3-3) `clearSessionState` returns success; day-guard block retries once, escalates
  `day_guard_session_clear_FAILED` (error) + `sessionCleared:false` when the stale doc survives.
  sessionService.js joins the touched set. eslint still 0 new errors.
- **Codex diff-review round 4 (2026-07-05, 2 findings, BOTH FIXED — flag stays OFF):** (P1r4-1)
  `sessionCleared` propagated to both UIs; `false` → distinct blocking recovery message ("answers saved,
  session could not be reset — reload / tell your teacher"), never a false "refreshed" claim. (P1r4-2)
  Codex factual correction accepted — Firestore interleaves ints and doubles, `>=0` can't exclude a
  malformed 999.5 — anchor lookup now PAGINATES (position-DESC, startAfter, pages of 10) until the first
  valid integer anchor or exhaustion; malformed floats can never suppress a valid anchor. Expected cost
  1 page (data is integer-only; Phase-0 found 0 floats). eslint 0 new.
- ⚠ No automated coverage for the new branches yet (Codex note) — the §9 persona runs are the validation.
- ⚠ Working tree ALSO carries earlier-session uncommitted changes (functions/index.js deploy-provenance,
  runbook entries) — do not assume the whole diff is Phase 1.

**First moves on re-launch:**
1. **Owner deploys indexes FIRST** (`firebase deploy --only firestore:indexes`), waits for build.
2. Owner builds/deploys the client (flag still OFF — zero behavior change; this just ships the code +
   the future min-version gate surface).
3. **Validate flag-off invariance** (persona run: no `list_progress` writes — n/a yet — and unchanged
   reconciliation logs), then flip `LIST_SCOPED_RECON = true` in a quiet window + rebuild → run plan §9
   Phase-1 personas (move persona 이주헌-pattern; dual-enroll 박주하-pattern; cross-pace; reset).
4. Then Phase 2 (resolveListProgress + hydrate-on-miss, §5.2) — the next implementation chunk.
3. Then Phases 2-6 per plan §6 (hydrate-on-miss §5.2, list-aware reset §5.3, §5.4 guards, rules §10,
   migration §8 w/ catch-up, retire).

**Standing constraints:** dsg-edits + admin scripts touch LIVE data — read-only first, back up before
writes, owner deploys code (I can't build/deploy from this container). Never commit without explicit say-so.
26SM = real cohort; 25WT = sandbox. Log: code → `change_action_log.md`; CS/data → `SUPPORT_RUNBOOK.md`.

### Queued behind this (do not lose)
- **`#1b`/`#1c` attempt-write + role lockdown** (`PLAN_attempt_write_lockdown.md`) — Option B made this a
  **parallel high-priority track**, not blocked behind list-progress. Forgeability is arguably the bigger
  real-world risk than the §13 races.
- **Grading concurrency Phase 2** (`PLAN_grading_idempotent_concurrency.md` v7): now ALSO owns the three
  server primitives this plan consciously skipped — **list-scoped** `startTest` (`{uid}_{listId}_day…`,
  plan §11), transactional finalize (day-advance), epoch `resetProgress`. Plan §13's table = its acceptance
  checklist. Phase 1a is DONE+LIVE+VALIDATED (see `docs/resume_archive/RESUME_2026-07-04.md`).
- **`retakeThreshold` 0.95 fix** (`NEED_TO_FIX.md` #5) — data normalized cohort-wide (CS-2026-07-04b), code
  still open.
- **Teacher grade-override** (#1) + DSG mock-exam session-loss cluster — separate subsystems, unscoped.
- **getPrimaryFocus progress-preferring fallback** (nice-to-haves #3b) — de-scoped from the plan; small
  standalone fix.

### Prior stream (grading concurrency Phase 1a) — archived
Full state incl. deployed artifacts, validation results, harness locations, sandbox accounts:
`docs/resume_archive/RESUME_2026-07-04.md`. Key facts: Phase 1a live (grading_jobs claim/lease/fence,
`getGradingStatus`, rules server-write-only), NOT committed (standing rule), owner deploys from working
tree, `GRADE_TOKEN_ENFORCED=false` since CS-2026-06-29 (re-enable needs nonce hardening — bundled with
grading rework).
