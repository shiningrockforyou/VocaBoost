# VocaBoost Audit — Save State 3 (2026-06-01)

## Git / deploy
- `origin/main` = prod = commit **6e9dd4a** (B2 fix + F01 build-time filter + selectReviewQueue backstop, all live).
- **Uncommitted in /app working tree** = the consolidated bundle (NOT yet on origin/main): 5 src files + public/_redirects. Delivered as **vocaboost_ALL_fixes.patch** (verified: git apply --check + full apply clean on pristine HEAD, all esbuild-parse OK). This SUPERSEDES the individual patches (blocker/quick/f01_definitive).

## vocaboost_ALL_fixes.patch contents (awaiting user deploy)
- studyAlgorithm.js: isRetiredMastered + excludeRetiredMastered helpers; selectTestWords filters retired-MASTERED (**THE F01 test-layer fix**); selectReviewQueue NEEDS_CHECK bucket (Codex #7) + MASTERED backstop.
- DailySessionFlow.jsx: **crash-recovery marker** written in navigateToTest (RECOVER3-confirmed HIGH fix); 6 setReviewQueue sites wrapped in excludeRetiredMastered (study-layer F01, user's "never show MASTERED in any mode" decision).
- MCQTest.jsx / TypedTest.jsx: retake route fix (/mcq-test→/mcqtest) + "Try Again" button wired (Codex #3).
- sessionService.js: updateSessionState strip-undefined (Codex #8). (saveSessionState strip already in 6e9dd4a.)
- public/_redirects: SPA fallback (Codex #5).

## CONFIRMED bug status
- **B2 (day-not-advancing strand): FIXED + verified in prod** (VERIFY).
- **F01 (MASTERED-in-review): real fix in bundle, NOT yet deployed.** Was leaking 48× in prod (lazy pool-collapse, identity-verified). Root cause: review TEST uses selectTestWords (no filter), not the buildReviewQueue path the earlier fixes touched. RULE: only "fixed" when lazy pool-collapse VERIFY = 0 leaks.
- **Recovery-trigger (HIGH): real fix in bundle, NOT deployed.** RECOVER3 confirmed: real-flow crash → lastPhase=NEW_STUDY (should be NEW_TEST) → recovery never fires → answers lost. Fix = write marker in navigateToTest.

## PENDING WORK (user direction 2026-06-01)
1. **Re-verifications (after user deploys the bundle):** lazy pool-collapse VERIFY (F01=0) + B29 recovery checks (R1 lastPhase=NEW_TEST, R3 crash→restore) + retake/_redirects/NEEDS_CHECK checks.
2. **Teacher-side audit (B28)** — batches/B28_teacher_side_audit.md ready. Covers Codex #1 (phantom enrollment), #2 (challenge atomicity), #4 (Dashboard hooks) + gradebook/analytics.
3. **Verify CODE_REVIEW_2026-06-01.md** (other Claude session, Sonnet, "47 files", 4 critical/7 high) — IN PROGRESS. ⚠️ Suspect: C2/C4/H7 claim OpenAI but grader is Claude Haiku 4.5 (Anthropic SDK) + functions has request.auth check. Verify ALL against real code; many may be wrong/assumed.
4. **Design an extensive Playwright audit campaign** spanning ALL issues (this audit's + Codex's + the new review's verified ones).

## Codex findings (all 8 verified valid earlier — CODEX_REVIEW.md)
- In bundle: #3, #5, #7, #8. HELD for human/dev: #1 joinClass phantom enrollment (rules reject studentIds write), #2 challenge non-atomic + stale-day guard, #4 Dashboard conditional hooks. + npm audit (4 crit/12 high), 458 lint errors, empty correctDefinition batch-crash.

## CONFIRMED GOOD (don't re-audit)
20-day walk achieved; AI grading on real data ~96.8% acc / 0 false-neg (Haiku 4.5); new-word selection; dedup; edit-churn; intervention; Korean UTF-8; no fabrication. Recovery infra works once marker correct (RECOVER3 scenario B). Graceful-close correctly suppresses recovery (intended). 3-min recovery window = MEDIUM/optional.

## Key gotchas
- CRLF files; node --check can't parse JSX (use esbuild.transformSync); vite build unrunnable in sandbox (missing lucide-react + .vite-temp EACCES).
- Patch gen: use `git add -N` for untracked files so one `git diff` covers them; verify apply on a clean stash (include --include-untracked).
- I can't push/PR (no creds/gh) — deliver patches; sandbox auto-syncs to origin/main after user pushes.
- Grader = Claude Haiku 4.5 (claude-haiku-4-5-20251001), NOT OpenAI. Docs say OpenAI = stale. (Old grader was GPT-4o-mini.)

## Reusable harness
- e2e/audit/B27/run_walk20.mjs (Date-constructor shim + H2 Move-On + fresh context).
- e2e/audit/helpers/expectedWords.js (checkReviewWords identity).
- VERIFY pattern: deploy-gate live bundle signatures → lazy pool-collapse + careful past-day-16 + B2 strand.
- RECOVER3 pattern: persistent context (preserve localStorage) + real study→test flow (NOT skip).
- Batches ready: B28 (teacher), B29 (recovery).
