# FIX_PLAN — deepfix Task 2, step 2.1 (v3) — the converged, phased convergence plan

**Status:** v3 — folds (a) Codex review of v1 (1 blocker + 4 high + 2 med → v2) and (b) the 3 independent
fable verifiers of v2 (1 blocker + 7 high + several med/nits → v3). The orchestrator verified every finding
against the working tree (ALL TRUE, none rejected; per-finding evidence in
`audit/deepfix/task2/adjudication_log.md`); this drafter independently re-verified each cited `file:line`
before folding (see §9 v1→v2 and v2→v3). Backbone/altitude unchanged — no phase additions or re-sequencing;
all folds are spec-sharpening within existing phases. **Author:** FIX-PLAN drafter (Task 2.1).
**Date:** 2026-07-13. **Mode:** READ-ONLY design — no code changes, no live-Firebase calls were made in
producing this plan.
**Backbone:** the I-6 master sequencing (`investigations/inv_I6_foundation.md` §4) adopted as the phase
order, with two additions argued in place: a parallel read-surface track (RS, from I-8) and a SPLIT of
David's continuation feature into a pre-foundation half (CONT-A) and the foundation-gated cycling half (CYC).
**Inputs:** `ROOT_CAUSE_FINDINGS.md`, `inv_I6_foundation.md`, `inv_I5_deploy_gate.md`,
`inv_I2_reviewonly_matrix.md`, `inv_I8_read_surfaces.md`, `inv_I10_permission_gap.md`,
`CONSOLIDATED_ISSUES.md`, the four converged plans (`PLAN_list_progress_persist.md` v3.7,
`docs/plans/loop/x/plan.md` v5, `PLAN_review_only_day_completion.md` v3, `PLAN_attempt_write_lockdown.md`
+ `W3_attempts_lockdown.rules.md`), David's feature request (`SESSION_CONTEXT_2026-07-13.md` §6), and the
Task-1 data exports (`audit/deepfix/task1/firebase/*`).

**Verification stance (David, verbatim: "always verify all claims by all agents and Codex results. Never
trust blindly. Always verify."):** every current-code claim in this plan was RE-VERIFIED against TODAY's
working tree by this drafter (tag `[V-P]`; full list + the corrections found are in §8). Every blast-radius
and migration-input number cites a Task-1 export file. Claims inherited from Task-1 docs without
re-verification are tagged with their source doc. Estimates are marked as estimates.

---

## §0 — Program frame

### 0.1 The ideal model this plan converges to (CONSOLIDATED §0, N1–N6)
- **N1** progress is student-owned per (student, list); class = access + policy.
- **N2** progression is a graph with first-class terminals (link, advance, cycle) — never a dead-end.
- **N3** every legitimate day-state completes on its assigned work (the I-2 S1–S10 matrix is the spec).
- **N4** grading is authoritative, calibrated, and never a dead-end (server-authorized override).
- **N5** writes are server-authoritative (role, attempts, progress, twi). **Caveat (v3 F5-HIGH-1):** MCQ
  correctness stays CLIENT-computed after P6 (server-authoritative twi/anchor arithmetic, but not MCQ grade
  authority — Phase E, §6.2b). N5 is met for progress/role/anchor writes; MCQ grade authority is a named
  follow-on, not delivered here.
- **N6** the system is observable (provenance consulted; read surfaces match their claims).

### 0.2 The program metric (F-4 H/P/B partition — the before/after for every phase)
Baseline 2026-07-13 (`firebase/CENSUS2_FINDINGS.md` F-4, `scan_F4_hpb.json`): of **774 started** students —
**H = 541** healthy · **P = 45** hand-patched (21 holding, **24 re-stuck**) · **B = 188** broken
(#11 wall / live-strand / undersized-test). Re-run before AND after every phase that writes or deploys (X5).
Per-root blast radius (ROOT_CAUSE §0): #11 wall = **183** · live cross-class carry = **~42** (36
LIVE-STRAND + 6 divergent, +72 latent; `scan_F3_dualenroll.json`) · permanent-fail now = **3**
(`scan_F6_tokens_permafail.json`) · #13 undersized = **18** tests / 17 students (`scan_F2_testsize.json`) ·
config-drift = **12 assignments** · pending challenges = **614**. The data is NOT corrupt; manual patches do
not hold (24/45 re-stuck) — the case for changing the MODEL, not the rows.

### 0.3 The phase map (hard-gate graph; calendar may overlap, gates may not)

```
FND-0 ─→ RO (David/X2) ──→ CONT-A (build after RO; hosting-only)
  │  └─→ RS (parallel; hosting + indexes only)
  └─→ FND-1 ─→ FND-2 ─→ FND-3 ─→ FND-4 ─→ FND-5
                                   ├─→ CYC  (hard gate: FND-4 live)
                                   └─→ OVR  (gates: FND-4 + C-28 role decision)
```

One line: **FND-0 → RO → {RS, CONT-A in parallel} → FND-1 → FND-2 → FND-3 → FND-4 → FND-5 → CYC → OVR.**
Everything after FND-0 that touches functions or rules is sequential; RO/RS/CONT-A are hosting-only and
slide at David's discretion after FND-0.

**What ships first:** FND-0 (two commits + ops substrate, no deploy) and then the RO hosting-only deploy —
the fastest live-harm reduction (183 walled + 6 day_guard students + 24 re-stuck P; all fixed-in-tree,
merely undeployed).

**Deviations from I-6 §4, declared:** (1) RS added as a parallel hosting+indexes track (I-8's scope has
zero contact with reconciliation/attempt-write paths → X4 by construction; justification in P-RS). (2)
David's continuation feature is split: list-linking + choice terminal + continuous advance-to-next-list
(CONT-A) does NOT require the foundation and ships after RO; start-over/cycling (CYC) keeps I-6's hard
FND-4 gate. Justification in §2.1. I-6 parked ALL continuation inside CYC; this plan argues the split.

---

## §1 — The phases

Format per phase: Goal · Changes (working-tree `file:line`, all `[V-P]` unless tagged) · Ship/Test/Revert ·
Flags & data · Acceptance (F-4-tied where relevant) · Deploy gate (I-5 G0–G5; deploy target) · Dissolves ·
Non-regression (X4/H10; full matrix in §5).

---

### P0 · FND-0 — Deploy-safety substrate (the G1 disarm; C-32/C-36)

**Goal.** Make it impossible for any deploy in this program to re-arm the 06-29 outage, and make
deploy-state knowable. Nothing else ships until this exists.

**Changes.**
1. **SCOPED COMMIT MANIFEST for the #11 fix** (I-5 G0, sharpened v2). Verified TODAY: the tree is dirty
   with **223 changed/untracked paths** `[V-P git status]` — but almost all of it is `audit/deepfix/**`,
   `scripts/cs/*`, and doc/harness churn that David wants to STAY uncommitted. So "commit #11 + tree clean"
   is naive: a blanket commit would sweep the audit program into the hosting bundle. The precise action is a
   **scoped commit of ONLY the three #11 runtime files** — `src/services/studyService.js`,
   `src/pages/DailySessionFlow.jsx`, `src/pages/Dashboard.jsx` `[V-P]` — explicitly isolated from the
   audit/harness/doc churn (which remains uncommitted). Record the EXACT commit sha(s) permitted into the
   hosting bundle, and do a full client-delta review of those three files vs the last deployed bundle
   (`a967f54` `[V-P git log]`). "Deploys only from a clean tree" (I-5 G0) is thus reinterpreted for this
   repo as **"deploys only the recorded runtime sha(s); the audit churn is provably not in the built
   bundle"** (the built `dist/` is `src/`-only, so the untracked `audit/`/`scripts/` paths never enter the
   bundle — but the client-delta review is what proves it). (The Task-2 session-context snapshot claiming a
   clean tree is WRONG — see §8 correction 3.) **The commit itself is David/owner's action** (this drafter
   and the orchestrator stay read-only / no-commit).
2. **Disarm G1 in-tree:** `functions/index.js:58` `const GRADE_TOKEN_ENFORCED = true;` `[V-P]` → `false`,
   its own commit. This matches the LIVE prod posture (F-9, `firebase/CENSUS2_FINDINGS.md`:
   `correctnessSource` null 77% ⇒ enforcement off) — so it is a repo-truth fix with ZERO behavior change.
   The re-arm (flip back to `true`) moves OUT of this program's critical path: it ships only in the same
   review as the validated nonce fix (P3/P4 legs F1–F3), after the F5 acceptance (I-5 §2) passes.
   Optional hardening per I-5: promote the GRADE_TOKEN/JOB consts to runtime params.
3. **Adopt the I-5 G1 flag-assertion table** into the deploy runbook: every deploy states intended values
   for `GRADE_TOKEN_ENFORCED`(:58)/`GRADE_TOKEN_MINT`(:68)/`GRADE_JOB_ENABLED`(:90) and
   `featureFlags.js` `SERVER_ATTEMPT_WRITE=true`(:10)/`SERVER_CHALLENGE_WRITE=false`(:20)/
   `SERVER_REVIEW_MARKER=false`(:28)/`LIST_SCOPED_RECON=true`(:41) `[V-P]`, asserted by grep at build time.
4. **Provenance consult procedure (G2/G3):** post-functions-deploy assert `exports.version`
   (`functions/index.js:1900` `[V-P]`) `sha == git HEAD`, `dirty == false`, flags == table. Bootstrap
   caveat (I-5): `version` is NOT yet live in prod — the FIRST functions deploy (P3) delivers the probe and
   is itself verified out-of-band (repeat the F-9 read on fresh attempts + `BUILD_INFO` cold-start log).
5. **File the client build-stamp** (hosting has zero provenance — `firebase.json:2-11`, I-5 G3 gap);
   implementation ships in P4's bundle. Interim hosting check: grep the deployed bundle for a fix-unique
   string (e.g. `TypedTest.jsx:1755` "Couldn't Grade — Please Reload" `[V-P]`).
6. **Standing rule:** never bare `firebase deploy`; always explicit `--only` targets (a bare deploy ships
   functions+rules+hosting together and re-arms G1 as a side effect — I-5 §3).

**Ship/Test/Revert.** Ops + two one-line-class commits; independently shippable (no deploy occurs in this
phase); testable by grep + runbook review; reversible trivially (git revert).
**Flags/data.** No flag flips beyond the disarm (repo→prod truth alignment); no data.
**Acceptance.** Repo flag values == live posture per F-9; runbook contains the table + G2 procedure;
the three #11 runtime files committed at a recorded sha, with the audit/harness/doc churn provably NOT in
that sha (scoped-manifest review) and provably NOT in the built bundle.
**Deploy gate.** None (this phase IS the gate). **Dissolves.** C-32 (the landmine as a standing hazard),
C-36 partially (provenance built→consulted; fully closed when P3 delivers the probe + P4 the client stamp).
**Non-regression.** No runtime code path touched; the #11 fix is preserved by being committed, verbatim.

---

### P1 · RO — Hosting-only deploy of the built #11 / #9 / #10 / C-27 fixes (trigger: David, X2)

**Goal.** Unfreeze the single largest live harm with code that already exists: the 183 #11-walled students
(F-4; includes the 24 re-stuck P), the 6 real day_guard students (`scan_F1_FINDINGS.md`), and the alarming
grading-error modal.

**What ships (all verified in-tree today).**
- **#11** (uncommitted until P0): `reviewOnlyDay` confirmed-reason predicate `studyService.js:1329-1335`;
  `wordsIntroduced` clamp `:1337-1342`; gate skip `:1430` `[V-P]`; list-end no-record terminal
  `DailySessionFlow.jsx:822-835` `[V-P]`; finished screen + persistent Dashboard hero
  `Dashboard.jsx:1562-1565` `[V-P]`.
- **#9** (committed `1c91466` `[V-P git log]`): REVIEW_STUDY resume `studyService.js:247-274`; list-scoped
  position-matched pairing `db.js:3402-3443`.
- **#10** (committed `14e49a4` `[V-P git log]`): pure snapshot read `TypedTest.jsx:983-985` `[V-P]` +
  `MCQTest.jsx:722-724`.
- **C-27** (committed): `gradingErrorKind` classifier + de-alarmed modal `TypedTest.jsx:105-106/:595-596/:1755` `[V-P]`.

**Pre-steps (required).**
1. P0 complete (fix committed, tree clean).
2. **C-38:** teach `scripts/cs/data-integrity-sweep.mjs` the `reviewOnlyDay` marker WITH this deploy, or
   the sweep flags every legitimate review-only completion (current benign floor: 31 `reviewNoNewPass`,
   CONSOLIDATED C-38).
3. Sandbox acceptance: PLAN_review_only §8 tests 1–8. The built Playwright harness
   (`audit/playwright/lsr_reviewonly*.mjs`) has NEVER run and CANNOT run in this WSL env — it runs on
   Codex's/David's side (SESSION_CONTEXT §3). If the harness stays blocked, the minimum bar is the manual
   §8 test list against the 25WT sandbox.
4. **Full client-delta diff review**: hosting ships the ENTIRE bundle at HEAD, not just these four fixes,
   and the prod client's current commit is unknowable until the build stamp exists (I-5 G3 gap) — review
   the whole `src/` delta vs the last recorded deploy (`a967f54` `[V-P git log]`).

**Ship/Test/Revert.** Independently shippable: `firebase deploy --only hosting` runs no functions
predeploy and cannot touch `GRADE_TOKEN_ENFORCED` (I-5 §4, verified graceful-degradation of the HEAD client
against old prod functions: `getGradingStatus` try/catch-null, `pollForGrade` only on `functions/aborted`,
token forwarded null under ENFORCED=false, W1/W2 flags false). Testable: sandbox suite + live watch window.
Reversible: redeploy the prior bundle; data written meanwhile stays VALID (legitimate csd advances —
and P5's migration screen must count them — see P5's mandatory amendment).

**Flags/data.** No flag changes (`LIST_SCOPED_RECON=true` already live per F-9: 853 `csd_twi_reconciled`
logs; required composite indexes proven live). No data writes.

