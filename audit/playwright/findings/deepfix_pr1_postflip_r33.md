# Round 33 — PR-1 post-flip prod smoke: complete → advance (LIVE build)

**VERDICT: ✅ PASS** — the definitive PR-1 proof (the leg deferred from r31), reproduced on **two independent** stuck accounts on the real production build.

- **Build:** LIVE prod `main@59df732` — the 3 PR-1 flags (REVIEW_PAIRING_V2 / REENTRY_GUARD / RECOVERY_GUARD) are ON in production. No dev server, no flag flip.
- **Base:** https://vocaboostone.netlify.app
- **Claim proven:** a stale-complete stuck student **completes the paired review and ADVANCES** (csd increments), **not** re-stranded on the stuck day or thrown to an empty re-entry.

## Results

| Account | State | Entry path | Study | Review test | Score | **csd before → after** | Re-stranded? | Verdict |
|---|---|---|---|---|---|---|---|---|
| `dup_repro_a` | mutated (shakedown) | resumed mid-flow | 63 cards | MCQ 30/30 | 17% (5/30) | **21 → 22** | no | PASS |
| `dup_repro_b` | **pristine** | re-entry modal fired fresh | 60 cards | MCQ 30/30 | 17% (5/30) | **17 → 18** | no | PASS |

`dup_repro_c` — **left untouched** (reserve, per handoff).

## What the pass shows
1. **Re-entry → Retry Review Test → playable review** renders on live prod (confirmed; `dup_repro_b` showed the fresh "Retry Review Test" re-entry modal, then the 60-card study loop).
2. **The review test is an MCQ** (`/mcqtest/`, 30 questions), not the typed test. Completed 30/30 and submitted on both.
3. **csd advances on COMPLETION regardless of score.** Both samples scored **17% (5 of 30)** — the results screen even reads *"Needs Attention · Low scores significantly slow your progress"* — and **both still advanced** (21→22, 17→18). This matches the handoff spec exactly: *the review always "passes"; the point is completion, not the score.* The paired review completes the anchor day and the student moves forward.
4. **`twi` unchanged** on both (1200→1200, 596→596) — the review path introduces no new words; only the anchor DAY completes and `csd` increments. Expected.

## Method note (why the first two r33 runs were INCONCLUSIVE, not FAIL)
- **r33 (v1):** assumed a typed test → `readTestRows` found 0 `input[placeholder*=definition]` rows; also called `enterReviewSession` (a dashboard re-entry helper) which is wrong when already in-session. Never reached the test. → driver gap.
- **r33 v2 (first pass):** reach-loop regex matched **"Take Test"** (page button) with `.first()` and never clicked the modal's **"Start Test"** — both buttons coexist in the DOM. Stuck at the "Ready for the Test?" modal. → driver gap.
- **r33 v2 (fixed) → v3:** click **"Start Test"** (modal CTA) first; then detect `/mcqtest/` and drive the MCQ (click first choice card per question, watch the `Submit Test N/30` counter, submit at 30). → reached completion → **PASS**.
- No product defect was ever observed; all three earlier INCONCLUSIVEs were harness gaps, corrected without touching any product code.

## Evidence
- Driver: `audit/deepfix/task6/pr1_e2e_r33v3.mjs`
- JSON: `audit/playwright/findings/deepfix_pr1_postflip_r33.json`
- Screenshots (per account, 5 steps): `findings/pr1_r33v3_dup_repro_{a,b}_{1entry,2studydone,3test,4submitted,5advance}.png`
- Invocation:
  ```
  LSR_BASE_URL=https://vocaboostone.netlify.app LSR_ALLOW_PROD_SMOKE=vocaboostone.netlify.app \
  NODE_OPTIONS=--use-system-ca node audit/deepfix/task6/pr1_e2e_r33v3.mjs <email>
  ```

## Scope / safety
- SANDBOX accounts only (`dup_repro_*@vocaboost.test`) — never 26SM.
- No `src/**`, `functions/**`, `firestore.rules`, or `featureFlags.js` changes this round (PR-1 flags already live in prod). Executor write-scope respected.
