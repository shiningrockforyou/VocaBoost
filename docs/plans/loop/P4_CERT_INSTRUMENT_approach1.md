# P4/D3 Behavioral Certification Instrument — approach-1 (emulator re-cert at prod flag set)

**Purpose:** behaviorally certify the D3/P4 forced-pathway **server** path that the live cutover (`6bffe1c` client →
`0ddbb34` functions) activated — closing the C4 gap (the hold-csd branch is untested at every layer; the M-CALL r34
cert used a stale baseline + inverted flags). This is the certification bar the 5-way convergence named. **Codex must
sign off on THIS instrument** (that a pass adequately certifies the live branch) before WinClaude runs it.

## Environment (safety)
- **Firebase EMULATOR only** (sandbox). **No 26SM writes. No prod deploy. Read-only wrt prod.** Reversible by construction.
- **Pinned to functions tree `0ddbb34`** (Fable-1 requirement): before running, `git show 0ddbb34:functions/foundation.js`
  (+ index.js) must hash-match the harness's functions source, OR check out `0ddbb34` for the run. The output artifact
  MUST stamp the certified sha so we never again cite a cert whose baseline drifted (the r34 failure mode).

## Flag set — the LIVE PROD posture (NOT the M-CALL full-on set)
Set in the emulator exactly as deployed at `0ddbb34`:
- `FORCED_PATHWAY_ENABLED = true`, grandfather epoch `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS = 1784333239063`
- the 7 D2 flags true (`SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`,
  `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `ANCHOR_VALIDATION_SHADOW`,
  `REVIEW_ENGAGEMENT_STAMP_ENABLED`, `RECOVERY_SCORE_CLAMP_ENABLED`)
- **`LIST_PROGRESS_CANONICAL = false` and `ANCHOR_VALIDATION_ENFORCE = false`** (the exact live posture — the two flags
  M-CALL r34 wrongly had true). Cycling/override/teacher-ids false.

## The certification assertions — all must PASS (callable/emulator observables; Codex r27-corrected)
All CSD/TWI outcomes are asserted on the canonical-OFF target doc **`users/{uid}/class_progress/{classId}_{listId}`**
(NOT `list_progress`, which must stay empty — assertion 6).

**1. Normal completion (non-held day):** `completeSession` on a normal day advances `currentStudyDay` by **exactly 1**
   AND `totalWordsIntroduced` to the new anchor, written to `class_progress/{classId}_{listId}`.

**2. Forced-pathway HOLD — the core new branch (3 explicit subcases).** Hold logic at `foundation.js:1462`:
   `fpHoldCsd = FORCED_PATHWAY_ENABLED && (fpThrottleReviewOnly || (dayNumber>=2 && !fpReviewEngaged))` — grandfather
   affects only `fpReviewEngaged`, NOT `fpThrottleReviewOnly`.
   - **2a. Post-epoch, non-engaged, NORMAL allocation** — Day≥2, submittedAt > epoch, `engagedReview=false`/insufficient
     answers, `allocationZero=false`, not list-complete, not review-study-resume → expect `status="review_recorded"`,
     **NO csd advance, NO twi advance**, `review_recorded` log emitted. *(Proves the F3 engagement hold, independent of throttle.)*
   - **2b. Pre-epoch (grandfathered), non-engaged-looking, NORMAL allocation** — same as 2a but submittedAt <
     `1784333239063` → grandfather makes it completion-engaged, so the non-engagement hold must **NOT** fire; with a
     valid day/new-anchor (or valid non-review-only evidence) completion **advances EXACTLY once**. *(Proves the
     grandfather boundary prevents old skip-like reviews being stranded — the I1 population.)*
   - **2c. Throttle review-only day** — recent sessions / persisted `reviewMode` force binary-throttle `allocationZero`,
     not list-complete, not review-study-resume → expect `status="review_recorded"`, **NO csd/twi advance**, `reviewMode`
     persisted from held recentSessions. *(Proves the throttle hold branch `fpThrottleReviewOnly`, independent of
     grandfather.)* **Run 2c BOTH pre- and post-epoch; it must hold in both.**

**3. `reviewMode`** is written to progress/session and read back correctly (asserted within 2c).

**4. Challenge cannot bypass the hold:** after a held review-only day, `advanceForChallenge` (challenge acceptance) does
   **NOT** advance the held day — assert the **persisted csd is unchanged** after the call (prove the day did not
   advance, not merely that `progress.reviewMode=true` triggered an early return).

**5. Day-guard (callable observables — NOT DSF/UI; this is the callable cert):**
   - **5a. Normal legitimate completion** — callable result is NOT `day_guard_rejected`; NO
     `day_guard_rejected_session_cleared` / `day_guard_session_clear_FAILED` log; csd/twi match assertion 1.
   - **5b. Stale-day completion** — callable returns `status="day_guard_rejected"` / `dayGuardRejected=true`; csd/twi
     **UNCHANGED**; the stale `session_states` doc is cleared; **EXACTLY ONE** of `day_guard_rejected_session_cleared` /
     `day_guard_session_clear_FAILED` is emitted (success expected under normal emulator conditions).
   *(DSF UI recovery, if ever required, is a SEPARATE UI smoke — this callable cert does not claim to prove it.)*

**6. No canonical writes (both checks):** for the test uid, ZERO `users/{uid}/list_progress` docs exist; AND no
   global/sandbox canonical `list_progress` write is created by the resolver/completion path during the run (while
   `LIST_PROGRESS_CANONICAL=false`).

## Pass criteria & output
- **PASS = all 6 assertions green** at the pinned `0ddbb34` + prod flag set. Output artifact
  `audit/.../deepfix_p4_behavioral_cert_0ddbb34.json`: per-assertion result, the certified sha, the exact flag set,
  emulator run metadata. WinClaude review `winclaude_04X.md`.
- **ANY assertion fails → D3/P4 has a real behavioral defect → STOP, escalate to David.** A fail is a rollback
  candidate (flip the 4 client flags false + push) — but diagnose first (emulator ≠ prod could mean a harness gap).
- On PASS → **D3/P4 is CERTIFIED**; update MASTER_TASK_LIST D3 ✅ and unblock the D4/P5 planning gate.

## Harness
Extend the proven M-CALL harness (21/0) with a `FORCED_PATHWAY_ENABLED=true` variant at the prod flag set + the
forced-pathway scenarios above. Reuse existing callable-test scaffolding; add the epoch-boundary cases for assertion 2.

## Codex sign-off ask
Confirm: (a) this flag set == the live `0ddbb34` posture; (b) the 6 assertions + the epoch-boundary cases in #2
adequately exercise the forced-pathway hold-csd branch the cutover activated; (c) the `0ddbb34`-pinning + sha-stamp
requirement is sufficient to avoid the r34 baseline-drift failure; (d) pass criteria are correct. Then it's a
Codex-GO'd cert instrument and WinClaude runs it.
