# DEEPFIX Task 3 — P10 (OVR) implementation notes — part (d): the custom-claim role model + the rules NARROWING

> **Status:** STAGED, DORMANT, LOCAL-ONLY draft (2026-07-14). This is the **security point-of-no-return** of
> the P10 program. Built on the converged P3–P10(a/b/c) foundation (all uncommitted in this working tree).
> **David decision U7 = Option A: custom auth claim.** Nothing here is deployed, committed, branched, or run
> live: the `firestore.rules` narrowing takes effect ONLY at the David-run P10 cutover rules deploy (the file
> is a not-yet-deployed draft that already carries the P6 cutoff + the P10c additive read clause); the
> claim-mint in `provisionTeacher` is flag-guarded (`TEACHER_CLAIM_ENABLED=false`); and the claim backfill
> script is **`--dry`-only** in anyone's hands but David's (write-guarded like the P5 migration).
> Follows `P10_IMPL_PLAN.md` ★ OWNER DECISIONS (U7=A) + §1(d) + §3, and `FIX_PLAN.md` P10 (`:815-816`).

---

## §0 · What part (d) is (and what it is NOT)

Part (d) does THREE things, all staged:
1. **Role model = custom auth claim** (U7=A). `provisionTeacher` also mints `setCustomUserClaims(uid,{role:'teacher'})`
   for every NEW teacher (gated); a one-time `--dry` backfill stamps the claim onto every EXISTING role-doc
   teacher. The user-doc `role` field STAYS (it drives the client UI, unchanged); the CLAIM is the rules
   source of truth. `provisionTeacher` sets BOTH so they agree.
2. **`isTeacher()` → the claim.** The rules helper stops doing a per-eval `users/{uid}` `get()` and reads
   `request.auth.token.role == 'teacher'`.
3. **Execute the two named P6/P10 rule TODOs** (the narrowings that became legal once P10(b) moved
   `reviewChallenge` server-side): the users-subcollection teacher-WRITE breadth → `isOwner`, and the attempts
   teacher-of-record UPDATE branch → removed (attempts fully server-owned).

It is **NOT**: the token-policy matrix (C-18 — zero-code, ships independently); the P10c additive read clause
(`firestore.rules` `match /attempts` read — converged, untouched); the `teacherIds` denorm/backfill work
(converged, untouched); any client role-read change (AuthContext keeps reading the doc role for UI).

---

## §1 · What changed (real working-tree anchors, post-apply)

### `firestore.rules` (STAGED narrowing — dormant until the P10 cutover deploy)

