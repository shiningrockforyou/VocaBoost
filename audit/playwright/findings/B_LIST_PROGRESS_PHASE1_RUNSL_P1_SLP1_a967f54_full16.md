# Findings — B_LIST_PROGRESS_PHASE1 (RUNSL_P1_SLP1_a967f54_full16)

**Run date:** 2026-07-12T14:30:23.629Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT RUNSL P1 SLP1_a967f54_full16"
- [2026-07-12T14:31:11.506Z] **selector-gap** — 25WT RUNSL P1 SLP1_a967f54_full16: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T14:31:32.957Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tKOlTGgHaDsbvLSN2RhYfBOzEWq5QQc4GjEQgPzgR01OIJrCr2jOOw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:31:37.113Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QIVjXEtpl1t2GIvGY2YenobRrUzP03IJzojJsRxkmLWG6giGvfEjdA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:31:37.142Z] **request-failed** — [p1-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=QIVjXEtpl1t2GIvGY2YenobRrUzP03IJzojJsRxkmLWG6giGvfEjdA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT RUNSL P1 SLP1_a967f54_full16 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT RUNSL P1 SLP1_a967f54_full16 → 467V3A
  - STEP [p1] join "25WT RUNSL P1 SLP1_a967f54_full16" via 467V3A → member
- [2026-07-12T14:32:13.317Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=dJdoZHWyvFqwr0A3Z4j2dOffgsUsg6NTM9MInuOZ7WVOT7t_ub8x5g&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:32:13.324Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Es15w0Y7Roc7iRjGCj_-zKilneLUKiK4bwCzhlAvOPAx6W3Jrg-_Gg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:32:46.502Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WEYq5OVz3MT5kac8ZFgvf4G594c4jiaeomMm_2akZJU3aGzl8jvMTw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:32:46.527Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=2h1NGmoZrHCz3S_HuhRMP6pcwSxPWVlGjw6fHVKI-yocrgsQbz1GJw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:32:51.652Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=tfExdShU9SfHw8AQeXdKhcMK-j4x3G7q3su_Mr9D6pcdO6ZVvCUGCg&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:32:51.658Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=h0MiNgksF_fWqEYCnIVU3EeyDdRfNEVw5YFvrWikIu7_iibikU-26w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:33:20.422Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=nk9bi0O5ZOHo9MFnMtZpLNQNLuiWFm0U0TZfliUcojTM6Ql25B8WJQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:33:20.427Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=yqgj0XFqZW50Ug3PlA0b2OlFjsAubdwobWZ5rR3pd96-GOnEFwNTVw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:33:45.138Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=hBPqa2m0SZKz_rPbQhUhpgtxustExlZPR988SoRorwen7FcW60cpjw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:33:45.144Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Oiq-oqhtariEiuGz-U2hI5KKRd0IrsKKSo3Ddp6r3ygutKKC9lP76A&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:33:50.248Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0yq8hd2DISejad1BfPZoplDzKfhkrHjZboU_Y7HuHXidsFMjb4pv7A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:33:50.254Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Wi16fDb9emB8zOb7pIVrU2YMXGphA4o8HfC795Y6oKv3LUcXiSivKg&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:34:18.845Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=zHdOyzGTCQKJcwyVSxdT-_Kqr8SnlLIVnTV34IJfZS6bhbujUvW-0Q&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:34:18.850Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0zaA9oWKhLRGrTtsKBeOIDMvlSSeW5razu5CRg7tMrN9pCHCU7P-pA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:34:45.333Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=q0StZuPuxoH3tTJYtCCY7OyHJXEzk_AudupH5zwUDW88MnXVyi-CeQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:34:45.340Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=wCyrfAlAk1OvoLSugP4v26tLZWvdq5MM8gKX-weOji8mE6asfRDy4w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:34:50.448Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ipYbTTlcbMd4nqxeTs0C5r_7xRl3GoALDELsci3wQWM8HBB01azlQg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:34:50.456Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=fFLt51Da06qKUb589ha233UnJuZOJlNsazO9G0NxP2mH8yX7bjDFIA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:35:19.516Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=NZYzZONcr5W_ErkURrCY4Enu6E14e8Tt9GAGpgXgxvPHxjsKqun9vQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:35:19.529Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=uYRMb41t6kTiCvCq2_41bUkokbjnxUkwfpyjQLHYSHpI0BNf1U3QYA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:35:46.851Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PZadnzJ52429BSrG4a-vMlIOGh2Xc6aNdPTh6Aei2L-ZQ-EGRWY6fA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:35:46.856Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=e1o83tbGa1anNdEZQxIHx06_ZWK2uZiIXLZqfQi_TFJl-cXcHXOy5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:35:51.964Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-WlI9ofxv91r-D8P9H9rdAM0-4OFRmYTKvqGVBCOSYLZuTUjTRAhVw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:35:51.968Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=lKpZy5pM9QSVturRQDAx75pMUyvUF1wBAY7ylNI0NZlBbCopfXXWIw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:36:22.660Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=v7_Ynq4-CUa3JwFI7IKPYYaJCOAJEIFKyZD74Ubeqf-6SUYGWafnig&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:36:22.665Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WrOnD1QSmHnWIVImJiYHKU7_7KELD0pLAeWxLqqZvpDjjxg6-KrYSQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:36:49.686Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=535MXN4StoXs1u81AQoPzSyGaUev60nH4zEwqrDf3yXPC0MJw0rnhw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:36:49.692Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=tfl79cYLzTnr2CDo3rI4EIhjMn4yddZYPjxp1_aSveOZcHZ2LA-6ag&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:36:54.811Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=qvfTlGOBNEeJsUavwMhxZFgyv-B7l4q8T95QAy8M3ZlXFpwl5kzk9g&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:36:54.815Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=TOPzmsWGar_BClU9t_IUR6OrucR2EE5E6GlzNUnHuZAQUmNN2UV-WA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:37:23.895Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YciEE3Xh68E2n8VKBQwpTgi-icai-eiHpx7lZkX5xxSg2HMgKEUEiQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:37:23.900Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Ar7riw0vfOAwZMNTkbwoFi3oDToS2NkAWfEGUHxqsOzefNEulYsO6Q&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:37:50.948Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=-r1Gp6rJ4UsbucYQT3uCl-InWDjcIWr4UZUoMCjdE0Q_zy-_reAX2w&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:37:50.955Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=zedqF1-g_7s8g3tPYFDFuT9yt4PNUz7yVElJJDPRZoK7em1iJHXm_w&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:37:56.136Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=r6aIq0Kevw9d2WVGAVNYLe0qfirl491khzFhh9fPs0WAkwxRl_OXXw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:37:56.147Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=9cn00rAWgbKkisMG5WhMXL6ExVJC5xWHyCVP9JlTCsbi1r1upDDQmQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:38:25.552Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=xJvgvioYFKG19FMkEKyLWu1EaUlPN4fKUVIMNvTsavlGBdjBieF_UA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:38:25.559Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=OV5xYSFJUCskRYH8u0HIaF23vx10d7abVDatMTBcxEJh6qESlGJKZg&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:38:53.266Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LBIOf4qz-iNKXMyOS2d92oxheKlDhfR5SeiKAJ76eMHYD_korrupvA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:38:53.274Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=S4BgwS181Vz9hDuZWm1JzIEEJbo2Ni3Ly1eT2TIXItXfpwXWTc6vTA&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:38:58.415Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=0ZRlJgo3ZX5ivdqp7fn_IS1VZcQHmBss9LoezV2fYlh9Euamac-K7A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:38:58.424Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iQoou9LGMINyKfIcyGwWGQ7b2zGKZFCjzqVX4jlRNxd0NDiE15RiKw&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:39:49.573Z] **flow-gap** — [d8-review] no Review/Continue button after 19999ms
- [2026-07-12T14:39:49.576Z] **flow-gap** — [d8] review not reached
- [2026-07-12T14:39:49.670Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iJvnPr6-7E9cA8q6gmyn_Dm7Jp8dhEIU2g05EAcocmF5Elx68AzcjQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T14:39:49.679Z] **request-failed** — [p1-student] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=KjPD5hlGAqC1P1_QvfzJcPthtP3Q7CumNs0xCBMFfkNM3ZpwCNh6ug&VER=8&d — net::ERR_ABORTED
- [2026-07-12T14:40:15.175Z] **ui-fb-mismatch** — day 8: UI words=140/exp160 day=8/exp9
