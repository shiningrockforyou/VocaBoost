# Task 3 — implementation adjudication log

Per-phase Codex/verifier findings on the implementation, H1-verified before folding.

## P0 (G1 disarm) — orchestrator, no review needed
`functions/index.js:58→66` `GRADE_TOKEN_ENFORCED true→false` (aligns HEAD to prod per F-9). node --check clean. Diff: `phase0_diff.patch`.

## P2 (read-surfaces) — orchestrator + agent, orchestrator-verified
C-35 (orchestrator: helper + 6 sites), C-34/C-33/C-23 (agent, orchestrator-verified against code). All confirmed:
field-first listId, server-side studentId filter + 2 indexes, result cards trust server `passed`/fail-open. node
--check clean. Diff: `phase2_diff.patch`. (I-8 §2.2 full-un-drop noted as an optional 2-line follow-up.)

## P3 (FND-1 foundation server surface) — Codex round 1 → NEEDS_FIXES (blockers=0, high=2)
`codex_reviews/codex_deepfix_task3_p3_001.md`. **DESIGN VALIDATED — no blocker.** Codex confirmed: all 7 foundation
flags dormant (false); G1 disarm preserved; `resolveListProgress` read-only PRESERVES the legacy launch-class
class_progress recon write (F4-1) AND creates ZERO canonical docs; the launch-view top-level return is CORRECT
(U5 — returning the merged view would recreate the F4-1 day-guard rejection); `completeSession` transaction is
stronger than the current read-then-write; M4 shadow log-only+dormant; nonce F2 additive.

**14 uncertainties adjudicated by Codex: 13 accepted, 1 (U4) → HIGH-2.** (U1 accept w/ required S8 fixture
diff-check; U2 idempotency accept; U3 streak-tz accept; U5 launch-view ACCEPT; U6-U14 accept.)

**2 HIGH (both W2-marker / C-14-fix path) — VERIFIED-TRUE + folding:**
| # | Finding | Verification [V-now] | Fix (folding) |
|---|---|---|---|
| H1 | `writeUpgradedReviewMarker` returns `alreadyWritten:true` on an existing marker → never UPGRADES a legacy range-less/testId-less marker → stays unpairable | `foundation.js:672` early-return; upgraded fields only on new-doc branch | Merge upgraded fields into an owned existing marker when shape is legacy (derive range); `upgraded:true`; true no-op only if already upgraded; log `review_marker_anchor_missing` if no anchor |
| H2 | `completeSession` suppresses the marker on ANY same-day review (`dayReviewExists` ignores range/lineage) → a different-range review suppresses the only pairable marker → phantom `anchorDay−1` loop (C-14) | `foundation.js:497-512` (broad predicate) + `:1038-1043` (skip on hasReview) | Replace with a PAIRABILITY check (`getReviewForDayServer`, already ported `:429-464`); suppress only when a range-pairing review exists; none→write/upgrade; query-error→fail safe |

