# WSL-Claude → Windows-Claude: PROD SMOKE (post-deploy verification, LIVE production)

> David pushed `main` → Netlify built → the deepfix initial release (incl. **#11**) should now be LIVE at
> **https://vocaboostone.netlify.app**. Verify critical things work on the live build. ~20-30 min.

## ⚠️ SAFETY — read first
- **SANDBOX ACCOUNTS ONLY** — `lsr_*@vocaboost.test` + 25WT classes. **NEVER 26SM / real students.** The
  identity guard enforces this (fail-closed); if it ever trips on a non-`lsr_*` account, STOP + report.
- The base guard now allows the ONE prod host via an explicit opt-in (`LSR_ALLOW_PROD_SMOKE=vocaboostone.netlify.app`).
  This is deliberate + David-authorized. Data-safety is unchanged from prior runs (sandbox → prod Firebase).
- **No dev server needed** — Playwright hits the live URL directly.

## Step 0 — did the deploy actually land? (30 seconds, do this FIRST)
Navigate to `https://vocaboostone.netlify.app`, open console, evaluate:
```js
window.__VOCABOOST_BUILD__
```
- **Expect `shortSha: "4b8452a"`** (the pushed `main` commit) and `dirty: false`. That confirms Netlify built the
  new code. If it shows an OLDER sha, `unknown`, or the object is missing → **the build didn't land / stamp issue —
  report immediately** (the rest is moot until the deploy is confirmed).

## Step 1 — critical-flow smoke (~20-30 min)
```
LSR_BASE_URL=https://vocaboostone.netlify.app LSR_ALLOW_PROD_SMOKE=vocaboostone.netlify.app NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s130@vocaboost.test,lsr_s131@vocaboost.test,lsr_s132@vocaboost.test,lsr_s133@vocaboost.test LSR_TIER=base DFX_SCENARIOS="RO-S1 RO-S9 RS-1 RS-2" DFX_CONCURRENCY=2 node audit/playwright/lsr_deepfix_ui.mjs prod-smoke-r1
```
Coverage: **RO-S1** = new-word day completion (the **#11** advance path) · **RO-S9** = read-surface render ·
**RS-1/RS-2** = gradebook (the C-33/C-34/C-35 deployed fixes).

## What actually matters (this is a DEPLOY smoke, not a count audit)
**PRIMARY signals (report these clearly):**
- Build stamp = new SHA (step 0). ✅/❌
- Site loads; login works; the session screens + gradebook **render** (no blank/white screens).
- A new-word test **submits + grades** (grading callable reachable on prod); the day **completes**.
- **Console errors** — quote any that aren't benign (favicon/analytics/Firestore-channel aborts). On PROD there's
  no dev-asset abort, so console-errors are more meaningful than in the local runs.
- Screenshots of: dashboard, a session/test screen, the gradebook, results.

**SECONDARY (don't over-weight):** the exact count oracles (csd 0→1, Showing=N). s130-133 are REUSED sandbox
students, so a count-mismatch is most likely list-scoped **pollution**, NOT a live defect. Report the verdict,
but flag count-fails as "likely pollution" unless paired with an actual error/blank/grading-failure.

**RED FLAGS (report immediately, don't wait for the full run):** site won't load, build stamp OLD/missing, login
fails, blank screens, grading throws, a fatal console error, or the identity guard trips.

## Deliverable
FINAL manifest + full stdout/stderr, per-scenario verdict+detail verbatim, the build-stamp object, console-error
list, `findings/deepfix_ui_prod-smoke-r1.{json,md}`, screenshots. Executor-only (no edits). Sandbox only.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_026.md`
- `baton.json`: `turnOwner="claude"`, `revision=52`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 52`.
