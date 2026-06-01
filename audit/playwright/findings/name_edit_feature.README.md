# name_edit_feature.patch — Student name-change feature (+ 2 pre-existing bug fixes)

Implements: real Profile page with student self-edit of display name, AND teacher/TA rename from the class roster via a Cloud Function. Built per NAME_EDIT_PLAN.md (decisions: real Profile page; Cloud Function for teacher path). Verified: esbuild parse OK on all 8 files; validation logic unit-checked.

## Files (8)
- **functions/index.js** — NEW `renameStudent` callable (Admin SDK): verifies caller is a teacher who owns a class the student is enrolled in, then writes profile + all member copies in a batch. **Requires `firebase deploy --only functions`** to go live (separate from the web deploy).
- **src/services/db.js** — NEW `updateDisplayName(userId, name)`: writes `users/{uid}.profile.displayName` + every `classes/{cid}/members/{uid}.displayName` (the denormalized copy the roster/gradebook read). Trim + 1–60 char validation.
- **src/contexts/AuthContext.jsx** — NEW `updateUserName(name)` exposed on context: calls the helper, syncs Firebase-auth displayName, and updates `user.profile.displayName` in state so header/dashboard refresh live.
- **src/pages/Profile.jsx** — NEW page at `/profile`: editable Display Name (save/validation/inline success+error), read-only Email + Role. Reuses Card/Button/tokens.
- **src/App.jsx** — registers `/profile` route (PrivateRoute).
- **src/components/HeaderBar.jsx** + **src/pages/Dashboard.jsx** — **bug fix:** read `user.profile.displayName` first (was reading `user.displayName`, the raw Firebase-auth field that's usually null for email signups → header/dashboard showed the email prefix instead of the real name).
- **src/pages/ClassDetail.jsx** — teacher roster: pencil-edit on each student's name → inline input → calls the `renameStudent` Cloud Function → optimistic row update.

## Two pre-existing bugs fixed by this patch
1. **Dead `/profile` link** — the avatar menu linked to `/profile`, which had no route → bounced to dashboard. Now a real page.
2. **Wrong name in header/dashboard** — read the wrong field; now shows the actual profile name.

## Deploy
- Web app: normal git push → Netlify (covers everything except the function).
- **Cloud Function: `firebase deploy --only functions:renameStudent`** (or all functions). The teacher rename UI will error until this is deployed; student self-edit works without it.
- No firestore.rules change needed: student writes their own profile + own member docs (allowed); teacher rename goes through the Admin-SDK function (bypasses rules), so rules stay as-is (no broadening).

## Verify after deploy
- Header/dashboard show the real signup name (not email prefix).
- Avatar → Profile loads the page (no bounce).
- Student: change name on Profile → header updates live → reload persists → teacher roster + gradebook show new name.
- Teacher: pencil-edit a student in ClassDetail → name updates; a teacher who does NOT own the student's class is denied (permission-denied) by the function.
- Edge: empty/whitespace/>60 chars blocked client + server side.

## Notes
- The function is authorization-scoped (teacher must own a class the student is enrolled in) — intentionally tighter than broadening rules.
- This does NOT touch the existing reviewChallenge/F01/etc. patches; independent.
