# Codex review — DEEPFIX_TASK3_P3 round 1

Target: `functions/foundation.js` P3 foundation server-surface draft, plus `functions/index.js` integration patch.

Verdict: NEEDS_FIXES.

The core foundation shape is mostly correct: all foundation callables are server-flag dormant; `GRADE_TOKEN_ENFORCED=false` is preserved; `resolveListProgress` read-only mode correctly preserves the legacy launch-class `class_progress` reconciliation write while creating zero canonical `list_progress` docs; and the launch-view top-level return is the correct P4 shape for day-guard consistency. However, the W2 upgraded marker path still has two correctness holes that can leave range-unpairable review days in exactly the class of bug this phase is meant to close.

## Findings

### HIGH — Existing legacy automarkers are never upgraded

Location: `functions/foundation.js:668-712`, especially `:671-677`.

Problem: `writeUpgradedReviewMarker` returns `alreadyWritten` immediately when the deterministic marker id already exists. That preserves ownership idempotency, but it also preserves the old broken marker shape: no parseable `testId`, no `newWordStartIndex`, no `newWordEndIndex`. Current evidence says the live automarker defect is specifically “range-less/testId-less marker exists but does not pair” (`audit/deepfix/task1/CONSOLIDATED_ISSUES.md:321-330`, `:537-541`). The P3 draft uses the same deterministic id (`foundation.js:669`) as the legacy marker path (`functions/index.js:580`) and the plan expects W2 to upgrade marker output shape. With the current no-op, a student/day that already has the legacy marker cannot be repaired by rerouting through the server callable; the callable will report success while leaving the unpairable document unchanged.

Evidence:

- Current `markReviewComplete` now delegates to `writeUpgradedReviewMarker` (`functions/index.js:566-602`).
- The helper checks existing marker and returns without merge/update (`functions/foundation.js:671-677`).
- The upgraded fields are only written on the new-doc branch (`functions/foundation.js:687-710`).
- Review pairing requires exact range match (`src/services/db.js:3483-3488`), and gradebook parsing depends on parseable `testId` (`src/services/db.js` parse sites; marker testId added only on new write at `foundation.js:694`).

Fix: If the existing marker belongs to the same `uid`, inspect its shape. If `testId` is missing/unparseable or `newWordStartIndex/newWordEndIndex` are missing while `deriveDayAnchorRange` can derive a range, merge the upgraded fields into the existing marker and return an explicit `upgraded:true`. Keep true no-op only when the existing marker already has the upgraded shape, or log `review_marker_anchor_missing` when no same-day anchor exists.

### HIGH — `completeSession` suppresses the marker on any same-day review, even an unpairable different-range review

Location: `functions/foundation.js:497-512`, `functions/foundation.js:1034-1043`.

Problem: `completeSession` writes the W2 marker only when `dayReviewExists(uid, listId, dayNumber)` returns false. That predicate checks any review attempt for the student/list/day (`foundation.js:500-506`); it does not require temporal lineage or exact `newWordStartIndex/newWordEndIndex` match. The live list-scoped recon logic only counts a review if it pairs to the anchor range (`src/services/db.js:3447-3501`; server port `foundation.js:429-464`). Therefore a same-day review from a different class/pace/range can suppress marker creation while still not satisfying future reconciliation. That recreates the C-14 “review exists but cannot pair” failure mode.

The draft notes this as “accepted” in U4, but it is not safe for the foundation path: P4/P5 will build on exact-range pairing, and suppressing the only upgraded marker because an unrelated review row exists means a future fresh launch doc can reconcile to `anchorDay - 1` instead of the completed day.

Evidence:

- `dayReviewExists` ignores anchor range and submittedAt lineage (`foundation.js:497-512`).
- `completeSession` skips marker write when that broad predicate returns true (`foundation.js:1038-1043`).
- Current client/server review pairing is exact-range + temporal lineage (`src/services/db.js:3451-3501`; server `foundation.js:429-464`).
- The Task-1 issue ledger explicitly calls out same-day/different-range reviews as a phantom-loop class (`audit/deepfix/task1/CONSOLIDATED_ISSUES.md:208-214`).

