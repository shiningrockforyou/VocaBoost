# DEEPFIX Task 3 — P10 (OVR) implementation notes — part (c): the C-19 read-surface widening

> **Status:** LOCAL-ONLY dormant draft (2026-07-14). No git commit / branch / deploy / live-Firebase
> **writes**. Implements ONLY P10 **part (c)** — the read-surface widening (C-19: a promoted student's
> old-teacher-stamped attempts must show in the new teacher's gradebook), per **David decision U1 = Option A**
> (`teacherIds`-array denormalization + reindex + a `--dry` backfill migration). Built on the converged
> **P3–P10(a/b)** foundation (this working tree already carries the (a)+(b) callables). Part **(d)** (role
> model / `firestore.rules` role+attempt narrowing / custom-claim) is **intentionally NOT touched** — the next,
> separate draft. Follows `P10_IMPL_PLAN.md` §1(c) / U1 and `FIX_PLAN.md` P10 read-surface leg.
>
> **Two paired dormant flags (both default false, flip TOGETHER at David's P10c cutover):**
> `TEACHER_IDS_READ` (client — `src/config/featureFlags.js:165`) gates the widened gradebook READ query +
> the ex-roster name filter + the CLIENT attempt-write stamp; `TEACHER_IDS_WRITE_ENABLED` (server —
> `functions/foundation.js:108`, in `FOUNDATION_FLAGS` `:123`) gates the SERVER attempt-write stamp. Server
> code cannot read a client flag, so the write-stamping is split across the two by runtime — the strict
> dormancy holds on both sides (see §3).
>
> **Round 1 (2026-07-14) — Codex P10c-1 (BLOCKER) RESOLVED.** Codex cleared the list-scoped membership set
> (agrees it's the right default), the disjunction budget, write-stamp coverage, the ex-roster fix, and the
> migration. The sole blocker: the widened `array-contains teacherIds` gradebook query is NOT readable under
> today's attempts read rule (`firestore.rules:170-173` = `studentId==uid || teacherId==uid`) — the I-10 §4
> query-vs-rules same-release problem; my "leave `firestore.rules` for part (d)" scoping was wrong for THIS.
> **Fix (this round):** add ONLY the additive attempts READ-rule clause to `firestore.rules` in part (c) —
> `('teacherIds' in resource.data && request.auth.uid in resource.data.teacherIds)` (existence-guarded, grants
> EXACTLY `uid ∈ teacherIds`), plus a P10c note in the rules file header, plus the corrected deploy-order
> invariant (§6). NO narrowing was added — the `isTeacher()→isOwner` teacher-breadth narrowing, the attempts
> teacher-UPDATE narrowing, `study_states`, and the custom-claim role work all remain part (d). See row c14 (§1),
> the §3 byte-equivalence bullet, and the §6 corrected sequence.

---

## §1 · What changed (real working-tree anchors, post-apply)

### Flags + shared helper

| # | Change | File:line |
|---|---|---|
| c1 | **Client flag `TEACHER_IDS_READ = false`** (dormant-draft comment; gates read query + name-filter + client write-stamp) | `src/config/featureFlags.js:165` |
| c2 | **Server flag `TEACHER_IDS_WRITE_ENABLED = false`** (dormant; added to `FOUNDATION_FLAGS`) | `functions/foundation.js:108`, object entry `:123` |
| c3 | **`computeTeacherIdsForAttempt({studentId,listId,stampTeacherId})`** — the server membership-set helper. **Returns `null` immediately (ZERO reads) when the flag is off** (strict dormancy); else `{stamp} ∪ {owner of each currently-enrolled class that assigns listId}`, sorted unique, best-effort (never throws). Exported. | `functions/foundation.js:1875`, export `:2366` |
| c4 | **`computeTeacherIdsClient(...)`** — the CLIENT twin (modular SDK), same definition, best-effort. Only called under `TEACHER_IDS_READ`. | `src/services/db.js:1198` |

### Write-stamp sites (the additive `teacherIds` field; all flag-gated)

| # | Change | File:line |
|---|---|---|
| c5 | **`writeAttemptTxn`** (the single server attempt writer — MCQ `submitVocabAttempt` + typed-retry): compute `teacherIds` PRE-transaction (denormalized, not a tx read), spread `...(teacherIds ? {teacherIds} : {})` into `attemptData`. | `functions/index.js:426` (compute), `:456` (field) |
| c6 | **`writeUpgradedReviewMarker`** (the review "automarker" attempt — the `completeSession`/`markReviewComplete` leg): compute + spread into the new-marker `.set(...)`. | `functions/foundation.js:797` (compute), field just below |
| c7 | **`overrideAttempt`** (the fresh valid-anchor `new` attempt): compute + spread into the `anchor` object. | `functions/foundation.js:2300` |
| c8 | **`reviewChallenge`** (UPDATE path): additively RE-STAMP via `arrayUnion(...computed)` on the answer-flip update, so a teacher who acted on an INHERITED attempt persists in the read surface even pre-backfill. | `functions/foundation.js:2120` |
| c9 | **Client `submitTestAttempt`** (MCQ) + **`submitTypedTestAttempt`** (typed): `if (TEACHER_IDS_READ) attemptData.teacherIds = await computeTeacherIdsClient(...)`. | `src/services/db.js:1324`, `:1483` |

### Read surface (the C-19 fix) + index + migration

| # | Change | File:line |
|---|---|---|
| c10 | **Gradebook query WIDENING** in `queryTeacherAttempts`: base predicate becomes `TEACHER_IDS_READ ? where('teacherIds','array-contains',uid) : where('teacherId','==',uid)`. The C-33 `studentId` push + class filter + date range + pagination below are UNCHANGED and still compose (the ≤30 DNF budget is unchanged — §2). | `src/services/db.js:2077` region |
| c11 | **Ex-roster name-filter fix** in `getTeacherData`: under the flag, augment the student name maps with a UNION roster (current members ∪ studentIds appearing on the teacher's `teacherIds array-contains` attempts, bounded by `EX_ROSTER_SCAN_LIMIT=2000`, cached). Ex-roster names now resolve ⇒ no hard-empty return. The pre-query hard-empty guard + the C-33 push are then reused UNCHANGED. | `src/services/db.js:1878` (const), `:1937` (augment) |
| c12 | **New composite indexes** — the `teacherIds`-CONTAINS family mirroring the whole `teacherId`/C-33 family (so every flag-on filter combo has an index): `{teacherIds,submittedAt}`, `{teacherIds,classId,submittedAt}`, `{teacherIds,studentId,submittedAt}`, `{teacherIds,classId,studentId,submittedAt}`. | `firestore.indexes.json:877,891,909,927` |
| c13 | **`--dry` backfill migration** `scripts/cs/deepfix-migrate-attempts-teacherids.mjs` (P5-style: `--dry` default + write-guard, `--commit --confirm-teacherids=<cohort>` guard, per-batch backups, count-verify read-back, idempotent via `teacherIdsBackfilledAt` + set-union). Scope = cohort `classNameRegex` (default 26SM). | new file |
| **c14** | **[Codex P10c-1] Attempts READ-rule WIDENING** — ONE additive OR clause on the `match /attempts` read rule so a teacher in `teacherIds` can read: `('teacherIds' in resource.data && request.auth.uid in resource.data.teacherIds)`. Existence-guarded (short-circuit — legacy attempts without the field never error, house idiom cf. the role guard `~:72`); grants EXACTLY `uid ∈ teacherIds`. Plus a `Note (P10c)` in the rules file header. **NO narrowing.** | `firestore.rules:170-194` (read rule), header note `:26-32` |

**Deliberately NOT touched (part (d) / out of scope):** `firestore.rules` NARROWING — the `isTeacher()→isOwner`
teacher-breadth narrowing, the attempts teacher-UPDATE branch narrowing, the `study_states` teacher-write rule,
and the custom-claim role work (part (d) is a separate draft). Also out: the Gradebook override BUTTON, the
`joinClass`/promotion append path (see U-promotion), grader calibration. *(Part (c) adds ONLY the additive
attempts READ clause to `firestore.rules` — c14.)*

---

## §2 · The ≤30 disjunction-budget interaction with C-33 (the STOP condition — analysed, NOT exceeded)

The task said: *if the array-contains + studentId combo exceeds the ≤30 budget, STOP and report.* It does **not**.

- Firestore expands a compound query to disjunctive normal form (DNF) and requires **≤30 disjunctive terms**.
  `in`/`array-contains-any` with *k* values contribute *k* terms; an **equality and a single `array-contains`
  contribute a factor of 1** (they match one value, they don't fan out).
- Today's gradebook, at its widest, is `teacherId == u  AND  classId in [m]  AND  studentId in [k]` ⇒ DNF product
  `1·m·k = m·k`. The already-shipped C-33 guard enforces exactly this: `classDisjuncts * filterStudentIds.length <= 30`
  (`db.js` C-33 region, unchanged by this draft).
- Part (c) replaces the base `teacherId == u` (factor 1) with `teacherIds array-contains u` (**also factor 1**).
  The product is therefore **identical**: `1·m·k = m·k`, still bounded by the same C-33 guard. **The budget does
  not move.** No guard change was needed and none was made.
- Legality: at most **one** `array-contains` per query, and `array-contains` (singular) **may** combine with `in`
  clauses (the restriction is on `array-contains-any`, not `array-contains`). The project already runs two `in`
  clauses together (C-33), confirming multi-`in` is enabled on this Firestore.
- **Residual (dormant) risk flagged for Codex/cutover:** this is a static argument; the flag-on query is not
  executed against live Firestore in this draft. Validate the exact `array-contains + in + in + range` shape (and
  the new indexes) in the emulator / at cutover before flipping `TEACHER_IDS_READ` — same "indexes first, loud
  failure" discipline as C-33.

---

## §3 · Flag-off byte-equivalence argument (per file)

**`src/config/featureFlags.js`** — one new `export const TEACHER_IDS_READ = false` + comment. No existing symbol
touched. Importers see a new false constant.

**`functions/foundation.js`** —
- New `const TEACHER_IDS_WRITE_ENABLED = false` + a `FOUNDATION_FLAGS` entry (provenance only) + the new
  `computeTeacherIdsForAttempt` (returns `null` on its FIRST statement when the flag is off → **zero reads**).
- The three write sites (c6/c7/c8) each call the helper and spread the result: `null ⇒ {}` spread ⇒ the written
  object is byte-identical to today; `arrayUnion` (c8) is only added when the computed array is non-empty (never
  reached when the flag is off, since the helper returns `null`). No other bytes changed.

**`functions/index.js`** — `writeAttemptTxn` computes `teacherIds` pre-tx via `foundation.computeTeacherIdsForAttempt`
(returns `null`, zero reads, when off) and spreads `...(teacherIds ? {teacherIds} : {})` into `attemptData` — the
doc is byte-identical to today when off. No new `require`/`exports` token (eslint delta 0 — §4).

**`src/services/db.js`** —
- New import symbol, new `computeTeacherIdsClient`, new `EX_ROSTER_SCAN_LIMIT` const — all inert unless a
  `TEACHER_IDS_READ` branch runs.
- The two client write-stamps (c9) are `if (TEACHER_IDS_READ) …` — no field set when off.
- The gradebook query (c10) is a ternary whose **off-branch is the verbatim** `where('teacherId','==',teacherId)`.
- The name-filter augmentation (c11) is a whole `if (TEACHER_IDS_READ) { … }` block — **no extra read** and the
  name maps are byte-identical when off; the downstream hard-empty guard + C-33 push are unmodified.

**`firestore.indexes.json`** — four additive index objects appended; adding indexes never affects existing query
behavior (they simply build). The `teacherId` family is untouched.

**`firestore.rules`** — ONE additive OR clause on the attempts read rule (c14) + a header note. It is a pure read
WIDENING and **inert until backfill**: pre-backfill NO attempt carries `teacherIds`, so the existence guard
`'teacherIds' in resource.data` is false and the `&&` short-circuits ⇒ the clause matches nothing ⇒ read behavior
is byte-equivalent to today. It is therefore safe to deploy at any time; its deploy-order invariant (before/with
the `TEACHER_IDS_READ` flip) is about not shipping a *widened query* without the widened rule, not about safety of
the rule itself. No narrowing, no existing clause changed.

Mechanically verified: **eslint delta 0** (§4, JS unchanged this round) and the reconstructed-baseline diff
round-trips exactly (§4).

---

## §4 · Validation results

- **Parser:** `node --check` PASS on `functions/foundation.js`, `functions/index.js`, the migration `.mjs`;
  `node --input-type=module --check` PASS on `src/services/db.js` and `src/config/featureFlags.js`.
  `firestore.indexes.json` parses as JSON (42 indexes total, 4 new `teacherIds` CONTAINS).
- **ESLint delta vs the reconstructed pre-(c) baseline = 0.** Before/after both = 42 errors / 0 warnings,
  identical per-file per-rule (`db.js` 7 `no-unused-vars`, `foundation.js` 4 `no-undef`, `index.js` 30
  `no-undef` + 1 `no-useless-escape`, `featureFlags.js` 0 — all pre-existing; the functions files are linted by
  the root flat config, which reports CommonJS `require`/`module`/`exports`/`Buffer` as `no-undef`). No new
  finding introduced: no new unused var, no new `require`/`exports` token.
- **`firestore.rules` (c14) — reviewed, not executed (emulator = Task 6).** Brace/paren balance verified
  (51/51, 191/191). The clause is existence-guarded with `&&` short-circuit (the house idiom at `~:72` uses the
  same `'x' in <map>` form), so a legacy attempt without `teacherIds` cannot error. It grants EXACTLY `uid ∈
  teacherIds` (the `in` list-membership operator against the guarded array) — no broader access. Inert
  pre-backfill. Re-review the guarded syntax + membership semantics in the emulator before the cutover deploy.
- **`--dry` migration (write-free, live-read, 26SM):**
  ```
  P10c teacherIds backfill [DRY] cohort=/26SM/i v=P10c-TEACHERIDS-v1
  classes=200 | cohort classes=32
  in-scope attempts: 400 (scanned 400; no-listId 0)
  actions: {"WRITE_MERGE":400}   willWrite=400 skipDone=0
  sample: 0jjLJCJq st=0jjLJCJq L=AObYOowh [WRITE_MERGE] before=[] -> merged=[9OcxdnYC] (+9OcxdnYC)
  [DRY] NO Firestore writes were made (write guard active). would-write=400.
  ```
  Zero writes (write guard active). Each existing attempt has no `teacherIds` yet (`before=[]`) and would gain the
  computed current-owner set. The write-guard also REFUSES `--commit` without `--confirm-teacherids=26SM`
  (verified — zero writes). Full plan artifact → `dsg-edits/srv_validate/` (gitignored, local-only).
  *Note:* the 400-row slice (drawn from the first cohort classes) showed no `merged>1` (multi-teacher / promoted)
  rows; those C-19 signatures live deeper in the cohort — a full-cohort `--dry` (no `--limit`) enumerates them.
- **Diff:** `audit/deepfix/task3/phase10c_diff.patch` — `git apply --check` clean onto the pre-(c) tree,
  applied ⇒ **round-trip EXACT** vs the post-(c) tree, and `git apply -R --check` clean. Includes the new
  migration file (`new file mode 100644`).

---

## §5 · Uncertainties (numbered) for Codex

1. **U1 — the `teacherIds` membership-set definition (LIST-SCOPED vs the broad authz union).** The helper (all
   three copies) computes `{stamp} ∪ {owner of each currently-enrolled class that ASSIGNS the attempt's listId}`
   — **list-scoped**. This is *tighter* than `assertOverrideAuthz` leg (ii), which authorizes an owner of **any**
   enrolled class (list-agnostic — the I-10 §7 breadth). I chose list-scoped because (a) it matches the task's
   "current-enrollment owners … *for that class/list*", (b) it is the more defensible read surface ("a teacher
   sees a student's attempts on lists that teacher assigns"), and (c) it dissolves the canonical C-19 case (a
   promoted student *continuing the same list* in the new class). **Consequence:** a teacher authorized by the
   broad union (owns an enrolled class that does NOT assign the list) can ACT via the override path but will NOT
   SEE the attempt in the gradebook. If Codex/David want read==authz exactly, drop the `assignsList` filter in all
   three copies + the migration. **Adjudicate — this is the load-bearing definition.**
2. **U2 — disjunction budget (see §2).** Confirm the DNF reasoning (array-contains = factor 1; the C-33 product
   guard is sufficient and unchanged) and that `array-contains + in + in + range` is a legal shape on this
   Firestore. Static-only in this draft; validate in the emulator before cutover.
3. **U3 — does write-stamping belong on ALL these paths?** `overrideAttempt` (fresh anchor = a NEW attempt) and
   the create paths (`writeAttemptTxn`, `writeUpgradedReviewMarker`, client submits) are clearly CREATE-stamp
   sites. `reviewChallenge` is an **UPDATE** — I additively RE-STAMP it (arrayUnion of the recomputed set) so an
   acting teacher persists. Alternatives: (a) don't touch `reviewChallenge` (rely on create-stamp + migration
   only), or (b) add only `callerId` (from the authz result) rather than the full recompute. I picked the full
   recompute for consistency with the single definition. **Confirm the re-stamp is wanted and full-recompute is
   the right form (U-restamp).**
4. **U4 — the ex-roster name-filter fix + its chicken/egg (U6 in the plan).** The union roster needs the
   inherited-attempt student set, which is only known after a query. I resolve it with a **bounded, cached
   pre-scan** (`teacherIds array-contains` attempts, `limit 2000`) inside `getTeacherData`, then reuse the
   existing name resolution + hard-empty guard verbatim. Open questions: (a) is a full teacher-attempts pre-scan
   an acceptable cost (it is cached 5 min, and only runs flag-on), or should this instead be a server callable /
   a denormalized roster; (b) is 2000 the right cap; (c) a teacher with >2000 attempts could miss a
   deep-ranked ex-roster student's name (documented degradation, mirrors the C-33 "large match keeps degraded
   mode" stance).
5. **U5 — migration conflict / idempotency rules.** The backfill writes `teacherIds = UNION(existing, computed)`
   + `teacherIdsBackfilledAt` (+ `teacherIdsBackfillVersion`). It is re-runnable (union never demotes; a
   flag-on live write-stamp or a prior run only ADDS), and SKIPs a doc iff it is stamped AND its existing set is
   already a superset of the freshly computed set. **Confirm:** (a) union-never-demote is the right conflict
   rule vs the live write-stamp (I believe yes — both only add); (b) the cohort scope is by the attempt's
   `classId` being a cohort class (an inherited attempt stamped to a NON-cohort old class, of a now-cohort
   student, is out of scope under the default regex — run `--all` for a full reindex; documented limitation);
   (c) listId resolution for legacy attempts uses the gradebook's testId parse (`vocaboost_test_…` and legacy
   `test_/typed_`) — parity acceptable?
6. **U-promotion — nothing RE-STAMPS on promotion (`joinClass`/`removeStudentFromClass`).** The plan's Option A
   also names a promotion-time append; the task scoped write-stamping to the attempt-write paths + the migration,
   so I did **not** modify `joinClass`. Going-forward promotions therefore rely on: the `reviewChallenge`
   re-stamp when B acts, and periodic idempotent `--dry`→`--commit` re-runs of the backfill. **Recommend** a
   follow-up `joinClass` append (append the new owner to the student's attempts' `teacherIds` on promotion) so
   inherited attempts become visible without waiting for the migration or an act — flagged, not built.
7. **U-index-set — I added the FULL 4-index `teacherIds` family**, not just the single `teacherIds+studentId+
   submittedAt` the task named, so every flag-on filter combination (none / class / student / class+student, each
   with the optional date range) has a covering index and won't throw a query-error. Indexes are additive/zero-
   risk. Confirm the extra three are wanted (or trim to the minimum the query actually issues).
8. **U-manual-pass-parity (carried from a/b).** `overrideAttempt`'s anchor uses the manual-pass `92` default
   threshold, not the app's `95` — pre-existing (a/b) carry, unchanged here; noted so the teacherIds stamp isn't
   confused with it.

---

## §6 · Deploy order (David's cutover, for the checklist — NOT run here) — CORRECTED per P10c-1

**Deploy-order INVARIANT (P10c-1):** the attempts read-rule widening (c14) is additive/safe-anytime, but
`TEACHER_IDS_READ` must NOT be flippable in any shipped build until the widened rule is DEPLOYED — a widened
`array-contains` query against the un-widened rule hits the backstop (I-10 §4 query-vs-rules same-release).

1. `--only firestore:indexes` (the 4 `teacherIds` indexes) — additive, build-first, loud-not-silent (C-33
   precedent).
2. `--only firestore:rules` — the additive attempts READ clause (c14). Safe anytime (inert until backfill); do it
   here so the rule is live BEFORE the query flag flips. **NOTHING narrowing rides along** (part (d) is its own
   later, LAST rules deploy).
3. Run the backfill `--dry` (review) → 25WT rehearsal → `--commit --confirm-teacherids=26SM` (OFF-PEAK) —
   SUPPORT_RUNBOOK CS entry + change_action_log row.
4. Flip `TEACHER_IDS_READ` (client) + `TEACHER_IDS_WRITE_ENABLED` (server) TOGETHER, rebuild + `--only functions`
   / `--only hosting`. Now new attempts self-stamp and the gradebook widens against the already-widened rule (no
   backstop hit). Soak.
5. Part (d) — the `firestore.rules` NARROWING (`isTeacher()→isOwner` teacher-breadth, attempts teacher-UPDATE,
   `study_states`) + the custom-claim role model — is the SEPARATE, LAST next draft. NOT in this draft.

## §7 · Files touched (for `change_action_log.md` — the orchestrator logs it, NOT me; I did NOT modify it)

`src/config/featureFlags.js` · `functions/foundation.js` · `functions/index.js` · `src/services/db.js` ·
`firestore.indexes.json` · `firestore.rules` (ONLY the additive attempts READ clause c14 — NO narrowing) ·
**new** `scripts/cs/deepfix-migrate-attempts-teacherids.mjs` · **new (docs)** `audit/deepfix/task3/P10c_impl_notes.md`,
`audit/deepfix/task3/phase10c_diff.patch`.
`firestore.rules` NARROWING (teacher-breadth / attempts-UPDATE / study_states / custom-claim) was **NOT** touched
(part (d), separate draft).
