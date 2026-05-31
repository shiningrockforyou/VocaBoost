# D1-03 — Day-1 Completion Test: slowlaptop TOP

**Label:** D1-03
**Date:** 2026-05-31
**Account:** `audit_slowlaptop_01_top@vocaboost.test` (uid: `ooF0fRwZodX8NyWuiQLYUS7Kpde2`)
**Class:** TOP (`k8tzOiiwotBbtJS3uTiv`)
**List:** `8RMews2H7C3UJUAsOBzR` (25WT2 TOP Vocabulary v2)
**Bundle:** index-CflgDyCK.js (prod https://vocaboostone.netlify.app)
**Classification:** **COMPLETED_PASS**

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | `audit_slowlaptop_01_top@vocaboost.test` |
| Reached test? | **YES** |
| Classification | **COMPLETED_PASS** |
| B2 strand (Unsupported field value: undefined)? | NO — clean |
| New-word slice correct? | YES (30 inputs filled, testSizeNew=30) |
| CSD before → after | 0 → 1 |
| Duplicate attempts? | NO — 1 new attempt this run; 3 total historically (2 prior failed runs from dev iteration, 1 passing) |
| Console errors | 0 |
| Orphan docs | 1 session_state doc(s) |
| Day-1 OK? | **y** |

---

## Flow Execution

| Step | Action | Result |
|------|--------|--------|
| 1 | Firestore baseline | classProgress=1, attempts=2, CSD=0 |
| 2 | Login | OK — dashboard URL |
| 3 | H2 guard + Start Session | Class card present: YES, Start btn: found |
| 4 | Dismiss Customize modal | Done |
| 5 | Study phase | 80 cards via keyboard 'C', ~40s |
| 6 | Take Test button | Appeared and clicked |
| 7 | Fill typed test | 30 inputs filled (all-at-once format) |
| 8 | Submit | YES |
| 9 | Grading (Cloud Function) | Observed |
| 10 | Results | Confirmed |

---

## Firestore Evidence

### Before Session
| Collection | Count | CSD |
|-----------|-------|-----|
| users/{uid}/class_progress | 1 | 0 |
| users/{uid}/study_states | 80 | — |
| attempts (by studentId) | 2 | — |
| users/{uid}/session_states | 1 | — |

### After Session
| Collection | Count | CSD |
|-----------|-------|-----|
| users/{uid}/class_progress | 1 | 1 |
| users/{uid}/study_states | 80 | — |
| attempts (by studentId) | 3 (+1) | — |
| users/{uid}/session_states | 1 | — |

### class_progress[0]
```json
{
  "id": "k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR",
  "classId": "k8tzOiiwotBbtJS3uTiv",
  "listId": "8RMews2H7C3UJUAsOBzR",
  "programStartDate": {
    "_seconds": 1780188796,
    "_nanoseconds": 589000000
  },
  "interventionLevel": 0,
  "recentSessions": [],
  "stats": {
    "avgNewWordScore": null,
    "avgReviewScore": null
  },
  "streakDays": 0,
  "lastStudyDate": null,
  "lastSessionAt": null,
  "createdAt": {
    "_seconds": 1780188796,
    "_nanoseconds": 589000000
  },
  "currentStudyDay": 1,
  "totalWordsIntroduced": 80,
  "updatedAt": {
    "_seconds": 1780261658,
    "_nanosec
```

### Attempt Docs (all 3 historical)
  - `...k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new_1780188846754_tun0hv5kf` day=undefined score=3 passed=false (2026-05-31T00:54 — prior dev run)
  - `...k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new_1780261187162_izprffjd6` day=undefined score=3 passed=false (2026-05-31T20:59 — D1-03 draft run with wrong answers)
  - `...k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new_1780261658211_3o7gpv219` day=undefined score=100 passed=true (2026-05-31T21:07 — **this D1-03 run, PASS**)

Note: `day` field is `undefined` in attempt docs (no `day` field stored) — this is consistent with B04/F02 findings. ID format `_new_{timestamp}_{random}` indicates non-deterministic IDs per B04/F03.

---

## Console Errors (0 total)

  NONE

---

## Orphan Docs

1 session_state doc(s)

---

## Day-1 Word Slice Verification

| Field | Value |
|-------|-------|
| List | topActiveList (`8RMews2H7C3UJUAsOBzR`) |
| Words in audit snapshot | 30 (= testSizeNew) |
| Pace | 80 (full list studied, 30 tested) |
| Study cards dismissed | 80 |
| Test inputs filled | 30 |
| study_states docs (after) | 80 |

---

## Findings

### PASS: Day-1 completed successfully end-to-end

All steps executed with slow cadence: login → H2 guard → study (80 cards) → typed test → submit → grading → results.

---

## Notes

- **Persona:** slowlaptop — 120ms/char typing, 400-600ms between cards, deliberate pauses
- **Prior state:** Account had 2 attempt(s) and 1 class_progress doc(s) before run
- **CSD:** 0 → 1 (advanced)
- **Bundle verified:** index-CflgDyCK.js (prod)
