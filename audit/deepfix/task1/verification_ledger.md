# Task 1 — Orchestrator H1 verification ledger (running)

**Purpose.** Bank the H1 (VERIFY EVERYTHING) re-tracing of concrete `file:line` anchors against the CURRENT
working tree, as evidence accrues. Started during the 1.2/1.3 wait; folds into the formal **1.5 H1 gate** and
the `VERIFICATION` annotations on `CONSOLIDATED_ISSUES.md`. Line numbers here supersede the prior-session /
NEED_TO_FIX citations where they drifted (the tree evolved + carries the uncommitted Phase-1 fix).

Legend: ✓ = confirmed in current code (traced today); ✓+ = confirmed AND surfaced a correction/extension beyond
the source doc; ⏳ = not yet re-traced.

| # / cluster | Claim | Prior cite | CURRENT cite (today) | Status | Notes / corrections |
|---|---|---|---|---|---|
| Flaw A / R-A1 | Day-2+ completion gate blocks review-only day | `studyService.js:1384-1401` | gate at `:1430`; `reviewOnlyDay` predicate `:1333`; wordsIntroduced clamp `:1339` | ✓+ | Working tree already carries the Phase-1 fix (uncommitted). Gate now `if (!reviewOnlyDay && newWordAttemptPassed!==true && newWordScore<threshold)`. |
| Flaw B / R-B1 | Progress doc keyed `{classId}_{listId}` | `progressService.js:32` | `getProgressDocId` `:33-34`; `getSessionDocId` `sessionService.js:55-56` | ✓ | Both return `` `${classId}_${listId}` ``. |
| Flaw B / R-B2 | Anchor query is student+list scoped | `db.js:3250` | `getMostRecentPassedNewTest` `db.js:3239` | ✓ | Signature `(userId, classId, listId)`; list-scoped path filters studentId+listId. |
| #9 / R-B4 (1) | Gate lookup uses post-pass base | `studyService.js:1318-1321` | `getNewWordAttemptForDay` gate `:1391` (exact-nwStartIndex match, comment `:1387`) | ✓ | Mechanism present; "exact newWordStartIndex match required [V4/Codex-P1-2]". |
| #9 / R-B4 (2) | TWI double-advance | `progressService.js:462` | `:467` `totalWordsIntroduced: (current||0) + (summary.wordsIntroduced||0)` | ✓ | Confirmed the additive TWI writer. |
| #9 / R-B4 (3) | Review paired to anchor class | `db.js:3407-3416` | `getReviewForDay` `:3391`; anchor-lineage required `:3406`; fail-closed `:3455` | ✓ | Pairing keyed on `anchorClassId`; now has explicit fail-closed on incomplete lineage. |
| #10 / R-F3 | Self-race: attempt→reconcile→complete | `TypedTest.jsx:919/979/1015`, `progressService.js:258/442`, `MCQTest.jsx:717` | `TypedTest.jsx:919` (write) / `:985` (getOrCreateClassProgress snapshot) / `:1022` (complete); `progressService.js:265` `currentStudyDay:safeCSD` + `:270` updateDoc + `:444` day-guard; `MCQTest.jsx:724` | ✓+ | Ordering intact. Code now CARRIES explicit #10 annotations (`TypedTest.jsx:979-989` "retake-rewind snapshot… #10", null-skip guard) — a documented, mitigated-but-latent state. |
| #1b / R-F1 | Self-writable role → self-promote teacher | `firestore.rules:34-35`, `AuthContext.jsx:39` | `isTeacher()`=`getUserData().role=='teacher'` `rules:19`; owner write `rules:34-35`; `AuthContext.jsx:39` `role: userData.role ?? 'student'` | ✓ | Owner-write block (34-42) has no field whitelist visible in grep — READ full block at 1.5 to confirm no `hasOnly` guards role. |
| #1c / R-F2 (create) | Student can create any attempt | `firestore.rules:101` | `allow create: if isAuthenticated() && request.resource.data.studentId==request.auth.uid` (`rules:~106`) | ✓ | No shape/passed check → `{passed:true}` forgery. |
| #1c / R-F2 (update) | Student-writable `answers[]` | `firestore.rules:109` | `allow update: … studentId==uid && diff().affectedKeys().hasOnly(['answers'])` | ✓+ | Rules block (96-101) documents W3 lockdown is STAGED (`docs/plans/W3_attempts_lockdown.rules.md`), intentionally NOT live yet — the live forgeability is a known deferred posture, not an oversight. |
| #1c / R-F2 (launder) | reviewChallenge recompute from stored isCorrect | `db.js:2690-2717` | `reviewChallenge` `db.js:2651`; recompute `:2704` `correctCount=updatedAnswers.filter(a=>a.isCorrect).length`; `:2706` newScore | ✓ | Confirmed the recompute-from-client-isCorrect laundering vector. |
| #7 / D1 | `assignedLists \|\| Object.keys` — `[]` truthy | `db.js:502` | `db.js:502` | ✓+ | **BROADER than #7 states:** same pattern at `db.js:502, 1438, 1531, 1808, 2314, 2436` (6 sites). A durable fix must cover all six; `:811/:835` use a different `\|\| []` pattern (intentional). |
| #8 / R-G2 | Name filter client-side on 50-row page | `db.js:1858/1982/1943` | `queryTeacherAttempts` `:1858` (pageSize 50); orderBy submittedAt `:1927`; client post-filter `:1982` `if (filterStudentIds.length>0 && !includes(studentId)) continue` | ✓ | Confirmed the paginate-then-post-filter architecture. |
| #5 / D2 | `retakeThreshold` defaults 0.95, fails closed | `TypedTest.jsx:~87`, `studyService.js:267` | `TypedTest.jsx:87` `useState(0.95)`; pass check `:817` `score>=retakeThreshold`; resolve `studyService.js:305` `newWordRetakeThreshold \|\| DEFAULT_RETAKE_THRESHOLD` | ✓ | Interim mitigation (assignments now carry `newWordRetakeThreshold`) usually resolves the real value at `:305`, but the client `:87` default + `:817` compare remain the durable gap on resolution failure. |

