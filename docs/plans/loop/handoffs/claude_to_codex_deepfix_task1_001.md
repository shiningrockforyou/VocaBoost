# Claude → Codex: DEEPFIX Task 1.3 — your OWN independent root-cause issue investigation

> **TASK = DEEPFIX_TASK1_ISSUES.** This is part of David's commissioned deep root-cause audit program
> (`/repo/audit/deepfix/MASTER_TASK_PLAN.md`, Task 1 step 1.3). This is NOT a plan review — it is an
> **independent investigation**: produce YOUR OWN extensive, evidence-backed issue list, in parallel with two
> other independent investigators (Claude's own list + a fable agent's list) whom you must NOT try to see.
> Divergence between the three is the signal we want. Write your deliverable to
> `/out/reviews/codex_deepfix_task1_issues_001.md`
> (my-side `docs/plans/loop/codex_reviews/codex_deepfix_task1_issues_001.md`), then flip turnOwner→claude.

## THE BINDING RULE (David, verbatim): "always verify all claims by all agents and Codex results. Never trust blindly. Always verify."
Every issue you list MUST carry EVIDENCE traced to real code (`file:line` under `/repo`) or real data. Tag each
claim: `[V-code file:line]` (you opened it and confirmed — cite the line), `[V-log]` (from the verbatim TA chat
log), `[V-doc <which>]` (a context doc asserts it but you did NOT code-trace it — mark needs-verification),
`[?]` (plausible, unverified — investigation target), `[spec]` (your hypothesis). **The working tree has an
UNCOMMITTED fix** in `src/services/studyService.js`, `src/components/DailySessionFlow.jsx`, `src/pages/Dashboard.jsx`
— so where a context doc cites a `file:line`, OPEN the file and report what the code says NOW, not what the doc
claims. Cite current code.

## INPUTS (read these under /repo)
1. `/repo/audit/deepfix/context/TA_CHATLOG_2026-06-30_to_07-13.md` — verbatim TA support chat log (PRIMARY SOURCE; much is Korean).
2. `/repo/audit/deepfix/context/SESSION_CONTEXT_2026-07-13.md` — state digest (structural flaws A & B, fix/audit status, env truths, file map). A MAP, not the authority — cross-check against code.
3. `/repo/docs/audits/TA_CHATLOG_TRIAGE_2026-07-13.md` — triage of the chat log (A/B/C, N1–N5).
4. `/repo/NEED_TO_FIX.md` — issue registry (#1,#1b,#1c,#2,#3,#4,#5,#6,#7,#8,#9,#10,#11,#12,#13,#14,#15).
5. `/repo/SUPPORT_RUNBOOK.md` — CS event log (CS-2026-07-13 a–f = today; plus earlier).
Plus your full read access to `/repo` (`src/**`, `functions/**`, `firestore.rules`, `scripts/**`, `docs/**`).

## THE PHILOSOPHY (frame every issue against this — David, verbatim)
Figure out what the app SHOULD do if it were a theoretically efficient, effective, well-written app, and frame
each issue as a deviation from that ideal — so fixes CONVERGE toward the ideal rather than adding another
responsive patch / tech debt. Where several symptoms share ONE structural root, GROUP them under that root.

## DELIVERABLE — `/out/reviews/codex_deepfix_task1_issues_001.md`
Structure it however best expresses YOUR analysis, but include:
- A short "ideal app" north-star framing (the properties you measure against).
- An EXTENSIVE issue list. For EACH issue: (a) symptom(s) + chat-log/data citation where one exists; (b) EVIDENCE
  (tagged, `file:line` where traced); (c) suspected layer (client / service / Cloud Function / rules / data model
  / product-UX); (d) related `NEED_TO_FIX #`; (e) ideal-app convergence direction; (f) open questions / what
  would pin the root cause.
- GROUP by structural root cause where symptoms share one.
- Explicitly CALL OUT anything the context docs under/over-state that your own code reading contradicts — that
  independent, code-grounded correction is the highest-value output.
- A short OUT-OF-SCOPE / non-VocaBoost / resolved-by-design section.

Be thorough and skeptical; an honest `[?]` beats an untraced root-cause assertion. This is one of the rare
intentionally-BROAD asks — budget for it (a genuine investigation, not a surgical claim check).

## Report footer
End the file with a machine-readable line:
```
DEEPFIX-TASK1-ISSUES done: issues=<n> structural-roots=<n> doc-contradictions=<n>
```
Then flip `turnOwner→claude` (set `codexStatus:"reviewed"`, `codexReview` to this file's /out path). This is an
investigation, not a GO/NEEDS_FIXES gate — no verdict needed; Claude will H1-verify and consolidate your list
with the other two.
