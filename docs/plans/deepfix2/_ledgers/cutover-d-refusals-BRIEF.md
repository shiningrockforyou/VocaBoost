# CUTOVER-D-REFUSALS — IMPLEMENTER BRIEF (the ledger is law) — ⚠ a LIVE-UI fold

## Read first
1. `docs/plans/deepfix2/_ledgers/cutover-d-refusals-fold-ledger.md` — THE LEDGER, your contract. V1-V5 are
   ANSWERED (a scout, file:line inside). **⚠ LIVE-UI:** the refusal render sites (`error`/`submitError`
   banners) are SHARED by the legacy AND engine paths — 947 students see them today. A3 (tokenization) is a
   LIVE cosmetic change (restyle to tokens, PRESERVE behavior); A1/A2 are flag-gated (rv2-only).
2. `src/services/reviewV2Compose.js` (`REFUSAL_REASONS` :141-164, `classifyThrownRefusal`) ·
   `reviewV2Submit.js` (recompose-once guard :97-119, the reason constants) · `reviewV2Complete.js`.
   `src/pages/MCQTest.jsx` (the recompose bug :783-813; V3 render sites) · `TypedTest.jsx` (:1054-1091;
   V3 sites) · `DailySessionFlow.jsx`.
3. cutover-a/b/c fixture pattern — USE `scripts/deepfix2/lib/fold-harness.mjs`; name yours `cutover-d-*`.

## A1 — the recompose state-collision BUG (PRIORITY; verify V2 in code first)
On a SUCCESSFUL `grade_unusable`→recompose swap (`MCQTest.jsx:783-813`, `TypedTest.jsx:1054-1091`) the code
`setError(out.reason)` — but `error` gates the full-page "Something went wrong" interstitial (`:1440`, when
`!showResults`), so the student gets a BLOCKING card, not the swapped test+banner. AND `loadTestWords`'s
"Try Again" (`:264-293`, PATH A `:269`) rebuilds from the STALE closure `testConfig.wordsToTest`, not the
fresh presentation just swapped in ⇒ a later submit answers the new `presentationId` with the old words ⇒
server drift-reject (`callables.js:527-529`). **FIX:** the recompose reason renders in a NON-BLOCKING banner
(`submitError`-shaped / inline, NOT the `error` full-page state); `loadTestWords`/retry reads the SWAPPED
presentation blob. Both pages. VERIFY the mis-wiring matches V2 before editing; if it differs, STOP + report.

## A2 — the reuse_anchor_mismatch coverage gap
Add a `REUSE_ANCHOR_MISMATCH` entry to `REFUSAL_REASONS` (`reviewV2Compose.js:141-164`) with specific,
student-safe copy (not the generic). Fixture: renders its specific reason; an unknown/retired status still
falls to `GENERIC_REFUSAL_REASON`.

## A3 — tokenize + make coherent the raw-Tailwind refusal render sites (LIVE UI)
Migrate raw `red-*`/`gray-*`/`blue-*`/`yellow-*` at the V3 sites (`MCQTest.jsx:1853-1858,1861-1881,1944-1954`;
`TypedTest.jsx:2122-2126,2226-2248,2250-2283`) to design tokens (`bg-error`/`text-text-error`/etc.), matching
the token-compliant treatments already in the same files. **PRESERVE BEHAVIOR** (which state shows what, the
retry affordances) — a restyle, not a UX redesign. The legacy error banners restyle too (live) — that's
expected; the visual check confirms. Verify with a grep that no raw `bg-red-`/`text-red-`/`bg-gray-`/etc.
remains in the touched refusal blocks.

## Scope — DECIDED, do NOT exceed
- RV2 refusal copy is a SEPARATE register from DF2-07 messaging — do NOT author `06_MESSAGING_COPY.md` or
  re-do the copy vocabulary; keep the existing "deliberately minimal" strings (tokenized). Record the
  register decision at the three adapter headers (they currently say "fold 51d owns the final copy") — D1.
- Do NOT touch the silent/transient states (not-serving, `grading_in_progress`, `no_evidence`'s sub-reasons)
  — they are CORRECT (V4).
- E1 (df2-07 coordination) + E2 (the DailySessionFlow dead-end UX question) are CARDED, not this fold.

## Constraints
- NO git commit/add · NO `.claude/*` · NO `change_action_log` write (propose the row TEXT) · NO flag-value
  changes · stage nothing (a concurrent session shares the repo).
- Run `gate.mjs --plan <ledger path>` before editing and `gate.mjs <ledger path>` at the end; include both.
- Restore the tree after each mutant.

## Refusal (a REPORT, not something to fix)
- The recompose bug mechanics differ from V2 → STOP, cite file:line.
- A tokenization would change error BEHAVIOR (not just styling) → STOP.
- The emulator won't start / anything needs production credentials → STOP.

## Report
`filesChanged` manifest + files created; V2's confirmed bug mechanics; evidence JSON paths + re-run commands;
the grep-assert output (no raw Tailwind left in the refusal blocks); ledger rows ticked vs not; the proposed
change-log row; the verbatim gate output. **Flag that this is a LIVE-UI fold** — the WinClaude visual check
is owed and load-bearing (it restyles what 947 students see on an error). Claims without evidence are unverified.