**Acceptance (F-4-tied).**
- The #11-wall chunk of B unfreezes: F-4 re-run shows B shrinking by the wall population as students
  complete review-only days (expected motion: most of the 183 → H or → "finished awaiting continuation";
  estimate, not a commitment — the wall count grows daily until deploy).
- `day_guard_rejected_session_cleared` trends → 0 for updated clients (F-1 baseline: 29 events / 6 real
  students; stale cached bundles may trickle — undecidable until the P4 build stamp, I-5 G3).
- `reviewNoNewPass` noise stays at the predicted floor; `csd_anchor_invalid` stays ≈ 0.
- Plan §8 tests 1–8 pass in sandbox first.

**Deploy gate.** G0 (clean tree) · G1 table (asserted even though hosting can't change functions flags —
guards against a mistaken bare deploy) · G3 interim bundle-grep · G4 (sweep + F-4 before/after; C-38 done)
· G5 watch window. **G5 watch signals + clock, made concrete (v3 F6-7):** for the first 60 min, watch
`system_logs` for `attempt_write_failed_client` with permission-denied (the 06-29 signature — baseline
118/18h; ALERT at >3 in any rolling 30-min window), `day_guard_rejected_session_cleared` (should trend to 0
for updated clients; F-1 baseline 29/6-students), `grading_attempt_failed`, and `csd_anchor_invalid` (stays
0). Rollback trigger = the permission-denied alert firing; rollback action = redeploy the prior bundle
(hosting kill-switch). Because hosting has no provenance until P4's stamp, also spot-check via the
bundle-grep of the fix-unique string. Target: `--only hosting`. **G1 is NOT touched.**

**Dissolves.** CR-2's live harm: #11 wall (183, F-4), throttle variant (1 live), #10 self-race (6 real
students, F-1), C-27 modal. The 183 then become CONT-A's population (C-13/C-11 — ROOT_CAUSE CR-2).

