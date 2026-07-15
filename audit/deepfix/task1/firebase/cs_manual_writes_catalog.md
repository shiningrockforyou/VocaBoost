# CS manual Firebase-write catalog (26SM live) — from SUPPORT_RUNBOOK.md

**Purpose (David's 2026-07-13 directive).** Catalog every manual Firebase write made to fix issues by hand, so
the empirical cohort census can separate three populations: **(H) genuinely healthy**, **(P) hand-patched**
(looks healthy but a manual write masked a live bug), and **(B) still broken**. A student in state P is *evidence
of a live bug that reached a real student* even though their current data looks fine — so P-students are
first-class investigation evidence, not "resolved."

Source: `SUPPORT_RUNBOOK.md` CS event log (full read, 2026-06-21 → 2026-07-13). Column "kind": ATTEMPT =
wrote/edited a `passed` attempt (reconciliation anchor); PROGRESS = wrote `class_progress` csd/twi; SESSION =
wrote/cleared `session_states`; ENROLL = enroll/drop (studentIds/enrolledClasses + deleted docs); CONFIG =
class-assignment settings; SETTINGS = `users/{uid}.settings` (primaryFocus). "verify-live" = what to re-check in
the census.

## A. Per-student data writes (the population to re-verify empirically)

| Date | Student / email / uid(short) | Class(es) | Issue (root) | Writes (kind) | verify-live |
|---|---|---|---|---|---|
| 06-21 | hgk2480 (AdvA1), kimseongyun2024 (AdvA2), noaa.kimm (InterA1) | — | invalid anchors from a deleted scratch manual-pass | ATTEMPT ×4: backfilled nwsi/nwei/wordsIntroduced on manual attempts | anchors now valid? sweep invalidAnchor=0? |
| 06-24 | 이가온 gaonlee0909 · TGJNuQ1v | Final A | Day-11 load hang (unpinned) | ATTEMPT (manual-pass d10,d11,d12) + PROGRESS csd12/twi1200 + SESSION → Day13 | **root NOT fixed, bypassed**; is she stuck again? (later a Summit-finisher) |
| 06-24b | 박시은 sieunprida · jJAodkRO | Inter E | primaryFocus fallback bumped to Ascent | ATTEMPT (Ascent d1,d2)+reviews + PROGRESS csd2/twi160 + SESSION + SETTINGS primaryFocus=Ascent | Ascent progress consistent? |
| 06-25 | 조예서 0exey.7 · 9fkKxuF0 | Inter B2 | grader judgment (amnesty=대사) — teacher override | ATTEMPT edit (amnesty.isCorrect=true, recompute 93 passed, manualOverride) + SESSION | manualOverride flag present; #1 override-gap evidence |
| 06-29C | 박시은 sieunprida · jDDw2GEu; 황정민 jungminacc170078 · CKDTCx | Inter E; Inter B2 | grader "restating KO def"; lost-save | ATTEMPT (manual-pass Ascent d6 / BaseCamp d6) | grader-bug + save-fail evidence |
| 06-30 | 이주헌 jooheon0923 · OCzwBwAb | AdvA1 (kept) / AdvA2,InterA2 (dropped) | #6 class-change reset | ATTEMPT (AdvA1 Ascent d8) + PROGRESS csd8/twi640 + SESSION + ENROLL (dropped 2 classes, deleted their progress/session) | single-enroll now; twi640 vs study_states? |
| 07-02 | 곽경훈 kwaknorinori · ikEf8P7U | Final B | grader (aesthetics=미적) — **reverses a teacher REJECTION** | ATTEMPT edit (isCorrect=true, recompute 94 passed, manualOverride) + SESSION | override-gap evidence; challengeStatus flipped rejected→accepted |
| 07-02b | 손진욱 sonjinug72 · bn8NwX7J; 박주하 bagjuha477 · fXsusIOb | →AdvA1 (dropped AdvB2); →InterA2 (AdvA2 kept) | #6 class-change reset | ATTEMPT (Ascent d8/d5) + PROGRESS csd8/640, csd5/400 + ENROLL | **programStartDate leak self-caught+corrected**; verify PSD correct |
| 07-03 | 김나연 nayunkim777 · y70xrW | InterA1 (dropped InterB2) | #5 retakeThreshold 0.95 + dual-class | ENROLL (dropped B2, deleted its csd0 progress/session) | single-class; #5 evidence |
| 07-06 | 구기현 nodnarb72351 · sjrmkEa6 | Adv (kept) + Final | #6 promotion reset | ATTEMPT (Final Ascent d3 + AObYOowh d1) + PROGRESS csd2/240, csd1/80 | **Adv NOT dropped** — dual-enroll still live; carry consistent? |
| 07-07 | 최도훈 dohoonchoi0405 · IRcn5Ksb | Inter B4 | lost-save Day-16 (impossible session state) | ATTEMPT (manual-pass BaseCamp d16 score93) + SESSION newPass=true + PROGRESS twi1280 | impossible-state (day16/review/newPass=false) evidence |
| 07-07b | 조준모 junmo0405 · CYgY0clw | →InterA2 (dropped Bridge CORE, InterB3) | #6, 3-class consolidation, CROSS-PACE | ATTEMPT (BaseCamp d8 pace80) + PROGRESS csd8/twi640 + ENROLL | **twi640 credits words 600–639 UNSTUDIED** (study_states=600) — twi>mastery gap |
| 07-08 | 남세이 snam2113 · 8BvZR67f | →AdvE (kept IntE) | #6 promotion | ATTEMPT (AdvE Ascent d3) + PROGRESS csd2/240 + SESSION | IntE Ascent left stale twi160 (reconciles on load); dual-enroll |
| 07-08b | 신예나 yennashinbest · RfKCFSHf | →Final B (dropped AdvE) | #6 promotion CROSS-PACE | ATTEMPT (Final B Ascent d12 pace100) + PROGRESS csd12/twi1200 + ENROLL | pace80→100 boundary; twi1200 vs 1200 study_states OK |
| 07-09 | 이서현 emily1004enfj · fc8sBxnz | →B3 (dropped A3) | #6 dual-enroll, "15-question" | ATTEMPT (B3 BaseCamp d10 score97) + PROGRESS csd10/twi800 + ENROLL | dual-study artifact; test-size 15 (#13) evidence |
| 07-13 | 안이연 lisayiyeon; 유혜준 yuhyejun37; Lucy luckyjiu1004 | ADV[한] (OBtxUKiB) | #12 cross-class carry-miss | PROGRESS (derived csd/twi from EXISTING anchor, NO new attempt) csd5/420, csd10/800, csd11/880 + SESSION cleared | **#12 PRIMARY evidence**; derived-write (no attempt) — recon self-consistent? |
| 07-13b | 김동현 kimdongdongsuper1 · 0BhMnVjx | Adv B2 | #11 list-end (Ascent 1600/1600) | SETTINGS primaryFocus=SUMMIT | #11 list-end evidence; if he re-selects Ascent → re-#11 |
| 07-13c | Kaila kailachung2008; 김준서 junseogim728 · InterB3 | Final; Inter B3 | csd-undercount (Kaila); #11 THROTTLE (Junseo) | PROGRESS Kaila csd=3 (non-demoting); Junseo completed frozen d5 review-only csd4→5 (best review 0.70) | Kaila cross-class review-pair fail (#9-adjacent); Junseo interv 1.0→0.78; **Junseo d5 = benign reviewNoNewPass artifact** |
| 07-13f | 최다온 53202853; 한예진 annette.han; 최우성 ryanking5719 | Bridge TOP | #11 list-end (BaseCamp 1200/1200) | SETTINGS primaryFocus=Ascent + SESSION cleared | #11 list-end evidence |

## B. Cohort-wide CONFIG writes (change the policy surface, not per-student progress)

| Date | Scope | Write |
|---|---|---|
| 06-23b | 4 INT classes (A1,A2,B1,O) | added Ascent assignment (config-only) |
| 06-28b | 11 ADV/FINAL classes | added SUMMIT (backdated assignedAt) + pinned primaryFocus=Ascent for 200 fallback students |
| 07-03b | 39 classes / 61 assignments | wrote `newWordRetakeThreshold = passThreshold/100` (per-assignment; #5 interim mitigation) |
| 07-04 | Inter B2 Ascent | passThreshold 74→92, newWordRetakeThreshold 0.74→0.92 |
| 07-04b | 8 classes / 18 writes | normalized ALL 26SM thresholds → 92/0.92 (54/54 assignments now 92) |
| 07-13d/e | 32 classes / 37 assignments | ensure-all-lists (added missing Base/Ascent/Summit, backdated) + batch-advance 87 list-end students (SETTINGS primaryFocus) |

## C. Investigate-only (NO write) — pure diagnostic tickets (still evidence)
06-23 (formerly-stuck healthy), 06-24b-note, 06-29D (김선아 client freeze), 06-30-note (박시준 threshold, 조은호 book-vs-app),
07-06b (김재민 grader flag), 07-09b (이지후 #8 gradebook UI), 07-13 손지성 (carry OK), 07-13f 허은서 (not-#11).

## D. Population implications for the census (KEY)
- **~18 per-student ATTEMPT/PROGRESS patches** → these students' current data is DERIVED, not organically produced.
  The census must flag `manualOverride:true` attempts + manual-pass docIds (`..._manual`) + derived class_progress
  (csd/twi without a matching organic anchor) and treat those students as **state P (hand-patched)**.
- **Known residual inconsistencies from patches** to check empirically: (a) **twi > study_states count** where a
  cross-pace carry credited unstudied words (조준모 600→credited 640; possibly 신예나, others); (b) **dual-enroll
  still live** (구기현 Adv+Final; 남세이 IntE+AdvE; 박주하 AdvA2+InterA2) → two class_progress docs on one list, a
  live #6/#12 surface; (c) **derived-write recon consistency** (안이연/유혜준/Lucy csd/twi written with NO anchor
  attempt — does re-reconciliation on load agree?); (d) **benign reviewNoNewPass** (Junseo d5 + manual list-end
  finishers) that the sweep will flag.
- **Repeat root causes by frequency (patch count):** #6/#12 class-change carry (≈10 students: 이주헌, 손진욱,
  박주하, 구기현, 남세이, 신예나, 조준모, 이서현, +07-13 trio) ; #11 list-end (김동현, 최다온, 한예진, 최우성, 이가온,
  batch-87) ; grader override (#1/#2/#14: 조예서, 곽경훈, 김재민, 박시은, 황정민) ; #5 threshold (김나연, 김호형 →
  cohort-wide config fix). **The patch-frequency ranking is itself empirical evidence of which roots hurt most.**
