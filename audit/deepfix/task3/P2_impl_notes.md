# P2 (RS) implementation notes — C-34, C-33, C-23

Deepfix Task 3 · 2026-07-13 · LOCAL-ONLY (no deploy, no commit, no live-Firebase call).
Spec: `audit/deepfix/task1/investigations/inv_I8_read_surfaces.md` + `audit/deepfix/task2/FIX_PLAN.md` §P2.
C-35 was already in the working tree (helper `getAssignedListIds` + 6 sites) — untouched.

Verification discipline: every target was re-located at its CURRENT file:line before editing
(pre-existing uncommitted P0/P1/C-35 work had shifted the FIX_PLAN's cited line numbers slightly);
post-edit syntax verified (`node --check` for .js, `@babel/parser` ESM+jsx parse for .jsx,
`JSON.parse` for the index file); full `git diff` of each touched file reviewed hunk-by-hunk.

---

## C-34 — un-drop testId-less attempts (field-first listId)

**What.** Replicated the shipped `fetchUserAttempts` pattern (db.js:2528-2533,
`attemptData.listId ?? parsedListId`) at the four read-surface sites that derived `listId`
ONLY from the testId regex and dropped rows on parse failure. At each site the parse local
was renamed to `parsedListId` and a field-first `const listId = attemptData.listId ?? parsedListId`
added; the row is now dropped ONLY when BOTH the stored field and the parse are absent
(per the task directive — note: I-8 §2.2 step 2 went further and deleted the drop entirely
in the two gradebook query fns; the binding task spec said "only `continue` if BOTH are
absent", so the both-absent drop is retained at all four sites — see "Judgment calls").

**Sites (pre-edit → post-edit locations in `src/services/db.js`):**

| Function | Old drop line | New field-first line | New drop line |
|---|---|---|---|
| `fetchClassAttempts` | 1480 | 1483 | 1485 (+ assigned-list gate 1486, unchanged) |
| `fetchAllTeacherAttempts` | 1625 | 1633 | 1635 |
| `queryTeacherAttempts` | 1986 | 2015 | 2017 |
| `queryStudentAttempts` | 2175 | 2209 | 2211 |

**List-name fallback ('Unknown List', don't crash the row).** Verified already present at
every site for kept rows (listId is guaranteed truthy after the new drop, so no null-getDoc
path exists): `fetchClassAttempts` defaults `listName = 'Unknown List'` before its try/catch;
`fetchAllTeacherAttempts` defaults `'Unknown List'`; `queryTeacherAttempts` uses
`listIdToNameMap.get(listId) || 'Unknown List'`; `queryStudentAttempts` sets `'Unknown List'`
on missing doc AND in its catch. No change needed — no site can crash on an unresolvable title.

**List-filter semantics unchanged (verified per site):** `queryTeacherAttempts`
`filterListIds.includes(listId)` and `queryStudentAttempts` listName-substring post-filters
untouched; `fetchClassAttempts`' `assignedListIds.includes(listId)` gate untouched. A row with
a real stored listId (the automarker shape: functions/index.js:584 writes top-level `listId`,
no `testId`) now resolves and filters exactly like a parseable row. Field precedence means a
malformed testId can no longer null out a valid stored listId (same rationale as db.js:2528-2530).

**Not done (out of task scope):** I-8's optional Step 4 (`autoCompleted` passthrough for row
labeling, C-37 adjacency) — task spec for C-34 did not include it.

**Check:** `node --check src/services/db.js` → OK.

---

## C-33 — gradebook Name filter server-side + composite indexes

**Code (`src/services/db.js`, `queryTeacherAttempts`).** Inserted at 1956-1971, immediately
after the class-filter block (per I-8 §1.2), before the date filter:

- 1 resolved studentId → `where('studentId', '==', id)`
- 2..30 → `where('studentId', 'in', ids)`, guarded by BOTH `length <= 30` AND
  `classDisjuncts * length <= 30` where `classDisjuncts = Math.max(filterClassIds.length, 1)`
  (Firestore DNF disjunction budget; I-8's exact guard — deliberately conservative when
  `filterClassIds.length > 10`, i.e. when the class clause itself wasn't pushed).
- \>30 (or budget exceeded) → nothing pushed; the existing post-filter (now db.js:2020-2023)
  is retained UNCHANGED as the degraded-mode backstop (no-op when the filter was pushed).

Unchanged and verified intact: the empty-match early return (`hasNameFilter && filterStudentIds.length === 0`,
db.js:1939-1943), `limit`/`startAfter` pagination (now walks the server-filtered ordered set —
the point of the fix), `hasMore = attemptDocs.length === pageSize`.

**Indexes (`firestore.indexes.json`).** Appended exactly TWO `attempts` composite entries
(end of the `indexes` array, before `fieldOverrides`):
1. `teacherId ASC, studentId ASC, submittedAt DESC`
2. `teacherId ASC, classId ASC, studentId ASC, submittedAt DESC`

No date-scoped variants needed: the date filter is a range on `submittedAt`, the orderBy field
(last index position). Deploy ordering note for whoever ships: indexes BEFORE code
(`firebase deploy --only firestore:indexes`) — NOT done here (local-only).

**Check:** `node --check src/services/db.js` → OK; `JSON.parse` of firestore.indexes.json → OK
(38 entries total; exactly 2 teacherId+studentId attempts entries confirmed programmatically).

---

## C-23 — result cards trust the stored verdict + fail open

**Server plumbing verified before editing (the "does the field exist" question):**
`submitVocabAttempt` returns `passed` on BOTH paths — fresh write (functions/index.js:534,
from `writeAttemptTxn`'s return at :451) and idempotent re-submit (:470 →
`normalizeExistingAttempt` at :238). Server verdict is computed against the class assignment's
real `passThreshold` (`assignment?.passThreshold ?? 95`, functions/index.js:343, :380). The
client previously discarded it (`result = { id: resp.data.attemptId }` only).

**Changes — `src/pages/TypedTest.jsx`:**
- :291-295 — PATH A threshold guard: only `setRetakeThreshold(testConfig.passThresholdDecimal)`
  when `Number.isFinite(...)`. An undefined/NaN value would make every
  `score >= retakeThreshold` compare false = fail-CLOSED verdicts; now the state keeps its
  default instead (fail open, and matches the server's own `?? 95` default for an absent value).
- :797-800 — `let serverPassed = null` declared in handleSubmit before `finalizeResultsView`.
- :927-929 — SERVER_ATTEMPT_WRITE branch captures
  `serverPassed = typeof resp.data.passed === 'boolean' ? resp.data.passed : null`.
- :949-951 — legacy client-write branch sets `serverPassed = passed` (the exact verdict the
  written attempt doc stores — card always matches the stored gradebook row).
- :819 — `serverPassed` added to the `setTestResultsData` payload (null in practice mode).
- :1322-1327 — new-word result card:
  `const passed = testResultsData.serverPassed ?? (Number.isFinite(retakeThreshold) ? score >= retakeThreshold : true)`.
  Stored verdict preferred; local compare only when no verdict exists (practice mode / older
  payload), and that fallback fails OPEN on a non-finite threshold.

**Changes — `src/pages/MCQTest.jsx`** (same six-part treatment): :246-250 PATH A guard;
:535-538 `let serverPassed = null` (hoisted before `if (!isPracticeMode)` since the payload
write at :832 is outside that block); :649-651 server capture; :671-673 legacy capture;
:832 payload field; :1058-1063 result card expression.

**Deliberately NOT touched (write-path adjacency, X4):** the `passed` computation feeding the
attempt write and session-completion gating (TypedTest :826, MCQTest :533), review-card tiers,
`retakeThreshold` uses in `canRetake`, and studyService.js:305 / :1367 (`newWordsTestPassed`
derivation is FIX_PLAN P4's C-25-adjacent fold, not P2).

**Checks:** `@babel/parser` (sourceType module, jsx plugin) parse of both files → OK.
(`node --check` cannot parse JSX; `node_modules` esbuild is the win32 binary — WSL-copied —
so the repo's own parser package was used instead.)

---

## Judgment calls / uncertainties

1. **C-34 drop scope.** Task directive ("only `continue` if BOTH are absent") retained the
   both-absent drop at all four sites; I-8 §2.2 step 2 would have fully un-dropped rows with
   NEITHER testId nor listId (pre-catalog scratch manuals) in the two gradebook query fns.
   Consequence: automarker + any listId-carrying manual rows become visible (the population
   the fix titles), but a row with neither field stays hidden. If the fuller I-8 behavior is
   wanted, it is a 2-line follow-up per gradebook fn (delete the drop + null-guard the name lookup).
2. **Index entry shape.** The file contains two shapes: console-export style (with `__name__`
   + `"density": "SPARSE_ALL"`) and the hand-added style of commit b10b1e1's 7 entries (no
   `__name__`, no density). I matched the b10b1e1 hand-added shape (the `__name__` suffix is
   implicit; density is a console-export artifact).
3. **C-33 guard conservatism.** `Math.max(filterClassIds.length, 1)` over-counts disjuncts when
   `filterClassIds.length > 10` (class clause not actually pushed then) — kept I-8's exact
   spec; the only cost is falling back to the (correct) degraded post-filter path in that rare case.
4. **MCQ score-vs-verdict display edge.** Client `score` counts only ANSWERED questions;
   the server scores against `totalQuestions` (skipped = incorrect, functions/index.js:376-380).
   With skips, the card can now show a percent above the threshold with a "Did not pass"
   verdict — that verdict matches the stored attempt (the fix working as specified); the
   score-display divergence is pre-existing and out of scope.
5. **Pre-existing tree state.** The working tree already carried uncommitted earlier-phase work
   (C-35 six-site helper, #11 Phase-1 fix in studyService/DailySessionFlow/Dashboard, functions
   provenance work). Verified my diff hunks in db.js/TypedTest/MCQTest/firestore.indexes.json
   are strictly the P2 changes described above; nothing else modified.
6. **Not run:** any live query, emulator test, or deploy (task is local-only implementation).
   I-8 §1.5/§2.4 emulator tests remain the Task-5/6 acceptance work.
