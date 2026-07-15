# I-10 — C-19 promotion permission gap: PINNED

**Investigator:** code-investigator (Task 1.6, WS-C I-10). **Date:** 2026-07-13. **Method:** read-only working-tree
trace (no live Firebase). Builds on `H1_GATE_1.5.md` correction 4 ("UI/query-scoped, not rules-scoped") — which this
investigation **partially corrects** (§4). Every claim tagged `{claim, evidence:file:line, confidence}`.

**Verdict: C-19 is PINNED → upgrade `plausible-unverified` → `verified-evidence` (code-traced; live-data reconfirm
via F-6b still recommended).**

---

## §1 The mechanism in one sentence

An attempt is **permanently stamped at write time** with `classId` = the launching class and `teacherId` = that
class's **`ownerTeacherId`**; every teacher-side surface — the gradebook query, the challenge-review authz check,
AND the attempts Firestore rules — is keyed to that immutable `attempt.teacherId` stamp, so after a promotion
A→B **no account except A's owner-teacher can ever list, read, or act on the attempt**, while A's own gradebook
simultaneously goes blind to the student because its name/roster maps are rebuilt from **current** class members.
Permission follows the *stamp*; nothing follows the *student*.

## §2 The stamp (write-time provenance — three writers, same rule)

| # | Writer | Evidence | Confidence |
|---|---|---|---|
| S1 | MCQ/generic client writer: `teacherId = classDoc.ownerTeacherId` of the launching `classId` | `src/services/db.js:1194-1204` (lookup), `:1233-1242` (stamped onto attempt) | verified |
| S2 | Typed client writer: same lookup + stamp | `src/services/db.js:1353-1364` (lookup), `:1367-1372` (`classId`, `listId`, `teacherId` stamped) | verified |
| S3 | Server writer (`writeAttemptTxn` via `assertCanWriteAttempt`): `teacherId = classData.ownerTeacherId` | `functions/index.js:348-349` | verified |
| S4 | Nothing ever re-stamps: promotion tooling (`removeStudentFromClass`) touches only `studentIds`/`members`/`enrolledClasses` — attempts keep the old stamp forever | `src/services/db.js:394-429`; no attempt-rewrite path found (grep `teacherId` across src + functions) | verified |

## §3 The three stacked predicates (the pinned gap)

**P1 — Visibility (the operative UX gap).** The teacher gradebook's ONLY query predicate is
`where('teacherId','==',teacherId)`:
- `src/services/db.js:1924-1928` — `query(collection(db,'attempts'), where('teacherId','==',teacherId), orderBy('submittedAt','desc'))`. **verified**
- Wired to the page: `src/pages/Gradebook.jsx:27` (`queryFn = queryTeacherAttempts`), `:304` / `:394` (called with `user.uid`). **verified**
- The "Pending Challenge" badge and the Accept/Reject drawer exist ONLY inside this teacherId-scoped list
  (`Gradebook.jsx:1114-1118` badge; `:1366-1408` review UI). There is **no other challenge inbox anywhere**
  (grep: `reviewChallenge` called only from `Gradebook.jsx:1380/:1396`). **verified**
- ⇒ **B's teacher can never see the A-stamped attempt or its pending challenge.** The class filter
  (`db.js:1931-1935`, `where('classId'...)`) only narrows further — it cannot widen past the teacherId base predicate.

**P2 — Actionability (the exact "권한이 없습니다" line).** Even given the attemptId, `reviewChallenge` hard-throws
for any caller whose uid ≠ the stamp:
- `src/services/db.js:2665-2668` — `if (attemptData.teacherId !== teacherId) throw new Error('Unauthorized: You are not the teacher for this attempt.')`. **verified**
- This error string is the near-certain source of the TA report "승반한 친구라 저희가 단어 권한이 없습니다"
  (양서현 07-08): B-side staff attempting to act on an A-stamped attempt. **high-confidence inference** (log↔code match; not reproduced live).

**P3 — Rules backstop (CORRECTION to the H1-gate refinement — see §4).** The attempts rules enforce the SAME
teacher-of-record scoping:
- `firestore.rules:101-105` — attempt **read** requires `studentId == uid || teacherId == uid` ⇒ B's teacher gets
  permission-denied even on a direct doc read. **verified**
- `firestore.rules:114-118` — teacher **update** requires `resource.data.teacherId == request.auth.uid && isTeacher()`. **verified**
- ⇒ even a hand-crafted client bypass of P1/P2 is rules-blocked on the attempt doc itself.

**P4 — The old teacher goes blind too (why the challenge is orphaned, not just misrouted).** A's owner-teacher CAN
still list the attempt (stamp matches), but after the student is removed from A's roster:
- `getTeacherData` builds name/roster maps from **current** `classes/{id}/members` of **currently owned** classes —
  `src/services/db.js:1786` (`fetchTeacherClasses`, which is `where('ownerTeacherId','==',uid)` per `:336-344`),
  `:1805-1827` (members → `studentIdToNameMap`/`studentNameToIdMap`). **verified**
