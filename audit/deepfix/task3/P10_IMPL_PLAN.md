# DEEPFIX Task 3 — P10 (OVR) implementation plan

> **Status:** PLANNING DOC ONLY (2026-07-14). No source edited, no git, no live-Firebase. This is the
> pin-the-anchors-and-decide-the-shape doc so P10 (OVR — teacher override + challenge redesign, FIX_PLAN
> `:792-833`, I-7/I-10) can be implemented fast once **P9 converges** and the **P6 foundation is live**.
> Every code anchor below was traced to the **current working tree** (which carries the uncommitted P3–P9
> stack), so line numbers differ from the FIX_PLAN's cites (those were pre-stack); both are given where it
> matters.

## ★ OWNER DECISIONS (David, 2026-07-14) — resolve U1 + U7
- **U1 (read-surface widening for part c) → OPTION A:** `teacherIds`-array **denormalization + reindex**. Stamp
  all authorized teachers onto each attempt as a `teacherIds` array; the gradebook queries `array-contains` the
  caller. ⇒ Part (c) includes a **one-time DATA MIGRATION** of the `attempts` collection (backfill `teacherIds`
  from `teacherId` stamp ∪ current-enrollment owners) + a **new composite index** — build it P5-style: a `--dry`
  script, David-authorized commit, mind the ≤30 disjunction budget shared with the C-33 `studentId` filter.
- **U7 (role model for part d) → OPTION A:** **custom auth claim**. "teacher" is minted into the login token
  (`auth.setCustomUserClaims(uid,{role:'teacher'})`), wired into the P6 `provisionTeacher` flow + a one-time
  backfill for existing teachers; the P6/P10 rules check `request.auth.token.role == 'teacher'` (no per-eval user
  doc `get()`). ⇒ Accept the **promote→re-login** lag (token refresh ~1h or sign-out/in); surface it in the
  provisioning UX. Part (d)'s rules narrowing keys on the claim.
- **Sequencing:** these unblock (c)/(d), but (c)/(d) are built AFTER **P10(a/b) converges** (they build on/finalize
  it — e.g. (d) can only remove the `study_states` teacher-write rule once (b)'s `reviewChallenge`→server is
  solid), and (a/b) is still in Codex review. Held on that gate.

**Scope stance (inherited from the deepfix pattern).** P10 ships **flag-guarded, dormant, LOCAL-ONLY draft;
flag-off byte-equivalent**; built on the now-complete foundation (P3–P6: server-authoritative progress via
`functions/foundation.js` callables, the P6 rules cutoff). Deploy order mirrors P6: **functions → rules**,
rules narrowing **LAST**. Verification stance (David, verbatim): "always verify all claims… Never trust
blindly." Every cite below was read in the working tree before writing.

**Gates (do not start P10 until both hold).**
1. **P6 live + accepted** (server-authoritative twi; rules cutoff deployed). Explicit in FIX_PLAN `:792`.
2. **The C-28 full role decision** (custom claim vs doc-field-forever). P6 shipped only the *minimum* (M8
   role whitelist `firestore.rules:71-91` + the `provisionTeacher` callable + `TEACHER_PROVISIONING_ENABLED`
   `functions/index.js:1945`). The FULL mechanism is "David's decision 4 and gates P10, not P6"
   (`functions/index.js:1939-1941`). See **U7**.

---

## §0 · What P4/P5/P6 ALREADY landed that P10 builds on (READ THIS FIRST — the overlap)

P10 is **not** greenfield. The P3/P4 stack already server-ported the *day-advance sub-leg* of challenge
review, so a large piece of FIX_PLAN P10 sub-part (b) is **already done**. Pinning this prevents
re-implementing it:

