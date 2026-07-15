# Findings — B_LIST_PROGRESS_PHASE1 (PX_L9_fleet)

**Run date:** 2026-07-12T18:37:42.364Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L9 S0 fleet"
- [2026-07-12T18:38:51.702Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=1c7M2RyJbGEPDYuGjeQEmz2gdF0xqqaNTiddutXJyvVLykl8y-5TbQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L9 S0 fleet (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT PX L9 S0 fleet → 2CKFYU
- [2026-07-12T18:39:12.426Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bvZkcy10E_m7ZMXeHaXrc6IN1lf4iCfMfuIZn-xtdWs3yzo3_Zm2OQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:39:12.431Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bvZkcy10E_m7ZMXeHaXrc6IN1lf4iCfMfuIZn-xtdWs3yzo3_Zm2OQ&VER=8& — net::ERR_ABORTED
  - STEP [L9-s0] join "25WT PX L9 S0 fleet" via 2CKFYU → member
- [2026-07-12T18:39:23.555Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=oytLrRckVega1dBeHExVrsCjoehAS3hXSx9dq3d_5Gu30T4o_HrhMQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:39:23.560Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wtsUFiWpl-xUP3ZT1c0nG_hSiynQBWKFMuqXFNZl_EqqKq2Eja8mgA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:40:02.467Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GnNPZpFJXBeNsTeuP0pp1jGhZvEVD49rCsux9XwaBZSxHDXylWYXqw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:40:02.473Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=15J7ZAMHhWMeaQcLSQforTP5hj-Js1__sAr-bR_M8NA9moYiCI1ATQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:40:08.039Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=86RpCpaVI3xlEMkC-TJ43Mc1n5f7Jopw_eC0Hwsog31XTqZ6dnmj9Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:40:08.050Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xsqwYPxLAh2ib-7X6gkV5E3pUu2DrGeXc6gC1CJeTtIIzy5we5t6WQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:40:44.971Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=pfNlAxN6X45G8JjQR9oPDyA4ItK9MQFuEl4uBlREnIZ066W4M-mXug&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:40:44.979Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PDcYVvdaN_vxtUdXb8zvscS0GfDO3UXCvQEU4IOsYpUXocA8MRVD-A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:41:20.977Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=fzuBGa6pgDcI1_q1DVAoElyJyxrgD1OmwJYNvu71BF9q0YzsYLF31w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:41:20.980Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-JRBrsAfCjhIcU7_6fxndg-cwkTnTDXxhyg3YRqyXmxGzNiHhw3zeQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:41:26.222Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=SF_Po4H-k1KuxK2RuvXtZz3I-fPgduOjK2Yt008fW60Rj4ntckxWqA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:41:26.233Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2ooT8pOZPrG3WRthqwb3TUMPPWWay5COCPbaqqRz8FcHEfsblPVjIQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:42:08.631Z] **exception** — TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disabled type="button" class="inline-flex items-center
