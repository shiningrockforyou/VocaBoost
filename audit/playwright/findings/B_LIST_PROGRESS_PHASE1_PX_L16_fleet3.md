# Findings — B_LIST_PROGRESS_PHASE1 (PX_L16_fleet3)

**Run date:** 2026-07-12T21:26:28.718Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L16 S0 fleet3"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L16 S0 fleet3 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T21:27:32.767Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=38tssHYy4vSMew_X7mOLN3lrMETX2CEzNFiTJOXOV7SD7mL6igUnLA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L16 S0 fleet3 → NSF4B7
- [2026-07-12T21:27:43.566Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0gyU4SWW6A_e8--fmvvZnjaCV4UXAoicXg6SmJS4orsdSDxXdJ7GzA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:27:43.568Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0gyU4SWW6A_e8--fmvvZnjaCV4UXAoicXg6SmJS4orsdSDxXdJ7GzA&VER=8& — net::ERR_ABORTED
  - STEP [L16-s0] join "25WT PX L16 S0 fleet3" via NSF4B7 → member
- [2026-07-12T21:27:54.646Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JzjfKOIYRnIkyrbqrfuXWePj1oFyFQN8NAho3yiMDmby6D4kbsx55g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:27:54.660Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ep2BLMhmNhLXC87S7b7DSn1jmi8Ntd9iT2-1BOor8kRUVeciWeVRwg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:28:32.890Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nrCUN4nschXPoE8SdlfHyEVf9AcHYyEpKltKglZA6CLIFT0zvMb2iw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:28:32.894Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QmON9RApmtZXK2zK5CabpiKl9I9Y-2533JGOEsEShzrBns3J6AJHDQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:28:38.222Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=cLFjea1Id9m7qPMCj-DHaw-MUPGh5oPQdIjhbvlyd0QYc4kBuG7byQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:28:38.228Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=JzLZOwi6X6_qyopqR226oLtuKWVB2E6G7qCRr6pMmkZDWLgPPzVKqg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:29:14.841Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Zg86atgIsZUqvNE14Tnuzt7WkPMQcLMkyKzntFMSAAl49qhuUQYlbw&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:29:14.845Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JmpXwRKMCe2nK9rAtWvVd_fQ7FetWdKltXBakA8O1m7NF6mOaIx0WQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:29:48.626Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lApdSC5xG7xyst4O99cAK4fmjhlRdv81X66u5GamN44WdMbRn0S4Hg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:29:48.630Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=vzo5JoM7NF7bEIyC7gEdJXK-IHTpQaBsP0PyEwAyiZCKP6gugGTjKg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:29:53.746Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qMvzMwK_5JUirnTFgcmYnKxy_yDf1BoDtr2k4A2Hxtp-rhpR8w-l6w&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:29:53.750Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4TcVyVLr5qAf86slKZNIXj-ieBDi4C8R7fK7Bl0AcQh-S4fxT2M4_w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:30:30.565Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=512zk83LW2an-l_wC2hkcgNSbZXC-IBIouGRKokPSCjr4BiWi31ZiA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:30:30.572Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=c54IFVbLtnWjaZMhDaS4eV3SsfW5Q8jDgHke0dPTPKhkvXM1E946Vw&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:31:06.001Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bCa_GSQ8HX6noLIobMEwNGKDP4R87ICLuYGrIIQ0Qiw0tPWy5T5k9A&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:31:06.005Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=yv-UZsRhbrKnqtGZWGG4vzwExAl1EQeilGfHrXBEaNOatVe0Ks8hUA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:31:11.116Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=kJ1fwei5VS3q3RgDSwK6d5EkcNPLEhd5lFmJw-RB-JdOaHTJN79Wlg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:31:11.119Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=R7VZm2FRsfN6Lm_6hHRm0Y46kl-2leoyLJuZJihJS7S5rfFKhroOvw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:31:47.640Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=x3_OUdRpBMNe8q99EyphEO5N52HkyBf8SQPWSfXURnXeagWV0WtLGQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:31:47.645Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QbNmzwfHiOwY3h2lyfNOjuVYTFu_t9AAwTlFQ3X6mIYM33smAUtWrg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:32:22.148Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L4Uuht8_T4eUFNCE7odtQoFgYA4pDeIVZct2UbTvNTjrrS-OvTZ00A&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:32:22.150Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KYsxZPRrND60eedYsUOcZm52Hkj3CQ6BYiGicVwEtVXq7FndrWBLMA&VER=8&d — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX L16 S1 fleet3"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L16 S1 fleet3 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T21:33:16.856Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=RJWTxfvaXDG_MNxbkuRboEqwx2eO1MtEqzwTBnBgW-jCi2GwAwb6uw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L16 S1 fleet3 → 7W4FGB
- [2026-07-12T21:33:22.646Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-W-GakPumX9-BfyolqfLJV_cCZ5sdlZMiLy6KK4KYb0I4nfz63__rA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:33:22.805Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-W-GakPumX9-BfyolqfLJV_cCZ5sdlZMiLy6KK4KYb0I4nfz63__rA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:33:22.853Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=yiaCmSBp-B4W-4B4qgZiY1qw9vJkBoyELnc3tAAk0vistmpjGWNW9w&VER=8&d — net::ERR_ABORTED
  - STEP [L16-s1] join "25WT PX L16 S1 fleet3" via 7W4FGB → member
- [2026-07-12T21:33:31.872Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=j8pvvnACP-vJwLcxgGT2pKyw9o_85SSPHZzJ5wQZkaIEZltimt9B-Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:33:31.875Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=jJxfIr61QtMB325xXBnIBwVyhXJMRS-9K1itvEcU0IbueHYEbvQsVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:33:46.153Z] **info** — [L16 #6 baseline] same-pace move: before csd=4/twi=320 → after-reconcile csd=4/twi=320 (carried=true)
- [2026-07-12T21:33:46.241Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SHHM6KoxAHS7fnc4j6cgR9WOAgoeHmOII0JngOpPnvQGAM4rbFM15A&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:33:46.247Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TOv0UH6uDZ8mau68ZVR7ryFW6w8ektw_TS1MZB_6SfD9PYwyMVQPZA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:34:22.813Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=MEipse9AG4QrzStr7m7NtIj3-LomYh-KC5cq2A5XIcZEyOBiUvbY4A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:34:22.816Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=mbcKzg0FfpoWknVDWzvPwc8OLCb50lIWIPZVB9iGMuBY4vhMvvxkIw&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:34:56.702Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Br4w4PXpbox7F9wOW8d2KAMWSoKNyiV99cc62-S4LEf-Luh6g2bkmg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:34:56.706Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YyjKal3HI7WZ5YXukHCDk9R9tMCxhGa6MgadIOxbgA3kDpdFD6znGA&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:35:02.442Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ZAGJUwycq2alqJXy4qhwwx9ctlqxPvpqtRI_hEq1FcbbtiSiR4eXsw&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:35:39.951Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=1nw0tB7ptW4ZHEVh88qeR0ukh4lTzsKyBlyl5NjmcEkoxxWauB_s5w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T21:35:39.954Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0jQ7xuIkL3YzHhYghc9PZfyqSaNssAHIFwaMBXWnCkFUdMpAoQdvvg&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:36:15.448Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GeX3YR6km1eTLiAKhosd5YWAHE4XuXdlW26ubG3J7qktn4FYcW0sBQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T21:36:15.450Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=G4ZI7NuoNMGOcGKb-TZyB2duMV6r7plje0owP87s4YvWtjOKleMqaw&VER=8&d — net::ERR_ABORTED