| Already in tree | Where | What it means for P10 |
|---|---|---|
| **`advanceForChallenge` callable** — the challenge-accept **day-advance** twi writer, server-side | `functions/foundation.js:1671-1812`; re-export `functions/index.js:2061` | The **twi clamp** (`:1780-1791`) and the **`phase==='new'` gate** (`:1792`) that FIX_PLAN P10(b) asks for are **ALREADY implemented** (both I-6 §3-row-8 defects closed). P10 does **not** re-do these. |
| Client `reviewChallenge` already **routes the day-advance** to that callable under `SERVER_CHALLENGE_WRITE` | `src/services/db.js:2856-2870` (route), `:2871-2933` (flag-off client fallback) | `reviewChallenge` is **hybrid today**: client does the answer-flip/score/study_state legs; server does the day-advance. P10(b)'s remaining job is to migrate the **rest** of `reviewChallenge` server-side + apply the authz union. |
| P6 rules left **explicit P10 TODOs in-code** | `firestore.rules:102-108` (study_states→isOwner), `:168-169` (attempts read widening = "P10's work"), `:186-188` (attempts teacher-update → "until P10 moves review server-side") | The rules edits P10 must make are **already named at the exact lines**. |
| `advanceForChallenge` authz is the **P3 minimum** (stamp-only), explicitly deferring the union to P10 | `functions/foundation.js:1694-1698` ("The I-10 §6 enrollment-union lands with P10's full reviewChallenge migration") | P10 upgrades this stamp-only check to the **I-10 §6 union** and reuses it for the new callables. |
| P5 made progress writes target the **canonical (student,list) record** | `advanceForChallenge` writes `durableProgressRef(studentId, classId, listId)` `:1738` | P10's override/reviewChallenge inherit the canonical target for free — **dissolves I-10 §5's "accepted challenge unlocks the OLD class's docs" mis-landing** without extra work. |
| Read-surface I-8 fixes (C-33/C-34/C-35) **already applied** | studentId server-push `db.js:1988-2002`; `getAssignedListIds` `db.js:1859` | The gradebook already pushes a *narrowing* studentId filter. P10's C-19 leg is the **widening** leg (a different problem — see §1c). |

**Net:** P10's real remaining work = (a) the **override callable** (new), (b) **finish** the `reviewChallenge`
server migration (answer-flip/score/study_state legs + **authz union**), (c) the **read-surface widening**
leg (C-19 visibility, still absent), (d) the **rules narrowing** (LAST). See **§8** for where this
re-scoping corrects the FIX_PLAN's P10(b) wording.

---

## §1 · Change inventory (numbered, grouped by P10 sub-part, real working-tree anchors)

### (a) Override callable — the in-product `manual-pass.mjs`

The override makes "no deterministic grader miss is a dead-end" true for the case with **no challengeable
answer** (grader false-negative on a whole attempt, `teacherId:null` orphans, etc.): a server-authorized
teacher writes a **valid reconciliation anchor**, exactly as CS does by hand today.

1. **New callable `overrideAttempt`** in `functions/foundation.js` (near `advanceForChallenge`, after
   `:1812`; re-export in `functions/index.js` beside `:2061`). Signature (proposed):
   `overrideAttempt({ attemptId?, studentId, classId, listId, studyDay, score })`.
   - **Mirror the valid-anchor write of `scripts/cs/manual-pass.mjs`** (the CLAUDE.md anchor rule, now a
     server primitive). It MUST set the full anchor field set that reconciliation reads:
     `sessionType:'new'`, `testType`, `studyDay`, `passed`, `score`, **`newWordStartIndex`**,
     **`newWordEndIndex`**, **`wordsIntroduced = nwei − nwsi + 1`**, **`testId:
     `vocaboost_test_${classId}_${listId}_new``**, `teacherId`, `classId`, `listId`, `studentId`,
     `manualOverride:true`, `manualReviewNote`, `submittedAt`. (Field set verbatim from
     `scripts/cs/manual-pass.mjs` payload.) Derive the word range from the student's verified daily pace
     exactly as the script does (day-1 passed-new attempt → `pace`, else cohort default), so the anchor is
     **valid** — an invalid anchor is what makes the app log `csd_anchor_invalid` to `system_logs`
     (CLAUDE.md; the CS-2026-06-21 failure class).
   - **Then advance the day** by reusing the *existing* `advanceForChallenge` transaction body (extract its
     tx block `functions/foundation.js:1743-1804` into a shared internal helper both callables call) —
     writing `durableProgressRef` `:1738` (canonical, P5). This guarantees the override's day-advance is the
     **same clamped + phase-gated** primitive, not a second hand-rolled writer.
   - **Audit-log** via `logSystemEventServer(...)` (the pattern `advanceForChallenge` uses at
     `functions/foundation.js:1806-1810`) with a distinct event name (`teacher_override`) + before/after.
   - **Authz = the I-10 §6 UNION** (see §3), enforced server-side (Admin SDK bypasses rules).
   - **Flag-gated** by a new `FOUNDATION_FLAGS` entry `SERVER_OVERRIDE_ENABLED` (default false) — a
     `failed-precondition` throw when off, exactly like `advanceForChallenge:1671-1674`.
