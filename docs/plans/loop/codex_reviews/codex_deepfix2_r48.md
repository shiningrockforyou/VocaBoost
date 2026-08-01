# Codex review — DEEPFIX 2 round 48

**Reviewed:** 2026-07-26  
**Scope:** final owner-decision ratification and fold-go  
**Verdict: OWNER OVERRIDES RATIFIED; MECHANICAL FOLD GO, WITH TWO ERROR-PREVENTION CONTRACTS REQUIRED IN DF2-14.**

David has explicitly accepted the pedagogical/data-trust ambiguity in Q2 and Q3. I stand down on those product
concerns. Neither choice is intrinsically unimplementable. The fold may run.

Two technical interpretations would convert the accepted ambiguity into actual erroneous data, however:

1. an impossible historical score must not be clamped into a passing proof;
2. class-scoped queues must have an explicit cross-class completion/race contract, not merely a dual-class test.

These do not require another David decision. They implement his stated bar: ambiguity is permitted; false
rejection, duplicate advance/graduation, and corrupted proof are not.

## Q2 — unqualified historical recompute: ratified with minimum structural hygiene

I accept David's decision to trust historical attempts without a provenance-era boundary. That consciously accepts
client-authored/cheating risk and some historical uncertainty.

One error-level objection remains to the stated hygiene:

> clamp scores to <=100

An attempt stored at 120% is internally impossible. Clamping it to 100 makes it pass the 92 threshold and turns the
known corruption into `reviewLastProvenAt`. That is the opposite of hygiene. The backfill must **exclude an
internally impossible attempt from proof**, not normalize it into proof.

The minimum non-provenance validity filter is:

- finite stored score in `[0,100]`;
- positive integer `totalQuestions`;
- finite/in-range correct count, never greater than `totalQuestions`;
- stored score agrees with the stored numerator/denominator under the historical rounding rule;
- answer rows used to stamp a word are structurally valid and have no conflicting duplicate entry for that word;
- malformed/impossible attempts are reported and omitted from **all four** label calculations, not partially
  trusted;
- `passed:true` is not used as proof; proof is the accepted stored/recomputed score threshold plus a correct word
  row.

This is basic record coherence, not the provenance boundary David rejected. The expected-result artifact must
publish excluded-document counts/reasons so the filter cannot silently shrink or reshape the cohort.

With that correction, **R2-35 Q2 is ratified**.

## Q3 — accepted ambiguity: ratified, but the three listed conditions are insufficient alone

David may choose per-class settings over shared word truth and permit a 70-threshold class to create proof later
consumed in a 92-threshold class. That is a deliberate consistency/pedagogy choice, not by itself data corruption.
I therefore stand down on the effective-settings resolver.

Dashboard focus is useful steering, but it is not server authority. It can differ by device, be bypassed by a
direct class route, or coexist with two open browsers. The server must remain correct when focus is absent, stale,
or changes mid-day.

### Required class-scoped queue identity

The key cannot be only `class+list+day`. Day numbers repeat after reset and algorithms/configuration change. The
identity must include at least:

`{uid,classId,listId,logicalDay,resetEpoch,algorithmVersion,configVersion}`.

The immutable queue record snapshots the actual threshold/queue/test/type values for that class-day. Mid-day
teacher edits affect the next queue only.

### Required cross-class evidence rule

To preserve David's accepted model without false rejection:

1. An attempt is validated only against **its own** class-scoped queue/presented identity.
2. Completion in another class must not compare that attempt to the launching class's different queue.
3. A valid cross-class passing attempt may satisfy the shared logical day only when
   `{uid,listId,logicalDay,resetEpoch,anchor/generation}` matches.
4. The consumed attempt and its source queue/config identity are recorded in the completion/audit result.
5. Label stamps remain class-blind as David decided.

This explicitly permits the smaller/different class test to govern the shared day; that is the accepted ambiguity.
It prevents the server from rejecting valid B evidence merely because A's queue differs.

### Required concurrency rule

Two classes/devices can submit passing reviews for the same shared day concurrently. The canonical list-progress
transaction must guarantee:

- exactly one day advance;
- exactly one graduation application for that logical day;
- an idempotent winner identity;
- the loser receives `already_completed` and cannot apply a second graduation/advance;
- each valid attempt's answer-label mutation is independently idempotent;
- reset-epoch mismatch rejects both queue and attempt;
- no first-opened client state or Dashboard focus participates in server authorization.

The dual-class cert gate needs explicit cases for:

- different thresholds;
- different queue/test sizes;
- both classes open concurrently;
- B pass consumed while completing/reloading A;
- simultaneous A+B passes;
- settings edit after queue creation;
- reset followed by reused day number;
- direct URL/second device with a different saved focus;
- one class unassigned between queue creation and submit;
- kill-switch/config-version change mid-day.

These are the oracles that make “no crash / no false rejection / no corruption” measurable. A fixture without them
would not close the error class.

With these contracts, **R2-36 is ratified and r46-B4 is closed by owner risk acceptance**.

## Q4 — ratified

The final law is coherent:

- fail and correct labels keep writing while OFF;
- proven freezes;
- retests remain label-neutral;
- legacy paths do not read the labels;
- cold start with no last-known posture holds and mints nothing;
- stamped config version governs through completion.

No further owner decision is needed. The fold should replace the shorter R2-32 wording with this final form.

## Q7 — 12-hour window ratified, with honest physical-deletion wording

The 12-hour product window is valid. `expiresAt` must be server-authored and checked transactionally on every
pickup/retry before grading begins.

Firestore TTL cleanup is asynchronous. Therefore:

- recovery becomes logically unavailable exactly at `expiresAt`;
- an expired pickup should transactionally mark the job expired and redact/delete submitted rows immediately when
  practical;
- native TTL is the eventual physical-cleanup backstop, not proof that bytes disappear at exactly 12 hours;
- UI says the submission expired and a new test is required;
- reset cancels/invalidates immediately through `resetEpoch`, regardless of TTL.

This is wording/implementation accuracy, not an objection to David's duration.

## Fold-go ruling

**GO:** execute the panel-13, r46, and r47 checklists as one mechanical fold, and author DF2-14 per r46 item 9.

The fold must additionally carry:

1. the Q2 impossible-record exclusion above;
2. the full Q3 queue/evidence/concurrency contract above;
3. r46-B2's high-watermark/delta/activation barrier;
4. authoritative queue/presented-set identity;
5. cached-client version negotiation;
6. reset-epoch binding for queues, attempts, jobs, and completion;
7. the final kill-switch law;
8. the 12-hour logical-expiry vs asynchronous-TTL distinction.

No additional David decision is required before the fold.

One bookkeeping correction: `12_R2_DISCUSSION_TRACE.md:92` still lists R2-15's least-recently-tested nod as open
even though R2-26 says it is sealed. Remove it. R2-10 challenge reversal remains intentionally conditional on A2;
the board is clear enough to fold, but it is not literally true that every future decision is closed. Carry R2-10
as an explicit deferred gate, not as resolved or forgotten.

**Round-48 final ratification: DONE. Mechanical fold: GO. Production/build authorization remains governed by the
folded DF2-14 gates.**
