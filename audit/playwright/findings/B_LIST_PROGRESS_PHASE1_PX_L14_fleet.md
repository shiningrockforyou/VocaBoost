# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_fleet)

**Run date:** 2026-07-12T18:45:55.370Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 fleet"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 fleet (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:47:04.313Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2rsGu3f9XXIgCxqyuaX2VWdhqiSCSe2TwXHzyt8RDoqOFgL5sK1FOg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 fleet → GP6FYV
- [2026-07-12T18:47:20.232Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7F0D8t0da9nvFZk6-ApmCeMw4sweQofWphz2C26upjKrpiffLjvifw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:47:20.240Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=7F0D8t0da9nvFZk6-ApmCeMw4sweQofWphz2C26upjKrpiffLjvifw&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 fleet" via GP6FYV → member
- [2026-07-12T18:47:31.686Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1meKXbgVGOsk9PGRtujSu6tSBcTKU21PvCyvXMFrIMTNdswHL6kUJw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:47:31.695Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nVh1cyRp7sOemEkEmK-r_hsw5xkErIcmI7pagfsQVGhhhjan7OYXmQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:48:08.360Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=MQSdmzIKfo9nnqbxMkxFKii-S3N1tO6tPFOe51UUU2davQmtQDy7YQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:48:08.369Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tFCUd3ABFAhxDHzKWmZNRrssewim-c6fplECSGhJYp3WNJceYWBOmQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:48:13.692Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qnVQJrLT0cF89Nr7NTy4MFFFi2tn1wqqy8HCzatp6b7AO_CeKyQp3Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:48:13.695Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=RK9th7_flyF0sR9vE16MBDCfdx-TToqakXYvJWSu7osDiMRCUy0toQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:48:50.725Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sDLsdBcSkaZEEIzl91OdG-sSMIfkd8Apq3LrRZW5vM0z-BrvzZXtxA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:48:50.754Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=307pnyNMcwV4kBhNXsT0s90Nu7ukE5MVbYXXMj4L6P85-0ZWlOnNbA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:49:21.410Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LFSdRvLJzRelL8kZpkgLSnmgscD6zPu3iXvLt_WRDzNBcEfY4FjeQw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:49:21.442Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=07GkdzM6LcwtWVu2KkE8bh2XjJNzgj0KLCbzrStSMvYEvwZmAUSSNQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:49:27.673Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=eaRbNIQwzkTqYgk-bLNxRVbX_dJ4rr2A0dBmVTeu7wDE4d5xx0MNUg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:49:27.689Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0_ez0eux9t0vGF5JZPs4uN4qZz5EUqrS3KUX_Gw66JUNCQPzRC4jpw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:50:05.860Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yvxjWnISUaqQBIKiv8XEDG5sgEfxsa2Ez0cWx-J8D73OjQvny3TUbQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:50:05.864Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2P4L3yVY_f87AIQr-HZlcOBMhxj5mTsmgDDU7y0oiAJvlziStfsxgA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:50:33.005Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=rjZ-3nmOwCCoxXX-Wx1LKP8nqmOQsFfgCHdXDyRel9oqKJ_C_GbaSw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:50:33.022Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Xy8ttpp58yyduJ4upqeey3aIClqRHciB1HtcAWBbUY-EIBl2sLsYMA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:50:38.193Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ZnIuF-KxuCy9Z4FBtfGhXpuJgloF9r7EYnsBzyIy618ShRoGjQgSlQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:50:38.197Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=x2YRgjiIOawCp-IiB7JqaZ14ZUcBOtcH8YqTZuC2Bwa4e6aCRx_m2A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:18.051Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=b4hyNsvdoTEJhaDLWWL4tEno223iG_AkAgbCfE1CTuq0rmqBWGlBAw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:51:18.054Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JIIjZlWJLXne0eQxONapvfJ1Ld9hBrSJ6UM6WoqwKz3wAKutH7crsA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:43.449Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=yTdsQ1JbLXAEMXCiqu0xOI9sjuMup34uKrTJ7U4wXP_73g8DRMVo2w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:51:43.457Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Kl8Bj6BiOKBtGmYFDj8nsg_ojJa9l1klxLFhlBXThK8YdiYyquB-5w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:48.632Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ii9knoAPwnQLgcUqP-IYS0puGYwl1SeDTJTRPZ2vJ_pL7zZG8Z3zBg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:51:48.635Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cyrMbx5Mm7Tj4dTRP74hz2eh8dhcbrI4XQHD6t5I68-YgVx7OQvHyw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:52:24.089Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:52:24.177Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3torq00z1uWdBmfgfp01NEBIko_2wyIh7VBjT8Nq0rKUZOBcmzmvNQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:52:24.183Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=h7oxdneUBuHM2NwLCv8yoRMgSf3JOsYeZGYwjNVHxLfsFoZg7syoiw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:52:29.426Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=AJyrhyO8IxQe4RGsSMj2XRNFMDDyiAN7FU1TIS61KpsyM7cLigF1jA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:52:29.430Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=f66ViKXbQJjbEhugHshgFQ85KBML89p9vPpOqu9IkjWNK7g7SI-Jvg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:52:59.692Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:52:59.794Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BybfSW5apdy_qiGgXM0wnYTLJSCZSLetPEDyHBCtffjKckwcOfKx1Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:52:59.802Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=MpF_hr0jn9annYP_J7_QAdjTg_5gmtHC8vyyawA7AtbWYf0RtnjZDQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:53:05.133Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=jnmdYGGf72oqIBQ4pvpzf3XLLjYjh2hjJ5-oCPOGcQRxDvAEQgvwyw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:53:05.138Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=kWr4IV0867TLwJf2oheiywWnaCFUyPghhlzjqMeCOlnMsMnb3ErG3A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:53:31.855Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:53:31.946Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CfcCLIYIrKKfBkiO6_rFqGl9B0FsTORGn82x8iNYEk3KQ07laYq9DA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:53:31.956Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LrRM2QnVU9WoDQ6O6jSQp0DiHRzC60sbizBweqLpH3Qm7YOw01uhXw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:53:37.434Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7xlXtfxJQc5st3s0uTafcBYlkXxHJirsLcRV_nBkVhl3W8AM_hEP5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:53:37.439Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=pNX3rAZ80Bw43BKdMCuo2aNlnnhE63oKN08z6r5r-ztWbTXdmGGcOw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:54:00.973Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T18:54:01.062Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6rORcx5aGrPbVX2-Ojn1NGcDCHEND0teAkdHZUDb9L5AKEuVD0HHNg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:54:01.071Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=amTW2T79U7fkke4yoxrbfRHRgxcfbCHfv4Nv9dHMnHap3NErVcIUuQ&VER=8& — net::ERR_ABORTED
