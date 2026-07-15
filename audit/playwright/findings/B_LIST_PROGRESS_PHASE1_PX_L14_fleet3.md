# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_fleet3)

**Run date:** 2026-07-12T21:21:29.053Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 fleet3"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 fleet3 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T21:22:32.757Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=l4jKexl2vOmDWJkXy56OFKYBRFkfJG44PdGN7QxBgdTEwG6jDc_nLg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 fleet3 → JB73AJ
- [2026-07-12T21:22:44.520Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=orMNRjwww8vKNed7ajNB80HWedyiNK-WMhrEqfE2G7BQoQQUC9npwA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:22:44.524Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=orMNRjwww8vKNed7ajNB80HWedyiNK-WMhrEqfE2G7BQoQQUC9npwA&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 fleet3" via JB73AJ → member
- [2026-07-12T21:22:55.714Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=_ECEBfA4HlFGTKGvBvzhHXQrV6vKh3RvZzalpp94RX6Zr3aj8zQ_KA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:22:55.717Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2EXoCy7R8envi3OSr-NTCtTnLG2CYL_3CKo_ch6kOo27vo3h0d8OvQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:23:33.157Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_oho-h9c38ugdSnOIEXV-hCOJVlxZToHcQRAyRq-0kjf11Reu1gAcQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:23:33.160Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XNiD4IEXU1qrVSMd27WB2F1h7dDeBF-AM4i38sPL_8o1q9qdj0MKoA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:23:38.442Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=xLdstlHc_JPI6Z7ToaS_eklVjkWAo6At8e_dRiFbW0lie0shJHZATA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:23:38.445Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BflVx4rGLC_kkljywGuqPR2cVlHBFN23lmzT4x6Qc2bwl-V9VmkqJg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:24:16.319Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=in7RDavF-eatvSINvchDYh41tmZZ9iblyi-YeukiKnMKuuuZbv2Oow&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:24:16.322Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lahKJ8bScqGIMbXNTDI4dx1ex4zoycnQFEyMrR22P6WJfrpPf4fSlg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:24:41.751Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=FCMCvLdU6U-1dpMfu-t71ziLWNSJcKiZh_I1YNTc0JoX32TPxV939g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:24:41.754Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tf9YcoknDd9kl9Tw09aptrVcU8e6O76rCXoSWe5Mgx8Y5BnEXemhfg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:24:46.921Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=riTwJUFskPbQalMlaEBxpLKB7dPpS1KhM05yBzFs3soPwWb2sVDpgg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:24:46.925Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=NMabFEeot77ygNYA7NCBwKvmGmsHujhbve4ZugXV80FCv-1E7zJa2A&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:25:24.026Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=LiUM_l_Hotqcuc-8X97Wclh_hkQkYYEhSmPdkhvLhwOkAYxYwzgrUA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:25:24.039Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Efob1lRwOEZluQNrQfTkHgnhRn1JLQEKrqwab_00tJbrZhfXervxRA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:25:50.360Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=7cXoHIGn6BR1ZtREYGk0UkprA7fC2-VDfY6LSP9RTlhfpfZ9ODzPLw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:25:50.367Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=af5WXwaGXo-vqagWnee75ZI-e3gCvVGZb16h9j_9ypBrnQAUfGnztA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:25:55.699Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Mdk_D762MvaPGoVJb4YGcHv5EtTcFFLH7-jmOCkCkHy8rtbEgFiiOQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:25:55.718Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=icfpYw6aEGIt92a7IJ-d79UL_xJIkdotVWPFwSueUkSKOkGi0Dc6mg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:26:40.126Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Is9dZPibCG-Hv7darUs1qXBHldB12VX__bjnF3dbV9IwjS8EYGIveQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:26:40.131Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SBlLTIcHpcoZxgHP7MxJctK1ZSpMaRMJOe0TZBozV7V33PXlQ9vOMQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:27:05.539Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=jYF17d1gZFl7RAl_-E4T4M_NQ7HDbhAiyh35gDAODmYDOjFqGUsf-Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:27:05.544Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=oq558gybMtPsUYuYcXuT6EymQNNUOdK-ArWpjR1U4pvvNhjaScOKXQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:27:10.664Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4Cvt9BnB1QgRFF4rZFkPh4x6d099XAtzJbb3AuWUbKVa_LWs1zw-WQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:27:10.674Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8BbmTbgv_u12mCtaqZB0xLVgKQZQozM7HV5Nrm8m34p5nJHUQLhbvw&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:27:47.345Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T21:27:47.430Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=F6SqcT_276eWkblvW2g_UFhUrL3qD3O_VXl5d1f7KqL-AWN2YX4PyA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:27:47.436Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XERtgBmiHamlo232Gs3uHAd_AxkkbWeMzk8kee1S9rXyQjE82cSvlQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:27:52.892Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=S5aBPn5qU8XsyQgHdLQE3gMyLstnBaRjq1E94KJeKqTHdg9tW7GJFQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:27:52.902Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vF1ynsepmtPuqMiid2sHTAuWMvJjFLJI_N7SA1OquK8Z4ozUn_Su-Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:28:27.787Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T21:28:27.884Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vjFlLQ_icITxtgvDiIo-5ZKG5b3TmUH5aneOWg6yZyKuItWQLLcLrQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:28:27.891Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uS-baSFN3RPAeBsc7g6EbOX81e72l54cPS7p4ixPmikFbxkOMWiQGQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:28:33.185Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_LBFJoYrYh15f9kd9fXMukA6WCvwRZR2ks0o2X5G4xaGTPrPHGStmQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:28:33.190Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=n4elFgla9frHfSeb1ib43UzXswfJNi0anzE3hA-Wtr8x4tkVcrpZng&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:28:58.588Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T21:28:58.676Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=D2W3-fAzbDusvjQR3NK6PV4sCOZWBuzA3ls9GHNNQtEPXK3LM-xJyg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:28:58.686Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=qsc-p60Odewu93De6TOCUMdIB2LmVRaikouT84Xw_zdLKooXEkuC2Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:29:03.936Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=2U5AB0LpbbXFSH_TJdjvy3I4zN56R6QS07QevQKLIXzaZKTogLhsTg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:29:03.939Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=06p5WRCUgJ6uPG0RNuD2L2rnUN-QdvIqCrvCpI2c4t7A7OzIoOXwIA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:29:27.649Z] **native-dialog** — [student] beforeunload:  — accept
- [2026-07-12T21:29:27.760Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bFDKyEqwGn4ttwxGf4Z91hNiqUdE3dEwCLmoSZpmXwQJ0zjx8e3OSQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:29:27.773Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=G_di1V3u1_6fjZMj799mWNvVbSmvOfHh4MsnFZxPHdw3aR0qMb47Vg&VER=8&d — net::ERR_ABORTED
