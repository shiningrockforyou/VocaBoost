# Chat-Log → Audit Coverage Map

Cross-reference of every distinct issue pattern reported by TAs in the 2026 winter intensive (Jan 5 – Feb 27) to the audit batches that exercise the same code paths.

**Important framing:** Many of these issues have already been fixed during the winter intensive itself. This map is **regression prevention** — it shows what the audit catches if a future change reintroduces the bug.

## Pattern table

| # | Pattern | Frequency | Real examples from chat | Batches that cover it | Personas exercising it |
| --- | --- | --- | --- | --- | --- |
| 1 | **Passed test but day didn't advance.** Student takes Day N test, passes legitimately, but Day N+1 doesn't appear. | 30+ reports | 신재영, 이연주, 김신우, 김나영, 강하랑, 윤유나, 강동영, 예성원, 손예나, 곽민준, 홍아정, 이주현, 김민준, 이종연, 신재영 again, 이서연, 이지민, 강희림 | **B22** S01, S03, S04, S05, S06; **B05** S02; **B07** S05–S07 | Careful, Korean, ESL, Recovering |
| 2 | **Day jumped past expected.** Day 1→Day 3 or Day 4→Day 6. | 15+ reports | 강희림 Day 6 with Day 4 words; oje 학생 Day 3 → Day 5 via challenge; 김수아 fail → next day | **B22** S08, S09, S15; **B23** S12, S13; **B19** | Anxious, Class-Switcher |
| 3 | **Review test confusion / not taken.** Students didn't know review test existed. | 10+ reports | David: "Do students know they have to take the review test as well?"; 1-2명정도 리뷰테스트가 뭔지 모르는 친구들 | **B22** S09; **B05** S01; **B15** S07 (UI prompts to take review); **B26** S30 (grading delay confusion) | Confused First-Timer, Lazy |
| 4 | **Challenge token depletion.** Student over-disputes, runs out of tokens, can't pass test. | 5+ reports | 김동현, 배성훈, 손예빈 | **B23** S04, S05, S18; **B11** S05 | Anxious, Korean Native Typist (high dispute frequency) |
| 5 | **Test-type mismatch.** Subjective shown when MCQ expected, or chain "주관식 → 주관식 리뷰 → 객관식 리뷰". | 4 reports | 강동영, 김민준; Core 온라인 단어시험 다 객관식 (settings error) | **B22** S08; **B05** S04; **B17** S09 (PDF format consistency) | Confused First-Timer, Anxious |
| 6 | **Class transfer breaks progression.** CORE→TOP transfer; 1st day shows Day 1 instead of catching up. | 2-3 reports | 민사랑 (multiple incidents Jan 26 – Feb 1) | **B24** S03, S04, S05, S14; **B22** S19 | Class-Switcher |
| 7 | **Records vanishing.** Student had Day 3 progress, suddenly Day 2. Or reset to Day 1 with old words. | 3 reports | 홍아정 (Day 3 → Day 2); 정혜교 (reset to Day 1 with Monday's words mid-week) | **B06** all scenarios; **B22** S05 (tab close + reopen); **B02/B03** persistence fixes | Recovering, Distracted |
| 8 | **AI graded verbatim-correct answer as wrong.** Student answer matches dictionary exactly, marked wrong. | 2+ reports | 안이찬 (Feb 4) — 21/25, two verbatim-correct marked wrong | **B26** S01 (verbatim test), S15 (cheater verbatim), S29 (consistency check) | Cheater, Korean (paste-verbatim) |
| 9 | **Algorithm pace suppression confusion.** "6 words at a time" state confused students. | 2 reports | 이지민, 김동현, 이다솔 (Day 6 stuck on 6-word batches) | **B25** all scenarios (S02 trigger, S03 recovery, S09 UI indication) | Lazy, Anxious |
| 10 | **Render staleness — refresh fixes the issue.** Data not appearing until manual refresh. | 12+ reports in single day (Feb 9 mock exam day) | Feb 9: 심재윤, 권미주, 김시우, 김민서, 이시현, 최수영, 손예빈, 송치윤, 안시현, 홍건우, 김윤현 all needed refresh | **B15** S05, S06, S10; **B22** S04 (refresh at every transition); **B07** all (real-time data sync) | Habitual Refresher |
| 11 | **Joining class fails.** Code typed correctly, doesn't join. | 1 confirmed | 정재민 (Feb 16) | **B24** S06, S07, S08, S11; **B12** S05; **B07** S11 | Confused First-Timer |
| 12 | **Site won't load on user's device.** | 1 confirmed | 문서현 (Jan 12) — couldn't access from any device | (Out of scope for Playwright; flag for manual cross-browser testing) | n/a |
| 13 | **Day mismatch between gradebook and student view.** Teacher sees Day 11 in gradebook, student sees Day 12 or vice versa. | 5 reports | 박서현, 강다은, 곽민준, multiple others | **B18** S10 (gradebook stale); **B22** S15 (challenge accept → day advance consistency) | Anxious Teacher, Anxious Student |
| 14 | **Mock exam not appearing.** | 12+ reports (Feb 9) | Same Feb 9 cluster | (vocaBoost is for vocab tests not mock exams — likely a different sub-app or page; if it's in scope, B15 S05) | Habitual Refresher |
| 15 | **Score recorded wrong / token consumed but dispute not visible.** | 1 confirmed | 김동현 Day 5 review (Jan 20) | **B23** S19 (challenge non-atomic); audit finding #10 | Recovering |
| 16 | **Test stuck during submission.** Student says lag, then weird state. | Implicit in many reports | David repeatedly asked: "submit을 할 때 여러번 클릭", "랙이 걸린 느낌", "끊겼다가 다시 했거나" | **B02** S04, S05, S09; **B03** S03, S04; **B07** S03–S07; **B08** S02–S04 | Rushed, Slow-Laptop, Academy-WiFi |
| 17 | **Submit button hit multiple times.** | David's recurring suspect | "submit 여러번 클릭" | **B02** S09; **B03** (analogous); **B08** S02, S03 | Rushed, Speed Runner |
| 18 | **Multiple tabs open.** | David's recurring suspect | "tab 여러개" | **B12** all; **B22** S07 | Hostile, Confused First-Timer |
| 19 | **Browser back/forward used.** | David's recurring suspect | "브라우저에서 뒤로가기/앞으로가기" | **B09** S02–S05, S07; **B22** S05 | Habitual Refresher, Distracted |
| 20 | **Browser refresh used.** | David's recurring suspect | "refresh하기" | **B06** S01, S05, S07–S09; **B22** S04; **B09** S01 | Habitual Refresher, Recovering |
| 21 | **Window closed quickly after submit.** | David's recurring suspect | "submit하고 나서 버튼 좀 빨리 누르거나 바로 창을 끄거나" | **B09** S07, S08; **B22** S05 | Recovering, Speed Runner |
| 22 | **Network instability.** Academy WiFi quality. | David asked about this | "코어 오프라인 반 인터넷이 조금 불안정한가요?" | **B07** all; **B22** S16, S21 | Academy-WiFi, Mobile-Data |
| 23 | **AI grading took too long.** | 1 explicit report + multiple students confused | David Feb 9: "AI 서버가 반응이 일시적으로 느려서" | **B07** S15; **B26** S30 (grading timing); **B03** S04 | Anxious, Recovering |
| 24 | **Korean-typed responses graded unexpectedly.** | Implicit (students may have hit this and just disputed) | n/a explicit but inferred | **B26** S02, S19, S22; **B03** S06, S08 | Korean Native Typist, Code-Switching |
| 25 | **ESL English (typos, missing articles) graded unfairly.** | Implicit | n/a explicit but inferred | **B26** S08, S09, S17 | ESL Learner |

## Audit-batch coverage rollup

Each batch's primary chat-log patterns:

| Batch | Patterns it covers |
| --- | --- |
| **B00** Setup | (foundational) |
| **B01** Auth | n/a (auth wasn't the source of these issues) |
| **B02** MCQ Submission | #16, #17, #21 |
| **B03** Typed Submission | #5, #16, #17, #21, #23, #24 |
| **B04** Session Day 1 | #1 (baseline) |
| **B05** Session Day 2+ | #1, #3, #5 |
| **B06** Recovery/Resume | #7, #19, #20 |
| **B07** Network Resilience | #16, #22, #23 |
| **B08** Erratic Interaction | #17 |
| **B09** Browser Nav Traps | #19, #20, #21 |
| **B10** Blind Spot | (not in chat log) |
| **B11** Test Result + Challenge | #4 |
| **B12** Concurrent Multi-Tab | #18 |
| **B13** Extreme Inputs | (defensive) |
| **B14** Long-Running | #7 |
| **B15** Dashboard Variants | #10, #14 |
| **B16** Teacher Class Mgmt | #11 |
| **B17** Teacher List Editor | (defensive) |
| **B18** Teacher Gradebook | #13 |
| **B19** Teacher Challenge Review | #2, #4, #15 |
| **B20** Responsive | (defensive) |
| **B21** Accessibility | (defensive) |
| **B22** Day Progression Mechanics | **#1, #2, #3, #19, #20, #21, #22** (the biggest pattern bucket) |
| **B23** Challenge Token Economics | **#4, #15** |
| **B24** Class Transfer | **#6, #11** |
| **B25** Pace Algorithm | **#9** |
| **B26** AI Grading Correctness | **#5, #8, #24, #25** |

## Confidence statement for rollout

If B22, B23, B26, B07, B09 pass with no BLOCKERs, the audit gives high confidence the patterns above won't reappear in production:

- Patterns 1, 2, 3 (day progression) — B22's 21 scenarios across 9 personas, 2-week walks, every transition disrupted.
- Pattern 4 (token economics) — B23 covers depletion, recovery, multi-tab races.
- Patterns 7, 19, 20, 21 (state loss / nav traps) — B06, B09, B22 disruption walks.
- Pattern 8 (AI false negatives) — B26's verbatim probes against the actual grading function.
- Pattern 22 (network) — B07 covers offline, slow, intermittent, stalled.

If any of these surfaces a BLOCKER, **do not start the next student cohort** until the underlying issue is fixed.
