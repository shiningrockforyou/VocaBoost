# Codex round 56 — stage-1 freeze re-verification

**Reviewed:** 2026-08-01  
**Round disposition:** **DONE**  
**Stage-1 implementation authority:** **NO — NEEDS FIXES**  
**B1 `--full`:** **NO-GO**

## Ruling

Round 56 makes several real corrections, but the second freeze attempt is not clean. The strongest failure is
the claimed H8 zero-violation result: the binding R2-46 ledger counts a day when the test has at least one
remainder slot, whereas H8 silently replaces that binary day with the fraction `remainderSlots / testSize`.
The saved advancing `b70_85` launch-seeded run has calendar exposure 42, bound 40, and `saturationDays: 0`;
therefore every day qualifies under the ledger and the result is still 42 > 40. It becomes 34.6/green only under
the new fractional oracle, which does not appear in the owner-decision record.

B1 also remains unable to create an adjudication-aware baseline: it reduces accepted challenge mutations to the
final answer state and replays that state at the original submission time. Its `mutationRisk` counts cannot
apply R2-43 or reconstruct the missing event order, and there is no executable B3/B4 reconciliation yet. The
graded fence accepts missing/non-boolean `graded`, the current `/26SM/` selector includes known 25WT test
classes, and the resting bootstrap still converts recent client-writable `masteredAt` into server truth after
only an any-history check.

H6/rules direction improved, but the newly authoritative `restudy_visits` collection is absent from the rules
guard and reset cleanup; presentation fingerprints are required but not stored; new/rerun sequence allocation
is not concurrency-safe; and reset ownership/retry semantics are still unspecified.

## Requested gate verdicts

| Gate item | Verdict | Independent result |
|---|---|---|
| B1 v4 / full-run safety | **MISS / NO-GO** | Manifest and CLI work closed, but mutable adjudications, grading eligibility, resting bootstrap, and cohort scope remain unsafe. |
| B2 | **PARTIAL** | The saved cadence sample is honestly uncapped; future capped cadence is unordered and the six-field collision scan is incomplete. |
| H6 contracts | **MISS** | Important direction is fixed, but reset, restudy authority, presentation identity, allocator, and evidence-shape contracts remain incomplete. |
| Rules v3 | **MISS** | Six label fields/config/metrics are guarded; `restudy_visits` is still owner-writable under the base rule. |
| H8 v4 | **REJECTED AS FREEZE EVIDENCE** | Deterministic, but its zero-violation result depends on an unratified fractional oracle and weak/synthetic launch-state ingestion. |
| R2-46 fold | **MISS** | The governing binary remainder-day wording and H8's fractional service clock are different contracts. |
| R2-10/R2-44/R2-45/ecosystem folds | **PARTIAL** | Core late decisions are visible, but implementation inputs retain contradictory challenge, language, pip, reset, and rule text. |

## B1/B2 — full remains a no-go

### Real closures

- The parser rejects malformed positive integers, empty cohort values, unknown flags, bare `--full` without an
  explicit cohort, and false full values (scripts/deepfix2/b1-expected-labels.mjs:50-61). I reran the negative
  CLI cases; all exited 2 before Firebase initialization.
- Output now carries all six expected values, including `rru` (:227-239), and Track B's B3 write set names all
  six server fields (14_TRACK_B_BACKFILL_PIPELINE.md:78-86).
- Per-reason publication is now counts rather than a capped row list (:81-94).
- JSONL and summary use temporary files and renames; the manifest is published last and binds both with SHA-256
  (:253-280). The saved JSONL and summary independently match manifest hashes
  `16351b71ca8d27c0395c1132319092c1514f089bf86446fbf39333e83af0ea48` and
  `09195fcb889c2433724d6b64bbe2228de73919cbdadc5b72519d9cdbca5c7409`.
- Stored-score-at-92, duplicate groups, and teacher-edit/pre-override handling remain present.
- B2's current cadence result is not cap-biased: the maximum sampled attempts per student is 108 against
  `ATT_CAP=300`. Its warning about future unordered samples is honest (b2:57,90-96,137).

