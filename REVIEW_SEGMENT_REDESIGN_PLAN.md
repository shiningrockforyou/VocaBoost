# Review-Segment Engine Redesign — Implementation Plan (v4)

**Status:** Reviewed (3 internal agents + Codex ×2), decision-locked, NOT YET IMPLEMENTED. Nothing committed.
**Author:** Claude (orchestrator) · **Date:** 2026-06-20
**Companion:** `REVIEW_SEGMENT_REDESIGN_PLAN_VERIFICATION_2026-06-20.md` (Codex notes)

> v4 is a clean rewrite. It supersedes all prior versions; there are no "override" notes — every claim below is the verified current truth.

---

## 1. Goal — the intended model
The review segment must match the owner's defined spaced-repetition model:
1. **Segment = the UNMASTERED pool ÷ `studyDaysPerWeek`**, serving the `dayOfWeek`-th slice each study day. Retired-MASTERED words are excluded *before* slicing. (NOT "total words introduced.")
2. **The student studies the FULL segment** as flashcards (every word that can graduate is actually seen).
3. **A random ~`testSizeReview` (~30) sample of the segment is tested.**
4. **Graduate `floor(segmentSize × testScore)` of the segment** to `MASTERED` (21-day `returnAt`). Deliberately loose statistical inference (not Anki per-word rigor); valid *because* the whole segment was studied.

