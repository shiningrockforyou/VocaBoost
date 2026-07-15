# Findings — B_LIST_PROGRESS_PHASE1 (PX_L8_L8Boff1)

**Run date:** 2026-07-12T18:02:12.381Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L8 S0 L8Boff1"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L8 S0 L8Boff1 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:03:15.384Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wHy35P9iBHvGo2qLWHvug9LTGSqg01y_VqU67g63xgf0nYApds6JiA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S0 L8Boff1 → YNA3C4
- [2026-07-12T18:03:25.138Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Sumc_1NvVgzbsoYZ8DBvBqcnudcjOUgY8V8MA1ye3fdSPjAr1cDdsQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:03:25.143Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Sumc_1NvVgzbsoYZ8DBvBqcnudcjOUgY8V8MA1ye3fdSPjAr1cDdsQ&VER=8& — net::ERR_ABORTED
  - STEP [L8-s0] join "25WT PX L8 S0 L8Boff1" via YNA3C4 → member
- [2026-07-12T18:03:36.217Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L6IahuExQMYE63IP913F4OD0V0V48rz5riNpTg2qT30aBXl8WPa5vw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:03:36.271Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3dg-16wB8pXJcT1v4u9mH6nX9BEo4Y2HS9ZMUbhgOAGjsw5wlDK38w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:14.905Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=D40ci2V7_IXlT-QXa2Ew5oUjKIpAhdOIuTxDEb7OzRZtH3lub6paPA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:14.916Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xuxaZRpBA7q9m61Kaw8qChRguA4P_uJ1Iilkk7YMZrQ_eWE34IoFIw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:20.157Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=jn5btQ_yPw5RskmuuVVKM2b3J4ZgMz2lm1WxycP5j8Oae_Bn_ax8EA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:20.168Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hPwkYFENdS77ybafiELpbbJgeuRNf_-YGTTztTLyVponPvZMel2vKg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:56.997Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=J9WFGFOmjQTG8E6ECBxFzw9no2ncxgWXTBRv-JrD_eqHtrT082pHsA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:57.013Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uN3hfByV7N_BCPe4Y53VAiMdeDbjJOoi9eIUjAAOXEBraWj1k19VFA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:31.155Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L9Pt2y7Ju16UAZEjCgq0BGYD9GctrWHR3pEQtY8li1xp5K259jvVoQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:31.188Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=H81wXhqVkUhNVyp4NZmSeQNoN5tHhxnKfhtMsFsu3CFinULJmiBYnA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:05:36.521Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_wrI1vvt8QxsVfaC98y25IWzcODS0d14Q-cGLNiIGaam4crgublgfQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:36.526Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=pU1eKTTH8stmB0YBwSw_EwF-gfG4E0ICnoZBGpvzag9m9C7yhj_oJg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:13.150Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gUM_x9dXtOA4w8QscZBzq0nJj5cR7fZXpm942w5eNFppkd5MyrqRoQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:13.155Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=O1prbEZ-SJD3PJNzKVYyRrkX1QpIkBXYR3lawwRHUZHLtT-pcEa2iw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:06:48.704Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cvxyY5wTILeeJJiwMZeCvGqDSFGj0pUXETyEs941DHn2YMP18m-frQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:06:48.712Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vz88AnZTAiyKQeS35s43m75JKho6T6X4uMeZa8R6vL5WU1tUCTIG4Q&VER=8&d — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX L8 S1 L8Boff1"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L8 S1 L8Boff1 (pace=80 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT PX L8 S1 L8Boff1 → JUZPEW
- [2026-07-12T18:07:49.219Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=v7WuMjiY0aRbielqRliJiBrhpjg7hXqXZ-FRqnidVv460hBIF8wk9w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:49.331Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CdIQOQwkVFgRvs1zPFdZXUz4VCJB7Q5qpQoXjDdm3UhwCpjF_A30Wg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:07:49.344Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=v7WuMjiY0aRbielqRliJiBrhpjg7hXqXZ-FRqnidVv460hBIF8wk9w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:49.367Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CdIQOQwkVFgRvs1zPFdZXUz4VCJB7Q5qpQoXjDdm3UhwCpjF_A30Wg&VER=8&d — net::ERR_ABORTED
  - STEP [L8-s1] join "25WT PX L8 S1 L8Boff1" via JUZPEW → member
- [2026-07-12T18:07:56.184Z] **flow-gap** — [L8-s1-focus] single-list focus "LSR Base Camp (audit clone)" != "LSR Ascent (audit clone)"
- [2026-07-12T18:07:58.953Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CBL7mlAyMyfN-j90L1c_NX5NphmSxyz-aUuh7Bk29Ty7PrR5uMcXNg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:07:58.963Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jMSPYXXpJ4kqun9dEnvCnfTsAi6UuP8dWrFR9w-2-xAvUoB3lo9Gzg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:08:37.089Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DfRqwCmjUymsnHHhsepW86SFG8Z40nnxdROyc4vgvezixsK-jWWjoA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:08:37.102Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=KseJ86yAaLIU0D9UKHrBPlc5cUeLZA9so8jVqbY8Vh5IeyOTEB2Llw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:08:42.214Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=F9G-1Y6gywy3lWUPNWQCtlXNso8nqv8Et2muLsfzKWV_Xy-bmuhHoA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:08:42.219Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=OGX0ODr849fQZmIC6ZMwjE79zLtgpfoCxR8X_yDpnsPvWKHrF6BGKg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:18.260Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=EnCDdfLUywiTeoEXanDMJshw3Cjkx0YVeAHY3TC1hdfzzykWG4pm6A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:18.265Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=WHXIhcMMw2CiC5ZCBO7JVeIrFzvVHbQ653KeICQLa5tjyBsEfF-87w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:51.709Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ltzXFl28CnV269ba79eP29wM2eD5zyJCKpDePtKn_SlANdVV7R4ZNw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:51.734Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=71oCe8R8dUP91FMJzLaTJaoayuoPtNWmVSyxQXLOecse-Z9lAIvPWg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:56.972Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1sP65ug6-AtcvlKEsY5K4bHHNrzVSqiJcbIpxZ6PDPS7qULKbuH3Og&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:57.010Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SHJbrkhla09_4wqAkbmN4HnUC5co8AZuVlxZgpwb6eYiyKYjKWbXRw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:10:34.856Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3jw0NuwaAMa7KLch-y5XFjq94VV6o4bdRr3ybzaPnBP8ROopm6rtfQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:10:34.861Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=sL0mWsBRzGBbHK6JXVWKQPvnXizEGprJSBHsmiAVoxDD8_RH829A5w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:11:09.355Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tkKt9adERCl5A_uIKTZZGCNwI4QN6vNbz51tB3IzBsZrDMBiv7p0jw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:11:09.360Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=o_hxgkvPvaJiHMT8mrAXfOGEXS4Q38WSOf0i5Pr0UtWd56gfEcgKNw&VER=8&d — net::ERR_ABORTED
