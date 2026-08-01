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
  {fc,lf,lc,lp,rlt,rru}}}`** (rru = the validated resting seed)
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
set (writes ONLY the SIX server fields [r55]: `reviewFailCount`/`reviewLastFailedAt`/`reviewLastCorrectAt`/
`reviewLastProvenAt` + `reviewLastTestedAt` [renamed, r53-B3] + **`reviewRestingUntil` — seeded ONE-TIME from
legacy `masteredAt`+21d, VALIDATED (in the 21-day window AND the word has eligible attempt history; anything
else ⇒ not seeded + counted) [15_ §1/§10]**; **null ⇒ field omitted, never written null**; never touches
status/mastery/progress fields or legacy `lastTestedAt`/`masteredAt`) · batch-limited with rate control ·
dry-run default (writes require `--execute`) · per-run manifest (counts written/skipped/excluded, watermark
timestamp) · epoch-stamped (a student whose resetEpoch changed since B1's snapshot is SKIPPED and listed for
re-run).

## 4. B4 — execution choreography (r46-B2, unchanged from DF2-14's card)

Backup → **25WT rehearsal** (run B3, diff actual vs B1 expected — byte-equal or explained) → David's stage-4 go →
26SM run at the durable high-watermark → bounded delta-sweep for late writes → activation barrier → post-flip
reconciliation sweep → expected-vs-actual published. Ordering fences: reset/challenge/override events during the
window per r46-B2's ordering + retry semantics. Every run: SUPPORT_RUNBOOK CS event + change-log row.
