# Codex review — DEEPFIX_TASK3_P6 round 2

Verdict: NEEDS_FIXES

VERDICT blockers=1 high=0 med=1 nits=0

## Scope reviewed

Round 2 asked for a narrow R1 delta review:

- `src/services/progressService.js`
- `src/pages/DailySessionFlow.jsx`
- `src/pages/TypedTest.jsx`
- `src/pages/MCQTest.jsx`
- `functions/foundation.js` resolver contract
- P6 rules context

## What is fixed

The original round-1 blocker is closed for resolver-outage fallback:

- `getOrCreateClassProgress` now retries `getOrCreateClassProgressViaResolver` once when `SERVER_PROGRESS_WRITE` is on and the request is for the signed-in owner.
- If both attempts fail, it throws a typed `progress_resolver_unavailable` instead of falling through to the legacy `setDoc`/`updateDoc`.
- Therefore the original P6-denied client write path is no longer attempted on resolver outage.
- `DailySessionFlow` now has an entry-time controlled reload/retry UX for `progress_resolver_unavailable` and raw `permission-denied`.
- Typed/MCQ fallback study-day derivation also blocks with controlled UX for the typed error.

That part is correct.

## Finding P6-2 — BLOCKER — Resolver success can still fail closed in canonical mode because the client ignores the callable result and rereads `class_progress`

The R1 fix prevents client writes on resolver outage, but the resolver-success path still has a P5/P6 cutover mismatch.

Evidence:

- `functions/foundation.js` documents and implements two modes for `resolveListProgress`.
- In canonical/write-capable mode, a canonical `users/{uid}/list_progress/{listId}` doc can be the authoritative result. The callable can return `mode: "canonical"` directly when canonical exists.
- `src/services/progressService.js:391-406` calls `resolveListProgress({ listId, classId })`, but discards the returned payload. It then unconditionally reads `users/{userId}/class_progress/{classId}_{listId}`.
- If that launching legacy doc is missing, `progressService.js:398-402` returns `null`; the caller retries once and then throws `progress_resolver_unavailable`.

That means a successful resolver response can be converted into an apparent outage solely because the launching `class_progress` doc does not exist.

This is not just theoretical after P5/P6:

- P5 introduces canonical `list_progress`.
- P6 denies client writes to both `list_progress` and `class_progress`.
- Legacy docs are preserved until P7, so old migrated pairs may still work, but new/fresh class-list paths after canonical cutover are not guaranteed to have a launching `class_progress` doc.
- In those cases, the server can successfully resolve/create/read canonical progress, but the client throws `progress_resolver_unavailable` because it insists on a legacy doc reread.

Required fix:

1. Make `getOrCreateClassProgressViaResolver` consume the callable response when no launching `class_progress` doc exists.
2. Preserve the existing return contract `{ progress, attempts }` for consumers:
   - If a launching legacy doc exists, returning that doc is fine for P4/P6 legacy-parity.
   - If not, synthesize/read progress from the resolver response/canonical `list_progress` doc, with a stable `id`, `classId`, and `listId` shape expected by downstream code.
3. Still fetch attempts with `getRecentAttemptsForClassList(userId, classId, listId, 8)` unless the canonical-mode design intentionally requires list-scoped attempts here; if so, document and test that explicitly.
4. Add the P6 emulator/persona case: canonical `list_progress` exists or is created; launching `class_progress` missing; session entry must succeed without any client progress write.

Until this is fixed, P6 can strand students on fresh/new class-list paths even when the resolver is healthy.

## Finding P6-3 — MED — Raw permission-denied logging is inconsistent in Typed/MCQ fallback derivation

The handoff says raw `permission-denied` is logged as `legacy_write_denied` on entry-time paths. That is true for `DailySessionFlow`, but not for the fallback study-day derivation catches in `TypedTest.jsx` and `MCQTest.jsx`.

- `DailySessionFlow.jsx:882-888` logs `legacy_write_denied` for raw permission denial.
- `TypedTest.jsx:856-860` and `MCQTest.jsx:578-582` show controlled UX for raw denial but do not log `legacy_write_denied`.

This is not the main safety issue because the typed `progress_resolver_unavailable` path is logged at source. But if these fallback derivation paths ever see raw denial, CS observability will be weaker than the handoff claims.

Suggested fix: log `legacy_write_denied` in the Typed/MCQ raw-denial branches too, or narrow the claim/test expectation to `DailySessionFlow` only.

## Bottom line

The original outage fallthrough is fixed, but P6 is not converged. The client resolver adapter still assumes a launching legacy `class_progress` doc even after P5 canonical progress exists. That is a deploy-blocking entry-time over-deny risk under the P6 cutoff.
