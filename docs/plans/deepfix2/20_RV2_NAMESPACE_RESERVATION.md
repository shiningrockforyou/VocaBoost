# 20 — RV2 NAMESPACE RESERVATION (the pre-flip blocker SET: NTF 19 + 22, with 23 riding)

**Status: DESIGN, pre-implementation. Codex checkpoint REQUIRED on this doc before any fold starts**
(standing decision: the pre-flip blockers are checkpointed as a SET — one of them, NTF 23, is
live-path and unassessed). Written 2026-08-04; every file:line below re-verified against the working
tree that day, not inherited from the cards.

## The one root cause

`attempts` and `grading_jobs` are GLOBAL top-level collections whose document NAMES the engine derives
server-side (`rv2_{uid}_{presentationId}` / `rv2_{presentationId}`), while THREE mouths still let a
client choose an arbitrary name in that same namespace. Fail-closed guards shipped by this program
(`isEngineAttemptFor`, `usableCachedResults`) correctly refuse the resulting foreign documents — and
thereby convert a would-be forgery into a PERMANENT DENIAL of the victim's engine test:

- **NTF 19** — `grading_jobs`: uid-mismatch throw runs BEFORE the status/lease checks
  (`functions/index.js:936-938`), so an expired lease never releases a doc to another uid; rules deny
  every client write (`firestore.rules:415-418` — deployed bytes, sha16 `f40f91fce3693b82`), so the
  victim cannot clear it. Permanent.
- **NTF 22** — `attempts`: create checks fields, never the NAME (`firestore.rules:301-312`); the
  victim's submit then fails closed forever (`callables.js:630-632` ⇒ `presentation_invalid`); delete
  is creator-only (`firestore.rules:394-396`). Permanent.
- Reachability (both): uids enumerate from `classes.studentIds`; `presentationId` is
  `{classId}_{listId}_d{day}_e{epoch}_p{seq}` with small predictable seq. Dark today; **live at the
  flip.**

## The mouth census (the completeness claim, and how it was derived)

Derived, not enumerated by hand:

```
grep -n 'collection("attempts")\|collection("grading_jobs")' functions/index.js functions/reviewV2/*.js functions/*.js
```

Every hit classified. **Write sites where a CLIENT can influence the document name:**

| # | Mouth | Name source | Verified |
|---|---|---|---|
| M1 | `gradeTypedTest` grading-job claim/persist | `jobKey = (writeContext ?? gradeContext)?.attemptDocId` — client-supplied, no namespace restriction; `GRADE_JOB_ENABLED=true` | `index.js:1048-1051`, `:929`, `:980`, `:104` |
| M2 | `submitVocabAttempt` attempt write | `attempts.doc(ctx.attemptDocId)` — client-supplied, **Admin SDK ⇒ bypasses rules**; existing-doc guard only checks `studentId` of a doc that exists, then happily CREATES at any free name | `index.js:471-479` |
| M3 | Client direct Firestore write | any `attempts/{id}` create with `studentId==self`, no server-only keys, id not `*[Mm]anual*` — the NAME is never tested | `firestore.rules:301-312` |

**Sites verified SAFE (why):** engine's own attempt write — name is server-derived
`engineDocId(uid, presentationId)` (`callables.js:551`); review marker — server-composed
`${uid}_${classId}_…_automarker`, and a Firebase uid (28-char alphanumeric, no underscore) can never
equal `rv2` (`foundation.js:1022`); manual-pass anchor — teacher/CS-gated, target derived from the
loaded attempt, uid-prefixed (`foundation.js:2884-2989`); `submitChallenge` / override / re-anchor —
load-EXISTING-by-id updates, never creates at a client name (`index.js:714`, `foundation.js:2729`,
`:2884`); everything else in the grep output is a query or an owner-checked read
(`readExistingAttemptForContext` guards the idempotency read, `index.js:261-276`). apBoost functions
never touch either collection (zero grep hits).

