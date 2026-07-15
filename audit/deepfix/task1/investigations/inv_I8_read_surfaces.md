# I-8 — Read-surface fix spec: C-33 (Name filter), C-34 (testId-less rows), C-35 (assignedLists six-site)

Deepfix Task 1.6 · read-only code investigation · 2026-07-13 · working tree @ main (clean)
North star **N6**: each surface's query semantics == its UI claim.
Verification discipline: every claim tagged `{claim, evidence:file:line, confidence}`. No live Firebase access;
data claims cite the census/ledger and are tagged as such.

Scope of change (all three fixes combined): `src/services/db.js`, `firestore.indexes.json`,
`scripts/cs/data-integrity-sweep.mjs`. Zero contact with reconciliation / attempt-write paths, so X4
(non-regression vs. the Phase-1 fix and LIST_SCOPED_RECON invariants) is satisfied by construction.

---

## 1 · C-33 — push the gradebook Name→studentId filter server-side

### 1.1 Current code (verified)

- {claim: `queryTeacherAttempts` builds ONE query `where('teacherId','==',teacherId)` + `orderBy('submittedAt','desc')`,
  evidence: src/services/db.js:1924-1928, confidence: high}
- {claim: Name tags are resolved client-side to `filterStudentIds` via the lowercased `studentNameToIdMap`
  (substring match), evidence: db.js:1892-1896 (map built at db.js:1817-1821), confidence: high}
- {claim: classId is already pushed server-side (`==` for 1, `in` for 2..10), date is a server-side range on
  `submittedAt`, evidence: db.js:1931-1935, 1938-1940, confidence: high}
- {claim: page = `limit(pageSize)` (default 50) + `startAfter(lastDoc)`, evidence: db.js:1943-1946, 1858, confidence: high}
- {claim: the studentId filter is applied POST-query on the fetched page, evidence: db.js:1982-1984, confidence: high}
- {claim: if a Name tag matches no student, the function early-returns empty (must be preserved),
  evidence: db.js:1917-1921, confidence: high}