### Blocking misses

1. **The challenge mutation boundary is still not durable or replayable.** The watermark remains workstation
   `Date.now()` and eligibility remains `submittedAt < watermark` (b1:78,121,128-131). Accepted challenges
   mutate answers/score/passed in place without moving `submittedAt` (src/services/db.js:2900-2947;
   functions/foundation.js:2592-2627). A challenge after that student's read is invisible to the artifact.
2. **`mutationRisk` is not an event baseline.** It counts only currently pending, adjudicated-at/after-watermark,
   or unknown-timestamp rows (b1:124,165-174). Rows are then reduced to `{wordId,ok}` and replayed at the
   original attempt time (:154-179,195-206). An accepted pre-watermark challenge silently mints `lc`/`lp` at
   submission time and cannot honor the resting-at-acceptance guard. The saved sample reports 19 risk students
   and 67 pending rows but zero post-watermark/unknown events; it contains no count or identity for historical
   accepted/rejected events.
3. **The promised B3/B4 absorption is prose, not an executable protocol.** `scripts/deepfix2/` contains only B1
   and B2. Track B says B3 re-reads flagged students and B4 covers post-watermark adjudications
   (14_:56-60,91-96), but supplies no mutation cursor, affected-attempt/word identity, deduplication rule, or
   rebaseline/delta ordering. A mutation visible to B1 can already be folded into its final-state labels and
   then be seen again by a later delta. The binding checklist still correctly leaves R2-10 condition (iv) open
   (11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:72,77).
4. **The graded fence is fail-open.** `if (a.graded === false)` accepts missing, null, zero, empty-string, and
   other malformed values (b1:135-137). B2 found the field on only 1,182 of 1,185 sampled attempts, so this is
   exercised data, not a theoretical shape. `manualOverride` is not an explicit exception to an exact
   `graded===true` predicate; it is used only to classify blank undercount (:179,190-192).
5. **The resting bootstrap still launders client authority.** Current/base rules let an owner write legacy
   `masteredAt`, and the additive rules intentionally retain that access (firestore.rules:202-216;
   firestore.review_v2.rules:15-21). B1 accepts any `masteredAt` inside 21 days when the bare word id appears in
   any eligible historical row (b1:209-221). It does not require a passing/proven attempt, a matching mastery
   transition, a list-specific event, or server graduation evidence. A forged recent timestamp on any
   once-attempted word therefore becomes server-owned `reviewRestingUntil`. One study-state word id is also
   copied to every matching `listId|wordId` key (:214-221).
6. **The resting rejection count is incomplete.** The Firestore query prefilters to `masteredAt > cutoff`
   (:212-213), so old/stale mastered rows never reach `rruRejectedStale`. Track B's claim that anything else is
   rejected and counted (14_:83-85) is false for the stale population.
7. **`/26SM/` is not an exact cohort boundary.** Class selection is an unanchored regex over names
   (b1:55,68-75). Repository evidence contains classes such as `25WT DUP REPRO 26SM SAT ...`
   (graduation-validity-26SM.json:5418-5422,5446-5450,5907-5911). The saved selector returned 960 users, and at
   least two known test-class users entered the 50-row B1 sample. Requiring the user to type some regex does not
   prove exact cohort membership. Full mode needs an exact class-id/allowlist boundary plus expected class and
   student counts. Supplying `--limit` with `--full` is also silently accepted then ignored (:61).
8. **Signature counts are not usually keyed by the published attempt signature.** Most fence failures are
   counted under class/list/type or class/unknown keys (:128-164); the full class/list/day/type/timestamp
   signature is not built until :175. Counts therefore collapse distinct attempt signatures despite the plan's
   per-signature requirement.
9. **B2 is not six-field complete.** Its study-state collision scan checks only the original four labels
   (b2:105-106), omitting `reviewLastTestedAt` and `reviewRestingUntil`; the study-state sample is capped at 500
   (:98). Its capped attempt query also still lacks `orderBy(submittedAt)` (:57), so the qualifier must remain.

