# Findings — B_LIST_PROGRESS_PHASE1 (DUP11)

**Run date:** 2026-07-15T23:40:39.018Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

- [2026-07-15T23:41:26.077Z] **request-failed** — [dup_dup1_a@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=5VZB8pnUSum0X0bzXK-L5Kh1AOfSGR3D0Tin_xsP0OZ6TfGYDU8XsQ&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:41:26.087Z] **request-failed** — [dup_dup1_a@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=hIJu3v90g8-uGPiJSAeURf9-aO8iinikxZptjJJ7UFwZFh8ngvoFZA&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:41:52.783Z] **flow-gap** — [dup_dup1_a@vocaboost.test] no Submit button
- [2026-07-15T23:42:11.770Z] **request-failed** — [dup_dup1_a@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tbAebIgdHNMzXMlEDts1gVTDkrHTj7iDX-T2zIxoxVzIj07ACAxVEw&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:42:12.990Z] **flow-gap** — [dup_dup1_a@vocaboost.test] on test-results route but "Continue" never appeared (20s)
- [2026-07-15T23:42:21.007Z] **request-failed** — [dup_dup1_b@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=16Jci1tR7lzYV7kakkXuk6EW9_Q51f2HeuR-mkmmcpcvrp7gHEEr9g&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:42:21.016Z] **request-failed** — [dup_dup1_b@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8QbK_Nl_MvABWAqsoYCc-xx_3EirZXlIgIAv91eTfig2t7eFvBeSWw&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:42:45.936Z] **flow-gap** — [dup_dup1_b@vocaboost.test] no Submit button
- [2026-07-15T23:43:06.120Z] **flow-gap** — [dup_dup1_b@vocaboost.test] on test-results route but "Continue" never appeared (20s)
- [2026-07-15T23:43:14.147Z] **request-failed** — [dup_dup1_c@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zE_7FKc5b9XXeezyEz2bkVFRTSIicl-4vHnxE8myoWcmfoGsg1U8JQ&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:43:14.156Z] **request-failed** — [dup_dup1_c@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YWmVY5-eKcVDejiwQS_UKd0PbXi8_c4LU4GEBHsp1OjAfxnCRc3uUA&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:43:40.810Z] **flow-gap** — [dup_dup1_c@vocaboost.test] no Submit button
- [2026-07-15T23:43:59.837Z] **request-failed** — [dup_dup1_c@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Ogz5Gu927bT367WNYpQ2G7nM3GL8KfuHLZDIbdKjXPz-orZpJ0sDvg&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:44:01.015Z] **flow-gap** — [dup_dup1_c@vocaboost.test] on test-results route but "Continue" never appeared (20s)
- [2026-07-15T23:44:09.098Z] **request-failed** — [dup_dup1_d@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A8CHd-i0CzmtezuCTwphMo5eoRn6HthVNQ8rBuxPnvsw1Pt5gW4BAA&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:44:09.108Z] **request-failed** — [dup_dup1_d@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=beBvjdPzEGZZYe0wYZjIktvKtH_K3jj0VPATe-u87UeJeRKiNpeqYQ&VER=8&d — net::ERR_ABORTED
- [2026-07-15T23:44:35.862Z] **flow-gap** — [dup_dup1_d@vocaboost.test] no Submit button
- [2026-07-15T23:44:54.830Z] **request-failed** — [dup_dup1_d@vocaboost.test] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SfSbiNMdmbZNc328_veJtHNTYCUyrYpdUydJWyIumkWOMzWK689DJw&VER=8& — net::ERR_ABORTED
- [2026-07-15T23:44:56.084Z] **flow-gap** — [dup_dup1_d@vocaboost.test] on test-results route but "Continue" never appeared (20s)