- Name search for the promoted student ⇒ `filterStudentIds = []` ⇒ **hard empty return**:
  `src/services/db.js:1892-1896` (name→id match against current roster) + `:1913-1921`
  (`if (hasNameFilter && filterStudentIds.length === 0) return { attempts: [] ... }`). **verified**
- Unfiltered/date-only view: the attempt still appears but renders as **'Unknown Student'**
  (`db.js:1998` `studentIdToNameMap.get(studentId) || 'Unknown Student'`), buried in the 50-row
  paginate-then-post-filter window (C-33; post-filters at `db.js:1982-1995`). **verified**
- ⇒ A's TA experiences "student not found"; B's TA experiences "no permission". The pending challenge dangles on
  an attempt no one is operationally looking at.

**Student side is NOT the gap:** `queryStudentAttempts` base predicate is `where('studentId','==',studentId)`
(`src/services/db.js:2113-2117`) with no enrollment gating, and challenge submission authz is
`attempt.studentId === uid` (client `db.js:2594-2597`; server callable `functions/index.js:648-650`;
rules `firestore.rules:106-107, 115-116`). A promoted student can still see the old attempt and spend a token
challenging it (`SERVER_CHALLENGE_WRITE = false` → legacy client path live, `src/config/featureFlags.js:20`,
`db.js:2562-2566`) — the challenge then lands in a pending state that effectively **no one reviews** (P1+P4).
Cosmetic: the old class's name may not resolve in the student's own view (`db.js:2078-2092` builds the class-name
map from current `enrolledClasses` only). **verified**

## §4 Correction to H1_GATE_1.5 correction #4

H1 gate stated C-19 is "UI/query-scoped, NOT rules-scoped — `firestore.rules:34-48` are permissive." That cite
covers **only `users/{userId}` and its subcollections**. The **attempts** block was not examined there:
`firestore.rules:102-105` (read) and `:114-118` (update) DO scope teacher access to `resource.data.teacherId`.
So C-19 is enforced at **both** the query layer (P1, the operative one) **and** the rules layer (P3, the backstop);
the genuinely permissive surface is the users-subcollection write breadth (§7). The gate's practical conclusion
("trace the query predicate, not the rules") was still the right instruction — P1 is what users hit first — but any
C-19 fix that only changes the query will now hit the rules backstop and must change `firestore.rules:102-118`
in the same release. `{claim: partial correction of H1 refinement, evidence: firestore.rules:101-118, confidence: verified}`

## §5 Scenario walk-through (student S, promoted A→B, failed/challengeable attempt stamped classId=A)

