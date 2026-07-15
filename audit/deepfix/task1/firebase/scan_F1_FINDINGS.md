# F-1 findings — syslog attribution (impossible_phase_detected + day_guard_rejected)

Read-only. Data: `scan_F1_syslog_attribution.json` (16000 most-recent system_logs, 2026-07-01→07-13).
Rosters: 26SM=817 students, sandbox(25WT)=326. Emitters found in code first.

## day_guard_rejected_session_cleared — RESOLVED: FIRES IN PROD for real students
- Emitter: `studyService.js:638`. Event has `userId, classId, listId, sessionDay, progressDay, sessionCleared`.
- **29 events / 6 DISTINCT REAL 26SM students** (07-12: 22, 07-13: 7) + 5 sandbox. Offenders: 3bWwRlE8 (Adv A2,
  10ev), fCbkvSoY (미주 Final, 6), cWaJsPrx (Adv A2, 5), Z16cWSmF (Inter A3, 4), 51lETXfc (제주 TOP), PjDr1GZq (Inter A3).
- **This CONTRADICTS SESSION_CONTEXT/NEED_TO_FIX "#10 has 0 live occurrences / 5 all-time all sandbox."** The
  day-guard rebuild ("세션 정보가 갱신되었습니다 / session refreshed") DOES fire for real 26SM students — low volume
  (6 students / 2 days) but real. Consistent with **prod running pre-#10-fix code** (C-30 is fixed-in-tree but
  UNdeployed) OR a sibling reconciliation-advance path. Either way: the "verify-deployed" premise is corroborated
  — prod exhibits a bug the working tree already fixes. → strengthens C-36 (provenance) + the deploy-state case.
- **NOT fully pinned:** whether these 6 are the exact #10 self-race or a different advance path needs each one's
  attempt+progress timeline (sessionDay vs progressDay are logged — a follow-up can classify without new code).

## impossible_phase_detected — RESOLVED (attributed) + one open sub-question
- Emitter: `studyService.js:105-114`, condition `dayNumber === 1 && newTest?.passed` (reason
  `day1_with_passed_new_test`) → routes phase to COMPLETE. Event logs `dayNumber, reason, newTestId` — **NO userId**.
- Volume STEADY ~450–1000/day across the WHOLE 07-01→07-13 window (not a 07-12 spike) → prod-wide, not sandbox-only.
- Attributed via `newTestId` (`{uid}_vocaboost_test_{classId}_{listId}_new_{ts}_{rand}`): **654 distinct states —
  531 real 26SM + 121 sandbox + 2 other.** The RAW count (3088 in the census 4000-window; 9451 here) is INFLATED
  by 07-12 **fleet-audit sandbox personas re-firing 60–79× each** (top offenders all `25WT PX Lx S0 fleet3`).
  Underneath: **531 distinct real-26SM day-1-with-passed-new states.**
- **Interpretation (open — the one sub-question F-1 can't fully close):** the branch routes to COMPLETE, so it is
  "handled." It fires either (a) benignly on normal day-1 completions being re-evaluated (dayNumber still 1 at
  completion), or (b) on genuine reset-to-day-1-with-carried-pass = the **#12 carry-miss shape** (C-02). 531
  distinct real states over 13 days is large for (b) alone but plausible for (a). PIN requires: per-testId repeat
  distribution for the 531 (a state firing 10-20× = stuck; 1-2× = transient) + join to the dual-enroll/#12 set.
  → hand to **I-2** (phase-flow trace: enumerate exactly when `dayNumber===1 && newTest.passed` occurs in the
  normal vs anomalous flow) with this export.

## Cross-issue updates
- **C-30 (#10):** "0 live" is FALSE — 6 real 26SM students hit day_guard_rejected. Status stays
  fixed-in-tree-verify-deployed, but the census contradiction is RESOLVED in the "fires in prod" direction.
- **C-02 (#12):** impossible_phase_detected is a candidate live proxy metric (531 real states) — pending the I-2
  benign-vs-anomaly split.
- **C-36 (#4 observability):** impossible_phase_detected logs no userId → un-attributable by construction (had to
  reverse-engineer via newTestId). Concrete N6 evidence: events must carry uid/classId/build stamp.
- **Deploy-state (F-9 preview):** prod exhibits the day-guard rebuild that HEAD fixes → prod is BEHIND HEAD (as
  expected; the #9/#10/#11 "verify-deployed" premise holds).
