# BRIEF — ntf26-grader-fix: close the "answer"-batch schema-confusion exploit in the typed grader
2026-08-04 · orchestrator → implementer (OPUS — live-path grading for 947 students) · ledger:
`_ledgers/ntf26-grader-fix-fold-ledger.md` · David directed the fix 2026-08-04 ("fix the prompt").
COMMITTED-NOT-DEPLOYED: no deploy in this fold; it rides `functions-deploy-engine` (David executes).

## The measured defect (assessment 2026-08-04 — do not re-derive, but DO read it)
Read `NEED_TO_FIX.md` item 26's "ASSESSMENT COMPLETE" block + evidence
`docs/plans/deepfix2/evidence/ntf26-grader-leniency-{baseline,round2}.json` (promptSha 153ba85f92a24caf).
Summary: the grader rejects every single-word wrongness class AND every uniform-garbage batch tested
(20× "test"/"asdf"/"idk"/"."/"몰라" → 0/20). The ONLY failure: **≥~10 identical rows of "answer" (or
"answer1") → ALL marked correct, 3/3 runs** (2× and 5× reject; 10× and 20× flip). Mechanism: at scale,
`"student": "answer"` reads as placeholder/template data, and "Default to CORRECT" resolves the
ambiguity wrong. The regression suite grades SINGLES ONLY, so it could never catch this.

## The fix — three legs, all in this fold

### Leg 1 — prompt hardening (functions/index.js, the `systemMessage` at ~:1356-1437; verify before edit)
SURGICAL. The false-reject history (commit 0992f5f) means the Korean-acceptance framing, rules 1/2/4,
and all existing examples stay BYTE-IDENTICAL. Add exactly two things:
1. In `<rules>`, after rule 4 (or as a short standalone line before "Everything else is CORRECT"):
   a statement that the `student` field is ALWAYS the literal text the student typed — never a
   placeholder or template value — and generic filler like "answer" / "test" / "idk" is rule-3 WRONG
   even when many rows contain the same text.
2. In `<examples>`, ONE worked WRONG example of the exploit shape (e.g. Word: vitriolic | Student:
   answer → WRONG with a 1-2 sentence student-facing reasoning). This is rule 3's FIRST worked
   example — mirror the formatting of the existing 4 WRONG examples exactly.
Wording is yours to draft well; the two content requirements above are law. Nothing else in the
prompt changes — the ledger carries a byte-diff row proving the edit is add-only outside those spots.