- {claim: the UI *claims* server-side filtering — "Server-side filtering is handled in queryTeacherAttempts /
  No client-side filtering needed", evidence: src/pages/Gradebook.jsx:322-324, confidence: high}
- {claim: the deep-link flow pre-fills BOTH a Class tag and a Name tag from URL params (`classId`, `studentName`) —
  so Class+Name combined is a first-class real flow, not an edge case, evidence: Gradebook.jsx:34-36, 70-114, confidence: high}
- {claim: "Load more" walks pages with the same filters + lastDoc, evidence: Gradebook.jsx:389-405, confidence: high}
- {claim: defect magnitude — a filtered student whose newest attempt ranks deep teacher-wide (이지후: 17,236/20,029)
  never appears on page 1 → "no results", evidence: audit/deepfix/task1/CONSOLIDATED_ISSUES.md:529-533 (ledger
  verified-evidence; not re-measurable here), confidence: high (as reported)}

Net: the query semantics are "newest 50 attempts of the WHOLE teacher, then hide non-matching rows"; the UI
claims "attempts of the filtered student". N6 violation confirmed.

### 1.2 Fix spec (convergence)

In `queryTeacherAttempts`, immediately after the class filter block (db.js:1931-1935), add a studentId
server-side filter. Name→id resolution stays exactly where it is (client-side against the cached member map —
no server-side name search is needed or possible):

```js
// After: class filter (db.js:1931-1935)
// NEW: push resolved studentIds server-side (C-33)
const IN_LIMIT = 30
const classDisjuncts = Math.max(filterClassIds.length, 1)   // 1 when classId is == or absent
if (filterStudentIds.length === 1) {
  attemptsQuery = query(attemptsQuery, where('studentId', '==', filterStudentIds[0]))
} else if (
  filterStudentIds.length > 1 &&
  filterStudentIds.length <= IN_LIMIT &&
  classDisjuncts * filterStudentIds.length <= 30            // Firestore DNF disjunction budget
) {
  attemptsQuery = query(attemptsQuery, where('studentId', 'in', filterStudentIds))
}
// else: >30 matches (or disjunction budget exceeded) → degraded legacy mode:
// the existing post-filter at db.js:1982-1984 still applies (keep it unconditionally
// as belt-and-braces; it is a no-op when the filter was pushed server-side).
```

- Keep db.js:1917-1921 (empty-match early return) unchanged.
- Keep db.js:1982-1984 (post-filter) unchanged — it is the correctness backstop for the >30 degraded mode and
  a no-op otherwise.
- **Pagination walks the filtered set with NO further change**: `startAfter(lastDoc)` (db.js:1944-1946) resumes
  the server-filtered ordered result, so every page contains only matching students; `hasMore =
  attemptDocs.length === pageSize` (db.js:1952) keeps its meaning. This is the whole point of the fix.
- SDK facts: {claim: `in` accepts ≤30 values and multiple `in` clauses are allowed subject to a ≤30
  disjunction (DNF cross-product) budget per query; an `in` uses the same composite index as `==`,
  evidence: Firestore query-limit docs (external) + firebase `^12.6.0` at package.json:22 (well past the 2023
  OR-query/disjunction release), confidence: medium-high — and the guard above makes correctness independent
  of the multiple-`in` support: if `classDisjuncts * n > 30` we simply don't push studentId and the legacy
  post-filter path handles it}
- Class-filter interplay: today classId `in` is capped at 10 (db.js:1933). With a single class (the locked-class
  deep link, the dominant real flow) the budget is 1×n ≤ 30 — always safe for n ≤ 30.

### 1.3 Composite indexes required — the precise answer to Codex's open question

{claim: `firestore.indexes.json` today has for `attempts` the pairs (teacherId, submittedAt DESC) and
(teacherId, classId, submittedAt DESC) but NO index containing teacherId+studentId,
evidence: firestore.indexes.json — attempts entries incl. `teacherId ASC, submittedAt DESC` and
`teacherId ASC, classId ASC, submittedAt DESC`; grep shows no teacherId+studentId entry, confidence: high}

**Exactly TWO new composite indexes** on collection `attempts` are required:

| # | Fields (in order) | Serves |
|---|---|---|
| 1 | `teacherId ASC, studentId ASC, submittedAt DESC` | Name filter alone (`==` or `in`), with or without Date range |
| 2 | `teacherId ASC, classId ASC, studentId ASC, submittedAt DESC` | Class (`==`/`in`) + Name (`==`/`in`) combined — the locked-class + studentName deep link (Gradebook.jsx:34-36), with or without Date range |

- **No date-scoped variants are needed**: the date filter is a RANGE on `submittedAt` (db.js:1938-1940), the
  same field as the `orderBy` — range + orderBy on the same field occupy the same (last) index position, so
  both queries ride the two indexes above. {evidence: db.js:1938-1940 + Firestore index-composition rules
  (external), confidence: high}
- `in` clauses index like `==` (one equality scan per disjunct) → no extra index per `in`. {confidence: high}
- List and Test Type remain client post-filters (db.js:1987-1995) — unchanged by this fix; `listId` cannot be
  pushed server-side yet because legacy attempts lack the field (see C-34) and a sparse-field where-clause
  would silently hide them. Residual: a List-only filter can still under-fill/empty page 1 — out of C-33 scope,
  note for the backlog.
- Deploy order: `firebase deploy --only firestore:indexes` BEFORE the code change; index builds are additive
  and zero-risk. Missing-index failure mode is loud, not silent: Firestore throws `failed-precondition` with a
  create link, surfaced by the Gradebook error state (Gradebook.jsx:308-313).

### 1.4 Risk

- **Low.** Additive where-clause on an already-single-query function; no fan-out/batching reintroduced.
- Degraded >30-match mode is byte-identical to today's behavior (post-filter at 1982-1984 still present).
- `teacherDataCache` (db.js:1773-1774, 5-min TTL) untouched — a just-enrolled student may take ≤5 min to be
  resolvable by name; pre-existing behavior.
- Student-role Gradebook uses `queryStudentAttempts` (App.jsx:121) which has NO Name filter — untouched by C-33.

### 1.5 Tests

Emulator-backed (firebase.json:16-27 configures auth+firestore emulators; seed via `npm run seed`, package.json:11):
1. Seed 1 teacher, 2 classes, student A with 5 attempts older than 60 attempts by other students. Name-filter
   "A" → page 1 returns exactly A's 5 attempts (fails on current code: returns 0).
2. Pagination: give A 55 attempts → page 1 = 50 A-rows, `loadNextPage` (Gradebook.jsx:389-405) returns the
   remaining 5, all A.
3. Combined Class+Name via deep-link params `?classId=..&studentName=..` (e2e, `npm run test:e2e`) — exercises
   index #2.
4. Name matching 2 students → `in` path; Name matching 31 fabricated students → degraded path still correct
   (post-filter) — assert no throw.
5. Name matching 0 students → empty result via db.js:1917-1921 (regression guard).

---

## 2 · C-34 — make testId-less attempts visible in the gradebook

### 2.1 Current code + who exactly is dropped (verified)

- {claim: `queryTeacherAttempts` derives `listId` ONLY by regex-parsing `testId`
  (`^(test|typed)_([^_]+)_` / `^vocaboost_test_[^_]+_([^_]+)_`) and DROPS any row that doesn't parse,
  evidence: db.js:1962-1975 (parse), db.js:1977 `if (!listId) continue`, confidence: high}
- {claim: the same parse-and-drop exists in `queryStudentAttempts` (student "My Scores", same Gradebook
  component via App.jsx:121) and in `fetchAllTeacherAttempts` / `fetchClassAttempts`,
  evidence: db.js:2151-2166 (drop at 2166), db.js:1601-1616 (drop at 1616), db.js:1456-1471 (drop at 1471,
  plus assigned-list gate at 1472), confidence: high}
- {claim: `fetchAttemptDetails` parses but does NOT drop — a null listId just renders 'Unknown List', so the
  details drawer already tolerates these rows, evidence: db.js:2248-2256, 2275-2277, confidence: high}
- {claim: `fetchUserAttempts` was ALREADY fixed with field-first resolution — `attemptData.listId ?? parsedListId`
  — this is the model pattern, evidence: db.js:2485-2488 (with the explanatory comment), confidence: high}
- {claim: the empty-review automarker writes NO `testId` but DOES write top-level `listId`, `classId`,
  `teacherId`, `sessionType:'review'`, `autoCompleted:true`, `score:100`, `passed:true`, `totalQuestions:0`,
  `answers:[]` — in BOTH write paths,
  evidence: server functions/index.js:580-597 (listId at :584); legacy client DailySessionFlow.jsx:984-1000
  (listId at :988), flag-selected at :974-978, confidence: high}
- {claim: current `cs/manual-pass.mjs` writes a PARSEABLE testId (`vocaboost_test_${classId}_${listId}_new`),
  so CS manual-passes ARE visible; only automarkers + pre-catalog scratch manuals are dropped,
  evidence: scripts/cs/manual-pass.mjs:51 + CONSOLIDATED_ISSUES.md:535-541 (V-1.4 refinement), confidence: high}
- {claim: normal app writes stamp top-level `listId` (and `listTitle`) on attempts when provided,
  evidence: db.js:1237-1238 (listId), db.js:1223 (listTitle), confidence: high}

### 2.2 Fix spec (convergence) — field-first, do NOT broaden the regex

**Rejected directions, with reasons:**
- *Broaden the regex*: cannot work — the automarker has NO testId at all (functions/index.js:580-597 writes none);
  there is nothing to parse.
- *classId fallback for list resolution*: unsound — a class has many assigned lists; classId identifies the class,
  not the list. (classId already serves as the class-NAME fallback at db.js:2008, which is fine.)

**Converged fix — replicate the db.js:2485-2488 pattern:**

Step 1 (the load-bearing line, both gradebook query fns — db.js:~1977 and ~2166; apply the same one-liner in
`fetchAllTeacherAttempts` ~1616 and `fetchClassAttempts` ~1471 for cross-surface consistency):

```js
// after the existing parse block (keep the regexes as the legacy fallback)
const listId = attemptData.listId ?? parsedListId   // field-first; testId parse is the legacy fallback
```

This alone makes every automarker row visible (they all carry `listId`), and is a strict superset of today's
resolution (a row that parsed before still parses; a stored field only ADDS rows).

Step 2 (recovers pre-catalog scratch manuals — rows with neither testId nor listId): in
`queryTeacherAttempts` and `queryStudentAttempts` ONLY, delete the `if (!listId) continue` drop and let the
row through with a resolvable-name chain:

```js
const listName = (listId && listIdToNameMap.get(listId)) || attemptData.listTitle || 'Unknown List'
```

(`listTitle` is stamped at write time, db.js:1223.) In `fetchClassAttempts`/`fetchAllTeacherAttempts`
(per-class analytics surfaces) keeping the drop for truly unresolvable rows is acceptable — their contract is
"attempts attributable to this class's lists"; field-first (step 1) already recovers the automarkers there.

Step 3 — page-filter interaction (the "without breaking the page filter" requirement):
- List filter (db.js:1987-1989): `filterListIds.includes(listId)` — a null-listId row can never match a named
  List filter → correctly excluded while a List filter is active. Automarker rows carry a REAL listId → the
  List filter matches them correctly. No change needed.
- Test Type filter (db.js:1992-1995): automarker `testType:'mcq'` (functions/index.js:586) → behaves normally.
- Name filter / C-33 server push: operates on `studentId`, present on every automarker → unaffected.

Step 4 (optional, small, recommended — C-37 adjacency): add `autoCompleted: attemptData.autoCompleted ?? false`
to the enriched row (db.js:2024-2042) so the UI can label the 100%/0-question marker rows "Auto-completed
review" instead of presenting a confusing perfect score. Details drawer already renders them safely
(db.js:2275-2277; `answers:[]` → empty answer list).

### 2.3 Risk

- **Low.** Purely additive row inclusion; no query or index change; the parse regexes remain for legacy docs.
- Behavior change teachers WILL see: automarker rows (100%, 0 questions) now appear — that is the fix working;
  Step 4 mitigates the legibility surprise.
- `attemptData.listId ?? parsed` ordering: a stored field beats the parse — exactly the documented precedence
  already shipped at db.js:2485-2488; a malformed testId can no longer null out a valid stored listId.
- F-8 (census: count 26SM attempts with missing/unparseable testId by origin) remains the data-side sizing task;
  nothing here blocks it.

### 2.4 Tests

Emulator seed four attempts under one teacher: (a) old-format `test_{listId}_{ts}`, (b) new-format
`vocaboost_test_{classId}_{listId}_mcq`, (c) automarker-shaped (NO testId; top-level listId/classId/teacherId,
`autoCompleted:true`, `totalQuestions:0`), (d) bare scratch (no testId, no listId, has classId/teacherId).
1. Unfiltered gradebook page returns all four (current code: a,b only).
2. List filter for the seeded list returns a,b,c — NOT d.
3. Row c renders score 100 / passed true / list name resolved; row d renders 'Unknown List'.
4. `fetchAttemptDetails` on c and d does not throw (regression: db.js:2248-2277 tolerated them already).
5. Student-role My Scores (`queryStudentAttempts`) shows c,d for their student.

---

## 3 · C-35 — six-site `assignedLists || Object.keys(assignments)` truthiness bug

### 3.1 Current code (verified — all six sites re-confirmed in working tree)

`[] || fallback` never falls back (empty array is truthy), so a class doc with `assignedLists: []` and a
populated `assignments` map shows ZERO lists on every consuming surface:

| Site | Enclosing function | Evidence |
|---|---|---|
| db.js:502 | `fetchStudentClasses` (467) | `classData.assignedLists \|\| Object.keys(assignments)` |
| db.js:1438 | `fetchClassAttempts` (1424) | same |
| db.js:1531 | `fetchAllTeacherAttempts` (1505) | `klass.assignedLists \|\| Object.keys(klass.assignments \|\| {})` |
| db.js:1808 | `getTeacherData` (1779) → feeds `queryTeacherAttempts` | same |
| db.js:2314 | `fetchAttemptDetails` (2235) | `classData.assignedLists \|\| Object.keys(classData.assignments \|\| {})` |
| db.js:2436 | `fetchUserAttempts` (2404) | same, stored into `classLookup` (consumed at 2499) |

- {claim: the split-brain seed is in-app — `createClass` writes `assignedLists: []` at birth,
  evidence: db.js:328, confidence: high}
- {claim: the two `|| []` sites at db.js:811 and 835 are INTENTIONAL accumulator seeds in
  `assignListToClass`/`unassignListFromClass` (start-from-empty then add/remove is correct) — DO NOT TOUCH,
  evidence: db.js:810-820, 834-842, confidence: high}
- {claim: 0 live impact today — census v1 found splitBrain=false across all 32 classes (ensure-all-lists cleaned
  it), but the code re-fires on the next `assignedLists: []`-while-assignments-populated write,
  evidence: CONSOLIDATED_ISSUES.md:543-551 + the census predicate at scripts/cs/deepfix-census.mjs:34,55,
  confidence: high (census-reported; not re-measurable here)}

### 3.2 Fix spec (convergence)

One shared helper, used at all six sites (DRY — prevents a seventh-site recurrence, per the pattern history
where the "one-line fix" in NEED_TO_FIX under-scoped it, CONSOLIDATED_ISSUES.md:613-614):

```js
// db.js, module scope (near the other small helpers, e.g. below normalizePOS at :172)
const getAssignedListIds = (classData) =>
  (classData?.assignedLists?.length ? classData.assignedLists : Object.keys(classData?.assignments || {}))
```

Then each site becomes `const assignedListIds = getAssignedListIds(classData)` (at 1531/1808: `(klass)`;
at 2436: `assignedLists: getAssignedListIds(classData)`).

Semantics audit of the new fallback direction (empty array → assignments keys):
- {claim: no in-app writer produces "array deliberately empty while assignments stays populated" —
  `unassignListFromClass` removes the list from BOTH the array and the map (`deleteField`) in one update,
  and `assignListToClass` appends to both, so array-empty + map-populated is only ever the split-brain
  corruption state the fallback is MEANT to heal, evidence: db.js:816-820 (assign, both), db.js:838-842
  (unassign, both incl. `assignments.${listId}: deleteField()` at :839), confidence: high}
- Both-empty docs (fresh class, db.js:318-330) yield `[]` before and after — no behavior change.
- The legacy assignments-only docs (no `assignedLists` field at all) resolve identically to today
  (`undefined?.length` → falsy → fallback), preserving the original back-compat intent (comment db.js:1436;
  converter db.js:745-750 untouched).

### 3.3 Standing sweep hook (the recurrence catcher, F-5)

- {claim: `scripts/cs/data-integrity-sweep.mjs` — the mandated BEFORE/AFTER sweep (CLAUDE.md CS rules) — has NO
  assignedLists/split-brain signature today, evidence: grep 'assignedLists' over
  scripts/cs/data-integrity-sweep.mjs returns nothing; signature list at data-integrity-sweep.mjs:10-13,27,
  confidence: high}

Port the census predicate verbatim into the sweep as a per-CLASS signature (the existing signatures are
per-student; this one belongs in the class-collection pass at data-integrity-sweep.mjs:21-23):

```js
// add to F (line 27): splitBrainClass: []
// in the classes pass (line 23), per matching class doc c:
if (Array.isArray(c.assignedLists) && c.assignedLists.length === 0 &&
    Object.keys(c.assignments || {}).length > 0)
  F.splitBrainClass.push(`${d.id.slice(0,8)} ${c.name}`)
```

(Exact predicate from scripts/cs/deepfix-census.mjs:34 — keep byte-parity so the census and sweep never
disagree.) Read-only; expected 0 hits today; every future CS sweep run then catches a recurrence even after
the code fix makes it invisible to users.

### 3.4 Risk

- **Near-zero.** Behavior changes only for split-brain docs, of which there are 0 live (census v1); for every
  currently-existing doc shape the resolved list set is identical or strictly-healed.
- Data sweep/backfill: NOT needed today (0-impact); do not write `assignedLists` backfills — the code fix +
  sweep signature is the whole remedy (X5: no hand-patching that masks the bug).

### 3.5 Tests

Emulator: seed three class docs — A `{assignedLists:['L1'], assignments:{L1}}`, B `{assignedLists:[],
assignments:{L1}}` (split-brain), C `{assignedLists:[], assignments:{}}`.
1. `fetchStudentClasses` for a student enrolled in all three: A and B each surface L1; C surfaces none
   (current code: B surfaces none — the defect).
2. `getTeacherData` classMap `listIds` includes L1 for B (feeds the gradebook maps, db.js:1826).
3. `fetchUserAttempts` class attribution for an attempt on L1 in B resolves the class name (db.js:2499 path).
4. Legacy doc `{assignments:{L1}}` with NO assignedLists field → unchanged (fallback fires as before).
5. Sweep parity: run the new `splitBrainClass` predicate against the three seeds → flags exactly B.

---

## 4 · Suggested landing order + logging

1. **C-35** (helper + six sites + sweep signature) — zero-risk, and C-34's `fetchClassAttempts` touch sits next
   to site 1438.
2. **C-34** (field-first listId + un-drop in the two gradebook query fns + optional `autoCompleted` passthrough).
3. **C-33** — deploy the TWO new composite indexes first (`firebase deploy --only firestore:indexes`), then the
   where-clause change.

Each step logged to `change_action_log.md` per CLAUDE.md rule 1; no SUPPORT_RUNBOOK entry needed (code-only, no
data intervention). No test runner exists in package.json (only `test:e2e` Playwright + emulator seed script,
package.json:6-14) — the emulator tests above should land as a seeded e2e spec or a standalone emulator script
under `scripts/` per existing convention.

**Open items deliberately NOT expanded here:** List-filter under-fill on page 1 (residual of C-33's scope —
listId is a sparse field on legacy attempts, can't be pushed server-side until F-8 sizes the legacy population);
F-8 census (sizes the C-34 recovered population); C-37 labeling of automarker rows (Step 4 provides the datum).
