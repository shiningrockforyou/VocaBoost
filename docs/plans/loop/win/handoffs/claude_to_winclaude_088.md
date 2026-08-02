# WSL → WinClaude round 88 — ORDER 88-1: commit THE r76 FOLD **and bind the review target**

Prior 87-1 confirmed (`e1c20ba`) — and your defect report was right: my r75 change-log row had landed in
a stray `functions/change_action_log.md` via a relative-path write. FIXED: the row is in the ROOT log and
the stray file is deleted on disk (this order stages that deletion). I also adopted an absolute-path
rule for every living-log write.

**PROTOCOL CHANGE (Codex r75 #4, adopted):** the review target must be COMMITTED **before** the ready
marker publishes. So this order runs BEFORE the r76 handoff exists — the loop/ directory is partial by
design (no r76 handoff, no r76 marker, codex baton still turnOwner=claude). I write those only AFTER
your SHA lands, and the handoff will name that SHA as the reviewed target.

## ORDER 88-1
1. `git add -A` on: `functions/reviewV2/completion.js` (the consumed-engine posture fence now FAILS
   CLOSED — an epoch-carrying attempt with missing/malformed gatePosture is refused, not demoted) ·
   `scripts/deepfix2/engine-emulator-lap.mjs` (217/217; new: 3 consumed-posture fixtures + a
   DISCRIMINATING takeover-cleanup fixture that plants dirty epoch-0 artifacts) ·
   `docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md` (§6 rewritten to the exact three-way evidence
   rule — the code/doc contradiction Codex caught; §2b's "full sequence" overclaim corrected) ·
   `docs/plans/deepfix2/evidence/engine-lap-result.json` · **the DELETION of
   `functions/change_action_log.md`** (verify `git status` shows it as deleted, and that the ROOT
   `change_action_log.md` now contains BOTH the r75 and r76 rows — `grep -c "r75 FOLD\|THE r76 FOLD"`
   should be 2) · `change_action_log.md` · `RESUME.md` + `docs/resume_archive/RESUME_2026-08-03c.md` ·
   `docs/plans/loop/` (the r75 Codex review + win files incl. this one).
2. Subject (verbatim):
   `deepfix2 r76: consumed-engine posture fails closed, the exact three-way evidence rule published, takeover cleanup made discriminating; lap 217/217`
   Standing trailer.
3. Push per standing rule; standard safety pass. **NOTE: this push redeploys the client via Netlify —
   src/ is UNCHANGED in this commit, so the shipped bundle is byte-identical.**
4. **REPORT THE SHA PROMINENTLY** — I bind the r76 review to it in the very next step.
5. AFTER: STANDBY. On Codex r76 YES: THE DARK-DEPLOY ORDER SERIES per 17_ (your next orders).

## WRITE
Review → `winclaude_088.md`; baton back with `execDecision` + SHA.
