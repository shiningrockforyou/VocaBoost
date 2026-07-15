# Claude → Codex: DEEPFIX Task 3 — review the P6 rules-cutoff DRAFT (RISKIEST phase)

> **TASK = DEEPFIX_TASK3_P6, round 1.** FIX_PLAN Phase P6 (FND-4) — the rules cutoff ending client write-authority
> over progress/attempts/role — as a REVIEWED DRAFT (deploy-gated, David-run after P3-P5 deploy + soak). A wrong
> rule locks out live 26SM students OR leaves a forgery hole. Rules can't run here → correctness rests on tracing +
> the rules-test matrix. Diff: `/repo/audit/deepfix/task3/phase6_diff.patch`. Write
> `/out/reviews/codex_deepfix_task3_p6_001.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## BINDING RULE (David): trace every rule to the app write path it governs. TWO failure modes are equally bad:
## OVER-DENY (locks out live students) and UNDER-DENY (leaves a forgery/escalation hole).

## Read
- The diff + `/repo/audit/deepfix/task3/P6_impl_notes.md` (the R1-R28 test matrix + uncertainties §5 — ADJUDICATE).
- Spec: `/repo/audit/deepfix/task2/FIX_PLAN.md` Phase **P6** (+ F4-3 role split + the provisioning path + preconditions).
- The foundation it relies on: `/repo/functions/foundation.js` (`resolveListProgress`, `resetProgress` — the server
  writers the rules now require) + P4's client cutover (routes progress/reset/challenge server-side, behind flags).
- Current `firestore.rules` + `src/pages/Signup.jsx` + `functions/index.js` (`provisionTeacher`, dormant).

## Verify (priority)
1. **R1 OVER-DENY (the load-bearing risk):** the agent flags that P4's FAIL-OPEN hydration fallback (a
   `resolveListProgress` outage → client create-on-miss/recon write) now fails CLOSED under the client-progress-write
   deny — stranding live 26SM students on a resolver outage. Is this real? Is the recommended fix (extend the C6-2
   denial handler to `getOrCreateClassProgress` pre-deploy) correct + sufficient? Any OTHER path that entry-time
   create-on-miss / reconciliation used to write client-side that P6 now denies?
2. **Under-deny / holes:** are the C-28 (role self-write), C-29 (attempt create/answers-update/owner-delete) holes
   ALL closed? Does `create:if false` on attempts break any LEGITIMATE current client path (all attempt creation must
   go through the server writer — confirm P4/P3 route it)? Is the `study_states`/`session_states` teacher-write branch
   (kept for reviewChallenge until P10) still needed + safe?
3. **Role split (F4-3):** create=student-only, update excludes role/roleProvisioning, provisioning callable — does it
   break signup (Teacher radio removed) or legit teacher creation? Is `provisionTeacher` (invite redemption) safe +
   truly dormant (`TEACHER_PROVISIONING_ENABLED=false`)?
4. **Preconditions + U3** (`SERVER_REVIEW_MARKER` must be ON or Day-2+ empty-review breaks) + R7 (pre-existing forged
   teacher roles → F-4c sweep at deploy) — adjudicate.

Per-finding: `severity · location (rules:line / plan §) · problem · evidence · fix`. VERDICT + CONVERGED-OK if 0/0.
GO = the cutoff is safe (no over-deny of a live path, no remaining hole) to hand to David for the emulator matrix.
