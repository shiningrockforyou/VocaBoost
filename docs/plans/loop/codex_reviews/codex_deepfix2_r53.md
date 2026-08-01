# Codex round 53 — implementation checkpoint 1

**Reviewed:** 2026-08-01  
**Round disposition:** **DONE**  
**Stage-1 implementation-authority disposition:** **NOT READY — NEEDS FIXES**

## Ruling

The checkpoint cannot freeze yet. Track B1 is not a write-comparison baseline, B2's reset-epoch result is
vacuous, H6 omits the completion/idempotency authority required by the carried contracts, the additive rules
artifact would break live/cached clients while the feature is dark, and H8's fairness result is false-green.

Track B production execution and the 25WT product rehearsal remain correctly deferred. The blockers are in the
stage-1 deliverables themselves.

## Per-item verdicts

| Item | Verdict | Ruling |
|---|---|---|
| 1. R2-38..41 ledger/fold | **NEEDS FIXES** | Core law is mostly carried, but the fold is not contradiction-free. |
| 2. Track A | **NEEDS FIXES** | A1/C2 are strong; A2 does not activate R2-10, and A1 leaves proof/validity unresolved. |
| 3. Track B | **BLOCKED FROM FREEZE** | B1/B2 can false-green and cannot support B4 expected-vs-actual. |
| 4. H6 | **BLOCKED FROM FREEZE** | Carried authority/concurrency contracts have no complete schema home. |
| 5. Rules | **BLOCKED FROM FREEZE** | The proposed lock is not inert and conflicts with current clients/anchors. |
| 6. H8 | **REJECTED** | Output is reproducible, but the model/oracle do not establish the claimed property. |

## Blocking findings

### R53-B1 — blocker — B1 is not an expected-state artifact; B2's epoch evidence is false-green

- `scripts/deepfix2/b1-expected-labels.mjs:85-108` computes per-word `{fc,lf,lc,lp,lt}` and discards it. The
  output has only aggregate/per-student counts (`:113-117`; sample JSON `:18-40`), so it cannot seed/compare five
  fields or supply B4 equality (`14_:42-55,69-80`; `11_:72-75`).
- B2 looks for reset markers on `users/{uid}` (`b2-database-investigation.mjs:101-109`). The real per-list
  tombstone is `users/{uid}/progress_meta/{listId}` with `{resetEpoch,resetAt}`
  (`functions/foundation.js:496-532,2047-2053,2110-2140`). Evidence checked zero students; zero orphans is
  vacuous. B1 reads no tombstone/epoch snapshot, so B3 cannot enforce `14_:73-75`.
- The ledger/addendum use the validity-checked **stored score >= 92** (`11_:39`; `10_:98-102`). B1 substitutes a
  row-derived score when row count equals `totalQuestions` (`:80-82`). Real backup records stored as 92 have a
  coherent 91.666... row fraction, so this materially changes labels.
- The r48 fence at `:57-78` is fail-open: fractional/non-finite totals, malformed rows, correctness types,
  duplicate word IDs, and some `rows.length > totalQuestions` cases are not rejected. Duplicate identity ignores
  class/content and a conflict excludes only the later doc. A real record with 31 rows/denominator 30/30 correct
  is accepted.
- Required per-class/per-signature exclusions are only global counts; missing timestamp/list records are silently
  skipped. The blank undercount is honest directionally, but malformed rows are conflated with blanks.

Required closure: repair B2 against real tombstones; define eligible graded attempts; make r48 validation fail
closed; preserve stored-score-at-92 after validation; emit the actual per-word five-field baseline with
epoch/config/watermark metadata and auditable exclusions; rerun/review the sample before any full run.

### R53-B2 — blocker — H6 lacks exactly-once completion and replay-safe presentation authority

DF2-14 requires queue, presentation, **and completion** schemas/transactions. `15_` has no authoritative
completion record, hence no home for one advance + one graduation, winner/loser CAS, consumed-attempt/source-config
audit, completion resetEpoch, or cross-class evidence consumption. A2 confirms the current client can rerun
graduation after `already_completed` (`A2_:42-50`).

`{queueId}_p{seq}` promises a monotonic sequence (`15_:35`) while compose replay promises an existing record
(`:77`), but no counter or compose idempotency key distinguishes a lost-response replay from a new retake.
Additional missing homes:

- `{count,lastAt}` cannot enforce same-visit BOTH-tests/each-attempt-once (`15_:64`);
- every-attempt effective posture/configVersion is absent, especially for new-word tests with no queue pointer;
- cached-client min-version/adapter negotiation has no config/response field;
- active/resting selection uses client-writable `status/masteredAt/returnAt`, while H6/rules lock only five fields.

Required closure: freeze completion/CAS and audit records, presentation replay keys/counters, restudy visit/pair
claims, posture/config stamps for every type, cached-client negotiation, and server authority for all pool inputs.

### R53-B3 — blocker — the rules artifact is activation-independent breakage

`firestore.review_v2.rules:6` says clauses are inert until new fields exist. `lastTestedAt` already exists and old
clients write it at `studyService.js:771-785` and `db.js:2971-2982`. The unconditional exclusion at artifact
`:14-21` would reject those owner writes even under `enabled:false`, including cached bundles.

The blanket `allow write` diff must be split by create/update/delete; current rules document why at
`firestore.rules:143-180`. Clause 6 targets an attempts UPDATE branch already set to `allow update: if false`
(`firestore.rules:303-314`), so no additive merge exists. The artifact also says grading jobs have no client
access, while owners can read them (`firestore.rules:340-347`); the safety of new rows/full writeContext must be
decided.

