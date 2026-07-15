# Codex Review — DEEPFIX Task 3 P10 Part (d), Round 2

Verdict: GO / CONVERGED-OK

Reviewed handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p10d_002.md`  
Target plan: `audit/deepfix/task3/P10_IMPL_PLAN.md`  
Implementation notes: `audit/deepfix/task3/P10d_impl_notes.md`  
Changed files in delta: `firestore.rules`, `functions/index.js`

## Result

The round-1 findings are fixed. I do not see a remaining blocker/high in P10(d).

## Delta review

### P10d-1 — users-doc `challenges` teacher write branch

Status: fixed.

The broad teacher OR-leg is gone. `users/{userId}` update is now owner-only while preserving the `role` / `roleProvisioning` protection:

```rules
allow update: if isAuthenticated()
  && isOwner(userId)
  && !request.resource.data.diff(resource.data).affectedKeys()
    .hasAny(['role', 'roleProvisioning']);
```

This keeps owner updates to profile/settings/enrolledClasses/challenges legal while removing the “any teacher can update any student’s challenges” branch.

I also checked the remaining `isTeacher()` call sites. The remaining write/create uses are teacher-owned capability surfaces such as class/list/AP authoring, not arbitrary writes to student challenge/attempt state. The attempts update rule remains `if false`, and users-subcollection writes remain owner-only.

### P10d-2 — custom-claim merge in `provisionTeacher`

Status: fixed.

`provisionTeacher` now reads the existing Auth user and merge-sets the role claim inside the dormant claim block:

```js
const userRecord = await admin.auth().getUser(uid);
await admin.auth().setCustomUserClaims(uid, {
  ...(userRecord.customClaims || {}),
  role: "teacher",
});
```

That matches the backfill script’s additive behavior and avoids clobbering future/current custom claims.

## Checks

### Claim switch / blast radius

Status: acceptable as staged.

The Option-A hard-precondition model is still operationally sharp, but the header now accurately distinguishes:

- `isTeacher()` re-keyed claim-based surfaces;
- rules that drop `isTeacher()` entirely as narrowings.

The hard deploy order remains load-bearing:

1. claim-minting functions live;
2. claim backfill complete;
3. token refresh/re-login window complete;
4. rules deploy last.

If that token refresh window cannot be guaranteed, use the documented Option-B bridge instead. Otherwise the staged draft is coherent.

### P10c read clause

Status: unchanged.

The additive `teacherIds` attempts read clause remains intact.

## Verification

Ran:

```bash
node --check functions/index.js
node --check scripts/cs/deepfix-backfill-teacher-claims.mjs
npm run build
```

All passed. Vite emitted only existing bundle/chunk warnings.

## Final decision

P10(d) is converged from this review’s perspective. With P10(a/b), P10(c), and P10(d) reviewed to GO, P10 is fully drafted pending the staged cutover discipline and later runtime/rules-test validation.
