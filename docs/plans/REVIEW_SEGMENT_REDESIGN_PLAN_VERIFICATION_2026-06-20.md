# Verification Comments: REVIEW_SEGMENT_REDESIGN_PLAN.md

Date: 2026-06-20  
Reviewer: Codex  
Scope: Verification of methodology and implementation plan only. No code changes reviewed or applied.

## Overall Assessment

The redesign concept is sound: pinning a new `segment.wordIds` array at session initialization and resolving every later study/test/graduation operation from that pinned segment is the right migration seam. It preserves old in-flight sessions because old session objects only have `{ startIndex, endIndex }`, and it gives new sessions an authoritative immutable word set.

I would not implement the plan as written yet. The current draft misses several active segment consumers, understates that the current app already has mixed "fast queue" and "full segment" paths, and needs a sharper separation between:

- review study set
- review test pool
- today's newly failed new words
- completion summary counts
- dashboard/time-estimate/display counts

Those are not objections to the model. They are implementation-readiness issues.

## Findings

### High: Blast radius checklist is incomplete

The plan lists several core files, but a grep of segment materialization shows more call sites that must be routed through the new resolver. If any one of these keeps using `segment.startIndex/endIndex` for a new `wordIds` segment, that path will silently load the wrong contiguous position range.

Evidence:

- `src/services/studyService.js:798-803` loads review words for today's PDF by `config.segment.startIndex/endIndex`.
- `src/services/studyService.js:842-847` loads complete PDF segment words by `config.segment.startIndex/endIndex`.
- `src/services/studyService.js:877` graduates from `getSegmentWords(userId, listId, segment.startIndex, segment.endIndex)`.
- `src/services/studyService.js:1044-1049` debug data loads segment words by range.
- `src/services/studyService.js:1052-1057` debug data loads mastered words by range.
- `src/pages/DailySessionFlow.jsx:515-520` complete-mode switch loads range directly.
- `src/pages/DailySessionFlow.jsx:648-653` mid-session recovery loads range directly.
- `src/pages/DailySessionFlow.jsx:851-856` resume-to-review path loads range directly.
- `src/pages/DailySessionFlow.jsx:871-875` no-new-words review path loads range directly.
- `src/pages/DailySessionFlow.jsx:988-993` `moveToReviewPhase` loads range directly.
- `src/pages/DailySessionFlow.jsx:1557-1562` local recovery loads range directly.
- `src/pages/TypedTest.jsx:389-395` standalone review PATH C loads range directly.
- `src/pages/MCQTest.jsx:334-340` standalone review PATH C loads range directly.

Fix shape: add `resolveSegmentWords(userId, listId, segment)` and make it the only legal segment materializer. Then grep should have no direct `getSegmentWords(...segment.startIndex...)` call sites except inside the resolver or explicit old-shape test fixtures. Debug code also needs either a `resolveMasteredWordsForSegment` helper or a debug path that derives mastered words from resolved segment words.

### High: Current behavior is mixed, not uniformly "same set is studied and tested"

The plan says `loadReviewQueue` currently sets `reviewQueue = buildReviewQueue` and that same set is studied and passed to the test. That is true for some paths, but not all active paths.

Evidence:

- Fast/default helper path uses `buildReviewQueue(...)` and stores the result as `reviewQueue` at `src/pages/DailySessionFlow.jsx:490-500`.
- Fast-mode switch also uses `buildReviewQueue(...)` at `src/pages/DailySessionFlow.jsx:544-553`.
- But several resume/recovery/direct-review paths already load the full segment into `reviewQueue`: `src/pages/DailySessionFlow.jsx:648-653`, `src/pages/DailySessionFlow.jsx:851-864`, `src/pages/DailySessionFlow.jsx:871-875`, `src/pages/DailySessionFlow.jsx:988-997`, and `src/pages/DailySessionFlow.jsx:1557-1563`.
- Tests sample from whatever `reviewQueue` is at navigation time: `src/pages/DailySessionFlow.jsx:1174-1205`, with sampling performed by `buildTestConfig` at `src/utils/testConfig.js:42-45`.

Fix shape: update the plan to describe the current mixed state explicitly. The implementation should normalize all review-entry paths to a single named data model, preferably `reviewStudyWords` and `reviewTestPool`, rather than relying on the overloaded `reviewQueue` name.

### High: Today's failed new words need explicit semantics

The plan says the student studies the full segment plus today's new failed words, while the review test should be a random sample of the segment. If today's failed new words are simply folded into `reviewQueue`, they become part of the test pool too, because `navigateToTest` passes `reviewQueue` to `buildTestConfig`.

