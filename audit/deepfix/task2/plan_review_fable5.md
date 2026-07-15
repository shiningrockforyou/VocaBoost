# Plan review — VERIFIER #5: architecture & tech-debt convergence lens

**Target:** `audit/deepfix/task2/FIX_PLAN.md` (v2). **Reviewer:** independent verifier #5 (fable5),
Task 2 step 2.4, lens = does the plan CONVERGE to the ideal model (ROOT_CAUSE §0 N1–N6) or leave
half-migrations / dead code / duplicated surfaces / new debt. **Date:** 2026-07-13. **Mode:** READ-ONLY;
every claim below re-verified against TODAY's working tree (tag `[V5]`) — no claim inherited untested.

**Verdict up front:** the plan genuinely converges. The one-migration keystone HOLDS under adversarial
checking (§2 below): P8/P9/P10 ride on the P3–P7 foundation with no second structural migration hiding
anywhere I could find. The transitional constructs (two-mode resolver, shadow-then-enforce M4) are
disciplined, bounded, and acceptance-asserted — transitional, not debt. But the plan has **two HIGH gaps**
where convergence is overstated or a seam is unspecified (MCQ correctness authority; the third twi
writer's P4→P5→P10 transition), and its **retirement story (P7) + flag lifecycle are under-inventoried**
enough that dead code and dead flags WILL linger unless folded now. Findings severity-ranked.

---

## HIGH findings

### H-1 · MCQ correctness stays client-authoritative FOREVER — and the plan never says so
- **Severity:** HIGH (convergence gap + honest-ledger violation).
- **Location:** FIX_PLAN §0.1 (N4/N5 claims), P6 "Dissolves", P10, §5 matrix, §6 deferred ledger —
  Phase E / MCQ correctness appears in NONE of them (`grep -n 'Phase E\|MCQ' FIX_PLAN.md` → only file
  cites at :145/:220/:369/:878/:920 `[V5]`).
- **Problem:** After the FULL program (P6 rules cutoff + P10 override), the MCQ pass verdict — the thing
  that mints a reconciliation anchor — is still computed by the client and merely *recorded* by the
  server. The plan claims N4 ("grading is authoritative") and N5 ("writes are server-authoritative") as
  its convergence target and never names this surviving client-authoritative path, not even in §6
  ("Open and deferred, honestly").
- **Evidence `[V5]`:** `functions/index.js:438-442` — `correctnessSource: opts?.correctnessSource ?? null`
  with the in-code comment: *"null = client-computed (MCQ) or legacy — downstream (override) treats null
  as untrusted. **No 'server-mcq' until Phase E** (MCQ stays client-computed; selectedOptionId is
  forgeable)."* `PLAN_attempt_write_lockdown.md:107-117` (§3) names this residual loudly ("server-written
  ≠ server-derived… MCQ correctness authority is deferred to Phase E — NOT a fast-follow") and §5 warns
  the lockdown "isn't oversold." FIX_PLAN adopts W1/W2/W3 (P3/P6) but drops the residual on the floor.
- **Why it matters architecturally:** it partially undermines the plan's OWN X3 gate rationale. §2.1
  says cycling is safe "under server-owned twi + validated anchors" — but M4 validates anchor *positions*
  (`nwsi === serverTwi`, counts ≤ allocation), not whether the pass was earned. Post-P6+P9 a student can
  still self-advance laps by submitting forged-`isCorrect` MCQ rows through the legitimate
  `submitVocabAttempt` callable: positions correct, day correct, M4 green, anchor minted, and the
  resolver's reconciliation (P3 change 2, "semantics unchanged") will then APPLY that anchor. Day-guard
  paces it to one day per day, but the forgery class survives the cutoff.
- **Fix:** (a) add the Phase-E residual to §6 as a named open item with the same honesty the plan gives
  the challenge-accept clamp (§5 row 7); (b) qualify §0.1's N4/N5 and P6's "Dissolves C-29" with "student
  MCQ-verdict forgery via the callable remains until Phase E"; (c) state whether Phase E gates anything
  (it should at least be *considered* against P9 CYC, since CYC is exactly the phase whose safety argument
  leans on anchor trust); (d) cheap partial mitigation to consider in P3: M4 could flag `anchor from
  correctnessSource:null attempt` in its shadow log so the exposure is at least measured (N6).

### H-2 · The THIRD twi writer (client `reviewChallenge` day-advance) has no specified transition across P4→P5→P10
- **Severity:** HIGH (silent CS-visible failure mode in the P5→P10 window; half-migration risk).
- **Location:** FIX_PLAN P4 change list (routes "render AND session-entry paths" + completion + reset —
  reviewChallenge absent); P5 (no client build ships at P5); P6(a); P10 (server migration).
- **Problem:** `reviewChallenge`'s accept path writes csd/twi to a HARD-CODED class-keyed progress doc:
  `db.js:2790-2791` `const progressDocId = \`${attemptData.classId}_${listId}\`` →
  `users/{uid}/class_progress/…`, guarded by `if (progressSnap.exists())` (`db.js:2794`), with the
  unclamped twi bump at `:2825-2836` `[V5]`. This client path stays live until P10 (the plan keeps the
  P6 teacher rules branch alive *specifically for it*). But: **P4 is the last client build before P6**,
  and FIX_PLAN P4 routes reads/hydration, completion (`completeSession`), and reset — it never says
  reviewChallenge's progress read+write get routed through the mode-aware resolver. If the P4 build
  leaves the hard-coded legacy target: post-P5, every teacher challenge-accept writes the stamped LEGACY
  doc while the canonical `list_progress` is authoritative → **the granted day-advance is invisible to
  the student** (resolver prefers canonical); P7's catch-up merge rescues ancillary fields only ([C4-3]),
  and a review-pass accept's csd bump has NO attempt anchor to self-heal from → permanently lost. Post-P7
  (legacy docs deleted), `progressSnap.exists()` is false → the advance silently no-ops. 614 pending
  challenges (F-4 baseline) make this a live-traffic path, not a corner.
- **Contributing cause:** the v2 BLOCKER fix changed the resolver's P3/P4 contract to return computed
  `{csd, twi, mode, sources}` — values, no `progressRef` — whereas the persist plan's resolver contract
  (§5.2 [C6-1], which FIX_PLAN adopts "by reference") returns `progressRef` precisely so write paths like
  reviewChallenge (persist §3 surface: `db.js:2791/2813/2831`; §7.1 ripple) write the right doc per mode.
  The FIX_PLAN's read-only hardening silently dropped the ref-returning half of the contract that the
  third writer needs.
- **Fix:** (a) P3 change 2: the resolver (both modes) must also return the mode-correct writable ref
  (legacy ref pre-P5, canonical post-P5) for the write paths that remain client-side; (b) P4: add
  "reviewChallenge read+write routed through the resolver (persist §7.1)" to the change list, with a
  persona: *teacher accepts a challenge post-P5 → the canonical doc advances*; (c) P6 rules text: state
  explicitly that the teacher branch retains `list_progress` write (see M-6 below); (d) §5 matrix row 7:
  extend the named residual with this transition note.

---

## MEDIUM findings

### M-1 · P7's retirement inventory is incomplete against its own goal — and has no code-level convergence acceptance
- **Severity:** MEDIUM.
- **Location:** FIX_PLAN P7 (Changes + Acceptance).
- **Problem:** P7's stated goal is "delete what the cutoff made dead, so the next reader cannot resurrect
  it" — exactly the right anti-debt instinct — but its deletion list names only four items (legacy
  submits `db.js:1158/:1276`, client automarker `DailySessionFlow.jsx:964-1008`, flag-OFF passthrough
  `studyService.js:1342`, dead resume branch `:800-816`). Dead-after-P6 surface it does NOT name `[V5]`:
  - the legacy client progress writers themselves: `updateClassProgress`'s pace-increment write
    (`progressService.js:465-486` incl. the create-on-miss `setDoc` `:480-485`) and
    `getOrCreateClassProgress`'s create path — rules-denied at P6, still in the bundle;
  - the client `resetStudentProgress` batch-delete function (`db.js:2886-2995`) — callers migrated at P4,
    rules-denied at P6, the function body still resurrectible;
  - the `class_progress` collection-group READ rule (`firestore.rules:27-29`) — reads a collection P7
    deletes; a dead rule is standing confusion surface;
  - the class-keyed doc-id composition surface (persist §3: `getProgressDocId` callers, hard-coded ids in
    `TypedTest.jsx`/`MCQTest.jsx`/blindSpot `studyService.js:835/:862`);
  - **server-side**: `completeSession`'s legacy-target branch (P4 spec: it writes the LEGACY doc until
    P5) and the resolver's read-only-mode + legacy-merge machinery, both dead after P5/P7.
  And P7's acceptance ("sweep clean; zero `legacy_write_denied` 7 days; F-4 stable") is purely
  behavioral — the persist plan already built the right convergence assert (Phase-2 [V10]: **zero
  non-helper references to the `class_progress` collection**, regex-specified) and P7 doesn't adopt it.