**Dashboard consequence (three distinct metrics under D3's cap):**
- `reviewBacklogTotal` = full unmastered pool (the "words remaining" backlog).
- `uncappedSegmentSize` = **`sliceIds.length`** — the actual slice the algorithm produced. (≈ `reviewBacklogTotal ÷ studyDaysPerWeek` for a steady mid-week pool, but exact only as `sliceIds.length`: week 1 divides by `dpw-1`, and the final slice can be shorter.)
- **`reviewSegmentSize` = `min(uncappedSegmentSize, REVIEW_STUDY_CAP)`** = the actual student-facing "words to review today" (capped effective segment).

All three shrink as mastery grows; the dashboard headline is `reviewSegmentSize`, with `reviewBacklogTotal` available as the larger "remaining" figure.

**Migration constraint (owner):** any session already in flight is UNAFFECTED and runs to completion on the OLD logic; the new logic applies on the NEXT session. Prior skew self-heals. In-flight results are accepted as-is.

---

## 2. Decisions — LOCKED (2026-06-20)
| # | Decision | Detail |
|---|---|---|
| D1 | **Failed-new-words = STUDY-ONLY** | `reviewStudyWords = segment + todaysNewFailed`; **test pool & graduation = segment only.** |
| D2 | **Projection = DROPPED** | Slice the current unmastered pool directly (§7 bias analysis = safe). |
| D3 | **Fast mode = DELETED** | Full-segment study only. A **per-day cap (proposed 60)** is applied **at segment computation**, so `segment.wordIds` IS the capped set — study, test, AND graduation all read that one pinned set (invariant preserved: everything graduated was studied). Overflow stays unmastered → reappears in future daily slices. Total backlog is a separate dashboard field (`reviewBacklogTotal`). *Cap value pending final owner confirm.* |
| D4 | **`studyDaysPerWeek` min = 2** | Enforce before session init (kills week-1 divide-by-zero). |

---

## 3. How the engine works TODAY (verified ground truth)
**The segment is position-based.** `calculateSegment` (`studyAlgorithm.js:118-153`) returns a contiguous position range `{startIndex,endIndex}`, sized off `totalWordsIntroduced` (`projectedTotal ÷ divisor` ≈ 496). It is computed once in `initializeDailySession` (`studyService.js:181`) and pinned into the returned config.

**Word resolution is by position.** `getSegmentWords(userId,listId,startIndex,endIndex)` (`studyService.js:292-322`) returns list words whose `position ∈ [startIndex,endIndex]`, merged with study states.

**Review STUDY is ALREADY the full segment.** Every active review-study entry point loads the full segment via `getSegmentWords` (+ `excludeRetiredMastered`): init resume `DailySessionFlow.jsx:851,871`, mid-session recovery `:648`, `moveToReviewPhase` `:988`, local recovery `:1556`. `loadReviewQueue` (`:487`) is **dead code (zero callers)**. The `reviewMode='fast'` toggle (`handleSwitchToFastMode` `:544` → `buildReviewQueue`) is an **opt-in shrink** to ~`reviewCount`, not the default.

**Review TEST samples the study set.** `navigateToTest` (`:1174`) passes `wordPool = reviewQueue` (the full segment) + `segment` via nav-state `testConfig`; `buildTestConfig` (`testConfig.js:43`) samples it to `testSizeReview` via `selectTestWords` (random, MASTERED-excluded). Test pages PATH A consume `testConfig.wordsToTest` directly (`TypedTest.jsx:282`, `MCQTest.jsx:240`); PATH C (standalone, no testConfig) recomputes via `initializeDailySession`+`getSegmentWords`.

**THE REAL GRADUATION PATH (critical).** Primary-flow graduation does NOT run in DailySessionFlow's in-memory handler. `TypedTest.jsx:854` / `MCQTest.jsx:721` call **`completeSessionFromTest` (`studyService.js:1090`)**, which reads `segment` from **`sessionStorage['dailySessionState']`** (`:1111`, written by `navigateToTest` `:1218`), then calls `recordSessionCompletion` (`:1217`) and **`graduateSegmentWords` (`:1222`)**. `DailySessionFlow.jsx:1463` graduation only fires for the all-mastered-modal / full-simulation paths. `graduateSegmentWords` (`:871`) count = `floor((endIndex-startIndex+1) × score)` capped at eligible — the span includes mastered slots → **inflated** (this is the bug we fix).

**Scoring already decouples test-set from graduation-set.** `processTestResults` (`:335-371`) computes `score`/`failed` over the ~30 sample only; graduation iterates the whole segment. So a smaller test sample + whole-segment graduation is already how it works.

**21-day returns.** `returnMasteredWords` (`:936`) flips expired MASTERED→NEEDS_CHECK. Today it's called by the *caller* (`DailySessionFlow.jsx:604`) before `initializeDailySession` — harmless now because `calculateSegment` reads no study state, but **see §5/D**.

**Segment is NOT in Firestore `session_states`** (`sessionService.js` stores only scores/phase). Its only cross-navigation persistence is the `sessionStorage` JSON blob. Firestore stores `segmentStartIndex/EndIndex` only as flattened **write-only audit scalars** on `attempts` (`db.js:1222,1386`) and `recentSessions` (`createSessionSummary`, `studyService.js:430-431`; typed `studyTypes.js:80-81`) — never read back to resolve words.

---

## 4. Migration seam — additive `wordIds`, pinned, sessionStorage-safe
**Extend the segment shape; never replace it.**
```
OLD session (in-flight, persisted): segment = { startIndex, endIndex }
NEW session (next init):            segment = { startIndex, endIndex, wordIds:[…] }   // wordIds authoritative; indices = display hints only
```
Single materializer — **every word-resolution branches on `wordIds`:**
```
resolveSegmentWords(userId,listId,segment):
  segment?.wordIds?.length ? getSegmentWordsByIds(userId,listId,segment.wordIds)        // NEW path
                           : getSegmentWords(userId,listId,segment.startIndex,segment.endIndex)  // OLD path (untouched)
```
**Why in-flight is safe:** old persisted segments have no `wordIds` → every consumer falls to the old position-range path → byte-for-byte unchanged. New sessions get `wordIds` → new behavior. We never read a new field off an old doc. A `wordIds:string[]` array survives the `sessionStorage` JSON round-trip, so the real graduation path (`completeSessionFromTest`) carries it correctly. **No Firestore migration; no version flag.**

**Resume continuity (NEW-session only):** every mount recomputes `initializeDailySession` (`DailySessionFlow.jsx:607`) rather than rehydrating; the crash-recovery write (`:740`) persists `reviewQueue:[]` + recomputed `config`. For a NEW session closed & reopened mid-review, a recompute would re-slice `wordIds` off the now-current pool → study/grad desync. **Fix:** on resume into a REVIEW phase, **rehydrate `sessionConfig.segment` (incl. `wordIds`) from `sessionStorage`** instead of recomputing; only compute fresh when no in-flight segment exists. (Old sessions unaffected — no `wordIds` to rehydrate.)

---

## 5. Design — exact changes

### Named data model (replaces the overloaded `reviewQueue`)
- **`segment.wordIds`** = the day's **pinned effective segment, already D3-capped at computation time.** This single set is the source for study, test, AND graduation → the invariant "everything that graduates was studied" holds by construction.
- `reviewSegmentSize` = `segment.wordIds.length` (capped; the headline "words to review today")
- `reviewBacklogTotal` = full unmastered-pool size (uncapped) — separate dashboard "words remaining" field. Overflow beyond the cap is NOT a special queue; it stays unmastered and reappears in future daily slices.
- `reviewStudyWords` = `resolveSegmentWords(segment)` **+ today's new-FAILED** (D1: new-FAILED are study-only, added on top of the cap, typically few; they are NOT in the test pool or graduation set, so they don't affect the invariant) — the flashcards
- `reviewTestPool` = `resolveSegmentWords(segment)` **only** (D1) — sampled to `testSizeReview`
- **graduation** iterates `segment.wordIds` (the same capped pinned set)
- `reviewTestSize` = `calculateReviewTestSize(...)` (~30–60)