### Leg 2 — regression harness batch mode (scripts/grader-regression.mjs)
The harness currently grades one word per call. Extend it (keep existing behavior + fixture intact):
- Add a BATCH section: build one call with N rows sharing one student string (same shape as the
  probe scripts — `Grade exactly N words...`). Cases, each RUNS times:
  (a) 20× "answer" expect ALL-wrong · (b) 10× "answer" expect ALL-wrong · (c) 20× "answer1" expect
  ALL-wrong · (d) MIXED: 10 rows "answer" + 10 rows GENUINE-correct answers (use the Codex-r35
  fixture's known-good pairs + obvious correct KO translations) expect the 10 filler wrong AND the
  10 genuine CORRECT (no collateral over-tightening) · (e) 20× genuine-correct rows (all different,
  correct) expect ALL-correct (batch positives stay green).
- Keep all 9 existing single cases. Exit non-zero on any false-accept OR false-reject, as today.
- Add `EVIDENCE_OUT` (default `docs/plans/deepfix2/evidence/ntf26-grader-fix-postfix.json`): write a
  JSON with per-case verdict arrays + the extracted promptSha, so the gate can re-derive every number
  (never hand-type scores into the ledger — cite this file).
- The word bank for batches: reuse the 20-word bank from the probe (copy it in; it is in
  `evidence/ntf26-grader-leniency-baseline.json` → singles/batches context and in the scratchpad
  probe source quoted in the assessment; keep word/english/korean triples identical so pre/post
  comparisons are apples-to-apples).

### Leg 3 — defense-in-depth pre-AI heuristic (functions/index.js, gradeTypedTest)
Before the AI call (with the existing blank/self-ref pre-filters; verify their real location first —
the entry cites ~:168-190 and the assembly around :1310-1340): group non-blank `answersToGrade` rows
by normalized response (trim + lowercase); if ONE identical value spans **≥ 8 rows**, mark THOSE rows
`isCorrect: false` pre-AI with student-facing reasoning in the existing reasoning style (e.g. "You
typed the same answer for every word. Write what each word means."), and send only the remaining rows
to the AI. Absolute threshold, NO percentage leg — the model flips at ~10 identical rows regardless of
test fraction, and no genuine student writes the same non-blank answer for 8 different words (a list
can legitimately have 2-4 same-translation synonyms; never 8). The heuristic must:
- run AFTER blank/self-ref filters (those rows keep their existing handling);
- count rows by the normalized string, not require the whole test be identical;
- flow its results through `finishGrading` exactly like blank/self-ref results do (same shape);
- log via the existing `logger.info` pattern (count only, no answer text beyond the normalized string).
NOTE the engine typed leg consumes the same grader (`functions/reviewV2/typedGrading.js:144` →
`gradeTypedTest.run`) — verify your edit sits on the shared path so both legs are covered, and that
the run-wrapper's contract (what typedGrading passes/expects) is not broken by pre-AI results.

## Verification (all in this fold, evidence-first)
1. BEFORE any edit: re-run the BASELINE exploit once to prove it still reproduces on your checkout —
   `RUNS=1` batch 20×"answer" via a scratchpad copy of the probe pattern (assessment evidence exists;
   this run pins YOUR tree). Key: `ANTHROPIC_API_KEY="$(cat /tmp/claude-1000/-app/fe422ae2-f0e2-4b80-974f-950b847a1e84/scratchpad/.grader-key)"` —
   the project's grader secret, already fetched read-only from Secret Manager; NEVER print it.
2. AFTER legs 1+2: run the extended harness (RUNS=3) → expect exit 0: all 9 singles green + batch
   (a)-(e) green. If (d)'s genuine half false-rejects, STOP and report — that is the over-tightening
   hazard, not something to prompt-tweak past silently.
3. Leg 3 is NOT exercised by the harness (it calls the API directly, not gradeTypedTest). Add a pure
   node fixture `scripts/deepfix2/ntf26-heuristic-fixtures.mjs` testing the grouping function in
   isolation (export it or reproduce its logic via extraction — prefer exporting a pure helper from
   index.js if the file's conventions allow; if index.js is not import-safe under plain node, extract
   the helper into a small pure module functions/ can require) — cases: 8 identical → all 8 wrong;
   7 identical → untouched; 8 identical among 30 → only those 8; case/whitespace variants group;
   blanks excluded; 4+4 two different groups → untouched. Plus ONE mutant (threshold 8→2) killed by
   the 7-identical case… (m2) drop normalization → killed by the variant case. Evidence JSON for the
   fixture run too (same never-hand-type rule).
4. Fold ledger from `scripts/deepfix2/FOLD_LEDGER_TEMPLATE.md`. This IS a closure/security claim ⇒
   the BYPASS-SET row enumerates the leniency classes (A-filler / B-plausible-EN / C-plausible-KO /
   D-unrelated / E-batch-filler / F-batch-plausible / mixed / positives / heuristic-bypass-via-
   variation e.g. "answer1","answer2",… — note the heuristic groups IDENTICAL strings only, so
   per-row-varied filler like answer1..answer20 is NOT caught by leg 3 and must be caught by leg 1's
   prompt fix: add batch case (f) 20× varied "answerN" expect ALL-wrong to the harness to prove it).
5. gate.mjs (`--plan` BEFORE edits, full run after). Known pre-existing reds (foreign NUMBERS/
   EVIDENCE rows vs audit/deepfix/task3 + 17_ + engine-lap-result + the cutover-b/c sha staleness
   from the df2-07 fold) — enumerate as out-of-footprint, do not chase.

## Constraints (law)
- Touch ONLY: `functions/index.js`, `scripts/grader-regression.mjs`,
  `scripts/deepfix2/ntf26-heuristic-fixtures.mjs` (new), a pure helper module if extraction is needed
  (functions/ side, name it plainly), the two NEW evidence JSONs, and your fold ledger. No other
  files. No `.claude/*`, batons, WORK_QUEUE, RESUME, change log. NO COMMIT, NO staging, NO deploy,
  no `firebase` commands.
- The API key: read from the scratchpad file path above at run time only; never echo/print/persist
  it elsewhere; do not commit anything containing it (the evidence JSONs must not embed it).
- Spend: harness+fixture runs ≈ low hundreds of Haiku calls max — within the authorized testing
  budget. Do not loop unbounded; RUNS=3 ceilings.
- `temperature: 0.1` and the model id stay as-is (this fold fixes the prompt, not the sampling).
- WSL: no vite, no build; plain node only.

## Report back
Per-leg outcome; the FULL new prompt text quoted; harness results table (pre-fix exploit repro +
post-fix all-green) with evidence paths; heuristic fixture results + mutants; every judgment call;
anything that surprised you. Your report is a CLAIM — an independent OPUS auditor re-executes the
evidence before the orchestrator trusts it.
