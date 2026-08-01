# WSL → WinClaude round 67: PROGRAM BRIEFING — DEEPFIX2 planning is DONE; implementation is next

**This is a BRIEFING round: read → ack → standby. No runs, no deploys, no edits.**

## Situation
1. **DEEPFIX2 planning CONVERGED and was PRESENTED to David 2026-07-27** after 8 verification rounds
   (Codex r44-r52 + internal Fable/Opus panels; final verdicts: Codex r52 "PRESENTABLE: YES", final panel no
   blockers). Binding decisions = the ledger `docs/plans/deepfix2/11_...FOLD_PLAN.md` §1, **R2-1..R2-38**.
   Plan of record = `docs/plans/deepfix2/02_TASK_LIST.md` (v5); design spec = `10_REVIEW_GRADUATION_REDESIGN.md`.
2. **What the program ships (one sentence):** ONE universal day-structured model for every class — review gate
   ON at 92%, teacher-set 60/30 rotation queue, four server-written `review*` labels driving priority/graduation,
   full-history label backfill — delivered as **THE LAUNCH (DF2-14): dark-deploy everything `enabled:false` →
   verify → backfill → ONE audited cohort-wide flip of `system_config/review_v2.enabled`** (David executes the
   flip), 7-study-day monitored soak, kill switch = the same flag.
3. **The pinned core rule stands**: `0ddbb34` (completeSession/resolveListProgress) stays untouched until the
   authorized pin-move INSIDE DF2-14's dark train. Nothing is deployed until the five-stage gates pass:
   (1) implementation auth → (2) dark build → (3) post-build 25WT product rehearsal → (4) David's backfill go →
   (5) David's activation go.

## What YOU will be asked to run, in order, when implementation starts
- **Emulator rules matrix** for the new artifact `audit/deepfix/task3/firestore.review_v2.rules` (Java runtime).
- **Dark-train deploys**: functions + hosting + rules + indexes, all surfaces `enabled:false` (stage 2), then the
  deploy-set verification reads.
- **25WT product-rehearsal matrices** (stage 3): the extensive Playwright suite (dual-class oracle incl. R2-38
  mixed-posture cases, wall/retake loops, force-pass live-dissolve, recovery/expiry, old-bundle fixture, streak
  fixtures).
- **Session-save commits/pushes** at milestones, as in round 66.
- NOT yours: Track A/B admin-SDK scripts (WSL runs those with the service account), the fireadmin config write
  and the flip (David personally).

## This round's deliverable
Write `docs/plans/loop/win/reviews/winclaude_067.md`: (1) ack the briefing; (2) report your current runtime
versions (node, firebase-tools, Java, Playwright browsers) and any drift/breakage since round 66 — we want env
problems surfaced NOW, not at stage 2; (3) confirm git/deploy state unchanged (HEAD, functions pins). Then flip
the baton: turnOwner=claude, execStatus=review-written, execDecision=ACK, revision=134.
