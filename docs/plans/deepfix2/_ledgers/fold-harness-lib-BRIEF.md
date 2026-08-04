# BRIEF — shared test-harness lib (`fold-harness.mjs`): extract the emulator scaffolding, BYTE-IDENTICAL

No fold ledger (tooling refactor). The brief defines done. Behavior MUST be preserved — the acceptance
test is that all three folds' emulator evidence re-runs with IDENTICAL results.

## Goal
The three committed emulator test files clone the same scaffolding (Firestore-emulator connect/teardown,
the receipt + `sourceShas` writer, the case-runner loop). Extract the GENUINELY-SHARED parts into
`scripts/deepfix2/lib/fold-harness.mjs` (NEW) and update each fold's emulator file to import them, keeping
ONLY its fold-specific CASES. The three files (all committed — a clean baseline):
- `scripts/deepfix2/cutover-a-compose-emulator.mjs`
- `scripts/deepfix2/cutover-b-submit-emulator.mjs`
- `scripts/deepfix2/namespace-reservation-emulator.mjs`

## Honest scope — do NOT inflate
An independent review measured the genuinely-shared surface at **~100–200 lines/file** (emulator connect +
receipt/sha write + the case runner), NOT the whole file — most of each file is fold-specific CASE logic
that MUST stay in the fold's file. Extract ONLY what is actually common across all three (or ≥2). If a
piece differs per fold, leave it. Do NOT force-fit fold-specific logic into the lib to pad the line count.
A smaller, honest lib beats a big false abstraction.

## THE ACCEPTANCE TEST — proven by re-execution, not asserted
BEFORE touching anything, run each fold's emulator suite and RECORD its pass count (N/N). AFTER the
refactor, re-run all three; each MUST produce byte-identical results (same N/N, same numbers). Run them
ONE AT A TIME (they share the emulator port). Per fold, from `/app`:
```
PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
  ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
  "node scripts/deepfix2/<fold>-emulator.mjs"
```
(`<fold>` = cutover-a-compose / cutover-b-submit / namespace-reservation.) If ANY count changes after the
refactor, you broke behavior — STOP and report; do not paper over it.

## Constraints
- Touch ONLY: `scripts/deepfix2/lib/fold-harness.mjs` (new) + the three `<fold>-emulator.mjs` files.
  NOT the pure/mutants/fixtures files (out of scope this pass), NOT any source/rules, NOT the evidence
  JSONs by hand (the re-run rewrites them — that is fine, but their NUMBERS must be unchanged).
- Do NOT change any CASE's inputs or assertions — only relocate shared scaffolding.
- No git add/commit. No `change_action_log.md` write (propose the row TEXT). Stage nothing. The working
  tree carries a concurrent session's `.claude/settings*.json` — do not touch it.

## Refusal (a REPORT, not something to force)
- If the "shared" scaffolding meaningfully DIFFERS across folds (not truly common), extract only the real
  common subset and REPORT what wasn't shareable — do not invent a false abstraction to hit a number.
- If any fold's pass count changes after the refactor → STOP and report.
- If the emulator will not start → REPORT (level-3 partial), do not fake counts.

## Report (for an orchestrator who will re-run all three suites)
`filesChanged` manifest + the new lib; the BEFORE and AFTER pass counts for ALL THREE folds (must match,
number-for-number); the honest net line delta (the review expects ~100–200/file, not ~450); the exact
re-run commands; the proposed change-log row; anything you stopped on.
