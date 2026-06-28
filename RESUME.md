# RESUME — current active work

> **This is the canonical resume file.** When the user says "resume," read this first, then any
> linked spec. **Rotate at each save-state:** copy this file to `docs/resume_archive/RESUME_<date>.md`
> (copy, don't move), then overwrite the active-stream section below with the new state. History lives
> in `docs/resume_archive/` (see its README). It's fine for the section to point to a detailed plan in
> `docs/plans/`.

---

## ▶ ACTIVE STREAM (updated 2026-06-28): Grading concurrency — pick up at Phase 2

**Status:** Phase 1a (recovery slice) IMPLEMENTED + DEPLOYED + VALIDATED LIVE.
Next: Phase 2 (deterministic identity / cross-device dedup). Read this, then the spec
`docs/plans/PLAN_grading_idempotent_concurrency.md` (v7, Codex verdict: implementation-ready).

---

## Where we are

### Phase 1a — DONE, LIVE, VALIDATED (the "grading recovery slice")
Closes the false "Grading Failed" / re-grade-on-lost-response class (the 06-22 incident, ~21 students).
Scope: lost-response + same-attempt idempotency ONLY. **No identity change, no side-effect move,
NO cross-device dedup** (that's Phase 2 — two devices with different nonces still grade twice).

**Deployed (owner deployed from working tree; default flag ON):**
- `functions/index.js` — `grading_jobs/{attemptDocId}` claim/lease/fence + grade-OUT-of-txn + result
  cache + new `getGradingStatus` callable. Keyed off the EXISTING nonce `attemptDocId` (no new identity).
  Fail-closed persist: only `persisted`/`already_graded` return a grade; superseded/lease_expired/absent
  → throw `aborted`; error → `unavailable`. Consts: `GRADE_JOB_ENABLED=true` (kill-switch = flip
  false + redeploy), `GRADE_JOB_LEASE_MS=180000`.
- `firestore.rules` — `grading_jobs`: server-write-only (`create,update,delete: if false`), owner-read.
- `src/pages/TypedTest.jsx` — `gradeWithRetry` polls `getGradingStatus` on in_progress, recovers cached
  grade before retry/throw, no-loop on deterministic errors; error modal branched (deterministic →
  **Reload Page** button).

**Validated live (2026-06-28):**
- Rules: 5/5 (`_rulescheck` — owner read ok; client create/update/delete denied; non-owner read denied).
- Server invariants: 14/14 — `dsg-edits/srv_validate/grading_job_tests.mjs` (cache-hit/no-re-grade,
  status channel, ownership, expired-lease takeover, in_progress, concurrent→one-job, rules deny,
  superseded + lease-expired fencing).
- UI recovery: 10/10 — `dsg-edits/srv_validate/phase1_ui_audit.mjs` (A1 no-regression, A2 FORCED
  lost-response → recovers, NO "Grading Failed", one attempt, no re-grade; A3 rapid double-submit→one).
- No regression: `persona_runs.mjs careful,korean` clean (server-ai, probes pass).
- Challenge accept/reject re-verified on tonight's build (0 bugs) — `reviewChallenge` UNCHANGED by Phase 1a.

**NOT committed** (standing rule: commit only on explicit say-so; deploy was from the working tree).
Change log: `change_action_log.md` (3 fix rounds + impl rows, 2026-06-28).

### Known open edges (non-blocking)
- Rare ~180s orphan-lease tail on a persist-txn `error` (self-heals via takeover; uncommon).
- A4 deterministic "Reload Page" modal: code-verified, NOT exercised live (needs forced malformed payload).
- No realtime listeners in student app → a teacher grade change / day-advance needs the **student to
  refresh** (normal refresh, not hard). Possible future `onSnapshot` enhancement.

---

## Phase 2 — what to build next (cross-device dedup + identity)

This is what actually fixes "multiple attempts shoved into the cloud" across devices. Full design is
`PLAN_grading_idempotent_concurrency.md` §3 (v7 state machine). Ship P2 as ONE release (don't split):

**Core (plan §3):**
- `startTest` server callable — authoritative, concurrency-safe: deterministic session key
  `test_sessions/{uid}_{class}_{list}_day${studyDay}_${sessionType}_e${resetEpoch}` (NOT testType-keyed),
  transactional create-or-return, server-derived studyDay/segment/allocation + server-allocated generation.
- Job/submission/ledger/outcome/automarker keys ALL epoch-scoped (`_e${resetEpoch}`).
- Immutable submission docs (history-preserving — best-passed selection, timesTestedTotal, challenges).
- Deterministic outcome pointer `attempt_outcomes/...` with exact comparator
  (force-pass → passed → score → generation → submissionId); server-recomputed on every mutation.
- Finalize txn writes deterministic effect ledgers (graduation made deterministic; day-advance idempotent).

**Hard preconditions (do these FIRST / as part of P2):**
1. **W3 attempts create-lockdown** (`docs/plans/W3_attempts_lockdown.rules.md`, `create: if false`) — the
   deterministic key is guessable → forge-by-pre-create without it. W3 has its own preconditions (flags on).
2. **`startTest` complete server re-derivation** of the study-set builder (or it blocks — no client fallback).
3. **Remove direct client attempt deletion** + migrate reset to a server `resetProgress` callable
   (epoch-tombstone + idempotent batched cleanup; not one unbounded txn).
4. **Migrate `reviewChallenge` + teacher override/force-pass to server transactions** that maintain
   attempt+outcome atomically.
5. **G2 enforcement stays ON**; the folded write still stamps `correctnessSource:'server-ai'`.
6. **Deploy order:** functions-first behind a server-honored flag; client only after server owns identity.
7. **Pre-cutover 26SM census** (dup attempts + invalid anchors) via `data-integrity-sweep`; converge
   only onto valid anchors.

**Migration uniqueness:** the claim/job transaction is the authority (NOT a field-query dual-read);
make anchor/gradebook readers dedup-aware during the mixed-scheme window. Composite indexes deployed first.

**Test infra to adopt (plan §7-INFRA):** claude.ai's concurrency suite — build the `assertTestScope`
isolation harness FIRST (namespace `__cctest__<ts>_<rand>`, refuse-to-start, guard every destructive
admin-SDK op), negative-control discipline (every race test demonstrably able to fail), concurrency
timestamps, the 7 cases. (For Phase 1a these were already covered live-green; for P2 they become real.)

---

## Process notes / how this stream runs
- Workflow norm: implement → owner deploys → I validate (Playwright + direct harness) → Codex review
  rounds until "implementation-ready" → fix → re-validate. The plan went through 3-agent + 6 Codex
  rechecks; expect Phase 2 to get the same scrutiny.
- I CANNOT build/deploy from the container (win32 esbuild on WSL; owner does all builds/deploys).
- `firebase deploy --only functions:a,functions:b` failed in the owner's CLI ("No function matches");
  use `firebase deploy --only functions` (all; skips unchanged) — that worked.
- Harnesses live in `dsg-edits/srv_validate/` (gitignored, its own git repo). Sandbox accounts kept:
  `mday_*` (10 personas) + `mday_teacher_20260628` + `mday_chalstu_20260628` + class
  "25WT MDay Challenge Test" (`mday_challenge.json`). 25WT/26SM split: 26SM = real (only genuine CS).
- Audit batch: `audit/playwright/batches/B_GRADING_IDEMPOTENT_CONCURRENCY_UI.md` (Codex black-box doc,
  scope-banner added: RUN-NOW vs DEFER-PHASE2 vs NOT-IMPLEMENTED).

## First moves tomorrow
1. Re-read `PLAN_grading_idempotent_concurrency.md` §3 (v7) + §8 Phase 2 + §7-INFRA.
2. Decide: implement the W3 lockdown chain first (its own preconditions) vs `startTest` re-derivation
   first — both gate P2. Probably scope `startTest`'s study-set re-derivation feasibility first (it can
   block the whole phase).
3. Run a fresh 26SM `data-integrity-sweep` census before any identity cutover.
