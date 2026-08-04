# BRIEF — session-state hygiene: the `[>]` in-progress marker + a fail-closed `save-state.sh`

No fold ledger (this is a tooling change, not a security fold). The brief defines "done"; write tests that
prove each change. Touch ONLY the files named below — the working tree carries unrelated uncommitted work
from two parked folds and a concurrent session; do not touch or stage any of it.

## Why this exists
Work keeps getting re-done across session boundaries. Two causes, two fixes here:
1. The queue has no "in progress" state — an item reads startable while it's actively being worked, so a
   second session re-starts it. (This literally happened: two sessions designed the same fold.)
2. Session save-state leaves ledgers/briefs in a `/tmp` scratchpad that dies, and writes a RESUME pointing
   at those dead paths — so the next session "re-derives" work that was already done.

## Task 1 — teach `whats-next.mjs` the `[>]` (in-progress) and `[~]` (carded) markers
- CURRENT parser (`scripts/deepfix2/whats-next.mjs:32`):
  `/^- \[([ x])\] (\S+) \| (.+?) \| blocker: (\S+)$/` — matches ONLY `[ ]` and `[x]`; a `[>]`/`[~]` row is
  silently dropped (never enters the items list), which also makes any `after:<that-id>` resolve to
  "unknown dependency" (see the `byId` use ~`:51-54`) and poisons the exit-code signal (~`:73`).
- CHANGE: widen the class to `[ x>~]` and capture the state char. Semantics:
  - `[ ]` unstarted → eligible to be READY when its blocker resolves (unchanged).
  - `[x]` done → neither ready nor blocked (unchanged).
  - `[>]` CLAIMED / in progress → NOT ready; listed under a new "IN FLIGHT" heading; and it is a VALID
    dependency target — an `after:<claimed-id>` row resolves to "waiting on <id> (in flight)", never "unknown".
  - `[~]` CARDED / parked → NOT ready; listed under "CARDED"; also a valid dependency target (waiting).
- The exit-10 "runnable" signal counts ONLY `[ ]` items whose blockers resolve — `[>]`/`[~]` never make the
  turn read as "start something".
- Update the format-spec line at `docs/plans/deepfix2/WORK_QUEUE.md:6` to document `[>]` and `[~]`.
- TEST: `scripts/deepfix2/whats-next.test.mjs` (new) — feed a synthetic queue string through the parse/
  resolve logic (refactor the parse into an exported function if needed, WITHOUT changing its behavior for
  `[ ]`/`[x]`) and assert: a `[>]` item is reported IN FLIGHT not READY; an `after:<claimed>` reads "waiting"
  not "unknown"; a plain ready `[ ]` still reads READY; exit-10 fires only on a runnable `[ ]`. Run it
  against the REAL `WORK_QUEUE.md` too and confirm the live queue still parses (no rows lost vs. before —
  compare counts).

## Task 2 — `scripts/deepfix2/save-state.sh` (fail-closed; enforces the invariants, does NOT author RESUME)
The orchestrator still writes RESUME's prose; this script refuses to let a lossy save-state through.
- SWEEP: copy any `*fold-ledger*.md` / `*BRIEF*.md` from the session scratchpad
  (`/tmp/claude-*/-app/*/scratchpad`) into `docs/plans/deepfix2/_ledgers/` if a copy isn't already there
  (idempotent; never overwrite a newer repo copy — compare mtime/content).
- CHECK (exit NONZERO on any failure, printing exactly what's wrong):
  1. `RESUME.md` contains no `/tmp/` and no `<scratch` substring (a durable pointer must not point at a
     dead path).
  2. Every repo-relative path RESUME.md references (e.g. `docs/...`, `_ledgers/...`, `scripts/...`) EXISTS
     on disk.
  3. No `*fold-ledger*.md` named/implied by RESUME lives ONLY in scratchpad (must be in `_ledgers/`).
- REPORT (not fail): print `git status --short` and a reminder to STAGE EXPLICITLY (never `git add -A`) and
  commit — the concurrent session shares this tree.
- Make it safe to run repeatedly; pure bash + standard tools; no node required for the checks.
- TEST: `scripts/deepfix2/save-state.test.sh` (new) — build a temp RESUME with a `/tmp/...` pointer and a
  reference to a nonexistent file, assert save-state's check exits nonzero and names both; build a clean
  RESUME, assert it exits zero. Do NOT run the real sweep against the live tree in the test (use temp dirs).

## Constraints
- Files you may touch: `scripts/deepfix2/whats-next.mjs`, `scripts/deepfix2/save-state.sh` (new),
  `scripts/deepfix2/whats-next.test.mjs` (new), `scripts/deepfix2/save-state.test.sh` (new),
  `docs/plans/deepfix2/WORK_QUEUE.md` (ONLY the `:6` format line). Nothing else.
- NO git add/commit, NO change_action_log write (propose the row), stage nothing, report your exact footprint.
- If widening the regex would change behavior for existing `[ ]`/`[x]` rows, STOP and report — parity on
  today's rows is required.

## Report
`filesChanged` manifest + files created; the exact commands to run both tests; test output verbatim; the
before/after row-count of the REAL WORK_QUEUE.md parse (proving no live rows lost); anything you stopped on;
the proposed change-log row.