| # | Change | Anchor (post-apply) |
|---|---|---|
| d1 | **File-header P10d note** — the **FOUR narrowings**, the **BLAST RADIUS enumeration** (~14 rules), the transition-safety choice (Option A), and HARD DEPLOY PRECONDITIONS **D1-D4** (claim-set live → backfill → token-refresh window → rules-test re-green), mirroring the P6 header. | `firestore.rules` header `Note (P10d …)` block |
| d2 | **`isTeacher()` → custom claim.** `return request.auth.token.role == 'teacher';` (was `getUserData().role == 'teacher'`). `getUserData()` retained but now **unused** (kept as the Option-B fallback + for future doc-field rules). | `firestore.rules` `isTeacher()` (helper defn); `getUserData()` just above it |
| d3 | **users/{u}/{subcollection} WRITE narrowed `isTeacher`→`isOwner`** (READ unchanged — teacher Students view still reads students' progress). Closes I-10 §7 breadth. | `firestore.rules` `match /{subcollection}/{docId}` `allow write` |
| d4 | **attempts teacher-of-record UPDATE branch REMOVED** → `allow update: if false;` (attempts now create:false/update:false/delete:false — fully server-owned). | `firestore.rules` `match /attempts/{attemptId}` `allow update` |
| d4b | **[Codex P10d-1 / U6] users/{u} UPDATE teacher OR-leg REMOVED** (was `isTeacher() && …hasOnly(['challenges'])`) → owner-only, KEEPING the `role`/`roleProvisioning` exclusion. Same dead-branch class: the only client teacher-write to a student's `challenges.history` was `reviewChallenge` (`db.js:2945`), now server-side. `submitChallenge` (`db.js:2803`) is the STUDENT/owner writing their OWN challenges → owner branch, unaffected. Same SERVER_OVERRIDE rollback coupling as d3/d4. | `firestore.rules` `match /users/{userId}` `allow update` |

**Untouched (verified):** the P10c additive read clause (`allow read … 'teacherIds' in resource.data …`)
and the whole teacherIds surface. Brace/paren/bracket balance re-checked (code-only, comments stripped):
`{}=49/49, ()=101/101, []=5/5`.

### `functions/index.js` (claim-wiring — flag-guarded, dormant)

| # | Change | Anchor |
|---|---|---|
| d5 | **`TEACHER_CLAIM_ENABLED = false`** — a NEW gate SEPARATE from `TEACHER_PROVISIONING_ENABLED`; the claim is the P10(d) rules source of truth, flipped at the P10 cutover (after the backfill, before the rules narrow). Updated the stale P6 comment that said "a custom-claim future WOULD add setCustomUserClaims here" (now RESOLVED = A). | just after `const TEACHER_PROVISIONING_ENABLED = false;` |
| d6 | **`provisionTeacher` mints the claim** — `if (TEACHER_CLAIM_ENABLED) { const r = await admin.auth().getUser(uid); await admin.auth().setCustomUserClaims(uid, {...(r.customClaims||{}), role:'teacher'}); }` AFTER the Firestore txn commits (auth writes can't join a Firestore txn), on BOTH the fresh and the idempotent `alreadyProvisioned` path. **[Codex P10d-2] MERGE (read-then-set)** — preserves any other custom claim (matches the backfill's additive discipline). **Fail-CLOSED**: throws `internal` on failure so the caller retries (the retry hits the idempotent branch and re-attempts ONLY the claim — never re-burns the invite). | inside `exports.provisionTeacher`, between the `runTransaction` and the audit-log |
| d7 | **`TEACHER_CLAIM_ENABLED` surfaced in the `version` probe** flags block (so the I-5 G1 flag-assertion table can assert "claim-set live" before the rules narrow). | `exports.version` `flags:` object |

### `scripts/cs/deepfix-backfill-teacher-claims.mjs` (NEW — `--dry`-only backfill)

- P5/P10c-style: `--dry` default (write guard THROWS before any `setCustomUserClaims` ⇒ ZERO auth writes);
  `--commit --confirm-claims=teacher-role-claims` guard (fixed sentinel forces intentionality). `--uid`,
  `--limit` for targeted/sample runs. Report → `dsg-edits/srv_validate/` (gitignored, local only).
- Lists every `users` doc with `role=='teacher'`; reads each user's CURRENT custom claims (Admin Auth
  `getUser`); classifies `SET_CLAIM` / `SKIP_ALREADY` (already `role:'teacher'`) / `MISSING_AUTH`
  (role-doc teacher with no Auth user — a data anomaly, flagged for triage, never auto-written).
- **Idempotent + additive**: `--commit` MERGE-sets `{...existingClaims, role:'teacher'}` (preserves any other
  custom claim — never wipes), read-back verifies, and prints the "everyone must refresh their token" (D3)
  reminder. A re-run SKIPs already-claimed teachers.

---

## §2 · The transition-safety choice + the FULL blast-radius enumeration (the key uncertainty, answered)

Switching `isTeacher()` to claim-only means **every** teacher-gated rule keys on the claim from the instant
the narrowing deploys. A teacher WITHOUT the claim (un-backfilled, or backfilled-but-token-not-yet-refreshed —
the promote→re-login lag) loses access to **all** of the following at once — NOT just override/review:

