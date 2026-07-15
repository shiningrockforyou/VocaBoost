# Findings — B_LIST_PROGRESS_PHASE1 (PX_L8_L8ko)

**Run date:** 2026-07-12T17:44:52.121Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L8 S0 L8ko"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L8 S0 L8ko (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:45:48.881Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=xoM-PzJ6HvtDl-L1zQfZzXOPjFBjOpNPkRkMLzZRTLbkIz6z0LUcVg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S0 L8ko → 4U9U36
- [2026-07-12T17:45:57.385Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8MuuYxMSiKDNb0i4S_VDb5FNew-6IDnQQpR_x0ujJJOmcLos-ZpTqQ&VER=8& — net::ERR_ABORTED
  - STEP [L8-s0] join "25WT PX L8 S0 L8ko" via 4U9U36 → member
- [2026-07-12T17:46:05.747Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8MuuYxMSiKDNb0i4S_VDb5FNew-6IDnQQpR_x0ujJJOmcLos-ZpTqQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:46:05.753Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dh9lekh1uLf9ZHY8D3eWwESZZkDRchp2T2VHUjDOFzocFnSt7O_VgQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:46:41.199Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=OHLSyymxw31hIzU2rXEAKMzrbLuRpcFx-eE7wIuYMT_5qev-uAdChg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:46:41.205Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=AZ1g4hLB3i0O7_-EQHzjF1yWyii8G0RGP-hTl0TxlNUdgYaocqDGXA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:46:46.368Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ROOvArpXa3Mt3k93aThSLTxBXXfP9xuSA-qO6DiLQ5RmcKOD0VVc5A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:46:46.376Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gzhC5ZnCKqx90ucZ_IPJwErzQ8vRRcNnx3ogs-vUxj3A91prJQimsA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:22.963Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-edJIYvGruT8qYnI-n_p25VO2MmNqWsUz28jJpEyfkDpT-_Qy1Dhkg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:22.969Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4Qwy-N0MxMO-SIsUyCk3COGegDcF6F1pBNW5goBh7Nc5ZSKouqlJEA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:47:59.231Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=dd0tR_B5Co4bML0zcAUSih2m7-kyWNNXmE3d0lOuAlKIgq3klhrk_Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:59.236Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HDB-ut5XytFRh1mLA7Se0Dm8WNwm7JMk3XZJ9qqVIf_tNyoVw-Ke8w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:48:04.483Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=c-C8UNcYk-TheuqdfcNeEYVp3Y9bF94m9DLLrLEXvldQ0myaXttGeQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:48:04.489Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Gv4lyJJSNEMgkddo7E-2JDNgfrY-jytAALCfn-j3zsQ_q7ENBZOm3g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:48:40.666Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BVEWPU3Y7ioJeZFgurY4ArItLcJtqA7z6kdg-uhgXHAbRJKsV-HxLA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:48:40.671Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NbXnleai_stN7k7MXLe6fxHVpmSZ8658tuQLdGOQQ4k8RRW0nB_qVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:49:17.978Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dS76Vd7C8s8zYDpKZO2vnctoDTRXt1qr9cKhx4M0Zt3LTZhlUCeA8A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:49:17.986Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2OhXeU9NP0zapi-rkV_4cguVYEPwnUdjI0J2KlMGHrTo2afkfBWYYg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX L8 S1 L8ko"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L8 S1 L8ko (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:50:12.808Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7-846i_eDXju_G5yxq35K-n4vK79PjsWAbRr2bq-yR25THJRwgVrGg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S1 L8ko → 37R3YH
- [2026-07-12T17:50:18.555Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_VxjehOqIIXKB_up73Bf8bJO9wx4AWyTV_P74Tr5TFRJw3haz8Dgxg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:18.682Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_VxjehOqIIXKB_up73Bf8bJO9wx4AWyTV_P74Tr5TFRJw3haz8Dgxg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:18.716Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UZzFjXvtoBWgwYs7AEeyIQUM9BBIvlhMDfe_okYGpE58L6oWAVYIZQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:50:18.724Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=UZzFjXvtoBWgwYs7AEeyIQUM9BBIvlhMDfe_okYGpE58L6oWAVYIZQ&VER=8&d — net::ERR_ABORTED
  - STEP [L8-s1] join "25WT PX L8 S1 L8ko" via 37R3YH → member
- [2026-07-12T17:50:25.143Z] **flow-gap** — [L8-s1-focus] single-list focus "LSR Base Camp (audit clone)" != "LSR Ascent (audit clone)"
- [2026-07-12T17:50:27.901Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Tm0PyebhVwH6FqcMdtI-KVJG1vFnFZ53Dwpw6DMcLfBI38xZRmzsRQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:50:27.906Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Xe_romGwIwHqIohtiESavtxPMPeIovHXjn3l-gdCNOyKDYwi7PiKOw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:51:05.267Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ipXYRwbEdI6XGFrOPS6d5ySSGCDQEXJMaNDEfXhT8nRGITv3-dnjsw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:51:05.275Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vPhNBWqqQh0FROvPvqcaMEtr0NcXNc86FX9kBKHXSvi5rMb18dpdag&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:51:10.379Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qAfAjFN-WSPj6xPxv6-L4jdF6qmJ_gR2EoIbwW5BNsoKxATGjsrVnA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:51:10.384Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Q80eGhwMI22Qqa-wSyPHl7ZR8rGmz4E0o81mOW3mPWodfW5aeRifdg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:51:46.960Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Svmt_GipuNjNug_dpSL3jHWC_gfDuRlvr-qRpobordvd9vTOArLVQA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:51:46.964Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kc7VYR9I-gJp09HfWiblViF8XEYN2oh6Kk9bqySJrz4zQh9YNe5lAA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:52:20.892Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=FlnS-lF2HsckpiD0KjI95pAxsRtqnWklmcht4bvnWrSQPnQOjvUKQw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:52:20.898Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KAUFQyLNq09Ds7zoBU1VmHK5M5sCEAcBbIbkb3cU4q7R2bHlQe3kzw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:52:26.025Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ioKNmUJSV0zZtOfSYY_GedgbaN7h5aUUHNUqP1A99hNeZN0ghPAcCA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:52:26.028Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ez8GFDgVV2UIBn2amQ1n_HqUcj9EjYTdu6cZ7j80nSkk7pEcTmBXxw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:53:03.060Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ii6lniZ0eC5BhmtM8Q-zhIdCJQQrAS4RnRnHmhgH80PZreijqJo3GQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:53:03.064Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VL_hWWk7BVj2iU6fpRAF69j3aLmZ2piqmIGMtOfDWwDhmuonD1_Ubw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:53:38.028Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fhrkKbmSonW5nHeYbygnVBrl27R5LVTYkTceTAGr5NFR7eRJrJ-aiw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:53:38.037Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Ehi52gwSwQFpvOp1zAAs6QmtaeDgSzWj8-DZ7pTF9G-iv-jETZPTzw&VER=8&d — net::ERR_ABORTED