Fix: Replace the marker-suppression predicate with a pairability check. For Day 2+ completions, derive the day anchor range (`deriveDayAnchorRange` / `getDayNewPass`) and call the same pairing logic (`getReviewForDayServer`) before suppressing the marker. Suppress only when a range-pairing review exists. If pairing is `none`, write/upgrade the marker. If pairing is `query-error`, fail safe by logging and either writing the marker when the anchor range is known or returning a retryable error before claiming completion-marker success; do not silently suppress.

## Adjudication of the 14 uncertainties

- U1 reason-3 derivation: accept with required fixture diff-check. The server’s `dayNewPass.newWordEndIndex <= currentTwi - 1` check (`foundation.js:915-922`) captures the observable consequence of `startPhase === REVIEW_STUDY`: the new pass was already absorbed into TWI before completion. It is safe against double-introduce. The acceptance fixture must compare an S8 cross-class review-resume against an ordinary same-day reload where the new pass is not absorbed.
- U2 idempotency ambiguity: accept for P3. `already_completed` based on `dayNumber === currentCsd` and last recent session day (`foundation.js:900-906`) is state-safe; exact status semantics can be improved later with a completion nonce.
- U3 streak timezone: accept as documented. KST fixed offset is a display-field drift risk, not a foundation blocker.
- U4 completeSession marker condition: needs change. The current broad “any review exists” predicate is not safe under exact-range pairing; see HIGH finding 2.
- U5 read-only resolver return shape: accept launch view as top-level. P4 session paths must consume the launch-class reconciled view, because the day guard reads the launch durable doc (`foundation.js:889-900`). Returning merged CSD as primary without writing that merged CSD to the launch doc would recreate the F4-1 day-guard rejection class. The merged view is correctly carried alongside (`foundation.js:1282-1294`).
- U6 hydration stamps: accept. `hydratedAt` distinct from migration `migratedAt` is the right separation.
- U7 implausibleStudyDayThreshold approximation: accept as observational only.
- U8 reset epoch pre-P5 location: accept. `progress_meta/{listId}` (`foundation.js:1483-1492`) is the only way to preserve the P4 “list_progress empty until P5” assertion while still recording a reset tombstone.
- U9 enforce flag declared but not wired: accept. `ANCHOR_VALIDATION_ENFORCE=false` and unused is correct until P6.
- U10 challenge TWI phase-gate: accept. For accepted review challenges, CSD advances and TWI stays flat (`foundation.js:1641-1644`), avoiding the known double-add hazard. The existing client over-add is the bug being retired.
- U11 invalid-anchor divergence: accept safe-direction divergence. Treating invalid anchor TWI as 0 preserves stored TWI instead of advancing on junk.
- U12 index dependence: mostly accept. The listed attempt query shapes exist in `firestore.indexes.json`; deploy still must assert indexes are live.
- U13 legacy-null assignment: accept. Fallback daily pace matches the existing default chain.
- U14 testId underscore assumption: accept as parity with existing `getTestId`/parse design, not new exposure.

## Other verified points

- Dormancy: all seven foundation flags are false in `functions/foundation.js:43-74`.
- `GRADE_TOKEN_ENFORCED=false` is preserved in `functions/index.js:66`.
- `resolveListProgress` read-only mode creates/updates the launch legacy `class_progress` doc (`functions/foundation.js:1223-1262`) and returns `canonicalWritten:false` (`functions/foundation.js:1294`); it does not create a canonical `list_progress` doc while `LIST_PROGRESS_CANONICAL=false`.
- `completeSession` uses a transaction for the day guard and progress write (`functions/foundation.js:892-980`), which is stronger than the current read-then-write client path (`src/services/progressService.js:441-480`).
- M4 shadow is log-only and dormant (`functions/foundation.js:731-804`; hook at `functions/index.js:380-390`).
- F2 attemptDocId echo is additive (`functions/index.js:1018-1053` region in the patched file).

## Required changes before GO

1. Make `writeUpgradedReviewMarker` upgrade an existing owned legacy marker when fields are missing/unparseable, instead of blindly returning `alreadyWritten`.
2. Make `completeSession` suppress marker creation only when an exact-range/temporal-paired review exists, not merely any same-day review.
3. Add explicit P3 acceptance assertions for both cases:
   - existing legacy marker is upgraded in place;
   - same-day different-range review does not suppress the upgraded marker.

VERDICT blockers=0 high=2 med=0 nits=0
