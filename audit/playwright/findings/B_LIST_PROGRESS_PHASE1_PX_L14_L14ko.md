# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_L14ko)

**Run date:** 2026-07-12T17:44:52.122Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 L14ko"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 L14ko (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T17:45:48.897Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_ZxnqB6OyTEsLyd0rrksRde3IQBVTCAKNXTR0txW5DbFM_xmRJ2-Lw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 L14ko → PT7UN7
- [2026-07-12T17:45:57.383Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QF3QjkPfFkhPFHScY3METR-ZNsdF4F8E6BmkZ51nVOnRteNui1YeYg&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 L14ko" via PT7UN7 → member
- [2026-07-12T17:46:05.761Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QF3QjkPfFkhPFHScY3METR-ZNsdF4F8E6BmkZ51nVOnRteNui1YeYg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:46:05.768Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L9mNHmuPfHmHeWShB9EOjBa8eZx5-GVed7Tm976lr0SRTwwqm4QkHg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:46:42.705Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zU0SJpPAWKMmBu6sm2ASxWyw7hM2an-eMFq7WbSTD3MUFTcfYhfQYQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:46:42.712Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3yXWegxbkA08-UzGjM_zdlSv_kUkmdBoBwVnWE3yoAwHZ-IC4fzrYw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:46:47.901Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=yA9m6nQODCgPllp57AC1_uabexZ2OyxCwnGCLEWR_pWcAYcppAppFw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:46:47.905Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Sz_B-mwsONvH695lvFCyniZQQ_RJ1ZQSByEBr5mzapr-iVBIT-8_iA&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:24.460Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NsGkDIEY3nrEiQtrSOe5akoJmzXaRllnAy2nr4hY-X_A0_WuWnX-Pw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:47:24.467Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=a1O6E0iQB7_qcdpwV-d_s7g5SZD79SeOVznbwBXtrHJ8-wgQbuSTsQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:50.312Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=x5Uq91rjzS000cel3zqTWdeAIjjwyH5uM-cIdRD2VIVcWl826Ah61w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:47:50.331Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=t4oarmXZHTlxk5hJUQVbUO060THpZvo47oG41Bf65BhqfmP_Lz0v8Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:55.561Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QKVOFoWPwPSNw-sXMMZux_-HDYLrqsCTjdlsEpV7dbO5O9hWh5AkrQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:47:55.566Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ibedP5N_ppsOvLGmTOtyg-xKXv4y23ePs2xaK6UGxUQZlUkIqjOgkQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:48:33.382Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=VRW1m5b3hcrYGp0WRdx0f8_egpuGYefKShrsqDOORHnOFV7jp_2xoA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:48:33.387Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yvKKLc2V2I6dsvRTXASxGu8DwibUCZo0m70jMdz_NccVGraGD2Ct7w&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:48:59.494Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yJgHdwcVR85SybwmAkjd1Kr2BDO-1C_aVOKIQU6IKwxRASRf4Rg1mg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:48:59.499Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=coXB09s0Stmx_rITRrpJirsunYsW1rBm8X2OIKyVuZg1c0Yevu4zxA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:49:04.678Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2tF4tG-LunQwEijaKpBpV_TrO2kyS6x9iPquDaF4XeiHdSPfpguzBw&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:49:04.686Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=EMz87CSqsqU8WXi0_ABY3SrQ8drWBHEDXTRW-l_3tFcPgNkkTJdHig&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:49:45.309Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TGqiPqPDXih8r55rABWryi9HMa0rWd6zxVGTioNX6ogszvMzJ3dBxg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:49:45.316Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=diI0rLNCDlJhHDmI6Le8TSPxwW7_c42oR9i2us5Q5Nw8O5YcCvT1Mg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:10.073Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=94pm7SEPFqolQUqsPaPwhxjlNnjMHMyixA6joI95zQ2i0OUooxFf0g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:50:10.079Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=o4t9FzS-uXRd1OHu3ESA9U9ZuGq5QTn6ETExv48dPpj5VDlnO32Ecg&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:15.221Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ho9nUk-NPevQK3Mdr8FpiTqCpMagZTW5nUSyMnviosOYhDKP6wDj6g&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:15.226Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6UJQo769jLadxHoNbiNQVZft2Km4FX1TeYLJBz6GKosfaaY77Jqu1g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:50:50.242Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T17:50:50.326Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=kdk-0UomNsQfy1-QhPQmN0VrozuODUNDUSIlAy4rIA05B97wS2p20w&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:50.335Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_9bagV81VKGV-zX-jk4kMn8xoUXBqTayJnW13ufgu4i8KXwJ7negqg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:50:55.595Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ziEHANOGXUHuHzeEpby9fvFbwBlkhbYk9M1V_jt5R80UNMa1R1A8JQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T17:50:55.600Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zcP5C2i6mdHpwawahYBYsBmL4J66y1lj3GyoOvFkxqrnunObXQn49A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T17:51:40.771Z] **exception** — TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button type="button" class="inline-flex items-center justify-
