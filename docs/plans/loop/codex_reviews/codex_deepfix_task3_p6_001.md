# Codex review — DEEPFIX_TASK3_P6 round 1

Verdict: NEEDS_FIXES

VERDICT blockers=1 high=0 med=0 nits=0

## Scope reviewed

- Target: `firestore.rules`
- Handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p6_001.md`
- Notes: `audit/deepfix/task3/P6_impl_notes.md`
- Cross-layer checks: `src/services/progressService.js`, `src/services/studyService.js`, `src/pages/DailySessionFlow.jsx`, `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`, `src/pages/Signup.jsx`, `functions/index.js`

## Finding P6-1 — BLOCKER — R1 over-deny is real: P6 denies the legacy hydration fallback, but the client still falls into it

The rules draft correctly denies owner writes to `users/{uid}/class_progress`, but the current client still treats resolver failure as fail-open and drops into the legacy client write path during session entry.

Evidence:

- `firestore.rules:109-114` denies writes to `class_progress`, `list_progress`, and `progress_meta` through the user-subcollection wildcard.
- `src/services/progressService.js:111-116` routes through `resolveListProgress` when `SERVER_PROGRESS_WRITE` is on, but if the resolver returns no routed result, it explicitly falls through to the legacy path.
- That legacy path can write:
  - `src/services/progressService.js:130-139`: create missing `class_progress` with `setDoc`.
  - `src/services/progressService.js:261-284`: reconcile mismatch with `updateDoc`.
- This is reached on session entry:
  - `src/services/studyService.js` calls `getOrCreateClassProgress` from `initializeDailySession`.
  - `src/pages/DailySessionFlow.jsx:574` calls `initializeDailySession`; the init catch at `DailySessionFlow.jsx:872-874` only shows the raw/generic error.
- The P4 `legacy_write_denied` handling exists for completion writes (`DailySessionFlow.jsx:1531-1544`, and analogous Typed/MCQ completion paths), but not for entry-time hydration/reconciliation.

So after P6, a transient resolver outage, callable auth issue, or resolver-side error on a student with a missing or recon-needed progress doc no longer fails open. It falls through to a client `setDoc`/`updateDoc`, the rules deny it, and the student sees a session-load failure instead of a controlled reload/retry path. This is exactly the R1 over-deny described in the handoff.

Required fix before P6 can be considered deploy-safe:

1. Do not let `getOrCreateClassProgress` fall through to legacy client writes in the P6-cutoff world when `SERVER_PROGRESS_WRITE` is enabled for the signed-in owner.
2. Prefer a controlled fail-closed branch: retry the resolver if appropriate, then throw/return a typed error such as `progress_resolver_unavailable` or `legacy_write_denied`.
3. Extend the P4 denial UX/logging to entry-time initialization in `DailySessionFlow`, `TypedTest`, and `MCQTest`, not only completion writes.
4. Add an emulator/persona case for resolver unavailable + missing/recon-needed progress doc under P6 rules. The expected result should be a controlled reload/retry message and a `legacy_write_denied`/resolver-unavailable log, not a raw Firestore permission failure.

The mitigation proposed in the handoff — extending the denial handler to `getOrCreateClassProgress` before deploy — is directionally correct, but it is not implemented in this draft. Until it is, this rules cutoff can lock out live students on the exact outage path P4 originally made fail-open.

## Checks that look correct

These did not produce blockers in this pass:

- C-28 role self-write closure looks structurally correct. User create allows only absent role or `student`; owner update excludes actual changes to `role` and `roleProvisioning`.
- The signup/provisioning split is coherent. Signup creates a student; `provisionTeacher` is server-side/Admin SDK, currently gated by `TEACHER_PROVISIONING_ENABLED=false`, and `teacher_invites` are client-denied.
- C-29 attempt lockdown is structurally closed in rules: student create/update/delete are denied; teacher update remains for override paths. This is safe only with the stated deploy preconditions that server attempt/review-marker writes are live.
- `SERVER_REVIEW_MARKER` being ON is a real hard precondition. If it is off, P6 can break review-marker creation because client attempt writes are denied. The rules header correctly calls this out.
- Keeping teacher writes to `study_states` / `session_states` under the user-subcollection wildcard appears intentionally necessary until the teacher override/reviewChallenge path is moved server-side. This is a residual broad rule, but not a P6 blocker given role self-forgery is closed and the R7 role sweep is treated as a deploy prerequisite.

## Bottom line

Do not ship P6 as-is. The rules themselves close the intended holes, but they expose an unfixed entry-time availability path. Fix R1 at the client/service boundary, add the explicit test, then re-review P6.
