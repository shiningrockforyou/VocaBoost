# Findings — B_LIST_PROGRESS_PHASE1 (FIX10_FIX10_run3)

**Run date:** 2026-07-12T10:19:11.744Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT FIX10 TYPED FIX10_run3"
- [2026-07-12T10:19:58.946Z] **selector-gap** — 25WT FIX10 TYPED FIX10_run3: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:20:20.477Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=5Hs2osSdOBLTqWgyketq5NBe1ozeXyU5yEpMxIbjKsX95kD4vRhd5g&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:20:24.577Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iY6GePy5Ut5AcYpU_YbxNWtYQIR6d6el40vYIPIoNbsoLjYsz07HFA&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:20:24.584Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=iY6GePy5Ut5AcYpU_YbxNWtYQIR6d6el40vYIPIoNbsoLjYsz07HFA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 TYPED FIX10_run3 (pace=20 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT FIX10 TYPED FIX10_run3 → 2WNYA5
  - STEP [teacher] create class "25WT FIX10 MCQ FIX10_run3"
- [2026-07-12T10:21:17.700Z] **selector-gap** — 25WT FIX10 MCQ FIX10_run3: assign list select "LSR TOP Vocab (audit clone)" failed
- [2026-07-12T10:21:39.189Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=4ezWjtB8EsXgnD2-REFvdDE188YkOvN7HeXokg67L8_a0AspIBWhcg&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:21:43.323Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=M4BE31Kdmjl9YugmxlkechK8tZBa_-6FQQVlxLGRSa-fv-U3lTYX8A&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:21:43.343Z] **request-failed** — [fix10-teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=M4BE31Kdmjl9YugmxlkechK8tZBa_-6FQQVlxLGRSa-fv-U3lTYX8A&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR TOP Vocab (audit clone)" to 25WT FIX10 MCQ FIX10_run3 (pace=20 thr=92 mode=mcq) → ok
  - STEP [teacher] read join code for 25WT FIX10 MCQ FIX10_run3 → CNER7P
  - STEP [TD1] join "25WT FIX10 TYPED FIX10_run3" via 2WNYA5 → member
- [2026-07-12T10:22:18.114Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=z49-Sq6xsIhFPX2rNfGyw4Y_sPzV9xhHtnndq7IrCsswgwWEixS8jA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:22:18.119Z] **request-failed** — [fix10-TD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=9ic8J1CriWjX0CEnh0Lrp8NpG53j20Jp-PLWRvYosKhJjPK9K-XWSQ&VER=8& — net::ERR_ABORTED
  - STEP [TD2] join "25WT FIX10 TYPED FIX10_run3" via 2WNYA5 → member
- [2026-07-12T10:23:14.812Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=EgRKFXgEGmUBSBtROwUeNhinGPF4u7wxidmhgAD6vheFwdueWKXlOA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:23:14.820Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Sfo0UQnAwESREHot9qNlW3W4JnW5WPVELCRGDTQWlOpSd-lz8flOlw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:23:39.119Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=BpwMZXDW0V19tocpvbef_8R9x6D2Lojt0OVQnwtJgQakpgV4bJm0QA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:23:39.124Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=0am2PYpFnlS_tm314maylJz7hlWJZsxFUYV-XbO9ZkBTjT8nmkF15A&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:24:15.603Z] **selector-gap** — [TD2-setup-d2new] Session-menu button not visible
- [2026-07-12T10:24:30.675Z] **flow-gap** — [TD2-setup-d2new] test page (typed or MCQ) not reached
- [2026-07-12T10:24:31.643Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=O5ceVuIA-0kuH1yyxr7Z_tjirOyOTL97Ff0GqYKWdC0IYD6gxwAQUA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:24:31.648Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=bUF0kxv41V56Fe7yvOGgA5Y4IcxhTi7I1hZOzWocgdgDZZ5pXUAvRw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:25:24.271Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cx55EBDzb794y0rNxVVNYDbTHjg9NfLcw-JctBudpZ8kl77CoyXLpg&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:25:24.282Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=YL4qFKbrM0mjJpxcG8XrqEHOKDTSHeHUQifn_kKt9DD9OlobI4w3uA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:25:54.245Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=YL4qFKbrM0mjJpxcG8XrqEHOKDTSHeHUQifn_kKt9DD9OlobI4w3uA&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:25:54.289Z] **request-failed** — [fix10-TD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=cx55EBDzb794y0rNxVVNYDbTHjg9NfLcw-JctBudpZ8kl77CoyXLpg&VER=8& — net::ERR_ABORTED
  - STEP [MD1] join "25WT FIX10 MCQ FIX10_run3" via CNER7P → member
- [2026-07-12T10:26:41.620Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=XEdPGGPJC7zarlqWmlfi4MVEICe8r8C-IBKYLaDKO7j13TVxmzwr7A&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:26:41.625Z] **request-failed** — [fix10-MD1] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=8aKjITjlG7OoVfAZ85FWXefqYHkSv9B84nmHnaPRc9HLVASWLUm8eg&VER=8& — net::ERR_ABORTED
  - STEP [MD2] join "25WT FIX10 MCQ FIX10_run3" via CNER7P → member
- [2026-07-12T10:27:31.781Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=8lEDiXCGHi9yydqJ85Gq7SXE6MTHhOf5agTAeBJRhIydRi2he9gKIw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:27:31.785Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=v2_bDHKywuXfaoKdJsL9LIOrXoNo020ALcGPKps8JPv7oO9reb-HDw&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:27:58.263Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=L4VUkDt7zZpn07rBtMNA6MeLRkyZ6qkry2s44qLbz73IE0LS9fiZZg&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:27:58.268Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=ARGHoPNF1-kVB93EvMqI1QB3la-eT6B_ZYVmc1RNOUwjWS4BHCSWfw&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:28:34.763Z] **selector-gap** — [MD2-setup-d2new] Session-menu button not visible
- [2026-07-12T10:28:49.831Z] **flow-gap** — [MD2-setup-d2new] test page (typed or MCQ) not reached
- [2026-07-12T10:28:50.759Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=83YEtCfVzmMluZA8rY3Y4TLZCYFa_5xsgMm3fRieppABP6MayKzidQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:28:50.764Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=vRgLBY6dw0fSp78MBW8gc9x5W6ip5_zv_Wl-suqbfs5sdhFsK49lJQ&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:29:44.163Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=kuj8Fw_5iVlwZzkBPj_ka79CZiNhMnQI--yPwcsYaTBoSfxbD0TGTg&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:29:45.656Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LtPvjbu5DU2i9QXZI3covexn7ZKPWZWGaXlQqxnT9Dr2IcRYJuC9LQ&VER=8&d — net::ERR_ABORTED
- [2026-07-12T10:30:14.143Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=kuj8Fw_5iVlwZzkBPj_ka79CZiNhMnQI--yPwcsYaTBoSfxbD0TGTg&VER=8& — net::ERR_ABORTED
- [2026-07-12T10:30:15.626Z] **request-failed** — [fix10-MD2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=LtPvjbu5DU2i9QXZI3covexn7ZKPWZWGaXlQqxnT9Dr2IcRYJuC9LQ&VER=8&d — net::ERR_ABORTED
