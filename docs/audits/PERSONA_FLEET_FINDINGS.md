# Persona Fleet Audit — Findings (cert fleet3, build a967f54, 2026-07-12)

The 12-persona fleet CERTIFIED 12/12 (fail-closed, identity-bound: `findings/fleet_manifest_fleet3.json`).
The harness cert is the *means*; below are the **product / reliability findings** the audit surfaced. Each is
tagged with a proposed disposition for Codex to pressure-test (real NEED_TO_FIX vs known/benign).

## F1 — Grading + save TRANSIENTS (reliability) · MED · likely known (CS-matrix #3/#4)
Across ~220 test-days in the fleet, **3 transient app failures** occurred, all RECOVERED by client retry:
- **grading-internal** (`gradeTypedTest` → `FirebaseError: internal`, client retries N/3): L4, L8.
- **save-error** ("Couldn't Save Your Results" / Retry Save — grading OK, durable save failed): L7.
Rate ≈ 1.4% of test-days. Recovered every time, so not a data-loss issue, but a real reliability signal.
**Disposition:** confirms the grading/save reliability area (NEED_TO_FIX #3/#4). Not a NEW bug; worth a
reliability note + rate baseline. Q for Codex: worth a dedicated NEED_TO_FIX entry with this rate, or fold
into the existing grading-recovery items?

## F2 — Same-pace class move CARRIES progress under current flags (#6 status) · INFO/HIGH-VALUE
L16 (the #6 pre-fix baseline) OBSERVED: a same-list, SAME-pace class reassignment **carried** csd/twi exactly
(before csd=4/twi=320 → after-reconcile csd=4/twi=320, `carried=true`). So the classic **#6 "class change
resets progress" does NOT reproduce for a same-pace move** under the currently-deployed LIST_SCOPED_RECON —
reconciliation already carries it. **Disposition:** materially updates the #6 / foundation / cycling planning
(the reset may already be closed for the reconciliation path; the foundation program's #6 scope may be
narrower than assumed). Q: does this change the foundation/cycling gating (which assumed #6 unfixed)?

## F3 — List-end DEAD-END confirmed (phantom + freeze EXPECTED-BLOCKED) · CONFIRMS cycling need
L13 (post-cap phantom) and L14 (full-freeze interv=1.0) both correctly BLOCK: a review-only / newWordCount=0
day cannot complete (retake-required), csd/twi FROZEN. Block signatures affirmative on all blocked days
(L13 ×1, L14 ×4). **This is the exact list-end dead-end the per-student cycling capstone (`x/plan.md`) exists
to fix** — the audit confirms it live. **Minor discrepancy:** expected `orphaned_attempt_flagged` system_logs
were NOT observed (orphanFlagged=0 on all blocked days); the block was proven via retake-gate/visible UI, not
the orphan log. Q: is the orphan-flag log actually emitted under the current flag, or is that signature stale?

## F4 — Full-freeze is a PERMANENT stuck state · **CONFIRMED** · HIGH · → NEED_TO_FIX #11
**CONFIRMED from fleet3 L14 data (no probe needed — the fleet already drove high blocked reviews).** Student
froze at day 5; `recentSessions` ends at day 4 (reviews 0.27/0.27/0.27). On the stuck day the student submitted
**4 review attempts, ALL `passed=true score=100`** — but NONE were appended to `recentSessions` (they weren't
COMPLETIONS), and csd stayed frozen at 4 across all. So intervention (computed from the stale low-review window)
never drops → newWordCount stays 0 → every day re-blocks. **A full-freeze student is permanently stuck** (escape
only via manual/admin fix or a class-change reconciliation). Root cause: `recentSessions` is appended only in
`recordSessionCompletion`, but a full-freeze day never completes → high reviews are never recorded. Codex
confirmed the code path. **Recorded as NEED_TO_FIX #11; fix is its own plan + go-ahead (standing rule).**

## Deferred (NOT in this cert): L10 (cross-class #9), L11 (2nd-list footgun), L12 (dynamic throttle), L15
## (seeded bad-anchor) — NOT_YET_HARDENED; each a follow-on build. Their events remain UNAUDITED.