1. **Who can SEE it:** only the account where `uid === attempt.teacherId === A.ownerTeacherId` (db.js:1926;
   rules:102-105). B's owner-teacher: never (different uid). A's owner-teacher: yes in unfiltered/class-A-filtered
   views (as 'Unknown Student' if S was removed from A's members, db.js:1998), **no** via name search
   (db.js:1917-1921 empty-return).
2. **Can B's TA act on it (challenge-accept / grade)?** **No, at three independent layers:** can't list it
   (db.js:1926), `reviewChallenge` throws (db.js:2666), rules deny read+update (rules:102-105, 114-118). There is
   no override path at all (C-16 product-gap) and no server-side reviewChallenge callable (grep: none in
   functions/index.js — only `submitChallenge`, `functions/index.js:626-678`).
3. **The pinned gap:** permission is keyed to the immutable write-time `attempt.teacherId` stamp
   (db.js:1194-1204/1353-1364, functions/index.js:348) — **visibility predicate `db.js:1926`**, **action predicate
   `db.js:2666`**, **rules predicates `firestore.rules:102-105 + 114-118`** — while both teachers' operational
   views follow **current roster membership** (db.js:1805-1827, 1917-1921). The attempt's permission set and the
   student's staffing set become permanently disjoint at the moment of promotion.

**Variants / boundary cases:**
- **Same-owner promotion (A and B owned by one teacher account):** no gap — stamp still matches; explains why C-19
  presents intermittently across the cohort. `{evidence: db.js:336-344 single-owner model, confidence: verified-by-construction}`
- **`teacherId = null` attempts** (classId absent at save, or class doc unreadable — db.js:1194-1204 catch path;
  `functions/index.js:348` `|| null`): invisible to EVERY teacher (`where('teacherId','==',uid)` never matches null;
  rules:104 read denied) and unactable by anyone (db.js:2666 throws for all) — a permanent challenge dead-end class.
  **verified (code); population unmeasured → fold into F-6b.**
- **Class A deleted post-promotion** (`deleteClass` db.js:387-392 deletes only the class doc): attempts stay
  actionable by A's owner account, but class renders 'No data' (db.js:2008) and the roster blindness (P4) is total.
- **Even the happy path mis-lands:** if A's teacher DOES accept the challenge, the day-progression unlock writes to
  the **old class identity** — `users/{S}/class_progress/{classIdA}_{listId}` and
  `session_states/{classIdA}_{listId}` (`db.js:2791-2792`, `:2813-2820`, `:2831-2836`) — while S now studies under
  `{classIdB}_{listId}`. The score/study_state correction carries (global, `db.js:2755-2766`), and the flipped
  `passed:true` (db.js:2727-2731) becomes a list-scoped recon anchor, but the direct session unlock lands on a doc
  S no longer runs. CR-1/C-01 interplay — the challenge-accept path re-derives C-19's harm even when permission
  exists. `{confidence: verified (code-traced); runtime carry-via-recon not empirically confirmed}`

## §6 Convergence (north-star N1/N4)

Permission must follow **the attempt / the (student, list)**, not the write-time class stamp and not current
enrollment alone. Concretely, the C-19 fix (and the C-16 override + C-29 lockdown it gates):
1. **Authz set = union**, server-side: `attempt.teacherId` (teacher of record) **∪** any teacher T where S ∈ a
   class owned by T *currently* (the `renameStudent` pattern — role check + `ownerTeacherId` over the student's
   `enrolledClasses`, `functions/index.js:1847-1875`). Note the codebase already contains BOTH models
   (reviewChallenge = stamp-only; renameStudent = current-enrollment-only); C-19 is precisely the disjunction
   neither implements.
2. **Do it in a Cloud Function** (`reviewChallenge` → callable, as the rules TODO itself prescribes,
   `firestore.rules:39-44`), so the attempts-rules backstop (`:114-118`) and the users-subcollection breadth (§7)
   can BOTH be tightened without breaking the flow. Sequencing: this is the same W1/W2/W3 train as C-29 (X1).
3. **Read surface:** the teacher gradebook query needs a second predicate leg (e.g. `studentId in currentRoster`
   or a `teacherIds`-array/attempt-reindex) so B's teacher can SEE inherited attempts; and the name filter must
   stop hard-empty-returning on ex-roster students (db.js:1917-1921).
4. Under the C-31 student-owned re-key, the challenge/override unlock must write to the (student, list) progress
   record — dissolving §5's mis-landing.

## §7 SEPARATE security finding (for C-16 design; do not fold into C-19)

`firestore.rules:45-48`: **any authenticated teacher may read AND write ANY student's `users/{uid}` subcollections**
(`study_states`, `class_progress`, `session_states`, …) with no class-membership check — acknowledged in-file as
overly broad (`firestore.rules:39-44` TODO). Today `reviewChallenge`'s cross-doc legs depend on this breadth
(`db.js:2757-2766` study_states; `:2791-2836` class_progress/session_states), and `firestore.rules:34-37` lets any
teacher write any student's top-level `challenges` field. **The C-16 override MUST NOT be built on this breadth**:
it would inherit "any teacher account can override any student anywhere" (and C-28's self-promotable doc-role makes
"teacher account" itself forgeable — `firestore.rules:18-19` + `:34-37`). The override must be a server callable
with explicit class-ownership authz (§6.1 union) + audit log, after which rules:45-48 tightens to `isOwner` per its
own TODO. `{confidence: verified (rules text + call-site trace)}`

## §8 Claims ledger

| Claim | Evidence | Confidence |
|---|---|---|
| Attempt permanently stamped `teacherId = launching class ownerTeacherId` | db.js:1194-1204, 1233-1242, 1353-1372; functions/index.js:348 | verified |
| Teacher gradebook visibility = `where('teacherId','==',uid)` only | db.js:1924-1928 (+ Gradebook.jsx:27, 304) | verified |
| Challenge review authz = `attempt.teacherId === uid` (client throw) | db.js:2665-2668 | verified |
| Attempts rules also gate read/update by `teacherId` (H1-gate correction) | firestore.rules:102-105, 114-118 | verified |
| Old teacher's name-search goes blind post-roster-removal (hard empty return) | db.js:1892-1896, 1913-1921; roster maps 1805-1827 | verified |
| No other challenge-review surface / no server reviewChallenge exists | grep: Gradebook.jsx:1380,1396 only; functions/index.js has submitChallenge only (626-678) | verified |
| Student can still see + challenge own old attempt | db.js:2113-2117, 2594-2597; functions/index.js:648-650; rules:106-107,115-116 | verified |
| `SERVER_CHALLENGE_WRITE = false` → legacy client challenge path live | src/config/featureFlags.js:20; db.js:2562 | verified |
| "단어 권한이 없습니다" = db.js:2666 Unauthorized throw surfaced to B-side staff | log(07-08) ↔ code-path match | high-confidence inference |
| `teacherId:null` attempts are review-orphans for everyone | db.js:1926 + 2666 + rules:104 | verified (population unmeasured → F-6b) |
| Accepted challenge unlocks OLD class's progress/session docs | db.js:2791-2792, 2813-2820, 2831-2836 | verified |
| Any teacher can write any student's users-subcollections (C-16 hazard) | firestore.rules:45-48 (+TODO :39-44), 34-37 | verified |
