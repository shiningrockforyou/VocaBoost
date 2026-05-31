# D1-04 — Day-1 Trolling / Junk Input Test

**Date:** 2026-05-31
**Account:** audit_trolling_01_top@vocaboost.test
**Class ID:** k8tzOiiwotBbtJS3uTiv (TOP)
**List ID:** 8RMews2H7C3UJUAsOBzR
**Bundle:** index-CflgDyCK.js (live prod)

---

## Classification

**COMPLETED_NOPASS**

> Junk input failed test as expected. Day did NOT advance. This is CORRECT behavior.

---

## Status Block

| Check | Result |
|-------|--------|
| Account | audit_trolling_01_top@vocaboost.test |
| Reached Day-1 test? | YES |
| Classification | **COMPLETED_NOPASS** |
| Junk correctly graded wrong? | YES |
| B2 "Unsupported field value: undefined" strand? | NO |
| Crash on junk input? | NO |
| CSD before → after (held?) | 0 → 0 — HELD (correct) |
| Console errors | 0 error(s) |
| Orphan docs | NONE |
| Exactly one Day-1 attempt? | YES |
| Day-1 robust to junk? | YES |

---

## Score Details

- Questions answered with junk: **30**
- Correct count (from results page): **0**
- Incorrect count (from results page): **30**
- Grading Cloud Function called: **YES**

---

## Console Errors

_No console errors detected._

---

## Firestore Evidence

- **class_progress.currentStudyDay before:** 0
- **class_progress.currentStudyDay after:** 0
- **Attempt docs added:** 1 (correct)

---

## Analysis

Day-1 flow with junk/trolling input completed as expected.
The grader correctly rejected random characters, emoji, "lol", "idk", and blank answers.
The session completed without crashing, and the CSD was held (not advanced), which is correct behavior for a failing score.
No B2 "Unsupported field value: undefined" errors were observed from junk inputs.

---

## Logs

- JSONL: `/app/findings/agent_logs/D1-04.jsonl`
- Status: `/app/findings/agent_logs/D1-04.status.json`
