# Claude → Codex: DEEPFIX Task 3 — review the P4 client-cutover DRAFT

> **TASK = DEEPFIX_TASK3_P4, round 1.** FIX_PLAN Phase P4 (FND-2, client cutover) implemented as a DORMANT reviewed
> draft (12 files, +1021/-78; all new routing behind `SERVER_PROGRESS_WRITE`/`SERVER_RESET_PROGRESS`=false +
> `SERVER_CHALLENGE_WRITE`/`SERVER_REVIEW_MARKER` at current values). Cannot be execution-tested here (Task 6).
> Review for correctness + flag-off byte-equivalence; adjudicate the uncertainties. Write
> `/out/reviews/codex_deepfix_task3_p4_001.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## BINDING RULE (David): verify every claim vs `/repo` file:line. The #1 safety property: FLAG-OFF must be
## byte-equivalent to today (Run-L discipline) — a regression here hits live 26SM on the next hosting deploy.

## Read
- The diff: `/repo/audit/deepfix/task3/phase4_diff.patch` + `/repo/audit/deepfix/task3/P4_impl_notes.md` (U1-U15 — adjudicate).
- Spec: `/repo/audit/deepfix/task2/FIX_PLAN.md` Phase **P4** (+ F6-2 teacher read, F6-3 reset, nonce F1/F3/F4, F5-HIGH-2/U13).
- P3's callables (the routing targets): `/repo/functions/foundation.js` (`completeSession`, `resolveListProgress`, `resetProgress`, `advanceForChallenge`). I-5 §2 for the nonce.
- Current code: `src/utils/testRecovery.js` (F3 memoized nonce), `src/pages/TypedTest.jsx:771/:879-896` (F1/F2), `src/services/studyService.js` (completeSession shim), `src/services/progressService.js:518` (F6-2 teacher read), `src/services/db.js:~2845` (U13 reviewChallenge→advanceForChallenge) `+:2886` (F6-3 reset).

## Verify (priority)
1. **FLAG-OFF byte-equivalence** — with all P4 flags false, is EVERY changed path identical to today's behavior? (the shims, the reset routing, the nonce, the teacher read, Dashboard Panel C). Name any path that isn't.
2. **Nonce F1/F3/F2** — single derivation (no double-derive), memoized store (catch NEVER re-mints per-call — closes the 06-29 docId divergence), server-echoed id preferred + divergence tripwire. Correct?
3. **completeSession shim** — does `recordSessionCompletion`→`completeSession` map ALL server statuses onto today's sentinels without changing flag-off behavior or losing a completion? (U3/U4: thinner flag-on return + `already_completed` idempotent re-run — safe?)
4. **U13 reviewChallenge→advanceForChallenge** — is `previousScore: attemptData.score||0` the correct pre-acceptance transition (client already wrote newScore at :2794)? Direct write preserved in `else`?
5. **F6-2 teacher read** (U14: read-order client-side) + **F6-3 reset** + **resolveListProgress hydration fail-open** (U5) — adjudicate.
6. **Build stamp** (vite.config.js/buildStamp.js/main.jsx) — additive/observability-only?
7. Any defect that would break a live path when a flag flips, or a flag-off regression.

Per-finding: `severity · location · problem · evidence · fix`. VERDICT + CONVERGED-OK if 0/0.
