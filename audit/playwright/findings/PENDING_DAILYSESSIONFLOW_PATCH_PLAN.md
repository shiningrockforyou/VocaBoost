# Pending bundled patch — DailySessionFlow.jsx (+ maybe test components)

**Why bundled:** both pending fixes edit `src/pages/DailySessionFlow.jsx`. Doing them as separate patches would overlap/conflict. Apply as ONE patch (`vocaboost_dailysessionflow_bundle.patch`) once the recovery mechanism is confirmed by RECOVER3.

Status: **DONE (2026-05-31).** Both parts executed + verified + consolidated into `vocaboost_ALL_fixes.patch`. RECOVER3 confirmed Part B (captured lastPhase=NEW_STUDY in real flow → recovery never fired; fix = write marker in navigateToTest, option A). See APPENDED RESULTS at bottom.

---

## PART A — Study-layer: hide retired MASTERED words from review FLASHCARDS (user decision: "never show them, all modes incl. Complete Mode")

**Goal:** no MASTERED-with-future-returnAt word appears as a review study flashcard, in ANY mode. (The TEST leak is already fixed in vocaboost_f01_definitive.patch via selectTestWords; this is the study/flashcard layer.)

**Approach:** add one shared filter helper and wrap each `getSegmentWords(...) -> setReviewQueue(...)` source. MAP-LIFECYCLE confirmed `returnMasteredWords` runs at DailySessionFlow:579 BEFORE all these reads, so a simple `status !== 'MASTERED'` would be safe here — BUT use the SAME returnAt-aware predicate as selectTestWords for consistency and defense in depth.

**Helper (add to src/utils/studyAlgorithm.js, export it; reuse the predicate from selectTestWords):**
```js
// true if the word is a still-retired MASTERED word (should be hidden from review)
export function isRetiredMastered(w, nowMs = Date.now()) {
  const state = w?.studyState || w;
  if (state?.status !== 'MASTERED') return false;
  const returnAtMs = state.returnAt?.toMillis?.() ?? state.returnAt ?? null;
  return !!(returnAtMs && returnAtMs > nowMs);
}
export function excludeRetiredMastered(words) {
  const now = Date.now();
  return (words || []).filter(w => !isRetiredMastered(w, now));
}
```
(Refactor selectTestWords to use isRetiredMastered so there is ONE source of truth.)

**Sites to wrap in DailySessionFlow.jsx** (filter the array before setReviewQueue/setReviewQueueCurrent). All confirmed via grep on 2026-05-31:
1. Line ~490–497 `handleSwitchToCompleteMode`: `allWords` from getSegmentWords → wrap: `const filtered = excludeRetiredMastered(allWords); setReviewQueue(filtered); setReviewQueueCurrent(filtered)`. (This is the Complete-Mode site — user explicitly wants it filtered too.)
2. Line ~622–630 mid-session recovery REVIEW_STUDY: `segmentWords` → wrap before setReviewQueue/Current.
3. Line ~806–813 same-day resume REVIEW_STUDY/TEST: `allWords` → wrap.
4. Line ~820–827 no-new-words segment-only init: `allWords` → wrap.
5. Line ~937–968 `moveToReviewPhase` (normal path): wrap the final `allWords` (which is `[...failedWords, ...segmentWords]`). NOTE: failed new words have `studyState:{status:'failed'}` (lowercase) → not MASTERED → kept. Good. Wrap right before the empty-check at 961 so the empty-segment modal still fires correctly on the FILTERED list.
6. Line ~1442–1453 local crash recovery restore: `allWords` from getSegmentWords → wrap BEFORE the `queueWordIds`/`restoredQueue` filter (so restored set is also free of mastered).

**Do NOT touch:**
- Line 473–474 loadReviewQueue (dead code, already uses buildReviewQueue=filtered).
- Line 526–527 fast mode (buildReviewQueue=filtered already).
- Lines 1171/1185/1220 (restore reviewQueue from sessionStorage — that stored queue was built by a now-filtered source; but ALSO wrap defensively if cheap: `setReviewQueue(excludeRetiredMastered(state.reviewQueue))` — low risk, decide at apply time).
- studyService.js getSegmentWords itself — shared with PDF export / debug / getTodaysBatch; do NOT filter at the source (would change PDF/debug semantics). Filter at the CONSUMER (DailySessionFlow) only.

**Verify Part A:** esbuild parse; behavioral test of excludeRetiredMastered (retired→out, overdue/PASSED/FAILED/NEEDS_CHECK/new→in); confirm complete-mode no longer shows mastered (the empty-segment modal still works on filtered list).

---

## PART B — Recovery-trigger fix (write `lastPhase: NEW_TEST` so crash recovery actually fires)

**BLOCKED ON RECOVER3** — it confirms whether the marker is truly never written (suspected) and which fix site is correct. See findings_recovery_trigger.md.