**Still to re-trace at 1.5 (lower-priority / discrete):** #3 (`gradeTypedTest` listId-gated backfill, `functions/index.js`),
#4 grading-error modal (`gradeWithRetry` branch), D6 (`newWordsTestPassed` derived-from-score in
`completeSessionFromTest`), #2/#14 grader calibration (`functions/index.js` grading prompt), #4 provenance
(`stamp-build.mjs`), #13 test-gen path (needs data audit, not just code), #12 root cause (needs live repro).

## CORRECTIONS from the 1.2/1.3 independent lists — VERIFIED by me today (H1)

Codex (1.3) and the fable agent (1.2) both asserted #9/#10 are ALREADY FIXED in the working tree, contradicting
NEED_TO_FIX + my R-F3/R-B4 framing. I traced both against current code — **both corrections CONFIRMED**:

- **#10 self-race — FIXED in working tree (uncommitted). ✓+ [V-now]** `TypedTest.jsx:983-985` + `MCQTest.jsx:722-724`:
  `const progress = LIST_SCOPED_RECON ? await getClassProgress(...) : (await getOrCreateClassProgress(...)).progress`.
  Under the LIVE flag it takes the PURE read `getClassProgress` (no reconciliation write between attempt-write and
  completion) → the self-race cannot occur. My earlier ledger row ("ordering intact") was a MISREAD of the ternary —
  **CORRECTED.** Reclassify #10 / R-F3: *fixed-in-tree, verify-deployed* (prod may still run stale code). Triple-
  confirmed (my trace + Codex + fable).
- **#9 cross-class review retake (3 coupled modes) — FIXED in working tree (uncommitted). ✓+ [V-now]**
  `studyService.js:247-274`: on a REVIEW_STUDY resume under the flag, `nwCount=0` (no re-introduce / no TWI
  double-advance = mode 2) AND preserves the passed-new anchor range on `newWordStartIndex/EndIndex` (mode 1 gate
  lookup + mode 3 review pairing via `getReviewForDay`, `db.js:3402-3443`). Reclassify #9 / R-B4:
  *fixed-in-tree, verify-deployed*.
