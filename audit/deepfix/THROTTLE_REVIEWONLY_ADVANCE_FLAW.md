# Issue: #11 fix advances csd on THROTTLE review-only days → recovery-defeating "review-racing" loop

**Date:** 2026-07-16 · **Status:** OPEN · candidate NEED_TO_FIX #16 · **Severity:** MED-HIGH (recurring, CS-observed)
**Related:** NEED_TO_FIX #11 (the review-only completion fix — this is a flaw *in* that deployed fix) ·
CS-2026-07-16b (the reset-reconcile that surfaced it).
**Decision (David, 2026-07-16):** NO manual override — the recovery path works; let students self-heal.
This doc records the underlying flaw for the eng owner.

---

## Symptom (TA reports, 2026-07-16, all Ascent)
- **이아연 / iayeon24 (Adv B1):** "Day 8 Review 70% 넘긴 뒤 Day 9 하려는데 Day 9 **Review**로 바로 넘어감. 재접속해도 계속 다음날 Review로 넘어간다. 정상 진도는 Day 9 (new words)."
- **김시연 / siyeon08kk (Adv B1):** identical.
- **조예서 / 0exey.7 (Inter B2):** "Day 11 단어가 **6개**밖에 안 뜬다" (milder — a trickle of new words, not zero).

## Root cause (two things stacking)
1. **Reconcile restored real (low) reviews** (CS-2026-07-16b, David option-a): these students genuinely average
   ~15% on reviews (but 90-100% on new-word tests) → `calculateInterventionLevel` → interv ~0.93-1.0 →
   `newWordCount = round(pace*(1-interv))` → 0-6 new words. Working as designed.
2. **The deployed #11 fix advances csd on THROTTLE review-only days** — not just list-end ones. So instead of the
   throttle HOLDING the student on a day to review until they improve, the fix completes each review-only day and
   **jumps them to the next day's review**. Students race through Day 9→10→11 Review in minutes.

## The core design flaw
The #11 fix (studyService.js:1808, `!reviewOnlyDay` gate-skip → completion → `recordSessionCompletion` csd+1)
advances csd on **all** review-only days. That is:
- **CORRECT for list-end** review-only (twi≥listSize, finished list — nothing more to do on this list).
- **WRONG for throttle** review-only (words remaining) — the throttle's PURPOSE is to hold the student on review
  until retention recovers. Advancing csd converts "held on review" into "sprint through review-only days."

## Why it defeats recovery (the vicious loop)
Intervention = average of the **last 3** review scores; new words return once that avg > ~0.30. But because the
fix auto-advances review-only days, students **rush** through them and score 0, and each rushed 0 refills the
3-review window, cancelling the good scores they DO get. Evidence — 이아연 did three review-only days in ~20 min:

```
recentSessions: d7[r0.00] d8[r0.77] d9[r0.00] d10[r0.00] d11[r0.73]
attempts:  d9 review score=0 (0.3h ago), d10 review score=0 (0.3h ago), d11 review score=73 (0.1h ago)
last-3 = [0, 0, 0.73] → avg 0.24 → interv 1.0 → 0 new words
```
She scored 77% and 73% on the days she engaged, but the rushed 0s keep her pinned.

## The recovery path DOES work (verified — so this is UX-defeating, not a dead-end)
Review scores ARE saved to `recentSessions` on review-only completion (confirmed: 이아연's d11 73% is stored).
So a couple of genuinely-good reviews recover them:

| next review | last-3 | avg | interv | new words @80 |
|---|---|---|---|---|
| now | [0,0,0.73] | 0.24 | 1.00 | 0 |
| +1 good (0.80) | [0,0.73,0.80] | 0.51 | 0.53 | ~38 |
| +2 good | [0.73,0.80,0.85] | 0.79 | 0.00 | full 80 |

So **one more careful, good review → new words next day**; two clears the throttle. Not stuck — just fighting
the racing UX and the 0-score dilution.

## Proposed fixes (eng)
1. **Primary:** do NOT advance csd on **throttle** review-only days — only list-end ones. Hold throttle students
   on the day (original throttle intent) so their reviews accumulate and recovery isn't diluted by rapid 0-days.
   (Distinguish the two reviewOnlyDay causes: `wordsRemaining>0` = throttle → hold; `wordsRemaining<=0` = list-end → advance/terminal.)
2. **Or/also:** don't let a rushed/instant review-only submission count into the intervention window (min time on task,
   or exclude auto-advanced days), so genuine good reviews aren't cancelled.
3. **Or/also (pedagogy):** soften the throttle for the **high-new / low-review** profile — a student passing new-word
   tests at 90-100% arguably shouldn't be zeroed on new words purely on review scores (may indicate guess-clicking
   reviews rather than a true retention wall — worth teacher confirmation).

## Interim (no code)
No manual override (David). TA guidance: **"do the review tests carefully — one or two good reviews (>50%) brings
new words back the next day."** Monitor via `scripts/cs/scan-throttle-risk.mjs`.
