# I-2 — Review-only day-state completion MATRIX + impossible_phase attribution

**Program:** deepfix Task 1.6, investigation I-2. **Date:** 2026-07-13. **Author:** I-2 code investigator.
**Method:** read-only trace of the CURRENT working tree (which carries the UNCOMMITTED #11 fix in
`studyService.js` / `DailySessionFlow.jsx` / `Dashboard.jsx`) + analysis of the F-1 export
(`audit/deepfix/task1/firebase/scan_F1_FINDINGS.md`). No live Firebase access. Verification stance
(David, verbatim): "always verify all claims by all agents and Codex results. Never trust blindly.
Always verify." — every claim below carries `{evidence: file:line, confidence}` against the working tree
as of today.

**Flag state (load-bearing):** `LIST_SCOPED_RECON = true`, `SERVER_REVIEW_MARKER = false`,
`SERVER_ATTEMPT_WRITE = true` (`src/config/featureFlags.js:10,29,42`). All "current behavior" below is the
flag-ON path unless marked. **Prod-bundle inference:** prod emits `day_guard_rejected_session_cleared`
(29 events, F-1), an event that exists ONLY inside flag-gated code (`progressService.js:449-451` gates the
sentinel; `studyService.js:624` gates the emit at `:638`) → **the deployed bundle runs LIST_SCOPED_RECON-ON
code** (behind HEAD, but flag-on). {evidence: studyService.js:624-645, progressService.js:449-451,
scan_F1_FINDINGS.md §day_guard; confidence: high}

---

## §1 — Predicate completeness: every path where newWordCount ≤ 0 at completion/termination

### 1.0 The in-tree machinery (what the code says NOW)