**If confirmed (lastPhase stays NEW_STUDY in real flow):** the recovery trigger marker is never written because `setPhase(NEW_WORD_TEST)` is never called (test on separate route). Fix options (pick after RECOVER3):
- **(A) In `navigateToTest()` (DailySessionFlow ~1088), before navigate():** write the session-recovery localStorage key with `lastPhase: testPhase==='new'?'NEW_TEST':'REVIEW_TEST'`, testType, wordPool (the wordPool the student will test on). Use getLocalSessionId(user.uid, classId, listId, sessionConfig.dayNumber, phaseType) + saveLocalSessionState (already imported at lines 58–59). This mirrors what the dead useEffect@382 intended, at the place the student actually commits to the test.
- **(B) On test-component mount (MCQTest/TypedTest):** write the marker when the test screen actually opens (most robust single source of truth). Would edit the test components, not DailySessionFlow — in that case it is NOT part of this DSF bundle; deliver separately.
- Then DELETE the dead useEffect@382 (or keep harmless). Note its sibling at line ~356 writes NEW_STUDY/REVIEW_STUDY (study-phase recovery) and DOES fire — leave that.

**Verify Part B:** re-run B29 checks R1 (lastPhase===NEW_TEST asserted) + R3 (crash→reopen routes to test + answers restored). Not "fixed" until R1+R3 pass.

---

## Assembly / delivery
1. Apply Part A edits (DailySessionFlow.jsx + studyAlgorithm.js helper). Note: studyAlgorithm.js already has uncommitted edits (NEEDS_CHECK bucket + selectTestWords F01 filter) — the helper refactor stacks on those.
2. After RECOVER3 → apply Part B (likely DailySessionFlow.jsx; or test components if option B).
3. Generate ONE patch for DailySessionFlow.jsx + studyAlgorithm.js (+ test components if B). esbuild-parse all; git apply --check vs HEAD; behavioral tests.
4. Deliver `vocaboost_dailysessionflow_bundle.patch` + README. User deploys.
5. Post-deploy verify: B29 recovery checks + (already planned) lazy pool-collapse VERIFY for F01.

## Patch inventory so far (for the dev, to avoid double-apply on shared files)
- vocaboost_blocker_fixes.patch — B2 (sessionService, studyService) + F01 selectReviewQueue backstop (studyAlgorithm). [delivered; already on origin/main as 6e9dd4a]
- vocaboost_quick_fixes.patch — Codex #3/#5/#7/#8 (MCQTest, TypedTest, sessionService, studyAlgorithm NEEDS_CHECK, public/_redirects). [delivered, uncommitted]
- vocaboost_f01_definitive.patch — selectTestWords F01 filter + NEEDS_CHECK bucket (studyAlgorithm). [delivered, uncommitted] — OVERLAPS quick_fixes on studyAlgorithm.
- vocaboost_dailysessionflow_bundle.patch — THIS plan (Part A + B). [pending]
**studyAlgorithm.js is touched by quick_fixes, f01_definitive, AND Part A → consolidate into ONE studyAlgorithm diff at final assembly so the dev applies it once.**

---

## APPENDED RESULTS (2026-05-31) — executed

**RECOVER3 verdict (Part B confirmation):** Real-flow crash recovery FAILS. Clicked through all 80 cards via real UI → test → typed 3 answers (present in localStorage) → crash (persistent context, no beforeunload) → reopen → NO recovery, fresh study screen. **Captured `lastPhase = NEW_STUDY`** (should be NEW_TEST). Scenario B proved the recovery infra works when the marker IS correct. Graceful close correctly suppresses (intended). Severity: HIGH confirmed. Fix site = navigateToTest (option A).

**Part A executed:** added `isRetiredMastered`/`excludeRetiredMastered` to studyAlgorithm.js; refactored selectTestWords to use them; wrapped 6 setReviewQueue sites in DailySessionFlow (handleSwitchToCompleteMode, mid-session recovery, same-day resume, no-new-words init, moveToReviewPhase [before empty-check], local crash recovery). Complete-mode filtered per user decision.

**Part B executed:** navigateToTest now writes the recovery marker (lastPhase NEW_TEST/REVIEW_TEST + testType + wordPool + sessionContext) via saveLocalSessionState before navigate(). Left the dead useEffect@382 in place (harmless; the study-phase sibling@356 still does its job).

**Verification:** esbuild parse OK (studyAlgorithm + DailySessionFlow); behavioral test PASS (selectTestWords & excludeRetiredMastered keep b,d,e,f,g = overdue-MASTERED/PASSED/FAILED/new/NEEDS_CHECK, drop retired-MASTERED a,c); 7 excludeRetiredMastered uses (1 import+6 sites), 1 recovery marker, 2 helper exports.

**Delivery:** consolidated into `vocaboost_ALL_fixes.patch` (+ README) — supersedes the individual patches (resolves the studyAlgorithm triple-overlap). git apply --check CLEAN against pristine tree.

**Post-deploy verify owed:** lazy pool-collapse VERIFY (F01=0 leaks) + B29 recovery checks (R1 lastPhase=NEW_TEST, R3 crash→restore).
