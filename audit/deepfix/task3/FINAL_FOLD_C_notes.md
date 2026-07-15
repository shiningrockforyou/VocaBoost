# FINAL FOLD C — client / scripts / misc findings (stream C)

**Program:** deepfix Task 3 — FINAL whole-surface review fold, **stream C (client/scripts/misc)**.
**Date:** 2026-07-14. **Status:** LOCAL-ONLY draft. No git commit/branch, no deploy, no live-Firebase
write. `change_action_log.md` NOT touched (per binding constraint).

Folds **F-8, F-10, F-13, N-1, N-2, N-3** + the two **stream-A carryforwards** into the P5 migration
(progress_meta/reset-epoch read + `autoCompleted` review-evidence exclusion), and **documents F-9**
(deferred to P7). Files touched (exactly the 7 assigned):

- `src/pages/Signup.jsx` — F-8
- `src/pages/DailySessionFlow.jsx` — F-10, N-2
- `src/pages/ClassDetail.jsx` — N-1
- `scripts/cs/deepfix-backfill-teacher-claims.mjs` — F-13
- `scripts/cs/deepfix-migrate-attempts-teacherids.mjs` — F-13
- `scripts/cs/deepfix-migrate-list-progress.mjs` — N-3 + carry F-6 + carry F-4
- `audit/deepfix/task3/P7_RETIREMENT_INVENTORY.md` — F-9 defer note

Diff: `audit/deepfix/task3/final_fold_c.patch` (git-apply-clean on a reconstructed pre-fold baseline +
byte-identical round-trip verified).

## Validation performed
| Check | Result |
|---|---|
| `node --check` (3 `.mjs` scripts) | OK (all 3) |
| `@babel/parser` (`sourceType:module`, `jsx`) on the 3 `.jsx` | OK (all 3) |
| **eslint delta vs reconstructed pre-fold baseline** | **0 / 0 / 0** — Signup 0e/0w→0e/0w · DailySessionFlow 3e/9w→3e/9w · ClassDetail 4e/0w→4e/0w · claims 0/0→0/0 · teacherids 0/0→0/0 · migration 0/0→0/0 (all pre-existing env/`no-undef` noise; NONE added) |
| `final_fold_c.patch` `git apply --check` (fresh prefold baseline) | CLEAN |
| Patch round-trip (`cmp` post-apply vs current) | byte-identical for all 7 files |

The one added JS `catch` (Signup F-8) and the migration's `catch` use **optional catch binding**
(`} catch {`) — the src eslint config flags a bound `catch (e)` as `no-unused-vars`; optional binding
adds neither. (Same discipline as stream A.)

## Dormancy posture (why the fold is safe to merge dark)
- **F-8 / F-10 / N-1 / N-2** ride behind the P9/P10 flags (`CYCLING_ENABLED` false; the teacher-claim
  narrowing dormant) — every touched branch short-circuits before its flag today, so flag-off byte
  behavior is unchanged (arguments per-fix below).
- **F-13 / N-3 / carry-F-6 / carry-F-4** are in `--dry`-only, write-guarded DRAFT scripts (a `--commit`
  needs the fixed confirm sentinel + David authorization + — for the migration — asserts-pass AND
  quarantine=0). No fix produces an unauthorized write; the fixes only tighten the DRY analysis /
  exit-code discipline (strictly more conservative).

---

## F-8 (MED) — Signup invite redemption force-refresh  [`Signup.jsx`]
**Change.** Added `import { auth } from '../firebase'` and, inside `finishTeacherRedemption` (the SOLE
redemption surface — both the email `handleSubmit` and the Google `handleGoogleSignIn` route through
it, so "every redemption surface" is covered by one edit) after `redeemTeacherInvite` succeeds and
BEFORE `window.location.assign('/')`:
```js
try { await auth.currentUser?.getIdToken(true) } catch { /* ignore */ }
```
Force-refreshes the ID token so the freshly-minted `role:'teacher'` custom claim
(`provisionTeacher`/`TEACHER_CLAIM_ENABLED`) is present the moment the narrowed P10(d) rules read it —
closing the "`firestore.rules` D3 cites a Signup.jsx force-refresh that doesn't exist → redeemed
teacher denied ~1h" gap. **Implemented the getIdToken fix** (the task's primary route); the rules-D3
alternative is stream B's and was not touched.

