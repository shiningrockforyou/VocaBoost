# DEEPFIX Task 3 — P10 (OVR) implementation notes — parts (a)+(b) only

> **Status:** LOCAL-ONLY dormant draft (2026-07-14). No git commit / branch / deploy / live-Firebase.
> Implements ONLY the decision-independent core of P10: **(a) the override callable** and **(b) the
> `reviewChallenge` → server migration**. Parts **(c) read-surface widening** and **(d) rules narrowing** are
> **intentionally deferred** (held pending owner decisions — see §6). Built on the converged P3–P9 foundation.
> Follows `P10_IMPL_PLAN.md` change inventory §1(a)+(b), flag design §2, authz model §3.
>
> **Round 2 (2026-07-14) — Codex P10-1 (BLOCKER) RESOLVED.** Codex round 1 cleared the
> `runChallengeDayAdvanceTxn` extraction, flag-off byte-equivalence, the `reviewChallenge` port, and
> `reviewChallenge`'s authz; the sole blocker was that `overrideAttempt` authorized one subject but wrote
> another. **Fix (scoped to `overrideAttempt` only):** the authorization is now TARGET-BOUND to the exact write
> subject via two paths — see §2 decisions 5–6, §1(a) rows a6–a7, and the U2/U4 resolutions in §6. Nothing else
> changed; flag-off byte-equivalence preserved (`overrideAttempt` still `failed-precondition`-throws as its first
> statement when off).

---

## §1 · What changed (real working-tree anchors, post-apply)

### (a) Override callable — the in-product `manual-pass.mjs`

| # | Change | File:line |
|---|---|---|
| a1 | **Server flag `SERVER_OVERRIDE_ENABLED = false`** (dormant-draft comment; added to `FOUNDATION_FLAGS`) | `functions/foundation.js:98`, object entry `:112` |
| a2 | **`overrideAttempt` callable** — writes the FULL valid anchor (manual-pass parity) for the **target-bound** subject, advances the day via the shared tx, audit-logs `teacher_override` (actor/target/before/after). `failed-precondition` throw when the flag is off (like `advanceForChallenge`). | `functions/foundation.js:2133` |
| a3 | **Re-export** so it deploys as a function | `functions/index.js:2068` |
| a4 | **Client wiring + dormant caller** `overrideAttempt(...)` — calls the callable; refuses when `SERVER_OVERRIDE` is off. (Gradebook button DEFERRED to (c) — see §6.) | `src/services/db.js:2980` |
| a5 | **Client flag `SERVER_OVERRIDE = false`** (client gate for a4 + b4) | `src/config/featureFlags.js:135` |
| **a6** | **[Codex P10-1] Target-bound authz split in `overrideAttempt`.** `attemptId` path: write target (`studentId/classId/listId/studyDay`) is **derived FROM the loaded attempt**, request target fields must not conflict (else `invalid-argument`/`not-found`), then `assertOverrideAuthz(callerId, priorAttempt)` (the reviewChallenge union, target-bound). No-`attemptId` path: **strict** target authz (row a7). Anchor + day-advance + audit-log all use the target-bound `t*` vars. | `functions/foundation.js:2143-2199` |
| **a7** | **New `assertOverrideTargetAuthz(callerId, {studentId, classId, listId})`** — the STRICT check for the orphan path: caller is a teacher AND owns the EXACT `classId` AND the student is enrolled in THAT `classId` AND the class assigns THAT `listId`. **Not** the "owns any enrolled class" union leg (the P10-1 hole). Returns `classData`. | `functions/foundation.js:1808` |

### (b) `reviewChallenge` → server (FINISH the P4-begun migration)