### New — `studyAlgorithm.js`
`computeUnmasteredSegmentIds(orderedUnmasteredWordIds, currentStudyDay, studyDaysPerWeek) → string[]|null`
```
week = ceil(day/dpw); dow = ((day-1)%dpw)+1
if (week===1 && dow===1) return null
divisor = (week===1) ? dpw-1 : dpw            // D4 guarantees dpw>=2 → divisor>=1
pos     = (week===1) ? dow-2 : dow-1
pool = orderedUnmasteredWordIds                // MASTERED-excluded, position-ordered
if (!pool.length) return null
size = ceil(pool.length / divisor)
slice = pool.slice(pos*size, pos*size+size)
return slice.length ? slice : null
```
(Week-1/week-2 offsets mirror `calculateSegment` exactly — agent-verified, no off-by-one. Keep `calculateSegment` for old-shape fallback until retired.)

### New — `studyService.js`
- `getUnmasteredPoolIds(userId,listId,totalWordsIntroduced) → string[]` (position-ordered): resolve introduced words + states, drop retired-MASTERED via `excludeRetiredMastered` (returnAt-aware). **Must not naively reload the whole list every call** — reuse a bounded/cached ordered word list (§6 perf).
- `getSegmentWordsByIds(userId,listId,wordIds) → [{…word, studyState}]`: **chunk** `in`-queries (Firestore limit) and **re-order to match input `wordIds`** (Firestore `in` does not preserve order); return shape identical to `getSegmentWords`.
- `resolveSegmentWords(userId,listId,segment)`: the §4 branch. The ONLY legal segment materializer.

### Changed — `studyService.js`
- `initializeDailySession`: call `returnMasteredWords` **inside** (before pool read) so all 5 callers get a fresh pool; compute `unmasteredIds = getUnmasteredPoolIds(...)`, `sliceIds = computeUnmasteredSegmentIds(...)`, **apply the D3 cap → `cappedIds = REVIEW_STUDY_CAP ? sliceIds.slice(0, REVIEW_STUDY_CAP) : sliceIds`**, `segment = cappedIds.length ? {wordIds:cappedIds, startIndex:minPos, endIndex:maxPos} : null`. Also return `reviewBacklogTotal = unmasteredIds.length`. Remove the now-redundant `DailySessionFlow.jsx:604` call (idempotent if left).
- `buildReviewQueue`: resolve via `resolveSegmentWords`; standardize MASTERED filter on `excludeRetiredMastered`.
- `graduateSegmentWords`: resolve via `resolveSegmentWords`; `segmentSize = segment.wordIds?.length ?? (endIndex-startIndex+1)`; add defensive `excludeRetiredMastered` on the new path.
- `completeSessionFromTest`: resolve segment via `resolveSegmentWords`; size from `wordIds.length`. (This is the real graduation path — must be in scope.)
- PDF batches (`getTodaysBatchForPDF :798`, `getCompleteBatchForPDF :842`) and `getDebugSessionData :1044` (+ `getMasteredWordsInRange`): route through `resolveSegmentWords`/tolerate `wordIds`.