Evidence:

- `buildReviewQueue` injects today's failed new words before segment words at `src/services/studyService.js:607-626`.
- `selectReviewQueue` makes today's failed words priority 1 at `src/utils/studyAlgorithm.js:224-231`.
- `navigateToTest` uses `reviewQueue` as the review `wordPool` at `src/pages/DailySessionFlow.jsx:1174-1189`.
- `buildTestConfig` samples review test words from that `wordPool` at `src/utils/testConfig.js:42-45`.
- `completeSession` stores `wordsReviewed: wordsReviewed.length` from the same review queue at `src/pages/DailySessionFlow.jsx:1427-1455`.

Fix shape: keep failed-new carryover separate from the authoritative review segment unless the owner explicitly wants failed new words to be eligible for the review test and segment-wide graduation statistics. A safer shape is:

- `reviewStudyWords = resolvedSegmentWords + todaysNewFailedWords`
- `reviewTestPool = resolvedSegmentWords`
- `graduationSegment = pinned segment.wordIds`
- summary fields distinguish `reviewSegmentSize`, `reviewStudyCount`, and `reviewTestCount`

### High: `wordIds` storage is probably acceptable for the stated 296-word case, but the plan needs an explicit payload bound

The intended example, about 296 word IDs, is reasonable. But the plan introduces a persisted `wordIds` array without stating a maximum. The client also stores `sessionConfig` and the full `reviewQueue` in `sessionStorage`.

Evidence:

- `navigateToTest` writes `reviewQueue` and `sessionConfig` into `sessionStorage` at `src/pages/DailySessionFlow.jsx:1217-1228`.
- `reviewQueue` may become the full segment under the new model, and `sessionConfig.segment.wordIds` would duplicate the ID list.
- `getSegmentWords` currently fetches all words in the list and filters client-side at `src/services/studyService.js:292-306`, so a naive `getUnmasteredPoolIds` implementation could make large-list behavior worse.

Fix shape: set an explicit expected upper bound for `segment.wordIds`, document why it is below Firestore document and browser storage limits, and avoid storing duplicate large payloads where possible. `getSegmentWordsByIds` should fetch chunks and preserve input order. `getUnmasteredPoolIds` should use a bounded/range query or a cached ordered word list rather than loading an entire large list by default.

### Medium: `reviewCount` and `testSizeReview` need clearer definitions after redesign

The plan says "`reviewCount`/`testSizeReview` (~30) random sample", but the existing code treats them differently.

Evidence:

- `calculateReviewCount` returns `Math.min(50, reviewCap)` when there is no recent score data and can vary by score thereafter at `src/utils/studyAlgorithm.js:161-184`.
- `calculateReviewTestSize` returns 30-60 based on intervention at `src/utils/studyAlgorithm.js:196-205`.
- `initializeDailySession` returns both `reviewCount` and `testSizeReview` separately at `src/services/studyService.js:189-230`.

Fix shape: define which field controls study count, which controls test count, and which field powers dashboard "words to review today." Under the owner's model, `reviewCount` may become legacy/fast-mode only, while `reviewSegmentSize` and `testSizeReview` become the important counts.

### Medium: Dashboard, progress, summary, and time estimate counts will be wrong unless updated

Changing study from approximately 30-50 review words to a full segment changes visible counts and time estimates. The plan mentions `SessionSummaryCard` and `SegmentDebugPanel`, but more display surfaces depend on the old `reviewCount`/`reviewQueue` meaning.

Evidence:

- Session snapshot uses `cardsTotal: sessionConfig.newWordCount + (sessionConfig.reviewCount || 0)` at `src/pages/DailySessionFlow.jsx:254`.
- Review progress UI uses `reviewQueue.length` at `src/pages/DailySessionFlow.jsx:1759-1767` and `src/pages/DailySessionFlow.jsx:1782-1784`.
- Session summary displays `sessionConfig.reviewCount` as "Words Reviewed" at `src/components/SessionSummaryCard.jsx:49-54`.
- Session time calculator defaults review study count to `reviewTestSizeMax` unless given an override at `src/utils/sessionTimeCalculator.js:72-75`.
- Debug panel displays `Review Count` and `Review Queue` separately at `src/components/dev/SegmentDebugPanel.jsx:170-181`.

Fix shape: add or standardize fields such as `reviewSegmentSize`, `reviewStudyCount`, and `reviewTestSize`. Use those fields consistently in dashboard cards, progress labels, summary cards, debug output, and time estimates.

### Medium: `startIndex/endIndex` as display hints may mislead users