2. **Client entrypoint** for the override in the Gradebook review UI (`src/pages/Gradebook.jsx`, alongside
   the existing Accept/Reject drawer that calls `reviewChallenge` — I-10 traced the only two call sites at
   `Gradebook.jsx:1380/1396`, now shifted; grep before editing). A "Mark as passed / override" action that
   calls `httpsCallable('overrideAttempt')`. **Gated on the new client flag `SERVER_OVERRIDE`** (§2): when
   off, the entrypoint is not rendered → byte-equivalent.

### (b) `reviewChallenge` → server (FINISH the migration begun in P4)

3. **New callable `reviewChallenge`** in `functions/foundation.js` (server port of the client body
   `src/services/db.js:2728-2942`). It absorbs the legs the client still owns today:
   - **Answer-flip** (`db.js:2761-2773`) — set `answers[i].challengeStatus` accepted/rejected + `isCorrect`.
   - **Score/passed recompute** with the persisted-`totalQuestions` denominator (`db.js:2775-2808`) — the
     review-vs-new `newPassed` rule (`db.js:2799-2801`) carried verbatim.
   - **`challenges.history` update** (`db.js:2810-2830`).
   - **`study_states` PASSED write** on accept (`db.js:2832-2843`) — **this is the write that keeps the
     `firestore.rules:109-114` teacher branch alive**; moving it into the callable is the precondition for
     the §1(d) rules narrowing (rules comment says so verbatim at `:105-108`).
   - **Day-advance** — call the shared helper extracted from `advanceForChallenge` (item 1) rather than a
     sub-`httpsCallable`, so the whole review is **one transaction** (today it is two hops: client update
     then a nested callable, `db.js:2868-2870`).
   - Model it on `submitChallenge` (`functions/index.js:630-682`): all-reads-first, `runTransaction`,
     idempotency guard (already-reviewed → no-op success, cf. client `db.js:2757-2759`).
   - **Authz = the I-10 §6 UNION** (§3), replacing the client's stamp-only throw (`db.js:2743-2745`).
   - **Flag-gated** by `FOUNDATION_FLAGS.SERVER_REVIEW_CHALLENGE_ENABLED` (default false).
4. **Client `reviewChallenge` routes to the callable** under the new `SERVER_OVERRIDE` flag — the same
   spread/branch pattern P4 used for the day-advance (`db.js:2856-2870`), but now wrapping the **whole**
   function body, not just the day-advance block. Flag-off ⇒ the current client body (incl. its own
   `SERVER_CHALLENGE_WRITE` day-advance sub-branch) runs unchanged ⇒ byte-equivalent.
   - **Note the twi clamp + `phase==='new'` gate are NOT new P10 code** — they already live in
     `advanceForChallenge:1780-1792` (P4). Item 3 inherits them by calling the shared helper. (This is where
     the FIX_PLAN P10(b) wording overlaps P4 — see §8.)

### (c) Read-surface leg — C-19 visibility (inherited attempts + ex-roster name filter)

The gradebook is a **client** Firestore query, so both a query change **and** an attempts-read-rule change
are required, in the same release (I-10 §4).

