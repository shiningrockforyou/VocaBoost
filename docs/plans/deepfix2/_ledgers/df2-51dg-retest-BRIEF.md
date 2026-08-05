# BRIEF — 51-d + 51-g: wire the re-test, render the cap, fix the reload gap
2026-08-05 · orchestrator → implementer (OPUS — this touches the live test-taking path) ·
ledger `_ledgers/df2-51dg-retest-fold-ledger.md`
Folds 4 + 7 of 8, COMBINED because they own the same files. Read `22_DF2-51_PASTDAY_NAV_DESIGN.md` §7
(RATIFIED) first — decisions (h) and (i) are this fold's, verbatim.

## What has already landed — CONSUME, never duplicate
| fold | file | what it gives you |
|---|---|---|
| 51-a `19dd849` | `src/utils/pastDayAuthority.js` | day rows/states/pips + `canRetestTyped` (presentation-only cap predicate; its `{refused, scope, windowKey}` snapshot shape was defined FOR you — use it, don't invent a second) |
| 51-b `2779d4d` | `src/services/restudyVisit.js` | mint/persist/discard/re-mint-once of the `visitId`. **This fold is its first real caller.** Read its header: it mints at FIRST RERUN COMPOSE — that is you |
| 51-c `92bc6e0` | `src/pages/RestudyBrowser.jsx` | the Re-study / Re-test **stubs** you now wire (clearly named; do not fake navigation elsewhere) |
| ai-metering `d3dce7a` | `functions/aiMetering.js` | the SERVER cap. Refusal status is `practice_limit_reached` with a `scope`. **The server is the enforcement point; your client work is presentation only** |

## Build
### Leg 1 — wire Re-study and Re-test (51-d)
- Re-study opens that day's flashcards in the normal viewer, non-advancing.
- Re-test composes a rerun through the engine's existing rerun leg and runs the test. It must:
  - mint/attach the `visitId` via 51-b (the submit **requires** it — `callables.js` rerun txn refuses
    `visit_invalid` without one) and honor 51-b's discard/re-mint contract exactly;
  - be **non-advancing** — a rerun must never move the student's day or rewrite the original score.
    Verify the server guards you rely on and cite them; do not add a client-side "don't advance" hack;
  - respect `type:'retest'` stamping (the engine does it — confirm, don't reimplement).
- **MCQ re-tests are unmetered and must remain available even when typed is capped.**

### Leg 2 — render the cap refusal (decision (h))
`practice_limit_reached` is in **no** frozen client status list, so today a capped student sees generic
text. Add it to `src/services/reviewV2Client.js`'s classifiers + a student-facing message:
*"You've reached today's practice-grading limit — try again tomorrow, or use a multiple-choice
re-test."* **It must NOT poll and must NOT recompose** (it is permanent-for-today, not transient) —
prove that against the existing classifier sets, the way cutover-d proved `grade_unusable`'s handling.
Use 51-a's `canRetestTyped` to pre-empt where you can, but the server refusal must still render
correctly if it arrives anyway (belt and braces — the client predicate can be stale).

### Leg 3 — NTF-27, the hard-reload gap (decision (i))
NEED_TO_FIX 27: after a `grade_unusable` recompose, a hard reload loses `presentedWordIds` (the
sessionStorage blob persists only the presentation HANDLE), so the next submit answers a new
`presentationId` with the old word set → a safe server drift-reject, but a confusing dead end. Fix by
persisting `presentedWordIds` in the blob, OR by re-composing on reload for an rv2 presentation.
Choose, justify, and fixture it. Update NTF-27 with what you did.

## Constraints (law)
- **Touch ONLY**: `src/pages/MCQTest.jsx`, `src/pages/TypedTest.jsx`, `src/services/reviewV2Client.js`,
  `src/pages/RestudyBrowser.jsx` (wiring its stubs ONLY — no redesign), a sibling pure `.js` module if
  you need fixturable logic (this checkout cannot import JSX under plain node — 51-c/51-e both hit
  this), your fixtures/mutants, evidence JSONs, and your ledger. NOTHING else — NOT `functions/**`
  (the server is frozen for this feature), NOT `Dashboard.jsx`/`DailySessionFlow.jsx` (51-f/51-e just
  landed), NOT the landed utils/services, NOT any flag value.
- **Flag-off byte-identical.** `REVIEW_V2_CLIENT` stays `false`. These two test pages are the live
  path for 947 students — the whole cutover series shipped under this doctrine; match it exactly (read
  how cutover-b/d gated their changes in these same files).
- WSL cannot run vite — no build. `npx eslint`, report the delta vs HEAD per file.
- No commit, no staging. A parallel CS session shares this tree; never `git add`.

## Fixtures + mutants
Pure node. Cases at minimum: a rerun carries a `visitId` and is non-advancing · the visit contract is
honored (mint once, discard on completion, re-mint once on refusal — cite 51-b's evidence rather than
re-testing it) · `practice_limit_reached` renders its message and does NOT poll/recompose · MCQ stays
available when typed is capped · the reload gap: a reload mid-recompose no longer drift-rejects ·
flag-off parity for both pages. One mutant per new clause (at minimum: drop the visitId from the rerun
submit; classify `practice_limit_reached` as transient/pollable; drop the reload persistence). Evidence
JSON; numbers never hand-typed.

## Report back
Per-leg outcome; the server guards you verified for non-advancement (with cites); how you proved the
cap refusal doesn't poll or recompose; your NTF-27 choice and why; flag-off proof per file; eslint
deltas; fixture/mutant results; every judgment call; anything that would need a `functions/**` change
(that is a STOP — report it, do not widen). Your report is a CLAIM — an independent opus auditor
re-executes it before the orchestrator trusts it.
