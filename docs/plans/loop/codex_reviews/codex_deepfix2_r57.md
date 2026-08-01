# Codex round 57 — stage-1 freeze re-verification

**Reviewed:** 2026-08-02  
**Round disposition:** **DONE**  
**Stage-1 implementation authority:** **NO — NEEDS FIXES**  
**B1 `--full`:** **NO-GO**

## Ruling

I accept the owner-level R2-47 decision as stated: the numeric exposure-clock promise is retired, the round-56
binary-versus-fractional dispute is therefore no longer a governing gate, and the H8 timing values are only
monitoring baselines. This review does not revive R2-46's former numeric oracle.

The replacement structural certification is not, however, established by the submitted artifact. H8 calls an
advancing run cyclic when, after 120 simulated days, each introduced word has **ever** been queued **or is
currently resting or has any proof timestamp**. That is not a check that rotation reaches every pool word in
each cycle. A proved word that was never selected satisfies it solely through `lp !== null`, and a resting word
satisfies it without any rotation visit. The claimed arithmetic unit fixture is not present in the repository.
Thus R2-47 is not misstated as a numeric promise, but its new structural launch claim is false-green evidence.

Round 57 also makes real B1 and rules improvements, but the authority gate still has independent blockers. B1
cannot yet publish an adjudication-complete expected baseline, still promotes client-writable mastery into
server resting state, and has no reviewed full-cohort allowlist. H6's allocator and reset contracts remain
concurrency-unsafe: the counter schema is incomplete and contradicted by the retained count-query instruction,
compose-key uniqueness is not transactionally serialized, and the reset acquisition is described as a batch
write that cannot reject concurrent reset callers.

## Requested gate verdicts

| Gate item | Verdict | Independent result |
|---|---|---|
| R2-47 decision | **ACCEPTED** | The numeric clock is retired. I do not use R2-46's old numeric bound as a gate. |
| R2-47 structural certification / H8 v5 | **MISS** | The code checks an end-of-run `everQueued OR resting OR proved` predicate, not per-cycle rotation coverage; no claimed arithmetic fixture exists. |
| B1 v5 / full-run safety | **NO-GO** | Allowlist and fence mechanics improved, but mutation closure, expected-label authority, and exact execution scope remain unresolved. |
| B2 | **PARTIAL / NON-BLOCKING HERE** | The six-field collision predicate is fixed; this does not cure B1/B3/B4 correctness. |
| H6 contracts | **MISS** | Counter, compose-key, reset, evidence, and quarantine contracts are not implementation-complete. |
| Rules v4 | **DIRECT-AUTHORITY CLOSURE REAL; FREEZE STILL MISS** | All seven subcollections are now protected, but the server transaction/reset contract that uses them remains unsafe. |
| Ecosystem folds | **PARTIAL** | Several late decisions are folded, but binding implementation inputs still contradict R2-44, R2-47, the six-field baseline, and counter/reset text. |

## B1/B2 — full remains a no-go

### Real closures

- The challenge scan now occurs before the attempt fences
  (`scripts/deepfix2/b1-expected-labels.mjs:133-160`), so a currently challenged excluded attempt is at least
  recorded as mutation exposure.
- Eligibility now fails closed on `graded !== true`, with an explicit manual-override exception (:158-160).
- Full mode requires `--classAllowlist=FILE`, rejects `--limit`, resolves exact class document IDs, and aborts
  on missing IDs or an empty resolved student set (:50-86). I reran the missing-allowlist and full-plus-limit
  cases; both exited 2 before Firebase initialization.
- B2's study-state collision predicate now covers all six label fields
  (`scripts/deepfix2/b2-database-investigation.mjs:105-106`).
- Temporary-file/rename publication and last-written manifest hashing remain real. The current v5 sample's
  JSONL and summary independently match the manifest hashes
  `fae439d371d89f159a79da580ea0276bd6a8928a9dfa4e3e83e4465801c4ed57` and
  `7f6bcf35d87ce12226ff4212d50b76bc2f4132999b6015e86e180dcc05da0f3f`.

### Blocking misses

1. **The claimed B3/B4 mutation protocol was not folded or implemented.** The handoff says Track B defines
   re-reading all flagged students and union-comparing that set with new attempts. The actual Track B text
   still has only the old generic pending/post-watermark statements
   (`14_TRACK_B_BACKFILL_PIPELINE.md:56-60,91-96`). It defines no affected-attempt cursor, adjudication cursor,
   `challengedAttemptIds` consumption, union/deduplication order, or rebaseline-before-delta rule. There is no
   B3 or B4 script under `scripts/deepfix2/`.
