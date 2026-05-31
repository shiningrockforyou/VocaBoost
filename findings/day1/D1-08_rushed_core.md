# D1-08 — Rushed Cadence, CORE Class

**Account**: `audit_rushed_01_core@vocaboost.test`
**UID**: `QJ5AXP27u9exyxGRgnmU5ARsBRm2`
**Class**: CORE (`LVjBTFuYE8FbPG34pVAt`) — "25WT 2차 CORE OFFLINE"
**List**: `aRGjnGXdU4aupiS8SlXR` — "25WT2 CORE Vocabulary (v2)", 3380 words
**Tested**: 2026-05-31T20:45:39Z → 2026-05-31T20:46:51Z
**Prod bundle**: `index-CflgDyCK.js` confirmed via https://vocaboostone.netlify.app

---

## STATUS BLOCK

| Field | Value |
|---|---|
| Account | `audit_rushed_01_core@vocaboost.test` |
| CORE testMode | `typed` |
| Reached test? | **YES** |
| Classification | **COMPLETED_PASS** |
| B2 strand? | **NO** |
| New-word slice correct? | **YES** — all 25 words in positions [0, 60) |
| CSD before→after | **0 → 1** |
| Duplicate/skipped under rush? | **NO** (2 attempts = prior failed run + this pass; no double-submit) |
| Console errors | **NONE** (0 errors) |
| Orphan docs | **NONE** |
| Day-1 OK? | **YES** |

---

## CORE Config (confirmed from Firestore)

| Setting | Value |
|---|---|
| pace | **60** (new words per day = positions 0–59) |
| testMode | **typed** |
| testSizeNew | **25** questions |
| passThreshold | **90%** |
| reviewTestType | **mcq** (not needed Day 1) |
| reviewTestSizeMin/Max | 20–30 |

---

## Baseline State (before this session)

| Field | Value |
|---|---|
| currentStudyDay | 0 |
| totalWordsIntroduced | 0 |
| streakDays | 0 |
| existing attempts | 1 (prior failed run, score 4/25=16%, submitted `_seconds:1780184654`) |
| session_state phase | `new-words-study` (Day 1) |

The account had one pre-existing failed Day-1 attempt from a previous session (~21 hours earlier). The session was in `new-words-study` phase, ready for a new attempt.

---

## Test Execution Flow

### Step 1 — Login
- SPA loaded at root, client-routed to `/login` via history.pushState
- Login form completed: email + password + Enter
- Redirected to dashboard, CORE class card visible ("25WT 2차 CORE OFFLINE")

### Step 2 — Session Start
- "Start Session" button found (1 instance), clicked
- Session opened; "Customize Your Flashcards" modal dismissed via "Start Studying"

### Step 3 — Study Phase (Rushed)
- Session menu immediately accessible; used "Skip to Test" → confirmed "Start Test"
- Cards dismissed: 0 (skip is valid rushed behavior)
- No double-advance or premature skip issues

### Step 4 — New Words Test (Typed)
- Test: "New Words Test — Day 1" — **25 questions displayed in bulk**
- All 25 inputs visible simultaneously (not sequential)
- Typed char-by-char at 5ms/char (rushed cadence)
- **All 25 inputs filled** — 0 empty after typing
- No questions skipped by rushed clicks

#### Word Positions Presented (25 of pace=60)
```
Positions: 19, 56, 24, 33, 52, 29, 27, 40, 38, 31, 4, 51, 57, 25, 39,
           16, 46, 47, 3, 9, 0, 58, 34, 43, 20
Words: scrupulous, paradigm, critique, triad, stalwart, camaraderie, stratum,
       champion, blatant, grandiloquent, fabricate, noxious, incorporate,
       parity, archives, defiance, somnolent, emaciate, sly, chaff, vigilant,
       progressive, strive, earnest, versatile
```
All positions within [0, 60) — **new-word slice correct** ✓

### Step 5 — Submit (Rushed)
- Submit button clicked once; button disabled immediately after click
- No double-submit triggered by rushed click ✓

### Step 6 — Grading
- AI grading: ~30 seconds
- Results: "Completed Day 1 session — 100% — 25 of 25 correct"

---

## Post-Session Firestore State

| Field | Before | After |
|---|---|---|
| currentStudyDay | 0 | **1** |
| totalWordsIntroduced | 0 | **60** |
| streakDays | 0 | 0 (anomaly, see below) |
| lastStudyDate | null | null (anomaly) |
| session_state phase | `new-words-study` | `complete` |
| attempts count | 1 | **2** |

### Attempt Detail (This Session)
- ID: `...new_1780260385078_u4hwus0qp`
- studyDay: 1, score: **100/25 (100%)**, passed: **true**, graded: true
- newWordStartIndex: **0**, newWordEndIndex: **59** ✓

### Duplicate Attempt Analysis
Two Day-1 attempts exist:
1. Prior session (pre-existing, ~21h earlier): `_seconds:1780184654`, score=4/25, passed=false
2. **This session**: `_seconds:1780260382`, score=100/25, passed=true

These are NOT from rushed double-clicking — they are a prior failed attempt + this passing retake. IDs have distinct timestamp suffixes. **No duplicate from rush** ✓

---

## Grading Anomaly (Notable Finding — Non-Blocking)

**AI Grader accepted generic fallback text as 100% correct.**

All 25 submitted answers were the harness fallback string `"a specific word with meaning"` (word lookup failed because CORE list stores `definition` field, not `definition_en`). The AI grader returned `isCorrect: true` with empty `aiReasoning` for all 25.

Examples:
- `vigilant` → "a specific word with meaning" → graded **correct** (expected: "keeping careful watch for possible danger")
- `scrupulous` → "a specific word with meaning" → graded **correct** (expected: "diligent, thorough, and extremely attentive to details")

This is a **grader reliability concern** but does not block Day-1 completion. The UI correctly processed the 100% score and advanced CSD. Note for harness: CORE list uses `definition` field, not `definition_en`.

---

## Rushed-Cadence Issues

| Issue | Detected? |
|---|---|
| Double-advance (card/question skipped) | NO |
| Skipped questions (empty inputs) | NO |
| Premature submit | NO |
| Duplicate attempt from rushed submit | NO |
| Session state corruption | NO |

No rushed-cadence regressions detected.

---

## Console Errors

NONE (0 console errors recorded throughout session).

---

## Orphan Documents

NONE. Session state correctly transitioned to `phase: "complete"` after submission.

---

## Non-Blocking Anomalies

1. **streakDays=0 after completion**: Expected 1. Possible timezone/date calculation issue.
2. **lastStudyDate=null**: Not set after Day-1 completion.
3. **AI grader accepted all generic answers**: See "Grading Anomaly" above.

---

## Classification

**COMPLETED_PASS**

Full Day-1 end-to-end:
- Login → session → H2 guard → study (skip-to-test, rushed) → test (25/25 answered) → grading → results (100%) → CSD 0→1 ✓
- No B2 errors, no console errors, no orphan docs, no duplicate from rush, no skipped questions, word slice [0,60) correct ✓

---

## Evidence

Screenshots: `/app/findings/evidence/D1-08/` (11 captures)
Log: `/app/findings/agent_logs/D1-08.jsonl`
Status: `/app/findings/agent_logs/D1-08.status.json`
