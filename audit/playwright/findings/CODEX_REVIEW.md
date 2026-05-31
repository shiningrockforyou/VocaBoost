# Codex Audit Findings — Validation (verified against actual code, 2026-05-31)

All 8 Codex findings verified by reading the cited code. **Every one is valid.** None overlap with the already-patched B2/F01 except #6 and #7 (which I'd already flagged). Several are in the teacher/enrollment surface we never audited — Codex found real things there.

| # | Codex finding | Verified? | Severity | Notes |
|---|---|---|---|---|
| 1 | joinClass phantom enrollment | **CONFIRMED + worse** | HIGH | Non-atomic 3-write sequence (db.js 941→953→959). AND firestore.rules:55 `allow update ... hasOnly(['studentCount'])` but the client write at 953 also sets `studentIds` → the rule REJECTS that update for normal users, so the middle write *fails by design* → member doc exists, class never updated = guaranteed phantom enrollment. This is a rules-vs-code mismatch, not just a race. |
| 2 | Challenge submit/review non-atomic | **CONFIRMED** | HIGH | submitChallenge (2539/2552) + reviewChallenge (multiple awaits, no transaction/batch). Day-advance at 2698-2731 increments `currentStudyDay` guarded only by score threshold — no stale-day guard. Teacher-side; never audited. |
| 3 | Retake route mismatch + retake UI not wired | **CONFIRMED** | HIGH (easy fix) | Routes are `/mcqtest` `/typedtest` (App.jsx 99/107) but retake navigates to `/mcq-test` `/typed-test` (MCQTest 807, TypedTest 909) → **404 on every review retake**. Failed-test result UI only renders "Go to Dashboard"; `canRetake`/`handleRetake` exist but aren't rendered (lint flags them unused). |
| 4 | Dashboard.jsx hook-order errors | **CONFIRMED via lint** | HIGH | `react-hooks/rules-of-hooks`: conditional `useMemo`/`useState` at Dashboard.jsx 902, 989, 1107, 1159+. Real — can cause unstable state / crashes across renders. |
| 5 | Netlify SPA fallback missing | **CONFIRMED** | MEDIUM | No `public/_redirects`, no `netlify.toml`. BrowserRouter (App.jsx:28) → deep-link/refresh 404s. Matches our own first-audit SPA-404 finding. (Unless configured in Netlify UI — can't see that; but we observed live 404s, so it's real.) |
| 6 | Empty correctDefinition fails whole batch | **CONFIRMED** | HIGH | functions/index.js:97 throws on missing field; TypedTest.jsx:628 passes `word.definition` directly. Same as our finding. |
| 7 | Returned MASTERED (NEEDS_CHECK) never re-enters review | **CONFIRMED** | MEDIUM→HIGH | selectReviewQueue (studyAlgorithm.js) buckets only FAILED/NEVER_TESTED/PASSED (+ our new MASTERED exclusion at 222). No NEEDS_CHECK bucket → returnMasteredWords flips MASTERED→NEEDS_CHECK (studyService.js:920) but those words then never get selected for review. **Now MORE important:** our F01 fix makes retirement actually work, so words DO return as NEEDS_CHECK — and then get stuck out of review. The fix and this gap interact. (Possible mitigation via blind-spot staleness path — needs verification.) |
| 8 | updateSessionState lacks strip-undefined | **CONFIRMED** | MEDIUM | My B2 patch hardened `saveSessionState` (123) but `updateSessionState` (171) still writes `...updates` raw. Same Firestore-undefined failure class open for its callers (dismissWord, recordNewWordsTestResult, recordReviewTestResult). Incomplete hardening — good catch. |

Plus: **npm audit** = 4 critical / 12 high / 15 moderate / 1 low dependency vulns. **Lint** = 458 errors (many from e2e scripts in repo-wide lint, but real app-source: Dashboard hooks, unused retake handlers, hook-dep warnings). Codex correctly **withdrew** the intentional-exit finding per owner clarification.

## How these relate to our audit
- #3 explains/compounds our **beginner-stuck-at-90%** MEDIUM: even when a student *should* retake, the button isn't shown and the retake route 404s. Wiring retake is part of unblocking beginners.
- #7 is the downstream of our **F01 fix** — fixing the leak surfaces the "stuck retired" gap. Should be fixed together.
- #2 (challenge day-advance) is the *other* `currentStudyDay` writer besides completeSession — the teacher-approval path. We never exercised it. Reinforces the **teacher-side audit** gap.
- #6, #8 already in our FIX_SPEC.

## Proposed fixes (by effort/impact)

**Quick + safe (one-liner-ish, low risk):**
- **#3 route mismatch:** change retake nav to `/mcqtest`/`/typedtest` (or rename routes — pick one canonical form). Then render the retake button in the failed-result UI using existing `canRetake`/`handleRetake`.
- **#8 updateSessionState:** apply the same `Object.fromEntries(...filter v!==undefined)` strip already in saveSessionState.
- **#5 _redirects:** add `public/_redirects` with `/*  /index.html  200` (if not handled in Netlify UI).
- **#7 NEEDS_CHECK:** add a NEEDS_CHECK bucket to selectReviewQueue (e.g., treat like NEVER_TESTED/PASSED priority) so returned words re-enter review.

**Needs care / review (data-integrity, transactional):**
- **#1 joinClass:** make enrollment atomic (writeBatch or a Cloud Function), AND fix firestore.rules to allow `studentIds`+`studentCount` together (or move enrollment server-side). Rules+code must agree.
- **#2 challenge:** wrap submit/review in transactions/batches; add a stale-day guard to the challenge day-advance (mirror the `expectedDay` guard in updateClassProgress).
- **#4 Dashboard hooks:** refactor conditional hooks to top-level — needs careful reading of Dashboard.jsx render branches.

**Dependencies:** triage `npm audit` — run `npm audit` to see if the criticals are in prod deps or devDeps/build-only.

## Proposed follow-up audits
1. **Teacher-side audit** (covers #1, #2, #4-dashboard, gradebook, analytics) — the biggest untested surface; Codex's #1/#2 are the tip.
2. **Enrollment integrity audit** — join/leave class, rules-vs-code consistency, phantom-enrollment repro.
3. **NEEDS_CHECK lifecycle audit** — confirm whether returned words are truly stuck or rescued by blind-spot; verify after the bucket fix.
4. **Retake-flow audit** — after wiring the UI/route, confirm failed students can actually retake (ties to beginner-stuck).
