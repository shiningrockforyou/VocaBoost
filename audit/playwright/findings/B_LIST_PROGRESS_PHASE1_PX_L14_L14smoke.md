# Findings — B_LIST_PROGRESS_PHASE1 (PX_L14_L14smoke)

**Run date:** 2026-07-12T16:40:05.268Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L14 S0 L14smoke"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L14 S0 L14smoke (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T16:41:06.198Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=TYuWSkFzGIiny3_x2Iavv1V6-o7MKjnwVAF-zu2asUGgf7naIIbmbw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L14 S0 L14smoke → WZREUG
- [2026-07-12T16:41:16.233Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FeO_3MRV7-LxdhBJwxVlJfXUAi7HweeVqYzt0hJz-OlwlGAkQql9xw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:41:16.238Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=FeO_3MRV7-LxdhBJwxVlJfXUAi7HweeVqYzt0hJz-OlwlGAkQql9xw&VER=8& — net::ERR_ABORTED
  - STEP [L14-s0] join "25WT PX L14 S0 L14smoke" via WZREUG → member
- [2026-07-12T16:41:27.304Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gvTcR9PLyjlYFGhtiFZ9I_HgEe_WKqQ7chcSux_thmFKHtAaVkWoMQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:41:27.312Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=4z_8j78M5MTkbLLHSffuB517bRMlToj1kFbT2-LQVrcDtC6TubrtBg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:02.671Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=RL1i1qaqvZ9i0PzV-ulw4-wmqh4Xjq0pTpYYtd8mLWoVgWc8arjq9w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:42:02.679Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Pfdt2r5wmEe9DO7n008XX3QqiYmj8SwA0M_s-PiZRkuOXLQom8EznA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:07.911Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QnL6Iji-IFkM702xlkm4pBrI_0wxJeo-32Skrh6YZItgiEOSQUM1kQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:07.922Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=RxA0_wZJ5Bo1Ira_rZoeOV-7I6M1ynFQW4pX0nr46nlW8N34kyWVJA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:42:44.534Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A6brxKWqFcL2nqmNrfAk-JYCwiDXfysoTgPaHLkcs8dlSdQNuZOF9Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:42:44.539Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BZIjVS9zRGKE27cey4quLg5DLeBCjgGQohlj2NXtbzbMQNTv2DZVEw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:08.847Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=K0pZfdEwPlp4UOeZdWX10BopvaSn98e568ruruJ2eIjtEM_WMExRww&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:43:08.854Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=iBNqKhuRK2hfWiO76ntZc0fp7k3sjmAXxl_My-V-hKZ2_30tGP7KgA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:13.986Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=l6DIhqmYrz5RpJSgXjrSOkJfHEXyNtI-6ruipfXYh85iPJInXXe_3w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:43:13.994Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6oKseErY-7K42pR7ucc2Jn76dR5n7A6UZy06nQkdhbvYnNfQv7pdmA&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:43:50.116Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=DPcIYdsKQYsOqACkaE7iI6SujvxpSVoR40ihABliVqzzF_q0fa_TmQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:43:50.121Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=dhxjxcxRyU0PkZFxqNOkQgB7fpZSgxG6LZ4VGGeqwEQ_Abj5E0VJvw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:44:14.412Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0gNvr1q51fnRP8SwRY6EvbqmKtAwektsFg1FnG3TxN6FNnHu3grv3Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:44:14.417Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qPO-S7oLGx97lwoQp6BAx178ws2x2Pdo05g-8FHKhmhopXJ9qRVnew&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:19.520Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SdfxEn8CCREdnwCOQ1OQ3CZSXskjQvBCWqvxmfNaPiMQq_dH_v7wdg&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:19.525Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=gmd06MSOxjZIWKSbLYbCbJf78261yL17RT-Q1ctfT63VgDzlA9ywOA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:44:55.605Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wQJKOESqE8rJ4m-XsBM_0ziMt6SEnUMwaDZU5KVmGzu76i-EuMzAmw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:44:55.610Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=HqxsACqZvTbJAJs8ONbGIemBNJtlOOWKfx4LJMPAz9wOcNgIGJ5HVQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:45:21.387Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XJ9E_FjfmFDzZOGMaUccUBNn-v7uj-2xbzXAlb-cGLQvkrliA04VJA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:45:21.391Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qX2J1-dXrxCDh5k_PftovawLfzsRdlL48LamKscxiTpdsFnEQqM45Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:26.537Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nwFBE2ePrc3hFRAzx764ez1_qSk7JjE13GpKdeWYe_nUxKX2u_lWlw&VER=8& — net::ERR_ABORTED
- [2026-07-12T16:45:26.548Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=u0XZUFNkCdoAGUHCj9FqpFeRcVZ1YUxb16enuHbyULzr_1HMLe5evQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T16:46:12.138Z] **exception** — TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disabled type="button" class="inline-flex items-center
