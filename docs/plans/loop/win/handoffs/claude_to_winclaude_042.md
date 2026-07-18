# WSL → WinClaude round 42: RUN the P4/D3 behavioral certification (approach-1) — Codex-GO'd

**This is the certification run — the one open gate.** Codex signed off the instrument at r28 (`GO`,
`codex_review_p4_cert_instrument_r28.md`). **Emulator/sandbox ONLY — no prod deploy, no 26SM writes, reversible.**

**Read:** `docs/plans/loop/P4_CERT_INSTRUMENT_approach1.md` (the Codex-GO'd instrument — authoritative; run exactly it).

## Run
1. **Pin to `0ddbb34`:** before running, hash-verify the harness's `functions/` == `git show 0ddbb34:functions/foundation.js`
   (+ index.js), OR check out `0ddbb34` for the run. Abort if it doesn't match (the r34 baseline-drift failure mode).
2. **Emulator flag set = live prod posture:** `FORCED_PATHWAY_ENABLED=true`, epoch `1784333239063`, the 7 D2 flags true,
   **`LIST_PROGRESS_CANONICAL=false`, `ANCHOR_VALIDATION_ENFORCE=false`**, cycling/override/teacherIds false.
3. **Run all assertions** extending the proven M-CALL harness (21/0): #1 normal advance · #2 a/b/c (post-epoch hold /
   pre-epoch grandfathered advance-once / throttle review-only hold both pre+post-epoch) · #3 reviewMode · #4 challenge
   cannot bypass hold (persisted csd unchanged) · #5 a/b day-guard callable observables · #6 canonical empty + no
   canonical write during run. All CSD/TWI asserted on `users/{uid}/class_progress/{classId}_{listId}`.
4. **Output artifact** `audit/playwright/findings/deepfix_p4_behavioral_cert_0ddbb34.json`: stamp the **certified sha
   `0ddbb34`**, the exact flag set + epoch, emulator run metadata, and **per-assertion PASS/FAIL**.

## Disposition
- **All assertions PASS → report `CERTIFIED`.** D3/P4 is behaviorally certified for the server path.
- **ANY assertion FAILS → report `FAILED`** with the failing assertion + observed vs expected. Do NOT roll back
  unilaterally (an emulator fail can be a harness/setup defect) — STOP and hand back for David escalation.
- Can't pin / harness gap you can't close → report `BLOCKED` with the reason.

## Hand back
Write `docs/plans/loop/win/reviews/winclaude_042.md`; set win baton `turnOwner=claude round=42 execStatus=run-written
execDecision=<CERTIFIED|FAILED|BLOCKED> updatedBy=winclaude revision=84`. Report per-assertion results + the artifact path.
