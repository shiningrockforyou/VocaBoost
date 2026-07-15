# M-UI build notes — deepfix audit harness, FOUNDATIONAL chunk (Task 5)

**Scope of this chunk:** the shared **seed module** (`audit/playwright/lsr_deepfix_fb.mjs`) + the **M-UI runner**
(`audit/playwright/lsr_deepfix_ui.mjs`) covering the **RO** (review-only) and **RS** (read-surface) scenario
blocks of `audit/deepfix/task4/AUDIT_DESIGN.md` (§1.B, §1.C). Built by extending the proven `lsr_reviewonly*`
scaffolding. **This is TEST code Codex RUNS in Task 6** (David's Windows env). It is **un-runnable in this WSL**
(9p mount — no Vite/Playwright); it was validated here by `node --check`, import-resolution, verbatim-diff of the
reused block, and a walk of each oracle against the design. **No "run" was fabricated — execution validation is
Codex's Task-6 job.**

## Files built
| File | Role |
|---|---|
| `audit/playwright/lsr_deepfix_fb.mjs` | Admin-SDK seed/data layer. `export *` re-exports the whole `lsr_reviewonly_fb.mjs` data layer (guard + RO seeds + oracles + preVerify + snapshotState + resetStudentState) UNCHANGED, and ADDs the §3 seeds RO-S*/RS-* need. |
| `audit/playwright/lsr_deepfix_ui.mjs` | M-UI runner. Extends `lsr_reviewonly.mjs`'s `runScenario` loop + manifest; RA1–RA9 adopted **verbatim**; adds RO-S1/S9/S10 + RS-1..4; writes `findings/deepfix_ui_<runId>.{json,md}`; nonzero exit on any FAIL/INVALID/fatal anomaly. CLI: `node audit/playwright/lsr_deepfix_ui.mjs <runId>`. |

## Scenarios IMPLEMENTED (16) — oracle ↔ AUDIT_DESIGN row
**RO block (§1.B):**
- **RA1–RA9** — adopted **byte-for-byte verbatim** from `lsr_reviewonly.mjs:138-311` (verified by diff: RA1..RA9
  identical, including the unused `const anchor =` binding). They call only imported primitives
  (`FB.seed*`, `driveReviewOnlyDay`, browser verbs), so no library code is duplicated.
- **RO-S1 (S1)** — Day-1 new-only completes at submission. Oracle: results → `csd 0→1`, `twi += pace`, the day-1
  attempt carries the FULL anchor (`newWordStartIndex/newWordEndIndex/wordsIntroduced/testId`). Drives the new
  test with **Korean-first** answers (`carefulAnswersFrom` — the AI grader rejects verbatim-English as copying).
- **RO-S9 (S9)** — Finished steady-state re-entry. Oracle: finished hero PERSISTS across 2 reloads; NO misleading
  "learn N new words"/"start new words" CTA; re-entry shows the terminal and records nothing
  (snapshot hash flat after a 12s settle). Reuses `seedAllMasteredTerminal`.
- **RO-S10 (S10)** — Day-guard collision surfaces as **rebuild, never success**. Mid-session admin `csd` bump
  (`bumpStudyDay`) simulates a concurrent completion; on submit the oracle asserts `outcome==='rebuild'` (NOT
  `results`), `csd` advanced EXACTLY ONCE (`post.csd===bump.to`), and a `day_guard_rejected*` system-log OR a
  day-guard console warn (uid signal). **M-UI leg only** — the transactional server leg is **CS-2 in M-CALL** (deferred).

**RS block (§1.C):**
- **RS-1 (C-33)** — server-side gradebook Name filter surfaces a DEEP-ranked student. `seedDeepGradebook` builds
  the 이지후 shape: a **filler** student with 55 NEWER attempts pushes the **target** (3 OLDER attempts, distinctive
  member `displayName` token) off page 1. Oracle (teacher `/teacher/gradebook`, Name filter = token): target row
  visible AND `Showing:` count == the target's small attempt count (not the 50-cap page of fillers), NOT "no
  results". Proves the `studentId ==` push is **server-side**, not a client post-filter miss.
- **RS-2 (C-34)** — a `testId`-less automarker/manual attempt still renders WITH the list title. `seedTestIdlessAttempt`
  writes an attempt with `listId` set + **no** `testId`. Oracle: the row appears in the teacher gradebook and its
  list cell shows the list title (proves `attemptData.listId ?? parsedListId`, field-first).
- **RS-3 (C-35)** — `assignedLists:[]` + populated `assignments` renders the list on BOTH surfaces.
  `seedAssignedListsEmpty` forces the split-brain. Oracle: list reachable on the student dashboard (focus/option)
  AND shown on the teacher ClassDetail → Assigned Lists tab (proves `getAssignedListIds`' length-check fallback).
- **RS-4 (C-23)** — a genuine `[90,95)` score under a 90-tier + **undefined**-`retakeThreshold` assignment DISPLAYS
  as pass. `seedDriftedAssignment` sets `passThreshold:90` and `FieldValue.delete()`s `retakeThreshold`. Oracle:
  result card shows the PASS state ("Completed Day N session", not "Did not pass") AND the stored attempt
  `passed===true` — proving the stored `serverPassed` wins over the client `0.95` default (`TypedTest.jsx:1385`).

## Scenarios DEFERRED to the next chunk (not in this foundational RO+RS build)
Per `HARNESS_BUILD_PLAN.md`, M-UI eventually also covers these — intentionally **out of scope** here:
- **CUT-2, CUT-3(*), CUT-4, CUT-7, CUT-8** (P4 client cutover personas: reset-via-callable, teacher-view resolver,
  challenge-advance, dashboard reconciled read, C-14/S7 end-to-end). Need P4 wiring + several new seeds
  (`seedImpossiblePhaseT`, `seedPendingChallenge`, `seedS7MidSessionMastered`) and a challenge-accept verb.
- **CA-1..6** (P8 CONT-A continuation). Gated on `CONTINUATION_LINKS`; need `seedNextListLink`/`seedPinnedFinished`
  + terminal/focus-read verbs.
- **CY-1..7** (P9 cycling) and **OV-1/4/5** (P10 override/challenge/inherited-gradebook). **P9/P10 are not yet
  implemented** (`HARNESS_BUILD_PLAN.md` §"Coverage-vs-foundation": build the scaffolding now, add rows when the
  phases land + `file:line` pins are pinned at impl review).
- The **white-box** rows (W-RA3g/4/4b, CS-11, CUT-5/6) belong to **M-WB** (`lsr_deepfix_whitebox.mjs`), a separate
  module in the build order — not this file.

## Reuse map (AUDIT_DESIGN §7)
| Reused UNCHANGED (imported) | Copied verbatim | New in this chunk |
|---|---|---|
| `assertSandboxTriple`, `seedInterventionWindow`, `seedListEnd`, `seedAllMasteredTerminal`, `seedFix9Anchor`, `getListWordIds`, `preVerify`, `snapshotState`, `resetStudentState`, `readProgress/readAttempts/readSessionState/readSystemLogsSince`, `SANDBOX` (all via `export *` from `lsr_reviewonly_fb.mjs`); BASE guard + `newAuditPage`/`login`/`joinClass`/`selectList`/`goDashboard`/`enterReviewSession`/`driveNewWordsToTest`/`readTestRows`/`carefulAnswersFrom`/`partialAnswers`/`fillSubmitAndObserve`/`returnFromResultsAndClearCompletion`/`shot`/`sleep`/`readFocusList`/`listSelectorOptions` (from `lsr_ui.mjs`); `createClass`/`assignList`/`readJoinCode`/`openClassDetail` (from `lsr_teacher.mjs`); the identity guard, `runScenario` shape, `provisionClass`, `driveReviewOnlyDay`, `assertComplete`, `terminalVisible`, `nextStudent`, `setV`, the fail-closed manifest pattern | **RA1–RA9** scenario bodies (`lsr_reviewonly.mjs:138-311`) — `lsr_reviewonly.mjs` is an executable entrypoint that `process.exit()`s on import, so its `SCENARIOS` object can't be imported; copying the bodies (which reference only imported primitives) duplicates **zero** library code | Seeds: `seedDeepGradebook`, `seedTestIdlessAttempt`, `seedAssignedListsEmpty`, `seedDriftedAssignment`, `bumpStudyDay`; read helpers `readClassDoc`, `readMember`; runner helpers `applyNameFilter`, `readShowingCount`, `listReachable`, `escRe`, `bySubmittedDesc`, the `PROV` per-scenario provisioning map; RO-S1/S9/S10 + RS-1..4 oracles; `deepfix_ui_<runId>.{json,md}` manifest |

## Sandbox-guard reuse (BINDING — confirmed)
- Every new seed write calls the **reused** `assertSandboxTriple({email,uid,classId,listId})` FIRST (lsr_*@vocaboost.test
  student + 25WT-prefixed class + its assigned clone). RS-1's filler attempts assert the triple for the filler
  identity too. NO seed bypasses the guard; NO 26SM path exists.
- The runner keeps the reused **import-time localhost-only BASE guard** (via `import ./lsr_ui.mjs`) and the
  **identity guard** (`/^lsr_.*@vocaboost\.test$/` on TEACHER + every SL_STUDENT) before any login/seed.
- The gradebook-visibility fixtures (RS-1/RS-2) are written as **non-anchor** (`review`/manual) attempts precisely
  so they are exempt from the CLAUDE.md passed-`new`-anchor rule and cannot forge an invalid anchor. There are
  **no deliberately-forged anchor fixtures** in this chunk (those live in M-CALL/M-MIG/M-RULES).

## AUDIT_DESIGN oracles I could NOT fully implement here (flagged, not guessed)
1. **RS-1 pager sub-check** ("working pagination"). Implemented the affirmative page-1 surfacing + the `Showing`
   count that proves server-side filtering; did **not** drive the Prev/Next pager loop (extra locators + a
   >pageSize *filtered* set). The design's core oracle (deep student on page 1, not a client post-filter miss) IS
   asserted. Pager exercise → next chunk / Codex calibration.
2. **RS-3 STAT leg** ("sweep signature count == 0 on 25WT"). That's an **M-STATIC** assertion
   (`lsr_deepfix_static.mjs`, already built) — the E2E both-surfaces leg is here; the sweep leg stays in M-STATIC.
3. **RO-S10 server/transactional leg** — the M-UI leg (rebuild + one advance + log) is here; the day-guard
   *transaction* semantics + `day_guard_rejected_session_cleared` exact shape are **CS-2 (M-CALL)**, deferred.
4. **RS-4 exact "90–91%"** — deterministically hitting exactly 90–91% via the AI grader isn't reliable, so the
   oracle targets any score in **`[90,95)`** (28/30 ≈ 93%): above the 90 tier, below the 0.95 client default —
   which is the property the C-23 fix must satisfy. A score landing outside `[90,95)` is scored **INVALID**
   (grader drift → re-calibrate), never a false PASS.
5. **RA7 teacher `PreviousSessionCell "—"` render** — kept as the reviewonly design's **data-only** oracle
   (recentSessions.newWordScore null + avg not NaN); the teacher-cell render is a soft check there and stays so.

## First-run CALIBRATION flags for Codex (design §4 "first-run calibration carry-over")
- **Gradebook filter locators** (RS-1/RS-2): the `Name` category button, the `Search by name…` input, the
  `Add Filter` button, and `Showing: N` are semantic best-effort from `Gradebook.jsx:703/887/901/939`; verify on
  the flag-on build. A locator miss returns **INVALID** (not a false PASS).
- **Teacher gradebook route**: fixed to **`/teacher/gradebook`** (the `/gradebook` route is the *student* view,
  `showNameFilter=false`). Confirm the teacher route serves `queryTeacherAttempts` in the built app.
- **RO-S10 collision semantics**: the `by:1` `csd` bump + the mid-test timing are the calibration knob — if the
  guard compares `studyDay` vs `csd` differently, tune `bump` / the stage point. The `day_guard_rejected*` event
  *type name* is a best-guess list (`day_guard_rejected_session_cleared`/`day_guard_rejected`/
  `duplicate_day_completion_blocked`) with a console-warn fallback; pin the real event name at impl review.
- **RS-4 answer count**: `round(rows.length*0.93)` targets ≈93%; if grader drift moves the score out of `[90,95)`
  the scenario self-reports INVALID with the observed score — adjust the multiplier.
- **WM coverage** of the chosen clone list (Korean answers) is the same assumption the reviewonly RA rows carry.
- **SL_STUDENTS must have ≥2 entries** (RS-1 allocates a distinct filler via `nextStudent()`; filler==target → INVALID).

## Validation performed in WSL (execution is Codex's)
- `node --check lsr_deepfix_fb.mjs` and `node --check lsr_deepfix_ui.mjs` → both parser-clean.
- Imported `lsr_deepfix_fb.mjs` (side-effect-free until `db()`): all 23 expected exports resolve
  (`export *` re-exports + the 5 new seeds/2 read helpers); `SANDBOX.SANDBOX_STUDENT_RE` is a RegExp.
- Grepped every named import from `lsr_ui.mjs` (20 symbols) and `lsr_teacher.mjs` (4 symbols) — all present.
- Diffed RA1–RA9 against `lsr_reviewonly.mjs` → **byte-identical**.
- Enumerated the 16 `SCENARIOS` keys — they match `DEFAULT_SCEN` exactly (no "unknown scenario" INVALID for the
  default set).
- Source regions bound: `db.js:31` (`getAssignedListIds`), `db.js:2001-2118` (`queryTeacherAttempts` server Name
  filter + `pageSize=50`), `db.js:1564` (`attemptData.listId ?? parsedListId`), `TypedTest.jsx:1385` (`serverPassed`
  result card), `TypedTest.jsx:87` (`0.95` default), `App.jsx:130` (`/teacher/gradebook`) — all present in-tree.

---

# M-UI build notes — CHUNK 2 (CUT · CA · CY · OV)

**Scope of this chunk:** extends the SAME two files (`lsr_deepfix_fb.mjs` seeds + `lsr_deepfix_ui.mjs` runner) with
the remaining M-UI E2E blocks of `AUDIT_DESIGN.md`: **CUT** §1.E (P4 client cutover — CUT-2/3/4/7/8), **CA** §1.I
(P8 CONTINUATION_LINKS — CA-1..6), **CY** §1.J (P9 CYCLING_ENABLED — CY-1..7), **OV** §1.K (P10 SERVER_OVERRIDE —
OV-1/4/5 E2E legs). Built by extending the chunk-1 `runScenario` loop, manifest binding, anomaly gate, and
fail-closed conventions **unchanged**. Still **TEST code Codex RUNS** on David's Windows env (Task 6). **Un-runnable
in this WSL** — validated by `node --check`, import-resolution, reuse-correctness (RA verbatim + key↔default match),
and an oracle-walk of each row against the design. **No run fabricated.** These blocks assert the **flag-ON build**
behavior (Codex flips the dormant flags per `CODEX_RUNBOOK`). `DEFAULT_SCEN` now enumerates the full **37-row** M-UI
E2E set (RO+RS+CUT+CA+CY+OV); the manifest `block` label is derived from the attempted set.

## Scenarios ADDED (21) — oracle ↔ AUDIT_DESIGN row + realizability class
Realizability: **[client]** pure render/navigation, fully realizable in M-UI now · **[fns-env]** a leg routes
through a P-phase server callable that needs the FLAG-ON functions env (emulator/test project per CODEX_RUNBOOK ★) —
a dark/flag-off callable self-reports **INVALID (env)**, never a false PASS · **[two-build]** asserts flag-OFF-build
behavior (auto-detects the build).

**CUT (§1.E):**
- **CUT-2** [fns-env] reset-via-callable: seed progress+attempts (`seedFix9Anchor`) → drive the Settings reset flow
  (`#reset-class`/`#reset-list` → two confirm modals → type `RESET`) → oracle: post `csd===0` + attempts wiped
  (server-deleted; client-delete path dead under the flag). `resetProgress` error → INVALID (SERVER_RESET_PROGRESS
  env). Dual-class epoch (CS-9) is M-CALL.
- **CUT-3** [client] teacher Students view via resolver: `seedFix9Anchor(day3)` + member token → teacher ClassDetail
  → Students tab → oracle: the row renders the **reconciled** `Day N` (N≥2), not a stale legacy read. Straggler
  hydrate-on-miss = CS-8/M-CALL.
- **CUT-4** [fns-env] 3rd-twi-writer routed: `seedPendingChallenge` NEW-variant near list end (this student) +
  REVIEW-variant (a distinct filler, like RS-1) → teacher `/teacher/gradebook` review drawer → **Accept ✓** →
  oracle: NEW-phase accept advances the day + `twi ≤ listSize` (clamped); REVIEW-phase accept leaves `twi` **flat**
  (nwei:null hazard). Accept alert (callable dark) → INVALID. Legacy-`class_progress`-untouched leg = STATIC/M-CALL.
- **CUT-7** [client/resolver] dashboard reconciled read: `seedImpossiblePhaseT` (valid passed-day-1 anchor + STALE
  `csd:0`) → dashboard hero → oracle: hero renders the reconciled `DAY≥2` AND **zero** `impossible_phase_detected`
  in `system_logs` during the visit. Hero unread (resolver dark) → INVALID.
- **CUT-8** [fns-env] C-14/S7: `seedS7MidSessionMastered` (valid passed-new anchor + all introduced words MASTERED)
  → entry drives the empty-review automarker → oracle: a **server marker** attempt appears with a parseable `testId`
  + real `newWord{Start,End}Index` (CS-5 shape) and the day carries (`csd ≥ studyDay`). No marker → INVALID
  (SERVER_REVIEW_MARKER env / S7-path calibration).

**CA (§1.I) — all [client] (RA6-style all-mastered terminal entry; no completion write):**
- **CA-1** finished terminal offers `Advance to {nextListTitle} →` when `assignments[list].nextListId` is set
  (`seedNextListLink`). Oracle: button visible + labeled with the **next list title** (read from the link, not
  another source).
- **CA-2** advance = pure navigation (§2.1 falsifier): click Advance → next list starts a **Day-1** session AND the
  FINISHED list's record is **unchanged** (list-scoped snapshot `csd|twi|recentLen` equality after a 12 s settle).
- **CA-3** focus-yield PIN branch: `seedPinnedFinished` (`settings.primaryFocusListId` on a finished, linked list) →
  Dashboard `List:` focus == the **next** list (pin resolved past, not rewritten).
- **CA-4** focus-yield RECENCY branch: unpinned finished list (`setPrimaryFocus(null)`) → focus == next list.
- **CA-5** never a dead button: NO `nextListId` → the static P1 terminal EXACTLY (no Advance, no Start-over pre-CYC,
  Back-to-Dashboard present).
- **CA-6** dual-enroll: class A links NEXT_LIST, a provisioned class B links NEXT_LIST_B (needs ≥3 teacher clones);
  finishing under A offers **A's** next, not B's (launching class = policy, §8.3 e).

**CY (§1.J):**
- **CY-1** [client] `Start over (review the list again)` renders iff `assignments[list].cyclingEnabled`
  (`seedCyclingAssignment`) — under the global `CYCLING_ENABLED` build flag. Absent under a supposed flag-on build →
  INVALID (confirm the flag).
- **CY-2** [client] lap rollover: Start over → a new lap begins (cap removed → new-words allocation resumes). The
  twi-past-`listTotal` **persistence** + lap-aware **display** are the CY-3/M-CALL completion leg (flagged residual).
- **CY-3** [fns-env] lap-2 day completes; M4 lap-aware: drive a lap-2 new-words day to results → oracle: `twi > listTotal`,
  zero `anchor_rejected`/`csd_anchor_invalid`. Completion routes through `completeSession` → INVALID when unreachable.
- **CY-4** [fns-env] review pool lap-BOUNDED: after a lap-2 completion, `study_states` non-MASTERED pool ≤ cycleLength
  (a **proxy**). The exact lap-field membership assert is M-WB/M-CALL (flagged). INVALID when lap-2 unreachable.
- **CY-5** [fns-env] review-only × laps: throttle the lap-2 student (`seedInterventionWindow`) → a lap-2 review-only
  day completes with `twi` **flat** (reuses `assertComplete`/`driveReviewOnlyDay`). INVALID when unreachable.
- **CY-6** [two-build] flag-OFF mid-lap dead-end: auto-detects the build — Start over present ⇒ INVALID
  ("run against the flag-off baseline"); on the flag-off build → terminal renders, no `twi`/`csd` regression.
- **CY-7** [client] finished/focus lap-aware: `seedCyclingAssignment` WITH a link → Dashboard focus **stays** on the
  cycling list (no spurious per-lap yield). Spurious yield → FAIL (with a flag caveat in the detail).

**OV (§1.K) — E2E legs only (OV-2/3/6 = M-CALL/M-RULES):**
- **OV-1** [client+seed] permafail → override → unstuck: `seedPermafail` (failed-new, stuck) → `applyOverrideAnchor`
  (**stands in** for the `overrideAttempt` callable's server WRITE — the callable's authz UNION + audit-log +
  server derivation is **CS-6/OV-1-CALL**, NOT exercised here) → oracle: the override attempt carries a FULL VALID
  anchor (nwsi/nwei/wordsIntroduced/testId, `nwei===nwsi+wordsIntroduced-1`) AND the day advances on re-entry.
- **OV-4** [fns-env] orphaned challenge (C-19): `seedPendingChallenge(exTeacherId=EX_TEACHER_STAMP)` → the CURRENT
  owner accepts the inherited pending challenge (no "단어 권한이 없습니다" throw). Needs TEACHER_IDS_READ (owner sees it)
  + SERVER_OVERRIDE (accept routes) — either dark → INVALID.
- **OV-5** [client/flag] gradebook inherited-attempts + ex-roster filter: `seedInheritedAttempt`
  (`teacherId:ex`, `teacherIds:[ex,owner]`) → owner `/teacher/gradebook` Name filter shows the A-stamped row and
  does NOT hard-empty. Needs TEACHER_IDS_READ flag-on → INVALID when the array-contains query is not effective.

## New seeds/helpers added to `lsr_deepfix_fb.mjs` (same guard + anchor discipline)
`validAnchorAttempt` (internal — the shared manual-pass-parity anchor builder, so no chunk-2 seed can emit an
invalid anchor); **seeds** `seedNextListLink`, `seedPinnedFinished`, `seedCyclingAssignment`, `seedPermafail`,
`applyOverrideAnchor` (labeled override-write stand-in), `seedImpossiblePhaseT` (labeled), `seedS7MidSessionMastered`,
`seedPendingChallenge` (labeled; CUT-4 + the OV-4 orphaned variant via `exTeacherId`), `seedInheritedAttempt`
(labeled; the OV-5 promoted-student fixture), `seedMemberToken`, `setPrimaryFocus`; **reads** `readAssignment`,
`readUserSettings`, `readAttemptDoc`, `readStudyStates`. Every WRITE calls `assertSandboxTriple` FIRST;
`seedNextListLink` guards BOTH the primary and the (newly-assigned) next-list triple. Runner **verbs**:
`openFinishedTerminal`, `terminalButtons`, `advanceButtonForTitle`, `acceptPendingChallenge`, `resetViaSettings`,
`readTeacherStudentsRow`.

## Sandbox-guard + anchor discipline (BINDING — confirmed)
- Every chunk-2 seed WRITE goes through the reused `assertSandboxTriple` (lsr_*@vocaboost.test + 25WT + assigned
  clone). No 26SM path. `seedNextListLink`/`seedPinnedFinished`/`seedCyclingAssignment(nextListId)` guard the
  next-list triple AFTER assigning it. The synthetic `EX_TEACHER_STAMP` is a field VALUE only (never an auth
  identity; the real class owner is teacher B).
- Anchor-bearing seeds (`seedImpossiblePhaseT`, `seedS7MidSessionMastered`, `seedPendingChallenge` NEW-variant,
  `applyOverrideAnchor`) use `validAnchorAttempt` → always a FULL valid anchor. `seedPermafail` is a FAILED-new
  attempt (not an anchor); the gradebook-visibility inherited fixtures are NON-anchor `review` attempts — all
  exempt from the passed-`new` rule. Deliberately-special fixtures are labeled in `manualReviewNote`.
  **No deliberately-forged INVALID anchors in this chunk** (those stay in M-CALL/M-MIG/M-RULES).

## AUDIT_DESIGN oracles NOT fully realized here (flagged — INVALID, never a false PASS)
1. **CUT-4 legacy-`class_progress`-untouched** — the E2E asserts the advance + clamp + review-phase-flat; the
   "legacy doc untouched" leg is STATIC/M-CALL (M-UI reads `class_progress` AS the progress source).
2. **CY-2 twi-past-`listTotal` + lap-aware display** — the client leg proves the lap RESUMED (cap removed); the
   monotonic-twi persistence + lap-display need a completed lap-2 day → CY-3/M-CALL (documented as a partial, the
   RS-1-pager precedent).
3. **CY-4 exact lap-membership** — realized as a bounded-pool proxy (`study_states` non-MASTERED ≤ cycleLength);
   the precise "only lap-2-eligible words" assert keyed on the lap field is M-WB/M-CALL (the lap-field name is a
   first-run pin).
4. **OV-1 override CALLABLE** — the E2E certifies only the UNSTICK corollary + the override-anchor VALIDITY via
   `applyOverrideAnchor`; the `overrideAttempt` callable itself (I-10 §6 authz UNION + audit-log row + server
   derivation) is **CS-6 / OV-1-CALL**. The in-product override BUTTON is deferred to P10(c) (`featureFlags.js:132`),
   so there is intentionally no UI to drive here.
5. **CUT-8 S7 automarker path** — reproducing the exact mid-session marker WRITE depends on SERVER_REVIEW_MARKER
   flag-on fns env AND the precise empty-review-after-passed-new trigger; the seed sets the precondition and the
   oracle fails CLOSED to INVALID if no marker materializes (first-run path calibration).

## First-run CALIBRATION knobs for Codex (design §4)
- **Choice-terminal copy** (`DailySessionFlow.jsx:2454/2467/2476`): `Advance to {title} →` / `Start over (review the
  list again)` / `Back to Dashboard`. The continuation title resolves via an async `getDoc(lists/{nextId})` — if the
  Advance label lags the 5 s terminal entry, add a short wait before `terminalButtons` (the positive CA rows).
- **Settings reset** (`Settings.jsx`): `#reset-class`/`#reset-list` `<select>` (by option `value` = classId/listId),
  the "Reset Progress" button, modal-1 "Continue", modal-2 `Type RESET` input + final "Reset Progress". A
  `resetProgress` alert/`resetError` → INVALID (SERVER_RESET_PROGRESS env).
- **Teacher gradebook challenge review** (`Gradebook.jsx:1366-1408`, route `/teacher/gradebook`
  `challengeMode="review"` `App.jsx:135-140`): "View Details" → "Challenge Pending" panel → `Accept ✓`; a
  `reviewChallenge` failure `alert()` is armed→captured as a non-fatal dialog → `callableError` → INVALID.
- **Dashboard focus / hero** (`Dashboard.jsx:135`/`1071-1213`/`1882`): `List:` focus reader (reused `readFocusList`)
  for CA-3/4 + CY-7; the hero `DAY N` badge (N = csd+1) for CUT-7.
- **Flag confirmation**: CY-1/CY-2/CY-3/CY-7 assume `CYCLING_ENABLED` is ON in the served build; CY-6 assumes it is
  OFF (two-build); CUT-7 assumes the resolver (`SERVER_PROGRESS_WRITE`) is reconciling; OV-4/OV-5 assume
  `TEACHER_IDS_READ`; CUT-2/4/8, OV-4 assume the matching P-phase callable is deployed flag-on in the M-UI fns env.
- **Clones**: CA/CY multi-list rows need ≥2 teacher clones (CA-6 needs ≥3) in `lsr_lists.json` — teacher_01 has 5,
  teacher_02 has 3, so both suffice; fewer → the row self-reports INVALID. **SL_STUDENTS ≥ 2** (CUT-4's review arm
  allocates a distinct filler — filler==target → INVALID).

## Still DEFERRED (not M-UI)
- **M-CALL**: CUT-4/CY-3 server clamp+derivation, CUT-8 marker transaction, CUT-2 reset epoch (CS-9), OV-1 override
  callable (authz+audit), OV-2 authz-union triple, OV-3 reviewChallenge clamp/phase-gate, CS-1..11.
- **M-WB**: W-RA3g/4/4b, CS-11, CUT-5 (storage stub), CUT-6 (forced-deny), CY-4 exact lap-membership.
- **M-RULES**: RUL-1..9, OV-6 rules narrowing. **M-MIG**: MIG-1..10, RET-3. **M-STATIC**: DG, CUT-1, RET.

## Chunk-2 validation performed in WSL (execution is Codex's)
- `node --check` on both modules → parser-clean.
- Imported `lsr_deepfix_fb.mjs` (side-effect-free until `db()`): **43** exports resolve; every `FB.*` symbol the
  runner references is present; `SANDBOX.SANDBOX_STUDENT_RE` is a RegExp.
- Every named import from `lsr_ui.mjs` (24 symbols incl. the new `enterSessionOnly`/`readFocusClass`/`switchClass`/
  `armDialog`/`lastDialog`) and `lsr_teacher.mjs` (4) resolves.
- Enumerated the **37** `SCENARIOS` keys — they match `DEFAULT_SCEN` exactly (no unknown-scenario INVALID).
- RA1–RA9 re-diffed against `lsr_reviewonly.mjs` → still **byte-identical** after the chunk-2 edits.
- Every chunk-2 runner helper (`openFinishedTerminal`, `terminalButtons`, `advanceButtonForTitle`,
  `acceptPendingChallenge`, `resetViaSettings`, `readTeacherStudentsRow`) is declared exactly once and called.
- Source regions bound: `featureFlags.js:49/79/100/114/137` (CONTINUATION_LINKS/CYCLING_ENABLED/SERVER_RESET_PROGRESS/
  SERVER_OVERRIDE/TEACHER_IDS_READ), `DailySessionFlow.jsx:911-937` (continuation effect), `:1942-1965`/`:2350-2478`
  (CompletePhase Advance/Start-over/Dashboard buttons), `:845-875` (all-mastered COMPLETE terminal),
  `Dashboard.jsx:756-759` (`users/{uid}.settings`), `:1071-1213` (`getPrimaryFocus`/`resolveContinuation` yield),
  `:1882-1889` (hero Advance), `Settings.jsx:267-472` (reset flow), `Gradebook.jsx:1366-1408` (challenge Accept/Reject),
  `App.jsx:131-142` (`/teacher/gradebook` `challengeMode="review"`), `studyService.js:268` (`impossible_phase_detected`),
  `db.js:31/513` (`getAssignedListIds`→`assignedListDetails`) — all present in-tree.
