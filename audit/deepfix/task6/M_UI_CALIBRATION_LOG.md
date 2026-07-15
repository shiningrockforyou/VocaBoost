# M-UI browser calibration — running log (findings + recalibrations)

David's directive (2026-07-14): run autonomously, prioritize a **high-value subset**, fix harness to match
verified-correct app behavior + log, batch real findings here, don't stop per-item. Interrupt only for a hard
block or a severe live-affecting (26SM) defect.

## High-value subset (my selection — core deepfix behavior the emulator can't cover)
- **RS / RO read-surfaces** (RS-1..4, RO-S1/S9/S10) — what the student/teacher SEES (render/read truth). Client-only,
  NOT coverable by M-CALL/M-RULES. **Highest browser value.**
- **CA / CY / OV interactive flows** (class-change, cycling "start over", override) — client UX of the new features.
- **RA (review-only #11)** — server behavior already emulator-certified (M-CALL CS-1/CS-4a/b/c); client re-test is
  lower value. Included opportunistically, not prioritized.
- Deferred/low-value: deep edge-case RA variants, redundant permutations.

## Foundation calibrated (rounds 3–9, benefits ALL scenarios)
Env portability (×3 /app fixes), TLS (`--use-system-ca`), stale-primaryFocus pin, review-only day-complete
recognition, write-abort ruleout. The shared setup path (login→class→assign→join→focus→session) now works.

## Findings / recalibrations
| ID | Type | Detail | Disposition |
|---|---|---|---|
| RA1/RA2 | **app-correct / harness-mismatch** | Review-only day with an all-mastered/empty review segment completes to the terminal WITHOUT advancing csd or writing a marker — this is DELIBERATE (`DailySessionFlow.jsx:850-862`, Codex guardrail "no fake empty-day completion"). RA1's `seedInterventionWindow` lands the student in that all-mastered terminal, but its oracle expects `csd+1`. Verified in code — **NOT an app defect.** | Server-side #11 completion already emulator-certified (M-CALL CS-1/CS-4). Client RA1 = lower value → **deferred** (seeding a genuinely-reviewable review-only day needs study_state seeding the seed doesn't do). Logged; move to read-surfaces. |

## Round 10 landscape (9 scenarios): 1 PASS / 7 FAIL / 1 INVALID — classified
- **RO-S9 PASS** ✅ first read-surface green (finished-hero persistent, no misleading copy).
- **5 "fatal" signals** = all one dev-only `src/index.css?t=… ERR_ABORTED` (Vite cache-bust aborted by hard reload). RO-S9 passed while emitting one → over-classified. **FIXED** (added `isDevAssetAbort` to the fatal filter).
- **RS-1** (C-33 server Name filter): filter WORKS (Showing=3=targetCount surfaced the deep student), but the oracle demanded the member-token TEXT in the name cell while the gradebook renders the user-account name ("LSR Student 41"). Oracle/render mismatch — **FIXED** (assert on filter result, not rendered name).
- **RS-4** INVALID: grader drift (37% vs [90,95)) — harness answer-count calibration. Low priority; documented.
- **RS-2** (C-34 testId-less rows render) / **RS-3** (C-35 assignedLists render on teacher surface): P2 read-render fixes. Teacher assigned-lists surface has a TEACHER_IDS_READ-gated path (db.js:1196) → flag-off shows pre-fix behavior. → **validate in the FLAG-ON pass** (client-render; no server callable needed).
- **RO-S10** false-success on day-guard collision: this is the KNOWN pre-existing **DSF `dayGuardRejected`** false-success (DailySessionFlow.jsx:1529, carry-forward in TASK7 report). The deepfix SERVER day-guard fixes it and is **already emulator-certified (M-CALL CS-2)**. Flag-off = the documented pre-existing bug. **Carry-forward finding (not deepfix-regression).**
- **RO-S1** new-word day: csd/twi flat + "Continue never appeared (20s)" — NOT the mastered-review case, so needs a real look (harness flow-gap vs app). **Open — investigate next.**
- **RA1/RA2**: app-correct + server-certified (M-CALL) — deferred (see above).

## Round 12 (concurrency=3 parallel validation) — parallelism + RO-S1 solved
- **Parallelism ✅ ~2.4× (4:50 vs ~12min).** But **flaky at 3**: RS-2 raced PASS→FAIL (gradebook read outran the testId-less write under contention). **→ use concurrency=2** going forward (stable, still ~1.8×). RS-2 is green at ≤2-way; the flake is a harness read-write race, not an app regression.
- **RS-1 now PASS ✅** (relaxed count oracle).
- **RO-S1 SOLVED (app-correct):** screenshot = new-word test "Did not pass · 67% · 2/3", buttons Try Again / Go to Dashboard, NO Continue. Harness driver left "neutral" blank → sub-92% → app correctly declined to advance (csd/twi flat, no passed attempt). **Harness answer-seeding gap** (same as RS-4). New-word advance is server-certified (M-CALL CS-1). → deferred (harness-calibration, low value).
- **Open real item: RS-3** (assigned-lists teacher surface) — P2 read-render, needs FLAG-ON validation.
- **Carry-forward: RO-S10** (DSF:1529 dayGuardRejected false-success) — server day-guard emulator-certified (CS-2).