| # | Rule (post-apply) | What a claimless teacher loses |
|---|---|---|
| 1 | `match /{path=**}/class_progress/{docId}` `allow read` | admin/teacher dashboard progress read (collection group) |
| 2 | `match /users/{userId}/{subcollection}` `allow read` | the teacher Students view reading students' `list_progress`/`class_progress`/`study_states`/`session_states` |
| 3 | `match /classes/{classId}` `allow create` | creating a class |
| 4 | `match /lists/{listId}` `allow create` | creating a list |
| 5 | `match /system_logs/{logId}` `allow read` | reading reconciliation/system logs |
| 6 | `match /ap_tests` `allow write` | AP test authoring |
| 7 | `match /ap_questions` `allow write` | AP question authoring |
| 8 | `match /ap_stimuli` `allow write` | AP stimulus authoring |
| 9 | `match /ap_answer_keys` `allow read, write` | AP answer-key read+write |
| 10 | `match /ap_session_state` `allow read` (teacher OR-leg) | AP live-session monitoring read |
| 11 | `match /ap_test_results` `allow read` (teacher OR-leg) | AP result read |
| 12 | `match /ap_test_results` `allow update` | AP grading write |
| 13 | `match /ap_classes` `allow write` | AP class management |
| 14 | `match /ap_assignments` `allow write` | AP assignment management |

