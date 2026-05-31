# B27 Recovery — DEFINITIVE Test (RECOVER3)
Date: 2026-05-31T16:52:04.685Z
Label: RECOVER3
Method: Persistent browser context (launchPersistentContext + fixed userDataDir)
        Scenario A: Real UI interaction — 80 flashcards via "I know this word" button → confirm modal → test

## Prior Test Contamination

| Agent | Flaw | Impact |
|---|---|---|
| RECOVER | Fresh Playwright context — empty localStorage | False negative about root cause |
| RESTART2 | Skip to Test shortcut — bypassed real study→test transition; code analysis confirmed bug | Correct bug ID, wrong test method |
| RECOVER3 (this) | Persistent context + real UI button clicks for all 80 cards | Definitive live confirmation |

## Scenario Results Table

| Scenario | Test Reached (Real Flow) | lastPhase Before Crash | intentional_exit Set? | Storage Preserved? | Answers Restored? | Prompt Shown? | Verdict |
|---|---|---|---|---|---|---|---|
| A (new-word test, real flow, crash) | YES (80 cards + confirm modal + Start Test) | NEW_STUDY | NO | YES | NO | NO | BUG_lastPhase_is_NEW_STUDY_not_NEW_TEST |
| B (review, injected REVIEW_TEST) | N/A (injected) | REVIEW_TEST (injected) | NO | YES | YES (routed to /typedtest) | N/A | REVIEW_RECOVERY_WORKS_WITH_CORRECT_LAST_PHASE |
| C (expiry control, 4min ago) | N/A (injected expired) | NEW_TEST (injected) | NO | YES | NO (expired) | NO | EXPIRED_STATE_CORRECTLY_NOT_RECOVERED |
| D (graceful close) | N/A (injected valid) | NEW_TEST (injected) | Not set by SPA nav | YES | N/A | N/A | GRACEFUL_CLOSE_CORRECTLY_SUPPRESSES_RECOVERY |

## Critical Evidence — Scenario A (DEFINITIVE)

1. Advanced account (UID: tVDBmGcf0nSW5CKndqrZ8lgQirE2), Day 3, 80 new words
2. Clicked "I know this word" (aria-label) 80 times via Playwright real UI
3. "Ready for the Test?" confirm modal appeared after card 80 (confirmModalSeen: true)
4. Clicked "Start Test" — navigated to /typedtest/k8tzOiiwotBbtJS3uTiv/8RMews2H7C3UJUAsOBzR
5. Test loaded: 30 typed input fields visible
6. Typed 3 answers: 'recovery_ans_1', 'recovery_ans_2', 'recovery_ans_3'
7. Waited 1500ms for autosave debounce
8. localStorage BEFORE crash:
   - testKey: vocaboost_test_k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new (EXISTS, answerCount=3)
   - lastPhase: "NEW_STUDY" ← BUG (should be NEW_TEST)
   - intentional_exit: [] (NOT set — correct for crash)
   - isExpired: false (within 3-min window)
9. ctx.close() — no beforeunload, no intentional exit
10. localStorage IMMEDIATELY after reopen (same userDataDir):
    - testKey: PRESERVED (answerCount=3 still there)
    - lastPhase: "NEW_STUDY" (unchanged)
    - exitKeys: [] (no intentional exit)
11. Navigated to session via SPA pushState
12. DailySessionFlow.checkTestRecovery(): wasInTestPhase("NEW_STUDY") = FALSE → recovery SKIPPED
13. App showed: "New Words Study — Day 3, Card 1 of 80" (fresh study, no recovery)
14. RESULT: NO recovery prompt, NO answers restored, URL /session/... (not /typedtest/)

## Root Cause (Code-Verified, Now Live-Confirmed)

navigateToTest() in DailySessionFlow.jsx (~line 1088) calls navigate() WITHOUT first writing
lastPhase:'NEW_TEST' to localStorage. The useEffect at lines 382-401 that writes lastPhase:'NEW_TEST'
only fires when phase === PHASES.NEW_WORD_TEST — but navigateToTest() never sets phase to NEW_WORD_TEST,
it just calls navigate() directly. The component unmounts before React re-renders with the new phase.
Result: lastPhase stays 'NEW_STUDY' → checkTestRecovery() condition 1 fails → no recovery.

## Fix (One Location)

In DailySessionFlow.jsx, inside navigateToTest() BEFORE the navigate() call (~line 1145):

  if (user?.uid && sessionConfig?.dayNumber) {
    const sid = getLocalSessionId(user.uid, classId, listId, sessionConfig.dayNumber, testPhase)
    saveLocalSessionState(sid, {
      lastPhase: testPhase === 'new' ? 'NEW_TEST' : 'REVIEW_TEST',
      testType: testPhase,
      wordPool: wordPool.map(w => ({ id: w.id, word: w.word })),
      sessionContext: { dayNumber: sessionConfig.dayNumber, phase: testPhase, isFirstDay: sessionConfig?.isFirstDay }
    })
  }

## DEFINITIVE VERDICT

GENUINE RECOVERY BUG CONFIRMED (HIGH severity)

lastPhase value captured via real flow: NEW_STUDY (NOT NEW_TEST)
Storage preserved across persistent context crash: YES (confirmed)
intentional_exit set on crash: NO (confirmed)
Answers restored: NO (recovery skipped due to wrong lastPhase)
Root cause: navigateToTest() navigates without writing lastPhase:'NEW_TEST'
Prior RECOVER "restart loses work HIGH": correct severity, wrong root cause
Is 3-min window the only real gap: NO — there is also the lastPhase bug (HIGH)
Graceful close correctly suppresses recovery: YES
Review recovery works when lastPhase correct: YES (Scenario B confirmed)
Final severity: HIGH (unchanged)
