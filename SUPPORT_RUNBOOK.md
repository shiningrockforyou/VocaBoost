# VocaBoost — Support / CS Runbook

The single place for: (1) **defined CS scripts** (what to run for which problem), and (2) the **CS event log** (what we did, when, and why — so it's referenceable later).

**Golden rules**
- All admin scripts read Firebase Admin creds from `scripts/serviceAccountKey.json` (gitignored — never commit).
- Run from `/app`: `NODE_PATH=/app/node_modules node scripts/cs/<script>.mjs ...`. (Container can't run the Vite build; that's fine for admin scripts.)
- **Diagnose read-only first; write only with a derived/verified value.** Sweep before and after any write-bearing fix.
- 26SM = the REAL active cohort. 25WT = audit sandbox (`ta@` owner). Touch 26SM only for genuine CS fixes, never audits.
- A passed `new` attempt is the CSD/TWI **reconciliation anchor** — any script that writes one MUST set `newWordEndIndex` (+`newWordStartIndex`,`wordsIntroduced`,`testId`) or it creates an "invalid anchor" (see CS-2026-06-21).

---

## 1. Defined scripts (`scripts/cs/`)

| Script | Purpose | Mode | Usage |
|---|---|---|---|
| `data-integrity-sweep.mjs` | Scan a cohort for all known corruption signatures (dup/orphan progress, docId mismatch, implausible CSD, TWI>list, **invalid anchors**, `no_class` attempts, review-without-new-pass, ghost progress, missing programStartDate). | **READ-ONLY** | `node scripts/cs/data-integrity-sweep.mjs [classNameRegex=26SM]` |
| `manual-pass.mjs` | Unstick a student by writing a `passed:true` new-word attempt for a day — with a **VALID anchor** (full field set; derives word range from the student's pace). Replaces the old ad-hoc manual scripts that omitted `newWordEndIndex`. | WRITE (has `--dry`) | `node scripts/cs/manual-pass.mjs <email> <classId> <listId> <studyDay> <score> [--dry]` |

**Existing ad-hoc helpers in `scripts/`** (pre-catalog; use the `cs/` ones above when overlapping): `find-stuck-students.js`, `fix-stuck-students.js`, `advance-student-to-day.js`, `check-single-student.js`, `get-student-attempts.js`, `list-student-progress.js`, `delete-student-attempts.js`. ⚠️ `fix-stuck-students.js`/`advance-student-to-day.js` predate the valid-anchor requirement — verify they write `newWordEndIndex`, or migrate their callers to `cs/manual-pass.mjs`.

**Related app-side observability:** the CSD anomaly logs (`csd_anchor_invalid`, `csd_implausible`, `csd_anchor_query_error`) land in the `system_logs` collection on session load (shipped commit `9c162f6`/`7b5010e`). Watch them to catch invalid anchors / corrupt CSD as they occur, instead of only via sweeps.

---

## 2. Common problems → fix

- **"Grading Failed" loop** → root-caused + fixed in app (commit `1771876`: recovery snapshots dropping word definitions). If a student is still stuck on an old failure: `cs/manual-pass.mjs` for the affected day, then re-run the sweep.
- **Student stuck / day won't advance** → diagnose with `get-student-attempts.js` + `list-student-progress.js`; reconciliation rule = CSD derived from the most-recent **passed** new attempt (`twi = newWordEndIndex+1`; `csd = reviewExists(anchorDay) ? anchorDay : anchorDay-1`). If the anchor is malformed → `cs/manual-pass.mjs`.
- **Suspected data corruption (cohort-wide)** → `cs/data-integrity-sweep.mjs`.

---

## 3. CS event log

### CS-2026-06-21 — Invalid reconciliation anchors from manual-pass attempts (26SM)
- **Trigger:** read-only data-integrity sweep of all 26SM students (309) requested after the dashboard work.
- **Finding:** cohort overwhelmingly clean (0 across dup/orphan/docId/CSD/TWI/attribution/stuck). **3 students** (`hgk2480@gmail.com` Adv A1, `kimseongyun2024@gmail.com` Adv A2, `noaa.kimm@gmail.com` Inter A1) had `passed:true` new-word attempts **missing `newWordEndIndex`** → "invalid reconciliation anchors."
- **Root cause:** these were **manual-override attempts** (docId `..._day{N}_typed_new_manual`, fields `manualOverride`/`manualReviewNote`, no `testId`/`newWordStartIndex`/`newWordEndIndex`/`wordsIntroduced`) — written by a now-deleted scratch manual-pass script during live support (likely unsticking grading-failure victims, dates 6/09–6/12). The scratch script omitted the anchor fields.
- **Impact:** none broken. 2 students superseded by a later good anchor; 1 (kimseongyun, whose most-recent was the bad one) was protected by the existing `Math.max(storedCSD,csd)` reconciliation — not stuck.
- **Fix (write, authorized):** backfilled `newWordStartIndex`/`newWordEndIndex`/`wordsIntroduced` on the **4** manual attempts across the 3 students, derived from each student's verified pace (80/day) + neighbor attempts; stamped `anchorBackfilledAt`/`anchorBackfillNote`. Post-fix sweep = **0 findings, CLEAN**. (noaa day-10 anchorTWI 800 vs stored 720 is normal mid-day-10 lag, not corruption.)
- **Prevention:** created `scripts/cs/manual-pass.mjs` (always writes a valid anchor) + `scripts/cs/data-integrity-sweep.mjs` (reusable read-only sweep) + this runbook. The app-side `csd_anchor_invalid` log will now surface any future invalid anchor automatically.
- **Follow-up:** audit `scripts/fix-stuck-students.js` / `advance-student-to-day.js` for the same omission.

## CS-2026-06-23 — Typed-grading malform fix deployed; formerly-stuck students verified healthy

- **Context:** The "Grading Failed" loop (gradeTypedTest rejecting typed submissions as `invalid-argument`, 230 rejections / 14 real 26SM students on 2026-06-22) was fixed and deployed today (functions + client). Root cause: crash-recovery marker thinned the word pool, dropping definitions; fix = persist defs in the marker + server-authoritative definition resolution + write-path backfill. See change_action_log.md (2026-06-23) and PLAN_typed_grading_malform_fix_v1.md (v5).
- **Post-deploy validation (no data writes to real students):** server E2E 10/10 vs deployed callables (thin-payload resolves, forged-def ignored, unassigned rejected, backfill+writtenBy); browser E2E happy path (EN/KO, listId/classId sent, writtenBy:cloud-function) + Retry-Save UX (modal renders, no re-grade). All via audit student in 25WT sandbox, cleaned up.
- **Formerly-stuck students — NO intervention needed:**
  - 서준혁 (gejh0131@gmail.com) — manually unstuck 2026-06-22 (see that day's entry).
  - 정다인 (da.xn1j@gmail.com, uid Zuc4iziJ…) — SELF-RECOVERED: has a passed Day-1 new typed attempt (score 100, writtenBy client), session_state phase=review-study, newWordsTestPassed=true. Healthy; can proceed with review.
- **Orphan allowlist note (for class owner):** `KNOWN_ORPHAN_WRITES` in functions/index.js hardcodes 2 students (W3MUFXDb, fc8sBxnz) writing to list `7Is5UdS4P4` under class `teKHajON` — that list was unassigned mid-progress. The allowlist keeps them working. ACTION: the teacher should reassign the list or let them finish; remove the allowlist entries once done.

## CS-2026-06-23b — Add ASCENT to Base-Camp-only INT classes (prevent list-swap orphaning)

- **Why:** Students get "list reset to Day 1" when a class's list is **swapped** (Base Camp removed, Ascent added) instead of **added alongside** — their progress is keyed by (classId,listId) and becomes unreachable when the list is unassigned (e.g., 박한별/bergkamp0202: Base Camp Day-6 progress stranded under B2 after B2 went Ascent-only). Root cause = explicit unassign (assignListToClass only ADDS; unassignListFromClass is a separate confirmed action whose dialog misleadingly says "Student progress is saved"). Fix/prevention = every INT class should assign BOTH Base Camp + Ascent so the selector covers both and no one is stranded.
- **Action (authorized by David):** Added Ascent (dVliNv0p9jqZYp9rfLpN) to the 4 INT classes that had Base Camp but not Ascent — **A1, A2, B1, O** — copying each class's own Base Camp settings (typed, thr=92, pace=80, new=30, opts=6). Backups: `dsg-edits/srv_validate/class_backups/<id>.json`. Verified all 4 now have both. No student progress touched (config-only). Current Base Camp students undisturbed; Ascent becomes available when they reach Day 16.
- **Audit result (11 INT classes):** 10/11 now have both. **B2 (CKDTCx) is the anomaly — Ascent-ONLY, missing Base Camp** (someone unassigned Base Camp). PENDING DECISION: re-add Base Camp to B2 → recovers 박한별 + other B2 Base-Camp stragglers naturally (progress docs intact, just hidden). Re-add must be to B2 (where progress lives), with settings copied from a peer (B1).
- **Follow-up:** reword the unassign confirm in ClassDetail.jsx:389 ("Student progress is saved") → warn that mid-progress students lose access until re-assigned.

## CS-2026-06-24 — 이가온 (Final A) advanced past stuck Day-11 typed test

- **Student:** 이가온 / gaonlee0909@gmail.com / uid TGJNuQ1v… / class qeCkS6Bp (26SM SAT Final A) / list dVliNv0p (Ascent, typed, pace 100).
- **Symptom:** Day-11 단어시험 stuck on the LOADING screen, won't proceed; reproducible across devices (home too). Stuck since ~6/22.
- **Diagnosis (read-only):** list + Day-11 segment 100% clean (1600 contiguous words, 100 valid Day-11 words); session_state consistent (studied all 100, dismissed IDs all match the Day-11 segment). 0 grading logs since 6/22 → hangs at LOAD, before submit. Other Final A students pass Day 11+ (peer at csd 13) → student-specific, NOT a list/class issue. Root cause = an unreproduced client-side load hang on this account's Day-11 state — could NOT pin from DB alone. Note: Days 1-9 were in-app; Day 10 was already a manual pass (older script, incomplete anchor — missing testId/wordsIntroduced), so typed-test trouble is recent (Days 10-11).
- **Action (authorized by David, "advance 가온"):** `scripts/cs/manual-pass.mjs gaonlee0909@gmail.com qeCkS6Bp dVliNv0p 11 100` → valid anchor (nwsi 1000/nwei 1099/wIntro 100/testId set/manualOverride). Then session_state → phase=review-study, newWordsTestPassed=true, csd=11. data-integrity-sweep "Final A" CLEAN before & after.
- **2026-06-24 follow-up (David: "send her to day 13"):** advanced further to Day 13. Wrote Day-12 new anchor (manual-pass, nwsi 1100/nwei 1199) + Day-11 & Day-12 mcq review attempts (manual); class_progress → csd 12/twi 1200; session_state → Day 13 new-words-study (dismissed cleared). Reconciliation verified: most-recent passed-new = Day 12 + Day-12 review present → csd 12, twi 1200 → student lands on Day 13. Sweep CLEAN before & after. NOTE: she will now hit the Day-13 typed test — if the load hang recurs, she'll be stuck again (get the console screenshot then).
- **⚠️ Root cause NOT fixed — bypassed.** If the Day-11 review (MCQ) or Day-12 new (typed) hangs again, escalate. NEXT TIME they hit the loading hang, get a **browser-console screenshot** (F12) — that error pinpoints the actual bug. This student has now needed manual passes for Day 10 AND 11, so watch for recurrence at Day 12.

## CS-2026-06-24b — 박시은 (Inter E) → Ascent default + skip to Ascent Day 3

- **Student:** 박시은 / sieunprida@gmail.com / uid jJAodkRO… / class jDDw2GEu (26SM SAT Inter E, has Base Camp + Ascent, pace 80 typed).
- **Issue:** TA mis-guidance + stress; mother asked to start from Day 3. Was split across two lists — Base Camp Days 1-2 passed (Day-2 review pending) AND failing Ascent Day 1 x3. Root cause of the Ascent confusion: the getPrimaryFocus FALLBACK picks the most-recently-assigned list (Ascent, added 2026-06-22) for any student without an explicit selection, ignoring existing progress — so adding Ascent silently bumped Inter students onto the hard list. (See nice-to-haves.)
- **Action (David: "make ascent her default and let her start on day 3"):** manual-pass Ascent Day 1 + Day 2 (nwsi 0/79, 80/159) + Ascent Day-1/Day-2 reviews; class_progress(Ascent) csd 2/twi 160; session(Ascent) → Day 3 new-words-study; settings.primaryFocusListId → Ascent. Verified: anchor Day 2 + Day-2 review → csd 2 → Day 3. Sweep CLEAN before & after. Base Camp progress untouched (just no longer default).
- **Follow-up:** the getPrimaryFocus fallback (newest-assigned, progress-blind) is the systemic stress cause when a list is added — should prefer the list with active progress. Added to scripts/cs/nice-to-haves.md.

## CS-2026-06-25 — 조예서 (Inter B2) → accept TA-graded answer, unstick Day-7 typed test

- **Student:** 조예서 / 0exey.7@gmail.com / uid 9fkKxuF0… / class CKDTCxTTvscEZAY1DbUN (26SM SAT Inter B2) / list **Base Camp** (RmNNkuLP, typed, pace 80, passThreshold 92).
- **Symptom (TA report):** in yesterday's word test the TA hand-graded `amnesty`="대사" as correct and passed that item, but VocaBoost still showed the whole test as not-passed, so the student couldn't advance to the next Day.
- **Diagnosis (read-only):** Days 1-6 all passed; the **Day-7 new typed attempt** (…408748_8fhos08hc) scored **90% = 27/30, passed=false** (threshold 92). Three items the AI marked wrong: `amnesty`="대사", `migratory`="animal that migrates", `synthetic`="통합적인". The AI grade was technically correct (대사 = ambassador/dialogue, not amnesty/사면), but the TA chose to accept it. Accepting **just amnesty** → 28/30 = **93% ≥ 92 → passes**. The attempt already carried a valid anchor (newWordEndIndex 559, testId set), so no fabrication needed.
- **Action (per TA decision):** corrected the single disputed answer in the **real** Day-7 attempt — `amnesty.isCorrect=true` (note: "CS override 2026-06-25: TA accepted 대사"), recomputed 28/30 → score 93, passed=true, retention 0.9333, manualOverride flag + manualReviewNote. Then session_state(Base Camp) → phase=review-study, newWordsTestPassed=true so she proceeds to the Day-7 review and on to Day 8. **Did NOT touch migratory/synthetic** (TA only accepted amnesty). data-integrity-sweep "Inter B2" CLEAN (0 findings) before & after; invalidAnchor 0.
- **Note (not a bug):** this is a grading *judgment* discrepancy, not a VocaBoost fault — the system graded a wrong answer correctly; the teacher overrode it. Preferred resolution is to correct the actual attempt (honest re-grade) rather than write a synthetic manual-pass. If TAs frequently want to override single items, a teacher-facing "accept this answer / re-grade" control would remove the need for CS scripts (candidate nice-to-have).

<!-- Add new events above this line, newest first: CS-YYYY-MM-DD — <title> -->
