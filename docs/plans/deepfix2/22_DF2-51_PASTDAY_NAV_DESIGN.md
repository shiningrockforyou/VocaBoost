# DF2-51 — Past-day browser + within-day phase toggle — DESIGN DRAFT (orchestrator decisions PENDING)

> **STATUS: DRAFT. Nothing here is decided.** Every recommendation below is marked **PROPOSED** and is a
> proposal to the orchestrator, not a ruling. No code was written for this document. Author: bounded
> design agent, 2026-08-04. Card: `02_TASK_LIST.md:170`. Queue leg: `WORK_QUEUE.md:42`.

## 0. What was read (every cite below was re-verified in the working tree)

| Source | Used for |
|---|---|
| `docs/plans/deepfix2/02_TASK_LIST.md:170` | the DF2-51 card (scope, `type:'retest'`, AI-metered, FF2-01 in-train) |
| `docs/plans/deepfix2/02_TASK_LIST.md:144` (DF2-32) · `:145` (DF2-33) | boundary of scope — messaging register / Dashboard one-affordance |
| `docs/plans/deepfix2/12_R2_DISCUSSION_TRACE.md:110-111` (rows 72-73) | R2-41 unified stamping law, ratified + folded |
| `docs/plans/deepfix2/11_...FOLD_PLAN.md:57` (R2-26) · `:63` (R2-20) · `:36` (R2-41) · `:35` (R2-40) | Q11 within-day freedom; metering condition; the laws verbatim |
| `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md:187-196` | frozen visit/metering/bookmark doc schemas (§6) |
| `docs/plans/deepfix2/trackA/C2_UI_CALIBRATION.md:34,73-78,95-98` | the C2 UI audit — existing primitives, gaps, and its own open questions |
| `functions/reviewV2/callables.js`, `visits.js`, `presentations.js`, `completion.js` | the engine contract as-built (§2) |
| `src/pages/Dashboard.jsx:177,1627-1690` · `src/pages/DailySessionFlow.jsx:88-95,1491-1558` · `src/services/reviewV2Client.js:183-209` · `src/services/reviewV2Compose.js:97-115,246` · `src/services/studyService.js:228` · `firestore.rules:99-104,238-240` | client landscape (read-only; see §4 file ownership) |

## 1. The feature in one page

DF2-51 is **the universal model's only new nav UI**, built on the **LEGACY UI** (not the container), and it
ships **inside DF2-14's train at the review flip** — the container absorbs it later (`02_:170`, FF2-01).
Two things, and nothing else:

1. **A past-day browser.** A student picks an earlier day of the *current* list and may (i) **re-study** its
   flashcards and (ii) **re-test**. Re-tests are written as `type:'retest'`.