- **Predicate** (`studyService.js:1327-1335`): `reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
  && cfgNewWordCount <= 0 && reviewOnlyReasonConfirmed`, where the confirmed reasons (`:1329-1332`) are
  `allocation.newWords <= 0` (throttle) OR `isListComplete === true` (list-end/over-introduced) OR
  `startPhase === REVIEW_STUDY` (#9 resume). All three reason fields are written by `initializeDailySession`
  (`:182/235` allocation, `:314` isListComplete, `:317` startPhase) and persisted verbatim inside the full
  `sessionConfig` at BOTH sessionStorage persist sites — main `DailySessionFlow.jsx:1167-1178` (`:1175
  sessionConfig`) and crash-recovery `:695-706` (`:703 sessionConfig: recoveryConfig`). {confidence: high}
- **Clamp** (`studyService.js:1339-1342`): `wordsIntroduced = reviewOnlyDay ? 0 : (LIST_SCOPED_RECON &&
  Number.isFinite(cfgNewWordCount) ? cfgNewWordCount : legacy||-chain)` — **plan's claim VERIFIED**: a
  review-only day persists `wordsIntroduced: 0`, so `updateClassProgress`'s `totalWordsIntroduced +=
  wordsIntroduced` (`progressService.js:467`) keeps TWI exactly flat. {confidence: high}
- **Gate skip** (`studyService.js:1430`): `if (!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore <
  threshold) return { requiresNewWordRetake: true }`. Null semantics: no-attempt on a reviewOnlyDay →
  `newWordScore = null` (`:1405-1410`), session_state gets literal `newWordsTestPassed: null` +
  `reviewOnlyDay: true` marker (`:1450-1457`). {confidence: high}
- **Routing that reaches it:** fresh entry with `newWordCount <= 0` and a non-empty review set lands in
  REVIEW_STUDY (`DailySessionFlow.jsx:819-838`), the review test is the session-final test
  (`TypedTest.jsx:971-976`; MCQ mirror `MCQTest.jsx:761`), and completion is invoked AT SUBMISSION TIME
  inside the test page (`TypedTest.jsx:1022-1037`). {confidence: high}

### 1.1 Per-path verdict table

| # | Path | Route (file:line) | Completes correctly? | CSD / TWI / recentSessions effect | Gap? |
|---|------|-------------------|----------------------|-----------------------------------|------|
| **(a)** | **List-end, review backlog** (`wordsRemaining <= 0`, unmastered words exist) | init `studyService.js:234-235,314` → `DailySessionFlow.jsx:819,836-838` REVIEW_STUDY → review test → `studyService.js:1329-1335` (reason: `isListComplete===true` `:1331`) → gate skipped `:1430` | **YES** — completes on the review | csd+1 (`progressService.js:466`), TWI flat (clamp `:1339`→`progressService.js:467` adds 0), review score appended to recentSessions (`progressService.js:455`); summary `newWordScore: null` (`:1405-1410`) | None in the completion path. Terminal UX renders: session `DailySessionFlow.jsx:2200-2219` finished screen; Dashboard persistent finished hero `Dashboard.jsx:1562-1565` (`listFinished`) + copy `:1656-1674`. Residual: C-38 (CS sweep `reviewNoNewPass` will flag every such day — tooling, not code) |
| **(b)** | **Throttle mid-list** (interv = 1.0 → `allocation.newWords = 0`, words remain) | `studyAlgorithm.js:65-99` (interv from last-3 reviews) + `:105-112` (`newWords = round(pace·(1−interv))`) → same routing as (a); reason: `allocationNewWords <= 0` (`studyService.js:1330`) | **YES** — the deadlock is broken; the recovering review IS recorded | csd+1, TWI flat, review→recentSessions → next init recomputes interv (`studyService.js:167`). **Cadence verified:** one high review replaces the last-3 window average (e.g. [0.10,0.40,1.0] → avg 0.5 → interv ≈ 0.56 → newWords > 0) — review-only stretch ≈ 1 day, matching plan §8 | None. Oscillation (interv re-rises on a bad review) is by-design; hero legibility is the deferred Phase-2 UX |
| **(c)** | **Over-introduced negative count** (`wordsRemaining < 0` → `newWordCount < 0`) | `studyService.js:235` (min → negative) → `isListComplete = wordsRemaining <= 0` TRUE (`:314`) → predicate `<= 0` (`:1334`) + reason `:1331` → reviewOnlyDay TRUE → **clamp `:1339` VERIFIED**: `wordsIntroduced = 0` | **YES** — completes; TWI cannot decrement | csd+1, TWI exactly flat (never −N), review→recentSessions | **Flag-OFF residual only:** the legacy branch `:1342` (`newWordCount \|\| newWords.length`) would pass a truthy NEGATIVE through to `progressService.js:467` and decrement TWI — deliberate byte-equivalence (Run-L), academic while the flag is ON everywhere incl. prod (see header inference). Task 2 should delete the legacy branch when the flag is retired. {confidence: high} |
| **(d)** | **All-mastered, empty review, FRESH entry** (list-end or not; no review work exists) | Two sibling terminals: `DailySessionFlow.jsx:822-834` (segment non-null but `buildReviewStudySet` empty) and `:839-847` (segment null — `getUnmasteredPool` empty → `studyService.js:208-219` leaves segment null) → `setPhase(COMPLETE)`, **return before any recording** | **N/A — deliberately does NOT complete** (records NOTHING, advances NOTHING, writes NO automarker, so nothing can revert) — plan guardrail 4 / test 6 ("no fake empty-day completion") | csd frozen, TWI frozen, recentSessions untouched. UX: CompletePhase renders the finished terminal when `sessionConfig.isListComplete` (`:2200,2206-2218`) | Verdict: **by design, correct** for list-end. Note (i): the `:839-847` branch renders the GENERIC "Day N Complete" (isListComplete false) for a hypothetical mid-list all-mastered no-work day — near-unreachable (requires interv=1.0 AND everything mastered, contradictory performance signals) {confidence: medium}. Note (ii): the day is a standing no-op — re-entry recomputes the same day forever until a 21-day rest expires and `returnMasteredWords` (`studyService.js:164`, `DailySessionFlow.jsx:550`) refills the pool. Acceptable terminal; Task 2 should make it an EXPLICIT state, not an emergent loop |
| **(e)** | **Mid-session automarker path (C-14)** — day HAD new words, new test passed, then the review set is empty | Two live triggers: mid-session `moveToReviewPhase` `DailySessionFlow.jsx:950-953`, and REVIEW_STUDY-resume `:596-603` → `showNoReviewModal` (render `:1624,1862`) → `handleNoReviewModalClose` `:964-1008`: `completeSession()` (`:966` → `:1384-1419`, direct `recordSessionCompletion`, **bypasses `completeSessionFromTest` and the #11 predicate entirely**) then writes the marker attempt `:983-1000` with **NO `testId`, NO `newWordStartIndex/newWordEndIndex`** (`SERVER_REVIEW_MARKER=false` → legacy client write is live) | **Completes TODAY (csd+1, TWI += real newWords count `:1414`)** — but the marker cannot satisfy review-pairing: `db.js:3440-3441` requires exact integer range match against the day's anchor → `undefined ≠ int` → `none` | In-place: **NOT reverted under flag-ON** — reconciliation computes `csd = anchorDay − 1` (`progressService.js:182`) but `safeCSD = max(storedCSD, csd)` (`:233-234`) preserves the recorded day. The damage is: (1) **the day does not CARRY** — any fresh/reset progress doc (class move, dual-enroll second doc, CS-deleted doc) reconciles to anchorDay−1 → the student re-does that day in the new context (the C-03 Kaila phantom-loop shape); (2) marker is **gradebook-invisible** (no testId → dropped at `db.js:1963-1977`, C-34); (3) flag-OFF (old bundles) WOULD revert in place — the original C-14 wording holds only there | **YES — GAP, and the in-tree #11 fix does NOT touch it** (it's outside `completeSessionFromTest`). Known + filed (C-14); fix = W2 server marker stamping the day's anchor range + a testId, or pairing accepts `autoCompleted:true` markers. Refinement to C-14's wording: under flag-ON, "reverts on next entry" → "fails to carry + invisible", not an in-place revert {confidence: high} |

### 1.2 Additional zero-new edges checked (completeness sweep)

| Edge | Behavior | Verdict |
|---|---|---|
| Lost/unparseable sessionStorage at review-only completion | `cfgNewWordCount` undefined → `Number.isFinite` false (`:1334`) → NOT reviewOnlyDay → no new attempt found → `newWordScore = 0` (`:1416`) → gate blocks with the nonsense "pass the new-word test first" prompt | Transient, fails CLOSED (never false-open), self-heals on next full init (re-persist at `DailySessionFlow.jsx:1167`). Accepted limitation = plan tests 4/4b + Lens A #5. {confidence: high} |
| Stale finite `0` on an ordinary assigned-new day | `<= 0` passes but NO reason confirms (allocation > 0, not list-complete, startPhase not REVIEW_STUDY) → reviewOnlyDay false → gate applies | Covered — the Codex ROI-1 false-open is closed by `reviewOnlyReasonConfirmed` (`:1329-1332`) {confidence: high} |
| #9 REVIEW_STUDY resume (cross-class same-day pass) | `nwCount=0` + anchor range preserved (`studyService.js:247-274`); reason 3 (`:1332`) makes it reviewOnlyDay, but the gate is ALSO satisfied the strong way: `getNewWordAttemptForDay` position-proven cross-class pass (`db.js:3055-3070`) → `newWordAttemptPassed=true`; real score persists (not null — `:1444-1449` comment + `newAttemptMissing` keying `:1450`) | Correct; wordsIntroduced clamps to 0 → no TWI double-count {confidence: high} |
| Review attempt written on a review-only day carries a degenerate range | fresh review-only init leaves `nwStart = twi`, `nwEnd = twi + count − 1 ≤ twi−1` (`studyService.js:248-249`) → stamped onto the attempt via sessionContext (`DailySessionFlow.jsx:1151-1152` → `TypedTest.jsx:903`) | Harmless for pairing (reconciliation only pairs reviews at the ANCHOR's day, which is the last real new-pass day), but tooling reading ranges should expect `end < start`. Data-shape note for Task 2 / CS sweep {confidence: medium} |
| Day-guard collision during a review-only completion | `updateClassProgress` guard (`progressService.js:441-452`) rejects if another entry point advanced csd; `recordSessionCompletion` aborts + clears session (`studyService.js:624-655`); test page shows rebuild message (`TypedTest.jsx:1051-1057`) | Correct sentinel flow; review-only adds no new exposure {confidence: high} |
| Review-only days don't carry cross-class | Review-only days advance csd with NO new-word anchor → a fresh progress doc reconciles only to the last real-new-anchor day; every review-only day since is invisible to attempt-anchored recon. In-place they survive via non-demoting CSD (`progressService.js:233-234`) | Inherent limit of attempt-anchored reconciliation, acknowledged by plan §7; dissolved by the C-31/N1 student-owned migration. Task 2 must not promise cross-class carry of review-only days before that {confidence: high} |

**Dead code found (worth knowing before Task 2 builds here):** `DailySessionFlow.jsx:800-816`
(`attemptsSayReviewPending` + the `:807-812` empty-review modal branch) is **unreachable**: the same init
already returns on every `startPhase === REVIEW_STUDY` path at `:590-623` (modal `:601`, review `:617`, error
`:621`) and on COMPLETE at `:578-588`. The LIVE resume-empty-review branch is `:596-603`. Plan §5 (Lens A #2)
cites `:807-812` as "the resume branch" — functionally equivalent code, but the citation points at the dead
copy. Cosmetic today; Task 2 should delete the duplicate rather than modify it. {evidence:
DailySessionFlow.jsx:523-853 single `init()` (one definition at `:523`, invoked `:853`); confidence: high}

**Headline verdict §1:** the in-tree predicate + clamp + gate-skip cover **all fresh zero-new completion paths
(a)(b)(c) correctly**, (d) is a correct deliberate no-record terminal — **the one uncovered path is (e)**, the
mid-session all-mastered automarker (C-14), which bypasses `completeSessionFromTest` entirely and writes an
unpairable, gradebook-invisible marker.

---

## §2 — `impossible_phase_detected` (studyService.js:105-114): benign, anomaly, or mixed?

### 2.1 Emitter condition and its two callers

The branch (`studyService.js:105-118`): `dayNumber === 1 && newTest?.passed` → log event (NO userId — the F-1
observability gap) → return phase COMPLETE. `determineStartingPhase(attempts, dayNumber)` has exactly **two
production callers**:

1. **`initializeDailySession` (`studyService.js:238`)** with `dayNumber = reconciledCSD + 1` — the csd here is
   POST-reconciliation (`getOrCreateClassProgress` at `:158` runs first). `attempts` = 8 newest, LIST-scoped
   under the flag (`db.js:3121-3128`).
2. **`Dashboard.jsx:1464`** (panel C hero) with `dayNumber = rawStoredCSD + 1`, where
   `currentStudyDay = progress?.currentStudyDay ?? 0` (`:1456`) comes from **pure, UN-reconciled**
   `getClassProgress` reads (`Dashboard.jsx:692`), and `listAttempts` are **CLASS+list-scoped**
   (`:1461-1463`) out of `fetchUserAttempts` = ALL of the student's attempts, unlimited (`db.js:2404-2415`).
   A loading gate (`:1436-1450`) prevents half-loaded fires; the memo recomputes (and re-fires) on every
   dashboard mount / data refresh while the state persists.

### 2.2 Which caller produces the volume — traced elimination

**Caller 1 (session init) cannot fire in steady state without a correlated `csd_anchor_*` log.** For
`dayNumber === 1` post-reconciliation, `safeCSD` must be 0 — but any VALID passed anchor forces csd ≥ 1
(day-1 anchor → `csd = 1` unconditionally, `progressService.js:155-158`; day-2+ anchor → ≥ anchorDay−1 ≥ 1,
`:182`). So csd = 0 with a visible passed studyDay-1 attempt requires the anchor lookup to have returned
`none`/`query-error`/invalid — each of which logs (`csd_anchor_query_error` `:289-293`, `csd_anchor_invalid`
`:294-302`; the position query `db.js:3267-3298` + studyDay fallback `:3303-3323` make a passed attempt
invisible only if malformed). **Census: `csd_anchor_*` ≈ 0 cohort-wide** → caller 1 contributes ≈ nothing.
{confidence: high}

**Caller 2 (Dashboard) is the live emitter.** It fires whenever the RAW stored csd is 0 (or the progress doc
is MISSING → `?? 0`) while a **passed studyDay-1 'new' attempt exists in the SAME class+list**. Normal day-1
completions do NOT produce this: completion runs at submission time inside the test page, awaited before the
results screen (`TypedTest.jsx:975-1037` — "[3] Complete session (CSD will increment)"), so csd = 1 in
Firestore before the student can navigate back, and a returning Dashboard remount refetches fresh progress.
{confidence: high}

The state therefore exists only when day-1-pass and csd genuinely disagree in Firestore:
- **(T) Transient:** the day-1 attempt was written (server-side, `SERVER_ATTEMPT_WRITE=true`) but the CLIENT
  completion never landed — completion error swallowed (`TypedTest.jsx:1060-1063` "attempt is already saved"),
  day-guard rejection, or tab closed mid-submit. Self-heals at the student's NEXT session entry
  (reconciliation `progressService.js:155-158` writes csd = 1) — but fires on every dashboard visit until
  then, and the census logs 12/1.35d `attempt_write_failed_client`-class flakiness for the completion write
  family.
- **(P) Persistent anomalies:** (P1) progress doc **deleted** (CS dual-enroll consolidation drops the second
  doc while its class attempts survive → `progressData[key]` null → csd ?? 0 — the 이주헌-recurrence family);
  (P2) progress doc **reset to 0** while attempts remain (the "resets don't stick" family); (P3) any recurring
  day-1 completion failure. Each persists — and keeps firing — until the student launches a session in THAT
  class (reconciliation heals) — which for P1/P2 is exactly a reset-to-day-1-with-carried-pass, i.e. the #12
  anomaly SHAPE.

**Important negative result:** the classic #12 promoted-student shape (old-class attempts, NEW class doc) does
**NOT** fire from the Dashboard — the `a.classId === getPrimaryFocus.classId` filter (`Dashboard.jsx:1462`)
excludes cross-class attempts, and the session-init caller reconciles the anchor list-wide first. So the 531
states are NOT a direct census of #12 promotions; they proxy the **same-class csd-vs-attempt divergence**
families (T, P1, P2, P3). {confidence: high}

### 2.3 VERDICT

**MIXED, anomaly-weighted — and never a benign heartbeat.** The branch does NOT fire on normal day-1
completion re-evaluation (interpretation (a) in F-1 is ruled out at the code level: both callers see a
post-advance or post-reconciliation csd on the normal path). Every fire is a REAL "csd=0-or-missing while a
same-class passed day-1 attempt exists" inconsistency; the population splits into a self-healing transient
family (completion-write didn't land before the next dashboard view) and a persistent family (deleted/reset
progress docs = the CS-drop / reset-not-sticking / #12-shape strands). 531 distinct real states over 13 days
(~40/day across 816 students) is plausible for the transient family dominating, with the persistent family as
the minority tail — but only data can fix the ratio. {confidence: high on mechanism, medium on the ratio}

### 2.4 The pin-check the orchestrator should run (read-only, definitive)

Using the F-1 export (events carry `newTestId` = `{uid}_vocaboost_test_{classId}_{listId}_new_{ts}_{rand}`):

1. **Parse** each of the 531 real-26SM `newTestId`s → `(uid, classId, listId)`.
2. **Per-testId fire profile:** event count + first/last timestamps → `spanHours`. Bucket: `span < 24h, ≤3
   fires` = transient (T); `span ≥ 48h or ≥5 fires` = persistent (P).
3. **Join to CURRENT state** (one read per tuple): `users/{uid}/class_progress/{classId}_{listId}` →
   - doc **missing** → P1 (CS-drop family; cross-check against SUPPORT_RUNBOOK consolidation entries),
   - `currentStudyDay === 0` → P2/P3 (live-stuck; check whether a passed studyDay-1 attempt still exists),
   - `currentStudyDay ≥ 1` → healed → T (confirm: last fire precedes the student's first attempt AFTER it —
     the heal-by-session-entry signature).
4. **Join uid set** to the census dual-enroll-98 and hand-patched-82 sets (P1 should intersect the dual-enroll
   consolidations; P2 the patched set).
5. **Falsifier for my caller attribution:** if any tuple fires while its stored csd was provably ≥ 1 the whole
   window AND `csd_anchor_*` = 0 for that uid, my Dashboard-only attribution is wrong — reopen caller 1.

Deliverable of the check: the T:P ratio + the P-population list. P > ~50 students would upgrade this from
"observability noise about known families" to a live stuck-population needing CS action; a T-dominated result
closes it as a legibility/observability fix (log uid+classId, downgrade severity, suppress on the Dashboard
read path — or better, make panel C consume a reconciled read).

---

## §3 — Day-state enumeration: the state machine Task 2 implements (north-star N3)

Legend: **SHOULD** = ideal semantics (N2/N3: every legitimate day state is representable and completes on its
assigned work; terminals are first-class). **NOW** = current working-tree behavior (flag-ON).

| ID | State | Entry condition (derivable from) | SHOULD (ideal) — completion/record semantics | NOW (working tree) | Delta for Task 2 |
|----|-------|----------------------------------|---------------------------------------------|--------------------|------------------|
| S1 | **Day-1 new-only** | csd=0, newWordCount>0 | New test is the day's only gate; pass → record {csd=1, TWI+=n, newScore}; fail → retake. Test identity sealed at launch | Correct: `studyService.js:1369-1378` (no day-1 gate needed — pass gating happens in the test page), completion at submission `TypedTest.jsx:975-1037` | Sealing (CR-5/C-22) is separate work; semantics OK |
| S2 | **Ordinary day (new+review)** | csd≥1, newWordCount>0, review set non-empty | New test gates the day; review is the final test; record {csd+1, TWI+=n, both scores, review→recentSessions} | Correct: gate `studyService.js:1430` (kept intact for assigned-new days — plan test 3), review always-passes by design (`MCQTest.jsx:529`/`TypedTest.jsx:817` per plan §1) | — |
| S3 | **Review-only: throttle (recovery)** | newWordCount≤0 ∧ !isListComplete ∧ allocation.newWords≤0 | Completes on the review alone; record {csd+1, TWI flat, newScore=null (excluded from averages), review→recentSessions so intervention can EXIT}; UX says "recovery", not "behind" | Correct since the #11 fix: predicate reason 1 (`studyService.js:1330`), null semantics `:1405-1417,1450-1457`; exit cadence ≈1 day (verified §1.1b) | Phase-2 UX (recovery hero, teacher "why" legibility) still open by design; `review_only_completion` observability event tracked-not-built (plan §11 B2) |
| S4 | **Review-only: list-end (backlog)** | newWordCount≤0 ∧ isListComplete ∧ unmastered words exist | Completes on review; record as S3; UX = distinct FINISHED terminal, list yields focus to the linked next list / cycling | Completion + terminal screen correct (`DailySessionFlow.jsx:2206-2218`; Dashboard `listFinished` hero `Dashboard.jsx:1565,1656-1674`) — but the finished list KEEPS primary focus (recency ranking `Dashboard.jsx:1096,1104-1108` — C-13) and there is no next-list link (C-12) or cycling (C-11) | Task 2: continuation graph (nextListId / cycling gate on C-31); focus-yield rule |
| S5 | **Review-only: over-introduced** (wordsRemaining<0) | as S4 with negative newWordCount | Same as S4; introduced-count clamps at 0; TWI NEVER decrements | Correct (clamp `studyService.js:1339`; §1.1c) | Delete the flag-off negative-passthrough (`:1342`) when the flag retires |
| S6 | **All-mastered no-work terminal (list-end)** | newWordCount≤0 ∧ review pool empty (all MASTERED & resting) | An explicit REPRESENTED terminal: no fake completion, csd frozen, UX = finished + "words return as their rest expires"; sweeps/teachers see WHY | Emergent, not represented: bare `setPhase(COMPLETE)` no-record terminals (`DailySessionFlow.jsx:822-834,839-847`); finished UX only via `isListComplete`; re-entry loops the same day silently | Task 2: make it a named state; fix the `:839-847` mid-list variant's generic copy (near-unreachable, low priority) |
| S7 | **All-mastered empty-review, mid-session** (new words passed today, review set empty) | day HAD new words; pool empties after the new test | Day completes {csd+1, TWI+=n, review=marker}; the marker must be a FIRST-CLASS, pairable, gradebook-visible artifact carrying the day's anchor range + testId (server-written, W2) | **THE GAP (C-14):** completes via `completeSession()` + client automarker with no range/testId (`DailySessionFlow.jsx:964-1008`) → unpairable (`db.js:3440-3441`) → day doesn't carry to fresh/reset docs; gradebook-invisible (C-34). Not touched by the #11 fix (§1.1e) | Task 2 / W2: server marker stamping `newWordStartIndex/EndIndex` + parseable testId; or pairing accepts `autoCompleted:true` |
| S8 | **Cross-class review-resume (#9 family)** | day's new test passed in ANOTHER class; this class resumes at review | Resume at review with zero re-introduction; completion trusts the position-proven cross-class pass; review attempt carries the anchor range so the day pairs | Correct in-tree: `studyService.js:247-274` (nwCount=0 + anchor range), `db.js:3055-3070` (position+passed proven in-query), reviewOnlyDay reason 3 | Verify-deployed (C-04); dissolves under C-31 |
| S9 | **Finished-terminal steady state** (post-S4/S6 daily re-entry) | isListComplete, day already completed / nothing due | Persistent terminal hero; no misleading "learn N new words"; explicit continuation offer | Hero correct (`Dashboard.jsx:1565` derivable from progress alone); re-entry modal copy still promises "start fresh with new words" (plan Lens C #8, Phase-2) | Phase-2 UX + continuation (C-11/C-12/C-13) |
| S10 | **Day-guard collision / rebuild** | csd advanced elsewhere between init and completion | Completion atomically rejects; session rebuilds; never presented as success; observable with uid | Correct sentinel chain: `progressService.js:441-452` → `studyService.js:624-655` (logs WITH userId) → `TypedTest.jsx:1051-1057` | F-1: 6 real students hit it in prod (pre-fix bundle) — deploy-state issue (C-30/C-36), not a code gap here |

**Invariant set the matrix rests on (Task 2 must preserve):** TWI monotonic + anchor-authoritative
(`progressService.js:229,236`); CSD non-demoting = session count (`:233-234`); anchor `twi = nwei + 1`
(`:148-150`); errored lookups move nothing (`:146,173-181`, `db.js:3402-3411` fail-closed); completion
day-guard (`:441-452`); gate stays intact for assigned-new days (`studyService.js:1430`).

---

## §4 — Summary of NEW findings (beyond confirming known issues)

1. **Predicate coverage is complete for every `completeSessionFromTest` path**; the only zero-new path outside
   it is the C-14 automarker flow (S7), which the built fix deliberately didn't touch. {high}
2. **C-14 refinement:** under flag-ON (tree AND — by the day-guard-event inference — prod), the automarker day
   does NOT revert in place (non-demoting CSD); the harm is non-carry to fresh/reset docs + gradebook
   invisibility. The literal "reverted on next entry" only describes flag-OFF bundles. {high}
3. **`impossible_phase_detected` is effectively a Dashboard-only emitter** (`Dashboard.jsx:1464` on raw
   un-reconciled csd + class-scoped attempts); the session-init caller can't fire without a `csd_anchor_*`
   log (census ≈0). Verdict MIXED (transient completion-lag vs persistent deleted/reset-doc anomalies), never
   a benign day-1 heartbeat; NOT a direct #12-promotion census (class-scoped filter). Pin-check spec in §2.4. {high}
4. **Dead code:** `DailySessionFlow.jsx:800-816` is unreachable (live resume branch is `:590-623`); plan §5's
   `:807-812` citation points at the dead copy. {high}
5. **Flag-off negative-TWI passthrough** survives at `studyService.js:1342` (deliberate byte-equivalence);
   retire with the flag. {high}
6. Review-only-day review attempts carry a degenerate `[twi, twi−1]` range (`studyService.js:248-249` →
   `TypedTest.jsx:903`) — harmless to pairing, but a data-shape expectation for tooling. {medium}
7. Review-only days are structurally invisible to attempt-anchored reconciliation (no anchor) — they survive
   in place via non-demoting CSD but cannot carry cross-class until the C-31/N1 migration. {high}