The read itself would not write production data, but `--full` would publish a misleading candidate baseline and
feed H8/B3 decisions. That is sufficient for **NO-GO**.

## H6 and rules — freeze remains incomplete

### Real closures

- All six label fields are denied on client create/update/delete, including erasure
  (audit/deepfix/task3/firestore.review_v2.rules:29-54).
- `system_config/review_v2` is a literal client-read/server-write document (:67-73).
- `ops_metrics` is correctly specified as server-write-only/teacher-readable and the H6 text rejects
  client-creatable `system_logs` as authority (:81-85; 15_H6_SCHEMAS_AND_CONTRACTS.md:133-137).
- The exact client-version predicate is now explicit (`!Number.isSafeInteger(v) || v < min`) (15_:147-155).
- Canonical list-order tie-breaking, anchor/generation on queue/completion, exact grading-job uid equality, and
  per-visit set-once/CAS direction are all stated.

### Blocking misses

1. **`restudy_visits` is not protected.** H6 adds
   `users/{uid}/restudy_visits/{visitId}` as server-owned CAS authority (15_:117-124), but all three rules
   exclusion lists, the collection inventory, and emulator matrix still name only five new subcollections and
   omit it (firestore.review_v2.rules:18-19,29-64,108). The base generic owner rule therefore permits a student
   to create/update/delete visit halves or `completed` (firestore.rules:202-216), defeating the pip CAS.
2. **Reset does not reach or fence the visit authority.** The cleanup list omits `restudy_visits`, and the visit
   shape carries no `resetEpoch` (15_:123,170-179). Old claims are neither epoch-tagged nor safely
   epoch-derivable. The same section calls cleanup stale-epoch-only while `streak_credits` and
   `restudy_completions` also lack an explicit epoch in their listed shapes.
3. **The reset lock has no operation ownership.** The contract sets `resetInProgress`, cleans, then clears it,
   but does not reject/serialize a second reset, stamp a `resetOperationId`/target epoch, clear-if-owner, or
   define crash/retry recovery (15_:170-179). Two resets can bump twice and the first can clear the lock while
   the second is still deleting, reopening the race the lock was meant to close.
4. **The compose fingerprint is required but not stored.** Replay compares
   `{sessionType,testType,kind,visitId}` (15_:49-55), while the presentation field schema omits `sessionType`,
   `kind`, and a request-fingerprint object (:56-58). This also leaves no frozen server field for deciding which
   restudy half an attempt may claim. The fallback enum says its seed is recorded (:67-69), but no seed field is
   defined.
5. **The hash contract contradicts itself.** H6 first requires JSON serialization for all three hashes
   (:43-44), then defines `presentationHash` with collision-prone `presentedWordIds.join(',')` (:58).
6. **The new/rerun sequence allocator is not concurrency-safe.** A per-identity count query followed by create
   lets two distinct compose keys both choose `N+1` (:63-65,70-74). Unlike queue presentations, there is no
   counter document to serialize them. Firestore's Node transaction retry set does not include the resulting
   `ALREADY_EXISTS`, and retry responses define no collision recovery (15_:160-166).
7. **The evidence-kind matrix is not exhaustive at intersections.** `gate_off_autopass`,
   `list_end_review_only`, and `first_day_new_only` specify overlapping null shapes, then reject every other
   combination (15_:84-93). Gate-OFF plus list-end legitimately yields both attempt ids null but has no kind;
   day/gate preconditions also do not disambiguate first-day and gate-off null review evidence.
8. **Grading-job quarantine is named but not executable.** Exact `job.uid === caller.uid` is clear, but the only
   quarantine reference is 15_:139-143. No quarantine status/schema, scan owner, idempotency rule, or Track-B/
   DF2-12 work item exists. Current code's acknowledged missing-uid fail-open therefore has no complete migration
   contract yet (functions/index.js:935-938,1566-1569).