### Changed — `DailySessionFlow.jsx`
- Delete dead `loadReviewQueue` (`:487`).
- Route review-study loads (`:515,648,851,871,988,1556`) through `resolveSegmentWords`; build `reviewStudyWords = segment + newWordFailed` consistently (fix init/recovery paths that currently DROP new-FAILED); apply the D3 per-day cap.
- **Delete fast mode entirely — every entry point** (not just the handler): state `reviewMode`/`showFastModeModal`/`showCompleteModeModal` (`:137-139`), handlers `handleSwitchToFastMode :536` + `handleSwitchToCompleteMode :507`, the toggle wiring `:1734-1739`, the two mode modals `:1927-1941`. In **`SessionMenu.jsx`**: the `reviewMode` prop (`:36`) + the `showReviewModeToggle` render block (`:174-182`). Full-segment (capped) is the only mode.
- Fix count surfaces to the named model: `cardsTotal :254`, progress UI `:1759,:1782`, Complete-Mode modal `wordCount :1929` (use `reviewSegmentSize`, not `endIndex-startIndex+1`).
- **Resume rehydrate** (`:607` mount + crash-recovery `:740`): rehydrate `segment` (incl. `wordIds`) from sessionStorage for in-flight NEW sessions instead of recomputing.

### Changed — test pages & display
- `TypedTest.jsx`/`MCQTest.jsx` PATH C: route the recompute's `getSegmentWords` through `resolveSegmentWords`.
- `SegmentDebugPanel.jsx:150-181`: show `reviewSegmentSize` (= `wordIds.length`), not the position span.
- `SessionSummaryCard.jsx:49`: it reads no segment indices, but it **displays `reviewCount` as "Words Reviewed"** — point it at the new count field (NOT "no change").
- `sessionTimeCalculator.js:72-75`: defaults review-study count to `reviewTestSizeMax`; feed it `reviewSegmentSize` (capped).

---

## 6. Complete blast radius (single authoritative table)
Class: **FLOW** = resolves words for study/test/grad → must use `resolveSegmentWords`. **COUNT** = display count → use `reviewSegmentSize`. **RECORD** = write-only audit scalar → leave as min/max position hints (acceptable; analytics show a broad span, not the sparse set).

| Site | Class | Action |
|---|---|---|
| `studyService.js:1090` `completeSessionFromTest` (grad `:1222`, reads sessionStorage `:1111`) | FLOW (grad) | resolver + `wordIds.length` |
| `studyService.js:871` `graduateSegmentWords` | FLOW (write) | resolver + size + defensive exclude |
| `studyService.js:578` `buildReviewQueue` | FLOW | resolver + standardize filter |
| `studyService.js:798` PDF today / `:842` PDF complete | FLOW (PDF) | resolver |
| `studyService.js:1044` `getDebugSessionData` / `getMasteredWordsInRange` | COUNT/display | tolerate `wordIds` |
| `DailySessionFlow.jsx:515,648,851,871,988,1556` review-study loads | FLOW | resolver + new-FAILED fold + D3 cap |
| `DailySessionFlow.jsx:740` crash-recovery write / `:607` mount recompute | FLOW (resume) | rehydrate `segment` from sessionStorage |
| `DailySessionFlow.jsx:254,1759,1782,1929` counts | COUNT | `reviewSegmentSize` |
| `TypedTest.jsx:389` / `MCQTest.jsx:334` PATH C | FLOW (standalone) | resolver |
| `SegmentDebugPanel.jsx:150-181` | COUNT | `reviewSegmentSize` |
| `SessionSummaryCard.jsx:49` | COUNT | new count field |
| `DailySessionFlow.jsx:137-139,507,536,1734-1739,1927-1941` + `SessionMenu.jsx:36,174-182` | UI removal | delete fast-mode toggle entirely (D3) |
| `sessionTimeCalculator.js:72-75` | COUNT (time) | `reviewSegmentSize` |
| `studyService.js:430-431` `createSessionSummary`→`recentSessions`; `studyTypes.js:80-81` | RECORD | min/max hints OK; **listed explicitly** |
| `db.js:1222,1386` attempt `segmentStartIndex/EndIndex` | RECORD | min/max hints OK |

**Acceptance gate:** after implementation, do a **multiline-aware** sweep — `rg -U 'getSegmentWords\('`, `rg -U 'getMasteredWordsInRange\('`, and `rg -U 'segment\.(startIndex|endIndex)'` (or an AST review) — NOT a single-line pattern, since most call sites span multiple lines. Every `getSegmentWords(`/`getMasteredWordsInRange(` that **resolves words** must sit inside `resolveSegmentWords` (or an explicit old-shape test fixture); every `segment.startIndex/endIndex` read must be display- or record-only, never word resolution.