| # | Change | File:line |
|---|---|---|
| b1 | **Server flag `SERVER_REVIEW_CHALLENGE_ENABLED = false`** (dormant-draft comment; added to `FOUNDATION_FLAGS`) | `functions/foundation.js:93`, object entry `:111` |
| b2 | **`reviewChallenge` callable** — the FULL server port of the client body (`db.js` `reviewChallenge`): answer-flip, score/passed recompute (persisted-`totalQuestions` denominator + review-vs-new `newPassed`), `challenges.history` update, `study_states` PASSED write, day-advance via the shared helper. Authz = the I-10 §6 union. `failed-precondition` throw when off. | `functions/foundation.js:1949` |
| b3 | **Re-export** | `functions/index.js:2067` |
| b4 | **Client `reviewChallenge` routes to the callable** under `SERVER_OVERRIDE` — flag-off keeps today's client body verbatim (incl. its own `SERVER_CHALLENGE_WRITE` day-advance sub-branch). | `src/services/db.js:2741` (import `:25`) |

### Shared primitives (the "reuse, don't re-implement" spine — plan §0/§1b/§3)

| # | Change | File:line |
|---|---|---|
| s1 | **`runChallengeDayAdvanceTxn(...)`** — the clamped + phase-gated day-advance **transaction, extracted VERBATIM** from `advanceForChallenge`'s inlined tx (P4/F5-HIGH-2). All THREE callers (advanceForChallenge, reviewChallenge, overrideAttempt) run this one primitive, so the twi clamp (I-6 §3-row-8) + the `phase==='new'` gate live in exactly one place and are **NOT re-implemented**. | `functions/foundation.js:1681` |
| s2 | **`assertOverrideAuthz(callerId, attempt)`** — the I-10 §6 UNION, server-side: teacher AND (stamp `attempt.teacherId===caller` OR current-enrollment owner via the `renameStudent` pattern). Used by both new callables; unrelated teacher → `permission-denied`. | `functions/foundation.js:1765` |
| s3 | **`advanceForChallenge` refactored** to call `runChallengeDayAdvanceTxn` (its inline tx removed; behaviour byte-identical). | `functions/foundation.js:1899` |

---

## §2 · Design decisions

1. **Reuse via extraction, not duplication (s1/s3).** The task/plan are explicit: the twi-clamp + `phase==='new'`
   gate are **already done** in `advanceForChallenge` — do NOT rebuild them. I extracted them **verbatim** into
   `runChallengeDayAdvanceTxn` and had all three callers use it. `advanceForChallenge`'s tx body was **moved, not
   rewritten** (round-trip + eslint-verified), so its behaviour when its own flag flips is unchanged.
2. **`advanceForChallenge`'s own authz LEFT as-is (P3 stamp-only).** The task's IMPLEMENT list scopes the union to
   the two NEW callables. `advanceForChallenge`'s union-upgrade (plan §3, "the upgraded advanceForChallenge") is a
   change to a P4-shipped callable's semantics; I deferred it to keep (a)/(b) focused and `advanceForChallenge`
   byte-for-byte except the mechanical tx extraction. **Harmless:** once `SERVER_OVERRIDE` is on, the client routes
   the whole review to the server `reviewChallenge` (which carries the union), and never reaches the P4
   `advanceForChallenge` route — so `advanceForChallenge` is vestigial for the client review path and its authz is
   moot there. (See U7.)
3. **`reviewChallenge` server port is FAITHFUL to the client body, delegating only the day-advance.** Answer-flip /
   score / `newPassed` / history / `study_states` legs are ported line-for-line from the client. The day-advance
   sub-leg derives `phase`/`listId` **from `testId` exactly as the client does** (`db.js` `:2846-2852`) and re-fetches
   the day-advance threshold/pace from the testId-list's assignment (client `:2872-2877`) — this can differ from the
   score-recompute list when `attempt.listId !== testId listId`; preserved deliberately for parity. The clamp +
   phase gate come from the shared helper.
4. **Two hops preserved, server-side (U3).** I did NOT fold the day-advance into one atomic transaction. The port
   keeps today's structure (answer/score/history/study_state writes, THEN the day-advance tx), so the failure
   semantics match today (an answer-flip can commit even if the day-advance no-ops). A single atomic tx is a larger
   change with its own risk — flagged, not taken. See U3.