- **Fix:** make P7's change list "the [V10] grep returns zero + this named inventory," and add the
  server-side dead branches. Cheap to fold; without it P7 rots into "deleted the four examples."

### M-2 · Flag lifecycle is unspecified — the program ends with ~8 client flags + a server flag family and one vague retirement sentence
- **Severity:** MEDIUM (and thematically serious: a live flag whose OFF path rotted IS the G1/06-29
  incident class the plan opens by disarming).
- **Location:** P7 ("LEGACY invariant tests removed WITH the flags" — the only retirement statement);
  P4, P8; `src/config/featureFlags.js` `[V5]`.
- **Problem:** end-state flag census: existing `SERVER_ATTEMPT_WRITE`/`SERVER_CHALLENGE_WRITE`/
  `SERVER_REVIEW_MARKER`/`LIST_SCOPED_RECON` (featureFlags.js:10/20/28/41) + new `SERVER_PROGRESS_WRITE`,
  `SERVER_RESET_PROGRESS`, `LIST_PROGRESS_PERSIST` (P4), `CONTINUATION_LINKS` (P8) = 8 client flags; plus
  server-side: per-callable flags (P3), the M4 shadow/enforce flag, the resolver mode flag (§8.3 h),
  `GRADE_TOKEN_ENFORCED`/`MINT`/`GRADE_JOB_ENABLED`. "WITH the flags" names no flags, no owner, no phase.
  Specific orphans: **`CONTINUATION_LINKS` outlives P7** (P8 is parallel-track; nothing after it retires
  anything); `LIST_SCOPED_RECON`'s OFF path (class-scoped recon, "byte-equivalent legacy") is dead after
  P5 yet unscheduled; the resolver mode flag is permanently write-capable after P5 yet unscheduled.
  Per-assignment `cyclingEnabled` + `nextListId` are product CONFIG, not rollout flags — correctly
  permanent; the plan should say that distinction once so they don't get "cleaned up."