## H8 / R2-46 — zero violations is a false green

1. **H8 tests a different fairness law from the binding ledger.** R2-46 says the bound counts a day when
   `priorityCount < effectiveTestSize`, i.e. at least one remainder slot; the addendum repeats “remainder-slot
   days” (11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:37-38;
   10_REVIEW_GRADUATION_REDESIGN.md:59-61). H8 instead increments `effClock` by
   `remainderSlots / TEST` (h8-final-values-resim.mjs:85,124-128) and tests fractional gap against the bound
   (:203-205). The discussion trace's owner ruling records the full-saturation bounded exception/no guardrail,
   not a proportional discount for partial priority (12_R2_DISCUSSION_TRACE.md:116). The fractional law appears
   only in the round-56 fold/handoff.
2. **The saved artifact still violates the binding law.** The advancing `b70_85`, reruns=2, seed=2,
   launch-seeded case reports daysAdvanced=119, calendar max=42, bound=40, `saturationDays=0`, fractional
   max=34.6, holds=true (h8-resim-results.json:1792-1823). Since `saturationDays=0`, every day had at least one
   remainder slot and counts under the ledger. The governing result is 42 > 40. David may ratify the fractional
   service-capacity clock, but absent that decision the freeze cannot substitute it.
3. **The output describes yet another oracle.** `fairnessLaw` says
   `holds = maxGap <= bound + saturationDays`, while code uses fractional `maxGapEffective <= bound`
   (h8 script:203-205,220). `fairnessBoundNote` still cites an old peak of 48 though current seeded max is 42
   (:221).
4. **Manifest verification is not schema validation.** H8 verifies only the JSONL hash and that it yields more
   than 1,000 values (:38-48). It does not validate manifest probe/version/mode/watermark, the summary hash,
   uid/word uniqueness, six-field presence/types/ranges, or clock invariants. A correctly hashed JSONL of empty
   word objects proceeds through all 60 scenarios instead of refusing.
5. **The launch seed remains synthetic.** It discards uid/list/key/canonical wordIndex, samples word tuples with
   replacement from the entire cohort, and applies the same global distribution to every ability band
   (:42-47,67-80). Within-student/list correlations and the relationship between labels, list position, and
   introduction age are lost. H8 tie-breaks on synthetic `w.i`, not canonical B1 word order (:67,119-123).
6. **`rru` is randomized, not mapped.** Every non-null real deadline becomes a uniform random day 0..20, and
   the manifest watermark is unused (:81). The 9,379 saved resting values have real remaining durations; H8
   fabricates day-zero returns and destroys their relationship to label clocks. Return-slug and underflow
   results are therefore not B1 launch truth.
7. **Effective-size/fallback coverage is absent.** Presentation shrinks implicitly for a small queue, but
   `remSlots` is computed against constant `TEST=30`, so queue<30 with no priority is credited 30 service slots
   even when fewer were offered (:123-127). H8 has no post-compose invariant assertion or fallback scenario,
   despite publishing the effective-size/fallback law as resolved (:220). All six scenarios with any full
   saturation are walled/N/A; no advancing saturation-drain case exercises the bounded exception.
8. **Underflow/graduation accounting is wrong.** Resting top-up words can enter `grads` and consume its slice,
   their rest write is skipped because they are already resting, but `liveGrad += grads.length` still counts
   them (:105-108,146-157). Eighteen saved scenarios exercise underflow. Rerun sampling also uses
   engine-sensitive/non-uniform `sort(() => rnd()-0.5)` rather than a deterministic shuffle (:163-165).

The script is reproducible, not correct evidence: rerunning it produced the same SHA-256
`888da6c79feacb574caa7b072e8e32e5eef5ddd72d072a50082c74623beb540c`, 60 scenarios, and zero failures only
under its own fractional oracle.

## Fold consistency

