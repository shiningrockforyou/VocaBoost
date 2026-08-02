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
3. **H-A advance interlock + frozen-field consequences [r71 Opus; wording corrected r74 N-7]**: csd/twi
   single-line-of-advance is enforced by the mutual day-guards. The ENGINE side is fixtured (a
   legacy-advanced csd makes completeDay refuse — lap). The completeSession side is the SAME transactional
   day-guard (foundation.js:1356-1364) verified by code reading; a completeSession-side lap fixture is
   EXPLICITLY DEFERRED to the 25WT rehearsal (the callable is live-flagged and its flow needs a full legacy
   session context). For engine-completed days the fields recentSessions/stats/streakDays/interventionLevel/
   reviewMode FREEZE — and they are not display-only: `deriveThrottleModeServer` and the intervention
   derivation CONSUME recentSessions, so a legacy completion after engine days derives throttle/intervention
   from a window that skipped them. Published consequence of the rehearsal window; dissolves when D-1
   removes the throttle and DF2-51 reads engine truth.
4. **Compose read-set sizing [CC-14]**: a first-compose day transactionally reads ≈ the introduced-range
   size in study_states (1,300-word lists ⇒ ~1,300-doc txn read sets; chunked ×300). Label-stamp
   contention aborts retry via runTransaction. No action — a sizing/contention note for the deploy
   monitors.
5. **N-1 twi semantics [r72 Opus; completed r74]**: ENGINE twi = ordinal count over canonical order
   (gap-tolerant; 15_ §2 supersession recorded). The CS anchor law `twi = nwei + 1` is positional and
   exact only on gap-free lists. EVERY canonical load (session/new/rerun/completion) emits the
   `positionGap` ops WARNING on a gapped list — surfaced to CS, no refusal. DUPLICATE positions KEEP
   refusing (`list_words_malformed`) — a duplicate breaks grading-key identity and is the real signature
   of the deleteWord/addWord REINDEX BUG (db.js deleteWord renumbers, addWord appends at count — carded
   in NEED_TO_FIX.md; the read-only position sweep runs pre-rehearsal, results filed with the deploy). **SWEEP RESULT
   (2026-08-03, scripts/deepfix2/list-position-sweep.mjs): 46 lists — 42 clean, 4 empty, ZERO duplicated,
   ZERO gapped. The hazard class is empirically absent from production today.**
6. **N-10 [r74]**: the completion evidence fence is TWO-legged by the ONE discriminator (`resetEpoch`
   presence): engine legs REQUIRE claimed presentations + complete valid gatePosture; legacy (epoch-less)
   legs keep the published boundary rules (rows/score validity still enforced; posture/presentation
   requirements exempt — they predate the engine).
7. **N-9 [r74]**: `windowRunId` stamping rides the ≤60s registry cache, so a window open/roll has a
   bounded skew where in-flight writers still stamp the prior run (their rows quarantine — fail-closed,
   never misclassified). PROCEDURE (extends the existing generation law's schedule): after writing
   `shadow_registry/window`, WAIT > the 60s TTL before starting batteries; same on teardown.
8. Standard set: functions + `audit/deepfix/task3/firestore.review_v2.rules` + indexes, all
   `enabled:false`, `rehearsalClassIds:[]`; the R2-48 flip choreography (14_ §4) governs activation;
   hosting does NOT deploy in this train.
