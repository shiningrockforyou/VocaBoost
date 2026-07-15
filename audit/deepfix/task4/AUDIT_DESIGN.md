# AUDIT DESIGN — deepfix Task 4, step 4.1: the ONE converged Playwright audit for the whole FIX_PLAN

**Status:** v1 draft for adversarial review (Codex + 3 verifiers). **Author:** AUDIT-DESIGN drafter (Task 4.1).
**Date:** 2026-07-13. **Mode:** READ-ONLY design — no code was written, no live-Firebase calls were made.
**Certifies:** the implemented phases of `audit/deepfix/task2/FIX_PLAN.md` v3 (P0–P10). Per David's directive
the audits run **ALL AT ONCE, after implementation is complete** — this design therefore certifies the
**end-state** behavior of every phase and *verifies-but-does-not-re-execute* transition-window and live-ops
criteria (§6 ledger). **The FIX_PLAN's per-phase ACCEPTANCE blocks are this audit's oracle set** — no scenario
asserts a behavior the FIX_PLAN does not specify (David: "always verify all claims… Never trust blindly.
Always verify" — every row cites its FIX_PLAN phase and, where the behavior is pinned in today's tree, the
`file:line` the FIX_PLAN itself verified `[V-P]`; behaviors that live in not-yet-written code cite the
FIX_PLAN phase+change number, with `file:line` to be pinned at implementation review).

**Reuses (does NOT restart):** the converged review-only audit design
(`docs/plans/PLAN_reviewonly_playwright_audit.md` v2 — hybrid E2E + white-box, fail-closed certification,
artifact binding, seed-then-pre-verify) and the built-never-run harness:
`audit/playwright/lsr_reviewonly.mjs` (RA1–RA9 UI matrix + manifest, `runScenario` at `:107`),
`lsr_reviewonly_whitebox.mjs` (W-RA3-gate/W-RA4/W-RA4b, `patchSessionConfig` `:59`),
`lsr_reviewonly_fb.mjs` (sandbox guard `:53-64`, seeds `:124-204`, `preVerify` `:223`, `snapshotState` `:111`,
`resetStudentState` `:242`), `lsr_ui.mjs` (import-time BASE guard `:23-31`, browser verbs), `lsr_persona.mjs`
(login/drive/oracle primitives). The review-only matrix (RA*/W-RA*) is **adopted verbatim as this audit's P1
block** and extended.

---

## §0 — Frame

### 0.1 What "one converged audit" means here
Five matrices, one program certification. Every matrix is fail-closed; the program certifies only when ALL
five are ALL-CLEAN on the SAME runId family:

| Matrix | Module (build) | Drives | Covers |
|---|---|---|---|
| **M-UI** | `lsr_reviewonly.mjs` extended → `lsr_deepfix_ui.mjs` | real browser vs `LSR_BASE_URL` | P1 S1–S10, P2, P4 personas, P8, P9, parts of P3/P10 |
| **M-WB** | `lsr_reviewonly_whitebox.mjs` extended | browser + documented `page.evaluate` exception | un-drivable gate paths (stale-0, absent config, crafted mismatch, storage-stub nonce) |
| **M-CALL** | NEW `lsr_deepfix_callable.mjs` | authenticated HTTPS callable invocations (sandbox ID token) | `completeSession` / `resolveListProgress` / `resetProgress` / W1 / W2 / M4 / override — server paths UI routing can't reach (day-guard reject, duplicate retry, forged anchors, derivation fixtures) |
| **M-RULES** | NEW `lsr_deepfix_rules.mjs` | Firestore client-SDK/REST writes signed in AS a sandbox identity (Admin SDK bypasses rules — useless for denial oracles) | P6 cutoff matrix + P10 narrowing: every forgery DENIED, every happy path ALLOWED |
| **M-MIG** | NEW `lsr_deepfix_migrate_audit.mjs` | the P5 migration script itself (`--dry` then commit) against a SEEDED 25WT cohort | P5 merge/screen/quarantine/idempotency/catch-up + P7 retirement + CS-toolchain retarget |
| **M-STATIC** | NEW `lsr_deepfix_static.mjs` (runs even in this WSL — read-only) | git/grep/bundle/probe assertions | P0 deploy-gate, P4/P6 bundle greps, P7 zero-refs, flag lifecycle |

(M-STATIC is the sixth block but certifies as part of the same program set; listed separately because it is
the only one runnable in this WSL.)

### 0.2 Environment truth (binding)
- This WSL **cannot** run Vite or Playwright (9p mount). M-UI/M-WB/M-CALL/M-RULES/M-MIG run on
  **Codex's/David's Windows env** (platform-matched node_modules) per `REVIEWONLY_HARNESS.md` preflight;
  M-STATIC may run anywhere with repo read access. Task 6 remains env-gated; this document is the runnable spec.
- Target = `http://localhost:5173` (Vite dev serving the implemented tree) via the EXISTING import-time
  fail-closed BASE guard (`lsr_ui.mjs:23-31` — default localhost, throws on any non-localhost/http origin).
  **NEVER** the live site.
- The Admin SDK, the callable probes, and the rules probes all hit the **prod Firebase project** — "local-only
  isolates the CODE, not the DATA" (review-only design §0). Data containment = sandbox-identity discipline
  (§4), fail-closed. **Sandbox only:** `lsr_*@vocaboost.test` students, `25WT`-prefixed classes, cloned lists.
  **NEVER 26SM.**
- Because the audit runs post-implementation, the deployed Cloud Functions + rules of the prod project ARE the
  artifacts under test: sandbox identities exercising them write only sandbox docs. The manifest binds the
  deployed `exports.version` probe output (sha/flags) so "what was tested" is provable (§2).