**Deviations from the literal finding (deliberate, flagged):** (a) optional chaining `?.` — guards a
null `currentUser` without throwing; (b) best-effort `try/catch` — the redemption already SUCCEEDED
server-side and the full reload re-authenticates regardless, so a token-refresh network hiccup must NOT
land in the outer catch and masquerade as "invite could not be redeemed" (which would also skip the
navigate). Both make the change strictly safer without altering the success outcome.

**Byte-equivalence (flag-off / common path).** A student (no invite code) never calls
`finishTeacherRedemption` → ZERO change. On the teacher redemption SUCCESS path the only added behavior
is one extra token-refresh network call before the reload; navigation and every other flow are
unchanged. Today the claim is dormant (TEACHER_CLAIM_ENABLED off), so the refresh is inert-but-harmless
until claims exist — exactly the "extra token refresh on the redemption success path only" the finding
describes.

## F-10 (MED) — P9 "Start over" gated on EFFECTIVE cycling  [`DailySessionFlow.jsx` ~:1960]
**Change.** The choice-terminal "Start over" prop pair went from the raw global flag:
```
cyclingCapabilityLive={CYCLING_ENABLED}
onStartOver={CYCLING_ENABLED ? … : undefined}
```
to **effective cycling**:
```
cyclingCapabilityLive={CYCLING_ENABLED && !!sessionConfig?.cyclingSourceClassId}
onStartOver={CYCLING_ENABLED && sessionConfig?.cyclingSourceClassId ? … : undefined}
```
`sessionConfig.cyclingSourceClassId` is the result of `deriveEffectiveCycling` — studyService resolves
it at init via `resolveEffectiveCycling` (`studyService.js:355`) and threads
`cyclingSourceClassId: cyclingCap.sourceClassId` onto the config (`:505`). It is **non-null IFF** some
enrolled class assigns this list with `cyclingEnabled:true` AND `CYCLING_ENABLED` is on
(`resolveEffectiveCycling` short-circuits to `sourceClassId:null` when the global flag is off). So this
IS the finding's `deriveEffectiveCycling(studentClasses, current.id).enabled` — already computed and
stored on the session, requiring **no new read and no studyService edit** (studyService is not a stream-C
file). The old gate rendered the button for EVERY finished student even though its handler can only
serve an effective-cycling one; the new gate narrows it to the meaningful case (finished-before-enable
transition).

**Why the pre-resolved signal rather than importing `deriveEffectiveCycling` (flagged).** DSF does not
carry the cross-class `studentClasses` array (only the launching class's curated `assignmentSettings`,
which *drops* `cyclingEnabled` — see `studyService.js:349-350`), so a faithful in-render
`deriveEffectiveCycling(studentClasses, listId)` would need a fresh cross-class fetch. The init-resolved
`cyclingSourceClassId` is the SAME predicate's result and strictly more correct (no render-time read).

**Byte-equivalence (flag-off).** `CYCLING_ENABLED` false ⇒ `resolveEffectiveCycling` returns
`sourceClassId:null` ⇒ `cyclingSourceClassId` null ⇒ both props false/undefined ⇒ button absent — the
SAME terminal as today. The retained `CYCLING_ENABLED &&` makes this airtight regardless of data (a
stale `sessionConfig` lacking the field ⇒ `undefined` ⇒ false ⇒ hidden — safe).

## F-13 (LOW) — backfill scripts NOT_READY exit-2 discipline  [both backfill `.mjs`]
**Change.** Both scripts hoisted a `let commitMismatched = 0;` above the `if (MODE==='commit')` block,
set it from the post-write read-back loop, and replaced the unconditional `process.exit(0)` with:
- **`deepfix-backfill-teacher-claims.mjs`**: `exit(2)` when `MODE==='commit' && (commitMismatched > 0
  || counts.missingAuth > 0)`. `missingAuth` (a role-doc teacher with no Auth user) is treated as
  *untriaged* because the script has no triage-ack, so any at commit is a NOT_READY signal (per the
  finding's "claims script: also untriaged `missingAuth>0`"). FINAL line now prints `NOT_READY/READY`
  + `mismatched=` under commit.
- **`deepfix-migrate-attempts-teacherids.mjs`**: `exit(2)` when `MODE==='commit' && commitMismatched >
  0` (sampled read-back; no `missingAuth` concept here).

Matches P5's exit-2 discipline (`deepfix-migrate-list-progress.mjs` already exits 2 on
`assertFailures||quarantine`). D2 makes the commit read-back a HARD precondition, so a checklist keying
on exit codes can no longer wave through a partial backfill.

