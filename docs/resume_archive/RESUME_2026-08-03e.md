# RESUME — DEEPFIX2: ✅ STAGE-2 CHECKPOINT CLOSED (2026-08-03) → THE DARK DEPLOY

## THE CHECKPOINT IS CONVERGED
**Codex r77 YES** ("PRESENTABLE: YES. The Stage-2 checkpoint is converged", target `3cb6e40`) +
**Opus r74 YES**. Receipts: `docs/plans/loop/codex_reviews/codex_deepfix2_r77.md` ·
`docs/plans/loop/fable_panels/panel_r74_opus.md`. Engine lap **220/220**, sha-bound, lint clean unmasked.
Rounds r70→r77 all folded; every closing condition closed or explicitly deferred with reasons.

## NEXT: THE DARK-DEPLOY ORDER SERIES (per docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md)
**AWAITING DAVID'S GO** (asked 2026-08-03 — it is the program's first PRODUCTION backend deploy).
The four legs, in order:
1. **indexes** — `firebase deploy --only firestore:indexes` (adds the NEW grading_jobs (uid,status)
   composite; 17_ §2 requires it before any RESET_V2 flip). Additive, no behavior change.
2. **rules** — merge `audit/deepfix/task3/firestore.review_v2.rules` (131 lines, ADDITIVE: denies client
   writes to the SIX new label fields + nine new subcollections + three new top-level collections; all
   are NEW surfaces, so the lock is inert for every live/cached client) into `firestore.rules` (419
   lines) and deploy. THE ONE OUTWARD-FACING LEG — verify additivity leg-by-leg before deploying.
3. **functions** — the 7 dormant callables + the ONE index.js wiring block. `RESET_V2_ENABLED=false`
   keeps `resetProgress` on the legacy law (David: flip it at the rehearsal phase).
4. **the config doc** — create `system_config/review_v2` = `{enabled:false, firstEnabledAt:null,
   rehearsalClassIds:[], configVersion:1, threshold:92, queueSize:60, testSize:30,
   minClientVersion:null}`. Until it exists the resolver returns HOLD (cold-start law) — safe, but the
   doc must exist before the rehearsal.
POST-DEPLOY: verify dark (every callable refuses `review_v2_dark`), then 25WT rehearsal
(`rehearsalClassIds` = sandbox class ids) → shadow audit (16_) → **David's backfill go** → **David's
flip** (flip-review-v2.mjs refuses without his flag).

## STANDING
Netlify auto-publish OFF (David 08-03, receipted 17_ §8) — pushes BUILD but never ship; **branch rule
RETIRED**, client work commits to main normally · R2-51 ratified · RESET_V2 flip = rehearsal phase ·
perpetual watcher (relaunch first thing each wake) · fold-ledger + OTHER-LEG discipline · absolute paths,
verified in-call · commit-then-marker protocol (worktree frozen during any review) · calibration alerts
to David each round.