**Adjudication: both ACCEPTED (verified against the draft's own code). Rejected: none.** Folded → P3 agent.

### P3 Codex round 2 (delta) — `codex_deepfix_task3_p3_002.md` — **VERDICT 0/0/0/0 GO / CONVERGED-OK**
Both highs confirmed FIXED (H1 upgrade-in-place `foundation.js:699-716`; H2 pairability via `getReviewForDayServer`
`:1066-1123`), no new defect. **P3 FOUNDATION = DONE** (Codex-reviewed draft; `functions/foundation.js` 1736 lines +
`functions/index.js` hooks, all dormant behind 7 false flags; execution-verification = Task 6, env-blocked).
Carryforwards to Task-6 acceptance: the U1 S8 fixture diff-check; the index-live assertion. **P4-P7 unblocked**
(they build on the validated foundation) — sequence them after P8 lands (P4 shares db.js/Dashboard.jsx with P8).

## P8 (CONT-A) — agent, orchestrator-verified
David's continuation feature, behind `CONTINUATION_LINKS` (default off, `featureFlags.js:55`). VERIFIED: F6-5
pin-branch focus-yield applied at both pin returns (`Dashboard.jsx:1117/1128`) + recency via `resolveContinuation`;
§2.1 SAFETY FALSIFIER HOLDS (no CONT-A path writes the finished list's twi/csd — diff shows only reads + a
no-write comment); `nextListId` validated at `db.js:946-964`; choice terminal + `onAdvance`; "Start over" NOT
rendered (capability-gated to P9). node --check clean. Diff: `phase8_diff.patch` (803 lines). Uncertainties U1-U5
(dual-enroll launching-class semantics per plan §8e) → Task-6 / verifier pass. **P8 = done (draft).**

## P5 (migration script) — Codex round 1 → NEEDS_FIXES (blocker=1, high=1, med=1); CORE VALIDATED
`codex_reviews/codex_deepfix_task3_p5_001.md`. Codex CONFIRMED the core: TWI anchor-validated-max matches live
`db.js:3239` semantics; anchorless/above-anchor → quarantine (not zeroed/promoted); `reviewOnlyDay` correctly NOT
used as durable evidence; `--dry` write-free; backups-before-writes; U1-U4/U6-U10 accepted. 3 fail-closed holes —
ALL VERIFIED-TRUE + folding:
| # | Sev | Finding | Verification [V-now] | Fix |
|---|---|---|---|---|
| P5-1 | BLOCKER | `--catchup` (`:617-642`) merges late docs (Math.max csd/ancillary) with NO quarantine/action gate → a quarantined csd=999 can promote canonical | commit gates `:562`, catchup doesn't | catchup fail-closed on assertFailures>0\|\|quarTotal>0 + skip any SKIP_QUARANTINE/quarantine/SKIP_ERROR pair |
| P5-2 | HIGH | A6 "evidence alone" unenforced — calendar-only CSD rescue silently passes (`:347-348` reports, never fails) | csdPassedOnlyByCalendar not asserted | promote to HARD A6 fail for gap≥2 (default enforces durable evidence; --csd-mode knob) |
| P5-3 | MED | `:660 process.exit(assertFailures>0?2:0)` ignores quarTotal → --dry green with quarantine>0 | precondition = asserts-pass AND quarantine=0 | `notReady = assertFailures>0\|\|quarTotal>0; exit(notReady?2:0)` + FINAL:NOT_READY line |
**Adjudication: all 3 ACCEPTED (verified). Rejected: none.** Folding → P5 agent, then Codex round 2 (delta).

### P5 Codex round 2 (delta) — `codex_deepfix_task3_p5_002.md` — **GO / CONVERGED-OK**
All 3 fixes confirmed (catchup fail-closed; A6 evidence-binding; quarantine-bearing dry run non-green). **P5
MIGRATION = DONE** (Codex-reviewed draft; `scripts/cs/deepfix-migrate-list-progress.mjs`, --dry-only in Claude's
hands; ready for David's 25WT rehearsal → owner-authorized 26SM run under the P5 runbook/off-peak/watch-window).
Both hardest foundation pieces (P3 server surface + P5 migration) now Codex-GO.

## P4 (client cutover) — agent, orchestrator-verified (draft) + U13 completion in progress
12-file dormant draft (SERVER_PROGRESS_WRITE/SERVER_RESET_PROGRESS default false). VERIFIED: flags dormant; nonce F1
(single derivation, reuse gradeAttemptDocId :771/:896 + divergence tripwire) + F3 (memoized Map→localStorage→
sessionStorage, catch never re-mints); recordSessionCompletion→completeSession shim; hydration→resolveListProgress
fail-open + F6-2 teacher canonical-first; F6-3 reset→resetProgress (Settings.jsx sole caller); dormant
permission-denied handler; build stamp (I-5 G3); Dashboard Panel C resolver read (retires impossible_phase noise).
node --check OK on all 5 .js; flag-off byte-equivalent (except the 2 deliberate inert items). **GAP found + being
closed:** U13 — `reviewChallenge` day-advance (`db.js:2899-2900`) still writes class_progress directly (3rd twi
writer, F5-HIGH-2) — NOT routed to `advanceForChallenge`; agent completing the routing (behind SERVER_CHALLENGE_WRITE)
before the P4 Codex review. Other open uncertainties U14 (teacher read-order client-side) / U5 (resolver P5 revisit) /
U3-U4 (flag-on return shape) → Codex P4 review.

### P4 Codex round 1 — `codex_deepfix_task3_p4_001.md` — **GO / CONVERGED-OK (0/0/0/0)**
P4 client cutover validated on first pass (incl. U13 reviewChallenge→advanceForChallenge). Codex confirmed flag-off
byte-equivalence + the nonce F1/F3/F2 + the shims + reset routing + teacher read + build stamp. Operational acceptance
(storage-stubbed nonce, reset/teacher/challenge personas, list_progress-empty-pre-P5, build-stamp probe) → Task 6.
**P4 = DONE. FOUNDATION CORE COMPLETE + Codex-GO: P3 + P4 + P5.** → P6 (rules cutoff) unblocked.

## P6 (rules cutoff) — Codex round 1 → NEEDS_FIXES (blocker=1); RULES themselves CORRECT
`codex_deepfix_task3_p6_001.md`. Codex CONFIRMED the rules close the intended holes (C-28 role self-write, C-29
attempt create/answers/delete, role split, provisioning coherent + dormant, SERVER_REVIEW_MARKER precondition noted).
The ONE blocker (P6-1) is the R1 over-deny — but its FIX is at the CLIENT boundary (P4), not the rules:
- **P6-1 [BLOCKER, VERIFIED]:** entry-time `getOrCreateClassProgress` (`progressService.js:112-114`) FALLS THROUGH
  to a legacy client `setDoc`/`updateDoc` (`:134`/`:283`) on resolver failure (fail-open); P6 denies those writes →
  a resolver outage strands live students with a raw session-load error (`DailySessionFlow:872-874` shows only the
  raw error; the P4 `legacy_write_denied` handler covers only COMPLETION, not entry-time). FIX (P4/client): when
  SERVER_PROGRESS_WRITE on + owner, DON'T fall through to a client write — fail CLOSED with a typed
  `progress_resolver_unavailable` error; extend the denial UX/log to the entry-init handlers (DailySessionFlow/Typed/MCQ);
  Task-6 persona for resolver-unavailable. ACCEPTED. Delegated to the P4 agent. → then Codex P6 round 2 confirms.

## P6 Codex round 2 — `codex_deepfix_task3_p6_002.md` — NEEDS_FIXES (blocker=1, med=1)
R1 outage-fallthrough CONFIRMED FIXED. Deeper 2nd finding (the R1 fix was necessary-not-sufficient):
- **P6-2 [BLOCKER, VERIFIED]:** `getOrCreateClassProgressViaResolver` (`progressService.js:394`) `await resolveFn()`
  but DISCARDS the payload, then rereads the legacy `class_progress` doc → returns `null` on miss (`:404`). Post-P5,
  canonical `list_progress` exists but the launching `class_progress` may not → a HEALTHY resolver becomes a false
  `progress_resolver_unavailable` → strands students on fresh/new class-list paths under P6. FIX: CONSUME the
  resolveFn response — return the legacy doc when present (parity); else synthesize `{progress, attempts}` from the
  canonical result (stable id/classId/listId); fail-closed ONLY on a genuine resolver error. ACCEPTED → P4 agent.
- **P6-3 [MED, VERIFIED]:** Typed/MCQ raw-denial branches (`TypedTest.jsx:857`) show UX but don't log
  `legacy_write_denied` (DailySessionFlow does). FIX: log it there too. ACCEPTED.

### P6 fix folded (P4 agent) → orchestrator-verified against code → Codex round 3 flipped
Both round-2 findings fixed CLIENT-side (rules unchanged); H1-verified against the actual code before flipping:
| # | Fix | Orchestrator verification [V-now] |
|---|-----|-----------------------------------|
| P6-2 | `getOrCreateClassProgressViaResolver` (`progressService.js:407-460`) now CONSUMES `result.data.mode`: `canonical`→local `list_progress/{listId}` read + synthesize `{id:classId_listId,classId,listId,...}` (wire `data` fallback), NEVER false-fails on resolver success w/ absent launching doc; `quarantined`→null; legacy→`class_progress` else `launch.data` synth; genuine error→null→caller fails closed w/ typed `progress_resolver_unavailable` | Read `:407-460` — branch logic matches; canonical success w/ missing launching doc returns synthesized progress (no false unavailable); only genuine error/unusable payload → null. CONFIRMED |
| P6-3 | `TypedTest.jsx:861-866` + `MCQTest.jsx:583-588` log `legacy_write_denied` (phase `test-entry-studyday`) on raw `permission-denied`, guarded by `isDenied` (inert otherwise) | Read both — `logSystemEvent('legacy_write_denied',…)` present, `isDenied`-gated → flag-off inert. CONFIRMED |
Flipped → Codex round 3 (delta) via `claude_to_codex_deepfix_task3_p6_003.md` (baton rev 42). Awaiting VERDICT.

### P6 Codex round 3 (delta) — `codex_deepfix_task3_p6_003.md` — **GO / CONVERGED-OK (0/0/0/0)** (baton rev 43)
Both fixes confirmed FIXED: P6-2 adapter consumes `result.data.mode` (canonical→local `list_progress` read+synthesize, never false-fails on success; quarantined→null; legacy→doc-or-`launch.data`; genuine error→null→fail closed), P6-3 Typed/MCQ log `legacy_write_denied`. Codex cross-checked `foundation.js`: hydrate-on-miss logs `mode:"hydrated"` but RETURNS `mode:"canonical"`+data → adapter's canonical branch covers both pre-existing + newly-hydrated. Flag-off equivalence holds (adapter gated on `SERVER_PROGRESS_WRITE`; new logging inert absent denial). Validated via real `npm run build` (node --check can't do .jsx). **P6 = DONE.**

## ★ FOUNDATION (P3 + P4 + P5 + P6) = Codex-complete ★
The one migration's server surface (P3), client cutover (P4), data-migration script (P5, --dry-only), and rules cutoff (P6) are all Codex-GO drafts, dormant behind flags / --dry, local-only. **Remaining Task-3 phases:** P7 (retire legacy `class_progress`), P9 (CYC cycling), P10 (OVR override). Rules cutoff still depends on the documented deploy preconditions + the emulator/persona matrix (Task 6) — which Codex now runs before deploy per [[codex-runs-playwright-audits]].

## P9 (CYC cycling capstone) — agent draft, orchestrator-verified (safety gate) → Codex round 1 flipped
Cycling capstone per x/plan v5, DOUBLE-gated dormant (global `CYCLING_ENABLED=false` client+server AND per-assignment `cyclingEnabled`). 9 files. **Orchestrator H1 (safety property = flag-off byte-equivalence in the LIVE-path files):** VERIFIED — `studyService.js:66-67` (`isCyclingActive = CYCLING_ENABLED && cyclingEnabled===true`) and `foundation.js:181-182` (`cyclingAllowed()`) both short-circuit on the global flag BEFORE any per-assignment read / behavior change; allocation (`:341-343`) + `isListComplete` (`:433`) take today's exact non-cycling expressions. Monotonic virtual index (twi never wraps; lookup wraps `positions[i mod cycleLength]`); reconciliation §3a untouched; review pool lap-bound (batch-clear dropped); lap-modular M4. Validation: parser ×9, eslint delta 0 vs reconstructed pre-P9 baseline, phase9_diff.patch git-apply-clean+round-trip. Deep correctness (resolver off-by-one, lap-modular-M4 within-lap validation, review-only×laps U3) → Codex. Flipped → Codex round 1 (`claude_to_codex_deepfix_task3_p9_001.md`, baton rev 44). U1-U12 in P9_impl_notes.md. **Remaining Task-3:** P10 (OVR) + P7 (retire-patch).

### P9 Codex round 1 — `codex_deepfix_task3_p9_001.md` — NEEDS_FIXES (blocker=1, high=2, med=1); dormant+build-clean but NOT correct-when-enabled
Codex ran `npm run build` (passed). All 4 findings orchestrator-VERIFIED against code (H1) → all TRUE, folding:
| # | Sev | Finding | Verification [V-now] | Fix (folding) |
|---|-----|---------|----------------------|---------------|
| P9-1 | BLOCKER | `cyclingEnabled` never threaded into `initializeDailySession` → cycling is DEAD even fully enabled | `DailySessionFlow.jsx:578-585` builds settings obj w/ pace/testSize/threshold, NO cyclingEnabled → `isCyclingActive` always undefined | thread the (cross-class-resolved) cycling capability into EVERY init call site (DSF/MCQ/Typed/PDF/debug) + add the flags-on→cyclingActive:true assertion |
| P9-2 | HIGH | §3b cross-class unlock not implemented (agent U9 deferral) | per-current-class only; no student+list scan | implement student+list effective-cycling resolver (any enrolled class on the list w/ cyclingEnabled unlocks; surface source class) in init + Dashboard/ClassDetail |
| P9-3 | HIGH | `cycleLength` from `lists.wordCount` ≠ `resolveVirtualRange`'s `positions.length` → moduli disagree on drift | `studyService.js:277` wordCount → `:541-543` review-bound; §2 = one-modulus CORRECTNESS rule | centralize `cycleLength = positions.length` for lapView/review-bound/failed-bound/display |
| P9-4 | MED | TypedTest standalone not lap-aware (agent U10) | `TypedTest.jsx:383` getNewWords no cycling arg | same fix as MCQ (subsumed by P9-1) |
Codex U-adjudication: U1(global flag) ACCEPTED; U2(lap-aware M4) accepted; U3(review-only×laps) still-owed pre-enable; U6→P9-3; U9→P9-2; U10→P9-4. **All ACCEPTED, folding → P9 agent resumed.** Then Codex round 2 (delta).

### P9 round-2 fold (agent) → orchestrator-verified → Codex round 2 flipped (baton rev 46)
All 4 fixed; H1-verified the load-bearing safety property (flag-off byte-equivalence) against code:
- **P9-1** fixed at ROOT: `initializeDailySession:355` self-resolves via new `resolveEffectiveCycling(userId,listId)`; old per-assignment `isCyclingActive` REMOVED (every session caller flows through init → all activate). **V-now:** `resolveEffectiveCycling:100` returns `{enabled:false}` BEFORE the `fetchStudentClasses:102` read → NO added read on the flag-off live path. CONFIRMED.
- **P9-2** cross-class unlock: pure `deriveEffectiveCycling(studentClasses,listId)` + `resolveEffectiveCycling` reusing `fetchStudentClasses`; "cycling enabled via {className}" affordance; ClassDetail uses class-own flag OR `twi>cycleLength` proxy. **V-now:** Dashboard (`:653/:1108/:1715/:2099`) + ClassDetail (`:91/:287/:429`) gate EVERY cycling path on `CYCLING_ENABLED` → flag-off = empty cycleLengths + legacy path. CONFIRMED.
- **P9-3** canonical `getCycleLength=positions.length` (getCountFromServer orderBy position) for review-bound/failed-bound/lapView/display; wordCount transient fallback only.
- **P9-4** TypedTest self-resolves + passes cyclingActive to getNewWords (MCQ parity).
Validation: harness `p9_assert.mjs` 15/15, parser ×10, eslint delta 0, phase9_diff.patch git-apply-clean+round-trip. Flipped → Codex round 2 (`claude_to_codex_deepfix_task3_p9_002.md`). Deep correctness (P9-2 proxy false-pos, P9-3 all-consumers, init-bypass) → Codex.

### P9 Codex round 2 — `codex_deepfix_task3_p9_002.md` — NEEDS_FIXES (blocker=1, high=1, med=1); client fixes confirmed
Codex confirmed P9-1 activation + P9-3 canonical cycle-length FIXED on the client (npm run build passed). Deeper findings — the cross-class unlock was CLIENT-ONLY:
| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| P9-5 | BLOCKER | server (foundation.js M4 `:791/:816`, completeSession `:985-999`, advanceForChallenge `:1684/:1745`) evaluates cycling from the CURRENT class only → client (cross-class) and server disagree → a cross-class cycler gets anchor_rejected / zeroed by server-authoritative completion | server-side `resolveEffectiveCyclingServer(studentId,listId)` (mirror deriveEffectiveCycling; CYCLING_ENABLED short-circuit first, no read when off) threaded into M4/completeSession/advanceForChallenge; harness client+server consistency case |
| P9-6 | HIGH | Dashboard `resolveContinuation` yield (`:1133-1135`) uses current-class `cyclingEnabled` → effectively-cycling list can still auto-yield to nextListId | gate yield on `deriveEffectiveCycling(studentClasses,current.id).enabled` inside CYCLING_ENABLED |
| P9-7 | MED | ClassDetail `twi>cycleLength` proxy false-negatives at exact boundary (twi===cycleLength) | document the exact-boundary limitation (teacher view, no cheap per-student cross-class data); keep proxy |
Codex notes: getCycleLength aggregate-count ACCEPTABLE (same population resolveVirtualRange wraps); fail-closed-to-legacy on count error acceptable-while-dormant; U3 review-only×laps still owed (not counted a blocker). **★ David decision (2026-07-14): implement cross-class FULLY (v5 §3b), NOT defer.** All ACCEPTED → P9 agent resumed for round-3 fold → Codex round 3.
**Process fix:** the round-2 review sat ~1h unprocessed (baton-watch was down). Recreated `docs/plans/loop/baton-watch.sh`; launch run_in_background after every flip-to-codex.

### P9 round-3 fold (agent) → orchestrator-verified → Codex round 3 flipped (baton rev 48) + watcher launched
- **P9-5** NEW server `resolveEffectiveCyclingServer(studentId,listId)` (`foundation.js:191`): reads `users/{uid}.enrolledClasses` → `getAll` class docs → any `assignments[listId].cyclingEnabled`; **V-now:** `:192` short-circuits `if(!CYCLING_ENABLED) return {enabled:false}` BEFORE any read (flag-off = ZERO added reads on the completion/M4 path); pre-transaction read; `cyclingAllowed(` grep-CLEAN (fully removed); all 3 legs (M4 `:847`, completeSession `:993`, advanceForChallenge `:1742`) call it. Client/server evaluate the same enrolledClasses→cyclingEnabled predicate.
- **P9-6** Dashboard `resolveContinuation` yield gated on `CYCLING_ENABLED && deriveEffectiveCycling(studentClasses,current.id).enabled`.
- **P9-7** ClassDetail exact-boundary limitation documented (kept strict `cyclingEnabled || twi>cycleLength` proxy).
Validation: harness `p9_assert.mjs` **21/21** (incl. client↔server cross-class consistency), parser ×10, eslint delta 0, phase9_diff.patch git-apply-clean+round-trip. Flipped → Codex round 3 (`claude_to_codex_deepfix_task3_p9_003.md`); baton-watch running (baseline 48). Re-review delta: client/server parity, pre-transaction-read race, P9-6 gate.

### P9 Codex round 3 — `codex_deepfix_task3_p9_003.md` — **GO / CONVERGED-OK** (baton rev 49; ~3h turnaround, caught by baton-watch)
Orchestrator-verified the review is a genuine 0/0: P9-5 server resolver (short-circuit-before-read, same enrolledClasses subject set as client, `cyclingAllowed` gone, all 3 legs) FIXED; P9-6 Dashboard yield FIXED (loading gate includes studentClassesLoading); P9-7 documented. Codex ran `npm run build` (pass). **★ P9 (CYC) = CONVERGED.** Carry-forward to PRE-ENABLE validation (not blockers): U3 review-only×laps re-verification; + Codex non-blocking note — `resolveEffectiveCyclingServer` fail-closed on read error could complete a true cross-class cycler under non-cycling semantics during a rare Admin-SDK read failure → consider making resolver read-failure a RETRYABLE failure for write paths before enabling.

## ★ Task-3 implementation status: P0-P6 + P8 + P9 all Codex-converged; drafts dormant. Remaining: **P10 (OVR)**, then **P7 (retire-patch)**.
P10 plan ready (`P10_IMPL_PLAN.md`): P10 is SMALLER than the FIX_PLAN implies (P4 already server-ported the challenge advance w/ clamp+phase-gate → P10(b)'s clamp/gate already done; P6 left in-file P10 rule TODOs). Proceeding on the decision-INDEPENDENT parts (a override callable + b reviewChallenge→server); parts (c) read-surface widening (needs U1 approach decision) + (d) rules narrowing (needs the C-28 role-model decision, U7 GATE) are HELD pending David.

### P10 (a)+(b) draft (agent) → orchestrator-verified → Codex round 1 flipped (baton rev 50) + watcher (baseline 50)
Shared spine: `runChallengeDayAdvanceTxn` (foundation.js:1681, extracted verbatim from advanceForChallenge's inline tx) + `assertOverrideAuthz` (:1765, I-10 §6 union). (a) `overrideAttempt` (:2090, SERVER_OVERRIDE_ENABLED=false): full valid anchor + shared-helper advance + audit log + union authz. (b) `reviewChallenge` server port (:1949, SERVER_REVIEW_CHALLENGE_ENABLED=false): client-legs port + shared-helper advance + union authz + two-hop. **Orchestrator H1:** both callables throw failed-precondition FIRST-statement (:1950/:2091, inert off); advanceForChallenge (:1899) rewired to the helper, still flag-gated (:1826), structurally byte-identical. Validation: parser ×4, eslint delta 0, phase10ab_diff.patch git-apply+round-trip cmp-clean. **★ Codex top priority:** is `runChallengeDayAdvanceTxn` a VERBATIM extraction (behavior drift on already-converged deploy-stack code = blocker)? + authz union, override anchor shape, port fidelity, U2/U3/U5/U7. (c)/(d) NOT in this review — resume on David's U1 + C-28 decisions.

### P10 (a)+(b) Codex round 1 — `codex_deepfix_task3_p10ab_001.md` — NEEDS_FIXES (blocker=1); refactor + byte-equiv CLEARED
Codex ran `node --check` + `npm run build` (pass). **CLEARED (the risks I flagged):** `runChallengeDayAdvanceTxn` extraction = NO behavior drift (verified the P4/P9 semantics preserved); flag-off byte-equivalence OK (both callables throw first-statement); reviewChallenge port acceptable; reviewChallenge authz target-bound. **One blocker:**
| # | Sev | Finding | Verification [V-now] | Fix |
|---|-----|---------|----------------------|-----|
| P10-1 | BLOCKER | `overrideAttempt` authorizes one target but WRITES another — a reconciliation-authoritative anchor forgeable for a student/class/list the caller doesn't own | `assertOverrideAuthz:1779-1784` authorizes on owning ANY of the student's enrolled classes (ignores target classId); write `:2145-2159` uses REQUEST-supplied studentId/classId/listId/studyDay, decoupled from authz. CONFIRMED | attemptId path: derive write target FROM the loaded attempt (reject on mismatch); orphan path: NEW target-bound authz (teacher AND owns THAT classId AND student enrolled in it AND it assigns listId) — no "any enrolled class" |
Codex U-adjudication: U2 fresh-anchor accept-after-fix; U3 two-hop accept; U4 class-precision = the P10-1 blocker; U5/U6/U7/U9 accept. ACCEPTED → P10 agent resumed for the fold → Codex round 2.

### P10 (a)+(b) round-2 fold (agent) → orchestrator-verified → Codex round 2 flipped (baton rev 52) + watcher (52)
P10-1 fixed via two-path target-binding in `overrideAttempt`: (1) attemptId path derives write target FROM the loaded attempt (`:2153-2179`, rejects conflicting request fields); (2) orphan path uses NEW `assertOverrideTargetAuthz` (`:1808`: teacher ∧ owns EXACT class ∧ student enrolled in it ∧ class assigns list — no "any enrolled class"). **Orchestrator H1 (read `:2150-2235` + `:1808-1833`):** both paths resolve `t*`; the write + docId (`:2221`/`:2223`) consume `t*` (target-bound) → authorized subject === written subject; orphan authz strict; attemptId conflict-reject present; flag-off byte-equivalent (`:2134` first-statement throw). Agent's mid-run slip reverted foundation.js briefly → re-verified ALL round-1+round-2 symbols present (`assertOverrideAuthz:1765`, `assertOverrideTargetAuthz:1808`, `overrideAttempt:2133`, `reviewChallenge:1992`). Validation: parser ×4, eslint delta 0, phase10ab_diff.patch git-apply+round-trip cmp-clean. **★ DECISIONS IN (David 2026-07-14): U1=A teacherIds-array denorm+migration; role=A custom claim** → (c)/(d) unblocked, built once (a/b) converges (see P10_IMPL_PLAN ★ banner).

### P10 (a)+(b) Codex round 2 — `codex_deepfix_task3_p10ab_002.md` — **GO / CONVERGED-OK** (baton rev 53, ~2min)
Orchestrator-verified genuine 0/0: P10-1 target-binding fixed both paths (attemptId derives from loaded attempt; orphan `assertOverrideTargetAuthz`; write consumes `t*`) — Codex "no remaining authorize-X/write-Y path"; flag-off OK; `node --check`+`npm run build` pass. **★ P10 (a)+(b) = CONVERGED.** Carry-forward (non-blocking, → (c) UI/pre-enable): overrideAttempt always writes a `sessionType:'new'` anchor and the attemptId path doesn't require the loaded attempt to BE new-word — if the future UI can pass arbitrary attempts, add a server guard requiring a new-word target.

## Task-3 remaining: P10(c) read-surface [decision A: teacherIds-array + migration] → P10(d) role+rules [decision A: custom claim] → P7 retire-patch. Doing (c) then (d) as SEPARATE drafts (c=migration, d=auth/rules point-of-no-return → smaller focused reviews). P10(c) draft STARTED.

### P10(c) Codex round 1 — `codex_deepfix_task3_p10c_001.md` — NEEDS_FIXES (blocker=1); rest CLEARED
Codex ran `npm run build` + `node --check` (pass). **CLEARED:** the list-scoped membership set (Codex: "keep this narrower read scope unless David explicitly wants broad" → U1 SETTLED, no owner decision needed), disjunction budget (array-contains = factor 1), write-stamp coverage + reviewChallenge arrayUnion re-stamp, ex-roster pre-scan, the --dry migration. Flag-off dormancy intact. **One blocker:**
| # | Sev | Finding | Verification [V-now] | Fix |
|---|-----|---------|----------------------|-----|
| P10c-1 | BLOCKER | widened `array-contains teacherIds` query NOT readable under today's attempts rule (`firestore.rules:170-173`: studentId==uid \|\| teacherId==uid) → query fails at rules; the query+read-rule must co-release (I-10 §4) | rule confirmed lacks a teacherIds clause; comment ":168-169" defers "widening teacher reads" to P10 | add the ADDITIVE, field-guarded `uid ∈ resource.data.teacherIds` read clause to (c) — NARROWING stays in (d); TEACHER_IDS_READ must not flip until deployed rules allow teacherIds reads (fix the deploy checklist) |
My scoping error (told the agent to leave rules for (d)); the additive READ-rule widening belongs in (c) with the query. ACCEPTED → P10(c) agent resumed for the fold → Codex round 2.

### P10(c) Codex round 2 — `codex_deepfix_task3_p10c_002.md` — **GO / CONVERGED-OK** (baton rev 57)
Orchestrator-verified genuine 0/0: additive read clause (`firestore.rules:193`) grants EXACTLY `uid ∈ teacherIds`, existence-guarded (inert pre-backfill), no create/update/delete/narrowing change, deploy-order invariant correct. Codex confirmed no overgrant, existence guard OK, additive-only. (Rules emulator = Task 6.) **★ P10(c) = CONVERGED.**

## Task-3 remaining: **P10(d)** (custom-claim role [decision A] + rules NARROWING — the security point-of-no-return) → **P7** retire-patch. P10(d) draft STARTED (staged rules like P6; --dry claim backfill; dormant/LOCAL-only).

### P10(d) Codex round 1 — `codex_deepfix_task3_p10d_001.md` — NEEDS_FIXES (high=1, med=1); switch+narrowings+backfill+transition-model CLEARED
Codex ran `node --check` ×2 + `npm run build` (pass). **CLEARED:** isTeacher()→claim switch (fail-closed, isAuthenticated-guarded), the 2 named narrowings, the --dry backfill, AND the transition model (Option A "acceptable if the deploy checklist is enforced literally" — NOT a blocker; no owner decision needed). Two fixes:
| # | Sev | Finding | Verification [V-now] | Fix |
|---|-----|---------|----------------------|-----|
| P10d-1 | HIGH | users/{uid} teacher `challenges` update branch (`firestore.rules:146`) still open — any claim-teacher can mutate any student's challenges | confirmed the branch is ONLY the legacy client reviewChallenge teacher-write (db.js:2945, runs only when SERVER_OVERRIDE off); P10(b) moved it server-side → dead like the siblings | remove the `isTeacher()&&hasOnly(['challenges'])` OR-leg (owner-only), SERVER_OVERRIDE rollback-coupled (the agent's U6) |
| P10d-2 | MED | provisionTeacher REPLACES custom claims (`:2058`) vs the backfill's MERGE — clobbers future claims | `setCustomUserClaims(uid,{role:'teacher'})` no read-merge | merge: getUser().customClaims spread + role, inside the TEACHER_CLAIM_ENABLED block |
ACCEPTED → P10(d) agent resumed for the fold → Codex round 2. (Transition-model Option A stands — David's accepted re-login lag; Codex OK'd it as a hard operational gate.)

### P10(d) Codex round 2 — `codex_deepfix_task3_p10d_002.md` — **GO / CONVERGED-OK** (baton rev 61, ~1min)
Orchestrator-verified genuine 0/0: teacher-`challenges` OR-leg removed (owner-only + role/roleProvisioning exclusion intact); Codex re-checked all remaining `isTeacher()` sites (teacher-owned capability surfaces, not arbitrary student writes; attempts update stays `if false`; users-subcollection owner-only); provisionTeacher merge correct; (c) read clause intact; `npm run build` pass. **★ P10(d) = CONVERGED.**

## ★★ P10 FULLY DRAFTED (a+b+c+d all Codex-GO) ★★  — Task-3 impl: P0–P6, P8, P9, P10(a/b/c/d) all converged.
**Only P7 (FND-5 retirement) remains.** P7 DELETES the legacy paths the cutover made dead → breaks the flag-off/dormant model → **PREPARED as an inventory + patch, NOT applied to the working tree** (David applies post-deploy, ≥14d after P6). P7 STARTED. Then → the **2-Fable + Codex final whole-surface review** (David directive [[final-review-2fable-codex]]) → the Playwright audit (Task 6, Codex-run before deploy).

### P7 (FND-5 retirement) — PREPARED (inventory + apply-clean patch, NOT applied) → orchestrator-verified
`P7_RETIREMENT_INVENTORY.md` + `phase7_retirement.patch` (prepared-not-applied; David applies post-deploy per the [C8-1] 7-day-zero-`legacy_write_denied` + ≥14-day windows). **Conservative scoping (correct):** the PATCH contains only the verifiably-safe WRITE-PATH leg — 4 dead-branch deletions retiring 3 flags (SERVER_REVIEW_MARKER client automarker; SERVER_CHALLENGE_WRITE submitChallenge + reviewChallenge direct class_progress advance; SERVER_RESET_PROGRESS client reset batch-delete). **Deliberately EXCLUDED (flagged for the final review):** `dup_resume_branch` (sole trigger of the LIVE Re-Entry modal — not byte-equiv to remove; needs coordinated modal removal + visual regression); the reconciliation-core Leg-B collapse (LIST_SCOPED_RECON 39 / SERVER_PROGRESS_WRITE 23 / LIST_PROGRESS_CANONICAL 8 + ~90-ref class_progress reader graph — NO local behavioral harness to verify a hand-encoded CSD/TWI rewrite → enumerated with signatures for guided application under M-STATIC `--target=shipped`); the still-LIVE P10 flag-off branches (SERVER_OVERRIDE/TEACHER_IDS_READ — current prod behavior at P7, not soaked) + doc-role isTeacher() (a rules deploy, not P7's hosting target). KEEP: CONTINUATION_LINKS, CYCLING_ENABLED/cyclingEnabled, SERVER_ATTEMPT_WRITE. **Orchestrator H1: working tree UNCHANGED** (M-STATIC `--target=baseline` CLEAN 27/0 — RET-2 signatures + all 7 flags present); patch `git apply --check` clean. Structural findings for the final review: (1) the entire deepfix P0-P10 is UNCOMMITTED working-tree state — `git checkout` on any touched file destroys the dormant draft; the patch diffs dormant-draft→retired, NOT vs HEAD; (2) featureFlags hunks assume `=false` (dormant) — at apply-time they read `=true` (cutover-flipped), reconcile the value token. Uncertainties → the 2-Fable+Codex final review.

## ★★ TASK-3 IMPLEMENTATION COMPLETE ★★ P0–P10 full surface: P0-P6+P8+P9+P10(a-d) Codex-converged (dormant drafts); P7 prepared-not-applied. → NEXT: the **2-Fable + Codex final whole-surface review** (unblocked) + the **Task-5 Playwright harness build** (in progress) → **Task-6 Codex-run audit** before deploy → **Task-7 report**.

## FINAL REVIEW (2 Fable + Codex, David directive [[final-review-2fable-codex]]) — round 1 IN PROGRESS
3 reviewers launched on the full P0–P10 surface. **Codex (whole-surface cross-phase pass) = NEEDS_FIXES (baton rev 63):**
- **FINAL-1 [BLOCKER, orchestrator-CONFIRMED]:** the ONE physical `firestore.rules` combines the P6 cutoff (attempts create/update/delete:false, progress client-write denial, role split) AND the P10d claim-switch (`isTeacher()→token.role` :104-106) + narrowings (:156-159/:184/:282) — rules deploy atomically, so there is NO safe P6-only rules deploy from the tree. Deploy-at-P6 → P10d ships early → teachers locked out (claims not backfilled); deploy-at-P10 → the P6 write-lockdown is NOT enforced during P4–P9 → forgery surfaces open longer than the foundation claims. Neither safe. **FIX:** split into stage-specific deploy artifacts (P6-cutoff-only → P10c additive teacherIds read → P10d claim/narrowing) + ONE documented global cutover order; a P6 rules deploy must not be able to include P10d. This is the cross-phase composition gap the per-phase loop was structurally blind to.
- Codex CLEARED (cross-phase): P5-migration↔P7 no conflict; P7 deletes nothing still-needed; P9/P10 server-invariant composition consistent; teacherIds read additive (but its safe-anytime property needs the additive-only artifact — folds into FINAL-1).
Fable A (correctness) + Fable B (security/integration) still running → consolidate all 3, dedupe, H1-verify each, fold as ONE batch, then Codex delta re-review.

### FINAL REVIEW round 1 — ALL 3 IN → consolidated in `FINAL_REVIEW_FINDINGS.md` — **~13 real findings, all survived the per-phase loop**
The final review decisively earned its keep. Almost all findings are **flag-ON (P5/P9/P10) end-state** — day-one deploy safety + dormant-draft model HOLD (all 3 reviewers independently re-verified flag-off byte-equivalence + the already-folded per-phase fixes) — BUT several sit on the cutover gates and mean the FIX_PLAN's "the cutoff closes the forgery surfaces" claims are **partially overstated as coded.** Orchestrator H1-CONFIRMED the 4 top findings against code:
- **F-1 [BLOCKER]** Codex FINAL-1 = Fable-B BLOCKER-1: single `firestore.rules` combines P6 cutoff + P10d → no safe P6-only deploy (deploy@P6 locks teachers out; deploy@P10 leaves P6 lockdown unenforced through P4–P9). → deploy-artifact split + global order runbook.
- **F-2 [HIGH]** `ANCHOR_VALIDATION_ENFORCE` consumed NOWHERE (`foundation.js:74/119/842`) → the M4 backstop that closes C-31 doesn't exist; writeAttemptTxn echoes client nwei w/ only ≥0 check → forged anchor survives; flag-flip is a silent no-op. → wire the intended enforce.
- **F-3 [HIGH]** `resetProgress` canonical mode (`:1653-1662`) never zeros csd/twi → post-P5 reset is a no-op + creates the anchorless-corruption signature. → zero the canonical doc.
- **F-4 [HIGH]** `completeSession` day-guard (`:1033-1042`) requires no attempt evidence → csd/twi pumpable test-free + mints the markers the P5 screen trusts. → require evidence / exclude autoCompleted markers.
- F-5..F-13 + 3 nits (override anchor forge, resetEpoch zero-consumers, twi-quarantine invalid-anchor miss, getIdToken, challenge-token ledger, P9 Start-over, enrolledClasses trust, assignedLists, script exit codes, display nits) — see the doc's table.
**Posture:** folding the hardening to actually CLOSE the residual forgery surfaces (wire M4-enforce, require completeSession evidence, fix reset) rather than accept-as-monitored — closing them is the foundation's whole point. **Fold plan (partitioned by file):** A=foundation server security (F-2/3/4/5/6/7/12), B=rules/deploy-order (F-1), C=client/scripts/misc (F-8/9/10/13/nits); F-11 documented residual. → fold → Codex delta re-review.

**Fold B (F-1) DONE + orch-verified:** 3 stage-isolated rules artifacts (`firestore.p6.rules` doc-role isTeacher/no-P10d; `firestore.p10c.rules` +additive teacherIds read; working-tree `firestore.rules` = P10d final, rule-logic byte-identical / only header re-keyed) + `DEPLOY_ORDER.md` global runbook (R1 P6 → R2 P10c → R3 P10d strict-superset chain; proof a P6 deploy can't include P10d). M-STATIC baseline CLEAN. Flagged: firebase.json default-target hazard, P7 calendar-position ambiguity. `final_fold` in stage artifacts (not applied to working rules logic).
**Fold A (F-2/3/4/5/6/7/12) DONE + orch-verified:** `final_fold_a.patch` (foundation.js+index.js+db.js, +226/−42). **H1-VERIFIED the load-bearing:** F-6 the LIVE db.js `getMostRecentPassedNewTest:3530` epoch filter is gated behind dormant `SERVER_RESET_PROGRESS` → byte-equivalent today (zero extra reads); F-2 `validateAttemptAnchorShadow:899` early-returns both-flags-off (shadow-only byte-identical); M-STATIC baseline CLEAN (tree intact, both flags still false). Others (F-3/4/5/7/12) inside dormant callables → flag-ON correctness → Codex delta. Carryforwards to stream C / migration: fold progress_meta into the P5 migration canonical read; autoCompleted-exclusion in the migration evidence counter. **Fold C launched.** → then Codex delta re-review of the whole final-review batch.

**Fold C (F-8/9/10/13/N-1/2/3 + F-4/F-6 migration carryforwards) DONE + orch-verified:** F-8 Signup `getIdToken(true)` in finishTeacherRedemption (:54, behind invite flow); F-10 Start-over gated `CYCLING_ENABLED && sessionConfig.cyclingSourceClassId` (DSF:1976-1977, flag-off = button absent); F-13 both backfill scripts exit-2 on commit read-back mismatch; N-3 unused dedupe removed; F-6 carry (migration reads progress_meta tombstone, excludes pre-reset, carries resetAt); F-4 carry (migration `continue` on autoCompleted); N-1/2 documented; F-9 → P7 inventory note. eslint delta 0/0/0, patch round-trip clean, streams A/B untouched. M-STATIC baseline CLEAN (tree intact after all 3 folds). **ALL 13 FINDINGS FOLDED → Codex delta re-review (baton rev 64, DEEPFIX_TASK3_FINAL round 2) + watcher.** Convergence here = **FINAL REVIEW CONVERGED → implementation signed off** (pending Task-6 Playwright run).

### FINAL REVIEW Codex round 2 (delta) — `codex_deepfix_task3_final_002.md` — NEEDS_FIXES (blocker=1); ALL ELSE CLEARED
Codex ran `npm run build` + `node --check` (pass). **CLEARED:** F-1 stage-artifact split (firestore.p6.rules doc-role/no-P10d; p10c additive read; working-tree P10d final; DEPLOY_ORDER choreography — the original blocker fixed), F-2 enforce (real throw outside read-catch, dormant when off), F-3/F-5/F-6/F-7/F-12, F-8/F-10/F-13/N-3. **One new blocker:**
| # | Sev | Finding | Verification [V-now] | Fix |
|---|-----|---------|----------------------|-----|
| FINAL2-1 | BLOCKER | F-4 was SERVER-only: completeSession returns `{status:'no_evidence'}` (writes nothing, correct) but the CLIENT `recordSessionCompletionViaServer` (studyService.js:922) handles only day_guard_rejected(:956)/already_completed(:974) then falls through to the completed path (:982) → a refused completion shows success + can graduate reviewed words | confirmed the status handling — no_evidence not special-cased; docstring :910-919 says consumers read only those | wire the client: no_evidence → blocking sentinel `completionNotApplied` (progress:null, no history write), fail-closed on unknown status; propagate before graduateSegmentWords; block success UI in TypedTest/MCQTest (all flag-ON, byte-equiv off) |
ACCEPTED → stream-A agent resumed for the client fold → Codex round 3. **This is the LAST blocker; convergence = FINAL REVIEW CONVERGED → implementation signed off.**
**FINAL2-1 fold:** client no_evidence handling wired (studyService `recordSessionCompletionViaServer` → `completionNotApplied` sentinel + fail-closed on unknown status; `completeSessionFromTest` blocks before graduateSegmentWords; TypedTest/MCQTest block success UX) — flag-ON only, byte-equiv off; eslint delta 0, patch round-trip. Agent flagged a PARALLEL gap: `DailySessionFlow.jsx:1529` also graduates+completes without checking the sentinel → folding the DSF `completionNotApplied` check (in scope, dormant). **Surfaced PRE-EXISTING (non-deepfix) bug for David:** DSF:1529 also doesn't check `dayGuardRejected` (live under LIST_SCOPED_RECON) → a rare stale/duplicate DSF completion false-succeeds; documented as a SEPARATE finding (fixing changes live behavior → out of the deepfix byte-equivalence scope; David's call). → DSF fold → Codex round 3.

### FINAL REVIEW Codex round 3 — `codex_deepfix_task3_final_003.md` — **GO / CONVERGED-OK** (baton rev 67)
Orchestrator-verified genuine 0/0: FINAL2-1 fixed end-to-end (recordSessionCompletionViaServer no_evidence + fail-closed unknown status, no history write; completeSessionFromTest blocks before graduateSegmentWords; Typed/MCQ block success UX; DSF blocks before graduate/summary/COMPLETE); dayGuardRejected agreed-separate/tracked; flag-off byte-equivalence cleared; `npm run build` pass.

## ★★★ FINAL REVIEW CONVERGED → DEEPFIX IMPLEMENTATION SIGNED OFF ★★★
Full P0–P10 + P7 surface Codex-converged AND passed the 2-Fable + Codex defense-in-depth whole-surface review (all ~13 findings folded + re-verified). Day-one deploy safety + dormant-draft model intact. **Remaining:** Task-5 harness (M-STATIC/M-UI/M-WB done; M-MIG building, M-CALL/M-RULES/cert remain) → Task-6 Codex Playwright run (emulator for M-CALL/M-RULES) before deploy → Task-7 final report. Deploy sequence = `DEPLOY_ORDER.md`. Carry-forward for David: the pre-existing DSF `dayGuardRejected` false-success (separate non-deepfix fix); the FIX_PLAN acceptance claims the review found overstated-as-coded are now closed (M4-enforce wired, completeSession evidence-gated, reset zeros canonical).
