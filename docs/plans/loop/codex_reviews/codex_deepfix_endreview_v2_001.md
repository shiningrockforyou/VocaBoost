# Codex end-review v2: initial staged release gate

Verdict for the initial staged release: **NO-GO**

Scope reviewed: the v2 rider manifest, deploy scoping (`firestore:indexes` → `functions` → `hosting`, no rules), grade-token MINT posture, and the live F1 path called out by the manifest.

## Findings

### BLOCKER — F1 is listed as live/accepted, but its server callable is still disabled

- File/lines:
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:25`
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:63-65`
  - `src/pages/Signup.jsx:15-17`
  - `src/pages/Signup.jsx:86-89`
  - `src/pages/Signup.jsx:106-109`
  - `functions/index.js:1960-1962`
  - `functions/index.js:1985-1991`
- Classification: **initial-release blocker**, manifest/deploy-order unsoundness.
- Concrete failure scenario:
  1. The manifest accepts F1 as a live hosting delta: Signup teacher self-registration is removed and teacher onboarding now uses an invite code plus the `provisionTeacher` callable.
  2. The manifest says the only deploy-order requirement is “functions must be live before hosting,” and the hard invariants say “No flag flips.”
  3. But `provisionTeacher` is gated by `TEACHER_PROVISIONING_ENABLED=false` in `functions/index.js:1960-1962`.
  4. The callable immediately throws `failed-precondition` while disabled at `functions/index.js:1985-1991`.
  5. The Signup page unconditionally calls that callable whenever a teacher invite code is entered, both for email/password signup and Google signup (`src/pages/Signup.jsx:86-89`, `src/pages/Signup.jsx:106-109`).

Result: after the scoped release, a new teacher who enters an invite code will create/sign in as a student, then invite redemption deterministically fails with `TEACHER_PROVISIONING_ENABLED=false`. This is not covered by “functions before hosting”; the actual prerequisite is “functions deployed **and** `TEACHER_PROVISIONING_ENABLED=true`,” which contradicts the v2 invariant “No flag flips.”

To make this releasable, choose one of these and update the manifest/runbook accordingly:

1. Enable `TEACHER_PROVISIONING_ENABLED` for this initial release and treat it as a deliberate live server flag flip with its own preconditions, invite-doc readiness, rollback story, and verification; or
2. Do not ship the Signup invite-code hosting change in the initial release; or
3. Reclassify F1 honestly as “teacher onboarding temporarily disabled,” if that is an acceptable live product change, and make the UI copy avoid inviting users into a guaranteed failed-precondition path.

As written, F1 is neither dormant nor correctly enabled, so this is a NO-GO.

## Confirmed non-blockers

### GRADE_TOKEN_MINT is now false

- File/lines:
  - `functions/index.js:67`
  - `functions/index.js:80`
  - `functions/index.js:1044-1045`

`GRADE_TOKEN_ENFORCED=false` and `GRADE_TOKEN_MINT=false`. The minting branch computes `mintTokens = GRADE_TOKEN_MINT || GRADE_TOKEN_ENFORCED`, so typed grading no longer reintroduces the live secret/minting dependency in this scoped functions deploy.

### v1 Firestore rules blocker is resolved by deploy scoping, assuming the scoping is enforced

- File/lines:
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:12`
  - `audit/deepfix/task6/DEPLOY_RIDER_MANIFEST.md:64`

The v2 plan explicitly excludes `firestore:rules` and says never to run a bare deploy. Under that constraint, the P10d/P6 `firestore.rules` file is not shipped in this initial release, so the v1 rules NO-GO is handled by exclusion.

This remains operationally fragile: the repo still maps `firebase.json` rules to `firestore.rules`, so the protection is procedural, not technical. I am not treating that as a separate blocker because the v2 gate explicitly narrows to `--only firestore:indexes`, `--only functions`, and `--only hosting`.

### Index-before-hosting invariant is conceptually sound for F2

The manifest correctly identifies that the unconditional Name-filter `studentId` query needs indexes built before hosting. I did not find a contradiction equivalent to F1 in the scoped check.

## Final gate answer

**NO-GO for the initial staged release as currently specified.**

The release cannot simultaneously ship the live Signup invite-code flow, keep “no flag flips,” and leave `TEACHER_PROVISIONING_ENABLED=false`.
