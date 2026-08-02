# DEEPFIX2 — 17_ DEPLOY-ORDER REQUIREMENTS (the durable card home, r72 Opus condition 10)

The WinClaude dark-deploy order series MUST carry each item below; nothing here is optional or
handoff-ephemeral.

1. **RESET_V2 flip step [David 2026-08-03: "whenever is convenient" ⇒ the sandbox-rehearsal phase]**:
   `RESET_V2_ENABLED` (functions/foundation.js) deploys FALSE; flipping it is its own named,
   David-acknowledged deploy after the 25WT rehearsal exercises the §9 reset law. Until then production
   reset behavior is the legacy law (state-law parity; response adds resetV2/targetEpoch/rv2Deleted/
   jobsCancelled fields).
2. **THE grading_jobs (uid ASC, status ASC) composite index** — ADDED to firestore.indexes.json at r73
   (it did NOT previously exist; the §9 job-cancellation query and DF2-12's session-start pickup both
   need it). The index deploy precedes any RESET_V2 flip.
3. **H-A advance interlock + display-field freeze [r71 Opus]**: csd/twi single-line-of-advance is
   enforced by the mutual day-guards (engine completion refuses a legacy-advanced day and vice versa —
   fixtured). For engine-completed days the legacy display fields (recentSessions/stats/streakDays/
   interventionLevel/reviewMode) FREEZE; DF2-51's display reads engine truth. Until then, teacher-facing
   legacy stats under-report engine-day activity — a KNOWN, published limitation of the rehearsal window.
4. **Compose read-set sizing [CC-14]**: a first-compose day transactionally reads ≈ the introduced-range
   size in study_states (1,300-word lists ⇒ ~1,300-doc txn read sets; chunked ×300). Label-stamp
   contention aborts retry via runTransaction. No action — a sizing/contention note for the deploy
   monitors.
5. **N-1 twi semantics [r72 Opus]**: ENGINE twi = ordinal count over canonical order (gap-tolerant);
   the CS anchor law `twi = nwei + 1` is positional and exact only on gap-free lists. Gapped lists emit
   the `list_words_malformed` ops WARNING (`positionGap`) — surface to CS review; no refusal.
6. Standard set: functions + `audit/deepfix/task3/firestore.review_v2.rules` + indexes, all
   `enabled:false`, `rehearsalClassIds:[]`; the R2-48 flip choreography (14_ §4) governs activation;
   hosting does NOT deploy in this train.