- **Consequence:** #9, #10, AND #11 are ALL fixed-in-tree-but-uncommitted-and-undeployed. The live-student defect
  for all three is now a **deploy-state** problem, not a code-absence — which sharply elevates R-G1 (deploy
  provenance / #4) and the empirical need (does PROD behave as HEAD? check `system_logs` signatures + `version`).

## NEW deploy-landmine finding from fable (1.2) — to VERIFY at 1.5
- **G1 — `GRADE_TOKEN_ENFORCED = true` in HEAD (`functions/index.js:~58`)** while PROD was set `false` on 06-29 to
  stop a 118-save `permission-denied` outage (CS-2026-06-29 A), root cause (localStorage-nonce→docId divergence,
  `testRecovery.js:98-110`) UNPATCHED. **Deploying HEAD as-is reintroduces the outage.** ⚠️ This is a hard blocker
  on any deploy of the deepfix work — VERIFY `functions/index.js` HEAD flag value + the nonce root cause at 1.5.
  (Neither my list nor Codex isolated this — fable's sharpest independent find.)
- **B2 (fable) — empty-review automarker can't satisfy flag-on review pairing** (`DailySessionFlow.jsx:~984` writes
  no `newWordStartIndex/EndIndex`; `db.js:~3440` requires exact match) → auto-completed "all mastered" days revert.
  VERIFY at 1.5/1.6.
- **E1 (fable) — automarker/manual-pass attempts lack a parseable `testId` → dropped from gradebook** (`db.js:~1977`)
  — a SECOND cause of "no results" beyond #8's aging-out window; ties to the CS manual-write population. VERIFY.
- **C2 (fable) — challenge-token accounting:** code counts only ACTIVE REJECTIONS in a 30-day window (`db.js:~181`),
  so accepted/pending challenges cost nothing — refines R-C4/Codex-14 ("rejected consumes a token"). VERIFY exact
  accounting at 1.5.

## MORE H1 confirmations (traced today)
- **G1 CONFIRMED ✓+ [V-now]:** `functions/index.js:58` `GRADE_TOKEN_ENFORCED = true` (HEAD) + `:68` `GRADE_TOKEN_MINT = true`.
  Prod was set `false` 06-29 (CS-2026-06-29 A). **Comment `:69` still says "GRADE_TOKEN_ENFORCED stays false" — STALE/contradictory
  = a deploy trap.** Nonce still `localStorage`-based (`testRecovery.js:88`) → root cause looks unpatched. Deploy blocker.
  (Still verify at 1.5: did a sessionStorage/in-memory nonce fallback land? The 06-29 follow-up asked for one.)
- **C2 CONFIRMED+refined ✓+ [V-now]:** `db.js:181` `getAvailableChallengeTokens = max(0, 5 − activeRejections)` where
  activeRejections = history entries `status==='rejected' && replenishAt.toMillis() > now`. **ONLY rejected (still-active)
  challenges consume tokens; accepted/pending cost nothing.** Sharper than R-C4/Codex-14. "Out of tokens" = 5 rejections in 30d.
- **D6 CONFIRMED ✓ [V-now]:** `studyService.js:1376` `newWordsTestPassed: newWordScore >= threshold` (+ `:1453` null-on-absence
  for the review-only path). Persisted flag is score-derived, not the authoritative `newWordAttemptPassed` → COMPLETE+passed:false possible.

## OPEN empirical questions from the census smoke test (Adv B2) — RESOLVE after full census
- **`impossible_phase_detected: 3088`** of the last 4000 system_logs (window ~07-12→07-13) — the DOMINANT log event.
  NEED_TO_FIX #10 flagged this family at "406 recent"; now far higher. WHAT is it, is it benign, whose (26SM vs sandbox)? **Investigate.**
- **`day_guard_rejected_session_cleared: 17`** recent — CONTRADICTS SESSION_CONTEXT "0 live / 5 all-time sandbox." Attribute:
  are these 26SM real students (→ #10 fires in prod) or 07-12 fleet audit sandbox runs? **Attribute before concluding #10 is live.**
- **testSizeMismatch: 8 in Adv B2 alone** — validate the heuristic isn't over-counting (retakes / mid-list remainders / review days)
  before treating as #13 scope. Cross-check the flagged rows in census_rows.json.
- **B2 (fable):** DailySessionFlow.jsx path is `src/pages/` (grep guessed src/components/ — re-locate); verify the empty-review
  automarker anchor-range claim then.

**Bonus independent findings banked (feed the consolidator + 1.6):**
1. **#7 is a 6-site pattern**, not one line — widen the fix surface.
2. **#1c live forgeability is intentional/deferred** (W3 staged, safe-deploy posture) — so R-F2 is a *sequencing*
   problem (when to apply the staged lockdown), corroborating X1.
3. **#10 is annotated + partially mitigated in code** (retake-rewind snapshot + null-skip guard) yet the core
   ordering remains — the latency-in-prod is real but the code shows awareness.
