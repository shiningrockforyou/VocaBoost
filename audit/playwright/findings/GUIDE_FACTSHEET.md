# Guide update fact sheet (verified against live code, 2026-06-01)

Authoritative facts for updating the 4 help guides. Every item verified in source this session. Editor: preserve each file's existing structure, styling, language, and table of contents; ADD/CORRECT only.

## Files (all in /app/public/, minified single-line HTML, served at /help-*.html)
- help-student-ko.html / help-student-en.html (student; KO is source, EN is its translation — keep parallel)
- help-teacher-ko.html / help-teacher-en.html (teacher/TA/admin)

## NEW — TA / Admin shared account (add to BOTH teacher guides)
- TAs and admins use a **teacher-role account**. A dedicated shared account exists:
  - Email: `ta@vocaboost.com`  Password: `VocaTA2026!`
  - Role: teacher. Use it to manage classes, view the gradebook, and review challenges.
- Add a short "TA / Admin access" subsection near the top (after login) explaining: TAs/admins log in with this teacher account; everything in the teacher guide applies to them; treat the password as shared-internal.

## Enrollment / adding students (teacher guides — already covered, verify accuracy)
- Each class auto-generates a **6-character join code** (e.g. TOP `QSTRZL`, CORE `3VEHE8`). Found on the class card and class detail page; "copy code" button.
- **Teachers/TAs CANNOT directly add a student.** Students self-enroll: Dashboard → "Join Class" → enter the join code. (Existing guide already says this — keep it.)
- Roster appears in class detail once students join. (Audit note: a recent fix corrected a bug where joined students were missing from the class roster count — now fixed; no need to mention the bug, just ensure the guide says joined students appear in the roster.)

## Checking grades / Gradebook (teacher guides)
- Gradebook: open from teacher dashboard. Filter by Class / List / student Name / Date. Click a test row → per-question detail (student answer, correct/incorrect, AI reasoning).
- Export grades to CSV.
- Numbers reflect submitted typed/MCQ attempts; Korean answers display correctly.

## Challenge system (BOTH guides — important, make it clear)
- After a test, a student viewing their graded answers can **challenge** an answer they think was marked wrong — opens a challenge modal, optional note to the teacher.
- **Token model (verified):** a student has up to **5 challenge tokens**. Submitting a challenge is free to retry, BUT a **rejected** challenge consumes availability — while a rejection is "active," tokens are reduced. A rejected challenge's hold lasts **30 days** (replenishAt = now + 30 days), after which it no longer counts against the student. (So: students get 5; rejections temporarily lock tokens for 30 days; accepted challenges don't penalize.)
- **Teacher/TA review:** Gradebook shows "Pending Challenge" on attempts with open challenges. The teacher opens the attempt and **accepts or rejects** each challenge.
  - Accept → the answer is marked correct, the score is recalculated, and study state for that word becomes PASSED. If accepting pushes a failing test over the pass threshold, the student's day can advance (only for the current day's test).
  - Reject → no score change; counts against the student's tokens for 30 days.

## Study process (student guides — "thoroughly explain what to expect")
Daily session has up to **5 steps** (shown as a Step x of N tracker):
1. **Study New Words** — flashcards for the day's new words. Flip to see meaning; "I know this word" to dismiss a card you already know.
2. **New Words Test** — tested on the new words. Must score at/above the **pass threshold** to pass (default **95%**, but the teacher can set it per class — some classes use 92%/90%). If you don't pass, you can **Try Again** (retake).
3. **Review Study** — flashcards reviewing earlier words (does not appear on Day 1).
4. **Review Test** — tested on review words (not on Day 1).
5. **Complete** — day done; your study day advances by 1.
- **Test modes:** Multiple Choice (pick the right definition) or Written/Typed (type the meaning; you may answer in English, Korean, or a mix — the AI grader is lenient and accepts Korean translations, paraphrases, and minor typos). The typed test shows all questions on one page; type each answer then Submit; grading takes ~15-20s.
- **Auto-adjusting workload (intervention):** if a student struggles on reviews, the app automatically reduces new words and adjusts review size; doing well keeps the normal pace. Set expectation: the daily amount adapts to performance.
- **Word states / mastery:** words move through states (new/never-tested → tested → passed/failed → MASTERED after consistent success). MASTERED words "rest" ~21 days then return for a check, so you're not endlessly re-tested on words you know.
- **Crash/refresh:** if the browser refreshes mid-session you're returned to where you were; (KNOWN LIMITATION to optionally mention: if you crash mid-typed-test, you're returned to the test but may need to re-type in-progress answers — submitting normally always saves). NOTE: only include this caveat if a student-facing note is wanted; it's a pending fix.
- **Intentional exit clears in-progress test answers by design** — if you deliberately close/leave a test, your in-progress (unsubmitted) answers are discarded; finish and Submit to save.
- PDF download of the day's words is available for offline study.
- Challenge (이의 제기): see challenge section above.

## Pass threshold note (both)
Default 95%; teacher-configurable per class/list (observed live values include 92% and 90%). Guides should say "default 95%, set by your teacher" rather than a hard 95%.

## Don't include
- Internal bug names, audit details, the phantom-enrollment fix, F01, etc. Guides are user-facing.
