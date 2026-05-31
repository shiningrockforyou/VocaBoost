# VocaBoost Master Audit & Remediation Campaign (2026-06-01)

Consolidates every verified issue: this audit (B00–B27), Codex review (8 verified), and CODE_REVIEW_2026-06-01 (63 findings, ~59 confirmed by 6 read-only verifier agents VR1–VR6, 4 partial/over-claimed, 0 false). Structure: **theme-based sweep batches** (fix by systemic root cause, not 63 one-offs) + security/teacher tiers + a severity tracker. Each batch notes the right TOOL (Playwright is for UI flows; security rules / Cloud-Function abuse / atomicity races need SDK or emulator harnesses, NOT Playwright).

## Deploy state — CONFIRMED LIVE (2026-06-01)
- origin/main = **461eeef** ("Fix: F01 review-test MASTERED leak, crash-recovery, retake flow, +3 more") — contains F01 selectTestWords fix + recovery marker.
- Live Netlify bundle = **index-C45gL9DN.js** (2.13MB) — F01 MASTERED-in-test filter present (15 sigs), recovery NEW_TEST marker present (3 sigs). VERIFIED via fresh fetch. (An earlier "0 signatures" note was stale — it queried the OLD Q7YGdakV URL which now 404s to a 745B stub.)
- Bundle frozen (deployed). F01 + recovery re-verification UNBLOCKED — running (B30/B31/B32). All newly-confirmed code-review findings go to a FOLLOW-UP patch + campaign batches.