5. **Second predicate leg for inherited attempts.** The base predicate is still
   `where('teacherId','==',teacherId)` (`src/services/db.js:1974-1979`); it can *never* show B's teacher the
   A-stamped attempt (I-10 §3 P1). Add a widening leg so a currently-enrolled-teacher sees inherited
   attempts. **Design fork (U1 — pick before building):**
   - **Option A (structural, recommended, north-star aligned): `teacherIds` array denormalization.** Add a
     `teacherIds` array to attempts, stamped `[ownerTeacherId]` at the 3 write sites
     (`db.js:1236-1244` MCQ/generic, `db.js:1396-1404` typed, `functions/index.js:359` server) and
     **appended** on promotion (the `removeStudentFromClass`/`joinClass` path, `db.js` promotion tooling —
     I-10 §2 S4 confirms nothing re-stamps today). Query becomes
     `where('teacherIds','array-contains',uid)`; rules read becomes `uid in resource.data.teacherIds`
     (cheap, no `get()`). Requires: a one-time **reindex/backfill** of the C-19-orphaned subset (F-6b
     population) + **2 new composite indexes** (`teacherIds`+`submittedAt`, and `teacherIds`+`studentId`+…
     to compose with the C-33 push). This is the I-10 §6.3 "`teacherIds`-array/attempt-reindex" option.
   - **Option B (no migration): query-union + rules `get()`.** A Firestore `or()` of `teacherId==uid` and
     `studentId in currentRoster`; rules read adds an enrollment-ownership `get()` on the student doc. No
     backfill, but: complicates pagination/`orderBy` (`db.js:2004-2019`), consumes the ≤30 DNF disjunction
     budget shared with the C-33 studentId push (`db.js:1993-2002`), and adds an expensive per-doc rules
     `get()`. Fragile.
   - **Option C: route gradebook discovery through a server callable** (like `resolveListProgress`), union
     enforced server-side, no client read-rule widening at all. Biggest code change; cleanest security.
6. **Name filter must stop hard-empty-returning on ex-roster students.** `getTeacherData` builds
   `studentNameToIdMap` from **current** members only (`db.js:1852-1878`), so a promoted student's name never
   resolves → `filterStudentIds:[]` → **hard empty return** (`db.js:1963-1972`, specifically the
   `hasNameFilter && filterStudentIds.length === 0` disjunct). Fix: when the widening leg (item 5) is active,
   resolve names against a **union roster** (current members ∪ students appearing on inherited attempts), or
   suppress the hard-empty return for the Name category when inherited attempts exist. The `'Unknown Student'`
   render fallback (`db.js:2070`) already tolerates unresolved ids in the unfiltered view.
7. **Attempts READ rule widening** (`firestore.rules:170-173`) — co-released with items 5–6 (I-10 §4). Add
   the third read condition matching the chosen Option (A: `uid in resource.data.teacherIds`; B/C:
   enrollment `get()` or none). This is a **read WIDENING** and is additive-safe (see §5) — distinct from the
   §1(d) narrowing.

### (d) Rules narrowing — LAST, co-released with nothing risky

8. **Attempts teacher-UPDATE branch → union / removed** (`firestore.rules:189-190`, currently
   `resource.data.teacherId == request.auth.uid && isTeacher()`). Once `reviewChallenge` is fully
   server-side (item 3, flag on + soaked), **no client writes attempt docs as a teacher** → this branch can
   narrow to the union (or be removed entirely if no client teacher-write remains). The rules comment
   `:186-188` names this exact edit.
9. **Users-subcollection teacher-write → `isOwner`** (`firestore.rules:109-114`). The `isTeacher()` breadth
   survives *only* because client `reviewChallenge` writes the student's `study_states` on accept
   (`db.js:2832-2843`; rules comment `:102-108` states this verbatim). After item 3 moves that server-side,
   narrow `allow write` from `(isOwner(userId) || isTeacher())` to `isOwner(userId)` — closing the I-10 §7
   "any teacher can write any student's subcollections" breadth. This is the long-standing in-file TODO the
   P6 comment replaced.

---

## §2 · Flag design

**New flags (default false; flag-off = byte-equivalent).** Mirror the established naming
(`SERVER_CHALLENGE_WRITE`, `SERVER_PROGRESS_WRITE`, …) and the P6 provisioning pattern
(`TEACHER_PROVISIONING_ENABLED`).

| Flag | Where | Gates |
|---|---|---|
| **`SERVER_OVERRIDE`** (client) | `src/config/featureFlags.js` (beside the others, dormant-draft comment) | Routing client `reviewChallenge` → the server callable (item 4); rendering the override entrypoint (item 2); the read-surface query widening (items 5–6) |
| **`SERVER_REVIEW_CHALLENGE_ENABLED`** (server) | `FOUNDATION_FLAGS` `functions/foundation.js:89-98` | The `reviewChallenge` callable (item 3) — `failed-precondition` throw when off |
| **`SERVER_OVERRIDE_ENABLED`** (server) | `FOUNDATION_FLAGS` `functions/foundation.js:89-98` | The `overrideAttempt` callable (item 1) |

