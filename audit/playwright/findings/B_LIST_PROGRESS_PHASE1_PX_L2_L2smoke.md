# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2smoke)

**Run date:** 2026-07-12T16:24:34.075Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2smoke"
- [2026-07-12T16:25:03.458Z] **selector-gap** — 25WT PX L2 S0 L2smoke: assign list select "LSR Ascent (audit clone)" failed
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2smoke (pace=80 thr=92 mode=typed) → unverified
- [2026-07-12T16:25:36.160Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XwJVd4n8HCwl3F-ty2NMhtD4segd8GPFjBhuvYS6BLvFd1N_dzF1Vg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2smoke → XRW3S5
- [2026-07-12T16:25:45.755Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qPoYloMx1g8rr6qdUAmquQFMuqNqVpuVK9SpAbUwCP4GTMqS8vEGFw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:25:45.761Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qPoYloMx1g8rr6qdUAmquQFMuqNqVpuVK9SpAbUwCP4GTMqS8vEGFw&VER=8& — net::ERR_ABORTED
