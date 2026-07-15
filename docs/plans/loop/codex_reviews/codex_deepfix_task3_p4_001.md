# Codex review — DEEPFIX_TASK3_P4 round 1

Verdict: GO — CONVERGED-OK

`VERDICT blockers=0 high=0 med=0 nits=0`

Reviewed:

- `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p4_001.md`
- `audit/deepfix/task3/phase4_diff.patch`
- `audit/deepfix/task3/P4_impl_notes.md`
- `audit/deepfix/task2/FIX_PLAN.md` Phase P4
- P3 callable targets in `functions/foundation.js`
- routed client files in `src/`

Validation run:

- `npm run build` — PASS
- `node --check vite.config.js` — PASS
- `node --check functions/foundation.js` — PASS

The Vite build produced only existing/non-blocking chunk-size and dynamic-import warnings.

## Priority checks

### 1. Flag-off behavior

Status: acceptable.

The P4 routing flags are all default-off:

- `SERVER_PROGRESS_WRITE=false`
- `SERVER_RESET_PROGRESS=false`
- `SERVER_CHALLENGE_WRITE=false`
- `SERVER_REVIEW_MARKER=false`

The main routed paths short-circuit to legacy behavior when those flags are false:

- `recordSessionCompletion` returns to the existing client `updateClassProgress` path.
- `getOrCreateClassProgress` does not call `resolveListProgress`.
- `fetchStudentsProgressForClass` reads legacy `class_progress`.
- `resetStudentProgress` runs the existing client reset.
- `reviewChallenge` runs the existing direct `class_progress` day-advance block.
- Dashboard Panel C’s resolver effect exits before work.

Two unflagged exceptions are real but acceptable:

- The nonce store change in `src/utils/testRecovery.js` / `TypedTest.jsx` is the F1/F3 payload itself. Healthy-storage behavior remains value-equivalent; degraded storage intentionally changes from “fresh nonce per call” to “stable in-page nonce.”
- The build stamp is always-on observability and does not affect app state.

I would not call those blockers. They are the explicitly intended P4 payload/provenance exceptions, not accidental route cutover.

### 2. Nonce F1/F3/F2

Status: correct.

Evidence:

- `src/utils/testRecovery.js:13-198` implements Map → localStorage → sessionStorage, memoizing before best-effort persistence.
- `clearTestState` deletes the memo entry as well as storage, so successful completion rolls the nonce.
- `src/pages/TypedTest.jsx:771` computes `gradeAttemptDocId` once before grading.
- `src/pages/TypedTest.jsx:888-896` prefers the server-echoed `attemptDocId`, logs `nonce_identity_divergence`, then uses that one identity for the durable write.
- `src/pages/MCQTest.jsx:610-611` already uses a single nonce derivation.

This closes the degraded-storage grade/save docId split without adding a new failure mode.

### 3. `completeSession` shim

Status: correct.

Evidence:

- Client shim: `src/services/studyService.js:579-790`
- Server callable: `functions/foundation.js:880-1133`

Mapping is coherent:

- `day_guard_rejected` maps to the existing rebuild sentinel shape.
- `already_completed` maps to success-shaped idempotent retry without writing duplicate session history.
- `completed` writes the existing client-owned `users/{uid}/sessions` history record after the server has applied progress.

The thinner returned `progress` object is sufficient for current consumers. The noted future-risk around consumers expecting `recentSessions` is real but not a current blocker.

### 4. `reviewChallenge → advanceForChallenge`

Status: correct.

Evidence:

- Client route: `src/services/db.js:2844-2923`
- Server callable: `functions/foundation.js:1594-1723`

`previousScore: attemptData.score || 0` is the correct pre-acceptance score because `attemptData` is read at `db.js:2730`, before the client writes the accepted score at `db.js:2794-2798`. The server then reads the fresh attempt and validates the fail→pass transition.

The direct legacy day-advance block remains in the `else` branch and is still the flag-off path.

### 5. Teacher read, reset, and resolver fail-open

Status: acceptable.

- Teacher read: `fetchStudentsProgressForClass` now prefers `list_progress` under `SERVER_PROGRESS_WRITE` and falls back to `class_progress`. The literal callable route is impossible with the current self-service `resolveListProgress`, so the client-side read order is the right implementation for F6-2.
- Reset: `resetStudentProgress` routes to `resetProgress({listId})` under `SERVER_RESET_PROGRESS`, preserving the legacy client reset when off.
- Resolver fail-open: during P4, falling back to the legal legacy client path is acceptable. It must be revisited at/after the P6 write cutoff, but it is not a P4 blocker.

### 6. Build stamp

Status: correct.

- `vite.config.js` injects `__VOCABOOST_BUILD_INFO__`.
- `src/utils/buildStamp.js` exposes `window.__VOCABOOST_BUILD__` and logs once.
- `src/main.jsx` imports it for side effect.

Build passed with the stamp active.

## U1-U15 adjudication

- U1 — Accepted. It is not strict byte-equivalence in degraded storage, but it is the intended nonce fix.
- U2 — Accepted. Build stamp is always-on observability.
- U3 — Accepted. Current consumers do not require the full legacy progress body.
- U4 — Accepted. `already_completed` causing idempotent graduation replay is acceptable for the same-session retry path; persona coverage should still exercise it.
- U5 — Accepted for P4. Canonical-read behavior must be revisited in P5/P6.
- U6 — Accepted for P4 soak. Fail-open is posture-neutral while legacy writes remain legal.
- U7 — Accepted. Teacher seeing shared list progress is the foundation model, not a P4 regression.
- U8 — Accepted. Panel C-only resolver use matches the scoped objective.
- U9 — Accepted. Existing page error banners satisfy the blocking reload requirement.
- U10 — Accepted. Server remains authoritative even when the client preview fields are absent.
- U11 — Accepted. Timeout choices are reasonable.
- U12 — Closed by this review: local `npm run build` passed.
- U13 — Closed. `reviewChallenge` day-advance routes to `advanceForChallenge` when flagged.
- U14 — Accepted. Client-side canonical-first read is the practical teacher-read implementation unless the callable API is expanded.
- U15 — Accepted as pre-existing Dashboard structure debt. The new hooks inherit the existing teacher early-return pattern; not a P4 blocker.

## Required follow-up before live cutover

No code changes required for this draft.

Before flipping P4 live, still run the operational acceptance already listed in the notes:

- storage-stubbed nonce run;
- reset-via-callable persona;
- teacher Students-view persona;
- challenge-accept persona;
- `list_progress` stays empty pre-P5;
- build-stamp probe on the deployed hosting bundle.