**Read-side (out of this set's scope, tracked where they belong):** `completeDay` consumes
client-supplied attempt ids as evidence (`completion.js:317`, `:447`) — engine-side classification is
cutover-c's contract; the provenance claim it rests on is NTF 20 (both legs now established).

## The decision: reserve the `rv2_` prefix at every mouth

**One rule, three legs: a client-influenced name may never enter `rv2_*` space — refused loudly at
the mouth, never silently rewritten.**

- **Leg 1 (functions, closes NTF 19 + M2, collapses NTF 23's lever):** refuse
  `attemptDocId.startsWith("rv2_")` with `invalid-argument` wherever a client-supplied attemptDocId is
  ingested in the LIVE callables — one shared validation covering BOTH the grading-job key derivation
  (M1) and the attempt-write target (M2). Implementation detail for the fold: prefer a single
  chokepoint validator; whether one exists that both paths already flow through is the fold's first
  verify row, and each callable gets its OWN refusal fixture regardless.
  **Live-behavior claim to prove, not assert:** the legacy client mints
  `{uid}_{testId}_{nonce}` (`MCQTest.jsx:700`) — uid-prefixed, never `rv2_` — so no legitimate live
  request is refused. Fixture: byte-parity on legacy-shaped ids + refusal on the reserved prefix.
- **Leg 2 (rules, closes NTF 22/M3):** in the `attempts` match block, deny client **create, update,
  delete** for `attemptId.matches('rv2_.*')` — the name test on ALL write verbs, not only create
  (set-merge on a nonexistent doc is a create in different clothing; the uniform denial is one line
  per verb and needs no key-presence reasoning). Engine writes are Admin SDK and unaffected. Legacy
  ids are uid-prefixed and unaffected.
  **Bundle NTF 20's owed comment repair into this same rules change** (its instruction: never a
  standalone deploy) — cite the provenance scan alongside the create guard at
  `firestore.merged.rules:133`/`:346`.
- **Leg 3 (NTF 23, assessment + card):** with Leg 1 in place the pre-seeding lever dies at the source
  — a client can no longer cache into `rv2_*` job keys, and legacy-on-legacy pre-seeding requires
  predicting another student's nonce. The remaining self-seed "exploit" caches a genuine grade of the
  caller's own submitted answers — no forgery value. **The owed end-to-end assessment therefore
  shrinks to confirming those two sentences on the live client flow** (TypedTest.jsx:710-718 →
  index.js:1048) and gets written into NTF 23 when the fold lands. A consumer-side acceptance test on
  the legacy `return_cached` branch (`index.js:1052`) stays CARDED as defense-in-depth — explicitly
  NOT a pre-flip blocker once the namespace is reserved.

### Alternatives rejected (and why)

1. **Reorder the uid check after the lease checks** (make 19's block a 180s window): changes live
   claim semantics for all 947 students, converts permanent denial into a re-squattable window (the
   attacker re-claims each expiry), and does nothing for `attempts`. Treats the symptom.
2. **uid-namespace the job key server-side** (`{uid}__{key}`): changes the shape of a live collection
   mid-flight — in-flight jobs, `getGradingStatus` reads, and the r097-deployed owner-read rule all
   assume today's key; migration burden for zero extra closure over Leg 1.
3. **Move `attempts` to a uid-scoped subcollection** (the DF2-46 direction): the real long-term
   answer and far out of pre-flip scope; nothing in this set forecloses it.

### Residual exposure, stated honestly

- **Legacy-on-legacy squat/pre-seed stays theoretically possible** (create at another student's
  future `{uid}_{testId}_{nonce}` id): requires predicting a client nonce, so not practically
  reachable; carded, not fixed, not a pre-flip blocker. The `rv2_` reservation is load-bearing
  precisely because ENGINE names are predictable BY DESIGN.
- Rules deny is name-based: a future engine key shape that drops the `rv2_` prefix silently exits the
  fence. The reservation must be recorded at `engineDocId`'s definition as a contract.

## Fold obligations (two ledgers, standard discipline)

- **Fold A (functions leg, LIVE path):** full bypass set per the template (create · update · delete ·
  set-merge · set-overwrite · delete-then-recreate · batch · transaction · other path · third party ·
  teacher) against BOTH mouths M1/M2; fixtures: legacy-shape parity, `rv2_` refusal on each callable,
  foreign-uid claim refusal unchanged; MUTANT: drop the prefix refusal ⇒ refusal fixture red. Emulator
  harness per the cutover-a pattern.
- **Fold B (rules leg):** rules-matrix run (the `rules-matrix.mjs` harness) covering all write verbs ×
  {self, classmate, teacher, unauth} at `rv2_`-named and legacy-named ids; MUTANT: revert the name
  clause ⇒ matrix red. Artifact sha re-baselined post-deploy (order-97 pattern).
- **Deploy sequencing:** Leg 2 (rules) can ship independently and first — it is deny-only and the
  engine bypasses it. Leg 1 rides `functions-deploy-engine` (prod functions are STALE at `b54c6e5`;
  the flip requires a functions deploy regardless), behind the standing pre-deploy Codex checkpoint.
- **Rehearsal obligation (from NTF 22):** the collision fix removed ACCIDENTAL collisions, so the
  25WT rehearsal must test squatting DELIBERATELY — add a deliberate-squat scenario to
  `19_REHEARSAL_SPEC.md` when this lands (expected result post-fix: refused at the mouth, no denial).

## Questions for the Codex checkpoint

1. Is name-based reservation at the mouths ACCEPTED as the closure for 19+22, with the uid-scoped
   subcollection (DF2-46) recorded as the long-term direction rather than a pre-flip requirement?
2. Is the `rv2_` reservation being recorded AT `engineDocId`'s definition (the contract that a future
   key-shape change must preserve) sufficient, or should the fence be shape-agnostic (e.g. an explicit
   server-writer allowlist) so a future prefix change cannot silently exit it?
3. Is Leg 3's NTF-23 shrink accepted — that reserving the namespace collapses 23 from a pre-flip
   blocker to a carded consumer-side defense-in-depth item — or must the legacy `return_cached`
   acceptance test ship before the flip regardless?
4. Deploy split: is shipping Leg 2 (rules, deny-only) independently and ahead of Leg 1 (functions)
   acceptable, or must both land in one atomic push to avoid a window where one mouth is guarded and
   another is not?

---

## FOLDED FROM A PARALLEL DESIGN (2026-08-04) — reconciliation note

This doc was authored ~12:11. A second session independently redesigned the same fold ~12:20
(`20_ENGINE_NAMESPACE_RESERVATION.md`, now a superseded pointer) and reached the SAME three mouths and
the SAME `rv2_`-reservation decision — convergent, which strengthens the finding. **This doc is the
canonical union.** The parallel design's contributions, folded in here:

- **The retrospective proof ALREADY EXISTS** — the rv2-collision fold shipped
  `audit/deepfix/task3/live_baseline/rv2-docid-precondition-receipt.json`: a docId-PREFIX scan,
  **0 `rv2_` ids across 41,688 `attempts` and 16,732 `grading_jobs`** (read-only, vocaboost-879c2). So
  the reserved namespace is empty today ⇒ the fix holds RETROSPECTIVELY, on NTF-20's standard. The fold's
  C0 = RE-RUN it fresh immediately before the deploy (the corpus grows), not author from scratch.
- **RE2 semantics for Leg 2:** Firestore `matches()` is a full-string RE2 match, so the reserved-prefix
  test is `attemptId.matches('rv2_.*')` (not `^rv2_`), mirroring the existing `.matches('.*[Mm]anual.*')`.
- **"Denies nothing legitimate" is a PROOF obligation, not an assertion** (Leg 1 already flags it):
  `grep -rn "rv2_" src/` returns ONLY the `rv2_compose_invalid_day` LOG-event name — no client writes an
  `rv2_`-named doc — and legacy ids are `{uid}_{testId}_{nonce}` / `..._automarker`. Each leg carries an
  ALLOW-still-allowed fixture; a false-DENY that breaks a real student is the failure mode feared most.
- **Sequencing to the program's gates:** design → fold ledger (bypass-complete) → implement (delegated,
  impl + independent auditor) → WSL+Opus converge by re-execution → push (WinClaude order) → Codex FINAL
  GATE on the pushed sha, as a SET with NTF-23 → deploy is David's ACTIVATION authority under
  `17_DEPLOY_ORDER_REQUIREMENTS.md`. The rules-artifact protocol: `/app/firestore.rules` + the three
  baseline artifacts edited in lockstep (all four are sha16 `f40f91fce3693b82` today), harnesses extended,
  matrix re-run, AFTER-sha re-derived from the receipt.
- **The flip's abort card** (`21_DF2-14_FLIP_ABORT_CARD.md`) monitors this fold's write path directly:
  regression-signal R3 (attempt-write success) reddens if the namespace guards misfire on real students.

**Working fold ledger:** `_ledgers/namespace-reservation-fold-ledger.md` (gate `--plan` ACCEPTED),
structured as three guards G1(=Leg 2 rules)/G2(=M2 submitVocabAttempt)/G3(=M1 gradeTypedTest) — same
substance, one ledger rather than the two proposed above.
   subcollection