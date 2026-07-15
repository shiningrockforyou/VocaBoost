# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2v4)

**Run date:** 2026-07-12T17:30:43.234Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2v4"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2v4 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:31:44.520Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QzfZePUn2yY4eFUx1VSnzqt7fhiARwmBovDqu_rppc_G2tkXV9rpCg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2v4 → FLYC6S
- [2026-07-12T17:31:55.284Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zc3u_7MRFm4zgM4zv_5Mvqg_AntE-kNg2LvzvHL-hVbfMiokOnB62A&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:31:55.293Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zc3u_7MRFm4zgM4zv_5Mvqg_AntE-kNg2LvzvHL-hVbfMiokOnB62A&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 L2v4" via FLYC6S → member
- [2026-07-12T17:32:06.367Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=M0d2rSNnGLmg62pYWDOLkCmjzho2jXlJY7SOOFlZ1-4FKtH8HVdMhA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:32:06.375Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=c8Gzmnt-Z_PrMNolxoDyt9HR-u0bxbc__RNW4ErfcFkPBvhpsGsUHg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:33:11.833Z] **flow-gap** — [ascent-d1-exit] on test-results route but "Continue" never appeared (20s)
- [2026-07-12T17:33:19.751Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0XjSDZaoypxkwtNrkk8QYg3w59zeMlaE2kQD6fwf-VcmZfs29I64ZA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:33:19.786Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=282HGDV0ArqXh5KrFAZcP32UrVRAL2Sf8j9bbtuSTyEf3WpUTK-Utg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:33:32.965Z] **info** — [dbg ascent d1 finalization-miss(csd=0/exp1 cont=false)] active Class="" List="" url=https://vocaboostone.netlify.app/typedtest/NvrOoYGRU0XSYrJQgD0K/ssjsJSyeUk6F9yRXBuwN → FAIL_ascent_d1_finalization_miss_csd_0_exp1_cont_false__L2v4.png
- [2026-07-12T17:33:34.761Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0XjSDZaoypxkwtNrkk8QYg3w59zeMlaE2kQD6fwf-VcmZfs29I64ZA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:33:34.769Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=282HGDV0ArqXh5KrFAZcP32UrVRAL2Sf8j9bbtuSTyEf3WpUTK-Utg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:34:09.834Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=quT-xr2M5kH1kmIWRBTZ03hblpYf_0XJ8gnupitVYHfHz6d9ooFnww&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:34:09.840Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fCZ7emBZGSA_gfqfCdbfmwtQ3atkP3Fxqlxf6ppf5GdM4HPuSOkVaQ&VER=8& — net::ERR_ABORTED