5. **Override = fresh valid anchor (manual-pass model), TARGET-BOUND [Codex P10-1 · resolves U2/U4].**
   `overrideAttempt` writes a fresh valid-anchor `new` attempt at the deterministic manual-pass docId (idempotent
   `merge`) with the **full field set verbatim from `scripts/cs/manual-pass.mjs`** (nwsi/nwei/wordsIntroduced/testId/
   sessionType/testType/passed/graded/…); pace derived as the script does (day-1 passed-new attempt → `nwei+1`, else
   80). **The write subject is now bound to what was authorized** (fixing the P10-1 hole where authz and write were
   decoupled), via TWO paths:
   - **`attemptId` supplied** → the write target (`studentId/classId/listId/studyDay`) is **derived FROM the loaded
     attempt** (re-anchoring THAT attempt's day), NOT the request; only `score` is taken from the request. If the
     attempt is missing target fields, or any request target field conflicts with the loaded attempt, **hard-reject**
     (`invalid-argument`/`not-found`). Authorization is `assertOverrideAuthz(callerId, priorAttempt)` — the
     reviewChallenge union (stamp OR current-enrollment), applied to the loaded attempt, which Codex accepted as
     target-bound. (`assertOverrideAuthz` unchanged.)
   - **no `attemptId`** (the `teacherId:null`/ungradeable orphan — the override's reason to exist) → the EXACT
     supplied `{studentId, classId, listId}` is authorized by the **new strict `assertOverrideTargetAuthz`**: caller
     owns THIS class AND student enrolled in THIS class AND class assigns THIS list. The broad "owns ANY enrolled
     class" leg is **deliberately not reused** here (that breadth was the P10-1 hole). Only then is the anchor built
     + written for that validated target.
   The anchor, day-advance, and audit-log all consume the target-bound `t*` vars, so the authorized subject === the
   written subject on both paths.
6. **Override day-advance is BEST-EFFORT.** After the anchor write, the day-advance uses the same shared helper; its
   current-boundary guard may no-op, but the anchor still reconciles at next entry (`twi = newWordEndIndex + 1`) —
   the manual-pass behaviour. So the override never DEPENDS on the day-advance succeeding (correct for the
   `teacherId:null`/ungradeable case, which is the override's reason to exist).
7. **Client override entrypoint = wiring + dormant caller; the Gradebook BUTTON is deferred to (c).** `db.js`
   `overrideAttempt(...)` wires the callable and refuses when `SERVER_OVERRIDE` is off. The rendered teacher UI
   (the button supplying student/class/list/day/score for an orphaned attempt) is deferred to the (c) read-surface
   release, because an orphaned/inherited attempt is **not yet VISIBLE** in the gradebook until (c)'s widening leg
   lands — there is no row to attach the action to yet. This keeps the client change purely additive + dormant.
8. **Audit logging.** `overrideAttempt` → `logSystemEventServer('teacher_override', {actor, target, classId,
   listId, studyDay, before, after, advance})`. `reviewChallenge` → `logSystemEventServer('challenge_reviewed',
   {…, authzVia, advance})`. Both use the existing server logger (never throws).

---

## §3 · Flag-off byte-equivalence argument (per file)

All new flags default **false**. Byte-equivalence verified by: reconstructed pre-P10 baseline (the current working
tree BEFORE these edits — `foundation.js` is untracked and the 3 tracked files carry the uncommitted P3–P9 stack,
so `git diff HEAD` is NOT P10-only), diff (the patch), `node --check` per file, and an **eslint delta of 0 new
findings** per file (baseline swapped in-place, linted with each file's real config).

- **`functions/foundation.js`** — All new code is either (i) a new flag const `= false` never read on a live path,
  (ii) two new callables that `throw failed-precondition` at their FIRST statement when their flag is false (touch
  nothing — the P3 dark-callable pattern; the P10-1 target-binding rework lives entirely INSIDE the dark
  `overrideAttempt`, after its first-statement throw), or (iii) the `runChallengeDayAdvanceTxn` /
  `assertOverrideAuthz` / `assertOverrideTargetAuthz` helpers, reachable ONLY from those dark callables and from
  `advanceForChallenge` (itself gated by the unchanged `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=false`). The
  `advanceForChallenge` refactor is a verbatim tx extraction: with its flag false it still throws at the top; with
  its flag true it runs the identical transaction body.
- **`functions/index.js`** — Two additive `exports.X = foundation.X` lines. They register dark callables; nothing
  invokes them. The `version` probe surfaces the two new flags automatically via `...foundation.FOUNDATION_FLAGS`
  (no probe edit). No existing export changed.
- **`src/config/featureFlags.js`** — One additive `export const SERVER_OVERRIDE = false`. No existing flag changed.
- **`src/services/db.js`** — (1) import adds `SERVER_OVERRIDE`; (2) `reviewChallenge` gains a `if (SERVER_OVERRIDE)`
  branch at the TOP that returns early — with the flag false the existing body below runs **verbatim** (including
  its own `SERVER_CHALLENGE_WRITE` day-advance sub-branch); (3) a new `overrideAttempt` export that refuses when the
  flag is off and is invoked by nothing. Flag-off ⇒ no new read/write is issued.

**Eslint delta (real configs): 0 new findings on every file.**
- `functions/foundation.js`: base clean → post clean (0 → 0), via `functions/.eslintrc.js` (node env).
- `functions/index.js`: base 1 → post 1 (same pre-existing `no-useless-escape` at `:155`), 0 new.
- `src/config/featureFlags.js`: 0 → 0 (identical output).
- `src/services/db.js`: base 7 → post 7 (same pre-existing findings; only two `err` unused-var line numbers shift
  because lines were inserted above them), 0 new.

---

## §4 · Validation results (round 2, post-P10-1)

- **Parser:** `node --check` OK for all four files (root is `type:module`, so `.js` src files parse as ESM).
- **Eslint delta = 0 new findings** per file (§3) — re-verified after the P10-1 rework: `functions/foundation.js`
  base clean → post clean (the two new authz helpers + the target-binding split add no findings under the node-env
  `.eslintrc.js`); the other three files are byte-unchanged from round 1 (delta unchanged).
- **Patch:** `audit/deepfix/task3/phase10ab_diff.patch` — regenerated; `git apply --check` CLEAN against the
  reconstructed baseline; `git apply` round-trips **exactly** to the post-P10-1 working tree (`cmp` clean on all four
  files); all four re-parse after apply.
- **New/untracked note:** `functions/foundation.js` is **untracked** in the repo; the patch still carries its hunks
  (baseline = its pre-edit working-tree content). The other three files are tracked-but-modified by P3–P9 — the
  patch isolates ONLY the P10 hunks (it was generated baseline→current, not `git diff HEAD`).

---

## §5 · (c) and (d) are INTENTIONALLY DEFERRED (owner decisions)

Per the task, only (a)+(b) are implemented. **NOT touched:**
- **(c) Read-surface widening (C-19 visibility)** — the gradebook second predicate leg for inherited attempts, the
  name-filter union roster, and the attempts-READ rule widening (`firestore.rules`). Gated on **U1** (Option A
  `teacherIds`-denorm + reindex vs. Option B `or()`+rules-`get()` vs. Option C server-callable discovery). No
  `firestore.rules` / `firestore.indexes.json` / gradebook-query edits were made. The Gradebook override **button**
  rides here (§2.7).
- **(d) Rules narrowing (LAST)** — the attempts teacher-UPDATE branch and the users-subcollection teacher-write →
  `isOwner` narrowing. Only legal once (b) is server-side, flag-on, and soaked. No `firestore.rules` edits were made.

The actionability fix (a)+(b) needs **no** rules read-widening: the Admin SDK bypasses rules, so the union authz in
the callables is the operative unlock. Visibility (c) is a separate, additive release.

---

## §6 · Uncertainties (U1..U9) for Codex

- **U1 — read-surface widening approach (the biggest open fork; part (c), deferred).** Option A (`teacherIds`-array
  denorm + reindex), Option B (`or()` query + rules `get()`), or Option C (server-callable gradebook discovery). The
  plan recommends A. Not built here — adjudicate before (c). Interacts with the shipped C-33 studentId push sharing
  the ≤30 DNF budget under Option B.
- **U2 — override input contract — RESOLVED (Codex round 1 · P10-1).** Codex accepted fresh-anchor "only after
  P10-1 binds authorization to the exact target." Done: `overrideAttempt` still writes a FRESH valid-anchor `new`
  attempt (the manual-pass model), but the write subject is now target-bound (§2.5): with `attemptId`, target is
  derived from the loaded attempt (request fields must not conflict); without, the exact supplied target is strictly
  authorized. The alternative repair-existing-in-place semantics remain a possible future refinement, not required.
- **U3 — one atomic tx vs. two hops for `reviewChallenge` (RESOLVED here as two hops; confirm).** The port keeps
  today's two-hop shape server-side (answer/score/history/study_state writes, THEN the day-advance transaction)
  rather than one atomic tx. This preserves today's failure semantics (a committed answer-flip can coexist with a
  no-op day-advance). Folding everything into one transaction is possible but larger (all day-advance reads must move
  into the review tx's read phase). Confirm the atomicity choice.
- **U4 — override `classId` authz precision — RESOLVED (Codex round 1 · P10-1, "not optional").** The override no
  longer authorizes a caller-supplied target via the broad "owns ANY enrolled class" leg. No-`attemptId` overrides go
  through the strict `assertOverrideTargetAuthz` (own THIS class AND student enrolled in THIS class AND class assigns
  THIS list); `attemptId` overrides derive the target from the loaded attempt and reject conflicts, so the union on
  the loaded attempt is genuinely target-bound. The broad union leg survives ONLY on `reviewChallenge` (acting on the
  loaded attempt) — which Codex accepted as target-bound.
- **U5 — review-pass phase-gate twi-flat semantic delta (inherited from P4, still unadjudicated).** The shared helper
  makes a **review-pass** boundary advance csd but leave twi **flat** (`twiIncrement = phase==='new' ? clamped : 0`),
  whereas the legacy client added the pace-derived count on the review branch too. P4 flagged this "for reviewer
  adjudication"; P10 inherits it verbatim via `runChallengeDayAdvanceTxn`. Re-confirm rather than silently carry.
- **U6 — manual-pass `passThreshold` default 92 vs the app's 95.** `overrideAttempt` computes the anchor's `passed`
  with `assignment?.passThreshold ?? 92` — **verbatim from `manual-pass.mjs:53`** — whereas the app/foundation
  default is `DEFAULT_PASS_THRESHOLD = 95`. When an assignment sets an explicit threshold this is moot; it only
  differs for assignments with no `passThreshold`. Kept manual-pass parity deliberately; confirm which default the
  in-product override should use.
- **U7 — `advanceForChallenge` authz NOT upgraded to the union (scoping choice).** Plan §3 lists the union upgrade of
  `advanceForChallenge` too. Left as its P3 stamp-only check (§2.2) — harmless because the client stops calling it
  once `SERVER_OVERRIDE` routes the whole review to the server `reviewChallenge`. Confirm it can stay stamp-only, or
  add the one-line swap to `assertOverrideAuthz`. Also gated by the C-28 full role decision (custom claim vs
  doc-field) — the union grants powerful cross-student write authority keyed on `isTeacher()` reading the doc `role`.
- **U8 — `reviewChallenge` day-advance derivation source.** The port derives `phase`/`listId` from `testId` (client
  parity), while `advanceForChallenge` uses field-first (`sessionType`/`listId`) with a testId fallback. Both feed
  the same helper. Kept client parity for a faithful port; a follow-up could unify the two derivations.
- **U9 — parts (c)/(d) deferral is a scope decision, not an oversight.** Recorded explicitly (§5) so Codex does not
  read the missing rules/query/index edits as incomplete (a)/(b). The C-28 role decision (U7) and U1 gate them.

---

## §7 · Files touched (for the change log — orchestrator logs `change_action_log.md`, NOT me)

`functions/foundation.js` (2 flags, 2 callables, 2 shared helpers, advanceForChallenge tx-extraction) ·
`functions/index.js` (2 re-exports) · `src/config/featureFlags.js` (`SERVER_OVERRIDE`) ·
`src/services/db.js` (import, reviewChallenge routing, overrideAttempt wrapper). **NOT touched:** `firestore.rules`,
`firestore.indexes.json`, `src/pages/Gradebook.jsx` (parts (c)/(d) + the rendered override button — deferred).