2. **The published mutation summary omits known affected students.** B1 records `adjudicatedTotal` and up to
   200 attempt IDs (:133-147), but increments `mutationRiskStudents` only for pending, post-watermark, or
   unknown-timestamp cases (:265). Independent aggregation of the saved JSONL finds 22 students with a
   challenged attempt while the summary reports 19; three historical-adjudication-only students disappear
   from the advertised risk count. The 200-ID cap has no total or truncation marker. A challenge submitted and
   adjudicated against an old attempt after that student's B1 read can also evade both the saved-ID set and the
   new-attempt delta because `submittedAt` does not move.
3. **R2-10(iv)/R2-43 is still not reconstructable.** Accepted challenge rows are reduced to final
   `{wordId,ok}` answers and replayed at the attempt's original submission time (B1:176-220). They do not carry
   an adjudication event time into the label replay, so a later accepted answer can still mint `lc`/`lp` at the
   wrong point in history. Calling this a Stage-2 B3 prerequisite does not make the B1 expected baseline safe
   to publish or consume now.
4. **The manual-override exception is broader than the named synthetic shape.** Any attempt with
   `manualOverride === true` bypasses the exact graded fence (:158-160), including a malformed or unrelated row
   with nonempty answers. The code does not require the known empty-anchor/manual-pass shape before allowing
   that exception to influence replay (:192-220). An exception to a fail-closed grading predicate must validate
   the whole authoritative synthetic shape, not one boolean.
5. **RRU still launders client mastery into server authority.** The additive rules deliberately retain owner
   write access to legacy study state. B1 now requires that the bare word appeared in an eligible review test,
   but it still accepts client-writable `masteredAt` as the event establishing the 21-day rest window
   (B1:222-240). It does not bind the timestamp to a passing review, an authoritative graduation, or the
   transition that mastered the word. A student can therefore forge a recent timestamp for a previously
   review-tested word and seed server-owned `reviewRestingUntil`. Conversely, legacy fill-graduated words can
   be validly mastered without being directly review-tested and are rejected. Mapping a bare word ID across
   matching list keys adds another identity ambiguity. The saved sample seeds 7,084 resting labels.
6. **The RRU evidence count fails open.** The expired-row aggregation is wrapped in an empty `catch {}`
   (B1:228). A denied, failed, or unsupported aggregation silently yields a complete-looking count, including
   zero. Publication evidence must fail closed or expose a typed incomplete/error state.
7. **Exact allowlist support is a mechanism, not approval for this full run.** No reviewed target-cohort
   allowlist artifact, expected class count, expected student count, or roster reconciliation exists in the
   repository. The saved v5 evidence is still regex sample mode and its manifest lists 51 matched classes,
   including many `25WT AUDIT ... 26SM` and `25WT DUP ... 26SM` test classes. H8 consumes that sample. Until the
   exact allowlist and expected census are reviewed, B1 `--full` has no approved target input.
8. **Most exclusion counts are still not per actual attempt signature.** The full
   class/list/day/type/timestamp signature is created only at B1:188. Earlier exclusions use class/list/type or
   still coarser keys (:153-187), collapsing multiple attempts while Track B promises per-signature evidence.
9. **Plan/source drift remains operationally significant.** The B1 header still says `graded===false`, any
   eligible history, regex cohort usage, and a five-field artifact (B1:1-12). Track B still calls the output a
   five-field baseline and says `masteredAt` plus eligible attempt history
   (14_:63-85). These are precisely the instructions a later B3/B4 implementation would follow.

The proposed full run is read-only against production, but it would publish authoritative-looking expected
labels that downstream H8 and backfill work are instructed to trust. That remains sufficient for **NO-GO**.

## H6 and rules — direct locks fixed, transaction authority not frozen

### Real closures

- All seven new subcollections — queues, presentations, day completions, streak credits, restudy completions,
  restudy visits, and review counters — are now excluded from generic owner writes on create/update/delete and
  included in the rule matrix (`audit/deepfix/task3/firestore.review_v2.rules:30-68,105-112`). This closes the
  round-56 direct client-write hole.
- Restudy visits, restudy completions, and credits now carry reset epochs
  (`15_H6_SCHEMAS_AND_CONTRACTS.md:128-131`).
- Presentation persistence now includes the request fingerprint and fallback seed, and uses JSON serialization
  for the presentation hash (:49-61).
