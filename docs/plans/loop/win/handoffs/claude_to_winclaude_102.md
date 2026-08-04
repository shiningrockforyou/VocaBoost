# CLAUDE → WINCLAUDE — ORDER 102 (batched flag-OFF visual checks: cutover-c completion + cutover-d refusals)

Two flag-OFF visual checks on 25WT, both behind `REVIEW_V2_CLIENT` (stays FALSE). Typed submission
authorized ≤200 (David) where needed.

## SHARED GATES (both tasks)
- **25WT SANDBOX ONLY, never 26SM.** The dev build writes to REAL production Firebase.
- **Do NOT flip `REVIEW_V2_CLIENT`** (stays false — this is FLAG-OFF parity, not flag-on).
- Dismiss the first-run "Customize Your Flashcards" modal explicitly (a selector behind it hangs silently).
- Capture the console for each run; any NEW error/warning is a finding. The 4 `[PHASE]` "impossible state"
  warnings are PRE-EXISTING (`studyService.js:294`), NOT findings.

## TASK 1 — cutover-c: flag-OFF DAY-COMPLETION parity (committed `063ed17`)
Prove the day COMPLETES and ADVANCES normally on the legacy path (the engine `completeDay` adapter is dead
code flag-off). Drive a full day to completion on a 25WT MCQ class: new-word study → new-word test → SUBMIT
→ result → review test → SUBMIT → result → the day completes and advances (the "Completed Day N" summary +
advance to the next day / TWI update). Confirm the completion + advance render and behave as before cutover-c.

## TASK 2 — cutover-d: flag-OFF REFUSAL-BANNER rendering (LIVE UI — this restyled the error banners)
cutover-d tokenized the shared error/`submitError` banners that 947 students see today (both legacy AND rv2
paths render through them). Confirm:
- Trigger a refusal/error state (e.g. a submit/save error — a network blip during submit, or any blocked
  state you can reach) and confirm the banner renders with the design tokens (NOT broken/unstyled), in BOTH
  light AND dark mode.
- If reachable: a `grade_unusable` → recompose should show the FRESH test with a NON-BLOCKING banner, NOT
  the full-page "Something went wrong" interstitial (the A1 bug fix). This may be hard to trigger
  deliberately; if you can't reach `grade_unusable`, say so — the banner-rendering + dark-mode check is the
  priority (the A1 fix is fixture+mutant-verified in code).
- Confirm NO error banner renders unstyled/broken in light or dark.

## AFTER
Set the win baton `turnOwner=claude round=102 execDecision=<CLEAN|PASS_WITH_GAP|finding> updatedBy=winclaude`
with a plain answer PER TASK: (1) does flag-off day-completion render/advance unchanged? (2) do the refusal
banners render correctly — design tokens, light AND dark, both paths?
