# PLAN REVIEW — Verifier #4 (correctness & data-integrity / migration lens)

**Target:** `audit/deepfix/task2/FIX_PLAN.md` (v2, Codex-converged). **Date:** 2026-07-13.
**Mode:** READ-ONLY; no code changes, no live-Firebase calls. **Stance (David, verbatim):** "always verify
all claims by all agents and Codex results. Never trust blindly. Always verify." Every claim below was
re-traced against TODAY's working tree (`[V-F4]`) or a named Task-1 export. I did NOT take the plan's
`[V-P]` tags on faith for anything my findings rest on — the load-bearing ones were independently re-read
(list in §Verified at the end).

Verdict up front: **the backbone (phase order, single audited migration, resolver mode-switch, conflict
rule) is sound, but the plan is NOT correctness-sound to implement as written.** One spec-level blocker
(P4's read/write split breaks completion for exactly the reconciliation-dependent population) and three
HIGHs must be folded first. All are spec fixes, not architecture changes.

---

## Findings (severity-ranked)

### F-1 · BLOCKER — P4's "read-only resolver + legacy completeSession" strands every reconciliation-healed student in a day-guard rejection loop

**Location:** P4 (FND-2) changes bullet 1 + P3 change 1; §5 rows "CSD non-demoting" / "Completion day-guard."

**Problem.** Today, correctness at completion depends on an entry-time WRITE the plan silently removes.
The current flow: session entry runs `getOrCreateClassProgress` → reconciliation **writes** the corrected
`csd/twi` into the launching legacy doc (`progressService.js:264-271` `[V-F4]`) → the session is built with
`dayNumber = reconciledCsd + 1` → completion's day-guard compares `sessionSummary.day` against **the stored
doc's** `currentStudyDay + 1` (`progressService.js:441-452` `[V-F4]`; `summary.day` mapping verified at
`studyService.js:595` `[V-F4]`). Entry-write and guard agree **because the entry wrote first**.

P4 as written removes the entry write: "render AND session-entry paths … consume the resolver's IN-MEMORY
reconciliation … **even the write paths read-only-resolve until P5**" — while `completeSession` "writes
csd/twi to the LEGACY class_progress doc … **exactly as today's model does**," with day-guard "semantics of
`progressService.js:441-452`." Those two statements are jointly impossible:

- Session built at `resolvedCsd + 1` (in-memory merge, `max` across docs / anchor-derived).
- `completeSession` transaction reads the **un-reconciled** legacy launching doc and asserts
  `expectedDay = storedCsd + 1`.
- For every student where `resolvedCsd > storedCsd` — the 36 LIVE-STRAND + 6 divergent
  (`scan_F3_dualenroll.json`, counts re-verified `[V-F4]`), every dual-enrolled student with review-only
  days on the other doc (which post-RO is a **daily-growing** population), and any single-doc student whose
  anchor ran ahead of the stored counter — the guard **rejects every completion** → session cleared →
  rebuild → same mismatch → permanent loop. This regresses students who complete fine TODAY, and it hits
  hardest exactly the population the program exists to fix.

"Exactly as today's model does" is therefore **FALSE**: today's model is entry-reconcile-write THEN guarded
increment; P4 keeps the guard and deletes the write.

**Fix (spec-level, pick one and pin it).** (a) Redefine P3/P4 "read-only" as *canonical*-read-only: the
resolver in P4 mode may (must) still write reconciled values to the **legacy** doc at session entry —
legacy writes are legal until P6 and this preserves today's semantics byte-for-byte; or (b) specify that
`completeSession`'s legacy mode performs the same in-memory resolution **inside its transaction** — the
guard base and the written value are `resolvedCsd`, not `storedCsd`, i.e. it writes the absolute
`resolvedCsd + 1` to the launching doc. Either way: add a P4 persona "divergent dual-enroll + LIVE-STRAND
student completes a session" (the current persona list names dual-enroll but nothing asserts *completion
succeeds from a stale stored counter*), and re-word the "exactly as today" claim.

