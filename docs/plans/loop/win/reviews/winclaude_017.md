# WINCLAUDE round 17 — M-MIG full sandbox audit — seed-phase SANDBOX GUARD abort

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MMIG_FULL_AUDIT`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_017.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T10:45Z (mig-r17, 6 fresh students s130–s135, LSR_TIER=base)
- **execDecision:** `NOT_CLEAN` — **but NOT a migration finding and NOT a classifier block: it died in the SEED phase on the harness's own safety guard. The 12 migration oracles never ran.**

---

## Gate status: NOT blocked ✅
Unlike the r15 sweep, the classifier **allowed** the command — the migrate-audit wrapper ran (it started seeding). So no permission gate this round; no ask for David.

## What actually happened — seed crash (verbatim, entire output)
```
file:///C:/Users/dmchw/vocaboost/audit/playwright/lsr_reviewonly_fb.mjs:66
  if (!assigned) throw new Error(`[SANDBOX GUARD] list ${listId} not assigned to class ${classId} — REFUSING`);
                       ^
Error: [SANDBOX GUARD] list 0HrPB6ejvDxQ16arUh7C not assigned to class ySd9tmRZlSXO6H23nb8g — REFUSING
    at Module.assertSandboxTriple (file:///…/lsr_reviewonly_fb.mjs:66:24)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async seedDualDocStrand (file:///…/lsr_deepfix_migrate_audit.mjs:268:3)
    at async file:///…/lsr_deepfix_migrate_audit.mjs:600:14
Node.js v24.11.1
```
**Exit code: 1** (node crash).

## Read (pointer, NOT a fix)
- The crash is in **`seedDualDocStrand` (lsr_deepfix_migrate_audit.mjs:268)**, called from the audit's main at :600. It calls `assertSandboxTriple` (`lsr_reviewonly_fb.mjs:66`), which **REFUSED** because the list `0HrPB6ejvDxQ…` was **not (yet) assigned** to the freshly-created class `ySd9tmRZ…`.
- **This is the safety guard working, not a data risk** — it refused to seed a strand until the sandbox triple (student-in-class + list-assigned-to-class) was verified. No unsafe writes occurred; nothing migrated.
- Most likely a **seed-ordering / not-awaited-assignment bug** in `seedDualDocStrand`: it asserts the triple before the list-assign write has landed/propagated for this MIG class. (Timing or a missing assign step for the dual-doc-strand class specifically.)
- **Possible connection (light pointer, unverified):** this "list not assigned to class" may share a root with **RS-3** ("list NOT shown on the teacher Assigned-Lists surface") if list-assignment persistence is the common factor — OR it's purely a seed-order race here. Your call which; I'm only flagging the surface similarity.

## Oracles / artifacts
- **NONE of MIG-1..10 / RET-3 ran** — the process died during seed, before any oracle. **No PROGRAM VERDICT.**
- **No artifacts written** (`findings/deepfix_mig_mig-r17.*` do not exist — confirmed).

## Safety / hygiene
- **`--dry` never reached** — the migration script wasn't invoked at all (died in seed), so no migration writes of any kind. The guard aborted before that.
- Partial seed: the MIG class `ySd9tmRZ…` (and any students seeded before the crash) were created as **25WT sandbox** docs — left in place like prior rounds (sandbox, harmless; adds to the deferred-sweep pile).
- Executor-only, no edits. Sandbox `lsr_*`/25WT only. No 26SM/prod contact. No commits/branches.

## For WSL-Claude (deliverable)
M-MIG got **past the classifier but not past its own seed guard**: `seedDualDocStrand` asserts the sandbox triple before the list is assigned to the new MIG class → `assertSandboxTriple` REFUSES. Fix the seed ordering (assign list → await → then seed strand / assert), hand me a re-run, and the 12 live migration oracles (MIG-1 LIVE-STRAND collapse, MIG-2 divergent CSD, MIG-3/4/5/8/9) can finally run. No migration-correctness signal yet — the verification is still pending on this seed fix.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_017.md`.
- `baton.json` → `turnOwner="claude"`, `revision=34`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T10:45Z`.
- Watcher re-backgrounded at baseline 34. Dev server up on 5173.
