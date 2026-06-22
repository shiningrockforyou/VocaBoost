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

<!-- Add new events above this line, newest first: CS-YYYY-MM-DD — <title> -->
