# DEEPFIX Task 3 — P8 (CONT-A) implementation notes

**Date:** 2026-07-13. **Scope:** FIX_PLAN v3 Phase P8 · CONT-A (list linking + choice terminal +
continuous advance + focus-yield), REAL code, LOCAL-ONLY — **no deploy, no commit, no live-Firebase
call**. Everything behind the NEW flag `CONTINUATION_LINKS` (**default OFF**,
`src/config/featureFlags.js:55`) + per-assignment `nextListId` (absent = today's behavior exactly).
Verification stance (David, verbatim): "always verify all claims… Never trust blindly. Always
verify." — every claim below was traced to the working-tree `file:line` BEFORE editing, and every
changed file was parse-checked after (see §6).

**Baseline correction (verified before work):** the git snapshot claiming a clean tree is FALSE —
the working tree already carried the UNCOMMITTED #11/RS/P3 work (`git status`: 26 modified files
incl. all 4 files this phase touches). All "current code" cites below are against that working
tree, per the FIX_PLAN's own convention. Also confirmed before building: the review-only plan §5's
`DailySessionFlow.jsx:800-816` resume cite is the DEAD copy (inv_I2 §4.4) — the live resume branch
is `:590-623` pre-edit; nothing in CONT-A modifies either resume branch.

---

## Per-item record

### 1. Schema — `nextListId` on `classes/{classId}.assignments[listId]`

- **Where:** `src/services/db.js:946-966` — inside `updateAssignmentSettings` (`db.js:854`), the
  assignment-settings write site that owns pace/testSizeNew/passThreshold validation and performs
  the single `updateDoc(classRef, { assignments, updatedAt })` (`:975-978`).
- **Cite drift note (verified):** the plan's `[V-P]` cite `db.js:796-819` is the `assignListToClass`
  assign-time block. The LIVE settings-editor write path is `updateAssignmentSettings`
  (ClassDetail.jsx:366 → db.js:854) — same file, same trust level, same `classes` rules surface;
  it is the block that owns the pace/testSizeNew/threshold **validation** the plan describes, so
  the branch was added there. `assignListToClass` needs no change: its spread
  `...(assignments[listId] || {})` (`db.js:807`) preserves an existing `nextListId` across
  re-assign (verified by reading the object literal `:806-817` — only known keys are overwritten).
- **Validation:** `undefined` → untouched (flag-off writes are byte-identical); `null`/`''` →
  `null` (clear); string → must NOT equal the listId itself and MUST be a key of the class's own
  `assignments` map (link target must be assigned to this class), else throws. Owner-teacher-only
  exactly like pace: same client function, same Firestore `classes` rules surface — **no rules
  change** (per P8: "no functions, no rules").
- **Dangling-link posture:** if the linked list is later unassigned (`unassignListFromClass`
  `db.js:848` deletes the assignment entry), the pointer dangles. Every reader added in this phase
  is defensive: Dashboard resolves the id against `assignedListDetails` (no match → no
  yield/button), the session terminal validates against the class's assignment keys (no match → no
  button), the teacher card chip resolves against `assignedLists` (no match → nothing). I chose
  NOT to add sibling-cleanup writes to `unassignListFromClass` (keeps the diff minimal and the
  flag-off write path untouched); flagged as a possible P8 polish item.

### 2. Teacher UI — ClassDetail "next list" selector

