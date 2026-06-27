# PLAN — Practice Mode v2 (dedicated, real) — DRAFT for 3-agent + Codex review

Status: DRAFT. Replaces the fake "Practice again" with a real standalone Practice Mode.
Owner: (feature) · Flag: `PRACTICE_MODE_ENABLED` (new) · Scope: student-facing, no gradebook impact.

## 0. Locked decisions (David, 2026-06-24)
- **Isolation = FULLY ISOLATED (v1).** Practice never writes study_states / mastery / review-queue /
  class_progress / gradebook. Only `practice_sessions` records it. (§3.6)
- **Subsume BlindSpotCheck.** Fold blind-spots in as a Practice-Mode auto preset; **retire the standalone
  `/blindspots` page**. Under ISO it becomes a pure self-check (see §3.6 consequence note). (§3.7)
- **MCQ only for v1, but the quiz layer is PLUGGABLE** — practice config carries `quizType: 'mcq' | 'typed'`
  (default `'mcq'`); only MCQ is wired now, typed can be enabled later by settings without re-architecting. (§3.4)

## 0.1 Corrections from 3-agent audit (must-fix before implement)
- **ISO BLOCKER — `getBlindSpotPool`/`getBlindSpotCount` WRITE `class_progress` when passed a `classId`**
  (studyService.js:832-845, `if(classId) updateDoc(blindSpotCount…)`). The route is `/practice/:classId/:listId`,
  so the natural call leaks. **Constraint: call `getBlindSpotPool(uid, listId)` with classId OMITTED/null** — the
  write is guarded by `if(classId)`. This is the one real coupling that breaks ISO; lock it.
- **Review-queue auto-set is NOT `getUnmasteredPool + selectReviewQueue`** — `getUnmasteredPool` returns bare
  `{id,position}` (no status/definition); `selectReviewQueue` needs `status`/`lastQueuedAt`/`queueAppearances`
  and the quiz needs `definition`. The hydration in between is what **`buildReviewQueue` (studyService.js:708)**
  does. Use `buildReviewQueue` (or replicate its `resolveSegmentWords→excludeRetiredMastered→map` step).
- **Day→position math `(N-1)*P..N*P-1` is an APPROXIMATION, not the engine's invariant.** Real new-word indexing
  uses persisted `totalWordsIntroduced` + intervention-adjusted allocation (studyService.js:181/252), not flat
  pace. Fine as a "practice by days" UI convenience; DO NOT state as ground truth. Also: **pace lives on the
  class `assignment`, not `class_progress`** — suggest-next-range/day-mode must read `assignment.pace`.
- **No reusable MCQ-option helper** — `generateQuestions` is inline in MCQTest (and a separate copy in
  BlindSpotCheck). EXTRACT a pure `buildMcqOptions(word, pool, optionsCount)` (trivial; uses shared
  `shuffleArray`). Don't claim "reuse MCQTest's helper."
- **Rules premise WRONG (see rewritten §3.8).** firestore.rules:45-48 already has a `users/{uid}/{subcollection}`
  wildcard granting **owner-OR-any-teacher** read/write. So owner access to `practice_sessions` exists with
  zero changes; "no teacher read" CANNOT be achieved by ADDING a block (rules union = OR) — it requires
  NARROWING the wildcard. Decision needed.
- **`PrivateRoute` is auth-only, NOT student-only** (no role gate). `/session`,`/mcqtest` are the same. Accept
  auth-only for v1 (teachers practicing is harmless); drop the "student-only" wording.
