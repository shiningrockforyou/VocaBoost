# DEEPFIX2 — Track B: the label-backfill pipeline (14_, v1 2026-08-01)

> **Status: DESIGN v2 — the r53 correction fold applied** (B1/B2 rewritten; adjudications RESOLVED below) (11_ §3 pipeline; David's directive: expected results
> computed BEFORE the backfill writes; every stage converged before execution; final artifacts at the heavier
> 3F+2O+1C per the checkpoint-5 spec). Laws: **R2-35** (unqualified recompute-at-92 · impossible records EXCLUDED
> never clamped · published exclusion counts · reset-epoch-scoped) + **r48** (validity filter + watermark cutover)
> + **r46-B2** (cutover contracts) + **R2-41** (attempt-type-agnostic stamping). Writes touch ONLY
> `users/{uid}/study_states/{wordId}` label fields. 26SM execution = David's stage-4 go; 25WT rehearsal first.

## 0. Pipeline order (dependencies)

**B2 investigation → B1 expected-result calculation → B3 backfill writer → B4 execution.**
B2 runs first (read-only reconnaissance — its shape findings parameterize B1's parser and B3's writer).
Checkpoint 1 converges: this plan + the B2 script + B2 findings + the B1 plan/script. B3's script converges
before any 25WT write; B4's 26SM run sits behind David's go with expected-vs-actual at the watermark.

## 1. B2 — database investigation (script: `scripts/deepfix2/b2-database-investigation.mjs`, READ-ONLY)

