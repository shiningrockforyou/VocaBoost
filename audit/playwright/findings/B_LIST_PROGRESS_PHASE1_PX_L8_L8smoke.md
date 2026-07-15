# Findings — B_LIST_PROGRESS_PHASE1 (PX_L8_L8smoke)

**Run date:** 2026-07-12T16:39:57.887Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L8 S0 L8smoke"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L8 S0 L8smoke (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T16:40:59.488Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=S65KKPK76OiBhM8u1lf382XsLhy6mSOhIvaJUJ3i8vJl33mILa37Vw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S0 L8smoke → ZKJLY7
- [2026-07-12T16:41:09.370Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LkX4Nb5mAwEyMt4DV02c9k95P9Y-nkpGaAheRIMUvJpqRjrVIxg22A&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:41:09.375Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LkX4Nb5mAwEyMt4DV02c9k95P9Y-nkpGaAheRIMUvJpqRjrVIxg22A&VER=8& — net::ERR_ABORTED
  - STEP [L8-s0] join "25WT PX L8 S0 L8smoke" via ZKJLY7 → member
- [2026-07-12T16:41:20.466Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=v4c6V2AbgVQn1T2RgwkMlL6oHEntH7Og_dyT26dUM7t0phN0hw_CPQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:41:20.472Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qZ5ASpFl0YqqxKR4RuNbWwaHNsW64iO5LoVv6XXiJi7DatBQyvDRHw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:41:56.604Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3XFlnIEWPDMmLndwrgspgLCfXbsrQUxm6eSQnO6KBj26BMzQt4drQw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:41:56.610Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rHVO-a9HYPS-aO6adgf9CATdWfvq86qGxueKYkzx3RyveeJDlYiIqw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:01.795Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xrVJBiMcoTNLwPrGlL1A6B4LwOunMdrhevTil0E7Ka3wv8a6n4gjtQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:42:01.800Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7VaZZO7-GcIKBiHH6rXjXahe72PyGnD4REh9cvdozUOR9HU0CVo-xw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:38.667Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4mi2gf7cCVvGlTn9m_WGK97HIm29G4YVZqpiTXDxLgbYZFFSub5xTA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:42:38.672Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cml9q0GR6kHkGr-Hd7sCEzzLwLhRxhQAPodhlAolUVJpmxhzZZfLJQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:43:12.379Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WqZjr2kGUADmbElmpCbwMudGYUm-NuGIS4ecsXsjIxFIK9DhXUktMQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:43:12.386Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sEWNLDS7uCLS9WEsNRtmyODv9tdkVWpIe54TxTLCFGvBYpNE6FyhXA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:17.594Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2C-DTU11kxkUYcVInVrmHaRW-9fCHHbGBGXgdFC34s_Q0aZpI8wmdg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:43:17.601Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tgdmCgJqMXtJb637hpYYQaZBzudZ1VJjA2b5oJlrKd0cHNiXe2um0Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:53.252Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ZjDhe3lz5fF2u9dKw68gs3u0Y7tpcOTetD4TzAwe8GLJ612lErA5Gg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:53.257Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ejrd42nVfL3nq7cRK1l1RlhSTDgmgStyfcGgKSlsz7WmeF99BUpwAg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:28.211Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bErG6_HR5axmPYC5LbteCFEy2FRyESk5pYt660FZmK7FOiLip1NDeQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:28.217Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Qg3JEXS9VbsDmUQEoJOW-bClJWycimvCYHJ9WmbWf7_ZC3Kfu0EiVA&VER=8&d — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX L8 S1 L8smoke"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L8 S1 L8smoke (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T16:45:22.912Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ry2SrtuYSHVV6i7uZp6Yd3HE3vFtK1RxwinJXXDXFIoTjtJLfDBwmQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S1 L8smoke → 92ZM5B
- [2026-07-12T16:45:28.817Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_ehJeV6mvFi2CxjViFBJlroTLQsczCkE-kOyWiklU-DfDp4IBsoJeg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:28.901Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JQR62_wQu3_WfghpnVQdX1OEOUdHftViG8OhDr3n-SuhAnGpAL_dNw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:45:28.910Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_ehJeV6mvFi2CxjViFBJlroTLQsczCkE-kOyWiklU-DfDp4IBsoJeg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:28.946Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JQR62_wQu3_WfghpnVQdX1OEOUdHftViG8OhDr3n-SuhAnGpAL_dNw&VER=8&d — net::ERR_ABORTED
  - STEP [L8-s1] join "25WT PX L8 S1 L8smoke" via 92ZM5B → member
- [2026-07-12T16:45:35.337Z] **flow-gap** — [L8-s1-focus] single-list focus "LSR Base Camp (audit clone)" != "LSR Ascent (audit clone)"
- [2026-07-12T16:45:38.107Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jiVN262RNZz_01vwH4oIzdDuWybyDTgIXYrPJfwmwKkKx2YTNe4ExQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:38.113Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=aZ48PZDHaUK_j3hQzVxxjx3N_Nk60vfdm8sMp0aG0ob_E6vw1E6ZSA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:46:15.713Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JS93L1YsoQQutievBuJhiIfxFa2OT5obdvJB-86-J9RYGSkbflKxWg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:46:15.719Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uyw_auB2eemozEJ4eOagZ8ktXqzp5nkq5kqNNyQOUuA8I-buNJxFrg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:46:20.934Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wCx9uOTq-sF5OzcSvewboENm-AQ0Y00KHKQaRUacDzDO4jBlaQFJZg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:46:20.942Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vbyIq3wCSstdWVXGaqjkpsQxgRA78qpO6etmhN3nerrTOgzlweZBgQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:46:58.091Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=wQn1DeiozAgMEJpG4CoFQDY1LhTwdHFBwfTT6szWF-Qr0ossKDc2Tw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:46:58.099Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_lGHgMjeWgeQ3hPILV_r6fnZ4cLtamCV-tKBjfL2A5R29gwMDxFxcQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:47:31.627Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=3hOTkBz0KiPmX-UykmO0FkrUoAlSTL9pmcD2Uin-6r8rIQzEjDIOvA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:47:31.637Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vmZAmezgbIVQvuQqRSlRprpH-jf2mzCrGdP4bNUlbOemYDQUG0DSRQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:47:36.742Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KAcBiX1R7NOxn1N04KYZhU3ccTIK539e51XxPuacjwaXmic-Ay0Kgg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:47:36.748Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=be08_E8yOKXfXtjo3WehsrU6UbC7fd3BOkFGH6KD8GttWrMPy1oGqA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:48:36.716Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_6W3h884PeeEaDMixVUNkA18vqZpdU4v010jgtzi8XpLaYe5ffNYiw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:48:38.213Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qxaPBFR_n3K5U5FIO14ds_uL90wpjf19qAYclsrcG9wnXYt_T1TzRQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:48:43.529Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T16:48:43.749Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_6W3h884PeeEaDMixVUNkA18vqZpdU4v010jgtzi8XpLaYe5ffNYiw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:48:43.759Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qxaPBFR_n3K5U5FIO14ds_uL90wpjf19qAYclsrcG9wnXYt_T1TzRQ&VER=8&d — net::ERR_ABORTED
