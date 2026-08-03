# DEEPFIX2 — EXECUTION DISCIPLINE, OPERATIONALIZED

Written 2026-08-03 after David observed: *"It seems I keep having to remind you, which seems
inefficient."* He is right, and the reminders were always about the same handful of rules. This
document is the fix, and the fix is **not another rule**.

## 1. WHY REMINDING KEPT BEING NECESSARY (root cause, not symptom)

Every discipline rule in this program lived in one of two states:

| State | What happened to it |
|---|---|
| **Advisory** (a memory file, a note, an instruction to myself) | Decayed within the session. I recalled it when prompted, not when it applied. |
| **Fail-closed** (something refuses) | Held every time, with zero reminders. |

The evidence is unambiguous. Four things caught real defects this program, and all four were
mechanical: an `assert` on an edit anchor (caught a silent no-match), the mutation suite refusing when
an anchor went stale (caught a claim before it was published), the executor's read-before-deploy
refusal (stopped a production outage at r91), and Firestore rules themselves. Meanwhile the advisory
half decayed: the fold ledger existed with **zero rows ticked**, three planned rows silently died, and
a stale test score was published in three consecutive rounds — once *inside the paragraph claiming the
previous stale score had been fixed*.

**Design principle: a discipline that is not GENERATED or GATED will decay. Convert every rule into
one of those two, or expect to repeat it.**

There is a second, subtler failure this cannot fix and must not pretend to: **applying a rule only
where it was last pointed out.** After r2 caught an incomplete closure on `role`, I wrote the lesson
down and then applied it *only to `role`* — r3 found the identical hole in both other guards. Tooling
cannot catch that; only a template that forces the rule **per item** can, which is why the ledger has a
mandatory per-guard BYPASS SET row.

## 2. THE MECHANISMS

### (a) `scripts/deepfix2/gate.mjs` — run before publishing anything
Fails closed on the things a machine can decide. Its first run found two real defects immediately.

| Gate | Prevents |
|---|---|
| LEDGER | rows silently dying — fails if any `[ ]` remains in the newest ledger; warns if no BYPASS-SET row |
| FREEZE | certifying bytes that no longer exist — evidence must post-date the last artifact edit, and the stamped sha must match |
| NUMBERS | stale scores — every score-shaped figure in the receipt and `17_` must exist in the evidence JSON |
| CLAIMS | asserting from intent — lists strong words ("is closed", "cannot be", "no-op") with no evidence pointer nearby |
| BATON | racing an executor — warns when someone else holds the turn (no git, no editing their review target) |
| WATCHER | a returned baton sitting unnoticed |
| LOG | an unlogged change |

### (b) `scripts/deepfix2/session-start.sh` — one command, every start-of-turn duty
Relaunches the watcher, prints both batons, lists unfinished ledgers, shows uncommitted work and the
RESUME pointer. Replaces a five-item list I had to remember (and twice didn't). Its first run surfaced
53 unticked rows across four old ledgers.

### (c) `scripts/deepfix2/FOLD_LEDGER_TEMPLATE.md` — the plan, with the lessons built in
Copy it per round. Its structure forces what judgment kept missing: VERIFY-BEFORE-EDITING rows, a
**BYPASS SET per guard** (create · update · delete · set-merge · set-overwrite · FieldValue.delete ·
delete-then-recreate · batch · transaction · other path · third party · teacher), an OTHER-LEG row, a
mutant per new clause, TRUTH REPAIRS at source, and CARDED rows so nothing is silently dropped.

### (d) Numbers are derived, never typed
Every score in a receipt comes from the evidence JSON. The NUMBERS gate enforces it. This class of
error had survived three rounds of human review; it cannot survive a diff against its own evidence.

### (e) Panel prompts carry the history
Each review round's prompt states the author's demonstrated failure mode and says *verify, accept
nothing*. That is why r2, r3 and r4 found what they found — the reviewers were pointed at the right
suspicion rather than asked for a generic opinion.

## 3. THE LOOP (what "doing it right" looks like end to end)

```
session-start.sh ──► read the FULL review files (never a truncated notification)
   └─► copy FOLD_LEDGER_TEMPLATE.md, fill V-rows, enumerate a BYPASS SET per guard
       └─► verify each V-row in code BEFORE editing (a guard is inert only if no live writer exists)
           └─► edit (every edit asserts its anchor) ──► fixtures + one mutant per new clause
               └─► FREEZE the artifact ──► re-run evidence ──► re-stamp shas
                   └─► tick every row with file:line + fixture ref
                       └─► node gate.mjs  ──(must be clean)──► log ──► commit
                           └─► push order to WinClaude ──► review panel ──► Codex final gate
```

## 4. THE RULES A MACHINE CANNOT ENFORCE (kept short so they are memorable)

1. **A closure claim needs the bypass set, per guard, every time** — not just for the guard a reviewer
   named.
2. **Don't fix a hazard by restructuring the repo** unless the blast radius on tooling has been
   checked. My "landmine fix" broke five harnesses and would have silently reverted the workstream.
3. **Freeze the artifact while a panel measures.** Editing mid-review invalidates the sha binding that
   downstream gates depend on.
4. **Report the outcome, not the intent** — including when the outcome is "I published something
   false."
