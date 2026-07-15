# INVESTIGATION PLAN — deepfix Task 1, step 1.4 (feeds 1.5 H1 gate + 1.6 investigations + Task 2 planning)

**Author:** Consolidator (1.4). **Date:** 2026-07-13. **Companion:** `CONSOLIDATED_ISSUES.md` (issue ids C-xx,
priorities, evidence tags). Baseline empirical data already banked: `firebase/CENSUS_SUMMARY.md` +
`census_rows.json` (530 rows) + `census_classes.json` + `syslogs.json` (read-only census v1, 2026-07-13).

## §0 — Purpose, philosophy, binding rules

**Goal.** For each structural root (CR-1…CR-7) and each material discrete issue: PIN the root cause (not merely
suggest it), define the ideal-app behavior it deviates from, and specify the convergence direction — so Task 2
plans fixes that move toward the ideal model instead of adding responsive patches. The census has already
delivered the empirical thesis this plan must honor: **the data is not corrupt; the failures are structural /
behavioral / deploy-state, and manual patches demonstrably don't hold (25/82 re-stuck; 이주헌 re-split).**

**Binding rules (verbatim-derived):**
1. **VERIFY EVERYTHING** (David): no investigation output is accepted on assertion; every claim lands with a
   working-tree `file:line` or a Firebase doc-path + values, or is explicitly tagged unverified.
2. **Empirical linkage (David, 2026-07-13):** wherever possible, every code finding must be LINKED to concrete
   Firebase evidence (student uid + doc path + anomalous values) — or explicitly marked
   **"not empirically checkable + why"** (e.g. client-only UX defects, latent code paths with 0 live rows).
3. **Access boundary (H4, CRITICAL):** ALL live-Firestore work is run by the ORCHESTRATOR (main session),
   READ-ONLY, from WSL: `NODE_PATH=/app/node_modules node scripts/cs/<script>.mjs` (service-account key present;
   egress confirmed). **Fable/Codex/sub-agents NEVER get live 26SM Admin access.** The pattern is:
   orchestrator runs scans → exports rows to `audit/deepfix/task1/firebase/` → agents analyze EXPORTED data +
   code. Scan specs below are written for the orchestrator to implement; agent briefs reference only exports.
4. **Read-only discipline:** census/scans never write. Any data FIX they suggest is a separate CS event
   (SUPPORT_RUNBOOK entry, David-authorized, sweep-before/after) — out of scope for this plan.
5. **Reuse defined scripts** (`scripts/cs/` — extend `deepfix-census.mjs`, `data-integrity-sweep.mjs`,
   `scan-reviewonly-frozen.mjs`, `sweep-ascent-carry.mjs`), don't proliferate one-offs.
6. **No app-source change** falls out of this plan directly — investigations produce findings + convergence
   specs; code changes need their own converged plan + Codex GO + David go-ahead (standing rule).

**Export contract (all F-scans).** Each scan writes
`audit/deepfix/task1/firebase/scan_<id>_<slug>_<YYYY-MM-DD>.json`: an array of rows
`{uid, fullUid, email?, cls, classId, listId, docPath(s), values…, signature, h1Caveats[]}` + a `_meta` header
(query spec, window, counts, caveats). Agents cite rows by `uid + docPath`.

---

## §1 — Workstream map

| WS | What | Runs | Parallelism |
|---|---|---|---|
| **WS-F** | Empirical Firebase census refinements F-1…F-14 (the MANDATORY workstream; census v1 done) | Orchestrator only (read-only live) | F-scans mutually independent unless noted |
| **WS-C** | Code/root-cause investigations I-1…I-10 | Agents (fable/Codex/fork) on code + exports | Mostly parallel; data-gated ones noted |
| **WS-V** | 1.5 H1 verification-gate completion (re-trace the remaining `[V-prior]` anchors) | Orchestrator or one agent | Parallel with everything |

---

## §2 — WS-F: the empirical Firebase workstream (orchestrator, read-only)

Census v1 (`deepfix-census.mjs`) is the baseline: 32 classes / 816 students / 1121 started; signature counts
banked with H1 caveats. The scans below are the REFINEMENTS the caveats demand plus the signatures census v1
did not cover. Priority order within WS-F: **F-1 first** (deploy-state truth gates everything), then F-2/F-3/F-4
(they gate I-3/I-6/Task-2 sizing), then the rest.