2. **Within-day phase freedom.** Inside today's session the student moves between the review phase and the
   new-word phase at will (R2-26 Q11, `11_:57` — "students move freely between review and new-word work
   within the day, plus backward re-study/re-test; day-advance stays gated on both tests").

**The three laws it must obey.**

- **R2-41 — unified stamping** (`12_:110-111`, `11_:36`). EVERY graded test stamps word labels: live-new,
  live-review, rerun-new, rerun-review. Wrong **and blank** = fail; correct = correct; on the presented set.
  **Graduation is review-type only, and a RERUN graduates TESTED-CORRECT ONLY — no probabilistic fill.**
  The recency clock (`reviewLastTestedAt`) **advances on reruns**. Pool underflow tops up from graduated
  (resting) words, **earliest-graduated first**. Rerun review composition is a **regenerated pure-random**
  draw over the full introduced range — no priority slots, fresh shuffle per rerun (R2-41(h)).
- **Non-advancing retest.** A retest never advances the day and never displaces the accountability score
  (R2-20, `11_:63`; gradebook-preserving, teacher toggle default OFF, R2-40(g)).
- **R2-26 Q11 — within-day freedom is RATIFIED**; both tests still gate the day advance.

**The whole feature is client-only.** The server rerun/visit legs are already committed and dark (§2).

## 2. The engine contract as built (verified, 2026-08-04)

| Contract | Cite | What it means for the client |
|---|---|---|
| Mint a visit | `functions/reviewV2/callables.js:893-913` → `visits.js:41-77` | `reviewV2MintVisit({classId,listId,day})`. A §9-fenced txn: refuses `reset_in_progress`, `reset_epoch_mismatch`, and `day_guard_rejected` when `day > csd` (`visits.js:64-66`). Restudy can therefore target **1..csd only** — never the frontier. |
| Compose a rerun | `callables.js:404-486` | `reviewV2ComposeRerun({classId,listId,visitedDay,half,visitId,composeKey})`, `half ∈ {'review','new'}` (`:412-414`), `visitId` **required** (`:408`). |
| Rerun REVIEW pool | `callables.js:434-446` + `presentations.js:243-245` + `15_:112-116` | mode `rerun-review`; the pool is the **FULL currently-introduced range sliced inside the claim txn** — *not* the visited day's words. `logicalDay` = the visited day is an identity tag only. `compositionVersion:'rerun-random'`. |
| Rerun NEW pool | `callables.js:447-467` | mode `new-day`, `kind:'rerun'`; the visited day's **historical anchor range** via `foundation.deriveDayAnchorRange` (`foundation.js:996-1007`). No anchor ⇒ `{status:'no_evidence'}` (`:452-454`); empty ⇒ `{status:'empty_pool'}` (`:458`). |
| Rerun discriminator | `callables.js:676` | `isRerunTxn = p.requestFingerprint?.kind === 'rerun'`, read from the **in-txn** presentation snapshot. |
| visitId required at submit | `callables.js:739-750` | a rerun without a well-formed, tuple-matching visit doc returns `visit_invalid` and **mints nothing**. |
| The retest stamp | `callables.js:761` | `...(isRerunTxn ? {type:'retest', visitId: p.visitId ?? null} : {})`. Rerun halves are deliberately **range-less** (`:762-768`). |
| Rerun graduation | `callables.js:797-811` | on a **passing** rerun: review-type ⇒ `graduateRerunInTxn` (tested-correct only); either half ⇒ `recordRerunHalfInTxn`. Ops event `rerun_graduation` at `:833-838`. |
| Non-advancing guards | `completion.js:323-325` and `:455-457` | `consumed.type === 'retest'` ⇒ `no_evidence`; `newTest.type === 'retest'` ⇒ `no_evidence`. A retest can never satisfy either half of the day advance. |
| Visit pairing / pips | `visits.js:92-130` | set-once per half; when BOTH are set the same txn flips `completed:true` and increments `restudy_completions/{classId}_{listId}_d{day}` exactly once. Display-only. |
| Client wrapper exists | `src/services/reviewV2Client.js:183-185` (`composeRerun`), `:207-209` (`mintVisit`) | **No edit to the wrapper is needed** — both callables are already exported and dormant. |
| Reads are permitted | `firestore.rules:239-240` | owner reads on every `users/{uid}` subcollection, including `restudy_visits` / `restudy_completions`. Writes are server-only (`:99-104`, `:251-263`). **No rules change is needed.** |
| No server ordering constraint | `callables.js:228-278` (review) and `:325-380` (new) | neither compose requires the other phase first. **Within-day freedom is already legal server-side**; only the client's `determineStartingPhase` (`src/services/studyService.js:228`) forces new→review. |

## 3. OPEN DECISIONS — for the orchestrator

### (a) Past-day browser entry point

| Option | Trade-off |
|---|---|
| **A1** per-list affordance on the Dashboard (next to `ListProgressStats`, `Dashboard.jsx:177`) | most discoverable; but `Dashboard.jsx` is DF2-33's single-owner surface and is under concurrent edit — and C2 already flags placement as unresolved (`C2:96`) |
| **A2** a new phase inside `DailySessionFlow` (`PHASES`, `DailySessionFlow.jsx:88-95`) | inherits session chrome + the existing recovery/sessionStorage machinery; but DSF is 2 913 lines, concurrently edited, and its init is frontier-shaped |
| **A3** a new route `/restudy/:classId/:listId` (new page file + one line in `App.jsx`) | **zero** shared-file collision; flag-off parity collapses to one route-level guard; costs a chrome decision and needs an entry affordance later |

**PROPOSED: A3 for the browser itself, with the entry affordance deferred to its own later fold.** Reason:
it is the only option whose file set is disjoint from the two hottest files in the repo, it makes flag-off
parity a one-line assertion, and it lets DF2-33 keep sole ownership of the Dashboard derivation. The entry
affordance (A1 or A2) then becomes a ~5-line gated addition that can be sequenced after DF2-33/DF2-07 land.

### (b) Client `visitId` lifecycle

| Option | Trade-off |
|---|---|
| **B1** mint on day-tile open | literal reading of "server-minted per restudy-day entry" (`15_:193`); mints a doc per tap; **breaks pairing** — leave and re-open mid-visit and the two halves land on different visits, so the R2-40c-ii pip is never earned |
| **B2** mint lazily at the FIRST rerun compose of that day; hold in state + `sessionStorage` under a scope key mirroring `composeKeyScope` (`reviewV2Compose.js:97-115`) | least garbage; pairing survives a reload; still breaks across devices |
| **B3** B1 + reuse the newest incomplete visit for that day (client query over `restudy_visits`) | best pairing continuity; adds a query and a "which incomplete visit" ambiguity the server does not adjudicate |

**PROPOSED: B2.** Discard the stored `visitId` when the visit reads `completed:true`, on an explicit leave,
or on any `visit_invalid` / `reset_epoch_mismatch` / `reset_in_progress` refusal — then re-mint **once**
(the same recompose-once shape already frozen for `GRADE_UNUSABLE`, `reviewV2Client.js:62-70`).
**Crash/abandon:** an unused visit is inert garbage by contract (`visits.js:14-16`, `15_:194-195`) — the
client must never treat an incomplete visit as state to repair. Never carry a `visitId` across days.

### (c) Typed-retest AI-metering guard

**A retest on a typed class bills the live Claude grader; MCQ retests are graded in-process and are free.**

| Option | Trade-off |
|---|---|
| **C1** launch with **MCQ retests only**; typed classes get re-study + a disabled "re-test" with copy | zero unmetered spend; honours R2-20's condition; narrows the card |
| **C2** client-side per-student/day cap on typed retests | trivially bypassable (the client is the attacker's own browser); creates the *appearance* of a limit R2-20 asked to be real |
| **C3** build `ai_metering/{uid}` + `ai_metering/_global` (`15_:191`) and gate on it | the correct answer — but it is a **server change**, which this card explicitly excludes (§5) |

**PROPOSED: C1 for the launch fold, and escalate C3 as a DF2-14/DF2-10 residual** (see Finding F1 — the
metering surface does not exist anywhere in the tree). Reason: R2-20 made metering a **binding CONDITION**
on re-tests, not a nice-to-have; shipping unmetered typed retests would ship past a ratified condition, and
no client-side control can satisfy it. **This narrows the card and therefore needs an explicit ruling.**

### (d) Within-day toggle placement, and how it composes with the flag-on cutover UI

| Option | Trade-off |
|---|---|
| **D1** segmented control in `SessionHeader` | one canonical control; touches a shared component with 4+ render sites; no toggle/switch primitive exists (`C2:75`) |
| **D2** make `SessionProgressSheet`'s step list tappable | strongest mental model; but the sheet encodes a **fixed linear** `phaseOrder` (`C2:34`) that must not be inherited, and it is concurrently edited |
| **D3** two additive buttons on the study screens ("Go to review" / "Go to new words"), shown only when the other phase exists and is incomplete | smallest blast radius, no new primitive, local to DSF; weakest as an information architecture |

**PROPOSED: D3 for the launch fold; card D2 for the container.** **Composition with the cutover UI:** the
toggle mutates only DSF's `phase` state. The two compose paths are already phase-scoped with distinct
compose-key `kind`s (`reviewV2Compose.js:97`), so jumping phases neither invalidates nor recomposes an
already-composed test, and day completion still requires both attempt ids through `reviewV2CompleteDay`
(`reviewV2Client.js:197-204`). The toggle must be **disabled while a test is in flight** and must not be
offered for a phase the day does not have (e.g. Day 1 has no review phase — `DailySessionFlow.jsx:10`).

### (e) What is visible FLAG-OFF

**PROPOSED: nothing.** Every branch is gated at its call site behind `REVIEW_V2_CLIENT`
(`src/config/featureFlags.js:243`, currently `false`) per the V6 doctrine already stated in
`reviewV2Compose.js:5-7`. The new route renders the existing not-found/redirect behaviour flag-off; the
toggle buttons do not mount; no derivation runs. Flag-off must be **byte-identical**, asserted the same way
every prior cutover fold asserted it. This matches every cutover fold to date and needs no new mechanism.

### (f) Fixture / verification strategy

**PROPOSED**, following the program's pure-fixtures + mutants + WinClaude-visual discipline:

1. **Pure node fixtures** (`scripts/deepfix2/df2-51-*.mjs`, the established `cutover-a-compose-*.mjs`
   shape — no emulator, no network) over pure derivation modules: past-day list = days `1..csd` with
   **no phantom day `csd+1`** (the `displayDay = completedDays + 1` idiom is exactly the phantom chapter
   R2-40(b) forbids — `C2:34`; live cite `Dashboard.jsx:204`, which C2 recorded as `:198-200` before the
   concurrent Dashboard edits moved it); retest-availability predicate (MCQ vs typed per
   (c)); visit-lifecycle reducer (mint → half recorded → completed → discard; every refusal branch);
   toggle-availability predicate (Day 1, in-flight test, already-passed phase); flag-off parity (each
   exported derivation returns the identical value with the flag false).
2. **One mutant per new clause** — e.g. `day <= csd` → `day <= csd + 1`; visit reused across days; typed
   gate inverted; phantom day included; toggle offered mid-test. Each mutant must turn at least one
   fixture red, and the mutant list is published with the fold.
3. **A WinClaude visual order** closes the fold (WSL cannot run vite). It must carry: flag-OFF parity as
   the one thing it exists to prove; **25WT identities only**; an **MCQ** class (typed submissions cost
   real money); do not flip the global flag; full console capture; the expected differences named up
   front; and the standing refusal conditions.

### (g) Scope boundary against R2-40's wider restudy package — NEEDS A RULING

`11_:35` names **DF2-51's in-train leg** as the build home for the whole R2-40 package: the resume sheet,
the five-state TOC, mastery pips, the restudy bookmark, and the list-end screen. This brief scopes the
draft to the browser + the toggle only. **PROPOSED: keep the launch fold to browser + toggle + a
read-only pip count on each day tile** (the counter already exists server-side and is owner-readable —
`visits.js:119-128`, `firestore.rules:239-240`), and card the resume sheet / bookmark / list-end
re-skin separately. The orchestrator should say explicitly whether that split is accepted.

## 4. PROPOSED fold split (each independently flag-off-safe; file ownership listed for sequencing)

| # | Fold | Files (⚠ = shared/contended) | Sequencing |
|---|---|---|---|
| 51-a | Past-day **model**: pure derivations (day list from csd, per-day availability, pip counts) + fixtures | `src/services/restudyNav.js` (NEW) · `scripts/deepfix2/df2-51-nav-fixture.mjs` (NEW) | none — start here |
| 51-b | **Visit lifecycle** client: mint/persist/discard over the existing wrapper | `src/services/restudyVisit.js` (NEW) · fixture (NEW) | after 51-a |
| 51-c | **Browser UI** at `/restudy/:classId/:listId` | `src/pages/RestudyBrowser.jsx` (NEW) · ⚠ `src/App.jsx` (ONE route line) | after 51-b; App.jsx is a 1-line add — verify sole ownership at fold time |
| 51-d | **Retest launch** path (compose rerun → render → submit) | prefer a `restudy` variant of the existing pure `rv2TestConfigOverride` (`reviewV2Compose.js:246`) so ⚠ `MCQTest.jsx` need not be touched | **after** the cutover folds release `MCQTest.jsx` |
| 51-e | **Within-day toggle** (option D3) | ⚠ `src/pages/DailySessionFlow.jsx` only | **after** df2-07-ade and df2-33 release DSF |
| 51-f | **Entry affordance** (option A1 or A2 — decision (a)) | ⚠ `Dashboard.jsx` **or** ⚠ `DailySessionFlow.jsx` — single-own, never both | after df2-33 |
| 51-g | **WinClaude visual order** (flag-OFF parity, then flag-ON on a rehearsal class) | none | last |

51-a/51-b/51-c touch **no file any other agent currently owns** — they can run while the Dashboard/DSF
cutover work is still in flight. 51-d/51-e/51-f are the sequenced tail.

## 5. NON-GOALS (explicit)

- **The container UI.** DF2-51 builds on the LEGACY UI; the container absorbs it later (`02_:170`, FF2-01).
  Nothing here anticipates DF2-33's one-affordance derivation or DF2-60/61's container train.
- **DF2-32 messaging-register copy.** Reason/holdReason copy, the retake wall, the 1:1 message⇔reason
  binding table and its oracle are DF2-32's (`02_:144`). DF2-51 writes only nav-local labels, and RV2
  refusal copy stays where the cutover fold put it (`reviewV2Compose.js:39-45`).
- **Teacher surfaces.** The gradebook re-run toggle and its **query-layer** retest exclusion
  (`queryTeacherAttempts`, `db.js:2024-2076` has no attempt-type filter — `C2` / `02_:124`) are DF2-14/
  DF2-11 work, not this card.
- **ANY server change.** `functions/**` and `firestore.rules` are **frozen for this feature** — the rerun
  engine, the visit docs, the stamping/graduation law, and the rules are already committed and verified in
  §2. Findings that require server work (F1) are **escalated, not implemented here**.
- **Backfill, migration, flip choreography, monitoring signals** — DF2-14/DF2-40/DF2-41.

## 6. FINDINGS — where the engine as-built does not match the card

**F1 (BLOCKING for the "AI-metered" clause). AI metering does not exist.** The card says retests are
"AI-metered" (`02_:170`); R2-20 made metering a binding CONDITION (`11_:63`); `15_:184` freezes
`aiCallCount` on grading jobs and `15_:191` freezes `ai_metering/{uid}` + `ai_metering/_global`. **Zero occurrences of
`ai_metering` or `aiCallCount` exist in `functions/` or `src/`** — the only match for "metering" in
`functions/` is a comment (`typedGrading.js:58`). This is a real gap, not a general "nothing is built
yet": the sibling §6 contracts ARE implemented (`streak_credits` — `completion.js:679`; bookmark cleanup —
`reset.js:108-114`). DF2-51 is client-only and **cannot** satisfy this condition. See decision (c).

**F2. The rerun REVIEW half is not day-scoped.** `callables.js:434-446` composes it over the **full
currently-introduced range**, not the visited day (ratified by R2-41(h), `11_:36`). The card's "past days
list → … re-test it" reads as day-scoped and is misleading. **Copy constraint:** a day tile must not
promise "re-test Day 7's words" — the review half is a fresh random draw over everything introduced so far,
identical no matter which past day is open. Only the **new** half is day-scoped.

**F3. Not every past day has a NEW half.** The rerun-new leg needs the visited day's passed new-word
anchor (`callables.js:450-458` → `foundation.js:996-1007`); without one it returns `no_evidence`, and an
empty slice returns `empty_pool`. Two real populations hit this: zero-new-word / list-end days (the LIST-END
LAW day advances on the review test alone), and the known CS "invalid anchor" rows (CLAUDE.md, CS-2026-06-21).
The card assumes both halves always exist. The browser must render a **half-availability** state per day.

**F4 (consequence of F3). Such days can never be "re-completed."** A pip requires BOTH halves in one visit
(`visits.js:106-127`, R2-40c-ii), so a day with no new half is permanently un-pip-able. If the day grid
shows a "re-completed" state, that state is unreachable for those days — a decision the pip fold must own.

**F5 (helpful, not a contradiction). Within-day freedom is already legal server-side.** Neither
`reviewV2ComposeSession` (`callables.js:228-278`) nor `reviewV2ComposeNewTest` (`:325-380`) requires the
other phase first; only `determineStartingPhase` (`studyService.js:228`) forces new→review. DF2-51(2) is a
pure client change with no engine dependency.

**F6 (path correction). `DailySessionFlow.jsx` lives at `src/pages/`, not `src/components/`** — the brief's
path does not exist. All ownership and sequencing above uses `/app/src/pages/DailySessionFlow.jsx`.
