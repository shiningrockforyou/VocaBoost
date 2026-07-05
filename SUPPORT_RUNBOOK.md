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

## CS-2026-06-28 — Grading-failure audit (26SM): 06-22 crash-recovery "malform" incident (already fixed), 0 data loss, + error-modal UX gaps

- **Scope:** read-only audit (no data touched). "Have any gradings *truly* failed for real students?" Cross-referenced `system_logs` (client-observed) + Cloud Functions logs (server-side) against `attempts`, 26SM only, full history.
- **Findings — client side (`system_logs`):** 660 `grading_attempt_failed` events, 06-18→06-28 — but mostly **retry-storms**; dedupe → **42 distinct failed test-sessions across 48 students**. Cross-ref vs `attempts` (match on `sessionType`+studyDay, plus "csd advanced past the failed day"): **36 graded-anyway, 6 advanced-past, 0 still stuck → 0 permanent lost grades.**
- **Root cause — the bulk (06-22 incident):** Cloud Functions logs (06-21→06-23) show **315 × HTTP 400**, of which **313 = "Malformed grading payload (likely client recovery dropped definitions)"** across 21 students, spiking at class hours (06h=93, 08h=80). This is the **typed-grading crash-recovery malform bug**: the test-phase recovery marker thinned the word pool to `{id, word}`, dropping `definition` → on mid-test reload the grade payload had `correctDefinition=undefined` for every word → whole batch rejected (all-or-nothing) → "Grading Failed" retry loop. **Already root-caused + FIXED** (change_action_log 2026-06-23: client persists `definition/definitions/partOfSpeech`; server `resolveAnswerDefinitions` backfills from the list + softened to auto-mark only unresolved rows wrong, throw only if EVERY row unprocessable). Logs confirm the fix landed: 400s collapse **313 (06-22) → ~2 (06-23) → ~12 total (06-23→06-28)**.
- **This explains CS-2026-06-24 (이가온/TGJNuQ1v, "stuck on LOADING" Day-10/11):** that account has many `grading_attempt_failed` on d10 (06-19) / d11 (06-22) — the same malform/grading failures, not a separate load hang. The manual advance bypassed it; root cause was the recovery-malform bug (now fixed).
- **Residual after the fix (the one open item):** ~12-16 failures = **`listId: null` → "Unresolvable grading payload"** (server can't backfill defs without a listId, so a thin payload still hard-fails) + 3 × `401 auth/id-token-expired` (session token expired mid-test). → NEED_TO_FIX.
- **Error-modal UX (answer to "what should students do on a grading pop-up"):** there are actually **two** modals, and they already distinguish the main cases:
  - **"Couldn't Save Your Results"** (yellow, `submitError`) = grading SUCCEEDED but the durable save failed → button **"Retry Save"** re-runs the write only (no re-grade). Copy correctly reassures "your answers are safe." → student should click Retry Save; their grade is captured.
  - **"Grading Failed"** (red, `gradingError`) = the grade call itself failed after 3 auto-retries → button **"Try Again"** (idempotent).
  - **Student guidance:** click the button — retries are **idempotent/safe** (won't double-count or lose work; a successful retake is detected). If "Try Again" fails *immediately* and repeatedly (deterministic error, e.g. the old malform case), **reload the test page and resubmit** — that rebuilds the payload with definitions, which is the actual fix. Progress is not lost.
  - **Gaps (→ NEED_TO_FIX):** (a) the red "Grading Failed" title is alarming/categorical and its body "Your answers are saved" is misleading (no graded attempt was written when grading truly failed); (b) on a transient/timeout error the server may have graded but the client still shows "Grading Failed" (no durable attempt yet → retry needed, but the copy implies loss); (c) deterministic errors (`invalid-argument`) auto-retry + "Try Again" loop uselessly — should detect and tell the student to reload instead.
- **Net:** truly-failed *calls* happened (06-22 incident, ~21 students) but were **already fixed**; **0 permanent lost grades**; residual is the `listId:null` tail + modal-copy clarity.
- Artifacts (read-only, gitignored): `dsg-edits/srv_validate/grading_failure_audit.mjs`, the two Cloud-Functions log exports.

## CS-2026-06-28b — Add SUMMIT to all ADV/FINAL 26SM classes without bumping anyone off ASCENT

- **Goal (David):** make SUMMIT (list `AObYOowhLoOOHx9wW2Sq`, 800 words) available on all 11 ADV/FINAL 26SM classes, WITHOUT changing any student's current list. ASCENT (`dVliNv0p`) = the active list (1600 words; ADV 80/day, FINAL 100/day).
- **Footgun (verified):** the default-list picker `getPrimaryFocus` (Dashboard.jsx:992) uses an explicit `users/{uid}.settings.primaryFocusListId` if set, else falls back to the **most-recently-assigned** list. Read-only audit: **200 of 215** enrolled students had NO explicit default → assigning SUMMIT (newest `assignedAt`) would have bumped all 200 onto SUMMIT Day 1, off their ASCENT progress (many at Day 15). Only 15 safe (11 explicit ASCENT, 4 other); 3 had finished ASCENT. Same class of bug as CS-2026-06-24b (박시은). **Do NOT add the list via the teacher UI** (stamps assignedAt=now).
- **Action (both safeguards, authorized; `dsg-edits/srv_validate/add_summit_safe.mjs --commit`):** (1) **BACKDATE** — assigned SUMMIT to all 11 classes with `assignedAt` = ASCENT's minus 1 day (2026-05-30 < 2026-05-31), settings (pace/threshold/testMode) copied from each class's ASCENT assignment; added to `assignments` map + `assignedLists`. (2) **PIN** — set `settings.primaryFocusListId=ASCENT` + `primaryFocusClassId` for the 200 fallback students (merge; experience unchanged — they already land on ASCENT). Left the 15 explicit-default students untouched.
- **Verify:** SUMMIT present 11/11, backdated < ASCENT 11/11; 200/200 pinned. Post re-check: **0 students on fallback, 0 classes where SUMMIT outranks ASCENT** → nobody exposed. data-integrity-sweep CLEAN before & after.
- **⚠️ Future:** re-assigning SUMMIT via the teacher UI would re-stamp it newest and re-expose any *future* unpinned student → re-backdate via the script if SUMMIT ever needs re-touching. Root fix = change the fallback to prefer the list with active progress (logged nice-to-have; folding into Phase 2 progress=student+list rework).

## CS-2026-06-29 — Save-failure incident (grade-token), grader "restating Korean def" bug, + 3 student fixes

Live class-time incident day. Four threads, all 26SM. data-integrity-sweep 26SM CLEAN before & after all writes.

### A. "Couldn't Save Your Results" hitting many students (durable-write reject) — MITIGATED
- **Symptom (TA channel):** multiple students across INT B2/B3 + 9 classes got the yellow `submitError` modal; **Retry Save did not fix it.**
- **Diagnosis (read-only):** 128 `attempt_write_failed_client` in 18h; **118 = `permission-denied` "requires a valid, fresh server grade token."** Token WAS minted (serverGraded), fresh (<24h), createdAt finite → the **HMAC verify at `submitVocabAttempt` rejected the save** under `GRADE_TOKEN_ENFORCED`. Retry Save can't fix it (re-sends same token, never re-grades). Root mechanism: the token binds `attemptDocId` (a localStorage-persisted nonce, `getOrCreateAttemptNonce`); when localStorage can't persist (in-app webviews/private/refresh) the grade-time docId ≠ save-time docId → HMAC mismatch. Confirmed via prod data: 4 students re-graded the SAME test under diverging nonces.
- **Action:** owner deployed **`GRADE_TOKEN_ENFORCED = false`** (functions/index.js:45) mid-day 06-29 (~11:14 KST). Verified live: new attempts now write `correctnessSource:null` (gate off) → saves succeed. **Engineering follow-up (NEED_TO_FIX, before re-enabling enforcement):** submit with the server-returned `attemptDocId` (don't let client regenerate it) + harden the nonce (sessionStorage/in-memory fallback). I cannot deploy (no CLI / admin SDK ≠ deploy creds) — owner deploys.

### B. Grader marked correct Korean answers wrong ("restating the Korean definition") — FIXED in deploy, but provenance gap
- **Symptom (TA):** 박시은 INT-E Ascent Day 6 — correct answers marked wrong; TA hand-graded 30/30.
- **Diagnosis:** her stored Day-6 (id …fh5rk4ri, 60% = 18/30) had **10 of 12 wrong = answers that matched VocaBoost's own Korean definitions** (표준화/복종/온순한/식민주의/다학제적인, verbatim KO-def fragments for adept/qualify/pristine/legitimacy/consequential). Only `alas` (genuinely wrong) + `oppressive` (negation typo) are real misses → true score **28/30 (93%)**. **Replaying her exact 30 answers through the LIVE grader now = 2/30 wrong, deterministic (4/4 runs)** → the bug is gone in the current deployment. Current prompt has the rule "answers matching the provided Korean definition → CORRECT" (committed 2026-03-10 in the mislabeled commit `0de81fb "apboost audit and updates"`).
- **Provenance gap (⚠️):** production emitted the "restating" failures **06-28 20:19 → 06-29 11:14 KST** (28 attempts), incl. her 10:19 test — i.e. the deployed grader did NOT match committed code until the ~11:14 KST 06-29 redeploy. The June-28 deploy shipped a stale grader artifact. → verify what commit each deploy builds from; the grader fix was hidden in an "apboost audit" commit.
- **Cohort sweep:** 28 restating-flagged failed attempts → only **1 still stuck** besides 박시은: `mkicsb0618@gmail.com` (유라시아 SAT Top, Day 6, 83%). **Re-graded with current grader = same 83% (29/35), still wrong on cavalier/maximal/imaginable/ethos/ornamental/glib → GENUINELY below threshold, NOT a grader victim** (string-match over-counts; re-grade is the real test). Everyone else recovered on retake. **Net grader-bug stuck-victims = 박시은 only.**

### C. Student fixes (manual-pass.mjs, valid anchors, sweep CLEAN before/after)
- **박시은 / sieunprida@gmail.com / class jDDw2GEu (26SM SAT Inter E [English only]) / Ascent (dVliNv0p):** grader-error correction. `manual-pass … jDDw2GEurOj5kD9JswI7 dVliNv0p 6 93` (28/30 verified score; nwsi 400/nwei 479, pace 80). Was stuck CSD=5. (This is the TA's "INT E Day 6.")
- **황정민 / jungminacc170078@gmail.com / class CKDTCxTT (26SM SAT Inter B2) / Base Camp (RmNNkuLP):** lost-save (incident A) — took Base Camp Day 6, save failed, closed the window before Retry (7 write-fails logged, all Day6/new/Base Camp), no cached grade. David: "pass 황정민." `manual-pass … CKDTCxTTvscEZAY1DbUN RmNNkuLPectBlBPiLbAJ 6 100` (manual, answers:[]; nwsi 400/nwei 479).

### D. 김선아 / hanna0801ha@gmail.com / class 6F0PX2E3 (26SM SAT Adv A1) — investigate only (no fix)
- **Symptom:** "Submit Test?" confirm modal — Go Back **and** Submit both dead (먹통). Screenshot = the pre-grade `ConfirmModal`.
- **Findings:** modal code is correct (clean `onConfirm`/`onCancel`, no disabled/overlay). Her saves WORK (3 gradings today, 2 attempts written, no write-fails). Scores 43→47→73% are **GENUINE** — wrong answers are real (speculate→"감독하다", blanks on caucus/zenith/caliber, abate→"힘", arrears→"폐합금") and post-fix (18:13 KST). NOT the grader bug. → dead buttons = **client-side freeze** (browser/tab/in-app webview), same environmental family as incident A. Recommend hard-refresh / real browser (not KakaoTalk in-app). Defensive UI hardening = candidate NEED_TO_FIX; couldn't repro from data.

## CS-2026-06-30 — 이주헌 class-change day-reset (Ascent duplication) → carry-forward + drop old classes

- **Student:** 이주헌 / jooheon0923@gmail.com / uid OCzwBwAb… . data-integrity-sweep 26SM CLEAN before & after.
- **Symptom (TA):** changed classes, his study DAY reset → words duplicated (re-studying already-known Ascent words).
- **Diagnosis (read-only):** enrolled in 3 classes. Did **Ascent days 1–8 in Adv A2** (Nys1FfB9, CSD=8/twi=640, real 100% passes). Moved to **Adv A1** (6F0PX2E3, same Ascent list) which started fresh at **CSD=1/twi=80** → fed him Ascent words 1–80 again. Root cause = **progress is keyed by (class, list)**, so a class change on the same list resets the day-counter (the Phase-2 "progress should be student+list" gap; same family as the getPrimaryFocus footgun). **study_states are student+list scoped** (doc id = wordId, has `listId`, NO `classId`) — verified he has **640 Ascent study_states** — so his *mastery* already follows him; only the counter was wrong. Cleanest possible carry-forward.
- **Action (David: "adv a1 is canonical, carry ascent to day 8, drop other classes after"):** (1) `manual-pass jooheon0923@gmail.com 6F0PX2E3gXetiI0Yw275 dVliNv0p 8 100` (his real Adv-A2 Day-8 score; nwsi 560/nwei 639, valid anchor). (2) set Adv A1 class_progress CSD 1→8, twi 80→640 (immediate). (3) cleared Adv A1 session_states (recompute → Day 9). (4) **dropped Adv A2 (Nys1FfB9) + Inter A2 (TyBnqbcc)**: removed from each class's `studentIds`, removed from `enrolledClasses`, deleted their class_progress + session_states under the user. Left historical attempts intact.
- **Verify:** enrolledClasses now = **only Adv A1**; progress = only `6F0PX2E3_Ascent` CSD=8/twi=640; most-recent passed-new = Day 8 → resumes **Day 9 (words 641+)**, no duplication; 640 Ascent study_states make reviews skip mastered words. Sweep CLEAN (ghostProgress 0, invalidAnchor 0, noClassAttempt 0).
- **Same-day investigate-only (no writes):** **박시준** (herosijun@gmail.com, INT A2) — "submit didn't count": both Day-1 submits DID save (67% real + 0% blank/accidental retake, 24/30 empty); stuck only because INT-A2 Base Camp threshold is **92%** and he hit 67% → retake or teacher-pass decision, NOT a fault. **조은호** (ellycho016@gmail.com, 유라시아 SAT Top) — "test words ≠ book 1201-1300": he's correctly on Ascent Day 1 (book numbers Ascent from 1201 = list position 0); list clean/contiguous; pending book-vs-app word comparison (sent the 100-word list).

## CS-2026-07-02 — 곽경훈 (Final B): accept aesthetics="미적", pass Day-4 Ascent

- **Student:** 곽경훈 / kwaknorinori@gmail.com / uid ikEf8P7U… / class KKQ0x7ki (26SM SAT Final B) / list Ascent (dVliNv0p, 100/day, passThreshold 92). Sweep CLEAN before & after.
- **Request (David):** "mark aesthetics/미적 as correct, pass him."
- **State:** latest typed = **Day 4 new**, 32/35 = **91% → failed** (threshold 92). The `aesthetics` row (studentResponse "미적") was **already student-challenged and teacher-REJECTED** (`challengeStatus:"rejected"`, reviewer 9OcxdnY…) — David is overriding that to accept. Other misses left as-is: `faithful`="신앙적인" (wrong), `supple`=blank.
- **Action:** corrected the real attempt (id …_new_1782964686497_6n8bwjrlh) — `aesthetics.isCorrect=true`, `challengeStatus:"accepted"` + note; recomputed **33/35 → score 94, retention 0.9429, passed=true**; `manualOverride:true` + manualReviewNote. Then session_state(Ascent) → `phase=review-study, newWordsTestPassed=true` so he proceeds to the Day-4 review → Day 5. class_progress left at CSD 3 (advances when he does the Day-4 review). Same pattern as CS-2026-06-25 (조예서).
- **Note:** this reverses a prior teacher challenge-rejection at David's instruction — recorded here for traceability.

## CS-2026-07-02b — 손진욱 (→Adv A1) & 박주하 (→Inter A2): class-change Ascent carry-forward

Both class-change carry-forwards (same family as CS-2026-06-30 이주헌: progress is (class,list)-keyed; study_states are student+list so mastery carries). Sweep CLEAN before & after.

- **손진욱 / sonjinug72@gmail.com / uid bn8NwX7J** — was enrolled ONLY in Adv B2 (`qIrJTbwl`), did Ascent Days 1–9 there (CSD=8/twi=640); TA (신동현) asked to move him to Adv A1. Action: **enrolled Adv A1** (`6F0PX2E3`, studentIds + enrolledClasses), **carried Ascent** → Adv A1 CSD=8/twi=640 (manual-pass Day-8 anchor score 97, nwei 639) → resumes **Day 9**; **dropped Adv B2** (unenrolled + deleted its class_progress/session). 720 Ascent study_states carry. default → Adv A1/Ascent.
- **박주하 / bagjuha477@gmail.com / uid fXsusIOb** — enrolled Adv A2 + Inter A2; did Ascent Days 1–5 in Adv A2 (CSD=5); Inter A2 had only BaseCamp Day 1. TA (김시연) asked Inter A2 Ascent to start Day 6. Action: **carried Ascent** Adv A2 → **Inter A2** CSD=5/twi=400 (manual-pass Day-5 anchor score 93, nwei 399) → resumes **Day 6**; default → Inter A2/Ascent. **Adv A2 left enrolled** (not dropped — TA only asked for the Day-6 carry; drop later if wanted). 400 Ascent study_states carry.
- **Self-caught issue:** I first built the new class_progress docs by spreading an existing student's (이주헌's) doc as a template — its only non-empty personal field was `programStartDate`, which leaked (both got 2026-06-29). Corrected: 손진욱→2026-06-24 (his earliest Ascent attempt), 박주하→2026-06-22 (his real Adv-A2 start). All other template fields were already empty/default (recentSessions [], streakDays 0, stats {null avgs}, no snapshot) = same as a fresh doc, so no further contamination. **Lesson: don't spread another student's progress doc as a template — set explicit fields.**

## CS-2026-07-03 — 김나연 (Inter A1): 93% shown as "fail" (retakeThreshold default bug + dual-class)

- **Student:** 김나연 / nayunkim777@gmail.com / uid y70xrW… . Sweep CLEAN before & after.
- **Symptom (TA):** got 28/30 vocab but screen shows **fail** and won't advance.
- **Diagnosis:** her Day-14 Base Camp test = **28/30 = 93%**, **server stored passed=true** (Inter A1 Base Camp threshold **92**), and her progress already advanced (CSD=14, session csd=15). But the client results screen showed "fail" and looped her into retakes (two Day-14 passed attempts today). Root cause = `TypedTest.jsx` `retakeThreshold` **defaults to 0.95** and only drops to the real 0.92 once it loads the class `passThreshold`; that load fell back to the default, so it compared 93% < 95% → "fail". Trigger: she was enrolled in **TWO Base Camp classes** — Inter B2 (`CKDTCx`, unused CSD=0) + Inter A1 (`k0j59bXv`, real CSD=14) — which breaks the client class/threshold resolution.
- **Action (David: "drop B2, make sure she's in A1"):** ensured Inter A1 enrollment (studentIds + enrolledClasses), **dropped Inter B2** (unenrolled + deleted its Base Camp class_progress CSD=0 + session_state), set default → Inter A1 / Base Camp. A1 progress (CSD=14/twi=1120) untouched. → single class now resolves threshold to 92 → her 93% reads as pass. She should reload (already on Day 15).
- **Follow-up:** the `retakeThreshold=0.95` default is a real client bug (higher than class thresholds → any threshold-load failure turns a genuine 92–94% pass into a displayed "fail"). Filed in NEED_TO_FIX. If she still sees "fail" after reload, escalate to that.

## CS-2026-07-03b — 김호형 (Adv E) 93%-shows-fail → cohort-wide newWordRetakeThreshold fix (no deploy)

- **Student:** 김호형 / **hperaszz**@gmail.com (TA typo'd "hoeraszz") / uid HMp1Qz / 26SM SAT Adv E [English only] (single class, Ascent). Symptom: 93% shows fail, TA thought the cutoff became 95% after a class promotion.
- **Diagnosis — where the 95% comes from:** NOT a real cutoff. Adv E's `passThreshold` is **92** (server uses it → his attempts are all `passed=true`, he's advancing CSD=9→Day 10). The **client** new-word gate uses a SEPARATE field, `newWordRetakeThreshold`, sourced at `studyService.js:267` (`assignment.newWordRetakeThreshold || DEFAULT_RETAKE_THRESHOLD`=**0.95**). **Class assignments never stored `newWordRetakeThreshold`**, so it fell back to 0.95 → `DailySessionFlow.jsx:1316` + `TypedTest.jsx:291`/results screen fail 92–94% scorers. (Code already comments this at studyService.js:1282.) Same root as CS-2026-07-03 (김나연); dual-class was a red herring — 김호형 is single-class. **No data fix for the student** (he's passing server-side).
- **Action (David: "do this for all classes, 0.92"):** wrote `newWordRetakeThreshold = passThreshold/100` onto **every class assignment** — **39 classes / 61 assignments**, 0 left missing. **Per-assignment, NOT a flat 0.92** (David said 0.92 but the cohort isn't uniform: distribution = 92×47, 90×10, plus 74/93/95/1). Forcing 0.92 on the 90- and 74-threshold classes (e.g. Inter B2 Ascent=74, Inter B4=90) would have re-created the exact server(<92)/client(0.92) mismatch, so each got its own: 92→0.92, 90→0.9, 74→0.74, 93→0.93. Verified (Adv E 0.92, Inter B2 Ascent 0.74, Inter B4 0.9, Final B 0.92).
- **Note:** takes effect on the **next session build** (student reload / next test) — the value is read when the session config is created, so anyone mid-session with a 0.95-baked sessionConfig should reload to pick it up. Durable code fix still open → NEED_TO_FIX #5.

<!-- Add new events above this line, newest first: CS-YYYY-MM-DD — <title> -->

## CS-2026-07-04 — 박혜린 (helenepark2010@gmail.com) "92% 안 됐는데 pass" → B2 Ascent 74%-threshold outlier fixed
- **Report (David):** SAT Inter B3 student 박혜린 — a sub-92% word test showed **pass**; teacher suspected a bug.
- **Diagnosis (read-only):** NOT a per-student bug. 박혜린 (uid KCTcG3bJ…) is actually in **26SM SAT Inter B2** (CKDTCxTT), not B3 (not in B3 roster — likely teacher misremembered). She studies the **Ascent** list (dVliNv0p), currently Day 5. Her passing tests: Day3 90%, **Day4 90% (27/30)**, Day5 97% — all `passed=true`. Correct, because **B2 Ascent's passThreshold was 74** (the "92" the teacher expected is Base Camp's value). Day-4 attempt carries a valid anchor (nwei 319, testId set); progression clean.
- **Cohort investigation (David: "2 and 3" — investigate then fix):** full Ascent threshold distribution = **92×21, 90×3, 74×1, 93×1**. B2's **74 is the sole sub-90 outlier**; mode is 92; **B3 itself is 92**. So 74 is a genuine mis-set, and 92 is the cohort-consistent + teacher-expected target.
- **Action (authorized, option 2):** set B2 Ascent (CKDTCxTT/dVliNv0p) **passThreshold 74→92, newWordRetakeThreshold 0.74→0.92**. Config-only; Base Camp (RmNNkuLP) untouched (92). Backup `dsg-edits/srv_validate/class_backups/CKDTCxTTvscEZAY1DbUN_prethresh.json`. Affects all 33 B2 students going forward; does NOT retroactively un-pass 박혜린's existing 90% (she's already Day 5).
- **OPEN (flagged, not changed):** a 90%-threshold tier remains — Ascent: 제주 CORE, B4, 제주 TOP (90); Base Camp: 제주 BRIDGE, Bridge TOP, B4, 미주 Bridge, Bridge CORE (90); plus 미주 Inter Ascent=93. These are internally consistent (nwt matches) and may be intentional per-class. Await David's call before touching.

## CS-2026-07-04b — Normalize ALL 26SM thresholds to 92% (cohort-wide, David)
- **Directive (David):** "All 26SM classes/lists threshold should be 92%."
- **Action:** set `passThreshold=92` + `newWordRetakeThreshold=0.92` on every 26SM class assignment where it differed. **8 classes / 18 field-writes** (the 90/0.9 tier + 미주 Inter Ascent 93/0.93): 제주 BRIDGE, Bridge (TOP), 제주 CORE, Inter B4 (both lists), 미주 Inter (Ascent 93→92), 제주 TOP, 미주 Bridge, Bridge (CORE). (B2 Ascent 74→92 already done in CS-2026-07-04.) Per-class backups `dsg-edits/srv_validate/class_backups/<id>_thresh92.json`.
- **Verify:** all **54/54** 26SM assignments now `92/0.92`, distribution `{"92/0.92":54}`, 0 outliers.
- Config-only; no student progress/attempts touched. Does not retroactively re-grade past attempts (server stored `passed` at submit time); applies to future tests.
