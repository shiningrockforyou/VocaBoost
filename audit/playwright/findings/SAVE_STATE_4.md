# VocaBoost — Save State 4 (2026-06-01, end of session)

## Deploy state (origin/main + live)
- origin/main = **e74e08a** "Add student name editing (Profile page + teacher rename) + fix profile-menu bugs" — LIVE on Netlify.
- Live web bundle confirmed serving updated code throughout the session.
- Cloud Functions: `gradeTypedTest`, `createSession`, `submitTest`, `pauseStaleSessions`, + **`renameStudent` (deployed this session, verified live + e2e)**.

## SHIPPED & VERIFIED this session (all live + confirmed)
1. **F01 (MASTERED-in-review):** fixed via `selectTestWords` filter; VERIFY2 confirmed 0 leaks under lazy pool-collapse (was 48). CLOSED.
2. **B2 (day-not-advancing strand):** fixed (saveSessionState strip-undefined + newWordScore default). Confirmed.
3. **Phantom enrollment:** firestore.rules `hasOnly(['studentCount','studentIds'])` deployed; backfill restored 103 students across 5 classes; verified 0 inconsistencies; join-class e2e confirmed new joins land in studentIds.
4. **reviewChallenge:** #5 score-denominator inflation fix + CSD-via-challenge stale-day guard — APPLIED, in commit (deployed). (runTransaction atomicity rework still SPEC-only in reviewChallenge_applied.README.)
5. **Quick fixes (Codex #3/#5/#7/#8):** retake route+UI, SPA _redirects (live, deep links 200), NEEDS_CHECK review bucket, updateSessionState strip-undefined.
6. **Help guides (4):** help-student/teacher ko/en — TA-first (teacher) / study-first (student) ordering, corrected challenge-token model (5 tokens, reject=30-day hold, accept=no cost), pass-threshold note, "where to click to Start Session", NO credentials. Deployed (commit 1574922 then folded forward).
7. **Name-edit feature (this session, LIVE + e2e-verified):**
   - New `/profile` page (student self-edit of displayName).
   - `updateDisplayName()` helper writes profile + denormalized members/{uid}.displayName copies.
   - AuthContext `updateUserName()` (live header refresh).
   - `renameStudent` Cloud Function — authorization-scoped (teacher must own a class the student is in); e2e verified: owned-rename SUCCESS, outsider DENIED (permission-denied), empty-name rejected, revert OK, cleanup confirmed.
   - ClassDetail roster pencil-edit UI.
   - Fixed 2 pre-existing bugs: dead `/profile` link (no route → bounced); header/dashboard read user.displayName instead of user.profile.displayName (showed email prefix).

## Data health (read-only audits this session)
- June 1+ real cohort = 15 students. CSD/class_progress + study_states CLEAN (0 corruption). 88,239 study_states across 194 real students: 0 invalid status, 45,154 MASTERED all with returnAt.
- Retakes WORK: June1+ cohort had 3 retakes, all 3 recovered (fail→pass). All-time: 216 real retake groups, 128 fail→pass recoveries. (I was wrong earlier saying students "can't retake" — corrected; new-word retake is in-place, no broken route; the broken route was REVIEW-retake only, Codex #3, now fixed.)
- 3 June1+ students at CSD=0 = correct failed-Day-1 holds (83/87/0% vs 90% threshold), NOT the F1 mobile bug. Haven't retaken yet; not blocked.
- 10 Day-1 persona runs: all Day-1 OK, 0 B2 strands, 0 crashes, junk/injection rejected, no XSS.

## OPEN / NOT YET DONE (follow-up patch candidates — none blocking)
- **D1-05 mobile F1 (BLOCKER-ish, UNCONFIRMED on real users):** mobile session completed but class_progress.currentStudyDay didn't advance (session_state said complete). Did NOT reproduce on the 3 real CSD=0 students (those were correct fails). Needs a 2nd mobile repro to confirm mobile-specific vs transient.
- **D1-05 F2 (HIGH, mobile layout):** dashboard "Start Session" button ~17px below fold on iPhone — needs scroll. CSS fix.
- **Recovery answer pre-fill:** crash recovery routes back to test but inputs come back EMPTY (answers in localStorage not repopulated). VR1 #17 / VERIFY2. validateTestState helper unused.
- **#2 (HIGH):** retake skips processTestResults → mastery diverges (MCQTest+TypedTest).
- **#1 (HIGH, TypedTest):** submitError retry UI hidden in isSubmitting overlay.
- **#3 (HIGH):** legacy assignedLists classes never load student progress.
- **reviewChallenge atomicity:** runTransaction rework (spec in reviewChallenge_applied.README) — needs emulator test before deploy.
- **B28 teacher HIGHs remaining:** challenge atomicity (above), Dashboard.jsx conditional-hooks refactor.
- **Empty correctDefinition (HIGH):** ~1,015 word/answer pairs blank def → whole grading batch can crash. Live-exposure check + data backfill + function skip-and-mark. (Not re-checked recently.)
- **Themes/security tier (AUDIT_CAMPAIGN_MASTER.md):** non-atomic RMW, post-pagination filtering (gradebook counts), input validation/CSV injection, grading rate-limit + prompt-injection probe, npm audit (4 crit/12 high), 458 lint.
- **Gradebook UX proposals (GRADEBOOK_UX_PROPOSALS.md):** Tier-1 = challenge inbox + status pills + fix dead pending-challenge badge (#12); per-student view; summary header; filter persistence.

## Accounts / creds (in transcript — rotate if needed)
- TA/admin uses: veterans@vocaboost.com / veterans5944 (real fake-teacher; used for e2e).
- ta@vocaboost.com / VocaTA2026! — created earlier; user said KEEP (unused; not in guides).
- Audit student accounts: AuditPass2026!.

## Key gotchas (carry forward)
- Edits to some files (HeaderBar.jsx, App.jsx, DailySessionFlow.jsx) sometimes SILENTLY REVERT (linter/reload) — ALWAYS re-grep after editing before generating a patch.
- CRLF source files; node --check can't parse JSX (use esbuild.transformSync); vite build unrunnable in sandbox (missing lucide-react dep + .vite-temp EACCES).
- I can't push/PR or firebase deploy (no creds/CLI) — deliver patches; user deploys. Sandbox auto-syncs to origin/main after user pushes.
- displayName denormalized in BOTH users/{uid}.profile AND classes/{cid}/members/{uid} — any rename must update both.
- Grader = Claude Haiku 4.5 (NOT OpenAI; docs stale).
- Verify deploys via live bundle hash + behavioral probe; never assume a deploy landed.

## Patches delivered (status)
- vocaboost_ALL_fixes.patch (F01/B2/recovery-marker/retake/NEEDS_CHECK/_redirects/updateSessionState) — DEPLOYED.
- reviewChallenge_applied.patch (#5 + stale-day guard) — DEPLOYED. (atomicity = spec only.)
- name_edit_feature.patch — DEPLOYED + e2e verified.
- Specs/reports: AUDIT_CAMPAIGN_MASTER.md, GRADEBOOK_UX_PROPOSALS.md, NAME_EDIT_PLAN.md, LOOSE_ENDS_AND_DAY1.md, CODE_REVIEW_2026-06-01_VERIFICATION.md, verify_review/VR1-6.md, PATCH_INTERACTION_NOTES.md.