(**14 rules switch to the claim** — down from 15: **[Codex P10d-1]** d4b now REMOVES `isTeacher()` from the
`users/{userId}` UPDATE teacher/`challenges` OR-leg, so it is no longer in the switch set. In total, narrowings
d3 [users-subcollection WRITE], d4 [attempts UPDATE], and d4b [users-doc `challenges` OR-leg] DROP `isTeacher()`
from their rules entirely — they don't merely re-key on the claim.)

**CHOICE = Option A (hard precondition), NOT Option B (transition-safe claim-OR-doc window).** Rationale:
- The plan (U7) and the spec both recommend A, accepting the promote→re-login lag as a one-time, bounded,
  operationally-known cost (ID-token TTL ≈ 1h, or a sign-out/in). Option B (`getUserData().role=='teacher' ||
  request.auth.token.role=='teacher'`) would keep the per-eval `get()` on the exact rules it was meant to
  remove, would leave the doc-role trust surface partially live through the window, and would then need a
  SECOND narrowing deploy to remove the doc leg — more deploys, more state, for a lag that A already bounds.
- A is enforced by the **hard preconditions D1-D4** in the rules header (claim-set live → backfill complete →
  token-refresh window elapsed → rules-test re-green), exactly the P6-header discipline. The Option-B
  one-liner is documented IN the `isTeacher()` comment so David can choose it if D3's refresh window is
  operationally unacceptable (e.g., a teacher mid-session at cutover cannot be asked to re-login).

**Blast-radius mitigation baked in:** D2 (backfill) covers the un-backfilled case; D3 (refresh window) covers
the token-lag case; both are gated BEFORE the rules deploy, so at deploy time the intersection "teacher with
no usable claim" is empty by construction.

---

## §3 · Flag-off / staging byte-equivalence argument (per file)

- **`firestore.rules`** — the whole file is a **not-yet-deployed draft**. The LIVE ruleset is unchanged until
  David runs `firebase deploy --only firestore:rules` at the P10 cutover. So d1-d4 are byte-equivalent to
  "today's live behavior" for as long as the file is undeployed — identical to how the P6 cutoff and the P10c
  read clause already sit dormant in this same file. There is NO client behavior tied to the rules file.
- **`functions/index.js`** — `TEACHER_CLAIM_ENABLED=false` ⇒ the `if (TEACHER_CLAIM_ENABLED)` block is skipped
  ⇒ `provisionTeacher` runs EXACTLY its P6 body (role-doc set only, no auth write) ⇒ byte-equivalent behavior
  and an unchanged return shape `{success, role, alreadyProvisioned}` (client behavior consistent). The new
  flag is inert data; the `version` probe just reports one more `false`. (Note: `provisionTeacher` itself is
  ALSO still gated dark by `TEACHER_PROVISIONING_ENABLED=false` — a P6 flip.)
- **`scripts/cs/deepfix-backfill-teacher-claims.mjs`** — new file; not imported by the app. `--dry` (default)
  makes ZERO auth writes (guard throws). No effect on any runtime surface.

---

## §4 · Deploy order + hard preconditions (David's cutover — NOT run here)

Extends the P6/P10 **functions → rules, rules LAST** discipline. The claim work inserts the backfill + refresh
window between them:

1. **`--only functions`** deploy carrying `provisionTeacher`'s claim-set, with **`TEACHER_CLAIM_ENABLED=true`**
   (and `TEACHER_PROVISIONING_ENABLED=true` if not already). Now every NEW teacher mint stamps the claim.
   Safe — dark for the rules (which still read the doc via the undeployed narrowing).
2. **Claim backfill (`--commit`)** — `node scripts/cs/deepfix-backfill-teacher-claims.mjs --dry` → David
   reviews the report → `--commit --confirm-claims=teacher-role-claims`. A CS event (SUPPORT_RUNBOOK +
   change_action_log). Read-back must show 0 mismatches; triage any `MISSING_AUTH`.
3. **Token-refresh window** — every live teacher re-logs-in OR ≈1h elapses (ID-token TTL) so the claim reaches
   their token. (Optional UX accelerator — see U5: a forced `getIdToken(true)` on redemption.)
4. **`--only firestore:rules`** NARROWING deploy (d1-d4b) — LAST, nothing rides along. Reversible via git +
   redeploy. **Coupling:** if `SERVER_OVERRIDE` (client reviewChallenge→callable) is ever rolled back, revert
   **d3+d4+d4b** in the SAME redeploy (their reverted client teacher-writes — study_states, attempts, and the
   student's `challenges.history` — would otherwise be denied).

**Preconditions = the rules-header D1-D4**, mirrored here. D-order is load-bearing: deploying the rules
narrowing before D2+D3 complete would lock every teacher out (the §2 blast radius).

---

## §5 · Uncertainties (numbered) for Codex

1. **U1 — the transition-safety choice (THE key call).** Chose **Option A (hard precondition D1-D4)** over
   Option B (claim-OR-doc window). Confirm A is acceptable given the §2 blast radius, OR direct me to stage
   Option B (`isTeacher()` = `getUserData().role=='teacher' || request.auth.token.role=='teacher'`, then a
   later doc-leg-removal deploy). The Option-B one-liner is documented in the `isTeacher()` comment. The load
   test for A: can EVERY live teacher be guaranteed a token refresh (D3) at cutover, including one mid-session?

2. **U2 — `setCustomUserClaims` merge vs replace — RESOLVED [Codex P10d-2].** `provisionTeacher` now MERGE-sets
   `{...(userRecord.customClaims||{}), role:'teacher'}` (read-then-set), matching the backfill script. Both
   paths preserve any other custom claim rather than clobbering it. One extra `getUser` read, only inside the
   dormant `if (TEACHER_CLAIM_ENABLED)` block; the fail-closed throw is retained.

3. **U3 — fail-closed throw in `provisionTeacher`.** On `setCustomUserClaims` failure I throw `internal` (the
   txn already committed the role doc + consumed the invite; a retry is idempotent and re-attempts only the
   claim). Alternative: swallow + log + return `{claimSet:false}` so the client can prompt a manual re-try
   without an error toast. Throwing is the conservative (fail-closed, at-least-once claim) choice; confirm the
   UX is acceptable (Signup's `finishTeacherRedemption` currently surfaces the error and keeps the student
   account working — see U5).

4. **U4 — attempts UPDATE: remove vs narrow.** Chose full **removal** (`allow update: if false`) over narrowing
   to the union, because (a) P10(b) enforces the I-10 §6 union SERVER-side (Admin SDK bypasses rules) and
   (b) I grep-confirmed the only client teacher attempt-write is `reviewChallenge`'s (`db.js:2920`), which is
   behind `SERVER_OVERRIDE` (ON at the deploy precondition); the student answers-write was already removed
   (C-29). So no legitimate client teacher-write remains ⇒ removal is strictly safer. Confirm no other client
   `updateDoc(attemptRef…)` teacher path exists that I missed.

5. **U5 — token-refresh / re-login UX surfacing (the promote→re-login lag).** Signup's
   `finishTeacherRedemption` already does `window.location.assign('/')` after redemption, which re-reads the
   DOC role (UI works immediately) but does NOT refresh the ID token — so the new CLAIM (and thus rules access)
   lags until the token refreshes. Recommended follow-up (NOT implemented — out of the named IMPLEMENT scope,
   and A accepts the lag): call `auth.currentUser.getIdToken(true)` right after a successful `provisionTeacher`
   to force a token mint that includes the claim, collapsing the lag for the signup path. Existing teachers
   (backfill path) still need a natural refresh (D3). Should this accelerator ship WITH the claim cutover?

6. **U6 — the users-DOC `challenges` teacher OR-leg — RESOLVED [Codex P10d-1] (narrowing d4b).** NARROWED to
   owner-only (teacher OR-leg removed, `role`/`roleProvisioning` exclusion kept). Grep-CONFIRMED the only client
   teacher-write to a student's `challenges.history` is `reviewChallenge` (`db.js:2945`, behind `SERVER_OVERRIDE`,
   moved server-side by P10(b)); `submitChallenge` (`db.js:2803`) is the STUDENT/owner writing their OWN
   `challenges.history` and passes the owner branch, unaffected. Same dead-branch class as d3/d4, with the same
   `SERVER_OVERRIDE` rollback coupling. (Codex confirmed this is the same class and directed the narrowing; it is
   now executed rather than deferred.)

7. **U7 — server callable authz still reads the DOC role, not the claim.** `assertOverrideAuthz` /
   `assertOverrideTargetAuthz` / `renameStudent` gate on `users/{caller}.role == 'teacher'` (Admin SDK doc
   read), NOT `request.auth.token.role`. This is consistent (doc + claim agree post-provision) and callables
   are Admin-SDK (rules-independent), so it is not a hole — but if David wants ONE source of truth, the
   callables could switch to `request.auth.token.role` too (removes a doc read per call). Left as-is: the
   spec scoped part (d) to the RULES `isTeacher()` + provisioning, not the callable authz. Flagging for a
   consistency decision.

8. **U8 — `getUserData()` left defined-but-unused.** After d2 no rule calls it. Kept (harmless; needed for
   Option B and any future doc-field rule). Confirm keeping the dead helper is preferred over deleting it
   (deleting is a larger, less-reversible edit; keeping documents the old path).

---

## §6 · Validation

- **Parser:** `node --check functions/index.js` → OK. `node --check scripts/cs/deepfix-backfill-teacher-claims.mjs`
  → OK.
- **Rules (reviewed-not-executed; emulator = Task 6):** brace/paren/bracket balance (comments stripped) =
  `{}=49/49, ()=101/101, []=5/5`, balanced. Manual walk of every `isTeacher()` call-site's new behavior = §2
  table (15 switch to the claim; 2 drop the teacher branch entirely). Every guarded by `isAuthenticated()`
  first ⇒ `request.auth` non-null when `isTeacher()` evaluates ⇒ `request.auth.token.role` is safe; absent
  claim ⇒ null ⇒ `!= 'teacher'` ⇒ fail-closed.
- **eslint delta vs reconstructed pre-(d) baseline = 0 new** (functions/index.js + the new script) — see the
  diff-generation notes; the reconstruction reverse-applies d5-d7 to get the pre-(d) file.
- **P10c read clause + teacherIds work UNCHANGED** — grep-verified (the `'teacherIds' in resource.data`
  read clause and the whole teacherIds surface are byte-identical).
- **Diff:** `audit/deepfix/task3/phase10d_diff.patch` (git-apply-clean + round-trip; new files noted).
