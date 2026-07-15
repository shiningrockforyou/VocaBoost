# P7 · FND-5 — Retirement Inventory (PREPARED, NOT APPLIED)

**Phase:** P7 (FIX_PLAN task2 `:662-690`) — *Retire legacy* (≥14 days after the P6 cutover deploys).
**Status:** PREPARED-NOT-APPLIED. The working tree is UNCHANGED (still the post-P10 dormant-draft).
The deletions live in `audit/deepfix/task3/phase7_retirement.patch`, applied by David post-deploy.
**Companion patch:** `phase7_retirement.patch` (WRITE-PATH leg — verified). Everything else in this
inventory is enumerated for a *guided* application under the M-STATIC `--target=shipped` oracle.
**Acceptance oracle:** `audit/playwright/lsr_deepfix_static.mjs --target=shipped` (RET-1..4) must
read the retired signatures at ZERO after the full retirement lands.

> **Why P7 must NOT be applied to today's tree.** Every prior phase preserved flag-OFF
> byte-equivalence by keeping BOTH paths. The transitional flags are still `false` (dormant) in the
> working tree; their flag-OFF fallbacks are the CURRENTLY-LIVE behavior. Deleting them now would
> break flag-off byte-equivalence. P7 is post-deploy cleanup that runs only after each flag has
> been flipped ON at its cutover and soaked (see §(e)).

> **Repo-state note (important for whoever applies this).** The deepfix P0–P10 work is **uncommitted
> working-tree state on top of HEAD `a967f54`** (≈300 modified/untracked paths; `git status`'s
> "clean" banner at session start was stale). Do **not** `git checkout` the touched files — it would
> revert them to the pre-deepfix HEAD blob and destroy the dormant draft. Restore from a backup copy
> instead. This is also why `phase7_retirement.patch` is a diff of *dormant-draft → retired*, not a
> diff against HEAD.

---

## 0. Scope split (what this inventory retires, and what it deliberately does NOT)

P7 (FND-5) retires the **FOUNDATION** transitional flags only — the ones whose cutover completes by
P6. The plan's flag list (`:675-679`) names exactly **7** transitional flags and no others, and
explicitly says KEEP `CONTINUATION_LINKS` (P8). P8/P9/P10 ship *after* P7 in the sequence, so their
flags are **not soaked at P7 time** and must survive.

| Leg | Items | In verified patch? | Rationale |
|---|---|---|---|
| **A. Write-path** | SERVER_REVIEW_MARKER, SERVER_CHALLENGE_WRITE, SERVER_RESET_PROGRESS + their client fallbacks | ✅ YES | Self-contained, no reconciliation reads, build/lint-verifiable |
| **B. Reconciliation-core** | LIST_SCOPED_RECON (39 sites), SERVER_PROGRESS_WRITE (23), LIST_PROGRESS_CANONICAL (12), class_progress readers | ❌ enumerated only | Collapses through the CSD/TWI engine; NO local behavioral test harness exists (only Playwright e2e needing an emulator) — hand-encoding an unverified rewrite of the reconciliation core violates the conservatism mandate |
| **C. dup_resume_branch** | `DailySessionFlow.jsx` unreachable resume copy | ❌ FLAGGED | Entangled with the live-rendered Re-Entry modal; not pure-dead (see §(a).1) |
| **D. class_progress docs** | one-time deletion script | ❌ ops step | Post-migration, post-window; §(c) |
| **E. CS toolchain (F6-3)** | 19 `scripts/cs/*.mjs` with `class_progress` | ❌ enumerated only | Rework 2 live scripts + archive 17 historical one-offs; §(c) |
| **OUT OF SCOPE at P7** | SERVER_OVERRIDE, TEACHER_IDS_READ (P10); CYCLING_ENABLED + per-assignment `cyclingEnabled` (P9); doc-role `isTeacher()` (rules/P6) | ❌ NOT retired | P9/P10 not soaked at P7; `isTeacher()` is a rules deploy, not P7's `--only hosting`+script target |

The task prompt lists SERVER_OVERRIDE/TEACHER_IDS_READ off-branches and `isTeacher()` as candidates.
**They are NOT dead at P7** and MUST NOT be deleted — see §(b) "Explicitly KEEP".

---

## (a) Dead code branches

