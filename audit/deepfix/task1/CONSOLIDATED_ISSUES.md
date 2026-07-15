# CONSOLIDATED ISSUES — deepfix Task 1, step 1.4 (master deduped list)

**Author:** Consolidator (1.4). **Date:** 2026-07-13.
**Inputs merged:** `issues_claude.md` (R-A…R-G), `issues_fable1.md` (roots A–G), `issues_codex.md` (SR-1…SR-5),
plus the orchestrator's `verification_ledger.md` (H1 re-traces incl. the #9/#10 corrections),
`firebase/cs_manual_writes_catalog.md`, and the **live 26SM empirical census** (`firebase/CENSUS_SUMMARY.md`,
`census_rows.json` 530 flagged rows, `census_classes.json`, `syslogs.json` — read-only, 2026-07-13). Context:
SESSION_CONTEXT_2026-07-13, TA chatlog + triage, NEED_TO_FIX, SUPPORT_RUNBOOK,
PLAN_review_only_day_completion, `loop/x/plan.md`.

**Verification stance (David, verbatim: "always verify all claims by all agents and Codex results. Never trust
blindly. Always verify."):** consolidation does NOT upgrade evidence. Tags below:
- `verified-evidence` — traced against the CURRENT working tree by the orchestrator (ledger) or by me during 1.4
  (marked `V-1.4`), or confirmed in live Firestore data (`V-data` prior session; `V-census` = the 2026-07-13
  read-only 26SM census — re-confirm before any write).
- `plausible-unverified` — asserted by a doc or a single list, mechanism coherent, NOT independently code-traced.
- `speculative` — a hypothesis; an investigation target, not a finding.

**H1 census caveats (do NOT quote these raw counts as bug-counts):** `testSizeMismatch:257` is
heuristic-inflated — the big buckets (q30→exp35 ×165, q50→exp30 ×141, q35→exp30 ×118) are dual-enroll
CROSS-CLASS attribution noise; real #13 ≈ the small-q bucket only (~30–50 undersized instances, e.g.
q13→30 ×11, q10→30 ×9). `impossible_phase_detected:3088` and `day_guard_rejected:17` (last ~1.35 days, a
window that INCLUDES the 07-12 fleet-audit sandbox runs) are **NOT yet attributed** to real 26SM vs sandbox —
they are high-priority empirical TODOs (INVESTIGATION_PLAN F-1), not confirmed prod facts.

Provenance markers: `[3/3]` raised by all three lists; `[2/3:names]`; `[solo:name]` (tagged **sharp** or **noise**).
Convergence across independent lists = confidence; divergence is preserved in §5, not averaged away.

**My own 1.4 spot-checks (V-1.4), run against the working tree today:**
1. `functions/index.js:58` — `const GRADE_TOKEN_ENFORCED = true;` in HEAD (fable G1 flag claim CONFIRMED).
2. `db.js:179-185` — `getAvailableChallengeTokens = max(0, 5 − activeRejections)` counting ONLY
   `status==='rejected' && replenishAt > now`; `db.js:2612` `replenishAt = +30 days` (fable token-accounting CONFIRMED).
