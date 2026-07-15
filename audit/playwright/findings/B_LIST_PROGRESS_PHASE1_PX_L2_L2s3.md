# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2s3)

**Run date:** 2026-07-12T16:35:10.707Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2s3"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2s3 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T16:36:13.065Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=P0sJjcT7X_xQwqef4jHC-DYbHoZ77QXiP0uW0eXkVvFuEwUJsbIUrQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2s3 → XAHFRP
- [2026-07-12T16:36:24.923Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4P2QK8lT98oEQd867KO-m4HLxLtW08MJaEd00YZnP2lTfL6L6IcpHA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:36:24.929Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4P2QK8lT98oEQd867KO-m4HLxLtW08MJaEd00YZnP2lTfL6L6IcpHA&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 L2s3" via XAHFRP → member
- [2026-07-12T16:36:36.011Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eDQ8YRFBRT3aQmFZ8aDzo-COJLtChuIQMdtkoemr8_dfwNahyck4Dw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:36:36.015Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1G-zsG8cCdoia4UPIaM88d42Peo0kBztnFZtw_UO2cbOK7u5aU36lg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:37:19.248Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Re0_GjMzUWjCRU62y7112-LYE19vHFyuZMkHhbc0YM3zRJb0QHOohg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:37:19.255Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pc914IBLRo6NRBMdWv0EmUPn8Z7MqZGRIxCPgX3nnYP7lU8pcZ78xw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:37:24.488Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UQI-e1zst6qtTv5SglXfd_fn2QBuGlJbEWXQ98VB3cAxqO-S2MZVsQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:37:24.495Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uzc_0j48_Cyl_fRlbMsYcugKDY4KZMGonYwLpbMcMNQRr2br-F1Kkw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:38:00.715Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=luTtv_SqrWyXA2du5jCtk4c-48xuUY3WgPw2uRwyR5MpSWx3NkxKXQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:38:00.720Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=d-_tC3Znx_ovq3YdZ_C9-25cwA1G07MUbORsdeKwP3aai8AXW7eTAA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:38:34.743Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=80YW2lmvbQUcXa_AuFmGTJ8VcqV0b1ajc7bJXwa6S5SI2lHeZh0lsw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:38:34.748Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LMy4bhWkzwcEpspwz-NJAeQo1JKE6av0bi6RZCq3SZJTKeWAd0wxKQ&VER=8& — net::ERR_ABORTED