**Byte-equivalence (`--dry` unaffected).** In dry mode `commitMismatched` stays 0 and the `missingAuth`
term is gated behind `MODE==='commit'`, so `commitNotReady` is false ⇒ `exit(0)` — identical to before.
No write behavior changes in any mode; only the COMMIT-mode exit CODE flips 0→2 on a mismatch (the
intended discipline).

## N-3 (NIT) — migration dead `dedupe` set removed  [`deepfix-migrate-list-progress.mjs` `evidencedReviewDays`]
**Change.** Removed the `dedupe` Set (keyed `classId|listId|studyDay`) that was built via `dedupe.add`
but never read — the function returns `days.size` (one-per-`studyDay`). Kept `days`; reconciled the
header contract (was contradictorily "keyed `(classId,listId,studyDay)` … capped ONE per `studyDay`")
to state the operative key plainly: **day-granular, list-scoped, one per `studyDay`** — the same unit as
csd, so a dual-enrolled student's same-day reviews across classes count ONCE (under-count is the
conservative, quarantine-favouring direction; over-count would inflate the plausibility ceiling). Now
code and contract agree.

**Byte-equivalence.** `dedupe` was write-only (never influenced the returned `days.size`), so removing
it produces IDENTICAL output. `lin` is still referenced (`lin.listId !== listId`), no unused var.

