# P6 · FND-4 — the rules cutoff: implementation notes (REVIEWED DRAFT)

**Status:** LOCAL-ONLY draft, 2026-07-13. NOT deployed, NOT committed, no live-Firebase call.
`firestore.rules` in the working tree now **carries the P6 lockdown** — it is **no longer
safe to deploy at any time** (the pre-P6 property the old W3-staging comment guaranteed).
The deploy is a David-run event gated on the FIX_PLAN P6 preconditions (§3 below), shipped
as `firebase deploy --only firestore:rules` with NOTHING riding along.

Rules cannot be execution-tested in this environment (no emulator / no client SDK against
live) — correctness here rests on the per-rule trace below + the Task-6 rules-test matrix
(§4, = the AUDIT_DESIGN M-RULES block). Every claim is traced to the pre-edit
`firestore.rules` line and the app write path it governs (working tree of 2026-07-13).

Files changed in this draft:
- `/app/firestore.rules` — the ONE-deploy lockdown (changes (a)–(c) + `teacher_invites` + header gate).
- `/app/functions/index.js` — `provisionTeacher` callable + `TEACHER_PROVISIONING_ENABLED` flag (dormant, reported by the `version` probe).
- `/app/scripts/cs/create-teacher-invite.mjs` — NEW admin (David-run) invite minting/revocation script.
- `/app/src/pages/Signup.jsx` — teacher self-select radio REMOVED (the C-28/#1b hole); optional invite-code redemption added.
- `/app/docs/plans/W3_attempts_lockdown.rules.md` — SUPERSEDED banner (its "owner delete unchanged" line must never be re-applied).

---

## §1 Rule-by-rule: before → after, with the app path each governs

### (a) Users subcollection wildcard — progress records become server-owned [C5-4]

**Before** (`firestore.rules:45-48` pre-edit):
```
match /{subcollection}/{docId} {
  allow read:  if isAuthenticated() && (isOwner(userId) || isTeacher());
  allow write: if isAuthenticated() && (isOwner(userId) || isTeacher());
}
```
**After** (`firestore.rules:109-114`): read unchanged; write additionally requires
`!(subcollection in ['list_progress', 'class_progress', 'progress_meta'])`.

| Path governed | Post-P6 behavior | Trace |
|---|---|---|
| Student completion write to `class_progress` (legacy `updateClassProgress`) | DENIED — flag-ON bundles call `completeSession` instead (P4); the legacy branch only runs flag-OFF / old bundles → the C6-2 `legacy_write_denied` handler catches it (TypedTest.jsx:1101, MCQTest.jsx:821) | `progressService.js:488-544` |
| Entry-time recon write (`getOrCreateClassProgress` legacy leg) | DENIED — flag-ON routes through the `resolveListProgress` callable (server does the F4-1 recon via Admin SDK); the client leg is only the **fail-open fallback** when the callable errors → see risk R1 | `progressService.js:112-117` (route), `:122-127` (create-on-miss), `:264-271` (recon updateDoc) |
| Challenge-accept day-advance to `class_progress`/`session_states` | class_progress leg DENIED — flag-ON routes to `advanceForChallenge` (db.js:2859); the direct write is the flag-OFF `else` branch only | `db.js:2875-2903` |
| Client reset deleting the `class_progress` doc | DENIED — flag-ON routes to `resetProgress` (db.js:2990); legacy delete is flag-OFF only | `db.js:3003-3007` |
| Blind-spot count cache write to `class_progress` | DENIED but **swallowed** (best-effort try/catch, console.warn only) — harmless denial noise; retire the write at P7 | `studyService.js:1021-1035` |
| `list_progress` (canonical, P5) | clients NEVER write it in any bundle (grep: only `getDoc` reads at `progressService.js:590`) — rule makes that a guarantee | P5 migration + server writers only |
| `progress_meta` (reset-epoch tombstone) | server-only by rule — **an addition beyond the plan's literal (a)**: the collection was invented by the P3 draft (`resetProgress` pre-P5 stamp) after the plan text was written; a client-forgeable reset epoch could tombstone away valid anchors, so it belongs with the server-owned set. Flagged as U6 | `functions/foundation.js` resetProgress; no client writer exists |
| Student's own `study_states` / `session_states` writes | **UNCHANGED** (owner) — students write these directly and continuously | `studyService.js:341/513/559/810/1218`; `sessionService.js:71-185` |
| Teacher write to student `study_states` on challenge accept | **UNCHANGED** (teacher branch survives — the ONLY remaining reason for it; P10 narrows to a callable per the old in-file TODO `:39-44`, which this comment block replaces) | `db.js:2824-2833` |
| Teacher READ of student `list_progress`/`class_progress` (Students view) | **UNCHANGED** — reads were deliberately not touched | `progressService.js:590` + `getClassProgress` fallback; `ClassDetail.jsx:198` |

### (b) `users/{userId}` — M8 role whitelist SPLIT BY OP (F4-3 / v2 HIGH-2, closes C-28/#1b)

**Before** (`firestore.rules:34-37` pre-edit): one `allow write` — owner unrestricted
(→ role self-writable = C-28), or teacher with `hasOnly(['challenges'])`.

**After** (`firestore.rules:63-91`):
- `allow create`: owner-only AND (`role` absent OR `== 'student'`). Why split: `createUserDocument`
  stamps `role: docOverrides.role ?? 'student'` via `setDoc(..., {merge:true})` on a missing doc
  (db.js — role default + merge-set inside `createUserDocument`; FIX_PLAN cites `db.js:221/:233`,
  today ~`:230/:242` after drift) — a CREATE, where a blanket `!hasAny(['role'])` on write would
  always deny (diff against a non-existent doc marks every key affected).
- `allow update`: owner branch adds `!affectedKeys().hasAny(['role', 'roleProvisioning'])`;
  teacher branch byte-identical to before (`hasOnly(['challenges'])`).
- `allow delete: if false` — **an explicit decision the old `allow write` left implicit-ALLOW
  for owners**: no live client path deletes a user doc (grep 2026-07-13: zero `deleteDoc` on
  `users/{uid}` top-level), and self-delete would wipe `challenges.history` (token-rejection
  state → free token refill on doc re-create) and `enrolledClasses`. Flagged as U5.

Paths verified to PASS under the new rules:
| Client path | Op | Why it passes |
|---|---|---|
| Email signup → `createUserDocument` (role:'student') | create | role == 'student' explicitly |
| Google first sign-in → `createUserDocument` (no role override → 'student') | create (doc-existence-checked first, AuthContext.jsx:109-118) | role == 'student' |
| `joinClass` merge-set of `enrolledClasses` on a MISSING user doc (edge: doc creation previously failed) | create | role absent → allowed |
| `joinClass` / `fetchStudentClasses` cleanup / `updateDisplayName` / `updateUserSettings` / student `challenges.history` (legacy submitChallenge) | update | affectedKeys ⊆ {enrolledClasses, profile, settings, challenges} — no role |
| Retried `createUserDocument` on an EXISTING doc (same role value) | update | affectedKeys compares VALUES — an unchanged `role:'student'` is not "affected" |
| Teacher `reviewChallenge` correcting student `challenges.history` | update (other-user) | teacher branch `hasOnly(['challenges'])`, unchanged |

Paths DENIED (intended): self-select `role:'teacher'` at signup (create), role escalation via
update, forging/altering `roleProvisioning`, user-doc delete, teacher writing any other
top-level field of a student doc (already denied before — e.g. `removeStudentFromClass`'s
`enrolledClasses` deleteField at db.js:431 was ALREADY swallowed-denied pre-P6; unchanged).

### (c) `attempts` — the W3 lockdown, APPLIED (+ the owner-delete removal that supersedes the W3 doc)

**Before** (`firestore.rules:101-122` pre-edit): create if `studentId == uid` (no shape check);
update student-`answers` branch OR teacher-of-record; delete if `studentId == uid`.

**After** (`firestore.rules:167-198`):
| Rule | Before → After | App path governed |
|---|---|---|
| read | unchanged (student-of-record ∥ teacher-of-record) | gradebook + student views; the C-19 stamp model — widening is P10's work |
| create | `studentId == uid` → **`if false`** (C-29/#1c) | all attempt writers are callables via Admin SDK: `submitVocabAttempt` (index.js:479), `gradeTypedTest` (:933), `markReviewComplete` (:566), `submitChallenge` (:630), `completeSession`/foundation. The forged `{passed:true, score:100, newWordEndIndex:...}` direct create — C-31's first input — is denied |
| update | student `hasOnly(['answers'])` branch **REMOVED** (W1 `submitChallenge` callable is live under `SERVER_CHALLENGE_WRITE` — precondition); teacher-of-record branch kept verbatim | legacy client `submitChallenge` (db.js:2594+) is flag-OFF only; client `reviewChallenge` still updates answers/score/passed as teacher-of-record (db.js:2794) until P10 |
| delete | owner-delete **REMOVED → `if false`** — supersedes `W3_attempts_lockdown.rules.md:40-43` ("delete unchanged"); legal ONLY because P3 `resetProgress` + P4 `SERVER_RESET_PROGRESS` ship first ([C5-5]) | client reset batch-delete (db.js legacy leg after :2999) is flag-OFF only; this closes the anchor-erasure half of the safeTWI forgery (delete anchors → `hasValidData=false` → `safeTWI = max(forged storedTWI, …)`, progressService.js:236) |

The W3 staging doc got a SUPERSEDED banner so nobody re-applies its delete line.

### (d) M4 shadow → ENFORCE
NOT a rules change — a server flag flip (`functions/foundation.js` `ANCHOR_VALIDATION_ENFORCE`),
noted in the rules header so the deploy checklist doesn't look for it here.

### (+) `teacher_invites/{inviteId}` — new collection, all client access denied
Explicit `allow read, write: if false` (`firestore.rules:206-208`). Redundant with Firestore's
default-deny for unmatched paths, but declared so the collection's server-only contract is visible.

---

## §2 The teacher-provisioning path (F4-3 — ships WITH P6, cannot defer to P10)

The live signup let anyone self-select Teacher (`Signup.jsx` radio `value="teacher"` →
`role: formState.role` into `createUserDocument`) — that IS C-28/#1b. Rule (b) breaks that
signup, so the same release provides the replacement:

1. **Mint (admin):** `scripts/cs/create-teacher-invite.mjs` (Admin SDK, David-run) generates a
   32-char single-use code (160-bit, crockford base32), stores
   `teacher_invites/{sha256(code)}` = `{createdBy, createdAt, note, expiresAt (default 14d),
   usedBy:null, usedAt:null, revoked:false}`, prints the plaintext ONCE (never stored).
   `--revoke <inviteId>` marks an invite unusable. Each mint/revoke = a SUPPORT_RUNBOOK CS event.
2. **Redeem (callable):** `provisionTeacher` (`functions/index.js`, after `renameStudent`) —
   gated on `TEACHER_PROVISIONING_ENABLED` (default **false**, dormant; reported by the
   `version` probe; flip WITH the P6 rules deploy). Auth required; hashes the submitted code
   (direct doc get — no query, no probing oracle: unknown/used/revoked/expired all return
   `permission-denied` with narrow messages); **transaction**: consume invite (`usedBy/usedAt`)
   + `role:'teacher'` + `roleProvisioning{via,inviteId,provisionedAt,invitedBy,note}` merge-set,
   atomically. Idempotent: retry after commit (usedBy == caller) or already-teacher → success
   without a second consume. Audit: `system_logs` `teacher_provisioned` (same shape as
   foundation's `logSystemEventServer`).
3. **Signup flow (`Signup.jsx`):** role radio REMOVED; everyone signs up as a student
   (`signup(...)` no longer passes `role`; `createUserDocument` defaults `'student'` —
   passes rule (b) create). New optional "Teacher invite code" field: after a successful
   email signup OR Google sign-in, a non-empty code calls `provisionTeacher`; on success
   → `window.location.assign('/')` (full reload so AuthContext re-reads the doc-role —
   its cached `role:'student'` from the signup path is stale); on failure → explicit error,
   account remains a working student. Grad-year/month fields now hide on invite-code entry
   (they keyed off the removed radio before).

Provenance chain this creates: post-P6, a legitimate teacher doc carries `roleProvisioning`
(owner-immutable by rule (b)); any live teacher-role doc WITHOUT it predates P6 or is suspect
(the F-4c hygiene sweep's exact predicate).

**David decision 10 (GATES the P6 DEPLOY, not this draft):** invite-code is the mechanism
implemented; admin-approval or custom-claims variants remain open (the callable is compatible
with a custom-claim future — add `setCustomUserClaims` at the txn commit; decision 4 / P10).

---

## §3 Deploy preconditions (HARD — do not gate the draft on them, do not deploy without them)

Reproduced in the `firestore.rules` header; all David-run:
1. **X1/constructional:** P3 functions live + flags ON (`SERVER_*_ENABLED`, incl.
   `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`) **+
   `TEACHER_PROVISIONING_ENABLED`** (new, this draft).
2. **P4 cutover live:** `SERVER_PROGRESS_WRITE`, `SERVER_RESET_PROGRESS`,
   `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER` true in the LIVE bundle; **bundle grep
   proves zero live client attempt-create/-delete** (v2 HIGH-3); rules-denied-reset persona.
3. **P5 migration complete**; 26SM quarantine = 0 [C7-2]; M4 shadow ≈0 false rejects over ≥14d;
   14-day no-legacy-write window + build-version census [C8-1]; W3 doc checklist.
4. §4 matrix green (Task 6). Deploy `--only firestore:rules`. Revert = restore prior blocks
   (git) + redeploy; full reversibility only until P7 deletes legacy docs.

---

## §4 RULES-TEST MATRIX (Task 6 — client-SDK/REST rules tests; Admin SDK cannot test rules)

Personas: `student` (owner uid S), `student2` (uid S2), `teacher` (provisioned, uid T, owner
of a class S is in), `teacherOfRecord` (uid = attempt.teacherId), `unauth`.

| # | Persona | Operation | Expect |
|---|---|---|---|
| R1 | student | CREATE `users/S` `{role:'student', ...}` (signup shape, merge-set on missing doc) | **ALLOW** |
| R2 | student | CREATE `users/S` with NO role field (joinClass-on-missing-doc shape) | **ALLOW** |
| R3 | student | CREATE `users/S` `{role:'teacher'}` (old self-select signup) | **DENY** |
| R4 | student | UPDATE `users/S` profile/settings/enrolledClasses/challenges (no role key) | **ALLOW** |
| R5 | student | UPDATE `users/S` `{role:'teacher'}` (escalation) — also via dotted field mask | **DENY** |
| R6 | student | UPDATE `users/S` merge-set that re-sends `role:'student'` UNCHANGED (createUserDocument retry) | **ALLOW** (value-diff semantics — if this DENIES, R-U2 fires) |
| R7 | student | UPDATE `users/S` touching `roleProvisioning` | **DENY** |
| R8 | student | DELETE `users/S` | **DENY** |
| R9 | teacher | UPDATE `users/S` `challenges.history` only | **ALLOW** |
| R10 | teacher | UPDATE `users/S` any other top-level field (e.g. enrolledClasses) | **DENY** |
| R11 | (server) `provisionTeacher` with a fresh valid invite | **role flips to teacher**; invite consumed; `roleProvisioning` stamped; retry → success, no double-consume |
| R12 | student | `provisionTeacher` with unknown/used/revoked/expired code | callable **permission-denied**; role unchanged |
| R13 | student/teacher | any READ/WRITE on `teacher_invites/*` | **DENY** |
| R14 | student | CREATE `attempts/*` `{studentId:S, passed:true, score:100, newWordEndIndex:...}` (forgery) | **DENY** |
| R15 | student | UPDATE own attempt `answers` only (old submitChallenge shape) | **DENY** |
| R16 | student | DELETE own attempt (old reset shape) | **DENY** |
| R17 | teacherOfRecord | UPDATE attempt `{answers, score, passed}` (client reviewChallenge) | **ALLOW** |
| R18 | teacher (NOT of record) | UPDATE/READ that attempt | **DENY** (C-19 stamp model preserved) |
| R19 | student | READ own attempt; teacherOfRecord READ | **ALLOW** |
| R20 | student | WRITE `users/S/class_progress/*` (create, update twi/csd, delete) | **DENY** (all three ops) |
| R21 | student | WRITE `users/S/list_progress/*` and `users/S/progress_meta/*` | **DENY** |
| R22 | teacher | WRITE `users/S/class_progress/*` / `list_progress/*` | **DENY** (teacher branch no longer reaches progress) |
| R23 | student | WRITE own `users/S/study_states/*` and `users/S/session_states/*` | **ALLOW** (live study flow) |
| R24 | teacher | WRITE `users/S/study_states/{wordId}` (challenge-accept correction) | **ALLOW** (until P10) |
| R25 | student | READ own `list_progress`/`class_progress`; teacher READ student's | **ALLOW** (dashboards + Students view) |
| R26 | (server flags ON) end-to-end personas | completion via `completeSession`, reset via `resetProgress`, challenge via `submitChallenge`+`advanceForChallenge`, review marker via `markReviewComplete` — all **PASS** with rules deployed (server writes bypass rules) |
| R27 | signup persona | self-select-teacher signup path is GONE from the UI; email-signup + invite → teacher; email-signup no invite → student; Google + invite → teacher | per §2 |
| R28 | old-bundle persona | legacy completion write → denied → `legacy_write_denied` logged + reload prompt (TypedTest.jsx:1101/MCQTest.jsx:821), NOT a silent swallow | [C8-1] residual |

---

## §5 Uncertainties / risks (flag every one — over-deny on live 26SM students is the top concern)

**R1 (over-deny, MOST LIKELY residual): the fail-open hydration fallback now fails closed.**
`getOrCreateClassProgress` falls back to the legacy CLIENT path whenever the
`resolveListProgress` callable errors (progressService.js:112-117 — deliberate P4 fail-open).
Post-P6 that fallback's create-on-miss (`:122-127`) and recon write (`:264-271`) are DENIED →
a callable outage converts into hydration failure at session entry (read-only cases still
work; only miss-create/recon-delta cases throw). This is inherent to the cutoff (client
authority is the thing being removed), but it means **P6 makes session entry availability
dependent on Functions availability**. Mitigation: watch `legacy_write_denied` +
`resolve_list_progress` error rates in the G5 window; the C6-2 reload prompt covers the
completion path but NOT this entry path — consider extending the denial handler to
`getOrCreateClassProgress` before deploy (small P4-side follow-up, not rules).

**R2 (over-deny, accepted): old bundles / dormant tabs.** Any pre-P4 bundle still open writes
class_progress/attempts directly → denied. The [C8-1] one-false-success completion residual is
accepted by the plan (integrity carried by rules; recovery = reload); the 14-day
no-legacy-write soak + build census is the precondition that shrinks this to ≈0.

**R3 (over-deny, benign): blind-spot cache write** (studyService.js:1021-1035) is denied but
try/caught (best-effort by design) — expect background denial noise in rules metrics, zero UX
impact. Candidate for the P7 retirement inventory.

**R4 (over-deny, dev-only): apBoost sandbox seeding** (`seedFullData.js:957-975`) merge-sets
`role:'teacher'` on the runner's own doc — post-P6 that's denied unless the doc already has
role:'teacher' with the same value (value-diff). Student-profile seeding was already denied
pre-P6 (best-effort catch). Sandbox tooling should move to Admin SDK; NOT a live-student path.

**R5 (hole, residual by design): `challenges` stays owner-writable.** A student can still
edit their own `challenges.history` (token state) — same as pre-P6. Token forgery is C-18/P10
scope (the plan's P6 dissolves role/attempt/progress forgery only). Flagged so nobody reads
P6 as "tokens are now trustworthy".

**R6 (hole, residual by design): teacher wildcard-write breadth.** ANY teacher can still write
ANY student's `study_states`/`session_states` (inv_I10 §7) — required by client
`reviewChallenge` until P10. P6 shrinks the breadth (progress subcollections excluded, role no
longer self-grantable so "teacher" is no longer forgeable-by-write) but does NOT add
class-membership scoping. P10 (OVR) owns that.

**R7 (hole, precondition-dependent): pre-existing forged teacher roles.** Rule (b) stops NEW
self-promotion; any doc whose role was ALREADY flipped to teacher pre-P6 keeps working
(`isTeacher()` reads the doc). The F-4c hygiene sweep (teacher-role docs without
`roleProvisioning` / without provenance) must run at deploy time — listed in CONSOLIDATED_ISSUES
C-28 as the FB item.

**U1 (rules semantics, MUST be proven by R6/R20 in the matrix): value-diff of `affectedKeys()`.**
The owner-update rule assumes a merge-set re-sending an UNCHANGED `role:'student'` yields no
`role` in `affectedKeys()` (documented Firestore behavior: the diff is value-based). If an
emulator run falsifies this, the retried-`createUserDocument` edge (R6) breaks signup retries —
fix would be `(!('role' in request.resource.data) || request.resource.data.role == resource.data.role)`
instead of the hasAny exclusion. Task 6 must run R6 explicitly.

**U2 (rules semantics): `subcollection in [...]` list membership** on a wildcard segment is
standard rules syntax, but it is exactly the kind of thing the emulator must confirm
(R20-R23 cover both sides: deny progress, allow study/session).

**U3: `markReviewComplete` + empty-review days.** The W3-doc precondition list requires
`SERVER_REVIEW_MARKER` ON before create:false — carried into the header preconditions (a
flag-OFF client automarker leg writes an attempt directly → denied → Day-2+ empty-review
completion breaks). DailySessionFlow's automarker leg (:964-1008) is the exact path.

**U4: `system_logs` create stays open to any authenticated user** (unchanged) — the
`legacy_write_denied`/`csd_twi_reconciled` client events need it. Spoofable log noise is a
known, accepted trade (read is teacher-only).

**U5: user-doc `allow delete: if false`** is stricter than the pre-P6 implicit owner-delete.
Grep found no client delete path, so over-deny risk ≈ 0, but it IS a posture change beyond
the plan's literal (b) text — revert to owner-delete if any hidden flow surfaces in Task 6.

**U6: `progress_meta` added to the server-owned list** — beyond the plan's literal (a)
(collection postdates the plan text; see §1(a) table). Zero client writers exist; deny-listing
it closes a forgeable-reset-epoch vector before it opens.

**U7: provisioning UX gaps.** No standalone redemption page: an already-signed-up student who
should become a teacher redeems via… nothing in the UI (CS can run the callable or David can
re-invite → they redeem at a fresh Google sign-in only if the doc is missing — it isn't).
Practically: David mints the invite BEFORE the teacher's first signup, or an admin script flips
the role (Admin SDK). Acceptable for the 26SM scale; a Profile-page redemption field is the
natural P10-adjacent follow-up.

**U8: `window.location.assign('/')` after redemption** is a hard reload by design (AuthContext
has no role-refresh hook). Cosmetic; flagged for review.

**U9: comment line-number drift.** The rules comments cite the FIX_PLAN's `[V-P]` line numbers
(db.js:221/:233 etc.); today's tree has drifted a few lines (~:230/:242). Citations kept
plan-consistent; do not "fix" them without re-verifying.

---

## §6 Checks run

- `node --check functions/index.js` ✓, `node --check functions/foundation.js` ✓,
  `node --check scripts/cs/create-teacher-invite.mjs` ✓.
- `npx eslint src/pages/Signup.jsx` → exit 0 (clean).
- `npx eslint functions/index.js` → 29 findings, ALL pre-existing environment false-positives
  (root flat config applied to CommonJS: `require`/`exports`/`Buffer` no-undef on lines that
  predate this draft, incl. every pre-existing `exports.*`); zero NEW findings attributable to
  this change.
- `firestore.rules`: full read-back for brace balance + block structure ✓ (no emulator here —
  syntax is finally proven by the Task-6 emulator load, which fails fast on a parse error).
- Client-writer sweep re-run post-edit: no client `list_progress`/`progress_meta` writer exists;
  the only `class_progress` client writers are the flag-OFF legacy legs + the try/caught
  blind-spot cache (§5 R3).