### F-1 · Attribute `impossible_phase_detected` (3088) + `day_guard_rejected_session_cleared` (17) — TOP TODO
- **Question:** are these real 26SM events (→ #10-family fires in prod; a large unknown behavioral signal) or
  07-12 fleet-audit sandbox noise (`lsr_*@vocaboost.test`, 25WT classes)?
- **How:** pull the raw `system_logs` events (not just tallies) for both types over the full window; extract
  `userId/classId/listId/details`; join uid→26SM-roster vs sandbox-roster; ALSO extend the window back before
  07-12 04:34 to get a pre-audit baseline rate. Separately: grep the CODE for the emitters of
  `impossible_phase_detected` (client + functions) and record what condition fires it (feeds the analysis brief).
- **Pins vs suggests:** uid attribution PINS live-vs-sandbox; the emitter trace pins WHAT the condition is; if
  real-26SM rows exist, export the top offenders' full timelines (attempts + progress + logs) for I-2/I-3 analysis.
- **Linked issues:** C-30, C-25, C-04 (deploy-state), C-36. **Export:** `scan_F1_syslog_attribution`.
- **Ideal-app anchor (N6):** system_logs signals must be attributable by construction (env/build stamped on every event).

### F-2 · Precise #13 recount (kills the 257-noise)
- **Question:** the TRUE undersized-test population, pinned to the class each attempt was TAKEN under.
- **How:** for every `sessionType:'new'` attempt of started 26SM students: compare `totalQuestions` vs the
  `testSizeNew` of the assignment of **attempt.classId** (NOT every enrolled class — that's what inflated 257);
  exclude retakes (same uid+day+list, later timestamp) into their own bucket; bucket results by boundary type:
  day-1 / first-attempt-after-enrollment(join date) / post-promotion (enrollment change within 3 days) /
  dup re-serve / list-end remainder (expected = min(size, remaining) — benign). Keep the q<0.6×expected rows as
  the headline set (~30–50 expected; census buckets q13→30 ×11, q10→30 ×9 are the seed).
- **Pins vs suggests:** the boundary-bucket distribution LOCALIZES which generation path to trace (I-3 input);
  it cannot alone pin the code path.
- **Linked:** C-22. **Export:** `scan_F2_testsize_recount`. **Ideal anchor (N3):** sealed test descriptor.

### F-3 · Dual-enroll divergent-vs-benign split + live #12 strand candidates + Kaila-phantom census
- **Question:** of the 98 dualEnrollSameList students — how many are (a) benign (both docs finished/equal),
  (b) DIVERGENT-active (live #6/#12 risk), (c) currently stranded (active doc far BEHIND the student's own
  cross-class anchor = live #12 rows), (d) **F-3b:** in the Kaila phantom state (`csd == anchorDay−1` while a
  same-day review exists in another class / with a mismatched position range)?
- **How:** for each of the 98 (from `census_rows.json` dualDocs): compute the student+list anchor
  (max `newWordEndIndex` passed-new attempt, the recon rule), each doc's csd/twi lag vs it, each doc's last
  activity; for F-3b run the `getReviewForDay` pairing logic offline against exported attempts.
- **Pins vs suggests:** (c) rows are LIVE evidence #12 is ongoing (not just the 07-13 trio); (d) counts the
  silent phantom-loop population. Neither pins the #12 MECHANISM (that's I-1's repro).
- **Linked:** C-01, C-02, C-03, C-06. **Export:** `scan_F3_dualenroll_split` (+ `_F3b_phantom`).
- **Ideal anchor (N1):** one (student,list) record — this census IS the migration's input-quality audit.

### F-4 · Hand-patched population durability + H/P/B partition (the catalog, empirically closed)
- **Question:** for each of the 82 manualPatched students (and every row in `cs_manual_writes_catalog.md`):
  did the patch HOLD? Which of the 25 re-stuck were re-caught by which bug (list-end wall / throttle / carry
  regression / new)? Verify the catalog's specific residuals: (a) derived-write recon consistency for
  안이연/유혜준/Lucy (07-13 writes had NO anchor attempt — does re-reconciliation agree today?); (b) dual-enroll
  leftovers 구기현/남세이/박주하 (join F-3); (c) programStartDate correctness for 손진욱/박주하; (d) **F-4b:**
  impossible session states (`newWordsTestPassed=false` + passed same-day attempt — 최도훈 family, feeds C-25);
  (e) **F-4c:** forgery/hygiene sweep — attempts `passed:true` with anomalous shape (no testId AND no
  manualOverride AND no writtenBy provenance) beyond known automarkers; any `users` role flips to teacher.
- **Then partition ALL 1121 started students:** **H** healthy (no signature, no patch) / **P** hand-patched
  (patch present — subdivide P-holding vs P-failed=re-stuck) / **B** still-broken (signature, no patch). A
  P-student is first-class evidence a bug reached a real student even when their data now looks fine — the
  partition is the program's ground-truth impact table and Task 2's acceptance baseline (the ideal-model fixes
  must move B→H and make P unnecessary).
- **Linked:** C-15, C-16, C-25, C-28, C-29, X5. **Export:** `scan_F4_hpb_partition` (+ `_F4b`, `_F4c`).

### F-5 · Config re-sweep (thresholds, split-brain watch, ghost progress)
- **Question:** confirm + root the 12 drifted assignments (제주 BRIDGE/CORE/TOP passThreshold 90; missing
  `newWordRetakeThreshold` ×10; the two INVERSE 90/0.92 rows) — did the 07-13 ensure-all-lists mirror re-introduce
  pre-normalization props (compare `assignedAt`/backup files `dsg-edits/srv_validate/class_backups/*`)? Keep the
  standing watches: splitBrain (0 today), ghostProgress (0 today), missingPSD (1).
- **Output:** the exact fix list for David (config WRITE = separate authorized CS event, not this plan).
- **Linked:** C-23, C-35, C-07. **Export:** `scan_F5_config_drift`.
- **Ideal anchor (N4/N6):** client never needs a mirrored threshold field at all (trust server `passed`) — the
  drift recurrence is itself evidence for the code fix over config maintenance.

### F-6 · Challenge-token + permanent-fail census (not covered by census v1)
- **Question:** how punitive is the token policy in practice, and who is in the permanent-fail state NOW?
- **How:** read `users/{uid}.challenges.history` for started 26SM students: per student — counts by status,
  active rejections (`status==='rejected' && replenishAt>now`), available tokens by the code formula
  (`db.js:179-185`); flag LOCKED (0 tokens). Cross-join: students with ≥3 failed attempts on the SAME day/list
  in the last 14d AND 0 tokens = **permanent-fail candidates** (C-15's live list — 양서현 should appear).
  **F-6b:** for promoted students among them, export attempt.classId vs current enrolledClasses (the C-19
  permission-gap evidence pair; I-10 consumes).
- **Linked:** C-15, C-17, C-18, C-19. **Export:** `scan_F6_tokens_permafail`.

### F-7 · Grader false-negative eval-set pull
- **Question:** a labeled dataset for C-17 calibration work.
- **How:** export (a) every challenge with `status:'accepted'` (student was right, grader wrong — labeled TRUE);
  (b) every manualOverride-corrected answer (CS/teacher judgment); (c) heuristic candidates: graded-wrong answers
  whose studentResponse exactly matches the list's own KO definition fragments (the CS-2026-06-29B method — but
  runbook proved string-match over-counts, so tag these UNLABELED, for re-grade only). Include word, response,
  expected defs, grader verdict/reasoning if stored.
- **Pins vs suggests:** the set + I-4's re-grade measures the false-negative rate by answer class; it PINS
  calibration breadth (is 김재민's "restating" regression cohort-wide?) without touching the prompt.
- **Linked:** C-17, C-15. **Export:** `scan_F7_grader_evalset`.

### F-8 · Automarker + testId-less attempt census
- **Question:** empirical reachability of C-14 (automarker-revert) and size of C-34 (gradebook-invisible rows).
- **How:** all 26SM attempts with `autoCompleted:true` OR missing/unparseable `testId` (regexes at
  `db.js:1968-1977`); classify origin (automarker / old scratch-manual / other). For each automarker: did the
  marker's day hold (current csd ≥ marker day) or revert? Any marker on a NON-list-end day = C-14 reachability
  proven live.
- **Linked:** C-14, C-34, C-33. **Export:** `scan_F8_automarkers`.

### F-9 · Deploy-state probe (does PROD behave as HEAD?)
- **Question:** the central program question now that #9/#10/#11 are all fixed-in-tree.
- **How (all read-only):** (a) recent attempts' `correctnessSource` (null ⇒ `GRADE_TOKEN_ENFORCED` off live) +
  `writtenBy` distribution (client vs cloud-function ⇒ SERVER_ATTEMPT_WRITE live posture); (b) try the
  `version` callable — if absent, that itself is the #4 finding re-confirmed; (c) post-07-11 signature hunt:
  #9's spurious-retake shape (same-day duplicate new attempts at an advanced base following a cross-class
  review) and #11's shape (day-N+1 review attempts written while csd frozen — 김동현's 7/13 row is the exemplar);
  (d) fold in F-1's attribution result.
- **Pins vs suggests:** (a)+(b) PIN live flag posture from data; (c) pins whether prod still exhibits the
  fixed-in-tree bugs (expected: YES until deploy — quantify the rate).
- **Linked:** C-04, C-09, C-30, C-32, C-36. **Export:** `scan_F9_deploy_state`.

### F-10 · (folded into F-3b — Kaila phantom census). Kept as an id placeholder to avoid renumbering agent briefs.

### F-11 · twi-vs-mastery reconciliation (census tension)
- **Question:** census `twiOverMastery≈0` vs the catalog's documented 조준모 over-credit (twi 640 / 600
  study_states). Reconcile the check definitions (census may count all study_states vs per-list; or he studied on).
- **How:** per (student,list): `twi` vs `count(study_states where listId)`; export every `twi > count` row with
  provenance (manual patch date vs organic); explicitly re-check 조준모/신예나.
- **Linked:** C-05. **Export:** `scan_F11_twi_vs_mastery`.

### F-12 · Continuation exposure census
- **Question:** who needs the continuation model the moment #11 deploys?
- **How:** per started student: finished lists (twi≥listSize), current `settings.primaryFocus{ListId,ClassId}`;
  flag (a) focus-on-finished-list (re-#11 exposure, C-13 — includes the 25 patched-re-stuck), (b) the ~63
  finishers still awaiting manual advance, (c) finished-EVERYTHING students (the 5 known ±), (d) next-list
  inference per class (feeds the C-12 linking design with real counts).
- **Linked:** C-11, C-12, C-13. **Export:** `scan_F12_continuation`.

### F-13 · Review-quality distribution
- **Question:** cohort review-score distribution; the future-throttle population; the near-zero-review population.
- **How:** review attempts (last 21d): score histogram; per student last-3 recentSessions review avg; flag ≤0.30
  (approaching interv 1.0 — Junseo's successor cohort) and <0.20 one-offs (accidental/garbage submits, C-20).
  Junseo's post-patch trajectory exported as the recovery exemplar for the plan-§8 cadence claim.
- **Linked:** C-10, C-20, C-21. **Export:** `scan_F13_review_quality`.

### F-14 · #12 strand timelines (I-1's evidence pack)
- **Question:** full forensic timelines for the known strands (Lucy/안이연/유혜준) + F-3(c) new candidates:
  every attempt (all classes) + class_progress snapshots + all `csd_twi_reconciled`/anchor logs with timestamps,
  interleaved chronologically.
- **Pins vs suggests:** SUGGESTS only (ordering/caching can't be proven from data) — it constrains I-1's repro
  hypotheses (e.g., was the first ADV load before or after the recon log? was there a same-minute Inter session?).
- **Linked:** C-02. **Export:** `scan_F14_strand_timelines`.

**Standing rule X5:** every future CS write updates the F-4 H/P/B partition. The partition is re-run before and
after any Task-2 fix ships (it is the program's before/after metric).

---

## §3 — WS-C: code/root-cause investigations (agents on code + exports; NO live access)

Each brief states: hypothesis to confirm/refute · what PINS vs merely suggests · inputs · deliverable · the
ideal-app behavior it must define. Assign one agent per brief (fable-class for adversarial tracing, Codex for
breadth, fork for context-heavy ones); every deliverable lands with evidence tags per §0-1.

### I-1 · PIN the #12 carry-miss mechanism (C-02) — the hardest open root
- **Hypotheses to adjudicate (from the three lists):** H-a fable's first-load `query-error|none` fallthrough +
  non-demoting follow-ups (but must explain why `safeTWI=max(stored,twi)` never applied 880); H-b session-context
  /sessionStorage caching of a prior class's session; H-c `initializeDailySession → getOrCreateClassProgress`
  read-before-write ordering race; H-d focus/class-context mismatch (session built for a different classId than
  reconciled).
- **Method:** instrumented REPRO in the 25WT sandbox (lsr_* accounts) driving the exact promotion flow
  (finish list-days in class A → enroll class B → first entry), with reconciliation logging at every
  read/apply/write; F-14 timelines constrain which hypotheses are even consistent with the live strands.
  **PIN = a repro that strands deterministically + the exact line where the anchor is dropped; anything less is
  "suggests."** If no repro after the H-a…H-d matrix, deliver the elimination table + the instrumentation patch
  proposal (observability-only) as the fallback.
- **Environment note:** THIS WSL env cannot run Vite/Playwright (9p mount); the repro harness must run from
  Codex's/David's side or via the audit-harness path (SESSION_CONTEXT §3) — plan the script; orchestrator
  coordinates execution.
- **Deliverable:** `inv_I1_carrymiss.md`. **Ideal (N1):** define how the student-owned re-key makes the entire
  hypothesis space unrepresentable (no per-class doc to be stale) — the interim guard (first-entry anchor read
  may not silently default) is a stopgap, specified separately.

### I-2 · Review-only predicate completeness + automarker interplay (C-09/C-10/C-14)
- **Hypothesis:** the in-tree `reviewOnlyDay` predicate covers list-end + throttle, but NOT every zero-new path:
  (a) over-introduced negative counts (plan says clamped — verify); (b) the all-mastered empty-review fresh
  branch `DailySessionFlow.jsx:826` (plan §5 flags it); (c) the mid-session automarker path whose marker then
  FAILS pairing (C-14) — i.e. the fix and the automarker can fight; (d) throttle-recovery cadence/oscillation
  (one high review → interv<1.0 next day? plan §8 claim).
- **Method:** pure code trace of every path where `newWordCount<=0` at completion or termination; matrix each
  against the predicate + pairing rules; use F-8's export for live reachability of (c). PIN = per-path verdict
  table with file:line. **Deliverable:** `inv_I2_reviewonly_matrix.md`.
- **Ideal (N3):** enumerate ALL legitimate day states {new+review, review-only(throttle|list-end), all-mastered,
  finished-terminal} and the exact completion/record semantics of each — the state machine Task 2 implements.

### I-3 · #13 test-size generation-path pin (C-22) — GATED on F-2
- **Hypotheses:** H-a pool collapse (`min(testSizeNew, pool.length)` with wordsRemaining shrunk by cross-class
  TWI — but must resolve the 이혜성 "introduced 80, tested on 10" tension); H-b wrong-class config pick in the
  standalone/smart TypedTest/MCQ paths; H-c retake regeneration from stale page state
  (`TypedTest.jsx:1122-1125`); H-d enrollment race on day-1 (assignment not yet readable at generation).
- **Method:** take F-2's boundary-bucketed real cases; for 3–5 exemplar students reconstruct the generation
  inputs (their TWI/pool/config at attempt time from exported attempts) and walk each candidate path; PIN = the
  one path whose computed totalQ reproduces the exemplars' actual values. **Deliverable:** `inv_I3_testsize.md`.
- **Ideal (N3):** the sealed launch-descriptor spec (what fields, sealed where, how retake re-seals).

### I-4 · Grader calibration eval (C-17) — GATED on F-7
- **Method:** categorize the eval set (KO-direct-translation / paraphrase / typo-1char / verb-form / partial);
  re-grade the UNLABELED candidates through the live grader (read-only callable use, orchestrator-mediated) to
  get true verdicts (the CS-06-29B lesson: string-match over-counts; re-grade is the test); measure
  false-negative rate per class; check whether the 03-10 "restating" fix regressed or was always partial
  (김재민 07-06 says one of the two). **Deliverable:** `inv_I4_grader_eval.md` + the labeled set as the
  before/after benchmark for any prompt change.
- **Ideal (N4):** the acceptance rubric (correct dictionary-equivalent KO accepted; typo tolerance; the
  false-POSITIVE guardrail so tuning doesn't overshoot).

### I-5 · G1 deploy-gate hardening design (C-32/C-36) — GATED on F-9 (+F-1)
- **Scope:** (a) verify the nonce root cause end-to-end (`testRecovery.js:98-110` → token binding
  `functions/index.js:491` → save path) — this is the one G1 leg still `plausible-unverified`; (b) design the
  fix: submit with the server-returned `attemptDocId`, sessionStorage/in-memory nonce surviving the grade→save
  gap; (c) the DEPLOY GATE checklist: flag-value assertion table (what each flag MUST be at deploy: 
  GRADE_TOKEN_ENFORCED=false until (b) ships; LIST_SCOPED_RECON=true; SERVER_* per W-plan), `version.sha == git
  HEAD` post-deploy check, stamp-build predeploy. **Deliverable:** `inv_I5_deploy_gate.md` — the checklist every
  Task-2 deploy MUST pass. **Ideal (N5/N6):** no armed flag whose failure mode is unpatched; provenance consulted,
  not just built.

### I-6 · Foundation design: student-owned progress + server-authoritative twi as ONE migration (C-31/C-01) — the keystone
- **Question (Claude's open Q5, answered by design):** the minimum single migration that (a) re-keys progress to
  `users/{uid}/list_progress/{listId}` (PLAN_list_progress_persist), (b) moves progress writes server-side +
  server-validates anchors (x/plan §3g), (c) defines reset as an epoch (Codex issue-3), (d) honors the X1
  ordering (server-derived reviewOnlyDay before W3's class_progress lockdown), (e) migrates the 98 dual-enroll
  students' divergent docs (F-3's split is the input: conflict rule = anchor-validated max, per
  PLAN_list_progress_persist).
- **Method:** design synthesis over the two existing converged plans + W1-W3 + F-3/F-4 data; deliverable is the
  Task-2 master sequencing spec (foundation → Phase-1 deploy → cycling → override), with the migration's
  dry-run verification plan. **PIN standard:** every invariant (twi monotonic, csd non-demoting, anchor
  `twi=nwei+1`) restated against the new model with its enforcement point (X4). **Deliverable:**
  `inv_I6_foundation.md`. **Ideal (N1+N5):** this IS the ideal-model spec.

### I-7 · Override + challenge server-authoritative design (C-16/C-29/C-18) — GATED on I-6 + C-28 decision
- **Scope:** the teacher override callable (per-answer accept / regrade / mark-day-passed — decide the minimal
  set per Codex Q), mirroring `cs/manual-pass` anchor validity; role trust resolution (custom claim vs field
  whitelist — pick ONE, spec the migration); W1/W2/W3 rollout order honoring X1; token-policy product decision
  matrix for David (should accepts consume? refund on grader-error? replace 30d?), student-facing token UI copy.
- **Deliverable:** `inv_I7_override_design.md`. **Ideal (N4/N5):** teacher corrections are first-class,
  auditable, forge-proof.

### I-8 · Read-surface fixes spec (C-33/C-34/C-35)
- Small, self-contained: server-side studentId filter for `queryTeacherAttempts` (+ composite indexes needed —
  answer Codex's index question); gradebook handling of testId-less rows (F-8 sizes it); the six-site
  `assignedLists?.length` fix + the standing sweep hook. **Deliverable:** `inv_I8_read_surfaces.md`.
  **Ideal (N6):** each surface's query semantics == its UI claim.

### I-9 · Review-model + legibility product spec (C-20/C-21/C-37 + plan §6 Phase 2)
- Retake/void affordance with superseded-marker audit trail; teacher review-quality surfacing + intervention
  alerts (F-13 sets thresholds empirically); the recovery/finished/oscillation hero states; position-vs-day
  display for cross-pace moves (C-05/D9). **Deliverable:** `inv_I9_review_model.md`. **Ideal (N3/N4/N6).**

### I-10 · Promotion permission-gap trace (C-19) — nobody has code-traced it
- **Hypothesis:** challenge/grade visibility is scoped to the CURRENT class roster (teacher view) while the
  attempt carries the OLD classId → after promotion neither the old nor new class's TA can act on it.
- **Method:** trace the challenge-review + gradebook authz path (who can see/act on an attempt, by what
  classId/teacherId predicate); confirm against F-6b's exported evidence pairs. PIN = the exact predicate line.
- **Deliverable:** `inv_I10_permission_gap.md`. **Ideal (N1/N4):** permission follows the attempt/(student,list).

---

## §4 — WS-V: 1.5 H1 verification-gate completion (parallel, anytime)

Re-trace the remaining `[V-prior]`/`plausible-unverified` anchors so no fix plan builds on a stale citation
(ledger's open list + items this consolidation leaned on):
1. `firestore.rules` FULL owner-write block (does anything whitelist/exclude `role`?) — C-28's caveat.
2. `testRecovery.js:98-110` nonce fallback + the full token→docId binding chain — C-32's unverified leg (feeds I-5).
3. `functions/index.js` grading prompt (the "restating" rule's current text) — C-17 (feeds I-4).
4. `gradeTypedTest` listId-gated backfill — C-26.
5. `gradeWithRetry` error branching — C-27.
6. `completeSessionFromTest` newWordsTestPassed derivation — C-25.
7. `MCQTest.jsx:322-324` legacy throw + `DailySessionFlow.jsx:817-826` dead-end lines — C-11 citations.
8. Codex's line-cites adopted above without an independent trace: `TypedTest.jsx:1122-1125` retake regen,
   `:819-860` day-stamping, `ClassDetail.jsx:387-401` unassign warn, result-card recompute `:1303-1333`/MCQ.
Anything that fails re-trace → update CONSOLIDATED_ISSUES tags + statuses immediately (the ledger's #10
self-correction is the model).

---

## §5 — Execution order, dependencies, Task-2 gates

**Wave 0 (done):** census v1 + this consolidation.

**Wave 1 (parallel, start now):**
- Orchestrator: **F-1** (top TODO — deploy-state truth), then F-2, F-3(+3b), F-4(+4b/4c), F-5 (quick), F-9.
- Agents: **I-2** (predicate matrix — pure code), **I-8**, **I-10**, **WS-V** items 1–8.
- Note: F-6/F-7/F-8/F-11/F-12/F-13/F-14 are independent — run as orchestrator bandwidth allows, F-14 early
  (it gates I-1's hypothesis pruning).

**Wave 2 (data-gated):**
- **I-1** (needs F-14 + F-3(c); repro executes wherever Vite/Playwright can run — not this WSL).
- **I-3** (needs F-2). **I-4** (needs F-7 + WS-V item 3). **I-5** (needs F-9/F-1 + WS-V item 2).
- **I-6 foundation design** (needs F-3/F-4 for migration inputs; consumes I-2's state-machine table).

**Wave 3 (design-gated):** **I-7** (needs I-6 + the C-28 role decision), **I-9** (needs F-13; folds plan §6 Phase 2).

**Gates for Task 2 planning (do NOT start Task-2 fix plans before these land):**
1. **F-1 attribution** — you cannot sequence deploys while the 3088/17 signals are unattributed.
2. **F-9 deploy-state probe** — establishes what prod actually runs (the #9/#10/#11 "fixed-in-tree" premise).
3. **I-6 foundation spec** — the keystone: Task 2's ordering (foundation → deploy Phase-1 → cycling → override)
   hangs off it, per X1–X4.
4. **I-1 verdict** (pinned mechanism OR explicit "unpinned — mitigate via foundation + first-entry guard").
5. **F-4 H/P/B partition** — the impact ground truth every Task-2 plan cites for blast radius and the
   before/after acceptance metric.
6. **WS-V complete** — no Task-2 plan may cite an un-retraced anchor (H1).

**Deliverable routing:** F-exports → `audit/deepfix/task1/firebase/`; I-briefs' findings →
`audit/deepfix/task1/investigations/inv_*.md`; status + evidence-tag updates flow back into
`CONSOLIDATED_ISSUES.md` (single source of truth for issue state). CS-write suggestions arising from any scan
(e.g. F-5's 12 config rows, F-3's consolidation candidates) go to David as SUPPORT_RUNBOOK proposals — never
executed from an investigation.