- `gate_off_list_end` exists, and the evidence-kind matrix is materially better (:88-99).
- The reset text adds operation ownership, target epoch, TTL/takeover, owner-clear, and both tombstones
  (:178-189). Those are the right pieces even though acquisition is not yet executable safely.

### Blocking misses

1. **The counter allocator is not a frozen schema or algorithm.** H6 introduces
   `review_counters/{identity} {next}` (:66-69), but does not define `identity`, its uid/list/day/epoch fields,
   initial value, allocate/increment/return order, or retry response. Reset later calls counters epoch-tagged
   even though the listed schema has no epoch. The normative rerun paragraph still says sequence comes from a
   per-identity **count query** (:74-78), directly contradicting the claimed counter-document fix. The rules
   also point to a nonexistent H6 §6e.
2. **Compose-key uniqueness remains racy across identities.** The transaction queries `(uid, composeKey)` and
   otherwise locks only the queue/counter identity (:49-55,66-69). Two concurrent calls reusing the same
   compose key against different identities can see no existing row, lock different counter documents, and
   both commit. Replay can then find multiple matches despite the promised mismatch refusal. A deterministic
   server-owned compose-key claim/registry document, or an identity derived from the key, must serialize this
   uniqueness invariant.
3. **Reset acquisition cannot meet its own concurrency law as a WriteBatch.** H6 says the first step is “ONE
   batched write” to both tombstones with `resetEpoch:+1` (:178-181). A WriteBatch cannot transactionally read
   the current locks/epochs, reject a live second reset, or derive one absolute `max(both epochs)+1` target.
   Two callers can both pass a precheck and overwrite the ownership fields. Acquisition must be a transaction
   that reads and fences both tombstones, writes one identical absolute epoch/owner, and only then cleans.
4. **The all-operation reset fence is not actually exhaustive.** The guard list names grading claim and
   challenge accept but not grading finalize/write recovery or force-pass/override mutations (:182-193). Any
   operation capable of committing authority after cleanup must re-read the same epoch and owned reset lock in
   its final transaction. The later repeated cleanup list also omits visits and counters after the earlier list
   includes them (:184-191), leaving contradictory runbook instructions.
5. **Evidence auditing is still ambiguous at important intersections.** The matrix does not bind
   `consumedAttemptClassId` to `consumedAttemptId`, or require an unambiguous source class/config/queue proof for
   gate-OFF auto-pass where the consumed attempt is intentionally null. Standard/list-end day and gate
   predicates remain underspecified. That weakens the server evidence the cross-class completion law relies on.
6. **Some canonicality claims have no formula.** `graduatedWordIdsHash` is named without the promised
   `SHA-256(JSON.stringify(graduatedWordIds))` definition (:91-92), and `fallbackSeed` is not required iff the
   fallback composition version is selected. These are byte-identity/replay fields, so one-way prose is not
   enough.
7. **The grading-job quarantine is still a slogan rather than an executable contract.** H6:147-151 names
   refusal and quarantine, and DF2-12 adds a status plus metric, but there is no exact malformed predicate,
   quarantine record shape/reason, atomic transition, terminal retry result, session-start behavior, legacy
   scan artifact/count, or acceptance rule. The known current fail-open ownership path therefore lacks a
   buildable and testable migration contract.
8. **RRU prose still authorizes the old broad law.** H6:21-23 and Track B:83-85 say merely “eligible attempt
   history,” while executable v5 says review-tested. Neither version supplies authoritative proof of the
   mastery timestamp. The contract must choose and state a server-derived event rather than preserving a
   client timestamp with progressively narrower corroboration.

## H8 / R2-47 — decision accepted, structural result not proved

### What is real

- H8 no longer publishes a numeric fairness pass/fail oracle. `exposureBaselines` are descriptive, consistent
  with the R2-47 owner decision.
- Underflow graduation excludes already-resting top-ups, and selection uses a deterministic Fisher-Yates draw.
- The generator is reproducible: syntax checks passed, rerunning produced a byte-identical
  `h8-resim-results.json` SHA-256
  `e8336864cdea09ed8684b1ae569219121934c725b92335bc6389d806e0e84cd9`. It produced version 5, 60 scenarios,
  30 scenarios to which its boolean cyclicity field applies, and zero failures under its own predicate.

### Why the replacement certification is false green