**Performance / payload:** `segment.wordIds` is the unmastered slice (live data §8: ~10–110 ids; bound well under Firestore doc & browser-storage limits). Store IDs once (don't duplicate the full `reviewQueue` *and* `wordIds` in sessionStorage). `getUnmasteredPoolIds` must use a bounded query / cached ordered list rather than re-fetching the entire list each call (`getSegmentWords` currently fetches all list words then filters — `:292-306`).

---

## 7. Edge cases & bias
- **Week-1 Day-1** → `null`; **week-1 divisor = dpw-1** (D4 ⇒ ≥1). Add tests for dpw=2 and 5.
- **Empty / short pool** (all mastered, or pool < divisor) → some days `null`/short slice; `reviewCount` already guards `segment ? … : 0`.
- **21-day returns ordering** → `returnMasteredWords` moved inside `initializeDailySession` before pool read (covers PDF/debug/standalone callers).
- **`getSegmentWordsByIds`** → order-preserving + chunked (§5).
- **Display hint** → never render "words X–Y" for a `wordIds` segment (min/max ≠ contiguous); show "N review words" / "segment N of M".
- **Drop-projection bias (D2) — safe:** daily re-slicing yields only a mild, bounded, self-correcting bias: (a) newest words always fall in the last slice (reviewed late-week — fine); (b) mid-week mastery shifts ranks so boundary words can skip/re-cover within a week. Not pathological because graduation removes RANDOM words (no position-band starvation), skipped words stay in-pool until mastered (covered later weeks), and magnitude is tiny at real backlogs (median ~25/day). Optional future refinement: order pool by staleness (least-recently-reviewed first) → better SR behavior; deferred (deviates from literal definition).

---

## 8. Live 26SM backlog data (2026-06-20, 40-student sample — sizing reality check)
Students are early (median Day 9, TWI 400–800); engine already masters ~80–90% of seen words.
- **BACKLOG (unmastered):** min 50 / median 124 / max 537.
- **SEG/DAY (≈ full-segment study load ≈ backlog ÷ dpw, pre-cap approximation):** **min 10 / median 25 / max 108.** (Exact daily load = `sliceIds.length` then capped; this sample uses the ÷dpw approximation for sizing.)
- ⇒ Median student's full-segment study ≈ 25 ≈ today's ~30 test (deleting fast mode is a no-op for them). The ~10–15% behind (70–108/day) are why D3 adds the per-day cap.

---

## 9. Validation (sandbox `ta@`/25WT, before ANY deploy)
1. esbuild-syntax-validate every touched file.
2. Seed/inspect a mid-list account (mixed MASTERED / unmastered).
3. Full cycle: new words → **full-segment** review study (capped) → ~30 random test → graduate `floor(reviewSegmentSize × score)` → **day advances**.
4. Old-shape segment (no `wordIds`) still runs the old path end-to-end (back-compat).
5. Counts are distinct and correct: `reviewBacklogTotal = unmasteredIds.length`; `uncappedSegmentSize = sliceIds.length` (the actual slice — week 1 uses `dpw-1`, final slice may be shorter); **`reviewSegmentSize = min(uncappedSegmentSize, REVIEW_STUDY_CAP)`** = student-facing "words to review today". Verify a capped (heavy-backlog) student, an uncapped (median) student, AND a week-1 / final-slice case.
6. No stranded day; no MASTERED leak into review.

**Test matrix (old-shape AND new-shape):** in-session normal · resume after passed new-word test · no-new-words review-only day · local/session crash recovery (`:740`) · Typed PATH A · MCQ PATH A · standalone PATH C · PDF/debug helpers · **`completeSessionFromTest` graduation via sessionStorage** · close-&-reopen mid-review (study↔grad consistency) · graduation count from `wordIds.length` · dpw=2.

---

## 10. Out of scope
- Dashboard implementation (separate task; consumes "words to review today = `reviewSegmentSize`").
- Retroactive fix of historical mastery skew (self-heals per owner).
- Committing / deploying (owner-gated).

---

## Appendix A — review history
- 3 internal agents (migration-safety / engine-correctness / study-UX) + Codex ×2.
- Biggest catch: the real graduation path is `TypedTest/MCQTest → completeSessionFromTest → graduateSegmentWords` reading `segment` from sessionStorage — NOT a DailySessionFlow-only model. v4 is built on that corrected understanding.
