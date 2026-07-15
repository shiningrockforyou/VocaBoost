# ROOT CAUSE FINDINGS — deepfix Task 1.6 (the executed investigation)

**Author:** Claude (orchestrator). **Date:** 2026-07-13. Culmination of Task 1: per root — the ACTUAL root cause
(pinned to `file:line`, or "not pinned + what would pin it"), the LIVE blast radius (read-only 26SM data), the
ideal-app behavior it deviates from, and the convergence direction. Every finding is linked to Firebase evidence
where possible (David's directive). Inputs: the 3 issue lists → `CONSOLIDATED_ISSUES.md` (H1-gated,
`H1_GATE_1.5.md`) → 8 empirical scans (`firebase/scan_*` + `CENSUS*_FINDINGS.md`) → 5 code investigations
(`investigations/inv_I{2,5,6,8,10}.md`). Verification stance: H1 throughout — several agent claims corrected
against code (e.g. I-10 corrected the orchestrator's own C-19 gate note; I-2 corrected the F-1 impossible_phase
read; the #10 "0 live" claim was falsified by F-1).

---

## §0 — The ground-truth impact table (live 26SM, read-only, 2026-07-13)

817 students · **774 started** · data is **NOT corrupt** (invalidAnchor / csdImplausible / ghostProgress /
noClassAttempt ≈ 0). The failures are **structural / behavioral / deploy-state**, and **manual patches don't
hold** (24 of 45 hand-patched students re-stuck). The **H/P/B partition** is the Task-2 before/after metric:

| Class | Count | % of started | Meaning |
|---|---|---|---|
| **H** healthy | 541 | 70% | no active signature, no hand-patch |
| **P** hand-patched | 45 (21 holding, **24 re-stuck**) | 6% | a manual write reached them → evidence a bug hit a real student |
| **B** broken (active signature) | 188 | 24% | at #11 wall, live-strand, or undersized-test |

**Per-root live blast radius:** #11 review-only wall = **183** · cross-class carry (#6/#12) live = **~42** (36
active-strand + 6 divergent; +72 latent) · hand-patched override demand (#14/#1) = **45** · permanent-fail NOW
(#14) = **3** (all known cases) · #13 undersized tests = **18** (17 students) · #5 config-drift exposure = **12
assignments** · twi>mastery (#5-adjacent) = **4** · pending-challenge backlog = **614**.

---

## §1 — Root findings by cluster

### CR-1 · Progress identity is class-scoped, not student-owned  → the #1 structural root
- **Root cause (PINNED):** progress/session docs keyed `{classId}_{listId}` (`progressService.js:33-34`,
  `sessionService.js:55-56`). A class move creates a FRESH doc; `LIST_SCOPED_RECON` reconciles from attempts
  (`db.js:3239` anchor) but as an *overlay*, not the source of truth.
- **Live evidence:** **~42 students actively re-doing words** (F-3: 36 LIVE-STRAND where the actively-studied doc
  is ≥1 day behind the student's own cross-class anchor; 6 divergent) out of 141 dual-enroll student-lists; +72
  latent. **이주헌 (OCzwBwAb) re-split AFTER his 06-30 CS consolidation** → the condition RECURS structurally.
- **#12 sub-root (NOT PINNED):** why reconciliation applies the promoted class's native position instead of the
  cross-class anchor on the first load, intermittently. Ruled out (data): missing index (0), anchor-query error
  (0 cohort-wide), the anchor query itself (returns the correct cross-class anchor). **What would pin it:** the
  I-1 instrumented repro (finish list-days in class A → enroll B → first entry, with reconciliation logging) —
  **env-blocked: this WSL cannot run Vite/Playwright; the repro must run on Codex's/David's side.** I-2 narrowed
  it: `impossible_phase_detected` (531 real states) is the reset/CS-drop family (class-scoped emitter
  `Dashboard.jsx:1464`), NOT a direct #12 census, so it is not the #12 proxy metric.
- **Kaila undercount (#9-adjacent, PINNED):** cross-class review pairing requires exact anchor-range match
  (`db.js:3440-3441`) → a cross-pace review → `getReviewForDay: none` → `csd = anchorDay−1` phantom loop.
- **Ideal (N1):** ONE record per (student, list); class = access + policy. **Convergence:** the I-6 foundation
  (below) makes the entire #6/#9/#12/Kaila bug class *structurally unrepresentable* (no per-class doc to be stale).

### CR-2 · Progression / day-state machine  → the largest live harm
- **#11 root (PINNED, FIXED-IN-TREE):** the Day-2+ completion gate conflated "no new-word test ASSIGNED" with
  "assigned-and-failed" (`studyService.js:1430`). The uncommitted fix (`reviewOnlyDay` predicate `:1333`, clamp
  `:1339`, terminal, finished-hero) is correct. **I-2 verified the predicate covers list-end + throttle +
  over-introduced + all-mastered-fresh; the ONE gap = the mid-session all-mastered automarker (C-14),
  `DailySessionFlow.jsx:964-1008`, which bypasses `completeSessionFromTest` and writes a range-less/testId-less
  marker that fails pairing (`db.js:3440-3441`) → non-carry to fresh docs + gradebook-invisible.**
- **Live evidence:** **183 students at the wall** (F-4/census, grows as students finish); 24 hand-patched
  re-stuck. **Throttle variant = 1 live** (rare). day_guard/#10 fires for **6 real students** (F-1).
- **Continuation gap (C-11/12/13, PRODUCT-GAP):** finished list dead-ends; no start-over/next-list/link; finished
  list keeps focus (`Dashboard.jsx:1084-1108` recency-ranked) → students re-hit the wall. The 183 become this
  issue's population the moment #11 deploys.
- **Ideal (N2/N3):** every legitimate day-state completes (I-2's 10-state matrix S1-S10 is the spec); list-end is
  a terminal offering continue/cycle. **Convergence:** deploy the built #11 fix (hosting-only, safe per I-5), fix
  the C-14 automarker via the server marker, then cycling (gated on the foundation).
- **⚠️ Migration interaction (I-6):** post-#11-deploy, review-only days create legitimate anchor-less CSD gaps for
  183+ students; the foundation's CSD-plausibility screen MUST count `reviewOnlyDay` markers as evidence or it
  would re-quarantine exactly the students #11 unfroze.

### CR-3 · Grading & recourse → the second (hard) dead-end
- **Root (PINNED, composite):** AI-only + immutable-from-teacher grading (#1 no override), calibration
  false-negatives (#2, "restating the Korean definition" recurred 07-06), token exhaustion (#14), and a
  **promotion permission gap (C-19, PINNED by I-10):** attempts are stamped `teacherId = launching class's owner`
  at write (`db.js:1194-1204`) and never re-stamped on promotion → three stacked `teacherId==uid` predicates
  (gradebook `db.js:1926`, `reviewChallenge` throw `db.js:2666` = the literal "단어 권한이 없습니다", attempts rules
  `firestore.rules:102-118`) block the new teacher AND the old teacher goes roster-blind → the challenge is
  **orphaned**.
- **Live evidence:** **3 students in the permanent-fail deadlock NOW** (F-6: 이서현/fc8sBxnz, 김재민/uhJ41qPB,
  김호형/HMp1QzFr — all known CS/chat cases; small-N but a hard dead-end + recurring). **45 hand-patched students**
  quantify the override demand. Token lockout is RARE (only 3 of 817 locked; accepts are FREE — the "used all 5"
  TA framing is empirically wrong). **614 pending challenges** (some structurally orphaned by C-19).
- **Ideal (N4):** server-authorized teacher override (valid-anchor-preserving), calibrated grader, humane tokens,
  permission that follows the (student, list). No deterministic miss is a dead-end. **Convergence:** I-7 (override
  design, Task 2) on the foundation + a role/rules fix; calibration eval (I-4, needs F-7). **NOTE (I-6):** the
  challenge-accept twi writer is UNCLAMPED (`db.js:2829-2833`) → the override design must clamp it.

### CR-4 · Review model (PRODUCT-GAP)
- **Root:** reviews are non-gating BY DESIGN, but there is no retake/void (`#15` — 박서준's 2% accidental review is
  permanent), and chronic low reviews silently drive the #11 throttle while review quality is invisible to
  teachers. **Live:** review scores 13-40% "pass" (이서현, Junseo). **Ideal (N3/N4/N6):** retake/void with
  superseded-marker; teacher-visible review quality + intervention alerts. **Convergence:** I-9 (Task 2).

### CR-5 · Client re-derives authoritative state from unsealed context
- **#13 root (NOT PINNED; SIZED):** 18 real undersized tests / 17 students (5 day-1) — precisely bounded by F-2
  (pinned each attempt to the class it was TAKEN under, killing the 257 dual-enroll noise). Candidate paths (test
  descriptor recomputed from ambient/stale state: `testConfig.js:40-44` pool-collapse; standalone TypedTest/MCQ
  fetch; retake regen `TypedTest.jsx:1123`). **What would pin it:** I-3 (walk the 18 exemplars' generation inputs)
  — DEFERRED (moderate value; #13 is real but small, not epidemic).
- **#5 (PINNED, mitigated-then-regressed):** `retakeThreshold` defaults 0.95 (`TypedTest.jsx:87`) + result cards
  recompute the verdict (`:1306`, `MCQTest.jsx:1042`) instead of trusting server `passed`. **Live: 12 drifted
  assignments** (제주/유라시아 90-tier + undefined retake-threshold → 0.95 fail-closed) — config mitigation has now
  failed 3×. **#25 (PINNED):** `newWordsTestPassed` score-derived not authoritative (`studyService.js:1376`).
- **Ideal (N3/N4):** a sealed launch descriptor; result cards render server `passed`. **Convergence:** I-8's
  read-surface pattern + the durable #5 code fix (fail open, trust server) — retires the recurring config sweep.

### CR-6 · Write authority & the deploy landmine
- **#1b (PINNED):** `firestore.rules:34-37` — owner writes their user doc with no field whitelist → self-promote
  to `role:teacher`. **#1c (PINNED, deliberately staged):** attempt create open + `answers[]` client-writable +
  `reviewChallenge` launders (`db.js:2704-2731`); W3 lockdown is STAGED (X1 sequencing, not oversight).
  **#10 (FIXED-IN-TREE):** self-race fixed (`TypedTest.jsx:983-985` pure `getClassProgress` under the flag) — but
  F-1 shows day_guard fires for 6 real students → prod runs pre-fix code.
- **G1 (PINNED end-to-end by I-5):** `GRADE_TOKEN_ENFORCED=true` in HEAD (committed 06-27 `4b82a0a`, before the
  outage; prod's `false` never committed back) + the unpatched per-call nonce (`testRecovery.js:106-110`) → a
  functions deploy from HEAD re-arms the 06-29 mass save-failure. **F-9 confirmed prod = ENFORCED:false.**
- **DEPLOY-STATE (the cross-cutting finding; git-corrected 2026-07-13):** all client-bundle-only → deployable via
  `firebase deploy --only hosting` **without re-arming G1** (I-5); only *functions* deploys are gated by G1.
  **Git precision (verified `git log`/`git diff HEAD`): #9 (`1c91466`), #10 (`14e49a4`), C-27, F02/F03 are already
  COMMITTED — and #10 carries a `a967f54` "Deploying: commit 14e49a4" marker (07-12). Only #11 is UNCOMMITTED (3
  files, +119/−23).** So "the deferred deploy" = ship the uncommitted #11 fix (hosting-only, David/owner-executed);
  the rest are committed and #10 was (marked) deployed — YET F-1 shows day_guard fires for 6 real students AFTER
  14e49a4 → #10's fix has a RESIDUAL advance path OR the 14e49a4 deploy didn't fully land = a deploy-provenance
  ambiguity (C-36; hosting has zero build stamp). Task-2 FND-0/RO handles the #11 commit+deploy; the residual
  day_guard path is a tracked follow-up (not the same self-race the #10 commit fixed).
- **Ideal (N5/N6):** server-authoritative writes; role a custom claim / whitelist; no armed flag with an unpatched
  failure mode; provenance consulted. **Convergence:** the I-6 foundation (server-owned twi) + I-5's deploy-gate
  checklist + the C-28 role whitelist (folded into the foundation's single rules cutoff).

### CR-7 · Observability / read surfaces / provenance
- **#8 (PINNED):** gradebook Name-filter is client-side post-filter on a 50-row page (`db.js:1926/1982`). **#34:**
  testId-less attempts dropped (`db.js:1963-1977`) — automarkers invisible. **#35 (#7):** `assignedLists:[]`
  6-site bug (0 live classes, latent; seed at `createClass db.js:328`). **#4:** no deploy provenance (stamp-build
  built, not deployed). **impossible_phase logs no userId** (F-1 — un-attributable by construction). **Ideal
  (N6):** I-8 spec — 2 composite indexes, server-side studentId filter, field-first listId; build/env-stamped logs.

---

## §2 — The foundation keystone (I-6) — the convergence spine

**ONE migration** dissolves CR-1 and unblocks the rest: re-key to `users/{uid}/list_progress/{listId}` **merged
with** server-authoritative twi (same three twi writers `progressService.js:264-271`/`:465-486`/`db.js:2823-2836`;
one rules cutoff). Server surface: `completeSession` (transactional day-guard + server-derived `reviewOnlyDay` =
X1 satisfied *by construction*), `resolveListProgress`, epoch `resetProgress`, shadow-then-enforce anchor
validation, + the C-28 role whitelist. **Conflict rule** (persist §8): TWI = anchor-validated max, CSD =
max-plausible — mapped to F-3 (36 LIVE-STRAND → anchor, 6 divergent → max csd, 72 stale dissolve); dry-run =
backup + sweep + the F-4 H/P/B partition as metric. **Phase order (Task 2):** FND-0 (I-5 deploy-gate / G1 disarm)
→ deploy built #11 (hosting-only, David's X2 call) → foundation callables → client cutover → migration → one
rules cutoff → cycling → override. This is the ideal-model spec (N1+N5). It maps: CR-1(#6/#9/#12/Kaila) dissolved,
C-11 cycling unblocked, C-16 override secured — three clusters bought with one foundation.

---

## §3 — What remains open (honest ledger)
- **#12 mechanism — UNPINNED.** Needs the I-1 instrumented repro; **env-blocked** (no Vite/Playwright in WSL) →
  Codex/David runs it, OR the foundation makes it moot (student-owned progress removes the failure surface).
- **#13 generation path — UNPINNED but SIZED (18).** I-3 pins it from the F-2 exemplars (deferred, moderate).
- **Grader calibration breadth — needs the F-7 eval set + I-4 re-grade** (deferred — mechanism known, breadth not).
- **impossible_phase 531 states** — I-2's pin-check (parse newTestIds → join class_progress → CS-drop/live-stuck/
  healed split) would classify them; deferred (verdict already: reset/CS-drop family, anomaly-weighted).
- **Deferred scans** (F-8 automarker-revert reachability, F-12 continuation counts, F-13 review distribution,
  F-14 strand timelines) — sharpen specific Task-2 designs; roots already established without them.

## §4 — Convergence thesis (one paragraph)
The week's ~50 tickets and the live data reduce to **one keystone + one deploy**. Most damage (183 walled + 24
re-stuck + the 6 real day_guard students) is **already fixed in the working tree and merely undeployed** — and
that deploy is **safe hosting-only** (I-5). The remaining structural harm (~42 live carry-strands, the #14
dead-end, the override gap) collapses onto **one migration** to student-owned progress + server-authoritative twi
(I-6), which makes the entire cross-class-carry bug class unrepresentable, unblocks continuation/cycling, and
secures the teacher override. The empirical case against continued patching is decisive: the data is not corrupt,
and manual patches demonstrably do not hold (24/45 re-stuck; 이주헌 re-split). Task 2 plans the fixes in the I-6
phase order, gated by the I-5 deploy checklist and the F-4 H/P/B before/after metric.
