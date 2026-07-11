# Findings — B_LIST_PROGRESS_PHASE1 (RUNL_L_20260706_014108)

**Run date:** 2026-07-06T01:47:42.319Z
**Policy:** docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md

## Raw anomaly log (triage EVERY entry — none dropped without written justification)

  - STEP [L1-T] logged in as lsr_s34@vocaboost.test; dashboard
  - STEP [L1-T] Day-1 typed completion
- [2026-07-06T01:48:19.187Z] **request-failed** — [L1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=L8kv95Jyd9XRT7jAe0U6B-MpiOtjoS0DKm6dkLV0ZDPnEm_IBu0FKQ&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:48:19.190Z] **request-failed** — [L1-T] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=wCLMzgjUmAGNg7_ETHHD-93YnGXvIKovGzQ5U4tiTLLpJMki1pwhfQ&VER=8& — net::ERR_ABORTED
  - STEP [L1-T] day 1→2 words 0→80 passedHeading=true
  - STEP [L1-M] logged in as lsr_s35@vocaboost.test; dashboard
  - STEP [L1-M] Day-1 mcq completion
- [2026-07-06T01:49:01.349Z] **request-failed** — [L1-M] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=Vgsa1ry-oxceQBcrtb6WoVO9geq7oUj0kUvB4ATEC4fWDt8OlEpmrQ&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:49:01.352Z] **request-failed** — [L1-M] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=A7sdjZXYBe9J2q18_QpgqOzbpm2N7tHTqk1aSbbVgGInjSbvxzqpkA&VER=8& — net::ERR_ABORTED
  - STEP [L1-M] day 1→2 words 0→80 passedHeading=true
  - STEP [L1-R] logged in as lsr_s37@vocaboost.test; dashboard
  - STEP [L1-R] failed once (outcome=results); mid-state day=1 words=0
- [2026-07-06T01:50:03.674Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WTxJ66FfE4MRIiMpX_Kp1BRaKHNzmnnXaKsgoCPHd8LI4YKbvwYEYA&VER=8& — net::ERR_ABORTED
- [2026-07-06T01:50:05.220Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JYAPrmx8JOOOY5gq-Uol3oIHUaNAwHgfu1piq9LzpM5K-N7SJfTkzw&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:50:13.078Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=WTxJ66FfE4MRIiMpX_Kp1BRaKHNzmnnXaKsgoCPHd8LI4YKbvwYEYA&VER=8& — net::ERR_ABORTED
- [2026-07-06T01:50:13.080Z] **request-failed** — [L1-R] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=JYAPrmx8JOOOY5gq-Uol3oIHUaNAwHgfu1piq9LzpM5K-N7SJfTkzw&VER=8&d — net::ERR_ABORTED
  - STEP [L1-R] retook → pass (outcome=results); day=2 words=80
  - STEP [L2] logged in as lsr_s04@vocaboost.test; dashboard
  - STEP [L2] selected Class:25WT RUNL L2B L_20260706_014108 List:LSR TOP Vocab (audit clone) (B=true L=true)
- [2026-07-06T01:50:30.591Z] **request-failed** — [L2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?gsessionid=CcFfSqxRT0yZ6OAgEl2M4j73YIODmKkTU1gZgWwlTB-n1_6rfD7IPQ&VER=8&d — net::ERR_ABORTED
- [2026-07-06T01:50:30.593Z] **request-failed** — [L2] GET https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?gsessionid=Alf-4C3CD_yntohPkPXKde4VxHnxGUZA1s7wACuXgKCx16XkWABWxQ&VER=8& — net::ERR_ABORTED
  - STEP [L2] after enter+reload: Class:25WT RUNL L2B L_20260706_014108 List:LSR TOP Vocab (audit clone) day=1 words=0
