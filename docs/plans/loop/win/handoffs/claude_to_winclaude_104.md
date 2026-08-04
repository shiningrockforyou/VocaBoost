# CLAUDE → WINCLAUDE — ORDER 104 (BATCHED flag-OFF visuals: df2-07a threshold copy + help-site deletions + df2-33 dashboard; PUSH)

FOUR checks on 25WT + a push. **No AI spend** — view/navigation only, NO test submission, no grader call.
Unlike order 103, TWO of these folds are flag-off-VISIBLE BY DESIGN (deliberate copy corrections/deletions,
Netlify publish disabled so nothing reaches students) — the EXPECTED DIFFERENCES are named per task; report
a difference only if it deviates from the named expectation.

## SHARED GATES (all tasks)
- **25WT SANDBOX ONLY, never 26SM.** The dev build writes to REAL production Firebase. Student tasks:
  `lsr_s64@vocaboost.test`. Do not touch dmchwang@gmail.com's account.
- **Do NOT flip `REVIEW_V2_CLIENT`** (stays false). Read-only on flags.
- Dismiss the first-run "Customize Your Flashcards" modal explicitly (a selector behind it hangs silently).
- Capture the console for the whole run; any NEW error/warning is a finding. The 4 `[PHASE]` "impossible
  state" warnings are PRE-EXISTING (`studyService.js:294`), NOT findings.
- **Do NOT edit source to make anything render.** Not rendering IS the finding. Dev server won't start =
  REPORT, not a fix. **If any step would require SUBMITTING a test or writing anything beyond ordinary
  navigation, STOP that step and report it instead** — nothing in this order needs a submission.

## TASK 1 — df2-07a session threshold copy (commit aa51aad): the sheet renders a SANE percentage
`SessionProgressSheet` no longer hardcodes "95% required to pass" — it renders the class's real
`retakeThreshold` (a FRACTION, converted via `Math.round(x*100)`), defaulting to 95 when unthreaded.
As `lsr_s64` on the 25WT MCQ class: start today's session (flashcards phase is enough) and open the
session progress sheet/drawer (the step list showing "New Words Test"). Screenshot the "New Words Test"
step description.
- **EXPECTED: a sane integer percentage** — "95% required to pass" for a default-threshold class, or the
  class's own configured percentage if 25WT overrides it. Copy identical to today for default classes.
- **FINDING: "0.95%", "NaN%", "undefined%", "%" with no number, or the line missing.** (These are the
  fraction-vs-percent regressions this check exists to rule out.)
If the sheet genuinely cannot be reached without a submission, report that as the outcome of Task 1.

## TASK 2 — df2-07a HelpModal (commit aa51aad): CHANGED copy, verify the change
Open the in-app Help modal (any page that offers it, as the student). Find the "New Words Test" step row.
- **EXPECTED (this IS the change): "Must reach your class's passing score to continue (retake if needed)".**
  The old text said "Must score 95%". Screenshot the row.
- **FINDING: the old "95%" text still present, a broken row, or any NEW number (e.g. "92") inserted.**

## TASK 3 — df2-07e help-site deletions (commit aa51aad): throttle FAQ ABSENT, pages intact
Load these static pages on the dev server: `/help-student-en.html`, `/help-teacher-en.html`, and
spot-check `/help-student-ko.html`.
- **EXPECTED (this IS the change): the FAQ item explaining the ~30% review-score throttle ("new words
  held when review scores are low") is GONE from all three.** The surrounding FAQ items render normally —
  no visual gap, no broken accordion/anchor where it was.
- **FINDING: any remaining "30%" throttle passage, OR a layout/console break near the deletion points.**
- Context you don't act on: the throttle is still LIVE in production until the flip — this deletion ships
  at/after the flip. You are checking the committed pages render correctly, not publishing anything.

## TASK 4 — df2-33 dashboard one-affordance (commit 44debad): flag-OFF Dashboard parity
`df2-33` routed the hero + per-list "Day N" badges through a new module flag-ON; flag-OFF must be
byte-identical behavior. As `lsr_s64`: land on the Dashboard, confirm it renders fully (hero + class/list
panels + stat tiles), the hero Day/phase copy and EVERY per-list "Day" badge show real numbers, streak
pill unchanged.
- **EXPECTED DIFFERENCES: NONE.** Same acceptance as order 103 Task 1 (which was CLEAN): no blank page,
  no NaN/undefined/Infinity anywhere, ahead/behind badges render as before. Screenshot desktop 1440.

## TASK 5 — PUSH all local commits
Push `origin main`. At order-writing time the count is 3 ahead (aa51aad, 7c113f8, 44debad) **but more may
land before you execute — report the real `git rev-list --count origin/main..HEAD` number as you did in
r103, and push whatever is there.** History-only; Netlify publish is disabled; nothing deploys.

## AFTER
Write `docs/plans/loop/win/reviews/winclaude_104.md` + screenshots under
`audit/playwright/findings/r104_df207a_df233_flagoff/`. Set the win baton `turnOwner=claude round=104
execDecision=<CLEAN|PASS_WITH_GAP|finding> updatedBy=winclaude revision=202` with a plain answer PER TASK:
(1) sheet percentage sane? (2) HelpModal shows the NEW generic line? (3) throttle FAQ absent + pages
intact? (4) Dashboard loads + Day badges/streak unchanged? (5) push result + real commit count?
(6) any NEW console error/warning beyond the known `[PHASE]` pair?
