# RESUME — DEEPFIX2 (2026-08-04: cutover-b + namespace COMMITTED & auditor-verified · operating model hardened)

## ⚡ FIRST ACTION — arm the monitor, then session-start
```
Monitor({command: "bash /app/scripts/deepfix2/baton-monitor.sh",
         description: "DEEPFIX2 baton returns (win + codex)", persistent: true, timeout_ms: 3600000})
```
Then `bash scripts/deepfix2/session-start.sh` — it relaunches the watcher, prints both batons, surfaces the
baton event log, and lists open ledgers + uncommitted work. This is CLAUDE.md's documented first action.

## READ THE OPERATING MODEL (new 2026-08-04 — it changes how you work)
CLAUDE.md now has an **"Operating model — DELEGATE, KEEP JUDGMENT"** section. In short: delegate
implementation to the **`implementer`** agent-def (Sonnet; pass `model: opus` at spawn for a live-path fold);
verify with the **`auditor`** agent-def (Opus — re-executes the evidence, returns GO/NO-GO); **read verdicts,
not diffs**; do a **file-ownership pass** before parallel fan-out (disjoint sets, else sequence/single-own);
set **`[>]`** on an item before delegating it; run **`save-state.sh`** at session end. Durable ledger home
is `docs/plans/deepfix2/_ledgers/`.

## WHERE THINGS STAND
**Nothing is deployed; nothing is activated.** `REVIEW_V2_CLIENT=false`. Production: functions STALE at
`b54c6e5` · rules DEPLOYED (`384c9c7a…`, sha16 `f40f91fce3693b82`).

**COMMITTED + PUSHED this session (win order 100 pushed all 19 commits; `origin/main` == HEAD `b6dce9b`).**
⚠ **COMMITTED ≠ DEPLOYED:** the committed `firestore.rules` (sha16 `4d8e511b`, w/ the namespace guard) and
`functions/` changes are AHEAD of the DEPLOYED state (rules still `f40f91`, functions still `b54c6e5`) —
they ship later via `functions-deploy-engine`, Codex-gated. "Production unchanged" = deployed, not committed.
- `9d73e98` — **cutover-b-submit + namespace-reservation**, each AUDITOR-VERIFIED GO (Opus, level-4):
  - cutover-b-submit: client submit routes through engine `submitAttempt` behind the flag; adapter
    `reviewV2Submit.js` sends only `{presentationId, answers}`; recompose-once on `grade_unusable`. Pure
    179/0 · emulator 65/0 · mutants 2/2. **VISUAL CHECK OWED** (queue `cutover-b-visual`, a win order).
  - namespace-reservation (NTF 19+22): `rv2_` prefix reserved at 3 mouths (G1 rules + G2 submitVocabAttempt
    + G3 gradeTypedTest). rules 276/276 · 16/16 mutants · emulator 31/31. 3 deploy artifacts sha16 `4d8e511b`.
- `a7aadbf` — **orchestration tooling**: `implementer`/`auditor` agent-defs, `[>]`/`[~]` markers, `save-state.sh`.
- (this commit) — CLAUDE.md operating-model section + this RESUME.

## PENDING (needs David / WinClaude)
- **Win order 100 DONE — PASS_WITH_GAP** (`docs/plans/loop/win/reviews/winclaude_100.md`): push SUCCEEDED
  (all 19 commits on origin). The cutover-b VISUAL CHECK is BLOCKED at a COST boundary — the NEW-WORD test
  is TYPED (reviewTestType governs only the REVIEW test), so submit→grade→result would bill real AI
  grading; WinClaude's cost-guard stopped. **Submit→grade→result stays UNVERIFIED in a browser** (cutover-b's
  acceptance criterion). **DAVID DECISION** (see `cutover-b-visual`): authorize one bounded typed submission,
  OR make the new-word test MCQ-configurable, OR provide an account past the new-word gate on an MCQ class.
- **Deferred bundle item:** the shared test-harness lib (`scripts/deepfix2/lib/fold-harness.mjs`) — modest
  savings (~100–200 lines/file, re-scoped by the plan-audit); the clean committed baseline now exists.

## NEXT (`node scripts/deepfix2/whats-next.mjs` is authoritative)
- `cutover-c-complete` (ready) — route day completion through `completeDay`.
- `namespace-legacy-cache-23`, `functions-deploy-engine` (ready, after namespace).
- **David's gates:** backfill-go · flip-go · gradedIsCorrect-trust · teacher-registration · deploying the
  committed folds (Codex-gated — the folds are committed but NOT deployed).

## STANDING FACTS
- Dev build talks to REAL production Firebase (`VITE_USE_EMULATOR=false`) ⇒ UI checks use 25WT identities
  ONLY, never 26SM. Typed tests bill real AI tokens.
- WSL cannot run vite or git push ⇒ both are WinClaude orders. A concurrent session shares this repo
  (`.claude/settings*.json` are THEIRS) ⇒ stage explicitly, never `git add -A`.
- Deploy stays David + Codex-gated. Codex baton idle (claude r79 YES).
