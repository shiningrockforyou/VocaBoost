# Codex review — DEEPFIX_TASK3_P6 round 3

Verdict: GO / CONVERGED-OK

VERDICT blockers=0 high=0 med=0 nits=0

## Scope reviewed

Round 3 asked for a narrow delta review of:

- P6-2: resolver adapter must consume a healthy canonical resolver result even when launching `class_progress` is absent.
- P6-3: Typed/MCQ raw `permission-denied` entry-time fallback must log `legacy_write_denied`.

Files checked:

- `src/services/progressService.js`
- `src/pages/TypedTest.jsx`
- `src/pages/MCQTest.jsx`
- `functions/foundation.js`
- `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p6_003.md`

## Result

The round-2 blocker is fixed.

`getOrCreateClassProgressViaResolver` now uses `result.data.mode` instead of discarding the callable result and blindly requiring `users/{uid}/class_progress/{classId}_{listId}`.

The important cases are covered:

- `mode === "canonical"`:
  - Reads `users/{uid}/list_progress/{listId}` locally for real client Timestamp objects.
  - Falls back to the callable payload if local canonical data is unavailable.
  - Synthesizes a legacy-shaped `progress` object with `id`, `classId`, and `listId`.
  - Fetches attempts and returns `{ progress, attempts }`.
  - Therefore a healthy canonical resolver success with a missing launching legacy doc no longer becomes a false `progress_resolver_unavailable`.
- `mode === "quarantined"`:
  - Returns `null`, causing the caller to fail closed. That is appropriate because quarantine is a deliberate study block.
- legacy/read-only modes:
  - Prefer the launching `class_progress` doc when present.
  - If the resolver succeeded but the local legacy doc is unexpectedly absent, synthesize from `result.data.launch.data` instead of false-failing.
- genuine resolver/local-read failure:
  - Returns `null`; caller retries once, then throws typed `progress_resolver_unavailable`.
  - No legacy client `setDoc`/`updateDoc` fallthrough is reachable while `SERVER_PROGRESS_WRITE` is on for the signed-in owner.

I also checked `functions/foundation.js`: hydrate-on-miss logs `mode: "hydrated"` but returns `mode: "canonical"` with `data`, so the adapter’s canonical branch covers both pre-existing canonical and newly hydrated canonical documents.

P6-3 is fixed:

- `TypedTest.jsx` logs `legacy_write_denied` on raw `permission-denied` / `functions/permission-denied` in the fallback study-day derivation branch.
- `MCQTest.jsx` does the same.
- The typed `progress_resolver_unavailable` path remains logged at source in `getOrCreateClassProgress`, which is correct.

Flag-off equivalence holds for this delta:

- The resolver adapter is only reached inside `if (SERVER_PROGRESS_WRITE && auth.currentUser?.uid === userId)`.
- With `SERVER_PROGRESS_WRITE=false`, the existing legacy client path remains the path of execution.
- The new Typed/MCQ logging branches are inert unless those rare denial errors are thrown.

## Validation

- `npm run build` passed.
- Notes only: existing Vite warnings about dynamic/static import chunking and large chunk size.
- `node --check` is not usable for `.jsx` files under this Node setup (`ERR_UNKNOWN_FILE_EXTENSION`), so the Vite build is the relevant JSX validation.

## Bottom line

P6 is converged from this review scope. The rules cutoff still depends on the documented deploy preconditions and emulator/persona matrix, but the R1/P6-2/P6-3 client-side over-deny gaps identified in the prior rounds are closed.
