# WinClaude r086 — ORDER 86-1 (the r74 ledger fold)

**Date:** 2026-08-02 · **Executor:** WinClaude · **Baton rev in:** 163 → **out:** 164
**Handoff:** `claude_to_winclaude_086.md` · **Authority:** B + E (David, r69).

## VERDICT: `PUSHED` — order complete

| | |
|---|---|
| **Commit SHA** | `e9e8ac4` |
| **Remote** | `origin/main` `58af1f1..e9e8ac4` — clean (**16 clean pushes**; no lock collision) |
| **Files** | **22** (920 insertions, 79 deletions; 7 new) |

## 1. Safety pass

- **`list-position-sweep.mjs` (NEW) scanned before staging** — it is a READ-ONLY production sweep, so I
  checked its content for identifiers: uid-pattern (`[A-Za-z0-9_-]{28}`) and email scans both returned
  **no matches**. Consistent with your note that it prints list IDs + counts only.
- Nothing matching `src/**`, `serviceAccount`, `trackB`, or `audit/` staged. r083's `db.js` line remains the
  program's only client delta.
- Sync check PASSED (twelfth run).

## 2. Notable content

- **Stale-lock permanent-lockout closed** (composer N-2): a crashed reset lock older than 10 minutes no
  longer blocks engine reads/writes. Worth recording that this is the *second* defect found in the reset
  path — the first was BL-A (r071 Opus / my r083 escalation). The §9 reset machinery has now produced two
  blocking-class findings; it is the most defect-dense area of the build so far and deserves the heaviest
  weighting in the 25WT and shadow batteries.
- **Production position sweep: 46 lists, ZERO duplicated, ZERO gapped** — filed in `17_` §5. A clean
  read-only result on real data, obtained without any write.
- **Lap 201/201.**
- `NEED_TO_FIX.md` gains the `deleteWord`/`addWord` reindex card — correctly routed to the backlog file
  rather than expanding this train's scope.

## 3. Watcher change (this round, David-directed)

The one-shot watcher was replaced with a **single perpetual `Monitor`** that fires on every baton flip and
never exits — no more per-round re-arming. It keys on the **owner transition** rather than `revision >`
baseline, specifically because your hand-backs have repeatedly not bumped `revision`; the old design would
have silently deadlocked on such a round. Error states are debounced so a missing/corrupt baton reports once
rather than flooding. Recorded to durable memory at David's instruction.

**This does not change anything on your side** — keep flipping `turnOwner` as you have been (and please do
still bump `revision`; it remains the audit trail and the only defence against a genuine two-sided race).

## STANDBY

Baton returned at rev **164**. Next: the r74 verdicts. **On a double-YES: THE DARK-DEPLOY ORDER SERIES per
`17_`** — zero-delta, `RESET_V2_ENABLED` false through the deploy per David's ruling.

Boundaries unchanged: hosting only on an evidence-citing order (with the `db.js` delta inside the OFF-parity
check) · no 26SM writes · `system_config` only via the §2.8 guarded script · **the global ON switch and the
`RESET_V2` flip are both David's.**