- **Fix:** add a flag-lifecycle table (flag → introduced → flipped → OFF-path deleted → flag deleted →
  phase) to §5 or P7; give `CONTINUATION_LINKS` a retirement condition (e.g. P8 acceptance green + 30d).

### M-3 · The client/server `reviewOnlyDay` predicate fork is PERMANENT with only a one-time sync check
- **Severity:** MEDIUM (permanent duplicated logic that must stay in sync — the definition of a fork).
- **Location:** P4 Non-regression ("the CLIENT predicate stays as UX preview"); §5 header ("client
  predicate retained as UX preview **until P7 retires only the flag-OFF legacy branches**" — i.e. the
  preview itself is never retired); P3 acceptance (fixture diff-check).
- **Problem:** post-P4 the same predicate lives twice forever: client
  `studyService.js:1329-1335` `[V5]` (UX preview) and `completeSession`'s server derivation (spec-pinned
  to it). The only specified consistency mechanism is P3's one-time diff-check "on live-shaped fixtures."
  Either side can drift under future edits; divergence shows as UX promising a review-only day the server
  then completes as a new-word day (or vice versa) — silent, student-visible, and exactly the class of
  client-vs-server disagreement this program exists to end.
- **Fix:** one line in P3: `completeSession` compares the client's previewed `reviewOnlyDay` (already in
  `sessionContext`) against its own derivation and logs `review_only_mismatch {uid, client, server}` —
  a permanent, free tripwire (N6) that converts the fork from trust-me to measured. (The fork itself is
  an acceptable pattern — server authoritative, client preview — *once instrumented*.)

