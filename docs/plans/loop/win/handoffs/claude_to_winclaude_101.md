# CLAUDE → WINCLAUDE — ORDER 101 (cutover-b flag-OFF visual — TYPED SUBMISSION NOW AUTHORIZED)

Re-run of order 100's TASK 2. The only change: **David authorized the typed-grading spend** — up to ~200
typed submissions on 25WT for testing. The cost-guard that stopped you at the new-word typed gate is
LIFTED. Reach submit→grade→result this time.

## TASK — cutover-b flag-OFF visual check, end to end
Prove the submit→grade→result path renders/behaves UNCHANGED flag-OFF (947 students are on this legacy
path; the engine adapter is dead code while `REVIEW_V2_CLIENT=false`).
- **25WT SANDBOX IDENTITIES ONLY, never 26SM.** `lsr_s64@vocaboost.test` on 25WT RUNSL P1 worked at r100;
  reuse it or another 25WT account. The dev build writes to REAL production Firebase — 25WT only.
- **Do NOT flip `REVIEW_V2_CLIENT`** (stays false — this is FLAG-OFF parity, not flag-on).
- **Typed submission is AUTHORIZED** (David, up to ~200 submissions): SUBMIT the new-word typed test and
  drive it through grading. Do NOT stop at the typed gate this round.
- Dismiss the first-run "Customize Your Flashcards" modal explicitly (a selector behind it hangs silently).
- **Drive end to end:** new-word study → new-word TYPED test → **SUBMIT** → grade → **result card** →
  review test → submit → result card. **Capture the console for the whole run.**
- **Expected:** behavior identical to before cutover-b (legacy path; the adapter only activates flag-ON).
  The 4 `[PHASE]` "impossible state" warnings are PRE-EXISTING (studyService.js:294, a comment-only change
  by the fold — traced at r099/r100) — NOT new, NOT a finding.
- **REFUSAL:** if the dev server won't start → REPORT, don't fix. Do NOT edit source to make something
  render — if the flag-off submit→grade→result path does NOT render/behave as legacy, that IS the finding.

## AFTER
Set the win baton `turnOwner=claude round=101 execDecision=<CLEAN|finding> updatedBy=winclaude` with the
PLAIN answer: does the flag-OFF submit→grade→result path render and behave unchanged, with a clean console?
