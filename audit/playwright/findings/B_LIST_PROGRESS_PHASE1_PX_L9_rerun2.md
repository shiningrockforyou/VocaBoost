# Findings — B_LIST_PROGRESS_PHASE1 (PX_L9_rerun2)

**Run date:** 2026-07-12T19:55:26.769Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L9 S0 rerun2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L9 S0 rerun2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T19:56:27.812Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=prNAFJ8HO07DEFY9w3Xk9_T8Do57Y7OQ1re9EB1G5Fox_UPAFnjpRA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L9 S0 rerun2 → 4GV3JH
- [2026-07-12T19:56:36.586Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=o1Rc0JriQNBy8cLtSmDueCP5wX_akofHb56ZkmEvZ2i9GT3HpFKYaQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:56:36.593Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=o1Rc0JriQNBy8cLtSmDueCP5wX_akofHb56ZkmEvZ2i9GT3HpFKYaQ&VER=8& — net::ERR_ABORTED
  - STEP [L9-s0] join "25WT PX L9 S0 rerun2" via 4GV3JH → member
- [2026-07-12T19:56:47.642Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1DpjeVOIUUq_-gI0QJG6RZarCJTJ2dL6ey9gryNFTXw20G2i18hdjA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:56:47.646Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OYiQVmafNfnrT-6VNyoPLlkG-qRiSZbQphvz6prExVMSBgSY_Wfovg&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:57:23.007Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_YAz2cUD2svHlc_Qm9eIwyKJDMaeHEDjcY8Q5BVjVglGEcQP4INvOQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:57:23.012Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BzcvIO0sVtx_2N-2EE30nZItjUKihAZNY0NvLLd0ow_XqBd4k1PmEQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:57:28.205Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EBm3l7t_z_5PXjUAW-rpqnW5uCzgmIDkBPNh7emFR7c0IeNMjAm7Ig&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:57:28.211Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=X6wqutFI-KttthpRXY9BpgHthbI2UuYZGPzG5OxDMHSme6LFNOxTGQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:58:04.853Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fs9Hr_snWA32wCtyOr7Syphyhn78-cjefT0Itvm_IatZ9kS1Gq1d1Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:58:04.858Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VcDSrl1BPMQq3ue71DpuhClXO9zP991QqXP1kczzLndpUDunI7efpA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:58:38.847Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nspYQ0Ft-VlNmmRv9r4zB-PCjr2902hn4O_MoZ_j0jgR3tzdegPZww&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:58:38.852Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2zsN0ja7SjGxS9HhqmoaiCWHMi6vYXj3HpTPWibD0Gw8IRSQYU8xoA&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:58:44.071Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7rMK3XKLhg9utZaw46le6hIcJ6fuxrirC05uOqJGkJpvMTnf7ImWYw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T19:58:44.081Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lUtHGKoPVDaEgn_cuFj92geVRpgMAK4T57hSWCiMKQD0QAo5Gzadzg&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:59:37.312Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=y93FAD8Dk3uYFmTlFJ9Rkwg6OhDSEV9IhxllEuDR5K9Y4CIKYBKhmw&VER=8& — net::ERR_ABORTED
- [2026-07-12T19:59:37.316Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hk2yPWD0-Kyq_QcVj3HHLkkBL_ayfdEttjC-c2ZSMg9kQv_mmeUE0g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:00:11.406Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YyuZxrnyWh8fl0kgSuY7cpPfNaKN9tmwSwyyoMZE_a7-IKw8BVOjzA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:00:11.413Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JqzPHwhIrawRc75rDIkOznCzNcUyjtUjcj6h0aa6tcbEirK_vwbnUg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:00:16.597Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fyaZJ0BOSACEPOZ-k7pJo6qLAuG6Q0AKtOtIi-1hU8juNsuIMSEBSg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:00:16.602Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8OPK6Rcnb8A9tRdfPh2ibeEm10v8cgXvx3rOvGNgV_mon8PX3mPAGg&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:00:52.662Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=564FLxR7jAynXAjQ4X0iT50hDIPuufwEE_faKVIvoTwGvU56DhAD8w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:00:52.667Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=UikTSYrT3t7U-c68FxM2bfNptfSKhO19_8lCN3NFiWCRSfmUuauskA&VER=8& — net::ERR_ABORTED
- [2026-07-12T20:01:26.511Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kG74hWyE9I45J0ThdjPzLlzpukpuR-IEuPjTkFcT50SejTd-mzBHaA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T20:01:26.516Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ecilfx1bJ3nJRVGFvXsqQznpyZG1f2uccHBM4fzIbUe4TwIW3ZwwOA&VER=8& — net::ERR_ABORTED
