# Findings — B_LIST_PROGRESS_PHASE1 (PX_L2_L2ko1)

**Run date:** 2026-07-12T17:40:01.574Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L2 S0 L2ko1"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L2 S0 L2ko1 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:40:59.005Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=b4MzU2X9ZS4w9HWE6ywGHHOsMEBhPKGl-HabAX4cXeSHwt4d4V_f7Q&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L2 S0 L2ko1 → 2NJ6QQ
- [2026-07-12T17:41:07.543Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Tp1S0c-vTd--2Xzo6pIsK6PeslzJJJiIVvsvr5397cbln-oMh6eRkQ&VER=8& — net::ERR_ABORTED
  - STEP [L2-s0] join "25WT PX L2 S0 L2ko1" via 2NJ6QQ → member
- [2026-07-12T17:41:15.999Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Tp1S0c-vTd--2Xzo6pIsK6PeslzJJJiIVvsvr5397cbln-oMh6eRkQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:41:16.011Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XKOWkmcEIb2aHpf0dXRyG4kPd7Qkk4ygDTmE1W7dVcZIQ6YJsM4img&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:41:55.117Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=o_KMXlFKY1z7ESX-N0QuotJP3Z_DDAWswupNeFA-gNhsYFBFFIbggA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:41:55.122Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=FQhCT_J2y4rqx2hIytL8e7kpKZHIWpH-izpbhT2TxREZyIi-n_NlMQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:42:00.305Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2uwyqWz_cKW_0hw12SdceHMqUrcJfDPatiwjtTIOG3gtmkWqZOf8XQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:42:00.311Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pGRd2dSDnnkD4uzpX27AAI_7X2TNRwMUD_Dc1fzU5Zy1MS3V7Tj81w&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:42:35.964Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=FDKvSIwAsCjiMne2kaRXzaVByupxmhfohgUjMmQE110_Vk1vwvdKMg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:42:35.970Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lHHiso0UoNbbYUVWKhp6eXwFMiR0drGq-2RHGxVHPk-ngYDDXyq1vQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:43:09.850Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OES1ubv0kWUf55BfNTqleCy0PTcJtXf807Nf5m8SCQq2ajB_UvHt6w&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:43:09.854Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XwIuej0XsWyn-OOf2UsVh4CvZ6IWg923SRae3C9pmcQvkX19iebqkQ&VER=8&d — net::ERR_ABORTED