Required closure: author exact op-split clauses against current rules; coordinate existing-field migration with
cached-client fencing; protect/disposition active/resting authority fields; correct the attempt and grading-job
claims; freeze emulator cases for existing owner creates/updates/deletes, cached bundles, and denial paths.

### R53-B4 — blocker — H8 does not establish a hard fairness bound

The saved output reproduces, but its oracle is unsound:

- comments claim B1 input (`h8-final-values-resim.mjs:9-10`), but all words start zero/null (`:34`);
- configured queue size is always 60 (`:15`), so size changes are absent;
- the queue is rebuilt every outer day (`:38-57`) even when `studyDay` is walled (`:95-96`), allowing pool
  mutations to violate the pinned day queue;
- only words seen more than once and truthy recorded gaps enter the oracle (`:117-130`), omitting never/once-seen
  and initial/terminal starvation;
- random remainder selection (`:64-67`) can omit an unproven-unfailed word forever, so no deterministic
  `<=2*ceil(LIST/QUEUE)` bound follows;
- `RETAKE_CAP=5` contradicts the uncapped policy, and one seed/scenario is not proof. The handoff also overstates
  its output: band 70/R=2 advances two days.

Required closure: either adopt deterministic bounded service or owner-ratify a probabilistic SLO. Then ingest B1
per-word state, preserve pinned queues, exercise config-size/equal/missing-clock cases, count censored/starved
words, remove the artificial cap, and run adversarial/multi-seed sensitivity. Do not gate on the present 12/12.

## Track A and fold findings

### A1 — investigation passes; contract fold still needs fixes

The audit is strong: today's override is synthetic, `teacherEdited` needs new metadata, gradebook readers would
show score/row contradictions, engagement readers exist, and stale submit returns `day_guard_rejected`.

1. `teacherEdited` intentionally creates score-vs-rows disagreement. Validate the organic score through
   `preOverride`, retain row fail/correct facts, classify the edit separately, and never retroactively mint
   proof/graduation. A1 flags this at `A1_:71-73,119,129`; B1 does not carry it.
2. `11_:66` expects override-then-real-pass to yield one graduation and one advance. A1/code establish the
   grade-only override advances with no retroactive graduation and stale submit is rejected. Freeze one advance
   + zero graduation and assert no client graduation on `already_completed`.

### A2 / R2-10 — do not activate

A2 refutes absolute immunity and certifies only continuous-tab presentation membership. It finds live
graduation/rebuild/re-pin windows and a `MASTERED -> PASSED` challenge edge that prematurely un-retires a word.
The redesigned queue pins membership, but challenge labels can still alter later strata/fill eligibility.

Keep R2-10 deferred until the narrow theorem is normative, MASTERED/challenge behavior is prohibited or accepted,
challenge-label-vs-graduation ordering is transactional, and B1 replays accepted adjudications correctly. Owner
confirmation follows that corrected certification, not this draft.

### A3 and C2

- A3's mechanisms are useful, but `change_action_log.md:1368` overstates *shortfall explained*: its three cohort
  probes were specified, not run. Say mechanism explained / cohort attribution unproven, and disposition the
  standalone 1.4x pace path and MCQ/typed retake asymmetry.
- C2's query-layer default-OFF rerun exclusion is correctly folded; post-filtering would break pagination. Its
  remaining layout choices are non-blocking for implementation authority.

## R2-38..41 fold residue

- DF2-14 CERT still names `LIST-END + CYCLING` and `cyclingEnabled/cyclingSourceClassId` (`02_:95`) although
  R2-39 retires them (`11_:34`; `02_:130,158,171`). Keep list-end + `nextListId` only.
- Governing ranges stop at R2-37/38 in `00_ORIENTATION.md:8`, `10_:3`, `02_:91`, and `11_:79,84-90`.
- Define `queueSize_effective` as the actual pinned queue after underflow top-up, not pool-size-only wording.

These are smaller than B1-H8, but must close before calling the contract frozen.

## Adjudications

### B1-Q1 — YES: uniform historical 92 for both attempt types

Use one 92 bar across all eligible graded new/review attempts, including supported reruns. Apply r48 validity
first, then the binding stored-score-at-92 rule. Per-type historical thresholds add provenance branching the owner
declined.

### B1-Q2 — YES: seed `lastTestedAt` from review-type history only

Seed/replace it with the latest valid review-type attempt containing the word, including review reruns; never use
new-word attempts. Freeze/report the no-review-history behavior rather than silently preserving the legacy
all-type clock. Amend `14_:63-65` to say review-type explicitly.

## B1 `--full` safety ruling

**Do not run it pre-freeze.** It has no Firestore writes, but overwrites local evidence and can false-green: a
literal invocation with `--full` first treats that flag as the class regex (`:29-31`), selects zero students,
labels the run FULL, and writes the artifact (`:116-117`). Correctly positioned arguments still produce the
wrong/non-comparable baseline.

## What I verified

- Validated baton revision 178 and the matching round-53 marker.
- Read the handoff, governing plans, Track A, Track B, H6, additive rules, actual `firestore.rules`, and callers.
- Ran `node --check` on B1, B2, and H8.
- Reran H8 in an isolated workspace temp directory; its 12 rows reproduced, then temp files were removed. No
  Firebase mutation and no Playwright audit were run.
- Reconciled three independent read-only review lanes against the code before ruling.

## Closure gate

The next checkpoint should show a corrected B2/B1 sample, completed H6 authority schemas, merge-correct rules,
a non-false-green H8 model or owner-ratified fairness-law change, the A1/R2-10 adjudications, and fold cleanup.
Only then can stage-1 implementation authorization be declared.

## Baton update

Review complete. Hand back with `codexDecision: DONE`; this means the checkpoint review is finished, not that
stage 1 is authorized.