**Known gap it does NOT fix (say it, don't discover it in review):** the C-14 mid-session all-mastered
automarker (I-2 S7) — `DailySessionFlow.jsx:964-1008` `[V-P]` bypasses `completeSessionFromTest` entirely
and writes a range-less/testId-less marker that fails exact-range pairing (`db.js:3440-3444` `[V-P]`) →
non-carry to fresh docs + gradebook-invisible. Fixed at P3/P4 (W2-upgraded server marker). Interim harm is
bounded: non-demoting CSD (`progressService.js:233-235` `[V-P]`) preserves the day in place.

**Non-regression.** This phase IS the #11 fix; #9/#10 ride as committed. Invariants: TWI stays exactly flat
on review-only days (clamp `:1337-1342`); CSD non-demoting untouched; anchor rule untouched. Enforcement
point: existing client code, unchanged semantics vs the converged plan (Codex r3 GO 0/0/0/0).

---

### P2 · RS — Read/render truth surfaces (parallel track; hosting + indexes only)

**Goal.** Make read surfaces match their UI claims (N6) and stop the client re-deriving verdicts (N4-edge):
C-33 gradebook Name filter, C-34 testId-less rows, C-35 assignedLists six-site, + the durable C-23 code fix.

**Changes (spec = I-8, adopted; landing order C-35 → C-34 → C-33 per I-8 §4).**
- **C-35:** shared helper `getAssignedListIds(classData)` replacing the `[] || fallback` bug at the six
  verified sites `db.js:502, 1438, 1531, 1808, 2314, 2436` `[V-P]` (NOT `:811/:835` — intentional
  accumulator seeds `[V-P]`); port the census predicate into `data-integrity-sweep.mjs` as a per-class
  signature (recurrence catcher; 0 live hits expected — census v1).
- **C-34:** field-first `const listId = attemptData.listId ?? parsedListId` after the parse block
  (`db.js:1962-1978` `[V-P]`, same pattern in `queryStudentAttempts`/`fetchAllTeacherAttempts`/
  `fetchClassAttempts`); un-drop rows in the two gradebook query fns with the `listTitle` name chain;
  optional `autoCompleted` passthrough for row labeling.
- **C-33:** TWO new composite indexes on `attempts` — `(teacherId, studentId, submittedAt DESC)` and
  `(teacherId, classId, studentId, submittedAt DESC)` — deployed FIRST via
  `firebase deploy --only firestore:indexes` (additive, zero-risk); then the server-side studentId
  where-clause after the class-filter block (`db.js:1931-1935` region) with the ≤30 disjunction guard and
  the existing post-filter (`db.js:1982-1984`) kept as the degraded-mode backstop.
- **C-23 code half (durable #5 fix):** result cards render the SERVER `passed` instead of recomputing
  (`TypedTest.jsx` result card ~`:1306`, `MCQTest.jsx` ~`:1042` — cites inherited from CONSOLIDATED C-23,
  re-locate at impl); retake-threshold resolution fails OPEN when the assignment value is undefined
  (default `useState(0.95)` at `TypedTest.jsx:87` `[V-P]`, resolution `studyService.js:305` `[V-P]`) —
  an undefined teacher threshold must not invent a stricter 0.95 verdict. NOTE: the DATA half (the 12
  drifted assignments, `CENSUS_SUMMARY`/CONSOLIDATED C-23) is a separate David-authorized config CS event,
  not a code change — the code fix removes the recurring exposure class (mitigation has failed 3x).

**Ship/Test/Revert.** Independently shippable: pure client bundle + additive indexes; no functions, no
rules → G1 untouched. Testable: I-8's emulator seed tests (§1.5/§2.4/§3.5) + the 이지후-shape repro
(deep-ranked student appears on page 1). Reversible: redeploy prior bundle; indexes are harmless to leave.

**Flags/data.** No flags; no data writes (explicitly NO assignedLists backfill — X5, I-8 §3.4).
**Acceptance.** Name filter returns the filtered student's attempts with working pagination; automarker/
manual rows visible; split-brain seed test heals; a genuine 90–91% pass under a 90-tier class DISPLAYS as
pass (C-23 inverse-mismatch case); F-4 unaffected (no student-state writes).
**Deploy gate.** G0 · indexes-before-code ordering · G3 interim grep · G5 short watch.
Targets: `--only firestore:indexes`, then `--only hosting`.
**Dissolves.** CR-7's C-33/C-34/C-35; CR-5's #5 recurring exposure (12 assignments' worth of false fails).
**Non-regression.** X4 by construction: zero contact with reconciliation or attempt-write paths (I-8
header, re-affirmed: all changes are read/render-side). Enforcement point: the unchanged write paths.

---

### P3 · FND-1 — Additive server surface (FIRST functions deploy; FND-0 gate applies HARD)

**Goal.** Build the entire foundation server surface behind server flags, client-invisible: the three
progress writers move server-side in code (not yet in traffic), anchor validation starts measuring, and the
nonce fix's server leg lands.

**Changes (all new code in `functions/`; integration semantics pinned to today's client code).**
1. **`completeSession({classId, listId, sessionContext})`** (I-6 M3+M5): one Admin-SDK transaction —
   read progress, assert the day-guard transactionally (semantics of `progressService.js:441-452` `[V-P]`,
   today read-then-write/racy → closes persist [C3-2] by construction); recompute allocation server-side
   from ITS OWN state → derive `reviewOnlyDay` (X1's server derivation) and
   `wordsIntroduced = max(0, serverNewWordCount)`; append `recentSessions` (null new-word fields on
   review-only per PLAN_review_only §3); `csd+1`; `twi += wordsIntroduced`; on a
   review-only-no-review-attempt day, write the W2 marker (below). Rejection returns the existing
   `day_guard_rejected_session_cleared` signal WITH uid.
   **The server `reviewOnlyDay` derivation MUST replicate ALL THREE client predicate reasons, not
   allocation alone (v3 F4-2 fix).** The client predicate is `reviewOnlyReasonConfirmed = (allocationNewWords
   <= 0) OR (isListComplete === true) OR (startPhase === REVIEW_STUDY)` (`studyService.js:1329-1335` `[V-P]`).
   If the server derived review-only from `allocationNewWords <= 0` ONLY, a #9 cross-class REVIEW_STUDY-resume
   day (allocation may be >0 but `startPhase === REVIEW_STUDY` zeroed `nwCount` with the anchor range
   preserved, S8) would NOT be classified review-only server-side → `wordsIntroduced` would go positive →
   **twi double-introduced above the anchor**. The P3 acceptance diff-check asserts the server derivation
   matches the client on all three reasons across live-shaped fixtures (S3 throttle, S4/S5 list-end, S8
   #9-resume). **Idempotency (v3 MED):** `completeSession` must be idempotent against a committed-but-lost
   retry — a client that completed the day server-side but lost the response and retries must NOT
   double-advance csd/twi. The transactional day-guard (`expectedDay = csd+1`) is the mechanism, but it must
   distinguish a duplicate retry of the SAME completion (return current state, no second `+1`) from a genuine
   day-guard collision (another entry advanced the day). Assert in the P3 suite: retry the same completion
   twice → exactly one advance.
2. **`resolveListProgress(listId)`** (persist §5.2 [C6-1], server-side) — **SHIPS READ-ONLY / SHADOW in
   this phase (v2 BLOCKER fix).** It has TWO modes and P3 defines BOTH:
   - **READ-ONLY mode (P3 → until P5 commits):** read canonical `list_progress` if present; else reconcile
     the merged view from legacy docs + attempts **IN MEMORY** and RETURN the computed `{csd, twi, mode,
     sources}` to the caller. "Read-only" is precise: it **MUST NOT create the NEW canonical `list_progress`
     doc** — but it **MUST PRESERVE today's LEGACY `class_progress` entry-time reconciliation write**
     (`progressService.js:264-271` `[V-P]`: `updateDoc(progressRef,{currentStudyDay:safeCSD,
     totalWordsIntroduced:safeTWI})`). **This is the F4-1 BLOCKER fix:** the completion day-guard reads that
     stored csd as its baseline (`progressService.js:441-448` `[V-P]`: `expectedDay=(current.currentStudyDay||0)+1`).
     If read-only were read as "no write at all," the stored csd would stay stale for the 36 LIVE-STRAND + 6
     divergent + every daily-growing review-only dual-enroll, and `completeSession` would REJECT every
     completion (a permanent loop) — the opposite of the fix. So: legacy class_progress recon write STAYS
     (keeps the day-guard baseline current); only the NEW canonical-doc creation is withheld until P5. Also
     returns quarantine (`{mode:'quarantined'}` blocks study + `list_progress_quarantined` log). This is the
     only mode any client or render path touches before P5.
   - **WRITE-CAPABLE mode (flipped ON as part of P5's migration, §P5):** canonical → hydrate-on-miss
     (unified §8 merge over ALL legacy docs incl. dropped classes, transactional [C4-4]) → create-fresh
     only when NO legacy doc exists.
   **Why the mode-switch is load-bearing (the BLOCKER):** if the resolver hydrated on arbitrary loads
   during P4, canonical docs would be written on random client entries BEFORE P5's audited/backed-up/
   authorized migration — breaking P5's "THE single audited write / reversible / backed-up" guarantee and
   P4's "no data migration yet." Read-only-until-P5 keeps **P5 the sole canonical writer**; post-P5 the
   canonical doc already exists for everyone (migration wrote it), so write-capable mode only ever hydrates
   a genuine straggler (a student the migration skipped), which is rare and still merge-audited.
   Reconciliation semantics unchanged (`db.js:3239-3324` anchor + discriminated statuses `[V-P fn head at
   :3239]`). **Every resolution (both modes) logs `{uid, listId, anchorStatus, applied csd/twi, sources}`**
   — the in-memory read-only computation IS the standing #12 tripwire from P4 on (§6.1).
3. **`resetProgress(listId)`** (I-6 M7): list-wide wipe per persist §5.3 (attempts FIRST, all classes; all
   `session_states/*_{listId}`; legacy docs) + `resetEpoch`/`resetAt` stamp; anchor queries exclude
   pre-epoch attempts. Closes [C3-3b] and makes the P6 owner-delete removal legal.
4. **W1 `submitChallenge`** per PLAN_attempt_write_lockdown (token parity ported EXACTLY from
   `db.js:179-185`, fixtures-tested).
5. **W2 `markReviewComplete` — UPGRADED** (I-6 M6 / I-2 S7): the server marker MUST stamp the day's anchor
   range (`newWordStartIndex`/`newWordEndIndex`) + a PARSEABLE testId, so it satisfies exact-range pairing
   (`db.js:3440-3444` `[V-P]`) and the gradebook parse (C-34). This is the C-14 fix.
6. **M4 anchor validation in SHADOW** inside the already-live server writer (`submitVocabAttempt`/
   `gradeTypedTest` writeContext — F-9: 96% of live attempts are `writtenBy: cloud-function`): assert
   `newWordStartIndex === serverTwi`, `newWordEndIndex === nwsi + introducedCount − 1`,
   `introducedCount ≤ server allocation` (clamped to `wordsRemaining`; lap-aware later under CYC),
   `studyDay === serverCsd + 1`; LOG-ONLY `anchor_rejected` — never arm a rejection path without measuring
   what it would have rejected (the G1 lesson).
7. **Nonce F2 (server leg, I-5 §2):** grade-only return adds `attemptDocId: bindCtx?.attemptDocId ?? null`
   (today omitted at `functions/index.js:1051-1052`, I-5-verified) + include it in the cached grading-job
   payload so recovery paths return it.
8. Delivers `exports.version` live (G2 becomes assertable) and — unavoidably — activates
   `GRADE_JOB_ENABLED=true` as a new live path: deliberate, smoked immediately per the I-5 G1 table.
9. **The THIRD twi writer's day-advance must move server-side HERE (v3 F5-HIGH-2 fix — pulled forward from
   P10).** `reviewChallenge`'s challenge-accept day-advance hard-codes the class_progress doc
   (`db.js:2790-2791` `[V-P]`: `progressDocId = ${attemptData.classId}_${listId}`), guards on
   `progressSnap.exists()` (`:2794` `[V-P]`), and writes `currentStudyDay+1` + `totalWordsIntroduced +=
   newWordCount` (`:2831-2833` `[V-P]`). If it stayed client-side, post-P5 it would write the DEAD legacy
   `class_progress` doc (nothing reads it), and post-P7 (docs deleted) its `exists()` guard would silently
   no-op → **teacher challenge-accepts stop advancing students**. So the day-advance write-target migration
   is NOT deferrable to P10: build a server path (fold the day-advance into `completeSession`, or a small
   `advanceForChallenge` callable) that writes the SAME record the foundation owns, and route it at P4/P5
   (below). It also inherits M4's clamp — closing the I-6 §3-row-8 UNCLAMPED defect (`db.js:2831-2833` adds
   `round(pace·(1−interv))` with NO `wordsRemaining` clamp `[V-P]`) and the review-pass `nwei:null→twi=1`
   hazard, by gating twi derivation to `phase==='new'`. **P10 still owns** the FULL `reviewChallenge`→server
   migration + rules narrowing + the C-19 authz union; only the twi-write-target moves now.

**⚠️ This phase DOES change one live path (v2 HIGH-4 correction — the v1 "no live path changes" claim was
FALSE).** `GRADE_JOB_ENABLED = true` in HEAD (`functions/index.js:90` `[V-P]`) is consumed by
`gradeTypedTest` (`:973` `gradeJob.enabled = GRADE_JOB_ENABLED && !!jobAttemptDocId` `[V-P]`) and
`getGradingStatus` (`:1459` `if (!GRADE_JOB_ENABLED) return {status:"absent"}` `[V-P]`) — so the FIRST
functions deploy activates the grading-job claim/recover/status path for all cohorts. This is DELIBERATE
(I-5 G1 marks it a deliberate activation; the recovery slice was Codex-reviewed ×3, change_action_log
2026-06-28). **Do NOT set `GRADE_JOB_ENABLED=false`** — the deploy VALIDATES it, it does not suppress it.
The other new callables (completeSession/resolveListProgress/resetProgress/W1/W2) stay behind flags with no
client routing; M4 is shadow-only. So the precise statement is: **one intended live-path activation
(grading-job), everything else dormant.**

**Ship/Test/Revert.** Independently shippable: the progress/challenge surface is behind server flags /
unused callables (no client routes yet); the grading-job path is the one intended activation. Testable:
25WT sandbox E2E (day-guard rebuild, review-only derivation DIFF-CHECKED against the client predicate
`studyService.js:1329-1335` on live-shaped fixtures); shadow-mode soak; **the FULL grading-job recovery
suite** (reuse `dsg-edits/srv_validate/grading_job_tests.mjs` — 7 transition tests, change_action_log
2026-06-28): claim, lost-response recovery, stale-lease/fencing, `getGradingStatus` behavior, plus a live
typed smoke. Reversible: server flags off → callables idle; grading-job rollback is the documented
`GRADE_JOB_ENABLED` flip (`:1457-1461` comment: "flipping the flag off is a TRUE byte-for-byte rollback").

**Flags/data.** Server-side flags only; client `featureFlags.js` untouched. No data migration (the resolver
is READ-ONLY this phase — see change 2). GRADE_JOB_ENABLED stays true (validated, not flipped).
**Acceptance.** Sandbox E2E green; **the 7-transition grading-job recovery suite green + a live typed
smoke** (v2 HIGH-4); **the W2-upgraded marker's OUTPUT SHAPE asserted** (v2 MED-6): a parseable `testId` +
integer `newWordStartIndex`/`newWordEndIndex` == the day's anchor, `getReviewForDay` (`db.js:3438-3444`
`[V-P]`) PAIRS it, and it is gradebook-visible (survives the `db.js:1962-1977` testId parse `[V-P]`) —
this asserts the C-14/C-34 fix at the gate, since today's `markReviewComplete` (`functions/index.js:580-597`
`[V-P]`) writes none of those fields; **M4 shadow false-reject rate ≈ 0 over ≥14 days of live traffic**;
version probe answers and matches HEAD; F-9-style read confirms `correctnessSource` stays null
(ENFORCED still false); G5 watch clean (`attempt_write_failed_client` permission-denied alert).
**Deploy gate.** THE FULL I-5 CHECKLIST, hard: G0 · G1 table (ENFORCED=false — flipped at P0 — or NO-GO) ·
G2 post-deploy version assert (bootstrap: out-of-band F-9 read) · G3 stamp regenerated · G4 sweeps ·
G5 watch. Target: `--only functions`. **This is the deploy the G1 landmine was waiting for; P0 is why it
is safe.**
**Dissolves (once traffic arrives at P4):** C-14/C-34 marker class; X1 (by construction — M5 lives inside
the only completion writer that survives the P6 cutoff); [C3-2]/[C3-3b] races; the 06-29 nonce class
(with P4's client legs).
**Non-regression.** The ONE live-path change is the intended grading-job activation, guarded by its own
recovery suite + a byte-for-byte flag rollback (above) — the typed grade→save contract is unchanged
(ENFORCED stays false, so tokens/verdicts are untouched). The progress/challenge surface changes no live
path (flags off, resolver read-only). The server `reviewOnlyDay` derivation is spec-pinned to the shipped
client predicate (diff-check is the acceptance); TWI clamp reproduced server-side as `max(0, …)`; day-guard
semantics preserved-then-strengthened (transactional). Enforcement point moves from client code to the
callable ONLY at P4.

---

### P4 · FND-2 — Client cutover build (hosting-only)

**Goal.** Route live traffic to the server surface; old bundles remain legal (rules unchanged during soak).

**Changes.**
- Flag flips in `featureFlags.js`: `SERVER_CHALLENGE_WRITE` (:20) → true, `SERVER_REVIEW_MARKER` (:28) →
  true `[V-P current values false]`; NEW `SERVER_PROGRESS_WRITE` routing
  `recordSessionCompletion`→`completeSession`; `LIST_PROGRESS_PERSIST` routes all progress reads/hydration
  through the **READ-ONLY** `resolveListProgress` (P3 change 2): render AND session-entry paths read the
  canonical doc if it exists, else consume the resolver's IN-MEMORY reconciliation — **nothing writes a
  canonical `list_progress` doc in this phase** (persist §5.2 read contract, hardened: even the write paths
  read-only-resolve until P5 flips the resolver). This is what keeps "no data migration yet" TRUE (v2
  BLOCKER fix): completion still writes csd/twi to the LEGACY `class_progress` doc via `completeSession`
  until P5, exactly as today's model does — P5 is the first and only canonical writer.
- **SERVER_RESET_PROGRESS route (v2 HIGH-3 — hard P4 requirement).** Today reset is a CLIENT batch-delete of
  attempts: `resetStudentProgress` (`db.js:2886` `[V-P]`) queries `where studentId + where classId` and
  client-`batch.delete`s attempts (`db.js:2958-2995` region `[V-P]`), legal via `firestore.rules:120-122`
  `allow delete: if resource.data.studentId == request.auth.uid` `[V-P]`. P6 REMOVES that owner-delete
  branch — so **every reset caller MUST be routed to P3's `resetProgress` callable in THIS phase, or P6
  breaks reset.** Add flag `SERVER_RESET_PROGRESS` → true; migrate every reset UI + support entry point off
  the client-delete path; grep the bundle to prove no live client path calls the client attempt-delete.
  (persist [C5-5]: reset-server-move and owner-delete-removal must ship together — this is the client half.)
- **Route the teacher READ path to the resolver (v3 F6-2 fix).** The plan's v2 migrated only the STUDENT
  read path; the teacher "Students" view reads class_progress DIRECTLY —
  `fetchStudentsProgressForClass` (`progressService.js:518` `[V-P]`) is called from `ClassDetail.jsx:198`
  `[V-P]`. Route it through the READ-ONLY `resolveListProgress` too, or the teacher dashboard freezes at P5
  (canonical exists, class_progress goes stale) and BREAKS at P7 (class_progress deleted). Add to the
  bundle-grep acceptance: zero direct `getClassProgress`/class_progress readers on the teacher surface.
- **Route the 3rd twi writer (reviewChallenge day-advance) to the server path built in P3 change 9
  (v3 F5-HIGH-2).** Under `SERVER_CHALLENGE_WRITE=true` the challenge write already moves to W1; the
  day-advance leg (`db.js:2790-2833`) must call the server `advanceForChallenge`/`completeSession` path so
  it writes the record the foundation owns (legacy pre-P5, canonical post-P5), never the client-hardcoded
  class_progress doc.
- **Runtime reviewOnlyDay mismatch LOG, not just the one-time diff-check (v3 MED).** The client predicate
  (`studyService.js:1329-1335`) survives as UX preview while the server derives authoritatively; a persistent
  fork could diverge silently. Emit a `reviewonly_derivation_mismatch` system event whenever the client
  preview disagrees with the server verdict at completion — a standing tripwire, not just the P3 fixture diff.
- The persist plan's `permission-denied` completion handler + `legacy_write_denied` system event ship HERE
  and activate at the P6 cutoff ([C6-2]: today both test pages swallow completion errors).
- **Nonce F1 + F3 (client legs, I-5 §2):** F1 — delete the second identity derivation
  (`TypedTest.jsx:869-870` `[V-P]`), reuse the `:767` `gradeAttemptDocId` `[V-P]` (mirrors MCQTest's
  single derivation `MCQTest.jsx:601-602` `[V-P]`); prefer the server-echoed id from P3's F2
  (`context.attemptDocId = gradingResult.data?.attemptDocId ?? attemptDocId`, divergence logged). F3 —
  rewrite `getOrCreateAttemptNonce` (`testRecovery.js:98-111` `[V-P]`: today the catch mints a FRESH
  per-call nonce) as the layered memoized store (module Map → localStorage → sessionStorage; catch
  memoizes, never re-mints). F4 — `nonce_storage_degraded` client event.
- **Client build stamp** (the P0-filed work): commit sha baked into the bundle + surfaced via a probe —
  closes the hosting-provenance gap (I-5 G3).
- **Dashboard panel C consumes the reconciled resolver read** — retires the `impossible_phase_detected`
  Dashboard-emitter noise (emitter at `Dashboard.jsx:1461-1464` on raw un-reconciled csd `[V-P]`; I-2 §2:
  531 real states, Dashboard-only emitter).

**Ship/Test/Revert.** Shippable: hosting-only; callables already soaked (P3). Testable: bundle greps
(persist §6 P2 regexes — zero direct progress writes on the new path **AND zero live client attempt-delete
calls**, v2 HIGH-3) + persist §9 personas (move / dual-enroll / reset / hydration / quarantine /
stale-session) + a **reset-via-callable persona** (reset still works through `resetProgress`, no client
delete) + storage-stubbed nonce run (Storage getItem/setItem throw → typed grade→save round-trip keeps ONE
docId). Reversible: flags off + rebuild; callables keep working idle; rules unchanged so old bundles are
still legal.

**Flags/data.** Client flags flip (incl. `SERVER_RESET_PROGRESS`); NO rules change; NO canonical
`list_progress` write (resolver read-only) → NO data migration yet.
**Acceptance.** Personas green (incl. reset-via-callable + a teacher-Students-view persona reading via the
resolver + a challenge-accept persona whose day-advance writes the foundation record, not class_progress);
greps clean (no direct progress write, no client attempt-delete, no direct class_progress reader on student
OR teacher surface); C-14 path verified fixed in sandbox (mid-session all-mastered day → server marker with
real range + parseable testId → pairs + appears in gradebook); resolver writes ZERO canonical docs on any
load (assert `list_progress` collection stays empty until P5); F-4 stable (no expected motion — same
semantics, new authority); `impossible_phase` Dashboard emissions drop to ≈ 0 for updated clients.
**Deploy gate.** G0 · G3 (build stamp NOW live — first provenance-verifiable hosting deploy) · G4 · G5.
Target: `--only hosting`.
**Dissolves.** C-14/C-34 (S7 marker), the nonce mechanism (C-32's root — though re-arm still waits for F5
acceptance), I-2 §2 noise, C-25-adjacent (fold the `newWordsTestPassed` derivation fix —
`studyService.js:1374-1377` `[V-P]` persists `newWordScore >= threshold`, not the authoritative flag —
into `completeSession`'s summary).
**Non-regression.** The #11 semantics now execute server-side but the CLIENT predicate stays as UX preview
(I-6 M5); flag-off path remains byte-equivalent (Run-L discipline); invariants unchanged (enforcement
point: `completeSession` transaction + still-live client clamps until P6). LIST_SCOPED_RECON invariants
re-verified via the P3 diff-check before this ships.

---

### P5 · FND-3 — THE data migration (one-time, David-authorized CS event)

**Goal.** Collapse every `users/{uid}/class_progress/{classId}_{listId}` into ONE
`users/{uid}/list_progress/{listId}` per (student, list) — the last consolidation, after which there is no
second doc to re-split (이주헌 OCzwBwAb re-split AFTER his 06-30 consolidation — the condition RECURS
structurally; `scan_F3_dualenroll.json` / CONSOLIDATED C-01).

**Rule (I-6 §2.1 = persist §8, adopted verbatim):** TWI = anchor-validated max (anchorless/forged highs
quarantine, never zero, never auto-promote); **CSD = max PLAUSIBLE across EVERY source doc** [C4-1];
ancillary from the max-twi winner; `programStartDate = min()`; `migratedAt` stamps; full backups.

**THE MANDATORY AMENDMENT (I-6 §7.1 — the migration's named invariant-at-risk).** From the moment P1 (RO)
deploys, 183+ students legitimately accrue anchor-less csd growth DAILY; the [C4-2] CSD plausibility screen
written against the 07-04 assumptions would quarantine-flag or DEMOTE exactly the students RO unfroze. The
screen MUST count post-anchor review activity as legitimizing csd−anchorDay gaps — but the evidence source
matters (v2 HIGH-5 correction):
- **PRIMARY, DURABLE evidence = the count of DISTINCT post-anchor review ATTEMPTS**, keyed by
  `(classId, listId, studyDay)`, with `submittedAt > anchor.submittedAt`, same student+list lineage, capped
  one-per-`studyDay`. Attempts are the permanent ledger — one exists for every review-only completion.
- **SUPPLEMENTAL / current-state only = the `reviewOnlyDay: true` session marker.** It is NOT durable: it is
  written ONLY to `session_states` (ephemeral, OVERWRITTEN each session) and DELIBERATELY not on the durable
  `recentSessions` summary — verified TODAY at `studyService.js:1449` (`[V-P]`: "reviewOnlyDay:true is a
  write-only marker … deliberately not on the summary") and `:1461-1472` (the summary has no such field).
  A student with MANY review-only days carries the marker on only their LATEST session_state → using it as
  primary evidence would UNDERCOUNT and re-quarantine long-recovering students. So it corroborates the
  current day only; it never replaces the attempt count.
- A gap is implausible only if it exceeds (anchorDay + distinct evidenced review-attempt days + slack).
- **Per-doc, own-anchor baseline (v3 MED):** the plausibility screen evaluates each SOURCE doc's CSD against
  THAT doc's OWN anchor-derived day (not the cross-doc max-twi winner's anchor) — bound to the merge rule so
  a slower-pace doc's legitimately higher session count (the [C4-1] pace-80-Day-8 vs pace-20-Day-15 case) is
  not judged implausible against the faster doc's lower anchor day. The CSD that survives is the max-plausible
  across docs, each screened on its own anchor.
- **Dry-run assertion (v2, extended v3):** for every student with N>1 consecutive review-only days, the
  screen must PASS (not quarantine, not demote) on review-attempt evidence alone; AND a cross-pace divergent
  student's higher session count survives its own-anchor screen — assert both explicitly in the `--dry` review.
- Optional (do NOT make P5 depend on it): P1/P3 could start persisting `reviewOnlyDay` into `recentSessions`
  for future durability — but P5's correctness rests on the attempt count, which already exists.

Corollary: the persist plan's Phase-0 numbers (69 collisions / 54 dual, 2026-07-04) are STALE — re-run the
audit and re-parameterize the screen AT migration time (F-3 v2 already shows 141 dual student-lists on
07-13).

**Populations (from `scan_F3_dualenroll.json` / CENSUS2 F-3):** 36 LIVE-STRAND → TWI jumps to the
cross-class anchor (this IS the manual carry-forward, automated); 6 divergent → [C4-1] exactly (fast doc
wins twi, slow doc's day count survives via max-plausible CSD); 72 stale-2nd-enroll → latent re-strand
path becomes unrepresentable; 22 + 5 benign → trivial collapse; ~633 single-doc → 1:1 re-key, byte-diff
except path + dropped fields.

**Procedure (X5 discipline, I-6 §2.3):** fresh Phase-0-style audit → backups
(`dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json`) → `--dry` → full per-student diff
review → **David authorizes** (SUPPORT_RUNBOOK CS entry + change_action_log row) → **the eager migration
script writes ALL canonical `list_progress` docs — it is the SINGLE audited canonical writer** → **flip
`resolveListProgress` to WRITE-CAPABLE mode** (P3 change 2: post-migration, canonical exists for everyone,
so write-capable only ever hydrates a genuine straggler) → sweep + census2 re-run. 25WT full rehearsal
FIRST (idempotent re-run + a flag-off-client post-migration write → catch-up merge). Quarantine
precondition [C7-2]: 26SM set already clean (persist Phase-0); the 70 EXT-cohort items need David's scope
decision (§7.2). **Ordering note (v2 BLOCKER):** the resolver stays READ-ONLY through P4 precisely so that
no canonical doc exists until this script writes it — the write-capable flip is PART OF the migration, not
before it.

**The `completeSession` write-target FLIP (v3 F4-4 — was unstated).** Through P4, `completeSession` writes
csd/twi to the LEGACY `class_progress` doc (§P4). P5 must flip its durable write-target to the canonical
`list_progress` doc — this is a THIRD state change bundled into the migration cutover (alongside the eager
script + the resolver flip), and all three flip together: (script writes canonical) → (`completeSession`
targets canonical) → (`resolveListProgress` write-capable). Spec it as one server-flag transition
(`LIST_PROGRESS_CANONICAL`), applied atomically after the script commits, so no completion is ever split
across the two doc shapes.

**Operational window (v3 F4-4 / F6-1 / F6-9 — the riskiest live event).** The migration is the single most
dangerous live moment: 26SM peaks at class hours and in-flight sessions are dropped/rebuilt. Required:
- **OFF-PEAK execution window** (outside 26SM class hours) — a scheduled, announced maintenance moment, not
  an arbitrary run.
- **WATCH window** post-flip: monitor `day_guard_rejected`, `list_progress_quarantined`, completion-error
  and `legacy_write_denied` counts for the first hours; staged rollback ready (restore backups + revert the
  three flags).
- **POST-FLIP catch-up pass:** completions that landed on a LEGACY doc during the script run (a student
  racing the migration) must be merged into the canonical doc — a delta pass keyed on
  `class_progress.lastSessionAt > migratedAt` (persist §8 catch-up), run before the watch window closes.

**Reversibility — honest (v3 F4-4).** The plan's "reversible until P7 deletes legacy docs" is OVERSTATED:
the true point-of-no-return is the FIRST post-flip completion (it writes canonical and advances the student
under the new model). Before any post-flip completion, restore-from-backup is clean; after, rollback means
restore-backups PLUS replay/reconcile the post-flip completions. State this: P5 is atomically reversible only
in the pre-first-completion window (minutes); thereafter rollback is a reconcile, not a restore. This is WHY
the off-peak window + immediate watch matter.

**CS toolchain rework — scheduled INTO P5/P7 (v3 F6-3).** `scripts/cs/data-integrity-sweep.mjs`,
`manual-pass.mjs`, and `deepfix-census*.mjs` are class_progress-shaped. Post-P5 the sweep would report
FALSE-CLEAN (reading an empty/stale legacy collection) and `manual-pass.mjs` would write the DEAD
collection. Since X5 (census-before/after) is the acceptance instrument for THIS very migration, the sweep +
census must target `list_progress` BEFORE the flip is verified (they run the before/after here), and
`manual-pass.mjs` must write canonical anchors from P5 on. Schedule: sweep/census rework lands with the P5
script; `manual-pass.mjs` rework lands with P5 (it is the CS override primitive until P10's callable).

**Ship/Test/Revert.** Shippable: a standalone Admin-SDK script + the three-flag cutover, run in the off-peak
window; app behavior unchanged for reads (P4 clients already read via the resolver, which prefers canonical).
Testable: dry-run diff + 25WT rehearsal + the post-flip watch window. Reversible: **cleanly only in the
pre-first-post-flip-completion window** (restore backups); after the first post-flip completion, rollback is
a reconcile (backups + replay post-flip completions), not a restore — legacy docs are RETAINED until P7 to
enable it; re-runnable via `migratedAt` stamps (v3 F4-4 honest reversibility).
**Acceptance (hard asserts).** 0 twi regressions, 0 csd regressions for every student; **every student with
N>1 consecutive review-only days passes the CSD screen on review-attempt evidence alone** (v2 HIGH-5);
dual-enroll signature = 0; `invalidAnchor` ≈ 0; **F-3 re-scan: LIVE-STRAND = 0, divergent = 0**; **F-4
re-run: the 42 live-carry students leave B; P-students' patched values SURVIVE (manual-pass.mjs writes valid
anchors → the anchor-validated max keeps them); NOBODY moves H→B**; the migration script is the ONLY writer
that created a canonical doc (resolver wrote none pre-flip).
**Deploy gate.** No app deploy; G4 (sweep before/after) + the CS-event authorization chain.
**Dissolves.** CR-1 wholesale: C-01 (#6), C-02 (#12 — see §6.1), C-03 (Kaila phantom: one doc → nothing to
reconcile a phantom against), C-04 residue, C-05 semantics substrate, C-06 (98 dual-enroll students).
**Non-regression.** The merge rule ENFORCES the invariants (TWI anchor-validated max = monotonic;
CSD max-plausible = non-demoting; anchor identity is the merge's twi filter); migration aborts a
student+list on any anchor query-error (errored lookups move nothing). Migration-day UX: the 36
LIVE-STRAND see a forward jump — comms decision §7.3; in-flight `session_states` dropped/rebuilt
(persist §7.5).

---

### P6 · FND-4 — THE cutoff: ONE rules deploy

**Goal.** Client write-authority over progress, attempts, and role ends in a single, fully-reversible
rules deploy.

**Changes (`firestore.rules`, one deploy).**
(a) **Users wildcard restructured** [C5-4]: the broad `match /{subcollection}/{docId}` owner+teacher write
(`firestore.rules:45-48` `[V-P]`) conditioned to EXCLUDE `list_progress` and `class_progress` from client
writes (the teacher branch survives for `reviewChallenge` only — per the in-file TODO `:39-44` `[V-P]` —
until P10 narrows it).
(b) **M8 role whitelist — SPLIT BY OP (v2 HIGH-2).** A blanket `allow write` +
`!diff().affectedKeys().hasAny(['role'])` would BREAK user creation: the user-create writer stamps
`role: docOverrides.role ?? 'student'` (`db.js:221` `[V-P]`) via `setDoc(..., {merge:true})` (`db.js:233`
`[V-P]`) — on a create the diff is against a non-existent doc and the role key is always "affected." Split
the `users/{uid}` rules by operation:
- **`allow create`:** owner may create only if `request.resource.data.role == 'student'` (or the field is
  absent and the default fills it) — a self-created `role:'teacher'` doc is DENIED.
- **`allow update`:** owner may update only if `affectedKeys()` excludes `role` (and any other server-owned
  field) — self-escalation via update DENIED; ordinary profile updates pass.
- **Role changes to teacher/admin** go through a callable / admin path only (not client-writable at all).
Minimum only; the FULL role mechanism (custom claim vs whitelist-forever) is I-7's decision (§7.4).
Rules-tests REQUIRED: student-create OK · profile-update OK · role-escalation-UPDATE DENIED ·
role='teacher'-CREATE DENIED · legit teacher provisioning via the admin/callable path ALLOWED.
**⚠️ The teacher-PROVISIONING path must ship WITH P6 — it cannot defer to P10 (v3 F4-3).** The LIVE signup
flow lets a user SELF-SELECT Teacher: `Signup.jsx:141-144` renders a Teacher radio (`value="teacher"`
`[V-P]`) whose value flows to `role: formState.role` at account creation (`Signup.jsx:38` `[V-P]`). The
moment (b)'s `create` rule denies non-student roles, that signup path BREAKS unless the same release either
(i) provides a real teacher-provisioning path (admin-approved / invite-code / callable that sets the role
server-side) OR (ii) changes the signup flow to create students-only + a separate provisioning step. This is
a NET SECURITY WIN, not just a migration cost: the self-select Teacher radio IS the C-28/#1b hole (anyone
can self-promote at signup today), so closing it and replacing it with a provisioned path fixes the
vulnerability and unblocks the rule in one move. Add a signup persona to the P6 test set: self-select-teacher
signup is DENIED/removed; the provisioning path yields a legitimate teacher.
(c) **W3 attempts block** (`:101-118` `[V-P]`): `create: false`; the student `answers`-update branch
(`:114-116`) removed (W1 callable is live); **owner delete REMOVED (the branch at `firestore.rules:120-122`
`[V-P]`) — this supersedes the staged W3 doc's "delete unchanged" line (`W3_attempts_lockdown.rules.md:40-43`
`[V-P]`)** — legal ONLY because P3's server `resetProgress` ships in the same program (persist [C5-5]: the
two must ship together). Client attempt-delete is also the anchor-erasure half of the x/plan §3g forgery
(delete attempts → `hasValidData=false` → `safeTWI = max(forged storedTWI, …)` `progressService.js:236`
`[V-P]`) — it closes HERE.
(d) **M4 shadow → ENFORCE** (server-side flag flip; clamp-or-reject + `anchor_rejected` with uid).

**Preconditions (ALL, hard).** X1: M5 live + validated (constructional — P3→P6 dependency — but re-assert
at the gate); **reset fully cut over to `resetProgress` (v2 HIGH-3): `SERVER_RESET_PROGRESS` live since P4,
bundle grep proves zero live client attempt-delete calls** — otherwise removing owner-delete (c) breaks
reset; 14-day no-legacy-write window + build-version census [C8-1] (P4's stamp makes this real); bundle
greps clean; 26SM quarantine = 0 [C7-2]; M4 shadow clean (≈0 false rejects); W3 doc checklist.

**Ship/Test/Revert.** Shippable: rules-only deploy (`--only firestore:rules`; NOTHING rides along —
explicitly not functions). Testable: the rules-test matrix — forged attempt create / answers update /
progress write DENIED; the M8 role matrix (student-create OK, profile-update OK, role-escalation-update
DENIED, role='teacher'-create DENIED, admin/callable provisioning ALLOWED — v2 HIGH-2); a **signup persona
(v3 F4-3): self-select-teacher signup DENIED/removed, the provisioning path yields a legitimate teacher**;
a **rules-denied-reset persona proving reset still works via the `resetProgress` callable** (v2 HIGH-3);
happy paths (server writes, owner reads, teacher `reviewChallenge`) PASS. Reversible: restore the prior rules
blocks (fast, per the W3 doc) — **full reversibility holds ONLY until P7 deletes legacy docs**, which is why
P7 waits ≥14 days.

**Flags/data.** No client flags; no data.
**Acceptance.** Rules matrix green; `legacy_write_denied` ≈ 0 with the accepted dormant-tab residual
([C8-1]: one false-success completion, integrity carried by the rules, recovery = reload); F-4 stable;
`anchor_rejected` (now enforcing) stays ≈ 0.
**Deploy gate.** G0 · the precondition list above · G4 · G5. Target: `--only firestore:rules`.
**Dissolves.** CR-6: C-28 (#1b role self-promotion), C-29 (#1c create/launder — student vector), C-31
(the `safeTWI` forgery hole — starved of both inputs: rules deny the forged storedTWI, delete-removal
denies the anchor-strip), C-08 (reset now real, server-side, epoch-tombstoned). Unblocks CYC (X3) and OVR.
**Non-regression.** The invariants' enforcement point becomes rules + callables (the §5 matrix's "new
enforcement point" column goes live). Old bundles: legal until this deploy, denied after — the P4 handler
turns denial into a reload prompt instead of a silent swallow.

---

### P7 · FND-5 — Retire legacy (≥14 days after P6)

**Goal.** Delete what the cutoff made dead, so the next reader of this codebase cannot resurrect it.

**Changes.** Catch-up merge (ancillary deltas, transactional [C4-3]) → delete `class_progress` docs →
delete dead code, per a **RETIREMENT INVENTORY (v3 MED — enumerate, don't sweep):**
- Dead writers/branches: legacy client submits (`db.js:1158/:1276` regions per lockdown plan §1), the client
  automarker leg (`DailySessionFlow.jsx:964-1008` `[V-P]`), the flag-OFF negative-TWI passthrough
  (`studyService.js:1342` `[V-P]` — I-2 finding 5), the UNREACHABLE duplicate resume branch
  `DailySessionFlow.jsx:800-816` `[V-P — confirmed still present today]` (I-2 finding 4: LIVE branch is
  `:590-623`; review-only plan §5 cites the dead copy at `:807-812` — delete, don't modify), and the
  now-dead client `reviewChallenge` day-advance to class_progress (`db.js:2790-2833` — routed server-side
  at P4, F5-HIGH-2).
- **Flag lifecycle:** retire the transitional flags in order — `LIST_SCOPED_RECON`, `LIST_PROGRESS_PERSIST`,
  `SERVER_PROGRESS_WRITE`, `SERVER_RESET_PROGRESS`, `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER`,
  `LIST_PROGRESS_CANONICAL` (~7–8 flags) once their both-sides paths are gone; delete the LEGACY invariant
  tests WITH their flag. Do NOT orphan `CONTINUATION_LINKS` (P8) — it stays live (feature flag, not
  transitional).
- **Zero-class_progress-refs acceptance:** grep the whole tree (src + functions + scripts/cs) for any
  remaining `class_progress` reader OR writer — must be ZERO before the doc deletion, covering BOTH the
  student and teacher read paths (F6-2) and the reworked CS toolchain (F6-3).
**Ship/Test/Revert.** Shippable: cleanup build + one-time deletion script. Testable: the zero-refs grep +
LEGACY invariant tests removed WITH the flags + sweep (now list_progress-shaped, F6-3). Reversible: NOT for
deleted docs (backups only) — hence the 14-day wait and the [C8-1] window.
**Acceptance.** Zero class_progress readers/writers tree-wide (student + teacher + CS toolchain); sweep clean
(against list_progress); zero `legacy_write_denied` for 7 consecutive days pre-deletion; F-4 stable.
**Deploy gate.** G0 · G4 · CS-event authorization for the deletion. Targets: `--only hosting` + script.
**Dissolves.** The residual attack/confusion surface of CR-1/CR-6 (dead writers, dead branch, the S7
client marker).

---

### P8 · CONT-A — List linking + choice terminal + continuous advance (forward design, part 1)

**Goal.** David's feature request items 1–3 minus start-over: an explicit per-class list SEQUENCE, a
list-end terminal that OFFERS the continuation, and a continuous no-TA advance — replacing the
manual-advance treadmill (87 batch-advanced + 63 still pending, SESSION_CONTEXT §4) and the C-13 re-wall
loop. Buildable immediately after P1 (RO); full design in §2.

**Expectation-setting (v3 F6-4).** David told TAs "start over ships tonight" (07-13). "Start over" =
CYCLING = P9, which is HARD-GATED behind the foundation (~the P0→P6 sequence). So the honest split to
communicate: **advance-to-next-list (CONT-A, THIS phase) ships FAST post-RO with NO foundation gate** and
covers the large majority of finishers (anyone with a next list in sequence); **start-over/cycling (P9) is
the multi-week item.** For the **5 finished-everything students** (함지민†/Soul Kim/유찬†/이가온/Young Cho,
SESSION_CONTEXT §4) who have NO next list to advance to, CONT-A does not help — they need either an interim
review-loop assignment or the manual-test bridge until P9. This is a David-comms + expectations item, flagged
in §7 decision 9; it is NOT a plan defect, but the plan must not let the "tonight" framing imply P9 is near.

**Changes (client + teacher-config; no functions, no rules).**
- **Schema:** `nextListId` (nullable) on `classes/{classId}.assignments[listId]` — written at the existing
  assignment-settings write site (`db.js:796-819` `[V-P]` — the same update block that owns
  pace/testSizeNew/thresholds), owner-teacher-only like every other assignment prop.
- **Teacher UI:** ClassDetail assignment editor gains "next list" (an ordered-sequence affordance over the
  class's assigned lists).
- **Choice terminal:** the P1 finished terminal (`DailySessionFlow.jsx:822-835` CompletePhase +
  `Dashboard.jsx:1562-1565` hero `[V-P]`) gains "Advance to {nextList} →" when the launching class's
  assignment has `nextListId`. "Start over" appears ONLY once CYC is live (capability-gated rendering —
  never offer a dead button).
- **Focus-yield (C-13 fix) — MUST handle the explicit-PIN branch, not just recency (v3 F6-5).** The v2 plan
  cited only the recency branch (`Dashboard.jsx:1084-1108`), but `getPrimaryFocus` returns from the
  explicit-pin branch FIRST: `if (userSettings?.primaryFocusListId)` at `Dashboard.jsx:1057` returns
  `buildFocus(savedClass, savedList)` at `:1064` (and the legacy list-only fallback `:1072-1078`) BEFORE
  reaching recency `[V-P]`. The ~287 CS-pinned students (the exact C-13 population that batch-advance pinned)
  would therefore NEVER auto-advance if the yield lived only in the recency branch. Fix: the pin branch must
  yield a pinned FINISHED list (`twi ≥ listTotal`) to its `nextListId` — either by resolving focus to the
  next list when the pinned one is finished, or by advancing/clearing the stale pin (`primaryFocusListId`/
  `primaryFocusClassId`) to the next list. **And make the `twi ≥ listTotal` finished-test lap-aware for P9**
  (under cycling twi climbs past listTotal, so a raw `twi ≥ listTotal` would misfire every lap — gate the
  yield on non-cycling or on lap-boundary semantics).
- **Continuous start:** "Advance" launches the next list through the EXISTING session-init path
  (`initializeDailySession` consumes `assignmentSettings` — `studyService.js:156` `[V-P]`); the next list's
  progress record is created by the existing create-on-miss flow. NO new write path, NO twi manipulation.
- **Data:** back-fill `nextListId` for the conventional Base→Ascent→Summit sequences = one David-authorized
  config CS event (the durable replacement for `batch-advance-listend.mjs`).

**Why this half is safe BEFORE the foundation (the argument, for adversarial review):** cycling is gated
(X3) because cap removal re-activates twi forgery on the SAME list (x/plan §0/§3g). CONT-A removes no cap
and touches no twi writer: advancing to a DIFFERENT list starts that list's progress at its own position
via the unchanged create path; the linking field is teacher-authored policy config at the same trust level
as `pace`/`testSizeNew` (same rules surface, same write site). Residual accepted: pre-P5, advancing creates
one more class-keyed doc — which P5 re-keys 1:1 like every other single-doc row. Dual-enroll nuance: the
terminal and focus-yield key off the LAUNCHING class's assignment, so two classes may link differently —
consistent with class=policy (N1); flagged for impl review (§8 uncertainty e).

**Ship/Test/Revert.** Shippable: hosting-only, behind flag `CONTINUATION_LINKS` (default off) +
per-assignment `nextListId` (absent = today's behavior exactly). Testable: sandbox persona (finish list →
terminal offers advance → next list Day 1 continuous; dual-enroll variant). Reversible: flag off / unset
`nextListId` — students fall back to the P1 static terminal (never to the pre-P1 wall).
**Acceptance.** The 63-pending manual-advance population (`next-list-by-class_2026-07-13.md`) drains
without TA writes; **a CS-PINNED finished student (the ~287 population) auto-advances via the pin branch, not
just recency-ranked students** (v3 F6-5); F-12-style count of finished-focus students with a link who
advanced unaided; sweep clean; F-4: finished students stop re-entering B via the C-13 loop.
**Deploy gate.** G0 · G3 · G4 · G5. Target: `--only hosting` (+ the config CS event).
**Dissolves.** C-12 (linking), C-13 (focus/re-wall), the advance half of C-11; the manual-advance
treadmill (SUPPORT_RUNBOOK batch-advance class of events).
**Non-regression.** Zero contact with completion/reconciliation paths; the #11 predicate/clamp/gate are
untouched (enforcement point: same client code P1 shipped, then `completeSession` after P4).

---

### P9 · CYC — Start-over / cycling capstone (forward design, part 2) — HARD GATE: P6 live

**Goal.** David's "start over" choice: per-student lap cycling on a finished list, per x/plan v5 —
monotonic VIRTUAL index (twi never resets; physical word = `positions[i mod cycleLength]`), accept-reset
study_state, lap-aware display.

**Changes (x/plan §4 touch-list, adopted):** allocation cap removal under `cyclingEnabled` + non-cycling
clamp ≥0 (`studyService.js:234-235` region); `resolveVirtualRange` + the §3c consumer inventory
(getNewWords, segment materialization, lap-bounded `getUnmasteredPool`/`getFailedFromPreviousNewWords`,
PDF helpers, blindSpot, displays); lap rollover replacing the legacy dead-end; per-assignment
`cyclingEnabled` flag (owner-teacher-only) + the §3b unlock rule; **M4's server anchor validation goes
lap-aware in the same release** (P3's `introducedCount ≤ wordsRemaining` clamp must become
lap-modular or it would reject every lap-2 day — a NEW integration point this plan adds to x/plan's list);
the choice terminal (P8) now renders "Start over".
**Why gated:** cap removal removes the only clamp that made forgery self-defeating (x/plan §0); safe ONLY
under server-owned twi + validated anchors + no owner attempt-delete = exactly P6. Flag stays OFF until P6
acceptance is green.
**Ship/Test/Revert.** Shippable: behind `cyclingEnabled` (default off — zero change off). Testable:
x/plan §6 + **PLAN_review_only §7 re-verification (review-only × laps — do NOT inherit the "zero recon
change" claim for a combination it never saw)**. Reversible: flag off → mid-lap students re-dead-end at
the lap boundary into the P8 terminal (no corruption; strictly better than pre-P1).
**Acceptance.** Lap-2 personas green (rollover, straddle day, review pool lap-bounded, display); F-12
population studying laps; sweep with lap-aware expectations; `anchor_rejected` stays ≈0 with lap-aware M4.
**Deploy gate.** G0–G5; functions leg (lap-aware M4) is a functions deploy → full P3-class gate.
Targets: `--only hosting` + `--only functions`.
**Dissolves.** C-11 (start-over half); the 5 finished-everything students (SESSION_CONTEXT §4).
**Open product decisions:** §7.6 (interventionLevel across laps; rollover ack prominence).

---

### P10 · OVR — Teacher override + challenge redesign (I-7) — gates: P6 + the C-28 full role decision

**Goal.** No deterministic grader miss is a dead-end (N4); permission follows the (student, list/attempt),
not the write-time stamp (I-10).

**Changes.**
- **Override callable:** server-authorized teacher grade-override that mirrors `manual-pass.mjs`'s
  valid-anchor write (sets `newWordStartIndex`/`newWordEndIndex`/`wordsIntroduced`/`testId` — the CLAUDE.md
  anchor rule, now a server primitive), audit-logged, authz = the I-10 §6 UNION: `attempt.teacherId` (stamp,
  `db.js:1194-1204` `[V-P]`) ∪ current-enrollment ownership (the `renameStudent` pattern,
  `functions/index.js:1847-1875` — I-10-verified). Under the P5 model it writes to the (student, list)
  record — dissolving I-10 §5's "accepted challenge unlocks the OLD class's docs" mis-landing
  (`db.js:2791-2836`).
- **`reviewChallenge` → server** (the rules TODO's own prescription, `firestore.rules:39-44` `[V-P]`),
  fixing BOTH I-6 §3-row-8 defects in the same move: the challenge-accept twi writer is UNCLAMPED
  (`db.js:2827-2833` `[V-P]`: `newWordCount = round(pace·(1−interv))` added to twi with NO `wordsRemaining`
  clamp) and must gate twi derivation to `phase === 'new'` (a review-pass `nwei:null → twi=1` hazard,
  x/plan §3g).
- **Read-surface leg (C-19/P1+P4 gaps):** the teacher gradebook needs a second predicate leg for inherited
  attempts (the `where('teacherId','==',uid)` base, `db.js:1924-1928` `[V-P]`, can never show B's teacher
  the A-stamped attempt), and the name filter must stop hard-empty-returning on ex-roster students
  (`db.js:1913-1921` region). **The attempts rules (`firestore.rules:101-118` `[V-P]`) change in the SAME
  release as the query change** — I-10 §4: a query-only fix hits the rules backstop.
- **Rules narrowing LAST:** `rules:45-48` teacher breadth → `isOwner` per its own TODO (only possible once
  `reviewChallenge` is server-side); attempts teacher-update branch narrowed.
- **Token policy matrix for David** (C-18): the code truth is `tokens = max(0, 5 − activeRejections)`,
  30-day window, accepts/pending FREE (`db.js:179-185` per CONSOLIDATED V-1.4) — the guidance/copy fix is a
  ZERO-CODE item that should NOT wait for this phase (§7.7).
- Grader calibration (C-17/I-4) explicitly NOT here — §6.3.

**Ship/Test/Revert.** Shippable: callable behind a flag; rules narrowing is its own last step. Testable:
permafail personas (grader false-negative → override → valid anchor → day advances); orphaned-challenge
persona (promoted student's pending challenge becomes actionable). Reversible: flag off; rules narrowing
reverts independently.
**Acceptance.** F-6 permanent-fail population (3 known students) → 0; every SUPPORT_RUNBOOK manual-pass
event class has an in-product path; the C-19-orphaned subset of the 614 pending challenges becomes
actionable; P (hand-patched) stops growing — the patch treadmill retires.
**Deploy gate.** Full I-5 checklist (functions + rules legs). Targets: `--only functions`, then
`--only firestore:rules`.
**Dissolves.** CR-3: C-15/#14 composite, C-16 (override), C-19 (permission gap, all three predicates),
C-18 (policy decision + comms); I-10 §7's breadth hazard.

---

## §2 — The forward design (David's feature request, 2026-07-13 — SESSION_CONTEXT §6)

David's three asks, mapped: (1) list-end notice offering **start over OR advance** → the P8 choice
terminal + P9 start-over; (2) **continuous** next-list, no dead-end, no TA → P8 continuous advance +
focus-yield; (3) **explicit list-LINKING within a class** → P8 `nextListId` on the assignment. This is the
replacement for symptom-patching: the P1 terminal alone would still strand finishers on a static
congratulation (and the 183 RO-unfrozen students land exactly there); P8/P9 make "finished" a graph node
with outgoing edges instead of a nicer-looking wall.

### 2.1 Why the split (CONT-A now, CYC gated) is safe — and what would falsify it
The x/plan gate (X3) exists because CYCLING removes the allocation cap, and cap removal makes twi forgery
non-self-defeating (x/plan §0/§3g; the `safeTWI` hole `progressService.js:236` `[V-P]`). CONT-A performs no
cap removal and adds no twi writer: it is teacher config + terminal UX + focus routing + the existing
first-session create path on a different listId. Falsifier: if implementation review finds ANY CONT-A code
path that writes `totalWordsIntroduced`/`currentStudyDay` or alters allocation on the FINISHED list, the
split argument fails and CONT-A re-gates behind P6. Design rule to keep that true: "Advance" must be pure
navigation + config read; the finished list's record is never touched again except by review sessions.

### 2.2 Design decisions embedded (for David's confirmation, §7.5)
- `nextListId` is per-assignment (per class) — two classes may sequence the same list differently; the
  launching class's link governs (consistent with class = policy).
- Terminal renders only LIVE capabilities: advance (if linked), start over (only post-P9), else the P1
  static finished message. Never a dead button.
- Open sub-decision (David, SESSION_CONTEXT §6): student-chooses-each-time vs teacher-set auto-advance.
  The P8 schema supports both (`nextListId` + an optional `autoAdvance` bool later); the plan defaults to
  STUDENT-CHOOSES (the choice terminal) because it matches the verbatim request.
- Cycling product decisions deferred to P9 (x/plan §5): interventionLevel across laps; rollover ack.

---

## §3 — Sequencing constraints (the program's hard rules)

1. **G1 landmine (C-32):** NO functions deploy of any kind before P0's disarm lands. HEAD carries
   `GRADE_TOKEN_ENFORCED = true` (`functions/index.js:58` `[V-P]`) vs prod `false` (F-9) — deploying
   functions as-is re-arms the 06-29 outage with the nonce root cause still unpatched
   (`testRecovery.js:98-111` `[V-P]`: the catch mints a fresh nonce PER CALL; TypedTest derives the
   identity TWICE, `:767`/`:869-870` `[V-P]`). Re-arm only after I-5 F5 acceptance, own commit, quiet
   window. Always `--only`-scoped deploys.
2. **X1 (server reviewOnlyDay BEFORE the class_progress lockdown):** satisfied BY CONSTRUCTION — M5 lives
   inside `completeSession` (P3), and the cutoff (P6) requires P3→P4 complete; the dependency graph, not
   process discipline, enforces it (I-6 §7.4). P6 re-asserts it as a listed precondition anyway.
3. **X3 (cycling gate):** P9 ships only after P6 is live and accepted. The P8/P9 split does not weaken
   this — see §2.1.
4. **The migration screen vs RO (I-6 §7.1):** every day between P1 and P5, 183+ students accrue
   legitimate anchor-less csd growth. The P5 plausibility screen MUST count post-anchor review ATTEMPTS
   (the durable ledger) as PRIMARY evidence — the `reviewOnlyDay` session marker is supplemental/
   current-state only (it is not on the durable summary, `studyService.js:1449` `[V-P]`; v2 HIGH-5) — and
   the Phase-0 audit MUST be re-run at P5 time. Inherited 07-04 parameters, or leaning on the ephemeral
   marker, would quarantine/demote the students RO unfroze. This is the single most dangerous plan-level
   interaction; it is called out in P5 as a mandatory amendment, not an option.
5. **Resolver read-only until P5 (v2 BLOCKER, F4-1-sharpened):** `resolveListProgress` ships READ-ONLY at
   P3 and stays read-only through P4 — it computes the merged position in memory and writes NO canonical
   `list_progress` doc on any load, BUT it PRESERVES the legacy `class_progress` reconciliation write
   (`progressService.js:264-271`) that the completion day-guard baselines on (F4-1). The write-capable flip
   is PART OF the P5 migration, so P5 remains the single audited canonical writer.
6. **Reset cutover before the cutoff (v2 HIGH-3):** `SERVER_RESET_PROGRESS` must route every reset caller
   to the `resetProgress` callable at P4, BEFORE P6 removes the client owner-delete branch — else the
   cutoff breaks reset. It is a P4 change AND a P6 precondition.
7. **All THREE progress/twi write-targets migrate together before P7 (v3 F5-HIGH-2 / F6-2):** the completion
   writer (`completeSession`), the challenge day-advance (3rd twi writer, `db.js:2790-2833`), AND the teacher
   read path (`fetchStudentsProgressForClass`) must all route to the foundation record at P4/P5 — none may
   still touch class_progress by P7, or P7's doc deletion silently breaks it. P7's zero-class_progress-refs
   grep is the enforcement.
8. **Migration operational window (v3 F4-4):** P5 runs OFF-PEAK with a watch window + post-flip catch-up; the
   completeSession write-target flip + resolver flip + canonical-doc write are one atomic three-flag
   cutover; reversibility is clean only until the first post-flip completion.
9. **X2 (RO timing):** David's standing call ("we'll just fix as requests come in"). This plan makes the
   deploy SAFE (P0 + the I-5 §4 hosting-only proof) and quantifies the stake (183 + 6 + 24); it does not
   re-litigate urgency.
10. **X4 (non-regression):** every phase names its enforcement point; consolidated matrix in §5.
11. **X5 (census-before-write):** F-4 H/P/B + `data-integrity-sweep.mjs` around every deploy/write;
    C-38 (sweep learns `reviewOnlyDay`) is a P1 pre-step; the sweep/census toolchain re-targets `list_progress`
    at P5 (F6-3) so X5 stays truthful post-migration.
12. **Ordering inside the parallel tracks:** RS's indexes deploy before RS's code; CONT-A requires P1's
    terminal surfaces to exist; P7 waits ≥14 days after P6 (the [C8-1] window).

---

## §4 — What each phase dissolves (roots × live blast radius)

| Phase | Roots dissolved | Live population converted (source) |
|---|---|---|
| P0 FND-0 | C-32 standing hazard; C-36 (partial) | Prevents a repeat of the 06-29 outage (118 denied writes/18h, SUPPORT_RUNBOOK) |
| P1 RO | CR-2 live harm: #11 (C-09/C-10), #10 (C-30), C-27 | **183 walled** (F-4) incl. **24 re-stuck P**; 1 throttle; **6 day_guard students** (F-1); the wall stops growing |
| P2 RS | CR-7: C-33/C-34/C-35; CR-5: #5 code half (C-23) | Teacher lookup failures (이지후-class); automarker invisibility; **12 drifted assignments'** false-fail exposure (CENSUS) |
| P3+P4 FND-1/2 | C-14/C-34 (S7 marker); nonce root (C-32 mechanism); I-2 §2 noise; C-25 | S7 reachability (F-8, deferred sizing); 06-29 class of failures; 531 impossible_phase states stop emitting |
| P5 FND-3 | **CR-1 wholesale**: C-01/#6, C-02/#12, C-03 Kaila, C-06 | **36 LIVE-STRAND re-doing words now + 6 divergent** (scan_F3); 72 latent → unrepresentable; recurrence (이주헌) ends — the LAST consolidation |
| P6 FND-4 | CR-6: C-28/#1b, C-29/#1c, C-31 (`safeTWI` hole), C-08 | Closes the forgery surface cycling/override need; role no longer self-grantable |
| P7 FND-5 | Residual dead surface of CR-1/CR-6 | — |
| P8 CONT-A | C-12, C-13, C-11 (advance half) | **63 pending manual advances** (SESSION_CONTEXT §4) + the RO-unfrozen 183 as they finish; the batch-advance treadmill retires |
| P9 CYC | C-11 (start-over half) | **5 finished-everything** students; every future finisher |
| P10 OVR | CR-3: C-15/C-16/C-18/C-19 | **3 permafail NOW** (scan_F6) → 0; **45 P** demand curve retired; C-19-orphaned share of **614 pending challenges** actionable |

Not dissolved by this plan (owned in §6): #13 (18 tests), grader calibration breadth, review
retake/visibility (C-20/C-21), Phase-2 UX legibility (C-37).

The leverage restated (ROOT_CAUSE §4): most damage is already fixed-in-tree and merely undeployed (P1);
the remaining structural harm collapses onto ONE migration (P5) whose safety machinery (P3/P4/P6) is the
same machinery the override and cycling need anyway. B+P = 233/774 ≈ 30% of started students is the
addressable population; every later phase lands ON the foundation rather than adding patch surface.

---

## §5 — Non-regression matrix (X4 / H10): the LIST_SCOPED_RECON invariants + the #11 fix

The #11 fix itself: preserved verbatim through P1 (it IS the payload), execution moves server-side at P4
(diff-checked derivation, P3 acceptance), client predicate retained as UX preview until P7 retires only
the flag-OFF legacy branches. No phase modifies `studyService.js:1329-1342`/`:1430` semantics; P7 deletes
only the dead/flag-OFF code around them.

| Invariant (I-2 §3 set) | Today's enforcement `[V-P]` | Phase-by-phase enforcement point |
|---|---|---|
| TWI monotonic + anchor-authoritative | `safeTWI` `progressService.js:236`; clamp `studyService.js:1337-1342` | P1–P4: unchanged client code; P3 adds M4 shadow measurement; P5 merge = anchor-validated max (never zeroed); P6: rules deny client twi writes + M4 enforces + delete-vector closed; P9: lap-aware M4 |
| CSD non-demoting (= session count) | `progressService.js:233-235` | P3/P4: `completeSession` csd+1 under a transactional guard; P5: max-PLAUSIBLE across all sources WITH P5's review-only-evidence amendment; post-P6 students cannot write csd |
| Anchor identity `twi = nwei + 1` | `progressService.js:148-150` (I-6-verified); writers must stamp full anchor (CLAUDE.md rule) | P3: W2 marker + M4 compute nwei from server twi (holds by construction); P5: anchor validation IS the merge filter; P10: override callable stamps full valid anchors (manual-pass parity) |
| Errored lookups move nothing | discriminated statuses (`db.js:3244/3313-3315`, I-6-verified) | P3: same contract inside `resolveListProgress` (+ server retries); P5: migration ABORTS the student+list on any anchor query-error |
| Completion day-guard | `progressService.js:441-452` (read-then-write) | P3/P4: transactional assert in `completeSession` (strictly stronger; closes [C3-2]); `day_guard_rejected` keeps uid |
| Assigned-new gate intact / reviewOnlyDay never false-open | predicate `:1329-1335` (confirmed-reason), gate `:1430` | P1: ships as converged (stale-0 false-open closed by confirmed-reason); P3/P4: server re-derives from its OWN allocation (closes the sessionConfig-forgery window = X1); P6: the only completion writer left is the server one |
| TWI exactly flat on review-only days | clamp `:1337-1342`; flag-OFF passthrough `:1342` retired at P7 | P3/P4: server `max(0, …)`; the challenge-accept writer is now CLAMPED at P4 (v3 F5-HIGH-2 pulled its server routing + M4 clamp forward from P10) — the I-6 §3-row-8 unclamped `db.js:2831-2833` defect closes at P4, not P10 |
| **3rd twi writer routed** (v3 F5-HIGH-2) | client reviewChallenge day-advance to class_progress (`db.js:2790-2833` `[V-P]`) | P3 builds the server day-advance path; P4 routes it (writes the foundation record, clamped, `phase==='new'`-gated); P7 deletes the dead client leg — else post-P7 challenge-accepts silently stop advancing |
| Review pairing (anchor class + lineage + exact range) | `db.js:3440-3444` | Unchanged through P4; P3's W2 marker makes S7 days pairable; post-P5 cross-doc carry ceases to exist (one doc), pairing remains for legacy history only |
| **Teacher read path survives migration** (v3 F6-2) | `fetchStudentsProgressForClass` → `getClassProgress` (`progressService.js:518`, `ClassDetail.jsx:198` `[V-P]`) | P4 routes the teacher Students view through the READ-ONLY resolver; P7 zero-refs grep covers it — else teacher dashboards freeze at P5 / break at P7 |
| **Reset works end-to-end** (v2 HIGH-3) | client attempt-delete `db.js:2886/:2958-2995` under owner-delete `firestore.rules:120-122` `[V-P]` | P3 builds `resetProgress` (server, epoch-tombstoned); P4 routes ALL callers to it (`SERVER_RESET_PROGRESS`); P6 removes owner-delete only after the P4 cutover + a rules-denied-reset persona proves the callable path works |
| **Role not self-grantable, create still works** (v2 HIGH-2) | `users/{uid}` write, no field whitelist (`firestore.rules:34-37`); create stamps `role` (`db.js:221/:233`) `[V-P]` | P6 splits by op: create allows only `role=='student'`/absent, update excludes `role`; teacher provisioning via admin/callable. Enforcement point: rules + the M8 test matrix |

---

## §6 — Open and deferred, honestly

### 6.1 #12 mechanism — UNPINNED. Position taken: the foundation MOOTS it; the instrumented repro is NOT a migration prerequisite.
Reasoning: every surviving #12 hypothesis lives in the space "a stale per-class doc + a first-load apply
that prefers the native position" (ROOT_CAUSE CR-1; data ruled out missing index / anchor-query error /
the anchor query itself). P5 removes the second doc; the hypothesis space becomes unrepresentable — the
same way INVESTIGATION_PLAN gate 4 anticipated. Requiring the env-blocked I-1 repro (no Vite/Playwright in
this WSL; Codex/David-side only) before P5 would gate the highest-leverage fix on the lowest-availability
resource to explain a bug class the fix deletes.
**Hedges (so this position is safe even if wrong):** (a) P3's `resolveListProgress` logs
`{uid, anchorStatus, applied values, sources}` on EVERY resolution — server-side and uid-attributed, this
IS the instrumented repro, running continuously in prod from P4 on; (b) the P5 dry-run diff surfaces any
strand the merge would mis-handle before a single write; (c) acceptance asserts F-3 re-scan
LIVE-STRAND = 0. **Falsifier:** a #12-shaped strand (student re-doing words below their own anchor)
appearing POST-P5 with a single `list_progress` doc would prove the mechanism was never the stale-doc
space — reopen I-1 immediately with the P3 logs as the trace. Interim (pre-P5): the first-entry guard
remains I-1's stopgap only if a new live strand forces CS action; do not build new interim code for it.

### 6.2 #13 (undersized tests) — real, small (18 tests / 17 students, scan_F2), root UNPINNED.
Deferred to I-3 (walk the 18 exemplars' generation inputs) — moderate value, not epidemic. The convergence
direction (CR-5 sealed launch descriptor) is NOT scheduled as its own phase in v1; if I-3 pins a cheap
cause, it lands as an RS-class hosting fix; if it demands the descriptor rework, it becomes a Task-2 v2
phase. Honest status: this plan reduces #13's blast radius only incidentally (P5 removes the cross-class
TWI-overshoot contributor); the day-1/dup-serve paths remain untraced.

### 6.2b MCQ correctness stays CLIENT-authoritative after P6 — N5 is not fully met (v3 F5-HIGH-1).
The plan must NOT let N5 ("writes are server-authoritative") read as fully converged. Typed correctness is
server-graded (G2, `correctnessSource:'server-ai'`), but **MCQ `isCorrect` remains client-computed** —
`functions/index.js:441` `[V-P]` states it verbatim: "No 'server-mcq' until Phase E (MCQ stays
client-computed; selectedOptionId is forgeable)." Consequence, stated honestly:
- Even after P6's lockdown + M4 anchor enforcement, a forged MCQ pass can mint an attempt whose ANCHOR is
  range-valid (M4 checks nwsi/nwei/studyDay arithmetic, not whether the MCQ answers were truly correct) →
  it passes M4 and advances the student. M4 closes the anchor-forgery vector, NOT the grade-forgery vector
  for MCQ.
- **X3 cycling caveat:** the cycling gate (P9) rests on "server-authoritative twi." That holds for the twi
  ARITHMETIC (server-owned writes + validated anchors), but a forged-MCQ-pass can still drive a legitimate-
  looking anchor forward one day at a time. The gate is materially stronger than today (no direct
  class_progress/twi forgery, no attempt-delete), but "unforgeable progression" is overstated while MCQ is
  client-graded — cap removal is safe against the ARITHMETIC forgery it was gated on (x/plan §0), not against
  a patient forged-MCQ climb.
- **Scoped follow-on (not silently omitted):** server-authoritative MCQ (Phase E — server-owned option/init
  token; `selectedOptionId` alone is forgeable, per `PLAN_server_authoritative_grading.md` §1/§8.3) is a
  named future phase AFTER OVR. It is out of THIS plan's scope but must appear in the ledger so N5 is not
  read as delivered. Typed override (P10) already gates on the stricter `correctnessSource:'server-ai'`
  marker; MCQ override stays blocked on Phase E (lockdown plan §5).

### 6.6 Reconciliation-overlay end-state — a decision to make before P7 (v3 MED).
Post-migration, `list_progress` is canonical and reconciliation-from-attempts becomes an overlay whose only
remaining job is legacy-history healing (cross-doc carry is gone — one doc). Decide explicitly at P7 whether
the overlay stays (as a self-heal safety net against a corrupted canonical csd/twi) or is retired with the
class-keyed model. This plan's position: KEEP it as a read-time safety net (it is cheap and the anchor is
still the source of position truth), but bind `cleanupOrphanedReviews` to log-only permanently unless a
reset-epoch tag lands (persist §5.1 [C5-2]). Flagged as a decision, not silently assumed.

### 6.3 Grader calibration (C-17 / I-4) — deferred behind the F-7 eval set.
OVR (P10) deliberately ships RECOURSE before calibration: an override makes every future false-negative
recoverable in-product, which both stops the harm and generates the labeled eval set (override + accepted
challenges) that I-4 needs. Calibration work (prompt/rubric + re-measure) follows P10; do not block P10
on it.

### 6.4 Review model (C-20 retake/void, C-21 quality visibility — CR-4) — deferred to I-9.
Not scheduled in v1. Note the dependency direction: retake/void wants the superseded-marker write to be
server-side → naturally post-P6.

### 6.5 Other deferred items
- **impossible_phase pin-check (I-2 §2.4):** read-only; run it alongside the P3 soak window (it also
  baselines the P4 "emissions → 0" acceptance). P-population > ~50 students would trigger CS action.
- **Deferred scans:** F-8 (automarker reachability — sizes the C-14 interim risk between P1 and P4),
  F-12 (continuation counts — sizes P8/P9), F-13 (review distribution — feeds I-9), F-14 (strand
  timelines — only if 6.1's falsifier fires).
- **GRADE_TOKEN_ENFORCED re-arm:** after F5 acceptance (storage-stubbed round-trip green, soak clean,
  `nonce_storage_degraded` volume known) — its own commit + quiet-window functions deploy + immediate G2
  assert. NOT on any phase's critical path.
- **EXT-cohort quarantine (70 items):** David scope decision (§7.2) — exclude retired cohorts or triage.
- **Phase-2 UX legibility (C-37, review-only plan §6/§9):** the allocation-aware hero + teacher "why"
  surfaces — a real sub-project, scheduled after P4 (it can consume the resolver read), not in v1's
  critical path.
- **Config-drift data fix (the 12 assignments):** a David-authorized CS config write, independent of RS's
  code fix; do it whenever authorized (F-5 re-sweep after).

---

## §7 — Decisions needed from David (some GATE specific phases — v3 correction)

The v2 header "nothing else blocks execution" was too strong: decisions **2, 3, and 8 GATE P5** (the
migration cannot run without the EXT-cohort scope call, the migration-day comms choice, and the CS-event
authorization), and **decision 10 (F4-3) gates P6** (the teacher-provisioning path must be chosen before the
role-create rule ships). The rest are product knobs that don't block the foundation.

1. **RO deploy timing** (X2 — standing call; P0 makes it safe whenever).
2. **EXT-cohort quarantine scope** (70 legacy items: triage vs exclude; persist §6 P0). **GATES P5.**
3. **Migration-day comms** for the 36 LIVE-STRAND (forward jump: one-line notice vs silent). **GATES P5.**
4. **Full role mechanism** (custom claim vs whitelist-forever) — gates P10, not P6 (M8 is compatible with
   both).
5. **Continuation sub-decision:** student-chooses-each-time (default in this plan) vs teacher-set
   auto-advance; confirm `nextListId` per-assignment semantics (§2.2).
6. **Cycling product knobs** (P9): interventionLevel across laps; rollover ack prominence.
7. **Token policy** (C-18): confirm rejection-only 30-day economics + authorize the guidance/copy fix NOW
   (zero-code CS item).
8. **FND-3 / FND-4 write authorizations** — each is a SUPPORT_RUNBOOK CS event per standing rules.
   **GATES P5/P6.**
9. **Continuation expectations + the 5 finished-everything (v3 F6-4).** David told TAs "start over ships
   tonight," but start-over = CYC = P9 (multi-week, foundation-gated). Confirm the messaging that
   advance-to-next-list (CONT-A) ships fast while cycling is the longer item, and decide the interim for the
   5 finished-everything students who have no next list (interim review-loop assignment vs manual-test
   bridge until P9).
10. **Teacher-provisioning path (v3 F4-3)** — how a teacher legitimately gets `role=teacher` once self-select
    signup is closed (admin approval / invite code / callable). **GATES P6** (must ship with the role-create
    rule). Also part of decision 4's mechanism choice.

---

## §8 — Verification appendix (what this drafter checked TODAY, and what it corrects)

### 8.1 Re-verified against the working tree, 2026-07-13 `[V-P]`
Git state: tree DIRTY (223 changed/untracked paths, mostly `audit/deepfix/**` + `scripts/cs/*`);
`studyService.js`/`DailySessionFlow.jsx`/`Dashboard.jsx` modified (the #11 fix uncommitted); commits
`a967f54`/`14e49a4`/`1c91466` present in log. Code: `functions/index.js:58`
(`GRADE_TOKEN_ENFORCED = true`), `:90` (`GRADE_JOB_ENABLED = true`), `:436-442` (MCQ correctness
client-computed, "no server-mcq until Phase E"), `:580-597` (markReviewComplete no testId/range), `:973`
(gradeTypedTest job), `:1459` (getGradingStatus job), `:1900` (`exports.version`); `testRecovery.js:98-111`
(per-call catch nonce); `TypedTest.jsx:87/:767/:869-870/:983-985/:1755`; `MCQTest.jsx:601-602`;
`Signup.jsx:38 (role: formState.role)/:141-144 (Teacher radio)`;
`studyService.js:1329-1335/:1337-1342/:1374-1377/:1430/:1449 (reviewOnlyDay not on summary)/:1461-1472`,
`initializeDailySession` `:156`;
`progressService.js:33-35/:236/:264-271/:441-448/:465-467/:518 (fetchStudentsProgressForClass)`;
`db.js:221 (role default)/:233 (setDoc merge)/:328/:502/:796-819/:811/:835/:1194-1204/:1438/:1531/:1808/
:1924-1928/:1962-1978/:2314/:2436/:2665-2668/:2790-2795 (challenge class_progress)/:2831-2833 (3rd twi
writer, unclamped)/:2886 (resetStudentProgress)/:2958-2995 (client attempt-delete)/:3239/:3440-3444`;
`ClassDetail.jsx:198 (teacher progress read)`; `sessionService.js:55-56`;
`firestore.rules:32-49/:101-118/:120-122 (owner-delete)`; `featureFlags.js:10/:20/:28/:41`;
`DailySessionFlow.jsx:590-603/:800-816 (dead branch present)/:822-835/:964-1008`;
`Dashboard.jsx:1057 (pin branch)/:1064/:1072-1078/:1084-1108/:1461-1464/:1562-1565`;
`W3_attempts_lockdown.rules.md:40-43` ("delete — unchanged" line this plan supersedes). Data exports
confirmed on disk and quoted from source: `CENSUS2_FINDINGS.md` (F-2/F-3/F-4/F-9/F-11), `scan_F1_FINDINGS.md`,
`scan_F3_dualenroll.json`, `scan_F4_hpb.json`, `scan_F6_tokens_permafail.json`. **v3 additions re-verified
this round:** `progressService.js:264-271` (legacy recon write, F4-1), `:441-448` (day-guard baseline),
`Signup.jsx:38/:141-144` (F4-3), `functions/index.js:436-442` (F5-HIGH-1), `db.js:2790-2795/:2831-2833`
(F5-HIGH-2), `progressService.js:518` + `ClassDetail.jsx:198` (F6-2), `Dashboard.jsx:1057-1078` (F6-5),
`firestore.rules:120-122` (owner-delete cite corrected from v2's `:117-118`).

### 8.2 Corrections found against the Task-1 inputs (small; none change the backbone)
1. **The Task-2 session snapshot's "git status: clean" is FALSE** — the tree is dirty and the #11 fix is
   still uncommitted (re-verified). I-5's G0 stands exactly as written; anyone reading the snapshot instead
   of the tree would skip a load-bearing pre-step.
2. **I-2's flag-line citations are stale by one line:** it cites `featureFlags.js:10,29,42`; today's tree
   has `SERVER_REVIEW_MARKER` at `:28` and `LIST_SCOPED_RECON` at `:41` (I-6's cites are correct).
   Cosmetic; values match.
3. **45 vs 82 hand-patched:** ROOT_CAUSE (§0/CR-3) uses 45; CONSOLIDATED §1.5 carries v1's 82. F-4
   resolves it: 82 = flagged ROWS across **45 distinct students** (21 holding / 24 re-stuck). This plan
   cites 45 students throughout.
4. **I-5's list-end-terminal cite `:824-834`** — the verified block today spans
   `DailySessionFlow.jsx:822-835` (comment at `:824`, `setPhase` at `:830`). Cosmetic.
5. **(v3 self-correction) The v2 owner-delete rules cite `:117-118` was off** — the actual `allow delete`
   branch is `firestore.rules:120-122` (`:117-118` is the tail of the teacher-update branch). Corrected in
   P6(c) and the §5 reset row.

### 8.3 Self-flagged uncertainties (for the adversarial reviewers)
a. **Firestore multi-`in` disjunction budget** (RS/C-33): medium-high confidence per I-8 (external docs,
   SDK `^12.6.0`); the ≤30 guard + retained post-filter make correctness independent of it — only the
   optimization degrades.
b. **`4b82a0a` commit-date claim** (armed since 06-27): inherited from I-5's `git log -S`; not re-run here.
c. **Prod client commit is unknowable until P4's build stamp** — the a967f54-vs-F-1 day_guard tension
   stays undecidable exactly as I-5 says; P1's acceptance therefore says "trends to 0 for updated
   clients," not "0".
d. **`completeSession` implementation risk:** the transaction bundles day-guard + allocation recompute +
   recentSessions append; contention/size behavior is unproven until P3's sandbox E2E — that is what the
   14-day shadow/soak is for.
e. **CONT-A × dual-enrollment pre-P5:** the choice terminal keys off the LAUNCHING class's assignment; a
   student finishing under class A while enrolled in B with a different link gets A's next list. Accepted
   as class=policy semantics; flagged for impl review + a persona test.
f. **F-4 "expected motion" figures are estimates**, not commitments — e.g. some RO-unfrozen students
   remain B-adjacent ("finished, awaiting continuation") until P8; the acceptance criteria phrase motion
   directionally with the census re-run as the arbiter.
g. **P2/P8 line-cite drift risk:** cites like `TypedTest.jsx:~1306`/`MCQTest.jsx:~1042` (C-23 result
   cards) are inherited from CONSOLIDATED and marked approximate — re-locate at implementation; all other
   cites in this plan are exact and re-verified.
h. **Resolver mode-switch is a state machine** (v2 BLOCKER fix): read-only (P3/P4) → write-capable (P5).
   Correctness depends on the write-capable flip being atomic with the migration commit and on NO code path
   reaching write-capable hydration before it. Flagged for implementation: a single server-side flag guards
   the mode; the P4 acceptance asserts the `list_progress` collection stays empty until P5.
i. **Reset caller enumeration** (v2 HIGH-3): the P4 cutover must find EVERY reset entry point (UI + support
   surfaces), not just `resetStudentProgress`'s primary caller — the bundle grep for live client
   attempt-delete is the backstop, but an un-migrated caller would fail only at P6. Flagged; the grep +
   the rules-denied-reset persona are the guards.
j. **Grading-job activation** (v2 HIGH-4): P3's first functions deploy activates `GRADE_JOB_ENABLED` (live
   in HEAD). Confidence that it is safe rests on the Codex-reviewed-×3 recovery slice + the 7-transition
   test suite (`grading_job_tests.mjs`) — not re-run by this drafter; the deploy validates it with rollback
   ready (byte-for-byte flag revert).
k. **The 3rd-twi-writer server path** (v3 F5-HIGH-2): pulling `reviewChallenge`'s day-advance server-side at
   P4 (not P10) is new integration between the challenge flow and the foundation completion path — the
   `advanceForChallenge`-vs-fold-into-`completeSession` choice is an impl decision; flagged. The FULL
   reviewChallenge→server migration + C-19 authz union stays P10.
l. **Teacher-provisioning mechanism** (v3 F4-3): closing self-select-teacher signup at P6 requires SOME
   provisioning path to exist; which one (admin/invite/callable) is David's decision 10 and gates P6 — the
   plan states the requirement, not the mechanism.
m. **MCQ-forever residual** (v3 F5-HIGH-1): N5 is only partially met; the forged-MCQ→range-valid-anchor path
   survives P6. Confidence high (functions:441 says so verbatim); the RISK sizing (how reachable a patient
   forged-MCQ climb is) is unmeasured — flagged as the reason Phase-E server-MCQ is a named follow-on, not
   dropped.

---

## §9 — Changelog (v1 → v2): Codex review folds

Codex reviewed v1 → NEEDS_FIXES (1 blocker + 4 high + 2 med); the orchestrator verified all 7 against the
working tree (all TRUE); this drafter independently re-verified each cited `file:line` before folding
(re-verification results in the "V" column). Each fold below names the affected phase(s) and the evidence.

| # | Sev | Finding | Fold (where) | Evidence `[V]` |
|---|---|---|---|---|
| 1 | **BLOCKER** | `resolveListProgress` was write-capable (hydrate-on-miss CREATES canonical) and P4 routed live hydration through it → canonical docs written on arbitrary loads BEFORE P5's audited migration, breaking P5's "single audited/reversible write" + P4's "no data migration yet." | **P3 change 2** now defines the resolver in TWO modes (READ-ONLY/shadow until P5, write-capable flipped ON as part of P5); **P4** routes reads/hydration through the READ-ONLY resolver (writes nothing canonical; completion still writes the legacy doc); **P5 Procedure** flips it write-capable as the migration's own step + asserts the resolver wrote zero canonical docs pre-flip; **§3 new constraint 9**; **§8.3 h**. | Resolver is new code (P3); the fix is a spec-level mode-switch, verified consistent with persist §5.2 [C6-1]/[C4-4] |
| 2 | HIGH | A blanket `users/{uid}` `allow write` + `!diff().affectedKeys().hasAny(['role'])` BREAKS user creation. | **P6 change (b)** split by op: `create` allows only `role=='student'`/absent; `update` excludes `role`; teacher/admin via callable; + a required rules-test matrix. **P6 test list**, **§5 new "role" row**, **§8.3 (implicit via matrix)**. | `db.js:221` `role: docOverrides.role ?? 'student'`, `db.js:233` `setDoc(..., {merge:true})` `[V-P re-verified]` |
| 3 | HIGH | P6 removing owner attempt-delete BREAKS reset unless P4 first routes reset to the server callable (reset is a CLIENT batch-delete of attempts). | **P4** adds the `SERVER_RESET_PROGRESS` route (migrate every reset caller off client-delete + bundle grep) as a hard requirement; **P6 preconditions** add "reset fully cut over" + a rules-denied-reset persona; **§3 new constraint 10**; **§5 new "reset" row**; **§8.3 i**. | `resetStudentProgress` `db.js:2886`; client `batch.delete` of attempts `db.js:2958-2995` (`where studentId + classId`); `firestore.rules:117-118` owner-delete `[V-P re-verified]` |
| 4 | HIGH | P3's "No live path changes" was FALSE — `GRADE_JOB_ENABLED=true` in HEAD; the first functions deploy activates the grading-job path. | **P3** now states the ONE intended live-path activation, keeps `GRADE_JOB_ENABLED=true` (does NOT flip false), and adds the full grading-job recovery suite (`grading_job_tests.mjs`, 7 transitions) + live typed smoke to acceptance; **P3 Non-regression** rewritten; **§8.3 j**. | `functions/index.js:90` `GRADE_JOB_ENABLED=true`; consumed `:973` (gradeTypedTest) + `:1459` (getGradingStatus); byte-for-byte rollback comment `:1457-1461` `[V-P re-verified]` |
| 5 | HIGH | The P5 CSD-plausibility amendment leaned on `reviewOnlyDay:true`, which is a NON-durable session_states marker (overwritten each session, not on the durable summary) → undercounts long-recovering students. | **P5 amendment** rewritten: PRIMARY evidence = count of DISTINCT post-anchor review ATTEMPTS keyed `(classId,listId,studyDay)`, `submittedAt > anchor`, capped one-per-studyDay (durable ledger); the session marker is SUPPLEMENTAL/current-state only; + a dry-run assertion for N>1 consecutive review-only days; **P5 acceptance** + **§3 constraint 4** updated. | `studyService.js:1449` ("reviewOnlyDay:true … deliberately not on the summary"); summary `:1461-1472` lacks it `[V-P re-verified]` |
| 6 | MED | P3's W2 marker needed an explicit output-shape assertion (today's `markReviewComplete` writes no testId/nwsi/nwei → unpairable + gradebook-invisible). | **P3 acceptance** adds: the upgraded marker has a parseable `testId` + integer `newWordStartIndex`/`newWordEndIndex` == anchor, `getReviewForDay` pairs it, it is gradebook-visible — asserting the C-14/C-34 fix at the gate. | `functions/index.js:580-597` (no testId/range today); pairing `db.js:3438-3444`; gradebook parse-drop `db.js:1962-1977` `[V-P re-verified]` |
| 7 | MED | P0's "commit #11 + tree clean" was naive — 223 changed paths, mostly audit/harness/doc churn that stays uncommitted. | **P0 change 1** now requires a SCOPED COMMIT MANIFEST (only the 3 #11 runtime files, recorded sha, full client-delta review vs `a967f54`, audit churn provably out of the bundle; commit is David's action); **P0 acceptance** updated. | `git status` = 223 changed/untracked paths (mostly `audit/deepfix/**`, `scripts/cs/*`) `[V-P re-verified]` |

**Structure/altitude preserved:** no phases added or removed; the FND-0…OVR backbone, the RS/CONT-A/CYC
split, the §6 open-ledger positions, and the §7 David-decision list are unchanged. All seven folds sharpen
mechanism within existing phases; the only cross-cutting additions are §3 constraints 9–10, two §5 rows,
and §8.3 h–j.

---

## §9b — Changelog (v2 → v3): 3-verifier review folds

The 3 fable verifiers reviewed v2 → 1 BLOCKER + 7 HIGH + several MED/nits; the orchestrator verified every
finding against the tree (ALL TRUE, none rejected — `adjudication_log.md`); this drafter independently
re-verified each new `file:line` (results in the "V" column). Backbone unchanged; all folds sharpen spec
within existing phases.

| ID | Sev | Finding | Fold (where) | Evidence `[V-P re-verified]` |
|---|---|---|---|---|
| F4-1 | **BLOCKER** | The v2 "read-only resolver" was ambiguous: today entry-time reconciliation WRITES safeCSD/safeTWI to class_progress and the completion day-guard baselines on that stored csd — a literal "no write" would REJECT every completion for the 36 LIVE-STRAND + 6 divergent + daily-growing review-only dual-enrolls (permanent loop). | **P3 change 2** now states read-only PRESERVES the legacy class_progress recon write (keeps the day-guard baseline current); only the NEW canonical-doc creation is withheld until P5. **§3 constraint 5** updated. | `progressService.js:264-271` (`updateDoc{currentStudyDay:safeCSD,…}`); day-guard `:441-448` (`expectedDay=(current.currentStudyDay||0)+1`) |
| F4-2 | HIGH | Server `reviewOnlyDay` derived from allocation alone omits predicate reason 3 (REVIEW_STUDY resume) → #9 double-introduces twi. | **P3 change 1** now requires the server derivation to replicate ALL 3 client reasons; diff-check asserts all 3 across S3/S4/S5/S8 fixtures. | `studyService.js:1329-1335` (3-reason predicate) |
| F4-3 | HIGH | P6's role-create rule breaks the LIVE self-select teacher signup; the teacher-provisioning path must ship WITH P6. | **P6 (b)** adds the provisioning-path-with-P6 requirement + a signup persona; **§7 decision 10** (gates P6); framed as a net security win (self-select IS the #1b hole). | `Signup.jsx:141-144` (Teacher radio), `:38` (`role: formState.role`) |
| F4-4 / F6-1 / F6-9 | HIGH | P5 completeSession legacy→canonical write-flip unspecified; no off-peak/watch/catch-up; reversibility overstated (real point-of-no-return = first post-flip completion). | **P5** spec's the three-flag atomic cutover, an OFF-PEAK window + watch + post-flip catch-up pass, and honest reversibility; **P5 Ship/Test/Revert** rewritten; **§3 constraint 8**. | migration risk (class-hour peaks; in-flight sessions dropped, persist §7.5) |
| F5-HIGH-1 | HIGH | MCQ stays client-authoritative forever → N5 overstated; forged MCQ mints a range-valid (M4-passing) anchor post-lockdown. | **§6.2b** (new) honest ledger + **N5 caveat in §0.1** + the X3 cycling-gate forgery implication + a scoped Phase-E server-MCQ follow-on; **§8.3 m**. | `functions/index.js:436-442` ("no server-mcq until Phase E; selectedOptionId forgeable") |
| F5-HIGH-2 | HIGH | The 3rd twi writer (client reviewChallenge day-advance) has no P4→P5 routing → writes dead class_progress P5–P10, no-ops post-P7 (challenge-accepts stop advancing). | **P3 change 9** (build the server day-advance path + clamp + phase-gate) + **P4 routing** + **P7 dead-leg deletion**; **§5 new "3rd twi writer" row**; **§3 constraint 7**; **§8.3 k**. P10 still owns the full reviewChallenge→server + authz. | `db.js:2790-2791` (hardcoded class_progress), `:2794` (exists-guard), `:2831-2833` (unclamped twi/csd write) |
| F6-2 | HIGH | Teacher "Students" view reads class_progress directly (un-migrated) → freezes at P5 / breaks at P7. | **P4** routes `fetchStudentsProgressForClass` through the READ-ONLY resolver; **P4 + P7 acceptance** add zero-class_progress-reader on the teacher surface; **§5 new "teacher read" row**; **§3 constraint 7**. | `progressService.js:518`, `ClassDetail.jsx:198` |
| F6-3 | HIGH | CS toolchain (sweep/manual-pass/census) is class_progress-shaped → post-P5 false-CLEAN + writes dead collection; X5 depends on it being truthful. | **P5** schedules the CS-toolchain rework to target list_progress (sweep/census with the P5 before/after; manual-pass writes canonical anchors from P5); **§3 constraint 11**; **P7** zero-refs covers CS. | `scripts/cs/*` read/write class_progress |
| F6-4 | HIGH | Start-over (CYC) is ~multi-week behind the foundation, but David told TAs "tonight"; 5 finished-everything on the manual treadmill. | **P8 Goal** adds the expectation-setting split (CONT-A fast / CYC slow) + interim for the 5; **§7 decision 9** (David-comms). | David 07-13 chat + SESSION_CONTEXT §4 |
| F6-5 / F5-med | MED→HIGH | P8 focus-yield cited only the recency branch, but `getPrimaryFocus` returns from the explicit-PIN branch FIRST → ~287 CS-pinned students never auto-advance; the `twi≥listTotal` test also breaks under P9 cycling. | **P8 focus-yield** now handles the pin branch (pinned finished list yields to nextListId / clears-advances the pin) and is lap-aware for P9; **P8 acceptance** adds a pinned-student persona. | `Dashboard.jsx:1057` (pin branch) returns `:1064`/`:1072-1078` before recency `:1084` |
| MEDs/nits | MED/LOW | P7 retirement inventory + zero-refs acceptance + flag lifecycle; runtime reviewOnlyDay mismatch LOG; recon-overlay end-state decision; completeSession idempotency; CSD per-doc own-anchor baseline; §7 decisions 2/3/8 gate P5; P1 G5 watch signal/clock; nit cites (P6(a) P9→P10, owner-delete `:120-122`). | Folded across **P7** (inventory + flag lifecycle + zero-refs), **P4** (mismatch log), **§6.6** (overlay end-state), **P3** (idempotency), **P5** (per-doc baseline), **§7** (gating), **P1** (G5 concrete), **P6** (cite fixes). | per-item cites in the respective phases; owner-delete `firestore.rules:120-122` |

**Structure/altitude preserved (v2→v3):** no phases added, removed, or re-sequenced (the verifiers confirmed
this). New cross-cutting additions: §3 constraints 7–8 + renumbering, two §5 rows (3rd twi writer, teacher
read), §6.2b + §6.6, §7 decisions 9–10 + gating flags, §8.3 k–m. Every fold lands inside an existing phase.
