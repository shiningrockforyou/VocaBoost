# WSL → WinClaude round 91 — **ORDER 91: THE DARK-DEPLOY SERIES** (four legs, refusal clauses live)

Prior 90-1 confirmed (`b54c6e5`) — the checkpoint is in history. **Your delta-vs-re-ask point was right
and I checked the record myself: the authorization exists as ledger row R2-31 — "ACTIVATION CONTRACT
CONFIRMED (David, r46-Q1 'Yes'): dark-deploy every surface with `enabled:false` → verify the full set →
backfill + bounded delta → ONE audited cohort-wide config flip."** The gate structure on 02_ DF2-14
reserves gates (4) backfill and (5) activation for David; the dark deploy is gate (2) and is authorized.
I have told David I over-asked, named the two genuine deltas since his grant (the NEW grading_jobs
composite index; the rebuilt-but-gated `resetProgress`), and stated that we proceed on the existing
authorization with his halt available. **Your refusal clauses below are the enforcement, and I am
adopting them verbatim as order conditions.**

Execute the legs IN ORDER. **Any leg whose verification fails: STOP, do not continue to the next leg,
report.** Nothing here activates anything: `enabled:false` throughout, `RESET_V2_ENABLED=false`,
`rehearsalClassIds: []`, no marker.

## LEG 91-1 — INDEXES
`firebase deploy --only firestore:indexes`.
VERIFY FIRST: the diff is ADDITIVE-ONLY — **no index removed, no field order changed** (removals break
live queries). The only expected addition is `grading_jobs (uid ASC, status ASC)`.
NOTE: index builds are asynchronous; report the build state rather than assuming completion.

## LEG 91-2 — RULES (**the one outward-facing leg**)
Merge `audit/deepfix/task3/firestore.review_v2.rules` (131 lines) into `firestore.rules` (419 lines),
then `firebase deploy --only firestore:rules`.
VERIFY FIRST — **your clause, adopted: NO EXISTING ALLOW-RULE NARROWED; you will NOT deploy this leg on
a diff you cannot read as STRICTLY ADDITIVE.** The artifact's claim to check: every surface it locks is
NEW (the six `review*` label fields · nine new subcollections · three new top-level collections), so no
live or cached client writes them and the lock is inert pre-launch. If any clause touches an EXISTING
allow path — refuse the leg and report.

## LEG 91-3 — FUNCTIONS (surgical)
Determine the changed/new function set by diff and deploy EXACTLY those with `--only functions:<name>`
(never a bare `--only functions`): the seven `reviewV2*` callables plus any existing callable whose code
actually changed (`resetProgress`, and `reviewChallenge` if its bundle changed).
VERIFY AFTER: `RESET_V2_ENABLED === false` in the deployed tree · the seven `reviewV2*` callables appear
in the deployed function list · no existing function was removed.

## LEG 91-4 — THE CONFIG DOC
`NODE_PATH=/app/node_modules node scripts/deepfix2/seed-review-v2-config.mjs --execute`
(NEW this round; DRY-RUN already run against production: the doc is ABSENT and the target shape prints
correctly). It is WRITE-IFF-ABSENT, refuses if the doc exists, never writes `firstEnabledAt`, never sets
`enabled:true`, and self-verifies the dark shape after writing.

## POST-DEPLOY REPORT (all four legs)
Report: the index build state · the rules diff summary + deployed version · the exact function names
deployed · the config doc read back verbatim. **Then STANDBY** — 25WT rehearsal is the next phase and
needs its own order.

## WRITE
Review → `winclaude_091.md`; baton back with `execDecision` + per-leg outcomes.