Cost-aware by design (NEED_TO_FIX #17: no unfiltered full-collection scans): `count()` aggregations for volumes;
bounded per-student samples for shapes.

Measures:
1. **Volumes**: total `study_states` (collectionGroup count), total `attempts`, per-sampled-student medians —
   sizes the B3 write budget and batch plan.
2. **Attempt shapes** (sample ~30 students × ≤300 attempts): field presence (`score`/`scorePercent` types,
   `totalQuestions`, `sessionType`/`type`, `passed`, per-word rows key + row shape, `resetEpoch` presence,
   timestamps), score units (0-1 vs 0-100 mix), the known >100% corruption class.
3. **Blank reconstructibility**: fraction of attempts whose rows cover `totalQuestions` (blanks-as-rows vs
   absent) — determines whether blank=fail is reconstructable per attempt or published as an undercount
   limitation.
4. **`study_states` shapes**: key sets, legacy fields (`masteredAt`, status enums), whether any `review*` label
   names already exist (collision check), duplicate/casing anomalies.
5. **Reset hygiene [r53-B1 corrected]**: the REAL per-list tombstones are `users/{uid}/progress_meta/{listId}`
   + `list_progress/{listId}` `{resetEpoch, resetAt}` (foundation:496-532/2047-2140) — B2 v2 reads them;
   `epochMarkersSeen` distinguishes "no resets in sample" from instrument failure; B1 snapshots per-(uid,list)
   epoch into its artifact and EXCLUDES pre-resetAt attempts (counted `preEpoch`), making B3's skip-rule
   executable.
6. **Live-write pattern**: recent-attempt cadence (bounded query) — sizes the delta-sweep window for B4.

Output: `docs/plans/deepfix2/evidence/b2-database-investigation.json` + console summary. Zero writes.

## 2. B1 — expected-result calculation (plan; script follows B2)

Per student × word (scoped to the student's CURRENT resetEpoch), replay all graded attempts in timestamp order
under the final law and emit the predicted four labels + distributions:

- **Fail**: each wrong-or-blank presented word on any graded attempt ⇒ `reviewFailCount`+1, `reviewLastFailedAt`
  := attempt time (blanks only where reconstructable per B2 §1.3; undercounts published).
- **Correct**: each correct answer ⇒ `reviewLastCorrectAt` := attempt time.
- **Proven**: correct answer on an attempt whose validity-checked **STORED score ≥ 92** ⇒ `reviewLastProvenAt`
  := attempt time (stored `passed` flags ignored; **B1-Q3 RESOLVED per r53-B1 + panel: the ledger LETTER governs —
  rows FENCE the stored score (≤2pp agreement required when rows are complete) but never REPLACE it**).
- **Exclusion filter (r48, before any stamping)**: non-finite/out-of-range score · insane totals · numerator >
  denominator · score↔rows disagreement beyond rounding · conflicting duplicates ⇒ attempt EXCLUDED from all
  four labels; per-class + per-signature exclusion counts published in the artifact.
- **Challenge-mutation law [r55]: accepted challenges mutate attempts IN PLACE (no submittedAt change) — B1
  replays adjudicated rows as stored (the stored-score law absorbs the flip) and emits per-student
  `mutationRisk` (pending challenges + adjudications at/after the watermark); B3 re-reads flagged students at
  write; B4's delta sweep covers post-watermark adjudications. Historical resting-at-acceptance (R2-43) is NOT
  reconstructable ⇒ NO historical stamping decision depends on it (documented conservative posture).**
- Output [r53-B1/r55]: **JSONL — one student per line `{uid, epochByList, mutationRisk, words:{listId|wordId →
  {fc,lf,lc,lp,rlt}}}`** (FIVE fields — the rru seed is RETIRED [r60/r62]: `reviewRestingUntil` is LIVE-ONLY, never baselined, never backfilled)
  (the per-word five-field B4 comparison baseline) + a summary JSON (aggregates, per-class + per-signature
  exclusion counts, identical-dup drops, blank undercount, per-student sha256 digests, computation watermark).
  Fail-closed eligibility fence + whole-group conflicting-duplicate exclusion per the script header.

**Checkpoint-1 adjudications (flagged, not decided here):**
- **B1-Q1 ⟶ RESOLVED (r53 adjudication): uniform 92 bar across ALL ELIGIBLE GRADED ATTEMPT TYPES (the whitelist: new · review · retest)** — r48
  validity first, then stored-score-at-92; per-type historical thresholds rejected (provenance branching the
  owner declined).
- **B1-Q2 ⟶ RESOLVED (r53 adjudication): YES — seed the clock from REVIEW-TYPE history ONLY** (latest eligible
  review-type attempt containing the word; new-word attempts never move the clock, matching R2-41(d)).
  **Null policy [panel]: no review history ⇒ the field is NOT WRITTEN** (unseeded words tie-break by wordIndex).
  **FIELD RENAMED `reviewLastTestedAt` [r53-B3]**: legacy `lastTestedAt` is client-written today and stays
  untouched until DF2-46 — the server rotation clock is a NEW field, born server-only; the write set is five
  NEW fields and the rules lock is truly inert.

## 3. B3 — backfill writer (requirements; script converges before 25WT)

Resumable (durable cursor per student) · idempotent (recompute-and-overwrite semantics; safe replay) ·
**pre-image backup** of every touched `study_states` doc (export file, not a Firestore copy) · tamper-proof field
set (writes the FIVE label fields [r59-A9 — `reviewRestingUntil` is LIVE-ONLY, never backfilled; the seed +
its flag are DEAD]: `reviewFailCount`/`reviewLastFailedAt`/`reviewLastCorrectAt`/`reviewLastProvenAt`/
`reviewLastTestedAt`; **expected-null ⇒ `FieldValue.delete()` on owned fields [A4 — convergent, never
merge-omitted]**; never touches status/mastery/progress fields or legacy `lastTestedAt`/`masteredAt`) · batch-limited with rate control ·
dry-run default (writes require `--execute`) · per-run manifest (counts written/skipped/excluded, watermark
timestamp) · epoch-stamped (a student whose resetEpoch changed since B1's snapshot is SKIPPED and listed for
re-run).

## 4. B4 — execution choreography (r46-B2, unchanged from DF2-14's card)

**EMULATOR SMOKE LAP FIRST [r62p David-ratified; r64 scope = the expanded 02_ card]: the full chain (B1 --full → B3 --execute → B4 → one `b-delta-cycle.mjs` lap + the (a)–(e)/crash-injection/postFlip/resume/stale-report cases carded on 02_) runs against the Firestore emulator before 25WT — execution evidence, not review evidence.** Backup → **25WT rehearsal** (B3 exec → B4 PASS — fail-closed) → David's stage-4 go → 26SM: FULL B1 → B3
--execute → B4 → **the CONVERGENT ENDGAME [r61, corrected r62p — a live cohort never yields an empty delta,
and doesn't need to]: iterate (B4 → materialized delta layer → B1 --deltaAuth → B3 --deltaDir --execute →
B4 --appliedDelta; the driver = `b-delta-cycle.mjs` [r64 — cross-platform Node; exits 0 PASS / 5 structural / 3 skips / 4 write-failures / 8 A8-hazard / 9 exhausted], consuming B4's printed MATERIALIZED_DELTA_DIR line)
until |delta| is small (students keep submitting — the tail is expected) → THE FLIP (label writers go
server-side at that instant) → ONE post-flip reconciliation pass = **B4 `--postFlip=FLIP_TS` — READ-ONLY**
[r62p N2/N3 — the flip is NOT a write-freeze for labels; it's the moment LIVE label writes BEGIN. Therefore:
**B3 NEVER runs post-flip** (hard guard: B3 FATALs when `enabled` is true OR the durable `firstEnabledAt` marker exists [r65 — one guard, one era authority] — a
post-flip B3 could overwrite fresher live stamps with phase-1 values) and **`--repairExtras` against a
post-flip report is REFUSED** (its "extras" include the live server's own writes). The postFlip B4
recomputes expected at boundary=FLIP_TS (absorbing the pre-flip tail) and judges PER FIELD [r64 — the
doc-wide exemption hid stale fields behind one fresh stamp]: a mismatched TIMESTAMP field is exempt only if
ITS OWN value ≥ FLIP_TS (bounded-future sanity-capped); `reviewFailCount` (cumulative) is NEVER
timestamp-exempt — it verifies against a SECOND replay through the run's captured cutoff (one re-read retry
absorbs concurrent attempts); adjudication is handled by the ADJUDICATION-REALITY LAW (H6 §6b — grading truth recovered/reconstructed;
as-of-boundary minting; NO word-level exemption exists: a rejected challenge cannot hide corruption, lap-
proven); UNCOVERED students (any uid outside original ∪ chain) are LISTED (`uncoveredAtGate`) and their
diffs BLOCK — there is no auto-advisory re-enrollment path [r66 — the r64 skip was a reproduced false
green];
corrupt-typed values are never exempt. PASS = zero non-exempt NON-TAIL diffs; **THE TAIL DISPOSITION [r65p]: events between the last layer watermark and the flip have NO writer — the gate CLASSIFIES them (`preFlipTail` REQUIRES ALL THREE [r66/r67/r68]: (1) MOVED — the flip-boundary expectation ≠ the layer expectation; (2) QUIET — the cutoff expectation ≡ the flip expectation on the SAME field (a tail event never excuses a lost post-flip event on that field); (3) disk ≡ the layer expectation. PROVENANCE QUALIFIER [r68 — the dup/epoch corner]: movement is tail-window provenance EXCEPT where a post-flip event changes replay INPUTS retroactively (a post-flip adjudication diverging a duplicate group, or a post-flip reset moving preEpoch exclusions, shifts BOTH replays together) — those students are simultaneously delta-flagged (`adjudicationChanged`/`epochDrift`) and the gate publishes its replay-exclusion counts, so the corner is visible, bounded by the minutes-scale gate window, and never silent. A lost POST-flip stamp leaves flip ≡ layer ⇒ NOT tail ⇒ BLOCKS. Honesty [r67 — one sentence, no self-contradiction]: TIMESTAMP tails re-stamp through live use; a pure-tail fc deficit does NOT heal — it persists as a PUBLISHED permanent undercount, advisory-priority impact only), publishes the counts + rows (a LAYER-ONLY JOINER of a cutover-aborted layer surfaces as an `uncoveredAtGate` BLOCKER, not tail [r68]); the FINAL pre-flip micro-lap bounds the window to minutes; mixed tail+post-flip fc divergence still BLOCKS**] → the FINAL verdict published.**
**DARK-WINDOW CUSTODY [RATIFIED — R2-48, David 2026-08-02]: the six label fields have exactly ONE writer per era. The live
label writers stamp per THE R2-48 PREDICATE — `firstEnabledAt` SET ∨ class ∈ `rehearsalClassIds` [r67:
the one predicate, stated here too] (the marker written in the same audited txn as the first
`enabled:true`, write-iff-absent, NEVER cleared — the kill switch clears `enabled` only). Before that marker
exists (the dark window) there are ZERO live label writers OUTSIDE `rehearsalClassIds` [the R2-48 carve-out] — B3 owns the real cohort's fields exclusively, and R2-32's
"fail+correct write while OFF" governs POST-ACTIVATION kill-switch windows only (its ratified context).
B3's post-flip guard checks the DURABLE marker (`firstEnabledAt` present ⇒ FATAL), so a kill-switch
`enabled:false` can never re-admit B3 during an incident window.**
**ROSTER LAW [r62p D2/D6]:** `rosterAdded` = enrolled but covered by NEITHER the original NOR any applied
layer (a layer-covered joiner is never re-flagged — the chain terminates); departed students' labels are
frozen artifacts, verify-skipped + listed; a PRE-flip re-enrollment re-enters as rosterAdded and the next
lap re-baselines them; a POST-flip re-enrollment converges through live use (the labels are advisory
priority data, self-healing under H6's stamping law — never progression state).
Ordering fences: reset/challenge/override events during the window per r46-B2's ordering + retry semantics.
Every run: SUPPORT_RUNBOOK CS event + change-log row.
