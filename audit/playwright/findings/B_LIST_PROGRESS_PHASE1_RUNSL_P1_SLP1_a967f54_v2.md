# Findings — B_LIST_PROGRESS_PHASE1 (RUNSL_P1_SLP1_a967f54_v2)

**Run date:** 2026-07-12T12:13:28.039Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNSL P1 SLP1_a967f54_v2"
- [2026-07-12T12:14:15.397Z] **selector-gap** — 25WT RUNSL P1 SLP1_a967f54_v2: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T12:14:36.838Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LNoIwigFtuXFhw_LXdTfdqDxNSWxDAf6slF04usc92_E61mDDlPDZw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:14:40.948Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9H12Y-UzdNiDTDtIm4BfC1PlELYH0KG3VNSn0BHQgxHXCSZ8-Ik7BA&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:14:41.026Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9H12Y-UzdNiDTDtIm4BfC1PlELYH0KG3VNSn0BHQgxHXCSZ8-Ik7BA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNSL P1 SLP1_a967f54_v2 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNSL P1 SLP1_a967f54_v2 → GF5QG2
  - STEP [p1] join "25WT RUNSL P1 SLP1_a967f54_v2" via GF5QG2 → member
- [2026-07-12T12:15:18.636Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-x2QRfoi3td-b5ogHNi7buvLCYVIFUitIdn8n1v_bpOPr-lAqIkAHw&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:15:18.642Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fDt795yZjw_jaJqFRniFDPLbsnDeAYrFm36zOATyWc5T7itbx1aE1g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:15:50.781Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DbSXDQV7ZOka5ABfzuQvg0nJtusNeGdllcl31o-rv46IJlpqMnhl1w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:15:50.787Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JIOq-UrhojN0M43maH8pbPjMLnErYZ8FJyHp2Tzk0pwq9N0sOWpqBA&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:15:55.908Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=E1CUk2iCDNYOQtSo3KUswsSDeTm6XVp8XQHty0OR0TXNIbWl3Z6p7Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:15:55.914Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=D44zXSVvTjpaUhhEnSF40ZaRO0oNqMVShOdiMaOs_29twkQ6Oe_lww&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:16:27.638Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=b5mbKDXpNhVnaJQH5Q_jNmxc5hPXzoiPM-sSPqViN_mt4zM0nc_hSg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:16:27.647Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_EffFup8PmQmaRFy5CWdMeOb6p-0CnL5WAt9HD_GZJwdW_uCc5dyxg&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:16:52.606Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=uJPso4s9I1BXMB3Bnx_pH7_NmET_fzpjyMBMPPH5r9bjziT8WHBQKQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:16:52.612Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5Ol176RgeEAKsL8TDoWZwRSNJ4w-SiKXdK3p-_zgoqtHgOZ03QzdUg&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:16:57.729Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sPQqh5AxqI9MgiDVkooUTEmmCjuVnhgUeTdcsCjVxG2ekuzJto7vnA&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:16:57.734Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7ciITRAv7FiekvyM_F9s4G7RNmUocMVB8pCFhx2WFH4UT8dUU8rHlg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:17:26.853Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WDX4eLwLIanoUm4C59gk7D-CH1uoodzMzWwTWHbPOQTGy4NpdTr5kw&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:17:26.860Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UXBlu87rB6IKrewold41A2FGOFgEKNQ0S7bnSQ8HpUV5WbIgIW4lng&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:17:53.463Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=knybITQrcB-77mmxk-6NtfuXyKdg1PeAnhuN-XaDEcTNLI43MbZV0Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:17:53.468Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qK1UZNIZyz106oW1N87YnGGwMhH52kDRhx0eMXVaS8A5umk5x-v8qA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:17:58.579Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=aoE8lRhoVScikNTXnU6J8WaXpL1Z0Ig7uxhRxtq_5xMiKEeQECUTLw&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:17:58.584Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tORepLXl6a_g8Bh2NVsZguLRvjQLOGM-R5IpiCoa02zoXekAi6uDTg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:18:27.781Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NyG4Yfyphc8wJDkuL8H_p2b5QCy-2VZgFuNWD9lfFh4OE_RtBIpMMg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:18:27.786Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=eJBjl_Rh71rfBSKGbYNH4cqnn9_z4a2Dm3RXj3ne3Zf1YSy1v6qP5w&VER=8& — net::ERR_ABORTED
- [2026-07-12T12:18:55.123Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6ww_ETIX2Y57I6PGDVxF_FQLkp8GvcqL-ojTFyvKr4q_ETtmrejy2A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T12:18:55.127Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Y0A30UNWQQji4O-wvtloxgp9faPXbS-4dZ-spkIE0xtoOxghG5LO0g&VER=8& — net::ERR_ABORTED
