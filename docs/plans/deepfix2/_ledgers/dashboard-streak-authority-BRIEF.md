# DASHBOARD-STREAK-AUTHORITY — IMPLEMENTER BRIEF (the ledger is law) — client-only, flag-gated

## Read first
1. `docs/plans/deepfix2/_ledgers/dashboard-streak-authority-fold-ledger.md` — THE LEDGER, your contract.
   V1-V5 ANSWERED (a scout, file:line inside).
2. `src/pages/Dashboard.jsx` — `calculateStreak` (:38-123), the ONE consumption at `:1399`
   (`progress.streakDays ?? calculateStreak(...)`, inside `panelBState` useMemo :1355-1416), the 2 render
   sites (:1809 hero pill, :1937 stat tile), the progress-loading effect (:677-746).
3. `functions/reviewV2/completion.js:678-750` (the `streak_credits` write — schema, kstDate UTC+9,
   ONE-PER-DATE-PER-UID = ACCOUNT-WIDE). `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md:192` (frozen
   schema). `firestore.rules:239` (the read is ALREADY allowed).
4. `src/config/featureFlags.js:243` (`REVIEW_V2_CLIENT`). The cutover idiom: `REVIEW_V2_CLIENT ? engine : legacy`.

## Mission (A1 + A2)
Behind `REVIEW_V2_CLIENT`, the Dashboard reads the ACCOUNT-WIDE server `streak_credits` ledger (a DIRECT
client Firestore query — rules allow it, `firestore.rules:239`) and derives the R2-21 streak number, shown
at `:1399`. The client `calculateStreak` stays the flag-off path.

## Key facts (build on them; do NOT re-derive or contradict)
- The server ledger is **ACCOUNT-WIDE** — one credit per KST date per uid, regardless of class/list (R2-21).
  The client's is per-list. So flag-ON shows ONE account-wide number. This is CORRECT (R2-21, David-ratified);
  `dashboard-df2-33` handles the presentation. Do NOT make the derivation per-list.
- Rules ALREADY allow a DIRECT client read (`firestore.rules:239`) — NO rules change, NO new callable, NO
  functions deploy. **READ-ONLY** (V5 — the read must never write; no reaching completeDay/the completion txn).
- The derivation is a NEW pure helper: query `streak_credits` ordered by `documentId()` DESC + a bounded
  `limit`, walk backward with FIXED Sat/Sun skip (R2-21 has NO `studyDaysPerWeek`) + the SAME freshness gate
  `calculateStreak` applies (`Dashboard.jsx:99-119`, "last credit is today/yesterday else 0"). Deterministic.
- Flag-off parity (V4): `calculateStreak` + the `:1399` expression + the `streakDays:0` branches
  (:1369/:1384/:1412) + the render sites BYTE-IDENTICAL. LEAVE the OTHER `streakDays` writers alone (legacy
  `updateClassProgress`/`recordReviewOutcome`; the `SERVER_PROGRESS_WRITE` mirror in foundation.js).

## Deltas
- **A1:** branch `:1399` → `REVIEW_V2_CLIENT ? serverStreak : (progress.streakDays ?? calculateStreak(...))`.
  Add a `serverStreak`/loading state to the progress-loading effect (`:677-746`), keyed on `uid`
  (account-wide, NOT the per-(classId,listId) loop), joined into `panelBState`'s deps. Fixture the DERIVATION
  (pure: fresh · broken · weekend-gap · stale→0 · empty→0) + the two-list→one-account-wide case + flag-off parity.
- **A2:** the READ (the query), flag-gated + read-only. Fixture the query shape (docId desc, limit) against
  seeded credits (use `scripts/deepfix2/lib/fold-harness.mjs` if the emulator is needed); assert NO writes.

## Scope — do NOT exceed
- Do NOT redesign the hero/per-list PRESENTATION (account-wide vs per-list display) — that's `dashboard-df2-33`
  (E1). This fold makes the account-wide server streak the AUTHORITY behind the flag.
- Do NOT touch `calculateStreak` or the other 2 `streakDays` writers (V4). E1/E2 are carded.

## Constraints
- NO git commit/add · NO `.claude/*` · NO `change_action_log` write (propose the row TEXT) · NO flag-value
  changes · stage nothing (concurrent session). READ-ONLY (V5).
- Run `gate.mjs --plan <ledger path>` before editing and `gate.mjs <ledger path>` at the end; include both.

## Refusal (a REPORT, not something to fix)
- The server ledger shape differs from V2 → STOP, cite file:line.
- A read would need a rules change or a new callable (V3 says a direct read is allowed) → STOP + report.
- Flag-off parity would require touching `calculateStreak`/the other writers → STOP.

## Report
`filesChanged` manifest + files created; the derivation's approach; evidence JSON paths + re-run commands;
ledger rows ticked vs not; the flag-off parity proof; the proposed change-log row; verbatim gate output.
This is a CLIENT fold behind a FALSE flag (dead flag-off; the account-wide display is flag-on only). Claims
without an evidence file are unverified.
