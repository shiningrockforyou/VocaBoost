# Unified Session State — THE FULL MAP (markdown twin, 2026-07-24)

> **⛔ POST-R2 STATUS (2026-07-26): still 3×-audited ground truth for CODE ANATOMY (what exists today). Its
> DESIGN-direction content is SUPERSEDED: no `navigationMode`/FREE mode (§12 historical — R2-24/26/27 ONE universal
> model), the review gate ships ON@92 at DF2-14 (not "banked"), G-DUE is CANCELLED (R2-27 Q4), engagement is retired
> (R2-11). Governing: `docs/plans/deepfix2/11_` §1 + `02_TASK_LIST.md` v5.**

**What this is:** the complete UI/mechanics map of the VocaBoost study system in auditable form — every route, screen
state, logic gate, and navigation edge, with exact conditions and file:line. Assembled from 4 read-only code extractions
(2026-07-24). **Companions:** `docs/plans/UNIFIED_SESSION_STATE_ARCHITECTURE.md` (the plan; §11 = this content condensed)
and `docs/design/unified-session-state-wireframe.html` (the visual). **Status: DESIGN REFERENCE — audit target.** Every
section is a set of claims about the code; auditors should attack them claim-by-claim.

---

## 1. Route table (src/App.jsx — flat, no nested layouts)

| Path | Component | Guard | Line |
|---|---|---|---|
| `/` | Dashboard | Private | App.jsx:33 |
| `/login` · `/signup` | Login / Signup | public | :41-42 |
| `/lists` · `/lists/new` · `/lists/:listId` | ListLibrary / ListEditor | Private+Teacher | :43-72 |
| `/classes/:classId` | ClassDetail | Private+Teacher | :73 |
| `/session/:classId/:listId` | DailySessionFlow | Private | :83 |
| `/blindspots/:classId/:listId` | BlindSpotCheck — **PARKED (§13)** | Private | :91 |
| `/mcqtest/:classId/:listId` | MCQTest | Private | :99 |
| `/typedtest/:classId/:listId` | TypedTest | Private | :107 |
| `/gradebook` | Gradebook role=student, challengeMode=submit | Private | :115 |
| `/teacher/gradebook` | Gradebook role=teacher, challengeMode=review | Private+Teacher | :130 |
| `/settings` · `/profile` | Settings / Profile | Private | :146-161 |
| `*` | → `/` | — | :164 |

Guards: `PrivateRoute` — initializing→loading screen; `!user` → `/login` with `state.from` (PrivateRoute.jsx:17).
`TeacherRoute` — `user?.role !== 'teacher'` → `/` (TeacherRoute.jsx:16); always nested inside PrivateRoute.
apBoost block at App.jsx:162-163 (out of scope). Provider nesting: Theme > Auth > Simulation > Router (App.jsx:26-32).

## 2. Navigation map (from → to | trigger | site)

**Dashboard → session**
- Hero CTA → `/session/${focus.classId}/${focus.id}` — ALL hero labels, same target (Dashboard.jsx:1875)
- Hero "Advance to next →" → `/session/${classId}/${nextListId}` — gated `CONTINUATION_LINKS ∧ listFinished ∧ nextListId ∧ nextListTitle` (:1889-1897)
- Per-list "Start Session" → `handleStartSession` (:803-836): `!progressReady → return`; `shouldShowReEntryModal(...)` true → modal; else navigate (:829; catch-branch navigate :834)
- Re-entry modal: "Study Again" → `/session/...` (:2380); "Move to Next Day" → `clearSessionState` then `/session/...` (:839-852, nav :848)

**DailySessionFlow internal (setPhase, conditional render — NOT route nav)**
- Render: NEW_WORDS → StudyPhase (:1932); REVIEW_STUDY → StudyPhase (:1971); NEW_WORD_TEST transient (:1952); COMPLETE → CompletePhase (:1991)
- Auto-complete setPhase(COMPLETE) sites: :607, :782, :797, :864, :874, :1441, :1483, :1595
- Return-from-test effect: `location.state?.testCompleted` (:1388-1494); back-to-study: `location.state?.goToStudy` (:1335-1383, re-nav :1342)

**DSF → tests** — `navigateToTest(testPhase, mode)` (:1228-1332): route = `mode==='typed' ? '/typedtest' : '/mcqtest'` (:1267), state `{testConfig, returnPath:'/session/${classId}/${listId}'}` (:1326-1331). Callers: `goToNewWordTest` (:1001-1017), `handleFinishReviewStudy` (:1189-1199), crash-recovery (:698-736).

**Tests → back** — MCQ `handleFinish` → `returnPath` with `{testCompleted:true, testType, results}` (MCQTest.jsx:1051-1063; no returnPath → `/`). Typed `handleBackToSession` (TypedTest.jsx:1383-1395). Review retake re-navigates `?type=review` (MCQ:1037-1042 / Typed:1315-1320). NEW-test FAIL branch "Go to Dashboard" → `/` (MCQ:1226-1246 / Typed:1486-1506 — these buttons are in the new-fail card; the review results card renders a single Continue only, per §7) [F1 correction]. Quit confirm → `/` (MCQ:1091-1095 / Typed:582-586).

**Complete terminal exits** — "Back to Dashboard" → `/` after `clearAllSessionStates`+`clearSessionState` (DSF:1995-1999); "Advance" → next list (:2002-2011, CONT-A); "Start over" → same list (:2028-2032, `CYCLING_ENABLED ∧ cyclingSourceClassId`); move-to-next-day → `/` (:1660-1669); local-recovery start-fresh → same route replace (:1725-1739); fatal error → `/` (:1782).