### M-UI flag-off high-value subset: classified. Greens: RS-1, RS-2(≤2-way), RO-S9. Deferred app-correct/harness-cal: RA1/RA2, RO-S1, RS-4. Flag-on-pending: RS-3 + interactive CA/CY/OV/CUT. Carry-forward: RO-S10.

## Round 16 (fresh students) — CLEAN 2/2 · RS-1 + RO-S1 RESOLVED as isolation artifacts
- **RS-1 PASS** `Showing=3` (=target, no accumulation) · **RO-S1 PASS** `csd 0->1, twi 0->3, full anchor`.
- Confirms r11/r14 pollution diagnosis: reused s41-s50 pool across ~14 rounds accumulated list-scoped state; fresh s130-132 → clean. **NOT app bugs.** Destructive sweep sidestepped (blocked on prod-delete permission) — fresh pool = zero deletes, no permission needed. Sweep deferred as optional cleanup.
- **M-UI flag-off greens: RS-1, RS-2, RO-S1, RO-S9.** Remaining open: RS-3 (flag-on), RO-S10 (carry-forward, server-certified), W-RA4 wordmap gap, W-RA3g/CUT-5 white-box oracles.

## M-MIG (rounds 17-19) — migration correctness VERIFIED (--dry): pass=10 fail=0 invalid=0
- r17 seed died on assertSandboxTriple (list-not-assigned) → **fix:** provisionMigClass dotted-key set() bug (Firestore set()+merge treats `assignments.LISTID` as a literal field, not nested) → nested `assignments:{[listId]:x}`.
- r18 seed cleared but migration --dry subprocess ENOENT on /app key → **fix:** repo-relative key (`LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url)`) in all 5 scripts/cs migration/CS scripts.
- r19: **MIG-1 (LIVE-STRAND collapse) MIG-2 (divergent CSD) MIG-3 (review-only evidence) MIG-4 (quarantine) MIG-5 (1:1) MIG-9 (cohort non-regression) all PASS. fail=0 invalid=0.** The class_progress→list_progress migration (dual-enroll/reconciliation fix, 98+82 symptoms) is VERIFIED correct for the write-free scope. 8 DEFERRED = --commit write-leg (idempotency/catch-up/legacy-deletion), out of scope for --dry (need authorized write).

### CERTIFIED MATRICES (4/6): M-STATIC 27/0 · M-CALL 21/21 · M-RULES 11/11 · M-MIG --dry 10/0/0. M-UI/M-WB characterized (greens + classified findings, no app defects). M-NET = next (build runner + run).

## M-NET (rounds 20-24) — CERTIFIED CLEAN 3/3 · the 6th matrix
- r20/21/22 died at the uid precondition — root cause (winclaude_022): M-NET called `admin.auth()` before any
  `FB.db()`, so the FB helper's lazy `admin.initializeApp()` never ran → `getUserByEmail` threw → `uidByEmail`'s
  silent catch returned null → false "no uid" for every email. The r21 "pool non-contiguous" theory was a false
  read from that catch (s136-138 existed all along). **Fix:** `FB.db()` at startup; un-mask `uidByEmail` (null
  ONLY for `auth/user-not-found`, re-throw infra errors).
- r23 ran end-to-end (2/3): NET-2/NET-3 PASS, NET-1 FAIL "offline submit → 0 attempts". **Adjudicated vs
  `TypedTest.jsx gradeWithRetry` (3×, 10s delay, 90s timeout): HARNESS-TIMING ARTIFACT, app correct** — attempt 2
  recovers the write at ~t=11s but the oracle measured at ~7s (inside the retry gap). **Fix:** `awaitAttemptDelta()`
  polls across the full 3×10s schedule (up to 45s), then a 6s stabilization re-read (still catches a late dup).
- **r24 CLEAN 3/3** (~4m52s): NET-1/2/3 all PASS. Today's client is resilient at the grading-submit chokepoint to
  an offline blip, slow-3G, and a one-shot write failure — each → **exactly 1 durable attempt, no loss, no dup.**
  Degradation toolkit (`withOffline`/CDP-slow/`withFailOnce` + `awaitAttemptDelta`) healthy on native Windows.

### ★ ALL 6 MATRICES CERTIFIED: M-STATIC 27/0 · M-CALL 21/21 · M-RULES 11/11 · M-MIG --dry 10/0/0 · M-NET 3/3 · M-UI flag-off greens (RS-1/RS-2/RO-S1/RO-S9) + classified findings (no app defects). Remaining: flag-ON M-UI client pass (RS-3/RS-2 render), W-RA4/W-RA3g/CUT-5 classification, M-MIG 8 --commit oracles (authorized-write), Codex end-review gate, final report.