- **R2-10 remains inconsistent.** 10_:5-6 and 11_:72 carry (i)(ii)(iii) closed/(iv) open, but the ledger header/
  row still says activation follows A2 certification (11_:7,16,65), and 02_:300 keeps the same shorthand.
  More importantly, 11_:77 requires B1 to be adjudication-aware, which v4 is not.
- **R2-44 remains contradictory.** 00_ORIENTATION.md:27 starts “ENGLISH-ONLY” then requires a “bilingual reason
  + next step”; R2-15 still says the teacher labels are ko/en (11_:31). The active C2 implementation input still
  recommends bilingual new states/teacher labels and calls the decision open
  (trackA/C2_UI_CALIBRATION.md:7,77-90). ARCH:548 and 01_:91 are genuinely fixed. The referenced
  `06_MESSAGING_COPY.md` still does not exist.
- **R2-45 is fixed in the governing ledger but not in implementation guidance.** 11_:35 clearly supersedes
  hover/long-press with static `xN`; C2_UI_CALIBRATION.md:31,69-71,90 still designs and asks for the old reveal.
- **Six-field wording remains stale.** Track B emits six values but calls them a five-field baseline and earlier
  says the write set is five (14_:61-64,74-76), before correctly naming six at :82-86. The B1 header repeats
  five-field (b1:11-12), and DF2-14's rules-lineage prose still says four protected labels (02_:95).
- **Telemetry remains contradictory.** Binding R2-42 still names a `system_logs` event (11_:38), while H6 and
  DF2-14 correctly require `ops_metrics`; `system_logs` remains client-creatable (firestore.rules:334-337).
- **Reset remains stale in the governing addendum.** 10_:102-105 still says delete then bump epoch, contradicting
  H6's lock-first reset.
- **B2/cycling/range residue remains.** Track B still calls the unordered capped query a recent-cadence measure
  (14_:38); 01_SOURCES.md:95-96 says the retired cycling F2 question survives; and 11_:84/90 still call R2-1..41
  complete/current in live fold directives. These are lower severity than the authority failures but disprove
  the claimed complete sweep.

## Exact closure gate

1. Reconcile R2-46 with the owner: either ratify and fold a fractional service-capacity clock everywhere, or
   restore the binary remainder-day oracle and close its 42 > 40 advancing failure. Add advancing partial/full
   saturation cases, effective-size edges, invariant/fallback tests, and correct underflow accounting.
2. Give B1 an event/update-aware server boundary and executable adjudication reconciliation carrying affected
   attempt/word ids and review timestamps; enforce exact graded shapes; validate resting from authoritative
   evidence rather than any history; and use an exact cohort allowlist with expected counts.
3. Add `restudy_visits` to rules/emulator/reset/epoch contracts; make resets operation-owned/recoverable; persist
   the full compose fingerprint and fallback seed; serialize all hashes canonically; and use a contention-safe
   allocator plus a truly exhaustive evidence matrix.
4. Reconcile the remaining R2-10/44/45, six-field, telemetry, reset, cycling, and range implementation inputs.

Only after those changes should B1 `--full` be reconsidered.

## What I verified

- Validated baton owner/round/revision `codex/56/184` and the complete matching marker/handoff.
- Read the changed plans, B1/B2, local baseline/manifest/summary, H6, additive and base rules, challenge writers,
  H8 script/results, and ecosystem folds.
- Ran Node syntax checks for B1, B2, and H8; all passed.
- Reran H8 and confirmed byte-identical output hash
  `888da6c79feacb574caa7b072e8e32e5eef5ddd72d072a50082c74623beb540c`.
- Independently verified both B1 manifest hashes, the strict negative CLI cases, the H8 scenario counts, the
  binding-oracle 42 > 40 case, and the relevant base-rule allow paths.
- Reconciled three independent read-only review lanes. No production Firebase operation, B1 full run,
  Playwright audit, or product-code edit was performed.

## Baton update

Review complete. Hand back with `codexDecision: DONE`; this means the round-56 review is complete, not that
Stage 1 or B1 full is authorized.