**BlindSpot loop (parked)** — entered ONLY from Dashboard.jsx:2172-2180 per-list Link; internal state-driven; every exit `navigate('/')` (BlindSpotCheck.jsx:157/202/240/309). Does not touch the session flow.

**Chrome & remaining edges (F2 audit additions):**
- DSF quit: SessionHeader back button → "Leave Study Session?" confirm → `/` (DSF:1823, :1745-1748, modal :2038-2047)
- Re-entry modal 3rd action "Retry Review Test": `handleReEntryRetake` → rebuild set → `setPhase(REVIEW_STUDY)`; empty set → NoReviewModal (DSF:1632-1653)
- HeaderBar (on Dashboard/Settings): logo→`/`, Gradebook→`/gradebook`∥`/teacher/gradebook`, teacher Classes dropdown→`/classes/:id`, Lists→`/lists`, Profile/Settings, Sign Out, Help modal (HeaderBar.jsx:75/86/118-120/142-158/193-208/213-220/228)
- Settings back → `navigate(-1)` (Settings.jsx:121); teacher Dashboard →`/classes/:id` (:910), →`/lists/:listId` (:994)
- Dead edge note: `location.state?.goToStudy` has a receiver (DSF:1336) but NO live sender
- Dev overlays (env-gated, not student-reachable in prod): SimulationPanel (App.jsx:31), SegmentDebugPanel (Dashboard.jsx:35/2258-2265); Watermark overlay on all session/test screens (DSF:1779/1793/1819, MCQ:1112+, Typed:1335+)

## 3. Phase machine

**Three LIVE phase vocabularies + one dead:**
1. `SESSION_PHASE` persisted kebab (sessionService.js:27-33): `new-words-study / new-words-test / review-study / review-test / complete`
2. `PHASES` local snake (DailySessionFlow.jsx:77-84): `loading / new_words / new_word_test / review_study / review_test / complete`
3. `getSessionStep` vocab (sessionStepTracker.js:38-53): same snake strings as PHASES
4. DEAD: SessionProgressBanner.jsx:16-36 kebab variant (component has 0 imports)
Bridge: `currentPhaseMap` PHASES→SESSION_PHASE (DailySessionFlow.jsx:305-311), used only when persisting.

**`DEFAULT_SESSION_STATE`** (sessionService.js:38-48): `{phase: NEW_WORDS_STUDY, currentStudyDay:1, newWordsTestPassed:false, newWordsTestScore:null, reviewTestScore:null, reviewTestAttempts:0, newWordsDismissedIds:[], reviewDismissedIds:[], lastUpdated:null}`.

**`determineStartingPhase(attempts, dayNumber)` (studyService.js:228-329)** — the entry decision tree, in order:
- Setup: `toFraction = s => s==null ? s : (s>1 ? s/100 : s)` (:237); `dayAttempts = attempts.filter(a => a.studyDay === dayNumber)` (:239); best new = passed-first then score-desc (:245-249); paired review (:266-270): under `REVIEW_PAIRING_V2 ∧ newTest` → `find(a => FORCED_PATHWAY ? (reviewPairsWithAnchor(a,newTest) ∧ isCompletionEngaged(a)) : reviewPairsWithAnchor(a,newTest))`, else `find(a => a.sessionType==='review')`.
- Branch 1 (:282): `dayNumber>1 ∧ newTest?.passed ∧ !reviewTest` → `review-study` (+`newWordScore`)
- Branch 2 (:293): `dayNumber===1 ∧ newTest?.passed` → `complete` + fires `impossible_phase_detected` log (:298-305) — the §8-G3 side effect
- Branch 3 (:312): `dayNumber>1 ∧ newTest?.passed ∧ reviewTest` → `complete` (+both scores)
- Default (:328): `new-words-study`

**`initializeDailySession`** (studyService.js:347-568): calls the tree at :466; on `LIST_SCOPED_RECON ∧ phase===REVIEW_STUDY` zeroes `nwCount=0` preserving anchor range (:478-502); `isListComplete` at :561; returns `startPhase`/`recoveredNewWordScore`/`recoveredReviewScore` (:564-566).

