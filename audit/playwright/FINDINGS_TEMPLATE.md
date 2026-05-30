# Findings — Batch BXX: <Batch Title>

**Run date:** YYYY-MM-DD HH:MM (timezone)
**Duration:** mm:ss
**Environment:** Chromium <version> on <Linux/macOS>, Firebase emulator <up/down>
**Tester / agent:** <name or agent id>

## Executive summary

One paragraph. What was tested, what broke. If everything passed, say so explicitly — empty findings files are a smell.

## Scenario coverage

| # | Scenario | Persona | Result | Severity if failed |
| --- | --- | --- | --- | --- |
| S01 | <one-line description from batch spec> | Careful Student | ✅ Pass | — |
| S02 | <…> | Rushed Student | ❌ Fail | HIGH |
| S03 | <…> | — | ⏸ Skipped | — |

Use ✅ Pass / ❌ Fail / ⏸ Skipped / 🟡 Partial. Skipped scenarios must include a one-line reason ("blocked: signup CAPTCHA enabled in emulator").

## Findings

For each FAIL or PARTIAL above, fill one block. Numbered F01, F02, …

---

### F01 — <one-sentence bug summary>

**Severity:** BLOCKER / HIGH / MEDIUM / LOW / NITPICK
**Persona:** <which persona triggered it>
**Scenarios touched:** S01, S03
**Reproducible:** YES / INTERMITTENT (n/m runs) / ONCE

**Repro:**
1. Concrete step
2. Concrete step
3. …

**Observed:**
What happened. Quote console errors verbatim. Reference screenshots by path (`findings/evidence/B02/B02_S01_03_after_submit.png`).

**Expected:**
What should have happened, and why (link to PLAN.md severity rubric or to a CLAUDE.md rule when relevant).

**Likely root cause (hypothesis):**
One sentence. Don't dive into the code unless the hypothesis is one Edit deep — leave detective work to the fix PR.

**User impact:**
Concrete sentence in student-facing language. "Student finishes a 30-question test, taps Submit, sees an error, and loses all 30 answers on refresh." Better than "submitTestAttempt fails to retry."

**Evidence:**
- `findings/evidence/B02/B02_S01_03_after_submit.png`
- `findings/evidence/B02/B02_S01_firestore_after_retry.json`
- console: `findings/evidence/B02/B02_console.log` lines 142–158

**Fix shape (optional):**
Only if you can articulate a clean fix in one sentence. Otherwise leave blank.

---

### F02 — …

---

## Observations (not yet findings)

Things you noticed that aren't bugs per the rubric but might be worth tracking:

- Submit button label is "Submit" on review tests but "Finish Test" on new-word tests — inconsistency, low priority.
- Console warns about React keys on the SessionProgressSheet drawer — investigate next refactor.

## Caveats / what wasn't tested

- "Multi-tab race S07 skipped — second tab didn't get auth state in time; retry with `storageState` next pass."
- "Firestore emulator returned 503 during S04; finding is suspect."

## Recommended fixes (top 3 from this batch)

1. F01 — <one-line fix>
2. F02 — <one-line fix>
3. F03 — <one-line fix>

These feed into `findings/RECOMMENDATIONS.md` at aggregation time.

## Next batch

After this batch, the next batch to run is BXX+1 unless a BLOCKER above changes the stop condition in BATCH_ORCHESTRATION.md.
