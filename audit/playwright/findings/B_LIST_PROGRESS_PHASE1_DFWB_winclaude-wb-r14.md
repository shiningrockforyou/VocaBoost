# Findings — B_LIST_PROGRESS_PHASE1 (DFWB_winclaude-wb-r14)

**Run date:** 2026-07-14T21:48:35.128Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [teacher] create class "25WT DFWB W-RA3g winclaude-wb-r14"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB W-RA3g winclaude-wb-r14 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:49:27.697Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BeVNqMpQ7DpJFMXfuRJxOj60-xkhJngLALMG8G7l86He0Fx8fj1QmA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB W-RA3g winclaude-wb-r14 → 5G5XXW
  - STEP [W-RA3g] join "25WT DFWB W-RA3g winclaude-wb-r14" via 5G5XXW → member
  - STEP [teacher] create class "25WT DFWB W-RA4 winclaude-wb-r14"
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB W-RA4 winclaude-wb-r14 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:51:05.880Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=YirfyRSqMYtv5MWwShzELW2P_WWHhT5BNZKEhEuNwBrY6Dkqx7FREw&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB W-RA4 winclaude-wb-r14 → 5R5JHE
  - STEP [W-RA4] join "25WT DFWB W-RA4 winclaude-wb-r14" via 5R5JHE → member
- [2026-07-14T21:52:01.918Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PDqL1BkYfq2gvzme9V7c8zKfmlO7YLUEmQXKb_A_30IfWYmAzNDhEA&VER=8& — net::ERR_ABORTED
- [2026-07-14T21:52:03.468Z] **exception** — [W-RA4] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disa
  - STEP [teacher] create class "25WT DFWB W-RA4b winclaude-wb-r14"
- [2026-07-14T21:52:27.642Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=a7oTqHplrXDwRTIxKdupjWlNZiTDsZN-9nO2S7mE99arxF5FcpLCmQ&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:52:27.718Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=a7oTqHplrXDwRTIxKdupjWlNZiTDsZN-9nO2S7mE99arxF5FcpLCmQ&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:52:31.916Z] **request-failed** — [wb-W-RA4] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=PDqL1BkYfq2gvzme9V7c8zKfmlO7YLUEmQXKb_A_30IfWYmAzNDhEA&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB W-RA4b winclaude-wb-r14 (pace=3 thr=92 mode=typed) → ok
- [2026-07-14T21:52:53.758Z] **request-failed** — [teacher] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=XPsFaXNkg9kW7KRPugYH2nX1ds32nMnq4FheHq_HTJYQiHJAb9fOmg&VER=8& — net::ERR_ABORTED
  - STEP [teacher] read join code for 25WT DFWB W-RA4b winclaude-wb-r14 → DQCUH3
  - STEP [W-RA4b] join "25WT DFWB W-RA4b winclaude-wb-r14" via DQCUH3 → member
- [2026-07-14T21:53:50.411Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BV0KBPsmY1c76e4UaDbnEDZav_AvolUHNVTSw8cphpjbWM0n8IcVBQ&VER=8& — net::ERR_ABORTED
- [2026-07-14T21:53:51.991Z] **exception** — [W-RA4b] TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^submit( test| answers)?$/i }).first()[22m
[2m    - locator resolved to <button disa
  - STEP [teacher] create class "25WT DFWB CUT-5 winclaude-wb-r14"
- [2026-07-14T21:54:16.119Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_GjpflJ0MkCaoIy-m0M0VtKj7fFdTXlAO84aRr0_lnaJCz8n4FljBg&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:54:16.229Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=_GjpflJ0MkCaoIy-m0M0VtKj7fFdTXlAO84aRr0_lnaJCz8n4FljBg&VER=8&d — net::ERR_ABORTED
- [2026-07-14T21:54:20.420Z] **request-failed** — [wb-W-RA4b] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=BV0KBPsmY1c76e4UaDbnEDZav_AvolUHNVTSw8cphpjbWM0n8IcVBQ&VER=8& — net::ERR_ABORTED
  - STEP [teacher] assign "LSR Base Camp (audit clone)" to 25WT DFWB CUT-5 winclaude-wb-r14 (pace=3 thr=92 mode=typed) → ok
  - STEP [teacher] read join code for 25WT DFWB CUT-5 winclaude-wb-r14 → MCVZHM
  - STEP [CUT-5] join "25WT DFWB CUT-5 winclaude-wb-r14" via MCVZHM → member
