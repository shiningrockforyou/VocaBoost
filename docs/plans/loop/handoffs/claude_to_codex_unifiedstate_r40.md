# WSL → Codex round 40: ARCHITECTURE REVIEW — unified session state (one derivation, one container)

David wants to kill the redundant screens via "one state-aware screen/modal reused throughout, computing state from the record."
WSL mapped it (two read-only explorations: UI flow + state-derivation surface) → plan:
**[`docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md`](../../UNIFIED_SESSION_STATE_ARCHITECTURE.md)** — read it.

## The claim to pressure-test
- "What should the student see?" is computed in **~11 scattered sites** (client + server, hand-synced byte-parity twins) with NO
  canonical function — and this duplication is the root of the month's off-by-one/throttle/dual-class/runaway bugs.
- The UI is ~13 screens that are really ~4 states of one machine (study→test→results duplicated for new/review; 3 results
  surfaces; 2 phase enums; vestigial RetakePrompt; unrendered REVIEW_TEST; 2 Dashboard start paths).
- **Target:** one server-authoritative record → one pure `deriveSessionState(record, dayAttempts, assignment, now) → view-model`,
  shared by client + server, UI as pure render. Stuck-notification = a derived `heldReason` field.

## Your review (answer the §6 open questions + poke holes)
1. **Extraction feasibility:** is `deriveSessionState` genuinely a PURE function today, or do Firestore/async reads
   (unmastered-pool, cross-class anchor via `getMostRecentPassedNewTest`, cycling) block a clean pure extraction? Where's the
   real seam between "read the record" and "derive"? Trace `initializeDailySession` + `determineStartingPhase`.
2. **Sequencing vs P5/canonical:** the "one authority" step assumes the `LIST_PROGRESS_CANONICAL` flip (single writer). Can step
   (a) (extract `deriveSessionState` + route the EXISTING call sites through it, no behavior change) land BEFORE the canonical
   flip, or does the current two-writer/flag-suppressed-twin reality make even that unsafe? What's the safe first increment given
   the pinned `0ddbb34` GO-HOLD cutover?
3. **Shared client↔server module:** can a shared `src/utils` be imported by the Cloud Function cleanly (bundling, `new Date()`/
   `Math.random` server hazards, the KST-offset issue the token work hit)? Or must the twins stay, just generated from one source?
4. **Missed edge states:** enumerate any state the current scatter handles that a single view-model would DROP — cross-class
   LIST_SCOPED_RECON, cycling, grandfather epoch (1784333239063), #9-resume, list-end terminal, the review-pass gate we banked.
5. **Deleting `session_state.phase` as routing input:** does that lose crash-recovery / multi-tab behavior, or is it safe (the
   routing code already declares it untrusted)?
6. Overall: is the single-derivation direction SOUND, and what's the biggest risk / the correct FIRST increment?

## Hand back
Write `docs/plans/loop/codex_reviews/codex_unifiedstate_r40.md`. Set baton `turnOwner=claude round=40 taskId=UNIFIED_SESSION_STATE
codexStatus=review-written codexDecision=DONE updatedBy=codex revision=151
codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_unifiedstate_r40.md`.

---

## UPDATE (2026-07-20, David re-requesting Codex): the 3-critic convergence ALREADY RAN — now VALIDATE/REFUTE it

While you were offline, the critical convergence ran WITHOUT you (1 Fable + 2 Opus + WSL) → **§8 of the plan**. David wants
your independent input now. So this is no longer a cold review — **read `docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md`
INCLUDING §8, and act as the 4th independent voice: confirm or REFUTE the critics' findings with your own code tracing.**
Priorities (highest-value first):

- **G0 (the structural claim):** the completeness critic says the seam `deriveSessionState(record)→VM` is entry-only, and ~⅓ of
  states are WRITE-TIME exit outcomes (`completed`/`review_recorded`/`no_evidence`/`day_guard_rejected`/`already_completed`/
  `requiresNewWordRetake`/`quarantined`) NEVER persisted to the record (foundation.js:1466-1506), so a pure(record) fn renders a
  held/refused submit as "success" → need a 2nd `lastWriteOutcome` channel = TWO derivations. **Is this RIGHT?** Trace it. This is
  the load-bearing claim — if true it reshapes the whole design; if overstated, say why.
- **C1:** Dashboard must be excluded from the byte-identical first increment (class-scoped Dashboard.jsx:1620-1622 vs cross-class
  db.js:3416-3423 inputs). Confirm/refute.
- **G1:** `heldReason:'low-reviews'|'list-end'` is semantically wrong (list-end ADVANCES; #9-resume + skip-hold missing). Confirm.
- **G3/G4:** `determineStartingPhase` impure (writes impossible_phase_detected, studyService.js:298-305); "caller does async reads"
  hides ORDERED WRITES (returnMasteredWords :355 before pool read :418) = "input-assembly infidelity." Confirm/refute.
- **G6:** the banked review-pass gate edits the same lines (studyService.js:266-270/312-321) → sequence after it. Agree?
- Then the original §6 questions (extraction seam, sequencing vs P5, shared-module hazards, session_state.phase deletion).

Anything the 3 critics MISSED? And: is the CORRECTED first increment in §8 right, or still off?

## Hand back (UPDATED)
Write `docs/plans/loop/codex_reviews/codex_unifiedstate_r40.md` (agree/refute per finding + your own additions + verdict
SOUND/SOUND-WITH-GAPS/NOT-SOUND + biggest risk + the correct first increment). Set baton `turnOwner=claude round=40
taskId=UNIFIED_SESSION_STATE codexStatus=review-written codexDecision=DONE updatedBy=codex revision=153
codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_unifiedstate_r40.md`.