**How flag-off stays byte-equivalent (the Run-L discipline).**
- Client: with `SERVER_OVERRIDE === false`, `reviewChallenge` runs its existing body unchanged (including its
  internal `SERVER_CHALLENGE_WRITE` day-advance branch), the override entrypoint is not rendered, and the
  gradebook query keeps the single `teacherId==` base predicate + the existing C-33 studentId push. No new
  read is issued; the new imports are inert. Verify with the same eslint-parity + reconstructed-baseline diff
  the P9 notes used.
- Server: the two new callables `failed-precondition`-throw when their FOUNDATION_FLAGS gate is false (cf.
  `advanceForChallenge:1671-1674`) — dark on deploy, exactly like every P3 callable shipped dark.

**Deploy-order dependency (functions → rules; §5 spells the full sequence).** The callables deploy first,
**dark**. Flags flip only at a David-run cutover after soak. The rules **narrowing** (items 8–9) is its own
**LAST** `--only firestore:rules` deploy — nothing rides along (the P6 discipline,
`P6_impl_notes.md:6`). FIX_PLAN P10 targets: `--only functions`, then `--only firestore:rules`.

---

## §3 · Authz model — the I-10 §6 UNION (server-enforced)

Both new callables (and the upgraded `advanceForChallenge`) compute the same authorization set, server-side,
Admin-SDK (bypassing rules):

```
authorized(caller, attempt) :=
    isTeacher(caller)                                            // role gate
 && (  attempt.teacherId === caller                             // (i) teacher of record — the STAMP
    ||  ∃ classId ∈ student(attempt).enrolledClasses :          // (ii) CURRENT-enrollment ownership
           classes/{classId}.ownerTeacherId === caller )
```

- Leg (i) = the stamp model `reviewChallenge`/`advanceForChallenge` use today
  (`db.js:2743`, `functions/foundation.js:1694`; stamp written at `db.js:1236-1244`/`:1396-1404`,
  `functions/index.js:359`).
- Leg (ii) = the **`renameStudent` pattern verbatim** — role check `functions/index.js:1866-1868` + iterate
  the student's `enrolledClasses` and match `ownerTeacherId === callerId`
  (`functions/index.js:1878-1887`). I-10 §6.1: the codebase already contains BOTH models separately
  (`reviewChallenge` = stamp-only; `renameStudent` = enrollment-only); **C-19 is precisely the disjunction
  neither implements** — P10 is the first to union them.
- **Unrelated teacher → DENIED** (neither leg) — same `permission-denied` HttpsError shape.
- Extract a shared `assertOverrideAuthz(callerId, attempt)` helper in `functions/foundation.js` and call it
  from all three callables (override, reviewChallenge, and the upgraded advanceForChallenge — replacing its
  P3-minimum stamp-only throw at `:1694-1698`).
- **Security dependency (I-10 §7 / U7):** the union grants powerful cross-student write authority keyed on
  `isTeacher()`. P6's M8 (`firestore.rules:71-91`) already stops self-promotion at the rules layer, but the
  callable reads the doc `role`. The **C-28 full role decision** (custom claim vs doc-field) governs whether
  `isTeacher()` here should read `request.auth.token.role` instead — this is the gate on P10.

---

## §4 · The C-19 orphaned-challenge + promoted-student cases (how P10 makes them actionable)

Scenario: student S promoted A→B; a failed/challengeable attempt stamped `teacherId = A.ownerTeacherId`
(I-10 §5). Today: B's teacher can't SEE it (query base `db.js:1974-1979`), can't ACT on it
(`reviewChallenge` throws `db.js:2743`), and rules deny read+update (`firestore.rules:170-173, 189-190`);
A's teacher goes blind via name search (`db.js:1963-1972`). Three independent locks (I-10 §3).

P10 unlocks each:
- **Actionability** — `reviewChallenge`/`overrideAttempt` callables authorize via the §3 union: B's owner
  (leg ii, S currently enrolled in B) is authorized even though the stamp is A's. Admin SDK bypasses the
  rules backstop. This is the operative fix and needs **no rules read-widening**.
- **Visibility** — the §1(c) read-surface leg (items 5–7) surfaces the inherited attempt + its pending-
  challenge badge in B's teacher gradebook, and stops A's teacher name-search from hard-empty-returning.
