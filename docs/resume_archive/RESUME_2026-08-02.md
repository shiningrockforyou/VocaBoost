# RESUME — DEEPFIX2 implementation, paused mid-checkpoint-1 (2026-08-01, usage-reset pause)

> **Where we are:** implementation STEP 1 (stage-1 contract freeze) — four convergence rounds deep
> (r53→r54→r55 + three 3-Fable panels). Everything through the R2-42..45 ratification fold is DONE and logged;
> the r55 + freeze-panel verdicts (both received 2026-08-01, logged as receipt rows in `change_action_log.md`)
> are **RECEIVED BUT NOT FOLDED** — David ordered a pause pending usage reset. Ledger = `11_` §1, R2-1..R2-45.

## Resume queue (in order)
1. **ASK DAVID first — two open rulings:**
   - **R2-42/R2-15 collision (Codex r55 #2, load-bearing):** when priority words fill all 30 test slots, the
     deterministic remainder has NO service bound (H8 measured a real advancing violation: 48 vs bound 40).
     Options: (a) reserve K remainder slots (e.g. 5 of 30) — priority takes ≤25, hard bound restored, slight
     dilution of the priority-first pedagogy; (b) keep uncapped priority + ratify a bounded EXCEPTION ("the
     bound holds whenever remainder slots exist; under backlog saturation exposure defers to backlog drain,
     monitored"). Codex requires one of the two stated plainly.
   - **H6 §6b R2-43 extension (freeze-panel):** the fold also skips the future R2-10 proof-stamp on resting
     words — beyond David's ratified letter. Ratify or strike.
2. **THE r55+panel CORRECTION FOLD** (one batch; both verdict receipt rows in the change log carry the full
   lists). Headlines: B1 challenge-aware boundary + adjudication-time replay (+ conservative exclusion if
   unreconstructable) · **14_ §3 B3 write set += `reviewRestingUntil`** (build-consequential miss) + B1 emits
   it · atomic run manifest (hash-bound JSONL+summary+pointer) · per-signature counts at fence sites ·
   reset lock (`resetInProgress`) · per-visit restudy claim docs · presentation n-seq allocator + fingerprint
   {modality, phase, kind} + delimiter-safe hashes · resting-bootstrap validation vs eligible history + canonical
   wordIndex · completion evidence-kind matrix + anchor/generation · exact minClientVersion predicate ·
   server-only fallback telemetry sink (not system_logs) · grading-job exact-uid + legacy quarantine ·
   H8 per-word launch ingest + effectiveTestSize invariant + fallback sim · R2-44 ecosystem stragglers
   (00:27, 01:91, ARCH:548) · R2-40(c) hover wording → superseded-by-R2-45 · R2-10 state text (i-iii closed,
   (iv) OPEN) · the R2-1..R2-45 range sweep (12 cites) · version stamps.
3. **r56**: Codex closure verification + 3-Fable panel (simultaneous, handed off at agent launch) → if clean,
   **STAGE-1 IMPLEMENTATION AUTH declared**, B1 `--full` runs (gitignored), then the dark build (stage 2) begins.

## Standing context
- Plan of record `docs/plans/deepfix2/02_TASK_LIST.md` (v5) · spec `10_` · ledger `11_` §1 (R2-1..R2-45,
  binding) · trace `12_` (77 rows) · Track A reports `trackA/` · Track B `14_` + `scripts/deepfix2/` ·
  H6 `15_` · rules artifact `audit/deepfix/task3/firestore.review_v2.rules` · H8 + evidence in `evidence/`
  (uid-bearing baselines live GITIGNORED in `audit/deepfix/trackB_baselines/`).
- Five-stage gates: (1) impl auth ← WE ARE HERE (blocked on the two rulings + the fold + r56) → (2) dark build
  → (3) 25WT product rehearsal → (4) David's backfill go → (5) David's activation flip.
- Convergence protocol: 4-entity (3 Fable via Workflow + Codex), Codex handed off AS the agents launch;
  45-min stall guard; if Codex is silent — STOP and tell David (standing order).
- Batons: Codex `docs/plans/loop/baton.json` at r55/rev183 back on our side (verify at resume);
  WinClaude `docs/plans/loop/win/baton.json` r67 ACK/standby (env green: node 24, firebase-tools 14.27,
  Java 21, Playwright 1.58).
- Uncommitted work has piled up since commit `9819336` (all plan docs + step-1 artifacts) — schedule a
  WinClaude session-save round when convenient.
- Every edit is row-logged in `change_action_log.md` (David's standing order: clear logs every edit);
  CS events in `SUPPORT_RUNBOOK.md` (last: CS-2026-08-01 B2 probe).
