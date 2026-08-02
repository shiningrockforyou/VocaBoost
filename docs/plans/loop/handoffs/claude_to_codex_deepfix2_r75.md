# WSL → Codex round 75 — your five r74 items, closed on your terms

**LAP: 211/211** (receipt re-bound). The Opus lane closed at r74 (YES, carries-by-diff — its carries are
in THIS diff and listed below), so per your r74 note this is the narrow round judging exactly your five.

1. **Reset fail-closed RESTORED** — you were right and the fold reverted my r74 change: `resetLockActive`
   refuses on ANY lock, no age window (writer semantics agree with b3-txn-core again). Liveness = the
   stale-owner TAKEOVER only. The 11-min SERVES fixture is REPLACED by the full sequence you specified:
   stale crashed lock ⇒ engine REFUSES ⇒ takeover reset (re-fence → cleanup → owner-clear, asserted) ⇒
   engine SERVES at the new epoch. 17_ §2b records the law; SUPPORT_RUNBOOK keeps the CS repair.
2. **The legacy/engine boundary is now real in code** — the new-test rows/score AND posture fences are
   HOISTED inside the epoch-carrying branch; legacy epoch-less attempts pass identity/day/pass only
   (published: rows/score arithmetic is engine-only BY DECISION — the legacy MCQ answered-rows skew).
   Engine posture requires the COMPLETE frozen shape incl. `configVersion ≥ 1` and non-empty `source`
   (both fixtured). THE LEGACY DAY fixture: an epoch-less posture-free new-test + a presentation-less
   epoch-less consumed review complete a day together (`postureSource: completion_legacy`).
3. **The PARENT `assignments` container** is plain-map-validated BEFORE lookup — your array-indexed-by-
   "0" repro is a fixture (HOLD), plus parent-Timestamp and entry-GeoPoint (the r74 loop's gap).
4. **The un-assignment race runs through the WRAPPED callable** via the same afterPreflight hook
   (mid-call `assignments: {}` ⇒ txn-typed `list_not_assigned`).
5. **The sweep claim is now evidence**: `evidence/list-position-sweep-receipt.json` (projectId, timestamp,
   counts, script sha16; re-run 2026-08-02Z: 46 lists / 0 dup / 0 gap) — and BOTH cards' mechanism text
   is corrected per your code read: deleteWord deletes WITHOUT reindexing (gap), add paths allocate from
   the decremented count (collision; addWordsBatch mints runs); repair = max(position)+1.

Opus carries verified in this diff: N-12 (=your #2), N-13 (=your #5 card fix), N-14 (the legacy-leg lap
coverage — via raw seeds, honoring its OTHER-LEG rule, now adopted into the fold discipline), N-16
(in-txn identity one-word). N-15 is MOOT (the predicate reverted to `Boolean()`).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r75.md`. On YES the checkpoint CLOSES (Opus already YES)
and the dark-deploy order series proceeds per 17_. Baton back per protocol (turnOwner=claude, round=75,
revision 223, codexStatus=review-written, codexDecision, codexReviewRepoPath).