For a `wordIds` segment derived from the unmastered pool, `min(position)` and `max(position)` are not an authoritative contiguous range. Many mastered/resting words can exist inside that visual range.

Evidence:

- New tests currently compute `wordRangeStart` and `wordRangeEnd` from `sessionConfig.segment.startIndex/endIndex` at `src/pages/DailySessionFlow.jsx:1177-1183`.
- The plan proposes retaining `startIndex/endIndex` as display-only hints.

Fix shape: avoid showing "words X-Y" for `wordIds` segments unless the UI explicitly labels it as a broad list-position span. Prefer "N review words" or "Review segment N of M" for the new path.

### Medium: Edge cases around `studyDaysPerWeek` should be made explicit

The proposed helper preserves the old week-1 day-1 no-review behavior, but the pseudo-code uses `divisor = dpw - 1` in week 1. If `studyDaysPerWeek` can ever be 1, this needs a guard or an explicit product constraint.

Evidence:

- Existing `calculateSegment` uses `studyDaysPerWeek - 1` for week 1 at `src/utils/studyAlgorithm.js:136-138`.
- The plan's new pseudo-code repeats that structure.

Fix shape: explicitly define valid `studyDaysPerWeek` bounds and add tests for `1`, `2`, and normal `5`. If `1` is invalid, enforce it before session initialization. If valid, define review behavior for the only study day in week 1.

### Medium: Dropping projection is a real product behavior change and needs approval plus tests

The plan correctly flags this as an owner decision. It should be treated as a required decision before implementation, not a note.

Evidence:

- Current `calculateSegment` projects forward using `adjustedPace` and `daysRemaining` at `src/utils/studyAlgorithm.js:127-145`.
- New plan slices the current unmastered pool directly.

Fix shape: add a decision record: "projection is intentionally removed." Then add tests that demonstrate expected coverage when the unmastered pool grows mid-week.

### Medium: `getSegmentWordsByIds` must preserve order and handle chunking

The plan allows fetching specific word docs, but it should state order preservation and chunk behavior explicitly. Firestore batch-style `in` queries do not guarantee returning documents in input order and have query-size limits.

Evidence:

- Existing segment behavior returns words ordered by `position` at `src/services/studyService.js:292-306`.
- The new `computeUnmasteredSegmentIds` depends on position-ordered IDs.

Fix shape: fetch in chunks if using `in` queries or individual doc reads, then reorder results by the original `wordIds` array before returning. The returned shape must match `getSegmentWords`, including `studyState`.

### Low: The plan correctly identifies the irreversible-write invariant

The key invariant is accurate: graduation is pinned to `config.segment`, and standalone test pages do not graduate.

Evidence:

- `completeSession` calls `graduateSegmentWords(user.uid, listId, config.segment, reviewScore, reviewFailed)` at `src/pages/DailySessionFlow.jsx:1463-1470`.
- `graduateSegmentWords` currently uses the passed segment directly at `src/services/studyService.js:871-890`.
- Typed and MCQ PATH A consume `testConfig` directly at `src/pages/TypedTest.jsx:282-302` and `src/pages/MCQTest.jsx:240-251`.

Fix shape: keep this invariant as the central test assertion: study, test, and graduation must all point at the same pinned segment object for a given session.

## Recommended Plan Edits Before Implementation

1. Expand the blast radius checklist to include every direct `getSegmentWords(...segment.startIndex...)` and `getMasteredWordsInRange(...segment.startIndex...)` call site listed above.
2. Rename or split the overloaded `reviewQueue` concept in the plan. At minimum, define `reviewStudyWords`, `reviewTestPool`, `reviewSegmentSize`, and `reviewTestSize`.
3. Decide whether today's failed new words are part of the review test pool. My recommendation: study them, but do not include them in the segment test pool or segment graduation math unless explicitly intended.
4. Add a storage/performance constraint for `segment.wordIds`, including chunked fetch and order preservation requirements.
5. Replace display reliance on `startIndex/endIndex` for new `wordIds` segments.
6. Promote "drop projection" from a review flag to an explicit owner decision with tests.
7. Add tests for old-shape sessions and new-shape sessions across:
   - in-session normal flow
   - resume after passed new-word test
   - no-new-words review-only day
   - local/session recovery
   - typed PATH A and MCQ PATH A
   - standalone PATH C
   - PDF/debug helpers
   - graduation count from `wordIds.length`

## Bottom Line

The migration seam is good and should be preserved. The draft is not yet implementation-ready because it does not comprehensively cover all consumers and it leaves the failed-new-word/test-pool/count semantics ambiguous. Fixing those points in the plan should make the implementation much safer.
