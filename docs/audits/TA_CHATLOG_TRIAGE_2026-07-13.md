# TA chat-log triage (26SM SAT TA channel, 2026-06-30 → 07-13)

Thorough pass over the TA support channel to (a) confirm everything handled today, and (b) surface issues
**relevant to our stuck-student / reconciliation work that we had NOT checked.** Read with `SUPPORT_RUNBOOK.md`
(the CS event log) and `NEED_TO_FIX.md`.

## Headline: the whole week is TWO themes — both are exactly what we've been working on
1. **#11 list-end review-only deadlock** — students finishing a list (Base Camp 16d / Ascent 16–20d / Summit)
   then frozen on a review-only day. David's standing workaround all week: *"manual test 만들어서 수기채점"* +
   repeated promises *"목록 끝나고 다시 처음부터 하는 기능 / repeat 기능 오늘 밤·주말 업데이트 예정."* That feature
   = our review-only-completion fix (§5 terminal) + cycling capstone. The chat is overwhelming live validation.
2. **Cross-class promotion carry** — students promoted INT→ADV→FINAL, progress on the shared list should carry.
   Sometimes fine, sometimes strands at Day 1 (#12) or under-counts CSD (Kaila-type). Second-most-common theme.

Everything else is grader/threshold/reliability/test-size noise that maps to existing NEED_TO_FIX entries.

## A. RESOLVED today (CS-2026-07-13*, see SUPPORT_RUNBOOK) — all 7/13 reports
오하린(carry-correct), 김동현(#11→Summit), 안이연·유혜준·Lucy(#12 carry→reconciled), Kaila(csd-undercount 2→3),
Junseo(#11 throttle→completed), 손지성(carry-correct), Bridge TOP 최다온·한예진·최우성(#11→Ascent), 허은서(not #11).
Plus systemic: **ensured all 32 classes have 3 lists** + **batch-advanced 87 list-end finishers**; **169-student
#11 scan** (100 active-need, 63 still-to-move, 5 finished-everything).

## B. RESOLVED earlier by David (verified where checked) — map to KNOWN issues
- **#11 list-end** (dominant): 정유나·어재원 (유라시아 Core d16 — VERIFIED now on Ascent d5), 김지원 (유라시아 Top d18→Summit),
  최도훈 (INT B4 d16→Ascent), 이가온 (Final Ascent+Summit 100% — finished-everything, manual), 안예진 (Final Ascent d16→Summit),
  고아연 (INT E — actually WRONG-LIST-selected, Base vs Ascent).
- **Cross-class carry / day-offset**: 박주하 (INT A2 d6), 조준모 (INT A2 d9), 남세이 (Adv E d2), 구기현 (Final — fixed),
  손진욱·이채은 (class transfer). Mostly "should be fixed" by David; carry is the #12 area.
- **Transients (refresh-fixed)**: 김나연 (28→fail), 이충한 (채점 안됨), 신세라·이수아 (review error), Connection Issue
  (유라시아 Top online ×4 — server-side, David "fixed"). → grading/save reliability (#3/#4).
- **Threshold**: 김호형 Adv E 93% vs 95-cut → #5 (David globally set all lists to 92% on 7/4).
- **Non-issues**: 로워모듈, 박현율 review-test-is-normal, 최세인 must-pass-day-1, 박현율 스킬마스터리 (non-vocaboost).

## C. ⚠️ NEW / UNCHECKED — surfaced by this triage, worth investigating
These are NOT yet in NEED_TO_FIX (or are new facets). Verified read-only where noted.

### N1 — Test size WRONG at boundaries (day-1 / promotion-retake / dup) — **VERIFIED real, unexplained**
- **이혜성** (미주 INT, hyeseong1028): class config `testSizeNew=30`, but her **Day-1 new test was totalQ=10**;
  Days 2–4 were correctly 30. She introduced 80 words day-1 but was tested on 10. Self-healed day 2. A genuine
  **first-day / enrollment-race test-generation bug** (she's also a cross-class Inter+Adv student).
- **김호형** (promoted Adv E→Final A): David SELF-FLAGGED unresolved — "재시험이 out of 30로 나옴 (should be 35)"
  on day 2 after promotion. Final pace-100 → testSizeNew=35, but retake showed 30. **Could not verify** (email
  hoeraszz@gmail.com has no auth record — deleted/typo). Cross-class test-size-on-retake bug, OPEN.
- **이서현** (INT B3 d9): "15문제만 나옴" — David: *"같은 시험을 여러번 보게 돼서 꼬였다"* → test-generation
  **duplicate/re-serve** bug (he said fixed). **Adv A2 12/12**: legit list-end remainder (benign).
- **Pattern:** test size is mis-generated at edges — day-1 enrollment, post-promotion retake, dup re-serve,
  list-end remainder. No systematic audit exists. → candidate NEED_TO_FIX (test-generation edge cases).

### N2 — Challenge tokens: 30-day replenish (NOT weekly) + rejected-consumes → forced manual-grade treadmill
- **Verified** (이서현 `users/{uid}.challenges.history`): each challenge (accepted OR rejected) sets
  `replenishAt = challengedAt + 30 days`. TAs were told *"다음 주에 challenge reset"* — the actual replenish is
  **30 days**, so the guidance is wrong and students stay tokenless far longer than expected.
- **The real deadlock** (양서현, Final A 승반생): grader **deterministically** marks a correct answer wrong AND
  the student is out of tokens → **can never pass** ("정답과 똑같이 써도 오답… no matter how many times, always fail").
  Recurred a LOT this week (이서현, 김재민, 윤여진, 안예진's classmate). Workaround = 수기채점. This is the
  **grader-calibration (#2) + no-teacher-override (#1)** gap combined into a permanent-fail state — a SECOND
  stuck-state class distinct from #11. Operational load was heavy all week.
- **NOTE:** promoted students often lack challenge/grade permission in the new class ("승반한 친구라 단어 권한이
  없습니다") → TA can't even manual-fix → escalates to David. Permission gap on promotion.

### N3 — No review-RETAKE path; reviews don't gate, so a mis-submit is permanent
- **박서준** (INT B3): accidentally submitted Day-7 review, scored 2%, wants a retake — **no mechanism**.
- Reviews always "pass" (low bar / non-gating), so **김지오** asked to roll back a student who advanced on a
  below-cutline review — that's *by design* (reviews don't gate CSD), but it means an accidental/garbage review
  is unrecoverable and still advances the day. Product gap: no review re-take, and no "review must meet a bar."

### N4 — Chronic low review scores → intervention throttle → the #11 THROTTLE variant (the Junseo chain)
- **Verified** (이서현: review scores 13%, 20%; Junseo: 27/10/40 → interv 1.0). Reviews always pass so low scores
  don't block *directly*, but 3 consecutive lows drive `interventionLevel→1.0 → newWordCount=0 → review-only day
  → #11 gate freeze` **mid-list** (not just list-end). So the #11 throttle variant is **downstream of review
  quality**, and any chronically-weak reviewer is a future #11-throttle freeze. Our fix covers the freeze; the
  underlying "reviews are near-zero but still pass" is a pedagogy/data-quality signal worth surfacing to teachers.

### N5 — Gradebook "no results" for a real, active student — CONFIRMED existing #8 (not new)
- **이지후** (미주 Inter): "Students shows Day 8, Grades → no results." Verified: all 14 attempts carry
  classId+teacherId (properly attributed) → the emptiness is the **client-side Name-filter on one page** (#8),
  not attribution. **최도훈** ("gradebook shows only review, new test missing") is the same surface. → #8.

## D. Recommended additions to NEED_TO_FIX
- **NEW #13 — Test-size mis-generated at boundaries** (N1): day-1 enrollment (이혜성 10≠30), post-promotion
  retake (김호형 30≠35), dup re-serve (이서현 15). MED. Needs a read-only cohort audit of `totalQuestions` vs
  the class `testSizeNew` to size it.
- **NEW #14 — Permanent-fail from grader-false-negative + token exhaustion + no override** (N2): the second
  stuck-state class. Folds #1(no override)+#2(grader calibration)+challenge-replenish-period-misinfo+promotion-
  permission-gap. HIGH operational impact. Manual-grade is the only current escape.
- **NEW #15 — No review-retake; reviews non-gating so mis-submit is permanent** (N3). MED, product.
- Note under #11: the THROTTLE variant is downstream of chronic low reviews (N4) — surface review quality to teachers.
- Correct the CS guidance: challenge replenish is **30 days**, not weekly (N2).
