# Round 01 — Claude's 3-agent audit of plan v1 (synthesis)

3 independent read-only Explore agents (A correctness / B security-blast-radius / C UX-edge) audited
`plan.md` v1 concurrently with Codex. Below: deduped, severity-ranked, with cross-agent corroboration and
my own code-verification status. (Codex's r01 review is verified & merged separately when it lands.)

## BLOCKERS

### BL-1 · Shared-list blast radius — extending one list mutates it for EVERY class/student on it
- **Agents:** B (blocker), corroborated by A-#2 / C-#3.
- **Evidence:** lists are per-teacher not per-student (`db.js:459` `where('ownerId','==')`); assignment is
  class-wide via the `assignments` map (`db.js:797`, hydrate `:502`); one listId (Base Camp `RmNNkuLP`,
  Ascent `dVliNv0p`) is assigned across dozens of 26SM classes (SUPPORT_RUNBOOK). The 3 finishers are on
  Base Camp 1200 → extending it hits the whole Base-Camp cohort.
- **My verification:** owner-scoping + class-wide assignment CONFIRMED. **This is the deciding flaw** — the
  approach as written can't scope to one student.

### BL-2 · `wordCount` is the cohort-wide progress denominator — bump dilutes everyone's bar
- **Agents:** A (high), B (blocker), C (high) — **all three independently.**
- **Evidence:** `Dashboard.jsx:1889-1891` (`totalWords=list.wordCount; pct=wordsIntroduced/totalWords`),
  `ClassDetail.jsx:81-102`, `StudySelectionModal.jsx:90`, `fetchStudentStats` denominator (`db.js:1058`).
  Finished student 1200/1200=100% → 1200/2400=50% overnight; mid-list students halve too.
- **My verification:** `wordCount` used as display value CONFIRMED (`Dashboard.jsx:963/1050`). Real.

### BL-3 · Position-offset math collides → breaks the monotonic-nwei invariant the plan sells
- **Agents:** A (blocker) + B (high) — independently.
- **Evidence:** `deleteWord` (`db.js:631-634`) decrements `wordCount` WITHOUT renumbering positions, so
  `wordCount ≠ maxPosition+1` after any mid-list delete; plan's `position = baseCount*(L-1)+w.position`
  then collides with existing positions → duplicate/regressing `newWordEndIndex` → the exact re-stick §3
  claims to prevent. `getNewWords`/`getSegmentWords` return ALL position matches (`studyService.js:732/342`).
- **My verification:** CONFIRMED `deleteWord` does not renumber. **Fix:** stride = `maxPosition+1`, assert
  contiguity, derive new `wordCount` from actual appended count.

### BL-4 · "Full List" PDF export prints every word 2–3× (the plan's own §4 gate — verified BROKEN)
- **Agents:** C (blocker), A (caveat).
- **Evidence:** `Dashboard.jsx:565→582 downloadListAsPDF(...,'full')` → `fetchAllWords` (`db.js:1012/1034`)
  returns ALL word docs by position (2400–3600 after extension); `pdfGenerator.js:141` renders each. Not
  keyed by text OR wordId — unconditional duplication in the teacher's printed list.
- **My verification:** to re-confirm at edit time. Treated as real (two agents).

## HIGH

- **H-1 · Mid-cycle `--revert` corrupts progress (A).** Reconciliation is anchor-authoritative: `twi =
  greatest-nwei + 1` (`progressService.js:148-150`, `db.js:3273-3274`), `safeTWI=twi` (`:231`). Reverting
  deletes lap-2 word docs + restores `wordCount=1200` but leaves `attempts` with nwei≤1799 → next session
  drives twi→1800 while wordCount=1200 → `wordsRemaining=-600`, negative `newWordCount`, orphaned
  study_states (`studyService.js:234-235/421-422`). My §7 "clean re-dead-end" claim is **wrong**.
- **H-2 · Re-run makes copies-of-copies (A).** `baseCount`/source-words must come from `cycleMeta`
  (recorded originals), never the live already-bumped list; filter out `cycleLap` docs when selecting source.
- **H-3 · Teacher edits don't propagate across laps (C).** Lap-2/3 are independent docs; a post-extension
  typo fix on lap-1 leaves stale lap-2 copies → student re-studies uncorrected word; both can surface as
  MCQ options. `ListEditor.jsx:75/461/478` also shows 2400–3600 rows.
- **H-4 · `--dry` reports nothing about blast radius; Admin SDK bypasses ownership rules (B).** Dry run
  only reads the words subcollection. Must enumerate every class + studentIds count + list.ownerId
  referencing the listId and require explicit ack (`firestore.rules:85/91` bypassed by service account).
- **H-5 · Non-atomic multi-batch write + presence-based idempotency → permanent half-extended list (B).**
  2400 docs = ≥5 batches (500 cap). Interrupt → partial; existence-based idempotency no-ops a partial run.
  Fix: ≤500-op chunks, bump `wordCount` LAST, idempotency verifies expected per-lap doc count.

## MEDIUM
- **M-1 · MCQ/Blind-Spot distractors are by-TEXT (C, new).** Distractors dedup by wordId only, rendered by
  definition text (`MCQTest.jsx:206-221`, `BlindSpotCheck.jsx:89-104`); cross-lap pool → correct answer's
  definition can appear as a "wrong" option. §4 check missed test-option generation.
- **M-2 · Silent cycling erases the completion SIGNAL (C, product).** No "list complete"/"Lap 2" for
  student, no teacher completion event to decide advance-to-Ascent/Summit. The durable fix (handle
  `isListComplete`) is what both actually expect; cycling should be explicit, not default masking.
- **M-3 · Read amplification (A).** `getUnmasteredPool where(position<twi)` + full-subcollection `getDocs`
  in getNewWords/getSegmentWords/getBlindSpotPool grow 2–3× per session; the "avoids loading whole list"
  comment (`studyService.js:377`) becomes false.
- **M-4 · Partial-commit interruption (A).** Same as H-5 from the correctness angle; make commit
  transactional/resumable, guard on doc-count AND wordCount.
- **M-5 · Editing the shared sweep risks masking real corruption (B).** Keep any sweep change strictly
  additive, gated on a `cycleMeta`/`cycleLap` marker; never relax base `twi>listSize` (`data-integrity-sweep.mjs:39`).

## NITS / positive verifications
- **§4 prereq, verified by A+C:** Blind-spot count, mastery bars, gradebook word view, unmastered/review
  pool all key off **wordId/position** — SAFE. Only PDF export (BL-4) + distractor text (M-1) break, plus
  `fetchStudentStats` mastery % shares the diluted denominator (BL-2). So §4 is real but I must record the
  **per-site verdict**, not just assert it.
- **§3 core mechanism, verified by A:** in the CONTIGUOUS case, allocation-continuation + review-repopulate
  work as claimed (`studyService.js:231/234/235/253/254`, lap words = fresh NEVER_TESTED wordIds). The plan's
  line-level code citations are all ACCURATE.
- **Review/test double-count nit (A):** same-text base+lap copy can co-occur in one test (dedup by wordId
  only). Cosmetic.

## Emerging direction for v2 (pending Codex + full verify)
BL-1/BL-2 + M-2 point away from "silently extend a shared list" toward: **handle `isListComplete`** (the
real unhandled root bug, zero consumers confirmed at `studyService.js:277`) — surface completion + a
teacher signal, and make continuation per-student / lap-aware rather than mutating a class-wide `wordCount`.
Extension may survive only as a per-dedicated-list mechanism with lap-aware denominators + the safety fixes
(BL-3/H-1..H-5). Decision deferred until Codex's review is in and I've verified its findings too.
