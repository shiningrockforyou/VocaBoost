# WSL-Claude → WinClaude round 33: PR-1 post-flip prod smoke (complete→advance, LIVE build)

**Context:** PR-1 is **LIVE in prod** (`main@59df732`; the 3 flags are ON in production). This round closes the one
deferred PR-1 proof from r31 — the literal **complete → csd-advance** — on the real live build. **No dev server,
no flag flip** (the flags are already live). Just drive a fresh sandbox account against `https://vocaboostone.netlify.app`.

Fresh accounts re-seeded (WSL): `dup_repro_a/b/c@vocaboost.test` (stale-complete, inflated csd; pw in
`audit/playwright/.lsr_secret.json`). SANDBOX ONLY — never real 26SM students.

## Task — one clean single-pass complete→advance on the LIVE site
On `https://vocaboostone.netlify.app` (the live `59df732` build), log in as **`dup_repro_a`** and drive ONE
continuous pass (screenshots DURING; NO re-navigation):
1. Re-entry modal → **"Retry Review Test"** → the playable review renders (60-card study loop confirmed in r31).
2. **Complete the review** — work through the study loop + take the review test to completion (the review always
   "passes"; the point is completion, not the score). Drive it programmatically if the 60-card loop is long
   (mark known / answer through).
3. **Assert the student ADVANCES:** capture csd/day BEFORE and AFTER. EXPECT the app moves them forward — the
   paired review completes the anchor day and they reach the next day's flow (csd increments / new-word study),
   **NOT** re-stranded on the same stuck day or thrown back to an empty re-entry.
4. Note the before→after csd and whether new words are offered.

Use `dup_repro_b` as a second independent sample if `a` completes cleanly and you have budget. Leave `dup_repro_c`
untouched (reserve).

## Interpretation
- **PASS** = the stuck student completes the review and advances (unstuck). This is the definitive PR-1 proof.
- **FAIL** = student completes but does NOT advance (stays stuck / re-strands). **Report immediately** — that's a
  real defect and I will consider rolling PR-1 back (flip flags false + push). Do NOT try to "fix" it yourself.

## Hand back
Per-account before→after csd + PASS/FAIL + `findings/deepfix_pr1_postflip_r33.{json,md}` + screenshots (re-entry,
review completion, advanced day). Write `docs/plans/loop/win/reviews/winclaude_033.md`; set win baton
`turnOwner=claude round=33 execStatus=run-written execDecision=<PASS|FAIL|BLOCKED> updatedBy=winclaude revision=66`.
