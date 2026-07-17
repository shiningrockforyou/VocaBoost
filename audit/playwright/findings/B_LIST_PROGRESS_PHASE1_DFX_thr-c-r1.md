# Findings — B_LIST_PROGRESS_PHASE1 (DFX_thr-c-r1)

**Run date:** 2026-07-16T00:03:47.377Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFX THR-C thr-c-r1"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT DFX THR-C thr-c-r1 (pace=3 thr=92 mode=typed) → ok
- [2026-07-16T00:04:46.558Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BAL-63JyYhiIGQMV3eOHxRIhflIYmBxPVnaxAxtjgqlzDaZZ_S4pRQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFX THR-C thr-c-r1 → J852EA
  - STEP [THR-C] join "25WT DFX THR-C thr-c-r1" via J852EA → member
- [2026-07-16T00:05:05.452Z] **request-failed** — [student-THR-C] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7B2kRIW4YwLcZF80DRAIoYqinQYxK80FOBtwPkCMKk5gPNgsLdEEYA&VER=8&d — net::ERR_ABORTED
- [2026-07-16T00:05:05.460Z] **request-failed** — [student-THR-C] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Za2eBtITa1XPKRVzsk6q2kKyL-62UHXw30URoiafxOlYrmPNf0VF0A&VER=8& — net::ERR_ABORTED
- [2026-07-16T00:05:51.287Z] **flow-gap** — [THR-C] on test-results route but "Continue" never appeared (20s)
- [2026-07-16T00:05:51.772Z] **request-failed** — [student-THR-C] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bLd54zd48_r1nQ1qyrrzYvfyNp6yEyeDr81xEz8x4OmYQFZqAOLNtQ&VER=8& — net::ERR_ABORTED