Each row: file · greppable signature · why dead · superseded by · deploy precondition · disposition.

### A. Write-path fallbacks — IN THE VERIFIED PATCH

#### A.1 · Client empty-review automarker (SERVER_REVIEW_MARKER off-branch) — RET-2 `client_automarker`
- **File / signature:** `src/pages/DailySessionFlow.jsx` — `if (SERVER_REVIEW_MARKER) { … } else { … }`
  in `handleNoReviewModalClose`; the else-branch `setDoc(doc(db, 'attempts', markerId), …)` carrying
  `manualReviewNote: 'Auto-completed: no review available — all segment words mastered (21-day rest).'`
- **Why dead:** the else-branch is a direct client `attempts` **create**. After P6/W3 rules set
  attempts `create:false`, this write is rules-DENIED; the only live marker path is the callable.
- **Superseded by:** `markReviewComplete` Cloud Function (`functions/index.js:574` →
  `foundation.writeUpgradedReviewMarker`), routed under `SERVER_REVIEW_MARKER` (now unconditional).
- **Precondition:** SERVER_REVIEW_MARKER flipped TRUE at P4 + soaked; W3/P6 attempts-create rule live.
- **Collapse:** keep the `if` body (the callable), drop the `else`; remove the now-orphaned `setDoc`
  import; drop `SERVER_REVIEW_MARKER` from the `featureFlags` import + its declaration.
- **Disposition:** ✅ in patch. `--strip-trailing-cr` verified; RET-2 `client_automarker` → 0.

#### A.2 · Client `submitChallenge` write (SERVER_CHALLENGE_WRITE off-branch, W1)
- **File / signature:** `src/services/db.js` — `submitChallenge`, `if (SERVER_CHALLENGE_WRITE) { …callable… }`
  followed by `// --- legacy client path (fallback; removed once SERVER_CHALLENGE_WRITE is validated) ---`
  (direct `challenges.history` + `attempts.answers` `updateDoc`).
