# Plan — Name Change Feature (student self-edit + teacher/TA roster edit)

Investigated the live profile menu + data paths 2026-06-01. This plan supersedes the earlier NAME_EDIT_SPEC.md and incorporates what the dashboard profile menu actually does.

## Profile-menu investigation findings (important — these change the plan)

The avatar dropdown lives in `src/components/HeaderBar.jsx` (global header). Clicking the avatar (CircleUser icon, top-right) opens a menu with:
- user header: **displayName + email**
- **Profile** → links to `/profile`
- **Settings** → links to `/settings`
- Sign Out

**Two PRE-EXISTING BUGS found while investigating (fold into this work):**
1. **`/profile` route does NOT exist.** App.jsx has no `/profile` route and there is no Profile page file. The menu's "Profile" link → falls through to the `*` catch-all → `<Navigate to="/" replace />`, i.e. **clicking "Profile" silently bounces to the dashboard.** Dead link today.
2. **HeaderBar reads the WRONG field for the name.** Line 26: `const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'`. But AuthContext stores the name at **`user.profile.displayName`** (line 40: `profile: userData.profile`), NOT `user.displayName`. `user.displayName` is the raw Firebase-auth field (often null for email/password signups). So the header usually shows the **email prefix**, not the real name the student set at signup. (Dashboard.jsx has the same `user?.displayName` mismatch at line 231.)

These two mean: the natural home for name-editing (the "Profile" menu item) is currently a dead link, and the name shown in the header is often wrong anyway. Fixing name-editing is the moment to fix both.

## Design decision (resolved by user): BOTH student self-edit AND teacher/TA roster edit.

---

## Recommended approach: build a real Profile page (fixes the dead link + houses the name editor)

### Part 0 — Foundational fixes (small, do first)
- **0a. Fix the displayName field read** in HeaderBar.jsx:26 and Dashboard.jsx:231 → `user?.profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'`. Makes the header show the real name. (Pure read fix, no data change.)
- **0b. Decide the `/profile` link:** either (i) create a real Profile page (recommended — it's where users expect to edit their name), or (ii) repoint the menu "Profile" link to `/settings` and host name-editing there. Recommend (i): a minimal Profile page at `/profile` showing name (editable), email (read-only), role; reuses the existing section/card styling.

### Part 1 — Student self-edit  [no rules change needed]
- **Shared data helper** in `src/services/db.js`:
  ```js
  export const updateDisplayName = async (userId, newName) => {
    const name = (newName || '').trim();
    if (!userId) throw new Error('userId required');
    if (name.length < 1 || name.length > 60) throw new Error('Name must be 1–60 characters.');
    // 1) source of truth
    await setDoc(doc(db,'users',userId), { profile: { displayName: name } }, { merge: true });
    // 2) denormalized copies the roster/gradebook read
    const snap = await getDoc(doc(db,'users',userId));
    const enrolled = snap.exists() ? Object.keys(snap.data().enrolledClasses || {}) : [];
    await Promise.all(enrolled.map(cid =>
      setDoc(doc(db,'classes',cid,'members',userId), { displayName: name }, { merge:true })
        .catch(e => console.warn('member name sync failed', cid, e))));
    return name;
  };
  ```
  (CRITICAL: the name is denormalized into `classes/{id}/members/{uid}.displayName` — the teacher roster + gradebook read THAT, not the profile. Must update both or names go stale. Verified in db.js joinClass + gradebook reads.)
- **AuthContext**: add `updateUserName(name)` that calls `updateDisplayName(user.uid, name)`, then `setUser(u => ({...u, profile:{...(u.profile||{}), displayName:name}}))` so the header updates live without reload. (Optionally also `updateProfile(auth.currentUser,{displayName:name})` to sync Firebase-auth.)
- **UI**: on the Profile page (or Settings), a "Display Name" input pre-filled from `user.profile?.displayName`, Save button, inline success/error, disabled-while-saving, trim + 1–60 char validation.
- **Rules**: NONE needed — student writes own `users/{uid}` (owner) + own member docs (members rule allows `isOwner(memberId)`).

### Part 2 — Teacher/TA roster edit  [rules change REQUIRED — decision needed]
- **UI**: in ClassDetail roster row (~852, the `member.displayName` cell) add a pencil IconButton → inline edit / small modal → `updateDisplayName(member.id, value)` → refresh roster row.
- **Blocker — current rules deny it twice:**
  - `/users/{userId}` write: teacher may only touch `['challenges']` → cannot write `profile`.
  - `classes/{id}/members/{uid}` update: only allowed for `isOwner(memberId)` (the student) → teacher can't update the member copy either.
- **Two options (pick at build):**
  - **(A) Broaden rules** — allow teacher to write `['challenges','profile']` on user docs, and add `|| class-owner` to the members update rule. Simple; but lets any teacher rename any user (rules file already TODOs that teacher writes are over-broad). OK for a trusted-TA tool; document it.
  - **(B) Cloud Function** (`renameStudent`) — Admin SDK, verifies the caller is a teacher who owns a class the student is enrolled in, then writes profile + member copies. Bypasses rules safely, scoped, no rule-broadening. **RECOMMENDED** given student-data sensitivity; more work (a function deploy).
- The teacher path reuses the same `updateDisplayName` write contract (or the CF replicates it server-side).

---

## Build order & delivery
1. Part 0 (field-read fix + Profile page or relink) — small, unblocks everything, fixes 2 live bugs.
2. Part 1 (student self-edit) — no rules, deployable immediately.
3. Part 2 (teacher edit) — after you pick (A) vs (B). (B) = Cloud Function recommended.
Deliver as patch(es) per prior workflow; verify (parse/build) + a behavioral check; you deploy.

## Verification (post-build)
- Header shows the real profile name (0a fix), not email prefix.
- "Profile" menu item loads a real page (not bounce to dashboard).
- Student renames → header updates live → reload persists → teacher roster + gradebook show new name (member copy synced).
- Teacher renames → profile + all member copies updated; student sees it next load.
- A student cannot rename another student (rules deny); teacher rename only via chosen path.
- Edge: empty/whitespace/>60 chars blocked; special chars render safely (React escapes).

## Decisions needed before Part 2
1. Profile page (recommended) vs relink Profile→Settings.
2. Teacher path: rule-broaden (A) vs Cloud Function (B, recommended).
