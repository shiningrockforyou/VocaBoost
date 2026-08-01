# Unified session state — screens→states map + one canonical derivation (design, 2026-07-20)

**Origin:** David — "there are a lot of redundant screens; ideally one state-aware screen/modal reused throughout, calculating
state from the record." This maps the current screens to the states they represent, shows what collapses, and locates the single
state-derivation. Built from two read-only explorations (UI flow + state-derivation surface). **DESIGN ONLY — nothing built.**

## The headline: it's ONE problem with two faces

- **UI face (redundant screens):** ~6 render phases that are really states of one machine, with the **study→test→results** pattern
  duplicated once for NEW and once for REVIEW, **three** places that show test scores, **two** phase enums, and **two** Dashboard
  "start" paths for the same list.
- **Logic face (scattered derivation):** "what should this student see right now?" is computed in **~11 places** across client and
  server, several as **hand-maintained byte-for-byte twins** (the server cites the client's line numbers in comments).
- **Same fix collapses both:** ONE server-authoritative record → ONE pure `deriveSessionState(record) → view-model` → ONE
  state-aware container that renders it. The redundant screens fold into states; the duplicated logic folds into one function.

## 1. Screens → the state they represent

| Current screen | State | Component (file) | Redundant with |
|---|---|---|---|
| Loading spinner | `deriving` | DailySessionFlow.jsx:1790 | — |
| New-word study (flashcards) | `study(new)` | `StudyPhase` (DailySessionFlow:1932) | Review study (same component) |
| New-word test | `test(new)` | `MCQTest`/`TypedTest` route | Review test (same route, mode=review) |
| New-word test results | `result(new)` | `renderResultsCard`+`TestResults` (MCQTest:1167/1365) | Review results, RetakePrompt, SessionSummary |
| RetakePrompt (in-session) | `result(new)` **vestigial** | DailySessionFlow:2367 | The test-route results card — dead dup (no `setPhase(NEW_WORD_TEST)` exists) |
| Review study (flashcards) | `study(review)` | `StudyPhase` (DailySessionFlow:1971) | New-word study |
| Review test | `test(review)` | `MCQTest`/`TypedTest` route | New-word test |
| Review test results | `result(review)` | test-route card | New results |
| Complete terminal | `complete` | `CompletePhase`+`SessionSummaryCard` | Re-shows BOTH scores = 3rd results view (SessionSummaryCard:52-77) |
| Re-entry "resume Day N?" modal | `resume-decision` | `ConfirmModal` (:2076) | RetakePrompt — both are "you scored X%, retake?" |
| Empty-review modal | `no-review` | `ConfirmModal` **rendered twice** (:1798 & :2088) | Itself |
| Dashboard focus hero CTA | `entry` | Dashboard:1873 (raw navigate, no guard) | The per-list "Start Session" row (same list) |
| Dashboard per-list "Start Session" | `entry` | Dashboard:2161 (`handleStartSession`, guarded) | The hero |

Plus `REVIEW_TEST` is a **defined-but-never-rendered** phase, and there are **two phase enums** for the same 5 states
(`SESSION_PHASE` persisted kebab-case sessionService.js:27 ↔ `PHASES` local snake_case DailySessionFlow.jsx:77, bridged by a
translation map at :305-310).

## 2. Where "what to show" is computed today — ~11 scattered sites (no canonical)

Client: `determineStartingPhase` (studyService.js:228, called from 3 sites), `initializeDailySession` (:347),
`completeSessionFromTest` (:1729, re-derives reviewOnly/hold/gate/phase), Dashboard `panelCState`+`getPrimaryFocus`
(Dashboard.jsx:1581/1078), `session_state.phase` writers (sessionService.js — a **4th phase store the routing code explicitly
refuses to trust**), and the client reconciliation/advance twins (progressService.js:160/570/663, flag-suppressed not deleted).
Server: `completeSession` advance-vs-hold (foundation.js:1367), `resolveListProgress`+`computeAnchorPosition` (:1737/:914),
`deriveThrottleModeServer` (:702), and a **3rd** copy in `validateAttemptAnchorShadow` (:1148). **Byte-parity twins** (throttle,
intervention, allocation, review-only reasons, advance/hold, anchor→csd/twi, completion-engagement, review-pairing) are kept in
sync by hand. **Every "runaway"/off-by-one/dual-class bug this month traces to two of these using slightly different predicates.**

## 3. Target architecture

1. **One server-authoritative record.** Promote canonical `users/{uid}/list_progress/{listId}` (the P5 `LIST_PROGRESS_CANONICAL`
   flip) so `csd/twi/reviewMode/recentSessions` have exactly ONE writer (`completeSession`/`resolveListProgress`). Retires the
   client reconciliation + advance/hold twins.
2. **One pure derivation:** `deriveSessionState(record, dayAttempts, assignment, now) → view-model` =
   `{ dayNumber, phase, mode:'new'|'review', reviewMode, interventionLevel, allocation, segment, isListComplete, testSizeReview,
   recoveredScores, heldReason }`. This is `initializeDailySession`'s pure core fused with `determineStartingPhase`, Firestore
   reads hoisted out. The building blocks (`deriveThrottleMode`, `calculateDailyAllocation`, `calculateReviewTestSize`,
   `reviewPairsWithAnchor`) are **already pure** → consolidation, not rewrite.
3. **Ship that one module to BOTH runtimes** (shared `src/utils`, imported by the Cloud Function) so client (Dashboard + session)
   and server (`completeSession` + shadow) call the *identical* function → the hand-synced twins and the "parity with
   studyService.js:NNN" comments disappear.
4. **UI = pure render of the derived object.** ONE `<SessionStage phase={…}>` container (fold the two enums into one) renders:
   - `study` (ONE `<Study mode>` — new & review already share `StudyPhase`),
   - `test` (ONE `<Test mode testType>` — MCQTest/TypedTest collapse; it becomes the SINGLE results surface),
   - `complete`. Retire `RetakePrompt` (vestigial) and the score re-shown in `SessionSummaryCard`; unify the two "you failed,
   retake?" mechanisms (RetakePrompt vs re-entry modal) into one. **Delete `session_state.phase` as a routing input** (already
   declared untrustworthy) — keep session_state only for display scratch (dismissed words, in-flight scores).
5. **Dashboard: one "start" affordance per list** (hero = shortcut to the guarded `handleStartSession`, not a 2nd raw navigate).

