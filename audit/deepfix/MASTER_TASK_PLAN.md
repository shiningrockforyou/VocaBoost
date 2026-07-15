# MASTER TASK PLAN — VocaBoost Deep Root-Cause Audit → Fix → Validate ("deepfix")

**Commissioned by David, 2026-07-13** (verbatim task list folded in below). Everything for this program lives
under `audit/deepfix/`. This plan is written to be executed across MULTIPLE fresh sessions — each task ends
with a save-state so the session can be cleared safely at any task boundary.

**Mission.** Stop patching symptoms. Identify, at the root, what the issues are (given the 2026-07-13
developments + the TA chat log) and fix them the way a theoretically efficient, effective, well-written app
would work — proposing fixes that CONVERGE toward that ideal rather than responsive fixes that add tech debt.
Then implement, then design + build + run Playwright audits over the whole implementation, then report.

---

## H. HARD RULES (bind EVERY task, EVERY step — restate in every agent prompt)

- **H1 — VERIFY EVERYTHING (David, verbatim: "always verify all claims by all agents and Codex results.
  Never trust blindly. Always verify.").** No agent finding, Codex finding, consolidated list, plan comment,
  implementation-review claim, or test result is acted on until the orchestrator has traced it to real code
  (`file:line`) or real data (read-only Firestore) personally. Reject wrong claims WITH EVIDENCE; require
  Codex to concede or escalate (per `docs/plans/loop/lib/CLAUDE_ROUND_SOP.md` §2). This applies symmetrically
  to the orchestrator's own claims. Session precedents proving why: Codex RAD-3 refuted by
  `progressService.js:236` (conceded); a 12-student sweep result reduced to 3 real cases on validation; a
  RESUME claim of "Codex prepped" contradicted by the actual NOT_READY report.
- **H2 — No app-source change** until the governing plan has **Codex GO** AND **David's go-ahead**. David's
  2026-07-13 commissioning of this plan constitutes CONDITIONAL go-ahead for Task 3/Task 5 implementation
  *after their plans converge* — but if converged scope materially differs from what this plan describes,
  re-confirm with David before touching `src/**`. Reverting counts as a change.
- **H3 — Owner deploys.** Claude never builds/deploys to live. Live (`https://vocaboostone.netlify.app`) has
  ACTIVE 26SM students. All implementation is LOCAL-ONLY on `main`, uncommitted, until David says otherwise.
- **H4 — Sandbox only** for audits/tests: `lsr_*@vocaboost.test` students, `25WT` classes, cloned lists.
  NEVER 26SM except genuine CS (read-only first; derived/verified writes only; `data-integrity-sweep` before
  + after; log to `SUPPORT_RUNBOOK.md`).
- **H5 — Logging + save-state.** Code changes → `change_action_log.md`. CS/data → `SUPPORT_RUNBOOK.md`. At
  every task boundary: write `audit/deepfix/reports/TASKn_REPORT.md`, save agent outputs/transcripts into the
  task folder, rotate `RESUME.md` (copy to `docs/resume_archive/RESUME_<date>.md`, then update).
- **H6 — Environment truths.** This WSL env CANNOT run Vite/Playwright (`/app` is a 9p Windows mount with
  win32 node_modules). Admin/Firestore scripts DO run from WSL (`NODE_PATH=/app/node_modules node …`).
  Playwright/dev-server execution happens from Codex's Windows env (needs UNSANDBOXED launches) or by David.
  **Codex prep verdict = NOT_READY: Firestore Admin egress from Codex's env timed out** — a bounded
  sandbox-read preflight MUST pass in whichever env runs the harness before any audit run (Task 6 gate).
- **H7 — Verify errors via SCREEN, never assume** (Task 6, David verbatim): when a Playwright run errors,
  capture and look at the screenshot/page state before hypothesizing.
- **H8 — Baton discipline.** All Codex interaction runs through the baton system (§B below). Codex reviews are
  written artifacts (`docs/plans/loop/codex_reviews/`) — read them fully; never act on the baton note alone.
- **H9 — Agent outputs are files.** Every agent writes its deliverable to the specified path under
  `audit/deepfix/taskN/` (and returns a short summary). No deliverable lives only in a message.
- **H10 — Scope guard.** No fix may regress the converged Phase-1 review-only fix (uncommitted, in the working
  tree — diff at `context/phase1_current_uncommitted_fix.diff`) without explicitly superseding it in a
  converged plan. The working tree IS the current source of truth; do not `git checkout/restore` anything.
- **H11 — Live CS interrupts.** Deploy is deliberately ON HOLD (David 2026-07-13: "we'll just fix as requests
  come in"), so new #11/#12-class tickets are near-certain DURING this program. Handle them without derailing:
  diagnose read-only first, reuse `scripts/cs/*` patterns (list-end finisher → advance to next list via
  primaryFocus, cf. `batch-advance-listend.mjs`; carry-miss → `reconcile-ascent-carry.mjs` pattern; the
  63-remaining advance list is `context/next-list-by-class_2026-07-13.md`), sweep before/after writes, log a
  `CS-YYYY-MM-DD` entry in `SUPPORT_RUNBOOK.md`, then return to the interrupted task step.
- **H12 — Never commit** `audit/deepfix/context/transcripts/` (47MB session JSONLs) or any secret-adjacent
  artifact. Nothing in this program is committed/pushed at all without David's say-so (standing rule).

## C. CONTEXT — read these before starting any task
1. `audit/deepfix/context/SESSION_CONTEXT_2026-07-13.md` — the state digest (structural flaws A/B, fix status,
   audit status, CS actions, environment truths, file map). **Start here.**
2. `audit/deepfix/context/TA_CHATLOG_2026-06-30_to_07-13.md` — David's verbatim TA chat log (primary source).
3. `docs/audits/TA_CHATLOG_TRIAGE_2026-07-13.md` — the triage of that log (A/B/C/N1-N5 classification).
4. `NEED_TO_FIX.md` — issue registry (#11, #12, #13, #14, #15 + older #1/#1b/#1c/#2/#3/#4/#5/#8/#10 etc.).
5. `docs/plans/PLAN_review_only_day_completion.md` + `context/phase1_current_uncommitted_fix.diff` — the
   converged #11 fix (code state: built, Codex GO, uncommitted, NOT deployed).
6. `docs/plans/PLAN_reviewonly_playwright_audit.md` + `audit/playwright/REVIEWONLY_HARNESS.md` (+ the three
   `audit/playwright/lsr_reviewonly*.mjs`) — converged audit design + built-but-never-run harness.
7. `docs/plans/loop/x/plan.md` — the cycling ("start over") capstone design (GO'd earlier).
8. `SUPPORT_RUNBOOK.md` CS-2026-07-13 a–f — today's interventions + the known-benign `reviewNoNewPass` artifact.
9. Full session transcript (47MB, SEARCH don't read):
   `audit/deepfix/context/transcripts/session_2026-07-12_to_13_full.jsonl`.

## B. THE BATON SYSTEM (Claude ⇄ Codex loop) — operational reference
- **State token:** `docs/plans/loop/baton.json`. Claude flips `turnOwner:"codex"` with a `handoff` file
  (`docs/plans/loop/handoffs/claude_to_codex_<slug>_NNN.md`) + `taskId`/`round`/`note`; Codex writes its review
  to `docs/plans/loop/codex_reviews/<name>.md`, sets `codexDecision` (`GO`/`NEEDS_FIXES`) and flips
  `turnOwner:"claude"` (or `done`).
- **Self-wake:** after every flip, launch the watcher in the background:
  `bash docs/plans/loop/lib/baton-watch.sh /app/docs/plans/loop 3600 15` (run_in_background). It exits when the
  baton returns → you are re-invoked. Timeout ⇒ state `stalled` ⇒ STOP and tell David (don't relaunch).
- **Round SOP:** `docs/plans/loop/lib/CLAUDE_ROUND_SOP.md` — the 3-agent audit runs ONCE on the initial draft;
  every later round is Codex + orchestrator verification only. Verify every finding (H1), fold only
  verified-true ones, respond per-finding ACCEPTED/REJECTED-with-evidence. Convergence = Codex
  blockers=0 & high=0 on an unchanged artifact (cleanStreak≥2 per SOP; a single clean GO on a final delta round
  has been accepted in practice — use judgment, record which standard was applied). Backstops: maxRounds 8;
  deadlock (same finding re-raised 2× after evidence-backed rejection) ⇒ STALEMATE.md + stop; 3 rounds without
  blocker/high decrease ⇒ stop.
- **Cost discipline:** Codex gets SURGICAL asks (verify THESE claims at THESE file:lines; judge THIS delta) —
  never "search the repo". Keep later-round handoffs terse deltas.
- **ORDERING NOTE:** the SOP's default pattern (3-agent audit parallel with Codex round 1) is OVERRIDDEN by this
  program's numbered task steps wherever they differ (e.g. Task 2 runs the Codex loop to GO FIRST, then the
  three fable verifiers, then a second Codex loop — David's mandated sequence). Follow the numbered steps.
- **Path convention for handoffs:** address Codex with container/repo paths — repo files as
  `/repo/<repo-relative-path>`, its review output as `/out/reviews/<name>.md` — and note the my-side equivalent
  (`docs/plans/loop/codex_reviews/<name>.md`) in parentheses. See any existing handoff in
  `docs/plans/loop/handoffs/` for the template.
- **Codex environment:** runs in the WINDOWS repo working tree (sees uncommitted changes), read access to the
  whole repo; has `scripts/serviceAccountKey.json` + Playwright browsers; browser/dev-server launches need
  unsandboxed execution; **Firestore egress unproven (NOT_READY)** — see H6.

## A. AGENT CONVENTIONS
- "Fable agent" = `Agent` tool, `subagent_type: "general-purpose"`, `model: "fable"`, `run_in_background: true`
  unless the result gates the immediate next step. Explore-type readonly agents may be used for pure searches.
- Fresh agents have NO conversation memory — every prompt must name the context files (§C) explicitly and
  restate H1 (and any other rule the agent could violate).
- Every agent prompt specifies: inputs (exact paths), deliverable (exact output path under
  `audit/deepfix/taskN/`), required evidence format (`{claim, evidence: file:line or data, confidence}`), and
  the instruction that its final message is a summary while the FILE is the deliverable.
- Independent reviewers must NOT see each other's outputs (divergence is signal). Consolidators explicitly DO.
- The orchestrator (main session) NEVER outsources H1 verification — verifying is not delegable to the agent
  being verified.
- If an agent dies, stalls, or returns unusable output: relaunch ONCE with a tightened prompt; if it fails
  again, do that slice yourself and note the failure in the task report.

---

# THE TASKS

## TASK 1 — Deep analysis of issues
**Goal:** an extensive, verified list of issues to investigate + an executed root-cause investigation, with the
"ideal-app convergence" philosophy — then a completion report. Workspace: `audit/deepfix/task1/`.

1.1 **Orchestrator list.** From §C context (esp. the TA chat log + triage + NEED_TO_FIX + today's findings),
    write YOUR OWN extensive issue list → `task1/issues_claude.md`. Include for each: symptom(s), evidence,
    suspected layer, related NEED_TO_FIX #, open questions.
1.2 **Fable agent #1 (independent list).** Feed it EXACTLY: `context/TA_CHATLOG_2026-06-30_to_07-13.md`,
    `context/SESSION_CONTEXT_2026-07-13.md`, `docs/audits/TA_CHATLOG_TRIAGE_2026-07-13.md`, `NEED_TO_FIX.md`,
    `SUPPORT_RUNBOOK.md`, + the transcript JSONL path (**grep/search ONLY — its prompt must say "do NOT Read
    this 47MB file; it will overflow your context"**). Do NOT show it `issues_claude.md` (independence — added
    per the reviewer-independence norm). It writes `task1/issues_fable1.md`. It has full repo read access —
    require file:line/data evidence per issue (H1 restated in prompt).
1.3 **Codex independent investigation (baton).** Handoff `claude_to_codex_deepfix_task1_001.md`: point Codex at
    the SAME context files (repo paths) + its own read access to the repo; its goal = its OWN extensive issue
    list + investigation, written to `codex_reviews/codex_deepfix_task1_issues_001.md`. Surgical framing but
    investigation-open (this is one of the rare intentionally-broad Codex asks — budget accordingly). Copy its
    output to `task1/issues_codex.md`.
1.4 **Fable agent #2 (consolidator + investigation planner).** Inputs: `issues_claude.md`, `issues_fable1.md`,
    `issues_codex.md`, + the same §C context. Deliverables: (a) `task1/CONSOLIDATED_ISSUES.md` — deduped,
    prioritized, each issue tagged {verified-evidence | plausible-unverified | speculative}; (b)
    `task1/INVESTIGATION_PLAN.md` — an agent investigation plan to identify, at the ROOT, what the issues are
    and how they ought to be fixed. **Philosophy clause (David verbatim): figure out what the app SHOULD be
    doing if it were a theoretically efficient, effective, well-written app, and propose fixes that converge
    toward that ideal — NOT responsive fixes that add tech debt.**
1.5 **H1 gate.** Orchestrator verifies every consolidated issue + every investigation-plan premise against
    code/data. Corrections in-place with a `VERIFICATION` annotation per item. Reject speculative items or
    demote them to explicit open questions.
1.6 **EXECUTE the investigation plan** (Task 2 presupposes "the investigation is complete"). Launch the
    investigation agents it defines (fable, parallel where independent), verify their findings (H1), and write
    `task1/ROOT_CAUSE_FINDINGS.md` — per issue: the actual root cause (or "not pinned + what would pin it"),
    the ideal-app behavior, and the convergence direction. Read-only throughout (no fixes yet).
1.7 **Save state + report** → `reports/TASK1_REPORT.md` (what was done, agent outputs, verification outcomes,
    rejected claims + why, the final verified issue set). Agent transcripts/outputs live in `task1/`.

## TASK 2 — Plan the fixes
**Goal:** one converged, phased fix plan. Workspace: `audit/deepfix/task2/`.

2.1 **Fable agent #3 drafts the plan** from `task1/ROOT_CAUSE_FINDINGS.md` + `CONSOLIDATED_ISSUES.md` + §C.
    Must define SANE PHASES for safe implementation (each phase independently shippable, testable, and
    reversible; explicit data-migration/flag strategy; explicit non-regression of the Phase-1 fix (H10) and of
    LIST_SCOPED_RECON reconciliation invariants — twi monotonic, csd non-demoting, anchor semantics). It must
    also cover David's feature request (list-linking + choice terminal + continuous next-list + start-over/
    cycling per `docs/plans/loop/x/plan.md`) as the forward design that REPLACES symptom-patching.
    → `task2/FIX_PLAN.md` (v1).
2.2 **Baton → Codex** for comments on the plan (surgical: judge phase-soundness, ordering, invariants, missed
    root causes; verify plan claims at named file:lines).
2.3 **Orchestrator adjudicates** (H1: verify each Codex comment against code before folding), folds
    verified-true ones, responds per-comment; **loop with Codex until GO/convergence** (per §B).
2.4 **Fable agents #4, #5, #6 verify the plan** — independent, parallel, no cross-visibility. Assign distinct
    lenses: (#4) correctness & data-integrity/migration; (#5) architecture & tech-debt-convergence (does it
    truly move toward the ideal app?); (#6) product/UX/rollout & operational safety (incl. CS/teacher surface,
    deploy sequencing with live students). Each writes `task2/plan_review_fableN.md`.
2.5 **Fold:** verify their comments (H1), fold verified ones into `FIX_PLAN.md`, record
    ACCEPTED/REJECTED-with-evidence per comment in `task2/adjudication_log.md`.
2.6 **Baton → Codex, loop until GO/CONVERGENCE** on the final plan.
2.7 **Save state + report** → `reports/TASK2_REPORT.md`. NOTE: implementation may start only per H2.

## TASK 3 — The implementation
**Goal:** the converged plan implemented, verified, converged. Workspace: `audit/deepfix/task3/`.

3.1 **Orchestrator implements** the plan (phase by phase, per the plan's own phasing). LOCAL-ONLY, uncommitted
    (H3). Log each phase to `change_action_log.md`. Keep a running diff artifact per phase →
    `task3/phaseN_diff.patch`.
3.2 **Fable agents #7, #8, #9 verify the implementation** (independent, parallel, lenses: correctness/data,
    security/authz, UX/edge-cases — mirroring the proven 3-agent pattern). They review the DIFF + real code.
    **Do NOT apply their suggested changes yet.** → `task3/impl_review_fableN.md`.
3.3 **Baton → Codex verifies the implementation** (surgical delta review vs the converged plan).
3.4 **Adjudicate ALL FOUR reviews together** (H1 on every claim), THEN implement the verified fixes; **continue
    the Codex baton loop until GO/convergence.**
3.5 **Final sweep: 3 MORE fable agents** (fresh, independent) over the final state; **share verified results
    with Codex** and converge on a plan for any remaining changes (apply if within scope, else record as
    follow-ups in the plan/NEED_TO_FIX).
3.6 **Save state + report** → `reports/TASK3_REPORT.md` (+ all diffs, reviews, adjudications in `task3/`).

## TASK 4 — Design the Playwright audits
**Goal (same process as Task 2, applied to audit design):** one converged audit design covering EVERY part of
the implementation. Audits run ALL AT ONCE, after all implementation is complete (David's directive).
Workspace: `audit/deepfix/task4/`.
- 4.1 Fable agent drafts `task4/AUDIT_DESIGN.md` — REUSE/extend the converged review-only audit design +
  built harness (§C-6) rather than restart; scenario table with UI oracle + Firestore data oracle per
  behavior; hybrid E2E/white-box split where UI routing can't reach a path; fail-closed certification with
  artifact binding (runId, git-dirty marker, resolved BASE, per-scenario sandbox triple, pre/post snapshots);
  local-only guards (H6); seeding strategy with mandatory pre-verifiers.
- 4.2 Baton → Codex comments → 4.3 adjudicate+fold (H1) → loop to GO → 4.4 three fable verifiers (independent
  lenses: coverage/false-pass, safety/isolation, drivability/flakiness) → 4.5 verify+fold → 4.6 Codex loop to
  GO/CONVERGENCE → 4.7 save state + `reports/TASK4_REPORT.md`.

## TASK 5 — Build the Playwright audit scripts
**Goal (same process as Task 3, applied to harness code):** the audit harness implemented per the converged
design. Workspace: `audit/deepfix/task5/`. HARNESS-ONLY code (never app source). Reuse
`audit/playwright/lsr_reviewonly*.mjs` + `lsr_ui.mjs`/`lsr_persona.mjs` primitives; address the build-manifest
caveats (A1-A3, injection timing, teacher default, dangling imports — see SESSION_CONTEXT §3).
- 5.1 orchestrator implements (mirroring 3.1) → 5.2 three fable verifiers (no premature acceptance) → 5.3
  Codex verify → 5.4 adjudicate-all, fix, Codex loop to GO → 5.5 final 3-fable sweep + Codex-shared closure
  plan → 5.6 save state + `reports/TASK5_REPORT.md`.

## TASK 6 — Run the Playwright audits
**Goal:** smoke → full run → all-clean certification. Workspace: `audit/deepfix/task6/`.
- 6.0 **Environment gate (hard):** (a) decide the RUNNER env (Codex Windows / David-run / other) — Codex's
  Firestore egress is UNPROVEN (NOT_READY); require a bounded sandbox-only Admin read preflight to PASS **in
  the runner env** first. Concrete gate: the runner must successfully complete a bounded read-only 25WT query
  — e.g. `node scripts/cs/data-integrity-sweep.mjs 25WT` (read-only by construction; from WSL prefix with
  `NODE_PATH=/app/node_modules`) or an equivalent one-doc `25WT` class read — returning real data within ~30s.
  Timeout/hang = gate FAILED = do not run; (b) `npm run dev` up + `http://localhost:5173` returns the SPA
  shell, CONFIRMED before any browser run; (c) `LSR_BASE_URL=http://localhost:5173`; import-time localhost
  guard active; sandbox identity guard active. NEVER live (H3/H4).
- 6.1 **Design efficient smoke tests** to verify script viability before the full matrix (cheapest scenario per
  mechanism: one E2E completion, one seed+pre-verify, one white-box gate case).
- 6.2 **On every error: verify via SCREEN (screenshot/page state) — never assume the cause (H7).** For each
  error's investigation+fix: **initiate and complete a baton loop with Codex until GO/CONVERGE** before
  applying the fix (harness-only fixes; batch per smoke wave per the audit-fix-loop protocol).
- 6.3 Full run: all matrices; fail-closed manifest; INVALID ≠ PASS; identity-bound; artifacts saved to
  `task6/` (+ `audit/playwright/findings/`).
- 6.4 Save state + `reports/TASK6_REPORT.md` (runs, errors, screenshots, fixes, final certification state).

## TASK 7 — Final report
- 7.1 `reports/FINAL_REPORT.md` — very detailed: per-task what was completed, what issues arose, verification
  outcomes, rejected claims, deviations from plan, what remains open (incl. deploy status — deploy remains
  David's action), risks.
- 7.2 `reports/FINAL_REPORT_PLAIN.md` — the same story for a human with limited technical understanding
  (what was broken, what students experienced, what we changed, how we know it works, what's left).

---

## S. SAVE-STATE PROTOCOL (every task boundary)
1. All agent deliverables + adjudication logs are files in `taskN/` (H9). Copy any critical agent-run output
   text VERBATIM into `taskN/` immediately when it arrives — `/tmp/.../tasks/*.output` transcripts are
   session-scoped and do NOT survive a session clear.
2. Write `reports/TASKn_REPORT.md`.
3. Update `change_action_log.md` (one row) and, for CS/data actions, `SUPPORT_RUNBOOK.md`.
4. Rotate `RESUME.md`: copy → `docs/resume_archive/RESUME_<date>[_x].md`, then rewrite the active stream to
   point at this plan + the next task. The RESUME must always name: current task, its step, baton state, and
   any running background agents (or "none").
5. Verify the baton is not mid-flight (turnOwner=codex with no watcher) before ending a session; if it is,
   note it in RESUME with re-entry instructions.

## R. HOW TO START / RESUME (for a fresh session)
1. Say "resume" → `RESUME.md` → points here. Or directly: **"Read `audit/deepfix/MASTER_TASK_PLAN.md` and
   continue from the task/step named in RESUME.md."** Fallback: if `RESUME.md` does not mention deepfix (e.g.
   it was rotated by an unrelated stream), start from THIS file — find the latest `reports/TASKn_REPORT.md`
   to locate the current position; if none exist, begin at Task 1 step 1.1.
2. Read §C-1 (SESSION_CONTEXT) fully; skim the rest of §C as needed.
3. Check `docs/plans/loop/baton.json` state before any Codex handoff.
4. First run starts at **Task 1, step 1.1**.
