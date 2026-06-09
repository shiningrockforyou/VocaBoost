# TA-CHALLENGE Audit Findings

## STATUS BLOCK

| Field | Value |
|---|---|
| agent | TA-CHALLENGE |
| run date | 2026-06-02 |
| student login | OK — `audit_careful_01_core@vocaboost.test` (UID `fNDvwIEDXphlv8BD4rxYygHOSvD3`) |
| teacher login | OK — `ta@vocaboost.com` (UID `coJxSKLgUyXkTicsCwFigsPgfnx2`) |
| persona used | `audit_careful_01_core@vocaboost.test` (classId `LVjBTFuYE8FbPG34pVAt`, CORE OFFLINE) |
| challenge filed? | YES — 2 challenges filed via student Gradebook UI |
| teacher review possible? | NO — blocked by seeding data issue (see Finding #1 Blocker) |
| score/CSD/token verdict | UNVERIFIABLE via E2E (teacher review blocked); code analysis shows correct design |
| writes performed | 2 challenges filed (audit persona only) — `users/fNDvwIEDXphlv8BD4rxYygHOSvD3/challenges.history` + `attempts/...answers[0,1].challengeStatus=pending` |
| 26SM classes touched? | NO — zero contact |
| Admin-SDK writes? | NO — Admin SDK used for reads only |
| real students touched? | NO — all writes to `audit_careful_01_core@vocaboost.test` only |

---

## Pre-Audit State (Admin SDK verified)

| Field | Value |
|---|---|
| `challenges.history` | [] (empty) |
| Available tokens | 5/5 |
| `class_progress[LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR].currentStudyDay` | 0 |
| Attempt `..._new_1780179723493_o00czrkub` score | 0 (0/25 correct) |
| Attempt passed | false |
| Attempt teacherId | `9OcxdnYCCGZYOrzfs09pUTUoDOR2` (veterans@vocaboost.com) |
| Class `ownerTeacherId` | `coJxSKLgUyXkTicsCwFigsPgfnx2` (ta@vocaboost.com) |

---

## Writes Performed (audit persona only)

1. **Challenge 1 filed** (2026-06-02T14:28:49.784Z): `wordId=KWzkd5TdyGn1w6oaMaTE` ("compulsion"), note "Audit test challenge - testing challenge review lifecycle"
   - `attempts/.../answers[0].challengeStatus = 'pending'`
   - `users/fNDvwIEDXphlv8BD4rxYygHOSvD3/challenges.history[0]` = `{status:'pending', replenishAt: 2026-07-02}`
2. **Challenge 2 filed** (2026-06-02T14:37:27.324Z): `wordId=6E5E7W8j54hk3ttzKnIq` ("defiance"), note "Second audit challenge test"
   - `attempts/.../answers[1].challengeStatus = 'pending'`
   - `users/fNDvwIEDXphlv8BD4rxYygHOSvD3/challenges.history[1]` = `{status:'pending', replenishAt: 2026-07-02}`

**Post-audit state (Admin SDK verified):** `challenges.history.length=2`, both `status=pending`, tokens=5/5 (unchanged — correct, pending does not cost tokens).

---

## Findings

### Blocker — F-CHAL-01: Teacher Cannot See Any Student Attempts in Gradebook (teacherId Mismatch)

**Where:** `/gradebook` (teacher view), class CORE OFFLINE  
**Evidence:** Console error `"Error loading attempts: FirebaseError: Missing or insufficient permissions."` (captured in Playwright run). Teacher gradebook shows "Showing: 0 results" / "Search for your students' results" even after navigating to `?classId=LVjBTFuYE8FbPG34pVAt`.  
**Screenshots:** `teacher_03_gradebook_nofilter.png`, `teacher_05_class_gradebook.png`, `teacher_06_class_gradebook_10s.png`

**Root cause (Admin SDK verified + code analysis):**
- The seeded attempt (`...new_1780179723493_o00czrkub`) has `teacherId = 9OcxdnYCCGZYOrzfs09pUTUoDOR2` (veterans@vocaboost.com).
- `ta@vocaboost.com` UID is `coJxSKLgUyXkTicsCwFigsPgfnx2` — different.
- `queryTeacherAttempts` in `db.js` (line 1922–1924) runs `where('teacherId', '==', teacherId)` where `teacherId = ta@.uid`. Zero attempts match.
- **Firestore security rule** (`/attempts/{attemptId}`) grants read only when `resource.data.teacherId == request.auth.uid`. Even a direct `fetchAttemptDetails(attemptId)` fails for ta@.
- The class's `ownerTeacherId` IS correctly set to ta@'s UID — the mismatch is in the seeded attempt data. When `submitTestAttempt` runs in production it correctly reads `ownerTeacherId` from the class doc (line 1197) and stamps it on the attempt. The seeded legacy attempts bypassed this path.

**Impact:** Teacher CANNOT:
- See any student attempt rows in their gradebook
- Open an attempt detail drawer
- See "Pending Challenge" badges
- Accept or reject challenges filed by students

**Repro:** Login as ta@vocaboost.com → Gradebook → observe 0 results. Console shows "Missing or insufficient permissions."

**Expected:** Teacher should see all 12 seeded attempts for CORE OFFLINE students, including the 2 pending challenges filed by `audit_careful_01_core`.

**Remediation options:**
- (A) Re-seed the test attempts with `teacherId = coJxSKLgUyXkTicsCwFigsPgfnx2` (ta@.uid). This is the cleanest fix for the audit environment.
- (B) Add a `teacherIds` array field or fall back to `ownerTeacherId` in the query when `teacherId` is absent/mismatched.

---

### High — F-CHAL-02: "Pending Challenge" Table-Row Badge Never Visible (Lazy-Load Strips Answers)

**Where:** `/gradebook` (both student `challengeMode=submit` and teacher `challengeMode=review`), table row badge  
**Evidence (code analysis + Playwright):** The badge code at `Gradebook.jsx:1108`:
```js
{attempt.answers?.some((a) => a.challengeStatus === 'pending') && (
  <span className="bg-amber-100 ...">Pending Challenge</span>
)}
```
depends on `attempt.answers` being populated. But `queryStudentAttempts` (db.js line 2209) and `queryTeacherAttempts` (db.js line 2031) both set `answers: []` in the enriched attempt — comments say "Lazy load on demand". 

**Playwright confirmation:** Student gradebook table row shows 0 "Pending Challenge" badges despite 2 pending challenges in Firestore (verified via Admin SDK). The badge IS correctly shown inside the attempt details drawer (after lazy-load via `fetchAttemptDetails`).

**Impact:** Students cannot see at a glance which attempts have pending/accepted/rejected challenges from the gradebook list. Teachers cannot identify which attempts need review without opening each one individually. This defeats the purpose of the at-a-glance badge.

**Repro:** File a challenge → return to Gradebook → table row shows no badge. Open detail drawer → "Challenge Pending" is visible.

**Expected:** The table row shows an amber "Pending Challenge" badge when any answer in the attempt has `challengeStatus === 'pending'`.

**Fix options:**
- Include `answers` (or just a derived `hasPendingChallenge` boolean / `pendingChallengeCount`) in the enriched attempt object returned by both query functions.
- Or: read `hasPendingChallenge` from a top-level field on the attempt document itself (denormalize).

---

### High — F-CHAL-03: No Dedicated Teacher Challenge Inbox — Discovery Requires Opening Each Attempt

**Where:** Teacher `/gradebook`, `/classes/{classId}`  
**Evidence (Playwright):** The teacher has no dedicated "Challenges" inbox, notification badge, or filter. There is no top-level summary showing "N pending challenges need review." The class detail page has only an "Open Gradebook" button that leads to the same 0-result page (see F-CHAL-01). Discovery path requires: teacher visits gradebook → applies class/student filter → opens each attempt row → checks the drawer for pending challenges. This is O(attempts) manual work.

**Screenshots:** `teacher_02_classes.png`, `teacher_class_01_detail.png`, `teacher_class_02_after_gb_tab.png`

**Impact:** In a class with 66 students and many daily attempts, a teacher has no efficient way to find outstanding challenges. Challenges may go unreviewed indefinitely.

**Repro:** Login as teacher → any class → no challenge count anywhere on dashboard/classes/gradebook.

**Expected:** A challenge inbox or at minimum a filtered view showing only attempts with pending challenges, accessible from the teacher dashboard or class detail page.

---

### Medium — F-CHAL-04: Attempt `completedAt` Field Missing

**Where:** Firestore `attempts/` collection, seeded attempts  
**Evidence (Admin SDK):** The recent test attempt `fNDvwIEDXphlv8BD4rxYygHOSvD3_vocaboost_test_..._new_1780179723493_o00czrkub` has `completedAt: missing` (field not present). It has `submittedAt` only. The enriched attempt date calculation falls back to `new Date()` (current time) when `submittedAt` is also missing.

**Impact:** The attempt date shown in the student's gradebook as "May 30, 2026" actually comes from `submittedAt`; if `submittedAt` were also absent, it would show today's date. This is a data consistency concern in the seeded attempt.

---

### Medium — F-CHAL-05: Token Count Display Reads from Firestore on Each Drawer Open (No Optimistic Update)

**Where:** Student gradebook `challengeMode=submit` drawer  
**Evidence (code analysis, db.js line 2371+, Gradebook.jsx line 1154–1162):** Each time a student opens an attempt drawer, the code re-fetches `users/{uid}` from Firestore to recalculate `availableTokens`. After filing a challenge and re-opening the drawer, the token count still shows "5/5 remaining" which is technically correct (pending doesn't consume tokens), but there's a brief window where `isSubmittingChallenge=true` and a Firestore error could leave the UI inconsistent. No optimistic UI update is applied.

**Impact:** Minor UX — but if a network error occurs mid-filing, the token display may be stale.

---

### Nitpick — F-CHAL-06: Class Detail "Gradebook" Tab Navigates Away Instead of Embedding

**Where:** `/classes/{classId}` → Gradebook tab  
**Evidence (Playwright):** Clicking the "Gradebook" tab on the class detail page navigates to `/teacher/gradebook` (the global gradebook), losing the class context. For teachers who want to see all attempts for a specific class, the transition is confusing — the URL in the nav bar is `/teacher/gradebook` not `/classes/{classId}/gradebook`.

**Screenshot:** `open_gb2_02_gb_tab.png`

**Expected:** Either navigate to `/gradebook?classId={classId}` with pre-applied class filter, or embed an inline gradebook view.

---

## Score/CSD/Token Analysis (Code + Attempted E2E)

The teacher review (accept/reject) lifecycle could not be fully exercised end-to-end in the UI because of Finding F-CHAL-01 (teacher cannot read the attempt). However, code analysis of `reviewChallenge` in `db.js` (lines 2602–2800) provides the following assessment:

### Score Calculation (Code Analysis)

```js
// db.js line 2649–2657
const correctCount = updatedAnswers.filter((a) => a.isCorrect).length
const denom = attemptData.totalQuestions || updatedAnswers.length
const newScore = denom > 0 ? Math.round((correctCount / denom) * 100) : 0
```

The denominator uses `attemptData.totalQuestions` (persisted canonical count = 25) rather than `updatedAnswers.length`. This correctly prevents inflation from partial/skipped attempts. **PASS** (code is correct).

**Example for this attempt:** If one challenge is accepted on a currently-0/25 attempt, score = `round(1/25 * 100) = 4%`. No inflation.

### CSD Guard (Code Analysis)

```js
// db.js lines 2757–2760
const attemptStudyDay = attemptData.studyDay
const isCurrentBoundary =
  Number.isInteger(attemptStudyDay) && attemptStudyDay === currentDay + 1
```

For this attempt: `studyDay=1`, `currentStudyDay=0` → `isCurrentBoundary = (1 === 0+1) = true`.

The guard then only advances CSD if `isCurrentBoundary` AND the old score was below the threshold AND the new score is at/above the threshold. Since `passThreshold=90` and accepting 1 challenge brings score from 0% to 4%, the condition `oldScore < threshold && newScore >= threshold` is `false` → CSD does NOT advance. **PASS (by design).**

If all 25 challenges were accepted: score = `round(25/25 * 100) = 100% >= 90%` → CSD would advance from 0 to 1. Since `isCurrentBoundary=true` and it's not `isFirstDay` (check: `currentDay=0, isFirstDay = currentDay === 0 = true`) → the "Day 1 New Word Test pass OR Review Test pass" branch executes: increment day and TWI. This appears correct.

### Token Model (Code Analysis)

- **File challenge:** `replenishAt` is set to +30 days, `status=pending`. Does NOT deduct tokens immediately. `getAvailableChallengeTokens` counts active rejections (entries with `status='rejected'` AND `replenishAt > now`). Tokens = 5 - activeRejections. **Correct design.**
- **Accept:** `reviewChallenge` updates `challenges.history[i].status = 'accepted'`. No `replenishAt` change. Token count unchanged. **Correct.**
- **Reject:** `challenges.history[i].status = 'rejected'`. The `replenishAt` was already set at filing time (+30 days). After rejection, `getAvailableChallengeTokens` counts this as an active rejection → tokens = 5 - 1 = 4. **Correct.**

**Note:** One subtle edge case: `replenishAt` is set at **filing** time, not at **rejection** time. So the 30-day window starts from when the challenge was filed, not from when the teacher rejected it. If a teacher takes 29 days to reject, the token replenishes 1 day after rejection. This is technically correct per the spec but may feel unexpected to users.

---

## Summary

| Finding | Severity | Status |
|---|---|---|
| F-CHAL-01: teacherId mismatch blocks all teacher gradebook access + challenge review | Blocker | Open |
| F-CHAL-02: "Pending Challenge" table-row badge never shows (lazy-loaded `answers: []`) | High | Open |
| F-CHAL-03: No teacher challenge inbox — discovery requires opening every attempt | High | Open |
| F-CHAL-04: `completedAt` field missing on seeded attempt | Medium | Open |
| F-CHAL-05: No optimistic token update after challenge filing | Medium | Open |
| F-CHAL-06: Class detail Gradebook tab navigates away instead of filtering | Nitpick | Open |

**Total: 1 Blocker, 2 High, 2 Medium, 1 Nitpick**

---

## Safety Confirmation

- All writes performed solely against audit persona `audit_careful_01_core@vocaboost.test` (UID `fNDvwIEDXphlv8BD4rxYygHOSvD3`)
- No writes to any real student, no writes to 26SM classes, no out-of-scope classes touched
- Admin SDK was used READ-ONLY throughout (no `setDoc`/`updateDoc`/`deleteDoc` via Admin SDK)
- No `ta@` teacher actions completed (blocked by F-CHAL-01 before any write attempt)
