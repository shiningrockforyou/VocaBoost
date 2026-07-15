# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_L14inv)

**Run date:** 2026-07-12T18:02:05.357Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 L14inv"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 L14inv (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:03:05.526Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=M97BTdTb996me8sYXemRLbRkDiHTqa6XMULJ9tTAVwjD4EYukjc0BA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 L14inv → DVGH2M
- [2026-07-12T18:03:13.481Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FvrSobsGRYho_I6sz7ufVkalnDkmAVL4soAJ7nVyCxTjaTcpEiicrQ&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 L14inv" via DVGH2M → member
- [2026-07-12T18:03:22.733Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FvrSobsGRYho_I6sz7ufVkalnDkmAVL4soAJ7nVyCxTjaTcpEiicrQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:03:22.741Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=25hp-2C6hBlijoK6vHfHoQkd4vLV1VyR9KgW6Yt-1xTaEPIbFBVCGA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:04.318Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ah130XDyqFce18T0GW1o-CypuppHkXd_kkE2a7SOfzOJs5i3N7dW0g&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:04.323Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zl7zcTUzHXnUtxVtQEfvffVaDlg5BstJt9_3vjLyN1n4KjN5_jJLHQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:09.572Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nC9ZFxlsPx-nvKrxDzfWhzPwdjrkKrO1vEWewgHQ8tIo4Hu5Fgkyqg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:09.576Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=pbQcuHCQaUmNJlI8z5nj1yaqL0pdRpRZh35EW13cTaOEVpvREozsOg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:46.279Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lC3vs0fnyMAJLXfzswjrSx-N8b1ms8GTcrtnH58kiphP2hFrB_Qh9g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:46.286Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8rqJhCvd6L-fFGBUDeTFMPXRvj36Z6xOoIMfxPi4XDQyjo6is5VAJg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:11.063Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BgpPLRHw_UZDEMiDw9TdkWClMl2OWAgWlIZTgA_YfwOGsggoZn3ibA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:11.072Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TmFzXNnswxeqSVJSCofdJTJTSKX76fNn4_gs5rT1d7dtCg1tnR-Vaw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:05:16.224Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iTrcgtu5porqnFE_fzms7MGh7BT1IpzZL9_XJ2Dy_6ODmovpu733Vw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:16.231Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1dpH2x0kOdbaldPCuqP3D4GEU5YQxBncMtYrXXrMT3R7oPL9-xDA-g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:05:53.508Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2Y5X-gKBwYdV621gCc5WIR13qKakyUFyd-yQTL25XzEmLJ5O6FjT9w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:53.513Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=QjpZ4PXdTZ_8rqubgmYLPfJlqei15bUjzDmn4DTAMoG32QTvoMflJQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:20.425Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FpIHD9pmemhinqVDmBfvvA3mtpUf1uOUj0bF5hKblc-eIHYP6di6Nw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:06:20.432Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fc6jgJZ5Obj7EnSXoxTDnX2686O9b_Q3aC6I5tUz_j3mI_ItPX9Vcw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:25.571Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sQK5lo5b4xqGfz6z1tKIV_2XRnuSq45bfvssDaZ3-Wb5jo6Q6uQI5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:25.577Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yFSn6qatKvB7sK90zdXCKmnz2vdmT9WNnUuy8xMHu3uHR-rAl2J9aA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:01.893Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0pcyR5S66cVP95kb1gj1qUzEq2o1dO_tnXZPvAk_yQYNS7ZX91iSbQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:07:01.899Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L2agtz7iLWY0LmZoige_6hA5DsUNUzixPJiYufOeHbeoeijel0eGUw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:26.722Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CwTSaDK69Tx59EzQYhQf9d3OPUyFUV9BbGIuSaBR3sgdPsUgazFpIw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:07:26.728Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5XEX_uW2eTl108RYWZLeLmZIMqe6fwHsk2R_bK5grHz-qtV5_4dr6w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:31.912Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=xAFIwEcmLLt2MG4GqTmJSFlro7cobupgHRcXTIBPO3rs0wheHZ_11A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:31.918Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ITJ8SXTLiRZ7geJ7K7r2jUazVurxBybJ6xwMZ4DD16ER1zYNN09nVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:08:06.936Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:08:07.024Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EylohUI-YmAfGqVXbZ-0dVYgF5AeM0pIImu9nyO53tmC7Js68e-42g&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:08:07.034Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Fi9PLsymWTENNXS2ynLnMqWrJLRqS_wEPEgtCSGwAJw6hSbJtCNTEA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:08:13.430Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hn1Pg4IIBL3ULHvmASmgBkoPhdvutHNum1WHCMJrefViQH-m9_2JHQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:08:13.437Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=gU3fate2urGFqKUVGEsplhepMV_9K1Dam1iboPJQiPjuiL-h-vqyUA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:07.098Z] **info** — [dbg base d6 blocked-submit-exception-disabled=false-inputs=12] active Class="" List="" url=https://vocaboostone.netlify.app/typedtest/VIgEjjRUEHbwJBz5jMN6/QwyGU8LMo1ffWazxyjrN → FAIL_base_d6_blocked_submit_exception_disabled_false_inputs_12_L14inv.png
- [2026-07-12T18:09:07.100Z] **info** — [BLOCKED-INVESTIGATE base d6] submit exception=TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getBy | submitDisabled=false submitVisible=true inputCount=12 url=https://vocaboostone.netlify.app/typedtest/VIgEjjRUEHbwJBz5jMN6/QwyGU8LMo1ffWazxyjrN
- [2026-07-12T18:09:07.115Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:09:07.342Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=STz5fMiN7wOV3P2VzyFX3D2uoCIRfI011L_l4V37CloY7aAcjVHnlw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:07.351Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EzsLq-GbGZuy0Gf-reqtw1a2lVd78aJ2MKiCZZB2dXr-UecH5WcVzA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:12.502Z] **verify-fail** — [L14 s0 d6] BLOCKED day lacked an affirmative block signature (outcome=undefined, uiBlock=undefined, orphans=0) — cannot certify the block executed
- [2026-07-12T18:09:12.519Z] **verify-fail** — [L14 s0 d6] counters frozen but NO block signature — possible false-green (day may not have executed the completion gate)