- **Correct landing** — the override/review day-advance writes `durableProgressRef(S, classId, listId)`
  (`functions/foundation.js:1738`, canonical per P5), so the unlock lands on the doc S **now** runs —
  **dissolving I-10 §5's mis-landing** (which wrote the OLD class's `class_progress`/`session_states`,
  `db.js:2884-2929`).
- **The `teacherId:null` sub-class** (attempt saved with no readable class → invisible+unactable to
  *everyone*, I-10 §5 variant): the **override callable** is the path — a teacher supplies the
  (student, list, day) and writes a fresh valid anchor, no dependence on the broken stamp. This is why the
  override is a *superset* of reviewChallenge, not a duplicate.

**Acceptance (FIX_PLAN `:826-828`):** F-6 permanent-fail population (3 known students) → 0; every
SUPPORT_RUNBOOK manual-pass event class has an in-product path; the C-19-orphaned subset of the 614 pending
challenges becomes actionable; the hand-patch treadmill (P set) stops growing.

---

## §5 · Ordering / co-release constraints (the hard rules)

1. **G1 landmine still applies** — any `--only functions` deploy re-arms the 06-29 outage risk unless P0's
   `GRADE_TOKEN_ENFORCED` disarm has landed (FIX_PLAN §3.1). P10's functions deploy inherits the full P3-class
   gate + quiet window. (By P10, P0 is long done — noted for the checklist, not a new risk.)
2. **The query+rules same-release rule (I-10 §4).** The read-surface query widening (items 5–6) must **not**
   ship without the attempts-read-rule widening (item 7) — a query-only fix hits the rules backstop
   (`firestore.rules:170-173`). Because item 7 is a read **widening** (additive permission), it is safe to
   deploy *before or with* the query flag flip.
3. **Rules narrowing (items 8–9) is LAST.** It is only legal once `reviewChallenge` is fully server-side and
   soaked (no client attempt-update / study_state-write remains). It reverts independently.

**Recommended sequence (extends the P6 functions→rules discipline):**
1. Deploy `--only functions` (override + reviewChallenge callables + shared authz/tx helpers) — **dark**
   (FOUNDATION_FLAGS false). Safe at any time.
2. Deploy `--only firestore:rules` **READ-WIDENING ONLY** (item 7) — additive; harmless while the query flag
   is off (no client queries wider yet).
3. **Cutover (David):** flip `SERVER_OVERRIDE` (client) + `SERVER_REVIEW_CHALLENGE_ENABLED` +
   `SERVER_OVERRIDE_ENABLED` (server) on, rebuild + `--only hosting`. Now review/override route server-side
   and the gradebook query widens against the already-widened read rule → no backstop hit. **Soak.**
4. Deploy `--only firestore:rules` **NARROWING** (items 8–9) — LAST, nothing riding along. Reversible via git
   + redeploy.

(If Option A `teacherIds` denorm is chosen for item 5, an index deploy + a read-only backfill of the
C-19-orphaned subset precede step 2 — `--only firestore:indexes` first, index builds are additive/zero-risk,
loud-not-silent failure, per the I-8 C-33 precedent.)

---

## §6 · Uncertainties (U1..U8) for the Codex review

- **U1 — read-surface widening approach (the biggest open fork).** Option A (`teacherIds`-array denorm +
  reindex; cheap query+rules, but a data migration + a new stamp site to maintain on promotion), Option B
  (`or()` query + rules `get()`; no migration, but pagination/DNF-budget/`get()`-cost fragility), or Option C
  (server-callable gradebook discovery). **The plan recommends A** as the north-star-aligned structural fix
  ("permission follows the student"), but this is the load-bearing decision — adjudicate before building
  items 5–7. Note the interaction with the already-shipped C-33 studentId push (`db.js:1993-2002`) sharing
  the ≤30 DNF budget under Option B.
- **U2 — override callable input contract.** Should `overrideAttempt` (a) flip an **existing** attempt to
  passed + backfill missing anchor fields, or (b) always **write a fresh** valid-anchor `new` attempt (the
  manual-pass model), or (c) both branches by whether `attemptId` is supplied? The spec says "mirrors
  manual-pass.mjs's valid-anchor write" (→ writes a fresh anchor); confirm that's the intended semantics for
  the has-an-attempt case too, vs. reusing/repairing the existing doc.
