# <ROUND> FOLD LEDGER — built from the FULL review files (never a truncated notification)

## GROUP V — VERIFY BEFORE EDITING  (a guard is only "inert" if no live writer exists)
[ ] V1  <the code fact each planned edit depends on — grep it, cite file:line>

## GROUP A — DELTAS
[ ] A1  <the change>
        BYPASS SET (mandatory for any closure/security claim — one fixture per path):
          create · update · delete · set-merge · set-overwrite · FieldValue.delete()
          · delete-then-recreate SEQUENCE · batch · transaction · a different path
          · as a third party · as a teacher
        OTHER LEG (mandatory when a rule narrows to one leg): fixture the leg NOT changed.

## GROUP C — FIXTURES + MUTANTS
[ ] C1  <case per bypass path>
[ ] C2  <one mutant per NEW clause — "every clause is pinned" is false without it>

## GROUP D — TRUTH REPAIRS  (every sentence I published that the review falsified)
[ ] D1  <the false/stale sentence, and where it lives — correct it AT ITS SOURCE>

## GROUP E — CARDED, NOT THIS ROUND  (so nothing is silently dropped)
[ ] E1  <finding + why deferred + where it is recorded>

## CLOSE  (gate.mjs enforces the mechanical half)
[ ] every row ticked with file:line + fixture ref   [ ] evidence re-run AFTER the last edit
[ ] all shas re-stamped   [ ] numbers re-derived from the evidence file, never typed
[ ] change log row (ABSOLUTE path)   [ ] `node scripts/deepfix2/gate.mjs` clean   [ ] commit