- `src/pages/ClassDetail.jsx:27` — flag import.
- `:138` — `settingsForm` gains `nextListId: null`.
- `:238` — `loadAssignedLists` maps `assignment.nextListId ?? null` onto the card/list objects.
- `:356` — `openSettingsModal` seeds the form from the list.
- `:377-383` — `handleSaveSettings` sends `nextListId` **only when `CONTINUATION_LINKS` is on**
  (spread-conditional; flag off ⇒ key omitted ⇒ `undefined` ⇒ no-op in db.js — flag-off saves are
  byte-identical to today's).
- `:1254-1290` — new flag-gated "List Sequence" section in the settings modal (inside the
  `settingsModalList && (` guard at `:1061`): a `<select>` over the class's OTHER assigned lists
  (`assignedLists.filter(l => l.id !== settingsModalList.id)`) + "None". This is the
  ordered-sequence affordance: each list points at its successor (Base→Ascent→Summit is three
  links).
- `:743-754` — flag-gated card chip "Next: {title}" on the assigned-list card (display only,
  resolves the id; dangling → hidden).

### 3. Choice terminal — session finished terminal + Dashboard finished hero

- **Session terminal** (`src/pages/DailySessionFlow.jsx`):
  - `:20` flag import; `:135-139` new state `classAssignedListIds` / `continuation`.
  - `:555-559` init captures `Object.keys(classData.assignments || {})` (config read, for the
    dangling-link guard).
  - `:880-914` new effect: when `phase === COMPLETE && sessionConfig.isListComplete === true`
    (the P1 finished terminal condition, CompletePhase `:2274` / render condition verified) AND
    the LAUNCHING class's `assignmentSettings.nextListId` is a valid, still-assigned link, it
    getDoc-reads `lists/{nextListId}` for the title and sets
    `continuation = { nextListId, nextListTitle }`. Fail-closed on any error → static terminal,
    never a dead button. Flag off → first-line return.
  - `:1866-1881` CompletePhase now receives `continuation` + `onAdvance`; `:2356-2377` the action
    area renders **"Advance to {nextList} →"** as primary with "Back to Dashboard" demoted to
    `outline` when (and only when) `isListComplete && continuation && onAdvance`; otherwise the
    single primary button, byte-identical markup. `:2294-2306` the finished copy mentions the next
    list when linked.
  - **testCompleted re-entry gap (found during implementation, fixed):** the most common path to
    the finished terminal returns from the review test with `location.state.testCompleted`, which
    SKIPS init (`:531`) — so `classAssignedListIds` would have stayed `[]` and the button would
    never render. Fix: the id list rides the existing `dailySessionState` sessionStorage blob at
    BOTH persist sites (main navigateToTest `:1236-1239`; crash-recovery `:726-728`) and is
    restored at both restore sites (`:1303`, `:1353`) with a fail-closed `|| []` for stale blobs.
    The extra blob key is inert when the flag is off (nothing reads it).
  - **Keyed remount (judgment call):** advancing navigates session→session on the SAME route
    (`/session/:classId/:listId`, App.jsx:84-90 renders `<DailySessionFlow/>` directly), which
    React Router does NOT remount on param change — the finished list's phase/config/results
    would leak into the next list's init. Fix: `DailySessionFlow` is now a thin wrapper
    (`:86-95`) rendering `DailySessionFlowSession` (the previous component, unchanged hooks)
    with `key={classId_listId}`. No-op for every existing flow: nothing else navigates
    session→session with different params (grepped: the only same-route navigations are
    `navigate(location.pathname)` and test-route round-trips), and the key is constant within a
    session.
- **Dashboard hero** (`src/pages/Dashboard.jsx:1760-1769`): flag-gated
  "Advance to {nextListTitle} →" button under the existing CTA when `listFinished` (the `:1633`
  derivation, formerly `:1565`) and the focus carries a resolvable link. Note: with focus-yield
  live this state is normally already resolved PAST the finished list, so the hero button's main
  future role is the P9 cycling case (yield gated off ⇒ the finished hero becomes the choice
  terminal). Implemented per the plan text; harmlessly unreachable otherwise.
- **"Start over" — capability-gated, NOT rendered:** cycling (P9/`cyclingEnabled`) does not exist
  in the tree, so per "never offer a dead button" NO start-over button is rendered anywhere; both
  terminals carry an explicit P9 comment marking where it joins once the capability is live
  (DailySessionFlow `:2360-2361`, Dashboard `:1753-1754`).

### 4. Focus-yield (C-13 / F6-5) — BOTH `getPrimaryFocus` branches

- `src/pages/Dashboard.jsx:1042-1069` — `buildFocus` gains read-only `nextListId`/`nextListTitle`
  (null with flag off; resolved against the class's `assignedListDetails`).
- `:1071-1102` — `resolveContinuation(klass, list)`: finished test = `twi >= listTotal` with
  `twi = progressData[classId_listId].totalWordsIntroduced || 0` (the same pure `getClassProgress`
  reads the hero derives `listFinished` from — `:692` fetch, `:1633`) and
  `listTotal = list.wordCount || 0` (`listTotal > 0` required). Chain-follows multi-hop sequences
  with a visited-set + hop cap (teacher-configured loops can't spin). Flag off → immediate
  `buildFocus` passthrough (byte-equivalent).
- **Pin branch (the F6-5 fold — verified against the live code before editing):**
  `getPrimaryFocus` returns from the explicit-pin branch FIRST —
  `if (userSettings?.primaryFocusListId)` at `:1106` (pre-edit `:1057`), exact class+list return
  at `:1117` (pre-edit `:1065`), legacy list-only fallback return at `:1128` (pre-edit `:1075`) —
  BEFORE recency (pre-edit `:1084-1108`). Both pin returns now go through `resolveContinuation`,
  so a CS-pinned FINISHED list (the ~287 population) yields to its linked next list. The pin
  itself is deliberately NOT rewritten (read-only resolution — no `updateUserSettings` write): the
  plan allows "resolving focus to the next list" as one of the two admissible mechanisms, and the
  no-write variant is the one that keeps CONT-A pure config-read. The stale pin keeps resolving
  forward on every load; if the link is later removed the pin degrades to exactly today's behavior.
- **Recency branch:** the sorted-winner return (`:1163`, pre-edit `:1108`) goes through the same
  resolver — a finished top candidate stops winning-forever on recency (the C-13 re-wall loop).
- **2b no-progress fallback** (`:1166-1190`) intentionally left on plain `buildFocus`: that branch
  only runs when NO list has `currentStudyDay > 0`, and a finished list necessarily has progress —
  the resolver would be a provable no-op there.
- **Lap-aware for P9 (the F6-5 second half):** the resolver breaks BEFORE yielding whenever the
  assignment has `cyclingEnabled === true` (`:1088`) — under cycling twi legitimately climbs past
  listTotal each lap, so raw `twi >= listTotal` would misfire every lap; a cycling list is never
  auto-yielded (the choice terminal handles it). The field doesn't exist yet → the gate is inert
  today and correct the day P9 ships.

### 5. Continuous start — existing create path only

- "Advance" (both surfaces) is `navigate('/session/{classId}/{nextListId}')` — the session
  terminal's handler additionally performs the SAME cleanup as the existing "Back to Dashboard"
  button (`clearAllSessionStates` = localStorage; `clearSessionState` = the finished list's
  `users/{uid}/session_states` doc — sessionService.js:159, NOT a progress record), verified
  identical to the shipped `onDashboard` handler it sits next to (`DailySessionFlow.jsx:1859-1863`).
- The next list's progress record is created by the UNCHANGED
  `initializeDailySession` → `getOrCreateClassProgress` create-on-miss path
  (`studyService.js:156-158`), reached through the normal route-mount init
  (`DailySessionFlow.jsx:576-588`). **No new write path was added anywhere in this phase.**
- The P8 "Data" item (back-fill `nextListId` for the Base→Ascent→Summit sequences) is a
  David-authorized config CS event against live Firebase — **explicitly NOT executed** (LOCAL-ONLY
  mandate). When run, it uses the same `updateAssignmentSettings` semantics and must be logged to
  SUPPORT_RUNBOOK as its own CS event.

---

## §2.1 falsifier check (the load-bearing one)

> Falsifier: "if implementation review finds ANY CONT-A code path that writes
> `totalWordsIntroduced`/`currentStudyDay` or alters allocation on the FINISHED list, the split
> argument fails and CONT-A re-gates behind P6."

**Confirmed holding — audited write-by-write.** The complete set of state-mutating operations in
CONT-A code:

| CONT-A operation | Target | Progress record touched? |
|---|---|---|
| `updateAssignmentSettings` `nextListId` branch (db.js:951-966) | `classes/{classId}` assignments map (teacher config; same updateDoc as pace) | NO |
| Focus-yield resolver (Dashboard.jsx:1081-1102) | none — pure derivation over already-fetched reads | NO |
| Hero advance (Dashboard.jsx:1763) | none — `navigate()` only | NO |
| Terminal continuation effect (DailySessionFlow.jsx:888-913) | none — one `getDoc(lists/{nextListId})` READ | NO |
| `onAdvance` (DailySessionFlow.jsx:1871-1880) | localStorage clear + `session_states` doc delete (byte-identical to the existing Back-to-Dashboard cleanup) + `navigate()` | NO (session_states ≠ progress; twi/csd live in class_progress) |
| sessionStorage blob key `classAssignedListIds` | browser sessionStorage | NO |

No CONT-A line writes `totalWordsIntroduced`, `currentStudyDay`, `newWordEndIndex`, or any
allocation input of the finished list; the allocation math (`studyService.js:234-235`) is
untouched; no twi writer was added (grep over the diff for `setDoc|updateDoc|writeBatch|deleteDoc`
finds only the pre-existing `updateAssignmentSettings` updateDoc, which gained validated config
keys only). "Advance" is pure navigation + config read; the finished list's record is only ever
touched again by review sessions through pre-existing code. **The pin is not rewritten either**, so
CONT-A adds zero writes to `users/{uid}` settings.

**Uncertainties / flags (honest ledger):**
- **U1 (dual-enroll, plan §8e — expected, not a defect):** terminal and focus-yield key off the
  LAUNCHING class's assignment; two classes linking the same list differently will route
  differently, consistent with class=policy (N1). The pin branch resolves within the PINNED class
  only — a student pinned to class A's finished unlinked copy will NOT yield via class B's link
  (matches "the launching class's link governs"; flag for impl review as the plan asks).
- **U2 (pre-P5 residual, accepted by the plan):** advancing creates one more class-keyed
  `class_progress` doc via the existing create path; P5 re-keys it 1:1.
- **U3 (hero-advance reachability):** with yield active the Dashboard finished hero's advance
  button is normally unreachable (focus already resolved forward); it becomes the live choice
  surface under P9 cycling. Kept per the plan text.
- **U4 (review access to a yielded list):** once yielded, the finished list stops being the
  default focus, so its review sessions are reachable only via explicit navigation (class page /
  focus control cannot re-pin it while linked-and-finished). This IS the plan's intent
  ("finished students stop re-entering B via the C-13 loop") but is a product-visible change to
  note for David's §7.5 confirmation.
- **U5 (line drift):** all pre-edit cites in this doc were re-verified against the working tree
  today; post-edit line numbers are as of this diff and will drift.

---

## Checks run

- `node --check src/config/featureFlags.js` — **OK**; `node --check src/services/db.js` — **OK**
  (repo is `"type": "module"`, so ESM import syntax checks cleanly).
- `node --check` cannot parse JSX (tool limitation, applies to the three .jsx files regardless of
  this diff). Equivalent syntax gate used instead: **@babel/parser** (`sourceType: module`,
  `plugins: ['jsx']`) full-file parse — `Dashboard.jsx` OK, `DailySessionFlow.jsx` OK,
  `ClassDetail.jsx` OK (db.js + featureFlags.js also parsed OK). esbuild/vite build unavailable in
  this WSL env (node_modules carries the win32-x64 esbuild binary — the known "audits run on
  Windows" constraint).
- **ESLint regression diff:** eslint run on all 5 files before vs after this change —
  featureFlags 0→0, ClassDetail 4→4, DailySessionFlow 12→12, Dashboard 23→23, db.js 7→7 findings:
  **zero new findings from this diff** (all pre-existing, incl. the conditional-hooks pattern in
  Dashboard and one unused `assignments` var at db.js:1468 introduced by the earlier uncommitted
  C-35 hunk, not touched here).
- NOT run (out of scope per mandate): dev-server/Playwright visual check (WSL cannot run Vite —
  established program constraint; P8 acceptance personas belong to the Task 4 audit design CA-1..6),
  any live-Firebase read/write, any deploy, any commit.

## Files touched

`src/config/featureFlags.js` · `src/services/db.js` · `src/pages/ClassDetail.jsx` ·
`src/pages/Dashboard.jsx` · `src/pages/DailySessionFlow.jsx` (+ this notes file;
`change_action_log.md` row appended).
