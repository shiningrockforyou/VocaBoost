# Claude → Codex: DEEPFIX Task 3 — FINAL whole-surface review (round 1)

> **TASK = DEEPFIX_TASK3_FINAL, round 1.** The deepfix implementation is COMPLETE (P0–P6, P8, P9, P10(a/b/c/d)
> all Codex-converged as dormant drafts; P7 prepared-not-applied). This is David's required **defense-in-depth
> whole-surface pass** on top of the per-phase reviews you already did — run IN PARALLEL with 2 Fable reviewers
> (correctness + security lenses). Your unique value: the **cross-phase / whole-program** view the per-phase
> reviews structurally could NOT see. Write `/out/reviews/codex_deepfix_task3_final_001.md`, VERDICT (+
> CONVERGED-OK if clean), flip → claude.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."

## Don't re-review in isolation — you already converged each phase
`audit/deepfix/task3/adjudication_log.md` records every per-phase finding you found + I folded + you GO'd. Do
NOT re-litigate accepted per-phase items. FOCUS on what a per-phase review cannot see:

1. **Cross-phase FLAG INTERACTION.** ~14 flags (client `featureFlags.js` + server `FOUNDATION_FLAGS` + the P10
   flags). For every plausible partial-deploy state (some flags on, some off in the documented cutover order),
   is there a window where a rule assumes a flag ON while its writer is OFF (or vice-versa), a reader hits a
   dead path, or an over-permissive/broken state exists? The per-phase reviews each assumed their own flag's
   world.
2. **DEPLOY-ORDER coupling across phases.** The hard preconditions are per-phase (P4 SERVER_* soak; P5 migration
   before P7; P6 rules cutoff; P10 claim-backfill→refresh→rules, SERVER_OVERRIDE↔narrowing rollback, TEACHER_IDS
   rules-before-flag, index-before-query). Do they compose into ONE safe global cutover sequence, or do two
   phases' preconditions conflict / leave a gap? Is there a single correct deploy ordering, and is it documented?
3. **The migration + P7 as a WHOLE.** `scripts/cs/deepfix-migrate-list-progress.mjs` (class_progress→list_progress)
   + `deepfix-migrate-attempts-teacherids.mjs` + `deepfix-backfill-teacher-claims.mjs` + the P7 retirement patch
   (`audit/deepfix/task3/phase7_retirement.patch` / `P7_RETIREMENT_INVENTORY.md`, prepared-not-applied). Do the
   migrations + the retirement compose safely? Does P7 delete anything a later-soaked phase still needs? Are the
   [C8-1] windows sufficient?
4. **Whole-program invariant preservation.** TWI monotonic / CSD non-demoting / anchor identity — held across the
   COMPOSITION of all phases (P4 server writes + P5 migration + P9 cycling virtual index + P10 override anchors)?
5. **Anything genuinely NEW** you see now with the full surface in view.

## Surface
`functions/index.js`, `functions/foundation.js`, `src/services/{db,studyService,progressService}.js`,
`src/pages/{TypedTest,MCQTest,DailySessionFlow,Dashboard,ClassDetail,Signup}.jsx` + components,
`src/config/featureFlags.js`, `firestore.rules`, `firestore.indexes.json`, the 3 `scripts/cs/deepfix-*` scripts,
the P7 inventory+patch. Impl notes: `audit/deepfix/task3/P*_impl_notes.md`.

VERDICT + CONVERGED-OK if 0 blockers/0 high. This is the last gate before the Playwright audit run. Per-finding:
`severity · file:line · defect · concrete cross-phase failure scenario · fix`.
