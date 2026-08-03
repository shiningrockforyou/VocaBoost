# DEEPFIX3 · DESIGN CARD — TEACHER UNIVERSES (multi-tenancy)

**Status:** design card, not scheduled. Raised by David 2026-08-03 while reviewing the rules panel's
finding that `teacher` is a self-asserted global role. **Sequenced AFTER the review-v2 launch** — it
touches every collection and every rule, and would collide with the DF2 cutover.

## 1. The problem it solves

Authority today is a **global boolean the user writes about themselves**. `users/{uid}.role` is set
from a public radio button at signup (`src/pages/Signup.jsx:124-149` → `src/services/db.js:254`), and
the live ruleset resolves `isTeacher()` off that same field, granting read+write on **every** student's
subcollections regardless of class membership (`firestore.live.rules:45-48`, which carries its own
`TODO(security)` admitting the grant is too broad). So anyone with an email address can reach all 947
students' records.

The review-v2 rules artifact narrows this (role is no longer changeable on an existing account, and the
engine's own surfaces are closed to teachers too) but it **cannot fix the shape**: a global boolean has
no scope to check against.

## 2. The model David described

> "There's a universe where classes exist. Some teachers have access to some universes, not all.
> Students are invited to a universe via joining a class."

That is **multi-tenancy**, and it is the standard answer. Google Classroom scopes by domain, Canvas by
account/sub-account, Schoology by school. The usual vocabulary is *organization* / *tenant* /
*workspace*; "universe" is the tenant.

The key shift: authority stops being *"is this person a teacher"* and becomes
**"is this person a teacher IN this universe"** — a membership the server grants, not a field the client
sets. Self-registration then becomes harmless: signing up as a teacher gives you a universe of your own
and access to nobody else's students.

## 3. Design decisions worth making early (expensive to retrofit)

**(a) Role belongs in a custom auth claim, not a document.** Firebase custom claims are set server-side,
cannot be forged by the client, and are readable in rules as `request.auth.token.*` **without a document
read**. That also removes the `get(/users/$(uid))` that `isTeacher()` performs on essentially every rule
evaluation today — a latency and cost win independent of the security one.
Shape: `{ universes: { <universeId>: 'teacher' | 'owner' }, ... }`. Claims are size-limited (~1000
bytes), so a user in many universes needs the membership-doc fallback in (b).

**(b) A membership collection is the source of truth**, claims are the cache.
`universes/{universeId}/members/{uid} = { role, addedBy, addedAt }`, mirrored into claims on write.
Rules check the claim first and fall back to a membership read only where the claim is absent.

**(c) Stamp `universeId` on every document** — classes, lists, attempts, and the user's progress
records. Deriving tenancy by walking class → student on each request is slow and hard to reason about;
a stamped field makes every rule a single equality check.

**(d) Students belong to the universe, not only to a class.** Joining a class is the *invitation*;
membership is what persists when they change or leave classes. Without this, a student between classes
falls into an undefined state — which is exactly the "phantom member" problem already visible today
(present in `members/` but missing from `studentIds`).

**(e) Decide the cross-universe rule explicitly.** Can one student exist in two universes with separate
progress? Almost certainly yes eventually (a student at two academies). If so, progress records must be
keyed by universe from day one — retrofitting that later is a data migration over live progress.

## 4. Rules shape (sketch, not final)

```
function universeRole(uid, universeId) {
  return request.auth.token.universes[universeId];   // claim first, no document read
}
match /universes/{universeId}/classes/{classId} {
  allow read:  if universeRole(request.auth.uid, universeId) != null;
  allow write: if universeRole(request.auth.uid, universeId) in ['teacher', 'owner'];
}
match /users/{userId}/{sub}/{doc} {
  allow read: if isOwner(userId)
    || universeRole(request.auth.uid, resource.data.universeId) in ['teacher', 'owner'];
}
```
The teacher branch becomes **scoped** rather than global — the single change that closes the exposure.

## 5. Migration sketch

1. Create one universe for the existing academy; stamp `universeId` on every existing document.
2. Backfill memberships from `classes.studentIds` + `ownerTeacherId`; mint claims.
3. Ship rules that accept **either** the legacy branch or the universe branch (dual-read).
4. Drain: verify no request still uses the legacy branch, then remove it.
5. Only then remove the teacher radio from public signup and route teacher creation through an invite.

Step 3's dual-read is what makes this shippable without a flag day — the same pattern DF2 used for the
engine.

## 6. Interim mitigation (do NOT wait for this card)

Removing the public **Teacher** radio from signup closes the live exposure in one small change, costs
nothing, and constrains none of the design above. It is carded separately in `NEED_TO_FIX.md` and is
David's decision.

## 7. Open questions for David

- Is a universe an **academy/business**, or a **campus** within one? (Determines whether universes nest.)
- Can a teacher belong to several universes? (Assumed yes above.)
- Should students see that other universes exist at all? (Affects error copy on a wrong-universe join.)
- Does billing/usage attribution follow the universe? (If yes, `ai_metering` needs the stamp too.)
