# CLAUDE → WINCLAUDE — ORDER 107 (FLAG-**ON** VISUAL WALKTHROUGH: the new UI, on 25WT — DAVID AUTHORIZES + IS PRESENT)

**This is the FIRST flag-ON visual of the program.** Every prior visual order proved flag-OFF parity
(nothing changed for the 947 students). This one proves the opposite thing: that the new UI actually
appears and works. **It requires TWO gates to be opened, one of which is a production data write, so it
does not run without David.**

## WHY IT CANNOT BE DONE ANY OTHER WAY (verified 2026-08-05, do not re-litigate)
- `REVIEW_V2_CLIENT = false` (`src/config/featureFlags.js:243`) — the client renders none of the new UI.
- `system_config/review_v2`: `enabled: false`, `rehearsalClassIds: []` — the engine refuses to serve
  even if the client asks.
- WSL cannot run vite at all (`rollup` native binary is win32-only — re-tested today), so the
  orchestrator cannot produce these screenshots from its side under any configuration.

## THE TWO GATES (David opens them; both are REVERSIBLE and both must be closed again after)
1. **Server (production write, David's authorization):** add ONE 25WT sandbox class id to
   `system_config/review_v2.rehearsalClassIds`. **Leave `enabled: false`** — the rehearsal-class list is
   the scoped opener; a global `enabled: true` is the FLIP and is NOT this order.
2. **Client (local only, never committed):** set `REVIEW_V2_CLIENT = true` in the working tree for the
   dev run. **Do NOT commit it. Do NOT push.** Restore it to `false` before finishing.

## WHAT TO CAPTURE — the walkthrough David asked for (desktop 1440, full-page each)
Log in as the 25WT student in that rehearsal class (**25WT ONLY — never 26SM**).
1. **Dashboard, flag-on** — the whole page. Expect the new **"Past days"** button on the list card, and
   (only if a half-finished restudy visit exists) the **resume panel** near the top. A first run will
   likely have NO resumable visit — that is CORRECT, not a defect; capture the absence.
2. **Every menu/pop-up expanded, one shot each** — the PDF menu on a list card, the session-progress
   sheet, the Help modal, and any other overlay the Dashboard offers. (Flag-off versions of several of
   these already exist from orders 103/104; this is the flag-on comparison.)
3. **The past-days browser** — click "Past days". Capture: the day list with the 5-state chips, the
   progress pips, the bookmark toggle (toggle one, screenshot before AND after), today's row shown as
   in-progress-not-actionable, and the "re-tests never change your progress" banner.
4. **FREE-NAV EXPLORATION — the point of this order.** Start today's session and capture the
   **Review / New words toggle**: a shot on each side, and a shot of a disabled half if today has one.
   Then exercise it: switch review→new→review and confirm the session does NOT advance the day and no
   score changes. **Capture the day number before and after** so the non-advancement is visible, not
   asserted.
5. **A past-day RE-TEST, if fold 51-d has landed by the time you run this** (check with WSL first — if
   it has not landed, SKIP this step and say so; do not improvise): start one, capture the flow, and
   capture what happens at the end. **MCQ class strongly preferred — a typed re-test bills the live AI
   grader.**

## REFUSAL CONDITIONS (any one ⇒ STOP, restore both gates, report)
- David is not present, or has not authorized the `rehearsalClassIds` write.
- You are about to set `enabled: true` (that is the FLIP — a different, later, David-gated event).
- The class you are about to add is not a 25WT sandbox class.
- Any instruction drifts toward 26SM, a deploy, a push, or committing the flag change.
- **Anything is broken and you feel tempted to edit source to make it render — if it does not render,
  THAT IS THE FINDING.** Report it with the screenshot; do not fix it.

## AFTER — RESTORE BOTH GATES (non-negotiable, verify each)
1. Remove the class id from `rehearsalClassIds` (back to `[]`) and re-read the doc to confirm.
2. Restore `REVIEW_V2_CLIENT = false`; `git status` must show a clean `featureFlags.js`.
3. Confirm nothing was committed or pushed.

## EXPECTED DIFFERENCES, named up front (so a real bug is not hidden behind an expected one)
This is flag-ON, so **almost everything is expected to differ** from the order-103/104 baselines. What
is NOT expected: any crash, any blank page, any NaN/undefined, any console error beyond the known
`[PHASE]` pair, a day advancing from a toggle, or a re-test altering the original score. Capture the
console for the whole run.

## AFTER
Write `docs/plans/loop/win/reviews/winclaude_107.md` + screenshots under
`audit/playwright/findings/r107_flagon_walkthrough/`. Baton back `turnOwner=claude round=107
execDecision=<CLEAN|finding|REFUSED> revision=<+1>`, answering: (1) does the new UI appear? (2) does
free-nav work without advancing the day? (3) do the chips/pips/bookmark behave? (4) any new console
error? (5) **were both gates restored?**