3. `Dashboard.jsx:1084-1108` — getPrimaryFocus §2a prefers active-progress lists ranked by **recency**
   (`lastMs` first) → a just-finished list keeps focus (fable correction #2 CONFIRMED).
4. `DailySessionFlow.jsx:973-1000` — empty-review automarker writes NO `testId` and NO
   `newWordStartIndex/newWordEndIndex`; `db.js:3440-3441` review pairing requires EXACT range match (fable B2
   mechanism CONFIRMED); `db.js:1963-1977` `if (!listId) continue` drops testId-less attempts (fable E1-sub
   CONFIRMED, with a refinement: `scripts/cs/manual-pass.mjs:51` writes `vocaboost_test_{classId}_{listId}_new`,
   which PARSES — so cs/manual-pass attempts are gradebook-visible; only automarkers + the old scratch manual
   attempts are dropped).
5. `db.js` — `assignedLists || Object.keys(assignments)` at 6 sites: **502, 1438, 1531, 1808, 2314, 2436**
   (ledger's widening of #7 CONFIRMED; `:811/:835` use a different intentional `|| []` pattern).

---

## §0 — The ideal-app north star (merged + sharpened)

All three lists converged on the same six properties; this is the frame every fix must converge toward
(per David: fixes that converge to the theoretically well-built app, NOT responsive patches).

- **N1 — Progress is student-owned, per list.** One record per `(student, list)` holding word-position (twi),
  session count (csd), per-word mastery. A class confers ACCESS + a session POLICY bundle (pace, thresholds,
  test mode/sizes, cycling flag) — never position. Class moves/promotions/dual-enrollment then carry by
  construction; the entire reconciliation overlay becomes unnecessary. "Day" is a derived view of position under
  the launching class's policy (Codex sharpening: cross-pace moves preserve exact word position, with explicit UX).
- **N2 — Progression is a graph with terminals, not a forever-line.** Lists link into an explicit per-class
  sequence; a list can cycle. "Finished" is a first-class terminal offering start-over / advance-to-next
  continuously, with zero TA intervention; a finished list cannot be accidentally re-entered into a dead-end.
- **N3 — Every legitimate day state is representable and completes.** A day with zero assignable new words
  (list-end, throttle, all-mastered) completes on its assigned work; the gate distinguishes "no new-word test
  was ASSIGNED" from "assigned and failed." Test identity (size, words, day) is sealed at launch — deterministic
  at day-1, promotion-retake, remainder, and retake boundaries; never recomputed from ambient/stale class state.
- **N4 — Grading is authoritative, calibrated, and never a dead-end.** The client renders the server's `passed`;
  it never re-derives a stricter verdict or invents a threshold. Teachers have a durable, server-authorized,
  audit-logged override that preserves valid anchors. Challenge economics are humane and correctly communicated.
  Reviews have a coherent product meaning (retakeable or explicitly non-gating-with-visibility). No deterministic
  grader miss can permanently fail a student.
- **N5 — Writes are server-authoritative.** Role is a custom claim; attempts/progress/anchors are not
  client-forgeable; completion and reconciliation cannot race each other; twi is server-owned (the foundation
  gating cycling and the override).
- **N6 — The system is observable and legible.** Live commit/flag state is knowable (version endpoint consulted
  as a deploy gate); teacher/student surfaces say WHY a student is in a state (recovery / finished / low-review);
  every read surface's query matches its filter semantics; CS signatures don't false-positive on legitimate states.

**The empirical case for this frame (census, §1.5):** the 26SM data is NOT corrupt — invalidAnchor,
csdImplausible, ghostProgress, noClassAttempt all ≈ 0. What the census DOES find is 183 students walled by a
structural gate, 98 students with split progress identities, and 82 hand-patched students of whom 25 are already
re-stuck. That is the signature of structural/behavioral/deploy-state failure, not data damage — patching
outputs demonstrably does not hold (25/82 failed; 이주헌's dual-enroll recurred after consolidation), so the
fixes must change the MODEL (N1–N6), not the rows.

---

## §1 — Root taxonomy reconciliation

| Consolidated root | issues_claude | issues_fable1 | issues_codex | North-star |
|---|---|---|---|---|
| **CR-1 · Progress identity is class-scoped, not student-owned** | R-B | Root A | SR-1 (issues 1–4) | N1 |
| **CR-2 · Progression/day state machine: no zero-new-word day, no terminal, no continuation** | R-A | Root B (B1–B3) | SR-2 (issue 5) | N2, N3 |
| **CR-3 · Grading & recourse: strict + immutable-from-teacher + token-punitive → permanent-fail** | R-C | Root C | SR-4 (14, 15) | N4 |
| **CR-4 · Review model: non-gating, non-retakeable, quality-invisible, feeds the throttle** | R-E | B4 | SR-2 (6, 7) | N3, N4, N6 |
| **CR-5 · Client re-derives authoritative state (test size, verdict, threshold, day) from unsealed context** | R-D + D2/D6 | Root D | SR-3 (8, 9, 10) | N3, N4 |
| **CR-6 · Writes are client-authoritative (role, attempts, progress) + armed-flag deploy landmine** | R-F | Root F + G1 | SR-4 (11–13) | N5 |
| **CR-7 · Observability / read surfaces / deploy provenance** | R-G + D1 | Root E + G2 | SR-5 (16–18) | N6 |

The three taxonomies are near-isomorphic (a genuine convergence signal). Differences reconciled: Claude alone
split the review model out (kept — it feeds both CR-2's throttle and CR-3's pedagogy); Codex alone grouped
verdict/test-size/day-stamping re-derivation as one "unsealed client context" root (adopted as CR-5 — it is the
sharper frame); fable alone isolated the armed-flag deploy landmine (adopted under CR-6/CR-7 as its own P0 issue).

## §1.5 — Empirical baseline (live 26SM census, 2026-07-13, read-only)

Cohort: 32 classes · 816 students · 3 lists · 3009 enrollments · **1121 started** (csd>0 or twi>0).
The load-bearing empirical facts (full detail + caveats: `firebase/CENSUS_SUMMARY.md`):

1. **183 students at the #11 list-end wall** (169→172→183 across scans — it GROWS as students finish) +
   1 throttle case. The single largest live impact. `[V-census]`
2. **98 dual-enroll-same-list students** — 2+ class_progress docs on ONE list, many divergent (d8DzmjMP: Adv B1
   csd19/twi1520 vs Final B csd2/twi200 — 17 days apart; ob0Ngt48: 9-day divergence, a live #12 strand
   candidate). **이주헌 (OCzwBwAb) re-split AFTER his 06-30 CS consolidation** — the condition RECURS because
   nothing prevents it structurally. This is the live CR-1 substrate, quantified. `[V-census]`
3. **82 hand-patched students (population P ≈ 10% of started)** — and **25 of them are back at the #11 wall**:
   manual CS patching is empirically NOT durable. The treadmill is quantified. `[V-census]`
4. **The data is NOT corrupt**: invalidAnchor / csdImplausible / twiOverMastery / ghostProgress / noClassAttempt
   ≈ 0 cohort-wide; `csd_anchor_*` logs = 0. **The failures are structural / behavioral / deploy-state — which
   is precisely the case for converging to the ideal model instead of continuing to patch.** `[V-census]`
5. **Real #13 ≈ 30–50 undersized-test instances** (small-q bucket; q9–q15 vs exp 30/35), NOT the raw 257 —
   the rest is dual-enroll cross-class attribution noise (H1 caveat above). `[V-census]`
6. **Config drift is live again:** 12 assignments off-normal — 제주 BRIDGE/CORE/TOP at passThreshold **90**,
   유라시아 Core/Top + others with `newWordRetakeThreshold` **undefined** (→ client falls back to 0.95 = live #5
   exposure), and 제주 CORE/TOP Ascent carry the INVERSE mismatch (server 90 vs client 0.92). The 07-04b
   "54/54 at 92/0.92" normalization did not hold — most drifted rows look like the 07-13 ensure-all-lists
   mirror re-introducing pre-normalization props (hypothesis, verify in F-5). `[V-census]`
7. **`impossible_phase_detected` fired 3088× in ~1.35 days** (77% of all system_logs; NEED_TO_FIX #10 noted
   "406 recent" — now 8×that) and **`day_guard_rejected_session_cleared` = 17** (contradicting the prior
   "0 live / all sandbox" claim). **Both UNATTRIBUTED** (window includes the 07-12 fleet-audit sandbox) → F-1.
8. `#7 assignedLists:[]` split-brain: **0 live 26SM classes** (ensure-all-lists cleaned the data; the 6-site
   CODE bug remains latent). `attempt_day_fallback` = 10/1.35d (LOW — answers Codex's volume question).
   `grading_attempt_failed` = 19/1.35d (grading is stable). `reviewNoNewPass` = 31, mostly the known benign
   review-only artifact. `[V-census]`

## §2 — Priority ranking (EMPIRICAL blast radius on live 26SM × severity × root-fix leverage)

**P0 (highest leverage / active live harm — now with measured blast radius):**
1. **C-09/C-10** #11 review-only deadlock — **183 live students at the wall and growing**; fixed-in-tree,
   UNdeployed. The deploy itself is the action, which is gated by →
2. **C-32** `GRADE_TOKEN_ENFORCED=true` deploy landmine + unpatched nonce root cause (deploying HEAD as-is
   re-triggers the 06-29 mass save-failure outage) + **C-36** deploy provenance. Every fix in this program
   passes through this gate. Elevated further by the unattributed 3088× `impossible_phase_detected` /
   17× `day_guard_rejected` signals (deploy-state truth is currently unknown → F-1).
3. **C-31** server-authoritative twi + student-owned progress foundation — **98 dual-enroll split-progress
   students** are its live substrate; **25/82 hand-patches already failed** (re-stuck). Dissolves CR-1, unblocks
   cycling, secures the override — the single highest-leverage structural investment, and the census proves the
   patch-treadmill alternative does not hold.
4. **C-15** permanent-fail recourse chain (#14 = no override + calibration + tokens + permission) — second
   stuck-state class; **82 hand-patched students** quantify the override demand curve.

**P1:** C-01 (#6 class-keyed reset — 98-student substrate), C-02 (#12 carry-miss, root unpinned; live strand
candidates in the dual-enroll set), C-03 (Kaila undercount), C-04 (#9, verify-deployed), C-06 (dual-enroll
data state — 98 live), C-11/C-12/C-13 (continuation + linking + focus — the 183 walled students land here after
the deploy), C-16/C-17/C-18 (override/calibration/tokens), C-22 (#13 test-size — real scale ~30–50, root
unpinned), C-23 (#5 threshold — **12 live drifted assignments**, mitigation regressed), C-28/C-29 (role +
attempt forgery), C-33 (#8 gradebook).

**P2:** C-05, C-14, C-19, C-20, C-21, C-25, C-30 (17 unattributed day_guard events → F-1), C-34,
C-35 (#7 — DOWNGRADED from P1: 0 live split-brain classes; latent 6-site code fix), C-37, C-38.
**P3:** C-07, C-24 (fallback volume measured LOW), C-26, C-27, D7–D9.

---

## §3 — CONSOLIDATED ISSUES BY ROOT

Format — **id · title** · raised-by · symptom+cite · best evidence · evidence tag · layer · NEED_TO_FIX # ·
convergence · **status** · **FB** (needs-Firebase-evidence → the live query, cross-ref to INVESTIGATION_PLAN scan S#).

### CR-1 · Progress identity is class-scoped, not student-owned

**C-01 · Progress/session docs keyed `{classId}_{listId}` → class change resets progress (#6)** `[3/3]`
- Symptom: class move / promotion on a shared list restarts Day 1; ≥10 students hand-carried (catalog: 이주헌,
  손진욱, 박주하, 구기현, 남세이, 신예나, 조준모, 이서현, +07-13 trio).
- Evidence: `progressService.js:33-34` `getProgressDocId`; `sessionService.js:55-56` (ledger ✓). Mastery carries
  (`users/{uid}/study_states/{wordId}`, no classId). — **verified-evidence**.
- **LIVE (census): 98 dual-enroll-same-list students carry split progress docs on one list, many divergent**
  (d8DzmjMP 17 days apart; kT4E0rVo dual on BOTH lists). **이주헌 re-split AFTER the 06-30 CS consolidation** —
  the condition structurally RECURS after every manual drop. `[V-census]`
- Layer: data model. NTF: #6. Status: **open-defect** (mitigated at read-time by `LIST_SCOPED_RECON`; persona-fleet
  F2 showed same-list/same-pace moves DO carry now — #6 reproduces on different-pace / list-switch / flag-off /
  stale-view paths).
- Convergence (N1): re-key to student-owned `users/{uid}/list_progress/{listId}` (`PLAN_list_progress_persist.md`);
  class becomes access+policy. This is the same migration as the C-31 foundation — do NOT plan them separately.
- **FB: partially DONE (census v1) → F-3** (divergent-vs-benign split of the 98; per-class csd/twi vs the
  student+list anchor) **+ F-4** (patched students are population P).

**C-02 · #12 — cross-class carry INTERMITTENTLY strands promoted students at Day 1** `[3/3]`
- Symptom: INT→ADV promotion on the same list sometimes shows Day 1/0-introduced. CS-confirmed 안이연/유혜준/Lucy;
  the SAME mechanism carried 홍승연, 6 Final-movers, Sarah Sung → intermittent.
- Evidence: Lucy re-did days 1–5 in ADV[한] while `csd_twi_reconciled` fired on her loads — recon RAN but applied
  the native position, not the nwei-879 anchor (`V-data`). Anchor query correct (`db.js:3250-3298`), apply
  unconditional (`progressService.js:233-270`), `csd_anchor_query_error`=0 cohort-wide — all ruled out.
  **Symptom = verified-evidence; mechanism = UNPINNED.**
- Leading hypothesis (fable A3, **speculative**, the sharpest available): the FIRST post-promotion load hit a
  `query-error`/`none` anchor status and fell through to defaults; later loads were non-demoting
  `max(storedCSD,csd)` on the already-written native value — but then `safeTWI = max(storedTWI, twi)` SHOULD have
  jumped to 880, so the open question is why the anchor read returned none/err on those loads specifically
  (caching / ordering / read-before-write race / session-context reuse).
- **LIVE (census): the dual-enroll set contains fresh strand candidates** — e.g. ob0Ngt48 (Adv A1 csd5/twi400 vs
  Adv[한] csd14/twi1120, 9 days behind its cross-class position). `csd_anchor_query_error` = 0 in the current log
  window (consistent with the earlier rule-out). `[V-census]`
- Layer: client session-build + reconciliation timing. NTF: #12. Status: **open-defect** (root unpinned).
- Convergence (N1): student-owned progress makes the bug class structurally impossible; interim fix must ensure
  the first post-promotion anchor read cannot silently default.
- **FB: YES → F-3 + F-14** (strand-candidate extraction from the 98; full log+attempt timelines for
  Lucy/안이연/유혜준 + new candidates) — but PINNING needs the I-1 instrumented repro (sandbox), not data alone.

**C-03 · Cross-class CSD undercount → phantom "day complete" loop (Kaila-type)** `[3/3` — Claude symptom, fable
traced mechanism, Codex via corrections`]`
- Symptom: promoted student sees "day complete" but can never advance (start → completion screen → dashboard).
- Evidence: review pairing requires EXACT anchor range match `db.js:3440-3441` (`V-1.4` re-confirmed); a
  cross-class/cross-pace review whose stored range ≠ the anchor's → `getReviewForDay: none` → `csd = anchorDay−1`.
  Kaila: Final Ascent csd=2 while day 3 was complete in old Adv class (`V-data`). — **verified-evidence**.
- Layer: reconciliation review-pairing. NTF: #9-adjacent. Status: **open-defect**.
- Convergence (N1): a review completed in ANY class on the list resolves the day; one student-owned record.
- **FB: YES → F-3b** (census refinement: students where csd == anchorDay−1 AND a same-day review attempt exists in
  a different class / with a mismatched range → count the silent phantom-loop population inside the 98).

**C-04 · #9 — cross-class review completion → spurious new-word retake + TWI double-advance** `[3/3]`
- Symptom: pass new in class A, finish the review in class B → told to retake, retake operates on the wrong day.
- Evidence: **FIXED IN WORKING TREE (uncommitted)** — `studyService.js:247-274` REVIEW_STUDY resume zeroes
  `nwCount` + preserves the anchor range; `db.js:3402-3443` list-scoped pairing (ledger ✓+, triple-confirmed:
  Codex correction 1 + fable A2 + orchestrator re-trace). — **verified-evidence**.
- Layer: reconciliation/session-init. NTF: #9. Status: **fixed-in-tree-verify-deployed** (prod may run stale code).
- Convergence (N1/N3): student-owned progress subsumes; Run S overlay S-1/S-3 is the regression test.
- **FB: YES → F-9** (deploy-state: do post-07-11 live attempts show the spurious-retake signature — same-day
  duplicate new attempts at an advanced base after a cross-class review?).

**C-05 · Cross-pace carry over-credits words (twi > mastery) + "day" is policy-dependent** `[solo:Codex #2 — sharp;
corroborated by the CS catalog]`
- Symptom: 조준모 carried to twi=640 with 600 study_states (words 600–639 credited UNSTUDIED, accepted trade-off);
  오하린 660-vs-640 confusion; 신예나 cross-pace boundary. Some of this is a deliberate CS trade-off, but the data
  state (twi > studied) is now live and untracked.
- Evidence: catalog CS-2026-07-07b (`V-data`); pace read from launching class `studyService.js:175-182` (Codex).
  — **verified-evidence** for the data state; the semantics gap is a **product-gap**.
- Layer: data model / pedagogy semantics. NTF: #6-adjacent. Status: **config/data-only** (live rows) +
  **product-gap** (day-vs-position semantics).
- Convergence (N1): position is the durable truth; "day" is a derived per-class view with explicit cross-pace copy.
- **CENSUS TENSION (H1):** census `twiOverMastery ≈ 0` cohort-wide, but the catalog documents 조준모's twi 640 vs
  600 study_states — either it self-healed (he studied on) or the census check differs from the catalog's
  definition. Do not treat as resolved; reconcile in F-11.
- **FB: YES → F-11** (re-run twi vs count(study_states) with the catalog's definition; provenance per row:
  manual patch vs organic).

**C-06 · Dual-enrollment leaves two live class_progress docs on one list** `[catalog; implied by all three]`
- Symptom: two progress docs on one list diverge (이서현's "15-question" ticket was dual-study redundancy);
  구기현 (Adv+Final), 남세이 (IntE+AdvE), 박주하 (AdvA2+InterA2) remain dual-enrolled per the catalog.
- Evidence: catalog D-b (`V-data`) — **and the census scaled it up: 98 students, not 3** (`[V-census]`).
  — **verified-evidence** (population), a live #6/#12 surface, and it recurs after CS drops (이주헌).
- Layer: data model. NTF: #6/#12. Status: **config/data-only** (until CR-1 re-key removes the second doc) —
  UPGRADED to P1 by the census count.
- **FB: partially DONE (98 identified) → F-3** (divergent-vs-benign split; which need a CS consolidation NOW vs
  which wait for the re-key).

**C-07 · List unassign revokes access but strands mid-progress students** `[solo:Codex #4 — sharp (real history:
박한별 CS-2026-06-23b); warning shipped (F03), stranding ability remains]`
- Evidence: `db.js:823-842` unassign deletes assignment; `ClassDetail.jsx:387-401` warn-only (Codex,
  plausible-unverified line-level; history verified in runbook). Status: **mitigated** (warning) + **product-gap**
  (should preserve progress visibility / offer migration).
- **FB: mostly answered (census ghostProgress = 0 live) → keep in the standing sweep (F-5).** `[V-census]`

**C-08 · Per-class `resetStudentProgress` is a no-op cross-class** `[3/3 — all agree by-design]`
- Documented, deferred (David 07-11); coherent under student-owned progress. Status: **out-of-scope** (deferred to
  the epoch/reset work; Codex's "reset = list-progress epoch" framing feeds the C-31 foundation design).

### CR-2 · Progression/day state machine

**C-09 · #11 list-end review-only deadlock (the dominant live impact)** `[3/3]`
- Symptom: student who finished a list is frozen on the next review-only day — "이 날을 완료하려면 먼저 새 단어
  시험을 통과해야 합니다"; csd/twi frozen; permanent. **LIVE: 183 students at the wall (census; 169→172→183 —
  grows as students finish), all LIST-END**; 김동현, 최다온/한예진/최우성, 정유나/어재원/김지원/최도훈/안예진/
  이가온 all week. **25 of the 82 hand-patched students are ALREADY back at this wall** — batch-advance/manual
  unsticking is not durable. `[V-census]`
- Evidence: gate `studyService.js:1430`; working tree carries the Phase-1 fix (`reviewOnlyDay` predicate `:1333`,
  clamp `:1339`, terminal `DailySessionFlow.jsx:824-834`, finished hero) (ledger ✓+). — **verified-evidence**.
- Layer: backend gate + session terminal + dashboard. NTF: #11. Status: **fixed-in-tree-verify-deployed**
  (LOCAL-ONLY, uncommitted, not acceptance-tested; deploy deliberately deferred by David — X2).
- Convergence (N2/N3): complete on review when zero new words ASSIGNED; list-end becomes a terminal, not a wall.
- Open Q: does the predicate cover EVERY zero-new path (over-introduced; all-mastered empty-review `:826`;
  automarker interplay C-14)? → I-2.
- **FB: DONE (census v1: 183 authoritative; resolves fable's 169/170/172 instability as growth-over-time) →
  refresh at deploy-decision time; F-4 covers the patched-re-stuck 25.**

**C-10 · #11 throttle variant — same gate freezes MID-list, self-reinforcing** `[3/3]`
- Symptom: 3 low reviews → interv=1.0 → newWords=0 → gate blocks → the recovering review is never recorded to
  `recentSessions` (append only on completion) → interv pinned. Junseo [0.27,0.10,0.40] (`V-data`).
- Evidence: `studyAlgorithm.js:66-112` + `progressService.js:455` (fable traced; plan §1 confirms).
  — **verified-evidence**. NTF: #11. Status: **fixed-in-tree-verify-deployed** (same fix).
- **LIVE (census): 1 current throttle case** — rare in practice (needs 3 consecutive low reviews); list-end
  dominates 183:1. `[V-census]`
- Convergence (N3): the throttle is a by-design recovery loop that must be able to EXIT; post-fix cadence
  (~1 review-only day, then new words return) needs verification (plan §8; open Q on oscillation).
- **FB: YES → F-13** (students with last-3 recentSessions reviews avg ≤0.30 → the future-throttle-freeze
  population; Junseo's post-patch trajectory as the recovery exemplar).

**C-11 · No continuation: finished list dead-ends (no cycling / start-over)** `[3/3]`
- Symptom: 5 finished-everything students (함지민†, Soul Kim, 유찬†, 이가온, Young Cho) have nothing to do; TAs
  hand-build tests; David promised "repeat/처음부터 다시" repeatedly; 63 finishers still to advance manually.
- Evidence: `V-data/V-log`; legacy dead-end `DailySessionFlow.jsx:817-826`, `MCQTest.jsx:322-324` throw
  (plausible-unverified line-level, design verified). NTF: feature req. Status: **product-gap**.
- Convergence (N2): cycling capstone (`x/plan.md`) — **HARD-GATED on C-31** (cap removal activates forgery).
- **FB: YES → F-12** (finished-everything count; primaryFocus state of the 63+5; note the 183 walled students all
  become this issue's population the moment the #11 fix deploys — continuation is the successor problem).

**C-12 · No explicit list-linking / per-class sequence** `[2/3: claude+fable; Codex in north star]`
- Symptom: "next list" inferred by convention (Base→Ascent→Summit); size can't order (Summit 800 < Ascent 1600);
  TAs and students pick wrong lists. David feature request #3. Status: **product-gap**. Convergence (N2):
  `nextListId`/ordered sequence on the class assignment drives automatic continuation.
- **FB: no** (design gap; S14 quantifies the manual-advance burden it removes).

**C-13 · Finished list keeps primary focus + stays clickable → students re-hit the wall** `[2/3: claude R-A5 +
fable correction #2; **V-1.4 re-confirmed**]`
- Symptom: 최다온/한예진 kept clicking Start on the finished Base Camp card (CS-2026-07-13f); 김동현 will re-#11
  if he re-selects Ascent.
- Evidence: `Dashboard.jsx:1084-1108` §2a ranks progress candidates by RECENCY → a just-finished list (most recent
  activity) remains focus. The old footgun (newest-assigned steals focus) is FIXED; the new one is "finished list
  won't yield focus." — **verified-evidence** (V-1.4).
- Layer: dashboard focus + list-card UX. Status: **open-defect** (UX-level; the Phase-1 finished-hero mitigates the
  dead-end but focus still points at the finished list until manually moved). Convergence (N2/N6): finished lists
  yield focus to the linked next list; finished card renders a terminal + "continue here →".
- **FB: YES → F-12** (students whose focus list is finished — twi ≥ listSize — i.e. the re-#11 exposure; the 25
  patched-re-stuck census rows are partly this mechanism in action).

**C-14 · Empty-review automarker cannot satisfy flag-on review pairing → auto-completed day reverts**
`[solo:fable B2 — SHARP (new, not in NEED_TO_FIX); mechanism **V-1.4 re-confirmed**, reachability open]`
- Mechanism: `DailySessionFlow.jsx:973-1000` marker written with NO `newWordStartIndex/EndIndex` (and no testId);
  `db.js:3440-3441` pairing requires exact integers → `undefined ≠ int` → `none` → `csd = anchorDay−1` → the
  auto-completed all-mastered day is reverted on next entry — defeating the marker's own stated purpose
  (comment at `:967-970`). `SERVER_REVIEW_MARKER=false` so the legacy path is the live one.
- Reachability: fresh-entry list-end path was rerouted to the non-recording terminal; the modal path is still live
  mid-session (`moveToReviewPhase`) and in REVIEW_STUDY recovery. Possibly masked because such students are usually
  at list-end. — mechanism **verified-evidence**; live impact **plausible-unverified**.
- Layer: reconciliation ↔ client marker. Status: **open-defect** (latent until a mid-list all-mastered day occurs).
- Convergence (N3/N5): server marker (W2) stamping the anchor range; or pairing accepts an `autoCompleted` marker.
- **FB: YES → F-8** (all `autoCompleted:true` attempts in 26SM; for each, did that day's csd hold or revert on
  subsequent loads? count = empirical reachability — not covered by census v1).

### CR-3 · Grading & recourse (the second stuck-state class)

**C-15 · #14 — permanent-fail deadlock: grader false-negative + token exhaustion + no override + permission gap** `[3/3]`
- Symptom: "정답과 똑같이 써도 오답… no matter how many times, always fail" (양서현, Final A); recurred all week
  (김재민, 윤여진, 이서현, 안예진's class). Only escape is off-platform 수기채점. — `V-log`, **verified-evidence**
  as a live phenomenon; composite of C-16/C-17/C-18/C-19.
- **LIVE (census): 82 hand-patched students (63×1 patch, 12×2, 7×5) — the manual-override volume this recourse
  gap generates, quantified.** `[V-census]`
- Layer: grader + product. NTF: #14. Status: **open-defect** (P0 product).
- Convergence (N4): override + calibration + humane tokens + permission fix — no deterministic miss is a dead-end.
- **FB: YES → F-6** (permanent-fail candidates = students with ≥N failed attempts on the same day/test +
  0 available tokens; join against F-7's grader-error labels — challenges.history NOT covered by census v1).

**C-16 · #1 — no teacher/TA grade-override path** `[3/3]`
- Every override today is a hand-written Firestore edit (조예서 CS-06-25, 곽경훈 CS-07-02 — which even reversed a
  teacher challenge-REJECTION by owner instruction). — **verified-evidence** (runbook + absence confirmed by Codex rg).
- NTF: #1, blocked on #1b/#1c (C-28/C-29). Status: **product-gap**. Convergence (N4/N5): server callable mirroring
  the CS script's valid-anchor write (nwsi/nwei/wordsIntroduced/testId), class-ownership authz, audit-logged.
- **FB: DONE (census v1): 82 students carry `manualOverride`/`_manual` attempts — the demand curve measured;
  25 already re-stuck (patches not durable). → F-4** for the per-patch durability breakdown.

**C-17 · #2 — AI grader rejects defensible answers (calibration)** `[3/3]`
- "Restating the Korean definition" false-negatives RECURRED after the supposed fix (김재민 07-06:
  `autobiographical←자전적인`, `indifferent←무관심한` rejected). — **plausible-unverified at the prompt level**
  (nobody traced the live prompt this round; behavior verified in runbook re-grades).
- NTF: #2. Status: **open-defect** (investigate-first). Convergence (N4): labeled eval set from
  overridden/challenge-accepted items → measure false-negative classes → rubric fix → re-measure.
- **FB: YES → F-7** (export the eval set: all challenge-accepted answers + manualOverride items + graded-wrong
  answers equal to the list's own KO definitions — not covered by census v1).

**C-18 · Challenge-token economics: 30-day replenish, ONLY active rejections count, guidance doubly wrong**
`[3/3; fable sharpened the accounting; **V-1.4 re-confirmed**]`
- RECONCILED ACCOUNTING (supersedes NEED_TO_FIX #14's "rejected challenges ALSO consume" phrasing and the triage's
  framing): `tokens = max(0, 5 − activeRejections)` where activeRejections = `status==='rejected' &&
  replenishAt > now`; `replenishAt = challengedAt + 30d`. **Accepted and pending challenges cost NOTHING.** The
  real lock is ≥5 rejections in a rolling 30-day window. TA guidance was wrong twice: "다음 주에 reset" (it's 30
  days, from the challenge date) and "5개 다 썼다" counting accepts (they're free). Note: the 07-01 chat shows
  David's own mental model matched the code ("reject한 게 2-3번밖에 없으면 남아있어야 할 텐데") — the TA-side
  counting was the error; the UI gives students no visibility either way. — **verified-evidence** (V-1.4).
- NTF: #14(c). Status: **config/data-only** (fix the guidance + student-facing copy NOW) + **product-gap**
  (whether rejection-only-scoped 30d is the intended policy; whether grader-error rejections should refund).
- **FB: YES → F-6** (distribution of challenges.history: active-rejection counts, locked students, accepted/pending/
  rejected ratios — quantifies how punitive the current policy is in practice; not covered by census v1).

**C-19 · Promotion permission gap: promoted students lose challenge/grade permission** `[3/3 via #14]`
- "승반한 친구라 저희가 단어 권한이 없습니다" (양서현 07-08). — `V-log`; **plausible-unverified mechanism: NO ONE
  code-traced where this permission check lives** (class-scoped challenge/grade authz vs the attempt's classId).
  Investigation target, not a pinned bug.
- Status: **open-defect** (mechanism unpinned). Convergence (N1/N4): permission follows the (student, list/attempt),
  not current enrollment. **FB: YES → F-6b** (a promoted student's failed attempt: attempt.classId vs current
  enrolledClasses vs the teacher who can see it) + I-10 code trace.

### CR-4 · Review model

**C-20 · #15 — no review-retake; a mis-submitted review is permanent** `[3/3]`
- 박서준 accidental Day-7 review, 2%, no retake; reviews always pass (`TypedTest.jsx:817`, `MCQTest.jsx:529`,
  server `functions/index.js:371-377` — fable+Codex traced). — **verified-evidence**. NTF: #15.
  Status: **product-gap**. Convergence (N4): retake/void affordance with audit trail (Codex: superseded marker).
- **FB: YES → F-13** (count near-zero reviews (<20%) — the accidental-submit + garbage population).

**C-21 · Chronic low reviews silently feed the throttle; review quality invisible to teachers** `[3/3]`
- 이서현 13/20%, Junseo 27/10/40, 허은서 17% — all "pass"; 3 lows → interv 1.0 → C-10. — **verified-evidence**
  (V-data + traced pipeline). Status: **product-gap** (surfacing) — the non-gating itself is BY DESIGN (all agree).
- Convergence (N6): teacher-visible review quality + intervention alerts; define what score triggers attention.
- **FB: YES → F-13** (cohort review-score distribution; students trending toward interv=1.0).

### CR-5 · Client re-derivation / unsealed session identity

**C-22 · #13 — test size mis-generated at boundaries (day-1 / promotion-retake / dup re-serve)** `[3/3]`
- VERIFIED case: 이혜성 Day-1 totalQ=10 vs config 30 (introduced 80!); 김호형 promotion-retake 30≠35 (UNVERIFIED —
  no auth record); 이서현 d9 15-question dup (12/12 = benign remainder, all agree).
- Mechanism candidates (neither pinned): fable — `totalQ = min(testSizeNew, pool.length)` (`testConfig.js:40-44`)
  so a collapsed POOL (cross-class TWI over-advance shrinking wordsRemaining) explains 10-of-30, but is in tension
  with "introduced 80 day-1"; Codex — multiple generation paths (TypedTest/MCQ standalone+smart fetch ambient
  assignment state; retake regenerates from previous page state `TypedTest.jsx:1122-1125`). — symptom
  **verified-evidence** (V-data); root **plausible-unverified**.
- **LIVE (census, H1-caveated): raw testSizeMismatch = 257 but ~80% is dual-enroll CROSS-CLASS attribution noise
  (q30→exp35 ×165, q50→exp30 ×141, q35→exp30 ×118 = the other class's config); the REAL #13 signal is the
  small-q bucket: q13→30 ×11, q10→30 ×9, plus q9–q15 instances (~30–50 undersized tests across ~25–40 students —
  e.g. vsmxhBzK 9/30 ×3, BmSE6nII 11/30, kT4E0rVo 12/30).** No class has testSizeNew < 25, so small-q cannot be
  attribution noise. `[V-census]`
- Layer: test-gen + cross-class TWI (shares CR-1). NTF: #13. Status: **open-defect** (root unpinned; real scale
  now bounded ~30–50, i.e. real but NOT epidemic).
- Convergence (N3): sealed launch descriptor (classId, listId, policy, word ids, expected count, attempt identity);
  retakes reuse or re-seal — never recompute from ambient state.
- **FB: v1 DONE (heuristic) → F-2** (precise recount: pin each 'new' attempt to the class it was TAKEN under via
  attempt.classId, exclude retakes, bucket by boundary — day-1 / first-day-post-enrollment / post-promotion /
  dup re-serve — BEFORE the code trace I-3).

**C-23 · #5 — `retakeThreshold` defaults 0.95 (fails closed) + result cards recompute the verdict** `[3/3]`
- Evidence: `TypedTest.jsx:87` useState(0.95), compare `:817`; resolution `studyService.js:305` (ledger ✓); fable:
  the smart-selection path passes literal `DEFAULT_RETAKE_THRESHOLD` (`TypedTest.jsx:375,391`); Codex: result cards
  compute `passed = score >= retakeThreshold` even when the server verdict exists (TypedTest `:1303-1333`,
  MCQ `:1038-1070`). — **verified-evidence** (default+compare via ledger; the recompute framing plausible-unverified
  at exact lines, mechanism consistent).
- NTF: #5. Status: **mitigated-then-REGRESSED** (07-03 config write covered 61 assignments, but the census found
  **12 assignments off-normal again**: 제주 BRIDGE/CORE/TOP at passThreshold 90; 유라시아 Core/Top +others with
  `newWordRetakeThreshold` UNDEFINED → live 0.95 fail-closed exposure; and 제주 CORE/TOP Ascent carry the INVERSE
  mismatch, server 90 vs client 0.92 → a genuine 90–91% pass displays as fail. Most drifted rows look like the
  07-13 ensure-all-lists mirror re-introducing old props — hypothesis, verify) + **open-defect** (the durable code
  fix: trust server `passed`; fail open; multi-class resolution — config-only mitigation has now demonstrably
  failed to hold twice). `[V-census]`
- **FB: DONE (census v1 found the 12) → F-5** (re-sweep + root the drift origin; the config WRITE to fix them
  needs David's authorization — CS event, not investigation).

**C-24 · Attempt day-stamping fallback complexity can hide identity bugs** `[solo:Codex #10 — plausible smell,
not noise; explicitly `[?]`-tagged by its author]`
- `TypedTest.jsx:819-860` derives/corrects `studyDay` from mutable progress when launch context is missing.
  — **plausible-unverified**. Status: **open-defect (low)**. Convergence (N3): sealed descriptor; fail closed on
  staleness. **FB: DONE (census syslogs): `attempt_day_fallback` = 10 and `attempt_day_context_invalid` = 0 in
  ~1.35 days — LOW volume; Codex's open question answered; stays P3.** `[V-census]`

**C-25 · `newWordsTestPassed` persisted from score-derivation, not the authoritative flag** `[solo:claude, from
plan §11 — sharp, tracked-deferred]`
- A manual/lower-threshold pass can persist `COMPLETE + passed:false`. — **plausible-unverified** (V-prior; on the
  1.5 re-trace list). Status: **open-defect (latent)**. Convergence (N4): persist `newWordAttemptPassed`.
- **FB: YES → F-4b** (session_states where newWordsTestPassed=false but a passed same-day attempt exists — 최도훈's
  impossible-state family; possibly related to the unattributed `impossible_phase_detected` flood, F-1).

**C-26 · #3 — grading hard-fails on `listId:null`** `[solo:claude/NTF]` — ~12 recovered errors, 0 loss.
  **plausible-unverified** (1.5 re-trace pending). Status: **open-defect (low)**. **FB: DONE-ish (census syslogs):
  `grading_attempt_failed` = 19/1.35d, `grading_recovered` = 1 — grading is stable; stays P3.** `[V-census]`

**C-27 · Grading-error modal overstates failure / loops on deterministic errors** `[solo:claude/NTF #4-UX]` —
  **1.5 GATE CORRECTION → LARGELY FIXED IN-TREE**: `TypedTest.jsx:105` `gradingErrorKind`, `:596` branches on
  `invalid-argument`/`failed-precondition`, `:1755` de-alarmed titles ("Grading Didn't Go Through" /
  "Couldn't Grade — Please Reload") + reload guidance for deterministic errors. **verified-evidence** (V-now).
  Status: **fixed-in-tree-verify-deployed** (was open-defect) → joins the #9/#10/#11/C-27 "does PROD behave as
  HEAD?" question (F-9). **FB: no** (client-only). Reliability baseline (D5): ~1.4% recovered transients, 0 loss.

### CR-6 · Write authority & security

**C-28 · #1b — doc-`role` self-writable → student self-promotes to teacher** `[3/3]`
- `firestore.rules:34-42` owner write without field whitelist; `isTeacher()` reads doc role (`rules:19`);
  `functions/index.js:1847-1850` renameStudent checks doc role (ledger ✓; caveat: read the FULL rules block at 1.5
  to confirm no hasOnly guard). — **verified-evidence** (with the 1.5 caveat). NTF: #1b. Status: **open-defect**
  (security; blocks C-16). Convergence (N5): custom claim or authority-field whitelist.
- **FB: partial → F-4c** (hygiene: any 26SM user whose role changed to teacher without provenance).

**C-29 · #1c — attempt CREATE open + `answers[]` student-writable + reviewChallenge launders** `[3/3]`
- `rules:101/:106` create with own studentId, no shape check; `:109-118` hasOnly(['answers']) without sub-field
  restriction; `db.js:2704-2731` recompute-from-client-isCorrect on accept AND reject; `SERVER_CHALLENGE_WRITE=false`
  so legacy client path live (ledger ✓). — **verified-evidence**. IMPORTANT NUANCE (ledger ✓+): the rules block
  documents W3 as STAGED deliberately (`docs/plans/W3_attempts_lockdown.rules.md`) — this is a **known deferred
  posture / sequencing problem (X1)**, not an oversight. NTF: #1c. Status: **open-defect (live, deliberately
  staged)**. Convergence (N5): W1/W2/W3 lockdown; until then no recompute trusts client grade fields.
- **FB: YES → F-4c** (forgery hygiene sweep: attempts with passed:true + anomalous shape — no testId, no grading
  provenance, writtenBy absent — beyond the known automarkers/manual-passes; census's invalidAnchor=0 says
  anchors are clean, it does NOT say no forgery — different check).

**C-30 · #10 — flag-ON completion self-race** `[3/3]`
- **FIXED IN WORKING TREE**: `TypedTest.jsx:983-985` / `MCQTest.jsx:722-724` take the PURE `getClassProgress` read
  under the flag — no reconciling write between attempt-write and completion (ledger ✓+ CORRECTED its own earlier
  misread; triple-confirmed). 0 live occurrences ever (5 events all sandbox). — **verified-evidence**.
- NTF: #10. Status: **fixed-in-tree-verify-deployed**. Residual (ledger): the day-guard rebuild machinery remains;
  a DIFFERENT reconciliation-advance path could still trigger it — watch, don't fix blind.
- **⚠️ CENSUS CONTRADICTION (H1, unresolved): `day_guard_rejected_session_cleared` = 17 in the last ~1.35 days**,
  vs the prior "0 live occurrences / 5 all-time, all sandbox" claim — AND `impossible_phase_detected` = 3088
  (was "406 recent" in NEED_TO_FIX; now 8×). The log window INCLUDES the 07-12 fleet-audit sandbox runs, so
  neither count is attributed yet. If any of the 17 are real 26SM students, #10 (or a sibling
  reconciliation-advance path) FIRES IN PROD despite the in-tree fix. `[V-census]`
- **FB: F-1 DONE (scan_F1_FINDINGS.md) — CONTRADICTION RESOLVED "fires in prod":** `day_guard_rejected` = 29
  events / **6 real 26SM students** (Adv A2, 미주 Final, Inter A3, 제주 TOP) + 5 sandbox → the rebuild DOES fire
  live (prod runs pre-fix code). `impossible_phase_detected` = emitter `studyService.js:105-114`
  (`dayNumber===1 && newTest.passed`); raw count inflated by 07-12 sandbox personas re-firing 60–79× each, but
  **531 distinct REAL 26SM states** underneath (logs NO userId — N6 observability gap). Benign-vs-#12-anomaly
  split → I-2. `[V-census/F-1]`

**C-31 · Server-authoritative twi + student-owned progress — the missing FOUNDATION** `[claude explicit R-F4;
fable+Codex convergent (their A/SR-1 convergence directions land on the same migration)]`
- `class_progress`/`study_states` student-writable; `safeTWI=max(stored,twi)` honors a forged storedTWI
  (`progressService.js:231`); anchors client-echoed. Removing the allocation cap (cycling) without this activates
  unbounded forgery (`x/plan.md` §0/§3g). — **verified-evidence** (V-prior + plan-verified).
- Status: **product-gap (architecture)** — the keystone. Convergence (N1+N5): ONE migration = student-owned re-key
  (#6) + server-owned progress writes + server-validated anchor. Dissolves CR-1, unblocks C-11 cycling, secures
  C-16 override. Claude's open Q5 ("is it the same migration as the re-key?") is answered by design in I-6: it must be.
- **FB: no direct** (design); S2/S3/S12 quantify the migration's input-data quality.

**C-32 · G1 — `GRADE_TOKEN_ENFORCED = true` in HEAD is a deploy landmine; the 06-29 nonce root cause is UNPATCHED**
`[solo:fable — the sharpest independent find; flag **V-1.4 re-confirmed** at `functions/index.js:58`]`
- Prod was set `false` on 06-29 to stop a 118-write `permission-denied` outage; root cause (localStorage nonce →
  grade-time/save-time docId divergence, `testRecovery.js:98-110`) unpatched; no fix routes the server-returned
  docId back. **Deploying functions/index.js as-is re-arms the outage.** Since #9/#10/#11 are all now
  deploy-state problems, every planned deploy passes through this landmine. — flag **verified-evidence** (V-1.4);
  nonce mechanism **plausible-unverified** (V-doc; 1.5 re-trace listed).
- Layer: ops + backend + client. NTF: #4-adjacent. Status: **open-defect (P0 ops blocker)**.
- Convergence (N5/N6): keep enforcement false until nonce/docId binding hardened (submit with server-returned
  attemptDocId); version endpoint consulted as a hard deploy gate.
- **FB: YES → F-9** (read the LIVE flag from data: recent attempts' `correctnessSource` — null means enforcement
  off, per CS-2026-06-29A's verification — + `writtenBy`, + call `exports.version` if deployed. The low
  `attempt_write_failed_client` = 12/1.35d is consistent with enforcement OFF in prod today). `[V-census]`

### CR-7 · Observability / read surfaces / deploy provenance

**C-33 · #8 — gradebook Name/student filter is client-side on one 50-row page** `[3/3]`
- `db.js:1858/1927/1982` paginate-then-post-filter (ledger ✓); 이지후 ranks 17,236/20,029 teacher-wide → page 1
  empty → "no results." Students-vs-Grades read different sources (fable E3 — folds in here). — **verified-evidence**.
- NTF: #8. Status: **open-defect**. Convergence (N6): push studentId server-side (`where studentId ==/in` +
  composite index); pagination walks the filtered set. **FB: no new** (already measured; S8 only if regression).

**C-34 · testId-less attempts are invisible in the gradebook** `[solo:fable E1-sub — sharp; **V-1.4 re-confirmed
with refinement**]`
- `db.js:1963-1977` drops attempts whose testId doesn't parse → the empty-review automarker (writes NO testId) is
  gradebook-invisible. REFINEMENT (V-1.4): `cs/manual-pass.mjs` writes a PARSEABLE testId, so current CS
  manual-passes are visible; the OLD scratch manual attempts (CS-2026-06-21 family, no testId) are not.
  — **verified-evidence**. Status: **open-defect (facet of C-33)**.
- **FB: YES → F-8** (count 26SM attempts with missing/unparseable testId, by origin: automarker / old-manual / other).

**C-35 · #7 — `assignedLists: []` split-brain hides all lists — SIX sites** `[3/3; ledger widened; **V-1.4
re-confirmed**: db.js:502, 1438, 1531, 1808, 2314, 2436]`
- `[] || fallback` never falls back. Still live in the working tree (fable confirmed; not touched by the Phase-1
  diff). — **verified-evidence**. NTF: #7. Status: **open-defect (LATENT — downgraded to P2)**: the census answered
  Codex's open question — **0 live 26SM classes in split-brain** after ensure-all-lists. The 6-site code bug
  remains and will re-fire on the next `assignedLists:[]` write; fix it, but it is not currently harming anyone.
  `[V-census]`
- **FB: DONE (census v1: splitBrain=false across all 32 classes) → include in the standing sweep so a recurrence
  is caught (F-5).**

**C-36 · #4 — no deploy provenance / silent repo↔prod drift** `[3/3]`
- stamp-build + `exports.version` BUILT, not deployed/consulted; history: the 03-10 grader fix hidden in an
  "apboost audit" commit ran stale in prod through 06-29. — **verified-evidence** (history) / fix-pending.
- NTF: #4. Status: **open-defect (ops)** — elevated by the #9/#10/#11 fixed-in-tree reality: "does PROD behave as
  HEAD?" is now the central question of the whole program, and the unattributed 3088× impossible_phase /
  17× day_guard signals (F-1) are exactly the kind of ambiguity provenance would kill. Convergence (N6):
  deploy-from-HEAD + post-deploy `version.sha == git HEAD` + intended-flag assertion. **FB: YES → F-9.**

**C-37 · Teacher surfaces don't show WHY (recovery / finished / low-review legibility)** `[2/3: claude + fable
(via B3/B4); plan §6 Phase 2]`
- `CurrentSessionCell` renders null as red "New: ✗"; frozen-% with no why; review quality hidden.
  — **plausible-unverified** (V-prior lines). Status: **product-gap** (Phase-2 UX sub-project). **FB: no.**

**C-38 · CS integrity sweep false-positives on legitimate review-only days** `[solo:claude — sharp, from runbook
CS-2026-07-13c "KNOWN BENIGN ARTIFACT"]`
- `reviewNoNewPass` flags legit review-only completions (Junseo d5, manual list-end finishers); will flag EVERY
  review-only day post-deploy. — **verified-evidence** (V-data). Status: **config/data-only (tooling)** — the sweep
  must learn the `reviewOnlyDay` marker BEFORE/WITH the #11 deploy (Codex issue-5 open question, same point).
- **FB: DONE (census v1): 31 current reviewNoNewPass hits, mostly the known benign artifact — the post-deploy
  noise floor is now predictable.** `[V-census]`

### Discrete / peripheral

- **D7 · Test step-navigation can't go back** `[solo:claude, V-log ×2 (이서윤)]` — **plausible-unverified** in code.
  Status: open-defect (minor UX). FB: no.
- **D8 · Transient "test not visible / already completed / stuck review" states** `[solo:claude, V-log]` — mostly
  C-09/C-13 faces; 박건형 ("dsg 계속 떠서 review 못 한다", teacher asked to force-end) may be a distinct stuck
  session — **speculative**. FB: YES → F-1 sample (his uid's log/attempt timeline if re-reported).
- **D9 · Position-vs-day display confusion on class moves** `[2/3: claude D9 + Codex issue-2 framing]` — 오하린
  640-vs-660 was CORRECT carry (all agree not-a-bug); the confusion is the C-05 semantics/legibility gap. Status:
  product-gap (fold into C-05/C-37). FB: no.

---

## §4 — Cross-cutting sequencing constraints (program risks, not code bugs)

- **X1 · W3 ordering (from ledger ✓+):** once W3 locks down class_progress, forging `reviewOnlyDay` becomes the
  sole client path to advance CSD — `completeSessionFromTest` must re-derive reviewOnlyDay server-side BEFORE W3's
  class_progress lockdown lands (plan §4). The #1c live exposure is a *deliberately staged* posture, so the real
  work is executing this ordering, not re-discovering the hole.
- **X2 · Deploy posture:** Phase-1 #11 fix is uncommitted/undeployed by David's explicit choice ("we'll just fix
  as requests come in"); do not re-litigate deploy urgency without new facts — but C-32 (landmine) + C-36
  (provenance) must be resolved so that WHEN the deploy decision comes, it is safe.
- **X3 · Cycling gate:** cycling ships only after C-31 (server-auth twi). Sequence: foundation → Phase-1
  review-only (built) → cycling capstone.
- **X4 · Non-regression:** any fix must not regress the uncommitted Phase-1 fix, LIST_SCOPED_RECON invariants
  (twi monotonic, csd non-demoting, anchor `twi=nwei+1`), and must re-verify plan §7 (review-only × recovery ×
  cycling) if it touches reconciliation.
- **X5 · Census-before-write:** every future CS write updates the H/P/B partition (see INVESTIGATION_PLAN §2.6) —
  hand-patches mask bugs; the mask must stay inventoried.

## §5 — Reconciled disagreements & corrections (the load-bearing deltas)

1. **#9 and #10 are FIXED in the working tree (uncommitted)** — NEED_TO_FIX and issues_claude carried them as open;
   fable + Codex corrected; the orchestrator re-traced BOTH and confirmed (ledger, incl. correcting its own earlier
   misread of the #10 ternary). Consolidated status: **fixed-in-tree-verify-deployed** (C-04, C-30). Consequence
   (ledger): #9/#10/#11 are ALL deploy-state problems → CR-7/C-32/C-36 elevated to P0.
2. **getPrimaryFocus footgun**: the CS-2026-06-24b/28b "newest-assigned, progress-blind" bug is LARGELY FIXED
   (F02); the residual is **recency-ranking keeps a finished list as focus** (fable; V-1.4 confirmed) → C-13.
   Do not re-file the old footgun.
3. **#7 is live AND multi-site**: not one line — SIX `assignedLists ||` sites (ledger; V-1.4 grep-confirmed).
   The one-line fix in NEED_TO_FIX under-scopes it → C-35.
4. **Challenge-token accounting**: NEED_TO_FIX #14 / triage phrasing ("rejected challenges ALSO consume") is
   imprecise — ONLY active rejections (30-day window) reduce availability; accepted/pending are free (fable;
   V-1.4 confirmed). Both the period AND the counting in TA guidance were wrong → C-18.
5. **#12 mechanism remains UNPINNED** — all three agree on the ruled-outs; fable's first-load-fallthrough
   hypothesis is the sharpest lead but leaves the safeTWI question open; requires the I-1 instrumented repro.
   Do not let any fix plan claim this root without the repro.
6. **이혜성 test-size tension**: fable's pool-collapse explanation conflicts with "introduced 80 on day-1" — the
   census (S4) must adjudicate before I-3 asserts a generation path → C-22.
7. **Headcount instability (169/170/172)** — fable's process flag; RESOLVED empirically: the census's 183 shows
   the number was never unstable, it was GROWING (students keep finishing lists). Cite 183 with the census date,
   and refresh at deploy-decision time.
7b. **"#10 has 0 live occurrences" is now CONTRADICTED by unattributed data** — census syslogs show
   `day_guard_rejected_session_cleared` = 17 and `impossible_phase_detected` = 3088 in ~1.35 days (window
   includes the 07-12 fleet-audit sandbox runs). Neither the old "all sandbox" claim nor "fires in prod" is
   currently proven — F-1 attribution is the top empirical TODO before any deploy-state conclusion.
7c. **testSizeMismatch raw count (257) must never be quoted as the #13 bug-count** — ~80% is dual-enroll
   cross-class attribution noise; the real signal is ~30–50 small-q instances (census H1 caveat).
7d. **Census `twiOverMastery≈0` vs the catalog's documented 조준모 over-credit** — unreconciled definition
   mismatch or self-heal; F-11 adjudicates. Do not cite either as final.
7e. **#7 split-brain: code-bug yes, live-data no** — census found 0 affected classes (ensure-all-lists cleaned
   it), so fable's "still present in working tree" (code) and "0 live" (data) are BOTH true; C-35 downgraded to
   latent P2.
8. **오하린 / 손지성 / 12-question remainder / review-after-new / 김지오 rollback** — all three lists agree these
   are NOT bugs (correct carry / benign remainder / by design). Kept out of the defect list (see §6, D9, C-20 note).
9. **Automarker/manual-pass gradebook visibility** — fable's E1-sub claim refined at 1.4: current `cs/manual-pass`
   attempts ARE parseable/visible; only automarkers and pre-catalog scratch manual attempts are dropped → C-34.

## §6 — Out of scope / resolved-by-design / non-VocaBoost

- Non-VocaBoost: 로워모듈, Canvas login, 스킬마스터리 교재, DSG "module 2 Upper", math 모의고사 decimals. `[3/3]`
- Review test is the normal next step (박현율 07-01) — legibility nit only.
- Reviews non-gating BY DESIGN (김지오 rollback ask) — the gap is C-20/C-21, not the advance.
- Per-class resetStudentProgress no-op — documented+deferred (C-08); true reset = epoch work under C-31.
- 12/12 (김소윤 Adv A2) list-end remainder — benign (`min(testSize, pool)`).
- 손지성 Day-2, 오하린 640 — carry working CORRECTLY.
- 고아연 wrong-list — user selection (the C-12/C-13 UX makes it likelier; not itself a defect).
- APBoost — out of program scope.

## §7 — Index by NEED_TO_FIX #

| NTF | Consolidated | Status |
|---|---|---|
| #1 | C-16 | product-gap (gated on C-28/C-29) |
| #1b | C-28 | open-defect |
| #1c | C-29 | open-defect (staged W3, X1) |
| #2 | C-17 | open-defect (investigate-first) |
| #3 | C-26 | open-defect (low) |
| #4 (provenance) | C-36 | open-defect (ops, P0-adjacent) |
| #4 (modal UX) | C-27 | open-defect (low) |
| #5 | C-23 | mitigated + open-defect |
| #6 | C-01 (+C-05, C-06) | open-defect (narrowed paths) |
| #7 | C-35 | open-defect (6 sites) |
| #8 | C-33 (+C-34) | open-defect |
| #9 | C-04 | **fixed-in-tree-verify-deployed** |
| #10 | C-30 | **fixed-in-tree-verify-deployed** |
| #11 | C-09/C-10 | **fixed-in-tree-verify-deployed** (deploy deferred, X2) |
| #12 | C-02 | open-defect (root UNPINNED) |
| #13 | C-22 | open-defect (root UNPINNED) |
| #14 | C-15 (=C-16+C-17+C-18+C-19) | open-defect (P0 product) |
| #15 | C-20 (+C-21) | product-gap |
| (new) | C-13, C-14, C-32, C-34, C-38 | not yet in NEED_TO_FIX — file after 1.5 gate |