### 0.3 End-state vs transition vs live-ops (the all-at-once consequence, stated up front)
Running after completion means three FIX_PLAN criterion classes:
1. **END-STATE** — behavior of the finished system. Fully audit-certifiable. The scenario table (§1) is this class.
2. **TRANSITION-WINDOW** — true only mid-program (e.g. P4's "`list_progress` collection stays empty until P5";
   P3's "resolver read-only"; the 14-day no-legacy-write window). Unobservable post-P5 by construction. The
   audit **verifies the bound gate artifacts** (per-phase manifests/logs David/Codex captured at each gate)
   for existence + internal consistency, and asserts the strongest surviving end-state corollary (e.g. every
   canonical doc carries `migratedAt` from the migration script OR a straggler-hydration resolution log —
   "P5 was the sole canonical writer" evidence). Missing artifact = **INVALID**, never PASS. Ledger in §6.
3. **LIVE-OPS** — live-26SM numbers (F-4 H/P/B motion, M4 ≥14-day shadow rate, G5 watch signals). The audit
   is FORBIDDEN from touching live data; these stay David/CS-run census events using the (audited, §1 MIG-10)
   reworked toolchain. The audit certifies the MECHANISM and the INSTRUMENT, not the live number. Ledger in §6.

---

## §1 — Scenario table (one row per FIX_PLAN behavior/acceptance criterion)

Column key: **Type** E2E (M-UI), WB (M-WB), CALL (M-CALL), RULES (M-RULES), MIG (M-MIG), STAT (M-STATIC).
**Seed** names the fixture; all seeds are sandbox-triple-gated + pre-verified (§3). "—" = no data write needed.
Every row's target cites FIX_PLAN phase (+ `file:line` where the behavior is pinned in-tree `[V-P]`/I-2/I-6).

### 1.A — DG · P0 deploy-safety substrate (FIX_PLAN P0; I-5 G0–G5)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| DG-1 | Flag-assertion table holds at HEAD: `GRADE_TOKEN_ENFORCED`(`functions/index.js:58`)/`GRADE_TOKEN_MINT`(`:68`)/`GRADE_JOB_ENABLED`(`:90`), `featureFlags.js:10/:20/:28/:41` + the program's end-state flag values (P0 change 3) | grep values == the runbook table for the shipped phase set; mismatch = FAIL | STAT | — |
| DG-2 | Provenance consult (P0 change 4): deployed `exports.version` (`functions/index.js:1900`) answers `{sha == git HEAD of the recorded deploy, dirty:false, flags == DG-1 table}` | HTTPS probe JSON == expected triple | STAT | — |
| DG-3 | Client build stamp live (P0 change 5 → P4 deliverable): served bundle exposes commit sha via the probe | probe/page value == recorded hosting sha | STAT | — |
| DG-4 | Scoped-commit manifest + bundle hygiene (P0 change 1): the 3 #11 runtime files' recorded sha(s) exist in `git log`; the built bundle greps positive for the fix-unique string (`TypedTest.jsx:1755` "Couldn't Grade — Please Reload") and negative for any `audit/`/`scripts/` content | git + `dist/` grep both pass; missing manifest = INVALID | STAT | — |

### 1.B — RO · P1 review-only completion — the full I-2 S1–S10 day-state matrix (FIX_PLAN P1; predicate `studyService.js:1329-1335`, clamp `:1337-1342`, gate `:1430`, terminal `DailySessionFlow.jsx:822-835`, hero `Dashboard.jsx:1562-1565` `[V-P]`)

Adopted verbatim from the converged review-only design v2 (§2/§7) + 3 new rows for full S1–S10 coverage.
All UI oracles assert AFFIRMATIVE completion (`{outcome:results, csd+1, reviewAttempts+1, twi flat,
newWordScore:null}`), never merely "not blocked".

| ID | State | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|---|
| RA1 | S3 | Throttle review-only day completes; intervention recovers (I-2 §1.1b) | results screen, not retake-gate / `csd+1`, `twi` FLAT, `recentSessions[last].newWordScore===null`, next driven day `newWordCount>0` | E2E | `seedInterventionWindow` |
| RA2 | S3 | Persistent-low: every review-only day completes, no permanent block | each day completes / `csd`+1 per day, `twi` flat, no `requiresNewWordRetake` | E2E | RA1 seed + low reviews |
| RA3 | S2 | Assigned-new gate INTACT: failed new-word test still blocks (relabeled per v2) | RetakePhase visible / no `csd` advance | E2E | fresh day |
| RA5 | S4 | List-end + backlog completes; finished terminal + persistent hero | "You finished the list!" + Dashboard hero / `twi==listSize` flat, `csd+1` | E2E | `seedListEnd` |
| RA5b | S5 | Over-introduced: `twi` never DECREASES; `wordsIntroduced:0` (clamp `:1337-1342`) | terminal / `twi` exactly flat | E2E | `seedListEnd(twi>listSize)` |
| RA6 | S6 | All-mastered no-work terminal: completes NOTHING, records NOTHING (I-2 §1.1d) | terminal visible AND no review test / snapshot→settle≥12s→re-read: `csd`/`recentSessions`/`sessions` UNCHANGED | E2E | `seedAllMasteredTerminal` |
| RA7 | — | Teacher analytics render null newWordScore as "—"; no NaN averages (`ClassDetail.jsx:42` region) | PreviousSessionCell "—" / `avgNewWordScore` excludes null | E2E | after RA1 |
| RA8 | — | CSD non-demoting across review-only days; no corrupting orphan writes | csd climbs monotonically / no `csd_anchor_invalid` in `system_logs` | E2E | RA2 chain |
| RA9 | S8 | #9 REVIEW_STUDY resume keeps the REAL score (NOT null); twi not double-introduced (`studyService.js:247-274`, `db.js:3402-3443`) | completes normally / `recentSessions[last].newWordScore == real`, `newWordsTestPassed:true`, `twi` flat | E2E | `seedFix9Anchor` |
| RO-S1 | S1 | NEW — Day-1 new-only completes at submission (I-2 S1; `TypedTest.jsx:975-1037` region) | results / `csd:0→1`, `twi+=n`, anchor fields on the attempt | E2E | fresh student |
| RO-S9 | S9 | NEW — Finished steady-state re-entry: persistent hero, re-entry records nothing, no misleading "learn N new words" hero copy | hero persists across reloads; re-enter → terminal / all counters unchanged | E2E | post-RA5 state |
| RO-S10 | S10 | NEW — Day-guard collision surfaces as rebuild, never success (`progressService.js:441-452` semantics → server transactional per P3; `TypedTest.jsx:1051-1057`) | rebuild message, NOT results / exactly one `csd` advance; `day_guard_rejected…` log WITH uid | E2E+CALL | mid-session admin csd bump (sandbox) |
| W-RA4b | gate | Stale finite `newWordCount:0` on an ordinary day does NOT open the gate (ROI-1; un-drivable — v2 §7) | `requiresNewWordRetake` / no advance | WB | crafted `dailySessionState` |
| W-RA4 | gate | Absent config → gate applies (fails CLOSED) | blocked / no advance | WB | cleared state |
| W-RA3g | gate | `reviewOnlyDay:true` skips the gate; non-review-only unpassed day still blocks (`:1430`) | completes vs blocks / csd oracle both arms | WB | crafted pair |

### 1.C — RS · P2 read/render truth surfaces (FIX_PLAN P2; spec I-8)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| RS-1 | C-33 gradebook Name filter is SERVER-side: deep-ranked student appears on page 1 with working pagination (where-clause after `db.js:1931-1935` region; 2 composite indexes live) | filtered student's attempts on page 1; pager works / query returns rows without client post-filter reliance (post-filter retained as backstop `db.js:1982-1984`) | E2E | `seedDeepGradebook` (>50 attempts ahead of target — the 이지후 shape) |
| RS-2 | C-34 testId-less rows visible: field-first `attemptData.listId ?? parsedListId` (`db.js:1962-1978` region) | automarker/manual row renders with list title / row present in both gradebook query fns | E2E | `seedTestIdlessAttempt` (+ CS-5's marker doubles as fixture) |
| RS-3 | C-35 `getAssignedListIds` helper at the six sites (`db.js:502,1438,1531,1808,2314,2436` `[V-P]`); sweep gains the per-class signature | class with `assignedLists:[]` + populated `assignments` renders lists on student AND teacher surfaces / sweep signature count == 0 on 25WT | E2E+STAT | `seedAssignedListsEmpty` class |
| RS-4 | C-23 durable fix: result card renders SERVER `passed` (not recomputed); undefined retake threshold fails OPEN (`TypedTest.jsx:87` default, `studyService.js:305` resolution) | a genuine 90–91% under a 90-tier class DISPLAYS as pass; undefined-threshold assignment does not invent a 0.95 fail / attempt doc `passed:true` matches the render | E2E | `seedDriftedAssignment` (90-tier + undefined retakeThreshold, sandbox clone) |

### 1.D — CS · P3 server surface (FIX_PLAN P3 changes 1–9; callables have no tree `file:line` yet — pin at impl review)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| CS-1 | `completeSession` happy path (P3 c1): transaction writes `csd+1`, `twi+=wordsIntroduced`, appends `recentSessions` | driven day completes / canonical `list_progress` doc shows the triple; write is server-`writtenBy` | E2E | ordinary day |
| CS-2 | Transactional day-guard reject (P3 c1; supersedes racy `progressService.js:441-452`) | callable returns day-guard rejection WITH uid signal / exactly ONE advance; `day_guard_rejected_session_cleared` logged | CALL | concurrent double-complete |
| CS-3 | Idempotent duplicate retry (P3 c1 v3-MED): committed-but-lost retry of the SAME completion returns current state, no second `+1`; distinguished from a genuine collision | retry response == current state / `csd` advanced exactly once | CALL | replay same payload |
| CS-4 | Server `reviewOnlyDay` replicates ALL THREE client reasons (P3 c1 F4-2; client predicate `studyService.js:1329-1335`): fixtures S3 throttle, S4/S5 list-end/over-introduced, S8 REVIEW_STUDY-resume | per-fixture: server verdict == client predicate; S8 does NOT double-introduce / `twi` flat on all four; `wordsIntroduced==0` | CALL | 4 fixtures (reuse RA seeds) |
| CS-5 | W2 `markReviewComplete` UPGRADED output shape (P3 c5, v2 MED-6; today's marker writes none — `functions/index.js:580-597`): parseable `testId` + integer `newWordStartIndex/EndIndex == day anchor` | marker attempt fields exact / `getReviewForDay` (`db.js:3438-3444`) PAIRS it; row survives the gradebook parse (`db.js:1962-1977`) → visible in RS-2's surface | CALL+E2E | S7 fixture (see CUT-8) |
| CS-6 | M4 anchor validation ENFORCING at end-state (P3 c6 shadow → P6(d) enforce): asserts `nwsi===serverTwi`, `nwei===nwsi+count−1`, `count ≤ allocation` clamped to `wordsRemaining`, `studyDay===serverCsd+1` | forged anchor → clamp-or-reject + `anchor_rejected` log WITH uid; VALID anchor → silent pass (false-reject 0 on the whole M-UI run) | CALL | forged-anchor payloads ×4 fields |
| CS-7 | Nonce F2 server leg (P3 c7; today omitted at `functions/index.js:1051-1052`): grade return + cached job payload carry `attemptDocId` | response `.attemptDocId === bindCtx docId`; recovery-path response carries it too | CALL | typed grade round-trip |
| CS-8 | `resolveListProgress` end-state contract (P3 c2): canonical-first read; genuine straggler → hydrate-on-miss via the unified merge, merge-audited; quarantine `{mode:'quarantined'}` blocks study + logs; EVERY resolution logs `{uid, listId, anchorStatus, applied csd/twi, sources}` (the standing #12 tripwire, §6.1) | straggler's first entry creates canonical == merged legacy view; quarantined student sees blocked-study UX / resolution log shape exact; `list_progress_quarantined` logged | CALL+E2E | `seedLegacyOnlyStraggler`, `seedQuarantineCase` |
| CS-9 | `resetProgress` epoch semantics (P3 c3; persist §5.3): attempts wiped FIRST across ALL classes, `session_states/*_{listId}` cleared, legacy docs handled, `resetEpoch`/`resetAt` stamped; anchor queries EXCLUDE pre-epoch attempts | post-reset entry = Day 1; a pre-epoch passed attempt does NOT resurrect position / attempts count 0 across both seeded classes; epoch stamp present | CALL | dual-class attempt spread |
| CS-10 | Grading-job path validated (P3 c8, v2 HIGH-4): the 7-transition recovery suite + a sandbox typed smoke | reuse `dsg-edits/srv_validate/grading_job_tests.mjs` verbatim — all 7 green; smoke: grade→save one docId | CALL+E2E | suite's own fixtures |
| CS-11 | `reviewonly_derivation_mismatch` standing tripwire (P4 v3-MED): client preview disagreeing with server verdict at completion emits the event | crafted mismatch (W-RA4b-style injection) → event in `system_logs`; agreeing day → no event | WB | crafted preview |

### 1.E — CUT · P4 client cutover (FIX_PLAN P4)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| CUT-1 | Bundle greps (P4 acceptance; persist §6 P2 regexes): ZERO direct client progress writes, ZERO live client attempt-delete (`db.js:2958-2995` path dead), ZERO direct `class_progress` readers on student OR teacher surface | all three greps clean against the built bundle | STAT | — |
| CUT-2 | Reset-via-callable persona (v2 HIGH-3): every reset UI entry point routes to `resetProgress`; reset WORKS under the P6 rules | reset flow succeeds end-to-end post-cutoff / no client delete occurred (attempt docs removed by server; rules would deny client) | E2E | CS-9 fixture |
| CUT-3 | Teacher Students view reads via resolver (F6-2; was `fetchStudentsProgressForClass` `progressService.js:518` ← `ClassDetail.jsx:198`) | ClassDetail shows CORRECT reconciled progress for a migrated student AND a straggler / rendered values == canonical/resolver values, not stale legacy | E2E | migrated + straggler pair |
| CUT-4 | 3rd twi writer routed (F5-HIGH-2; legacy `db.js:2790-2833` dead): teacher challenge-accept advances via the server path — CLAMPED to `wordsRemaining`, twi derivation gated `phase==='new'` | teacher accepts challenge → student's day advances / foundation record `csd+1`, `twi` clamped; legacy class_progress doc UNTOUCHED; review-pass accept → NO twi bump (nwei:null hazard) | E2E+CALL | `seedPendingChallenge` (new-phase + review-phase variants, near-list-end for the clamp) |
| CUT-5 | Nonce F1+F3 client legs (P4; F1 kills the 2nd derivation `TypedTest.jsx:869-870`, F3 rewrites `testRecovery.js:98-111` memoized): storage-stubbed typed grade→save keeps ONE docId; `nonce_storage_degraded` emitted | round-trip succeeds with Storage get/setItem throwing / exactly ONE attempt doc; graded docId == saved docId; degraded event logged | WB | context-injected storage stub |
| CUT-6 | Denied-legacy-write handler (P4; [C6-2] — today both test pages swallow completion errors): a rules-denied write → visible reload prompt + `legacy_write_denied` event, never silent success | prompt visible / event logged; no fake results screen | WB | forced denied write via injected direct-write call |
| CUT-7 | Dashboard panel C consumes the reconciled read (P4; retires the emitter `Dashboard.jsx:1461-1464` on raw csd) | seeded csd-0-with-passed-day-1 state renders the RECONCILED day / NO `impossible_phase_detected` emission during the dashboard visit | E2E | `seedImpossiblePhaseT` |
| CUT-8 | C-14/S7 path fixed end-to-end (P4 acceptance; legacy automarker `DailySessionFlow.jsx:964-1008` bypassed `completeSessionFromTest`): mid-session all-mastered day → SERVER marker with real range + parseable testId → pairs + gradebook-visible; day CARRIES to a fresh doc | day completes; marker row visible in gradebook / marker fields per CS-5; a fresh progress doc for the same (student,list) reconciles to the FULL day (no anchorDay−1 phantom) | E2E | `seedS7MidSessionMastered` (new words pass, then pool empties) |

### 1.F — MIG · P5 the data migration (FIX_PLAN P5; merge rule = I-6 §2.1/persist §8; run on the SEEDED 25WT cohort — this formalizes the P5-required 25WT rehearsal with oracles)

| ID | Criterion (target) | Oracle (data; script-driven) | Type | Seed |
|---|---|---|---|---|
| MIG-1 | LIVE-STRAND collapse (the strand→anchor move; F-3 population 36): active doc behind the student's own cross-class anchor → canonical `twi` = anchor-validated max; nothing re-done | canonical `list_progress/{listId}`: `twi == cross-class anchor nwei+1`; `csd` = max plausible; F-3-signature re-scan on the sandbox cohort == 0 | MIG | `seedDualDocStrand` (doc A anchored ahead, doc B active behind) |
| MIG-2 | Divergent cross-pace [C4-1] + per-doc OWN-anchor CSD screen (v3 MED): fast doc wins twi; slow doc's higher session count SURVIVES, screened against its OWN anchor day | canonical `twi` = fast doc's anchor max; `csd` = slow doc's higher day, NOT quarantined | MIG | `seedDivergentPace` (pace-80 Day-8 vs pace-20 Day-15) |
| MIG-3 | Review-only CSD evidence amendment (v2 HIGH-5; I-6 §7.1 — the invariant-at-risk): N>1 consecutive post-anchor review-only days PASS the plausibility screen on DISTINCT post-anchor review-ATTEMPT evidence alone (keyed `(classId,listId,studyDay)`, capped 1/day) — no quarantine, no demote | `--dry` diff: student classified PASS; committed csd preserved (not demoted to anchorDay) | MIG | `seedReviewOnlyGapN` (anchor at day k, k+N review attempts, N≥3) |
| MIG-4 | Anchorless/forged high twi → QUARANTINE (never zero, never auto-promote); quarantine blocks study + logs | canonical `{mode:'quarantined'}`; original values preserved in backup; E2E: student blocked (CS-8 UX oracle); `list_progress_quarantined` logged | MIG+E2E | `seedForgedTwiHigh` (storedTWI ≫ anchor, no valid anchor) |
| MIG-5 | Single-doc 1:1 re-key (the ~633 shape): values verbatim, path + dropped fields only | byte-diff of value set except path/`classId`→`lastActiveClassId`/dropped fields; `programStartDate=min()`, `migratedAt` stamped | MIG | plain single-doc student |
| MIG-6 | Idempotent re-run (`migratedAt` stamps): second run is a no-op | run twice → zero additional diffs; no double-merge | MIG | after MIG-1..5 commit |
| MIG-7 | Post-flip catch-up pass (F4-4/F6-9): a completion landing on a LEGACY doc during the script run (`lastSessionAt > migratedAt`) is merged into canonical | delta pass folds the racing completion; canonical csd/twi include it; no loss | MIG | `seedRacingLegacyWrite` |
| MIG-8 | Errored anchor lookup ABORTS the student+list (moves nothing; §5 invariant row 4) | that student's docs untouched; abort logged; run continues for others | MIG | fixture with a malformed anchor attempt forcing query-error handling |
| MIG-9 | Cohort-wide hard asserts (P5 acceptance): 0 twi regressions, 0 csd regressions; backups exist per SOURCE doc; `--dry` full-diff artifact produced BEFORE commit; migration script is the only canonical-doc creator in the run | post-commit sweep over the whole seeded cohort: `twi_after ≥ twi_before`, `csd_after ≥ csd_before` for every student; backup file per source doc in the run dir; every canonical doc traces to the script (runId stamp) | MIG | whole 1.F cohort |
| MIG-10 | CS toolchain retarget (F6-3; X5 instrument): `data-integrity-sweep.mjs` + census read `list_progress` (no false-CLEAN off the dead collection); `manual-pass.mjs` writes a CANONICAL valid anchor (nwsi/nwei/wordsIntroduced/testId — the CLAUDE.md rule) | sweep flags a seeded corruption in `list_progress` and NOT via `class_progress`; manual-pass on a sandbox student yields a valid canonical anchor that CS-6's M4 accepts | MIG | seeded corrupt canonical + one stuck sandbox student |

### 1.G — RUL · P6 the cutoff rules matrix (FIX_PLAN P6; probes signed in AS sandbox identities — Admin SDK cannot test rules)

| ID | Criterion (target) | Oracle | Type | Seed |
|---|---|---|---|---|
| RUL-1 | W3: student attempt `create: false` (`firestore.rules:101-118` region) — forged attempt DENIED | PERMISSION_DENIED on client-SDK create | RULES | sandbox student token |
| RUL-2 | W3: student `answers`-update branch removed (was `:114-116`) | PERMISSION_DENIED on answers update of own attempt | RULES | seeded attempt |
| RUL-3 | Owner attempt-delete REMOVED (was `firestore.rules:120-122` `[V-P]`; the anchor-erasure half of the C-31 forgery) | PERMISSION_DENIED on own-attempt delete | RULES | seeded attempt |
| RUL-4 | Client progress writes DENIED: `class_progress` AND `list_progress` excluded from the users wildcard (`:45-48` restructured) — the forged-storedTWI half of C-31. With RUL-3 this starves the `safeTWI` hole (`progressService.js:236`) of BOTH inputs | PERMISSION_DENIED on direct twi/csd write to both collections | RULES | own docs |
| RUL-5 | M8 role split-by-op (v2 HIGH-2): owner UPDATE touching `role` DENIED; profile update (no role key) ALLOWED | denied / allowed pair | RULES | own user doc |
| RUL-6 | M8: self-`create` with `role:'teacher'` DENIED; create with `role:'student'`/absent ALLOWED (create stamps role — `db.js:221/:233`) | denied / allowed pair on a fresh sandbox uid | RULES | fresh auth user |
| RUL-7 | Happy paths PASS: owner reads, server writes land, teacher `reviewChallenge` branch works per shipped end-state (pre-P10: teacher branch alive per `:39-44` TODO; post-P10: narrowed to the server path — oracle keyed on the shipped set) | reads OK; challenge flow OK (E2E leg in CUT-4) | RULES | teacher + student pair |
| RUL-8 | Signup persona (F4-3): self-select-Teacher signup DENIED/removed (was `Signup.jsx:141-144`/`:38`); the provisioning path yields a legitimate teacher. **Mechanism is David's decision 10 — oracle parameterized, flagged §6** | signup UI has no working teacher self-select; provisioning path (as shipped) produces `role:'teacher'` server-side | E2E+RULES | fresh sandbox signup |
| RUL-9 | M4 ENFORCE at the rules layer's companion (P6(d)) — already CS-6; asserted here post-cutoff as the composite: forged anchor attempt cannot enter by ANY path (client create denied RUL-1 + callable clamps CS-6) | both arms hold in the same run | RULES+CALL | CS-6 payloads |

### 1.H — RET · P7 retirement (FIX_PLAN P7)

| ID | Criterion (target) | Oracle | Type | Seed |
|---|---|---|---|---|
| RET-1 | Zero `class_progress` readers/writers TREE-WIDE (src + functions + scripts/cs; covers student, teacher F6-2, CS toolchain F6-3) | grep == 0 before doc deletion | STAT | — |
| RET-2 | Retirement inventory executed (v3 MED): dead branch `DailySessionFlow.jsx:800-816` deleted (I-2 finding 4 — delete, don't modify); flag-OFF negative-TWI passthrough (`studyService.js:1342`) gone; client automarker leg (`DailySessionFlow.jsx:964-1008`) gone; client challenge day-advance (`db.js:2790-2833`) gone | greps for each signature == 0 | STAT | — |
| RET-3 | Legacy docs deleted + sweep clean (sandbox): after the deletion script, no `class_progress` docs remain for the 25WT cohort; the list_progress-shaped sweep is CLEAN | admin read: 0 legacy docs; sweep exit 0 | MIG | post-1.F cohort |
| RET-4 | Flag lifecycle: the ~7–8 transitional flags retired with their both-sides paths; `CONTINUATION_LINKS` NOT orphaned (stays live) | featureFlags grep: transitional flags absent, CONTINUATION_LINKS present | STAT | — |

### 1.I — CA · P8 CONT-A continuation part 1 (FIX_PLAN P8; terminal `DailySessionFlow.jsx:822-835`, hero `Dashboard.jsx:1562-1565`, focus `Dashboard.jsx:1057-1108` `[V-P]`)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| CA-1 | Choice terminal offers "Advance to {nextList} →" when the LAUNCHING class's assignment carries `nextListId` | button visible with correct list title / `assignments[listId].nextListId` read, not any other source | E2E | `seedNextListLink` |
| CA-2 | Advance is pure navigation + config read (the §2.1 falsifier): next list starts Day 1 via the EXISTING init path; the FINISHED list's record is NEVER touched again | next list Day-1 session runs / finished list's `list_progress`: zero writes (snapshot equality); next list's record created by the existing create-on-miss flow | E2E | CA-1 state |
| CA-3 | Focus-yield PIN branch (F6-5 — the ~287 population): a CS-pinned FINISHED list (`userSettings.primaryFocusListId`) yields to its `nextListId` | Dashboard primary focus = the NEXT list (pin resolved/advanced, not stuck) / pin fields advanced or cleared per impl | E2E | `seedPinnedFinished` |
| CA-4 | Focus-yield recency branch (`Dashboard.jsx:1084-1108`): unpinned finished list yields to next list | primary focus = next list | E2E | unpinned finished |
| CA-5 | Never a dead button: NO `nextListId` → the P1 static finished terminal exactly; "Start over" renders ONLY when CYC is live (capability-gated) | static terminal; no Advance, no Start-over pre-CYC / — | E2E | link absent |
| CA-6 | Dual-enroll: the LAUNCHING class's link governs (class=policy; §8.3 e) | finishing under class A offers A's next list even though B links differently | E2E | two classes, two links |

### 1.J — CY · P9 cycling (FIX_PLAN P9; x/plan §4 touch-list)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| CY-1 | "Start over" appears on the choice terminal only under `cyclingEnabled` (per-assignment, owner-teacher-only) | button present iff flag set on the launching assignment | E2E | `seedCyclingAssignment` |
| CY-2 | Lap rollover: monotonic VIRTUAL index — `twi` NEVER resets; physical word = `positions[i mod cycleLength]`; lap-aware display | lap-2 Day-1 serves lap-1's first words re-keyed; lap display correct / `twi` strictly increases past `listTotal` | E2E | finished small list, start-over chosen |
| CY-3 | Lap-2 day completes; M4 lap-aware (the clamp is lap-modular — a lap-2 day must NOT be anchor-rejected) | day completes / `anchor_rejected` count 0 for the lap-2 run; csd+1, twi+=n | E2E+CALL | CY-2 state |
| CY-4 | Review pool lap-bounded (`getUnmasteredPool`/`getFailedFromPreviousNewWords` per x/plan §3c) | lap-2 review draws only lap-2-eligible words / pool membership assert via study_states | E2E | mid-lap-2 |
| CY-5 | Review-only × laps re-verified (PLAN_review_only §7 — do NOT inherit the "zero recon change" claim): a review-only day INSIDE lap 2 completes with twi flat | RA1-style oracles on a lap-2 throttle day | E2E | lap-2 + intervention seed |
| CY-6 | Flag-off mid-lap: student re-dead-ends at the lap boundary into the P8 terminal — NO corruption | terminal renders; no write anomalies / counters coherent, no twi/csd regression | E2E | flip flag off mid-lap |
| CY-7 | Finished/focus test lap-aware (F6-5 tail): with cycling on, `twi ≥ listTotal` does NOT misfire the CA-3 yield every lap | mid-lap student keeps focus on the cycling list (no spurious advance) | E2E | CY-2 state + nextListId |

### 1.K — OV · P10 override + challenge redesign (FIX_PLAN P10)

| ID | Criterion (target) | Oracle (UI / data) | Type | Seed |
|---|---|---|---|---|
| OV-1 | Override callable: grader false-negative → teacher override → attempt carries a FULL VALID anchor (`newWordStartIndex/EndIndex/wordsIntroduced/testId` — manual-pass parity, the CLAUDE.md rule) → the day advances; audit-logged | teacher override UI/callable succeeds; student unstuck next entry / overridden attempt's anchor fields valid per CS-6's M4; `csd+1`; audit log row | E2E+CALL | `seedPermafail` (failed typed attempt, no tokens) |
| OV-2 | Override authz = the I-10 §6 UNION: `attempt.teacherId` stamp-owner ∪ current-enrollment owner both ALLOWED; an unrelated teacher DENIED | allowed/allowed/denied triple | CALL | promoted-student fixture (stamp=A, enrollment=B, outsider=C) |
| OV-3 | `reviewChallenge` server-side fixes BOTH I-6 §3-row-8 defects: twi delta CLAMPED to `wordsRemaining` (was unclamped `db.js:2831-2833`); twi derivation gated `phase==='new'` (review-pass `nwei:null` → NO `twi=1`) | near-list-end accept: twi clamps at listTotal; review-phase accept: twi unchanged | CALL | CUT-4 variants near list end |
| OV-4 | Orphaned-challenge persona (C-19): a promoted student's PENDING challenge becomes actionable by the new teacher | new teacher sees + accepts the challenge (was the literal "단어 권한이 없습니다" throw, `db.js:2665-2668`) / accept lands on the (student,list) record | E2E | promoted-student + pending challenge |
| OV-5 | Gradebook inherited-attempts leg + ex-roster filter (P10 read-surface leg; base predicate `db.js:1924-1928` can never show B's teacher the A-stamped attempt) | teacher B's gradebook shows the A-stamped attempt; name-filter on an ex-roster student returns rows, not hard-empty | E2E | OV-2 fixture |
| OV-6 | Rules narrowing LAST: `rules:45-48` teacher breadth → `isOwner`; attempts teacher-update branch narrowed — in the SAME release as the query change (I-10 §4) | outsider-teacher direct write to student subcollections DENIED; the OV-5 query still works (no rules backstop regression) | RULES | OV-2 identities |

**Count: 83 scenarios** (DG 4 · RO 15 · RS 4 · CS 11 · CUT 8 · MIG 10 · RUL 9 · RET 4 · CA 6 · CY 7 · OV 6),
≈ 37 E2E / 46 white-box (WB 5 · CALL 12 · RULES 9 · MIG 11 · STAT 9, counting hybrid rows once by primary layer).

---

## §2 — Fail-closed certification + artifact binding

Inherited from the review-only design §6 (Codex RAD-6) and extended for the multi-matrix program:

1. **Per-matrix manifest** (`findings/deepfix_<matrix>_manifest_<runId>.json`) binds: `runId`; **git-state
   marker** (`git rev-parse HEAD` + dirty flag); resolved `BASE` (`lsr_ui.mjs` value, never hardcoded);
   the EXACT scenario set attempted (subset runs cannot certify — the program manifest requires the full §1
   enumeration); per-scenario `{studentUid, classId, listId}` sandbox triple; per-scenario pre/post
   `snapshotState` hashes; per-scenario verdict ∈ {PASS, FAIL, INVALID} + `confirmed` flag (transient
   calibration inherited: a recovered grading/save transient on a confirmed intended outcome is exempt).
2. **Deployment binding (new, load-bearing for the all-at-once run):** the program manifest additionally
   binds (a) the deployed `exports.version` probe output `{sha, dirty, flags}` (DG-2), (b) the hosting
   build-stamp sha (DG-3), (c) `sha256(firestore.rules)` of the tree at runId time, (d) the migration run's
   script sha + backup-dir path (MIG-9). A mismatch between any of these and the recorded deploy shas =
   **program INVALID** — the audit must prove WHAT it tested, not just that tests ran.
3. **INVALID ≠ PASS.** Guard trips (base/identity/sandbox), cold dev server, un-materialized seeds
   (pre-verifier fail), missing gate artifacts (§6 ledger), unknown scenario IDs → INVALID; any INVALID or
   FAIL or PH-6 fatal app-health signal (console-error/page-error/dialog/auth) in any matrix → that matrix
   NOT-CLEAN → **no certification**. Exit 1.
4. **Program certification** = ALL matrices ALL-CLEAN on the same bound deployment + the §6 artifact ledger
   complete. One consolidated `findings/DEEPFIX_AUDIT_CERT_<runId>.md` states: matrices, counts, bindings,
   the §6 not-re-executed ledger, and the FIX_PLAN coverage map (§5) with per-row verdicts.

---

## §3 — Seeding strategy (clean seed + MANDATORY pre-verify — the RAD-3 lesson, program-wide)

- **Reuse:** `assertSandboxTriple` (`lsr_reviewonly_fb.mjs:53-64`) gates EVERY seed write;
  `seedInterventionWindow`/`seedListEnd`/`seedAllMasteredTerminal`/`seedFix9Anchor` (`:124-204`);
  `preVerify` (`:223`) + `snapshotState` (`:111`) + `resetStudentState` (`:242`) between scenarios.
- **New seed helpers** (same module family, same guard): `seedDeepGradebook`, `seedTestIdlessAttempt`,
  `seedAssignedListsEmpty`, `seedDriftedAssignment`, `seedS7MidSessionMastered`, `seedLegacyOnlyStraggler`,
  `seedQuarantineCase`, `seedPendingChallenge`, `seedImpossiblePhaseT`, `seedDualDocStrand`,
  `seedDivergentPace`, `seedReviewOnlyGapN`, `seedForgedTwiHigh`, `seedRacingLegacyWrite`,
  `seedNextListLink`, `seedPinnedFinished`, `seedCyclingAssignment`, `seedPermafail`, promoted-student
  fixture. Anchor-bearing seeds ALWAYS write the full valid anchor (nwsi/nwei/wordsIntroduced/testId —
  `manual-pass.mjs` parity) EXCEPT the deliberately-forged fixtures (CS-6, MIG-4, RUL-9), which are labeled
  and confined to their scenario's student.
- **Mandatory pre-verifier per scenario (hard rule):** after seeding and BEFORE the measured step, read back
  the seeded state and assert the INTENDED precondition materialized (e.g. RA-class: `initializeDailySession`
  yields `{isListComplete, newWordCount≤0, segment}`; MIG-class: legacy docs + anchors read back exactly;
  RUL-class: the auth token's uid == the fixture uid and the target path is sandbox; CA-class: `nextListId`
  present on the assignment) AND that no `csd_anchor_invalid`/`csd_implausible` appeared in `system_logs`
  during seeding (forged fixtures assert the EXPECTED log instead). A seed that didn't reproduce the state
  = INVALID, never PASS, never silently re-seeded.
- **Isolation:** one student per scenario where the pool allows (`SL_STUDENTS` rotation); otherwise
  `resetStudentState` + fresh snapshot between scenarios. The MIG cohort (1.F) is a dedicated student set,
  never shared with M-UI, so migration commits can't contaminate UI oracles.
- **Seeded-state faithfulness:** list-end seeds stay in the adjudicated-safe no-attempt shape
  (review-only design §4: preserved by `progressService.js:236`/`:233-234` non-demotion; `status:'none'`
  not `invalid-anchor`); seeded `csd` stays LOW on small clone lists to avoid the `csd_implausible`
  threshold.

---

## §4 — Local-only guards (H6) + run-environment plan

- **Base guard (exists, reused):** import-time fail-closed localhost-only assert in `lsr_ui.mjs:23-31` —
  every runner that opens a browser imports it; the live site is unreachable without editing that code.
- **Identity guard (exists, reused):** `LSR_TEACHER`/`SL_STUDENTS` must match `/^lsr_.*@vocaboost\.test$/`
  at runner start; **sandbox triple guard** before every seed/reset write (above).
- **NEW guards (same fail-closed pattern, required because new modules bypass the browser):**
  1. `lsr_deepfix_callable.mjs` + `lsr_deepfix_rules.mjs` mint ID tokens ONLY for emails passing the
     identity regex, and assert every request path's `{uid, classId, listId}` against the sandbox triple
     BEFORE sending — a probe against a non-sandbox doc throws (INVALID).
  2. `lsr_deepfix_migrate_audit.mjs` invokes the migration script with an EXPLICIT uid allowlist +
     `classNameRegex=25WT`; the driver independently re-verifies every doc the script's dry-run enumerates
     is allowlisted before authorizing commit — any non-allowlisted doc in the plan = ABORT (INVALID).
     Sweep/census invocations are always `classNameRegex=25WT`-scoped.
  3. `lsr_accept.mjs` (hardcoded live URL in its report label) remains BANNED this cycle (review-only §0.3).
  4. Admin SDK stays out of `lsr_ui.mjs` (its own policy, `lsr_ui.mjs:4-7`); oracle reads are strictly `.get()`.
- **Run environment:** this WSL runs ONLY M-STATIC. Codex/David's Windows env runs the rest per
  `REVIEWONLY_HARNESS.md` preflight (dev server + `curl -sf` SPA-shell check, `LSR_BASE_URL`, `LSR_AUDIT_PW`,
  sandbox accounts, `PLAYWRIGHT_BROWSERS_PATH`, platform-matched node_modules). Cold server = INVALID.
  The callable/rules probes additionally require the DEPLOYED functions+rules to be the recorded shas (DG-2/
  §2.2) — probing a half-deployed program is INVALID, not FAIL.
- **First-run calibration carry-over:** the REVIEWONLY_HARNESS A1–A3 assumptions + locator tuning remain
  flagged; new equivalents: the callable endpoint names/regions, the override UI locators, the choice-terminal
  copy, the provisioning mechanism (RUL-8).

---

## §5 — Coverage map (every FIX_PLAN phase → scenarios; nothing unaudited)

| FIX_PLAN phase | Acceptance criteria (abridged) | Scenario(s) | Not-audit-certifiable residue (→ §6) |
|---|---|---|---|
| **P0 FND-0** | flag table; provenance probe; scoped commit; runbook | DG-1..4 | runbook adoption + "commit is David's action" (procedural) |
| **P1 RO** | S1–S10 complete; §8 tests 1–8; day_guard→0; noise floor | RA1–RA9, RO-S1/S9/S10, W-RA3g/4/4b | F-4 wall-motion; G5 live watch |
| **P2 RS** | name filter + pagination; testId-less visible; assignedLists; C-23 inverse-mismatch | RS-1..4 | index deploy ordering (transition artifact) |
| **P3 FND-1** | sandbox E2E; 3-reason diff-check; idempotency; W2 shape; M4; grading-job suite; version probe; nonce F2 | CS-1..11 (+DG-2) | M4 ≥14d live shadow rate; live typed smoke |
| **P4 FND-2** | personas (reset/teacher-view/challenge-advance); greps; C-14 fixed; resolver writes zero canonical; impossible_phase→0; nonce F1/F3; build stamp | CUT-1..8 (+DG-3) | "list_progress empty until P5" (transition); live emission counts |
| **P5 FND-3** | 0 regressions; review-only-evidence screen; dual-enroll sig=0; F-3 re-scan 0; single-writer; toolchain retarget | MIG-1..10 | live F-4/F-3 re-runs; off-peak window + comms; David authorization chain |
| **P6 FND-4** | rules matrix; role matrix; signup persona; reset persona; M4 enforce; legacy_write_denied≈0 | RUL-1..9, CUT-2, CUT-6, CS-6 | 14-day no-legacy-write window + build-version census; live denied-write counts |
| **P7 FND-5** | zero-refs grep; retirement inventory; docs deleted; sweep clean; flags retired | RET-1..4 | 7-day zero-`legacy_write_denied` pre-deletion window |
| **P8 CONT-A** | terminal offer; pure-navigation advance; PIN-branch yield; never-dead-button; dual-enroll | CA-1..6 | 63-pending live population drain |
| **P9 CYC** | lap personas; review-only×laps; lap-aware M4; flag-off safety | CY-1..7 | F-12 live lap population |
| **P10 OVR** | permafail→unstuck; authz union; clamp+phase gate; orphaned challenge; inherited gradebook; rules narrowing | OV-1..6 | F-6 live permafail→0; P-population growth stop; token-policy comms (zero-code) |
| Cross-cutting §5 invariants | TWI monotonic/flat; CSD non-demoting; anchor identity; errored-lookups-move-nothing; day-guard; gate intact; pairing; teacher read; reset | RA5b/RA8/CS-2..6/CS-8/CS-9/CUT-2..4/MIG-1..9/RUL-3..4 | — |

---

## §6 — The honest ledger: criteria WITHOUT a concrete audit oracle (flagged, per the task's mandate)

Verified-as-artifact (existence + consistency checked by M-STATIC; **not re-executed**; missing = INVALID):
1. **P4 "resolver wrote ZERO canonical docs before P5"** — transition-window; unobservable post-migration.
   Audit substitute: MIG-9's single-writer trace + CS-8's straggler path; artifact: the P4-era gate manifest.
2. **P3 resolver READ-ONLY mode behavior** — same class; end-state corollary (canonical-first + straggler
   hydrate) is what CS-8 certifies.
3. **P6 preconditions** (14-day no-legacy-write window, build-version census [C8-1], 26SM quarantine=0
   [C7-2]) and **P7's 7-day zero-denial window** — dated live windows; artifacts only.
4. **P0/P5/P6 authorization chain** (David's scoped commit, CS-event entries per SUPPORT_RUNBOOK) — procedural.

Live-ops (FORBIDDEN to this audit; owner: David/CS with the MIG-10-audited toolchain):
5. **The F-4 H/P/B before/after motion per phase** (the program metric) — requires live 26SM census. The
   audit certifies the instrument (MIG-10) and every mechanism the motion depends on; it cannot and must not
   produce the live number.
6. **M4 shadow false-reject ≈ 0 over ≥14 days of live traffic** (P3) — audit proves shadow/enforce mechanism
   (CS-6); the live rate is a soak artifact.
7. **P1/P3 G5 watch-window signals** (permission-denied alert thresholds, rollback clock) — live monitoring.
8. **Population outcomes**: 183-wall drain (P1), 63-pending drain (P8), F-6 permafail→0 (P10), 531
   impossible_phase→0 live (P4) — sandbox personas prove the per-student mechanism; the counts are census.

Mechanism-dependent (oracle parameterized, cannot be finalized in this design):
9. **RUL-8 teacher provisioning** — the mechanism is David's open decision 10 (FIX_PLAN §7); the DENY arm is
   fully specified, the ALLOW arm is written against "the shipped provisioning path" and must be concretized
   at implementation review.
10. **P0 "never bare `firebase deploy`" standing rule** — procedural discipline; no runtime oracle exists.
    Closest check: DG-2/DG-3 provenance equality after every recorded deploy.

---

## §7 — Harness delta summary (reuse vs build)

| Reused as-is | Extended | New |
|---|---|---|
| BASE guard, identity guard, sandbox triple, `preVerify`, `snapshotState`, `resetStudentState`, findings/PH-6 protocol, manifest pattern, `runScenario` loop, RA1–RA9 + W-RA* scenarios, browser verbs (`enterReviewSession`, `driveTierTest`-family, `fillSubmitAndObserve`, teacher `provisionClass`), `grading_job_tests.mjs` | `lsr_deepfix_ui.mjs` (adds RO-S1/S9/S10, RS, CUT personas, CA, CY, OV E2E verbs: gradebook, ClassDetail, challenge accept, override, terminal/focus reads); `lsr_reviewonly_fb.mjs` → `lsr_deepfix_fb.mjs` (new seeds §3 + oracles for `list_progress`, resolution logs, epoch, marker shape); whitebox module (CS-11, CUT-5 storage stub, CUT-6 forced-deny) | `lsr_deepfix_callable.mjs` (authenticated callable probes + guards §4.1); `lsr_deepfix_rules.mjs` (client-SDK/REST rules matrix); `lsr_deepfix_migrate_audit.mjs` (25WT cohort seeder + migration driver + regression sweep); `lsr_deepfix_static.mjs` (DG/CUT-1/RET greps + probes); program cert consolidator |

**Design lineage:** hybrid E2E+white-box, fail-closed INVALID≠PASS, artifact binding, seed-then-pre-verify —
all carried forward from `PLAN_reviewonly_playwright_audit.md` v2 (Codex GO) unchanged; this document only
widens the scenario surface to the full FIX_PLAN and adds the four probe layers the wider surface requires.
