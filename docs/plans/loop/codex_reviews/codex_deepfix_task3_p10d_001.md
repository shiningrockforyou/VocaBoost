# Codex Review — DEEPFIX Task 3 P10 Part (d), Round 1

Verdict: NEEDS_FIXES

Reviewed handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p10d_001.md`  
Target plan: `audit/deepfix/task3/P10_IMPL_PLAN.md`  
Implementation notes: `audit/deepfix/task3/P10d_impl_notes.md`  
Changed files: `firestore.rules`, `functions/index.js`, `scripts/cs/deepfix-backfill-teacher-claims.mjs`

## Summary

The custom-claim switch is mechanically coherent and the two named narrowings are present. However, one live teacher-breadth write branch remains: any teacher can still update any user document’s `challenges` field.

P10(b) moved challenge review server-side, so this branch appears to be dead for legitimate client traffic for the same reason the subcollection write and attempts update branches are now dead. Leaving it in place preserves a known “any teacher can mutate any student challenge state” rule surface.

That needs to be fixed or explicitly justified as still live.

## Findings

### P10d-1 — HIGH — `users/{userId}` teacher `challenges` update branch remains open

Location: `firestore.rules:140-147`

Current rule:

```rules
allow update: if isAuthenticated() && (
  (isOwner(userId)
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['role', 'roleProvisioning'])) ||
  (isTeacher() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['challenges']))
);
```

After P10(d), `isTeacher()` is claim-backed. This branch therefore still lets any claim-teacher update the `challenges` field on any `users/{userId}` document.

Why this is a problem:

- The notes already identify this as U6: client `reviewChallenge` used to need this branch to update `users/{student}.challenges.history`.
- P10(b) moved `reviewChallenge` server-side; the callable updates `challenges.history` through Admin SDK.
- P10(d) narrows the sibling users-subcollection teacher write branch and removes the attempts teacher update branch for the same reason: no legitimate client teacher write remains after P10(b).
- Leaving this branch means P10(d) still has a broad teacher-write surface over student challenge state.

Required fix:

- Remove the teacher OR-leg from `users/{userId}` update, leaving owner-only updates, or
- provide concrete evidence of a remaining legitimate client teacher write to `users/{student}.challenges` that must survive.

Suggested narrowed shape:

```rules
allow update: if isAuthenticated()
  && isOwner(userId)
  && !request.resource.data.diff(resource.data).affectedKeys()
    .hasAny(['role', 'roleProvisioning']);
```

Rollback coupling should match the other P10(d) narrowings: if `SERVER_OVERRIDE` / server-side `reviewChallenge` is rolled back, this rule must be reverted in the same rules redeploy.

### P10d-2 — MEDIUM — `provisionTeacher` replaces custom claims instead of merging them

Location: `functions/index.js:2058-2061`

Current code:

```js
await admin.auth().setCustomUserClaims(uid, {role: "teacher"});
```

The backfill script correctly merge-sets claims:

```js
{ ...(p.existingClaims || {}), role: 'teacher' }
```

`provisionTeacher` should use the same merge pattern unless the project can prove no user redeeming a teacher invite can already carry another custom claim. Replacing custom claims is a footgun for future roles/claims and creates inconsistent behavior between new-teacher provisioning and backfill.

Suggested fix:

```js
const userRecord = await admin.auth().getUser(uid);
await admin.auth().setCustomUserClaims(uid, {
  ...(userRecord.customClaims || {}),
  role: "teacher",
});
```

This adds one Auth read only when `TEACHER_CLAIM_ENABLED` is true.

## Checks that passed

### `isTeacher()` claim switch

Status: mechanically OK.

`isTeacher()` now returns:

```rules
request.auth.token.role == 'teacher'
```

The call sites I inspected are guarded by `isAuthenticated()`, so missing claims fail closed rather than dereferencing unauthenticated state.

### Named narrowings

Status: partially OK.

The two named narrowings are present:

- `users/{userId}/{subcollection}` write is narrowed to `isOwner(userId)`.
- `attempts/{attemptId}` update is now `if false`.

The remaining issue is the users-doc `challenges` branch above.

### Backfill script

Status: OK.

The backfill script is dry-by-default, commit-sentinel guarded, merge-sets existing claims, reports `MISSING_AUTH`, and verifies after commit.

### Transition model

Status: acceptable if treated as a hard operational gate.

Option A — hard preconditions rather than claim-OR-doc transition — is acceptable only if the deploy checklist is enforced literally:

1. claim-minting function live;
2. backfill complete;
3. token refresh/re-login window complete;
4. rules deploy last.

This is operationally sharp, but the blast radius is documented clearly. If that D3 refresh window cannot be guaranteed, use the documented Option B bridge instead.

## Verification

Ran:

```bash
node --check functions/index.js
node --check scripts/cs/deepfix-backfill-teacher-claims.mjs
npm run build
```

All passed. Vite emitted only existing bundle/chunk warnings.

## Final decision

Do not sign off P10(d) until the remaining `users/{userId}.challenges` teacher-write branch is removed or justified with concrete evidence, and preferably align `provisionTeacher` with the backfill script’s merge-claim behavior.