- **U3 — one transaction vs. two hops for `reviewChallenge`.** The plan folds the day-advance into the
  reviewChallenge transaction (via the shared helper) so the whole review is atomic — today it is two hops
  (client update, then nested `advanceForChallenge`, `db.js:2868-2870`). Confirm the atomic single-tx is
  wanted (it changes the failure semantics: today a day-advance failure leaves the answer-flip committed,
  `db.js:2934-2937` swallows it).
- **U4 — narrow vs. remove the attempts teacher-UPDATE rule (item 8).** After review is server-side, is there
  ANY remaining legitimate client teacher-write to an attempt? If none, remove the branch entirely (strictly
  safer) rather than narrowing to the union. Grep for teacher-side `updateDoc(attemptRef…)` before deciding.
- **U5 — review-pass phase-gate semantic delta (inherited from P4, still unadjudicated).**
  `advanceForChallenge:1792` makes a review-pass boundary advance csd but leave twi **flat** (phase gate),
  whereas the legacy client added the pace-derived count on the review branch too (`db.js:2914-2929`). P4's
  own notes flagged this "for reviewer adjudication" (`functions/foundation.js:1659-1664`). P10 inherits it
  verbatim via the shared helper — re-confirm it here rather than silently carrying it.
- **U6 — name-filter union roster (item 6) scope.** Resolving names against "current members ∪ students on
  inherited attempts" needs the inherited-attempt student set, which is only known *after* the widening query
  runs — a chicken/egg with the pre-query hard-empty guard (`db.js:1963-1972`). Options: drop the hard-empty
  guard for Name when widening is active (accept a wider fetch then post-filter), or resolve names against a
  denormalized union under Option A. Tie to U1.
- **U7 — the C-28 full role decision (a genuine GATE, not just a note).** FIX_PLAN `:792` and
  `functions/index.js:1939-1941` make the full role mechanism (custom claim vs doc-field-forever) a
  precondition of P10, because the §3 union grants powerful authority keyed on `isTeacher()`. P6's M8 stops
  self-promotion at the rules layer but the callable reads the doc `role`. **Decision owed by David** before
  the P10 rules narrowing; M8 is compatible with both futures (inv_I6 §251).
- **U8 — token-policy matrix (C-18) must NOT wait for P10.** The code truth is
  `tokens = max(0, 5 − activeRejections)`, 30-day window, accepts/pending FREE (`db.js:179-185` per
  CONSOLIDATED V-1.4; server re-check `availableChallengeTokens` at `functions/index.js:664`). This is a
  **ZERO-CODE** guidance/copy fix for David (FIX_PLAN §7.7) — flagged here only to record that it should ship
  independently of P10, not gated behind it.

---

## §7 · Explicitly OUT of scope

- **Grader calibration (C-17 / I-4).** FIX_PLAN §6.3 / `:820`. P10 makes a grader **miss** recoverable
  (override → valid anchor → day advances); it does **not** touch the AI/deterministic grader's accuracy.
  (No `inv_I4` exists — I-4 was never run; nothing to build on and nothing to change here.)
- **P7 retirement (legacy `class_progress` deletion).** A separate phase. P10 writes the canonical record
  (`durableProgressRef`, P5) and the `advanceForChallenge` comments already anticipate P7 making the legacy
  direct write a no-op (`db.js:2864-2867`, `functions/foundation.js:1746-1747`). P10 neither deletes nor
  depends on P7.

---

## §8 · Contradictions / drift vs. the FIX_PLAN's assumptions (flag for the reviewer)

1. **FIX_PLAN P10(b) is partly already-done (line-number drift + scope overlap).** FIX_PLAN `:806-809`
   describes "`reviewChallenge` → server … fixing BOTH I-6 §3-row-8 defects … the challenge-accept twi writer
   is UNCLAMPED (`db.js:2827-2833`) and must gate twi derivation to `phase==='new'`." In the **current tree**
   the twi clamp **and** the `phase==='new'` gate are **already implemented** in `advanceForChallenge`
   (`functions/foundation.js:1780-1792`, P4/F5-HIGH-2), and client `reviewChallenge` already routes the
   day-advance there under `SERVER_CHALLENGE_WRITE` (`db.js:2856-2870`). P10(b)'s *remaining* work is the
   **rest** of `reviewChallenge` (answer-flip/score/study_state legs) + the **authz union** — not the
   clamp/phase-gate. The plan re-scopes accordingly (§0, §1b). Not a defect in the FIX_PLAN — it was written
   pre-P4-stack — but implementers must not re-do the clamp/gate.