### M-4 · The attempt-based reconciliation overlay's END-STATE is never decided — a second derivation of truth survives the whole program as a silent writer
- **Severity:** MEDIUM (deliberate, but undecided ≠ decided; two-sources-of-truth debt).
- **Location:** P3 change 2 ("Reconciliation semantics unchanged", resolver "runs reconciliation and
  writes the reconciled values" per I-6 §1.2); §6.1 hedge (a) (the logging IS the #12 tripwire).
- **Problem:** the ideal model (N5) makes the server-written doc THE truth; the anchor-recon overlay
  (`progressService.js:233-236` semantics, `db.js:3239-3324`) exists to self-heal client-corruptible
  docs. Post-P6 (rules deny client writes, M4 enforces anchors) the overlay's inputs and target are both
  server-owned — yet it remains an *applying writer* forever. That means (a) disagreements between the
  doc and the attempt-derivation get silently healed instead of alarmed — the anti-observability failure
  N6 warns about, hiding exactly the bug class (#12) the tripwire is meant to catch; (b) H-1's forged
  MCQ anchor gets *applied* by this overlay, making it the transmission belt of the residual forgery.
  The plan keeps it as the #12 tripwire (right, pre-P5) but never states what it becomes after P6+soak.
- **Fix:** add an end-state decision to §6: after P6 acceptance + N days of `anchor_rejected ≈ 0`, the
  overlay demotes from silent-apply to **detect-and-alert** (log + optionally quarantine on mismatch;
  never silently move a server-owned doc). One sentence now saves a permanent dual-derivation later.

### M-5 · P8's "finished" predicates break under P9 cycling — an integration point the plan itself creates and doesn't name
- **Severity:** MEDIUM (P8×P9 interaction; wrong-focus/wrong-terminal for every cycling student).
- **Location:** P8 Focus-yield ("yields a finished list's focus (`twi ≥ listTotal`)…") + choice terminal;
  P9 change list (lap-aware M4, review-only×laps — no P8-surface item).
- **Problem:** under P9's monotonic virtual index, `twi ≥ listTotal` is PERMANENTLY true for a cycling
  student (x/plan §2: twi climbs past `cycleLength` forever). P8's focus-yield would therefore yield a
  mid-lap-2 student's focus to `nextListId`, and the finished/hero surfaces re-trigger every lap. The
  plan already demonstrates the right pattern by adding lap-aware M4 as "a NEW integration point this
  plan adds to x/plan's list" — but P8's new consumers (focus-yield, choice terminal, Dashboard hero
  `listFinished` at `Dashboard.jsx:1560-1565` `[V5]`) post-date x/plan, so x/plan's §3c/§3e consumer
  inventory structurally CANNOT cover them, and nobody else does.
- **Fix:** P9 change list gains: "P8 surfaces go cycling-aware — focus-yield and finished-terminal
  predicates key off `cyclingEnabled` + lap position (`twi mod cycleLength`), not raw `twi ≥ listTotal`;
  a cycling student's focus does not yield." One persona: cycling student with a linked next list keeps
  focus mid-lap.

### M-6 · P6(a)'s rules spec is ambiguous exactly where it must be precise: "client writes" vs the teacher branch
- **Severity:** MEDIUM (spec ambiguity on the cutoff's central artifact; overlaps H-2).
- **Location:** P6 change (a); §5 matrix row 1.
- **Problem:** P6(a) says the users wildcard is "conditioned to EXCLUDE `list_progress` and
  `class_progress` from client writes (the teacher branch survives for `reviewChallenge` only…)". A
  teacher's browser IS a client. If the exclusion binds both branches, client `reviewChallenge`'s
  progress write breaks at P6 (its server migration is P10). If it binds the owner branch only (the I-6
  M6 intent: "survives the cutoff FOR TEACHERS ONLY, bounded by M8"), then §5 row 1's "rules deny client
  twi writes" OVERCLAIMS: the third twi writer keeps client authority (any teacher account, unclamped,
  `db.js:2825-2836` `[V5]`) until P10, and the honest statement is "progress is server-authoritative
  for STUDENTS at P6, fully at P10." The plan names the unclamped residual (§5 row 7) but rows 1/2 and
  the P6 "Goal" line don't carry the caveat, and the rules test matrix has no "teacher CAN still write
  list_progress (until P10)" positive case.
- **Fix:** write the branch-level rule shape into P6(a) (owner: excluded; teacher: retained for
  `list_progress` until P10), add the positive rules test, and scope rows 1–2's claims "(students; full
  at P10)".

---

## LOW findings

### L-1 · P6(a) cites the wrong phase for the teacher-branch narrowing
- **Location:** FIX_PLAN:493 "until P9 narrows it". **Problem:** P9 is CYC; the narrowing ships in P10
  OVR ("Rules narrowing LAST", FIX_PLAN:666-667). A reader gating work on "P9 narrows the teacher branch"
  would mis-sequence a rules change. **Fix:** s/P9/P10/.

### L-2 · Cite drift on a [V-P]-tagged rules line
- **Location:** FIX_PLAN:361-362 and §5 reset row: "`firestore.rules:117-118` `allow delete: if
  resource.data.studentId == request.auth.uid`". **Evidence `[V5]`:** the owner-delete rule is at
  `firestore.rules:120-122`; `:117-118` is the teacher-update branch + closing paren. **Problem:** twice-
  cited, [V-P]-tagged, and §8.3 g claims "all other cites in this plan are exact and re-verified" — minor,
  but the plan's authority rests on cite exactness. **Fix:** correct to `:120-122`.

---

## Where the plan converges WELL (verified, not vibes)

1. **The one-migration keystone survives adversarial checking.** I went looking for a hidden second
   structural migration and did not find one: P8 is additive teacher config through the existing
   create path (`db.js:796-819` write site, `initializeDailySession`/`studyService.js:156` init path
   `[V5]`) with the pre-P5 class-keyed residual honestly priced; P9 needs no migration by construction
   (x/plan §2's monotonic virtual index was CHOSEN to keep reconciliation at zero change — the plan even
   ADDS the lap-aware-M4 integration point x/plan lacked); P10 writes through a server primitive onto the
   (student,list) record. I-6 §0's four reasons hold at the code level (three twi writers confirmed:
   `progressService.js:264-271`/`:465-486`, `db.js:2825-2836` `[V5]`).
2. **The transitional constructs are debt-bounded, not debt.** The two-mode resolver is a state machine
   with an atomic flip inside the audited migration and a falsifiable acceptance ("`list_progress` stays
   empty until P5") — the v2 BLOCKER fold genuinely protected P5's single-writer property. M4
   shadow-then-enforce with a measured false-reject gate is the correct generalization of the G1 lesson.
3. **X1 as a construction property** (M5 inside the only surviving completion writer; the dependency
   graph enforces the ordering, not process discipline) is real architectural convergence — the plan
   removes a whole class of "someone deployed in the wrong order" failures.
4. **P7 exists.** A dedicated retirement phase with a ≥14-day reversibility window, deleting the dead
   resume branch (`DailySessionFlow.jsx:800-816` confirmed still present `[V5]`) and the flag-OFF
   passthrough — the anti-resurrection intent is exactly right; M-1 is about completing its inventory,
   not about its existence.
5. **RS converges instead of patching:** `getAssignedListIds()` replaces six duplicated `[] ||` sites
   (`db.js:502/1438/1531/1808/2314/~2436` confirmed, `:811/:835` correctly excluded as accumulator seeds
   `[V5]`); fail-open threshold + render-server-`passed` retire a 3×-failed config-sweep mitigation class.
6. **The #12 posture is exemplary anti-debt:** refuse interim code for a bug class the foundation
   deletes, hedge with continuous server-side logging, name the falsifier (§6.1). This is what
   "converge, don't patch" looks like when applied to an unpinned root.
7. **The v2 folds each killed a half-migration before it happened** (resolver hydration pre-P5; reset
   stranded at P6; role whitelist breaking create) — the adjudication loop is doing its job.

---

## Verdict (lens answer)

**The plan converges to the ideal model; it does not merely patch.** N1 (P5), N2 (P8/P9), N3 (P1/P3),
N6 (P0/P2/P4 provenance + logging) are genuinely reached; N5 is reached for students at P6 and fully at
P10 *provided M-6/H-2 are folded*. The two real convergence debts are: **N4/N5 is overstated for MCQ
correctness (H-1)** — a client-authoritative grading input survives the entire program unnamed — and the
**retirement/flag story (M-1/M-2) is under-specified**, which is how a convergence program quietly
re-accumulates the dead-surface debt it set out to delete. H-2 is the one seam that can silently hurt
real users in the P5→P10 window. All are foldable without touching the backbone: no phase additions, no
re-sequencing — sharpen P3/P4/P6/P7 text, add one §6 entry (Phase E) and one end-state decision (M-4).
