# B29 — Crash/Refresh Recovery Audit (standing batch)

**Why a dedicated batch:** recovery is the class of bug that hides — a feature that looks wired but whose trigger never fires, so it silently no-ops. It must be asserted explicitly every regression run, not assumed. Prior re-tests (RECOVER, RESTART2) were each invalidated by a harness artifact; this batch encodes the correct method so it can't recur.

## HARNESS RULES (mandatory — both prior runs failed one of these)
1. **Preserve localStorage across "restart":** use `chromium.launchPersistentContext(userDataDir, ...)` with a FIXED userDataDir; close + reopen = real restart. NEVER a fresh empty context (that wipes localStorage and fakes a loss).
2. **Reach the test the REAL way:** study flashcards → "Go to Test"/navigateToTest. NEVER use the session-menu "Skip to Test" shortcut for recovery tests (it's a legitimate feature but bypasses the normal study→test path).
3. **Crash ≠ graceful close:** a crash must NOT trigger `beforeunload` (which sets intentional_exit and correctly clears recovery). Close the context to mimic process death; assert intentional_exit is NOT set after reopen.

## MUST-ASSERT checks (fail loudly, don't assume)
- **R1 (trigger marker):** on the test screen with ≥1 answer entered, read session-recovery localStorage key and ASSERT `lastPhase === 'NEW_TEST'` (new) / `'REVIEW_TEST'` (review). *Currently expected to FAIL — see findings_recovery_trigger.md (marker likely never written; setPhase(NEW_WORD_TEST) is never called).*
- **R2 (answers persisted):** assert `vocaboost_test_*` holds the typed answers + valid expiresAt.
- **R3 (crash recovery):** crash (rule 3) → reopen → ASSERT routed back into the TEST (not study/dashboard) AND answers restored AND a recovery prompt shown.
- **R4 (expiry boundary):** answers >3 min old → assert loss is due to expiry only (isolates the MEDIUM 3-min-window gap from a real bug).
- **R5 (graceful close control):** graceful close → reopen → assert recovery correctly SUPPRESSED (intended). Proves crash-vs-close distinction.
- **R6 (new + review):** run R1–R3 for both test types.

## Outputs
findings/findings_B29_recovery.md (per-check pass/fail + captured lastPhase value), evidence/B29/ (localStorage before-crash/after-reopen snapshots + screenshots). Tie back to findings_recovery_trigger.md.

## Current status
RECOVER3 (in flight) performs R1–R5 and reports the captured lastPhase value. When it lands, fold its result here and confirm/deny the suspected HIGH. Re-run after any recovery fix is deployed.
