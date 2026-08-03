# RESUME — DEEPFIX2 (2026-08-03: DARK DEPLOY COMPLETE · RULES ARTIFACT CONVERGING)

## PRODUCTION (live-verified)
Indexes 43 ✅ · functions 24 ✅ (zero removed) · **`system_config/review_v2` SEEDED DARK ✅** · rules NOT
deployed (the one remaining leg) · client PINNED `ce09792` · **Netlify BUILDS STOPPED** (pushes trigger
nothing) · NOTHING ACTIVATED. Students see no difference.
**WSL Claude cannot push — every push is a WinClaude order.** [[wsl-claude-has-no-git-push]]

## IN FLIGHT
- **ORDER 93 (win baton rev 179, turnOwner=winclaude): PUSH ONLY.** Amended mid-flight to allow a dirty
  worktree (round-2 fold landed while it ran). Expect `execDecision: PUSHED`. **Codex cannot start until
  this lands** — its review target must exist on origin.
- **UNCOMMITTED: the panel round-2 fold** (artifact + matrix + mutants + firebase.json + the moved P10
  draft + 17_ + NEED_TO_FIX + log rows). COMMIT IT as soon as the baton returns.

## THE RULES ARTIFACT — state
`audit/deepfix/task3/live_baseline/firestore.merged.rules` · **194/194 matrix · 7/7 mutants killed**.
Panel r1: spec-fidelity YES / forgery NO → folded. Panel r2: blast-radius **YES** ("zero live client
writers denied"), fold-closure **NO** → folded (below). **NEXT: one more Opus closure pass, then the
CODEX FINAL GATE, then its own deploy order.** Deploy is NOT authorized yet.

### What r2 caught (both reviewers independently) — the pattern to keep watching
**I published F1 as CLOSED when it was not.** `create`/`delete` on users were bare `isOwner`, so
delete-then-recreate restored role elevation in two calls, and the matrix asserted NEITHER op — so
"every clause is pinned" was false too. Fixed: `delete: if false` + cases R7-R11 + mutant M7, and the
claim restated in the artifact, the receipt AND 17_. **Rule: a closure claim needs a fixture on the
bypass, not just on the direct path.**
**The deploy landmine was still armed:** firebase.json pointed at `/app/firestore.rules` (the unshipped
P10 cutover) — 27 measured live-flow regressions if shipped. Draft moved to
`docs/plans/UNSHIPPED_P10_CUTOVER.firestore.rules`; firebase.json now points at the LIVE ruleset so a
blind rules deploy is a **no-op**. The real order must name the merged artifact explicitly.

## AWAITING DAVID (raised, not fixed — NEED_TO_FIX bottom entry)
**Anyone can self-register as a teacher** (`Signup.jsx:124-149` public Teacher radio → `db.js:254`
verbatim), and the LIVE ruleset lets ANY teacher read/write EVERY student's subcollections regardless of
class membership, plus rewrite `ap_answer_keys`. Live today, NOT caused by DEEPFIX2. Three options
carded (remove the radio / scope the grant to class membership / custom auth claim). **His call.**

## THEN, in order
DF2-12/13 typed grading → DF2-51 client cutover (wrapper + dormant flag exist) → 25WT rehearsal →
shadow audit → **David's backfill go** → **David's flip**. DF2-10 adoption legs stay DEFERRED until
after the rehearsal (they are the only remaining work touching live student paths).

## STANDING
Watcher first-thing every wake · **Codex is the FINAL gate only — WSL+Opus converge first** (David
2026-08-03) · fold-ledger before edits, verify per row · absolute paths · no git while WinClaude holds
the baton · calibration alerts · `exports.version` is stale after surgical deploys.