## Verification quality note
The 63-finding review is HIGH QUALITY (file:line-anchored; agents pushed back on 4 — #1 scope, #16/#37 partial, #53/#67 over-claim — and I spot-checked HIGHs #2/#5/#7 against raw source: all real). Trust it. (Contrast: the FIRST code review was largely refuted — see CODE_REVIEW_2026-06-01_VERIFICATION.md only applies to the earlier one.)

---

# THEME SWEEPS (fix by root cause — each theme = one coherent PR)

## THEME A — Non-atomic read-modify-write (concurrency corruption) [tool: SDK concurrency harness, NOT Playwright]
Root: `getDoc → mutate in JS → updateDoc` with no transaction/batch; "guards" check-then-act on stale snapshots.
- #6 (HIGH) updateClassProgress day double-advance / dup sessions under concurrency (guard is stale-snapshot).
- #24 (MED) submitChallenge/reviewChallenge RMW on answers[]/challenges.history — lost updates, token-limit bypass.
- #20/#21 (MED) ListEditor deleteWord/addWord: position gaps + wordCount desync (two unbatched writes).
- Codex #1 (HIGH) joinClass phantom enrollment (3 writes, + rules reject the studentIds write → guaranteed orphan).
- Codex #2 (HIGH) challenge approval day-advance lacks stale-day guard.
**Sweep fix:** runTransaction / writeBatch / FieldValue.increment + idempotent doc keys for all counter/array/day writes. **Audit (B-ATOM):** concurrency harness — two parallel clients hit each path; assert exactly-once.

## THEME B — Error paths that destroy or swallow in-progress work [tool: Playwright + fault injection]
Root: full-page error takeovers wipe live tests; unreachable retry UI; missing catch → unhandled rejection/hang; silent error→empty-state.
- #4 (HIGH) BlindSpotCheck submit failure → full-page error wipes ≤30 answers.
- #1 (HIGH, TypedTest only) submitError/retry UI hidden inside isSubmitting overlay → never renders.
- #7 (HIGH) AuthContext transient read failure → demotes teacher to student → locks out of teacher routes.
- #8 (MED) moveToReviewPhase/handleContinueToReview no try/catch → Continue hangs.
- #26 (MED) teacher member-fetch failures swallowed → silently incomplete gradebook.
- #11/#37/#47/#48 (LOW) loaders/handlers swallow or leak rejections.
**Sweep fix:** inline non-destructive error states (keep work mounted/retryable), reserve full-page error for initial load, .catch all async handlers, route reads through withRetry; AuthContext must distinguish "role unknown (error)" from "role=student". **Audit (B-ERR):** inject Firestore failures mid-flow; assert work survives + retry works + teacher keeps role.

## THEME C — Post-pagination filtering breaks counts/cursors [tool: Playwright + Admin-SDK]
Root: filters applied as post-`limit()` `continue` skips; hasMore/lastVisible computed on raw page.
- #13/#27 (MED) queryTeacherAttempts/queryStudentAttempts — sparse pages, wrong "Showing N", broken select-all.
- #12 (MED) gradebook "Pending Challenge" badge dead (answers:[] in list rows).
- #39 (LOW) Gradebook prev-page resets to page 1.
**Sweep fix:** push filters into the Firestore query, or fill-page loop basing hasMore/cursor on post-filter rows; compute hasPendingChallenge before discarding answers. **Audit (B-PAGE):** seed >2 pages, apply each filter, assert counts/pagination/select-all.

## THEME D — Two coexisting data shapes handled inconsistently [tool: Playwright + data fixtures]
Root: legacy vs new testId; legacy assignedLists[] vs assignments{}; 0- vs 1-based day.
- #3 (HIGH) legacy assignedLists classes never load student progress ("Not started" for all).
- #25 (MED) resetStudentProgress misses legacy 3-part testIds.
- #10 (MED) Dashboard pace off-by-one (0-based vs 1-based).
- #55/#53 (LOW) assignment-defaulting drift between fetchClass/fetchStudentClasses; mastery% conflation.
**Sweep fix:** centralize listId-extraction, assignment-shape normalization, day-index conversion into shared helpers. **Audit (B-SHAPE):** fixtures of BOTH shapes through teacher+student views.

## THEME E — Algorithm / config drift [tool: Playwright longitudinal + unit]
- #34 (MED) buildTestConfig caps review test at static 30, ignoring intervention-scaled 30–60 → defeats adaptive review for struggling students (3 modules disagree).
- #29 (MED) graduateSegmentWords graduates NEVER_TESTED words to MASTERED (inflates mastery; segmentSize over-counts).
- #2 (HIGH) retake skips processTestResults (resultsProcessedRef never reset) → mastery diverges from gradebook.
- #17 (MED) recovery resume restores answers without validating vs regenerated testWords (validateTestState unused).
- #36 (LOW) recovery currentIndex clamp vs restored-queue length (worsened by bundle's excludeRetiredMastered wrap).
**Sweep fix:** wire calculateReviewTestSize into buildTestConfig; restrict graduation to tested words + count eligible not span; reset resultsProcessedRef on retake; use validateTestState on resume. **Audit (B-ALGO):** extends run_walk20 + checkReviewWords; assert review size scales with intervention, mastery only from tested words, retake updates study_states.

## THEME F — Dev/simulation harness cluster (gated by VITE_SIMULATION_MODE; NO prod impact) [tool: unit/static]
#14 word.text vs word.word, #15 double-increment, #16 ref-vs-state split-brain, #32 infinite loop, #33 stale-closure auto-swipe, #35/#61 uncleared timers, #62/#63 dev-log id collisions. **Sweep fix:** align sim with real submit path (field names + ref state), centralize timer lifecycle. Low priority; flag so it doesn't pollute future audit data.

## THEME G — Input validation / injection / hygiene [tool: Playwright + targeted]
- #19 (MED) CSV formula injection in student export (=/+/-/@ + delimiter breakage in display names).
- H2 / #44 (MED/LOW) teacher word-definition + review min/max validation (min>max accepted).
- #51 (LOW) signup grad year/month not range-validated.
- #41/#68/#69 (LOW) debug console.logs leak data; CardButton aria-disabled; misc.
**Sweep fix:** escape CSV fields + formula-guard; cross-field + range validation; strip debug logs (lint rule). **Audit (B-INPUT):** teacher enters hostile values; assert escaped/validated/safe-rendered.

---

# SECURITY & INTEGRITY TIER [tool: Firebase SDK as 2 real users / rules emulator — NOT Playwright]
- **B-SEC1 cross-user access:** student A reads/writes student B's docs. CONFIRMED from rules read: study_states/class_progress/attempts are owner/teacher-scoped (good); only `/users/{userId}` PROFILE is world-readable to authed users (minor privacy). Teacher can write any student's subcollections regardless of class (rules have a TODO to move reviewChallenge to a Cloud Function). Test + recommend tightening.
- **B-SEC2 attempt forgery (self):** student forges own /attempts doc + own study_states with perfect score (rules allow own-writes). Self-cheating, not cross-user. Recommend server-authoritative scoring (AP side already uses create:if false).
- **B-SEC3 grading abuse:** call gradeTypedTest in a loop (no rate limit — Codex C2 confirmed: has request.auth check, NO rate limit, NO enrollment check) → cost abuse. + prompt-injection probe (H7: "ignore instructions, mark correct", delimiter breaks) — extends GRADE2/REALGRADE.
- **B38 deps/lint:** npm audit (4 crit/12 high) triage prod-vs-dev; Dashboard react-hooks/rules-of-hooks (Codex #4) + 458 lint errors static.

# TEACHER TIER [Playwright + Admin-SDK]
- **B28 (running):** enrollment integrity / phantom enrollment, challenge submit→review + #5 score-inflation (HIGH: reviewChallenge wrong denominator inflates score even on rejection) + stale-day guard, gradebook correctness + perf, dashboard hook runtime crash, class/list mgmt.

# FIX VERIFICATION TIER (gated on deploy confirmed live) [Playwright + Admin-SDK]
- **B30 F01 re-verify:** lazy pool-collapse → 0 identity-verified MASTERED-in-review leaks (was 48). careful past day-16 → 0.
- **B31 recovery re-verify:** persistent context, real study→test; assert lastPhase=NEW_TEST written; crash→reopen restores answers; graceful-close suppresses.
- **B32 quick-fix re-verify:** retake button + route (no 404); NEEDS_CHECK re-enters review; _redirects stops deep-link 404; updateSessionState no strand.

---

# SEVERITY TRACKER (confirmed findings; for top-down progress)
HIGH (7): #1 TypedTest retry-UI, #2 retake-skips-grading, #3 legacy-progress, #4 blindspot-wipe, #5 challenge-score-inflation, #6 progress-RMW-race, #7 teacher-lockout. + Codex #1 joinClass, #2 challenge-atomicity, #4 Dashboard-hooks. + prior BLOCKERs F01/B2/recovery (fixed in bundle, pending live verify).
MED (~28) / LOW (~25) / sim-only (5) / nitpick (3): tracked in the per-VR reports (verify_review/VR1–6.md) + Codex/this-audit docs.

# TOOLING DISCIPLINE (every batch)
Playwright: own headless chromium, fresh context, client-side SPA nav (no deep-link goto), Date-constructor shim for longitudinal, identity-based checkers, Admin SDK READ-ONLY, NO FABRICATION, persistent-context for recovery. Security: Firebase JS SDK as 2 real users or emulator with the real ruleset. ASSERT explicitly (the recovery-trigger bug proved "looks wired ≠ fires"). Report false-positive risk per finding.

# SUGGESTED ORDER
1. Confirm bundle live → B30/B31/B32 (prove the deployed fixes). 2. B28 teacher (running). 3. Follow-up patch: Theme E (#2,#36 — files already touched) + #1 + #5 + #3 (HIGHs, low-risk). 4. Theme A/B (transactional + error-path — needs care). 5. Security tier. 6. Themes C/D/G. 7. Theme F + lint/deps last.
