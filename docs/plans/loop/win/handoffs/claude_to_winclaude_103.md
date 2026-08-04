# CLAUDE → WINCLAUDE — ORDER 103 (BATCHED flag-OFF visual checks: dashboard streak + df2-11 teacher modals)

TWO flag-OFF visual checks on 25WT, both behind `REVIEW_V2_CLIENT` (stays FALSE). **No AI spend** — both are
VIEW/interaction checks, no test submission, no grader call. Both prove the same thing: a flag-gated client
fold left the LIVE surface BYTE-IDENTICAL for the 947 students / their teachers on the legacy path today.

## SHARED GATES (both tasks)
- **25WT SANDBOX ONLY, never 26SM.** The dev build writes to REAL production Firebase.
- **Do NOT flip `REVIEW_V2_CLIENT`** (stays false — this is FLAG-OFF parity, not flag-on).
- Dismiss the first-run "Customize Your Flashcards" modal explicitly (a selector behind it hangs silently).
- Capture the console for each run; any NEW error/warning is a finding. The 4 `[PHASE]` "impossible state"
  warnings are PRE-EXISTING (`studyService.js:294`), NOT findings.
- **Do NOT edit source to make anything render.** If something does not load/render, that IS the finding —
  report it, do not fix it. If the dev server will not start, that is a REPORT, not something to fix.

## TASK 1 — dashboard-streak-authority (committed f60ebf7): flag-OFF Dashboard parity
`dashboard-streak-authority` added a new client read (`src/services/streakCredits.js` +
`src/utils/streakAuthority.js`) and a new import + effect in `Dashboard.jsx`, all behind `REVIEW_V2_CLIENT`.
Prove the two things a byte-diff cannot:
1. **The Dashboard still LOADS** — the new `streakCredits`/`streakAuthority` imports must not break page load
   or throw at mount. Log in as a 25WT student, dismiss the modal, land on the Dashboard, confirm it renders
   fully (hero + panels; no blank/interstitial).
2. **The streak still RENDERS UNCHANGED** — the hero streak pill ("🔥 N-day streak") and the stat tile
   ("N days") show a normal styled number (whatever the legacy calc yields — a per-list number is correct
   flag-off; the VALUE is not the point), not broken/missing/NaN.
EXPECTED DIFFERENCES: NONE (byte-identical flag-off change). Screenshot the Dashboard (desktop 1440).

## TASK 2 — df2-11 teacher review-settings (committed 1c05038): flag-OFF teacher-modal parity
`df2-11` added a review-settings group behind `REVIEW_V2_CLIENT` to TWO teacher modals via a flag-scoped
min/max→new-group SWAP. Flag-OFF, both modals must show TODAY'S "Review Test Settings" section (the Min
Questions / Max Questions fields) exactly as before, and still save. Log in as a 25WT **teacher** (owner of
a 25WT class), then:
1. **AssignListModal** — open the "Assign List" modal on a 25WT class. Confirm the "Review Test Settings"
   section renders with **Min Questions + Max Questions** (today's fields), NOT a new threshold/queue-size
   group. Confirm the modal still assigns (or at least renders + validates without error).
2. **ClassDetail "Edit List Settings"** — open the Settings gear on an assigned list. Confirm the same
   "Review Test Settings" (Min/Max) section renders as today, and the save works.
3. **ClassDetail read card** — confirm the per-list card shows NO review-settings block (as today; the new
   read surface is flag-ON only).
EXPECTED DIFFERENCES: NONE flag-off (the new reviewPassThreshold/reviewQueueSize/reviewTestSize/
reviewGateEnabled group is flag-ON ONLY, dead until the flip). If you see the NEW group flag-off, that is a
finding. Screenshot both modals (desktop 1440).

## AFTER
Set the win baton `turnOwner=claude round=103 execDecision=<CLEAN|PASS_WITH_GAP|finding> updatedBy=winclaude`
with a plain answer PER TASK: (1) does the Dashboard LOAD + the streak render unchanged? (2) do BOTH teacher
modals render today's Min/Max "Review Test Settings" section (NOT the new group) + still save, and the read
card shows no review block? (3) any NEW console error/warning beyond the known `[PHASE]` pair?