**Resume/init routing (DSF init effect)** — doctrine: `session_state.phase` is NON-authoritative for routing; attempts are (#7, DSF:822-833). Key rows: startPhase COMPLETE → PHASES.COMPLETE (:599-608); startPhase REVIEW_STUDY + non-empty set → REVIEW_STUDY (:611-638, empty → NoReviewModal :617-623); test-crash recovery `wasInTestPhase(lastPhase)` → re-navigate to test (:679-743); durable COMPLETE day-1 → COMPLETE (:779-784); durable COMPLETE day-2+ w/ review (+REENTRY_GUARD day match) → COMPLETE + re-entry modal (:791-799); attempts-authority: `startPhase===REVIEW_STUDY` → REVIEW_STUDY (:836-850) · `newWordCount>0` → NEW_WORDS (:851-852) · segment non-empty → REVIEW_STUDY (:853-872) · all-mastered/empty → COMPLETE with NO completeSession write (:856-868) · fallthrough → COMPLETE (:873-874).

**In-session transitions:** NEW_WORDS → test route (goToNewWordTest :1001-1005); return day-1 → COMPLETE (:1412-1441); return day-2+ `score ≥ (retakeThreshold ?? 0.95)` → `moveToReviewPhase` → REVIEW_STUDY (:1446-1448) else → NEW_WORDS retake loop (:1449-1453); REVIEW_STUDY → review test (`handleFinishReviewStudy` :1189-1200, mode = `reviewTestType ∥ getReviewTestType(reviewTestAttempts, testMode)`); review return → COMPLETE (:1455-1483); NoReviewModal close → completeSession + marker attempt (:1053-1090; renders :1799/:2090) [cite fixed per F1].

**Test-side pass/fail (identical MCQ/Typed):** threshold resolution 4-deep: `testConfig.passThresholdDecimal` (MCQ:254-255) → `assignmentSettings.passThreshold/100` (:274-275) → class doc `assignments[listId].passThreshold` else 95 (:279-280) → `assignment.passThreshold/100` (:308); default `useState(0.95)` (MCQ:92); constant `DEFAULT_RETAKE_THRESHOLD=0.95` (studyAlgorithm.js:24).
- **`passed = currentTestType==='review' ? true : summary.score >= retakeThreshold`** — REVIEW ALWAYS PASSES (MCQ:581 / Typed:853).
- Results-card render: `passed = serverPassed ?? (Number.isFinite(retakeThreshold) ? score>=retakeThreshold : true)` — fails OPEN on non-finite threshold (Typed:1434-1435 / MCQ:1174-1175).
- Server-authoritative: `score = Math.round(fraction*100)`; `passed = sessionType==='review' ? true : score >= passThreshold` (0-100) (functions/index.js:433-434; threshold `assignment?.passThreshold ?? 95` :354).
- `canRetake`: `type==='new' ∧ score < retakeThreshold` (MCQ:564-566 / Typed:832-833). Retake = in-place resample via `selectTestWords`, NO navigation, new question set (MCQ:956-971 / Typed:1233-1249). Review retake = snapshot-restore (day-matched, <1hr) + re-navigate (Typed:1251-1320, MCQ:998-1042).
- `isSessionFinalTest = isFirstDay ? type==='new' : type==='review'` (MCQ:793-795 / Typed:1049); `passed ∧ final ∧ dayNumber` → snapshot → `completeSessionFromTest` (MCQ:800-874).
- Failed attempts ARE recorded (`passed:false`) — the `submitVocabAttempt` write is gated only on `!isPracticeMode` (Typed:978-984 / MCQ:710-712).

**`completeSessionFromTest` durable writes (studyService.js:1729-2022):** day-1 → `{scores, phase:COMPLETE}` (:1850-1859); day-2+ gate FAIL (**`!reviewOnlyDay ∧ newWordAttemptPassed !== true ∧ newWordScore < threshold`** — the attempt's `passed` flag is AUTHORITATIVE and short-circuits the score check, honoring teacher overrides / CS manual-passes / challenge regrades where `passed:true` with a lower score, :1881-1885) → NO write, returns `{requiresNewWordRetake:true}` (:1911-1921) [F1-W1 correction]; else → scores + `phase: (fpReview ∧ !fpEngaged) ? REVIEW_STUDY : COMPLETE` (:1923-1942). `reviewOnlyReasonConfirmed = allocation.newWords<=0 ∨ isListComplete ∨ startPhase===REVIEW_STUDY` (:1783-1786). Then `recordReviewOutcome` (hold) or `recordSessionCompletion` (:1971-1973); graduation only if `segment ∧ reviewScore != null` (:2006-2015).

**session_state fields:** `phase` written by persist/record/transition/complete sites (sessionService.js:273/295/313/329/402, DSF:320, studyService:1858/1941), read ONLY by `shouldShowReEntryModal` (:361) + DSF re-entry (:779) — display cache, demoted not deleted (§9).

**In-session chrome & modal layer (F2 audit additions — all student-visible):**
- **SessionMenu** (every study phase, DSF:1856-1868): skip-to-test → "Ready for the Test?" confirm (:2050-2062, handler :1750-1757); restore-dismissed → "Reset Progress?" confirm (:2065-2074, handlers :981/:1130); PDF download today/full (`handlePDFDownload` :446; SessionMenu.jsx:135/151, `generatingPDF` state); card-content toggles.
- **First-run "Customize Your Flashcards" modal** (`showCardSettingsModal`, DSF:2107-2178) — gates the first study experience; `showKoreanDef`/`showSampleSentence` feed Flashcard rendering (:1864-1867, :2297-2302).
- **Dismissed-words UI**: DismissedWordsDrawer w/ restore/restore-all (:2181-2187, handlers :1139/:1162); header count badge (:1843-1854); StudyPhase queue-empty terminal "All cards reviewed!" w/ Take Test / Study Again (:2262-2336, resets :1944/:1983).
- **Complete-screen variants**: list-end terminal (continuation vs static, :2442-2464) vs day-complete (:2466-2474); ahead/behind chip via `calculateExpectedStudyDay` (:2478-2492, built :1425-1430/:1467-1472); Day-1 welcome banner (:2495-2504).
- **RetakePrompt correction (F2+F3 convergent):** it IS rendered (DSF:1955) inside `phase===PHASES.NEW_WORD_TEST` (:1952) — dead only because no `setPhase` call (of 19) ever sets NEW_WORD_TEST/REVIEW_TEST. See §13 deletion spec.

## 4. Dashboard CTA machine (student view; all inline, no hooks)

Derived values (Dashboard.jsx): `settingsLoaded=userSettings!==null` (:1352); `progressReady`/`progressHasError` — every `${classId}_${listId}` entry `status==='ok'` / any `'error'` (:350-364); `heroLoading = panelBLoading ∨ panelCState?.loading`; `firstPaintLoading = !settingsLoaded ∨ studentClassesLoading ∨ (!progressReady ∧ !progressHasError)` (:1706-1716); `day = (panelCState?.currentStudyDay ?? 0)+1` (:1741); `listFinished = !focusLapView ∧ listTotal>0 ∧ wordsLeft===0` (:1740); `reviewStage = phase==='review-study'` (:1744); `doneToday = phase==='complete'` (:1745).

| State | Condition (in eval order) | Renders / action |
|---|---|---|
| Loading | `firstPaintLoading` (:1753) | skeleton hero |
| Load error | `progressHasError` (:1760) | Retry → `window.location.reload()` (:1768) |
| Hero card | `getPrimaryFocus` truthy (:1774) | sub-states below |
| No list | else (:1902) | "join a class below" |

Hero sub-states (:1824-1900): heroLoading → skeleton; `doneToday ∧ listFinished` → "List complete 🎉 / Review again"; `doneToday` → "Day N done 🎉 / Practice again"; `reviewStage` → "One step left — review / Start review" (STEP 2 OF 2); `listFinished` → "Keep your words sharp / Start review"; `newCount` (pace) → "Learn N new words / Start new words"; else → "Start today's new words". **All → the same navigate (:1875).**

**panelCState (:1581-1638):** `currentStudyDay = resolvedMatchesFocus ? max(resolvedFocusCsd.csd, progress?.currentStudyDay ?? 0) : (progress?.currentStudyDay ?? 0)` (:1613-1615); `listAttempts` CLASS-scoped filter (:1620-1622); `phase = determineStartingPhase(listAttempts, currentStudyDay+1).phase` (:1623). (The session path feeds CROSS-class attempts under LIST_SCOPED_RECON — the §8 C1 divergence.)

**THE DAY-GATE TRUTH:** "done today" is NOT a KST/date compare — attempts-only. After a normal advance csd increments → `determineStartingPhase(attempts, csd+1)` = `new-words-study` → next day immediately startable (multi-day binge possible). `doneToday` appears only when csd is HELD while day-(csd+1) attempts exist (foundation.js:1462-1492 heldUpdates write no csd/twi). KST lives only in streaks (`STREAK_TZ_OFFSET_MINUTES=540`, foundation.js:190) + token weeks.

**Re-entry (G-REENTRY):** `shouldShowReEntryModal` (sessionService.js:352-364): `REENTRY_GUARD ∧ Number.isInteger(lastCompletedDay) ∧ sessionState.currentStudyDay !== lastCompletedDay → false`; else `phase===COMPLETE ∧ reviewTestScore !== null`. Reads session_state (NOT attempts) — the second "done" authority (§11).

**Focus resolution (G-FOCUS, :1078-1248):** exact pin (classId+listId :1163-1176) → legacy list-only pin (:1181-1187) → progress-recency `lastSessionAt/updatedAt → csd → assignedAt → id` (:1198-1221) → most-recent-assigned/first (:1225-1247). `CONTINUATION_LINKS` yields finished lists to `nextListId`. Switchers render only when `settingsLoaded ∧ progressReady ∧ focus ∧ classOptions.length>0` (:1671); FocusControl = label if ≤1 option, dropdown if ≥2 (:229-289).

**Other Dashboard surfaces:** hero ring (listPct/tIntro/wordCount :1776-1795); streak chip (`progress.streakDays ?? calculateStreak(...)` :1809/:1399); stat tiles (tIntro / `masteryRate=round(avgReviewScore*100)` / wordsLeft / streak :1911-1940); weekly activity bars = inline chart from `recentSessions` reviewScores, weekend-skip when dpw≤5 (:1943-1962, NOT MasteryBars); per-list progress bar (:2100-2146); ListProgressStats day card w/ `calculateExpectedStudyDay` ahead/behind (:173-223, studyTypes.js:159-196). **NOT rendered:** MasterySquares (imported :29, never used), MasteryBars (orphan), BlindSpotsCard (orphan). No token display on Dashboard (tokens: TestResults.jsx:24 + Gradebook.jsx:1305-1309 only).

## 5. Exit channel (completeSession statuses → client)

Wrapper `recordSessionCompletionViaServer` (studyService.js:980-1108), callable `completeSession` timeout 30s. Payload (:994-1011): `{classId, listId, sessionContext:{dayNumber, newWordScore, reviewScore, segmentStartIndex, segmentEndIndex, wordsReviewed, wordsTested}}` + optional `clientReviewOnlyDay`/`clientWordsIntroduced`. Server owns csd/twi/interventionLevel.

| status | Client handling | Site |
|---|---|---|
| `completed` / legacy | success + writes `users/{uid}/sessions` history | :1087-1107 |
| `already_completed` | success-shaped, idempotent, no duplicate history | :1032-1038 |
| `review_recorded` | **HOLD** — success-shaped, csd NOT advanced, no history | :1040-1052 |
| `no_evidence` | BLOCK `{completionNotApplied, reason}` | :1054-1069 |
| `day_guard_rejected` | `{dayGuardRejected, sessionCleared}` — server already cleared session | :1014-1030 |
| any other | fail-closed BLOCK | :1075-1085 |

Downstream: `completeSessionFromTest` maps dayGuardRejected → `{requiresSessionRebuild, sessionCleared}`, completionNotApplied → passthrough (:1979-2002); DSF `completeSession` blocks on completionNotApplied with bilingual error (:1552-1556); test pages block on requiresNewWordRetake / requiresSessionRebuild / completionNotApplied (MCQ:877-902, Typed:1133+), only clean success shows results (:934-946). **KNOWN GAP:** DSF's own `completeSession` path (:1500-1620, uses `recordSessionCompletion` directly :1539) does NOT handle dayGuardRejected (:1549-1551).

## 6. Failure & recovery states

| State | Gate | Exit | Site |
|---|---|---|---|
| Init fatal | `initializeDailySession` threw | Back → `/` | DSF:1776-1786 |
| Test load error / empty | fetch failed / zero words | MCQ → `returnPath ∥ /` (:1130); Typed → `navigate(-1)` (:1353/:1368) — **inconsistent** | — |
| Grading transient | gradeTypedTest failure, `gradingErrorKind='transient'` | 3 tries ×10s w/ counter (:1815); FIRST polls `getGradingStatus(attemptDocId)` — lost response ≠ ungraded, cached grade reused (:628-742) | TypedTest |
| Grading deterministic | non-transient (malformed payload — retry loops) | reload rebuilds payload; answers preserved (:624/:1203-1217) | TypedTest |
| Blocked, answers saved | completion refused mid-typed flow | bilingual "day can't be completed yet — answers saved" (:1155-1158) | TypedTest |
| Quarantined (DORMANT) | canonical `resolveListProgress` corrupt-signature refusal — log-only (`quarantine_candidate`) until P5, then mode `quarantined` BLOCKS | needs a real screen before P5 | foundation.js:1724-1926 |

**F2 audit additions (all live):**

| State | Gate | Site |
|---|---|---|
| MCQ submission overlay + retry | full-screen "Submitting Your Test…"; on failure `submitError` + "Retry Submission" | MCQTest.jsx:1610-1638 |
| In-test Recovery Prompt modal | "Resume Previous Test?" Resume/Start-Fresh; `RECOVERY_GUARD`-gated answer-intersection restore (a LIVE flag, featureFlags.js:230) | MCQ:1577-1586/:405-447 · Typed:1800/:533-570 |
| MCQ under-answered review confirm | `<80%` answered → "won't complete your day" warning modal (live, REENTRY_GUARD=true) | MCQTest.jsx:1592-1607 |
| Typed submit confirmation | unanswered-count confirm before grading | TypedTest.jsx:1656-1662/:1782-1794 |
| Review-retake FAILURE path | snapshot absent / day-mismatch / >1hr → `retakeError` "cannot retake", `canRetake=false` | MCQ:992-1048 · Typed:1497-1498 |
| Restore-failure trigger | return-from-test catch → `setError('Failed to restore session…')` → §6 fatal screen | DSF:1487-1490 |
| Settings reset UI surface | class/list pickers → 2 confirm modals (type `RESET`) → `resetStudentProgress` → success/error msgs; lands Day 1 | Settings.jsx:267-472/:90 |

Crash/local recovery: `sessionStorage.dailySessionState` + `wasInTestPhase` re-navigation (DSF:679-743) + per-answer save/restore in tests (Typed:256-285/419-441/487/532-567) — a SEPARATE state machine (§9 A5). Caveat (F3): the `'NEW_TEST'/'REVIEW_TEST'` localStorage marker vocabulary (DSF:1303, `wasInTestPhase`) is LIVE crash-recovery machinery — distinct from the dead REVIEW_TEST render phase.

## 7. Results & challenge

**New test:** pass banner (`passed`) w/ Continue → returnPath; fail banner + "below X%" + "Try Again" iff `canRetake`; per-word verdicts via `<TestResults>` always (TestResults.jsx:81-150).
**Review test:** 4-tier `≥85 excellent / ≥70 good / ≥50 needs-work / else critical` (Typed:1515-1518 / MCQ:1255-1258), single Continue, NO retake CTA, never fails. (The banked reviewPassThreshold lever lands on the 3 pass-expression lines in §3.)
**Challenge (typed only):** button iff `typed ∧ !isCorrect ∧ availableTokens>0 ∧ !challenged` (TestResults.jsx:85-88); "Pending" badge (:140-141); "No tokens" (:143-144); tokens read on mount typed-only (:30) — default useState(5) (:18) but UI gated typed so MCQ never shows it. `submitChallenge` (db.js:2754 / server index.js:702) sets `answers[idx].challengeStatus='pending'` + appends `{attemptId, wordId, challengedAt, replenishAt, status:'pending'}` to `users/{uid}.challenges.history` — **NO grade change on submit**; idempotent if pending (index.js:731). **Teacher accept** (`reviewChallenge` db.js:2853+): `isCorrect=true` (:2911), rescore `round(correct/denom*100)` (:2920-2922), `newPassed = review ? true : newScore>=passThreshold` (:2940), attempt updated (:2943-2947), history → accepted/rejected (:2957-2965), study_state → PASSED (:2975-2982), **day may advance iff `oldScore<thr ∧ newScore>=thr`** (:3021 / server `advanceForChallenge` :3008).
**Token week:** `max(0, 5 − rejected since Monday 04:00 KST)` — `startOfKstWeekMs` (db.js:193-217 ≡ functions byte-twin index.js:657/661-683).

## 8. Review build & sizing

Pool: `getUnmasteredPool(userId, listId, twi)` position-ordered (studyService.js:418) → `computeUnmasteredSegmentIds(ids, currentStudyDay, dpw)` (:421; studyAlgorithm.js:188-215): `divisor = week1 ? dpw−1 : dpw` (:205); `segmentSize = ceil(pool/divisor)` (:210); slice by day position (:211-212); week-1 day-1 → null. Cap `REVIEW_STUDY_CAP=60` (studyAlgorithm.js:40; applied studyService.js:427). Study set = `buildReviewStudySet(segment)` + today's failed-new prepended (DSF:1036). **The scheduler IS currentStudyDay** — free mode must replace it.
Test size: `testSizeReview = calculateReviewTestSize(interventionLevel)` (studyService.js:536; studyAlgorithm.js:258-268): `min + (max−min)×interventionLevel` with min/max args NEVER passed → hardcoded 30↔60. Teacher `reviewTestSizeMin/Max` stored + echoed (testConfig.js:36-37/61-62) but read by NOTHING (dead levers). Standalone test paths use `assignment.testSizeReview ∥ 30` — a field never written (Typed:367 / MCQ:314). Final pick `selectTestWords(pool, size)` — excludes retired-MASTERED, shuffles, slices (studyAlgorithm.js:391-411).

**Word-mastery lifecycle (F2 addition — live, decides every review pool):** `graduateSegmentWords` promotes `floor(segmentSize×score)` RANDOMLY-selected segment words → `MASTERED` with `returnAt = +21d` (studyService.js:1510-1560); `returnMasteredWords` flips expired MASTERED → `NEEDS_CHECK` at session init (:351, :683-685 — ordered BEFORE the pool read, the §8-G4 write-before-read hazard). This 21-day mechanic is shared with the parked BlindSpot surface and seeds free-mode's G-DUE.

## 9. Teacher levers (stored `classes/{id}.assignments.{listId}.*`; writers db.js:805 `assignListToClass` / db.js:877 `updateAssignmentSettings`)

| Lever | Default | Feeds | Status |
|---|---|---|---|
| pace | 20 | G-ALLOC; `weeklyPace = pace×dpw` (DSF:579); standalone paths fabricate `pace×7` (Typed:375/MCQ:322) — input-twin | live |
| passThreshold | 95 | G-PASS everywhere (client, server index.js:354, challenge db.js:2932) | live |
| testMode | 'mcq' | G-TESTROUTE (`mcq/typed/both`; 'both'→new mcq) | live |
| testOptionsCount | 4 | MCQ options (1-10) | live |
| testSizeNew | 50 | new test size | live |
| reviewTestType | 'mcq' | review mode override (DSF:1197-1198 only consumer) | live |
| reviewTestSizeMin/Max | 30/60 | **NOTHING** | **DEAD** |
| studyDaysPerWeek | 5 | G-SCHED divisor, weeklyPace, streak weekend-skip; NOT in AssignListModal (only ClassDetail settings; writer validates 1-7) | live |
| nextListId | null | G-CONT | flag CONTINUATION_LINKS |
| cyclingEnabled | false | G-CYCLE (`resolveEffectiveCycling` studyService.js:399) | flag CYCLING_ENABLED |
| ~~navigationMode~~ | 'forced' | ~~§10 mode seam~~ | **DEAD — never added (R2-24/27: one universal model)** |
| **reviewPassThreshold** | off today | G-PASS review branch | **LANDS AT DF2-14: starts ON@92, teacher-tunable (R2-6/26); + `reviewQueueSize`/`reviewTestSize` (DF2-11)** |

Form: AssignListModal.jsx:7-15 state inits, :49 onAssign arg order; ClassDetail.jsx:390-404 assign, :427-458 save, clamps :1155-1309.

## 10. Gate glossary (deduplicated view — one row per mechanic)

| Gate | Expression | Owner |
|---|---|---|
| G-AUTH / G-ROLE | `!user → /login` · `role≠teacher → /` | PrivateRoute:17 / TeacherRoute:16 |
| G-READY | all progress entries `status==='ok'` | Dashboard:350-364 |
| G-FOCUS | pin → legacy pin → recency → first | Dashboard:1078-1248 |
| G-PHASE | the §3 decision tree | studyService:228-329 |
| G-DONE | `phase==='complete'` — attempts-only; **no clock** (= G-PHASE br.3 @ Dashboard) | Dashboard:1745 |
| G-REENTRY | `phase===COMPLETE ∧ reviewTestScore≠null` (+day guard) — session_state authority | sessionService:352-364 |
| G-ALLOC | `newWords = round(pace×(1−interventionLevel))`; reviewMode → 0 | studyAlgorithm:107 |
| G-THROTTLE | enter `avg(last3) < 0.30` / exit `> 0.50` | foundation:687-688 |
| G-SCHED | csd-indexed slice; `divisor = wk1 ? dpw−1 : dpw`; cap 60 | studyAlgorithm:188-215 |
| G-TESTSIZE | new `testSizeNew` · review `30+(60−30)×interv` (teacher min/max DEAD) | studyAlgorithm:258-268 |
| G-TESTROUTE | typed→/typedtest else /mcqtest; review `reviewTestType ∥ (typed/both ∧ tries<3 ? typed : mcq)` | DSF:701/1198 · sessionService:374-386 |
| G-PASS | new `score ≥ passThreshold/100` · review ALWAYS true | MCQ:581 · Typed:853 · index.js:434 |
| G-RETAKE | `new ∧ score<thr` → in-place resample; failed attempt recorded | MCQ:564/956 |
| G-FINAL | `isFirstDay ? new : review` → completeSession | MCQ:793-795 |
| G-DAYGUARD | txn `expectedDay = csd+1` else reject+clear | foundation:1355-1365 |
| G-HOLD | **`fpHoldCsd = fpThrottleReviewOnly ∨ (day≥2 ∧ ¬engaged)`** where `fpThrottleReviewOnly = allocationZero ∧ ¬listComplete ∧ ¬reviewStudyResume` — ONLY the throttle review-only day holds; list-end and #9-resume review-only days ADVANCE (comment :1453-1455, client mirror studyService:1797-1800) [F1 correction] → NO csd/twi write → `review_recorded` | foundation:1458-1492 |
| G-ENGAGED | `answered/totalQuestions ≥ 0.8` (`MIN_ENGAGED_ANSWER_RATIO`, reviewPairing.js:34/80) + grandfather epoch (forcedPathway.js:52) — feeds G-PHASE pairing + G-HOLD's non-engaged leg | reviewPairing.js:34 |
| G-MASTERY | graduate `floor(size×score)` random words → MASTERED `returnAt=+21d`; expired → NEEDS_CHECK at init | studyService:1510-1560/:683-685 |
| G-RESOLVE | Dashboard csd source: `resolveListProgress` callable gated `SERVER_PROGRESS_WRITE`, FAIL-OPEN to stored csd | Dashboard:1259-1283 |
| G-EXIT | the §5 status table (fail-closed on unknown) | studyService:1014-1085 |
| G-QUAR | canonical corrupt-signature refusal — log-only until P5, then BLOCKS | foundation:1724-1926 |
| G-TOKEN | `max(0, 5 − rejected since Mon 04:00 KST)` | db:211-217 ≡ index:657 |
| G-CHALLENGE | submit→pending only · teacher accept→regrade, advance iff crosses thr | db:2853-3021 |
| G-RESET | type "RESET" → list-wide wipe ALL classes + resetEpoch → Day 1 | foundation:2055-2146 |
| G-CONT / G-CYCLE | `listFinished ∧ nextListId` · `cyclingSourceClassId` | flags |
| ~~G-FRONTIER / G-DUE / G-OFFER / G-POLICY~~ | ~~FREE mode (future E4)~~ **DEAD (R2-24/27: universal model; G-DUE cancelled)** — backward re-study/re-test lands as DF2-51's past-day browser inside DF2-14 | — |

Taxonomy overlaps (deliberate): G-DONE ⊂ G-PHASE; G-RETAKE = ¬G-PASS + behavior; G-DAYGUARD/G-HOLD are producers of G-EXIT statuses.

## 11. Redundancy audit (code-site duplication — the refactor's delta)

1. **G-PASS at 12 live predicate sites, 2 unit conventions** (0-1 vs 0-100 via `toFraction`; F3 re-count — my ≥6 was conservative): MCQ:581, Typed:853, both results renders (MCQ:1175/Typed:1435), DSF:1446 + DSF:324 (`newWordsTestPassed` stamp), studyService:1911 (+ its own inline 0-100→fraction bridge :1878-1880) + :1857/:1934 session_state stamps, index.js:433-434, db.js:2940 + :3021 (challenge crossing check). Plus a DEAD copy: sessionService.js:268 `recordNewWordsTestResult` (zero callers). Threshold resolution = 4-deep fallback chain duplicated per test page.
2. **"Done" has TWO authorities that disagree on EVERY normal completion** (F3 sharpening): G-DONE (attempts) vs G-REENTRY (session_state). The moment a day advances, the hero says "Start new words" (attempts for csd+1 empty) while the per-list button pops the "already completed" re-entry modal (session_state still phase=complete, day-guard passes). And the hero `navigate()` (:1873-1875) never consults G-REENTRY at all — two start affordances, different done-gates. After `clearSessionState` on a HELD day: inverse disagreement (hero "done", modal silent). REENTRY_GUARD's own comment (sessionService:338-346) documents the unreliability.
3. **G-PHASE at 2 live client sites** with different inputs (Dashboard class-scoped :1620-1622 vs session cross-class via db.js:3416-3423 under LIST_SCOPED_RECON — §8 C1). **Server mirrors of the phase evidence** [F3 repoint — NOT `validateAttemptAnchorShadow`, which shadows the G-ALLOC/G-DAYGUARD legs (declared foundation:1127, LIVE via `ANCHOR_VALIDATION_SHADOW=true` at :70 despite its stale docstring)]: `getDayNewPass` (foundation:819 — "mirrors determineStartingPhase's passed-first ordering") + the engaged-paired-review reader (:798), both live in completeSession. Consolidate THOSE.
4. **Two throttle vocabularies coexist:** binary `reviewMode` (supersedes; fresh derivations pin interventionLevel {0,1} — client studyService:367-369, server foundation:1375-1377) + float `interventionLevel` still scaling G-ALLOC and G-TESTSIZE — **and genuinely fractional values still flow live**: challenge-accept advance scales allocation by the PERSISTED float (db.js:3056-3061, foundation:2209-2211) and canonical hydration copies legacy floats verbatim (foundation:1972) [F3 evidence].
5. Success metric: every glossary row computed at exactly ONE site.

## 12. ~~FREE mode (future, per-class `navigationMode:'free'`)~~ — **SUPERSEDED (R2-24/26/27): ONE universal model; no mode field ever ships. Historical record below.**

States: NavigateHub (frontier/due/mastery, day = `ceil(twi/segment)` display-only) · Study(any segment ⊆ [0,twi)) · Review(due — NEW scheduler) · SegmentTest (advances frontier). Exit set shrinks to `recorded / frontier_advanced / already` — no held/refused/retake(unless pass-to-advance=yes). Reuses `<Study>`/`<Test>`. **Prereqs unchanged:** server-owned frontier (P5 census; twi per-class non-monotonic — 129 divergent, 27 active), new per-word scheduler (seed = the 21-day stale mechanic), new rules artifact, pass-to-advance product decision (**✅ CLOSED YES, David 2026-07-25**). Build program: `docs/plans/deepfix2/`.

## 13. Parked & dead

**BlindSpot — HIDDEN (David 2026-07-24; hide FINAL, probe SKIPPED — R2-22).** Hide spec: `BLINDSPOTS_UI=false` flag; gate Dashboard.jsx:2172-2180 link + App.jsx:91-98 route (redirect `/`) + HelpModal.jsx:250-253 copy; on flip also `public/help-student-{en,ko}.html` (~7 mentions incl. FAQ). KEEP `BlindSpotCheck.jsx` + `getBlindSpotPool` + the 21-day stale data model (the 21-day rest SURVIVES the redesign; ~~free-nav G-DUE seed~~ — G-DUE cancelled, R2-27 Q4).
**Dead code (audited 3× — dead = zero imports OR unreachable render; zero apBoost references to any item):**
- Plain orphans (zero imports): SessionSteps.jsx, SessionProgressBanner.jsx, BlindSpotsCard.jsx, MasteryBars.jsx, MasterySquares import (Dashboard.jsx:29).
- **RetakePrompt — dead-by-UNREACHABLE-GUARD, not orphan** [F2+F3 convergent correction]: rendered at DSF:1955 inside `phase===NEW_WORD_TEST` (:1952), but none of the 19 `setPhase` calls ever sets NEW_WORD_TEST/REVIEW_TEST (code's own comment :1294-1297). Deletion spec: remove the :1952-1969 branch + the :2367 definition + handler props — a zero-imports sweep would MISS it.
- **StudySelectionModal — unreachable UI with BROKEN targets** [F2 addition]: rendered ×2 (Dashboard:2286-2297) but its open-setters are never set true (:1642-1643), and its Links target `/study/...`,`/test/...` — routes that don't exist (StudySelectionModal.jsx:75) → wildcard → `/`.
- REVIEW_TEST phase (defined :82, no render branch, never setPhase'd). Caveat: the `'NEW_TEST'/'REVIEW_TEST'` **localStorage marker vocab is LIVE** crash-recovery (DSF:1303) — do not delete with the phase.
- `practiceMode` prop (both test pages read from location.state, default false — NO caller passes it; Practice Mode v2's hook).

## 14. Findings register (new facts/defects this mapping surfaced)

1. No calendar day-gate exists — multi-day binge possible after advance; "daily" = hold-csd only.
2. Dead levers reviewTestSizeMin/Max (+ `assignment.testSizeReview` never written → standalone review size always 30; AssignListModal:215 copy describes an interpolation the values don't join).
3. Dead chrome SessionSteps + SessionProgressBanner (3rd/4th phase vocab).
4. Three live phase vocabularies bridged by `currentPhaseMap`.
5. DSF's own completeSession path misses `day_guard_rejected` (DSF:1549-1551).
6. SessionProgressSheet hardcodes "95% required to pass" (SessionProgressSheet.jsx:72-107) — ignores class passThreshold.
7. Failure/recovery exits inconsistent (MCQ→returnPath vs Typed→navigate(−1)).
8. `practiceMode` dormant (no live caller).
9. Live chrome = SessionHeader + `getSessionStep` (sessionStepTracker.js:27-66; totalSteps = isFirstDay?3:5) + SessionProgressSheet (phaseOrder :110-112; "95%" desc; scores from props) + **SessionMenu + Watermark** (F2 correction — the chrome inventory was missing both).
10. **The day-2+ completion gate honors the attempt's `passed:true` flag over the local score check** (F1-W1) — teacher overrides / manual passes / challenge regrades complete even below the local threshold. Any refactored gate MUST preserve this conjunct or CS-fixed students get re-blocked.
11. Mechanics F2 surfaced that now have glossary rows: G-MASTERY (21-day graduate/return lifecycle), G-ENGAGED (0.8 ratio), G-RESOLVE (SERVER_PROGRESS_WRITE fail-open csd source). Live flags the map previously omitted: `RECOVERY_GUARD` (featureFlags.js:230), `SERVER_PROGRESS_WRITE`, `ANCHOR_VALIDATION_SHADOW=true` (foundation:70).

## 16. Audit log (2026-07-24 — 3 independent Fable auditors, adversarial, read-only)

| Auditor | Lens | Verdict |
|---|---|---|
| F1 | Gate/expression accuracy (§3-§10) | **57 CORRECT / 1 WRONG / 3 IMPRECISE** — WRONG: day-2+ gate missing `newWordAttemptPassed !== true` conjunct (fixed, §3+§14.10); IMPRECISE: G-HOLD over-broad (fixed, §10), NoReviewModal + §5 cite drift (fixed); out-of-lens: §2 review-results mislabel (fixed) |
| F2 | Completeness | **GAPS-FOUND** — ~10 chrome modals/screens + 3 mechanics missing (all folded: §2 chrome edges, §3 modal layer, §6 additions, §8 mastery, §10 new rows); StudySelectionModal added to dead list; RetakePrompt over-claim caught |
| F3 | Redundancy + dead-code claims | **SAFE TO ACT ON with 2 adjustments** (both folded): RetakePrompt deletion spec corrected; §11.3 third-copy repointed to `getDayNewPass`/engaged-reader. G-PASS count raised ≥6→12; two-done-authorities sharpened to every-normal-completion; throttle float-leak evidence added |

All corrections above are folded into this document; sections tagged [F1]/[F2]/[F3] mark them.

## 15. Collapse map (today → unified)

| Today | → Unified |
|---|---|
| new-word study · review study | `Study(mode)` |
| new-word test · review test · ~~REVIEW_TEST phase~~ | `Test(mode)` |
| test-route results · ~~RetakePrompt~~ · ~~SessionSummary score~~ · re-entry modal | `Outcome(advance/held/retake/refused)` |
| day-complete terminal · ~~empty-review modal ×2~~ | `Complete` |
| SESSION_PHASE · PHASES · stepTracker vocab · ~~Banner vocab~~ | one phase enum |
| Dashboard hero start · ~~per-list start~~ · panelCState re-derivation | one start affordance |
| SessionProgressSheet steps · "95%" copy · ~~SessionSteps~~ · ~~SessionProgressBanner~~ | mode-aware chrome |
| /blindspots route · Dashboard link · ~~BlindSpotsCard~~ | PARKED (flag off) |
