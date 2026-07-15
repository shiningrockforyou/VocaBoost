# Findings — B_LIST_PROGRESS_PHASE1 (PX_L8_L8Boff2)

**Run date:** 2026-07-12T18:02:05.356Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT PX L8 S0 L8Boff2"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT PX L8 S0 L8Boff2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:03:05.556Z] **request-failed** — [teacher-base] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=HnSmqDzxL07B-clhF809oLj8L29RDC6Z5bJJ1BOTjZeJHGZJPIQkFg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S0 L8Boff2 → JL42SY
- [2026-07-12T18:03:13.547Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qiuujc_c1-zQ45hj68flDVH4x4zjh2wYUlSSoQFwTtWsZjApfSD3SQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:03:13.704Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qiuujc_c1-zQ45hj68flDVH4x4zjh2wYUlSSoQFwTtWsZjApfSD3SQ&VER=8& — net::ERR_ABORTED
  - STEP [L8-s0] join "25WT PX L8 S0 L8Boff2" via JL42SY → member
- [2026-07-12T18:03:22.733Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=f8lMhZ3_kKFMdTg8iH5SLpBPNoEDmdzQuaAWpvXUEAw0esW_UOhnbw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:03:22.739Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uCC0-_h8GfO6QG__53p8z-LEnMRZT_4fAG98iwpM6EH4rLoW5lddPQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:03.855Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0b1ElaKD3Alw2eGdBF5ZBFL7ILkRdsXvL1ZlR11NPYDBhMNNO32NoA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:03.859Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fEV1Rk72u5UX5K6MN9JIH-3p_LN8lAl0PlCQApuJR4vUqdS-N2zzXQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:09.095Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=5M3Ys6H0J8K9oyM5XjV6Dn2aU6DHaMDd6VcXUW69-w9Bvmq2DG089g&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:04:09.102Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=oGQ7ng16pgPKAECMDcR-llYDT1R0EcraGrGZRwHhvE7frG6c74lDIA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:45.806Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=PE5pB8o6U7bGRm5q8ffn1zrIhuWezwQYzzp9ZnGP088HGoiixscwbA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:04:45.813Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=nRAS7RpgQGM51RFllVnzz57Ygy6l4y1dm6cIDPJN4FT1Wg1TXXjgIA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:19.983Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=lxl6cvufMKvalXYzZX2JjaCG1BcYKUnVzCdZHBUJnkWTtGnTmOWCzg&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:19.991Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=yuRnkmADBzbxfjN4ipVkfmbxOIch_RD4iQFKYLHy17xpR7GN8npvkQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:05:25.122Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=w6CuSICwW4mVJI_INLHBppt7OpzhU3zXDwnwymNGVz8arkPufjA7nQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:05:25.126Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xexWw0GJkfoLKPG-rMEnl9pxCSuUzzSuL3Ya10n-EpYtRhhfltfotQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:01.350Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L6htaJzTw7zXptFTl-Vw5AlAFdgQENJnjHHWYxyRVaUqjoV4HEhY5w&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:06:01.359Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=3awJVCds_SV965kG4zYbuSaho11MJj0tpeBYox7CSmeT3DkNmu_V-A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:36.515Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=sOMS_EFITHu6lLk2W-0Ao-VszDfXGG45tkKwQhGPLtIZCIlmULtiVg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:06:36.521Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PIMa3gAhVRolBTXG3bpCiY-mFY3M1qWQFGAo3YzVzM1wwOb5-q2dyw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] create class "25WT PX L8 S1 L8Boff2"
  - STEP [teacher] assign "LSR Ascent (audit clone)" to 25WT PX L8 S1 L8Boff2 (pace=80 thr=92 mode=typed) → ok
- [2026-07-12T18:07:31.333Z] **request-failed** — [teacher-ascent] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=SbA-TRjhbwr5wieIEi6xaWulT4cnj4622tfjLXDQ0rDEJoNv6VfwOg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT PX L8 S1 L8Boff2 → 78M4ZL
- [2026-07-12T18:07:37.025Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ddncb-S6lTLyNiB8-uUeXE9aywSCu0410CFxdy_zGHpZgxyRDjY-9A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:37.179Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=ddncb-S6lTLyNiB8-uUeXE9aywSCu0410CFxdy_zGHpZgxyRDjY-9A&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:37.228Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=69KHpTak4s1C1bfIFnnbS8un4_BQLzef28bMKuWMY4FedMKoqcOXsQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:07:37.237Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=69KHpTak4s1C1bfIFnnbS8un4_BQLzef28bMKuWMY4FedMKoqcOXsQ&VER=8&d — net::ERR_ABORTED
  - STEP [L8-s1] join "25WT PX L8 S1 L8Boff2" via 78M4ZL → member
- [2026-07-12T18:07:43.761Z] **flow-gap** — [L8-s1-focus] single-list focus "LSR Base Camp (audit clone)" != "LSR Ascent (audit clone)"
- [2026-07-12T18:07:46.563Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=oTjf6JPPMPWtCYEBiCA5tH7rCLq2CiMdfOa84EqtW6250Yrzw83dOQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:07:46.569Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=6X5MQLhKme1TDNY1nUh-Qui3cEMwrMs5jwSqcIWAegHBGXNakvd6Iw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:08:23.601Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=6lUN4s4fGTwMzHrC95139XL8CCmHGIc2yontqUOdNOjOL_4LqEktDw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:08:23.607Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=H_Il7MaNOgwcOEzClFP8isItLTd1W6RlmZA6Zg6p2H7rciswIZD3ZA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:08:28.792Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=duRGimAx7LgSi8w-yVWeSvjjAVvWSF7YI-0eqlufe6minjsA18-kSw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:08:28.798Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Vz5SFqJmHW_TG_zxORlZQaEiMhsjt-Ev4GUpzXWs1IzcCG9UCwBYZQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:05.450Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=DLciU4huKfufAcvqVmi8mTvtlO0pg5_2nMWdZ3bUvZ4lTtgel84rJw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:05.456Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=GXjcMe-FtlKxCYVNnGCAgnHiLKQLHNnr01vo2qtLcp1GcLB2nYH3zw&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:39.325Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KXhuRmJvQF0unOo9Ew0if_wgqFe62lhSeBbRGJhQqdTJaJHTAm5Ogg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:09:39.330Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Lhkj1jbH2FW-9DsuoHHmQTQhci2jE1XcispBVK7qSV73x-NAHQWToA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:44.439Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=kn2d6nEcdEtXA-JM9bJrGh5qmREELMcs2vC3e-E_YbA-OgVMrO0BmA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:09:44.445Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=if29l5Ma6ssVk7x5N45OO-_Ovf7ELT_7xnSk9-UHDegunrC6vYfRpw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:10:21.131Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=rhwkTNSsO_Cu_tL-qkXOGueyYXm5HaYRywM2zUpxpFtNUwnORpETXA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T18:10:21.137Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=VZo0qmrT08KzbeCvPWlc4v9enZCDygUJozai3FNVzw0snf8xdeHQhQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:10:55.923Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=r72yIFe5xn5SHnJwLF7o9czOWz3dm1EEU7Cu8MWiWIjKixNN1S8qmA&VER=8& — net::ERR_ABORTED
- [2026-07-12T18:10:55.930Z] **request-failed** — [student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0UcXYyoTsttRSx-1e9-73_dhUki-bK9oK_z517F9KF8ipiRWYnY83g&VER=8&d — net::ERR_ABORTED