## 4. Why it's worth it (payoff)
- **Redundant screens collapse** (David's ask) — ~13 screens → ~4 states of one container.
- **The bug class collapses** — off-by-one / throttle / dual-class / runaway all came from duplicated derivation; one authority
  + one function ends that family.
- **The stuck-student notification** (the earlier request) becomes a **derived field** (`heldReason: 'low-reviews' | 'list-end'`)
  the container renders — no separate wiring.
- **New features become "add a state"** not "touch 11 places" (e.g. the review-pass gate (ships ON@92 inside DF2-14 — not banked, post-R2)).

## 5. Scope, sequencing, risk (honest)
- **Real refactor, but mostly consolidation** of existing pure functions — not a from-scratch rewrite.
- **Intersects the pinned cutover + P5:** the server is mid-cutover (`0ddbb34` pinned, GO-HOLD) and the canonical
  `LIST_PROGRESS_CANONICAL` migration is the "one authority" prerequisite. This work should **sequence with/after P5**, not race it.
- **Do it incrementally, behind the grain:** (a) extract `deriveSessionState` as a pure module and route the *existing* call sites
  through it (no behavior change, provable equivalence vs the twins); (b) unify the UI container + enums; (c) shared-module the
  server; (d) delete the flag-suppressed client twins once canonical is authoritative. Each step independently shippable/verifiable.

## 6. Open questions for Codex (architecture review)
- Is `deriveSessionState` genuinely factorable as a pure function today, or do hidden Firestore/async reads (unmastered-pool,
  cross-class anchor) block a clean extraction? Where's the seam?
- Sequencing vs P5/canonical: can step (a) (extract + route existing sites) land BEFORE the canonical flip, or does the
  two-writer reality make that unsafe?
- Client↔server shared module: is a shared `src/utils` importable by the Cloud Function without bundling/`new Date()`/`Math.random`
  hazards? (server runs UTC, KST offset, no DST — the token work hit this.)
- Any state the current scatter handles that a single derivation would MISS (cross-class LIST_SCOPED_RECON, cycling, grandfather
  epoch, #9-resume)? Enumerate the edge states the view-model must carry.
- Does deleting `session_state.phase` as a routing input lose anything real (crash-recovery, multi-tab)?

## 7. Review — WSL stopgap (Codex unavailable r40, 2 poll timeouts; Codex can still re-review)

Answering §6 critically (not rubber-stamping my own plan):

1. **Extractable? Yes — but the async part is the INPUT ASSEMBLY, not the derivation.** The derivation building blocks
   (`deriveThrottleMode`, `calculateDailyAllocation`, `calculateReviewTestSize`, `reviewPairsWithAnchor`,
   `computeCyclingAllocation`, `determineStartingPhase`) are already pure. The blocker is that `initializeDailySession`
   *interleaves* Firestore reads (`getOrCreateClassProgress`, the unmastered pool, list wordCount, the cross-class
   `getMostRecentPassedNewTest` anchor) with the derivation. **Seam:** `deriveSessionState(record, dayAttempts, resolvedAnchor,
   unmasteredPool, assignment, listMeta, now)` — the CALLER does the async reads, passes plain data in. So the real work isn't
   "make it pure," it's "untangle the read-then-derive interleaving." Doable, medium.

2. **Sequencing — the safe FIRST increment does NOT need the canonical flip and does NOT touch the server.** Extracting
   `deriveSessionState` and routing the **client** sites (`initializeDailySession`, `determineStartingPhase`, Dashboard
   `panelCState`) through it is a pure refactor with byte-identical output — no change to where the record comes from, no P5
   dependency, and critically **no functions deploy** (so the pinned `0ddbb34` cutover is untouched). The server-side unification
   + twin deletion must wait for canonical + the next functions deploy. **⇒ First increment = client-only extraction, proven
   equivalent.**

3. **Shared module — a real packaging wrinkle: `functions/` is a SEPARATE package; it cannot `import ../src/utils`.** So a live
   cross-package import is out. Realistic options: (a) a copied/generated pure module in `functions/` with a test asserting
   byte-equality to the `src/` original, or (b) a shared workspace package. The `now`/`Date.now`/`Math.random` hazard is handled
   by the plan's "inject `now`" rule (the token work already proved this). ⇒ don't promise a live shared import; promise "one
   source, generated/copied into both, equality-tested."

4. **Biggest risk — an INCOMPLETE view-model.** A single derivation must carry every state the scatter handles or it silently
   drops edge cases (= new bugs): `reviewMode/heldReason`, `isListComplete` (list-end terminal), `reviewStudyResume` (#9-resume),
   cycling (twi past list size), cross-class carry (LIST_SCOPED_RECON anchor), grandfather-epoch completion-engagement,
   empty/all-mastered review, mid-test crash-recovery, AND the review-pass gate (ships ON@92 inside DF2-14 — not banked, post-R2). **This enumeration must be exhaustive
   BEFORE coding** — it's the highest-risk item.

5. **Deleting `session_state.phase` as routing input — safe.** Routing already treats it as untrusted (DailySessionFlow:822-833,
   attempts-only doctrine); `session_state` stays for display scratch (dismissed words, in-flight scores) + crash-recovery uses
   `sessionStorage`, not `.phase`. Low risk.

6. **Direction: SOUND.** Standard `UI = f(state)` + single source of truth; attacks the bug root. **Biggest risks:** (i)
   incomplete view-model (#4), (ii) server unification colliding with the pinned cutover/P5 (#2). **Correct first increment:**
   client-side `deriveSessionState` extraction + route the 3 client sites, asserting byte-identical output vs today — independently
   shippable, no server/canonical dependency. Then unify the UI container (fold the 2 enums, one `<SessionStage>`, one `<Study>`,
   one `<Test>`). Server unification last.

**Caveat:** this is a self-review — it lacks Codex's independent eye. If Codex comes online, re-run r40 for a second opinion,
especially on the view-model completeness (#4) and the pure-extraction seam (#1).

## 8. CRITICAL CONVERGENCE (2026-07-20) — roster: 1 Fable + 2 Opus + WSL (Codex absent, 3rd non-response)

**Unanimous verdict: SOUND-WITH-GAPS.** All three critics + WSL agree the DIRECTION (UI=f(state), one authoritative record, one
derivation) is right and attacks the bug root. But the critics found **3 factual errors in §7 and one STRUCTURAL miss** that
change the first increment. Codex did not participate (r40 handoff still queued; folded as addendum if it responds).

### Convergent findings (≥2 critics independently — highest confidence)
- **C1 — Dashboard MUST be excluded from the byte-identical first increment** (Opus-sequencing + Fable-extraction, both with
  code). Dashboard `panelCState` feeds the derivation **class-scoped** attempts (Dashboard.jsx:1620-1622) + a **Math.max'd** csd
  (:1613-1615); the session path feeds **cross-class** attempts (db.js:3416-3423 under LIST_SCOPED_RECON) + a reconciled csd.
  They *already* legitimately disagree for dual-class students (the 박연서 case) → "one function ≠ one answer." Routing Dashboard
  through the fused fn is a **behavior change**, not a byte-identical move. **Corrects §7.2** (which said "route the 3 client sites").
- **C2 — re-CALL the leaf utils, never EDIT them** (both). `forcedPathway.js`/`reviewPairing.js` are already shared with the
  pinned server twins; editing a leaf obligates re-porting foundation.js + a deploy (breaks "no deploy"). By transitivity,
  byte-identical-to-today ⇒ server parity preserved. **Add this as an explicit constraint** (§7 omitted it).

### Unique high-value findings
- **G0 (Opus-completeness — THE biggest, a STRUCTURAL miss everyone else made too):** the seam `deriveSessionState(record)→VM` is
  pure-of-**record** = ENTRY derivation. But **~⅓ of the states are WRITE-TIME / EXIT outcomes** (`completed`, `already_completed`,
  `day_guard_rejected`, `no_evidence`, `review_recorded`, `requiresNewWordRetake`, `quarantined`) that are **never persisted to the
  record** (foundation.js:1466-1506 write no status). A pure(record) function renders a **rejected/held/refused submit as
  "success/complete"** = silent CSD/TWI corruption + stranded student. **⇒ It is TWO derivations, not one: entry (record→VM) +
  exit (writeOutcome→VM). Add a second input channel `lastWriteOutcome`.** Invalidates the literal "one derivation" framing.
- **G1 (Opus-completeness):** the plan's `heldReason:'low-reviews'|'list-end'` is **semantically WRONG** — `list-end` **ADVANCES**
  (it isn't "held"); `#9-resume` and the **non-engaged skip-hold** are missing. Must be the full 4-outcome reviewOnly/hold model
  (allocationZero-hold vs listComplete-advance vs reviewStudyResume-advance vs skip-hold). The `#11`/`#16` hold-vs-advance axis.
- **G2 (Opus-completeness — scoping correction):** **NO "held/stuck/low-reviews" surface exists in the UI today** (verified). So
  the `heldReason` banner (and the earlier "notification for stuck students" idea) is **net-new UI, not a consolidation** — plan
  for it as a feature, don't assume it falls out for free.
- **G3 (Fable-extraction):** **§7.1's "`determineStartingPhase` is already pure" is FALSE** — it fires a Firestore write
  (`impossible_phase_detected`, studyService.js:298-305) on the day-1-passed branch; Dashboard.jsx:1583-1585 exists to gate that
  side effect. Return an `anomalies` field from the pure core; the assembly logs it.
- **G4 (Fable-extraction — biggest extraction risk):** "caller does the async reads" hides **ordered WRITES** —
  `returnMasteredWords` (studyService.js:355) must run **before** the unmastered-pool read (:418), and a reconciliation
  `updateDoc` (progressService.js:307) sits mid-pipeline. A naive `Promise.all` assembly **silently changes the pool** on
  expired-mastered days. **Biggest extraction risk = "input-assembly infidelity"**: the pure fn kills *predicate* twins but not
  *input* twins (per-site input divergence persists — e.g. MCQTest fabricates `weeklyPace=pace*7` vs DailySessionFlow `pace*dpw`).
  Spec the assembly as an ORDERED pipeline; equivalence-test with an expired-mastered fixture.
- **G5 (Fable-extraction):** **flags must be an explicit PARAMETER**, not module-imported — else the shared client/server module
  compiles *different behavior* into the "identical" function (client featureFlags.js vs foundation.js:65/133/146), resurrecting
  the twin problem inside the unification. Same for the grandfather epoch.
- **G6 (Opus-sequencing):** the **review-pass gate (ships ON@92 inside DF2-14 — not banked, post-R2) edits the SAME lines** (studyService.js:266-270/312-321) and is AHEAD in
  the queue → **sequence this refactor AFTER the gate ships, or co-design the predicate**; add `reviewPassThreshold`/`passedRequired`
  to the view-model enumeration.
- **G7 (Fable-extraction):** signature fixes — drop `resolvedAnchor` (wrong layer: it feeds reconciliation, already baked into
  `record.csd/twi`); pass the FULL reconciliation window not pre-filtered `dayAttempts` (the `dayNumber` filter is computed inside
  the derivation → pre-filtering forces callers to duplicate the rule = the drift the plan wants dead); normalize serialized
  timestamps to epoch-ms at the seam (`tsMillis`→0 on wire timestamps, reviewPairing.js:52-56); add anchor-range fields
  `newWordStartIndex/EndIndex/Count` to the view-model (load-bearing for pairing + twi).

### Completeness (Opus-completeness): the enumeration must be ~2× longer BEFORE coding
WSL's §7#4 had 9 states; the critic's exhaustive pass found ~19 field-groups across 4 tiers (Tier-0 exit channel; Tier-1
anchor-range/anchor-validity/reviewOnly-trichotomy/launch-vs-merged-view/throttle-deadband/evidence-gate; Tier-2
isFirstDay/lap-reset/5 cycling fields/empty-3-surfaces/impossible-phase/review-pass-gate; Tier-3 9 score carriers +
null-vs-0-vs-real 3-way / 3-layer crash-recovery+nonce / two-enum bridge / re-entry modal / Dashboard pace-focus matrix /
blind-spot / negative-allocation clamps). **This full enumeration is the pre-coding gate.**

### CORRECTED first increment (post-convergence)
Extract **only `initializeDailySession`'s pure core** (`deriveThrottleMode → calculateDailyAllocation → segment →
determineStartingPhase`, reads hoisted) into `deriveSessionState`, called by **`initializeDailySession` alone** (→ its 5 entry
points: DailySessionFlow.jsx:574, MCQTest.jsx:321/341, TypedTest.jsx:374/395). **Leave `determineStartingPhase` in place** (it's
already the shared exported phase fn — nothing to extract; wrap its log side-effect as an `anomalies` return). **Exclude Dashboard**
(C1). Constraints: re-call leaf utils never edit (C2); flags+epoch as explicit params (G5); ORDERED assembly, write-before-read
(G4); return the CURRENT config object field-for-field, NOT the §3.2 VM shape yet (G7); normalize timestamps (G7); model the
exit channel as a second derivation with `lastWriteOutcome` (G0); CI differential test across the flag matrix
(LIST_SCOPED_RECON/FORCED_PATHWAY/REVIEW_PAIRING_V2/CYCLING_ENABLED) + both SERVER_PROGRESS_WRITE record shapes. **Sequence AFTER
the review-pass gate (ships ON@92 inside DF2-14 — not banked, post-R2)** (G6). No server change, no canonical flip, no functions deploy — the pinned 0ddbb34 stays untouched
(confirmed by all three).

### Net
Direction **confirmed sound by 3 independent critics**; the convergence caught **3 factual errors** (determineStartingPhase
purity, Dashboard byte-identical, heldReason semantics) + **1 structural miss** (entry-vs-exit split) + a **doubled completeness
list** — all folded above. The plan is materially stronger and the first increment is now correctly scoped. **This remains
DESIGN — nothing built.** Prerequisite before any code: the full state enumeration (the pre-coding gate) + shipping the review-pass gate (ships ON@92 inside DF2-14 — not banked, post-R2) first.

## 9. CODEX — full-roster convergence (re-raised r40, 2026-07-20; codex_unifiedstate_r40.md)

Codex came online and reviewed the plan INCLUDING §8. **Verdict: SOUND-WITH-GAPS** — makes it a **unanimous 5-way** (1 Fable +
2 Opus + Codex + WSL). Codex **independently CONFIRMED every load-bearing §8 finding** with its own code tracing, added 5 gaps,
and made 1 precision correction.

**Confirmations (Codex traced each itself):**
- **G0 CONFIRMED** (the structural one) — `completeSession` statuses can't be reconstructed from the entry record
  (foundation.js:1360-1364 guard, :1410-1412 no_evidence, :1458-1491 review_recorded, mapped client-side studyService.js:1014-1085,
  blocked at DailySessionFlow.jsx:1552-1555). ⇒ needs `deriveWriteOutcomeView(lastWriteOutcome, entryState)`. **Precision fix:**
  "never persisted to the record" is too strong — `review_recorded` DOES write recentSessions/reviewMode/stats/streak; but the
  *outcome STATUS* is not a stable entry-state field, so the two-derivation conclusion holds. (Amends G0 wording, not substance.)
- **C1 CONFIRMED** (Dashboard exclusion) · **G3 CONFIRMED** (determineStartingPhase impure) · **G4 CONFIRMED** (ordered writes;
  + notes DailySessionFlow.jsx:570-574 calls `returnMasteredWords` then initializeDailySession calls it AGAIN — test before any
  "cleanup") · **G5 CONFIRMED** (flags+epoch as explicit params) · **G6 AGREE** (sequence after review-pass gate).
- **G1 CONFIRMED + SHARPENED** — proposes concrete fields instead of a flat `heldReason`: `reviewOnlyReason`
  (allocationZero|listComplete|reviewStudyResume|none) + `completionPolicy` (advance|hold|requireRetake|refuse) + `holdReason`
  (throttleReviewOnly|nonEngagedReview|reviewBelowThreshold). Re-confirms **no existing stuck/held banner** = net-new UX.

**Codex ADDITIONS (what all 3 critics + WSL missed):**
- **A1** — exit-channel already lossy: `recordSessionCompletionViaServer` maps `review_recorded` to success-shaped
  `{progress: data.progress||null}` but the server return (foundation.js:1584-1590) has no progress object; the future exit-view
  must carry explicit `advanced:false`/`progressDay`/`reviewMode`/reason, not rely on null-progress.
- **A2** — increment-1 must preserve the config object **field-for-field** (lists them: newWordCount, nwStart/End, segment.wordIds,
  reviewCount, reviewSegmentSize, reviewBacklogTotal, testSizeReview, retakeThreshold, cyclingActive, cycleLength, lapView,
  recovered scores, isListComplete) — do NOT introduce the §3 idealized VM shape yet.
- **A3** — timestamp normalization (Firestore `Timestamp` vs serialized) must be IN the seam (affects pairing + grandfather).
- **A4** — PDF/debug callers (`getTodaysBatchForPDF`, `getDebugSessionData`) are real `initializeDailySession` callers →
  equivalence tests must include them.
- **A5** — local recovery (`sessionRecovery.js` + `sessionStorage.dailySessionState`) is a SEPARATE state machine that needs a
  named place in the model.
- **Refinement of §7.5/"delete session_state.phase":** **DEMOTE, don't delete.** Removing `phase` as an *authoritative routing
  input* is safe, but `session_states` + browser `sessionStorage.dailySessionState` still carry real crash/multi-tab/display data
  (dismissed words, queue/segment snapshot, test-return payloads, review attempts, continuation context) — keep those channels.

**Verification gate Codex adds (before any code beyond design):** golden fixtures for `initializeDailySession` output across the
flag matrix (LIST_SCOPED_RECON/FORCED_PATHWAY/REVIEW_PAIRING_V2/CYCLING_ENABLED) + scenario fixtures (dual-class same-list, #9
resume, list-end, cycling lap boundary/straddle, expired-mastered return, impossible day-1-passed, allocationZero review-only,
non-engaged skip, review-pass threshold); the differential test compares **full config objects, not just `phase`**.

**Codex final:** proceed only after the review-pass gate settles + the full state enumeration is written; the immediate
buildable slice = client-only `initializeDailySession` core extraction with differential tests; exclude Dashboard / server /
canonical / UI-container-deletion from increment 1. — Identical to §8's corrected first increment.

### CONVERGENCE CLOSED — 5/5 unanimous SOUND-WITH-GAPS
1 Fable + 2 Opus + Codex + WSL. Zero dissent on direction; Codex confirmed all §8 findings + added A1-A5 + the demote-not-delete
refinement + the verification gate. The design is now fully reviewed. **Still DESIGN — nothing built.** Ordered prerequisites
before code: (1) ship the review-pass gate (ships ON@92 inside DF2-14 — not banked, post-R2); (2) write the full state enumeration (§8 completeness list + A1-A5); (3) then
the client-only `initializeDailySession` core extraction with the golden/differential fixture harness above.

## 10. MODE-AWARENESS — free-navigation coexistence (David 2026-07-24)

> **⛔ SUPERSEDED (2026-07-26, R2-24/26/27): COEXISTENCE is DEAD — ONE universal day-structured model for every
> class; `navigationMode` never ships; the seam below is historical design record. Free-within-the-day + backward
> re-study/re-test deliver via DF2-14 (`deepfix2/02_TASK_LIST.md` v5); the ledger `deepfix2/11_` §1 governs.**

**Why this section exists:** everything above (§1-§9) is the FORCED-progression model — the ~11 scattered derivations are all
forced-mode logic (throttle, day-gate, hold/refuse). But David closed the free-navigation gate on 2026-07-17 as
**COEXISTENCE**: free-nav is a future **per-class mode** `navigationMode: 'forced' | 'free'`, not a replacement
(`docs/design/FREE_NAVIGATION_MODEL.md`, Codex round-7 SOUND-WITH-CAVEATS, converged). **The unified container is the vehicle for
it.** If we extract `deriveSessionState` and build `<SessionStage>` baking in forced-mode assumptions, adding free-nav later is
another rewrite. If the seam is **mode-aware from day one**, free-nav is an additive branch — exactly the payoff the unification
promises ("new features = add a state, not touch 11 places," §4).

### The two modes, side by side
| | FORCED mode (default, built) | FREE mode (per-class opt-in, LATER) |
|---|---|---|
| Progression | day-gated: study→test→review→complete, must pass to advance | **frontier** (`twi`): everything in `[0, frontier)` is free (study/re-study/review any word, any order); only gate = unreached `[frontier, N)` |
| `currentStudyDay` | authoritative, defended (reconciled csd) | **derived label** (`ceil(twi/segment)`), display-only |
| Throttle / review-only hold | binary throttle → 0 new words → hold-csd (the whole §8 G1 hold model) | **none** — student chooses review vs new; system never forces 0 |
| New words | forced allocation per day | **offered, never forced** ("Ready for the next 40 words?") |
| Exit states (§ G0) | advance / **held** / **retake** / **refused** / rebuild / idempotent | advance-frontier / **recorded** — **no held/refused** (nothing to gate); retake only if the mode's pass-to-advance = yes |
| Review | gated review-only "days" | **always-on** mode, driven by a NEW per-word scheduler (see prereq) |

### How it lands on the architecture (the seam)
1. **`navigationMode` is a derivation input**, sourced per-class from the assignment/class config (same channel as the §G5
   flags): `deriveSessionState(record, attempts, assignment, flags, navigationMode, scheduler, now) → view-model`.
2. **ONE derivation, two branches.** `mode==='forced'` → the §1-§9 logic verbatim. `mode==='free'` → frontier logic: no throttle,
   no day-gate, no hold/refuse; states become `navigate-hub / study(any-segment) / review(due) / test(new-segment→advance-frontier)`.
3. **The view-model carries `navigationMode`** + free-mode fields: `frontier` (=twi), `dueForReview` (count/ids from the new
   scheduler), `nextSegmentOffer` ({startIndex, size}), `masteryPct`, `canAdvanceFrontier`. Forced-only fields
   (`reviewOnlyReason`, `heldReason`, `completionPolicy`, the day-gate) are **null in free mode**; free-only fields are null in
   forced mode. The container renders whichever set is populated.
4. **The exit channel (G0) SIMPLIFIES in free mode.** No `no_evidence`/`review_recorded`-hold/`requiresRetake` — a submit just
   records mastery + (if a new segment) advances the frontier. So `lastWriteOutcome` in free mode is a small closed set
   (`recorded` / `frontier_advanced` / `already`), not the 8-status forced set. The two-derivation split (entry + exit) still
   holds; the exit derivation is just thinner.
5. **`<SessionStage mode>`** is the same shell (loading, error, the one container). The mode picks the sub-view family:
   forced → `<Study>`/`<Test>`/`<Outcome>`/`<Complete>` (§3); free → `<NavigateHub>`/`<Study>`/`<Review>`/`<SegmentTest>`.
   `<Study>` and `<Test>` are **reused across modes** (they already only vary by `mode`/word-pool) — so free-nav adds ~2 new
   sub-views (`NavigateHub`, always-on `Review`), not a parallel app.

### What DOESN'T change (build order is unaffected)
- **Forced mode is still the whole near-term build.** Free mode is designed-into-the-seam but **not wired** in increment 1 — the
  first slice (client-only `initializeDailySession` core extraction, §8) implements ONLY the forced branch; the `navigationMode`
  param is threaded as a constant `'forced'`. This adds a parameter, not behavior — preserves the byte-identical claim.
- **Free mode's own prerequisites are unchanged** (from FREE_NAVIGATION_MODEL.md rigor + Codex caveats, which are its design
  spec): a **server-owned/adjudicated frontier** (P5 census — `twi` is per-class non-monotonic today; live scan found 129
  divergent, 27 actively in the lower-twi class → `max(twi)` corrupts them), a **new review scheduler** (today the scheduler
  literally *is* `currentStudyDay` — `computeUnmasteredSegmentIds`, so a display-only csd freezes review), a **new rules
  artifact** (P10d denies client progress writes → bare deploy = cohort freeze), and the **pass-to-advance-the-frontier product
  decision** (yes = teacher pass-contract survives; no = self-paced wordlist, undermines the hagwon product — must be answered
  first). Free-nav MODE = E4 in `CONSOLIDATED_ROADMAP_2026-07-17.md`, post-cutover.

### Net
Designing the **`navigationMode` seam into `deriveSessionState` + `<SessionStage>` now** is the cheap, correct move: it costs one
threaded parameter (constant `'forced'`) in the first increment and makes free-nav an **additive branch + ~2 sub-views** later,
instead of a second UI. This is precisely the "add a state, not touch 11 places" dividend the unification is for — extended from
"add a state" to "add a *mode*." The forced/free split is the same shape as the entry/exit split (§G0) and the mode-parity flags
(§G5): one derivation, explicit inputs, branches — never hidden duplication. **Still DESIGN.** The free branch is spec'd here but
gated behind free-nav's own prerequisites (E4); the seam is what increment 1 must not foreclose.

**CO-IMPLEMENTATION DIRECTIVE (David 2026-07-24):** free-nav is to be IMPLEMENTED TOGETHER with this work — the free branch
(derivation + `<NavigateHub>`/`<Review>` + teacher lever UI) is built as the increment(s) after inc.1, behind
`navigationMode:'free'` that no live class has set. **Code together ≠ ship together:** live enablement stays gated on the
prereq quartet (frontier census + server-owned frontier [P5, GO-HOLD], new rules artifact, pass-to-advance — **✅ CLOSED YES,
David 2026-07-25**; the free branch is product-unblocked). Consistency contract with FREE_NAVIGATION_MODEL.md: its "CONSISTENCY WITH THE SESSION MAP"
section (5 binding requirements — one G-PASS predicate incl. the passed-flag tripwire, one position authority, the teacher
lever surface, per-mode review-gate semantics, G-MASTERY as the G-DUE seed). Its superseded top layer is bannered — read
"DELETE/RETIRE" there as free-MODE-only.

## 11. FULL UI SURFACE MAP + MECHANICS INVENTORY (David 2026-07-24 — "100% comprehensive")

**Why:** David's completeness check found the plan was session-container-scoped, not full-UI-scoped. This section closes that:
every route, every surface, every logic gate, every teacher lever — extracted from code (4 read-only sweeps, 2026-07-24), not
recalled. **The wireframe of record** (visual counterpart, gates + navigation routes per screen):
`docs/design/unified-session-state-wireframe.html` (published artifact). **The canonical detailed map (markdown twin, AUDITED):**
`docs/design/UNIFIED_SESSION_STATE_MAP.md` — verified by 3 independent Fable auditors (accuracy 57✓/1✗/3≈; completeness
GAPS-FOUND→folded; redundancy/dead-code SAFE-TO-ACT-ON→2 adjustments folded; see its §16 audit log). Where this section and the
map disagree, the map wins.

### 11.1 DECISION — BlindSpot: HIDE from UI now (David 2026-07-24; survival undecided)
Not deleted — hidden, pending a keep-or-kill decision later. **Hide spec (surgically small — most of the feature is already dead):**
- Add `BLINDSPOTS_UI = false` to `src/config/featureFlags.js` (matches the existing flag pattern).
- Gate the ONLY live entry point: the per-list "Blind Spots" `<Link>` on the student Dashboard (Dashboard.jsx:2172-2180).
- Gate the route `/blindspots/:classId/:listId` (App.jsx:91-98) → redirect `/` (else reachable by direct URL).
- Gate the HelpModal copy line (HelpModal.jsx:250-253).
- Second-order (on flip, not before): `public/help-student-{en,ko}.html` mention Blind Spots in ~7 places incl. a FAQ answer
  (en:673/758/914-924/1047; ko:664/905-911) → edit + Netlify redeploy alongside the flag flip.
- **Already dead, no action needed to hide** (list for later delete-or-revive): `BlindSpotsCard.jsx` (orphaned — never imported;
  its docstring claims "end of daily session flow" but DailySessionFlow never renders it), `MasterySquares` (imported
  Dashboard.jsx:29, never rendered), `MasteryBars.jsx` (orphaned).
- **Keep intact:** `BlindSpotCheck.jsx` + `getBlindSpotPool` + the 21-day stale mechanic in `study_states` — that mechanic is the
  seed of ~~free-nav's per-word due-scheduler~~ (G-DUE CANCELLED, R2-27 Q4) — the 21-day model is KEPT for the graduation rest cycle, so hiding the UI must NOT delete the data model.

### 11.2 ROUTE TABLE (App.jsx — flat, no nested layouts; guards: PrivateRoute → login-redirect, TeacherRoute → /)
| Path | Component | Guard |
|---|---|---|
| `/` | Dashboard | Private |
| `/login` `/signup` | Login / Signup | public |
| `/session/:classId/:listId` | DailySessionFlow (the session orchestrator) | Private |
| `/mcqtest/:classId/:listId` · `/typedtest/:classId/:listId` | MCQTest / TypedTest (tests + results + challenge) | Private |
| `/blindspots/:classId/:listId` | BlindSpotCheck — **→ PARKED (11.1)** | Private |
| `/gradebook` | Gradebook role=student, challengeMode=submit | Private |
| `/teacher/gradebook` | Gradebook role=teacher, challengeMode=review | Private+Teacher |
| `/classes/:classId` | ClassDetail (lever surface) | Private+Teacher |
| `/lists` `/lists/new` `/lists/:listId` | ListLibrary / ListEditor | Private+Teacher |
| `/settings` `/profile` | Settings (reset-progress) / Profile | Private |
| `*` | → `/` | — |

### 11.3 SURFACE DISPOSITION TABLE (every surface → what happens to it under this plan)
| Surface | Today | Disposition |
|---|---|---|
| Dashboard hero CTA (8 sub-states, Dashboard.jsx:1753-1900) + per-list Start (:2161) + Re-entry modal (:2376) | duplicates the entry derivation via `panelCState` (class-scoped — the §8 C1 divergence) | → renders the ONE entry derivation's output; one start affordance (§3.5). Excluded from increment 1 (C1). |
| DailySessionFlow + StudyPhase/CompletePhase + both test routes + results cards + TestResults | ~13 screens, 2 live phase enums | → `<SessionStage>` states (§3-§4) |
| **Session chrome — LIVE:** SessionHeader + `sessionStepTracker.getSessionStep` + SessionProgressSheet | hardcodes the 5-step forced sequence + literal "95% required to pass" copy (SessionProgressSheet.jsx:72-107) | → chrome fed by the unified enum (PHASE-derived — universal model, DF2-30 [R2-24/27]; ~~forced-steps/free-hub split~~); copy must read `passThreshold`, not 95 |
| **Session chrome — DEAD:** `SessionSteps.jsx`, `SessionProgressBanner.jsx` (0 imports; a 3rd+4th phase vocabulary) | dead code | → DELETE at unification cleanup (with RetakePrompt §1, unrendered REVIEW_TEST phase) |
| BlindSpot surfaces (route, Dashboard link, HelpModal copy; orphaned card) | 3rd separate study→test flow | → **PARKED / hidden** (11.1) |
| Gradebook (student submit / teacher review) | separate challenge surfaces | out of session-container scope; challenge-token gate documented in 11.4; unchanged |
| Settings → reset-progress | 2-modal confirm + `resetProgress` CF | unchanged UI; the derivation must respect the `resetEpoch` tombstone (add to the §8/§9 state enumeration) |
| Teacher ClassDetail + AssignListModal | the per-class lever surface (11.5) | **home of the surviving lever set [post-R2]**: ~~navigationMode~~ DEAD (R2-27) · `reviewPassThreshold` (ships ON@92, teacher-tunable) + `reviewQueueSize`/`reviewTestSize` — land in AssignListModal + ClassDetail + `updateAssignmentSettings` validation via DF2-11 inside DF2-14's train |
| Login/Signup/Profile/ListLibrary/ListEditor | — | untouched |

### 11.4 GATE GLOSSARY — every logic gate, exact expression (the mechanics; wireframe renders these per screen)
| Gate | Expression (owner) |
|---|---|
| G-AUTH / G-ROLE | `!user → /login` (PrivateRoute.jsx:17) · `role!=='teacher' → /` (TeacherRoute.jsx:16) |
| G-READY | every `${classId}_${listId}` progress entry `status==='ok'` (Dashboard.jsx:350-364); per-list Start disabled until ready |
| G-FOCUS | getPrimaryFocus order: exact pin → legacy list-pin → progress-recency (`lastSessionAt→csd→assignedAt`) → most-recent-assigned (Dashboard.jsx:1078-1248) |
| G-PHASE | `determineStartingPhase(attempts, csd+1)` (studyService.js:228): dayAttempts=`studyDay===dayNumber`; best new = passed-first, score-desc; paired review under REVIEW_PAIRING_V2 (`reviewPairsWithAnchor` + engaged under FORCED_PATHWAY). Branches: `day>1 ∧ new.passed ∧ ¬review → review-study` · `day===1 ∧ new.passed → complete` (+`impossible_phase_detected` log) · `day>1 ∧ new.passed ∧ review → complete` · else `new-words-study` |
| **G-DONE ("done today")** | `phase==='complete'` — **attempts-only. There is NO calendar/KST day-gate anywhere**: after a normal advance csd increments, so the hero immediately offers Day N+1. "Done today" appears only when csd is HELD (G-HOLD) while day-(csd+1) attempts exist. The "daily" boundary is the hold mechanism, not a clock. (KST exists only in streaks + token weeks.) |
| G-REENTRY | `phase===COMPLETE ∧ reviewTestScore!==null` (+REENTRY_GUARD: `sessionState.currentStudyDay===lastCompletedDay`) (sessionService.js:352-364) |
| G-ALLOC | `newWords = Math.round(pace × (1 − interventionLevel))` (studyAlgorithm.js:107); binary throttle: `reviewMode → 0 new` |
| G-THROTTLE | enter `avg(last3 reviewScores) < 0.30` / exit `> 0.50` (deriveThrottleModeServer, foundation.js:687-688) |
| G-SCHED | review pool = unmastered slice: `divisor = week1 ? dpw−1 : dpw`; `segmentSize=ceil(pool/divisor)`; slice indexed by **csd** (studyAlgorithm.js:188-215) + `REVIEW_STUDY_CAP=60`. **The scheduler IS currentStudyDay** — ~~free mode must replace it (§10 prereq)~~ post-R2: DF2-14's day-offset rotation replaces the review-selection leg; the day clock itself stays |
| G-TESTSIZE | new: `testSizeNew` (50) · review: `30 + (60−30) × interventionLevel` (studyAlgorithm.js:258-268) — **teacher min/max are DEAD (11.6)** |
| G-TESTROUTE | `testMode==='typed' → /typedtest else /mcqtest`; `'both'`→ new=mcq; review mode: `reviewTestType ∥ (testMode typed/both ∧ attempts<3 ? typed : mcq)` (DailySessionFlow.jsx:701/1003/1198, sessionService.js:374-386) |
| **G-PASS** | new: `score ≥ passThreshold/100` (default .95) · **review: `passed = true` ALWAYS** (MCQTest.jsx:581, TypedTest.jsx:853, server index.js:434). The `reviewPassThreshold` gate changes exactly these three lines **[post-R2: not banked — ships ON@92 at DF2-14; these are the change sites]**. |
| G-RETAKE | `type==='new' ∧ score < threshold` → in-place resample (`selectTestWords`), no navigation, failed attempt IS recorded (`passed:false`) |
| G-FINAL | `isSessionFinalTest = isFirstDay ? type==='new' : type==='review'` → triggers completeSession |
| G-DAYGUARD | server txn `expectedDay = csd+1` (foundation.js:1355-1365) → mismatch = `day_guard_rejected` + session cleared |
| G-HOLD | **throttle-only** [F1 audit fix]: `fpHoldCsd = fpThrottleReviewOnly ∨ (day≥2 ∧ ¬engaged)`, `fpThrottleReviewOnly = allocationZero ∧ ¬listComplete ∧ ¬reviewStudyResume` — list-end and #9-resume review-only days ADVANCE (foundation.js:1453-1492; client mirror studyService.js:1797-1800). Held write = NO csd/twi → status `review_recorded` |
| G-EXIT | statuses → client: `completed`→advance · `already_completed`→idempotent success · `review_recorded`→HOLD · `no_evidence`→BLOCK · `day_guard_rejected`→rebuild · unknown→fail-closed (studyService.js:1014-1085) |
| G-QUAR | canonical `resolveListProgress` refuses corrupt csd/twi signatures — **dormant**: LOG-ONLY (`list_progress_quarantine_candidate`) until the P5 canonical flip, then mode `quarantined` BLOCKS entry (foundation.js:1724-1926). Needs a real screen before P5. |
| G-TOKEN | `max(0, 5 − rejectedChallenges since Mon 04:00 KST week start)` (db.js:211-217 ≡ index.js:657) |
| G-CHALLENGE | student submit → `challengeStatus:'pending'` ONLY (no grade change; token at-risk) · teacher accept → `isCorrect=true`, rescore, `newPassed = review?true:newScore≥passThreshold`, may advance day iff `old<thr ∧ new≥thr` (db.js:2853-3021) |
| G-RESET | Settings: class+list → 2 modals → type `RESET` → `resetProgress` CF: deletes attempts+session_states+study_states+class_progress **list-wide across ALL classes** + `resetEpoch` tombstone → Day 1 (foundation.js:2055-2146) |
| G-CONT / G-CYCLE | `CONTINUATION_LINKS ∧ listFinished ∧ nextListId` → "Advance to next list" · `CYCLING_ENABLED ∧ cyclingSourceClassId` → "Start over" |
| ~~FREE-mode gates (FUTURE, E4)~~ **DEAD (R2-24/27; G-DUE cancelled R2-27 Q4 — the DF2-14 rotation is the selector)** | G-FRONTIER: all of `[0, twi)` free; only `[twi, N)` gated behind taking the next segment test · G-OFFER: next segment suggested, never forced · G-DUE: NEW per-word scheduler (replaces G-SCHED; the 21-day stale mechanic is its seed) · G-ADVANCE-POLICY: pass-to-advance — **✅ CLOSED YES (David 2026-07-25)** |

### 11.5 LEVER TABLE (teacher-side; stored `classes/{id}.assignments.{listId}.*`; writers `assignListToClass` db.js:805 / `updateAssignmentSettings` db.js:877)
| Lever | Default | Feeds | Status |
|---|---|---|---|
| pace | 20 | G-ALLOC (`weeklyPace = pace×dpw`; MCQ/Typed standalone fabricate `pace×7` — the §8 G4 input-twin) | live |
| passThreshold | 95 | G-PASS (client + server + challenge recompute) | live |
| testMode | 'mcq' | G-TESTROUTE | live |
| testOptionsCount | 4 | MCQ options (1-10) | live |
| testSizeNew | 50 | G-TESTSIZE (new) | live |
| reviewTestType | 'mcq' | G-TESTROUTE (review) | live |
| **reviewTestSizeMin/Max** | 30/60 | **NOTHING — dead levers.** Stored + echoed by buildTestConfig, never read; actual size uses hardcoded 30↔60 (11.6) | **DEAD** |
| studyDaysPerWeek | 5 | G-SCHED divisor, weeklyPace, streak weekend-skip — **absent from AssignListModal** (only ClassDetail settings) | live |
| nextListId | null | G-CONT | flag-gated |
| cyclingEnabled | false | G-CYCLE | flag-gated |
| ~~navigationMode~~ | 'forced' | ~~the mode seam~~ **DEAD (R2-24/27) — never added** | — |
| **reviewPassThreshold** ~~(banked gate)~~ | off today | G-PASS review branch | **ships ON@92 teacher-tunable at DF2-14; + `reviewQueueSize`/`reviewTestSize` (DF2-11)** |

### 11.6 NEW FINDINGS from this sweep (facts/defects the plan now carries)
1. **No calendar day-gate exists** (design fact, not a bug): a student who advances can immediately start the next day — multiple
   "days" per sitting. The only "come back tomorrow" is the hold-csd mechanism. Any future real day-gate is NEW behavior.
2. **Dead levers:** `reviewTestSizeMin/Max` teacher inputs never feed sizing (hardcoded 30↔60 interp; the AssignListModal:215 copy
   describes an interpolation the values don't join). Also `assignment.testSizeReview` (read by standalone test paths) is never
   written → always 30. Fix-or-remove at unification.
3. **Dead chrome:** SessionSteps.jsx + SessionProgressBanner.jsx (0 imports) carry a 3rd/4th phase vocabulary. Delete.
4. **Three LIVE phase vocabularies** (persisted kebab `SESSION_PHASE`, local snake `PHASES`, `getSessionStep` snake) bridged by
   `currentPhaseMap` — the §3 single-enum work, now with exact inventory.
5. **DSF's own `completeSession` doesn't handle `day_guard_rejected`** (DailySessionFlow.jsx:1549-1551 gap; the studyService path
   does). Pre-existing; folds into the exit-channel work (G0).
6. **SessionProgressSheet hardcodes "95% required to pass"** — ignores class `passThreshold`. Copy must derive.
7. **Failure/recovery states enumerated** (David 2026-07-24 Q2): init-fatal (DSF:1776), test-load-error/empty (exit routes
   INCONSISTENT: MCQ→returnPath, Typed→navigate(−1)), grading-transient-retry (3×10s + `getGradingStatus` recovery poll by
   attemptDocId — a lost response ≠ ungraded, cached grade reused, TypedTest:621-764), grading-deterministic→reload
   (answers preserved, :1203), completion-blocked-answers-saved (:1155-1158 — the 조은서 pattern surfaced bilingually), and
   G-QUAR (dormant). All now carded in the wireframe (§04b). The exit-view model must carry these as named states.
8. **`practiceMode` is a dormant prop** — both test pages read it from `location.state` (skip attempt recording + banner),
   but NO live caller passes it. It's Practice Mode v2's hook, not a live surface. Parked list.

### 11.7 GATE REDUNDANCY AUDIT (David 2026-07-24 — "are there redundancies in gates?")
**In the map (taxonomy):** three deliberate overlaps, annotated in the glossary — G-DONE = G-PHASE branch 3 evaluated at the
Dashboard (kept as a named view; it's where the no-calendar-gate misconception lives); G-RETAKE = ¬G-PASS(new) + the resample
behavior; G-DAYGUARD/G-HOLD are *producers* of two G-EXIT statuses (channel vs producers, different sites). One row per
mechanic otherwise — the glossary is the deduplicated view.

**In the code (the real redundancy — what the refactor exists to collapse). Post-audit (F3 re-derived every claim):**
- **G-PASS computed at 12 live sites, 2 unit conventions** (0-1 vs 0-100, bridged by `toFraction`; the original ≥6 was
  conservative): the 6 originals (MCQ:581, Typed:853, both results renders, DSF:1446, studyService:1911, index.js:433-434,
  db.js:2940) + DSF:324 / studyService:1857/:1934 (`passed` stamps) + db.js:3021 (challenge crossing check) + a DEAD copy
  (sessionService.js:268, zero callers). Threshold RESOLUTION is a 4-deep fallback chain duplicated per test page.
- **"Done" has TWO authorities that disagree on EVERY normal completion** (F3 sharpening): the moment a day advances, the
  hero (attempts) says "Start new words" while the per-list button (session_state) pops the "already completed" modal — and
  the hero's bare `navigate()` never consults G-REENTRY at all. Inverse disagreement after `clearSessionState` on a held day.
  REENTRY_GUARD's own comment (sessionService.js:338-346) documents the unreliability. Fold to one authority.
- **G-PHASE at 2 live client sites** with different inputs (Dashboard class-scoped vs session cross-class — the §8 C1
  divergence). **Server mirrors of the phase evidence** [F3 repoint]: `getDayNewPass` (foundation.js:819) + the
  engaged-paired-review reader (:798) — NOT `validateAttemptAnchorShadow` (it shadows the G-ALLOC/G-DAYGUARD legs; live via
  `ANCHOR_VALIDATION_SHADOW=true` despite its stale docstring). Consolidate the right code.
- **TWO throttle vocabularies coexist** — confirmed NOT overstated: fresh derivations pin interventionLevel {0,1}
  (client studyService:367-369, server foundation:1375-1377), but genuinely fractional floats still flow live through the
  challenge-accept advance (db.js:3056-3061, foundation:2209-2211) and canonical hydration copies legacy floats verbatim
  (foundation:1972). Decide the float's fate at unification.
- **Success metric for the refactor:** every glossary row computed at exactly ONE site. The §11.4 table is the target state;
  this list is the delta.
- **Refactor tripwire (F1's one WRONG, HIGH):** the day-2+ completion gate is
  `!reviewOnlyDay ∧ newWordAttemptPassed !== true ∧ newWordScore < threshold` — the attempt's `passed:true` flag is
  AUTHORITATIVE and short-circuits the score check (teacher overrides / CS manual-passes / challenge regrades,
  studyService.js:1881-1885/:1911). Any consolidation that re-derives pass from score alone re-blocks CS-fixed students.
- **Dead-list corrections (F2+F3 convergent):** RetakePrompt is dead-by-UNREACHABLE-GUARD (rendered DSF:1955 inside a
  `NEW_WORD_TEST` branch no setPhase ever reaches) — delete the :1952-1969 branch + :2367 definition, not an orphan-file
  sweep. StudySelectionModal added to the dead list (open-setters never true + broken `/study` `/test` targets). The
  `'NEW_TEST'/'REVIEW_TEST'` localStorage marker vocab is LIVE crash-recovery — keep when deleting the REVIEW_TEST phase.

### Net (§11)
The plan now spans the full UI surface: the session container (§1-§9), the mode seam (§10), and — new — the Dashboard CTA machine,
the live/dead chrome, the results+challenge surfaces, Settings-reset, the teacher lever surface (home of `reviewPassThreshold` — ships ON@92 at DF2-14; ~~navigationMode~~ DEAD R2-27) (was: future home of `navigationMode` +
`reviewPassThreshold`), and BlindSpot **parked** (11.1). Increment sequencing is UNCHANGED (§8/§9: review-pass gate → state
enumeration → client-only extraction); 11.6's dead-code deletions and dead-lever fix join the unification cleanup list. Still DESIGN.

> **⛔ MODE-SEAM SUPERSESSION (2026-07-26, R2-24/26/27):** §10's `navigationMode` seam and §12.2's free-mode UX
> delta are OBSOLETE — ONE universal model shipped (ledger `deepfix2/11_` §1). §12.2's surviving items: the past-day
> browser + within-day phase toggle (→ DF2-51 rescoped). The container/§12.3-messaging work continues unchanged.

## 12. SHIP-TOGETHER MODEL · FREE-NAV UX DELTA · STATUS-MESSAGING REGISTER (David 2026-07-25)

### 12.1 Release model — one train, staged ACTIVATION
> **⚠ SUPERSEDED IN PART (2026-07-26, deepfix2 v3).** The governing release model now lives in
> `docs/plans/deepfix2/02_TASK_LIST.md` §0/§4.1: **one release LINE**; ~~pre-Wave-6 production exposure is the OPEN **DECIDE-0** decision~~ **DECIDE-0 is CLOSED: (b) SINGLE-TRAIN
> (R2-25); the review redesign ships separately = DF2-14's ONE audited flip**; byte-identity is absolute EXCEPT each
> train's NAMED delta list. The text below is the 2026-07-25 origin layer — read it as history, not instruction.

David's directive: the unified container and free-nav **ship together** (built as one system). Model: a **single release train**
containing the container + both mode branches; what's staged is *activation*, not shipping:
1. Container replaces the forced-mode UI — **byte-identical by the differential-fixture gate**. One precision note: the container
   is *engineered* to work alone (that identity proof is the 26SM safety net); free-nav is the piece that cannot ship alone.
   Ship-together is the release model; byte-identity stays the falsifier that protects the live cohort on day one.
2. Free branch rides in the same release, **dark** — no class has `navigationMode:'free'`.
3. Per-class enablement — only after the prereq quartet closes (frontier census + server-owned frontier [P5], new rules
   artifact, pass-to-advance decided, G-DUE scheduler live).

### 12.2 Free-nav Dashboard/UX delta (Q2 — "considered?": at ARCHITECTURE level yes (§10.5 names `<NavigateHub>`); at UI level NO — this is the full surface to design)
1. **Day/segment picker** (David's example): grid/list of all segments ≤ frontier with per-segment state (mastery %, due count,
   last score) → tap to study / re-test any of them.
2. **Next-segment offer** as the primary CTA ("Ready for the next 20 words?") + soft backlog nudge ("180 due — review first?").
3. **Always-on review entry** — due-count badge + Start Review (G-DUE).
4. **Frontier/progress visualization** — a segment map (mastered / due / untouched / unreached) replaces the single ring.
5. **Mode indicator + "Day N" reframe** — day becomes a label (`ceil(twi/segment)`), and the UI must not let free-mode students
   read forced-mode semantics into it.
6. **Teacher-side monitoring** — `ListProgressStats` ahead/behind uses `calculateExpectedStudyDay` (day-model); free mode needs
   frontier-vs-expected pacing + mastery/due analytics. Gradebook survives (attempts keep the `studyDay` label).
7. **Session chrome** — steps/ProgressSheet don't apply; hub breadcrumb (per §11.3 mode-aware chrome).
8. **Re-entry modal — n/a in free mode** (nothing to guard); its job is absorbed by the hub.
9. **PDF** — `getTodaysBatchForPDF` is day-based (the §9-A4 caller) → needs segment-based selection in free mode.
10. **Streaks — keep as-is** (activity-based, mode-agnostic; verify weekend-skip unaffected).
11. **Practice Mode v2 overlap** — PMv2 = free review *inside forced mode*; in free mode it's native. Design once so they don't
    fork (Codex caveat 4); the dormant `practiceMode` prop is the shared rail.
12. (Stretch) per-word mastery browser within reached segments — defer unless wanted.
13. **Free-mode hero CTA decision order** (Fable pass 2026-07-25): the §11.4/§4 CTA machine is forced-mode; free mode needs its
    own selection order for the ONE primary button — proposal: segment-in-progress → "Resume" · due-heavy (due > nudge threshold)
    → "Review N due" · else → "Continue: next segment". This is a designable gate (the free-mode analog of panelCState), not
    an emergent property of the hub.
14. **Mixed-mode Dashboard (dual enrollment)** (Fable pass): a student in one forced class + one free class sees BOTH on one
    Dashboard — per-list rows and the hero must be mode-aware *per class*, not globally. Dual-class students are a live CS
    class (박연서/김나연 pattern) — this is not hypothetical.
15. **Hub empty/edge states** (Fable pass): frontier=0 (new student — no picker yet, just "start first segment"), all-mastered/
    nothing-due (celebrate + offer), frontier=N list-end (hub = pure review + continuation offer). Enumerate like everything else.
Note on item 1: "task" selection = THREE actions per reached segment — {re-study, re-test, review-due} — not just study.
Open UX decisions: hub layout/prominence of the offer vs review; nudge strength; teacher pacing metric definition.

### 12.3 Status-messaging register (Q3 — kill the black boxes that generate CS calls)

> **Post-R2 (2026-07-26): rows 1-3 RETIRED (throttle D-1 + engagement R2-11); the LIVE set = rows 4-16 (row 15
> re-homed = past-day-browser messaging; row 16 = the retake wall). `06_MESSAGING_COPY.md` supersedes the draft
> strings below [Fable-2 M5]; DF2-32 owns delivery; free-mode variants are dead (R2-24).**
**Principle:** every gate that blocks, holds, or redirects MUST render a *reason + next step* (~~bilingual ko/en~~ ⟶ ENGLISH-ONLY for new surfaces [R2-44]; the
TypedTest:1155-1158 pattern for structure only). Prior state: §8-G2 — NO held/stuck surface exists today; the wireframe's Outcome/failure cards
specced most of the layer. This register completes it against the REAL CS ticket classes (SUPPORT_RUNBOOK):

| # | Trigger (gate) | Message intent | Surface | CS class it kills |
|---|---|---|---|---|
| 1 | ~~Review-only day, throttle (G-HOLD entry-side)~~ **RETIRED 2026-07-26 [D-1: the throttle is removed entirely — deepfix2 task list §4; no copy will be authored]** | — | — | (the CS class dies with the mechanic) |
| 2 | ~~Review recorded but day HELD, rolling-average throttle (`review_recorded`)~~ **RETIRED 2026-07-26 [D-1 — same; the per-test retake wall is row 16, a different mechanic]** | — | — | — |
| ~~3~~ RETIRED (R2-11 — engagement dead) | ~~Non-engaged review (< 0.8 answered, G-ENGAGED)~~ | after-the-fact "this review didn't count toward advancing (under 80% answered)" — the before-the-fact warn EXISTS (MCQ:1592) | Outcome + next-entry banner | silent skip-holds |
| 4 | Position carried/reconciled (class change, UNDER-RECON up-reconcile) | one-time "Progress carried from [old class] — continuing at Day N" | toast/banner on first load | the Day-1-shock class (조예서/김나연/강라원) |
| 5 | Lost save restored (crash/rebuild recovery) | "Last session didn't finish saving — restored to where you were" | entry banner | 조은서-class |
| 6 | `requiresNewWordRetake` | EXISTS (fail banner + Try Again) — fix the copy to the real threshold, not hardcoded 95 (§11.6-6) | results card | — |
| 7 | `no_evidence` refused | "Day needs a passing new-word test first — nothing was lost" | Outcome(refused) | phantom-success stucks |
| 8 | `day_guard_rejected` | "Session was out of date — rebuilding" | Outcome(rebuild) | duplicate-day confusion |
| 9 | Grading retry / reload / blocked-saved | EXIST (§04b cards incl. "answers saved") | overlay/banner | grading-outage tickets |
| 10 | Typed fail + AI-grade doubt | hint: "Think an answer was graded wrong? Challenge it (uses a token)" | results card | 홍석현-class (plus the pending grader prompt fix) |
| 11 | Token count | append "resets Monday 4 AM KST" | TestResults/Gradebook token row | token-timing tickets |
| 12 | List complete | EXISTS (terminal + CONT-A advance) | Complete | "끝났는데 뭐 해요" |
| 13 | Quarantined (G-QUAR, post-P5) | "Progress held for review — your teacher's been notified" + auto CS signal | blocking screen (MUST exist before P5 flips) | corrupt-record black box |

| 14 | **Challenge OUTCOME** (Fable pass 2026-07-25) | accepted: "Challenge accepted — score updated to X%" (+ if it crossed the threshold: "Day N unlocked") · rejected: "Challenge rejected — token used; tokens reset Monday 4 AM KST" | notification/banner on next results/gradebook view | the silent-token-loss + "my day jumped, why?" classes — today the student learns the outcome only by noticing the gradebook changed |
| 15 | **Free-mode events** | "Frontier advanced — next 20 words unlocked" · (pass-to-advance=YES, decided) "Segment test below X% — retake to unlock the next segment" · backlog nudge copy | hub toast/banner | the free-mode analogs; the retake-wall message is free mode's ONLY blocking message |
| 16 | **Forced retake-wall** (`review_retake_required`, the DF2-10 gate) [added 2026-07-26, deepfix2 C8] | "Review below your class's bar (X%) — retake to finish the day" — the per-test bar (standalone since D-1 retired row 2's rolling-average hold) | Outcome/results — a BLOCKING STATE re-derived on every load, NEVER seen-markered | the gate's own black box, pre-empted |

**New messages needed: #4-#5, #10-#11, #13-#16** (#1-#3 RETIRED — throttle D-1 + engagement R2-11 [2026-07-26]; rest exist or are already specced). **Implementation home:** this whole layer
is a *render* of fields the unified derivation already carries — `reviewOnlyReason`/`holdReason` (§9-G1) + the exit channel
(`lastWriteOutcome`, §G0) + a `carriedFrom` field to add to the entry view-model. **Delivery-channel note (updated 2026-07-26):**
rows split into STATE messages (banners re-derived every load — safe, stateless; **incl. #16 and #15's retake variant, which are
BLOCKING states**) vs EVENT messages (**#4, #14, #15's frontier-advance only** — one-time toasts needing a seen/dismissed
mechanism, e.g. a lastSeen marker in session_state display-scratch; do NOT derive one-time events from the durable record or
they re-fire forever). Final copy authority: `deepfix2/06_MESSAGING_COPY.md` supersedes this table's draft strings. **Free-mode dividend (updated 2026-07-26):** rows 1-2 are now gone in BOTH modes (D-1 throttle
removal); row 3 is RETIRED outright (R2-11) and row 4's copy simplifies under the universal model — a big cut of the CS classes this
register exists to answer — which is itself part of the ship-together rationale.
