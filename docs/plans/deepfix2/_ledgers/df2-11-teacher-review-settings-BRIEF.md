# DF2-11 TEACHER REVIEW-SETTINGS UI — IMPLEMENTER BRIEF (the ledger is law) — client-only, flag-gated, LIVE surface

You are an OPUS implementer. This touches LIVE teacher screens (26SM teachers use them today), so FLAG-OFF
BYTE-IDENTITY is the load-bearing property. The design is DECIDED — implement it; do not redesign.

## Read first
1. `docs/plans/deepfix2/_ledgers/df2-11-teacher-review-settings-fold-ledger.md` — **THE LEDGER, your contract.**
   V1-V5 ANSWERED (scout + orchestrator spot-verify, file:line inside). Tick every non-carded row with file:line.
2. `src/components/AssignListModal.jsx` — the initial-assign modal (239 lines); the min/max "Review Test
   Settings" section is :165-217; the 9-positional `onAssign(...)` is :49.
3. `src/pages/ClassDetail.jsx` — THREE relevant surfaces: `handleAssignList` (:390, calls assignListToClass),
   the "Edit List Settings" modal (:1128-1391; its min/max section :1258-1319; saves via `handleSaveSettings`
   :427 → updateAssignmentSettings), and the read-only per-list card (:799-820). **COPY THE PROVEN FLAG
   PATTERN already in this file:** `{CYCLING_ENABLED && (<section>)}` render (:1360) + `...(CYCLING_ENABLED ?
   {cyclingEnabled:…} : {})` save-spread (:448) — flag-off ⇒ key omitted ⇒ byte-identical.
4. `src/services/db.js` — `assignListToClass` (:805, write shape :829-840) + `updateAssignmentSettings`
   (:877, validation+patch :895+). BOTH writers get the new fields.
5. `functions/reviewV2/config.js:163-192` — the SERVER field contract your client validation MIRRORS
   (reviewPassThreshold [1,100], reviewQueueSize/reviewTestSize [1,500], reviewGateEnabled boolean,
   reviewTestType mcq|typed; defaults 92/60/30). The server is the AUTHORITY; your validation is UX.
6. `src/config/featureFlags.js:243` — `REVIEW_V2_CLIENT = false`, your gate (the SAME as the cutover).

## Mission (A1-A4, the ledger has the detail)
Behind `REVIEW_V2_CLIENT`, add a REVIEW-SETTINGS group to BOTH teacher modals + BOTH writers + the ClassDetail
read card, writing per-assignment `reviewPassThreshold`/`reviewQueueSize`/`reviewTestSize`/`reviewGateEnabled`
(+ `reviewTestType`). Flag-OFF, every surface renders + writes BYTE-IDENTICALLY to today (the dead min/max
section stays flag-off). The min/max→new-group swap is FLAG-SCOPED; do NOT physically delete min/max (E1).

## Design decisions (DECIDED — build on them, do not contradict)
- **Gate = `REVIEW_V2_CLIENT`** (build const; one gate for the whole client cutover). Flag-off the new group
  is dead code; the min/max section renders/writes exactly as today.
- **Both modals + both writers** get the new group (avoid the `studyDaysPerWeek` one-writer asymmetry).
- **Carry the new fields via an APPENDED options-object arg** on the modal callbacks — keep the existing 9
  positional args intact so the flag-off callback is byte-identical. Flag-off, pass no options object (or
  undefined) ⇒ the writer's spread-conditional omits the keys ⇒ byte-identical write.
- **Client validation MIRRORS `config.js`** (clamp or reject out-of-range BEFORE write); the server
  re-validates (HOLD on malformed), so your validation is UX, not the authority.
- **Keep `reviewPassThreshold` (92) DISTINCT** from the existing new-word `passThreshold` (95) — separate
  field, separate label ("Review Pass Threshold" vs the existing new-word one). English-only labels [R2-44],
  VISIBLE defaults.
- **Out of scope:** physical min/max deletion (E1, rides the flip), `testSizeReview` (E2, DF2-46), force-pass
  (E3, DF2-14), the flip deploy ordering (E4).

## Fixtures (GROUP C)
`scripts/deepfix2/df2-11-teacher-review-settings-fixtures.mjs` + a `-mutants.mjs`. `db.js` CANNOT load under
plain node (imports firebase) — either extract the assignment-object construction / validation into a pure
helper a fixture can import (as `streakAuthority.js` did for the dashboard fold), OR use the emulator via
`scripts/deepfix2/lib/fold-harness.mjs`. You pick the cleanest seam; state which and why.
- C1 flag-OFF writer byte-identity (new keys ABSENT, min/max PRESENT — same shape as HEAD).
- C2 flag-ON write (new fields written with validated values + defaults; min/max omitted).
- C3 validation, one valid+invalid PER field (the 5 fields, ranges/enum/boolean per V4).
- C4 one MUTANT per validation clause (widen a range / drop the enum guard ⇒ the invalid fixture goes RED),
  restore clean.
- C5 = the WinClaude visual (flag-off render parity) — NOT yours; the orchestrator dispatches it.
Write each fixture's evidence JSON to `docs/plans/deepfix2/evidence/df2-11-teacher-review-settings-*.json`
with `sourceShas`. Re-run AFTER your last edit.

## Constraints (hard)
- NO git commit/add · NO `.claude/*` (both `.claude/settings*.json` are already `M` in git status — NEVER
  touch/stage them) · NO `change_action_log` write (propose the row TEXT) · NO flag-value change
  (`REVIEW_V2_CLIENT` stays false) · stage NOTHING (a concurrent session shares the repo).
- Touch ONLY: `AssignListModal.jsx`, `ClassDetail.jsx`, `db.js`, `featureFlags.js` (import only — do NOT
  change any flag VALUE), the two new fixture/mutant `.mjs`, their evidence JSON, and the ledger (tick rows).
- Do NOT touch the other assignment fields/writers beyond adding the new keys; do NOT remove min/max; do NOT
  touch `calculateReviewTestSize`/`studyService`/`sessionTimeCalculator`.
- Run `gate.mjs --plan <ledger>` before editing and `gate.mjs <ledger>` at the end; include BOTH verbatim.

## Refusal (a REPORT, not something to fix)
- A flag-off surface CANNOT be kept byte-identical without a structural change beyond the flag-scope → STOP,
  cite file:line, report (do not force it).
- The server contract in `config.js` differs from V4 → STOP, cite it.
- Achieving parity would require touching a file outside the allowed list → STOP + report.

## Report (structured)
`filesChanged` manifest (absolute paths) + files created; the flag-scope approach per surface; the fixture
SEAM you chose + why; evidence JSON paths + re-run commands + the actual numbers; ledger rows ticked vs not;
the FLAG-OFF PARITY proof (per surface: the render is flag-scoped, the writer output byte-identical, the
callback byte-identical — cite file:line and the fixture); the proposed change-log row; verbatim gate output
(both --plan and final). Claims without an evidence file are unverified. Tell me what you did NOT do.
