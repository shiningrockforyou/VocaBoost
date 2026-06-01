# Feature spec — Edit student display name (student self-edit + teacher roster edit)

Status: SPEC for review (per user). Build after OK. Verified against live code 2026-06-01.

## Current state (verified)
- `displayName` is written ONCE at signup (`createUserDocument`, db.js) into `users/{uid}.profile.displayName`. No edit path anywhere.
- **It is DENORMALIZED into a second location:** `classes/{classId}/members/{uid}.displayName` (written by `joinClass`, db.js:~942). The teacher roster (ClassDetail) and parts of the gradebook read the MEMBER copy, not the user profile. ⚠️ **A rename MUST update both, per class the student is in, or rosters show the old name.**
- AuthContext holds `user.profile.displayName` in React state (set at load/login). After a self-edit we must update that state so the UI reflects the change without a reload.
- Firestore rule (`/users/{userId}`): owner can write own doc; a teacher can ONLY write the `challenges` key (`hasOnly(['challenges'])`). So the teacher path REQUIRES a rule change.

## Data-write contract (the core of the feature) — one shared helper
Add to db.js:
```js
// Update a user's display name in BOTH the profile and every class member doc.
export const updateDisplayName = async (userId, newName) => {
  const name = (newName || '').trim();
  if (!userId) throw new Error('userId required');
  if (name.length < 1 || name.length > 60) throw new Error('Name must be 1–60 characters.');
  // 1) profile (source of truth)
  await setDoc(doc(db, 'users', userId), { profile: { displayName: name } }, { merge: true });
  // 2) denormalized member copies — find classes this user is a member of.
  //    Prefer enrolledClasses on the user doc (authoritative for the student's classes).
  const userSnap = await getDoc(doc(db, 'users', userId));
  const enrolled = userSnap.exists() ? Object.keys(userSnap.data().enrolledClasses || {}) : [];
  await Promise.all(enrolled.map(classId =>
    setDoc(doc(db, 'classes', classId, 'members', userId), { displayName: name }, { merge: true })
      .catch(e => console.warn('member displayName update failed for', classId, e))
  ));
  return name;
};
```
Notes: member-update failures are non-fatal (profile is source of truth; roster can be reconciled). Trim + length-bound the name (prevents the empty-name / oversized issues the audit flagged elsewhere). Do NOT allow HTML — it's rendered as text (React escapes), but keep it clean.

## PART 1 — Student self-edit (Settings page)
- Add a new "프로필 / Profile" section at the TOP of the Settings card (above Theme): a label "표시 이름 / Display Name", a text input pre-filled with `user.profile?.displayName`, a Save button, inline success/error, disabled while saving.
- On save: `await updateDisplayName(user.uid, value)`, then update AuthContext state so the dashboard "Welcome, {name}" updates live. AuthContext needs a small exposed updater — add `updateUserName(name)` to the context that does `setUser(u => ({...u, profile:{...u.profile, displayName:name}}))` (and the firebase-auth `updateProfile(currentUser,{displayName})` for completeness). 
- Rules: NO change needed — student writes their own `users/{uid}` doc + their own member docs (member create/update allows `isOwner(memberId)`).
- Edge cases: empty/whitespace → block with message; trim; 60-char cap; reflect in the header without reload.

## PART 2 — Teacher/TA roster edit (ClassDetail)
- In the roster row (ClassDetail ~852, the `member.displayName` cell), add a small pencil IconButton → inline edit (input + check/cancel) or a tiny modal. On confirm: `await updateDisplayName(member.id, value)`, then refresh the roster (re-run loadMembers or optimistically update the row).
- **Rules change REQUIRED** (firestore.rules `/users/{userId}` write): currently teachers may only touch `['challenges']`. Two options:
  - (A) Broaden to allow a teacher to also write the profile name:
    `(isTeacher() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['challenges','profile']))`
    — simplest, but lets ANY teacher rename ANY user's profile (the file already has a TODO noting teacher writes are over-broad). Acceptable for a trusted-TA tool; document it.
  - (B) Tighter: move the rename to a Cloud Function (Admin SDK) that checks the teacher actually owns a class the student is in, then writes. More secure, more work. Recommended if student data sensitivity matters.
  - The teacher ALSO writes `classes/{id}/members/{uid}.displayName` — the members rule already allows the class owner to update member docs? CHECK: members rule allows `create, update: if isOwner(memberId)` (the student), and delete by owner-teacher. So a TEACHER updating a member doc's displayName is NOT currently allowed either → the rule for members would also need `|| class-owner` on update. Factor this in.
- Given the rules complexity, **recommend the teacher path use option (B) Cloud Function** OR scope (A) carefully. Flag for decision at build time.

## Verification plan (after build)
- Student: change name in Settings → header updates live → reload → persists → roster (teacher view) shows new name → gradebook shows new name.
- Teacher: rename from roster → member doc + profile both updated → student's own dashboard shows new name on next load.
- Rules: a student cannot rename ANOTHER student (denied); a teacher rename allowed only via the chosen path.
- Edge: empty/oversized/whitespace blocked; special chars stored safely (no XSS on render).

## Open decisions for build
1. Teacher path: rule-broaden (A) vs Cloud Function (B). (B) recommended.
2. Member-doc update on teacher rename needs a members-rule update too (or do it in the CF).
3. Whether renaming should also update Firebase Auth displayName (cosmetic; the app reads Firestore profile, so optional).
