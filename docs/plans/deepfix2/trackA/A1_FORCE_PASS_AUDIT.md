# A1 — Force-pass mutation-set + consumer audit (Track A step-1 report, 2026-08-01 — investigation agent output, WSL-filed)

> Checkpoint-1 convergence target. Claims cite file:line; VERIFIED vs INFERRED per report text.

## Summary

A1 verified end-to-end. (i) Today's overrideAttempt (foundation.js:2708-2865, DORMANT — SERVER_OVERRIDE_ENABLED=false) mutates NO existing attempt: it writes a fresh synthetic sessionType:'new' anchor doc with answers:[] and manualOverride:true — r46-H4's "not reusable, build a new exact-attempt grade-only resolver" is code-accurate; the only live grade-mutating surface is the client reviewChallenge (db.js:2943-2947: answers/score/passed in place). (ii) 30+ attempt readers enumerated; progression readers honor an override-pass by design, but all four gradebook enrichment sites recompute correctAnswers from rows while displaying the stored score, so a grade-only override renders a visible "95% (12/30)" contradiction with no label. (iii) Existing metadata does NOT suffice: manualOverride is semantically claimed by synthetic anchors (CS scripts key on it) — a new field set (teacherEdited/teacherEditedBy/teacherEditedAt/preOverride{score,passed}) is required. (iv) The grade-independence invariant holds; the session-local exceptions at graduation are the reviewScore/failedWordIds fed to graduateSegmentWords, Day-1 gate, session_states pass flags, and recentSessions summaries. (v) VERIFIED no retroactive graduation on grade change (no attempt triggers exist; challenge-accept touches one word's status only). (vii) All resolver anchor inputs (csd/twi/assignment/day-anchor/session phase) are server-readable, with the caveat that the M4 validator covers only sessionType:'new' and no failed review attempt exists in data today (index.js:434 hardcodes review passed:true). (ix) index.js:474-478 and :538-539 idempotent zero-write returns re-confirmed (plus gradeTypedTest :1038-1040). Two material spec-vs-code mismatches: A1(vi)'s "no engagement reader exists" is false for today's live code, and the (viii) baseline's post-override stale-submit resolves via day_guard_rejected, not already_completed.

## (i) Override / manual-pass surfaces — exact mutation sets [VERIFIED]

**overrideAttempt (functions/foundation.js:2708-2865; exported foundation.js:2875, index.js:2190; DORMANT — `SERVER_OVERRIDE_ENABLED=false` foundation.js:99; client wrapper db.js:3118-3125 gated by `SERVER_OVERRIDE=false` featureFlags.js:135).**
- **Mutates NO existing attempt.** The optional `attemptId` path only READS the prior attempt for target-binding + authz (foundation.js:2734-2754); there is no update to it anywhere in the function.
- **Writes ONE fresh synthetic doc** at deterministic id `${uid}_${classId}_${listId}_day${d}_typed_new_manual` via `set(..., {merge:true})` (foundation.js:2821, 2839). Field set (2825-2838): studentId/classId/listId/teacherId, optional teacherIds, `testId: vocaboost_test_{c}_{l}_new`, **`sessionType:'new'` always**, testType:'typed', studyDay, score, passed (threshold `assignment?.passThreshold ?? 92`, :2819 — NOT the app's 95 default, db.js:2925), graded:true, nwsi/nwei/wordsIntroduced (pace-derived, list-end-clamped when not cycling :2805-2816), isFirstDay, totalQuestions:30, **`answers: []`** — per-word answers of the real attempt are never touched, `interventionLevel:0`, credibility:1, retention:1, **`manualOverride:true` + `manualReviewNote`** (:2835-2836), submittedAt. No `writtenBy` field (unlike writeAttemptTxn, index.js:517).
- **Day-advance**: best-effort via shared `runChallengeDayAdvanceTxn` with `phase:'new'` (foundation.js:2846-2854). On Day-2+ a phase-'new' pass routes to review-study, NOT day completion (foundation.js:2195-2205) — so even if enabled, today's surface **cannot dissolve a review retake wall**; given a failed REVIEW attemptId it still writes a new-word anchor for that day. Confirms R2-1b/r46-H4 verbatim.
- **Audit metadata**: `teacher_override` system_logs event with actor/target/before/after (foundation.js:2857-2863).
- Authz: attemptId path = stamp∪enrollment union (assertOverrideAuthz, foundation.js:2272-2297); no-attemptId path = strict target-bound (assertOverrideTargetAuthz, :2315-2346).

**scripts/cs/manual-pass.mjs** — same synthetic-anchor model: deterministic docId (:59), payload :61-73 incl. anchor fields + `manualOverride:true`, threshold `?? 92` (:65), `answers: []`. Pace derived from the day-1 passed-new attempt **class-scoped only** (:37-40) — it lacks overrideAttempt's F-5 list-match fix (foundation.js:2798-2803); refuses past-list-end days rather than clamping (:44-54).

**The only surface that mutates an EXISTING attempt's grade today** is the live client `reviewChallenge` (db.js:2853-3096, `SERVER_OVERRIDE=false` keeps the client body): flips one answer's challengeStatus/challengeReviewedBy/challengeReviewedAt/isCorrect (db.js:2901-2912), recomputes score off the persisted totalQuestions denominator (:2920-2922), recomputes passed (**review branch always passed:true**, :2940), and updates `answers/score/passed` in place (:2943-2947); plus one study_state → 'PASSED' on accept (:2972-2982) and the server day-advance under `SERVER_CHALLENGE_WRITE=true` (:3007-3009 → advanceForChallenge, foundation.js:2432-2517). The dormant server port mirrors this (foundation.js:2557-2687, mutation at :2623-2627).

## (ii) Consumer audit — every attempt reader beyond `passed`, with mislead classification

Classification for an **override-passed attempt with unchanged per-word answers** (the specced grade-only resolver). "Intended" = treats the forced pass as progression truth, which is the feature's purpose; "MISLED" = shows/derives something wrong absent a teacher-edited label.

**Server progression/reconciliation readers (fields: sessionType, passed, newWordEndIndex/StartIndex, studyDay, submittedAt, classId):**
| Reader | Cite | Verdict |
|---|---|---|
| getListAnchor (anchor pick) | foundation.js:523-581 | Intended — becomes the twi-defining anchor if promoted attempt is `new` with valid nwei; a promoted LEGACY new attempt missing nwei falls to the sparse fallback (:563-577) → client logs `csd_anchor_invalid` (progressService.js:331-339) — the A1(vii) fixture is justified |
| computeAnchorPosition / resolveListProgress | foundation.js:914-919, 1737 | Intended (csd/twi only, no word states) |
| getDayNewPass (evidence, reason-3) | foundation.js:819-839 | Intended; ANY-PASSING semantics confirmed (filter at :831) — R2-27 Q13b accurate |
| getReviewForDayServer (pairing) | foundation.js:755-808 | **MISLED today**: FIX-1 leg :794-799 requires `isCompletionEngagedServer` — a non-engaged (blank) override-passed review is SKIPPED → day won't complete (see mismatch M2) |
| dayReviewExists / countPostAnchorReviewDays | foundation.js:842-857, 865-900 | Counts it as durable review evidence (only autoCompleted excluded :889) — acceptable, label aids audits |
| getDayReviewForEngagement + isCompletionEngagedServer | foundation.js:730-745, 715-723 | Truthful (stamp/rows unchanged) → hold persists; same M2 |
| completeSession day-guard/evidence/hold | foundation.js:1355-1412, 1462-1491 | Intended; hold legs are the R2-11 retirement set |
| validateAttemptAnchorShadow | foundation.js:1127-1240 | `sessionType!=='new'` returns early (:1129); a grade-only mutation never re-runs it (no writeAttemptTxn pass) — no false anchor_rejected |
| advanceForChallenge / reviewChallenge / submitChallenge | foundation.js:2432-2517, 2557-2687; index.js:702-754 | Challenge-flow only; unaffected |
| Idempotency readers | index.js:239-278, 474-478, 538-539, 1038-1040 | Return the STORED (overridden) score/passed — retry displays the forced grade; good for (viii)/(ix) durability |
| writeUpgradedReviewMarker / deriveDayAnchorRange | foundation.js:1021-1103, 996-1007 | Range from getDayNewPass — an override-pass can define marker range; acceptable |

**Client readers:**
| Reader | Cite | Verdict |
|---|---|---|
| getMostRecentPassedNewTest (client anchor) | db.js:3534+; consumed progressService.js:175-232 | Intended; invalid-anchor observability :331-339 |
| getNewWordAttemptForDay (Day-2+ gate) | db.js:3322-3390; gate studyService.js:1872-1885, 1911 | Intended — comment :1881-1884 already names "teacher manual overrides where passed=true with a lower score" as covered |
| determineStartingPhase (routing, Dashboard CTA) | studyService.js:228-309; Dashboard.jsx:1617-1638 | Intended for `new`; **review leg requires engaged pairing** (studyService.js:266-270) — M2 again |
| getReviewForDay / getRecentAttemptsForClassList | db.js:3722+, 3404+ | Mirror of server pairing incl. engagement |
| fetchDashboardStats latestTest | db.js:567-589 | Display-only; a synthetic anchor (today's model) becomes "latest test"; grade-only mutation preserves display order |
| **Gradebook enrichment (4 sites)**: fetchAllTeacherAttempts, queryTeacherAttempts, queryStudentAttempts (student /gradebook, App.jsx:116-126), fetchAttemptDetails | db.js:1800-1802, 2217-2219, 2402-2404, 2545 | **MISLED**: `correctAnswers = answers.filter(isCorrect).length` from ROWS but `score` prefers the stored field → grade-only override renders "95% (12/30)" with no explanation; Gradebook.jsx:1111-1112, 1299-1300 and CSV export :605-613 show both numbers |
| fetchClassAttempts → ClassDetail | db.js:1537-1621; ClassDetail.jsx:367 | Same stored-score display |
| credibility/retention | write-only db.js:1285-1291; echoed rows :1872-1873; index.js:493-494 "deprecated, no UI consumer" — grep of pages/components confirms zero UI reads | Not misled (dormant); synthetic anchors hardcode 1/1 (foundation.js:2834) |
| Engagement stamp | writer index.js:499, foundation.js:665-676 | Unchanged by grade-only override — truthful |

**scripts/cs readers:**
| Script | Cite | Verdict |
|---|---|---|
| data-integrity-sweep | :46-75 | Override-pass = anchor truth (intended); flags legacy no-nwei promotions as `invalidAnchor` (:71); tags `manualOverride` docs MANUAL (:68) |
| graduation-validity-probe | :45-68 | Reads answers only (never score/passed) — NOT misled; synthetic answers:[] anchors contribute zero rows |
| deepfix-census:119-120, census2:55, migrate-list-progress:198, fix-phantom-anchor:50, diag-reviewonly-cases:68, reconcile-ascent-carry:41 | — | Treat `manualOverride`/`_manual` as the hand-patched synthetic population — **reusing manualOverride for the new resolver would misclassify organic attempts** |
| batch-triage:47-60, sweep-crossclass-undercount:48-73, fix-csd-undercount:36-40, fix-csd-to-completed:17-18, carry-progress:22-27, throttle-relief-cohort:63-65, census-i4-pairing:37-84 | — | passed-new anchor logic — intended, but cannot distinguish teacher-authorized from organic without a label |
| find-grader-false-negs:37-54 | — | answers/aiReasoning only — unaffected |

No Firestore triggers observe attempts (grep: `onDocumentWritten` appears only in a comment index.js:5; the sole scheduled fn is apBoost `pauseStaleSessions` on ap_session_state, index.js:1855-1874).

## (iii) Teacher-edited label — existing metadata does NOT suffice; proposed field set

**Existing metadata inventory:** `manualOverride:true` + `manualReviewNote` exist only on SYNTHETIC anchors (foundation.js:2835-2836; manual-pass.mjs:70-71); `manualReviewNote` alone also appears on auto-markers (foundation.js:1098; DailySessionFlow.jsx:1087). Per-answer challenge stamps (challengeStatus/challengeReviewedBy/challengeReviewedAt — index.js:773-776, db.js:2902-2907) are challenge-flow-specific. The `teacher_override` audit event lives in system_logs, not on the attempt (foundation.js:2857-2863). **No field exists that marks "grade edited by teacher on an organic attempt".**

**Why manualOverride cannot be reused:** CS tooling defines the hand-patched population as `manualOverride===true || /_manual/ docId` (deepfix-census.mjs:119-120, deepfix-census2.mjs:55, deepfix-migrate-list-progress.mjs:198) and assumes those docs are synthetic anchors (answers:[], fabricated range). Stamping it on an organic attempt corrupts that classification.

**Required NEW field set (proposal for DF2-10 wp-7 / DF2-14):** `teacherEdited: true` (the read-only label), `teacherEditedBy: <teacherUid>`, `teacherEditedAt: Timestamp`, `preOverride: {score, passed}` (before-image on the doc, matching the system_logs before/after), optional `teacherEditedReason`. Keep `manualOverride` exclusively for synthetic anchors.

**Readers that must consume the label:** (a) the 4 gradebook enrichment sites + Gradebook UI (the "95% (12/30)" contradiction in (ii)); (b) the r48/R2-37 impossible-record validity filter — its **score↔rows-agreement test would otherwise EXCLUDE every force-passed attempt as corruption** (or worse, count it); teacherEdited needs an explicit carve-out rule; (c) B1 backfill + live label stamping — so a forced pass mints no `reviewLastProvenAt` proof (the R2-16-lineage "force-pass stamps nothing" intent, R2-1b); (d) CS scripts' organic-vs-authorized distinction.

## (iv) Invariant: no grade derived independently of the attempt record — holds, with these session-local exceptions

**Holds at rest [VERIFIED]:** every persisted-grade consumer reads `score`/`passed` off the attempt doc or recomputes from the doc's own rows (reviewChallenge recompute db.js:2920-2922 / foundation.js:2603-2605; idempotency returns index.js:239-253). Day-2+ completion reads the attempt doc and treats its `passed` as authoritative (studyService.js:1872-1885, gate :1911). Grading provenance is stamped, never re-derived (correctnessSource, index.js:510-514).

**Session-local score exceptions at graduation/completion time (the known set):**
1. **Graduation inputs** — `graduateSegmentWords(userId, listId, segment, reviewScore, reviewFailed)` (call studyService.js:2006-2013) takes `testResults.score`/`testResults.failed` from the just-taken test in memory (:1862-1863), produced by `processTestResults` (:763-799) — never re-read from the attempt doc. `segment` comes from sessionStorage (:1747-1756).
2. **Day-1 completion** — `newWordScore = testResults.score` and the pass flag `newWordScore >= threshold` written to session_states (:1850-1859); threshold is the sessionStorage `retakeThreshold` fallback (:1848).
3. **session_states grade-shaped fields** — newWordsTestScore/newWordsTestPassed/reviewTestScore (:1932-1942; challenge path foundation.js:2199-2204, db.js:3047-3052) — scratch, not truth (consistent with A1(ix)).
4. **recentSessions summaries** — client sc.newWordScore/reviewScore clamped into the server summary (foundation.js:1421-1434) → stats/streak AND the throttle derivation `reviewAvgLastNServer` (foundation.js:691-708) run on these copies, not on attempts.
5. **Engagement inputs** — `reviewAnswered` threaded from the live session (studyService.js:1804-1811); the server prefers the stored stamp (foundation.js:1342-1347, 715-723).
All are copies of the same grading event that wrote the attempt — no truly independent grader exists.

## (v) No retroactive graduation on an attempt-grade change [VERIFIED]

- `graduateSegmentWords` (studyService.js:1510-1569, MASTERED batch :1548-1563) has exactly ONE call site: the live completion flow (studyService.js:2006-2013), guarded so day_guard_rejected / completionNotApplied skip it (:1979-2002).
- Grade-change paths write no graduation: client reviewChallenge accept writes ONE challenged word's study_state → status 'PASSED' (not MASTERED) + day-advance only (db.js:2972-3092); server port same (foundation.js:2643-2678); advanceForChallenge advances the day only (foundation.js:2432-2517); overrideAttempt writes zero study_states (foundation.js:2825-2864); runChallengeDayAdvanceTxn updates only csd/twi/reviewMode/lastSessionAt/updatedAt (foundation.js:2240-2246).
- No Firestore trigger on attempts exists (index.js: only `pauseStaleSessions` onSchedule for ap_session_state, :1855). Server resolver/completeSession move csd/twi only, never word states.
- Therefore a force-passed day's words remain in the pool exactly as A1(v) wants stated. One nuance to carry into the spec text: the **challenge-accept** path does flip the single challenged word's legacy status to PASSED (db.js:2975-2982 / foundation.js:2643-2647) — that is the R2-10 (A2-deferred) surface, not day graduation.

## (vii) Resolver expected-anchor inputs are all server-readable [VERIFIED, with 2 caveats]

- **csd/twi**: `durableProgressRef(uid, classId, listId)` → `users/{uid}/class_progress/{classId_listId}` today (`LIST_PROGRESS_CANONICAL=false`, foundation.js:65, 281-296); read pattern foundation.js:1135-1138 (serverTwi/serverCsd).
- **Open-day identity**: expected day = serverCsd+1 (validator leg foundation.js:1192; boundary guard :2191); class+list from the teacher's target row; assignment (pace/threshold) from `classes/{classId}.assignments[listId]` (foundation.js:2482-2483, 2780-2782); list size from lists/{listId} (:2493-2494, 2789-2790); session phase from `users/{uid}/session_states/{classId_listId}` (:2198, 2090-2092). Candidate attempts queryable by studentId/listId/sessionType/studyDay ordered submittedAt desc (pattern foundation.js:730-740).
- **Expected-anchor shape machinery already exists server-side**: validateAttemptAnchorShadow computes serverTwi/serverCsd/allocation/allowedIntroduced (foundation.js:1148-1192) — reusable as the spec assumes; getDayNewPass (:819-839) + deriveDayAnchorRange (:996-1007) give the day's real range for review-attempt matching.
- **Caveat 1**: the M4 validator runs ONLY for `sessionType==='new'` (foundation.js:1129) — a review-shaped expected-anchor check (range vs the day's new pass) is NEW work for the resolver, not a pure reuse.
- **Caveat 2**: no failed review attempt exists in current data — the server writer hardcodes `passed = sessionType==='review' ? true : ...` (index.js:434) — so "select the LATEST failed attempt" has a target population only after DF2-10's review-gate writer ships; legacy review docs are all passed:true. The day-QUEUE identity (segment.wordIds) is today client-side (sessionStorage, studyService.js:1747-1756) — fine for A1(vii)'s inputs, but the r48 Q3 server-owned queue snapshot is what makes composition checks server-readable later.

## (ix) Idempotent existing-doc returns re-confirmed + (viii) baseline notes

- **index.js:474-478** (writeAttemptTxn, inside the txn): `existing.exists` → ownership check → `return normalizeExistingAttempt(existing)` — zero write ops; comment "idempotent no-op" (:478).
- **index.js:538-539** (submitVocabAttempt fast path): `readExistingAttemptForContext` → `return normalizeExistingAttempt(existing)` — read-only (helper :261-278 throws on ownership/context mismatch, else returns the snap).
- **Also present**: gradeTypedTest pre-AI idempotency (index.js:1038-1040, same helper) and the grading-job `return_cached` leg (:1050-1052). `normalizeExistingAttempt` (:239-253) returns the STORED score/passed → a retry after a grade-only override reports the overridden grade to the client (durability-positive).
- **(viii) baseline**: retake-submit and re-entry both pass through server truth — completeSession day-guard (foundation.js:1355-1365), day_guard_rejected clears session_states server-side + logs (:1534-1559), client maps to requiresSessionRebuild and skips graduation (studyService.js:1014-1030, 1979-1987); already_completed maps success-shaped (foundation.js:1562-1568; studyService.js:1032-1038); re-entry reconciles via getOrCreateClassProgress + determineStartingPhase (progressService.js:126-377; studyService.js:228+). Stuck-forever is structurally impossible as claimed — but see mismatch M3 for which status actually fires post-override.

## Spec-text vs code-reality MISMATCHES (the explicit A1 ask)

**M1 — A1(i)'s phrasing presumes overrideAttempt mutates attempt fields.** It mutates none (writes a fresh synthetic doc, foundation.js:2839). R2-1b's r46-H4 supersession is code-accurate; A1(i)'s question list ("score? passed? answers untouched?") answers: n/a-existing / n/a-existing / untouched — the mutating surface is reviewChallenge (db.js:2943-2947).

**M2 — A1(vi) "DISSOLVED (R2-11 — engagement retired; no engagement reader exists)" is FALSE for today's code.** Engagement readers are live: FORCED_PATHWAY=true (featureFlags.js:218) and FORCED_PATHWAY_ENABLED=true (foundation.js:133) activate getReviewForDayServer's FIX-1 skip (foundation.js:794-799), the completeSession hold legs (:1342-1347, 1462-1491), and the client conjuncts (studyService.js:266-270, 1804-1816). Under TODAY'S code a force-passed blank review still would not complete the day. The dissolution is valid only once DF2-10's reader rewrite ships — the resolver and the engagement retirement must land in the same train, or the resolver spec must handle the engaged predicate.

**M3 — A1(viii)'s "retake-submit … hits completeSession → `already_completed`" names the wrong status for the post-override case.** `already_completed` requires the last recentSessions entry to be the completed day (foundation.js:1359-1362); `runChallengeDayAdvanceTxn` appends NO recentSessions entry (:2240-2246), so a stale retake-submit after a teacher override returns **`day_guard_rejected`** (:1364) — session cleared server-side (:1534-1559), client rebuilds (studyService.js:1979-1987). The invariant (server-truth exit, no stuck state) HOLDS; the named mechanism differs. Side-effect worth carrying: a force-passed day leaves no reviewScore in recentSessions, so throttle/intervention derivation (foundation.js:691-708) never sees that day.

**M4 — A1(ix) "override-then-real-pass → single graduation"**: in override-first order the real retake-submit lands day_guard_rejected → client SKIPS graduation → the outcome is single advance + ZERO graduation (words stay in pool — consistent with (v), but "single graduation" ≠ today's behavior). Conversely, a genuine `already_completed` retry re-enters the client graduation call (studyService.js:2004-2014 runs on any success-shaped result) and can graduate ADDITIONAL eligible words — the current client graduation is NOT idempotent across completion retries; DF2-10's in-txn graduation must not inherit this.

**M5 — r48 validity filter × force-pass**: the score↔rows-agreement leg of the impossible-record exclusion would classify every grade-only overridden attempt as malformed (excluded from all four labels + counted as corruption) unless teacherEdited is carved out — unstated in R2-37/A1 text.

**M6 — manualOverride reuse hazard**: census/migration tooling defines the synthetic population by this flag (deepfix-census.mjs:119-120, census2.mjs:55, migrate-list-progress.mjs:198) — the new label must be a different field (see iii).

**M7 — no failed review attempts exist yet** (index.js:434) — the resolver's selection logic exercises only post-redesign data; fixtures must create their population via the new writer.

**Verified-accurate spec cites**: index.js:474-478/:539 ✓; getDayNewPass any-passing (foundation.js:819-839) ✓ (R2-27 Q13b); getReviewTestType 3-attempt MCQ fallback at sessionService.js:374-386 ✓ (R2-33 Q6); `primaryFocusClassId` premise not re-checked here (out of A1 scope).

## Open questions

- Proof-minting rule for force-passed attempts: under R2-41(b) a forced PASSING review with unchanged rows would let its genuinely-correct rows mint reviewLastProvenAt — does the R2-16-lineage 'force-pass stamps nothing' survive into the final law, and is teacherEdited the mechanism (needs an explicit DF2-14 clause)?
- r48 impossible-record filter carve-out: are teacherEdited attempts (score↔rows disagreement by construction) exempted, label-only-included, or excluded-with-published-count in B1 and the live validity filter?
- Does the new grade-only resolver ship in the same train as the R2-11 engagement-reader retirement (M2), or must it also satisfy/bypass isCompletionEngaged for the interim?
- Should the resolver's day-advance append a recentSessions summary (unlike runChallengeDayAdvanceTxn) so already_completed idempotency and throttle derivation see the forced day, or is the day_guard_rejected exit (M3) the accepted contract?
- Graduation idempotency on already_completed retries (M4): confirm DF2-10's server-txn graduation owns exactly-once semantics so the current client re-graduation gap dies rather than migrates.