1. **The predicate is not the R2-47 claim.** At the end of the run H8 computes
   `introducedFinal.every(w => w.everQueued || w.restUntil > 0 || w.lp !== null)`
   (`h8-final-values-resim.mjs:209-211`). “Was ever queued over the whole simulation, or is resting, or has ever
   proved” does not establish “the rotation reaches every pool word each cycle.” It neither delineates cycles
   nor asserts a visit within each one. Existing proof/rest state can make the check pass without a rotation
   visit at all.
2. **The claimed arithmetic unit fixture is absent.** The script and output say selector mechanism/cyclicity is
   certified by unit fixtures, but no isolated rotation arithmetic fixture or test artifact exists in the
   repository. The simulation's permissive end-state predicate cannot stand in for it.
3. **Tuple validation is sampled and incomplete.** H8 validates only the first 50 of the 1,200 randomly drawn
   tuples (:77-82), not the whole input or even all selected tuples. It does not validate the manifest mode and
   summary binding, integer/clock invariants, key uniqueness, or RRU semantics. A malformed tuple after the
   first 50 can enter every scenario despite the handoff's “B1 tuple schema validation” claim.
4. **The baseline input remains contaminated and synthetic.** The v5 sample manifest itself exposes the 25WT
   test classes. H8 then globally samples per-word tuples, losing student/list/order correlations. R2-47 makes
   the timing outputs non-gating, so this does not resurrect a numeric oracle; it does mean the published
   monitoring thresholds are not yet a clean target-cohort launch baseline.

## Fold consistency

- `00_ORIENTATION.md:27` still says both **ENGLISH-ONLY** and “a bilingual reason + next step.” The claimed
  R2-44 rewrite did not happen.
- `10_REVIEW_GRADUATION_REDESIGN.md:131-135` still requires H8 to “demonstrate BOUNDED SIGHTING INTERVALS.” That
  is the retired numeric-style product promise, not R2-47's structural mechanism certification plus descriptive
  monitoring.
- Track B and the B1 source header still say five fields and retain old mutation/RRU instructions, as detailed
  above.
- The rules clauses correctly protect seven subcollections, but the header and merge instruction still say
  “five NEW (now SEVEN)” and that the only additive deltas are five names
  (`firestore.review_v2.rules:18-20,57-60`).
- H6 still contains both the counter-document and count-query sequence instructions, and two different reset
  cleanup lists. These are binding implementation contradictions, not editorial history.
- The C2 report's superseded banner, the R2-42 `ops_metrics` correction, the six-label rule-task wording, and
  the F2-retired marker are real fold improvements. They do not offset the live contradictions above.

## Exact closure gate

1. Add an isolated deterministic rotation fixture that defines a cycle for mutable pools and proves every
   eligible remainder-pool word is selected within each applicable cycle across pool sizes, offsets, priority
   prefixes, fallback, and size changes. Make H8 check that exact structural predicate, validate every consumed
   tuple, and remove the old bounded-sighting requirement.
2. Freeze and implement the B1→B3→B4 mutation protocol: durable affected-attempt/adjudication identity,
   truncation-free or paged cursors, event-time replay, exact dedupe/order, and union comparison. Validate the
   full manual-override shape and derive RRU only from an authoritative server event. Publish and review the
   exact class-ID allowlist plus expected class/student census before reconsidering `--full`.
3. Define the counter identity/schema and transactional allocator; serialize global compose-key uniqueness;
   acquire both reset tombstones in one read/check/write transaction; enumerate every epoch-fenced writer; and
   make evidence/hash/quarantine contracts executable with retry outcomes and tests.
4. Reconcile the live R2-44, R2-47, six-field, counter, reset, RRU, and rules-merge text so implementers have one
   contract.

## What I verified

- Validated baton owner/round/revision `codex/57/186` and the complete matching ready marker and handoff.
- Read the changed plans, B1/B2, sample JSONL/summary/manifest, H6, additive/base rules, challenge and legacy
  graduation paths, H8 script/results, R2 ledger/trace, and ecosystem folds.
- Ran Node syntax checks for B1, B2, and H8; all passed.
- Reran H8 and confirmed byte-identical output, version/scenario/cyclicity counts, and the actual predicate.
- Independently verified both v5 B1 manifest hashes and the strict full-mode negative CLI cases.
- Reconciled three independent read-only audit lanes. No production Firebase operation, B1 full run,
  Playwright audit, Docker workflow, or product-code edit was performed.

## Baton update

Review complete. Hand back with `codexDecision: DONE`; this means the round-57 review is complete, not that
Stage 1 or B1 full is authorized.
