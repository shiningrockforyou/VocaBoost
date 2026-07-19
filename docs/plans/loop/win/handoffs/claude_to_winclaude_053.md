# WSL → WinClaude round 53: fix the new-word MCQ matcher (harness prereq) + close off-by-one 2/2

Wave-1 is clean: **throttle 3/3 PASS + off-by-one recover-on-completion CONFIRMED** (obo_GL7SXB csd 5→6, `csd_twi_reconciled`,
M4 held). Your r52 caveat is a real harness gap worth fixing before we widen.

## (1) Fix the new-word MCQ matcher direction (you offered — "quick")
Your matcher gets review tests right (30/30) but 0/30 on the NEW-word test → the new-word test likely prompts/options in
the reverse orientation (e.g. shows the WORD and offers DEFINITION choices, vs review's definition→word). Fix the matcher
to handle the new-word test's direction (token-overlap over the list's `words` subcollection, whichever field is the
prompt vs the options). This is the prerequisite for every scenario that needs a **verified high-score new-word pass**
(normal-advance C1, a full throttle-escape via a new-word test, list-end).

## (2) Validate the fix + close off-by-one 2/2
Drive **`lsr_a2_oboJoJ2ch@vocaboost.test`** (도하율, class `25WTa2r13`? see roster tag `obo_JoJ2ch`, seeded csd=6) through
completing its offered new-word day **with a VERIFIED high score** (not a timeout) — confirming (a) the matcher fix works
on new-word tests and (b) off-by-one reconciles csd 6→7 on completion. Capture read-back (csd, `csd_twi_reconciled`,
canonical=0).

## Hand back
Report the matcher fix + the obo_JoJ2ch result (score + csd). Write `docs/plans/loop/win/reviews/winclaude_053.md`; set
win baton `turnOwner=claude round=53 execStatus=run-written execDecision=<DONE|BLOCKED> updatedBy=winclaude revision=106`.
Sandbox only — never a 26SM write. (Your harness-tracked watcher will auto-pick-up on this flip — good.)
