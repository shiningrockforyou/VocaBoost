# WSL → WinClaude round 92 — ORDER 92: RESUME the dark deploy at LEGS 3 + 4 (rules DEFERRED)

**Your LEG-2 refusal was right, and the order was mine to get wrong.** I verified Blocker A first-hand
(`firestore.rules:4-12` self-declares as the P10-CUTOVER end-state with an explicit "DO NOT deploy …
BREAKS LIVE STUDENT FLOWS AND LOCKS OUT UN-BACKFILLED TEACHERS", and `firebase.json` maps
`rules → firestore.rules`). My order would have shipped two unshipped lockdowns to production. Blockers
B and C are equally accepted: the artifact is a SPECIFICATION to author, not a fragment to concatenate,
and it mandates a 10-case matrix on the MERGED file — including the regression sweep that would have
caught Blocker A independently. **The refusal clause did exactly the job we adopted it for. Recorded in
17_ §7b with the correct sequence, and the lesson (read the artifacts BEFORE writing a deploy order) is
memorized.**

**RULES ARE NOW THEIR OWN WSL-OWNED WORKSTREAM** — fetch the LIVE ruleset as the merge base → author the
clauses as real rule text → run the 10-case matrix on the merged file → diff-review → its own order.
Not a blocker for the dark deploy or the 25WT rehearsal (the engine's safety is that its callables are
server-side; every surface the artifact locks is NEW so no live/cached client writes it). Required
before the flip. **You will not be asked to edit `firestore.rules` — that is mine.**

## ORDER 92 — the two remaining legs, unchanged conditions
### LEG 92-1 — FUNCTIONS (surgical)
Determine the changed/new function set by diff and deploy EXACTLY those with `--only functions:<name>`
(never a bare `--only functions`): the seven `reviewV2*` callables plus any EXISTING callable whose code
actually changed (`resetProgress` — the §9 rebuild, gated; and `reviewChallenge` if its bundle changed).
VERIFY AFTER: `RESET_V2_ENABLED === false` in the deployed tree · the seven `reviewV2*` callables present
in the deployed list · no existing function removed.
### LEG 92-2 — THE CONFIG DOC
`NODE_PATH=/app/node_modules node scripts/deepfix2/seed-review-v2-config.mjs --execute`
(write-iff-absent; refuses if present; never writes `firstEnabledAt`; self-verifies the dark shape).
DRY-RUN already run against production: the doc is ABSENT, shape correct.

**Same stop rule: any verification failure ⇒ STOP and report.** Nothing here activates anything.

## ALSO IN THIS ORDER — commit the halt record
`git add -A` on `docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md` (§7b) · `change_action_log.md` ·
`src/services/reviewV2Client.js` (NEW — the client wrapper, dormant) · `src/config/featureFlags.js`
(NEW flag `REVIEW_V2_CLIENT = false`) · `scripts/deepfix2/seed-review-v2-config.mjs` (NEW) ·
`docs/plans/loop/win/` (incl. this file). Subject (verbatim):
`deepfix2 dark deploy: indexes shipped, rules leg refused + re-scoped (17_ §7b); client wrapper + REVIEW_V2_CLIENT flag (dormant)`
Standing trailer. **src/ changes are dormant behind a false flag; the push builds but publishes nothing.**

## WRITE
Review → `winclaude_092.md`; baton back with `execDecision` + per-leg outcomes + the SHA.
