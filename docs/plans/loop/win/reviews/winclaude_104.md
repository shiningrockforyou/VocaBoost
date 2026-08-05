# WinClaude r104 — ORDER 104: df2-07a copy + help-site deletions + df2-33 dashboard (flag-OFF) + push

**Date:** 2026-08-05 · **Baton rev in:** 201 → **out:** 202
**Evidence:** `audit/playwright/findings/r104_df207a_df233_flagoff/` (7 screenshots @1440 + `console.json`)

## VERDICT: `CLEAN` (all four checks)

| # | Question | Answer |
|---|---|---|
| 1 | Sheet percentage sane? | **YES — “92% required to pass”** |
| 2 | HelpModal shows the NEW generic line? | **YES**, and the old “95%” text is gone |
| 3 | Throttle FAQ absent + pages intact? | **YES**, all three pages |
| 4 | Dashboard loads + Day badges/streak unchanged? | **YES** |
| 5 | Push | **`e37fe76..879b713`** — real count **6** (order said 3) |
| 6 | New console error/warning beyond `[PHASE]`? | **NO — 0 errors, 0 beyond the known pair** |

## TASK 1 — df2-07a session threshold copy ✅ and better than "not broken"

Progress sheet (`04-T1-progress-sheet.png`), step 2: **“New Words Test — 92% required to pass.”**

- **A sane integer percentage.** None of the regressions this check exists to rule out: no `0.92%`, no
  `NaN%`, no `undefined%`, no bare `%`, line not missing.
- **It is the class's REAL configured value, not the 95 default.** At r103 I read this same class's
  *Edit List Settings* modal, which shows **Pass Threshold = 92** for “LSR TOP Vocab (audit clone)”. The
  sheet now renders **92**, so the `retakeThreshold` really is being threaded through and converted
  correctly (`Math.round(x*100)`) — the hardcode is genuinely gone. **That is stronger evidence than a
  default-95 class could have given.**

Verified on the screenshot, not just the text extraction.

## TASK 2 — df2-07a HelpModal ✅

Row reads: **“New Words Test — Must reach your class's passing score to continue (retake if needed)”**.
The new generic line is present; **“Must score 95%” is absent**; no new number inserted. (`02-T2-helpmodal.png`)

## TASK 3 — df2-07e help-site deletions ✅

All three pages load (HTTP 200) and render fully — TOC, sections, FAQ accordions, no visual gap or broken
anchor at the deletion point (`05/06/07-T3-*.png`). **No `30%` anywhere in any of the three.**

### I nearly filed a false finding here too — the mechanism, recorded

My first grep reported **2 throttle hits in `help-student-ko.html`** and 0 in the English pages, which looked
like a missed Korean deletion. **It was my pattern, not the page.**

- I had used a **broader Korean pattern** (`낮으면` = “if low”) than English (`30%|throttl|held back`), so the
  comparison was asymmetric.
- The commit shows the deletion applied to **all four** pages — `5 lines removed each` from
  `help-student-en/ko` and `help-teacher-en/ko`. The removed item is the specific FAQ
  *“I'm only getting review words… pauses new words… roughly above 30%”*.
- Re-grepping **symmetrically** shows English retains the **same** general adaptive-pacing copy the Korean
  hits were (`help-student-en:1032` *“If your scores are low, new words decrease and review increases”*;
  `help-teacher-en:899`). The two Korean lines are their direct counterparts — **general pacing copy that was
  never in scope**, not the deleted FAQ.
- Confirmed on the Korean page: `grep -c "30%"` → **0**.

**Deletion is consistent across all four pages. No finding.**

## TASK 4 — df2-33 dashboard parity ✅

`01-T4-dashboard.png`: hero + class/list panels + stat tiles all render; **“🔥 1-day streak”**; hero badge
**“DAY 6 · STEP 1 OF 2”** (real numbers, correctly advanced from the r102 completion); **no
`NaN`/`undefined`/`Infinity`** anywhere in the rendered text. Expected differences: none, as specified.

## TASK 5 — push

**`e37fe76..879b713`**, `origin/main` == local HEAD. **Real count 6**, not the 3 the order stated — you
anticipated this and asked for the real number; third round with the count drifting, and reporting the actual
figure is now routine. History-only; Netlify publish disabled; nothing deployed.

## Console

**130 messages · 0 errors · 8 warnings · 0 warnings beyond the known `[PHASE]` pair** (explicitly filtered
and counted).

## A pattern I am now treating as a standing rule

**Three false positives in two rounds** — r102's phantom dark-mode contrast, r103's phantom "new group", and
this round's phantom Korean throttle passage. Each came from trusting a text match or a computed value over
the artifact itself, and each would have sent you chasing a bug that does not exist. **Rule: for a render or
content question, the screenshot / the actual diff is the authority; the string match is only a pointer to go
look.** Cheap heuristics find candidates; they do not file findings.

## Boundaries honoured

25WT sandbox only (`lsr_s64@vocaboost.test`), **never 26SM**, David's account untouched · `REVIEW_V2_CLIENT`
read-only, still `false` · **no test submitted, no grader call, no AI spend** · no deploys · no commits,
branching, stash or reset · `node_modules` untouched · no source edited to make anything render.

## STANDBY

Baton returned at rev **202**, `execDecision: CLEAN`. Watcher armed.
