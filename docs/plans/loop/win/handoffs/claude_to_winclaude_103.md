# CLAUDE → WINCLAUDE — ORDER 103 (flag-OFF visual check: dashboard-streak-authority)

One flag-OFF visual check on 25WT, behind `REVIEW_V2_CLIENT` (stays FALSE). **No AI spend** — this is a
Dashboard VIEW only (log in, look at the streak); no test, no submission, no grader call.

## THE ONE THING THIS EXISTS TO PROVE
`dashboard-streak-authority` added a new client read (`src/services/streakCredits.js` +
`src/utils/streakAuthority.js`) and a new import + effect in `Dashboard.jsx`, all behind
`REVIEW_V2_CLIENT`. Flag-OFF the streak still comes from the legacy `calculateStreak` (proven
BYTE-IDENTICAL in code). **Two things a browser must confirm that a byte-diff cannot:**
1. **The Dashboard still LOADS** — the new `streakCredits`/`streakAuthority` imports must not break page
   load or throw at module/mount time. 947 students are on this exact flag-off path.
2. **The streak still RENDERS UNCHANGED** — the hero pill (top streak "🔥 N-day streak") and the stat
   tile ("N days") show a normal styled number, exactly as before this fold.

## SHARED GATES
- **25WT SANDBOX ONLY, never 26SM.** The dev build writes to REAL production Firebase.
- **Do NOT flip `REVIEW_V2_CLIENT`** (stays false — this is FLAG-OFF parity).
- Dismiss the first-run "Customize Your Flashcards" modal explicitly (a selector behind it hangs silently).
- Capture the console for the whole run; any NEW error or warning is a finding. The 4 `[PHASE]`
  "impossible state" warnings are PRE-EXISTING (`studyService.js:294`), NOT findings.
- **Do NOT edit source to make anything render.** If the Dashboard does not load, that IS the finding —
  report it, do not fix it. If the dev server will not start, that is a REPORT, not something to fix.

## TASK — flag-OFF dashboard streak parity (committed this round)
1. Log in as a 25WT student **who has an active streak if one exists** (any class/modality — the streak is
   modality-independent; MCQ is fine). Dismiss the modal.
2. Land on the Dashboard. Confirm **it loads fully** (hero + panels render; no blank/interstitial).
3. Read the **streak in two places**: the hero streak pill and the stat tile. Confirm both show a normal
   styled number (whatever the legacy calc yields — the VALUE is not the point; a per-list number is
   correct flag-off), not broken/missing/NaN/undefined.
4. **EXPECTED DIFFERENCES: NONE.** This is a byte-identical flag-off change — the streak must look exactly
   as it did before. The ACCOUNT-WIDE number is flag-ON only (dead until the flip); do not expect it.
   If the streak looks different from a normal Dashboard, that is a finding.
5. Screenshot the Dashboard (desktop 1440) showing both streak sites.

## AFTER
Set the win baton `turnOwner=claude round=103 execDecision=<CLEAN|PASS_WITH_GAP|finding>
updatedBy=winclaude` with a plain answer: (1) does the Dashboard LOAD flag-off with the new imports?
(2) does the streak render UNCHANGED (hero pill + stat tile, a normal styled number)? (3) any NEW console
error/warning beyond the known `[PHASE]` pair?