## Stream-A carryforward (1) — reset-epoch (`progress_meta`) fold into the migration  [`deepfix-migrate-list-progress.mjs`]
**Change (two legs, parity with F-6/F-3).**
1. **Read exclusion (the finding's explicit ask).** New `getResetMeta(uid, listId)` reads the reset
   tombstone from `users/{uid}/progress_meta/{listId}` (the PRE-P5 location — `LIST_PROGRESS_CANONICAL`
   flips WITH this migration, so pre-flip the legacy reset branch wrote there; mirrors foundation
   `getResetAtServer` / db.js `getMostRecentPassedNewTest`). In `computePair`, `notPreReset(a)` excludes
   attempts with `submittedAt < resetAt` from the **anchor pool** (`passedNew` → `valid`/`invalid`/
   `listAnchor`/per-class `own`), so a pre-epoch straggler can't re-promote twi ("reset un-resets").
2. **Write carry (stream-A FOLD note (c): "the migration must fold `progress_meta` into the canonical
   doc it writes").** When a tombstone exists, `merged.resetAt`/`merged.resetEpoch` are carried onto the
   written canonical `list_progress` doc, so post-P5 anchor readers keep excluding pre-reset attempts
   (parity with F-3, which stamps these on a server reset). These come from `progress_meta`, not the
   `class_progress` sources, so they are NOT in `droppedFields`.

**Scoping decision (flagged).** The read filter is applied to the ANCHOR pool only (item-1's literal
"pre-epoch anchor is excluded"); the review-evidence counter is NOT separately reset-filtered because
its post-anchor gate (`submittedAt > anchor.submittedAt`) already excludes pre-reset reviews once the
anchor is post-reset, and the no-anchor case quarantines on `ANCHORLESS_TWI` regardless. `newAtts`
(undersized-test heuristic) is left unfiltered — a different signature, out of the anchor-read scope.

**Byte-equivalence (dormant tree).** The reset tombstone has EXACTLY ONE writer: the dormant server
`resetProgress` (`SERVER_RESET_PROGRESS_ENABLED=false`); the reachable legacy client reset writes NO
tombstone. So **no `resetAt` exists anywhere today** ⇒ `getResetMeta` returns null for every pair ⇒
`notPreReset` is the identity (anchor pool unchanged) and `merged` gets no added fields ⇒ byte-identical
DRY output. The script is `--dry` write-guarded regardless. The extra per-pair `progress_meta` read is a
read on a dry-run tool (not a live path); on a missing/denied doc it fails to null (no exclusion).

## Stream-A carryforward (2) — `autoCompleted` review-evidence exclusion  [`deepfix-migrate-list-progress.mjs` `evidencedReviewDays`]
**Change.** `evidencedReviewDays` now `continue`s on `a.autoCompleted === true` (parity with stream-A's
`countPostAnchorReviewDays`). The client automarker (`DailySessionFlow.jsx`) and server W2 marker both
set `autoCompleted`; these "no review available" stand-ins are NOT durable student review evidence, so
they must not legitimise a pumped csd in the plausibility screen. Header note added.

**Byte-equivalence.** `--dry` write-guarded — no write. The DRY report's `evDays` (and thus
`csdPlausible`/quarantine) may tighten for pairs carrying auto-markers; that is the POINT of the fix and
it moves strictly toward MORE quarantine (aligned with the fail-closed `[C7-2]` commit gate). No
unauthorized write is possible.

## N-1 (NIT) — ClassDetail cycling-proxy false-positive DOCUMENTED  [`ClassDetail.jsx` ~:100]
**Change.** Extended the `StudentProgressCell` KNOWN-LIMITATION comment (P9-7 recorded only the false-
NEGATIVE) to document the **false-POSITIVE**: the `wordsIntroduced > cycleLength` proxy ALSO matches a
legacy OVER-INTRODUCTION row (twi driven past the list length by a pre-fix bug, no cycling) → a false
"Lap 2" under `CYCLING_ENABLED`. **Chose documentation over tightening** (the finding permits either):
distinguishing a genuine cross-class cycler from legacy over-introduction needs per-student
effective-cycling data this teacher grid doesn't carry, and tightening to `list.cyclingEnabled === true`
alone would erase the (accepted) cross-class-cycler case entirely — strictly worse. Display-only; the
underlying data is what the P5 migration quarantines (`ANCHORLESS_TWI`/`TWI_EXCEEDS_ANCHOR`).

**Byte-equivalence.** Comment-only; the `CYCLING_ENABLED &&` gate is unchanged ⇒ flag-off `cellCycling`
is always false ⇒ byte-identical.

## N-2 (NIT) — straddle-day lap display DOCUMENTED  [`DailySessionFlow.jsx` `lapDisplayNewIndex` ~:1204]
**Change.** Documented the known flag-ON straddle inversion: a single day's new-word allocation can span
a lap boundary (e.g. virtual 95→104, cycleLength 100), and because start/end are wrapped INDEPENDENTLY
the header can read inverted ("Words 96–5"). **Chose documentation over fix** (the finding permits
either): a cross-lap range has no coherent single "A–B" form, so a real fix must pair the two call
sites (`wordRangeStart`/`End`) and pick a wrapped-range convention ("96–100 · 1–5" or clamp-to-boundary)
with product/visual sign-off — beyond a byte-equivalent dark fold. Cosmetic only (the test SAMPLE +
graduation use physical `wordIds`, never these display numbers).

**Byte-equivalence.** Comment-only; flag-off `cyclingActive` is falsy ⇒ `v+1`, no wrap ⇒ byte-identical.

## F-9 (MED) — DEFER→P7 (document only)  [`P7_RETIREMENT_INVENTORY.md` §(a) A.2]
**Change.** Appended a "RULES FOLLOW-ON — F-9" bullet to the A.2 (`submitChallenge`) retirement entry:
once P7 retires the legacy client `submitChallenge` (which writes `challenges.history` from the client),
ALSO add `challenges` to the `users/{userId}` owner-update **exclusion list** in `firestore.rules` (or
move the ledger server-owned), sequenced WITH the A.2 retirement so no window opens where the client
can't write its own challenge yet the rule still trusts a forged `challenges.history`. Explicitly notes
this is a rules change (NOT P7's `--only hosting` target) and MUST NOT be applied now (would deny the
still-live client write). **No `firestore.rules` edit made** (stream B's file / deferred).

---

## Could NOT / did NOT fix (flagged, not guessed)
- **N-1 / N-2** — documented rather than behaviorally fixed (finding permits either; a real fix needs
  cross-class per-student data (N-1) or a paired-call-site display convention + visual sign-off (N-2)).
- **F-10 signal source** — used the init-resolved `sessionConfig.cyclingSourceClassId` instead of a
  literal `deriveEffectiveCycling(studentClasses,…)` import, because DSF lacks the cross-class
  `studentClasses` array and studyService is not a stream-C file. Same predicate, no new read; flagged.
- **carryforward (1) scope** — read filter on the anchor pool only + write-carry of the tombstone;
  review-evidence not separately reset-filtered (transitively covered post-anchor). Flagged above.

## Streams NOT touched (confirmed)
Stream C edited ONLY the 7 assigned files (the patch's only `diff --git` subjects). **NOT touched:**
`functions/foundation.js` / `functions/index.js` (stream A), `src/services/db.js` (stream A), and
`firestore.rules` / the `firestore.*.rules` stage artifacts (stream B) — verified: none appear as a
diff subject in `final_fold_c.patch` (the only matches for those names are prose/comment mentions inside
the stream-C files). `change_action_log.md` NOT touched (binding constraint).