2. **The cited line anchors are pre-stack.** FIX_PLAN's `db.js:2791-2836`, `:1924-1928`, `:1913-1921`,
   `:1194-1204` and `firestore.rules:39-48`, `:101-118` all shifted under P3–P9. Current equivalents:
   challenge day-advance `db.js:2845-2939`; gradebook base predicate `db.js:1974-1979`; name-filter
   hard-empty `db.js:1963-1972`; stamp `db.js:1236-1244`/`:1396-1404`; rules teacher-breadth (already
   narrowed by P6, with P10 TODOs) `firestore.rules:102-114`; attempts rules `firestore.rules:167-198`.
3. **C-19 read surface: the C-33 "second predicate leg" the FIX_PLAN gestures at already exists — but it is
   the wrong direction.** FIX_PLAN `:810-812` says the gradebook "needs a second predicate leg for inherited
   attempts." The tree already has a second `studentId` leg (`db.js:1988-2002`) — but that is C-33's
   **narrowing** filter (I-8), which cannot widen past the `teacherId==` base. P10's inherited-attempts leg is
   a **widening** leg and is still entirely absent. The two must not be conflated (they share the DNF budget —
   U1).
4. **The rules the FIX_PLAN says P10 "must change" are already half-changed by P6, WITH P10 TODOs.** P6
   pre-narrowed the users-subcollection block and left the teacher branch alive *specifically* for
   `reviewChallenge`'s study_states write, with in-file comments naming the exact P10 edits
   (`firestore.rules:105-108`, `:168-169`, `:186-188`). P10's rules work is smaller and better-specified than
   the FIX_PLAN's prose implies — it is "execute the named TODOs," not "design the narrowing."

---

## §9 · Acceptance & test personas (from FIX_PLAN `:822-828`, to seed the eventual harness)

- **Permafail persona:** grader false-negative → teacher override → valid anchor written
  (`newWordEndIndex` set) → reconciliation `twi = newWordEndIndex + 1` → day advances; `anchor_rejected` /
  `csd_anchor_invalid` stays ≈0.
- **Orphaned-challenge / promoted-student persona:** S promoted A→B, A-stamped pending challenge → visible in
  B's teacher gradebook (item 5) → B's teacher accepts via the server callable (§3 leg ii) → progress lands
  on S's **current** (B) canonical record (§4).
- **`teacherId:null` orphan:** override path writes a fresh valid anchor with no dependence on the stamp.
- **Authz negative:** an unrelated teacher (neither stamp nor current-enrollment owner) → `permission-denied`
  from all three callables.
- **Flag-off byte-equivalence:** reconstructed-baseline diff + eslint parity (the P9-notes method) across
  every touched file; every cycling/override branch gated false ⇒ today's exact behavior, no added read.

**Deploy gate:** full I-5 checklist (functions + rules legs).
**Dissolves (FIX_PLAN `:831-832`):** CR-3 (C-15/#14 composite), C-16 (override), C-19 (permission gap, all
three predicates), C-18 (policy + comms), I-10 §7's breadth hazard.

---

## §10 · Files P10 will touch (for the change log, once implemented)

`functions/foundation.js` (override + reviewChallenge callables + shared authz/tx helpers; upgrade
advanceForChallenge authz) · `functions/index.js` (re-export the 2 callables beside `:2061`) ·
`src/config/featureFlags.js` (`SERVER_OVERRIDE`) · `src/services/db.js` (route client reviewChallenge; the
read-surface widening + name-filter; + `teacherIds` stamp if Option A) · `src/pages/Gradebook.jsx` (override
entrypoint) · `firestore.rules` (attempts read-widening; then teacher-update + users-subcollection narrowing)
· `firestore.indexes.json` (+2 composite indexes if Option A). Per CLAUDE.md: log to `change_action_log.md`
(code) — no SUPPORT_RUNBOOK entry (no data intervention; the override callable *replaces* the manual-pass CS
script for in-product use, but building it is a code change, not a CS event).