- **Second fake re-run affordance:** the re-entry modal "Study Again" (Dashboard.jsx:2041-2053, nav:2046)
  re-runs the daily flow identically to the CTA we're removing. DECISION: repoint it to /practice too, or leave
  (it's a deliberate post-completion choice). Don't leave it un-decided.
- **/blindspots retire is small:** only ONE live inbound link (Dashboard.jsx:1839 `<Link to="/blindspots/…">`);
  `BlindSpotsCard.jsx` is **orphan dead code** (delete it). Recommend **redirect** `/blindspots → /practice`.
- **Record shape:** add `quizType`, store `position`(+word) in `wordResults` (self-contained history panel),
  add `schemaVersion`. (§3.5)
- **Typed "config-only" caveat:** a fully-ISO typed practice still needs a **separate client-side grading
  path** — TypedTest's real grading is the server/AI route (`SERVER_ATTEMPT_WRITE`), not a flag flip. So
  `quizType:'typed'` is "design the seam now, but it's more than a config flip later." (§3.4)
- Minor: test pages are in **src/pages/** (not components); `getSegmentWords` end-INCLUSIVE vs `getNewWords`
  end-EXCLUSIVE — don't mix.

## 1. Spec (from David)
Remove the throwaway "Practice again"; build a **dedicated, real Practice Mode** — a standalone
session (NOT tied to the daily new-words flow) with:
1. **Flashcards** (study)
2. **MCQ quiz**
3. **Practice-only records** kept — separate from the gradebook (student-facing only, for now)
4. **Range selection** — by **words** or **days**; after a session **suggest the next range** based on
   the previous one; option to **auto-build** the set from the student's **blind spots / review-queue**.

## 2. Current state (grounded)
- **The current "Practice again" is fake.** Dashboard hero CTA (Dashboard.jsx:1572) just navigates to
  `/session/{classId}/{listId}` and re-runs the whole DAILY flow; `practiceMode` is **never passed**, so
  it can even write to the gradebook. Misleading — remove it.
- **`practiceMode` prop exists** in TypedTest.jsx:54/119 and MCQTest.jsx:52/105 — but it currently
  **skips ALL writes** (`if (!isPracticeMode) {...}` TypedTest:732 / MCQTest:532) and shows a banner.
  For v2 we need practice to **write to a practice store**, not skip — so this needs reworking.
- **`BlindSpotCheck.jsx` already exists** (`/blindspots/:classId/:listId`, App.jsx:92): an inline MCQ over
  NEVER_TESTED/stale words via `getBlindSpotPool`, and it calls `processTestResults` (updates study_states).
  → The new Practice Mode should **subsume** this as its "blind-spots auto-set" mode.
- **Reusable as-is:** `Flashcard.jsx` (pure deck card), `MCQTest.jsx` (accepts a `wordPool`/`testConfig`),
  `selectTestWords`, `buildTestConfig`, `getBlindSpotPool`/`getBlindSpotCount`, `getSegmentWords`/
  `getNewWords` (range by position), `selectReviewQueue`/`getUnmasteredPool` (review-queue auto-set).
- **Range math:** words have a 0-indexed `position`; day N at pace P = positions `(N-1)*P .. N*P-1`.
- **Feature flags:** `src/config/featureFlags.js` (boolean exports, git-deploy gated).

## 3. Design

### 3.1 New route + component
- Route `/practice/:classId/:listId` under `<PrivateRoute>` (student-only), flag-gated by
  `PRACTICE_MODE_ENABLED` (App.jsx ~line 114, mirrors `/session`).
- New `src/pages/PracticeMode.jsx` — a small, self-contained flow (does NOT reuse DailySessionFlow,
  which is entangled with daily reconciliation). Internal phases:
  `SETUP (range picker) → STUDY (flashcards) → QUIZ (MCQ) → RESULTS (+ suggest next)`.
  Uses local component state; no `sessionService`/`class_progress`/CSD writes.

### 3.2 Range picker (SETUP)
Three ways to choose the practice set:
- **By days** — "Days X–Y" → positions `(X-1)*pace .. Y*pace-1` → `getSegmentWords`/position query.
- **By words** — "Words A–B" (position range) → position query. Cap at a sane max (e.g. 60) per session.
- **Auto** — two presets:
  - **Blind spots** — `getBlindSpotPool(uid, listId)` (NEVER_TESTED / stale >21d). (subsumes BlindSpotCheck)
  - **Review queue** — `getUnmasteredPool` + `selectReviewQueue` (FAILED / due words).
- Default suggestion on first open: the student's current day range (from `class_progress.currentStudyDay`).
- UI: reuse the **FocusControl dropdown pattern** (Dashboard.jsx:227) + number inputs (ClassDetail idiom);
  design tokens only.

### 3.3 Study (STUDY) — flashcards
Reuse `Flashcard.jsx` in a minimal loop (flip / next / "got it"), no dismissed-word persistence, no
session-state. Honors the existing `showKoreanDef`/`showSampleSentence` prefs. "Start quiz →" advances.

### 3.4 Quiz (QUIZ) — pluggable, MCQ wired for v1
Practice config carries `quizType: 'mcq' | 'typed'` (default `'mcq'`). A thin `PracticeQuiz` dispatcher
renders the chosen engine; **v1 wires MCQ only** (client-graded, zero AI cost). `typed` is a future flip
(reuses the same `practice_sessions` record shape + the existing server resolution path) — design the
record + the dispatcher so adding it is config-only, no re-architecture. Two engine options:
- **(A) Reuse MCQTest** in a new `practiceMode='record'` variant that, instead of skipping, writes a
  **practice record** (§3.5) and does NOT touch gradebook/study_states/CSD. Pro: one quiz engine.
  Con: MCQTest is 1470 lines entangled with daily-session writes — risky to fork its write path.
- **(B) A lightweight `PracticeQuiz` component** (MCQ rendering only, like BlindSpotCheck's inline quiz),
  writing the practice record directly. Pro: clean isolation, no risk to the daily engine. Con: some MCQ
  UI duplication.
- **Recommendation: (B)** — isolate practice from the gradebook engine entirely; reuse MCQTest's *option-
  generation* helper if cleanly extractable, but keep the practice write path separate. (Codex to weigh in.)

### 3.5 Practice records (out of gradebook)
New collection: **`users/{uid}/practice_sessions/{autoId}`** (NOT the `attempts` collection — keeps it
out of every gradebook reader, which all query `attempts where classId==…`). Shape:
```
{ schemaVersion: 1, listId, classId,
  mode: 'days'|'words'|'blindspots'|'reviewqueue', quizType: 'mcq'|'typed',
  rangeStart, rangeEnd, dayStart?, dayEnd?, pace?,            // pace from assignment, for day↔pos suggest
  total, correct, score,
  wordResults: [{wordId, word, position, isCorrect}],         // word+position → self-contained history panel
  createdAt }
```
- **Student-facing only:** a "Practice history" panel on the dashboard reads this; teachers/gradebook never do.
- **Suggest-next-range:** read the most recent `practice_sessions` doc → propose the next contiguous range.

### 3.6 Isolation — LOCKED: fully isolated (ISO)
Practice does **NOT** update study_states / mastery / retention / review-queue / class_progress /
gradebook. Only `practice_sessions` (§3.5) records it. Zero risk to the daily algorithm.
**Consequence to flag:** today's `BlindSpotCheck` calls `processTestResults` (it *does* clear blind spots
by updating study_states). Subsuming it under ISO means **practicing blind spots no longer shrinks the
blind-spot list** — only the real daily flow does. Accepted for v1 (practice = pure self-check). If David
later wants blind-spots specifically to "count," that's a narrow FEED exception (deferred), not ISO-wide.

### 3.7 Remove the fake "Practice again"
- Dashboard.jsx:1572 — when `doneToday`, the CTA becomes a real **"Practice"** entry → `/practice/...`
  (flag-gated; if flag off, hide it rather than re-run the session). Remove the misleading re-run nav.
- Leave the `practiceMode`-skips-everything code in TypedTest/MCQTest for now (dead unless invoked); remove
  in a later cleanup, or repurpose if we pick quiz option (A).

### 3.8 Firestore rules (CORRECTED per audit)
firestore.rules:45-48 already has a `match /{subcollection}/{docId}` wildcard under `users/{userId}` that
grants **owner OR any teacher** read+write. So:
- **Owner read/write to `users/{uid}/practice_sessions` works with ZERO rule changes.** No new block needed
  for the feature to function.
- The plan's earlier "owner-only, no teacher read" is **not achievable by adding a block** — Firestore unions
  matching rules (OR), so a stricter block can't subtract the wildcard's grant. Achieving student-only would
  require **narrowing the existing `{subcollection}` wildcard** (e.g. exclude `practice_sessions`), which
  touches a shared rule (the file's own TODO already flags the wildcard as over-broad).
- **Decision (Codex/David):** for v1, is teacher *read* of practice_sessions actually harmful? It's
  student-facing by UI only. Cheapest: **ship on the existing wildcard** (teachers technically can read, but
  no UI surfaces it) and note it. If we want true isolation, schedule the wildcard-narrowing separately (it's
  a latent security item independent of this feature). **Recommend: ship on wildcard for v1, log the
  narrowing as a follow-up.**

### 3.9 Feature flag + rollout
`PRACTICE_MODE_ENABLED` gates the route + the dashboard entry. Ship dark, enable after validation. Pure
client + a new user-subcollection + one rules block — no Cloud Function change.

## 4. Reuse map
| Need | Reuse |
|---|---|
| Flashcards | `Flashcard.jsx` (as-is) |
| Range by day/word | `getSegmentWords` / position query (studyService) |
| Blind-spots auto-set | `getBlindSpotPool` / `getBlindSpotCount` (exists) |
| Review-queue auto-set | `getUnmasteredPool` + `selectReviewQueue` |
| MCQ option generation | extract from MCQTest/BlindSpotCheck if clean |
| Sampling/cap | `selectTestWords` |
| Suggest next range | `class_progress` + new `practice_sessions` |

## 5. Open questions (RESOLVED ones struck; remaining for Codex)
- ~~Q1 Isolated vs feeds~~ → **ISO, locked** (§0/§3.6).
- ~~Q2 Subsume BlindSpotCheck~~ → **subsume + retire /blindspots, locked** (§0/§3.7).
- ~~Q3 MCQ vs typed~~ → **MCQ v1, pluggable quizType, locked** (§0/§3.4).
- Q4: Practice-session **cap** (max words per quiz) — propose **60** (matches MAX_TYPED_TEST_WORDS idiom).
- Q5 (eng, for Codex): Quiz engine — fork MCQTest (A) vs new lightweight `PracticeQuiz` (B). **Recommend B**
  (clean isolation; MCQTest's write path is entangled with the gradebook/CSD — risky to fork).
- Q6 (eng, for Codex): Records under `users/{uid}/practice_sessions` (recommend) vs flagged `attempts`.
  **Recommend subcollection** (every gradebook reader queries `attempts where classId==…`; a subcollection
  is structurally incapable of leaking into the gradebook).
- Q7 (eng): retiring `/blindspots` — redirect old route → `/practice` (or remove). Confirm no inbound links.

## 6. Rough work breakdown (after design sign-off)
1. `featureFlags.PRACTICE_MODE_ENABLED` + `/practice` route + dashboard entry (remove fake "Practice again").
2. `PracticeMode.jsx` shell (phase machine) + range picker (days/words/auto).
3. Word loading (range/blindspots/reviewqueue) — thin wrappers over existing services.
4. Flashcard study loop.
5. `PracticeQuiz` (MCQ) + `practice_sessions` write.
6. Results + suggest-next-range; dashboard "Practice history" panel.
7. Firestore rules block.
8. Validate: esbuild + Playwright (set range → study → quiz → record written, gradebook untouched).