---

### F-2 · HIGH — `completeSession`'s reviewOnlyDay/wordsIntroduced derivation omits predicate reason 3 (S8/#9 cross-class resume) → server-side TWI double-introduction

**Location:** P3 change 1; §5 rows "Assigned-new gate" and "TWI exactly flat on review-only days."

**Problem.** The shipped client predicate has THREE confirmed reasons (`studyService.js:1329-1335`
`[V-F4]`): throttle (`allocation.newWords <= 0`), list-end (`isListComplete`), and **`startPhase ===
REVIEW_STUDY`** (#9 resume — new test already passed, `nwCount` forced to 0 with the anchor range
preserved, `studyService.js:247-274` / I-2 S8). P3's spec derives the server value from allocation only:
"recompute allocation server-side from ITS OWN state → derive reviewOnlyDay and `wordsIntroduced = max(0,
serverNewWordCount)`." On an S8 day, allocation recomputes `newWords > 0` (no throttle, words remain) →
server derives `reviewOnlyDay = false`, `wordsIntroduced = N > 0` → `twi += N` on a day whose N words were
already introduced/completed under the other class's doc. Pre-P5 (two docs) that writes the lagging doc's
twi **above its own carried anchor** — precisely the shape P5 must then quarantine or clamp. The plan's own
§5 matrix claims "TWI clamp reproduced server-side as `max(0, …)`" — `max(0, …)` reproduces the
NEGATIVE-clamp, not the S8 zero.

The P3 acceptance diff-check ("server derivation diff-checked against the client predicate
`:1329-1335`") would fail on any fixture set that includes reason 3 — i.e. the plan's spec contradicts its
own acceptance gate. Note post-P5 the case largely self-resolves (one doc: either the day already
completed → day-guard rejects, or it genuinely didn't → introducing N is correct), so this is chiefly a
P4→P5-window defect — but it is a defect in the permanent spec text.

**Fix.** P3 change 1 must state all three reasons server-side: the server derivation is (allocation ≤ 0) OR
(list-complete) OR (the day's positioned new-word attempt already exists and passed — the server-side twin
of `getNewWordAttemptForDay`'s position-consistency check, `db.js:3055-3070` semantics), and
`wordsIntroduced = 0` on that third leg pre-P5. Name S8 explicitly in the diff-check fixture list.

---

### F-3 · HIGH — P6's M8 create-rule breaks the LIVE teacher-signup flow, and the replacement provisioning path is deferred to a later phase

**Location:** P6 change (b); §9 fold #2; §7 decision 4.

**Problem.** The v2 HIGH-2 fold verified `db.js:221/:233` but missed the caller: the **live Signup page
offers a "Teacher" radio** (`src/pages/Signup.jsx:130-148` `[V-F4]`), passed as `gradData.role` through
`AuthContext.signup` (`src/contexts/AuthContext.jsx:75-77` `[V-F4]`) into
`createUserDocument({role: …})`. So client self-creation of `role:'teacher'` is not merely a rules hole
(C-28) — it is the **product's only teacher-onboarding path today**. P6's `allow create: role == 'student'
or absent` denies it, and the plan's replacement ("role changes to teacher/admin go through a
callable / admin path only") is never BUILT in any phase before P10: P3's callable inventory has no
provisioning callable, and the "full role mechanism" is explicitly deferred to I-7 (§7.4). The P6 rules
test "legit teacher provisioning via the admin/callable path ALLOWED" tests a path that does not exist.
Post-P6, a new teacher signs up → rules denial surfaces as a raw error on the signup form → onboarding is
broken with no in-product alternative, and the Signup UI keeps offering a dead option.

**Fix.** P6 must ship, in the same release: (i) the minimal provisioning path (an admin-gated callable, or
the documented decision that teachers are console-provisioned by David during the interim — a decision to
ADD to §7), and (ii) the Signup UI change removing/disabling the Teacher radio (hosting leg). Note the
denial is the *point* (any student can self-select Teacher today — C-28 confirmed live and trivially
exploitable `[V-F4]`), so this is a sequencing gap, not a direction dispute.

---

### F-4 · HIGH — P5 cutover atomicity and reversibility are overstated

**Location:** P5 Procedure + Ship/Test/Revert; §3 constraint 9; §8.3 h.

Three distinct gaps:

1. **The `completeSession` write-target flip is unspecified.** P4 says completion writes legacy "until P5";
   P5's procedure flips only `resolveListProgress` to write-capable. Nothing states when/how
   `completeSession` (and `resetProgress`) switch from legacy to canonical targets, nor that this flip is
   atomic with the resolver flip. If `completeSession` keeps writing legacy after canonical exists, every
   completion is invisible to the canonical read path (reads prefer canonical) → students frozen at their
   migration-day state. If it flips before the script finishes, it writes canonical docs the migration then
   must not clobber. **Fix:** one named server-side mode flag governs resolver + completeSession +
   resetProgress together; the flip is a single step in the P5 procedure with its own assert.
2. **No quiet-window / post-flip delta pass.** A completion landing on a legacy doc between the script's
   read of that student and the flip is silently absent from canonical (the script wrote a pre-completion
   snapshot). The persist plan's own answer (§7.5 migrate-no-inflight; repeated catch-up passes) is not
   carried into P5's procedure; the 25WT rehearsal covers a *flag-off-client post-migration* write, not a
   *mid-script* write. **Fix:** run in a quiet window; immediately post-flip, run a delta pass over legacy
   docs with `lastSessionAt > migratedAt` applying the FULL merge rule (see F-5, not ancillary-only); assert
   zero completion events logged during the script run.
3. **"Reversible: backups + legacy docs RETAINED until P7" is only true until the first post-flip
   completion.** After students write canonical for even one day, restoring backups/re-pointing to legacy
   loses those days; a true revert requires a canonical→legacy back-merge that is designed nowhere.
   **Fix:** state the honest reversibility window ("clean revert only before post-flip writes accumulate;
   after that, revert = reverse catch-up merge, script to be written before P5 runs, or explicitly
   accepted as forward-only").

---

### F-5 · MEDIUM — P7's catch-up merge inherits [C3-4]'s "position self-heals" rationale, which is FALSE for review-only CSD → legacy review-only days are dropped at legacy deletion

**Location:** P7 changes ("Catch-up merge (ancillary deltas…)"); persist §8 [C3-4].

**Problem.** [C3-4] (2026-07-04) merges only ancillary fields (recentSessions union, streak/interv) on the
argument "position self-heals (the completion also wrote a server attempt → anchor reconciliation)." That
was written before review-only completion existed. Review-only days advance **csd with no anchor** and are
"structurally invisible to attempt-anchored reconciliation" (I-2 §1.2 last row, re-verified: the summary
`studyService.js:1461-1472` carries no anchor; the marker is session_states-only `[V-F4]`). Post-P5, the
remaining legacy writers are stale pre-P4 bundles running full client completion; their review-only
completions write `csd+1` to a legacy doc that the canonical read path ignores. P7's ancillary-only
catch-up then discards the csd component and deletes the doc — a permanent day loss for exactly the
RO-recovering population, and a violation of the plan's own "CSD non-demoting" invariant row at the one
boundary it doesn't cover. (Bounded: only pre-P4 bundles in the P5→P6 window — P6's 14-day no-legacy-write
precondition caps it — but the writes that DID happen in that window are silently truncated.)

**Fix:** the catch-up pass re-runs the §8 COUNTER merge, not just ancillary: `csd = max(canonical, legacy)`
(screened), `twi = anchor-validated max`; add "0 csd/twi regressions vs pre-deletion legacy" to P7's
acceptance. Cheap, since recentSessions are already being unioned.

---

### F-6 · MEDIUM — the CSD-plausibility screen amendment is directionally right but under-pinned in three ways that can still quarantine legitimate students

**Location:** P5 "THE MANDATORY AMENDMENT"; §3 constraint 4.

1. **Which anchor baselines the gap is load-bearing and unstated.** [C4-2]'s baseline is per-source-doc:
   "wildly exceeding **its own doc's** anchor-derived day + slack." The amendment's text ("csd − anchorDay
   gaps … `submittedAt > anchor.submittedAt`") never says whether `anchor` is the doc's own class-lineage
   anchor or the cross-class max anchor. Using the cross-class anchor re-breaks the DIVERGENT population
   the rule exists to protect: the pace-20 Day-15 doc has gap 15−8=7 against the pace-80 anchor, and its
   ordinary-day review attempts (days 9–15) may predate the fast anchor's `submittedAt` → not counted →
   csd 15 excluded → Day 15 lost, the exact [C4-1] failure. **Fix:** pin it — per source doc, gap =
   `docCsd − ownLineageAnchorDay`, evidence = post-**own**-anchor review attempts in that doc's classId
   lineage (which also resolves the `(classId, listId, studyDay)` key ambiguity: cap one per
   (doc-lineage, studyDay)).
2. **The amendment must bind to the UNIFIED merge rule, not the migration script.** [C4-1] requires
   migration and hydration to share one merge rule; P5's write-capable resolver hydrates genuine
   stragglers at runtime. As written the amendment lives in "the migration script" — a long-recovering
   straggler hydrated post-P5 would be screened by the UN-amended [C4-2] and quarantined/demoted. **Fix:**
   state the amendment as part of the §8 unified rule (both executors).
3. **Admission direction, named honestly:** until P6, attempt-create is client-legal
   (`firestore.rules:101-107` `[V-F4]`), so evidence attempts are forgeable — a forged csd can be
   legitimized by minted review attempts. This is consistent with the program's accepted posture (csd
   over-credit is the documented non-demoting trade-off; forgery closes at P6; census shows no corruption)
   but the amendment should say it, so the screen isn't mistaken for a forgery control.

Otherwise the mechanism **checks out**: I traced every csd-advancing path — (a)(b)(c) review-test
completions, S8 resume, S7 automarker (its day carries a same-day passed NEW attempt → anchor covers it;
and the marker itself is a field-queryable `sessionType:'review'` attempt with `studyDay`+`submittedAt`,
`DailySessionFlow.jsx:984-1000` `[V-F4]`, so it is countable evidence too), post-P3 W2 marker (an attempt),
wall-era frozen-day duplicates (same studyDay → cap collapses them; csd didn't advance so no gap accrued) —
and gap ≤ evidence holds for all of them EXCEPT the challenge-accept path (F-7).

---

### F-7 · MEDIUM — the challenge-accept writer: (a) mints twi-above-anchor rows between now and P5 that make P5's acceptance self-contradictory; (b) becomes a silent dead write from P5 to P10

**Location:** §5 row "TWI exactly flat" (named residual); P6 change (a); P10.

**(a)** Verified: on a boundary review-pass accept, `reviewChallenge` adds
`round(pace·(1−interventionLevel))` to twi with no `wordsRemaining` clamp and no relation to any attempt's
`newWordEndIndex` (`db.js:2821-2836` `[V-F4]`), and it also advances `csd+1` with **no review-attempt
evidence and no anchor move** (a review attempt is not an anchor; the accepted attempt's `passed` flip at
`db.js:2727-2731` `[V-F4]` only moves the anchor for NEW-phase accepts). Concretely: a wall-era student
(review attempt < 95, completion blocked) whose teacher accepts a review challenge gets twi inflated by
pace-worth of never-introduced words and a csd tick with zero screen evidence. 614 challenges are pending;
accepts keep happening through P1–P5. At migration each such row forces a trilemma the plan doesn't
adjudicate: quarantine (collides with the [C7-2] "26SM quarantine = 0" P6 precondition), demote to anchor
(collides with "0 twi regressions" as an unconditional hard assert), or admit (immortalizes phantom twi).
**Fix:** P5 needs a named disposition rule (suggested: stored-twi ≤ anchor + pace with an accepted
challenge in the window ⇒ re-derive from anchor, logged as an EXPECTED correction and carved out of the
"0 twi regressions" assert; csd tick from a boundary accept counts as one evidenced day). F-11's
twi>mastery=4 shows the shape already exists live.

**(b)** From P5 on, the accept's day-advance writes a hardcoded **legacy** path
(`users/{uid}/class_progress/{classId}_{listId}`, `db.js:2791-2792` `[V-F4]`) inside a swallow-and-continue
catch (`db.js:2840-2843` `[V-F4]`) — invisible to canonical reads immediately, `progressSnap.exists()`
false after P7 deletes legacy. New-phase accepts self-heal at next entry (attempt now passed → anchor →
resolver reconciles); review-phase boundary accepts lose their day-advance entirely until P10. Also
ambiguous: P6(a) "conditioned to EXCLUDE list_progress and class_progress from client writes (the teacher
branch survives for reviewChallenge only)" — if the exclusion binds the teacher branch, the write is
DENIED (and swallowed) at P6; if not, teachers retain a pointless class_progress write. Either reading
contradicts §5-row-7's framing of a live "interim residual." **Fix:** state the interim behavior
explicitly (accepted-challenge day advance is anchor-recon-deferred for new-phase / lost for review-phase
until P10 — surface it in the teacher UI), or route the accept's progress leg through
`completeSession`/the resolver at P4–P5; and disambiguate P6(a)'s teacher-branch scope.

---

### F-8 · MEDIUM — `completeSession` has no idempotency/replay answer: a committed-but-response-lost call reads back as failure

**Location:** P3 change 1; §8.3 d.

The transaction closes the [C3-2] race, but the plan gives the callable no idempotency key: client submits
→ transaction commits → response lost (this cohort's daily reality — 313 failures/21 students on 06-22,
flaky mobile webviews per persist §13.1) → client retries → day-guard sees `csd` already advanced → returns
`day_guard_rejected_session_cleared` → a successfully completed day is presented as a rejection + session
clear. Data stays correct (the guard is doing its job); the UX and the F-1/G5 telemetry both take false
signal — the P1 acceptance "day_guard_rejected trends → 0" would be polluted by exactly the retries the new
path invites. **Fix:** key the call on a per-session token (the `sessionContext` it already receives);
on replay of an already-applied token, return the original success payload. Cheap inside the same
transaction doc.

---

### F-9 · NITS (each one line, each real)

1. **P0/P1:** `firebase deploy --only hosting` builds the WORKING TREE, not the recorded sha — the scoped
   commit alone proves nothing about the bundle. Today only the 3 #11 files are dirty under `src/`
   (`git status` re-run `[V-F4]`; 227 paths vs the plan's 223 — drift, immaterial), so it coincides; make
   it literal by building from a clean worktree/checkout of the recorded sha, or keep the client-delta
   review as the named compensating control (it currently is — say it's load-bearing, not belt-and-braces).
2. **P4 acceptance** "`list_progress` collection stays empty until P5" is falsifiable by any client: the
   users wildcard (`firestore.rules:45-48` `[V-F4]`) lets an owner write `list_progress/*` TODAY, and the
   P4 read path would then CONSUME a forged canonical doc (no new capability vs forging `class_progress`
   today — the safeTWI hole is identical — but the assert should check a script-provenance field, not
   emptiness, and the migration's existing "compare before overwrite" idempotency handles the collision).
3. **P3 `resetProgress` epoch:** "anchor queries exclude pre-epoch attempts" can bind only the server
   resolver + migration; the still-live client reconciliation (until P4/P6 bundles expire) knows no epoch —
   the [C3-3b] straggler-attempt resurrection residual persists on old bundles. Say so.
4. **Resolver logging volume:** "every resolution logs" × render paths (Dashboard + teacher gradebook,
   `fetchStudentsProgressForClass` = one resolution per student per view) is a `system_logs` write
   amplifier; bound it (log-on-change / sample renders, always-log session entry + hydration).
5. **P5 populations arithmetic:** verified against `scan_F3_dualenroll.json` — 36 LIVE-STRAND / 6 divergent
   / 72 stale / 22 benign-equal / 5 benign-finished = 141 rows exactly `[V-F4]`; "~633 single-doc" is
   correctly labeled an estimate.

---

## Where I looked for trouble and found none (explicit clears)

- **Conflict rule vs all F-3 populations:** LIVE-STRAND forward-jump, stale-doc dissolution, benign
  collapse, single-doc 1:1 — traced clean against `progressService.js:148-150/:233-236` semantics; the
  divergent case is clean **contingent on F-6.1** (per-doc anchor baseline).
- **The invariant table's per-phase enforcement points** (§5) hold as stated for TWI-monotonic,
  anchor-identity, errored-lookups-move-nothing (fail-closed pairing verified at `db.js:3244` and
  `db.js:3406-3410` `[V-F4]`), and day-guard — EXCEPT the two windows named in F-1 and F-5.
- **The v2 folds are all genuinely true against the tree** `[V-F4]`: resolver two-mode fix coherent with
  persist [C6-1]/[C4-4]; `db.js:221/:233` (HIGH-2 evidence, though see F-3 for what it missed);
  `db.js:2886/:2958-2995` + `firestore.rules:117-118` (HIGH-3); `functions/index.js:90/:973/:1459` +
  the byte-for-byte rollback comment (HIGH-4); `studyService.js:1449/:1455` write-only marker + summary
  `:1461-1472` lacking it (HIGH-5); `functions/index.js` markReviewComplete writing no
  testId/nwsi/nwei (MED-6); dirty tree, 3 runtime files (MED-7).
- **W3-doc supersession quote** confirmed verbatim ("Students may still delete their own attempts
  (progress reset) — unchanged", `W3_attempts_lockdown.rules.md` `[V-F4]`).
- **RO→P5 interaction (§3 constraint 4):** with the durable-attempt evidence rule, gap ≤ evidence holds for
  every legitimate csd-advancing path I could construct (enumeration in F-6), including wall-era
  same-studyDay duplicates and S7 automarker days. The single exception is the challenge-accept tick (F-7a).
- **P1 hosting-only safety, P2 zero-write claim, GRADE_TOKEN_ENFORCED=true at HEAD** — re-verified;
  no contradiction found.

## §Verified (working-tree re-reads behind this review, 2026-07-13)

`progressService.js:103-302` (create-on-miss, anchor identity, reviewLookupFailed, safeCSD/safeTWI,
recon write), `:434-489` (day-guard, csd/twi increment); `studyService.js:578-640`
(recordSessionCompletion, summary.day, guard-abort), `:1320-1480` (predicate/clamp/gate/null
semantics/marker/summary); `db.js:191-235` (user create), `:2655-2844` (reviewChallenge incl. passed
flip, boundary guard, unclamped bump, swallow catch), `:2886-2997` (client reset), `:3239-3324` (anchor),
`:3395-3449` (pairing); `functions/index.js:55-95` (flags), `~570-600` (marker fields), `:965-980/:1045-
1060/:1455-1465/:1895-1905`; `firestore.rules:25-118`; `featureFlags.js:10/20/28/41`;
`src/pages/Signup.jsx:13-148`; `src/contexts/AuthContext.jsx:65-120`; `DailySessionFlow.jsx:960-1008`;
`W3_attempts_lockdown.rules.md:35-48`; `git status`/`git log`; `scan_F3_dualenroll.json` (recounted),
`CENSUS2_FINDINGS.md`, `cs_manual_writes_catalog.md`.

**Bottom line:** fix F-1 (pin the P4 reconciliation-write/guard-base contract), F-2 (three-reason server
derivation), F-3 (teacher provisioning ships WITH P6), F-4 (one mode flag + quiet window + honest
reversibility) in the plan text; adopt F-5/F-6/F-7/F-8 as spec amendments. With those folded, I would call
the plan correctness-sound to implement on the live cohort.
