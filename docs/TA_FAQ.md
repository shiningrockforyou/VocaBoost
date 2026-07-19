# VocaBoost — TA FAQ (built from every CS ticket, 2026-06 → 2026-07-20)

Plain-language answers for the questions TAs actually get. Each item: **what the student says → what it is → what you do.**
Most things are now self-serve; the short escalate-to-David list is at the bottom.

---

## 🆕 Read this first — 4 answers CHANGED this week (2026-07-19/20)

1. **The grader was fixed — it now accepts correct Korean translations AND correct English definitions.**
   The old "정답과 똑같이 써도 오답" problem (correct 자전적인/무관심한, or a copied English definition, marked wrong as *"just
   restating the word / translate to Korean"*) is **fixed and live**. Correct-answer-marked-wrong should now be **rare**. If it
   still happens, it's a real judgment call → use **Challenge** (FAQ 1).

2. **Challenge tokens now refill WEEKLY, every Monday (early morning KST) — not "30 days."** If you tell students anything
   about tokens, say *"they reset every Monday."* (Old guidance said 30 days — that's outdated.)

3. **"Day won't advance / review won't submit / 단어시험 먼저 봐야 된다" is fixed** (the review-only-day deadlock, "#11"). A student
   who finished their list, or who is on a review-only day, is no longer frozen. If someone still isn't getting new words, it's
   almost always **low review scores** holding them (FAQ 4) — that's the system working, not a bug.

4. **Class changes now carry progress automatically.** Moving a student between classes on the same list (e.g. ADV→FINAL, or a
   승반) should keep their day/progress. Occasionally the first load still shows Day 1 → have them **reload once**; only escalate
   if it's still wrong after a reload.

---

## Top FAQs

### 1. "A right answer was marked wrong" (disputed grade)
- **Now rare** (grader fixed), but for genuine judgment calls you can resolve it yourself:
  1. Student taps **Challenge** next to the answer on their results screen → submit.
  2. You: **Gradebook → their test → the pending challenge → Accept** (or Reject).
  3. Accept marks it correct, recalculates the score, and advances their day if it now passes.
  4. Tell the student to **refresh** to see it.
- ⚠️ **Rejecting costs the student a token until the next Monday reset** — only reject if it's genuinely wrong.

### 2. "It says FAIL but I got 92–94%!"
- The pass mark is **92% everywhere** now. A 92–94% is a **pass** server-side; a "fail" screen is usually a stale display.
- **Have them reload** — it almost always corrects. If a 92%+ still shows fail after reload → send it to me.

### 3. "The day won't advance after a test" / "stuck after passing"
- First: did they actually **pass (≥92%)**? If just below, they simply **retake** — normal, not a bug.
- If a disputed answer is what's keeping them under → handle as **FAQ 1 (Challenge)**.
- If they **passed** but it didn't move → **reload first**. Still stuck on a *passed* day after reload → send it to me.

### 4. "New words stopped appearing" / "새 단어가 안 떠요" (review-only)
- This is the **throttle** working as designed: when recent **review scores are low (roughly under 30%)**, the app holds the
  student on **review only** and gives **no new words** until their reviews come up.
- **Correct answer to the student:** *"Your review scores are too low — keep doing the reviews and score above ~30%, and new
  words come back."* It's not broken.
- A student can't fix low retention by skipping — see FAQ 11. If a teacher wants to force new words for a specific student
  anyway → send me their email.

### 5. "My progress reset to Day 1" / "I'm re-studying words I already know" (after a class change)
- Progress is **not lost**, and class changes now **carry automatically**. Have them **reload** and pick the correct list from
  the **class/list selector** on their dashboard.
- If a specific student is genuinely still stuck at Day 1 (or re-studying old words) after a reload → send me their **email +
  the day they should be on** and I'll carry it across.

### 6. "Grading Failed" / "Couldn't Save Your Results" (the two pop-ups)
- **"Couldn't Save Your Results" (yellow):** the grade succeeded, only the save hiccuped → tap **Retry Save**. Their answers are safe.
- **"Grading Failed" (red):** tap **Try Again** (safe to retry). If it fails *immediately and repeatedly*, **reload the page and
  resubmit** — that's the real fix. Progress isn't lost.
- **Send to me only if it keeps failing after a fresh reload.**

### 7. "Grades → 'no results'" in Gradebook for a student who's clearly active
- Known Gradebook display bug for students **inactive for ~a month** — their grades exist, they just don't show on page 1.
- **Workaround:** in Gradebook, filter by **Class + a Date range** covering when they last tested (or page forward). Their
  grades are all there. (Fix is on my list.)

### 8. "Stuck on the loading screen" / "buttons don't work" / "screen frozen"
- Usually the **in-app browser** (opening from KakaoTalk/Instagram/etc.). Have them open VocaBoost in a **real browser**
  (Chrome/Safari) and **reload**; try a **different device** too.
- If it sticks on **one specific day** every time → send me the student, the day, and a **screenshot (F12 console if possible)**.

### 9. "When do challenge tokens come back?" / "I'm out of challenges"
- Everyone gets **5 tokens**, and they **reset every Monday (early KST morning)**. A rejected challenge costs one token **until
  that Monday reset** (no longer 30 days).
- If a specific student urgently needs tokens back before Monday → send me their email.

### 10. "When / how does a student move to SUMMIT (or the next list)?"
- Lists are **already on every class** — students **pick the next list from the selector**; you don't assign anything.
- A student who has **finished ASCENT stops getting new words** (review only) → that's the cue to pick **SUMMIT**. SUMMIT starts
  at its own Day 1 (expected for a new list). (ASCENT = 1,600 words: done after Day 20 at 80/day, Day 16 at 100/day.)

### 11. "I submitted a blank/accidental review" / mis-submit
- There's **no self-serve review-retake** yet, and a submitted review can't be undone in-app → send me the student + day.
- **Prevention (tell students):** actually **answer the review questions** — don't hit Submit on an empty/0 test. Skipping
  reviews both hurts their score and keeps new words locked (FAQ 4).

### 12. "What's the pass mark?" / threshold confusion
- **92% for every class and list.** (If a student ever *passes* below 92, or *fails* at 92+, tell me — that's a misconfig.)

---

## ⚠️ Don't do these

- **Don't add or remove lists from a class.** Every class already has the right lists; changing assignments knocks students off
  their progress. If a class's lists look wrong → send it to me.
- **Don't change a student's grade and assume it's live** — they must **reload** to see any change you make.

## 📩 Send to me (email + class + day + screenshot if possible)

- A **passed** test/day that **reloading doesn't fix**.
- A student **still at Day 1 / re-studying old words** after a class change *and* a reload.
- **"Grading Failed"** that persists **after a fresh reload**.
- **Stuck on the loading screen** for a specific day.
- A **blank/accidental review** that needs redoing.
- Setting a specific student's **default list**, or forcing new words for a low-review student.
- Anything that looks like **wrong/missing data** (scores that don't add up, duplicates), or a **wrong threshold/pass mark**.

---

*Reality check from the tickets: the biggest clusters were (a) "correct answer marked wrong" [grader — now fixed], (b) "day
won't advance / new words gone" [review-only / low scores — now completable], (c) class-change resets [now auto-carry], and
(d) "92–94% shows fail" [reload]. Most now self-resolve or need only a reload — when in doubt, reload first.*
