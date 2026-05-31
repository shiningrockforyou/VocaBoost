# vocaboost_ALL_fixes.patch — single consolidated patch (apply THIS one)

Supersedes the individual patches (blocker/quick/f01_definitive/dailysessionflow). They overlapped on `studyAlgorithm.js` and would double-apply; this is one coherent diff of ALL uncommitted fixes vs `origin/main` (6e9dd4a). Verified: esbuild JSX parse OK on all files; behavioral tests pass (F01 filter, NEEDS_CHECK bucket, retired-mastered helper); `git apply --check` clean against a pristine tree.

**Verification (corrected):** `git apply --check` and a full `git apply` both succeed cleanly against a pristine HEAD tree (exit 0, 6 files), and all 5 source files parse via esbuild after applying. (An earlier copy of this patch had a stray trailing `EOF` token from how the file was assembled — fixed; regenerate-and-verify done.)

5 source files + 1 new file. Apply:
```bash
git checkout main && git pull
git apply --check vocaboost_ALL_fixes.patch
git apply vocaboost_ALL_fixes.patch
git add -A && git commit -m "vocaBoost fixes: F01 test+study MASTERED filter, crash-recovery marker, retake UI/route, NEEDS_CHECK re-entry, SPA fallback, updateSessionState hardening"
```

## What's in it (file → findings addressed)

**src/utils/studyAlgorithm.js**
- `isRetiredMastered()` + `excludeRetiredMastered()` — shared returnAt-aware predicate (single source of truth for the F01 exclusion).
- `selectTestWords()` now filters retired-MASTERED via the helper → **THE F01 fix** (the real review-test chokepoint; all 11 test paths funnel through here). Verified by VERIFY + 3 path investigations.
- `selectReviewQueue()` adds a NEEDS_CHECK bucket (Codex #7) + the earlier MASTERED backstop.

**src/pages/DailySessionFlow.jsx**
- **Crash-recovery marker (HIGH, confirmed by RECOVER3):** `navigateToTest()` now writes the `lastPhase:'NEW_TEST'|'REVIEW_TEST'` recovery key before navigating. Previously never written (the phase-entry useEffect's guard is never met because the test is on a separate route), so a mid-test crash silently lost answers. RECOVER3 captured `lastPhase=NEW_STUDY` in the real flow and confirmed recovery works once the marker is correct.
- **Study-layer F01 (your "never show MASTERED flashcards, all modes" decision):** 6 `getSegmentWords→setReviewQueue` sites now wrapped in `excludeRetiredMastered` — complete-mode, mid-session recovery, same-day resume, no-new-words init, moveToReviewPhase, local crash recovery. MASTERED words no longer appear as review flashcards in any mode. (getSegmentWords itself untouched — still feeds PDF/debug unfiltered, intentional.)

**src/pages/MCQTest.jsx / TypedTest.jsx** (Codex #3)
- Retake nav route fixed (`/mcq-test`→`/mcqtest`, `/typed-test`→`/typedtest`) — was 404ing every retake.
- "Try Again" retake button wired into the failed-test screen (was "Go to Dashboard" only).

**src/services/sessionService.js**
- `saveSessionState` + `updateSessionState` strip undefined before Firestore write (B2 strand class + Codex #8). NOTE: `saveSessionState` strip is already in 6e9dd4a; the `updateSessionState` one (Codex #8) is new here. If applying onto 6e9dd4a the saveSessionState hunk is already present — git will note it; use --3way if needed.

**public/_redirects** (Codex #5) — `/*  /index.html  200` SPA fallback.

## MANDATORY post-deploy verification (don't mark fixed until these pass)
1. **F01:** re-run lazy pool-collapse VERIFY → expect 0 identity-verified MASTERED-in-review leaks (was 48). F01 was wrongly called fixed twice; this is the gate.
2. **Recovery:** re-run B29 checks → R1 asserts `lastPhase==='NEW_TEST'` present in real flow; R3 asserts crash→reopen routes to test + answers restored.
3. **Retake:** fail a new-word test → "Try Again" appears + retake route loads (no 404).
4. **NEEDS_CHECK:** returned words re-enter review after their 21-day return.
5. **SPA:** hard-refresh a deep link → no 404.

## NOT included — still for human review (Codex #1/#2/#4)
- #1 joinClass phantom enrollment (atomic enrollment + firestore.rules studentIds fix).
- #2 challenge submit/review atomicity + stale-day guard.
- #4 Dashboard.jsx conditional hooks refactor.
- npm audit (4 crit/12 high), broader lint cleanup.
- Empty `correctDefinition` batch-crash (data backfill + function skip-and-mark) — needs the live-exposure check first.
These are in CODEX_REVIEW.md / FIX_SPEC.md. The teacher-side audit (B28) covers #1/#2/#4 behaviorally.