- **Why dead:** the legacy client body is the exact `answers[].isCorrect` forgery vector (#1c); W3/P6
  rules remove the student `answers`-update branch, denying it.
- **Superseded by:** `submitChallenge` callable (server-side, token-checked, `request.auth.uid`).
- **Precondition:** SERVER_CHALLENGE_WRITE flipped TRUE at P4 + soaked; W3/P6 rules live.
- **Collapse:** keep the callable, drop the legacy body.
- **Disposition:** ✅ in patch.
- **RULES FOLLOW-ON — [deepfix FINAL-FOLD-C · F-9] (DEFERRED to P7; do NOT change `firestore.rules`
  now):** the challenge-token *ledger* `users/{userId}.challenges.history` is still OWNER-writable
  under the `users/{userId}` owner-update rule, so a student can self-edit `challenges.history` to
  mint unlimited challenge tokens (bounded — redemption still needs a teacher to accept). It stays
  owner-forgeable ONLY because the legacy client `submitChallenge` body above writes
  `challenges.history` from the client, so the owner-update rule must keep permitting it until that
  write is gone. **THEREFORE, sequenced WITH this A.2 retirement** (SERVER_CHALLENGE_WRITE cutover
  complete, the callable owns the ledger): add `challenges` to the `users/{userId}` owner-update
  **exclusion list** in `firestore.rules` (alongside `role` and the other server-owned fields), or
  move the ledger to a server-owned doc. Do them together so no window opens where the client can no
  longer write its own challenge yet the rule still trusts a forged `challenges.history`. NOT folded
  now (FINAL_REVIEW F-9 / Fable-B MED-5): editing the rule today would deny the still-live client
  `submitChallenge` write. This is a **rules** change (P6/rules-cleanup surface), not part of P7's
  `--only hosting` + deletion-script target — track it as the rules half of A.2's retirement.

#### A.3 · Client `reviewChallenge` day-advance to class_progress (SERVER_CHALLENGE_WRITE inner off-branch) — RET-2 `client_challenge_advance`
- **File / signature:** `src/services/db.js` — inside `reviewChallenge`, the inner
  `if (SERVER_CHALLENGE_WRITE) { advanceForChallenge(...) } else { …direct class_progress `updateDoc({currentStudyDay: currentDay+1, …})`… }`
  closed by `} // end SERVER_CHALLENGE_WRITE else — direct class_progress day-advance (flag-off fallback)`.
- **Why dead:** the else-branch is the unclamped 3rd-twi-writer direct `class_progress` day-advance
  (I-6 §3 row 8 over-add). Post-P5 it targets a dead collection; post-cutover the server owns csd/twi.
- **Superseded by:** `advanceForChallenge` callable (`functions/foundation.js`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`,
  guard at `functions/foundation.js:1936`) — re-derives threshold/day-boundary/phase-gate + clamps to `wordsRemaining`.
- **Precondition:** SERVER_CHALLENGE_WRITE + SERVER_ADVANCE_FOR_CHALLENGE_ENABLED flipped at P4 + soaked.
- **NOTE — nesting:** the **outer** `reviewChallenge` client body is gated by `if (SERVER_OVERRIDE)` (P10,
  NOT retired at P7), so the client body SURVIVES; only the INNER `SERVER_CHALLENGE_WRITE` day-advance
  collapses to the `advanceForChallenge` call. This matches the in-code comment ("post-P7 it would no-op").
- **Disposition:** ✅ in patch. RET-2 `client_challenge_advance` → 0.

#### A.4 · Client reset batch-delete (SERVER_RESET_PROGRESS off-branch) — CUT-1 `client_reset_attempt_delete`
- **File / signature:** `src/services/db.js` — `resetStudentProgress`, `if (SERVER_RESET_PROGRESS) { …resetProgress callable… }`
  then the legacy body: `// 1. Delete class_progress document` → `deleteDoc(progressRef)`, the
  `attemptsToDelete` batch-delete, study_states + session_states deletes.
- **Why dead:** it's a client attempt-delete + direct `class_progress` delete. P6 removed the attempts
  owner-delete rules branch ([C5-5]); with reset server-side no live client path deletes attempts.
- **Superseded by:** `resetProgress` callable (`functions/foundation.js`, `SERVER_RESET_PROGRESS_ENABLED`
  guard at `:1599`) — LIST-WIDE across classes, attempts-first, reset-epoch tombstone.
- **Precondition:** SERVER_RESET_PROGRESS flipped at P4 + soaked; P6 owner-delete rules branch removed.
- **Collapse:** keep the callable, drop the legacy body; update the JSDoc "Deletes: class_progress …".
- **Disposition:** ✅ in patch. Removes the client `class_progress` **delete** ref.

### C. dup_resume_branch — **FLAGGED, NOT in the patch**

#### C.1 · Unreachable duplicate resume branch — RET-2 `dup_resume_branch`
- **File / signature:** `src/pages/DailySessionFlow.jsx` — `if (existingState && existingState.phase === SESSION_PHASE.COMPLETE) { … setShowReEntryModal(true) … }`
  (the block introduced by `// Handle re-entry: check if user already completed session`).
- **Plan basis:** FIX_PLAN P7 `:670-672` + I-2 finding 4 direct it to be deleted ("delete, don't
  modify"); RET-2 `dup_resume_branch` expects it at 0 in `--target=shipped`.
- **Why it is NOT in the verified patch (flag):** on close inspection this is **not** the clean isolated
  dead-branch the one-line description implies:
  1. **It is the SOLE trigger of the Re-Entry modal.** `setShowReEntryModal(true)` appears ONLY in this
     block (grep-confirmed). Removing it makes `showReEntryModal` / `savedSessionState` /
     `handleReEntryRetake` / `handleReEntryMoveOn` + the `<ConfirmModal … isOpen={showReEntryModal}>`
     render into dead UI (never opens), and orphans the `setSavedSessionState` setter.
  2. **It is not byte-equivalent in the session_state↔attempts *disagreement* case.** The LIVE completion
     path (`:599`, `if (config.startPhase === SESSION_PHASE.COMPLETE) …return`) keys on the
     attempts-authority `config.startPhase` and returns first, so this block is unreachable when the two
     agree. It fires ONLY when `session_state.phase===COMPLETE` but attempts say otherwise — the exact
     "poisoned session_state" case the attempts-authority redesign defeats (the deprecated
     session_state-routed re-entry). Deleting it makes that case fall through to the attempts-authority
     routing at `:828` (self-healing) — the *intended* post-redesign behavior, but a behavior CHANGE, not
     a no-op.
- **Correct disposition:** delete the branch **together with** the now-dead Re-Entry modal (state +
  `handleReEntryRetake`/`handleReEntryMoveOn` + the `ConfirmModal` render; keep `handleMoveToNextDay` —
  it is shared) as ONE reviewed unit, and visually confirm no Re-Entry-modal regression against the P6
  build before applying. Superseded-by: the `:599`/`:828` attempts-authority routing. Precondition:
  attempts-sole-authority routing deployed (already live pre-P7). **Left OUT of the patch pending that
  coordinated removal + human/oracle review.**

### B. Reconciliation-core fallbacks — **enumerated, NOT in the patch** (see §0 leg B rationale)

#### B.1 · Negative-TWI passthrough (LIST_SCOPED_RECON off-branch) — RET-2 `neg_twi_passthrough`
- **File / signature:** `src/services/studyService.js` — `: (LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) ? cfgNewWordCount : (…|| newWords?.length || 0))`
  in `completeSessionFromTest`, plus the sibling `const reviewOnlyDay = LIST_SCOPED_RECON && …`.
- **Why dead:** `LIST_SCOPED_RECON` is already `true` in prod (F-9); the flag-OFF `||` leg treats an
  explicit `0` as falsy → can fall through to the review pool length → decrements/re-adds TWI (I-2 #5).
- **Superseded by:** the flag-ON leg (explicit-0 authoritative, clamp ≥0).
- **Collapse:** drop `LIST_SCOPED_RECON &&` at both sites (`:1675`, `:1682`).
- **COUPLING:** cannot be retired alone — removing the `LIST_SCOPED_RECON` *declaration* requires
  collapsing ALL **39** `LIST_SCOPED_RECON` sites (below). RET-2 `neg_twi_passthrough` → 0 only when B.2
  lands. **Flagged: deferred to leg B.**

#### B.2 · `LIST_SCOPED_RECON` (transitional; already ON) — full collapse, 39 sites
- **Sites (grep `LIST_SCOPED_RECON`):** `src/config/featureFlags.js` (decl `:47`), `src/pages/MCQTest.jsx`
  (`:8` import, `:761`), `src/pages/TypedTest.jsx` (`:18`,`:1040`), `src/services/progressService.js`
  (`:22` import, `:78/:190/:207/:232/:235/:253/:263/:272/:569`), `src/services/studyService.js`
  (`:50` import, `:434/:844/:1675/:1682/:1734`), `src/services/db.js` (`:25` import, `:3311/:3378/:3507/:3659`).
- **Why dead:** flag is ON in prod; every `else` is the legacy class-scoped reconciliation (superseded
  by the student+list-scoped anchor/review readers).
- **Collapse rule:** take the `if (LIST_SCOPED_RECON)` / ternary-true leg at each site; delete import +
  declaration when the last site is collapsed. **Touches the CSD/TWI reconciliation engine
  (`progressService.js` reconcile, `db.js` anchor/review readers).**
- **Disposition:** enumerated only — **no local behavioral test** to certify a reconciliation-core
  rewrite; apply per-site under the `--target=shipped` oracle + a live-tree soak. Flagged §7.

#### B.3 · `SERVER_PROGRESS_WRITE` (transitional; folds plan-name `LIST_PROGRESS_PERSIST`) — 23 sites
- **Sites:** `featureFlags.js` (decl `:77`), `Dashboard.jsx` (`:20`,`:1254`,`:1602`), `progressService.js`
  (`:22`,`:111`,`:656`), `studyService.js` (`:50`,`:796`,`:1817`), plus dormant-fallback references in
  `MCQTest.jsx:577`/`TypedTest.jsx:856`/`DailySessionFlow.jsx:879` (comments) and the ViaServer helpers.
- **Why dead:** post-cutover the durable completion write + hydration/render reads route through
  `completeSession`/`resolveListProgress`. The flag-OFF `recordSessionCompletion` body (the whole
  client `updateClassProgress` path) + the `getOrCreateClassProgress` legacy hydration become dead.
- **CASCADE:** collapsing this makes `recordSessionCompletion` a one-line delegate to
  `recordSessionCompletionViaServer`; then `updateClassProgress` (client `class_progress` writer) may
  become orphaned — verify no other live caller before deleting it. This is a large chunk of the
  RET-1 `class_progress` zeroing.
- **Disposition:** enumerated only; flagged §7 (reconciliation/persist core).

#### B.4 · `LIST_PROGRESS_CANONICAL` (server; P5 mode switch) — 8 sites in `functions/foundation.js`
- **Sites:** `:64` decl, `:117` FOUNDATION_FLAGS, `durableProgressRef` ternary (`:251`), `legacyProgressRef`
  (`:240`), `getProgressDocId` legacy usage, the anchor-validation `durableProgressRef` read.
- **Why dead:** post-P5 the canonical `list_progress` doc is authoritative; the legacy
  `class_progress` (`legacyProgressRef`) target is dead.
- **Collapse:** make `durableProgressRef` return `canonicalProgressRef` unconditionally; delete
  `legacyProgressRef` + `getProgressDocId`'s legacy path; remove the flag from FOUNDATION_FLAGS.
- **Disposition:** enumerated only; this is the server half of RET-1 `class_progress` zeroing. Flagged §7.

### Server-side flag guards paired with the retired client flags (documented follow-on)
Retiring a transitional flag has a **server half** — the `if (!*_ENABLED) throw 'failed-precondition'`
dormancy guard on the paired callable becomes an always-true no-op. These live in
`functions/foundation.js` / `functions/index.js` and are a `--only functions` deploy, **not** part of
P7's `--only hosting`+script target, so they are documented here but NOT in the hosting patch:
`SERVER_ADVANCE_FOR_CHALLENGE_ENABLED` (`:1936`), `SERVER_RESET_PROGRESS_ENABLED` (`:1599`),
`SERVER_COMPLETE_SESSION_ENABLED` (`:977`), `SERVER_RESOLVE_LIST_PROGRESS_ENABLED` (`:1286`).
Leaving them intact (hardcoded, still true post-deploy) keeps the callables coherent; retire them in a
follow-on `--only functions` cleanup. (RET-4's oracle checks only the CLIENT declarations +
`LIST_PROGRESS_CANONICAL`, so this does not block RET-4.)

---

## (b) Flag lifecycle

### Retire, in order (each with its flag-off path AND its LEGACY invariant tests)
The 7 transitional flags (FIX_PLAN `:675-679`). Order = reverse of cutover dependency so no half-retired
window: retire a flag only after BOTH its client + server paths are collapsed.

1. **SERVER_REVIEW_MARKER** — A.1. (write-path; in patch)
2. **SERVER_CHALLENGE_WRITE** — A.2 + A.3. (write-path; in patch)
3. **SERVER_RESET_PROGRESS** — A.4. (write-path; in patch)
4. **LIST_SCOPED_RECON** — B.1 + B.2. (reconciliation-core; enumerated)
5. **LIST_PROGRESS_PERSIST** — *folded* into SERVER_PROGRESS_WRITE (no separate declaration; recorded, not a bug).
6. **SERVER_PROGRESS_WRITE** — B.3. (persist-core; enumerated)
7. **LIST_PROGRESS_CANONICAL** — B.4 (server; enumerated)

**Delete the LEGACY invariant tests WITH each flag.** The flag-OFF / Run-L byte-equivalence assertions
live in the `audit/playwright/lsr_*` suite (e.g. `lsr_runL_verify.mjs`, `lsr_reviewonly*.mjs`,
`lsr_snapshot.mjs`) — any assertion that pins flag-OFF (legacy class-scoped / client-write) behavior is
meaningless once the flag is gone and MUST be removed alongside it. Do NOT delete the M-STATIC
`--target=shipped` RET oracle (`lsr_deepfix_static.mjs`) — that is the ACCEPTANCE, not a legacy test;
its `--target=baseline` RET/CUT rows are expected to go stale (they assert the dormant-draft state).

### Explicitly KEEP (do NOT retire at P7)
- **CONTINUATION_LINKS** (P8 · CONT-A) — a *feature* flag, not transitional. FIX_PLAN `:678-679`.
- **CYCLING_ENABLED** (global, P9) **+ the per-assignment `cyclingEnabled` field** (two-key gate) — P9;
  not shipped/soaked at P7. Keep both the flag and the `assignments[listId].cyclingEnabled` schema.
- **SERVER_OVERRIDE** + **SERVER_REVIEW_CHALLENGE_ENABLED** / **SERVER_OVERRIDE_ENABLED** (P10 · OVR) — the
  `reviewChallenge` client body and `overrideAttempt` are gated by these; P10 not soaked at P7. Their
  flag-OFF branches are the CURRENTLY-LIVE path — deleting them would break production.
- **TEACHER_IDS_READ** + **TEACHER_IDS_WRITE_ENABLED** (P10c) — the `where('teacherId','==',uid)` gradebook
  query is the LIVE read path while the flag is off; deleting it breaks the gradebook. Keep.
- **SERVER_ATTEMPT_WRITE** — pre-existing live, NOT in the plan's 7-flag transitional list; out of P7 scope.
- **Doc-role `isTeacher()`** (firestore.rules) — superseded by the teacher CLAIM, but its removal is a
  **rules** deploy; P7's target is `--only hosting` + the deletion script. Belongs to P6's rules work or
  a separate rules cleanup, NOT P7.

---

## (c) The `class_progress` document deletion (one-time script, post-migration, post-window)

- **Data:** legacy `users/{uid}/class_progress/{classId}_{listId}` docs. Migrated to canonical
  `users/{uid}/list_progress/{listId}` at **P5** by `scripts/cs/deepfix-migrate-list-progress.mjs`
  (LIST_PROGRESS_CANONICAL flip is atomic with that migration cutover).
- **Order (hard):** (1) full CODE retirement of every `class_progress` reader/writer (leg B + CS
  toolchain) so nothing reads/writes the collection; (2) a **no-legacy-write window** where zero code
  targets `class_progress`; (3) ONLY THEN the one-time deletion script removes the docs. Reversibility:
  **none for deleted docs — backups only** (FIX_PLAN `:684-685`), which is why P7 waits ≥14 days and
  keeps the [C8-1] window.
- **Script:** a one-time `deepfix-delete-class-progress.mjs` (`--dry` → `--commit`, per the
  `deepfix-migrate-*` precedent), authorized via a `SUPPORT_RUNBOOK.md` CS event (deploy gate G0 · G4 ·
  CS-event authorization, FIX_PLAN `:688`). Run the READ-ONLY `data-integrity-sweep.mjs` (list_progress-
  shaped, see below) BEFORE and AFTER.
- **CS toolchain rework (F6-3):** 19 `scripts/cs/*.mjs` reference `class_progress`. Split:
  - **Rework (live tools):** `scripts/cs/data-integrity-sweep.mjs` (contains `class_progress`) → make it
    `list_progress`-shaped. `scripts/cs/manual-pass.mjs` does NOT reference `class_progress` (writes
    anchors) — no change needed.
  - **Archive (historical one-offs, 17):** e.g. `batch-advance-listend*.mjs`, `fix-jisusu-throttle.mjs`,
    `reconcile-ascent-carry.mjs`, `sweep-*.mjs`, `scan-*.mjs`, `deepfix-census*.mjs`,
    `move-kimdonghyun-to-summit.mjs`, `fix-kaila-junseo.mjs`, `fix-csd-undercount.mjs`,
    `diag-reviewonly-cases.mjs`, `report-next-list.mjs`. Move to `scripts/cs/_archive/` (out of the
    `scripts/cs` grep root) rather than rewrite — they are point-in-time fixes against the old schema.
    (Archiving is what lets RET-1 reach 0 without rewriting dead scripts.)

---

## (d) Zero-`class_progress`-refs acceptance

**Gate:** `grep -rF class_progress src functions scripts/cs` must be **0** BEFORE the doc deletion —
covering BOTH student and teacher read paths (F6-2) and the reworked CS toolchain (F6-3).

**Current footprint (dormant draft):** ~90 refs across 30 files — `src` 9 files, `functions` 2 files,
`scripts/cs` 19 files. Reaching 0 requires: leg B (LIST_SCOPED_RECON + SERVER_PROGRESS_WRITE +
LIST_PROGRESS_CANONICAL collapses remove the `src`/`functions` readers/writers) + §(c) CS-script
rework/archival + purging stale `class_progress` **comments** (e.g. `db.js:551` "derived from
class_progress"; `DailySessionFlow.jsx:881`; several `progressService.js`/`studyTypes.js` comments) —
`grep -rF` counts comment matches too.

**Automated oracle — M-STATIC `--target=shipped`** (`audit/playwright/lsr_deepfix_static.mjs`):
- **RET-1** — `class_progress` tree-wide (`src`+`functions`+`scripts/cs`) must be `0`.
- **RET-2** — the 4 dead-branch signatures (`dup_resume_branch`, `neg_twi_passthrough`,
  `client_automarker`, `client_challenge_advance`) must be `0`.
- **RET-4** — the 7 transitional flags ABSENT from `featureFlags.js`/`foundation.js`; CONTINUATION_LINKS
  present.
- **CUT-1 (shipped)** — zero direct client progress-writes / attempt-deletes.

**Verified-patch coverage of the oracle (write-path leg only):** RET-2 `client_automarker` +
`client_challenge_advance` → 0; CUT-1 `client_reset_attempt_delete` (the `class_progress` delete +
`attemptsToDelete`) removed. RET-2 `dup_resume_branch` (flagged, §a.C.1) and `neg_twi_passthrough`
(coupled to leg B), full RET-1, and RET-4 (LIST_SCOPED_RECON/SERVER_PROGRESS_WRITE/LIST_PROGRESS_CANONICAL
still declared) require legs B–E. **The verified patch does NOT by itself make `--target=shipped` fully
green** — that is by design (§0 leg-B rationale); it makes the write-path RET/CUT rows green and reduces
the `class_progress` footprint.

---

## (e) Ordering + the [C8-1] window

Deploy gate (FIX_PLAN `:688`): **G0 · G4 · CS-event authorization** for the doc deletion; targets
`--only hosting` + the deletion script (the server-flag guard cleanup is a separate `--only functions`).

Sequence:
1. **P6 cutover deploys.** Start the clocks.
2. **≥14 day soak** after P6 (FIX_PLAN `:662`, `:685`) — the reversibility window; rules can still be
   rolled back until P7 deletes the legacy docs, so P7 must not run before the soak proves stable.
3. **≥7 consecutive days of zero `legacy_write_denied`** ([C8-1], FIX_PLAN `:687`) — proves no live
   client is still hitting a denied legacy write (the accepted dormant-tab residual excepted). Only
   after this 7-day-zero streak (within/after the 14-day window) proceed.
4. **Catch-up merge** of ancillary deltas (transactional, [C4-3]) → **apply the code retirement** (this
   patch = write-path leg; then legs B–E under the `--target=shipped` oracle) → build + `--only hosting`.
5. **No-legacy-write window** confirmed (RET-1 = 0 tree-wide; sweep clean against `list_progress`).
6. **One-time `class_progress` doc deletion script** (CS-event-authorized), `--dry` → `--commit`, with
   `data-integrity-sweep` before/after. Irreversible → backups first.
7. **Follow-on `--only functions`** cleanup: retire the paired server `*_ENABLED` guards.

Acceptance (FIX_PLAN `:686-687`): zero `class_progress` readers/writers tree-wide (student + teacher +
CS); sweep clean (list_progress-shaped); zero `legacy_write_denied` for 7 consecutive days pre-deletion;
F-4 stable.

---

## Uncertainties for the final review

1. **dup_resume_branch (§a.C.1)** — plan-directed + oracle-backed, but entangled with the live-rendered
   Re-Entry modal and not byte-equivalent in the session_state↔attempts disagreement case. Held out of
   the verified patch; needs the coordinated Re-Entry-modal removal + a visual regression check.
2. **Leg B reconciliation-core collapse** — mechanically the ON-branch survives by construction, but
   there is NO local behavioral test (only emulator-backed e2e). Recommend applying per-site on the live
   post-P6 tree, gated by `--target=shipped` + a soak, not blind.
3. **featureFlags hunk flag-value drift** — the two `featureFlags.js` hunks assume `= false` (dormant
   draft); at P7 the flags read `= true` (flipped at cutover). Reconcile the single value token if the
   hunks reject (the db.js/DSF guard hunks are value-independent).
4. **`getAvailableChallengeTokens` (db.js:188)** — after A.2 collapse, verify it still has a live caller
   (challenge-token UI) before treating it as a secondary orphan; it is exported, so left intact.
5. **Server `*_ENABLED` guard retirement** — deliberately excluded from the hosting patch (`--only
   functions`); confirm the follow-on functions deploy retires them so RET-4's spirit (both sides gone)
   holds.
